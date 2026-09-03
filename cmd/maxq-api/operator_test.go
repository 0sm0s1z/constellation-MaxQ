package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSanitizeListenAllowsPublicAndRejectsTenNet(t *testing.T) {
	if got := sanitizeListen("0.0.0.0:7432"); got != "0.0.0.0:7432" {
		t.Fatalf("public listen=%q", got)
	}
	if got := sanitizeListen("127.0.0.1:7432"); got != "127.0.0.1:7432" {
		t.Fatalf("loopback listen=%q", got)
	}
	if got := sanitizeListen("10.0.4.20:7432"); got != defaultListen {
		t.Fatalf("10/16 listen=%q want default", got)
	}
}

func TestSurfacePolicyRoundTrip(t *testing.T) {
	s := &server{config: t.TempDir(), listen: defaultListen}
	p := surfacePolicy{Listen: "127.0.0.1:7432", APIPublic: false, UIPublic: true}
	if err := s.writeSurfacePolicy(p); err != nil {
		t.Fatal(err)
	}
	got := s.surfacePolicy()
	if got != p {
		t.Fatalf("policy=%+v want %+v", got, p)
	}
	st, err := os.Stat(filepath.Join(s.config, "api.toml"))
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("api.toml mode=%o want 600", st.Mode().Perm())
	}
}

func TestSurfaceGateSeparatesUIAndAPI(t *testing.T) {
	s := &server{config: t.TempDir(), listen: defaultListen}
	if err := s.writeSurfacePolicy(surfacePolicy{Listen: defaultListen, APIPublic: false, UIPublic: true}); err != nil {
		t.Fatal(err)
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	gate := s.surfaceGate(next)
	uiReq := httptest.NewRequest(http.MethodGet, "http://eva/box", nil)
	uiReq.RemoteAddr = "192.0.2.8:5000"
	uiRR := httptest.NewRecorder()
	gate.ServeHTTP(uiRR, uiReq)
	if uiRR.Code != http.StatusNoContent {
		t.Fatalf("ui status=%d", uiRR.Code)
	}
	apiReq := httptest.NewRequest(http.MethodGet, "http://eva/status", nil)
	apiReq.RemoteAddr = "192.0.2.8:5000"
	apiRR := httptest.NewRecorder()
	gate.ServeHTTP(apiRR, apiReq)
	if apiRR.Code != http.StatusForbidden || !strings.Contains(apiRR.Body.String(), "api is loopback only") {
		t.Fatalf("api status=%d body=%q", apiRR.Code, apiRR.Body.String())
	}
}
