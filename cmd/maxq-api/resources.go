package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type hostResources struct {
	CPUUsedPercent      float64 `json:"cpu_used_percent"`
	CPUAvailablePercent float64 `json:"cpu_available_percent"`
	CPUUsedCores        float64 `json:"cpu_used_cores"`
	CPUAvailableCores   float64 `json:"cpu_available_cores"`
	CPUTotalCores       int     `json:"cpu_total_cores"`
	RAMUsedBytes        uint64  `json:"ram_used_bytes"`
	RAMAvailableBytes   uint64  `json:"ram_available_bytes"`
	RAMTotalBytes       uint64  `json:"ram_total_bytes"`
	SwapUsedBytes       uint64  `json:"swap_used_bytes"`
	SwapTotalBytes      uint64  `json:"swap_total_bytes"`
	NoSwap              bool    `json:"no_swap"`
}

type chromeDisplayInfo struct {
	Display      string `json:"display"`
	Profile      string `json:"profile"`
	ProfilePath  string `json:"profile_path"`
	RSSBytes     uint64 `json:"rss_bytes"`
	ProcessCount int    `json:"process_count"`
	ThisAgent    bool   `json:"this_agent"`
}

type agentChromeInfo struct {
	Display      string `json:"display"`
	Profile      string `json:"profile"`
	ProfilePath  string `json:"profile_path"`
	RSSBytes     uint64 `json:"rss_bytes"`
	ProcessCount int    `json:"process_count"`
	Mutable      bool   `json:"mutable"`
	Note         string `json:"note"`
}

type resourcesResp struct {
	Host   hostResources       `json:"host"`
	Chrome []chromeDisplayInfo `json:"chrome"`
	Agent  agentChromeInfo     `json:"agent"`
}

type chromeActionReq struct {
	Action string `json:"action"`
}

func (s *server) handleResources(w http.ResponseWriter, r *http.Request) {
	res, err := collectResources()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *server) handleChromeAction(w http.ResponseWriter, r *http.Request) {
	s.chromeMu.Lock()
	defer s.chromeMu.Unlock()
	var req chromeActionReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<14))
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
		return
	}
	switch strings.ToLower(strings.TrimSpace(req.Action)) {
	case "trim":
		n, err := trimAgentChrome()
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "trim", "signaled": n})
	case "restart":
		n, err := restartAgentChrome()
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "action": "restart", "signaled": n, "restarted": true})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "action must be trim or restart"})
	}
}

func collectResources() (resourcesResp, error) {
	host, err := readHostResources()
	if err != nil {
		return resourcesResp{}, err
	}
	groups, agent := chromeResources()
	return resourcesResp{Host: host, Chrome: groups, Agent: agent}, nil
}

type cpuSample struct {
	total uint64
	idle  uint64
}

func readCPUSample() (cpuSample, error) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuSample{}, err
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	fields := strings.Fields(line)
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuSample{}, fmt.Errorf("unexpected /proc/stat")
	}
	vals := make([]uint64, 0, 8)
	for i := 1; i < len(fields) && i <= 8; i++ {
		v, err := strconv.ParseUint(fields[i], 10, 64)
		if err != nil {
			return cpuSample{}, err
		}
		vals = append(vals, v)
	}
	if len(vals) < 4 {
		return cpuSample{}, fmt.Errorf("incomplete cpu counters")
	}
	var total uint64
	for _, v := range vals {
		total += v
	}
	idle := vals[3]
	if len(vals) > 4 {
		idle += vals[4]
	}
	return cpuSample{total: total, idle: idle}, nil
}

func readHostResources() (hostResources, error) {
	a, err := readCPUSample()
	if err != nil {
		return hostResources{}, err
	}
	time.Sleep(120 * time.Millisecond)
	b, err := readCPUSample()
	if err != nil {
		return hostResources{}, err
	}
	totalDelta := b.total - a.total
	idleDelta := b.idle - a.idle
	usedPct := 0.0
	if totalDelta > 0 && idleDelta <= totalDelta {
		usedPct = 100 * float64(totalDelta-idleDelta) / float64(totalDelta)
	}
	cores := runtime.NumCPU()
	usedCores := float64(cores) * usedPct / 100

	mem, err := readMemInfo()
	if err != nil {
		return hostResources{}, err
	}
	total := mem["MemTotal"] * 1024
	available := mem["MemAvailable"] * 1024
	if available > total {
		available = total
	}
	used := total - available
	swapTotal := mem["SwapTotal"] * 1024
	swapFree := mem["SwapFree"] * 1024
	if swapFree > swapTotal {
		swapFree = swapTotal
	}
	return hostResources{
		CPUUsedPercent:      usedPct,
		CPUAvailablePercent: 100 - usedPct,
		CPUUsedCores:        usedCores,
		CPUAvailableCores:   float64(cores) - usedCores,
		CPUTotalCores:       cores,
		RAMUsedBytes:        used,
		RAMAvailableBytes:   available,
		RAMTotalBytes:       total,
		SwapUsedBytes:       swapTotal - swapFree,
		SwapTotalBytes:      swapTotal,
		NoSwap:              swapTotal == 0,
	}, nil
}

