package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// MaxQ exposes a stable inventory for the fifteen X11 desktop slots. A slot
// is live when its X11 socket exists under /tmp/.X11-unix.
const desktopCount = 15

var x11SocketRoot = "/tmp/.X11-unix"

func (s *server) boxIdentity() string {
	if h, err := os.Hostname(); err == nil && strings.TrimSpace(h) != "" {
		return strings.TrimSpace(h)
	}
	return s.listen
}

func (s *server) localDesktopMaps() []map[string]any {
	if s.localInventory != nil {
		items, err := s.localInventory()
		if err == nil {
			return items
		}
	}
	current := displayNumber(os.Getenv("DISPLAY"))
	items := make([]map[string]any, 0, desktopCount)
	for n := 1; n <= desktopCount; n++ {
		live := desktopLive(x11SocketRoot, n)
		item := map[string]any{
			"id":          strconv.Itoa(n),
			"number":      n,
			"display":     fmt.Sprintf(":%d", n),
			"live":        live,
			"current":     n == current,
			"vnc_port":    5900 + n,
			"viewer_port": 6081,
		}
		if n == 1 {
			item["vnc_port"] = 5900
			item["viewer_port"] = 6080
		} else {
			item["token"] = n
		}
		items = append(items, item)
	}
	return items
}

func displayNumber(v string) int {
	v = strings.TrimSpace(v)
	i := strings.LastIndexByte(v, ':')
	if i < 0 || i == len(v)-1 {
		return 0
	}
	n := v[i+1:]
	if j := strings.IndexByte(n, '.'); j >= 0 {
		n = n[:j]
	}
	out, err := strconv.Atoi(n)
	if err != nil || out < 1 || out > desktopCount {
		return 0
	}
	return out
}

func desktopLive(root string, n int) bool {
	if n < 1 || n > desktopCount {
		return false
	}
	st, err := os.Stat(filepath.Join(root, "X"+strconv.Itoa(n)))
	return err == nil && !st.IsDir()
}
