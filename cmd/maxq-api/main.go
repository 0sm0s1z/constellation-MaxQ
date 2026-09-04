// MaxQ control API — loopback only, stdlib HTTP, tiny.
// GET /status /desktops; POST /apply /revert /proxy /desktops/preferences.
// Static settings sheet at / and operator desktop workspace at /desktops.
package main

import (
	"embed"
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
)

//go:embed ui/index.html ui/mocha.css ui/sheet.js ui/desktops.html ui/desktops.css ui/desktops.js
var uiEmbed embed.FS

const defaultListen = "127.0.0.1:7432"

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
	Listen string `json:"listen"`
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
		return defaultListen
	}
	host, port, err := net.SplitHostPort(v)
	if err != nil {
		return defaultListen
	}
	if host == "localhost" {
		host = "127.0.0.1"
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		fmt.Fprintf(os.Stderr, "maxq-api: refusing non-loopback listen %q; using %s\n", v, defaultListen)
		return defaultListen
	}
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 10 && ip4[1] == 0 {
		fmt.Fprintf(os.Stderr, "maxq-api: refusing 10.0.0.0/16 listen %q; using %s\n", v, defaultListen)
		return defaultListen
	}
	return net.JoinHostPort(host, port)
}

func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func (s *server) onlyLocal(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackAddr(r.RemoteAddr) {
			http.Error(w, "local only", http.StatusForbidden)
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
	uiFS := http.FS(ui)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", s.handleStatus)
	mux.HandleFunc("GET /desktops", func(w http.ResponseWriter, r *http.Request) {
		s.handleDesktops(w, r, uiFS)
	})
	mux.HandleFunc("POST /desktops/preferences", s.handleDesktopPreferences)
	mux.HandleFunc("POST /apply", s.handleApply)
	mux.HandleFunc("POST /revert", s.handleRevert)
	mux.HandleFunc("POST /proxy", s.handleProxy)
	mux.Handle("/", http.FileServer(uiFS))

	ln, err := net.Listen("tcp", s.listen)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "maxq-api listen %s (loopback, no Chrome proxy)\n", s.listen)
	srv := &http.Server{
		Handler:           s.onlyLocal(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	return srv.Serve(ln)
}

func (s *server) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.status())
}

func (s *server) handleApply(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.runMaxq("apply"); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	st := s.status()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": st.State, "status": st})
}

func (s *server) handleRevert(w http.ResponseWriter, r *http.Request) {
	// Flush 200 first: maxq revert stops this process via pidfile.
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": "reverted"})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	go func() {
		time.Sleep(200 * time.Millisecond)
		_ = s.runMaxq("revert")
	}()
}

func (s *server) handleProxy(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var req proxyReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
			return
		}
	}
	if req.Enabled != nil {
		if *req.Enabled {
			if err := s.runMaxq("proxy", "on"); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
				return
			}
		} else {
			if err := s.runMaxq("proxy", "off"); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
				return
			}
		}
	}
	if req.Upstream != nil {
		up := strings.TrimSpace(*req.Upstream)
		if up == "" {
			up = "none"
		}
		if err := s.runMaxq("proxy", "upstream", up); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
			return
		}
	}
	if req.Iface != nil {
		iface := strings.TrimSpace(*req.Iface)
		if iface == "" {
			iface = "none"
		}
		if err := s.runMaxq("proxy", "iface", iface); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
			return
		}
	}
	st := s.status()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": st})
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
	return statusResp{
		State: state,
		Theme: theme,
		Gost: gostInfo{
			Enabled:   asBool(sec(toml, "gost", "enabled")),
			Running:   pidRunning(gostPID),
			Listen:    orDefault(sec(toml, "gost", "listen"), "127.0.0.1:8080"),
			Upstream:  sec(toml, "gost", "upstream"),
			Iface:     sec(toml, "gost", "iface"),
			Intercept: asBool(sec(toml, "gost", "intercept")),
		},
		Clis: clisInfo{
			Installed:   sec(toml, "clis", "installed"),
			Skipped:     sec(toml, "clis", "skipped"),
			Preexisting: sec(toml, "clis", "preexisting"),
		},
		API: apiInfo{Listen: s.listen},
	}
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
			name := strings.TrimSpace(trim[1 : len(trim)-1])
			in = name == section
			continue
		}
		if !in {
			continue
		}
		name, rest, ok := strings.Cut(trim, "=")
		if !ok {
			continue
		}
		if strings.TrimSpace(name) == key {
			return unquote(strings.TrimSpace(rest))
		}
	}
	return ""
}
