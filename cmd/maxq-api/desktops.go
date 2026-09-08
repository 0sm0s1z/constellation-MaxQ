package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// desktopSlotFloor is the stable minimum slot range (1..15) always advertised.
const desktopSlotFloor = 15

var x11SocketRoot = "/tmp/.X11-unix"

type xvfbDesktop struct {
	Number       int              `json:"number"`
	Display      string           `json:"display"`
	Live         bool             `json:"live"`
	Current      bool             `json:"current"`
	VNC          int              `json:"vnc_port"`
	ViewerPort   int              `json:"viewer_port"`
	ViewerOK     bool             `json:"viewer_ok"`
	Token        int              `json:"token,omitempty"`
	Activity     string           `json:"activity"`
	ActivityAgeS int              `json:"activity_age_s"`
	CDPPort      int              `json:"cdp_port,omitempty"`
	Chats        []entitlementTab `json:"chats"`
	Suspended    bool             `json:"suspended"`
}

type desktopPrefs struct {
	VisibleCount int    `json:"visible_count"`
	Filter       string `json:"filter"`   // all | live | idle | ready | paused
	Selected     []int  `json:"selected"` // empty = all known that pass filter
}

type desktopTelemetry struct {
	CPUPercent         float64 `json:"cpu_percent"`
	RAMPercent         float64 `json:"ram_percent"`
	RAMUsedBytes       uint64  `json:"ram_used_bytes"`
	RAMTotalBytes      uint64  `json:"ram_total_bytes"`
	RAMAvailableBytes  uint64  `json:"ram_available_bytes"`
	SwapTotalBytes     uint64  `json:"swap_total_bytes"`
	SwapFreeBytes      uint64  `json:"swap_free_bytes"`
	SwapEnabled        bool    `json:"swap_enabled"`
	SwapNote           string  `json:"swap_note,omitempty"`
	Load1              float64 `json:"load1"`
	CPUCores           int     `json:"cpu_cores"`
	CPUModel           string  `json:"cpu_model"`
	Hostname           string  `json:"hostname"`
	Kernel             string  `json:"kernel"`
	UptimeSeconds      float64 `json:"uptime_seconds"`
	State              string  `json:"state"`
	GostRunning        bool    `json:"gost_running"`
	AgentDisplay       string  `json:"agent_display"`
	LiveCount          int     `json:"live_count"`
	ViewerReady        int     `json:"viewer_ready"`
	SuspendedCount     int     `json:"suspended_count"`
	GeneratedAtUTC     string  `json:"generated_at_utc"`
}

type desktopsResp struct {
	Desktops   []xvfbDesktop    `json:"desktops"`
	Preference desktopPrefs     `json:"preference"`
	System     desktopTelemetry `json:"system"`
}

func (s *server) handleDesktops(w http.ResponseWriter, r *http.Request, ui http.FileSystem) {
	if strings.Contains(r.Header.Get("Accept"), "text/html") {
		f, err := ui.Open("desktops.html")
		if err != nil {
			http.Error(w, "desktops ui unavailable", http.StatusInternalServerError)
			return
		}
		defer f.Close()
		st, _ := f.Stat()
		http.ServeContent(w, r, "desktops.html", st.ModTime(), f)
		return
	}
	writeJSON(w, http.StatusOK, s.desktops())
}

func (s *server) handleDesktopPreferences(w http.ResponseWriter, r *http.Request) {
	var req desktopPrefs
	dec := json.NewDecoder(io.LimitReader(r.Body, 4096))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	if req.VisibleCount < 1 || req.VisibleCount > 9 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "visible_count must be 1..9"})
		return
	}
	req = normalizeDesktopPrefs(req)
	if err := s.saveDesktopPrefs(req); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "preference": req})
}

