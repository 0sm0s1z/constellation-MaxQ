package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const entitlementsSemantics = "merged-allow-deny-with-source-labels"

type entitlementEntry struct {
	Action string `json:"action"`
	Kind   string `json:"kind"`
	Value  string `json:"value"`
	Label  string `json:"label,omitempty"`
	Source string `json:"source"`
}

type entitlementsFile struct {
	Entries []entitlementEntry `json:"entries"`
}

type entitlementsState struct {
	Entries   []entitlementEntry `json:"entries"`
	Source    string             `json:"source"`
	Semantics string             `json:"semantics"`
}

var entitlementKinds = map[string]struct{}{
	"host":      {},
	"cidr":      {},
	"service":   {},
	"ha-entity": {},
	"network":   {},
	"tag":       {},
}

func (s *server) entitlementsPath() string {
	return filepath.Join(s.config, "entitlements.json")
}

func normalizeOperatorEntitlements(entries []entitlementEntry) ([]entitlementEntry, error) {
	normalized := make([]entitlementEntry, 0, len(entries))
	seen := make(map[string]struct{}, len(entries))
	for i, entry := range entries {
		action := strings.ToLower(strings.TrimSpace(entry.Action))
		if action != "allow" && action != "deny" {
			return nil, fmt.Errorf("entries[%d].action must be allow or deny", i)
		}
		kind := strings.ToLower(strings.TrimSpace(entry.Kind))
		if _, ok := entitlementKinds[kind]; !ok {
			return nil, fmt.Errorf("entries[%d].kind %q is not supported", i, kind)
		}
		value := strings.TrimSpace(entry.Value)
		if value == "" {
			return nil, fmt.Errorf("entries[%d].value is required", i)
		}
		if len(value) > 512 || strings.ContainsAny(value, "\r\n\t") {
			return nil, fmt.Errorf("entries[%d].value is invalid", i)
		}
		label := strings.TrimSpace(entry.Label)
		if len(label) > 200 || strings.ContainsAny(label, "\r\n") {
			return nil, fmt.Errorf("entries[%d].label is invalid", i)
		}
		source := strings.ToLower(strings.TrimSpace(entry.Source))
		if source != "" && source != "operator" {
			return nil, fmt.Errorf("entries[%d].source must be operator for PUT entries", i)
		}
		if kind == "cidr" {
			if _, _, err := net.ParseCIDR(value); err != nil {
				return nil, fmt.Errorf("entries[%d].value %q is not a valid CIDR", i, value)
			}
		}
		if kind == "ha-entity" && !haEntityIDPattern.MatchString(value) {
			return nil, fmt.Errorf("entries[%d].value %q is not a valid Home Assistant entity id", i, value)
		}
		if kind == "host" && strings.ContainsAny(value, " /\\") {
			return nil, fmt.Errorf("entries[%d].value %q is not a valid host value", i, value)
		}
		key := action + "\x00" + kind + "\x00" + value
		if _, duplicate := seen[key]; duplicate {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, entitlementEntry{
			Action: action,
			Kind:   kind,
			Value:  value,
			Label:  label,
			Source: "operator",
		})
	}
	return normalized, nil
}

func (s *server) loadOperatorEntitlements() ([]entitlementEntry, error) {
	b, err := os.ReadFile(s.entitlementsPath())
	if os.IsNotExist(err) {
		return []entitlementEntry{}, nil
	}
	if err != nil {
		return nil, err
	}
	var file entitlementsFile
	if err := json.Unmarshal(b, &file); err != nil {
		return nil, fmt.Errorf("read entitlements: %w", err)
	}
	entries, err := normalizeOperatorEntitlements(file.Entries)
	if err != nil {
		return nil, fmt.Errorf("read entitlements: %w", err)
	}
	return entries, nil
}

func (s *server) saveOperatorEntitlements(entries []entitlementEntry) ([]entitlementEntry, error) {
	normalized, err := normalizeOperatorEntitlements(entries)
	if err != nil {
		return nil, err
	}
	b, err := json.MarshalIndent(entitlementsFile{Entries: normalized}, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := writePrivateFileAtomic(s.config, "entitlements-*.tmp", s.entitlementsPath(), append(b, '\n')); err != nil {
		return nil, err
	}
	return normalized, nil
}

func (s *server) mergedEntitlements() (entitlementsState, error) {
	operatorEntries, err := s.loadOperatorEntitlements()
	if err != nil {
		return entitlementsState{}, err
	}
	entries := append([]entitlementEntry{}, operatorEntries...)

	ha, err := s.loadHAAllowlist()
	if err != nil {
		return entitlementsState{}, err
	}
	for _, entity := range ha.Entities {
		entries = append(entries, entitlementEntry{
			Action: "allow",
			Kind:   "ha-entity",
			Value:  entity.ID,
			Label:  entity.Label,
			Source: "ha-allowlist",
		})
	}

	network, err := s.loadNetworkConfig()
	if err != nil {
		return entitlementsState{}, err
	}
	status := s.loadNetworkStatus()
	action := "deny"
	stateLabel := "not joined by MaxQ"
	if status == "up" {
		action = "allow"
		stateLabel = "up"
	} else if status == "down" {
		stateLabel = "disconnected"
	}
	entries = append(entries, entitlementEntry{
		Action: action,
		Kind:   "network",
		Value:  network.Mode,
		Label:  "MaxQ network marker: " + stateLabel,
		Source: "network",
	})

	listen := strings.TrimSpace(s.listen)
	if listen == "" {
		listen = defaultListen
	}
	entries = append(entries, entitlementEntry{
		Action: "allow",
		Kind:   "service",
		Value:  listen,
		Label:  "MaxQ loopback control API",
		Source: "maxq",
	})

	return entitlementsState{
		Entries:   entries,
		Source:    s.entitlementsPath(),
		Semantics: entitlementsSemantics,
	}, nil
}

func rejectSecretFields(value any) error {
	switch v := value.(type) {
	case map[string]any:
		for key, child := range v {
			lower := strings.ToLower(strings.TrimSpace(key))
			for _, marker := range []string{"auth_key", "authkey", "password", "token", "secret", "credential", "authorization"} {
				if strings.Contains(lower, marker) {
					return fmt.Errorf("secret-looking field %q is not allowed in entitlements", key)
				}
			}
			if err := rejectSecretFields(child); err != nil {
				return err
			}
		}
	case []any:
		for _, child := range v {
			if err := rejectSecretFields(child); err != nil {
				return err
			}
		}
	}
	return nil
}

func decodeEntitlementsFile(r *http.Request) (entitlementsFile, error) {
	var raw any
	if err := decodeJSON(r, &raw); err != nil {
		return entitlementsFile{}, fmt.Errorf("invalid json")
	}
	if err := rejectSecretFields(raw); err != nil {
		return entitlementsFile{}, err
	}
	b, err := json.Marshal(raw)
	if err != nil {
		return entitlementsFile{}, fmt.Errorf("invalid json")
	}
	var file entitlementsFile
	if err := json.Unmarshal(b, &file); err != nil {
		return entitlementsFile{}, fmt.Errorf("invalid entitlements payload")
	}
	return file, nil
}

func (s *server) handleEntitlements(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch r.Method {
	case http.MethodGet:
		state, err := s.mergedEntitlements()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, state)
	case http.MethodPut:
		file, err := decodeEntitlementsFile(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		if _, err := s.saveOperatorEntitlements(file.Entries); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		state, err := s.mergedEntitlements()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":        true,
			"entries":   state.Entries,
			"source":    state.Source,
			"semantics": state.Semantics,
		})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
