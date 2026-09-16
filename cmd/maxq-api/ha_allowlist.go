package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const haAllowlistSemantics = "curated-allowlist-not-full-dump"

var haEntityIDPattern = regexp.MustCompile(`^[a-z0-9_]+\.[a-z0-9_]+$`)

type haEntity struct {
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
}

type haAllowlistFile struct {
	Entities []haEntity `json:"entities"`
}

type haAllowlistState struct {
	Entities       []haEntity `json:"entities"`
	Source         string     `json:"source"`
	Semantics      string     `json:"semantics"`
	BotVisibleOnly bool       `json:"bot_visible_only"`
}

func (s *server) haAllowlistPath() string {
	return filepath.Join(s.config, "ha-allowlist.json")
}

func normalizeHAEntities(entities []haEntity) ([]haEntity, error) {
	normalized := make([]haEntity, 0, len(entities))
	seen := make(map[string]struct{}, len(entities))
	for i, entity := range entities {
		id := strings.TrimSpace(entity.ID)
		if id == "" {
			return nil, fmt.Errorf("entities[%d].id is required", i)
		}
		if len(id) > 255 || !haEntityIDPattern.MatchString(id) {
			return nil, fmt.Errorf("entities[%d].id %q is not a valid Home Assistant entity id", i, id)
		}
		label := strings.TrimSpace(entity.Label)
		if len(label) > 200 {
			return nil, fmt.Errorf("entities[%d].label exceeds 200 characters", i)
		}
		if _, duplicate := seen[id]; duplicate {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, haEntity{ID: id, Label: label})
	}
	return normalized, nil
}

func (s *server) haAllowlistState(entities []haEntity) haAllowlistState {
	if entities == nil {
		entities = []haEntity{}
	}
	return haAllowlistState{
		Entities:       entities,
		Source:         s.haAllowlistPath(),
		Semantics:      haAllowlistSemantics,
		BotVisibleOnly: true,
	}
}

func (s *server) loadHAAllowlist() (haAllowlistState, error) {
	b, err := os.ReadFile(s.haAllowlistPath())
	if os.IsNotExist(err) {
		return s.haAllowlistState([]haEntity{}), nil
	}
	if err != nil {
		return haAllowlistState{}, err
	}
	var file haAllowlistFile
	if err := json.Unmarshal(b, &file); err != nil {
		return haAllowlistState{}, fmt.Errorf("read HA allowlist: %w", err)
	}
	entities, err := normalizeHAEntities(file.Entities)
	if err != nil {
		return haAllowlistState{}, fmt.Errorf("read HA allowlist: %w", err)
	}
	return s.haAllowlistState(entities), nil
}

func (s *server) saveHAAllowlist(entities []haEntity) ([]haEntity, error) {
	normalized, err := normalizeHAEntities(entities)
	if err != nil {
		return nil, err
	}
	b, err := json.MarshalIndent(haAllowlistFile{Entities: normalized}, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := writePrivateFileAtomic(s.config, "ha-allowlist-*.tmp", s.haAllowlistPath(), append(b, '\n')); err != nil {
		return nil, err
	}
	return normalized, nil
}

func (s *server) handleHAAllowlist(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	switch r.Method {
	case http.MethodGet:
		state, err := s.loadHAAllowlist()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, state)
	case http.MethodPut:
		var req haAllowlistFile
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json"})
			return
		}
		entities, err := s.saveHAAllowlist(req.Entities)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		state := s.haAllowlistState(entities)
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":               true,
			"entities":         state.Entities,
			"source":           state.Source,
			"semantics":        state.Semantics,
			"bot_visible_only": state.BotVisibleOnly,
		})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
