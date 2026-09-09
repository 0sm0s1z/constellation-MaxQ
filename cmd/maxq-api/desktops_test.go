package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestDisplayNumber(t *testing.T) {
	cases := map[string]int{
		":1":            1,
		":15.0":         15,
		"localhost:7.0": 7,
		"":              0,
		":0":            0,
		":16":           16,
		":21":           21,
		"garbage":       0,
	}
	for in, want := range cases {
		if got := displayNumber(in); got != want {
			t.Fatalf("displayNumber(%q)=%d want %d", in, got, want)
		}
	}
}

func TestDesktopLiveUsesX11Socket(t *testing.T) {
	root := t.TempDir()
	if desktopLive(root, 3) {
		t.Fatal("desktop 3 unexpectedly live")
	}
	p := filepath.Join(root, "X3")
	if err := os.WriteFile(p, []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	if !desktopLive(root, 3) {
		t.Fatal("desktop 3 should be live")
	}
	if err := os.WriteFile(filepath.Join(root, "X16"), []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	if !desktopLive(root, 16) {
		t.Fatal("desktop 16 should be live")
	}
	if desktopLive(root, 0) || desktopLive(root, -1) {
		t.Fatal("invalid desktop reported live")
	}
}

func TestDiscoverDisplayNumbers(t *testing.T) {
	root := t.TempDir()
	got := discoverDisplayNumbers(root)
	if len(got) != desktopSlotFloor || got[0] != 1 || got[len(got)-1] != desktopSlotFloor {
		t.Fatalf("empty root slots=%v want 1..%d", got, desktopSlotFloor)
	}
	if err := os.WriteFile(filepath.Join(root, "X21"), []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "X5"), []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	got = discoverDisplayNumbers(root)
	if len(got) != 21 || got[20] != 21 {
		t.Fatalf("with X21 slots=%v want 1..21", got)
	}
}

func TestDesktopPreferencesPersist(t *testing.T) {
	s := &server{config: t.TempDir()}
	def := s.loadDesktopPrefs()
	if def.VisibleCount != 4 || def.Filter != "live" || len(def.Selected) != 0 {
		t.Fatalf("default prefs=%+v", def)
	}
	want := desktopPrefs{VisibleCount: 6, Filter: "live", Selected: []int{1, 16, 21}}
	if err := s.saveDesktopPrefs(want); err != nil {
		t.Fatal(err)
	}
	got := s.loadDesktopPrefs()
	if got.VisibleCount != want.VisibleCount || got.Filter != want.Filter || !reflect.DeepEqual(got.Selected, want.Selected) {
		t.Fatalf("loadDesktopPrefs=%+v want %+v", got, want)
	}
	st, err := os.Stat(s.desktopPrefsPath())
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("desktops prefs mode=%o want 600", st.Mode().Perm())
	}
}

func TestDesktopViewerPort(t *testing.T) {
	cases := map[int]int{0: 0, 1: 6080, 2: 6081, 3: 6082, 21: 6100}
	for n, want := range cases {
		if got := desktopViewerPort(n); got != want {
			t.Fatalf("desktopViewerPort(%d)=%d want %d", n, got, want)
		}
	}
}

func TestDesktopViewerMetadata(t *testing.T) {
	oldRoot := x11SocketRoot
	x11SocketRoot = t.TempDir()
	defer func() { x11SocketRoot = oldRoot }()
	oldDisplay := os.Getenv("DISPLAY")
	defer func() { _ = os.Setenv("DISPLAY", oldDisplay) }()
	if err := os.Setenv("DISPLAY", ":2"); err != nil {
		t.Fatal(err)
	}

	s := &server{config: t.TempDir(), listen: defaultListen, prefix: t.TempDir()}
	resp := s.desktops()
	if len(resp.Desktops) != desktopSlotFloor {
		t.Fatalf("desktop count=%d want %d", len(resp.Desktops), desktopSlotFloor)
	}
	one := resp.Desktops[0]
	if one.Number != 1 || one.VNC != 5900 || one.ViewerPort != 6080 || one.Token != 0 {
		t.Fatalf("desktop 1 metadata=%+v", one)
	}
	two := resp.Desktops[1]
	wantV2, _ := desktopViewerPortResolve(2, 5902)
	if !two.Current || two.VNC != 5902 || two.ViewerPort != wantV2 || two.Token != 0 {
		t.Fatalf("desktop 2 metadata=%+v want viewer_port=%d", two, wantV2)
	}
	three := resp.Desktops[2]
	if three.ViewerPort != 6082 {
		t.Fatalf("desktop 3 viewer_port=%d want 6082", three.ViewerPort)
	}

	if err := os.WriteFile(filepath.Join(x11SocketRoot, "X21"), []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	resp = s.desktops()
	if len(resp.Desktops) != 21 {
		t.Fatalf("desktop count with X21=%d want 21", len(resp.Desktops))
	}
	last := resp.Desktops[20]
	if last.Number != 21 || !last.Live || last.VNC != 5921 || last.ViewerPort != 6100 || last.Token != 0 {
		t.Fatalf("desktop 21 metadata=%+v", last)
	}
	if resp.System.LiveCount != 1 {
		t.Fatalf("live_count=%d want 1", resp.System.LiveCount)
	}
	if resp.System.SuspendedCount < 0 {
		t.Fatalf("suspended_count missing/negative: %d", resp.System.SuspendedCount)
	}
	// synthetic fixtures have no SIGSTOP notes; field must still serialize as 0+
	_ = resp.System.SuspendedCount
}

func TestDesktopPreferencesHTTP(t *testing.T) {
	s := &server{config: t.TempDir()}
	req := httptest.NewRequest(http.MethodPost, "/desktops/preferences", strings.NewReader(`{"visible_count":5}`))
	rr := httptest.NewRecorder()
	s.handleDesktopPreferences(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := s.loadDesktopPrefs()
	if got.VisibleCount != 5 || got.Filter != "all" {
		t.Fatalf("prefs=%+v want visible_count=5 filter=all", got)
	}

	ext := httptest.NewRequest(http.MethodPost, "/desktops/preferences", strings.NewReader(`{"visible_count":3,"filter":"live","selected":[2,16]}`))
	extRR := httptest.NewRecorder()
	s.handleDesktopPreferences(extRR, ext)
	if extRR.Code != http.StatusOK {
		t.Fatalf("ext status=%d body=%s", extRR.Code, extRR.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(extRR.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	got = s.loadDesktopPrefs()
	if got.VisibleCount != 3 || got.Filter != "live" || !reflect.DeepEqual(got.Selected, []int{2, 16}) {
		t.Fatalf("extended prefs=%+v", got)
	}

	paused := httptest.NewRequest(http.MethodPost, "/desktops/preferences", strings.NewReader(`{"visible_count":3,"filter":"paused"}`))
	pausedRR := httptest.NewRecorder()
	s.handleDesktopPreferences(pausedRR, paused)
	if pausedRR.Code != http.StatusOK {
		t.Fatalf("paused status=%d body=%s", pausedRR.Code, pausedRR.Body.String())
	}
	if got := s.loadDesktopPrefs(); got.Filter != "paused" {
		t.Fatalf("paused prefs=%+v", got)
	}

	bad := httptest.NewRequest(http.MethodPost, "/desktops/preferences", strings.NewReader(`{"visible_count":15}`))
	badRR := httptest.NewRecorder()
	s.handleDesktopPreferences(badRR, bad)
	if badRR.Code != http.StatusBadRequest {
		t.Fatalf("bad preference status=%d want 400", badRR.Code)
	}
}

func TestDesktopsContentNegotiation(t *testing.T) {
	oldRoot := x11SocketRoot
	x11SocketRoot = t.TempDir()
	defer func() { x11SocketRoot = oldRoot }()
	s := &server{config: t.TempDir(), listen: defaultListen, prefix: t.TempDir()}

	apiReq := httptest.NewRequest(http.MethodGet, "/desktops", nil)
	apiReq.Header.Set("Accept", "application/json")
	apiRR := httptest.NewRecorder()
	s.handleDesktops(apiRR, apiReq, http.Dir(t.TempDir()))
	if apiRR.Code != http.StatusOK || !strings.Contains(apiRR.Body.String(), `"desktops"`) {
		t.Fatalf("api response status=%d body=%s", apiRR.Code, apiRR.Body.String())
	}

	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "desktops.html"), []byte("<h1>Desktops</h1>"), 0o600); err != nil {
		t.Fatal(err)
	}
	htmlReq := httptest.NewRequest(http.MethodGet, "/desktops", nil)
	htmlReq.Header.Set("Accept", "text/html,application/xhtml+xml")
	htmlRR := httptest.NewRecorder()
	s.handleDesktops(htmlRR, htmlReq, http.Dir(root))
	if htmlRR.Code != http.StatusOK || !strings.Contains(htmlRR.Body.String(), "<h1>Desktops</h1>") {
		t.Fatalf("html response status=%d body=%s", htmlRR.Code, htmlRR.Body.String())
	}
}

func TestParseCPUInfo(t *testing.T) {
	snippet := "processor\t: 0\n" +
		"vendor_id\t: GenuineIntel\n" +
		"model name\t: Intel(R) Xeon(R) Processor\n" +
		"processor\t: 1\n" +
		"model name\t: Intel(R) Xeon(R) Processor\n" +
		"processor\t: 2\n" +
		"processor\t: 3\n"
	cores, model := parseCPUInfo(snippet)
	if cores != 4 {
		t.Fatalf("cores=%d want 4", cores)
	}
	if model != "Intel(R) Xeon(R) Processor" {
		t.Fatalf("model=%q", model)
	}
}

func TestCachedCPUInfoLive(t *testing.T) {
	if _, err := os.Stat("/proc/cpuinfo"); err != nil {
		t.Skip("no /proc/cpuinfo")
	}
	cores, model := cachedCPUInfo()
	if cores <= 0 {
		t.Fatalf("cores=%d want > 0", cores)
	}
	if model == "" {
		t.Fatal("empty cpu model")
	}
}

func TestVisibleCountAllowsNine(t *testing.T) {
	s := &server{config: t.TempDir()}
	req := httptest.NewRequest(http.MethodPost, "/desktops/preferences", strings.NewReader(`{"visible_count":9}`))
	rr := httptest.NewRecorder()
	s.handleDesktopPreferences(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := s.loadDesktopPrefs()
	if got.VisibleCount != 9 {
		t.Fatalf("prefs=%+v want visible_count=9", got)
	}

	bad := httptest.NewRequest(http.MethodPost, "/desktops/preferences", strings.NewReader(`{"visible_count":10}`))
	badRR := httptest.NewRecorder()
	s.handleDesktopPreferences(badRR, bad)
	if badRR.Code != http.StatusBadRequest {
		t.Fatalf("bad preference status=%d want 400", badRR.Code)
	}
}

func TestDisplayFromCmdline(t *testing.T) {
	cases := map[string]int{
		"Xvfb :5 -screen 0 1280x800x24":                                                         5,
		"/usr/local/bin/box-xvfb :16 -screen 0":                                                 16,
		"/opt/google/chrome/chrome --user-data-dir=/home/box/chrome-profile-5 --no-sandbox":     5,
		"env DISPLAY=:17 HOME=/home/box /opt/google/chrome/chrome":                              17,
		"/opt/google/chrome/chrome_crashpad_handler --user-data-dir=/home/box/chrome-profile-5": 0,
		"something else":    0,
		"Xvfb :0 -screen 0": 0,
	}
	for in, want := range cases {
		if got := displayFromCmdline(in); got != want {
			t.Fatalf("displayFromCmdline(%q)=%d want %d", in, got, want)
		}
	}
}

func TestReadProcCPUTicks(t *testing.T) {
	dir := t.TempDir()
	// pid (chrome) S 1 1 1 0 -1 0 0 0 0 0 10 20 0 0
	stat := "123 (chrome) S 1 1 1 0 -1 4194304 0 0 0 0 10 20 0 0\n"
	path := filepath.Join(dir, "stat")
	if err := os.WriteFile(path, []byte(stat), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := readProcCPUTicks(path); got != 30 {
		t.Fatalf("ticks=%d want 30", got)
	}
}

func TestIsChromeActivityProc(t *testing.T) {
	ok := "/opt/google/chrome/chrome --user-data-dir=/home/box/chrome-profile-5"
	if !isChromeActivityProc(ok) {
		t.Fatal("chrome profile should count")
	}
	if isChromeActivityProc("/opt/google/chrome/chrome_crashpad_handler --user-data-dir=/home/box/chrome-profile-5") {
		t.Fatal("crashpad should not count")
	}
	if isChromeActivityProc("Xvfb :5 -screen 0") {
		t.Fatal("Xvfb should not count as chrome activity")
	}
}

func TestCDPPortForDisplay(t *testing.T) {
	if cdpPortForDisplay(5) != 9227 || cdpPortForDisplay(1) != 9223 || cdpPortForDisplay(0) != 0 {
		t.Fatalf("cdp ports :5=%d :1=%d :0=%d", cdpPortForDisplay(5), cdpPortForDisplay(1), cdpPortForDisplay(0))
	}
}

func TestEntitlementSite(t *testing.T) {
	cases := map[string]string{
		"https://chatgpt.com/c/abc":                "chatgpt",
		"https://chat.openai.com/":                 "chatgpt",
		"https://grok.com/chat":                    "grok",
		"https://accounts.x.ai/sign-in?redirect=x": "grok",
		"https://grok.x.ai/":                       "grok",
		"https://x.com/i/grok":                     "grok",
		"https://x.com/i/chat/32925761-195138772":  "x",
		"https://twitter.com/i/chat/pin/recovery":  "x",
		"https://claude.ai/chat/1":                 "claude",
		"https://example.com/":                     "",
		"http://127.0.0.1:7432/":                   "",
	}
	for in, want := range cases {
		if got := entitlementSite(in); got != want {
			t.Fatalf("entitlementSite(%q)=%q want %q", in, got, want)
		}
	}
}

func TestGuardDesktopControl(t *testing.T) {
	s := &server{config: t.TempDir()}
	old := os.Getenv("DISPLAY")
	t.Cleanup(func() { _ = os.Setenv("DISPLAY", old) })
	if err := os.Setenv("DISPLAY", ":5"); err != nil {
		t.Fatal(err)
	}
	if err := s.guardDesktopControl(1); err == nil {
		t.Fatal("expected refuse :1")
	}
	if err := s.guardDesktopControl(5); err == nil {
		t.Fatal("expected refuse current :5")
	}
	if err := s.guardDesktopControl(16); err != nil {
		t.Fatalf(":%d should be allowed: %v", 16, err)
	}
}

func TestDisplayFromCmdlineDisplayFlag(t *testing.T) {
	if got := displayFromCmdline("x11vnc -display :16 -rfbport 5916"); got != 16 {
		t.Fatalf("x11vnc display=%d", got)
	}
}


func TestDesktopViewerListening(t *testing.T) {
	if desktopViewerListening(0) || desktopViewerListening(-1) {
		t.Fatal("invalid ports should be false")
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port
	if !desktopViewerListening(port) {
		t.Fatalf("expected listening port %d", port)
	}
	_ = ln.Close()
	if desktopViewerListening(port) {
		t.Fatalf("closed port %d still reported listening", port)
	}
}

func TestLoadSuspendedSetFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "suspended.json")
	if err := os.WriteFile(path, []byte("[5, 7, 1, 11]\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	set := loadSuspendedSetFile(path)
	if set[1] {
		t.Fatal("display 1 must be rejected from suspended set")
	}
	if !set[5] || !set[7] || !set[11] {
		t.Fatalf("set=%v want 5,7,11", set)
	}
	empty := loadSuspendedSetFile(filepath.Join(dir, "missing.json"))
	if len(empty) != 0 {
		t.Fatalf("missing file should yield empty set, got %v", empty)
	}
}

func TestHandoffDesktopBriefSuspendedJSON(t *testing.T) {
	raw, err := json.Marshal(handoffDesktopBrief{Live: 2, Total: 15, ViewerReady: 1, Suspended: 6})
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	v, ok := m["suspended_count"]
	if !ok {
		t.Fatalf("missing suspended_count in %s", raw)
	}
	if int(v.(float64)) != 6 {
		t.Fatalf("suspended_count=%v want 6", v)
	}
}


func TestDesktopViewerCmdlineHelpers(t *testing.T) {
	dedicated := "/usr/bin/python3 /usr/bin/websockify --web=/usr/share/novnc --heartbeat=30 0.0.0.0:6081 localhost:5902"
	tokenGW := "/usr/bin/python3 /usr/bin/websockify --web=/usr/share/novnc --heartbeat=30 --token-plugin TokenFile --token-source /tmp/sand-novnc-tokens.d 0.0.0.0:6081"
	altDedicated := "websockify --web=/usr/share/novnc 0.0.0.0:6181 localhost:5902"

	if !desktopViewerCmdlineHasListen(dedicated, 6081) {
		t.Fatal("dedicated should listen on 6081")
	}
	if !desktopViewerCmdlineHasListen(tokenGW, 6081) {
		t.Fatal("token gateway should listen on 6081")
	}
	if desktopViewerCmdlineHasListen(dedicated, 6181) {
		t.Fatal("dedicated 6081 should not match listen 6181")
	}

	if !desktopViewerCmdlineDedicatedTarget(dedicated, 5902) {
		t.Fatal("dedicated should match localhost:5902")
	}
	if desktopViewerCmdlineDedicatedTarget(tokenGW, 5902) {
		t.Fatal("token gateway must not match dedicated target")
	}
	if desktopViewerCmdlineDedicatedTarget(dedicated, 5900) {
		t.Fatal("wrong vnc port must not match")
	}
	if !desktopViewerCmdlineDedicatedTarget(altDedicated, 5902) {
		t.Fatal("alt dedicated should match")
	}
	if desktopViewerCmdlineDedicatedTarget("", 5902) {
		t.Fatal("empty cmdline must be false")
	}
}

func TestDesktopViewerPortResolveDecision(t *testing.T) {
	type tc struct {
		name                  string
		n                     int
		prefMatch, altMatch   bool
		prefListen, altListen bool
		wantPort              int
		wantMatched           bool
	}
	cases := []tc{
		{name: "preferred dedicated", n: 2, prefMatch: true, wantPort: 6081, wantMatched: true},
		{name: "alt dedicated", n: 2, altMatch: true, wantPort: 6181, wantMatched: true},
		{name: "preferred free", n: 2, wantPort: 6081, wantMatched: false},
		{name: "foreign preferred alt free", n: 2, prefListen: true, wantPort: 6181, wantMatched: false},
		{name: "foreign preferred alt match", n: 2, prefListen: true, altMatch: true, altListen: true, wantPort: 6181, wantMatched: true},
		{name: "both foreign", n: 2, prefListen: true, altListen: true, wantPort: 6181, wantMatched: false},
		{name: "slot1 preferred free", n: 1, wantPort: 6080, wantMatched: false},
		{name: "slot1 foreign uses alt", n: 1, prefListen: true, wantPort: 6180, wantMatched: false},
		{name: "invalid slot", n: 0, wantPort: 0, wantMatched: false},
	}
	for _, c := range cases {
		gotPort, gotMatch := desktopViewerPortResolveDecision(c.n, c.prefMatch, c.altMatch, c.prefListen, c.altListen)
		if gotPort != c.wantPort || gotMatch != c.wantMatched {
			t.Fatalf("%s: got (%d,%v) want (%d,%v)", c.name, gotPort, gotMatch, c.wantPort, c.wantMatched)
		}
	}
}

func TestDesktopViewerAltPort(t *testing.T) {
	cases := map[int]int{0: 0, 1: 6180, 2: 6181, 3: 6182, 21: 6200}
	for n, want := range cases {
		if got := desktopViewerAltPort(n); got != want {
			t.Fatalf("desktopViewerAltPort(%d)=%d want %d", n, got, want)
		}
	}
}
