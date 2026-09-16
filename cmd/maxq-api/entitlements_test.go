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

func newEntitlementsTestServer(t *testing.T) *server {
	t.Helper()
	root := t.TempDir()
	return &server{
		prefix: root,
		config: filepath.Join(root, ".config", "maxq"),
		listen: defaultListen,
	}
}

func TestOperatorEntitlementsRoundTripPrivateMode(t *testing.T) {
	s := newEntitlementsTestServer(t)
	entries, err := s.saveOperatorEntitlements([]entitlementEntry{
		{Action: " allow ", Kind: " host ", Value: " ha.home.arpa ", Label: " Home Assistant host "},
		{Action: "allow", Kind: "host", Value: "ha.home.arpa", Label: "duplicate"},
		{Action: "deny", Kind: "cidr", Value: "10.0.99.0/24", Label: "lab quarantine"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("dedupe failed: %+v", entries)
	}
	if entries[0].Source != "operator" || entries[0].Value != "ha.home.arpa" {
		t.Fatalf("operator normalization failed: %+v", entries[0])
	}
	info, err := os.Stat(s.entitlementsPath())
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("entitlements mode=%#o want 0600", info.Mode().Perm())
	}
	loaded, err := s.loadOperatorEntitlements()
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded) != 2 || loaded[1].Action != "deny" || loaded[1].Kind != "cidr" {
		t.Fatalf("round-trip mismatch: %+v", loaded)
	}
}

func TestMergedEntitlementsSourceLabels(t *testing.T) {
	s := newEntitlementsTestServer(t)
	if _, err := s.saveOperatorEntitlements([]entitlementEntry{{Action: "deny", Kind: "host", Value: "blocked.example", Label: "operator block"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.saveHAAllowlist([]haEntity{{ID: "light.kitchen", Label: "Kitchen light"}}); err != nil {
		t.Fatal(err)
	}
	if err := s.saveNetworkConfig(networkConfig{Mode: networkModeHeadscale, LoginServer: "https://headscale.example.invalid"}); err != nil {
		t.Fatal(err)
	}
	if err := s.saveNetworkStatus("up"); err != nil {
		t.Fatal(err)
	}

	state, err := s.mergedEntitlements()
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{"operator": false, "ha-allowlist": false, "network": false, "maxq": false}
	for _, entry := range state.Entries {
		if _, ok := want[entry.Source]; ok {
			want[entry.Source] = true
		}
		if entry.Source == "ha-allowlist" && (entry.Action != "allow" || entry.Kind != "ha-entity" || entry.Value != "light.kitchen") {
			t.Fatalf("bad HA import: %+v", entry)
		}
		if entry.Source == "network" && (entry.Action != "allow" || entry.Kind != "network" || entry.Value != networkModeHeadscale) {
			t.Fatalf("bad network row: %+v", entry)
		}
	}
	for source, present := range want {
		if !present {
			t.Fatalf("missing source %q in %+v", source, state.Entries)
		}
	}
	if state.Semantics != entitlementsSemantics || state.Source != s.entitlementsPath() {
		t.Fatalf("bad aggregate metadata: %+v", state)
	}
}

func TestEntitlementsPUTPersistsOnlyOperatorRowsAndKeepsImports(t *testing.T) {
	s := newEntitlementsTestServer(t)
	if _, err := s.saveHAAllowlist([]haEntity{{ID: "lock.front_door", Label: "Front door"}}); err != nil {
		t.Fatal(err)
	}
	if err := s.saveNetworkConfig(networkConfig{Mode: networkModeTailscale}); err != nil {
		t.Fatal(err)
	}
	if err := s.saveNetworkStatus("down"); err != nil {
		t.Fatal(err)
	}

	put := httptest.NewRecorder()
	body := `{"entries":[{"action":"allow","kind":"host","value":"ha.home.arpa","label":"HA host","source":"operator"}]}`
	s.handleEntitlements(put, httptest.NewRequest(http.MethodPut, "/entitlements", strings.NewReader(body)))
	if put.Code != http.StatusOK {
		t.Fatalf("PUT status=%d body=%s", put.Code, put.Body.String())
	}

	raw, err := os.ReadFile(s.entitlementsPath())
	if err != nil {
		t.Fatal(err)
	}
	var stored entitlementsFile
	if err := json.Unmarshal(raw, &stored); err != nil {
		t.Fatal(err)
	}
	if len(stored.Entries) != 1 || stored.Entries[0].Source != "operator" {
		t.Fatalf("PUT persisted derived rows: %+v", stored.Entries)
	}

	get := httptest.NewRecorder()
	s.handleEntitlements(get, httptest.NewRequest(http.MethodGet, "/entitlements", nil))
	if get.Code != http.StatusOK {
		t.Fatalf("GET status=%d body=%s", get.Code, get.Body.String())
	}
	var state entitlementsState
	if err := json.Unmarshal(get.Body.Bytes(), &state); err != nil {
		t.Fatal(err)
	}
	sources := map[string]bool{}
	for _, entry := range state.Entries {
		sources[entry.Source] = true
	}
	for _, source := range []string{"operator", "ha-allowlist", "network", "maxq"} {
		if !sources[source] {
			t.Fatalf("GET missing source %q: %+v", source, state.Entries)
		}
	}
}

func TestEntitlementsValidationAndSecretFieldRejection(t *testing.T) {
	s := newEntitlementsTestServer(t)
	cases := []string{
		`{"entries":[{"action":"maybe","kind":"host","value":"example.com"}]}`,
		`{"entries":[{"action":"allow","kind":"host","value":""}]}`,
		`{"entries":[{"action":"allow","kind":"cidr","value":"not-a-cidr"}]}`,
		`{"entries":[{"action":"allow","kind":"host","value":"example.com","source":"network"}]}`,
		`{"entries":[{"action":"allow","kind":"host","value":"example.com","token":"do-not-store"}]}`,
	}
	for _, body := range cases {
		rr := httptest.NewRecorder()
		s.handleEntitlements(rr, httptest.NewRequest(http.MethodPut, "/entitlements", strings.NewReader(body)))
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("invalid PUT status=%d body=%s input=%s", rr.Code, rr.Body.String(), body)
		}
	}
}

func TestEntitlementsNeverLeakNetworkAuthKey(t *testing.T) {
	s := newEntitlementsTestServer(t)
	if err := s.saveNetworkConfig(networkConfig{Mode: networkModeTailscale}); err != nil {
		t.Fatal(err)
	}
	if err := s.saveNetworkAuthKey("tskey-secret-value"); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	s.handleEntitlements(rr, httptest.NewRequest(http.MethodGet, "/entitlements", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("GET status=%d body=%s", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	if strings.Contains(body, "tskey-secret-value") || strings.Contains(body, "auth_key") {
		t.Fatalf("entitlements response leaked auth material/metadata: %s", body)
	}
}
