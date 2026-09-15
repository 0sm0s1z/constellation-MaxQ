// MaxQ control API — loopback only, stdlib HTTP, tiny.
// GET /status /desktop /defaults /sbom /desktops /actions; POST /apply /revert /proxy /defaults /bind /desktops/preferences /actions/{id}/run.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"embed"
)

//go:embed ui/*.html ui/*.css ui/*.js
var uiEmbed embed.FS

const defaultListen = "127.0.0.1:7432"
const publicListen = "0.0.0.0:7432"

type gostInfo struct {
	Enabled   bool   `json:"enabled"`
	Running   bool   `json:"running"`
	Listen    string `json:"listen"`
	Upstream  string `json:"upstream"`
	Iface     string `json:"iface"`
	Intercept bool   `json:"intercept"`
}
type clisInfo struct {
	Installed   string `json:"installed"`
	Skipped     string `json:"skipped"`
	Preexisting string `json:"preexisting"`
}
type apiInfo struct {
	Listen    string `json:"listen"`
	APIPublic bool   `json:"api_public"`
	UIPublic  bool   `json:"ui_public"`
}
type statusResp struct {
	State string   `json:"state"`
	Theme string   `json:"theme"`
	Gost  gostInfo `json:"gost"`
	Clis  clisInfo `json:"clis"`
	API   apiInfo  `json:"api"`
}
type proxyReq struct {
	Enabled  *bool   `json:"enabled"`
	Upstream *string `json:"upstream"`
	Iface    *string `json:"iface"`
}
type bindReq struct {
	APIPublic *bool `json:"api_public"`
	UIPublic  *bool `json:"ui_public"`
}
type server struct {
	prefix       string
	config       string
	listen       string
	apiPublic    bool
	uiPublic     bool
	operatorAuth bool // disabled-by-default password wall (see auth.go)
	maxqBin      string
	mu           sync.Mutex
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
	s := &server{prefix: prefix, config: filepath.Join(prefix, ".config", "maxq"), maxqBin: filepath.Join(prefix, "bin", "maxq")}
	s.loadBind()
	s.loadActionRuns()
	_ = os.WriteFile(filepath.Join(s.config, "api.pid"), []byte(fmt.Sprintf("%d\n", os.Getpid())), 0o644)
	if err := s.serve(); err != nil {
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
			if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[") {
				if strings.HasPrefix(line, "[") {
					break
				}
				continue
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
		return publicListen
	}
	host, port, err := net.SplitHostPort(v)
	if err != nil {
		return publicListen
	}
	if host == "localhost" {
		host = "127.0.0.1"
	}
	if host == "" || host == "0.0.0.0" || host == "::" || host == "::0" {
		return net.JoinHostPort("0.0.0.0", port)
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return publicListen
	}
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 10 && ip4[1] == 0 {
		fmt.Fprintf(os.Stderr, "maxq-api: refusing student-range listen %q; using %s\n", v, publicListen)
		return publicListen
	}
	if ip.IsLoopback() || ip.IsUnspecified() {
		return net.JoinHostPort(host, port)
	}
	fmt.Fprintf(os.Stderr, "maxq-api: refusing listen %q; using %s\n", v, publicListen)
	return publicListen
}
func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
func isAPIPath(p string) bool {
	switch p {
	case "/status", "/desktop", "/defaults", "/sbom", "/apply", "/revert", "/proxy", "/bind":
		return true
	default:
		return strings.HasPrefix(p, "/status") || strings.HasPrefix(p, "/desktop") || strings.HasPrefix(p, "/defaults") || strings.HasPrefix(p, "/sbom") || strings.HasPrefix(p, "/apply") || strings.HasPrefix(p, "/revert") || strings.HasPrefix(p, "/proxy") || strings.HasPrefix(p, "/bind") || strings.HasPrefix(p, "/actions") || strings.HasPrefix(p, "/api/processes") || strings.HasPrefix(p, "/api/stubs") || strings.HasPrefix(p, "/api/auth")
	}
}
func (s *server) loadBind() {
	s.listen = sanitizeListen(s.loadListen())
	s.apiPublic = asBool(orDefault(s.tomlAPI("api_public"), "true"))
	s.uiPublic = asBool(orDefault(s.tomlAPI("ui_public"), "true"))
	s.operatorAuth = s.loadOperatorAuth() // default false — demo stays open
	if s.listen == defaultListen && (s.apiPublic || s.uiPublic) {
		s.listen = publicListen
	}
	if !s.apiPublic && !s.uiPublic {
		s.listen = defaultListen
	}
}
func (s *server) tomlAPI(key string) string { return top(filepath.Join(s.config, "api.toml"), key) }
func (s *server) writeAPIToml() error {
	if err := os.MkdirAll(s.config, 0o755); err != nil {
		return err
	}
	body := fmt.Sprintf("# constellation-MaxQ control API (managed — do not edit by hand)\n# 0.0.0.0 is allowed. Never bind 10.0.0.0/16.\n# api_public / ui_public gate LAN access per surface.\n# operator_auth defaults false — leave OFF for open demo glass.\n\nlisten = %q\napi_public = %s\nui_public = %s\noperator_auth = %s\n", s.listen, boolTOML(s.apiPublic), boolTOML(s.uiPublic), boolTOML(s.operatorAuth))
	return os.WriteFile(filepath.Join(s.config, "api.toml"), []byte(body), 0o644)
}
func boolTOML(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
func (s *server) gate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		local := isLoopbackAddr(r.RemoteAddr)
		allow := local
		if isAPIPath(r.URL.Path) {
			allow = local || s.apiPublic
		} else {
			allow = local || s.uiPublic
		}
		if !allow {
			http.Error(w, "local only", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func serveUIFile(ui http.FileSystem, name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f, err := ui.Open(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		st, err := f.Stat()
		mod := time.Time{}
		if err == nil {
			mod = st.ModTime()
		}
		http.ServeContent(w, r, name, mod, f)
	}
}

func (s *server) serve() error {
	ui, err := fs.Sub(uiEmbed, "ui")
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", s.handleStatus)
	mux.HandleFunc("GET /desktop", s.handleDesktop)
	mux.HandleFunc("GET /defaults", s.handleGetDefaults)
	mux.HandleFunc("GET /sbom", s.handleSBOM)
	mux.HandleFunc("GET /desktops", func(w http.ResponseWriter, r *http.Request) {
		s.handleDesktops(w, r, http.FS(ui))
	})
	mux.HandleFunc("POST /desktops/preferences", s.handleDesktopPreferences)
	mux.HandleFunc("POST /desktops/ensure-viewers", s.handleEnsureDesktopViewers)
	mux.HandleFunc("POST /desktops/{n}/suspend", s.handleDesktopSuspend)
	mux.HandleFunc("POST /desktops/{n}/resume", s.handleDesktopResume)
	mux.HandleFunc("POST /defaults", s.handleSetDefaults)
	mux.HandleFunc("POST /apply", s.handleApply)
	mux.HandleFunc("POST /revert", s.handleRevert)
	mux.HandleFunc("POST /proxy", s.handleProxy)
	mux.HandleFunc("POST /bind", s.handleBind)
	mux.HandleFunc("GET /actions", func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.Header.Get("Accept"), "text/html") {
			serveUIFile(http.FS(ui), "actions.html")(w, r)
			return
		}
		s.handleActions(w, r)
	})
	mux.HandleFunc("GET /api/processes", s.handleProcessesAPI)
	mux.HandleFunc("POST /api/processes/{pid}/stop", s.handleProcessStop)
	mux.HandleFunc("POST /actions/{id}/run", s.handleActionRun)
	mux.HandleFunc("GET /actions/runs/{id}", s.handleActionRunGet)
	for _, page := range []struct{ path, file string }{
		{"/box", "box.html"},
		{"/processes", "processes.html"},
		{"/files", "files.html"},
		{"/sessions", "sessions.html"},
		{"/handoff", "handoff.html"},
		{"/vault", "vault.html"},
		{"/ai", "ai.html"},
		{"/skills", "skills.html"},
	} {
		mux.HandleFunc("GET "+page.path, serveUIFile(http.FS(ui), page.file))
	}
	RegisterStubRoutes(mux)
	s.registerAuthRoutes(mux, http.FS(ui))
	mux.Handle("/", http.FileServer(http.FS(ui)))
	ln, err := net.Listen("tcp", s.listen)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "maxq-api listen %s api_public=%t ui_public=%t operator_auth=%t\n", s.listen, s.apiPublic, s.uiPublic, s.operatorAuth)
	// gate (LAN) then operator auth stub (no-op while operator_auth=false)
	return (&http.Server{Handler: s.gate(s.withOperatorAuth(mux)), ReadHeaderTimeout: 5 * time.Second}).Serve(ln)
}
func (s *server) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.status())
}
func (s *server) handleApply(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.runMaxq("apply"); err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	st := s.status()
	writeJSON(w, 200, map[string]any{"ok": true, "state": st.State, "status": st})
}
func (s *server) handleRevert(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true, "state": "reverted"})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	go func() { time.Sleep(200 * time.Millisecond); _ = s.runMaxq("revert") }()
}
func (s *server) handleProxy(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var req proxyReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid json"})
			return
		}
	}
	if req.Enabled != nil {
		v := "off"
		if *req.Enabled {
			v = "on"
		}
		if err := s.runMaxq("proxy", v); err != nil {
			writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
			return
		}
	}
	if req.Upstream != nil {
		v := strings.TrimSpace(*req.Upstream)
		if v == "" {
			v = "none"
		}
		if err := s.runMaxq("proxy", "upstream", v); err != nil {
			writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
			return
		}
	}
	if req.Iface != nil {
		v := strings.TrimSpace(*req.Iface)
		if v == "" {
			v = "none"
		}
		if err := s.runMaxq("proxy", "iface", v); err != nil {
			writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
			return
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "status": s.status()})
}
func (s *server) handleBind(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var req bindReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid json"})
			return
		}
	}
	if req.APIPublic != nil {
		s.apiPublic = *req.APIPublic
	}
	if req.UIPublic != nil {
		s.uiPublic = *req.UIPublic
	}
	if s.apiPublic || s.uiPublic {
		s.listen = publicListen
	} else {
		s.listen = defaultListen
	}
	if err := s.writeAPIToml(); err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "status": s.status(), "rebind": true})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	go func() {
		time.Sleep(250 * time.Millisecond)
		bin, err := os.Executable()
		if err != nil {
			os.Exit(0)
		}
		cmd := exec.Command(bin)
		cmd.Env = os.Environ()
		cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
		_ = cmd.Start()
		os.Exit(0)
	}()
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
	gostPID := filepath.Join(s.config, "gost.pid")
	return statusResp{State: state, Theme: theme, Gost: gostInfo{Enabled: asBool(sec(toml, "gost", "enabled")), Running: pidRunning(gostPID), Listen: orDefault(sec(toml, "gost", "listen"), "127.0.0.1:8080"), Upstream: sec(toml, "gost", "upstream"), Iface: sec(toml, "gost", "iface"), Intercept: asBool(sec(toml, "gost", "intercept"))}, Clis: clisInfo{Installed: sec(toml, "clis", "installed"), Skipped: sec(toml, "clis", "skipped"), Preexisting: sec(toml, "clis", "preexisting")}, API: apiInfo{Listen: s.listen, APIPublic: s.apiPublic, UIPublic: s.uiPublic}}
}
func (s *server) runMaxq(args ...string) error {
	bin := s.maxqBin
	if _, err := os.Stat(bin); err != nil {
		if p, e := exec.LookPath("maxq"); e == nil {
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	_ = enc.Encode(v)
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
func top(path, key string) string          { return tomlGet(path, "", key) }
func sec(path, section, key string) string { return tomlGet(path, section, key) }
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
			name := strings.TrimSpace(trim[1 : len(trim)-1])
			in = name == section
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
