package main

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func newNetworkTestServer(t *testing.T, run func(...string) error) *server {
	t.Helper()
	prefix := t.TempDir()
	old := tailscaleCommandRunner
	tailscaleCommandRunner = func(_ *server, args ...string) error { return run(args...) }
	t.Cleanup(func() { tailscaleCommandRunner = old })
	return &server{prefix: prefix, config: filepath.Join(prefix, ".config", "maxq")}
}

func TestNetworkDefaultsToTailscale(t *testing.T) {
	s := newNetworkTestServer(t, func(...string) error { t.Fatal("read must not run tailscale"); return nil })
	cfg, err := s.loadNetworkConfig()
	if err != nil { t.Fatal(err) }
	if cfg.Mode != networkModeTailscale || cfg.LoginServer != "" { t.Fatalf("config=%+v", cfg) }
}

func TestHeadscaleRequiresLoginServerAndNeverRuns(t *testing.T) {
	calls := 0
	s := newNetworkTestServer(t, func(...string) error { calls++; return nil })
	_, err := s.applyNetworkUpdate(networkUpdateReq{Mode: networkModeHeadscale})
	if err == nil || !strings.Contains(err.Error(), "requires login_server") || !strings.Contains(err.Error(), "refusing to fall back") { t.Fatalf("err=%v", err) }
	if calls != 0 { t.Fatalf("tailscale calls=%d", calls) }
	if _, err := os.Stat(s.networkPath()); !os.IsNotExist(err) { t.Fatalf("network.toml unexpectedly persisted: %v", err) }
}

func TestHeadscalePersistsAndUsesAuthKeyFile(t *testing.T) {
	const secret = "tskey-auth-placeholder-not-real"
	var args []string
	s := newNetworkTestServer(t, func(got ...string) error { args = append([]string(nil), got...); return nil })
	state, err := s.applyNetworkUpdate(networkUpdateReq{Mode: networkModeHeadscale, LoginServer: "https://headscale.example.invalid/", AuthKey: stringPtr(secret)})
	if err != nil { t.Fatal(err) }
	want := []string{"up", "--login-server=https://headscale.example.invalid", "--auth-key=file:" + s.networkAuthPath()}
	if !reflect.DeepEqual(args, want) { t.Fatalf("args=%q want=%q", args, want) }
	if strings.Contains(strings.Join(args, " "), secret) { t.Fatal("argv leaked auth key") }
	if !state.AuthKeyConfigured || state.Status != "up" { t.Fatalf("state=%+v", state) }
	config, err := os.ReadFile(s.networkPath())
	if err != nil { t.Fatal(err) }
	if !strings.Contains(string(config), `mode = "headscale"`) || !strings.Contains(string(config), `login_server = "https://headscale.example.invalid"`) || strings.Contains(string(config), secret) { t.Fatalf("network.toml=%s", config) }
	for _, path := range []string{s.networkPath(), s.networkAuthPath(), s.networkStatusPath()} {
		info, err := os.Stat(path)
		if err != nil { t.Fatal(err) }
		if info.Mode().Perm() != 0o600 { t.Fatalf("%s mode=%o", path, info.Mode().Perm()) }
	}
}

func TestFreshTailscaleSaveUsesPlainUp(t *testing.T) {
	var args []string
	s := newNetworkTestServer(t, func(got ...string) error { args = append([]string(nil), got...); return nil })
	state, err := s.applyNetworkUpdate(networkUpdateReq{Mode: networkModeTailscale})
	if err != nil { t.Fatal(err) }
	if !reflect.DeepEqual(args, []string{"up"}) { t.Fatalf("args=%q", args) }
	if state.Status != "up" { t.Fatalf("state=%+v", state) }
}

func TestHeadscaleFailureNeverFallsBack(t *testing.T) {
	var calls [][]string
	s := newNetworkTestServer(t, func(got ...string) error { calls = append(calls, append([]string(nil), got...)); return errors.New("join failed") })
	_, err := s.applyNetworkUpdate(networkUpdateReq{Mode: networkModeHeadscale, LoginServer: "https://headscale.example.invalid"})
	if err == nil { t.Fatal("expected join error") }
	if len(calls) != 1 || len(calls[0]) < 2 || calls[0][1] != "--login-server=https://headscale.example.invalid" { t.Fatalf("calls=%v", calls) }
	if strings.Contains(strings.Join(calls[0], " "), tailscaleHostedLoginServer) { t.Fatalf("unexpected SaaS fallback: %v", calls) }
}

