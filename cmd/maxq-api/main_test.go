package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDefaults(t *testing.T) {
	d := defaultDefaults()
	if err := validateDefaults(d); err != nil { t.Fatalf("default defaults invalid: %v", err) }
	d.DefaultAIChat = "other"
	if err := validateDefaults(d); err == nil { t.Fatal("expected invalid default_ai_chat to fail") }
	d = defaultDefaults(); d.Sites["slack"] = "file:///tmp/nope"
	if err := validateDefaults(d); err == nil { t.Fatal("expected non-http URL to fail") }
}

func TestWriteAndReadDefaults(t *testing.T) {
	prefix := t.TempDir(); s := &server{prefix: prefix, config: filepath.Join(prefix, ".config", "maxq")}
	d := defaultDefaults(); d.DefaultAIChat = "grok"; d.Sites["discord"] = "https://discord.com/channels/@me"
	if err := s.writeDefaults(d); err != nil { t.Fatal(err) }
	got := s.defaults(); if got.DefaultAIChat != "grok" || got.Sites["discord"] != d.Sites["discord"] { t.Fatalf("round trip mismatch: %#v", got) }
	if _, err := os.Stat(filepath.Join(s.config, "defaults.toml")); err != nil { t.Fatal(err) }
}

func TestGhosttyDefaultStatus(t *testing.T) {
	prefix := t.TempDir(); bin := filepath.Join(prefix,"bin"); apps := filepath.Join(prefix,".local","share","applications"); xfce := filepath.Join(prefix,".config","xfce4")
	for _, p := range []string{bin, apps, xfce} { if err := os.MkdirAll(p, 0o755); err != nil { t.Fatal(err) } }
	ghostty := filepath.Join(bin,"ghostty"); if err := os.WriteFile(ghostty, []byte("#!/bin/sh\necho ghostty-test\n"), 0o755); err != nil { t.Fatal(err) }
	if err := os.WriteFile(filepath.Join(apps,"ghostty.desktop"), []byte("[Desktop Entry]\n"), 0o644); err != nil { t.Fatal(err) }
	if err := os.WriteFile(filepath.Join(xfce,"helpers.rc"), []byte("TerminalEmulator=ghostty\n"), 0o644); err != nil { t.Fatal(err) }
	s := &server{prefix:prefix, config:filepath.Join(prefix,".config","maxq")}; g := s.ghostty()
	if !g.Installed || !g.Default || g.Version != "ghostty-test" { t.Fatalf("unexpected ghostty status: %#v", g) }
}

func TestSanitizeListen(t *testing.T) {
	if got := sanitizeListen("0.0.0.0:7432"); got != defaultListen { t.Fatalf("non-loopback accepted: %q", got) }
	if got := sanitizeListen("127.0.0.1:9000"); got != "127.0.0.1:9000" { t.Fatalf("loopback changed: %q", got) }
}
