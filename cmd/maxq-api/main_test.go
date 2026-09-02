package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCronMatch(t *testing.T) {
	c, err := parseCron("*/5 9-17 * * 1-5")
	if err != nil { t.Fatal(err) }
	monday := time.Date(2026, 9, 7, 9, 10, 0, 0, time.UTC)
	if !c.match(monday) { t.Fatal("expected cron match") }
	if c.match(monday.Add(1*time.Minute)) { t.Fatal("unexpected cron match") }
	if _, err := parseCron("bad cron"); err == nil { t.Fatal("expected invalid cron") }
}

func TestWebhookPersistenceAndValidation(t *testing.T) {
	dir := t.TempDir()
	s := &server{prefix:dir, config:filepath.Join(dir,".config","maxq")}
	if err := os.MkdirAll(s.config, 0o700); err != nil { t.Fatal(err) }
	s.ensureHookFiles()
	if got := s.webhookURL(); got != "" { t.Fatalf("default webhook=%q", got) }
	if err := s.setWebhookURL("http://example.com/hook"); err == nil { t.Fatal("http webhook should be rejected") }
	want := "https://example.com/hook"
	if err := s.setWebhookURL(want); err != nil { t.Fatal(err) }
	if got := s.webhookURL(); got != want { t.Fatalf("webhook=%q want %q", got, want) }
}

func TestBuiltinResourceTrigger(t *testing.T) {
	dir := t.TempDir()
	s := &server{prefix:dir, config:filepath.Join(dir,".config","maxq")}
	if err := os.MkdirAll(s.config, 0o700); err != nil { t.Fatal(err) }
	s.ensureHookFiles()
	tf := s.loadTriggers()
	if len(tf.Triggers) != 1 { t.Fatalf("triggers=%d want 1", len(tf.Triggers)) }
	tr := tf.Triggers[0]
	if tr.ID != "resource.mem" || !tr.Enabled { t.Fatalf("bad builtin: %#v", tr) }
	if tr.Message != "warning resource limits exhausted: OOM" { t.Fatalf("message=%q", tr.Message) }
}

func TestCurrentAgent(t *testing.T) {
	old := os.Getenv("DISPLAY")
	t.Cleanup(func(){ _ = os.Setenv("DISPLAY", old) })
	_ = os.Setenv("DISPLAY", ":7.0")
	display, profile := currentAgent("/home/bot")
	if display != ":7.0" { t.Fatalf("display=%q", display) }
	if profile != "/home/bot/chrome-profile-7" { t.Fatalf("profile=%q", profile) }
}
