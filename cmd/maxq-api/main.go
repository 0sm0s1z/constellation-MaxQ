// MaxQ control API — loopback only, stdlib HTTP, tiny.
// GET /status  POST /apply  POST /revert  POST /proxy
// Static settings sheet at /. Never writes Chrome proxy policy.
package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed ui/index.html ui/mocha.css ui/sheet.js
var uiEmbed embed.FS

const defaultListen = "127.0.0.1:7432"

type gostInfo struct {
	Enabled   bool   `json:"enabled"`
	Running   bool   `json:"running"`
	Listen    string `json:"listen"`
	Intercept bool   `json:"intercept"`
}

type statusResp struct {
	State string   `json:"state"`
	Theme string   `json:"theme"`
	Gost  gostInfo `json:"gost"`
	API   struct {
		Listen string `json:"listen"`
	} `json:"api"`
}

type proxyReq struct {
	Enabled *bool `json:"enabled"`
}

type server struct {
	prefix  string
	config  string
	listen  string
	maxqBin string
	mu      sync.Mutex
}

func main() {
	prefix := os.Getenv("MAXQ_HOME")
	if prefix == "" {
		prefix = os.Getenv("HOME")
	}
	if prefix == "" {
		fmt.Fprintln(os.Stderr, "maxq-api: HOME unset")
		os.Exit(1)
	}

	s := &server{
		prefix:  prefix,
		config:  filepath.Join(prefix, ".config", "maxq"),
		maxqBin: filepath.Join(prefix, "bin", "maxq"),
	}
	s.listen = sanitizeListen(s.loadListen())
	if err := s.serve(); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, "maxq-api:", err)
		os.Exit(1)
	}
}

func (s *server) loadListen() string {
	if v := strings.TrimSpace(os.Getenv("MAXQ_API_LISTEN")); v != "" {
		return v
	}
	p := filepath.Join(s.config, "api.toml")
	if b, err := os.ReadFile(p); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if strings.HasPrefix(line, "[") {
				break
			}
			if strings.HasPrefix(line, "listen") {
				_, rest, ok := strings.Cut(line, "=")
				if ok {
					return unquote(strings.TrimSpace(rest))
				}
			}
		}
	}
	return defaultListen
}

func unquote(v string) string {
	v = strings.TrimSpace(v)
	if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' {
		return v[1 : len(v)-1]
	}
	return v
}

func sanitizeListen(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return defaultListen
	}
	host, port, err := net.SplitHostPort(v)
	if err != nil || port == "" {
		return defaultListen
	}
	if strings.EqualFold(host, "localhost") {
		return net.JoinHostPort("127.0.0.1", port)
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		fmt.Fprintf(os.Stderr, "maxq-api: refusing non-loopback listen %q; using %s\n", v, defaultListen)
		return defaultListen
	}
	return net.JoinHostPort(host, port)
}

func hostPort(v string) (string, string, bool) {
	host, port, err := net.SplitHostPort(v)
	if err != nil {
		return "", "", false
	}
	return strings.Trim(host, "[]"), port, true
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func (s *server) localHostPort(v string) bool {
	host, port, ok := hostPort(v)
	if !ok || !isLoopbackHost(host) {
		return false
	}
	_, wantPort, ok := hostPort(s.listen)
	return ok && port == wantPort
}

func (s *server) allowedOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true // curl/local clients
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "http" || u.User != nil || u.Path != "" {
		return false
	}
	return s.localHostPort(u.Host)
}

