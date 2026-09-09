package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const cdpPortBase = 9222

// Caps for CDP body previews — keep /desktops snappy and demo-safe.
const (
	chatPreviewMsgMax   = 5
	chatPreviewCharsMax = 160
	chatPreviewTabsMax  = 4
	cdpListTimeout      = 400 * time.Millisecond
	cdpEvalTimeout      = 1200 * time.Millisecond
	chatPreviewBudget   = 3500 * time.Millisecond
)

type entitlementTab struct {
	Site     string   `json:"site"`
	Title    string   `json:"title"`
	URL      string   `json:"url"`
	Messages []string `json:"messages,omitempty"`
	Preview  string   `json:"preview,omitempty"`
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
	case host == "grok.x.ai" || host == "accounts.x.ai":
		return "grok"
	case (host == "x.com" || host == "www.x.com" || host == "twitter.com") && strings.Contains(path, "/i/grok"):
		return "grok"
	case (host == "x.com" || host == "www.x.com" || host == "twitter.com") && strings.Contains(path, "/i/chat"):
		return "x"
	case host == "claude.ai" || strings.HasSuffix(host, ".claude.ai"):
		return "claude"
	default:
		return ""
	}
}

// cdpTarget is internal — webSocketDebuggerUrl must never reach the FE.
type cdpTarget struct {
	Type                 string `json:"type"`
	URL                  string `json:"url"`
	Title                string `json:"title"`
	WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
}

func truncateChatText(s string, max int) string {
	s = strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
	if max < 1 || s == "" {
		return ""
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	if max == 1 {
		return "…"
	}
	return string(r[:max-1]) + "…"
}

func previewFromMessages(msgs []string) string {
	if len(msgs) == 0 {
		return ""
	}
	return msgs[len(msgs)-1]
}

type previewJob struct {
	idx int
	ws  string
}

func listEntitlementTabs(port int) []entitlementTab {
	if port < 1 {
		return nil
	}
	client := &http.Client{Timeout: cdpListTimeout}
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
	var toEval []previewJob
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
		idx := len(out)
		out = append(out, entitlementTab{Site: site, Title: title, URL: clean})
		if t.WebSocketDebuggerURL != "" && len(toEval) < chatPreviewTabsMax {
			toEval = append(toEval, previewJob{idx: idx, ws: t.WebSocketDebuggerURL})
		}
	}
	fillChatPreviews(out, toEval)
	return out
}

func fillChatPreviews(tabs []entitlementTab, jobs []previewJob) {
	if len(jobs) == 0 || len(tabs) == 0 {
		return
	}
	deadline := time.Now().Add(chatPreviewBudget)
	var wg sync.WaitGroup
	for _, job := range jobs {
		if time.Now().After(deadline) {
			break
		}
		job := job
		wg.Add(1)
		go func() {
			defer wg.Done()
			remain := time.Until(deadline)
			if remain <= 0 {
				return
			}
			to := cdpEvalTimeout
			if remain < to {
				to = remain
			}
			msgs := fetchChatMessagesCDP(job.ws, to)
			if len(msgs) == 0 {
				return
			}
			tabs[job.idx].Messages = msgs
			tabs[job.idx].Preview = previewFromMessages(msgs)
		}()
	}
	wg.Wait()
}

// DOM scrape — message bodies only. Hard-capped; no cookies/tokens/debugger URLs.
const chatBodyEvalExpr = `(() => {
  const N = 5;
  const MAX = 160;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const clip = (s) => s.length > MAX ? s.slice(0, MAX - 1) + '\u2026' : s;
  const out = [];
  const push = (s) => {
    s = clean(s);
    if (!s || s.length < 2) return;
    if (out.length && out[out.length - 1] === s) return;
    out.push(clip(s));
  };
  const prefer = [
    '[data-message-author-role]',
    '[data-testid="conversation-turn"]',
    '[data-testid="message"]',
    '[data-testid="messageText"]',
    '[data-testid="tweetText"]',
    'div[class*="message-bubble"]',
    'div[class*="Message"]',
    '.markdown',
    '.prose',
  ];
  for (const sel of prefer) {
    const nodes = document.querySelectorAll(sel);
    if (!nodes || !nodes.length) continue;
    for (const el of nodes) push(el.innerText || el.textContent || '');
    if (out.length) return out.slice(-N);
  }
  // Fallback: last chunks of main/article (login or sparse DOM).
  const roots = document.querySelectorAll('main, article, [role="main"]');
  for (const root of roots) {
    const t = clean(root.innerText || root.textContent || '');
    if (!t) continue;
    const parts = t.split(/(?<=[.!?])\s+/).filter((p) => p.length > 8);
    const pick = (parts.length ? parts : [t]).slice(-N);
    for (const p of pick) push(p);
    if (out.length) break;
  }
  return out.slice(-N);
})()`

