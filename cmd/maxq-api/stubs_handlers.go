package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const maxPreferencesBytes = 4 << 20

type filesResponse struct {
	Root      string      `json:"root"`
	Path      string      `json:"path"`
	Parent    *string     `json:"parent"`
	Entries   []fileEntry `json:"entries"`
	Filtered  int         `json:"filtered"`
	ReadOnly  bool        `json:"read_only"`
	Generated time.Time   `json:"generated_at"`
}

type fileEntry struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Kind       string    `json:"kind"`
	Size       int64     `json:"size"`
	Modified   time.Time `json:"modified"`
	Hidden     bool      `json:"hidden"`
	Restricted bool      `json:"restricted"`
	Navigable  bool      `json:"navigable"`
}

type sessionsResponse struct {
	Sessions  []browserSession `json:"sessions"`
	ReadOnly  bool             `json:"read_only"`
	Generated time.Time        `json:"generated_at"`
}

type browserSession struct {
	Browser            string `json:"browser"`
	Profile            string `json:"profile"`
	Path               string `json:"path"`
	AuthState          string `json:"auth_state"`
	SignedIn           bool   `json:"signed_in"`
	SessionDataPresent bool   `json:"session_data_present"`
	LastActive         string `json:"last_active,omitempty"`
}

type browserRoot struct {
	Name string
	Rel  string
}

var sensitivePathPrefixes = []string{
	".ssh",
	".gnupg",
	".aws",
	".azure",
	".kube",
	".docker",
	".password-store",
	".local/share/keyrings",
	".config/gcloud",
	".config/gh",
	".config/op",
	".config/1password",
	".config/stripe",
	".config/rclone",
	"Library/Keychains",
}

var exactSensitiveNames = map[string]struct{}{
	".netrc":           {},
	".npmrc":           {},
	".pypirc":          {},
	".git-credentials": {},
	"credentials":      {},
	"credentials.json": {},
	"secrets.json":     {},
	"secrets.yaml":     {},
	"secrets.yml":      {},
	"id_rsa":           {},
	"id_ed25519":       {},
}

var chromeRoots = []browserRoot{
	{Name: "Chrome", Rel: ".config/google-chrome"},
	{Name: "Chrome Beta", Rel: ".config/google-chrome-beta"},
	{Name: "Chromium", Rel: ".config/chromium"},
	{Name: "Brave", Rel: ".config/BraveSoftware/Brave-Browser"},
	{Name: "Brave", Rel: ".config/brave-browser"},
	{Name: "Microsoft Edge", Rel: ".config/microsoft-edge"},
	{Name: "Chrome", Rel: "Library/Application Support/Google/Chrome"},
	{Name: "Chrome Beta", Rel: "Library/Application Support/Google/Chrome Beta"},
	{Name: "Chromium", Rel: "Library/Application Support/Chromium"},
	{Name: "Brave", Rel: "Library/Application Support/BraveSoftware/Brave-Browser"},
	{Name: "Microsoft Edge", Rel: "Library/Application Support/Microsoft Edge"},
}

// RegisterStubRoutes installs the read-only operator-glass endpoints.
//
// Call this once from the existing API bootstrap:
//
//	RegisterStubRoutes(mux)
//
// The handlers intentionally expose only metadata. Files are never read by the
// Files endpoint, and the Sessions endpoint never returns cookie contents,
// account identifiers, emails, tokens, or credential values.
func RegisterStubRoutes(mux *http.ServeMux) {
	if mux == nil {
		panic("RegisterStubRoutes: nil ServeMux")
	}

	mux.HandleFunc("/api/stubs/files", handleStubFiles)
	mux.HandleFunc("/api/stubs/sessions", handleStubSessions)
	mux.HandleFunc("/api/stubs/vault", handleStubVault)
	mux.HandleFunc("/api/stubs/skills", handleStubSkills)
	mux.HandleFunc("/api/stubs/handoff", handleStubHandoff)
}

func handleStubFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		stubWriteMethodNotAllowed(w, http.MethodGet)
		return
	}

	stubSetJSONHeaders(w)

	home, homeReal, err := canonicalHome()
	if err != nil {
		stubWriteJSONError(w, http.StatusInternalServerError, "home directory is unavailable")
		return
	}

	requested := strings.TrimSpace(r.URL.Query().Get("path"))
	relative, absolute, err := resolveSafeHomeDirectory(home, homeReal, requested)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, os.ErrNotExist) {
			status = http.StatusNotFound
		}
		stubWriteJSONError(w, status, err.Error())
		return
	}

	dirEntries, err := os.ReadDir(absolute)
	if err != nil {
		if errors.Is(err, os.ErrPermission) {
			stubWriteJSONError(w, http.StatusForbidden, "directory is not readable")
			return
		}
		stubWriteJSONError(w, http.StatusInternalServerError, "unable to enumerate directory")
		return
	}

	entries := make([]fileEntry, 0, len(dirEntries))
	filtered := 0

	for _, dirEntry := range dirEntries {
		name := dirEntry.Name()
		childRel := joinSlash(relative, name)

		if isSensitiveFileName(name) {
			filtered++
			continue
		}

		restricted := isRestrictedRelative(childRel)

		info, err := dirEntry.Info()
		if err != nil {
			continue
		}

		kind := "file"
		navigable := false

		switch {
		case dirEntry.Type()&os.ModeSymlink != 0:
			kind = "symlink"
		case dirEntry.IsDir():
			kind = "directory"
			navigable = !restricted
		}

		entries = append(entries, fileEntry{
			Name:       name,
			Path:       childRel,
			Kind:       kind,
			Size:       info.Size(),
			Modified:   info.ModTime().UTC(),
			Hidden:     strings.HasPrefix(name, "."),
			Restricted: restricted,
			Navigable:  navigable,
		})
	}

	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].Restricted != entries[j].Restricted {
			return !entries[i].Restricted
		}

		if entries[i].Kind == "directory" && entries[j].Kind != "directory" {
			return true
		}
		if entries[j].Kind == "directory" && entries[i].Kind != "directory" {
			return false
		}

		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})

	var parent *string
	if relative != "" {
		value := parentRelative(relative)
		parent = &value
	}

	stubWriteJSON(w, http.StatusOK, filesResponse{
		Root:      "$HOME",
		Path:      relative,
		Parent:    parent,
		Entries:   entries,
		Filtered:  filtered,
		ReadOnly:  true,
		Generated: time.Now().UTC(),
	})
}

func handleStubSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		stubWriteMethodNotAllowed(w, http.MethodGet)
		return
	}

	stubSetJSONHeaders(w)

	home, homeReal, err := canonicalHome()
	if err != nil {
		stubWriteJSONError(w, http.StatusInternalServerError, "home directory is unavailable")
		return
	}

	sessions := make([]browserSession, 0, 16)
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

			signedIn := signedInHints[profileName] || preferencesIndicateSignedIn(
				filepath.Join(profileDir, "Preferences"),
			)
			sessionData := hasNonEmptyCookieStore(profileDir)
			lastActive := newestProfileActivity(profileDir)

			authState := "no-auth-evidence"
			if signedIn {
				authState = "signed-in"
			} else if sessionData {
				authState = "session-data-present"
			}

			sessions = append(sessions, browserSession{
				Browser:            candidate.Name,
				Profile:            profileName,
				Path:               "$HOME/" + filepath.ToSlash(candidate.Rel) + "/" + profileName,
				AuthState:          authState,
				SignedIn:           signedIn,
				SessionDataPresent: sessionData,
				LastActive:         formatOptionalTime(lastActive),
			})
		}
	}

	for _, session := range discoverIsolatedChromeProfiles(home, homeReal) {
		key := session.Path
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		sessions = append(sessions, session)
	}

	sort.SliceStable(sessions, func(i, j int) bool {
		if sessions[i].Browser != sessions[j].Browser {
			return strings.ToLower(sessions[i].Browser) < strings.ToLower(sessions[j].Browser)
		}

		if sessions[i].Profile == "Default" && sessions[j].Profile != "Default" {
			return true
		}
		if sessions[j].Profile == "Default" && sessions[i].Profile != "Default" {
			return false
		}

		return naturalProfileLess(sessions[i].Profile, sessions[j].Profile)
	})

	stubWriteJSON(w, http.StatusOK, sessionsResponse{
		Sessions:  sessions,
		ReadOnly:  true,
		Generated: time.Now().UTC(),
	})
}

