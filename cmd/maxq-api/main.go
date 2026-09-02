// MaxQ control API — loopback only, stdlib HTTP, tiny.
// GET /status  GET|POST /defaults  POST /apply  POST /revert  POST /proxy
// Static settings sheet at /. Never writes Chrome proxy policy.
package main

import (
	"context"
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

var siteKeys = []string{"chatgpt", "grok", "claude", "discord", "slack"}

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
type ghosttyInfo struct { Installed bool `json:"installed"`; Default bool `json:"default"`; Version string `json:"version"` }
type launcherInfo struct { Name string `json:"name"`; Keybind string `json:"keybind"` }
type defaultsInfo struct { DefaultAIChat string `json:"default_ai_chat"`; Sites map[string]string `json:"sites"` }
type statusResp struct { State string `json:"state"`; Theme string `json:"theme"`; Gost gostInfo `json:"gost"`; Clis clisInfo `json:"clis"`; API apiInfo `json:"api"`; Ghostty ghosttyInfo `json:"ghostty"`; Launcher launcherInfo `json:"launcher"`; Defaults defaultsInfo `json:"defaults"` }
type proxyReq struct { Enabled *bool `json:"enabled"`; Upstream *string `json:"upstream"`; Iface *string `json:"iface"` }
type server struct { prefix string; config string; listen string; maxqBin string; mu sync.Mutex }

func main() {
	prefix := os.Getenv("MAXQ_HOME"); if prefix == "" { prefix = os.Getenv("HOME") }; if prefix == "" { fmt.Fprintln(os.Stderr,"maxq-api: HOME unset"); os.Exit(1) }
	s := &server{prefix:prefix, config:filepath.Join(prefix,".config","maxq"), maxqBin:filepath.Join(prefix,"bin","maxq")}
	s.listen = sanitizeListen(s.loadListen()); if err := s.serve(); err != nil { fmt.Fprintln(os.Stderr,"maxq-api:",err); os.Exit(1) }
}
func (s *server) loadListen() string { if v:=strings.TrimSpace(os.Getenv("MAXQ_API_LISTEN")); v!="" { return v }; p:=filepath.Join(s.config,"api.toml"); if b,err:=os.ReadFile(p); err==nil { for _,line:=range strings.Split(string(b),"\n") { line=strings.TrimSpace(line); if line==""||strings.HasPrefix(line,"#")||strings.HasPrefix(line,"[") { if strings.HasPrefix(line,"["){break}; continue }; if strings.HasPrefix(line,"listen") { _,rest,ok:=strings.Cut(line,"="); if ok{return unquote(strings.TrimSpace(rest))} } } }; return defaultListen }
func unquote(v string) string { v=strings.TrimSpace(v); if len(v)>=2&&v[0]=='"'&&v[len(v)-1]=='"'{return v[1:len(v)-1]}; return v }
func sanitizeListen(v string) string { v=strings.TrimSpace(v); if v==""{return defaultListen}; host,port,err:=net.SplitHostPort(v); if err!=nil{return defaultListen}; if host=="localhost"{host="127.0.0.1"}; ip:=net.ParseIP(host); if ip==nil||!ip.IsLoopback(){return defaultListen}; if ip4:=ip.To4(); ip4!=nil&&ip4[0]==10&&ip4[1]==0{return defaultListen}; return net.JoinHostPort(host,port) }
func isLoopbackAddr(addr string) bool { host,_,err:=net.SplitHostPort(addr); if err!=nil{host=addr}; ip:=net.ParseIP(host); return ip!=nil&&ip.IsLoopback() }
func (s *server) onlyLocal(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){ if !isLoopbackAddr(r.RemoteAddr){http.Error(w,"local only",http.StatusForbidden);return}; next.ServeHTTP(w,r) }) }
func (s *server) serve() error { ui,err:=fs.Sub(uiEmbed,"ui"); if err!=nil{return err}; mux:=http.NewServeMux(); mux.HandleFunc("GET /status",s.handleStatus); mux.HandleFunc("GET /defaults",s.handleGetDefaults); mux.HandleFunc("POST /defaults",s.handleSetDefaults); mux.HandleFunc("POST /apply",s.handleApply); mux.HandleFunc("POST /revert",s.handleRevert); mux.HandleFunc("POST /proxy",s.handleProxy); mux.Handle("/",http.FileServer(http.FS(ui))); ln,err:=net.Listen("tcp",s.listen); if err!=nil{return err}; srv:=&http.Server{Handler:s.onlyLocal(mux),ReadHeaderTimeout:5*time.Second}; return srv.Serve(ln) }
func (s *server) handleStatus(w http.ResponseWriter,r *http.Request){writeJSON(w,http.StatusOK,s.status())}
func (s *server) handleGetDefaults(w http.ResponseWriter,r *http.Request){writeJSON(w,http.StatusOK,s.defaults())}
func (s *server) handleSetDefaults(w http.ResponseWriter,r *http.Request){ s.mu.Lock(); defer s.mu.Unlock(); var req defaultsInfo; dec:=json.NewDecoder(io.LimitReader(r.Body,1<<16)); dec.DisallowUnknownFields(); if err:=dec.Decode(&req);err!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return}; if err:=validateDefaults(req);err!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":err.Error()});return}; if err:=s.writeDefaults(req);err!=nil{writeJSON(w,500,map[string]any{"ok":false,"error":err.Error()});return}; writeJSON(w,200,map[string]any{"ok":true,"defaults":s.defaults()}) }
func (s *server) handleApply(w http.ResponseWriter,r *http.Request){s.mu.Lock();defer s.mu.Unlock();if err:=s.runMaxq("apply");err!=nil{writeJSON(w,500,map[string]any{"ok":false,"error":err.Error()});return}; st:=s.status();writeJSON(w,200,map[string]any{"ok":true,"state":st.State,"status":st})}
func (s *server) handleRevert(w http.ResponseWriter,r *http.Request){writeJSON(w,200,map[string]any{"ok":true,"state":"reverted"});if f,ok:=w.(http.Flusher);ok{f.Flush()};go func(){time.Sleep(200*time.Millisecond);_ = s.runMaxq("revert")}()}
func (s *server) handleProxy(w http.ResponseWriter,r *http.Request){s.mu.Lock();defer s.mu.Unlock();var req proxyReq;body,_:=io.ReadAll(io.LimitReader(r.Body,1<<16));if len(body)>0{if err:=json.Unmarshal(body,&req);err!=nil{writeJSON(w,400,map[string]any{"ok":false,"error":"invalid json"});return}}; if req.Enabled!=nil{v:="off";if *req.Enabled{v="on"};if err:=s.runMaxq("proxy",v);err!=nil{writeJSON(w,500,map[string]any{"ok":false,"error":err.Error()});return}};if req.Upstream!=nil{v:=strings.TrimSpace(*req.Upstream);if v==""{v="none"};if err:=s.runMaxq("proxy","upstream",v);err!=nil{writeJSON(w,500,map[string]any{"ok":false,"error":err.Error()});return}};if req.Iface!=nil{v:=strings.TrimSpace(*req.Iface);if v==""{v="none"};if err:=s.runMaxq("proxy","iface",v);err!=nil{writeJSON(w,500,map[string]any{"ok":false,"error":err.Error()});return}};writeJSON(w,200,map[string]any{"ok":true,"status":s.status()})}
func (s *server) status() statusResp { toml:=filepath.Join(s.config,"maxq.toml");state:="reverted";if b,err:=os.ReadFile(filepath.Join(s.config,"state"));err==nil{v:=strings.TrimSpace(string(b));if v=="applied"||v=="reverted"{state=v}} else if top(toml,"state")=="applied"{state="applied"};theme:=top(toml,"theme");if theme==""{theme="mocha"};return statusResp{State:state,Theme:theme,Gost:gostInfo{Enabled:asBool(sec(toml,"gost","enabled")),Running:pidRunning(filepath.Join(s.config,"gost.pid")),Listen:orDefault(sec(toml,"gost","listen"),"127.0.0.1:8080"),Upstream:sec(toml,"gost","upstream"),Iface:sec(toml,"gost","iface"),Intercept:asBool(sec(toml,"gost","intercept"))},Clis:clisInfo{Installed:sec(toml,"clis","installed"),Skipped:sec(toml,"clis","skipped"),Preexisting:sec(toml,"clis","preexisting")},API:apiInfo{Listen:s.listen},Ghostty:s.ghostty(),Launcher:s.launcher(),Defaults:s.defaults()} }
func (s *server) ghostty() ghosttyInfo { bin:=filepath.Join(s.prefix,"bin","ghostty"); installed:=isExecutable(bin); def:=installed&&fileHasLine(filepath.Join(s.prefix,".config","xfce4","helpers.rc"),"TerminalEmulator=ghostty")&&fileExists(filepath.Join(s.prefix,".local","share","applications","ghostty.desktop")); version:="";if installed{ctx,cancel:=context.WithTimeout(context.Background(),time.Second);defer cancel();if out,err:=exec.CommandContext(ctx,bin,"--version").Output();err==nil{version=strings.TrimSpace(string(out));if i:=strings.IndexByte(version,'\n');i>=0{version=version[:i]}}};return ghosttyInfo{Installed:installed,Default:def,Version:version} }
func (s *server) launcher() launcherInfo { name:="missing";if b,err:=os.ReadFile(filepath.Join(s.config,"desktop","launcher"));err==nil{if v:=strings.TrimSpace(string(b));v!=""{name=v}};return launcherInfo{Name:name,Keybind:"Super+Space"} }
func defaultDefaults() defaultsInfo {return defaultsInfo{DefaultAIChat:"chatgpt",Sites:map[string]string{"chatgpt":"https://chatgpt.com","grok":"https://grok.com","claude":"https://claude.ai","discord":"https://discord.com/app","slack":"https://app.slack.com/client"}}}
func (s *server) defaults() defaultsInfo {p:=filepath.Join(s.config,"defaults.toml");d:=defaultDefaults();if v:=top(p,"default_ai_chat");v!=""{d.DefaultAIChat=v};for _,k:=range siteKeys{if v:=sec(p,"sites",k);v!=""{d.Sites[k]=v}};return d}
func validateDefaults(d defaultsInfo) error {switch d.DefaultAIChat{case "chatgpt","grok","claude":default:return fmt.Errorf("default_ai_chat must be chatgpt, grok, or claude")};for _,k:=range siteKeys{u,err:=url.Parse(strings.TrimSpace(d.Sites[k]));if err!=nil||(u.Scheme!="http"&&u.Scheme!="https")||u.Host==""{return fmt.Errorf("sites.%s must be an http(s) URL",k)}};return nil}
func tomlQuote(v string) string{return strings.ReplaceAll(strings.ReplaceAll(v,"\\","\\\\"),"\"","\\\"")}
func (s *server) writeDefaults(d defaultsInfo) error {if err:=os.MkdirAll(s.config,0755);err!=nil{return err};p:=filepath.Join(s.config,"defaults.toml");tmp:=p+".tmp";var b strings.Builder;fmt.Fprintln(&b,"# MaxQ operator defaults. Revert preserves this file.");fmt.Fprintf(&b,"default_ai_chat = \"%s\"\n\n[sites]\n",tomlQuote(d.DefaultAIChat));for _,k:=range siteKeys{fmt.Fprintf(&b,"%s = \"%s\"\n",k,tomlQuote(strings.TrimSpace(d.Sites[k])))};if err:=os.WriteFile(tmp,[]byte(b.String()),0644);err!=nil{return err};return os.Rename(tmp,p)}
func (s *server) runMaxq(args ...string) error {bin:=s.maxqBin;if _,err:=os.Stat(bin);err!=nil{p,e:=exec.LookPath("maxq");if e!=nil{return fmt.Errorf("maxq binary not found")};bin=p};cmd:=exec.Command(bin,args...);cmd.Env=append(os.Environ(),"MAXQ_HOME="+s.prefix);cmd.SysProcAttr=&syscall.SysProcAttr{Setpgid:true};out,err:=cmd.CombinedOutput();if err!=nil{msg:=strings.TrimSpace(string(out));if len(msg)>800{msg=msg[:800]};return fmt.Errorf("maxq %s: %v %s",strings.Join(args," "),err,msg)};return nil}
func writeJSON(w http.ResponseWriter,code int,v any){w.Header().Set("Content-Type","application/json");w.WriteHeader(code);_ = json.NewEncoder(w).Encode(v)}
func pidRunning(path string) bool {b,err:=os.ReadFile(path);if err!=nil{return false};pid:=strings.TrimSpace(string(b));if pid==""{return false};f,err:=os.Open(filepath.Join("/proc",pid));if err!=nil{return false};_ = f.Close();return true}
func isExecutable(path string) bool{st,err:=os.Stat(path);return err==nil&&st.Mode().IsRegular()&&st.Mode().Perm()&0111!=0}
func fileExists(path string) bool{_,err:=os.Stat(path);return err==nil}
func fileHasLine(path,want string) bool{b,err:=os.ReadFile(path);if err!=nil{return false};for _,line:=range strings.Split(string(b),"\n"){if strings.TrimSpace(line)==want{return true}};return false}
func asBool(v string) bool{switch strings.ToLower(strings.TrimSpace(v)){case "true","on","yes","1":return true};return false}
func orDefault(v,d string) string{if strings.TrimSpace(v)==""{return d};return v}
func top(path,key string) string{return tomlGet(path,"",key)}
func sec(path,section,key string) string{return tomlGet(path,section,key)}
func tomlGet(path,section,key string) string{b,err:=os.ReadFile(path);if err!=nil{return ""};in:=section=="";for _,line:=range strings.Split(string(b),"\n"){trim:=strings.TrimSpace(line);if trim==""||strings.HasPrefix(trim,"#"){continue};if strings.HasPrefix(trim,"[")&&strings.HasSuffix(trim,"]"){in=strings.TrimSpace(trim[1:len(trim)-1])==section;continue};if !in{continue};name,rest,ok:=strings.Cut(trim,"=");if ok&&strings.TrimSpace(name)==key{return unquote(strings.TrimSpace(rest))}};return ""}
