// MaxQ control API — loopback only, stdlib HTTP, tiny.
// GET /status  POST /apply  POST /revert  POST /proxy
// Static settings sheet at /. Never writes Chrome proxy policy.
package main

import (
	"context"
	"crypto/rand"
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

	"embed"
)

//go:embed ui/index.html ui/mocha.css ui/sheet.js
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
	Installed string `json:"installed"`
	Skipped   string `json:"skipped"`
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

// connection is the persisted form. Auth is deliberately never JSON encoded
// in an API response; the sheet only needs to know whether it is configured.
type connection struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	Auth    string `json:"auth,omitempty"`
}

type connectionView struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	BaseURL        string `json:"base_url"`
	AuthConfigured bool   `json:"auth_configured"`
}

type connectionsFile struct {
	Connections []connection `json:"connections"`
}

type connectionReq struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	Auth    string `json:"auth"`
}

type desktopActionReq struct {
	ConnectionID string          `json:"connection_id"`
	DesktopID    string          `json:"desktop_id"`
	Action       string          `json:"action"`
	Payload      json.RawMessage `json:"payload"`
}

type proxyReq struct {
	Enabled  *bool   `json:"enabled"`
	Upstream *string `json:"upstream"`
	Iface    *string `json:"iface"`
}

type server struct {
	prefix         string
	config         string
	listen         string
	maxqBin        string
	localInventory func() ([]map[string]any, error)
	mu             sync.Mutex
	connMu         sync.Mutex
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
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", s.handleStatus)
	mux.HandleFunc("POST /apply", s.handleApply)
	mux.HandleFunc("POST /revert", s.handleRevert)
	mux.HandleFunc("POST /proxy", s.handleProxy)
	mux.HandleFunc("GET /connections", s.handleConnections)
	mux.HandleFunc("POST /connections", s.handleAddConnection)
	mux.HandleFunc("DELETE /connections/{id}", s.handleDeleteConnection)
	mux.HandleFunc("GET /desktops", s.handleDesktops)
	mux.HandleFunc("POST /desktops/action", s.handleDesktopAction)
	mux.Handle("/", http.FileServer(http.FS(ui)))

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

func (s *server) handleConnections(w http.ResponseWriter, r *http.Request) {
	connections, err := s.loadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	views := make([]connectionView, 0, len(connections))
	for _, c := range connections {
		views = append(views, publicConnection(c))
	}
	writeJSON(w, http.StatusOK, map[string]any{"connections": views})
}

func (s *server) handleAddConnection(w http.ResponseWriter, r *http.Request) {
	var req connectionReq
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 120 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "name is required (max 120 characters)"})
		return
	}
	baseURL, err := normalizeBaseURL(req.BaseURL)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	c := connection{ID: newConnectionID(), Name: name, BaseURL: baseURL, Auth: strings.TrimSpace(req.Auth)}
	s.connMu.Lock()
	defer s.connMu.Unlock()
	connections, err := s.loadConnectionsLocked()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	connections = append(connections, c)
	if err := s.saveConnectionsLocked(connections); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"connection": publicConnection(c)})
}

