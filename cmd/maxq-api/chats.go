package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const cdpPortBase = 9222

type entitlementTab struct {
	Site  string `json:"site"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

func cdpPortForDisplay(n int) int {
	if n < 1 {
		return 0
	}
	return cdpPortBase + n
}

func entitlementSite(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u == nil {
		return ""
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	host := strings.ToLower(u.Hostname())
	path := strings.ToLower(u.Path)
	switch {
	case host == "chatgpt.com" || host == "www.chatgpt.com" || host == "chat.openai.com":
		return "chatgpt"
	case host == "grok.com" || host == "www.grok.com" || strings.HasSuffix(host, ".grok.com"):
		return "grok"
	case host == "grok.x.ai":
		return "grok"
	case (host == "x.com" || host == "www.x.com" || host == "twitter.com") && strings.Contains(path, "/i/grok"):
		return "grok"
	case host == "claude.ai" || strings.HasSuffix(host, ".claude.ai"):
		return "claude"
	default:
		return ""
	}
}

type cdpTarget struct {
	Type  string `json:"type"`
	URL   string `json:"url"`
	Title string `json:"title"`
}

func listEntitlementTabs(port int) []entitlementTab {
	if port < 1 {
		return nil
	}
	client := &http.Client{Timeout: 180 * time.Millisecond}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/json/list", port))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	var targets []cdpTarget
	if json.NewDecoder(resp.Body).Decode(&targets) != nil {
		return nil
	}
	seen := map[string]bool{}
	out := make([]entitlementTab, 0)
	for _, t := range targets {
		if t.Type != "page" {
			continue
		}
		site := entitlementSite(t.URL)
		if site == "" {
			continue
		}
		u, err := url.Parse(t.URL)
		if err != nil {
			continue
		}
		// Drop query/fragment so we don't leak CDP or session params.
		u.RawQuery = ""
		u.Fragment = ""
		clean := u.String()
		if seen[clean] {
			continue
		}
		seen[clean] = true
		title := strings.TrimSpace(t.Title)
		if title == "" || strings.EqualFold(title, site) {
			title = site
		}
		out = append(out, entitlementTab{Site: site, Title: title, URL: clean})
	}
	return out
}

func fillDesktopChats(items []xvfbDesktop) {
	var wg sync.WaitGroup
	for i := range items {
		if !items[i].Live {
			items[i].Chats = []entitlementTab{}
			continue
		}
		items[i].CDPPort = cdpPortForDisplay(items[i].Number)
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			tabs := listEntitlementTabs(items[i].CDPPort)
			if tabs == nil {
				tabs = []entitlementTab{}
			}
			items[i].Chats = tabs
		}(i)
	}
	wg.Wait()
}