func readMemInfo() (map[string]uint64, error) {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	out := map[string]uint64{}
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		switch key {
		case "MemTotal", "MemAvailable", "SwapTotal", "SwapFree":
			v, err := strconv.ParseUint(fields[1], 10, 64)
			if err == nil {
				out[key] = v
			}
		}
	}
	if out["MemTotal"] == 0 {
		return nil, fmt.Errorf("MemTotal missing from /proc/meminfo")
	}
	return out, nil
}

type procInfo struct {
	PID         int
	PPID        int
	RSSBytes    uint64
	Args        []string
	Display     string
	Profile     string
	ProfilePath string
}

type chromeGroup struct {
	Display     string
	Profile     string
	ProfilePath string
	Procs       map[int]procInfo
	Roots       map[int]procInfo
}

func readChromeProc(pid int) (procInfo, bool) {
	base := filepath.Join("/proc", strconv.Itoa(pid))
	args := splitNULFile(filepath.Join(base, "cmdline"))
	if len(args) == 0 || !isChromeExecutable(args[0]) {
		return procInfo{}, false
	}
	ppid, rss := readProcStatus(filepath.Join(base, "status"))
	display := ""
	for _, e := range splitNULFile(filepath.Join(base, "environ")) {
		if strings.HasPrefix(e, "DISPLAY=") {
			display = strings.TrimPrefix(e, "DISPLAY=")
			break
		}
	}
	profile, profilePath, _ := profileFromArgs(args)
	return procInfo{PID: pid, PPID: ppid, RSSBytes: rss, Args: args, Display: display, Profile: profile, ProfilePath: profilePath}, true
}

func splitNULFile(path string) []string {
	b, err := os.ReadFile(path)
	if err != nil || len(b) == 0 {
		return nil
	}
	parts := strings.Split(string(b), "\x00")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func readProcStatus(path string) (int, uint64) {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0, 0
	}
	ppid := 0
	var rss uint64
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		switch strings.TrimSuffix(fields[0], ":") {
		case "PPid":
			ppid, _ = strconv.Atoi(fields[1])
		case "VmRSS":
			v, _ := strconv.ParseUint(fields[1], 10, 64)
			rss = v * 1024
		}
	}
	return ppid, rss
}

func isChromeExecutable(v string) bool {
	name := strings.ToLower(filepath.Base(v))
	return strings.Contains(name, "chrome") || strings.Contains(name, "chromium")
}

func procType(args []string) string {
	for _, a := range args {
		if strings.HasPrefix(a, "--type=") {
			return strings.TrimPrefix(a, "--type=")
		}
	}
	return ""
}

func profileFromArgs(args []string) (string, string, string) {
	path := ""
	for i, a := range args {
		switch {
		case strings.HasPrefix(a, "--user-data-dir="):
			path = strings.TrimPrefix(a, "--user-data-dir=")
		case a == "--user-data-dir" && i+1 < len(args):
			path = args[i+1]
		}
		if path != "" {
			break
		}
	}
	if path == "" {
		return "", "", ""
	}
	name := filepath.Base(filepath.Clean(path))
	n, ok := profileNumber(name)
	if !ok {
		return "", "", ""
	}
	return name, path, n
}

func profileNumber(name string) (string, bool) {
	const prefix = "chrome-profile-"
	if !strings.HasPrefix(name, prefix) {
		return "", false
	}
	n := strings.TrimPrefix(name, prefix)
	if n == "" {
		return "", false
	}
	for _, r := range n {
		if r < '0' || r > '9' {
			return "", false
		}
	}
	return n, true
}

func displayNumber(display string) (string, bool) {
	display = strings.TrimSpace(display)
	if !strings.HasPrefix(display, ":") {
		return "", false
	}
	n := strings.TrimPrefix(display, ":")
	if dot := strings.IndexByte(n, '.'); dot >= 0 {
		n = n[:dot]
	}
	if n == "" {
		return "", false
	}
	for _, r := range n {
		if r < '0' || r > '9' {
			return "", false
		}
	}
	return n, true
}

func normalizeDisplay(display string) string {
	n, ok := displayNumber(display)
	if !ok {
		return ""
	}
	return ":" + n
}

func scanChromeGroups() map[string]*chromeGroup {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return map[string]*chromeGroup{}
	}
	procs := map[int]procInfo{}
	children := map[int][]int{}
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid <= 0 {
			continue
		}
		p, ok := readChromeProc(pid)
		if !ok {
			continue
		}
		procs[pid] = p
		children[p.PPID] = append(children[p.PPID], pid)
	}
	groups := map[string]*chromeGroup{}
	for _, root := range procs {
		profile, profilePath, n := profileFromArgs(root.Args)
		if profile == "" || procType(root.Args) != "" {
			continue
		}
		display := normalizeDisplay(root.Display)
		if display == "" || display != ":"+n {
			continue
		}
		key := display + "|" + profile
		g := groups[key]
		if g == nil {
			g = &chromeGroup{Display: display, Profile: profile, ProfilePath: profilePath, Procs: map[int]procInfo{}, Roots: map[int]procInfo{}}
			groups[key] = g
		}
		g.Roots[root.PID] = root
		stack := []int{root.PID}
		seen := map[int]bool{}
		for len(stack) > 0 {
			pid := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			if seen[pid] {
				continue
			}
			seen[pid] = true
			p, ok := procs[pid]
			if !ok {
				continue
			}
			pd := normalizeDisplay(p.Display)
			if pd != "" && pd != display {
				continue
			}
			g.Procs[pid] = p
			for _, child := range children[pid] {
				stack = append(stack, child)
			}
		}
	}
	return groups
}

