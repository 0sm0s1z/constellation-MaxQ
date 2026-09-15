package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type actionKind string

const (
	actionKindPrompt  actionKind = "prompt"
	actionKindWebhook actionKind = "webhook"
	actionKindLocal   actionKind = "local"
)

type maxqAction struct {
	ID          string     `json:"id"`
	Label       string     `json:"label"`
	Description string     `json:"description"`
	Kind        actionKind `json:"kind"`
	Scope       string     `json:"scope"`
	Runner      string     `json:"runner"`
	Binds       []string   `json:"binds"`
	Prompt      string     `json:"prompt,omitempty"`
	Webhook     string     `json:"webhook,omitempty"`
	Armed       bool       `json:"armed"`
}

type actionRun struct {
	ID        string `json:"id"`
	ActionID  string `json:"action_id"`
	Label     string `json:"label"`
	State     string `json:"state"`
	Detail    string `json:"detail"`
	StartedAt string `json:"started_at"`
	EndedAt   string `json:"ended_at,omitempty"`
}

type actionStore struct {
	mu   sync.Mutex
	runs map[string]*actionRun
}

var actionRuns = actionStore{runs: map[string]*actionRun{}}

const actionRunsKeep = 20

func (s *server) actionRunsPath() string {
	return filepath.Join(s.config, "action-runs.json")
}

func trimActionRunsLocked() {
	if len(actionRuns.runs) <= actionRunsKeep {
		return
	}
	all := make([]*actionRun, 0, len(actionRuns.runs))
	for _, r := range actionRuns.runs {
		all = append(all, r)
	}
	sort.Slice(all, func(i, j int) bool {
		return all[i].StartedAt > all[j].StartedAt
	})
	actionRuns.runs = make(map[string]*actionRun, actionRunsKeep)
	for _, r := range all[:actionRunsKeep] {
		actionRuns.runs[r.ID] = r
	}
}

func (s *server) loadActionRuns() {
	b, err := os.ReadFile(s.actionRunsPath())
	if err != nil {
		return
	}
	var list []actionRun
	if json.Unmarshal(b, &list) != nil {
		return
	}
	actionRuns.mu.Lock()
	defer actionRuns.mu.Unlock()
	for i := range list {
		cp := list[i]
		if cp.ID == "" {
			continue
		}
		actionRuns.runs[cp.ID] = &cp
	}
	trimActionRunsLocked()
}

func (s *server) persistActionRuns() {
	actionRuns.mu.Lock()
	trimActionRunsLocked()
	all := make([]actionRun, 0, len(actionRuns.runs))
	for _, r := range actionRuns.runs {
		all = append(all, *r)
	}
	actionRuns.mu.Unlock()
	sort.Slice(all, func(i, j int) bool {
		return all[i].StartedAt > all[j].StartedAt
	})
	if len(all) > actionRunsKeep {
		all = all[:actionRunsKeep]
	}
	b, err := json.MarshalIndent(all, "", "  ")
	if err != nil {
		return
	}
	_ = os.MkdirAll(s.config, 0o700)
	_ = os.WriteFile(s.actionRunsPath(), append(b, '\n'), 0o600)
}

