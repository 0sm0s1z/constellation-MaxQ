package main

import "testing"

func TestSanitizeProxyListen(t *testing.T) {
	got, err := sanitizeProxyListen("localhost:8080")
	if err != nil || got != "127.0.0.1:8080" {
		t.Fatalf("localhost: got %q err=%v", got, err)
	}
	if _, err := sanitizeProxyListen("0.0.0.0:8080"); err == nil {
		t.Fatal("expected wildcard listen rejection")
	}
	if _, err := sanitizeProxyListen("10.0.0.1:8080"); err == nil {
		t.Fatal("expected non-loopback listen rejection")
	}
}

func TestDisplayProfileNumbers(t *testing.T) {
	if got, ok := displayNumber(":7.0"); !ok || got != "7" {
		t.Fatalf("display: %q %v", got, ok)
	}
	if got, ok := profileNumber("chrome-profile-7"); !ok || got != "7" {
		t.Fatalf("profile: %q %v", got, ok)
	}
	if _, ok := profileNumber("chrome-profile-other"); ok {
		t.Fatal("non-numeric profile accepted")
	}
}
