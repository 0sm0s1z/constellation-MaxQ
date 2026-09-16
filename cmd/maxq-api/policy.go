package main

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const (
	approvalModeOff = "off"
	approvalModeOn  = "on"
)

type approvalPolicy struct {
	Mode        string `json:"mode"`
	AlwaysAllow bool   `json:"always_allow"`
}

type policyState struct {
	Approvals      approvalPolicy `json:"approvals"`
	Network        networkState   `json:"network"`
	Source         string         `json:"source"`
	SkipAutoReview bool           `json:"skip_auto_review"`
}

type policyUpdateReq struct {
	Enabled *bool             `json:"enabled"`
	Network *networkUpdateReq `json:"network,omitempty"`
}

type policyDecisionReq struct {
	Action  string `json:"action"`
	Channel string `json:"channel"`
}

type policyDecision struct {
	Action             string         `json:"action,omitempty"`
	Channel            string         `json:"channel,omitempty"`
	ApprovalRequired   bool           `json:"approval_required"`
	AllowWithoutReview bool           `json:"allow_without_review"`
	SkipAutoReview     bool           `json:"skip_auto_review"`
	Source             string         `json:"source"`
	Approvals          approvalPolicy `json:"approvals"`
}

func (s *server) policyPath() string {
	return filepath.Join(s.config, "policy.toml")
}

func canonicalApprovalPolicy(enabled bool) approvalPolicy {
	if enabled {
		return approvalPolicy{Mode: approvalModeOn, AlwaysAllow: false}
	}
	return approvalPolicy{Mode: approvalModeOff, AlwaysAllow: true}
}

func (s *server) ensureApprovalPolicy() (approvalPolicy, error) {
	path := s.policyPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		policy := canonicalApprovalPolicy(false)
		if err := s.saveApprovalPolicy(policy); err != nil {
			return approvalPolicy{}, err
		}
		return policy, nil
	} else if err != nil {
		return approvalPolicy{}, err
	}
	return s.loadApprovalPolicy()
}

func (s *server) loadApprovalPolicy() (approvalPolicy, error) {
	path := s.policyPath()
	mode := strings.ToLower(strings.TrimSpace(sec(path, "approvals", "mode")))
	alwaysRaw := strings.ToLower(strings.TrimSpace(sec(path, "approvals", "always_allow")))

	if mode != approvalModeOff && mode != approvalModeOn {
		return approvalPolicy{}, fmt.Errorf("invalid approvals.mode %q in %s", mode, path)
	}
	var alwaysAllow bool
	switch alwaysRaw {
	case "true":
		alwaysAllow = true
	case "false":
		alwaysAllow = false
	default:
		return approvalPolicy{}, fmt.Errorf("invalid approvals.always_allow %q in %s", alwaysRaw, path)
	}
	if (mode == approvalModeOff) != alwaysAllow {
		return approvalPolicy{}, fmt.Errorf("invalid approval invariant in %s: mode=%s always_allow=%t", path, mode, alwaysAllow)
	}
	return approvalPolicy{Mode: mode, AlwaysAllow: alwaysAllow}, nil
}

func (s *server) saveApprovalPolicy(policy approvalPolicy) error {
	if (policy.Mode == approvalModeOff) != policy.AlwaysAllow || (policy.Mode != approvalModeOff && policy.Mode != approvalModeOn) {
		return fmt.Errorf("invalid approval policy: mode=%s always_allow=%t", policy.Mode, policy.AlwaysAllow)
	}
	if err := os.MkdirAll(s.config, 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.config, "policy-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	content := fmt.Sprintf(`# constellation-MaxQ approval policy (managed by MaxQ settings)
# This file is the source of truth for host approval decisions.

[approvals]
mode = %q
always_allow = %t
`, policy.Mode, policy.AlwaysAllow)
	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, s.policyPath())
}

func (s *server) settingsState(policy approvalPolicy) (policyState, error) {
	network, err := s.loadNetworkConfig()
	if err != nil {
		return policyState{}, err
	}
	skip := policy.Mode == approvalModeOff && policy.AlwaysAllow
	return policyState{
		Approvals:      policy,
		Network:        s.networkState(network),
		Source:         s.policyPath(),
		SkipAutoReview: skip,
	}, nil
}

func (s *server) handlePolicy(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch r.Method {
	case http.MethodGet:
		policy, err := s.ensureApprovalPolicy()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		state, err := s.settingsState(policy)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, state)
	case http.MethodPost:
		var req policyUpdateReq
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
			return
		}
		if (req.Enabled == nil) == (req.Network == nil) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "provide exactly one of enabled or network"})
			return
		}
		if req.Network != nil {
			network, err := s.applyNetworkUpdate(*req.Network)
			if err != nil {
				var input networkInputError
				var join networkJoinError
				switch {
				case errors.As(err, &input):
					writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
				case errors.As(err, &join):
					writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error(), "network": network})
				default:
					writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
				}
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "network": network})
			return
		}
		policy := canonicalApprovalPolicy(*req.Enabled)
		if err := s.saveApprovalPolicy(policy); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		state, err := s.settingsState(policy)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, state)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *server) handlePolicyDecision(w http.ResponseWriter, r *http.Request) {
	var req policyDecisionReq
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}

	s.mu.Lock()
	policy, err := s.ensureApprovalPolicy()
	s.mu.Unlock()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	// MaxQ policy is authoritative. When approvals are Off, callers MUST skip
	// host Auto-review entirely rather than attempting to toggle its self-protected
	// settings.json state. This prevents Auto-review from re-blocking an action
	// that policy.toml explicitly marks always-allow.
	skip := policy.Mode == approvalModeOff && policy.AlwaysAllow
	writeJSON(w, http.StatusOK, policyDecision{
		Action:             strings.TrimSpace(req.Action),
		Channel:            strings.TrimSpace(req.Channel),
		ApprovalRequired:   !skip,
		AllowWithoutReview: skip,
		SkipAutoReview:     skip,
		Source:             s.policyPath(),
		Approvals:          policy,
	})
}