func builtinActions() []maxqAction {
	return []maxqAction{
		{
			ID:          "clear-ram",
			Label:       "Clear RAM",
			Description: "Ask OpenCode to intelligently free memory without killing live agent work.",
			Kind:        actionKindPrompt,
			Scope:       "box",
			Runner:      "opencode",
			Binds:       []string{"stream.ram", "stream", "crew.desktop"},
			Prompt:      clearRAMPrompt,
			Armed:       true,
		},
		{
			ID:          "close-idle-tabs",
			Label:       "Close idle tabs",
			Description: "Fleet webhook: tell CXN-Control to close unnecessary Chrome tabs. Unarmed until a webhook URL is configured.",
			Kind:        actionKindWebhook,
			Scope:       "fleet",
			Runner:      "webhook",
			Binds:       []string{"stream"},
			Armed:       false,
		},
		{
			ID:          "ensure-novnc",
			Label:       "Ensure noVNC",
			Description: "Start websockify for live desks that already have x11vnc but no viewer yet.",
			Kind:        actionKindLocal,
			Scope:       "box",
			Runner:      "local",
			Binds:       []string{"stream", "crew.desktop"},
			Armed:       true,
		},
		{
			ID:          "resume-paused",
			Label:       "Resume paused desks",
			Description: "SIGCONT all live desks that are frozen/paused, except the current agent display.",
			Kind:        actionKindLocal,
			Scope:       "box",
			Runner:      "local",
			Binds:       []string{"stream", "crew.desktop"},
			Armed:       true,
		},
		{
			ID:          "freeze-quiet-desks",
			Label:       "Freeze quiet desks",
			Description: "SIGSTOP non-current idle/quiet desks for RAM relief. Skips current agent, busy desks, and already-frozen. Manual only — never auto-fire.",
			Kind:        actionKindLocal,
			Scope:       "box",
			Runner:      "local",
			Binds:       []string{"stream.ram", "stream", "crew.desktop"},
			Armed:       true,
		},
		{
			ID:          "report-ram",
			Label:       "Report RAM",
			Description: "Read /proc/meminfo and return used/available/total GiB plus swap note as local JSON (no kills).",
			Kind:        actionKindLocal,
			Scope:       "box",
			Runner:      "local",
			Binds:       []string{"stream.ram", "stream", "crew.desktop"},
			Armed:       true,
		},
		{
			ID:          "restart-websockify-only",
			Label:       "Restart websockify only",
			Description: "Restart noVNC/websockify for live desks that already have x11vnc. Never kills Xvfb, Chrome, or x11vnc.",
			Kind:        actionKindLocal,
			Scope:       "box",
			Runner:      "local",
			Binds:       []string{"stream", "crew.desktop"},
			Armed:       true,
		},
	}
}

const clearRAMPrompt = `You are MaxQ on grokbot. Intelligently free RAM to speed up the box.

Hard rules:
- Do not kill the *current* operator agent's DISPLAY / Xvfb / chrome-profile (whatever /desktops marks current, or maxq reports as agent_display). Never assume a fixed display like :5.
- Do not kill maxq-api, gost, or Xvfb for desktops that still look live/busy.
- Prefer leftover renderer zombies and clearly-idle Chromes (no recent CPU, not current).
- Do not rewrite Chrome CONNECT, cxn-egress.json, or /tmp/sand-egress-proxy.
- Stay off 10.0.0.0/16.
- Report RAM used/total in GiB before and after, plus what you skipped vs reaped.
`

func actionByID(id string) (maxqAction, bool) {
	for _, a := range builtinActions() {
		if a.ID == id {
			return a, true
		}
	}
	return maxqAction{}, false
}

func (s *server) handleActions(w http.ResponseWriter, r *http.Request) {
	actionRuns.mu.Lock()
	recent := make([]*actionRun, 0, len(actionRuns.runs))
	for _, run := range actionRuns.runs {
		cp := *run
		recent = append(recent, &cp)
	}
	actionRuns.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"actions": builtinActions(),
		"runs":    recent,
	})
}

func (s *server) handleActionRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a, ok := actionByID(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "unknown action"})
		return
	}
	if !a.Armed {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": "action not armed"})
		return
	}
	run := &actionRun{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		ActionID:  a.ID,
		Label:     a.Label,
		State:     "queued",
		Detail:    "starting",
		StartedAt: time.Now().UTC().Format(time.RFC3339),
	}
	actionRuns.mu.Lock()
	actionRuns.runs[run.ID] = run
	trimActionRunsLocked()
	actionRuns.mu.Unlock()
	s.persistActionRuns()
	go s.execAction(a, run)
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "run": run})
}

func (s *server) handleActionRunGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	actionRuns.mu.Lock()
	run, ok := actionRuns.runs[id]
	var cp actionRun
	if ok {
		cp = *run
	}
	actionRuns.mu.Unlock()
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"ok": false, "error": "unknown run"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "run": cp})
}

