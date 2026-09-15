package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

func displayFromEnviron(pid int) int {
	raw, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/environ")
	if err != nil {
		return 0
	}
	for _, part := range strings.Split(string(raw), string(rune(0))) {
		if n := displayFromCmdline(part); n >= 1 {
			return n
		}
		if strings.HasPrefix(part, "DISPLAY=:") {
			if n := leadingInt(strings.TrimPrefix(part, "DISPLAY=:")); n >= 1 {
				return n
			}
		}
	}
	return 0
}

func pidsForDisplay(n int) []int {
	if n < 1 {
		return nil
	}
	ents, err := os.ReadDir("/proc")
	if err != nil {
		return nil
	}
	self := os.Getpid()
	out := make([]int, 0)
	for _, e := range ents {
		name := e.Name()
		if name == "" || name[0] < '0' || name[0] > '9' {
			continue
		}
		pid, err := strconv.Atoi(name)
		if err != nil || pid == self {
			continue
		}
		raw, err := os.ReadFile("/proc/" + name + "/cmdline")
		if err != nil || len(raw) == 0 {
			continue
		}
		cmd := strings.ReplaceAll(string(raw), string(rune(0)), " ")
		if strings.Contains(cmd, "maxq-api") || strings.Contains(cmd, "chrome_crashpad") {
			continue
		}
		got := displayFromCmdline(cmd)
		if got == 0 {
			got = displayFromEnviron(pid)
		}
		if got != n {
			continue
		}
		out = append(out, pid)
	}
	return out
}

func procStopped(pid int) bool {
	b, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/stat")
	if err != nil {
		return false
	}
	s := string(b)
	i := strings.LastIndexByte(s, ')')
	if i < 0 || i+2 >= len(s) {
		return false
	}
	fields := strings.Fields(s[i+2:])
	return len(fields) > 0 && fields[0] == "T"
}

func displaySuspended(n int) bool {
	pids := pidsForDisplay(n)
	if len(pids) == 0 {
		return false
	}
	stopped := 0
	for _, pid := range pids {
		if procStopped(pid) {
			stopped++
		}
	}
	return stopped*2 >= len(pids)
}

func signalDisplay(n int, sig syscall.Signal) (int, error) {
	pids := pidsForDisplay(n)
	if len(pids) == 0 {
		return 0, fmt.Errorf("no processes for :%d", n)
	}
	ok := 0
	for _, pid := range pids {
		if err := syscall.Kill(pid, sig); err != nil {
			continue
		}
		ok++
	}
	if ok == 0 {
		return 0, fmt.Errorf("signal %s failed on :%d", sig, n)
	}
	return ok, nil
}

func (s *server) guardDesktopControl(n int) error {
	if n < 2 {
		return fmt.Errorf("refusing to control primary desktop :%d", n)
	}
	cur := displayNumber(os.Getenv("DISPLAY"))
	if cur > 0 && n == cur {
		return fmt.Errorf("refusing to control the current desktop :%d", n)
	}
	return nil
}

func (s *server) handleDesktopSuspend(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad display"})
		return
	}
	if err := s.guardDesktopControl(n); err != nil {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	count, err := signalDisplay(n, syscall.SIGSTOP)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	s.noteSuspended(n, true)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "display": n, "signaled": count, "suspended": true})
}

func (s *server) resumeDesktop(n int) (int, error) {
	if err := s.guardDesktopControl(n); err != nil {
		return 0, err
	}
	count, err := signalDisplay(n, syscall.SIGCONT)
	if err != nil {
		return 0, err
	}
	s.noteSuspended(n, false)
	return count, nil
}

func (s *server) handleDesktopResume(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad display"})
		return
	}
	count, err := s.resumeDesktop(n)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "display": n, "signaled": count, "suspended": false})
}

type resumePausedResult struct {
	ResumedCount int      `json:"resumed_count"`
	Signaled     int      `json:"signaled"`
	Skipped      []string `json:"skipped,omitempty"`
	Errors       []string `json:"errors,omitempty"`
}

