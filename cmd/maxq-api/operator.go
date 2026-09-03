package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var siteKeys = []string{"chatgpt", "grok", "claude", "discord", "slack"}

type ghosttyInfo struct {
	Installed bool   `json:"installed"`
	Default   bool   `json:"default"`
	Version   string `json:"version"`
}

type launcherInfo struct {
	Name    string `json:"name"`
	Keybind string `json:"keybind"`
}

type defaultsInfo struct {
	DefaultAIChat string            `json:"default_ai_chat"`
	Sites         map[string]string `json:"sites"`
}

type desktopConfigInfo struct {
	Ghostty  ghosttyInfo  `json:"ghostty"`
	Launcher launcherInfo `json:"launcher"`
	Defaults defaultsInfo `json:"defaults"`
}

type sbomEntry struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Path    string `json:"path"`
	Source  string `json:"source"`
}

type surfacePolicy struct {
	Listen    string `json:"listen"`
	APIPublic bool   `json:"api_public"`
	UIPublic  bool   `json:"ui_public"`
}

type listenReq struct {
	APIPublic *bool `json:"api_public"`
	UIPublic  *bool `json:"ui_public"`
}

func (s *server) registerOperatorUI(mux *http.ServeMux, ui http.FileSystem) {
	serve := func(name string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) { serveUIFile(w, r, ui, name) }
	}
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		serveUIFile(w, r, ui, "index.html")
	})
	mux.HandleFunc("GET /box", serve("box.html"))
	for _, path := range []string{"/processes", "/files", "/sessions", "/handoff", "/vault", "/ai", "/skills"} {
		mux.HandleFunc("GET "+path, serve("stub.html"))
	}
	for _, name := range []string{"operator.css", "operator.js", "box.js", "desktops.css", "desktops.js"} {
		mux.HandleFunc("GET /"+name, serve(name))
	}
}

func serveUIFile(w http.ResponseWriter, r *http.Request, ui http.FileSystem, name string) {
	f, err := ui.Open(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		http.Error(w, "ui unavailable", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, name, st.ModTime(), f)
}

func (s *server) surfaceGate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isLoopbackAddr(r.RemoteAddr) {
			next.ServeHTTP(w, r)
			return
		}
		p := s.surfacePolicy()
		if isUIRequest(r) {
			if !p.UIPublic {
				http.Error(w, "operator glass is loopback only", http.StatusForbidden)
				return
			}
		} else if !p.APIPublic {
			http.Error(w, "api is loopback only", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func isUIRequest(r *http.Request) bool {
	if r.Method != http.MethodGet {
		return false
	}
	if r.URL.Path == "/desktops" {
		return strings.Contains(r.Header.Get("Accept"), "text/html")
	}
	switch r.URL.Path {
	case "/", "/box", "/processes", "/files", "/sessions", "/handoff", "/vault", "/ai", "/skills",
		"/operator.css", "/operator.js", "/box.js", "/desktops.css", "/desktops.js":
		return true
	default:
		return false
	}
}

func (s *server) surfacePolicy() surfacePolicy {
	p := surfacePolicy{Listen: defaultListen, APIPublic: true, UIPublic: true}
	path := filepath.Join(s.config, "api.toml")
	if v := top(path, "listen"); v != "" {
		p.Listen = sanitizeListen(v)
	}
	if raw := top(path, "api_public"); raw != "" {
		p.APIPublic = asBool(raw)
	}
	if raw := top(path, "ui_public"); raw != "" {
		p.UIPublic = asBool(raw)
	}
	return p
}

func (s *server) apiInfo() apiInfo {
	p := s.surfacePolicy()
	return apiInfo{Listen: s.listen, ConfiguredListen: p.Listen, APIPublic: p.APIPublic, UIPublic: p.UIPublic}
}

func (s *server) handleListen(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var req listenReq
	dec := json.NewDecoder(io.LimitReader(r.Body, 4096))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	p := s.surfacePolicy()
	if req.APIPublic != nil {
		p.APIPublic = *req.APIPublic
	}
	if req.UIPublic != nil {
		p.UIPublic = *req.UIPublic
	}
	if p.APIPublic || p.UIPublic {
		p.Listen = defaultListen
	} else {
		p.Listen = "127.0.0.1:7432"
	}
	if err := s.writeSurfacePolicy(p); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"api_public":        p.APIPublic,
		"ui_public":         p.UIPublic,
		"configured_listen": p.Listen,
		"effective_listen":  s.listen,
		"restart_required":  p.Listen != s.listen,
	})
}

func (s *server) writeSurfacePolicy(p surfacePolicy) error {
	if err := os.MkdirAll(s.config, 0o700); err != nil {
		return err
	}
	path := filepath.Join(s.config, "api.toml")
	tmp := path + ".tmp"
	body := fmt.Sprintf("# MaxQ control surfaces. Managed by Operator Glass.\nlisten = %q\napi_public = %t\nui_public = %t\n", p.Listen, p.APIPublic, p.UIPublic)
	if err := os.WriteFile(tmp, []byte(body), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func (s *server) handleDesktop(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, desktopConfigInfo{Ghostty: s.ghostty(), Launcher: s.launcher(), Defaults: s.defaults()})
}

func (s *server) handleSBOM(w http.ResponseWriter, r *http.Request) {
	p := filepath.Join(s.config, "sbom.json")
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, []sbomEntry{})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	var entries []sbomEntry
	if err := json.Unmarshal(b, &entries); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "invalid sbom.json"})
		return
	}
	if entries == nil {
		entries = []sbomEntry{}
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *server) handleGetDefaults(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.defaults())
}