func fetchChatMessagesCDP(wsURL string, timeout time.Duration) []string {
	if wsURL == "" || timeout <= 0 {
		return nil
	}
	u, err := url.Parse(wsURL)
	if err != nil || u == nil {
		return nil
	}
	if u.Scheme != "ws" && u.Scheme != "http" {
		return nil
	}
	host := u.Hostname()
	if host != "127.0.0.1" && host != "localhost" && host != "::1" {
		return nil
	}
	raw, err := cdpRuntimeEvaluate(wsURL, chatBodyEvalExpr, timeout)
	if err != nil || len(raw) == 0 {
		return nil
	}
	return parseChatMessagesValue(raw)
}

func parseChatMessagesValue(raw json.RawMessage) []string {
	var wrap struct {
		Result struct {
			Type  string          `json:"type"`
			Value json.RawMessage `json:"value"`
		} `json:"result"`
		ExceptionDetails json.RawMessage `json:"exceptionDetails"`
	}
	if json.Unmarshal(raw, &wrap) != nil {
		return nil
	}
	if len(wrap.ExceptionDetails) > 0 && string(wrap.ExceptionDetails) != "null" {
		return nil
	}
	var msgs []string
	if json.Unmarshal(wrap.Result.Value, &msgs) != nil {
		return nil
	}
	out := make([]string, 0, len(msgs))
	for _, m := range msgs {
		t := truncateChatText(m, chatPreviewCharsMax)
		if t == "" {
			continue
		}
		out = append(out, t)
		if len(out) >= chatPreviewMsgMax {
			break
		}
	}
	return out
}

func cdpRuntimeEvaluate(wsURL, expression string, timeout time.Duration) (json.RawMessage, error) {
	conn, err := dialCDPWebSocket(wsURL, timeout)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))

	req := map[string]any{
		"id":     1,
		"method": "Runtime.evaluate",
		"params": map[string]any{
			"expression":    expression,
			"returnByValue": true,
			"awaitPromise":  true,
		},
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	if err := wsWriteText(conn, payload); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		_ = conn.SetReadDeadline(deadline)
		msg, err := wsReadMessage(conn)
		if err != nil {
			return nil, err
		}
		var env struct {
			ID     int             `json:"id"`
			Result json.RawMessage `json:"result"`
			Error  json.RawMessage `json:"error"`
		}
		if json.Unmarshal(msg, &env) != nil {
			continue
		}
		if env.ID != 1 {
			continue
		}
		if len(env.Error) > 0 && string(env.Error) != "null" {
			return nil, fmt.Errorf("cdp error")
		}
		return env.Result, nil
	}
	return nil, fmt.Errorf("cdp timeout")
}