// resumePausedDesktops SIGCONTs live desks marked suspended, skipping the
// current agent display (and other guardDesktopControl refusals).
func (s *server) resumePausedDesktops() resumePausedResult {
	var out resumePausedResult
	for _, d := range s.desktops().Desktops {
		if !d.Suspended {
			continue
		}
		if d.Current {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d current", d.Number))
			continue
		}
		if !d.Live {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d not live", d.Number))
			continue
		}
		count, err := s.resumeDesktop(d.Number)
		if err != nil {
			out.Errors = append(out.Errors, fmt.Sprintf(":%d %v", d.Number, err))
			continue
		}
		out.ResumedCount++
		out.Signaled += count
	}
	return out
}

type freezeQuietResult struct {
	FrozenCount int      `json:"frozen_count"`
	Signaled    int      `json:"signaled"`
	Skipped     []string `json:"skipped,omitempty"`
	Errors      []string `json:"errors,omitempty"`
}

// freezeQuietDesktops SIGSTOPs live non-current desks that look idle/quiet
 // (not busy). Never touches the current agent display, primary :1, or already
 // suspended desks. Manual Action only — do not auto-fire overnight.
func (s *server) freezeQuietDesktops() freezeQuietResult {
	var out freezeQuietResult
	for _, d := range s.desktops().Desktops {
		if !d.Live {
			continue
		}
		if d.Current {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d current", d.Number))
			continue
		}
		if d.Suspended {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d already frozen", d.Number))
			continue
		}
		act := strings.ToLower(d.Activity)
		if act == "busy" {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d busy", d.Number))
			continue
		}
		if act != "idle" && act != "quiet" && act != "paused" {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d activity=%s", d.Number, d.Activity))
			continue
		}
		if err := s.guardDesktopControl(d.Number); err != nil {
			out.Skipped = append(out.Skipped, fmt.Sprintf(":%d %v", d.Number, err))
			continue
		}
		count, err := signalDisplay(d.Number, syscall.SIGSTOP)
		if err != nil {
			out.Errors = append(out.Errors, fmt.Sprintf(":%d %v", d.Number, err))
			continue
		}
		s.noteSuspended(d.Number, true)
		out.FrozenCount++
		out.Signaled += count
	}
	return out
}

func (s *server) suspendedPath() string {
	return filepath.Join(s.config, "suspended.json")
}

func (s *server) noteSuspended(n int, on bool) {
	set := s.loadSuspendedSet()
	if on {
		set[n] = true
	} else {
		delete(set, n)
	}
	nums := make([]int, 0, len(set))
	for k := range set {
		nums = append(nums, k)
	}
	b, err := json.MarshalIndent(nums, "", "  ")
	if err != nil {
		return
	}
	_ = os.MkdirAll(s.config, 0o700)
	_ = os.WriteFile(s.suspendedPath(), append(b, '\n'), 0o600)
}

func (s *server) loadSuspendedSet() map[int]bool {
	return loadSuspendedSetFile(s.suspendedPath())
}

// loadSuspendedSetFile reads the same suspended.json shape used by desktops telemetry.
func loadSuspendedSetFile(path string) map[int]bool {
	out := map[int]bool{}
	if path == "" {
		return out
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return out
	}
	var nums []int
	if json.Unmarshal(b, &nums) != nil {
		return out
	}
	for _, n := range nums {
		if n >= 2 {
			out[n] = true
		}
	}
	return out
}

func maxqSuspendedPath() string {
	prefix := os.Getenv("MAXQ_HOME")
	if prefix == "" {
		prefix = os.Getenv("HOME")
	}
	if prefix == "" {
		return ""
	}
	return filepath.Join(prefix, ".config", "maxq", "suspended.json")
}

// desktopMarkedSuspended matches applyDesktopSuspended: live SIGSTOP or noted in suspended.json.
func desktopMarkedSuspended(n int, noted map[int]bool) bool {
	return displaySuspended(n) || noted[n]
}

func (s *server) applyDesktopSuspended(items []xvfbDesktop) {
	noted := s.loadSuspendedSet()
	for i := range items {
		n := items[i].Number
		liveStop := displaySuspended(n)
		items[i].Suspended = liveStop || noted[n]
		if items[i].Suspended && items[i].Activity != "idle" {
			items[i].Activity = "paused"
		}
	}
}
