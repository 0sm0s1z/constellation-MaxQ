package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestHAActionAllowlistGate(t *testing.T) {
	s := newHAAllowlistTestServer(t)
	if _, err := s.saveHAAllowlist([]haEntity{{ID: "light.kitchen", Label: "Kitchen"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.saveHAConnection("http://ha.example.invalid", "tok-secret", false); err != nil {
		t.Fatal(err)
	}

	haHTTPClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		t.Fatalf("HA must not be called for non-allowlisted entity; got %s", r.URL)
		return nil, nil
	})}
	t.Cleanup(func() { haHTTPClient = &http.Client{} })

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/ha/action", strings.NewReader(`{"entity_id":"light.other","action":"turn_on"}`))
	s.handleHAAction(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code=%d body=%s", rr.Code, rr.Body.String())
	}
}

func TestHAActionTurnOnAllowlisted(t *testing.T) {
	s := newHAAllowlistTestServer(t)
	if _, err := s.saveHAAllowlist([]haEntity{{ID: "light.kitchen"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.saveHAConnection("http://ha.example.invalid", "tok-secret", false); err != nil {
		t.Fatal(err)
	}

	var sawService bool
	haHTTPClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if auth := r.Header.Get("Authorization"); auth != "Bearer tok-secret" {
			t.Fatalf("auth=%q", auth)
		}
		if strings.Contains(r.URL.Path, "/api/services/light/turn_on") {
			sawService = true
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`[{"entity_id":"light.kitchen"}]`)), Header: make(http.Header)}, nil
		}
		if strings.Contains(r.URL.Path, "/api/states/") {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"entity_id":"light.kitchen","state":"on","attributes":{"friendly_name":"Kitchen"}}`)), Header: make(http.Header)}, nil
		}
		t.Fatalf("unexpected path %s", r.URL.Path)
		return nil, nil
	})}
	t.Cleanup(func() { haHTTPClient = &http.Client{} })

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/ha/action", strings.NewReader(`{"entity_id":"light.kitchen","action":"turn_on"}`))
	s.handleHAAction(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", rr.Code, rr.Body.String())
	}
	var got haActionResult
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.OK || got.Service != "turn_on" || !sawService {
		t.Fatalf("got=%+v sawService=%v", got, sawService)
	}
	if strings.Contains(rr.Body.String(), "tok-secret") {
		t.Fatal("token leaked in response")
	}
}

func TestHAConnectionNeverReturnsToken(t *testing.T) {
	s := newHAAllowlistTestServer(t)
	if _, err := s.saveHAConnection("https://ha.example.invalid", "super-secret-token", false); err != nil {
		t.Fatal(err)
	}
	rr := httptest.NewRecorder()
	s.handleHAConnection(rr, httptest.NewRequest(http.MethodGet, "/ha/connection", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	if strings.Contains(body, "super-secret-token") {
		t.Fatalf("token leaked: %s", body)
	}
	var st haConnectionState
	if err := json.Unmarshal(rr.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	if !st.Configured || !st.TokenConfigured || st.BaseURL != "https://ha.example.invalid" {
		t.Fatalf("%+v", st)
	}
}
