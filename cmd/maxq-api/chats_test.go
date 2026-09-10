package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestTruncateChatText(t *testing.T) {
	if got := truncateChatText("  hello   world  ", 100); got != "hello world" {
		t.Fatalf("normalize: %q", got)
	}
	long := strings.Repeat("a", 200)
	got := truncateChatText(long, 10)
	if len([]rune(got)) != 10 || !strings.HasSuffix(got, "…") {
		t.Fatalf("truncate: %q len=%d", got, len([]rune(got)))
	}
	if truncateChatText("", 10) != "" {
		t.Fatal("empty")
	}
}

func TestPreviewFromMessages(t *testing.T) {
	if previewFromMessages(nil) != "" {
		t.Fatal("nil")
	}
	if got := previewFromMessages([]string{"a", "b", "c"}); got != "c" {
		t.Fatalf("got %q", got)
	}
}

func TestParseChatMessagesValue(t *testing.T) {
	raw := json.RawMessage(`{"result":{"type":"object","value":[" hi  there ","` + strings.Repeat("x", 200) + `"]}}`)
	msgs := parseChatMessagesValue(raw)
	if len(msgs) != 2 {
		t.Fatalf("len=%d %#v", len(msgs), msgs)
	}
	if msgs[0] != "hi there" {
		t.Fatalf("first %q", msgs[0])
	}
	if len([]rune(msgs[1])) != chatPreviewCharsMax || !strings.HasSuffix(msgs[1], "…") {
		t.Fatalf("second capped badly: %d %q", len([]rune(msgs[1])), msgs[1][:20])
	}
	bad := parseChatMessagesValue(json.RawMessage(`{"exceptionDetails":{"text":"boom"}}`))
	if bad != nil {
		t.Fatalf("exception should fail soft: %#v", bad)
	}
}

func TestEntitlementTabJSONOmitsDebuggerURL(t *testing.T) {
	tab := entitlementTab{
		Site:     "chatgpt",
		Title:    "Hello",
		URL:      "https://chatgpt.com/",
		Messages: []string{"body one"},
		Preview:  "body one",
	}
	b, err := json.Marshal(tab)
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, leak := range []string{"webSocketDebuggerUrl", "ws://", "devtools/page"} {
		if strings.Contains(s, leak) {
			t.Fatalf("leaked %q in %s", leak, s)
		}
	}
	if !strings.Contains(s, `"preview":"body one"`) {
		t.Fatalf("missing preview: %s", s)
	}
}

func TestFetchChatMessagesCDPRejectsRemote(t *testing.T) {
	if msgs := fetchChatMessagesCDP("ws://example.com/devtools", cdpEvalTimeout); msgs != nil {
		t.Fatalf("remote must be rejected: %#v", msgs)
	}
	if msgs := fetchChatMessagesCDP("wss://127.0.0.1:9222/x", cdpEvalTimeout); msgs != nil {
		t.Fatalf("wss must be rejected: %#v", msgs)
	}
}

func TestChatChromeNoiseFilter(t *testing.T) {
	raw := []string{
		"Michael Waitze 2w Thank you for the follow!",
		"Not Now Use X Number",
		"not now",
		"Feel free to let me know the tech topics that you find the most interesting",
		"Accept cookies",
		"If you know their X Number you can message them now.",
	}
	got := filterChatMessages(raw)
	if len(got) != 1 {
		t.Fatalf("len=%d %#v", len(got), got)
	}
	if got[0] != "Feel free to let me know the tech topics that you find the most interesting" {
		t.Fatalf("kept %q", got[0])
	}
	if previewFromMessages(raw) != got[0] {
		t.Fatalf("preview %q", previewFromMessages(raw))
	}
	if previewFromMessages([]string{"Not Now", "Use X Number"}) != "" {
		t.Fatal("all-noise should empty preview")
	}
}

func TestSkipChatBodyEval(t *testing.T) {
	if !skipChatBodyEval("https://accounts.x.ai/sign-in", "Sign In to Your Grok Account | Grok") {
		t.Fatal("accounts.x.ai sign-in")
	}
	if !skipChatBodyEval("https://chatgpt.com/auth/login", "Log in") {
		t.Fatal("login title")
	}
	if skipChatBodyEval("https://x.com/i/chat/32925761-195138772", "x.com/i/chat/32925761-195138772") {
		t.Fatal("real X chat must eval")
	}
}


func TestSkipChatBodyEvalExtraTitles(t *testing.T) {
	if !skipChatBodyEval("https://accounts.x.ai/sign-in", "Create your account | Grok") {
		t.Fatal("create account title")
	}
	if !skipChatBodyEval("https://grok.x.ai/", "Verify your identity") {
		t.Fatal("verify identity title")
	}
	if skipChatBodyEval("https://chatgpt.com/", "ChatGPT") {
		t.Fatal("real chatgpt must eval")
	}
}

func TestSplitMashedChatBody(t *testing.T) {
	raw := "Feel free to let me know the tech topics that you find the most interesting, i would be happy to cover it on the show :) Brandon Forbes 28w You: Awesome!"
	got := splitMashedChatBody(raw)
	if len(got) < 2 {
		t.Fatalf("expected split, got %#v", got)
	}
	if !strings.Contains(got[0], "Feel free to let me know") {
		t.Fatalf("first %#v", got[0])
	}
	last := got[len(got)-1]
	if !strings.HasPrefix(last, "You: Awesome") {
		t.Fatalf("last %#v", last)
	}
	if strings.Contains(got[0], "28w") || strings.Contains(got[0], "Brandon") {
		t.Fatalf("age/name still on first bubble: %#v", got[0])
	}
	trailing := splitMashedChatBody("hello there this is a long enough prior bubble Brandon Forbes 28w")
	if len(trailing) != 1 || strings.Contains(trailing[0], "28w") {
		t.Fatalf("trailing age label: %#v", trailing)
	}
	// Noise path: mashed follow thank-you should still filter after expand.
	filtered := filterChatMessages([]string{
		"Michael Waitze 2w Thank you for the follow! Brandon Forbes 28w You: Awesome!",
		"Feel free to chat about platforms",
	})
	if len(filtered) < 1 {
		t.Fatalf("filtered empty: %#v", filtered)
	}
	for _, m := range filtered {
		if strings.Contains(strings.ToLower(m), "thank you for the follow") {
			t.Fatalf("follow noise survived: %#v", filtered)
		}
	}
}
