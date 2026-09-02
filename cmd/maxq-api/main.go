// MaxQ control API — loopback only, stdlib HTTP, tiny.
// PLAN 20/31/32-35: thin settings, resources, triggers/hooks.
// Never writes Chrome proxy policy and never targets another agent's Chrome.
package main

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed ui/index.html ui/mocha.css ui/sheet.js
var uiEmbed embed.FS

const (
	defaultListen      = "127.0.0.1:7432"
	defaultCooldownSec = 900
	memFloorBytes      = uint64(512 * 1024 * 1024)
	memTripPercent     = 90.0
)

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

type apiInfo struct { Listen string `json:"listen"` }

type stubInfo struct {
	State string `json:"state"`
	Note  string `json:"note"`
}

type statusResp struct {
	State    string   `json:"state"`
	Theme    string   `json:"theme"`
	Gost     gostInfo `json:"gost"`
	Clis     clisInfo `json:"clis"`
	API      apiInfo  `json:"api"`
	Firewall stubInfo `json:"firewall"`
	Vault    stubInfo `json:"vault"`
	OAuth    stubInfo `json:"oauth"`
	Skills   stubInfo `json:"skills"`
}

type proxyReq struct {
	Enabled  *bool   `json:"enabled"`
	Upstream *string `json:"upstream"`
	Iface    *string `json:"iface"`
}

type memInfo struct {
	TotalBytes     uint64  `json:"total_bytes"`
	AvailableBytes uint64  `json:"available_bytes"`
	UsedBytes      uint64  `json:"used_bytes"`
	UsedPercent    float64 `json:"used_percent"`
}

type cpuInfo struct {
	UsedPercent float64 `json:"used_percent"`
	Cores       int     `json:"cores"`
	Load1       float64 `json:"load1"`
}

type chromeInfo struct {
	Display string `json:"display"`
	Profile string `json:"profile"`
	RSS     uint64 `json:"rss_bytes"`
	PIDs    []int  `json:"pids"`
	Current bool   `json:"current_agent"`
}

type resourceResp struct {
	Memory       memInfo      `json:"memory"`
	CPU          cpuInfo      `json:"cpu"`
	Chrome       []chromeInfo `json:"chrome"`
	AgentDisplay string       `json:"agent_display"`
	AgentProfile string       `json:"agent_profile"`
}

type trigger struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Spec        string `json:"spec"`
	Hook        string `json:"hook"`
	Enabled     bool   `json:"enabled"`
	Level       string `json:"level,omitempty"`
	Message     string `json:"message,omitempty"`
	CooldownSec int    `json:"cooldown_sec,omitempty"`
	LastFire    string `json:"last_fire,omitempty"`
}

type triggerFile struct { Triggers []trigger `json:"triggers"` }

type triggersResp struct {
	WebhookURL string    `json:"webhook_url"`
	Enabled    bool      `json:"hooks_enabled"`
	Triggers   []trigger `json:"triggers"`
}

type hookPayload struct {
	Source  string         `json:"source"`
	Trigger string         `json:"trigger"`
	Level   string         `json:"level"`
	Message string         `json:"message"`
	Host    string         `json:"host"`
	Facts   map[string]any `json:"facts"`
}

type processInfo struct {
	PID     int
	Cmd     []string
	Display string
	Profile string
	RSS     uint64
	Type    string
}

type server struct {
	prefix  string
	config  string
	listen  string
	maxqBin string
	mu      sync.Mutex
	client  *http.Client
}

func main() {
	prefix := os.Getenv("MAXQ_HOME")
	if prefix == "" { prefix = os.Getenv("HOME") }
	if prefix == "" {
		fmt.Fprintln(os.Stderr, "maxq-api: HOME unset")
		os.Exit(1)
	}
	s := &server{
		prefix: prefix,
		config: filepath.Join(prefix, ".config", "maxq"),
		maxqBin: filepath.Join(prefix, "bin", "maxq"),
		client: &http.Client{Timeout: 10 * time.Second},
	}
	if err := os.MkdirAll(s.config, 0o700); err != nil {
		fmt.Fprintln(os.Stderr, "maxq-api:", err)
		os.Exit(1)
	}
	s.ensureHookFiles()
	s.listen = sanitizeListen(s.loadListen())
	go s.triggerLoop()
	if err := s.serve(); err != nil {
		fmt.Fprintln(os.Stderr, "maxq-api:", err)
		os.Exit(1)
	}
}

