package main

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type listenPolicyInfo struct {
	Mode        string `json:"mode"`
	API         string `json:"api"`
	PortsOpened bool   `json:"ports_opened"`
	Daemon      bool   `json:"daemon"`
}

type stubInfo struct {
	State string `json:"state"`
	Path  string `json:"path"`
	Note  string `json:"note"`
}

type skillsInfo struct {
	State string   `json:"state"`
	Root  string   `json:"root"`
	Packs []string `json:"packs"`
	Note  string   `json:"note"`
}

func settingsSurfaces(prefix, apiListen string) (listenPolicyInfo, stubInfo, stubInfo, skillsInfo) {
	skillRoot := filepath.Join(prefix, ".local", "share", "maxq", "skills")
	return listenPolicyInfo{
		Mode:        "loopback-only",
		API:         apiListen,
		PortsOpened: false,
		Daemon:      false,
	}, stubInfo{
		State: "stub",
		Path:  filepath.Join(prefix, ".config", "maxq", "vault"),
		Note:  "shared bot-account import surface only; no secret ingestion in PLAN 20",
	}, stubInfo{
		State: "stub",
		Path:  filepath.Join(prefix, ".config", "maxq", "oauth"),
		Note:  "Grok Build / similar CLI connection surface only; no live OAuth app invented",
	}, skillsInfo{
		State: "stub",
		Root:  skillRoot,
		Packs: listSkillPacks(skillRoot),
		Note:  "list/enable/edit surface only; PLAN 24-28 bodies remain out of scope",
	}
}

func listSkillPacks(root string) []string {
	entries, err := os.ReadDir(root)
	if err != nil {
		return []string{}
	}
	packs := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
			packs = append(packs, entry.Name())
		}
	}
	sort.Strings(packs)
	return packs
}

func sanitizeProxyListen(v string) (string, error) {
	v = strings.TrimSpace(v)
	host, port, err := net.SplitHostPort(v)
	if err != nil {
		return "", fmt.Errorf("proxy listen must be host:port")
	}
	if host == "localhost" {
		host = "127.0.0.1"
	}
	if host != "127.0.0.1" {
		return "", fmt.Errorf("proxy listen must stay on 127.0.0.1")
	}
	p, err := strconv.Atoi(port)
	if err != nil || p < 1 || p > 65535 {
		return "", fmt.Errorf("proxy listen port must be 1-65535")
	}
	return net.JoinHostPort(host, strconv.Itoa(p)), nil
}

func setTomlSectionString(path, section, key, value string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("settings unavailable: %w", err)
	}
	lines := strings.Split(string(b), "\n")
	inSection := false
	found := false
	for i, line := range lines {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "[") && strings.HasSuffix(trim, "]") {
			inSection = strings.TrimSpace(trim[1:len(trim)-1]) == section
			continue
		}
		if !inSection || trim == "" || strings.HasPrefix(trim, "#") {
			continue
		}
		name, _, ok := strings.Cut(trim, "=")
		if ok && strings.TrimSpace(name) == key {
			lines[i] = key + " = " + strconv.Quote(value)
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("settings key [%s].%s not found", section, key)
	}
	mode := os.FileMode(0644)
	if st, err := os.Stat(path); err == nil {
		mode = st.Mode().Perm()
	}
	tmp := path + ".api-tmp"
	if err := os.WriteFile(tmp, []byte(strings.Join(lines, "\n")), mode); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}
