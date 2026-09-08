package main

import (
	"net/http"
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Documented vault slots under $HOME/.config/maxq (metadata only — never values).
var vaultSlotSpecs = []struct {
	Rel  string
	Kind string
	Note string
}{
	{"ca/maxq-ca.key", "tls-key", "MaxQ local CA private key"},
	{"ca/maxq-ca.pem", "tls-cert", "MaxQ local CA certificate (PEM)"},
	{"ca/maxq-ca.der", "tls-cert", "MaxQ local CA certificate (DER)"},
	{"ssh/hostkeys/ssh_host_ed25519_key", "ssh-host-key", "SSH host ed25519 private key"},
	{"ssh/hostkeys/ssh_host_rsa_key", "ssh-host-key", "SSH host RSA private key"},
	{"ssh/root_authorized_keys", "authorized-keys", "Authorized public keys for root SSH"},
	{"ssh/sshd_config", "config", "Managed sshd snippet"},
	{"hooks.toml", "hook-secret", "Trigger webhook destination (sensitive)"},
	{"triggers.json", "config", "Trigger registry"},
	{"desktop/key-saved", "desktop-key", "Saved desktop key slot"},
	{"desktop/key-prev", "desktop-key", "Previous desktop key slot"},
	{"defaults.toml", "config", "Operator AI/site defaults"},
	{"api.toml", "config", "API bind / public flags"},
	{"maxq.toml", "config", "MaxQ core config"},
}

type vaultSlot struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Kind     string    `json:"kind"`
	Note     string    `json:"note,omitempty"`
	Present  bool      `json:"present"`
	Mode     string    `json:"mode,omitempty"`
	Size     int64     `json:"size,omitempty"`
	Modified time.Time `json:"modified,omitempty"`
	Age      string    `json:"age,omitempty"`
	Masked   bool      `json:"masked"`
	Secret   bool      `json:"secret"`
}

type vaultResponse struct {
	Root      string      `json:"root"`
	Slots     []vaultSlot `json:"slots"`
	Count     int         `json:"count"`
	Present   int         `json:"present"`
	ReadOnly  bool        `json:"read_only"`
	Generated time.Time   `json:"generated_at"`
	Note      string      `json:"note"`
}

type skillCard struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	When        string    `json:"when,omitempty"`
	Excerpt     string    `json:"excerpt,omitempty"`
	Path        string    `json:"path"`
	HasAgents   bool      `json:"has_agents"`
	HasSkillMD  bool      `json:"has_skill_md"`
	Modified    time.Time `json:"modified,omitempty"`
	Age         string    `json:"age,omitempty"`
}

type skillsResponse struct {
	Root      string      `json:"root"`
	Skills    []skillCard `json:"skills"`
	Count     int         `json:"count"`
	ReadOnly  bool        `json:"read_only"`
	Generated time.Time   `json:"generated_at"`
}

type handoffStep struct {
	N    int    `json:"n"`
	Title string `json:"title"`
	Body string `json:"body"`
}

type handoffDesktopBrief struct {
	Live        int `json:"live"`
	Total       int `json:"total"`
	ViewerReady int `json:"viewer_ready"`
	Suspended   int `json:"suspended_count"`
}

type handoffSessionBrief struct {
	Total              int `json:"total"`
	SignedIn           int `json:"signed_in"`
	SessionDataPresent int `json:"session_data_present"`
}

type handoffResponse struct {
	Flow      []handoffStep         `json:"flow"`
	Desktops  handoffDesktopBrief   `json:"desktops"`
	Sessions  handoffSessionBrief   `json:"sessions"`
	ReadOnly  bool                  `json:"read_only"`
	Generated time.Time             `json:"generated_at"`
	Links     map[string]string     `json:"links"`
}