func canonicalHome() (string, string, error) {
	home, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return "", "", fmt.Errorf("resolve home: %w", err)
	}

	home = filepath.Clean(home)

	homeReal, err := filepath.EvalSymlinks(home)
	if err != nil {
		return "", "", fmt.Errorf("canonicalize home: %w", err)
	}

	return home, filepath.Clean(homeReal), nil
}

func resolveSafeHomeDirectory(home, homeReal, requested string) (string, string, error) {
	relative, err := cleanRelativeHomePath(requested)
	if err != nil {
		return "", "", err
	}

	if isRestrictedRelative(relative) {
		return "", "", errors.New("path is blocked by the safe-home policy")
	}

	target := home
	if relative != "" {
		target = filepath.Join(home, filepath.FromSlash(relative))
	}

	realTarget, err := filepath.EvalSymlinks(target)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", "", os.ErrNotExist
		}
		return "", "", errors.New("unable to resolve requested path")
	}

	realTarget = filepath.Clean(realTarget)

	inside, err := pathInsideRoot(homeReal, realTarget)
	if err != nil || !inside {
		return "", "", errors.New("requested path escapes $HOME")
	}

	info, err := os.Stat(realTarget)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", "", os.ErrNotExist
		}
		return "", "", errors.New("unable to stat requested path")
	}

	if !info.IsDir() {
		return "", "", errors.New("Files currently browses directories only")
	}

	canonicalRel, err := filepath.Rel(homeReal, realTarget)
	if err != nil {
		return "", "", errors.New("unable to calculate safe relative path")
	}

	if canonicalRel == "." {
		canonicalRel = ""
	}

	canonicalRel = filepath.ToSlash(canonicalRel)
	if isRestrictedRelative(canonicalRel) {
		return "", "", errors.New("path is blocked by the safe-home policy")
	}

	return canonicalRel, realTarget, nil
}

func cleanRelativeHomePath(requested string) (string, error) {
	requested = strings.TrimSpace(requested)
	requested = strings.ReplaceAll(requested, "\\", "/")
	requested = strings.TrimPrefix(requested, "$HOME/")
	requested = strings.TrimPrefix(requested, "~/")

	if requested == "$HOME" || requested == "~" || requested == "." || requested == "" {
		return "", nil
	}

	if strings.HasPrefix(requested, "/") {
		return "", errors.New("absolute paths are not allowed")
	}

	cleaned := filepath.Clean(filepath.FromSlash(requested))
	if cleaned == "." {
		return "", nil
	}

	if cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", errors.New("parent traversal outside $HOME is not allowed")
	}

	return filepath.ToSlash(cleaned), nil
}

func pathInsideRoot(root, target string) (bool, error) {
	relative, err := filepath.Rel(root, target)
	if err != nil {
		return false, err
	}

	if relative == "." {
		return true, nil
	}

	if relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return false, nil
	}

	return !filepath.IsAbs(relative), nil
}

func isRestrictedRelative(relative string) bool {
	relative = strings.Trim(filepath.ToSlash(relative), "/")
	if relative == "" {
		return false
	}

	lower := strings.ToLower(relative)

	for _, prefix := range sensitivePathPrefixes {
		p := strings.ToLower(strings.Trim(filepath.ToSlash(prefix), "/"))
		if lower == p || strings.HasPrefix(lower, p+"/") {
			return true
		}
	}

	return false
}

func isSensitiveFileName(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))

	if _, ok := exactSensitiveNames[lower]; ok {
		return true
	}

	if lower == ".env" || strings.HasPrefix(lower, ".env.") {
		return true
	}

	if strings.HasPrefix(lower, "id_rsa.") || strings.HasPrefix(lower, "id_ed25519.") {
		return true
	}

	return false
}

func parentRelative(relative string) string {
	relative = strings.Trim(filepath.ToSlash(relative), "/")
	if relative == "" {
		return ""
	}

	parent := filepath.ToSlash(filepath.Dir(filepath.FromSlash(relative)))
	if parent == "." || parent == "/" {
		return ""
	}

	return strings.Trim(parent, "/")
}

func joinSlash(base, name string) string {
	if base == "" {
		return name
	}
	return strings.Trim(base, "/") + "/" + name
}

func safeKnownPath(home, homeReal, relative string) (string, bool) {
	relative, err := cleanRelativeHomePath(relative)
	if err != nil || isRestrictedRelative(relative) {
		return "", false
	}

	target := filepath.Join(home, filepath.FromSlash(relative))
	realTarget, err := filepath.EvalSymlinks(target)
	if err != nil {
		return "", false
	}

	ok, err := pathInsideRoot(homeReal, filepath.Clean(realTarget))
	if err != nil || !ok {
		return "", false
	}

	return filepath.Clean(realTarget), true
}

