package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func vaultRequest(method, path, body string) *http.Request {
	return httptest.NewRequest(method, path, strings.NewReader(body))
}

func TestVaultPasteListAndClaimOnce(t *testing.T) {
	s := &server{vaultTTL: 10 * time.Minute}
	secret := "super-secret-value"
	create := httptest.NewRecorder()
	s.handleVaultCredentials(create, vaultRequest(http.MethodPost, "/vault/credentials", `{"label":"GitHub","purpose":"login","secret":"`+secret+`"}`))
	if create.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", create.Code, create.Body.String())
	}
	if strings.Contains(create.Body.String(), secret) {
		t.Fatal("create response leaked secret")
	}
	var metadata vaultMetadata
	if err := json.Unmarshal(create.Body.Bytes(), &metadata); err != nil {
		t.Fatal(err)
	}
	if metadata.ID == "" || metadata.Label != "GitHub" || metadata.Purpose != "login" || metadata.ExpiresAt.IsZero() {
		t.Fatalf("unexpected metadata: %+v", metadata)
	}

	list := httptest.NewRecorder()
	s.handleVaultCredentials(list, vaultRequest(http.MethodGet, "/vault/credentials", ""))
	if list.Code != http.StatusOK || strings.Contains(list.Body.String(), secret) {
		t.Fatalf("list leaked secret or failed: %d %s", list.Code, list.Body.String())
	}
	var listed struct {
		Credentials []vaultMetadata `json:"credentials"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Credentials) != 1 || listed.Credentials[0].ID != metadata.ID {
		t.Fatalf("unexpected list: %+v", listed.Credentials)
	}

	claimReq := vaultRequest(http.MethodPost, "/vault/credentials/"+metadata.ID+"/claim", "")
	claimReq.SetPathValue("id", metadata.ID)
	claim := httptest.NewRecorder()
	s.handleVaultClaim(claim, claimReq)
	if claim.Code != http.StatusOK {
		t.Fatalf("claim status = %d, body = %s", claim.Code, claim.Body.String())
	}
	var claimed struct {
		Secret string `json:"secret"`
	}
	if err := json.Unmarshal(claim.Body.Bytes(), &claimed); err != nil {
		t.Fatal(err)
	}
	if claimed.Secret != secret {
		t.Fatalf("claimed secret = %q", claimed.Secret)
	}

	secondReq := vaultRequest(http.MethodPost, "/vault/credentials/"+metadata.ID+"/claim", "")
	secondReq.SetPathValue("id", metadata.ID)
	second := httptest.NewRecorder()
	s.handleVaultClaim(second, secondReq)
	if second.Code != http.StatusNotFound {
		t.Fatalf("second claim status = %d, body = %s", second.Code, second.Body.String())
	}
}

func TestVaultExpiredCredentialsArePurged(t *testing.T) {
	s := &server{}
	create := httptest.NewRecorder()
	s.handleVaultCredentials(create, vaultRequest(http.MethodPost, "/vault/credentials", `{"label":"expired","purpose":"test","secret":"hidden"}`))
	if create.Code != http.StatusCreated {
		t.Fatalf("create status = %d", create.Code)
	}
	var metadata vaultMetadata
	if err := json.Unmarshal(create.Body.Bytes(), &metadata); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	credential := s.vault[metadata.ID]
	credential.ExpiresAt = time.Now().Add(-time.Second)
	s.vault[metadata.ID] = credential
	s.mu.Unlock()

	list := httptest.NewRecorder()
	s.handleVaultCredentials(list, vaultRequest(http.MethodGet, "/vault/credentials", ""))
	if list.Code != http.StatusOK || list.Body.String() != "{\"credentials\":[]}\n" {
		t.Fatalf("expired credential was not purged: %d %s", list.Code, list.Body.String())
	}
	claimReq := vaultRequest(http.MethodPost, "/vault/credentials/"+metadata.ID+"/claim", "")
	claimReq.SetPathValue("id", metadata.ID)
	claim := httptest.NewRecorder()
	s.handleVaultClaim(claim, claimReq)
	if claim.Code != http.StatusNotFound {
		t.Fatalf("expired claim status = %d", claim.Code)
	}
}
