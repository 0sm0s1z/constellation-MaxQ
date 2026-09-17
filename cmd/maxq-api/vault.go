package main

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"
)

const (
	vaultDefaultTTL = 10 * time.Minute
	vaultMaxLabel   = 200
	vaultMaxPurpose = 400
	vaultMaxSecret  = 8192
)

type vaultEntry struct {
	ID        string
	Label     string
	Purpose   string
	Secret    string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type vaultMeta struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Purpose   string `json:"purpose"`
	CreatedAt string `json:"created_at"`
	ExpiresAt string `json:"expires_at"`
}

type vaultCreateRequest struct {
	Label   string `json:"label"`
	Purpose string `json:"purpose"`
	Secret  string `json:"secret"`
	TTLSec  int    `json:"ttl_sec,omitempty"`
}

type vaultClaimResult struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Purpose string `json:"purpose"`
	Secret  string `json:"secret"`
}

func (s *server) ensureVault() {
	if s.vault == nil {
		s.vault = map[string]*vaultEntry{}
	}
}

func (s *server) purgeVaultLocked(now time.Time) {
	s.ensureVault()
	for id, e := range s.vault {
		if !e.ExpiresAt.After(now) {
			delete(s.vault, id)
		}
	}
}

func newVaultID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func vaultMetaOf(e *vaultEntry) vaultMeta {
	return vaultMeta{
		ID:        e.ID,
		Label:     e.Label,
		Purpose:   e.Purpose,
		CreatedAt: e.CreatedAt.UTC().Format(time.RFC3339),
		ExpiresAt: e.ExpiresAt.UTC().Format(time.RFC3339),
	}
}

func (s *server) handleVaultCredentials(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleVaultList(w, r)
	case http.MethodPost:
		s.handleVaultCreate(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *server) handleVaultList(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeVaultLocked(time.Now())
	out := make([]vaultMeta, 0, len(s.vault))
	for _, e := range s.vault {
		out = append(out, vaultMetaOf(e))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"credentials": out,
		"semantics":   "ephemeral-in-memory-one-shot-claim",
		"note":        "Secrets are never listed. Bots claim once via POST /vault/credentials/{id}/claim.",
	})
}

func (s *server) handleVaultCreate(w http.ResponseWriter, r *http.Request) {
	var req vaultCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	label := strings.TrimSpace(req.Label)
	purpose := strings.TrimSpace(req.Purpose)
	secret := req.Secret
	if label == "" || purpose == "" || secret == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "label, purpose, and secret are required"})
		return
	}
	if len(label) > vaultMaxLabel || len(purpose) > vaultMaxPurpose || len(secret) > vaultMaxSecret {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "label, purpose, or secret too long"})
		return
	}
	ttl := vaultDefaultTTL
	if req.TTLSec > 0 {
		ttl = time.Duration(req.TTLSec) * time.Second
		if ttl > 60*time.Minute {
			ttl = 60 * time.Minute
		}
		if ttl < 30*time.Second {
			ttl = 30 * time.Second
		}
	}
	id, err := newVaultID()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "id mint failed"})
		return
	}
	now := time.Now()
	e := &vaultEntry{
		ID:        id,
		Label:     label,
		Purpose:   purpose,
		Secret:    secret,
		CreatedAt: now,
		ExpiresAt: now.Add(ttl),
	}
	s.mu.Lock()
	s.purgeVaultLocked(now)
	s.ensureVault()
	s.vault[id] = e
	meta := vaultMetaOf(e)
	s.mu.Unlock()
	writeJSON(w, http.StatusCreated, meta)
}

func (s *server) handleVaultClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeVaultLocked(time.Now())
	e, ok := s.vault[id]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "credential not found or expired"})
		return
	}
	delete(s.vault, id)
	writeJSON(w, http.StatusOK, vaultClaimResult{
		ID:      e.ID,
		Label:   e.Label,
		Purpose: e.Purpose,
		Secret:  e.Secret,
	})
}

func (s *server) handleVaultDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeVaultLocked(time.Now())
	if _, ok := s.vault[id]; !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "credential not found or expired"})
		return
	}
	delete(s.vault, id)
	w.WriteHeader(http.StatusNoContent)
}