func (s *server) execAction(a maxqAction, run *actionRun) {
	setRun := func(state, detail string) {
		actionRuns.mu.Lock()
		run.State = state
		run.Detail = detail
		terminal := state == "ok" || state == "error"
		if terminal {
			run.EndedAt = time.Now().UTC().Format(time.RFC3339)
		}
		actionRuns.mu.Unlock()
		if terminal {
			s.persistActionRuns()
		}
	}
	setRun("running", "dispatching "+string(a.Kind))
	switch a.Kind {
	case actionKindPrompt:
		bin := filepath.Join(s.prefix, "bin", "opencode")
		if _, err := os.Stat(bin); err != nil {
			setRun("error", "opencode not installed")
			return
		}
		dir := filepath.Join(s.config, "runs")
		if err := os.MkdirAll(dir, 0o700); err != nil {
			setRun("error", err.Error())
			return
		}
		logPath := filepath.Join(dir, run.ID+".log")
		f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
		if err != nil {
			setRun("error", err.Error())
			return
		}
		defer f.Close()
		cmd := exec.Command(bin, "run", "-m", "constellation-router/auto", "--", a.Prompt)
		cmd.Dir = s.prefix
		cmd.Stdout = f
		cmd.Stderr = f
		if err := cmd.Start(); err != nil {
			setRun("error", err.Error())
			return
		}
		setRun("running", fmt.Sprintf("opencode pid %d", cmd.Process.Pid))
		if err := cmd.Wait(); err != nil {
			setRun("error", err.Error())
			return
		}
		setRun("ok", "opencode finished")
	case actionKindLocal:
		switch a.ID {
		case "ensure-novnc":
			res := ensureDesktopViewers()
			detail := fmt.Sprintf("started %d · ready %d · no-vnc %d", res.StartedCount, res.ReadyCount, res.NoVNCCount)
			if len(res.Errors) > 0 {
				detail += " · errors " + strings.Join(res.Errors, "; ")
				setRun("error", detail)
				return
			}
			setRun("ok", detail)
		case "resume-paused":
			res := s.resumePausedDesktops()
			detail := fmt.Sprintf("resumed %d · signaled %d", res.ResumedCount, res.Signaled)
			if len(res.Skipped) > 0 {
				detail += " · skipped " + strings.Join(res.Skipped, "; ")
			}
			if len(res.Errors) > 0 {
				detail += " · errors " + strings.Join(res.Errors, "; ")
				setRun("error", detail)
				return
			}
			setRun("ok", detail)
		case "freeze-quiet-desks":
			res := s.freezeQuietDesktops()
			detail := fmt.Sprintf("frozen %d · signaled %d", res.FrozenCount, res.Signaled)
			if len(res.Skipped) > 0 {
				detail += " · skipped " + strings.Join(res.Skipped, "; ")
			}
			if len(res.Errors) > 0 {
				detail += " · errors " + strings.Join(res.Errors, "; ")
				setRun("error", detail)
				return
			}
			setRun("ok", detail)
		case "report-ram":
			mem := readMemSnapshot()
			payload := map[string]any{
				"ram_percent":         mem.Percent,
				"ram_used_bytes":      mem.Used,
				"ram_total_bytes":     mem.Total,
				"ram_available_bytes": mem.Available,
				"swap_total_bytes":    mem.SwapTotal,
				"swap_free_bytes":     mem.SwapFree,
				"swap_enabled":        mem.SwapEnabled,
				"swap_note":           mem.SwapNote,
				"source":              "/proc/meminfo",
			}
			b, err := json.Marshal(payload)
			if err != nil {
				setRun("error", err.Error())
				return
			}
			gib := func(n uint64) float64 { return float64(n) / (1024 * 1024 * 1024) }
			detail := fmt.Sprintf(
				"avail %.1f / total %.1f GiB (%.0f%% used) · swap %s · %s · json=%s",
				gib(mem.Available), gib(mem.Total), mem.Percent,
				map[bool]string{true: "on", false: "0"}[mem.SwapEnabled],
				mem.SwapNote, string(b),
			)
			setRun("ok", detail)
		case "restart-websockify-only":
			res := restartWebsockifyOnly()
			detail := fmt.Sprintf("restarted %d · no-vnc %d", res.Count, len(res.SkippedNoVNC))
			if len(res.Errors) > 0 {
				detail += " · errors " + strings.Join(res.Errors, "; ")
				setRun("error", detail)
				return
			}
			setRun("ok", detail)
		default:
			setRun("error", "unknown local action")
			return
		}
	case actionKindWebhook:
		if a.Webhook == "" {
			setRun("error", "webhook not configured")
			return
		}
		body, err := json.Marshal(map[string]any{"action": a.ID, "scope": a.Scope, "host": "grokbot"})
		if err != nil {
			setRun("error", err.Error())
			return
		}
		resp, err := http.Post(a.Webhook, "application/json", bytes.NewReader(body))
		if err != nil {
			setRun("error", err.Error())
			return
		}
		resp.Body.Close()
		if resp.StatusCode >= 300 {
			setRun("error", fmt.Sprintf("webhook %d", resp.StatusCode))
			return
		}
		setRun("ok", "webhook accepted")
	default:
		setRun("error", "unknown kind")
	}
}