func handleStubVault(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		stubWriteMethodNotAllowed(w, http.MethodGet)
		return
	}

	home, homeReal, err := canonicalHome()
	if err != nil {
		stubWriteJSONError(w, http.StatusInternalServerError, "home directory is unavailable")
		return
	}

	maxqRel := ".config/maxq"
	maxqRoot, ok := safeKnownPath(home, homeReal, maxqRel)
	if !ok {
		stubWriteJSONError(w, http.StatusInternalServerError, "maxq config root unavailable")
		return
	}

	now := time.Now().UTC()
	slots := make([]vaultSlot, 0, len(vaultSlotSpecs))
	present := 0

	for _, spec := range vaultSlotSpecs {
		abs := filepath.Join(maxqRoot, filepath.FromSlash(spec.Rel))
		slot := vaultSlot{
			Name:    filepath.Base(spec.Rel),
			Path:    "$HOME/" + maxqRel + "/" + spec.Rel,
			Kind:    spec.Kind,
			Note:    spec.Note,
			Masked:  true,
			Secret:  isVaultSecretKind(spec.Kind),
			Present: false,
		}

		info, err := os.Lstat(abs)
		if err == nil {
			slot.Present = true
			present++
			slot.Mode = fmt.Sprintf("%04o", info.Mode().Perm())
			if info.Mode().IsRegular() {
				slot.Size = info.Size()
			}
			slot.Modified = info.ModTime().UTC()
			slot.Age = humanAge(now, slot.Modified)
		}
		slots = append(slots, slot)
	}

	sort.SliceStable(slots, func(i, j int) bool {
		if slots[i].Present != slots[j].Present {
			return slots[i].Present
		}
		return slots[i].Path < slots[j].Path
	})

	stubWriteJSON(w, http.StatusOK, vaultResponse{
		Root:      "$HOME/" + maxqRel,
		Slots:     slots,
		Count:     len(slots),
		Present:   present,
		ReadOnly:  true,
		Generated: now,
		Note:      "Metadata only. Secret values are never returned.",
	})
}

func handleStubSkills(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		stubWriteMethodNotAllowed(w, http.MethodGet)
		return
	}

	home, homeReal, err := canonicalHome()
	if err != nil {
		stubWriteJSONError(w, http.StatusInternalServerError, "home directory is unavailable")
		return
	}

	rel := ".config/maxq/skills"
	skillsRoot, ok := safeKnownPath(home, homeReal, rel)
	if !ok {
		stubWriteJSON(w, http.StatusOK, skillsResponse{
			Root:      "$HOME/" + rel,
			Skills:    []skillCard{},
			Count:     0,
			ReadOnly:  true,
			Generated: time.Now().UTC(),
		})
		return
	}

	entries, err := os.ReadDir(skillsRoot)
	if err != nil {
		stubWriteJSONError(w, http.StatusInternalServerError, "unable to list skills directory")
		return
	}

	now := time.Now().UTC()
	cards := make([]skillCard, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		dir := filepath.Join(skillsRoot, entry.Name())
		info, err := entry.Info()
		mod := time.Time{}
		if err == nil {
			mod = info.ModTime().UTC()
		}

		card := skillCard{
			Name:       entry.Name(),
			Path:       "$HOME/" + rel + "/" + entry.Name(),
			HasAgents:  fileIsDir(filepath.Join(dir, "agents")),
			HasSkillMD: stubFileExists(filepath.Join(dir, "SKILL.md")),
			Modified:   mod,
			Age:        humanAge(now, mod),
		}

		if card.HasSkillMD {
			name, desc, when, excerpt := parseSkillMarkdown(filepath.Join(dir, "SKILL.md"))
			if name != "" {
				card.Name = name
			}
			card.Description = desc
			card.When = when
			card.Excerpt = excerpt
		}
		if card.Description == "" {
			card.Description = "Shared MaxQ skill (no description in SKILL.md)."
		}
		if card.When == "" {
			card.When = skillWhenFromDescription(card.Description)
		}
		cards = append(cards, card)
	}

	sort.SliceStable(cards, func(i, j int) bool {
		return strings.ToLower(cards[i].Name) < strings.ToLower(cards[j].Name)
	})

	stubWriteJSON(w, http.StatusOK, skillsResponse{
		Root:      "$HOME/" + rel,
		Skills:    cards,
		Count:     len(cards),
		ReadOnly:  true,
		Generated: now,
	})
}

func handleStubHandoff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		stubWriteMethodNotAllowed(w, http.MethodGet)
		return
	}

	home, homeReal, err := canonicalHome()
	if err != nil {
		stubWriteJSONError(w, http.StatusInternalServerError, "home directory is unavailable")
		return
	}

	desktops := summarizeLiveDesktops()
	sessions := summarizeSessionsForHandoff(home, homeReal)

	stubWriteJSON(w, http.StatusOK, handoffResponse{
		Flow: []handoffStep{
			{N: 1, Title: "Operator requests auth", Body: "Agent pauses on a login wall and opens Handoff instead of storing credentials."},
			{N: 2, Title: "Pick a live desktop", Body: "Use an isolated Chrome profile on a live MaxQ desktop so the session stays in $HOME."},
			{N: 3, Title: "Complete sign-in", Body: "Operator finishes SSO / MFA in the browser. Secrets stay in the profile cookie jar — never in chat."},
			{N: 4, Title: "Confirm session evidence", Body: "Sessions page shows session-data-present or signed-in. Agent resumes with the handed-off profile."},
		},
		Desktops:  desktops,
		Sessions:  sessions,
		ReadOnly:  true,
		Generated: time.Now().UTC(),
		Links: map[string]string{
			"sessions": "/sessions",
			"desktops": "/desktops",
			"vault":    "/vault",
		},
	})
}

