package main

import (
	"os"
	"strings"
	"testing"
)

func TestTruncateCmd(t *testing.T) {
	if got := truncateCmd("  a   b  c ", 100); got != "a b c" {
		t.Fatalf("normalize: %q", got)
	}
	long := strings.Repeat("x", 200)
	got := truncateCmd(long, 120)
	if len([]rune(got)) > 120 {
		t.Fatalf("too long: %d", len(got))
	}
	if !strings.HasSuffix(got, "…") {
		t.Fatalf("missing ellipsis: %q", got)
	}
}

func TestIsProtectedProcess(t *testing.T) {
	self := os.Getpid()
	if !isProtectedProcess(self, "anything") {
		t.Fatal("self should be protected")
	}
	if !isProtectedProcess(1, "init") {
		t.Fatal("pid 1 protected")
	}
	cases := []struct {
		cmd  string
		want bool
	}{
		{"/home/box/bin/maxq-api", true},
		{"gost -L :8080", true},
		{"/usr/bin/Xvfb :99 -screen 0 1280x720x24", true},
		{"/opt/google/chrome --user-data-dir=/home/box/.config/maxq/chrome-profile", true},
		{"sleep 30", false},
		{"bash -c echo hi", false},
	}
	for _, c := range cases {
		if got := isProtectedProcess(424242, c.cmd); got != c.want {
			t.Fatalf("cmd %q protected=%v want %v", c.cmd, got, c.want)
		}
	}
}

func TestIsMaxQOwned(t *testing.T) {
	if !isMaxQOwned("/home/box/bin/maxq-api") {
		t.Fatal("maxq-api owned")
	}
	if isMaxQOwned("sleep 1") {
		t.Fatal("sleep not owned")
	}
}
