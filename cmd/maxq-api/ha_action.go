package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	haConnectionFile = "ha-connection.json"
	haTokenFile      = "ha.token"
)

// haHTTPClient is replaced in unit tests.
var haHTTPClient = &http.Client{Timeout: 15 * time.Second}

type haConnectionFileData struct {
	BaseURL string `json:"base_url"`
}

type haConnectionState struct {
	BaseURL         string `json:"base_url"`
	TokenConfigured bool   `json:"token_configured"`
	Configured      bool   `json:"configured"`
	Source          string `json:"source"`
}

type haActionRequest struct {
	EntityID    string   `json:"entity_id"`
	Action      string   `json:"action"`
	Temperature *float64 `json:"temperature,omitempty"`
}

type haActionResult struct {
	OK       bool           `json:"ok"`
	EntityID string         `json:"entity_id"`
	Action   string         `json:"action"`
	Domain   string         `json:"domain,omitempty"`
	Service  string         `json:"service,omitempty"`
	Before   map[string]any `json:"before,omitempty"`
	After    map[string]any `json:"after,omitempty"`
	HAStatus int            `json:"ha_status,omitempty"`
	Error    string         `json:"error,omitempty"`
}

type haStateResult struct {
	OK       bool           `json:"ok"`
	EntityID string         `json:"entity_id"`
	State    map[string]any `json:"state,omitempty"`
	Error    string         `json:"error,omitempty"`
}

func (s *server) haConnectionPath() string {
	return filepath.Join(s.config, haConnectionFile)
}

func (s *server) haTokenPath() string {
	return filepath.Join(s.config, haTokenFile)
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func normalizeHABaseURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("base_url is required")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("base_url must be an absolute http(s) URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("base_url must use http or https")
	}
	if u.User != nil {
		return "", fmt.Errorf("base_url must not include credentials")
	}
	u.RawQuery = ""
	u.Fragment = ""
	u.Path = strings.TrimRight(u.Path, "/")
	return strings.TrimRight(u.String(), "/"), nil
}

func (s *server) loadHAConnection() (haConnectionState, error) {
	st := haConnectionState{Source: s.haConnectionPath()}
	b, err := os.ReadFile(s.haConnectionPath())
	if err != nil {
		if os.IsNotExist(err) {
			st.TokenConfigured = fileExists(s.haTokenPath())
			return st, nil
		}
		return st, err
	}
	var file haConnectionFileData
	if err := json.Unmarshal(b, &file); err != nil {
		return st, fmt.Errorf("read HA connection: %w", err)
	}
	st.BaseURL = strings.TrimRight(strings.TrimSpace(file.BaseURL), "/")
	st.TokenConfigured = fileExists(s.haTokenPath())
	st.Configured = st.BaseURL != "" && st.TokenConfigured
	return st, nil
}

func (s *server) saveHAConnection(baseURL, token string, clearToken bool) (haConnectionState, error) {
	normalized, err := normalizeHABaseURL(baseURL)
	if err != nil {
		return haConnectionState{}, err
	}
	if clearToken && strings.TrimSpace(token) != "" {
		return haConnectionState{}, fmt.Errorf("token and clear_token cannot be used together")
	}
	b, err := json.MarshalIndent(haConnectionFileData{BaseURL: normalized}, "", "  ")
	if err != nil {
		return haConnectionState{}, err
	}
	if err := writePrivateFileAtomic(s.config, "ha-connection-*.tmp", s.haConnectionPath(), append(b, '\n')); err != nil {
		return haConnectionState{}, err
	}
	if clearToken {
		_ = os.Remove(s.haTokenPath())
	} else if tok := strings.TrimSpace(token); tok != "" {
		if err := writePrivateFileAtomic(s.config, "ha-token-*.tmp", s.haTokenPath(), []byte(tok+"\n")); err != nil {
			return haConnectionState{}, err
		}
	}
	return s.loadHAConnection()
}

func (s *server) readHAToken() (string, error) {
	b, err := os.ReadFile(s.haTokenPath())
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("HA token not configured; install %s with mode 0600 (IT, not chat)", s.haTokenPath())
		}
		return "", err
	}
	tok := strings.TrimSpace(string(b))
	if tok == "" {
		return "", fmt.Errorf("HA token file is empty")
	}
	return tok, nil
}

func (s *server) haAllowlisted(entityID string) (bool, error) {
	al, err := s.loadHAAllowlist()
	if err != nil {
		return false, err
	}
	for _, e := range al.Entities {
		if e.ID == entityID {
			return true, nil
		}
	}
	return false, nil
}

func domainOfEntity(entityID string) string {
	parts := strings.SplitN(entityID, ".", 2)
	if len(parts) != 2 {
		return ""
	}
	return parts[0]
}

func resolveHAService(entityID, action string) (domain, service string, err error) {
	domain = domainOfEntity(entityID)
	action = strings.ToLower(strings.TrimSpace(action))
	switch action {
	case "turn_on", "on":
		switch domain {
		case "light", "switch", "input_boolean", "fan", "siren":
			return domain, "turn_on", nil
		default:
			return "", "", fmt.Errorf("action turn_on not supported for domain %q", domain)
		}
	case "turn_off", "off":
		switch domain {
		case "light", "switch", "input_boolean", "fan", "siren":
			return domain, "turn_off", nil
		default:
			return "", "", fmt.Errorf("action turn_off not supported for domain %q", domain)
		}
	case "toggle":
		switch domain {
		case "light", "switch", "input_boolean", "fan":
			return domain, "toggle", nil
		default:
			return "", "", fmt.Errorf("action toggle not supported for domain %q", domain)
		}
	case "set_temperature":
		if domain != "climate" {
			return "", "", fmt.Errorf("action set_temperature requires climate.* entity")
		}
		return domain, "set_temperature", nil
	default:
		return "", "", fmt.Errorf("unsupported action %q (use turn_on, turn_off, toggle, set_temperature)", action)
	}
}