func dialCDPWebSocket(wsURL string, timeout time.Duration) (net.Conn, error) {
	u, err := url.Parse(wsURL)
	if err != nil {
		return nil, err
	}
	host := u.Host
	if !strings.Contains(host, ":") {
		host += ":80"
	}
	path := u.RequestURI()
	if path == "" {
		path = "/"
	}
	d := net.Dialer{Timeout: timeout}
	conn, err := d.Dial("tcp", host)
	if err != nil {
		return nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(timeout))

	key := make([]byte, 16)
	if _, err := rand.Read(key); err != nil {
		conn.Close()
		return nil, err
	}
	secKey := base64.StdEncoding.EncodeToString(key)
	req := fmt.Sprintf(
		"GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n",
		path, u.Host, secKey,
	)
	if _, err := io.WriteString(conn, req); err != nil {
		conn.Close()
		return nil, err
	}
	br := make([]byte, 0, 1024)
	buf := make([]byte, 256)
	for !strings.Contains(string(br), "\r\n\r\n") {
		n, err := conn.Read(buf)
		if n > 0 {
			br = append(br, buf[:n]...)
		}
		if err != nil {
			conn.Close()
			return nil, err
		}
		if len(br) > 8192 {
			conn.Close()
			return nil, fmt.Errorf("handshake too large")
		}
	}
	head := string(br)
	if !strings.Contains(head, " 101 ") && !strings.HasPrefix(head, "HTTP/1.1 101") && !strings.HasPrefix(head, "HTTP/1.0 101") {
		conn.Close()
		return nil, fmt.Errorf("ws upgrade failed")
	}
	return conn, nil
}

func wsWriteText(conn net.Conn, payload []byte) error {
	mask := make([]byte, 4)
	if _, err := rand.Read(mask); err != nil {
		return err
	}
	h := []byte{0x81}
	n := len(payload)
	switch {
	case n < 126:
		h = append(h, byte(0x80|n))
	case n < 65536:
		h = append(h, 0x80|126, byte(n>>8), byte(n))
	default:
		var lb [8]byte
		binary.BigEndian.PutUint64(lb[:], uint64(n))
		h = append(h, 0x80|127)
		h = append(h, lb[:]...)
	}
	h = append(h, mask...)
	masked := make([]byte, n)
	for i := 0; i < n; i++ {
		masked[i] = payload[i] ^ mask[i%4]
	}
	_, err := conn.Write(append(h, masked...))
	return err
}

func wsReadMessage(conn net.Conn) ([]byte, error) {
	var out []byte
	for {
		h := make([]byte, 2)
		if _, err := io.ReadFull(conn, h); err != nil {
			return nil, err
		}
		fin := h[0]&0x80 != 0
		opcode := h[0] & 0x0f
		masked := h[1]&0x80 != 0
		n := int(h[1] & 0x7f)
		switch n {
		case 126:
			var ext [2]byte
			if _, err := io.ReadFull(conn, ext[:]); err != nil {
				return nil, err
			}
			n = int(binary.BigEndian.Uint16(ext[:]))
		case 127:
			var ext [8]byte
			if _, err := io.ReadFull(conn, ext[:]); err != nil {
				return nil, err
			}
			n64 := binary.BigEndian.Uint64(ext[:])
			if n64 > 1<<20 {
				return nil, fmt.Errorf("frame too large")
			}
			n = int(n64)
		}
		var mask [4]byte
		if masked {
			if _, err := io.ReadFull(conn, mask[:]); err != nil {
				return nil, err
			}
		}
		payload := make([]byte, n)
		if n > 0 {
			if _, err := io.ReadFull(conn, payload); err != nil {
				return nil, err
			}
		}
		if masked {
			for i := 0; i < n; i++ {
				payload[i] ^= mask[i%4]
			}
		}
		switch opcode {
		case 0x1, 0x2, 0x0:
			out = append(out, payload...)
			if fin {
				return out, nil
			}
		case 0x8:
			return nil, io.EOF
		case 0x9:
			_ = wsWriteControl(conn, 0xA, payload)
		case 0xA:
		default:
			if fin && len(out) > 0 {
				return out, nil
			}
		}
	}
}

func wsWriteControl(conn net.Conn, opcode byte, payload []byte) error {
	if len(payload) > 125 {
		payload = payload[:125]
	}
	mask := make([]byte, 4)
	if _, err := rand.Read(mask); err != nil {
		return err
	}
	h := []byte{0x80 | opcode, byte(0x80 | len(payload))}
	h = append(h, mask...)
	masked := make([]byte, len(payload))
	for i := range payload {
		masked[i] = payload[i] ^ mask[i%4]
	}
	_, err := conn.Write(append(h, masked...))
	return err
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