func looksLikeChromeProfile(name, profileDir string) bool {
	if name == "Default" ||
		name == "Guest Profile" ||
		name == "System Profile" ||
		strings.HasPrefix(name, "Profile ") {
		return true
	}

	for _, marker := range []string{"Preferences", "History", "Cookies"} {
		if stubFileExists(filepath.Join(profileDir, marker)) {
			return true
		}
	}

	return stubFileExists(filepath.Join(profileDir, "Network", "Cookies"))
}

func readLocalStateSignedInHints(root string) map[string]bool {
	result := make(map[string]bool)

	var payload struct {
		Profile struct {
			InfoCache map[string]struct {
				GaiaID   string `json:"gaia_id"`
				UserName string `json:"user_name"`
			} `json:"info_cache"`
		} `json:"profile"`
	}

	if err := decodeSmallJSONFile(filepath.Join(root, "Local State"), &payload); err != nil {
		return result
	}

	for profileName, info := range payload.Profile.InfoCache {
		if strings.TrimSpace(info.GaiaID) != "" || strings.TrimSpace(info.UserName) != "" {
			result[profileName] = true
		}
	}

	return result
}

func preferencesIndicateSignedIn(path string) bool {
	var payload map[string]any
	if err := decodeSmallJSONFile(path, &payload); err != nil {
		return false
	}

	if value, ok := payload["account_info"]; ok {
		switch accounts := value.(type) {
		case []any:
			if len(accounts) > 0 {
				return true
			}
		case map[string]any:
			if len(accounts) > 0 {
				return true
			}
		}
	}

	if value, ok := payload["signin"]; ok {
		if signin, ok := value.(map[string]any); ok {
			for _, key := range []string{"signedin", "signed_in", "signedIn"} {
				if raw, exists := signin[key]; exists {
					if enabled, ok := raw.(bool); ok && enabled {
						return true
					}
				}
			}
		}
	}

	return false
}

func decodeSmallJSONFile(path string, destination any) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := io.LimitReader(file, maxPreferencesBytes+1)
	data, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	if len(data) > maxPreferencesBytes {
		return errors.New("JSON file exceeds inspection limit")
	}

	return json.Unmarshal(data, destination)
}

func hasNonEmptyCookieStore(profileDir string) bool {
	candidates := []string{
		filepath.Join(profileDir, "Network", "Cookies"),
		filepath.Join(profileDir, "Cookies"),
	}

	for _, path := range candidates {
		info, err := os.Stat(path)
		if err == nil && info.Mode().IsRegular() && info.Size() > 0 {
			return true
		}
	}

	return false
}

func newestProfileActivity(profileDir string) time.Time {
	candidates := []string{
		filepath.Join(profileDir, "Preferences"),
		filepath.Join(profileDir, "History"),
		filepath.Join(profileDir, "Network", "Cookies"),
		filepath.Join(profileDir, "Cookies"),
	}

	var newest time.Time

	for _, path := range candidates {
		info, err := os.Stat(path)
		if err != nil {
			continue
		}

		if info.ModTime().After(newest) {
			newest = info.ModTime()
		}
	}

	return newest
}

