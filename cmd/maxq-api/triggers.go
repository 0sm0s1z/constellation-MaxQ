package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"
)

const (
	triggerTick             = 15 * time.Second
	defaultProbeCooldown    = 5 * time.Minute
	resourceMemCooldown     = 15 * time.Minute
	resourceMemAvailableMin = uint64(512 * 1024 * 1024)
	resourceMemUsedTrip     = 90.0
)

type triggerDef struct {
	ID              string `json:"id"`
	Kind            string `json:"kind"`
	Spec            string `json:"spec"`
	Hook            string `json:"hook"`
	Enabled         bool   `json:"enabled"`
	Builtin         bool   `json:"builtin,omitempty"`
	CooldownSeconds int    `json:"cooldown_seconds,omitempty"`
}

type triggerState struct {
	LastFire    string `json:"last_fire,omitempty"`
	LastAttempt string `json:"last_attempt,omitempty"`
}

type triggerView struct {
	triggerDef
	LastFire string `json:"last_fire"`
}

type triggersResp struct {
	Worker            string        `json:"worker"`
	Timezone          string        `json:"timezone"`
	WebhookConfigured bool          `json:"webhook_configured"`
	WebhookHint       string        `json:"webhook_hint"`
	Triggers          []triggerView `json:"triggers"`
}

type webhookReq struct {
	URL string `json:"url"`
}

type triggerAddReq struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Spec    string `json:"spec"`
	Enabled *bool  `json:"enabled"`
}

type triggerEnableReq struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

type hookPayload struct {
	Source  string         `json:"source"`
	Trigger string         `json:"trigger"`
	Level   string         `json:"level"`
	Message string         `json:"message"`
	Host    string         `json:"host"`
	Facts   map[string]any `json:"facts"`
}

func (s *server) hooksPath() string {
	return filepath.Join(s.config, "hooks.toml")
}

func (s *server) triggersPath() string {
	return filepath.Join(s.config, "triggers.json")
}

func (s *server) triggerStatePath() string {
	return filepath.Join(s.config, "triggers-state.json")
}

func builtinResourceTrigger() triggerDef {
	return triggerDef{
		ID:              "resource.mem",
		Kind:            "probe",
		Spec:            "builtin:mem",
		Hook:            "warning",
		Enabled:         true,
		Builtin:         true,
		CooldownSeconds: int(resourceMemCooldown / time.Second),
	}
}

func (s *server) ensureTriggerFiles() error {
	if err := os.MkdirAll(s.config, 0700); err != nil {
		return err
	}
	if _, err := os.Stat(s.hooksPath()); os.IsNotExist(err) {
		if err := atomicWrite(s.hooksPath(), []byte("# MaxQ hook destination. Empty disables hooks.\nwebhook_url = \"\"\n"), 0600); err != nil {
			return err
		}
	}
	defs, err := s.loadTriggerDefsRaw()
	if err != nil {
		return err
	}
	found := false
	for i := range defs {
		if defs[i].ID == "resource.mem" {
			defs[i].Builtin = true
			defs[i].Kind = "probe"
			defs[i].Spec = "builtin:mem"
			defs[i].Hook = "warning"
			if defs[i].CooldownSeconds <= 0 {
				defs[i].CooldownSeconds = int(resourceMemCooldown / time.Second)
			}
			found = true
			break
		}
	}
	if !found {
		defs = append(defs, builtinResourceTrigger())
	}
	return s.saveTriggerDefs(defs)
}

func atomicWrite(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, mode); err != nil {
		return err
	}
	if err := os.Chmod(tmp, mode); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func (s *server) loadTriggerDefsRaw() ([]triggerDef, error) {
	b, err := os.ReadFile(s.triggersPath())
	if os.IsNotExist(err) {
		return []triggerDef{}, nil
	}
	if err != nil {
		return nil, err
	}
	var defs []triggerDef
	if len(bytes.TrimSpace(b)) == 0 {
		return []triggerDef{}, nil
	}
	if err := json.Unmarshal(b, &defs); err != nil {
		return nil, fmt.Errorf("trigger definitions invalid")
	}
	return defs, nil
}

func (s *server) loadTriggerDefs() ([]triggerDef, error) {
	if err := s.ensureTriggerFiles(); err != nil {
		return nil, err
	}
	return s.loadTriggerDefsRaw()
}

