// Operator password auth — disabled by default (operator_auth=false).
// When false: glass stays open (demo-safe). When true: password wall
// (hash check + 401 JSON + /login page). Leave OFF on live EVA :7432
// unless Matthew intentionally locks the glass.
package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	operatorAuthCookie   = "maxq_operator_session"
	operatorAuthHeader   = "X-MaxQ-Operator-Auth"
	operatorHashFilename = "operator.password.hash"
	bcryptCost           = bcrypt.DefaultCost
)

// loadOperatorAuth reads operator_auth from api.toml; missing/empty => false.
func (s *server) loadOperatorAuth() bool {
	return asBool(orDefault(s.tomlAPI("operator_auth"), "false"))
}

func (s *server) operatorHashPath() string {
	return filepath.Join(s.config, operatorHashFilename)
}

// operatorPasswordHash returns the configured hash or empty.
// Prefer secrets file operator.password.hash (0600); fall back to api.toml
// key operator_password_hash for older scaffolding.
func (s *server) operatorPasswordHash() string {
	if b, err := os.ReadFile(s.operatorHashPath()); err == nil {
		if h := strings.TrimSpace(string(b)); h != "" {
			return h
		}
	}
	if h := strings.TrimSpace(s.tomlAPI("operator_password_hash")); h != "" {
		return h
	}
	return ""
}

func isBcryptHash(h string) bool {
	return strings.HasPrefix(h, "$2a$") || strings.HasPrefix(h, "$2b$") || strings.HasPrefix(h, "$2y$")
}

func normalizeLegacySHA256(h string) string {
	return strings.ToLower(strings.TrimPrefix(strings.TrimSpace(h), "sha256:"))
}

// checkOperatorPassword verifies password against bcrypt (preferred) or
// legacy SHA-256 hex (scaffolding). Constant-time where applicable.
func (s *server) checkOperatorPassword(password string) bool {
	want := s.operatorPasswordHash()
	if want == "" || password == "" {
		return false
	}
	if isBcryptHash(want) {
		return bcrypt.CompareHashAndPassword([]byte(want), []byte(password)) == nil
	}
	sum := sha256.Sum256([]byte(password))
	got := hex.EncodeToString(sum[:])
	legacy := normalizeLegacySHA256(want)
	if len(got) != len(legacy) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(legacy)) == 1
}

func hashOperatorPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// writeOperatorPasswordHash stores the hash in the secrets file at 0600.
func (s *server) writeOperatorPasswordHash(hash string) error {
	if err := os.MkdirAll(s.config, 0o755); err != nil {
		return err
	}
	path := s.operatorHashPath()
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(hash+"\n"), 0o600); err != nil {
		return err
	}
	if err := os.Chmod(tmp, 0o600); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, path)
}

func (s *server) issueOperatorSessionToken(password string) string {
	// Scaffolding only — not a production session design.
	sum := sha256.Sum256([]byte("maxq-op|" + password + "|" + s.config))
	return hex.EncodeToString(sum[:])
}

func (s *server) validOperatorSession(r *http.Request) bool {
	hash := s.operatorPasswordHash()
	if hash == "" {
		return false
	}
	token := ""
	if c, err := r.Cookie(operatorAuthCookie); err == nil {
		token = c.Value
	}
	if token == "" {
		token = strings.TrimSpace(r.Header.Get(operatorAuthHeader))
	}
	if token == "" {
		return false
	}
	expect := operatorSessionTokenFromHash(hash)
	if len(token) != len(expect) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(expect)) == 1
}

func operatorSessionTokenFromHash(hash string) string {
	sum := sha256.Sum256([]byte("maxq-session|" + hash))
	return hex.EncodeToString(sum[:])
}

func writeAuthJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":    false,
		"error": msg,
		"auth":  "required",
	})
}

func isAuthExempt(path string) bool {
	switch path {
	case "/login",
		"/api/auth/login",
		"/api/auth/status",
		"/api/auth/set-password",
		"/api/auth/operator",
		"/mocha.css",
		"/shell.js":
		return true
	}
	if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") {
		return true
	}
	return false
}

// withOperatorAuth wraps the handler stack. When operator_auth is false (default),
// this is a no-op pass-through so the overnight demo stays open.
func (s *server) withOperatorAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.operatorAuth {
			next.ServeHTTP(w, r)
			return
		}
		if isAuthExempt(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		if s.validOperatorSession(r) {
			next.ServeHTTP(w, r)
			return
		}
		if isAPIPath(r.URL.Path) || strings.HasPrefix(r.URL.Path, "/api/") {
			writeAuthJSONError(w, http.StatusUnauthorized, "operator password required")
			return
		}
		http.Redirect(w, r, "/login?next="+r.URL.Path, http.StatusFound)
	})
}