func (s *server) desktops() desktopsResp {
	current := displayNumber(os.Getenv("DISPLAY"))
	numbers := discoverDisplayNumbers(x11SocketRoot)
	items := make([]xvfbDesktop, 0, len(numbers))
	liveCount := 0
	viewerReady := 0
	for _, n := range numbers {
		live := desktopLive(x11SocketRoot, n)
		if live {
			liveCount++
		}
		vport := desktopViewerPort(n)
		viewerOK := live && desktopViewerListening(vport)
		item := xvfbDesktop{
			Number:     n,
			Display:    fmt.Sprintf(":%d", n),
			Live:       live,
			Current:    n == current,
			VNC:        5900 + n,
			ViewerPort: vport,
			ViewerOK:   viewerOK,
			// Token left 0 / omitempty: each desk has a dedicated websockify
			// port, so a shared token gateway path is unused and previously
			// broke embedded previews when the UI appended ?token=N.
		}
		if n == 1 {
			item.VNC = 5900
		}
		if viewerOK {
			viewerReady++
		}
		items = append(items, item)
	}
	applyDesktopActivity(items)
	fillDesktopChats(items)
	s.applyDesktopSuspended(items)
	suspendedCount := 0
	for _, it := range items {
		if it.Suspended {
			suspendedCount++
		}
	}
	st := s.status()
	cpu := cpuPercent()
	mem := readMemSnapshot()
	load1 := loadAverage1()
	cores, model := cachedCPUInfo()
	host, _ := os.Hostname()
	kernel := readKernelRelease()
	uptime := readUptimeSeconds()
	agentDisplay := "—"
	if current > 0 {
		agentDisplay = fmt.Sprintf(":%d", current)
	}
	return desktopsResp{
		Desktops:   items,
		Preference: s.loadDesktopPrefs(),
		System: desktopTelemetry{
			CPUPercent:        cpu,
			RAMPercent:        mem.Percent,
			RAMUsedBytes:      mem.Used,
			RAMTotalBytes:     mem.Total,
			RAMAvailableBytes: mem.Available,
			SwapTotalBytes:    mem.SwapTotal,
			SwapFreeBytes:     mem.SwapFree,
			SwapEnabled:       mem.SwapEnabled,
			SwapNote:          mem.SwapNote,
			Load1:             load1,
			CPUCores:          cores,
			CPUModel:          model,
			Hostname:          host,
			Kernel:            kernel,
			UptimeSeconds:     uptime,
			State:             st.State,
			GostRunning:       st.Gost.Running,
			AgentDisplay:      agentDisplay,
			LiveCount:         liveCount,
			ViewerReady:       viewerReady,
			SuspendedCount:    suspendedCount,
			GeneratedAtUTC:    time.Now().UTC().Format(time.RFC3339),
		},
	}
}

// discoverDisplayNumbers returns a stable ascending slot list covering
// 1..max(desktopSlotFloor, highest X11 socket number discovered under root).
func discoverDisplayNumbers(root string) []int {
	highest := desktopSlotFloor
	entries, err := os.ReadDir(root)
	if err == nil {
		for _, e := range entries {
			name := e.Name()
			if !strings.HasPrefix(name, "X") || len(name) < 2 {
				continue
			}
			n, err := strconv.Atoi(name[1:])
			if err != nil || n < 1 {
				continue
			}
			if n > highest {
				highest = n
			}
		}
	}
	out := make([]int, 0, highest)
	for n := 1; n <= highest; n++ {
		out = append(out, n)
	}
	return out
}

func displayNumber(v string) int {
	v = strings.TrimSpace(v)
	i := strings.LastIndexByte(v, ':')
	if i < 0 || i == len(v)-1 {
		return 0
	}
	n := v[i+1:]
	if j := strings.IndexByte(n, '.'); j >= 0 {
		n = n[:j]
	}
	out, err := strconv.Atoi(n)
	if err != nil || out < 1 {
		return 0
	}
	return out
}

func desktopLive(root string, n int) bool {
	if n < 1 {
		return false
	}
	st, err := os.Stat(filepath.Join(root, "X"+strconv.Itoa(n)))
	return err == nil && !st.IsDir()
}


// desktopViewerListening probes whether a noVNC/websockify HTTP port answers on
// loopback. Live X11 without a listener shows as viewer_ok=false in the glass.
func desktopViewerListening(port int) bool {
	if port < 1 {
		return false
	}
	c, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 120*time.Millisecond)
	if err != nil {
		return false
	}
	_ = c.Close()
	return true
}

