package main

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sort"
	"strings"
	"time"
)

const defaultVaultTTL = 10 * time.Minute

type vaultCredential struct {
	ID        string
	Label     string
	Purpose   string
	Secret    string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type vaultMetadata struct {
	ID        string    `json:"id"`
	Label     string    `json:"label"`
	Purpose   string    `json:"purpose"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type vaultCredentialRequest struct {
	Label   string `json:"label"`
	Purpose string `json:"purpose"`
	Secret  string `json:"secret"`
}

func (s *server) vaultDuration() time.Duration {
	if s.vaultTTL > 0 {
		return s.vaultTTL
	}
	return defaultVaultTTL
}

func (s *server) purgeVaultLocked(now time.Time) {
	for id, credential := range s.vault {
		if !now.Before(credential.ExpiresAt) {
			delete(s.vault, id)
		}
	}
}

func (s *server) handleVaultCredentials(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		s.purgeVaultLocked(time.Now())
		items := make([]vaultMetadata, 0, len(s.vault))
		for _, credential := range s.vault {
			items = append(items, vaultMetadataFor(credential))
		}
		s.mu.Unlock()
		sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.Before(items[j].CreatedAt) })
		writeJSON(w, http.StatusOK, map[string]any{"credentials": items})
	case http.MethodPost:
		var req vaultCredentialRequest
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
			return
		}
		label := strings.TrimSpace(req.Label)
		purpose := strings.TrimSpace(req.Purpose)
		if label == "" || purpose == "" || strings.TrimSpace(req.Secret) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "label, purpose, and secret are required"})
			return
		}
		if len(label) > 200 || len(purpose) > 500 || len(req.Secret) > 10000 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "credential fields are too long"})
			return
		}
		now := time.Now()
		credential := vaultCredential{
			ID:        newVaultID(),
			Label:     label,
			Purpose:   purpose,
			Secret:    req.Secret,
			CreatedAt: now,
			ExpiresAt: now.Add(s.vaultDuration()),
		}
		s.mu.Lock()
		if s.vault == nil {
			s.vault = make(map[string]vaultCredential)
		}
		s.purgeVaultLocked(now)
		s.vault[credential.ID] = credential
		s.mu.Unlock()
		writeJSON(w, http.StatusCreated, vaultMetadataFor(credential))
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
	}
}

func (s *server) handleVaultClaim(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	s.mu.Lock()
	s.purgeVaultLocked(time.Now())
	credential, ok := s.vault[id]
	if ok {
		delete(s.vault, id)
	}
	s.mu.Unlock()
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "credential not found or expired"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":         credential.ID,
		"label":      credential.Label,
		"purpose":    credential.Purpose,
		"secret":     credential.Secret,
		"created_at": credential.CreatedAt,
		"expires_at": credential.ExpiresAt,
	})
}

func (s *server) handleVaultDelete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	s.mu.Lock()
	s.purgeVaultLocked(time.Now())
	_, ok := s.vault[id]
	if ok {
		delete(s.vault, id)
	}
	s.mu.Unlock()
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "credential not found or expired"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func vaultMetadataFor(credential vaultCredential) vaultMetadata {
	return vaultMetadata{
		ID:        credential.ID,
		Label:     credential.Label,
		Purpose:   credential.Purpose,
		CreatedAt: credential.CreatedAt,
		ExpiresAt: credential.ExpiresAt,
	}
}

func newVaultID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err == nil {
		return "v-" + hex.EncodeToString(buf)
	}
	return "v-" + hex.EncodeToString([]byte(time.Now().String()))
}