func (s *server) handleSetDefaults(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var req defaultsInfo
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<16))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	if err := validateDefaults(req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := s.writeDefaults(req); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "defaults": s.defaults()})
}

func (s *server) ghostty() ghosttyInfo {
	bin := filepath.Join(s.prefix, "bin", "ghostty")
	installed := isExecutable(bin)
	def := installed && fileHasLine(filepath.Join(s.prefix, ".config", "xfce4", "helpers.rc"), "TerminalEmulator=ghostty") && fileExists(filepath.Join(s.prefix, ".local", "share", "applications", "ghostty.desktop"))
	version := ""
	if installed {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if out, err := exec.CommandContext(ctx, bin, "--version").Output(); err == nil {
			version = strings.TrimSpace(string(out))
			if i := strings.IndexByte(version, '\n'); i >= 0 {
				version = version[:i]
			}
		}
	}
	return ghosttyInfo{Installed: installed, Default: def, Version: version}
}

func (s *server) launcher() launcherInfo {
	name := "missing"
	if b, err := os.ReadFile(filepath.Join(s.config, "desktop", "launcher")); err == nil {
		if v := strings.TrimSpace(string(b)); v != "" {
			name = v
		}
	}
	return launcherInfo{Name: name, Keybind: "Super+Space"}
}

func defaultDefaults() defaultsInfo {
	return defaultsInfo{DefaultAIChat: "chatgpt", Sites: map[string]string{
		"chatgpt": "https://chatgpt.com",
		"grok":    "https://grok.com",
		"claude":  "https://claude.ai",
		"discord": "https://discord.com/app",
		"slack":   "https://app.slack.com/client",
	}}
}

func (s *server) defaults() defaultsInfo {
	p := filepath.Join(s.config, "defaults.toml")
	d := defaultDefaults()
	if v := top(p, "default_ai_chat"); v != "" {
		d.DefaultAIChat = v
	}
	for _, k := range siteKeys {
		if v := sec(p, "sites", k); v != "" {
			d.Sites[k] = v
		}
	}
	return d
}

func validateDefaults(d defaultsInfo) error {
	switch d.DefaultAIChat {
	case "chatgpt", "grok", "claude":
	default:
		return fmt.Errorf("default_ai_chat must be chatgpt, grok, or claude")
	}
	for _, k := range siteKeys {
		u, err := url.Parse(strings.TrimSpace(d.Sites[k]))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return fmt.Errorf("sites.%s must be an http(s) URL", k)
		}
	}
	return nil
}

func tomlQuote(v string) string {
	return strings.ReplaceAll(strings.ReplaceAll(v, "\\", "\\\\"), "\"", "\\\"")
}

func (s *server) writeDefaults(d defaultsInfo) error {
	if err := os.MkdirAll(s.config, 0o700); err != nil {
		return err
	}
	p := filepath.Join(s.config, "defaults.toml")
	tmp := p + ".tmp"
	var b strings.Builder
	fmt.Fprintln(&b, "# MaxQ operator defaults. Revert preserves this file.")
	fmt.Fprintf(&b, "default_ai_chat = \"%s\"\n\n[sites]\n", tomlQuote(d.DefaultAIChat))
	for _, k := range siteKeys {
		fmt.Fprintf(&b, "%s = \"%s\"\n", k, tomlQuote(strings.TrimSpace(d.Sites[k])))
	}
	if err := os.WriteFile(tmp, []byte(b.String()), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func proveState(state string) string {
	if state == "applied" {
		return "PASS"
	}
	return "—"
}

func isExecutable(path string) bool {
	st, err := os.Stat(path)
	return err == nil && st.Mode().IsRegular() && st.Mode().Perm()&0o111 != 0
}
func fileExists(path string) bool { _, err := os.Stat(path); return err == nil }
func fileHasLine(path, want string) bool {
	b, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(b), "\n") {
		if strings.TrimSpace(line) == want {
			return true
		}
	}
	return false
}