func (s *server) loadListen() string {
	if v := strings.TrimSpace(os.Getenv("MAXQ_API_LISTEN")); v != "" { return v }
	p := filepath.Join(s.config, "api.toml")
	if b, err := os.ReadFile(p); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") { continue }
			if strings.HasPrefix(line, "[") { break }
			if strings.HasPrefix(line, "listen") {
				_, rest, ok := strings.Cut(line, "=")
				if ok { return unquote(strings.TrimSpace(rest)) }
			}
		}
	}
	return defaultListen
}

func unquote(v string) string {
	v = strings.TrimSpace(v)
	if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' { return v[1:len(v)-1] }
	return v
}

func sanitizeListen(v string) string {
	v = strings.TrimSpace(v)
	if v == "" { return defaultListen }
	host, port, err := net.SplitHostPort(v)
	if err != nil { return defaultListen }
	if host == "localhost" { host = "127.0.0.1" }
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() { return defaultListen }
	if ip4 := ip.To4(); ip4 != nil && ip4[0] == 10 && ip4[1] == 0 { return defaultListen }
	return net.JoinHostPort(host, port)
}

func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil { host = addr }
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
	if err != nil { return err }
	mux := http.NewServeMux()
	mux.HandleFunc("GET /status", s.handleStatus)
	mux.HandleFunc("POST /apply", s.handleApply)
	mux.HandleFunc("POST /revert", s.handleRevert)
	mux.HandleFunc("POST /proxy", s.handleProxy)
	mux.HandleFunc("GET /resources", s.handleResources)
	mux.HandleFunc("POST /resources/chrome", s.handleChromeAction)
	mux.HandleFunc("GET /triggers", s.handleTriggers)
	mux.HandleFunc("POST /triggers", s.handleAddTrigger)
	mux.HandleFunc("POST /triggers/enable", s.handleEnableTrigger)
	mux.HandleFunc("POST /triggers/test", s.handleTestTrigger)
	mux.HandleFunc("POST /triggers/webhook", s.handleWebhook)
	mux.Handle("/", http.FileServer(http.FS(ui)))
	ln, err := net.Listen("tcp", s.listen)
	if err != nil { return err }
	fmt.Fprintf(os.Stderr, "maxq-api listen %s (loopback, no Chrome proxy)\n", s.listen)
	srv := &http.Server{Handler: s.onlyLocal(mux), ReadHeaderTimeout: 5 * time.Second}
	return srv.Serve(ln)
}

func (s *server) handleStatus(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, s.status()) }

func (s *server) handleApply(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock(); defer s.mu.Unlock()
	if err := s.runMaxq("apply"); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()}); return
	}
	st := s.status()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": st.State, "status": st})
}

func (s *server) handleRevert(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": "reverted"})
	if f, ok := w.(http.Flusher); ok { f.Flush() }
	go func() { time.Sleep(200 * time.Millisecond); _ = s.runMaxq("revert") }()
}

func (s *server) handleProxy(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock(); defer s.mu.Unlock()
	var req proxyReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if len(body) > 0 && json.Unmarshal(body, &req) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"}); return
	}
	if req.Enabled != nil {
		arg := "off"; if *req.Enabled { arg = "on" }
		if err := s.runMaxq("proxy", arg); err != nil { writeErr(w, err); return }
	}
	if req.Upstream != nil {
		up := strings.TrimSpace(*req.Upstream); if up == "" { up = "none" }
		if err := s.runMaxq("proxy", "upstream", up); err != nil { writeErr(w, err); return }
	}
	if req.Iface != nil {
		iface := strings.TrimSpace(*req.Iface); if iface == "" { iface = "none" }
		if err := s.runMaxq("proxy", "iface", iface); err != nil { writeErr(w, err); return }
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "status": s.status()})
}

