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

func (s *server) localDesktops() ([]map[string]any, error) {
	if s.localInventory != nil {
		return s.localInventory()
	}

	current := displayNumber(os.Getenv("DISPLAY"))
	items := make([]map[string]any, 0, desktopCount)
	for n := 1; n <= desktopCount; n++ {
		vncPort, viewerPort := 5900+n, 6081
		if n == 1 {
			vncPort, viewerPort = 5900, 6080
		}
		items = append(items, map[string]any{
			"id":              fmt.Sprintf("local-desktop-%d", n),
			"name":            fmt.Sprintf("Desktop :%d", n),
			"number":          n,
			"display":         fmt.Sprintf(":%d", n),
			"live":            desktopLive(x11SocketRoot, n),
			"current":         n == current,
			"vnc_port":        vncPort,
			"viewer_port":     viewerPort,
			"box_identity":    s.boxIdentity(),
			"connection_name": "Local",
			"source_api":      "local",
		})
	}
	return items, nil
}

func (s *server) boxIdentity() string {
	if host, err := os.Hostname(); err == nil && strings.TrimSpace(host) != "" {
		return strings.TrimSpace(host)
	}
	return "local"
}

func displayNumber(value string) int {
	value = strings.TrimSpace(value)
	i := strings.LastIndexByte(value, ':')
	if i < 0 || i+1 >= len(value) {
		return 0
	}
	value = value[i+1:]
	if i := strings.IndexByte(value, '.'); i >= 0 {
		value = value[:i]
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 || n > desktopCount {
		return 0
	}
	return n
}

func desktopLive(root string, n int) bool {
	if n < 1 || n > desktopCount {
		return false
	}
	info, err := os.Stat(filepath.Join(root, "X"+strconv.Itoa(n)))
	return err == nil && !info.IsDir()
}
