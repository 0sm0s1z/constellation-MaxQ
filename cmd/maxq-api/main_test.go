package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestConnectionManagerAggregatesAndRoutesActions(t *testing.T) {
	var actionAuth string
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/desktops" {
			if r.Header.Get("X-MaxQ-Aggregate") != "1" {
				t.Errorf("missing aggregate marker")
			}
			if r.Header.Get("Authorization") != "Bearer secret" {
				t.Errorf("missing auth header: %q", r.Header.Get("Authorization"))
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"box_identity":"box-a","desktops":[{"id":"desk-a","name":"A"}]}`))
			return
		}
		if r.URL.Path == "/desktops/desk-a/action" {
			actionAuth = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"ok":true}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer remote.Close()

	s := &server{config: t.TempDir()}
	add := httptest.NewRecorder()
	s.handleAddConnection(add, httptest.NewRequest(http.MethodPost, "/connections", strings.NewReader(`{"name":"tester","base_url":"`+remote.URL+`/","auth":"secret"}`)))
	if add.Code != http.StatusCreated {
		t.Fatalf("add status = %d, body=%s", add.Code, add.Body.String())
	}
	var added struct {
		Connection connectionView `json:"connection"`
	}
	if err := json.Unmarshal(add.Body.Bytes(), &added); err != nil {
		t.Fatal(err)
	}
	if added.Connection.ID == "" || !added.Connection.AuthConfigured {
		t.Fatalf("bad public connection: %+v", added.Connection)
	}
	if strings.Contains(add.Body.String(), "secret") {
		t.Fatal("connection response leaked auth")
	}

	list := httptest.NewRecorder()
	s.handleConnections(list, httptest.NewRequest(http.MethodGet, "/connections", nil))
	if list.Code != http.StatusOK || strings.Contains(list.Body.String(), "secret") {
		t.Fatalf("bad list response: %d %s", list.Code, list.Body.String())
	}

	desktops := httptest.NewRecorder()
	s.handleDesktops(desktops, httptest.NewRequest(http.MethodGet, "/desktops", nil))
	if desktops.Code != http.StatusOK {
		t.Fatalf("desktop status = %d", desktops.Code)
	}
	var aggregate struct {
		Desktops []map[string]any `json:"desktops"`
	}
	if err := json.Unmarshal(desktops.Body.Bytes(), &aggregate); err != nil {
		t.Fatal(err)
	}
	if len(aggregate.Desktops) != 1 || aggregate.Desktops[0]["connection_id"] != added.Connection.ID || aggregate.Desktops[0]["box_identity"] != "box-a" {
		t.Fatalf("bad aggregate: %+v", aggregate.Desktops)
	}

	action := httptest.NewRecorder()
	s.handleDesktopAction(action, httptest.NewRequest(http.MethodPost, "/desktops/action", strings.NewReader(`{"connection_id":"`+added.Connection.ID+`","desktop_id":"desk-a","action":"watch"}`)))
	if action.Code != http.StatusOK || actionAuth != "Bearer secret" {
		t.Fatalf("action status=%d auth=%q body=%s", action.Code, actionAuth, action.Body.String())
	}
}

func TestNormalizeBaseURL(t *testing.T) {
	got, err := normalizeBaseURL("https://box.example:7432/api/?ignored=1#fragment")
	if err != nil || got != "https://box.example:7432/api" {
		t.Fatalf("got %q, err %v", got, err)
	}
	if _, err := normalizeBaseURL("file:///tmp/maxq"); err == nil {
		t.Fatal("accepted non-http URL")
	}
	if _, err := normalizeBaseURL("https://user:pass@box.example"); err == nil {
		t.Fatal("accepted URL credentials")
	}
}
