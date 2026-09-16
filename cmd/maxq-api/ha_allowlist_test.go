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

func newHAAllowlistTestServer(t *testing.T) *server {
	t.Helper()
	root := t.TempDir()
	return &server{prefix: root, config: filepath.Join(root, ".config", "maxq")}
}

func TestHAAllowlistMissingFileIsEmptyCuratedSet(t *testing.T) {
	s := newHAAllowlistTestServer(t)
	state, err := s.loadHAAllowlist()
	if err != nil {
		t.Fatal(err)
	}
	if state.Entities == nil || len(state.Entities) != 0 {
		t.Fatalf("missing allowlist should be a non-nil empty set: %#v", state.Entities)
	}
	if state.Semantics != haAllowlistSemantics || !state.BotVisibleOnly {
		t.Fatalf("missing allowlist lost curated-only semantics: %+v", state)
	}
	if _, err := os.Stat(s.haAllowlistPath()); !os.IsNotExist(err) {
		t.Fatalf("GET/default should not invent a file: %v", err)
	}
}

func TestHAAllowlistRoundTripDedupeAndPrivateMode(t *testing.T) {
	s := newHAAllowlistTestServer(t)
	entities, err := s.saveHAAllowlist([]haEntity{
		{ID: " light.kitchen ", Label: " Kitchen light "},
		{ID: "light.kitchen", Label: "duplicate is ignored"},
		{ID: "lock.front_door", Label: "Front door"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(entities) != 2 {
		t.Fatalf("dedupe failed: %+v", entities)
	}
	if entities[0].ID != "light.kitchen" || entities[0].Label != "Kitchen light" {
		t.Fatalf("normalization failed: %+v", entities[0])
	}
	info, err := os.Stat(s.haAllowlistPath())
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("allowlist mode=%#o want 0600", info.Mode().Perm())
	}

	state, err := s.loadHAAllowlist()
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Entities) != 2 || state.Entities[1].ID != "lock.front_door" {
		t.Fatalf("round-trip failed: %+v", state.Entities)
	}
}

func TestHAAllowlistValidation(t *testing.T) {
	cases := []struct {
		name     string
		entities []haEntity
	}{
		{name: "empty id", entities: []haEntity{{ID: "  "}}},
		{name: "missing domain separator", entities: []haEntity{{ID: "kitchen_light"}}},
		{name: "uppercase", entities: []haEntity{{ID: "Light.Kitchen"}}},
		{name: "space", entities: []haEntity{{ID: "light.kitchen lamp"}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := normalizeHAEntities(tc.entities); err == nil {
				t.Fatalf("expected validation error for %+v", tc.entities)
			}
		})
	}
}

func TestHAAllowlistHTTPGetPutContract(t *testing.T) {
	s := newHAAllowlistTestServer(t)

	getEmpty := httptest.NewRecorder()
	s.handleHAAllowlist(getEmpty, httptest.NewRequest(http.MethodGet, "/ha/allowlist", nil))
	if getEmpty.Code != http.StatusOK {
		t.Fatalf("GET empty status=%d body=%s", getEmpty.Code, getEmpty.Body.String())
	}
	var empty haAllowlistState
	if err := json.Unmarshal(getEmpty.Body.Bytes(), &empty); err != nil {
		t.Fatal(err)
	}
	if len(empty.Entities) != 0 || empty.Semantics != haAllowlistSemantics || !empty.BotVisibleOnly {
		t.Fatalf("empty GET pretended to be inventory or lost semantics: %+v", empty)
	}
	if !strings.HasSuffix(empty.Source, filepath.Join(".config", "maxq", "ha-allowlist.json")) {
		t.Fatalf("unexpected source path: %q", empty.Source)
	}

	put := httptest.NewRecorder()
	body := `{"entities":[{"id":"light.kitchen","label":"Kitchen light"},{"id":"light.kitchen","label":"duplicate"},{"id":"lock.front_door"}]}`
	s.handleHAAllowlist(put, httptest.NewRequest(http.MethodPut, "/ha/allowlist", strings.NewReader(body)))
	if put.Code != http.StatusOK {
		t.Fatalf("PUT status=%d body=%s", put.Code, put.Body.String())
	}
	var putResp struct {
		OK             bool       `json:"ok"`
		Entities       []haEntity `json:"entities"`
		Semantics      string     `json:"semantics"`
		BotVisibleOnly bool       `json:"bot_visible_only"`
	}
	if err := json.Unmarshal(put.Body.Bytes(), &putResp); err != nil {
		t.Fatal(err)
	}
	if !putResp.OK || len(putResp.Entities) != 2 || putResp.Semantics != haAllowlistSemantics || !putResp.BotVisibleOnly {
		t.Fatalf("unexpected PUT response: %+v", putResp)
	}

	get := httptest.NewRecorder()
	s.handleHAAllowlist(get, httptest.NewRequest(http.MethodGet, "/ha/allowlist", nil))
	if get.Code != http.StatusOK {
		t.Fatalf("GET saved status=%d body=%s", get.Code, get.Body.String())
	}
	var saved haAllowlistState
	if err := json.Unmarshal(get.Body.Bytes(), &saved); err != nil {
		t.Fatal(err)
	}
	if len(saved.Entities) != 2 || saved.Entities[0].ID != "light.kitchen" || saved.Entities[1].ID != "lock.front_door" {
		t.Fatalf("saved allowlist mismatch: %+v", saved.Entities)
	}
	if saved.Semantics != haAllowlistSemantics || !saved.BotVisibleOnly {
		t.Fatalf("GET response must remain curated-only: %+v", saved)
	}
}

func TestHAAllowlistHTTPRejectsInvalidEntity(t *testing.T) {
	s := newHAAllowlistTestServer(t)
	rr := httptest.NewRecorder()
	s.handleHAAllowlist(rr, httptest.NewRequest(http.MethodPut, "/ha/allowlist", strings.NewReader(`{"entities":[{"id":"not-an-entity"}]}`)))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid PUT status=%d body=%s", rr.Code, rr.Body.String())
	}
	if _, err := os.Stat(s.haAllowlistPath()); !os.IsNotExist(err) {
		t.Fatalf("invalid PUT must not persist allowlist: %v", err)
	}
}