func TestSwitchHeadscaleToTailscaleRestoresHostedControlPlane(t *testing.T) {
	var args []string
	s := newNetworkTestServer(t, func(got ...string) error { args = append([]string(nil), got...); return nil })
	if err := s.saveNetworkConfig(networkConfig{Mode: networkModeHeadscale, LoginServer: "https://headscale.example.invalid"}); err != nil { t.Fatal(err) }
	if _, err := s.applyNetworkUpdate(networkUpdateReq{Mode: networkModeTailscale}); err != nil { t.Fatal(err) }
	want := []string{"up", "--login-server=" + tailscaleHostedLoginServer}
	if !reflect.DeepEqual(args, want) { t.Fatalf("args=%q want=%q", args, want) }
}

func TestNetworkRejectsCredentialedLoginServer(t *testing.T) {
	s := newNetworkTestServer(t, func(...string) error { t.Fatal("invalid URL must not run tailscale"); return nil })
	_, err := s.applyNetworkUpdate(networkUpdateReq{Mode: networkModeHeadscale, LoginServer: "https://user:pass@headscale.example.invalid"})
	if err == nil || !strings.Contains(err.Error(), "without credentials") { t.Fatalf("err=%v", err) }
}

func TestNetworkLeaveRunsTailscaleDownAndPersistsStatus(t *testing.T) {
	var args []string
	s := newNetworkTestServer(t, func(got ...string) error { args = append([]string(nil), got...); return nil })
	state, err := s.applyNetworkAction(networkUpdateReq{Action: "leave"})
	if err != nil { t.Fatal(err) }
	if !reflect.DeepEqual(args, []string{"down"}) { t.Fatalf("args=%q", args) }
	if state.Mode != networkModeTailscale || state.Status != "down" { t.Fatalf("state=%+v", state) }
	if got := s.loadNetworkStatus(); got != "down" { t.Fatalf("status=%q", got) }
}

func TestHeadscaleLeaveUsesDownWithoutSaaSFallback(t *testing.T) {
	var calls [][]string
	s := newNetworkTestServer(t, func(got ...string) error { calls = append(calls, append([]string(nil), got...)); return nil })
	if err := s.saveNetworkConfig(networkConfig{Mode: networkModeHeadscale, LoginServer: "https://headscale.example.invalid"}); err != nil { t.Fatal(err) }
	state, err := s.applyNetworkAction(networkUpdateReq{Action: "leave"})
	if err != nil { t.Fatal(err) }
	if len(calls) != 1 || !reflect.DeepEqual(calls[0], []string{"down"}) { t.Fatalf("calls=%v", calls) }
	if strings.Contains(strings.Join(calls[0], " "), tailscaleHostedLoginServer) { t.Fatalf("unexpected SaaS fallback: %v", calls) }
	if state.Mode != networkModeHeadscale || state.LoginServer != "https://headscale.example.invalid" || state.Status != "down" { t.Fatalf("state=%+v", state) }
}

func TestNetworkLeaveRedactsStoredAuthKeyFromErrors(t *testing.T) {
	const secret = "tskey-auth-placeholder-not-real"
	s := newNetworkTestServer(t, func(...string) error { return errors.New("disconnect failed for " + secret) })
	if err := s.saveNetworkAuthKey(secret); err != nil { t.Fatal(err) }
	_, err := s.applyNetworkAction(networkUpdateReq{Action: "leave"})
	if err == nil { t.Fatal("expected leave error") }
	if strings.Contains(err.Error(), secret) { t.Fatalf("secret leaked in error: %v", err) }
	if !strings.Contains(err.Error(), "[redacted]") { t.Fatalf("redaction missing: %v", err) }
}

func TestNetworkLeaveRejectsSettingsAndUnknownActions(t *testing.T) {
	s := newNetworkTestServer(t, func(...string) error { t.Fatal("invalid action must not run tailscale"); return nil })
	for _, req := range []networkUpdateReq{
		{Action: "leave", Mode: networkModeTailscale},
		{Action: "logout"},
	} {
		if _, err := s.applyNetworkAction(req); err == nil { t.Fatalf("expected input error for %+v", req) }
	}
}

func stringPtr(v string) *string { return &v }
