package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCronMatches(t *testing.T) {
	loc, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatal(err)
	}
	monday := time.Date(2026, 9, 7, 9, 0, 0, 0, loc)
	if !cronMatches("0 9 * * 1-5", monday) {
		t.Fatal("weekday cron did not match")
	}
	if cronMatches("30 9 * * 1-5", monday) {
		t.Fatal("wrong minute matched")
	}
	if _, err := parseCron("0 9 * * nope"); err == nil {
		t.Fatal("invalid cron accepted")
	}
}

func TestWebhookValidationAndHint(t *testing.T) {
	if _, err := validateWebhookURL("http://example.com/hook"); err == nil {
		t.Fatal("non-HTTPS webhook accepted")
	}
	clean, err := validateWebhookURL("https://example.com/secret/path?token=abc")
	if err != nil || clean == "" {
		t.Fatalf("valid webhook rejected: %v", err)
	}
	if got := webhookHint(clean); got != "https://example.com/…" {
		t.Fatalf("hint leaked or changed path: %q", got)
	}
}

func TestEnsureTriggerFilesAddsBuiltin(t *testing.T) {
	root := t.TempDir()
	s := &server{prefix: root, config: filepath.Join(root, ".config", "maxq")}
	if err := s.ensureTriggerFiles(); err != nil {
		t.Fatal(err)
	}
	defs, err := s.loadTriggerDefsRaw()
	if err != nil {
		t.Fatal(err)
	}
	if len(defs) != 1 || defs[0].ID != "resource.mem" || !defs[0].Builtin {
		t.Fatalf("unexpected builtin defs: %#v", defs)
	}
	st, err := os.Stat(s.hooksPath())
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0600 {
		t.Fatalf("hooks.toml mode=%o", st.Mode().Perm())
	}
}