func (s *server) handleDeleteConnection(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "connection id is required"})
		return
	}
	s.connMu.Lock()
	defer s.connMu.Unlock()
	connections, err := s.loadConnectionsLocked()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	filtered := make([]connection, 0, len(connections))
	found := false
	for _, c := range connections {
		if c.ID == id {
			found = true
			continue
		}
		filtered = append(filtered, c)
	}
	if !found {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "connection not found"})
		return
	}
	if err := s.saveConnectionsLocked(filtered); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleDesktops(w http.ResponseWriter, r *http.Request) {
	// An aggregate request turns this API into a local provider. In particular,
	// do not call our own HTTP endpoint: that would recurse when this API is also
	// listed as a connection by another MaxQ instance.
	if r.Header.Get("X-MaxQ-Aggregate") == "1" {
		writeJSON(w, http.StatusOK, map[string]any{
			"desktops":     s.localDesktopMaps(),
			"box_identity": s.boxIdentity(),
		})
		return
	}
	connections, err := s.loadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	// Implicit local inventory unless a saved self connection already covers it.
	local := []map[string]any{}
	hasSelf := false
	for _, c := range connections {
		if isLocalBaseURL(c.BaseURL) {
			hasSelf = true
			break
		}
	}
	if !hasSelf {
		local = s.localDesktopMaps()
	}
	type result struct {
		index int
		items []map[string]any
		err   string
	}
	results := make(chan result, len(connections))
	var wg sync.WaitGroup
	for i, c := range connections {
		wg.Add(1)
		go func(i int, c connection) {
			defer wg.Done()
			items, err := s.fetchDesktops(r, c)
			if err != nil {
				results <- result{index: i, err: err.Error()}
				return
			}
			results <- result{index: i, items: items}
		}(i, c)
	}
	wg.Wait()
	close(results)
	ordered := make([]result, len(connections))
	for res := range results {
		ordered[res.index] = res
	}
	all := make([]map[string]any, 0, len(local))
	all = append(all, local...)
	errors := make([]map[string]any, 0)
	for i, res := range ordered {
		if res.err != "" {
			errors = append(errors, map[string]any{"connection_id": connections[i].ID, "connection_name": connections[i].Name, "error": res.err})
			continue
		}
		all = append(all, res.items...)
	}
	writeJSON(w, http.StatusOK, map[string]any{"desktops": all, "errors": errors})
}

func (s *server) handleDesktopAction(w http.ResponseWriter, r *http.Request) {
	var req desktopActionReq
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(req.ConnectionID) == "" || strings.TrimSpace(req.DesktopID) == "" || strings.TrimSpace(req.Action) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "connection_id, desktop_id, and action are required"})
		return
	}
	connections, err := s.loadConnections()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	var c connection
	for _, candidate := range connections {
		if candidate.ID == req.ConnectionID {
			c = candidate
			break
		}
	}
	if c.ID == "" {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "connection not found"})
		return
	}
	body := map[string]any{"action": req.Action}
	if len(req.Payload) > 0 && string(req.Payload) != "null" {
		var payload any
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "payload must be valid json"})
			return
		}
		body["payload"] = payload
	}
	status, response, err := s.postDesktopAction(r, c, req.DesktopID, body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, status, response)
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
			Installed: sec(toml, "clis", "installed"),
			Skipped:   sec(toml, "clis", "skipped"),
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

func (s *server) connectionsPath() string {
	return filepath.Join(s.config, "connections.json")
}

func (s *server) loadConnections() ([]connection, error) {
	s.connMu.Lock()
	defer s.connMu.Unlock()
	return s.loadConnectionsLocked()
}

func (s *server) loadConnectionsLocked() ([]connection, error) {
	b, err := os.ReadFile(s.connectionsPath())
	if os.IsNotExist(err) {
		return []connection{}, nil
	}
	if err != nil {
		return nil, err
	}
	var file connectionsFile
	if err := json.Unmarshal(b, &file); err != nil {
		return nil, fmt.Errorf("read connections: %w", err)
	}
	return file.Connections, nil
}

func (s *server) saveConnectionsLocked(connections []connection) error {
	b, err := json.MarshalIndent(connectionsFile{Connections: connections}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.config, 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.config, "connections-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(append(b, '\n')); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, s.connectionsPath())
}

func publicConnection(c connection) connectionView {
	return connectionView{ID: c.ID, Name: c.Name, BaseURL: c.BaseURL, AuthConfigured: c.Auth != ""}
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	return dec.Decode(dst)
}

func newConnectionID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err == nil {
		return fmt.Sprintf("c-%x", b)
	}
	return fmt.Sprintf("c-%d", time.Now().UnixNano())
}

