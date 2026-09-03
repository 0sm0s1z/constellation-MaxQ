package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDisplayNumber(t *testing.T) {
	cases := map[string]int{
		":1": 1,
		":15.0": 15,
		"localhost:7.0": 7,
		"": 0,
		":0": 0,
		":16": 0,
		"garbage": 0,
	}
	for in, want := range cases {
		if got := displayNumber(in); got != want {
			t.Fatalf("displayNumber(%q)=%d want %d", in, got, want)
		}
	}
}

func TestDesktopLiveUsesX11Socket(t *testing.T) {
	root := t.TempDir()
	if desktopLive(root, 3) {
		t.Fatal("desktop 3 unexpectedly live")
	}
	p := filepath.Join(root, "X3")
	if err := os.WriteFile(p, []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	if !desktopLive(root, 3) {
		t.Fatal("desktop 3 should be live")
	}
	if desktopLive(root, 0) || desktopLive(root, 16) {
		t.Fatal("out-of-range desktop reported live")
	}
}

func TestDesktopPreferencesPersist(t *testing.T) {
	s := &server{config: t.TempDir()}
	if got := s.loadDesktopPrefs().VisibleCount; got != 4 {
		t.Fatalf("default visible_count=%d want 4", got)
	}
	want := desktopPrefs{VisibleCount: 6}
	if err := s.saveDesktopPrefs(want); err != nil {
		t.Fatal(err)
	}
	if got := s.loadDesktopPrefs(); got != want {
		t.Fatalf("loadDesktopPrefs=%+v want %+v", got, want)
	}
	st, err := os.Stat(s.desktopPrefsPath())
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o600 {
		t.Fatalf("desktops prefs mode=%o want 600", st.Mode().Perm())
	}
}

func TestDesktopViewerMetadata(t *testing.T) {
	oldRoot := x11SocketRoot
	x11SocketRoot = t.TempDir()
	defer func() { x11SocketRoot = oldRoot }()
	oldDisplay := os.Getenv("DISPLAY")
	defer os.Setenv("DISPLAY", oldDisplay)
	if err := os.Setenv("DISPLAY", ":2"); err != nil {
		t.Fatal(err)
	}

	s := &server{config: t.TempDir(), listen: defaultListen, prefix: t.TempDir()}
	resp := s.desktops()
	if len(resp.Desktops) != 15 {
		t.Fatalf("desktop count=%d want 15", len(resp.Desktops))
	}
	one := resp.Desktops[0]
	if one.Number != 1 || one.VNC != 5900 || one.ViewerPort != 6080 || one.Token != 0 {
		t.Fatalf("desktop 1 metadata=%+v", one)
	}
	two := resp.Desktops[1]
	if !two.Current || two.VNC != 5902 || two.ViewerPort != 6081 || two.Token != 2 {
		t.Fatalf("desktop 2 metadata=%+v", two)
	}
}
