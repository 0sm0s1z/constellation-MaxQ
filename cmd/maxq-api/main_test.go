package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSanitizeListenRejectsNonLoopback(t *testing.T) {
	if got := sanitizeListen("0.0.0.0:7432"); got != defaultListen {
		t.Fatalf("got %q, want %q", got, defaultListen)
	}
	if got := sanitizeListen("10.0.0.5:7432"); got != defaultListen {
		t.Fatalf("got %q, want %q", got, defaultListen)
	}
}

func TestGuardRejectsCrossOriginMutation(t *testing.T) {
	s := &server{listen: defaultListen}
	h := s.guard(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	r := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:7432/apply", nil)
	r.RemoteAddr = "127.0.0.1:44444"
	r.Host = "127.0.0.1:7432"
	r.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("got %d, want %d", w.Code, http.StatusForbidden)
	}
}

func TestGuardAllowsLocalOriginMutation(t *testing.T) {
	s := &server{listen: defaultListen}
	h := s.guard(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	r := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:7432/apply", nil)
	r.RemoteAddr = "127.0.0.1:44444"
	r.Host = "127.0.0.1:7432"
	r.Header.Set("Origin", "http://127.0.0.1:7432")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusNoContent {
		t.Fatalf("got %d, want %d", w.Code, http.StatusNoContent)
	}
}