func (s *server) status() statusResp {
	toml := filepath.Join(s.config, "maxq.toml")
	stateFile := filepath.Join(s.config, "state")
	state := "reverted"
	if b, err := os.ReadFile(stateFile); err == nil {
		v := strings.TrimSpace(string(b)); if v == "applied" || v == "reverted" { state = v }
	} else if top(toml, "state") == "applied" { state = "applied" }
	theme := top(toml, "theme"); if theme == "" { theme = "mocha" }
	return statusResp{
		State: state, Theme: theme,
		Gost: gostInfo{Enabled: asBool(sec(toml,"gost","enabled")), Running: pidRunning(filepath.Join(s.config,"gost.pid")), Listen: orDefault(sec(toml,"gost","listen"),"127.0.0.1:8080"), Upstream: sec(toml,"gost","upstream"), Iface: sec(toml,"gost","iface"), Intercept: asBool(sec(toml,"gost","intercept"))},
		Clis: clisInfo{Installed: sec(toml,"clis","installed"), Skipped: sec(toml,"clis","skipped"), Preexisting: sec(toml,"clis","preexisting")},
		API: apiInfo{Listen:s.listen},
		Firewall: stubInfo{State:"stub", Note:"listen-policy is PLAN 17; no /usr writes"},
		Vault: stubInfo{State:"stub", Note:"credential vault is PLAN 21"},
		OAuth: stubInfo{State:"stub", Note:"OAuth seating is PLAN 22"},
		Skills: stubInfo{State:"stub", Note:"skill packs are PLAN 24-28"},
	}
}

func (s *server) runMaxq(args ...string) error {
	bin := s.maxqBin
	if _, err := os.Stat(bin); err != nil {
		if p, err := exec.LookPath("maxq"); err == nil { bin = p } else { return fmt.Errorf("maxq binary not found") }
	}
	cmd := exec.Command(bin, args...)
	cmd.Env = append(os.Environ(), "MAXQ_HOME="+s.prefix)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid:true}
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out)); if len(msg) > 800 { msg = msg[:800] }
		return fmt.Errorf("maxq %s: %v %s", strings.Join(args," "), err, msg)
	}
	return nil
}

// ---- resources -------------------------------------------------------------

func (s *server) handleResources(w http.ResponseWriter, r *http.Request) {
	res, err := s.resources()
	if err != nil { writeJSON(w, http.StatusInternalServerError, map[string]any{"ok":false,"error":err.Error()}); return }
	writeJSON(w, http.StatusOK, res)
}

func (s *server) resources() (resourceResp, error) {
	mem, err := readMemory(); if err != nil { return resourceResp{}, err }
	cpu := readCPU()
	procs := chromeProcesses(s.prefix)
	display, profile := currentAgent(s.prefix)
	groups := map[string]*chromeInfo{}
	for _, p := range procs {
		key := p.Display + "\x00" + p.Profile
		g := groups[key]
		if g == nil { g=&chromeInfo{Display:p.Display,Profile:p.Profile,Current:p.Display==display && p.Profile==profile}; groups[key]=g }
		g.RSS += p.RSS; g.PIDs = append(g.PIDs,p.PID)
	}
	chrome := make([]chromeInfo,0,len(groups)); for _,g := range groups { sort.Ints(g.PIDs); chrome=append(chrome,*g) }
	sort.Slice(chrome,func(i,j int)bool{return chrome[i].Display<chrome[j].Display || (chrome[i].Display==chrome[j].Display && chrome[i].Profile<chrome[j].Profile)})
	return resourceResp{Memory:mem,CPU:cpu,Chrome:chrome,AgentDisplay:display,AgentProfile:profile},nil
}