func normalizeBaseURL(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" || u.User != nil {
		return "", fmt.Errorf("base_url must be an http(s) URL without credentials")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("base_url must use http or https")
	}
	u.Fragment, u.RawQuery = "", ""
	u.Path = strings.TrimRight(u.Path, "/")
	return strings.TrimRight(u.String(), "/"), nil
}

func apiURL(base, path string) string {
	u, err := url.Parse(base)
	if err != nil {
		return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
	}
	u.Path = strings.TrimRight(u.Path, "/") + "/" + strings.TrimLeft(path, "/")
	return u.String()
}

func setAuth(req *http.Request, auth string) {
	auth = strings.TrimSpace(auth)
	if auth == "" {
		return
	}
	if strings.Contains(auth, " ") {
		req.Header.Set("Authorization", auth)
		return
	}
	req.Header.Set("Authorization", "Bearer "+auth)
}

func (s *server) fetchDesktops(parent *http.Request, c connection) ([]map[string]any, error) {
	// Any loopback base URL is local to this box. Use the provider directly
	// instead of making an HTTP request back through a local API.
	if isLocalBaseURL(c.BaseURL) {
		return s.enrichDesktopMaps(c, s.boxIdentity(), s.localDesktopMaps()), nil
	}
	ctx, cancel := context.WithTimeout(parent.Context(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL(c.BaseURL, "/desktops"), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-MaxQ-Aggregate", "1")
	setAuth(req, c.Auth)
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("remote status %s", resp.Status)
	}
	var raw any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode desktops: %w", err)
	}
	identity := ""
	var values []any
	switch value := raw.(type) {
	case []any:
		values = value
	case map[string]any:
		identity = firstString(value, "box_identity", "identity", "hostname", "host")
		if v, ok := value["desktops"].([]any); ok {
			values = v
		}
		if values == nil {
			if v, ok := value["items"].([]any); ok {
				values = v
			}
		}
	default:
		return nil, fmt.Errorf("desktops response must be an array or object")
	}
	return s.enrichDesktopValues(c, identity, values), nil
}


func isLocalBaseURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "127.0.0.1", "localhost", "::1":
		return true
	default:
		return false
	}
}

func (s *server) enrichDesktopValues(c connection, identity string, values []any) []map[string]any {
	maps := make([]map[string]any, 0, len(values))
	for _, value := range values {
		desktop, ok := value.(map[string]any)
		if ok {
			maps = append(maps, desktop)
		}
	}
	return s.enrichDesktopMaps(c, identity, maps)
}

func (s *server) enrichDesktopMaps(c connection, identity string, values []map[string]any) []map[string]any {
	items := make([]map[string]any, 0, len(values))
	for _, desktop := range values {
		copy := make(map[string]any, len(desktop)+4)
		for key, value := range desktop {
			copy[key] = value
		}
		box := firstString(copy, "box_identity", "hostname", "box", "host")
		if box == "" {
			box = identity
		}
		if box == "" {
			box = c.Name
		}
		copy["box_identity"] = box
		copy["connection_id"] = c.ID
		copy["connection_name"] = c.Name
		copy["source_api"] = c.BaseURL
		items = append(items, copy)
	}
	return items
}

func (s *server) postDesktopAction(parent *http.Request, c connection, desktopID string, body map[string]any) (int, any, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return 0, nil, err
	}
	ctx, cancel := context.WithTimeout(parent.Context(), 8*time.Second)
	defer cancel()
	path := "/desktops/" + url.PathEscape(desktopID) + "/action"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL(c.BaseURL, path), strings.NewReader(string(data)))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	setAuth(req, c.Auth)
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	responseData, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return 0, nil, err
	}
	var response any
	if len(strings.TrimSpace(string(responseData))) > 0 {
		if err := json.Unmarshal(responseData, &response); err != nil {
			response = map[string]any{"body": string(responseData)}
		}
	}
	if response == nil {
		response = map[string]any{"ok": resp.StatusCode >= 200 && resp.StatusCode < 300}
	}
	return resp.StatusCode, response, nil
}

func firstString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := values[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
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
