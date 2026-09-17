package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newVaultTestServer(t *testing.T) *server {
	t.Helper()
	return &server{vault: map[string]*vaultEntry{}}
}

func TestVaultPasteListClaimOnce(t *testing.T) {
	s := newVaultTestServer(t)

	req := httptest.NewRequest(http.MethodPost, "/vault/credentials", strings.NewReader(`{"label":"X login","purpose":"post as @bot","secret":"s3cret-value"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	s.handleVaultCredentials(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create status %d body %s", rr.Code, rr.Body.String())
	}
	var meta vaultMeta
	if err := json.Unmarshal(rr.Body.Bytes(), &meta); err != nil {
		t.Fatal(err)
	}
	if meta.ID == "" || meta.Label != "X login" || meta.Purpose != "post as @bot" {
		t.Fatalf("bad meta: %+v", meta)
	}
	if strings.Contains(rr.Body.String(), "s3cret-value") {
		t.Fatal("create response leaked secret")
	}

	rr = httptest.NewRecorder()
	s.handleVaultList(rr, httptest.NewRequest(http.MethodGet, "/vault/credentials", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("list status %d", rr.Code)
	}
	if strings.Contains(rr.Body.String(), "s3cret-value") {
		t.Fatal("list leaked secret")
	}
	var listed struct {
		Credentials []vaultMeta `json:"credentials"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Credentials) != 1 || listed.Credentials[0].ID != meta.ID {
		t.Fatalf("list: %+v", listed.Credentials)
	}

	claimReq := httptest.NewRequest(http.MethodPost, "/vault/credentials/"+meta.ID+"/claim", nil)
	claimReq.SetPathValue("id", meta.ID)
	rr = httptest.NewRecorder()
	s.handleVaultClaim(rr, claimReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("claim status %d body %s", rr.Code, rr.Body.String())
	}
	var claim vaultClaimResult
	if err := json.Unmarshal(rr.Body.Bytes(), &claim); err != nil {
		t.Fatal(err)
	}
	if claim.Secret != "s3cret-value" {
		t.Fatalf("claim secret=%q", claim.Secret)
	}

	rr = httptest.NewRecorder()
	s.handleVaultClaim(rr, claimReq)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("second claim want 404 got %d", rr.Code)
	}
}

func TestVaultExpiredPurged(t *testing.T) {
	s := newVaultTestServer(t)
	now := time.Now()
	s.vault["dead"] = &vaultEntry{
		ID: "dead", Label: "x", Purpose: "y", Secret: "z",
		CreatedAt: now.Add(-2 * time.Hour), ExpiresAt: now.Add(-time.Minute),
	}
	rr := httptest.NewRecorder()
	s.handleVaultList(rr, httptest.NewRequest(http.MethodGet, "/vault/credentials", nil))
	var listed struct {
		Credentials []vaultMeta `json:"credentials"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &listed)
	if len(listed.Credentials) != 0 {
		t.Fatalf("expired should be purged: %+v", listed.Credentials)
	}
}

func TestVaultDeleteCancels(t *testing.T) {
	s := newVaultTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/vault/credentials", strings.NewReader(`{"label":"a","purpose":"b","secret":"c"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	s.handleVaultCredentials(rr, req)
	var meta vaultMeta
	_ = json.Unmarshal(rr.Body.Bytes(), &meta)

	del := httptest.NewRequest(http.MethodDelete, "/vault/credentials/"+meta.ID, nil)
	del.SetPathValue("id", meta.ID)
	rr = httptest.NewRecorder()
	s.handleVaultDelete(rr, del)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("delete status %d", rr.Code)
	}

	claimReq := httptest.NewRequest(http.MethodPost, "/vault/credentials/"+meta.ID+"/claim", nil)
	claimReq.SetPathValue("id", meta.ID)
	rr = httptest.NewRecorder()
	s.handleVaultClaim(rr, claimReq)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("claim after delete want 404 got %d", rr.Code)
	}
}