func readMemory() (memInfo,error) {
	b,err:=os.ReadFile("/proc/meminfo"); if err!=nil{return memInfo{},err}
	vals:=map[string]uint64{}
	for _,line:=range strings.Split(string(b),"\n") {
		f:=strings.Fields(line); if len(f)<2{continue}; n,_:=strconv.ParseUint(f[1],10,64); vals[strings.TrimSuffix(f[0],":")]=n*1024
	}
	total,avail:=vals["MemTotal"],vals["MemAvailable"]; if total==0{return memInfo{},errors.New("MemTotal unavailable")}
	used:=total-avail; pct:=float64(used)*100/float64(total)
	return memInfo{TotalBytes:total,AvailableBytes:avail,UsedBytes:used,UsedPercent:pct},nil
}

type cpuSample struct{ total,idle uint64 }
func cpuSampleNow() cpuSample {
	b,_:=os.ReadFile("/proc/stat"); line:=strings.SplitN(string(b),"\n",2)[0]; f:=strings.Fields(line); var v []uint64
	for _,x:=range f[1:] { n,_:=strconv.ParseUint(x,10,64); v=append(v,n) }
	var total uint64; for _,n:=range v{total+=n}; var idle uint64; if len(v)>3{idle=v[3]}; if len(v)>4{idle+=v[4]}; return cpuSample{total:total,idle:idle}
}
func readCPU() cpuInfo {
	a:=cpuSampleNow(); time.Sleep(120*time.Millisecond); b:=cpuSampleNow(); dt,di:=b.total-a.total,b.idle-a.idle; pct:=0.0; if dt>0{pct=float64(dt-di)*100/float64(dt)}
	cores:=0; if entries,err:=os.ReadDir("/sys/devices/system/cpu");err==nil{for _,e:=range entries{if regexp.MustCompile(`^cpu[0-9]+$`).MatchString(e.Name()){cores++}}}
	load:=0.0; if data,err:=os.ReadFile("/proc/loadavg");err==nil{f:=strings.Fields(string(data));if len(f)>0{load,_=strconv.ParseFloat(f[0],64)}}
	return cpuInfo{UsedPercent:pct,Cores:cores,Load1:load}
}

var profileRE=regexp.MustCompile(`(?:^|/)chrome-profile-([0-9]+)(?:/|$)`)
func currentAgent(prefix string)(string,string){
	d:=strings.TrimSpace(os.Getenv("DISPLAY")); n:=""; if strings.HasPrefix(d,":"){n=strings.Split(strings.TrimPrefix(d,":"),".")[0]}
	if n==""{return d,""}; return d,filepath.Join(prefix,"chrome-profile-"+n)
}

func chromeProcesses(prefix string) []processInfo {
	entries,_:=os.ReadDir("/proc"); out:=[]processInfo{}
	for _,e:=range entries{
		pid,err:=strconv.Atoi(e.Name()); if err!=nil{continue}
		cmdRaw,err:=os.ReadFile(filepath.Join("/proc",e.Name(),"cmdline")); if err!=nil||len(cmdRaw)==0{continue}
		parts:=strings.Split(strings.TrimRight(string(cmdRaw),"\x00"),"\x00"); if len(parts)==0{continue}; base:=strings.ToLower(filepath.Base(parts[0])); if !strings.Contains(base,"chrome")&&!strings.Contains(base,"chromium"){continue}
		p:=processInfo{PID:pid,Cmd:parts}; for _,a:=range parts{if strings.HasPrefix(a,"--user-data-dir="){p.Profile=strings.TrimPrefix(a,"--user-data-dir=")};if strings.HasPrefix(a,"--type="){p.Type=strings.TrimPrefix(a,"--type=")}}
		if p.Profile==""{for _,a:=range parts{if m:=profileRE.FindStringSubmatch(a);len(m)>1{p.Profile=filepath.Join(prefix,"chrome-profile-"+m[1]);break}}}
		envRaw,_:=os.ReadFile(filepath.Join("/proc",e.Name(),"environ")); for _,kv:=range strings.Split(string(envRaw),"\x00"){if strings.HasPrefix(kv,"DISPLAY="){p.Display=strings.TrimPrefix(kv,"DISPLAY=");break}}
		if p.Display==""&&p.Profile!=""{if m:=profileRE.FindStringSubmatch(p.Profile);len(m)>1{p.Display=":"+m[1]}}
		stat,_:=os.ReadFile(filepath.Join("/proc",e.Name(),"status")); for _,line:=range strings.Split(string(stat),"\n"){if strings.HasPrefix(line,"VmRSS:"){f:=strings.Fields(line);if len(f)>1{n,_:=strconv.ParseUint(f[1],10,64);p.RSS=n*1024};break}}
		out=append(out,p)
	}
	return out
}