func isVaultSecretKind(kind string) bool {
	switch kind {
	case "tls-key", "ssh-host-key", "hook-secret", "desktop-key", "authorized-keys":
		return true
	default:
		return false
	}
}

func humanAge(now, then time.Time) string {
	if then.IsZero() {
		return ""
	}
	d := now.Sub(then)
	if d < 0 {
		d = 0
	}
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	case d < 60*24*time.Hour:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	default:
		return fmt.Sprintf("%dmo ago", int(d.Hours()/(24*30)))
	}
}

func parseSkillFrontmatter(path string) (name, description string) {
	name, description, _, _ = parseSkillMarkdown(path)
	return name, description
}

func skillWhenFromDescription(desc string) string {
	d := strings.TrimSpace(desc)
	lower := strings.ToLower(d)
	if !strings.HasPrefix(lower, "use when ") {
		return ""
	}
	when := strings.TrimSpace(d[len("use when "):])
	when = strings.TrimRight(when, ".")
	return when
}

func parseSkillMarkdown(path string) (name, description, when, excerpt string) {
	f, err := os.Open(path)
	if err != nil {
		return "", "", "", ""
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 256*1024)
	if !sc.Scan() || strings.TrimSpace(sc.Text()) != "---" {
		return "", "", "", ""
	}

	for sc.Scan() {
		line := sc.Text()
		if strings.TrimSpace(line) == "---" {
			break
		}
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(strings.ToLower(key))
		val = strings.TrimSpace(val)
		val = strings.Trim(val, "\"'")
		switch key {
		case "name":
			name = val
		case "description":
			description = val
		}
	}
	when = skillWhenFromDescription(description)

	var body []string
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			if len(body) > 0 {
				break
			}
			continue
		}
		if strings.HasPrefix(line, "#") {
			continue
		}
		body = append(body, line)
	}
	if len(body) > 0 {
		excerpt = strings.Join(body, " ")
		runes := []rune(excerpt)
		if len(runes) > 220 {
			excerpt = string(runes[:217]) + "…"
		}
	}
	return name, description, when, excerpt
}

func summarizeLiveDesktops() handoffDesktopBrief {
	numbers := discoverDisplayNumbers(x11SocketRoot)
	noted := loadSuspendedSetFile(maxqSuspendedPath())
	live := 0
	ready := 0
	suspended := 0
	for _, n := range numbers {
		// Same suspended source as /desktops system.suspended_count (noted ∪ live SIGSTOP).
		if desktopMarkedSuspended(n, noted) {
			suspended++
		}
		if !desktopLive(x11SocketRoot, n) {
			continue
		}
		live++
		if desktopViewerListening(desktopViewerPort(n)) {
			ready++
		}
	}
	return handoffDesktopBrief{Live: live, Total: len(numbers), ViewerReady: ready, Suspended: suspended}
}

func summarizeSessionsForHandoff(home, homeReal string) handoffSessionBrief {
	brief := handoffSessionBrief{}
	seen := make(map[string]struct{})

	for _, candidate := range chromeRoots {
		root, ok := safeKnownPath(home, homeReal, candidate.Rel)
		if !ok {
			continue
		}
		info, err := os.Stat(root)
		if err != nil || !info.IsDir() {
			continue
		}
		signedInHints := readLocalStateSignedInHints(root)
		rootEntries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, entry := range rootEntries {
			if !entry.IsDir() {
				continue
			}
			profileName := entry.Name()
			profileDir := filepath.Join(root, profileName)
			if !looksLikeChromeProfile(profileName, profileDir) {
				continue
			}
			key := filepath.Clean(profileDir)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			brief.Total++
			if signedInHints[profileName] || preferencesIndicateSignedIn(filepath.Join(profileDir, "Preferences")) {
				brief.SignedIn++
			}
			if hasNonEmptyCookieStore(profileDir) {
				brief.SessionDataPresent++
			}
		}
	}

	for _, session := range discoverIsolatedChromeProfiles(home, homeReal) {
		if _, exists := seen[session.Path]; exists {
			continue
		}
		seen[session.Path] = struct{}{}
		brief.Total++
		if session.SignedIn {
			brief.SignedIn++
		}
		if session.SessionDataPresent {
			brief.SessionDataPresent++
		}
	}

	return brief
}

// silence unused import if strconv unused — used? keep for future; remove if unused
