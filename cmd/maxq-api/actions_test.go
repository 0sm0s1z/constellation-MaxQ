package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuiltinActions(t *testing.T) {
	acts := builtinActions()
	if len(acts) < 2 {
		t.Fatalf("want at least 2 actions, got %d", len(acts))
	}
	a, ok := actionByID("clear-ram")
	if !ok || a.Kind != actionKindPrompt || !a.Armed || a.Prompt == "" {
		t.Fatalf("clear-ram=%+v ok=%v", a, ok)
	}
	if strings.Contains(a.Prompt, "chrome-profile-5") || strings.Contains(a.Prompt, "DISPLAY :5") {
		t.Fatalf("clear-ram prompt still hardcodes :5: %q", a.Prompt)
	}
	if !strings.Contains(a.Prompt, "current") || !strings.Contains(a.Prompt, "maxq-api") {
		t.Fatalf("clear-ram prompt missing current/maxq-api guidance")
	}
	w, ok := actionByID("close-idle-tabs")
	if !ok || w.Armed {
		t.Fatalf("close-idle-tabs should exist and be unarmed: %+v", w)
	}

	en, ok := actionByID("ensure-novnc")
	if !ok || en.Kind != actionKindLocal || !en.Armed || en.Runner != "local" {
		t.Fatalf("ensure-novnc=%+v ok=%v", en, ok)
	}
	rp, ok := actionByID("resume-paused")
	if !ok || rp.Kind != actionKindLocal || !rp.Armed || rp.Runner != "local" {
		t.Fatalf("resume-paused=%+v ok=%v", rp, ok)
	}
	if rp.Label != "Resume paused desks" {
		t.Fatalf("resume-paused label=%q", rp.Label)
	}
	for _, id := range []string{"freeze-quiet-desks", "report-ram", "restart-websockify-only"} {
		a, ok := actionByID(id)
		if !ok || a.Kind != actionKindLocal || !a.Armed || a.Runner != "local" {
			t.Fatalf("%s=%+v ok=%v", id, a, ok)
		}
	}
	if len(builtinActions()) < 7 {
		t.Fatalf("want >=7 actions, got %d", len(builtinActions()))
	}
}

func TestActionRunUnknownAndUnarmed(t *testing.T) {
	s := &server{config: t.TempDir(), prefix: t.TempDir()}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/actions/nope/run", nil)
	req.SetPathValue("id", "nope")
	s.handleActionRun(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("unknown status=%d", rr.Code)
	}
	rr2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPost, "/actions/close-idle-tabs/run", nil)
	req2.SetPathValue("id", "close-idle-tabs")
	s.handleActionRun(rr2, req2)
	if rr2.Code != http.StatusConflict {
		t.Fatalf("unarmed status=%d body=%s", rr2.Code, rr2.Body.String())
	}
}

func TestHandleActionsListsCatalog(t *testing.T) {
	s := &server{config: t.TempDir(), prefix: t.TempDir()}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/actions", nil)
	s.handleActions(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d", rr.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	acts, ok := body["actions"].([]any)
	if !ok || len(acts) < 7 {
		t.Fatalf("actions=%v", body["actions"])
	}
}