func (s *server) saveTriggerDefs(defs []triggerDef) error {
	sort.SliceStable(defs, func(i, j int) bool {
		if defs[i].Builtin != defs[j].Builtin {
			return defs[i].Builtin
		}
		return defs[i].ID < defs[j].ID
	})
	b, err := json.MarshalIndent(defs, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	return atomicWrite(s.triggersPath(), b, 0600)
}

func (s *server) loadTriggerStates() map[string]triggerState {
	b, err := os.ReadFile(s.triggerStatePath())
	if err != nil {
		return map[string]triggerState{}
	}
	states := map[string]triggerState{}
	if json.Unmarshal(b, &states) != nil {
		return map[string]triggerState{}
	}
	return states
}

func (s *server) saveTriggerStates(states map[string]triggerState) error {
	b, err := json.MarshalIndent(states, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	return atomicWrite(s.triggerStatePath(), b, 0600)
}

func (s *server) readWebhookURL() string {
	b, err := os.ReadFile(s.hooksPath())
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(b), "\n") {
		trim := strings.TrimSpace(line)
		if trim == "" || strings.HasPrefix(trim, "#") {
			continue
		}
		name, rest, ok := strings.Cut(trim, "=")
		if !ok || strings.TrimSpace(name) != "webhook_url" {
			continue
		}
		v := strings.TrimSpace(rest)
		if u, err := strconv.Unquote(v); err == nil {
			return strings.TrimSpace(u)
		}
		return strings.Trim(strings.TrimSpace(v), "\"")
	}
	return ""
}

func validateWebhookURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return "", fmt.Errorf("webhook must be an HTTPS URL without userinfo")
	}
	return u.String(), nil
}

func webhookHint(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host + "/…"
}

func (s *server) writeWebhookURL(raw string) error {
	clean, err := validateWebhookURL(raw)
	if err != nil {
		return err
	}
	content := "# MaxQ hook destination. Empty disables hooks.\nwebhook_url = " + strconv.Quote(clean) + "\n"
	return atomicWrite(s.hooksPath(), []byte(content), 0600)
}

func (s *server) triggerResponse() (triggersResp, error) {
	defs, err := s.loadTriggerDefs()
	if err != nil {
		return triggersResp{}, err
	}
	states := s.loadTriggerStates()
	views := make([]triggerView, 0, len(defs))
	for _, def := range defs {
		views = append(views, triggerView{triggerDef: def, LastFire: states[def.ID].LastFire})
	}
	webhook := s.readWebhookURL()
	return triggersResp{
		Worker:            "maxq-api",
		Timezone:          "America/Los_Angeles",
		WebhookConfigured: webhook != "",
		WebhookHint:       webhookHint(webhook),
		Triggers:          views,
	}, nil
}

func (s *server) handleTriggers(w http.ResponseWriter, r *http.Request) {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()
	resp, err := s.triggerResponse()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *server) handleWebhook(w http.ResponseWriter, r *http.Request) {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()
	var req webhookReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	if err := s.ensureTriggerFiles(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := s.writeWebhookURL(req.URL); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "configured": strings.TrimSpace(req.URL) != ""})
}

func (s *server) handleTriggerAdd(w http.ResponseWriter, r *http.Request) {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()
	var req triggerAddReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	id := strings.TrimSpace(req.ID)
	kind := strings.ToLower(strings.TrimSpace(req.Kind))
	spec := strings.TrimSpace(req.Spec)
	if err := validateTriggerID(id); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if id == "resource.mem" {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "resource.mem is builtin"})
		return
	}
	if kind != "schedule" && kind != "probe" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "kind must be schedule or probe"})
		return
	}
	if spec == "" || len(spec) > 512 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "spec must be 1-512 characters"})
		return
	}
	if kind == "schedule" {
		if _, err := parseCron(spec); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid 5-field cron"})
			return
		}
	}
	defs, err := s.loadTriggerDefs()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	for _, def := range defs {
		if def.ID == id {
			writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "trigger id already exists"})
			return
		}
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	cooldown := int(defaultProbeCooldown / time.Second)
	if kind == "schedule" {
		cooldown = 60
	}
	defs = append(defs, triggerDef{ID: id, Kind: kind, Spec: spec, Hook: "default", Enabled: enabled, CooldownSeconds: cooldown})
	if err := s.saveTriggerDefs(defs); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (s *server) handleTriggerEnable(w http.ResponseWriter, r *http.Request) {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()
	var req triggerEnableReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	id := strings.TrimSpace(req.ID)
	defs, err := s.loadTriggerDefs()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	found := false
	for i := range defs {
		if defs[i].ID == id {
			defs[i].Enabled = req.Enabled
			found = true
			break
		}
	}
	if !found {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "trigger not found"})
		return
	}
	if err := s.saveTriggerDefs(defs); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id, "enabled": req.Enabled})
}

