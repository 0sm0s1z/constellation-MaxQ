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

func TestAuthStatusOperatorAuthOff(t *testing.T) {
	s := &server{config: t.TempDir(), operatorAuth: false}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/status", nil)
	s.handleAuthStatus(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["operator_auth"] != false {
		t.Fatalf("operator_auth=%v want false", body["operator_auth"])
	}
	if body["authenticated"] != true {
		t.Fatalf("authenticated=%v want true", body["authenticated"])
	}
	if body["has_hash"] != false {
		t.Fatalf("has_hash=%v want false", body["has_hash"])
	}
}

func TestAuthLoginSkippedWhenOperatorAuthOff(t *testing.T) {
	s := &server{config: t.TempDir(), operatorAuth: false}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"password":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthLogin(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["ok"] != true || body["skipped"] != true {
		t.Fatalf("login body=%v want ok+skipped", body)
	}
	if body["reason"] != "operator_auth=false" {
		t.Fatalf("reason=%v", body["reason"])
	}
}

func TestWithOperatorAuthPassthroughWhenOff(t *testing.T) {
	s := &server{config: t.TempDir(), operatorAuth: false}
	called := false
	h := s.withOperatorAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("pass"))
	}))
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	h.ServeHTTP(rr, req)
	if !called {
		t.Fatal("inner handler not called")
	}
	if rr.Code != http.StatusTeapot || rr.Body.String() != "pass" {
		t.Fatalf("passthrough status=%d body=%q", rr.Code, rr.Body.String())
	}
}

func TestSetPasswordWhenAuthOff(t *testing.T) {
	dir := t.TempDir()
	s := &server{config: dir, operatorAuth: false}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/set-password", strings.NewReader(`{"password":"correct-horse"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthSetPassword(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["ok"] != true || body["has_hash"] != true {
		t.Fatalf("body=%v", body)
	}
	if body["operator_auth"] != false {
		t.Fatalf("operator_auth flipped on unexpectedly: %v", body["operator_auth"])
	}
	hashPath := filepath.Join(dir, operatorHashFilename)
	st, err := os.Stat(hashPath)
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("hash perms=%o want 0600", st.Mode().Perm())
	}
	raw, _ := os.ReadFile(hashPath)
	h := strings.TrimSpace(string(raw))
	if !isBcryptHash(h) {
		t.Fatalf("hash not bcrypt: %q", h)
	}
	if !s.checkOperatorPassword("correct-horse") {
		t.Fatal("bcrypt check failed for set password")
	}
	if s.checkOperatorPassword("wrong-password") {
		t.Fatal("wrong password should fail")
	}
}

func TestSetPasswordRejectedWhenShort(t *testing.T) {
	s := &server{config: t.TempDir(), operatorAuth: false}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/set-password", strings.NewReader(`{"password":"short"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthSetPassword(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status=%d want 400 body=%s", rr.Code, rr.Body.String())
	}
}

func TestEnableAuthRequiresHash(t *testing.T) {
	s := &server{config: t.TempDir(), operatorAuth: false}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/operator", strings.NewReader(`{"enabled":true}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthOperator(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("status=%d want 409 body=%s", rr.Code, rr.Body.String())
	}
}

func TestEnableDisableAuthAfterHash(t *testing.T) {
	dir := t.TempDir()
	s := &server{config: dir, operatorAuth: false, listen: "127.0.0.1:7432", apiPublic: true, uiPublic: true}
	// set password first
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/set-password", strings.NewReader(`{"password":"correct-horse"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthSetPassword(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("set-password status=%d body=%s", rr.Code, rr.Body.String())
	}
	// enable
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/operator", strings.NewReader(`{"enabled":true}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthOperator(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("enable status=%d body=%s", rr.Code, rr.Body.String())
	}
	if !s.operatorAuth {
		t.Fatal("operatorAuth not set in memory")
	}
	tomlPath := filepath.Join(dir, "api.toml")
	b, err := os.ReadFile(tomlPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), "operator_auth = true") {
		t.Fatalf("api.toml missing operator_auth=true: %s", b)
	}
	// middleware should now block
	called := false
	h := s.withOperatorAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/status", nil)
	h.ServeHTTP(rr, req)
	if called {
		t.Fatal("middleware should block unauthenticated /status")
	}
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("blocked status=%d want 401", rr.Code)
	}
	// disable with password
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/operator", strings.NewReader(`{"enabled":false,"password":"correct-horse"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthOperator(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("disable status=%d body=%s", rr.Code, rr.Body.String())
	}
	if s.operatorAuth {
		t.Fatal("operatorAuth still on after disable")
	}
	// glass open again
	called = false
	h = s.withOperatorAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/status", nil)
	h.ServeHTTP(rr, req)
	if !called || rr.Code != http.StatusOK {
		t.Fatalf("passthrough after disable called=%v status=%d", called, rr.Code)
	}
}

func TestSetPasswordRequiresCurrentWhenAuthOn(t *testing.T) {
	dir := t.TempDir()
	s := &server{config: dir, operatorAuth: false, listen: "127.0.0.1:7432"}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/set-password", strings.NewReader(`{"password":"correct-horse"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthSetPassword(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("seed set-password: %s", rr.Body.String())
	}
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/operator", strings.NewReader(`{"enabled":true}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthOperator(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("enable: %s", rr.Body.String())
	}
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/set-password", strings.NewReader(`{"password":"new-password-ok"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthSetPassword(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without current, got %d %s", rr.Code, rr.Body.String())
	}
	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/set-password", strings.NewReader(`{"password":"new-password-ok","current_password":"correct-horse"}`))
	req.Header.Set("Content-Type", "application/json")
	s.handleAuthSetPassword(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("set with current: %d %s", rr.Code, rr.Body.String())
	}
	if !s.checkOperatorPassword("new-password-ok") {
		t.Fatal("new password not accepted")
	}
}