func (s *server) handleChromeAction(w http.ResponseWriter,r *http.Request){
	var req struct{Action string `json:"action"`}; if decodeJSON(r,&req)!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return}
	if req.Action!="trim"&&req.Action!="restart"{writeJSON(w,400,map[string]any{"ok":false,"error":"action must be trim or restart"});return}
	display,profile:=currentAgent(s.prefix); if display==""||profile==""{writeJSON(w,409,map[string]any{"ok":false,"error":"current agent requires DISPLAY=:N and chrome-profile-N"});return}
	procs:=chromeProcesses(s.prefix); matched:=[]processInfo{}; for _,p:=range procs{if p.Display==display&&filepath.Clean(p.Profile)==filepath.Clean(profile){matched=append(matched,p)}}
	if len(matched)==0{writeJSON(w,404,map[string]any{"ok":false,"error":"no Chrome processes for this agent"});return}
	if req.Action=="trim"{
		count:=0; for _,p:=range matched{if p.Type=="renderer"{_ = syscall.Kill(p.PID,syscall.SIGTERM);count++}}
		writeJSON(w,200,map[string]any{"ok":true,"action":"trim","display":display,"profile":profile,"renderers_signaled":count});return
	}
	var root *processInfo; for i:=range matched{if matched[i].Type==""{root=&matched[i];break}}
	for _,p:=range matched{_ = syscall.Kill(p.PID,syscall.SIGTERM)}
	if root!=nil&&len(root.Cmd)>0{cmd:=exec.Command(root.Cmd[0],root.Cmd[1:]...);cmd.Env=append(os.Environ(),"DISPLAY="+display);cmd.SysProcAttr=&syscall.SysProcAttr{Setpgid:true};_ = cmd.Start()}
	writeJSON(w,200,map[string]any{"ok":true,"action":"restart","display":display,"profile":profile,"processes_signaled":len(matched),"relaunched":root!=nil})
}

// ---- triggers/hooks --------------------------------------------------------

func (s *server) hooksPath()string{return filepath.Join(s.config,"hooks.toml")}
func (s *server) triggersPath()string{return filepath.Join(s.config,"triggers.json")}

func (s *server) ensureHookFiles(){
	if _,err:=os.Stat(s.hooksPath());os.IsNotExist(err){_ = os.WriteFile(s.hooksPath(),[]byte("# MaxQ hook destination. Empty disables hooks.\nwebhook_url = \"\"\n"),0o600)}
	tf:=s.loadTriggers(); found:=false; for _,t:=range tf.Triggers{if t.ID=="resource.mem"{found=true;break}}
	if !found{tf.Triggers=append(tf.Triggers,trigger{ID:"resource.mem",Kind:"probe",Spec:"MemAvailable < 512MiB OR used >= 90%",Hook:"webhook",Enabled:true,Level:"warning",Message:"warning resource limits exhausted: OOM",CooldownSec:defaultCooldownSec});_ = s.saveTriggers(tf)}
}

