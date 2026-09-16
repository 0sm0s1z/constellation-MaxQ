package main

import (
	"os"
	"strings"
	"testing"
)

func TestSheetRefreshSettlesEndpointsIndependently(t *testing.T) {
	body, err := os.ReadFile("ui/sheet.js")
	if err != nil {
		t.Fatalf("read ui/sheet.js: %v", err)
	}
	js := string(body)
	for _, want := range []string{
		"Promise.allSettled",
		"renderStatus(status.value)",
		"renderPolicy(policy.value)",
		"renderPolicyUnavailable",
		"renderConnectionsUnavailable",
		"Desktops",
	} {
		if !strings.Contains(js, want) {
			t.Fatalf("sheet.js missing resilience marker %q", want)
		}
	}
	if strings.Contains(js, "await Promise.all([getStatus(), getPolicy(), getConnections(), getDesktops()])") {
		t.Fatal("sheet refresh must not let one auxiliary endpoint block status/policy rendering")
	}
}
