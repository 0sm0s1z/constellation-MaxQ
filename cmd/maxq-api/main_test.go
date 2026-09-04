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

func TestConnectionManagerAggregatesAndRoutesActions(t *testing.T) {
	oldRoot := x11SocketRoot
	x11SocketRoot = t.TempDir()
	t.Cleanup(func() { x11SocketRoot = oldRoot })
	oldDisplay := os.Getenv("DISPLAY")
	t.Cleanup(func() { _ = os.Setenv("DISPLAY", oldDisplay) })
	_ = os.Unsetenv("DISPLAY")

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
	remoteBase := strings.Replace(remote.URL, "127.0.0.1", "0.0.0.0", 1)

	s := &server{config: t.TempDir(), localInventory: func() ([]map[string]any, error) { return nil, nil }}
	add := httptest.NewRecorder()
	s.handleAddConnection(add, httptest.NewRequest(http.MethodPost, "/connections", strings.NewReader(`{"name":"tester","base_url":"`+remoteBase+`/","auth":"secret"}`)))
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

func TestAggregateReturnsLocalInventoryWithoutHTTPRecursion(t *testing.T) {
	oldRoot := x11SocketRoot
	x11SocketRoot = t.TempDir()
	t.Cleanup(func() { x11SocketRoot = oldRoot })
	oldDisplay := os.Getenv("DISPLAY")
	t.Cleanup(func() { _ = os.Setenv("DISPLAY", oldDisplay) })
	_ = os.Unsetenv("DISPLAY")
	if err := os.WriteFile(filepath.Join(x11SocketRoot, "X7"), nil, 0o600); err != nil {
		t.Fatal(err)
	}

	called := false
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		http.Error(w, "self HTTP call", http.StatusInternalServerError)
	}))
	defer remote.Close()
	s := &server{config: t.TempDir(), listen: defaultListen}
	if err := s.saveConnectionsLocked([]connection{{ID: "self", Name: "self", BaseURL: "http://127.0.0.1:7432"}}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/desktops", nil)
	req.Header.Set("X-MaxQ-Aggregate", "1")
	rr := httptest.NewRecorder()
	s.handleDesktops(rr, req)
	if rr.Code != http.StatusOK || called {
		t.Fatalf("aggregate status=%d self_http_called=%v body=%s", rr.Code, called, rr.Body.String())
	}
	var body struct {
		Desktops []map[string]any `json:"desktops"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Desktops) != desktopCount {
		t.Fatalf("local desktops len=%d want %d: %+v", len(body.Desktops), desktopCount, body.Desktops)
	}
	var live7 map[string]any
	for _, d := range body.Desktops {
		if d["display"] == ":7" {
			live7 = d
			break
		}
	}
	if live7 == nil || live7["live"] != true || live7["id"] != "7" {
		t.Fatalf("local desktop :7=%+v", live7)
	}

	// The normal aggregator also includes local inventory, but must not
	// duplicate it by fetching a saved URL for this same API.
	normal := httptest.NewRecorder()
	s.handleDesktops(normal, httptest.NewRequest(http.MethodGet, "/desktops", nil))
	if normal.Code != http.StatusOK || called {
		t.Fatalf("normal status=%d self_http_called=%v body=%s", normal.Code, called, normal.Body.String())
	}
	var normalBody struct {
		Desktops []map[string]any `json:"desktops"`
	}
	if err := json.Unmarshal(normal.Body.Bytes(), &normalBody); err != nil {
		t.Fatal(err)
	}
	if len(normalBody.Desktops) != desktopCount {
		t.Fatalf("normal local desktops len=%d: %+v", len(normalBody.Desktops), normalBody.Desktops)
	}
}

func TestAggregateIncludesSavedSelfConnectionWithoutHTTPRecursion(t *testing.T) {
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-MaxQ-Aggregate") != "1" {
			t.Fatalf("remote request missing aggregate marker")
		}
		_, _ = w.Write([]byte(`{"box_identity":"remote-box","desktops":[{"id":"remote-1"}]}`))
	}))
	defer remote.Close()
	remoteBase := strings.Replace(remote.URL, "127.0.0.1", "0.0.0.0", 1)

	s := &server{
		config: t.TempDir(),
		listen: "127.0.0.1:19099",
		localInventory: func() ([]map[string]any, error) {
			return []map[string]any{{"id": "local-1", "display": ":7", "box_identity": "local-box"}}, nil
		},
	}
	if err := s.saveConnectionsLocked([]connection{
		{ID: "local", Name: "local", BaseURL: "http://127.0.0.1:19099"},
		{ID: "remote", Name: "remote", BaseURL: remoteBase},
	}); err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	s.handleDesktops(rr, httptest.NewRequest(http.MethodGet, "/desktops", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("aggregate status=%d body=%s", rr.Code, rr.Body.String())
	}
	var body struct {
		Desktops []map[string]any `json:"desktops"`
		Errors   []map[string]any `json:"errors"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Errors) != 0 || len(body.Desktops) != 2 {
		t.Fatalf("aggregate desktops=%+v errors=%+v", body.Desktops, body.Errors)
	}
	byConn := map[string]map[string]any{}
	for _, d := range body.Desktops {
		id, _ := d["connection_id"].(string)
		byConn[id] = d
	}
	if byConn["local"]["box_identity"] != "local-box" || byConn["local"]["id"] != "local-1" {
		t.Fatalf("local desktop=%+v", byConn["local"])
	}
	if byConn["remote"]["box_identity"] != "remote-box" || byConn["remote"]["id"] != "remote-1" {
		t.Fatalf("remote desktop=%+v", byConn["remote"])
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