func (s *server) webhookURL()string{
	b,err:=os.ReadFile(s.hooksPath());if err!=nil{return ""};for _,line:=range strings.Split(string(b),"\n"){line=strings.TrimSpace(line);if strings.HasPrefix(line,"webhook_url"){_,v,ok:=strings.Cut(line,"=");if ok{return unquote(strings.TrimSpace(v))}}};return ""
}
func tomlQuote(v string)string{return `"`+strings.ReplaceAll(strings.ReplaceAll(v,`\`,`\\`),`"`,`\"`)+`"`}
func (s *server) setWebhookURL(v string)error{
	v=strings.TrimSpace(v);if v!=""{u,err:=url.Parse(v);if err!=nil||u.Scheme!="https"||u.Host==""{return errors.New("webhook_url must be empty or an https URL")}}
	return os.WriteFile(s.hooksPath(),[]byte("# MaxQ hook destination. Empty disables hooks.\nwebhook_url = "+tomlQuote(v)+"\n"),0o600)
}
func (s *server) loadTriggers()triggerFile{var tf triggerFile;b,err:=os.ReadFile(s.triggersPath());if err==nil{_ = json.Unmarshal(b,&tf)};return tf}
func (s *server) saveTriggers(tf triggerFile)error{b,err:=json.MarshalIndent(tf,"","  ");if err!=nil{return err};b=append(b,'\n');tmp:=s.triggersPath()+".tmp";if err=os.WriteFile(tmp,b,0o600);err!=nil{return err};return os.Rename(tmp,s.triggersPath())}
func (s *server) triggerResponse()triggersResp{tf:=s.loadTriggers();u:=s.webhookURL();return triggersResp{WebhookURL:u,Enabled:u!="",Triggers:tf.Triggers}}

func (s *server) handleTriggers(w http.ResponseWriter,r *http.Request){s.mu.Lock();defer s.mu.Unlock();s.ensureHookFiles();writeJSON(w,200,s.triggerResponse())}
func (s *server) handleWebhook(w http.ResponseWriter,r *http.Request){
	var req struct{WebhookURL string `json:"webhook_url"`};if decodeJSON(r,&req)!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return};s.mu.Lock();defer s.mu.Unlock();if err:=s.setWebhookURL(req.WebhookURL);err!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":err.Error()});return};writeJSON(w,200,map[string]any{"ok":true,"triggers":s.triggerResponse()})
}

var triggerIDRE=regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)
func (s *server) handleAddTrigger(w http.ResponseWriter,r *http.Request){
	var t trigger;if decodeJSON(r,&t)!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return};t.ID=strings.TrimSpace(t.ID);t.Kind=strings.TrimSpace(t.Kind);t.Spec=strings.TrimSpace(t.Spec);if !triggerIDRE.MatchString(t.ID)||t.ID=="resource.mem"{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid or reserved trigger id"});return};if t.Kind!="schedule"&&t.Kind!="probe"{writeJSON(w,400,map[string]any{"ok":false,"error":"kind must be schedule or probe"});return};if t.Spec==""{writeJSON(w,400,map[string]any{"ok":false,"error":"spec required"});return};if t.Kind=="schedule"{if _,err:=parseCron(t.Spec);err!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":err.Error()});return}};if t.Hook==""{t.Hook="webhook"};if t.Level==""{t.Level="info"};if t.CooldownSec<=0{t.CooldownSec=60};t.LastFire="";s.mu.Lock();defer s.mu.Unlock();tf:=s.loadTriggers();for _,x:=range tf.Triggers{if x.ID==t.ID{writeJSON(w,409,map[string]any{"ok":false,"error":"trigger id exists"});return}};tf.Triggers=append(tf.Triggers,t);if err:=s.saveTriggers(tf);err!=nil{writeErr(w,err);return};writeJSON(w,201,map[string]any{"ok":true,"trigger":t})
}
func (s *server) handleEnableTrigger(w http.ResponseWriter,r *http.Request){var req struct{ID string `json:"id"`;Enabled bool `json:"enabled"`};if decodeJSON(r,&req)!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return};s.mu.Lock();defer s.mu.Unlock();tf:=s.loadTriggers();found:=false;for i:=range tf.Triggers{if tf.Triggers[i].ID==req.ID{tf.Triggers[i].Enabled=req.Enabled;found=true;break}};if !found{writeJSON(w,404,map[string]any{"ok":false,"error":"trigger not found"});return};if err:=s.saveTriggers(tf);err!=nil{writeErr(w,err);return};writeJSON(w,200,map[string]any{"ok":true})}
func (s *server) handleTestTrigger(w http.ResponseWriter,r *http.Request){var req struct{ID string `json:"id"`};if decodeJSON(r,&req)!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return};s.mu.Lock();defer s.mu.Unlock();tf:=s.loadTriggers();for i:=range tf.Triggers{if tf.Triggers[i].ID==req.ID{facts:=map[string]any{"test":true};msg:=tf.Triggers[i].Message;if msg==""{msg="MaxQ trigger test"};err:=s.fireTrigger(&tf.Triggers[i],msg,facts,true);if err!=nil{writeErr(w,err);return};_ = s.saveTriggers(tf);writeJSON(w,200,map[string]any{"ok":true});return}};writeJSON(w,404,map[string]any{"ok":false,"error":"trigger not found"})}

func (s *server) triggerLoop(){ticker:=time.NewTicker(30*time.Second);defer ticker.Stop();time.Sleep(2*time.Second);s.evaluateTriggers();for range ticker.C{s.evaluateTriggers()}}
func (s *server) evaluateTriggers(){s.mu.Lock();defer s.mu.Unlock();tf:=s.loadTriggers();changed:=false;for i:=range tf.Triggers{t:=&tf.Triggers[i];if !t.Enabled{continue};fire,msg,facts:=s.triggerDue(*t);if !fire{continue};if err:=s.fireTrigger(t,msg,facts,false);err==nil{changed=true}};if changed{_ = s.saveTriggers(tf)}}
func (s *server) triggerDue(t trigger)(bool,string,map[string]any){
	if t.ID=="resource.mem"{m,err:=readMemory();if err!=nil{return false,"",nil};trip:=m.AvailableBytes<memFloorBytes||m.UsedPercent>=memTripPercent;return trip,t.Message,map[string]any{"mem_total_bytes":m.TotalBytes,"mem_available_bytes":m.AvailableBytes,"mem_used_percent":m.UsedPercent}}
	if t.Kind=="schedule"{c,err:=parseCron(t.Spec);if err!=nil{return false,"",nil};loc,err:=time.LoadLocation("America/Los_Angeles");if err!=nil{loc=time.Local};now:=time.Now().In(loc);if !c.match(now){return false,"",nil};return true,orDefault(t.Message,"scheduled MaxQ trigger"),map[string]any{"cron":t.Spec,"timezone":loc.String()}}
	if t.Kind=="probe"{ctx,cancel:=context.WithTimeout(context.Background(),15*time.Second);defer cancel();cmd:=exec.CommandContext(ctx,"/bin/sh","-lc",t.Spec);cmd.Env=append(os.Environ(),"MAXQ_HOME="+s.prefix);out,err:=cmd.Output();if err!=nil{return false,"",nil};msg:=strings.TrimSpace(string(out));if t.Message!=""{msg=t.Message};if msg==""{msg="probe true"};if len(msg)>512{msg=msg[:512]};return true,msg,map[string]any{"probe":"exit 0"}}
	return false,"",nil
}
func (s *server) fireTrigger(t *trigger,msg string,facts map[string]any,force bool)error{
	cd:=t.CooldownSec;if cd<=0{cd=defaultCooldownSec};if !force&&t.LastFire!=""{if last,err:=time.Parse(time.RFC3339,t.LastFire);err==nil&&time.Since(last)<time.Duration(cd)*time.Second{return errors.New("cooldown")}}
	u:=s.webhookURL();if u==""{return errors.New("hooks disabled")};host,_:=os.Hostname();level:=t.Level;if level==""{level="info"};payload:=hookPayload{Source:"maxq",Trigger:t.ID,Level:level,Message:msg,Host:host,Facts:facts};b,_:=json.Marshal(payload);req,err:=http.NewRequest(http.MethodPost,u,bytes.NewReader(b));if err!=nil{return err};req.Header.Set("Content-Type","application/json");resp,err:=s.client.Do(req);if err!=nil{return err};defer resp.Body.Close();if resp.StatusCode<200||resp.StatusCode>=300{return fmt.Errorf("webhook status %d",resp.StatusCode)};t.LastFire=time.Now().UTC().Format(time.RFC3339);return nil
}

type cronSpec struct{ fields [5]cronField }
type cronField struct{ any bool; vals map[int]bool }
func parseCron(spec string)(cronSpec,error){parts:=strings.Fields(spec);if len(parts)!=5{return cronSpec{},errors.New("cron must have 5 fields: min hour dom mon dow")};ranges:=[][2]int{{0,59},{0,23},{1,31},{1,12},{0,6}};var c cronSpec;for i,p:=range parts{f,err:=parseCronField(p,ranges[i][0],ranges[i][1]);if err!=nil{return c,fmt.Errorf("cron field %d: %w",i+1,err)};c.fields[i]=f};return c,nil}
func parseCronField(s string,min,max int)(cronField,error){f:=cronField{vals:map[int]bool{}};if s=="*"{f.any=true;return f,nil};for _,part:=range strings.Split(s,","){step:=1;base:=part;if strings.Contains(part,"/"){a,b,_:=strings.Cut(part,"/");base=a;n,err:=strconv.Atoi(b);if err!=nil||n<=0{return f,errors.New("invalid step")};step=n};lo,hi:=min,max;if base!="*"{if strings.Contains(base,"-"){a,b,_:=strings.Cut(base,"-");var err error;lo,err=strconv.Atoi(a);if err!=nil{return f,errors.New("invalid range")};hi,err=strconv.Atoi(b);if err!=nil{return f,errors.New("invalid range")}}else{n,err:=strconv.Atoi(base);if err!=nil{return f,errors.New("invalid value")};lo,hi=n,n}};if lo<min||hi>max||lo>hi{return f,errors.New("out of range")};for n:=lo;n<=hi;n+=step{f.vals[n]=true}};return f,nil}
func (c cronSpec)match(t time.Time)bool{vals:=[]int{t.Minute(),t.Hour(),t.Day(),int(t.Month()),int(t.Weekday())};for i,v:=range vals{if !c.fields[i].any&&!c.fields[i].vals[v]{return false}};return true}

// ---- shared helpers --------------------------------------------------------

func decodeJSON(r *http.Request,v any)error{dec:=json.NewDecoder(io.LimitReader(r.Body,1<<20));dec.DisallowUnknownFields();return dec.Decode(v)}
func writeErr(w http.ResponseWriter,err error){writeJSON(w,http.StatusInternalServerError,map[string]any{"ok":false,"error":err.Error()})}
func writeJSON(w http.ResponseWriter,code int,v any){w.Header().Set("Content-Type","application/json");w.WriteHeader(code);enc:=json.NewEncoder(w);enc.SetEscapeHTML(true);_ = enc.Encode(v)}
func pidRunning(path string)bool{b,err:=os.ReadFile(path);if err!=nil{return false};pid:=strings.TrimSpace(string(b));if pid==""{return false};_,err=os.Stat(filepath.Join("/proc",pid));return err==nil}
func asBool(v string)bool{switch strings.ToLower(strings.TrimSpace(v)){case "true","on","yes","1":return true};return false}
func orDefault(v,d string)string{if strings.TrimSpace(v)==""{return d};return v}
func top(path,key string)string{return tomlGet(path,"",key)}
func sec(path,section,key string)string{return tomlGet(path,section,key)}
func tomlGet(path,section,key string)string{b,err:=os.ReadFile(path);if err!=nil{return ""};in:=section=="";for _,line:=range strings.Split(string(b),"\n"){trim:=strings.TrimSpace(line);if trim==""||strings.HasPrefix(trim,"#"){continue};if strings.HasPrefix(trim,"[")&&strings.HasSuffix(trim,"]"){name:=strings.TrimSpace(trim[1:len(trim)-1]);in=name==section;continue};if !in{continue};name,rest,ok:=strings.Cut(trim,"=");if ok&&strings.TrimSpace(name)==key{return unquote(strings.TrimSpace(rest))}};return ""}