func (s *server) handleTriggerTest(w http.ResponseWriter, r *http.Request) {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()
	if err := s.ensureTriggerFiles(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	webhook := s.readWebhookURL()
	if webhook == "" {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "webhook is not configured"})
		return
	}
	payload := hookPayload{Source: "maxq", Trigger: "test", Level: "info", Message: "MaxQ webhook test", Host: safeHostname(), Facts: map[string]any{}}
	if err := postHook(webhook, payload); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func validateTriggerID(id string) error {
	if id == "" || len(id) > 64 {
		return fmt.Errorf("id must be 1-64 characters")
	}
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '_' || r == '-' {
			continue
		}
		return fmt.Errorf("id may contain only letters, numbers, dot, underscore, dash")
	}
	return nil
}

func (s *server) runTriggerLoop() {
	if err := s.ensureTriggerFiles(); err != nil {
		fmt.Fprintln(os.Stderr, "maxq-hooks: trigger store unavailable")
		return
	}
	ticker := time.NewTicker(triggerTick)
	defer ticker.Stop()
	for {
		s.evaluateTriggers(time.Now())
		<-ticker.C
	}
}

func (s *server) evaluateTriggers(now time.Time) {
	webhook := s.readWebhookURL()
	if webhook == "" {
		return
	}
	defs, err := s.loadTriggerDefsRaw()
	if err != nil {
		return
	}
	states := s.loadTriggerStates()
	changed := false
	for _, def := range defs {
		if !def.Enabled {
			continue
		}
		state := states[def.ID]
		if !cooldownReady(state.LastAttempt, defCooldown(def), now) {
			continue
		}
		fire, level, message, facts := false, "info", "", map[string]any{}
		switch def.Kind {
		case "schedule":
			loc, err := time.LoadLocation("America/Los_Angeles")
			if err != nil {
				loc = time.Local
			}
			localNow := now.In(loc)
			if cronMatches(def.Spec, localNow) && !sameMinute(state.LastFire, localNow) {
				fire = true
				message = "schedule " + def.ID + " fired"
			}
		case "probe":
			if def.ID == "resource.mem" || def.Spec == "builtin:mem" {
				fire, facts = resourceMemProbe()
				if fire {
					level = "warning"
					message = "warning resource limits exhausted: OOM"
				}
			} else if runShellProbe(def.Spec) {
				fire = true
				message = "probe " + def.ID + " matched"
			}
		}
		if !fire {
			continue
		}
		state.LastAttempt = now.UTC().Format(time.RFC3339)
		states[def.ID] = state
		changed = true
		payload := hookPayload{Source: "maxq", Trigger: def.ID, Level: level, Message: message, Host: safeHostname(), Facts: facts}
		if err := postHook(webhook, payload); err == nil {
			state.LastFire = now.UTC().Format(time.RFC3339)
			states[def.ID] = state
		}
	}
	if changed {
		_ = s.saveTriggerStates(states)
	}
}

func defCooldown(def triggerDef) time.Duration {
	if def.CooldownSeconds > 0 {
		return time.Duration(def.CooldownSeconds) * time.Second
	}
	if def.ID == "resource.mem" {
		return resourceMemCooldown
	}
	if def.Kind == "schedule" {
		return time.Minute
	}
	return defaultProbeCooldown
}

func cooldownReady(last string, cooldown time.Duration, now time.Time) bool {
	if last == "" {
		return true
	}
	t, err := time.Parse(time.RFC3339, last)
	if err != nil {
		return true
	}
	return now.Sub(t) >= cooldown
}

func sameMinute(last string, now time.Time) bool {
	if last == "" {
		return false
	}
	t, err := time.Parse(time.RFC3339, last)
	if err != nil {
		return false
	}
	t = t.In(now.Location())
	return t.Year() == now.Year() && t.YearDay() == now.YearDay() && t.Hour() == now.Hour() && t.Minute() == now.Minute()
}