func discoverIsolatedChromeProfiles(home, homeReal string) []browserSession {
	searchRoots := []string{
		"", // $HOME itself (desktop chrome-profile-*)
		".config",
		".config/maxq",
		".config/maxq/chrome-skel",
	}

	var result []browserSession
	seen := make(map[string]struct{})

	for _, relRoot := range searchRoots {
		root, ok := safeKnownPath(home, homeReal, relRoot)
		if !ok {
			continue
		}

		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			name := entry.Name()
			lower := strings.ToLower(name)

			if !strings.HasPrefix(lower, "chrome-profile-") &&
				!strings.HasPrefix(lower, "chromium-profile-") {
				continue
			}

			userDataDir := filepath.Join(root, name)
			realUserData, err := filepath.EvalSymlinks(userDataDir)
			if err != nil {
				continue
			}
			realUserData = filepath.Clean(realUserData)

			inside, err := pathInsideRoot(homeReal, realUserData)
			if err != nil || !inside {
				continue
			}

			// These dirs are usually Chrome --user-data-dir roots (Local State + Default),
			// not leaf profiles. Prefer scanning profile children; fall back to leaf.
			scannedChildren := false
			if stubFileExists(filepath.Join(realUserData, "Local State")) ||
				fileIsDir(filepath.Join(realUserData, "Default")) {
				signedInHints := readLocalStateSignedInHints(realUserData)
				children, err := os.ReadDir(realUserData)
				if err == nil {
					for _, child := range children {
						if !child.IsDir() {
							continue
						}
						profileName := child.Name()
						profileDir := filepath.Join(realUserData, profileName)
						if !looksLikeChromeProfile(profileName, profileDir) {
							continue
						}
						realProfile, err := filepath.EvalSymlinks(profileDir)
						if err != nil {
							continue
						}
						realProfile = filepath.Clean(realProfile)
						okIn, err := pathInsideRoot(homeReal, realProfile)
						if err != nil || !okIn {
							continue
						}
						if _, exists := seen[realProfile]; exists {
							continue
						}
						seen[realProfile] = struct{}{}
						scannedChildren = true

						signedIn := signedInHints[profileName] || preferencesIndicateSignedIn(
							filepath.Join(realProfile, "Preferences"),
						)
						sessionData := hasNonEmptyCookieStore(realProfile)
						lastActive := newestProfileActivity(realProfile)

						authState := "no-auth-evidence"
						if signedIn {
							authState = "signed-in"
						} else if sessionData {
							authState = "session-data-present"
						}

						relative, err := filepath.Rel(homeReal, realProfile)
						if err != nil {
							continue
						}

						result = append(result, browserSession{
							Browser:            "Chrome (isolated)",
							Profile:            name + "/" + profileName,
							Path:               "$HOME/" + filepath.ToSlash(relative),
							AuthState:          authState,
							SignedIn:           signedIn,
							SessionDataPresent: sessionData,
							LastActive:         formatOptionalTime(lastActive),
						})
					}
				}
			}

			if scannedChildren {
				continue
			}

			if !looksLikeChromeProfile(name, realUserData) {
				continue
			}

			if _, exists := seen[realUserData]; exists {
				continue
			}
			seen[realUserData] = struct{}{}

			signedIn := preferencesIndicateSignedIn(filepath.Join(realUserData, "Preferences"))
			sessionData := hasNonEmptyCookieStore(realUserData)
			lastActive := newestProfileActivity(realUserData)

			authState := "no-auth-evidence"
			if signedIn {
				authState = "signed-in"
			} else if sessionData {
				authState = "session-data-present"
			}

			relative, err := filepath.Rel(homeReal, realUserData)
			if err != nil {
				continue
			}

			result = append(result, browserSession{
				Browser:            "Chrome (isolated)",
				Profile:            name,
				Path:               "$HOME/" + filepath.ToSlash(relative),
				AuthState:          authState,
				SignedIn:           signedIn,
				SessionDataPresent: sessionData,
				LastActive:         formatOptionalTime(lastActive),
			})
		}
	}

	return result
}

func fileIsDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func stubFileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

func formatOptionalTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func naturalProfileLess(a, b string) bool {
	aLower := strings.ToLower(a)
	bLower := strings.ToLower(b)

	var aPrefix, bPrefix string
	var aNumber, bNumber int
	var aHasNumber, bHasNumber bool

	if _, err := fmt.Sscanf(aLower, "%s %d", &aPrefix, &aNumber); err == nil {
		aHasNumber = true
	}
	if _, err := fmt.Sscanf(bLower, "%s %d", &bPrefix, &bNumber); err == nil {
		bHasNumber = true
	}

	if aHasNumber && bHasNumber && aPrefix == bPrefix && aNumber != bNumber {
		return aNumber < bNumber
	}

	return aLower < bLower
}

func stubSetJSONHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
}

func stubWriteMethodNotAllowed(w http.ResponseWriter, allow string) {
	w.Header().Set("Allow", allow)
	stubSetJSONHeaders(w)
	stubWriteJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
}

func stubWriteJSONError(w http.ResponseWriter, status int, message string) {
	stubWriteJSON(w, status, map[string]any{
		"error": message,
	})
}

func stubWriteJSON(w http.ResponseWriter, status int, value any) {
	stubSetJSONHeaders(w)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