func chromeResources() ([]chromeDisplayInfo, agentChromeInfo) {
	groups := scanChromeGroups()
	agentDisplay := normalizeDisplay(os.Getenv("DISPLAY"))
	agent := agentChromeInfo{Display: agentDisplay, Note: "controls require DISPLAY=:N + matching chrome-profile-N"}
	expectedProfile := ""
	if n, ok := displayNumber(agentDisplay); ok {
		expectedProfile = "chrome-profile-" + n
		agent.Profile = expectedProfile
	}
	out := make([]chromeDisplayInfo, 0, len(groups))
	for _, g := range groups {
		var rss uint64
		for _, p := range g.Procs {
			rss += p.RSSBytes
		}
		isAgent := agentDisplay != "" && g.Display == agentDisplay && g.Profile == expectedProfile
		out = append(out, chromeDisplayInfo{Display: g.Display, Profile: g.Profile, ProfilePath: g.ProfilePath, RSSBytes: rss, ProcessCount: len(g.Procs), ThisAgent: isAgent})
		if isAgent {
			agent.ProfilePath = g.ProfilePath
			agent.RSSBytes = rss
			agent.ProcessCount = len(g.Procs)
			agent.Mutable = true
			agent.Note = "trim/restart locked to this DISPLAY + profile; other agents are read-only"
		}
	}
	sort.Slice(out, func(i, j int) bool {
		ni, _ := displayNumber(out[i].Display)
		nj, _ := displayNumber(out[j].Display)
		ai, _ := strconv.Atoi(ni)
		aj, _ := strconv.Atoi(nj)
		return ai < aj
	})
	return out, agent
}

func ownChromeGroup() (*chromeGroup, error) {
	display := normalizeDisplay(os.Getenv("DISPLAY"))
	n, ok := displayNumber(display)
	if !ok {
		return nil, fmt.Errorf("DISPLAY must be :N before Chrome controls are enabled")
	}
	profile := "chrome-profile-" + n
	g := scanChromeGroups()[display+"|"+profile]
	if g == nil {
		return nil, fmt.Errorf("no Chrome group matches %s + %s", display, profile)
	}
	return g, nil
}

func signalOwnedChrome(pid int, sig syscall.Signal) bool {
	g, err := ownChromeGroup()
	if err != nil {
		return false
	}
	if _, ok := g.Procs[pid]; !ok {
		return false
	}
	return syscall.Kill(pid, sig) == nil
}

func trimAgentChrome() (int, error) {
	g, err := ownChromeGroup()
	if err != nil {
		return 0, err
	}
	pids := make([]int, 0)
	for pid, p := range g.Procs {
		if procType(p.Args) == "renderer" {
			pids = append(pids, pid)
		}
	}
	sort.Ints(pids)
	signaled := 0
	for _, pid := range pids {
		if signalOwnedChrome(pid, syscall.SIGTERM) {
			signaled++
		}
	}
	return signaled, nil
}

func restartAgentChrome() (int, error) {
	g, err := ownChromeGroup()
	if err != nil {
		return 0, err
	}
	rootPIDs := make([]int, 0, len(g.Roots))
	var command []string
	for pid, p := range g.Roots {
		if procType(p.Args) != "" || len(p.Args) == 0 {
			continue
		}
		rootPIDs = append(rootPIDs, pid)
		if command == nil {
			command = append([]string(nil), p.Args...)
		}
	}
	if len(rootPIDs) == 0 || len(command) == 0 {
		return 0, fmt.Errorf("this agent has no restartable Chrome browser process")
	}
	sort.Ints(rootPIDs)
	signaled := 0
	for _, pid := range rootPIDs {
		if signalOwnedChrome(pid, syscall.SIGTERM) {
			signaled++
		}
	}
	if signaled == 0 {
		return 0, fmt.Errorf("Chrome ownership changed before restart; nothing was signaled")
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := ownChromeGroup(); err != nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if _, err := ownChromeGroup(); err == nil {
		return signaled, fmt.Errorf("this agent's Chrome did not exit cleanly; refusing broader signals")
	}
	cmd := exec.Command(command[0], command[1:]...)
	cmd.Env = os.Environ()
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		return signaled, fmt.Errorf("Chrome stopped but restart failed: %w", err)
	}
	_ = cmd.Process.Release()
	return signaled, nil
}
