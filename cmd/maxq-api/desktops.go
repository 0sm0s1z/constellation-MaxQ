package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const desktopCount = 15

var x11SocketRoot = "/tmp/.X11-unix"

type desktopInfo struct {
	Number     int    `json:"number"`
	Display    string `json:"display"`
	Live       bool   `json:"live"`
	Current    bool   `json:"current"`
	VNC        int    `json:"vnc_port"`
	ViewerPort int    `json:"viewer_port"`
	Token      int    `json:"token,omitempty"`
}

type desktopPrefs struct {
	VisibleCount int `json:"visible_count"`
}

type desktopTelemetry struct {
	CPUPercent     float64 `json:"cpu_percent"`
	RAMPercent     float64 `json:"ram_percent"`
	RAMUsedBytes   uint64  `json:"ram_used_bytes"`
	RAMTotalBytes  uint64  `json:"ram_total_bytes"`
	Load1          float64 `json:"load1"`
	State          string  `json:"state"`
	GostRunning    bool    `json:"gost_running"`
	AgentDisplay   string  `json:"agent_display"`
	LiveCount      int     `json:"live_count"`
	GeneratedAtUTC string  `json:"generated_at_utc"`
}

type desktopsResp struct {
	Desktops   []desktopInfo     `json:"desktops"`
	Preference desktopPrefs      `json:"preference"`
	System     desktopTelemetry  `json:"system"`
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
	if req.VisibleCount < 1 || req.VisibleCount > 6 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "visible_count must be 1..6"})
		return
	}
	if err := s.saveDesktopPrefs(req); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "preference": req})
}

func (s *server) desktops() desktopsResp {
	current := displayNumber(os.Getenv("DISPLAY"))
	items := make([]desktopInfo, 0, desktopCount)
	liveCount := 0
	for n := 1; n <= desktopCount; n++ {
		live := desktopLive(x11SocketRoot, n)
		if live {
			liveCount++
		}
		item := desktopInfo{
			Number:     n,
			Display:    fmt.Sprintf(":%d", n),
			Live:       live,
			Current:    n == current,
			VNC:        5900 + n,
			ViewerPort: 6081,
		}
		if n == 1 {
			item.VNC = 5900
			item.ViewerPort = 6080
		} else {
			item.Token = n
		}
		items = append(items, item)
	}
	st := s.status()
	cpu := cpuPercent()
	ramPct, ramUsed, ramTotal := memoryUsage()
	load1 := loadAverage1()
	agentDisplay := "—"
	if current > 0 {
		agentDisplay = fmt.Sprintf(":%d", current)
	}
	return desktopsResp{
		Desktops: items,
		Preference: s.loadDesktopPrefs(),
		System: desktopTelemetry{
			CPUPercent: cpu,
			RAMPercent: ramPct,
			RAMUsedBytes: ramUsed,
			RAMTotalBytes: ramTotal,
			Load1: load1,
			State: st.State,
			GostRunning: st.Gost.Running,
			AgentDisplay: agentDisplay,
			LiveCount: liveCount,
			GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
		},
	}
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
	if err != nil || out < 1 || out > desktopCount {
		return 0
	}
	return out
}

func desktopLive(root string, n int) bool {
	if n < 1 || n > desktopCount {
		return false
	}
	st, err := os.Stat(filepath.Join(root, "X"+strconv.Itoa(n)))
	return err == nil && !st.IsDir()
}

func (s *server) desktopPrefsPath() string {
	return filepath.Join(s.config, "desktops.json")
}

func (s *server) loadDesktopPrefs() desktopPrefs {
	p := desktopPrefs{VisibleCount: 4}
	b, err := os.ReadFile(s.desktopPrefsPath())
	if err != nil {
		return p
	}
	var got desktopPrefs
	if json.Unmarshal(b, &got) == nil && got.VisibleCount >= 1 && got.VisibleCount <= 6 {
		return got
	}
	return p
}

func (s *server) saveDesktopPrefs(p desktopPrefs) error {
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

func memoryUsage() (percent float64, used, total uint64) {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, 0
	}
	vals := map[string]uint64{}
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		if key != "MemTotal" && key != "MemAvailable" {
			continue
		}
		v, _ := strconv.ParseUint(fields[1], 10, 64)
		vals[key] = v * 1024
	}
	total = vals["MemTotal"]
	avail := vals["MemAvailable"]
	if total == 0 || avail > total {
		return 0, 0, total
	}
	used = total - avail
	percent = float64(used) * 100 / float64(total)
	return percent, used, total
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