func (s *server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")

		host, _, ok := hostPort(r.RemoteAddr)
		if !ok || !isLoopbackHost(host) || !s.localHostPort(r.Host) {
			http.Error(w, "local only", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead && !s.allowedOrigin(r) {
			http.Error(w, "local origin required", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) serve() error {
	ui, err := fs.Sub(uiEmbed, "ui")
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", s.handleStatus)
	mux.HandleFunc("POST /apply", s.handleApply)
	mux.HandleFunc("POST /revert", s.handleRevert)
	mux.HandleFunc("POST /proxy", s.handleProxy)
	mux.Handle("GET /", http.FileServer(http.FS(ui)))

	ln, err := net.Listen("tcp", s.listen)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "maxq-api listen %s (loopback, no Chrome proxy)\n", s.listen)
	srv := &http.Server{
		Handler:           s.guard(mux),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	return srv.Serve(ln)
}

func (s *server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.status())
}

func (s *server) handleApply(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.runMaxq("apply"); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": s.status()})
}

func (s *server) handleRevert(w http.ResponseWriter, _ *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// A normal `maxq revert` stops the API via api.pid. For an API-triggered
	// revert, temporarily detach that pidfile so the command can finish and
	// report errors before this process exits itself.
	pidPath := filepath.Join(s.config, "api.pid")
	pid, err := os.ReadFile(pidPath)
	if err != nil && !os.IsNotExist(err) {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "cannot read api pidfile"})
		return
	}
	if len(pid) > 0 {
		if err := os.Remove(pidPath); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": "cannot detach api pidfile"})
			return
		}
	}
	if err := s.runMaxq("revert"); err != nil {
		if len(pid) > 0 {
			_ = os.WriteFile(pidPath, pid, 0o644)
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": "reverted"})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	go func() {
		time.Sleep(100 * time.Millisecond)
		os.Exit(0)
	}()
}

func (s *server) handleProxy(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var req proxyReq
	dec := json.NewDecoder(io.LimitReader(r.Body, 1024))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "expected JSON {\"enabled\":true|false}"})
		return
	}
	if req.Enabled == nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "enabled is required"})
		return
	}

	sub := "off"
	if *req.Enabled {
		sub = "on"
	}
	if err := s.runMaxq("proxy", sub); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": s.status()})
}

func (s *server) status() statusResp {
	toml := filepath.Join(s.config, "maxq.toml")
	stateFile := filepath.Join(s.config, "state")
	state := "reverted"
	if b, err := os.ReadFile(stateFile); err == nil {
		v := strings.TrimSpace(string(b))
		if v == "applied" || v == "reverted" {
			state = v
		}
	} else if top(toml, "state") == "applied" {
		state = "applied"
	}
	theme := top(toml, "theme")
	if theme == "" {
		theme = "mocha"
	}

	st := statusResp{
		State: state,
		Theme: theme,
		Gost: gostInfo{
			Enabled:   asBool(sec(toml, "gost", "enabled")),
			Running:   pidRunning(filepath.Join(s.config, "gost.pid")),
			Listen:    orDefault(sec(toml, "gost", "listen"), "127.0.0.1:8080"),
			Intercept: asBool(sec(toml, "gost", "intercept")),
		},
	}
	st.API.Listen = s.listen
	return st
}

func (s *server) runMaxq(args ...string) error {
	bin := s.maxqBin
	if _, err := os.Stat(bin); err != nil {
		if p, err := exec.LookPath("maxq"); err == nil {
			bin = p
		} else {
			return fmt.Errorf("maxq binary not found")
		}
	}
	cmd := exec.Command(bin, args...)
	cmd.Env = append(os.Environ(), "MAXQ_HOME="+s.prefix)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if len(msg) > 800 {
			msg = msg[:800]
		}
		return fmt.Errorf("maxq %s: %v %s", strings.Join(args, " "), err, msg)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func pidRunning(path string) bool {
	b, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	pid := strings.TrimSpace(string(b))
	if pid == "" {
		return false
	}
	f, err := os.Open(filepath.Join("/proc", pid))
	if err != nil {
		return false
	}
	_ = f.Close()
	return true
}

func asBool(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "true", "on", "yes", "1":
		return true
	}
	return false
}

func orDefault(v, d string) string {
	if strings.TrimSpace(v) == "" {
		return d
	}
	return v
}

func top(path, key string) string {
	return tomlGet(path, "", key)
}

func sec(path, section, key string) string {
	return tomlGet(path, section, key)
}

func tomlGet(path, section, key string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	in := section == ""
	for _, line := range strings.Split(string(b), "\n") {
		trim := strings.TrimSpace(line)
		if trim == "" || strings.HasPrefix(trim, "#") {
			continue
		}
		if strings.HasPrefix(trim, "[") && strings.HasSuffix(trim, "]") {
			in = strings.TrimSpace(trim[1:len(trim)-1]) == section
			continue
		}
		if !in {
			continue
		}
		name, rest, ok := strings.Cut(trim, "=")
		if ok && strings.TrimSpace(name) == key {
			return unquote(strings.TrimSpace(rest))
		}
	}
	return ""
}