func runShellProbe(spec string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/bin/sh", "-c", spec)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	return cmd.Run() == nil
}

func resourceMemProbe() (bool, map[string]any) {
	mem, err := readMemInfo()
	if err != nil {
		return false, map[string]any{}
	}
	total := mem["MemTotal"] * 1024
	available := mem["MemAvailable"] * 1024
	if total == 0 || available > total {
		return false, map[string]any{}
	}
	usedPct := 100 * float64(total-available) / float64(total)
	facts := map[string]any{"mem_available_bytes": available, "mem_used_percent": usedPct, "swap_total_bytes": mem["SwapTotal"] * 1024}
	return available < resourceMemAvailableMin || usedPct >= resourceMemUsedTrip, facts
}

func safeHostname() string {
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		return "unknown"
	}
	return host
}

func postHook(rawURL string, payload hookPayload) error {
	clean, err := validateWebhookURL(rawURL)
	if err != nil || clean == "" {
		return fmt.Errorf("webhook is not configured")
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, clean, bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("webhook request invalid")
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook POST failed")
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook POST returned %d", resp.StatusCode)
	}
	return nil
}

type cronSpec struct {
	minute string
	hour   string
	dom    string
	month  string
	dow    string
}

func parseCron(spec string) (cronSpec, error) {
	fields := strings.Fields(spec)
	if len(fields) != 5 {
		return cronSpec{}, fmt.Errorf("cron needs 5 fields")
	}
	c := cronSpec{minute: fields[0], hour: fields[1], dom: fields[2], month: fields[3], dow: fields[4]}
	checks := []struct {
		field    string
		min, max int
	}{{c.minute, 0, 59}, {c.hour, 0, 23}, {c.dom, 1, 31}, {c.month, 1, 12}, {c.dow, 0, 6}}
	for _, check := range checks {
		if _, err := cronFieldMatch(check.field, check.min, check.min, check.max); err != nil {
			return cronSpec{}, err
		}
	}
	return c, nil
}

func cronMatches(spec string, t time.Time) bool {
	c, err := parseCron(spec)
	if err != nil {
		return false
	}
	minute, _ := cronFieldMatch(c.minute, t.Minute(), 0, 59)
	hour, _ := cronFieldMatch(c.hour, t.Hour(), 0, 23)
	month, _ := cronFieldMatch(c.month, int(t.Month()), 1, 12)
	dom, _ := cronFieldMatch(c.dom, t.Day(), 1, 31)
	dow, _ := cronFieldMatch(c.dow, int(t.Weekday()), 0, 6)
	if !minute || !hour || !month {
		return false
	}
	domAny := c.dom == "*"
	dowAny := c.dow == "*"
	switch {
	case domAny && dowAny:
		return true
	case domAny:
		return dow
	case dowAny:
		return dom
	default:
		return dom || dow
	}
}

func cronFieldMatch(field string, value, min, max int) (bool, error) {
	for _, part := range strings.Split(field, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			return false, fmt.Errorf("empty cron part")
		}
		step := 1
		base := part
		if strings.Contains(part, "/") {
			pieces := strings.Split(part, "/")
			if len(pieces) != 2 {
				return false, fmt.Errorf("bad cron step")
			}
			base = pieces[0]
			var err error
			step, err = strconv.Atoi(pieces[1])
			if err != nil || step <= 0 {
				return false, fmt.Errorf("bad cron step")
			}
		}
		start, end := min, max
		switch {
		case base == "*":
		case strings.Contains(base, "-"):
			pieces := strings.Split(base, "-")
			if len(pieces) != 2 {
				return false, fmt.Errorf("bad cron range")
			}
			var err error
			start, err = strconv.Atoi(pieces[0])
			if err != nil {
				return false, fmt.Errorf("bad cron range")
			}
			end, err = strconv.Atoi(pieces[1])
			if err != nil {
				return false, fmt.Errorf("bad cron range")
			}
		default:
			n, err := strconv.Atoi(base)
			if err != nil {
				return false, fmt.Errorf("bad cron value")
			}
			start, end = n, n
		}
		if start < min || end > max || start > end {
			return false, fmt.Errorf("cron value out of range")
		}
		if value >= start && value <= end && (value-start)%step == 0 {
			return true, nil
		}
	}
	return false, nil
}
