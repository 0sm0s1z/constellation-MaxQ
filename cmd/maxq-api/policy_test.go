package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestApprovalsOffSkipsAutoReviewForBrowserSocial(t *testing.T) {
	root := t.TempDir()
	s := &server{
		prefix: root,
		config: filepath.Join(root, ".config", "maxq"),
	}

	set := httptest.NewRecorder()
	s.handlePolicy(set, httptest.NewRequest(http.MethodPost, "/policy", strings.NewReader(`{"enabled":false}`)))
	if set.Code != http.StatusOK {
		t.Fatalf("set policy status=%d body=%s", set.Code, set.Body.String())
	}
	policyBytes, err := os.ReadFile(s.policyPath())
	if err != nil {
		t.Fatal(err)
	}
	policyText := string(policyBytes)
	if !strings.Contains(policyText, `mode = "off"`) || !strings.Contains(policyText, `always_allow = true`) {
		t.Fatalf("policy.toml not canonical Off policy:\n%s", policyText)
	}

	cases := []struct {
		name         string
		hostSettings string
	}{
		{name: "host auto-review key absent", hostSettings: `{}`},
		{name: "host auto-review enabled", hostSettings: `{"autoReviewInstructions":{"isEnabled":true}}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			hostDir := filepath.Join(root, "sand-data")
			if err := os.MkdirAll(hostDir, 0o700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(hostDir, "settings.json"), []byte(tc.hostSettings), 0o600); err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/policy/decision", strings.NewReader(`{"action":"browserUse","channel":"social"}`))
			s.handlePolicyDecision(rr, req)
			if rr.Code != http.StatusOK {
				t.Fatalf("decision status=%d body=%s", rr.Code, rr.Body.String())
			}
			var got policyDecision
			if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.ApprovalRequired || !got.AllowWithoutReview || !got.SkipAutoReview {
				t.Fatalf("MaxQ Off policy did not bypass host review: %+v", got)
			}
			if got.Approvals.Mode != approvalModeOff || !got.Approvals.AlwaysAllow {
				t.Fatalf("wrong authoritative policy: %+v", got.Approvals)
			}
		})
	}
}

func TestApprovalsOnAllowsHostReview(t *testing.T) {
	s := &server{config: t.TempDir()}

	set := httptest.NewRecorder()
	s.handlePolicy(set, httptest.NewRequest(http.MethodPost, "/policy", strings.NewReader(`{"enabled":true}`)))
	if set.Code != http.StatusOK {
		t.Fatalf("set policy status=%d body=%s", set.Code, set.Body.String())
	}

	rr := httptest.NewRecorder()
	s.handlePolicyDecision(rr, httptest.NewRequest(http.MethodPost, "/policy/decision", strings.NewReader(`{"action":"browserUse","channel":"social"}`)))
	if rr.Code != http.StatusOK {
		t.Fatalf("decision status=%d body=%s", rr.Code, rr.Body.String())
	}
	var got policyDecision
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.ApprovalRequired || got.AllowWithoutReview || got.SkipAutoReview {
		t.Fatalf("MaxQ On policy unexpectedly bypassed host review: %+v", got)
	}
}

func TestMissingPolicyDefaultsToApprovalsOff(t *testing.T) {
	s := &server{config: t.TempDir()}
	rr := httptest.NewRecorder()
	s.handlePolicy(rr, httptest.NewRequest(http.MethodGet, "/policy", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("get policy status=%d body=%s", rr.Code, rr.Body.String())
	}
	var got policyState
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Approvals.Mode != approvalModeOff || !got.Approvals.AlwaysAllow || !got.SkipAutoReview {
		t.Fatalf("missing policy did not seed Off/always-allow: %+v", got)
	}
	if _, err := os.Stat(s.policyPath()); err != nil {
		t.Fatalf("policy.toml not persisted: %v", err)
	}
}
