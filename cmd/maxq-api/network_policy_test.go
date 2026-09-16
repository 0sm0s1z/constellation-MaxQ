package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestPolicyNetworkLeaveCallsTailscaleDown(t *testing.T) {
	var calls [][]string
	s := newNetworkTestServer(t, func(got ...string) error {
		calls = append(calls, append([]string(nil), got...))
		return nil
	})

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/policy", strings.NewReader(`{"network":{"action":"leave"}}`))
	s.handlePolicy(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	if len(calls) != 1 || !reflect.DeepEqual(calls[0], []string{"down"}) {
		t.Fatalf("calls=%v", calls)
	}
	var got struct {
		OK      bool         `json:"ok"`
		Network networkState `json:"network"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.OK || got.Network.Status != "down" {
		t.Fatalf("response=%+v", got)
	}
}

func TestPolicyNetworkLeaveRejectsMixedInput(t *testing.T) {
	s := newNetworkTestServer(t, func(...string) error {
		t.Fatal("invalid request must not run tailscale")
		return nil
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/policy", strings.NewReader(`{"network":{"action":"leave","mode":"tailscale"}}`))
	s.handlePolicy(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
}

func TestPolicyNetworkLeaveRedactsAuthKeyError(t *testing.T) {
	const secret = "tskey-policy-placeholder-not-real"
	prefix := t.TempDir()
	old := tailscaleCommandRunner
	tailscaleCommandRunner = func(_ *server, _ ...string) error { return errors.New("failure " + secret) }
	t.Cleanup(func() { tailscaleCommandRunner = old })
	s := &server{prefix: prefix, config: filepath.Join(prefix, ".config", "maxq")}
	if err := s.saveNetworkAuthKey(secret); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/policy", strings.NewReader(`{"network":{"action":"leave"}}`))
	s.handlePolicy(rr, req)
	if rr.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	if strings.Contains(rr.Body.String(), secret) {
		t.Fatalf("secret leaked: %s", rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "[redacted]") {
		t.Fatalf("redaction missing: %s", rr.Body.String())
	}
}