func redactHAError(msg, token string) string {
	if token != "" {
		msg = strings.ReplaceAll(msg, token, "[redacted]")
	}
	return msg
}

func (s *server) haAPI(method, path string, body any) (int, map[string]any, error) {
	conn, err := s.loadHAConnection()
	if err != nil {
		return 0, nil, err
	}
	if conn.BaseURL == "" {
		return 0, nil, fmt.Errorf("HA base_url not configured")
	}
	token, err := s.readHAToken()
	if err != nil {
		return 0, nil, err
	}
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequest(method, conn.BaseURL+path, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := haHTTPClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("%s", redactHAError(err.Error(), token))
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var parsed any
	_ = json.Unmarshal(raw, &parsed)
	out := map[string]any{}
	switch v := parsed.(type) {
	case map[string]any:
		out = v
	case []any:
		out["results"] = v
	default:
		if len(raw) > 0 {
			out["raw"] = string(raw)
		}
	}
	if resp.StatusCode >= 400 {
		return resp.StatusCode, out, fmt.Errorf("HA %s %s returned %d", method, path, resp.StatusCode)
	}
	return resp.StatusCode, out, nil
}

func summarizeHAState(state map[string]any) map[string]any {
	if state == nil {
		return nil
	}
	summary := map[string]any{}
	if v, ok := state["state"]; ok {
		summary["state"] = v
	}
	if v, ok := state["entity_id"]; ok {
		summary["entity_id"] = v
	}
	if attrs, ok := state["attributes"].(map[string]any); ok {
		keep := map[string]any{}
		for _, key := range []string{"friendly_name", "temperature", "current_temperature", "brightness", "hvac_mode"} {
			if v, ok := attrs[key]; ok {
				keep[key] = v
			}
		}
		if len(keep) > 0 {
			summary["attributes"] = keep
		}
	}
	return summary
}

func (s *server) fetchHAState(entityID string) (map[string]any, int, error) {
	status, body, err := s.haAPI(http.MethodGet, "/api/states/"+url.PathEscape(entityID), nil)
	return body, status, err
}

func (s *server) handleHAConnection(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch r.Method {
	case http.MethodGet:
		st, err := s.loadHAConnection()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, st)
	case http.MethodPut:
		var req struct {
			BaseURL    string `json:"base_url"`
			Token      string `json:"token"`
			ClearToken bool   `json:"clear_token"`
		}
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
			return
		}
		st, err := s.saveHAConnection(req.BaseURL, req.Token, req.ClearToken)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":               true,
			"base_url":         st.BaseURL,
			"token_configured": st.TokenConfigured,
			"configured":       st.Configured,
			"source":           st.Source,
		})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *server) handleHAState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	entityID := strings.TrimSpace(r.PathValue("id"))
	if entityID == "" || !haEntityIDPattern.MatchString(entityID) {
		writeJSON(w, http.StatusBadRequest, haStateResult{OK: false, Error: "valid entity id required"})
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	ok, err := s.haAllowlisted(entityID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, haStateResult{OK: false, EntityID: entityID, Error: err.Error()})
		return
	}
	if !ok {
		writeJSON(w, http.StatusForbidden, haStateResult{OK: false, EntityID: entityID, Error: "entity not on HA allowlist"})
		return
	}
	state, _, err := s.fetchHAState(entityID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, haStateResult{OK: false, EntityID: entityID, Error: err.Error(), State: summarizeHAState(state)})
		return
	}
	writeJSON(w, http.StatusOK, haStateResult{OK: true, EntityID: entityID, State: summarizeHAState(state)})
}

func (s *server) handleHAAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req haActionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, haActionResult{OK: false, Error: "invalid json"})
		return
	}
	entityID := strings.TrimSpace(req.EntityID)
	if entityID == "" || !haEntityIDPattern.MatchString(entityID) {
		writeJSON(w, http.StatusBadRequest, haActionResult{OK: false, Error: "entity_id must be a valid Home Assistant entity id"})
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	ok, err := s.haAllowlisted(entityID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, haActionResult{OK: false, EntityID: entityID, Error: err.Error()})
		return
	}
	if !ok {
		writeJSON(w, http.StatusForbidden, haActionResult{OK: false, EntityID: entityID, Action: req.Action, Error: "entity not on HA allowlist"})
		return
	}

	domain, service, err := resolveHAService(entityID, req.Action)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, haActionResult{OK: false, EntityID: entityID, Action: req.Action, Error: err.Error()})
		return
	}
	if service == "set_temperature" && req.Temperature == nil {
		writeJSON(w, http.StatusBadRequest, haActionResult{OK: false, EntityID: entityID, Action: req.Action, Error: "temperature is required for set_temperature"})
		return
	}

	before, _, _ := s.fetchHAState(entityID)
	payload := map[string]any{"entity_id": entityID}
	if req.Temperature != nil {
		payload["temperature"] = *req.Temperature
	}
	status, _, err := s.haAPI(http.MethodPost, "/api/services/"+domain+"/"+service, payload)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, haActionResult{
			OK: false, EntityID: entityID, Action: req.Action, Domain: domain, Service: service,
			Before: summarizeHAState(before), HAStatus: status, Error: err.Error(),
		})
		return
	}
	after, _, _ := s.fetchHAState(entityID)
	writeJSON(w, http.StatusOK, haActionResult{
		OK: true, EntityID: entityID, Action: req.Action, Domain: domain, Service: service,
		Before: summarizeHAState(before), After: summarizeHAState(after), HAStatus: status,
	})
}