// desktopViewerPort returns a unique noVNC HTTP port for slot n.
// Desktop 1 stays on the historical 6080; others use 6080+(n-1) so idle/missing
// slots no longer all collide on 6081. This is address metadata only — Live
// still gates whether a viewer is expected to answer.
func desktopViewerPort(n int) int {
	if n < 1 {
		return 0
	}
	return 6080 + (n - 1)
}

// desktopVNCPort matches desktops() address metadata: slot 1 stays on historical
// 5900; others use 5900+n.
func desktopVNCPort(n int) int {
	if n < 1 {
		return 0
	}
	if n == 1 {
		return 5900
	}
	return 5900 + n
}

// desktopVNCListening probes whether x11vnc answers on 127.0.0.1:port.
func desktopVNCListening(port int) bool {
	if port < 1 {
		return false
	}
	c, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 120*time.Millisecond)
	if err != nil {
		return false
	}
	_ = c.Close()
	return true
}

type ensureViewersResult struct {
	OK             bool  `json:"ok"`
	Started        []int `json:"started"`
	SkippedReady   []int `json:"skipped_ready"`
	SkippedNoVNC   []int `json:"skipped_no_vnc"`
	Errors         []string `json:"errors"`
	StartedCount   int   `json:"started_count"`
	ReadyCount     int   `json:"ready_count"`
	NoVNCCount     int   `json:"no_vnc_count"`
}

func ensureDesktopViewers() ensureViewersResult {
	res := ensureViewersResult{
		OK:           true,
		Started:      []int{},
		SkippedReady: []int{},
		SkippedNoVNC: []int{},
		Errors:       []string{},
	}
	for _, n := range discoverDisplayNumbers(x11SocketRoot) {
		if !desktopLive(x11SocketRoot, n) {
			continue
		}
		vncPort := desktopVNCPort(n)
		viewerPort := desktopViewerPort(n)
		if desktopViewerListening(viewerPort) {
			res.SkippedReady = append(res.SkippedReady, n)
			continue
		}
		if !desktopVNCListening(vncPort) {
			res.SkippedNoVNC = append(res.SkippedNoVNC, n)
			continue
		}
		if err := startDesktopViewer(n, viewerPort, vncPort); err != nil {
			res.OK = false
			res.Errors = append(res.Errors, fmt.Sprintf(":%d %v", n, err))
			continue
		}
		res.Started = append(res.Started, n)
	}
	res.StartedCount = len(res.Started)
	res.ReadyCount = len(res.SkippedReady)
	res.NoVNCCount = len(res.SkippedNoVNC)
	return res
}