func (s *server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"operator_auth": s.operatorAuth,
		"authenticated": !s.operatorAuth || s.validOperatorSession(r),
		"has_hash":      s.operatorPasswordHash() != "",
	})
}

func (s *server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	if !s.operatorAuth {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"skipped": true,
			"reason":  "operator_auth=false",
		})
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	defer r.Body.Close()
	_ = json.NewDecoder(r.Body).Decode(&body)
	if !s.checkOperatorPassword(body.Password) {
		writeAuthJSONError(w, http.StatusUnauthorized, "invalid operator password")
		return
	}
	hash := s.operatorPasswordHash()
	token := operatorSessionTokenFromHash(hash)
	http.SetCookie(w, &http.Cookie{
		Name:     operatorAuthCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(12 * time.Hour),
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "auth": "session"})
}

// handleAuthSetPassword POST /api/auth/set-password
// Body: {"password":"...","current_password":"..."}.
// Allowed when operator_auth is false, OR when current_password matches.
// Writes bcrypt hash to ~/.config/maxq/operator.password.hash (0600).
func (s *server) handleAuthSetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	var body struct {
		Password        string `json:"password"`
		CurrentPassword string `json:"current_password"`
	}
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAuthJSONError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(body.Password) == "" {
		writeAuthJSONError(w, http.StatusBadRequest, "password required")
		return
	}
	if len(body.Password) < 8 {
		writeAuthJSONError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.operatorAuth {
		if !s.checkOperatorPassword(body.CurrentPassword) && !s.validOperatorSession(r) {
			writeAuthJSONError(w, http.StatusUnauthorized, "current password required while operator_auth is on")
			return
		}
	}
	hash, err := hashOperatorPassword(body.Password)
	if err != nil {
		writeAuthJSONError(w, http.StatusInternalServerError, "hash failed")
		return
	}
	if err := s.writeOperatorPasswordHash(hash); err != nil {
		writeAuthJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"has_hash":      true,
		"operator_auth": s.operatorAuth,
		"hash_file":     operatorHashFilename,
		"note":          "hash stored; glass stays open until operator_auth is enabled",
	})
}

// handleAuthOperator POST /api/auth/operator
// Body: {"enabled":true|false,"password":"..."}.
// Enable/disable only after a hash exists. When auth is currently on,
// password (or valid session) is required to flip the flag.
func (s *server) handleAuthOperator(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	var body struct {
		Enabled  *bool  `json:"enabled"`
		Password string `json:"password"`
	}
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAuthJSONError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.Enabled == nil {
		writeAuthJSONError(w, http.StatusBadRequest, "enabled required")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.operatorPasswordHash() == "" {
		writeAuthJSONError(w, http.StatusConflict, "set an operator password before enabling auth")
		return
	}
	if s.operatorAuth {
		if !s.checkOperatorPassword(body.Password) && !s.validOperatorSession(r) {
			writeAuthJSONError(w, http.StatusUnauthorized, "password required to change operator_auth while enabled")
			return
		}
	}
	want := *body.Enabled
	if want == s.operatorAuth {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":            true,
			"operator_auth": s.operatorAuth,
			"unchanged":     true,
			"has_hash":      true,
		})
		return
	}
	s.operatorAuth = want
	if err := s.writeAPIToml(); err != nil {
		s.operatorAuth = !want
		writeAuthJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	note := "operator_auth disabled — glass is open"
	if want {
		note = "DANGER: operator_auth enabled — EVA :7432 is locked behind the password wall"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"operator_auth": s.operatorAuth,
		"has_hash":      true,
		"note":          note,
	})
}

func (s *server) registerAuthRoutes(mux *http.ServeMux, ui http.FileSystem) {
	mux.HandleFunc("GET /login", serveUIFile(ui, "login.html"))
	mux.HandleFunc("GET /api/auth/status", s.handleAuthStatus)
	mux.HandleFunc("POST /api/auth/login", s.handleAuthLogin)
	mux.HandleFunc("POST /api/auth/set-password", s.handleAuthSetPassword)
	mux.HandleFunc("POST /api/auth/operator", s.handleAuthOperator)
}
