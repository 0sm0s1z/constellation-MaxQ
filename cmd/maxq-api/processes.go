package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

const processCmdMax = 120
const processListLimit = 200

type processInfo struct {
	PID       int     `json:"pid"`
	User      string  `json:"user"`
	CPUPct    float64 `json:"cpu_pct"`
	MemPct    float64 `json:"mem_pct"`
	Command   string  `json:"command"`
	MaxQOwned bool    `json:"maxq_owned"`
	Protected bool    `json:"protected"`
	Stoppable bool    `json:"stoppable"`
}

type processListResp struct {
	OK                bool          `json:"ok"`
	Count             int           `json:"count"`
	SelfPID           int           `json:"self_pid"`
	Processes         []processInfo `json:"processes"`
	RAMPercent        float64       `json:"ram_percent"`
	RAMUsedBytes      uint64        `json:"ram_used_bytes"`
	RAMTotalBytes     uint64        `json:"ram_total_bytes"`
	RAMAvailableBytes uint64        `json:"ram_available_bytes"`
	SwapTotalBytes    uint64        `json:"swap_total_bytes"`
	SwapFreeBytes     uint64        `json:"swap_free_bytes"`
	SwapEnabled       bool          `json:"swap_enabled"`
	SwapNote          string        `json:"swap_note,omitempty"`
	ActionsURL        string        `json:"actions_url"`
}

type processStopReq struct {
	Confirm      bool `json:"confirm"`
	ConfirmForce bool `json:"confirm_force"`
}

func truncateCmd(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if n <= 0 || len(s) <= n {
		return s
	}
	if n <= 3 {
		return s[:n]
	}
	return s[:n-1] + "…"
}

func isMaxQOwned(cmd string) bool {
	c := strings.ToLower(cmd)
	switch {
	case strings.Contains(c, "maxq-api"):
		return true
	case strings.Contains(c, "/bin/maxq") || strings.Contains(c, " bin/maxq") || strings.HasSuffix(c, " maxq") || strings.Contains(c, "/maxq "):
		return true
	case strings.Contains(c, "gost") && (strings.Contains(c, ".config/maxq") || strings.Contains(c, "maxq")):
		return true
	case strings.Contains(c, "chrome-profile") && strings.Contains(c, "maxq"):
		return true
	case strings.Contains(c, "xvfb") && strings.Contains(c, "chrome-profile"):
		return true
	}
	return false
}

func isProtectedProcess(pid int, cmd string) bool {
	if pid == os.Getpid() || pid <= 1 {
		return true
	}
	c := strings.ToLower(cmd)
	deny := []string{
		"maxq-api",
		"/bin/gost",
		" gost ",
		"gost -",
		"xvfb",
		"chrome-profile",
		"--user-data-dir=",
	}
	for _, d := range deny {
		if strings.Contains(c, d) {
			// Allow generic chrome without chrome-profile / user-data under maxq paths later;
			// hard-block Xvfb, maxq-api, gost, and any chrome-profile path.
			if d == "--user-data-dir=" {
				if strings.Contains(c, "chrome-profile") || strings.Contains(c, ".config/maxq") || strings.Contains(c, "/maxq/") {
					return true
				}
				continue
			}
			if d == "gost -" || d == " gost " || d == "/bin/gost" {
				return true
			}
			return true
		}
	}
	// Bare gost binary name
	fields := strings.Fields(c)
	if len(fields) > 0 {
		base := fields[0]
		if strings.HasSuffix(base, "/gost") || base == "gost" {
			return true
		}
		if strings.HasSuffix(base, "/maxq-api") || base == "maxq-api" {
			return true
		}
	}
	return false
}

func listProcesses() ([]processInfo, error) {
	cmd := exec.Command("ps", "-eo", "pid=,user=,pcpu=,pmem=,args=", "--sort=-pcpu")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ps: %w", err)
	}
	self := os.Getpid()
	lines := strings.Split(string(out), "\n")
	procs := make([]processInfo, 0, processListLimit)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil {
			continue
		}
		user := fields[1]
		cpu, _ := strconv.ParseFloat(fields[2], 64)
		mem, _ := strconv.ParseFloat(fields[3], 64)
		rawCmd := strings.Join(fields[4:], " ")
		cmdStr := truncateCmd(rawCmd, processCmdMax)
		owned := isMaxQOwned(rawCmd)
		prot := isProtectedProcess(pid, rawCmd) || pid == self
		procs = append(procs, processInfo{
			PID:       pid,
			User:      user,
			CPUPct:    cpu,
			MemPct:    mem,
			Command:   cmdStr,
			MaxQOwned: owned,
			Protected: prot,
			Stoppable: !prot,
		})
		if len(procs) >= processListLimit {
			break
		}
	}
	return procs, nil
}

func (s *server) handleProcessesAPI(w http.ResponseWriter, r *http.Request) {
	procs, err := listProcesses()
	if err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	mem := readMemSnapshot()
	writeJSON(w, 200, processListResp{
		OK:                true,
		Count:             len(procs),
		SelfPID:           os.Getpid(),
		Processes:         procs,
		RAMPercent:        mem.Percent,
		RAMUsedBytes:      mem.Used,
		RAMTotalBytes:     mem.Total,
		RAMAvailableBytes: mem.Available,
		SwapTotalBytes:    mem.SwapTotal,
		SwapFreeBytes:     mem.SwapFree,
		SwapEnabled:       mem.SwapEnabled,
		SwapNote:          mem.SwapNote,
		ActionsURL:        "/actions",
	})
}

func (s *server) handleProcessStop(w http.ResponseWriter, r *http.Request) {
	pidStr := r.PathValue("pid")
	pid, err := strconv.Atoi(pidStr)
	if err != nil || pid <= 1 {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid pid"})
		return
	}
	var req processStopReq
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if len(body) > 0 {
		if err := json.Unmarshal(body, &req); err != nil {
			writeJSON(w, 400, map[string]any{"ok": false, "error": "invalid json"})
			return
		}
	}
	if !req.Confirm {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "confirm required"})
		return
	}

	cmdline := readProcCmdline(pid)
	if cmdline == "" {
		// Fall back to ps row
		procs, _ := listProcesses()
		for _, p := range procs {
			if p.PID == pid {
				cmdline = p.Command
				break
			}
		}
	}
	if cmdline == "" {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "process not found"})
		return
	}
	if isProtectedProcess(pid, cmdline) {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "protected process", "pid": pid, "command": truncateCmd(cmdline, processCmdMax)})
		return
	}

	sig := syscall.SIGTERM
	if req.ConfirmForce {
		// Still never force-kill protected (already returned). Force = SIGKILL for stoppable only.
		sig = syscall.SIGKILL
	}
	if err := syscall.Kill(pid, sig); err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error(), "pid": pid})
		return
	}
	writeJSON(w, 200, map[string]any{
		"ok":      true,
		"pid":     pid,
		"signal":  sig.String(),
		"command": truncateCmd(cmdline, processCmdMax),
	})
}

func readProcCmdline(pid int) string {
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid))
	if err != nil {
		return ""
	}
	parts := strings.Split(string(b), "\x00")
	out := strings.Join(parts, " ")
	return strings.TrimSpace(out)
}