func startDesktopViewer(n, viewerPort, vncPort int) error {
	logPath := fmt.Sprintf("/tmp/novnc:%d.log", n)
	wsArgs := []string{
		"--web=/usr/share/novnc",
		"--heartbeat=30",
		fmt.Sprintf("0.0.0.0:%d", viewerPort),
		fmt.Sprintf("localhost:%d", vncPort),
	}
	var cmd *exec.Cmd
	if _, err := os.Stat("/usr/local/bin/box-bounded-log"); err == nil {
		args := append([]string{"--run", logPath, "--", "websockify"}, wsArgs...)
		cmd = exec.Command("/usr/local/bin/box-bounded-log", args...)
	} else {
		cmd = exec.Command("websockify", wsArgs...)
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		return err
	}
	// Detach so the API does not wait on websockify.
	go func() { _ = cmd.Wait() }()
	// Brief settle so a subsequent listen probe can see it when called back-to-back.
	deadline := time.Now().Add(800 * time.Millisecond)
	for time.Now().Before(deadline) {
		if desktopViewerListening(viewerPort) {
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	// Started but not yet answering — still count as started (process up).
	return nil
}

type restartWebsockifyResult struct {
	OK           bool     `json:"ok"`
	Restarted    []int    `json:"restarted"`
	SkippedNoVNC []int    `json:"skipped_no_vnc"`
	Errors       []string `json:"errors"`
	Count        int      `json:"count"`
}

// restartWebsockifyOnly kills only websockify/noVNC viewers for live desks that
 // already have x11vnc, then starts a fresh websockify. Never touches Xvfb,
 // chrome-profile, x11vnc, or maxq-api. Safe for :23 viewer-only repair.
func restartWebsockifyOnly() restartWebsockifyResult {
	res := restartWebsockifyResult{
		OK:           true,
		Restarted:    []int{},
		SkippedNoVNC: []int{},
		Errors:       []string{},
	}
	for _, n := range discoverDisplayNumbers(x11SocketRoot) {
		if !desktopLive(x11SocketRoot, n) {
			continue
		}
		vncPort := desktopVNCPort(n)
		viewerPort := desktopViewerPort(n)
		if !desktopVNCListening(vncPort) {
			res.SkippedNoVNC = append(res.SkippedNoVNC, n)
			continue
		}
		killWebsockifyOnPort(viewerPort)
		if err := startDesktopViewer(n, viewerPort, vncPort); err != nil {
			res.OK = false
			res.Errors = append(res.Errors, fmt.Sprintf(":%d %v", n, err))
			continue
		}
		res.Restarted = append(res.Restarted, n)
	}
	res.Count = len(res.Restarted)
	return res
}

func killWebsockifyOnPort(port int) {
	if port <= 0 {
		return
	}
	ents, err := os.ReadDir("/proc")
	if err != nil {
		return
	}
	needle := fmt.Sprintf("0.0.0.0:%d", port)
	alt := fmt.Sprintf(":%d", port)
	for _, e := range ents {
		name := e.Name()
		if name == "" || name[0] < '0' || name[0] > '9' {
			continue
		}
		raw, err := os.ReadFile("/proc/" + name + "/cmdline")
		if err != nil || len(raw) == 0 {
			continue
		}
		cmd := strings.ReplaceAll(string(raw), "\x00", " ")
		if !strings.Contains(cmd, "websockify") {
			continue
		}
		if !(strings.Contains(cmd, needle) || strings.Contains(cmd, " "+alt+" ") || strings.HasSuffix(strings.TrimSpace(cmd), alt)) {
			continue
		}
		pid, err := strconv.Atoi(name)
		if err != nil || pid <= 1 {
			continue
		}
		_ = syscall.Kill(pid, syscall.SIGTERM)
	}
	deadline := time.Now().Add(400 * time.Millisecond)
	for time.Now().Before(deadline) {
		if !desktopViewerListening(port) {
			return
		}
		time.Sleep(40 * time.Millisecond)
	}
}

func (s *server) handleEnsureDesktopViewers(w http.ResponseWriter, r *http.Request) {
	res := ensureDesktopViewers()
	code := http.StatusOK
	if !res.OK {
		code = http.StatusMultiStatus
	}
	writeJSON(w, code, res)
}

func (s *server) desktopPrefsPath() string {
	return filepath.Join(s.config, "desktops.json")
}

func normalizeDesktopPrefs(p desktopPrefs) desktopPrefs {
	if p.VisibleCount < 1 || p.VisibleCount > 9 {
		p.VisibleCount = 4
	}
	switch strings.ToLower(strings.TrimSpace(p.Filter)) {
	case "live":
		p.Filter = "live"
	case "idle":
		p.Filter = "idle"
	case "ready":
		p.Filter = "ready"
	case "paused", "suspended", "frozen":
		p.Filter = "paused"
	default:
		p.Filter = "all"
	}
	if p.Selected == nil {
		p.Selected = []int{}
	} else {
		cleaned := make([]int, 0, len(p.Selected))
		seen := map[int]bool{}
		for _, n := range p.Selected {
			if n < 1 || seen[n] {
				continue
			}
			seen[n] = true
			cleaned = append(cleaned, n)
		}
		sort.Ints(cleaned)
		p.Selected = cleaned
	}
	return p
}

func (s *server) loadDesktopPrefs() desktopPrefs {
	p := desktopPrefs{VisibleCount: 4, Filter: "live", Selected: []int{}}
	b, err := os.ReadFile(s.desktopPrefsPath())
	if err != nil {
		return p
	}
	var got desktopPrefs
	if json.Unmarshal(b, &got) != nil {
		return p
	}
	return normalizeDesktopPrefs(got)
}

func (s *server) saveDesktopPrefs(p desktopPrefs) error {
	p = normalizeDesktopPrefs(p)
	if err := os.MkdirAll(s.config, 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	path := s.desktopPrefsPath()
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

var (
	hostCPUOnce  sync.Once
	hostCPUCores int
	hostCPUModel string
)

// parseCPUInfo extracts logical CPU count and the first model name from /proc/cpuinfo text.
func parseCPUInfo(data string) (cores int, model string) {
	for _, line := range strings.Split(data, "\n") {
		if strings.HasPrefix(line, "processor") {
			cores++
			continue
		}
		if model != "" || !strings.HasPrefix(line, "model name") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		model = strings.Join(strings.Fields(strings.TrimSpace(parts[1])), " ")
	}
	return cores, model
}

func cachedCPUInfo() (cores int, model string) {
	hostCPUOnce.Do(func() {
		b, err := os.ReadFile("/proc/cpuinfo")
		if err != nil {
			hostCPUCores = runtime.NumCPU()
			return
		}
		hostCPUCores, hostCPUModel = parseCPUInfo(string(b))
		if hostCPUCores <= 0 {
			hostCPUCores = runtime.NumCPU()
		}
	})
	return hostCPUCores, hostCPUModel
}

func readKernelRelease() string {
	b, err := os.ReadFile("/proc/sys/kernel/osrelease")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func readUptimeSeconds() float64 {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(fields[0], 64)
	return v
}

func loadAverage1() float64 {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(fields[0], 64)
	return v
}

type memSnapshot struct {
	Percent       float64
	Used          uint64
	Total         uint64
	Available     uint64
	SwapTotal     uint64
	SwapFree      uint64
	SwapEnabled   bool
	SwapNote      string
}

func memoryUsage() (percent float64, used, total uint64) {
	s := readMemSnapshot()
	return s.Percent, s.Used, s.Total
}

func readMemSnapshot() memSnapshot {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return memSnapshot{}
	}
	vals := map[string]uint64{}
	want := map[string]bool{
		"MemTotal": true, "MemAvailable": true,
		"SwapTotal": true, "SwapFree": true,
	}
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		if !want[key] {
			continue
		}
		v, _ := strconv.ParseUint(fields[1], 10, 64)
		vals[key] = v * 1024
	}
	total := vals["MemTotal"]
	avail := vals["MemAvailable"]
	swapTotal := vals["SwapTotal"]
	swapFree := vals["SwapFree"]
	var used uint64
	var percent float64
	if total > 0 && avail <= total {
		used = total - avail
		percent = float64(used) * 100 / float64(total)
	}
	note := "swap is 0 on this box — do not enable swap without Matthew"
	if swapTotal > 0 {
		note = "swap present — still prefer Actions over OOM thrash; ask Matthew before changing swap"
	}
	return memSnapshot{
		Percent:     percent,
		Used:        used,
		Total:       total,
		Available:   avail,
		SwapTotal:   swapTotal,
		SwapFree:    swapFree,
		SwapEnabled: swapTotal > 0,
		SwapNote:    note,
	}
}

type cpuTimes struct {
	idle  uint64
	total uint64
}

func readCPUTimes() cpuTimes {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuTimes{}
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuTimes{}
	}
	var nums []uint64
	for _, f := range fields[1:] {
		v, err := strconv.ParseUint(f, 10, 64)
		if err != nil {
			return cpuTimes{}
		}
		nums = append(nums, v)
	}
	var total uint64
	for _, v := range nums {
		total += v
	}
	idle := nums[3]
	if len(nums) > 4 {
		idle += nums[4]
	}
	return cpuTimes{idle: idle, total: total}
}

func cpuPercent() float64 {
	a := readCPUTimes()
	time.Sleep(80 * time.Millisecond)
	b := readCPUTimes()
	if a.total == 0 || b.total <= a.total {
		return 0
	}
	dTotal := b.total - a.total
	dIdle := b.idle - a.idle
	if dIdle > dTotal {
		return 0
	}
	return float64(dTotal-dIdle) * 100 / float64(dTotal)
}

type desktopActSample struct {
	ticks uint64
}

type desktopActState struct {
	mu       sync.Mutex
	prev     map[int]uint64
	prevAt   time.Time
	lastBusy map[int]time.Time
}

var desktopActs = desktopActState{
	prev:     map[int]uint64{},
	lastBusy: map[int]time.Time{},
}

func leadingInt(s string) int {
	n := 0
	found := false
	for _, r := range s {
		if r < '0' || r > '9' {
			break
		}
		found = true
		n = n*10 + int(r-'0')
		if n > 99 {
			return 0
		}
	}
	if !found || n < 1 {
		return 0
	}
	return n
}

func displayFromCmdline(cmd string) int {
	if strings.Contains(cmd, "chrome_crashpad") {
		return 0
	}
	needles := []string{"chrome-profile-", "DISPLAY=:", "-display :", "Xvfb :", "box-xvfb :"}
	for _, needle := range needles {
		i := strings.Index(cmd, needle)
		if i < 0 {
			continue
		}
		if n := leadingInt(cmd[i+len(needle):]); n >= 1 {
			return n
		}
	}
	return 0
}

func isChromeActivityProc(cmd string) bool {
	if strings.Contains(cmd, "chrome_crashpad") || strings.Contains(cmd, "box-bounded-log") {
		return false
	}
	if !strings.Contains(cmd, "/opt/google/chrome/chrome") {
		return false
	}
	return displayFromCmdline(cmd) >= 1
}

func readProcCPUTicks(statPath string) uint64 {
	b, err := os.ReadFile(statPath)
	if err != nil {
		return 0
	}
	s := string(b)
	i := strings.LastIndexByte(s, ')')
	if i < 0 || i+2 >= len(s) {
		return 0
	}
	fields := strings.Fields(s[i+2:])
	// after comm: state ppid ... utime(index 11) stime(index 12)
	if len(fields) < 13 {
		return 0
	}
	utime, err1 := strconv.ParseUint(fields[11], 10, 64)
	stime, err2 := strconv.ParseUint(fields[12], 10, 64)
	if err1 != nil || err2 != nil {
		return 0
	}
	return utime + stime
}

func scanChromeTicks() map[int]uint64 {
	out := map[int]uint64{}
	ents, err := os.ReadDir("/proc")
	if err != nil {
		return out
	}
	for _, e := range ents {
		name := e.Name()
		if name == "" || name[0] < '0' || name[0] > '9' {
			continue
		}
		raw, err := os.ReadFile("/proc/" + name + "/cmdline")
		if err != nil || len(raw) == 0 {
			continue
		}
		cmd := strings.ReplaceAll(string(raw), "\x00", " ")
		if !isChromeActivityProc(cmd) {
			continue
		}
		n := displayFromCmdline(cmd)
		if n < 1 {
			continue
		}
		out[n] += readProcCPUTicks("/proc/" + name + "/stat")
	}
	return out
}

// busyThreshold is ~15% of one core in CLK_TCK units over the sample interval.
const busyCoreFraction = 0.15

func applyDesktopActivity(items []xvfbDesktop) {
	now := time.Now()
	ticks := scanChromeTicks()
	desktopActs.mu.Lock()
	defer desktopActs.mu.Unlock()
	elapsed := now.Sub(desktopActs.prevAt).Seconds()
	havePrev := !desktopActs.prevAt.IsZero() && elapsed > 0.2
	hz := 100.0
	for i := range items {
		n := items[i].Number
		if !items[i].Live {
			items[i].Activity = "idle"
			items[i].ActivityAgeS = -1
			continue
		}
		busy := false
		if havePrev {
			delta := ticks[n] - desktopActs.prev[n]
			if ticks[n] < desktopActs.prev[n] {
				delta = ticks[n]
			}
			coresUsed := float64(delta) / (elapsed * hz)
			if coresUsed >= busyCoreFraction {
				busy = true
				desktopActs.lastBusy[n] = now
			}
		}
		if busy {
			items[i].Activity = "busy"
			items[i].ActivityAgeS = 0
			continue
		}
		items[i].Activity = "quiet"
		if t, ok := desktopActs.lastBusy[n]; ok && !t.IsZero() {
			age := int(now.Sub(t).Seconds())
			if age < 0 {
				age = 0
			}
			items[i].ActivityAgeS = age
		} else {
			items[i].ActivityAgeS = -1
		}
	}
	desktopActs.prev = ticks
	desktopActs.prevAt = now
}
