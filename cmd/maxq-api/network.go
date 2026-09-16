package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	networkModeTailscale = "tailscale"
	networkModeHeadscale = "headscale"
	// Tailscale's hosted control plane. Only used when explicitly switching
	// back from Headscale; a fresh/default Tailscale save still runs plain
	// `tailscale up`, preserving the existing client behavior.
	tailscaleHostedLoginServer = "https://controlplane.tailscale.com"
)

type networkInputError struct{ message string }

func (e networkInputError) Error() string { return e.message }

type networkJoinError struct{ err error }

func (e networkJoinError) Error() string { return e.err.Error() }
func (e networkJoinError) Unwrap() error { return e.err }

type networkConfig struct {
	Mode        string
	LoginServer string
}

type networkState struct {
	Mode              string `json:"mode"`
	LoginServer       string `json:"login_server"`
	AuthKeyConfigured bool   `json:"auth_key_configured"`
}

type networkUpdateReq struct {
	Mode         string  `json:"mode"`
	LoginServer  string  `json:"login_server"`
	AuthKey      *string `json:"auth_key,omitempty"`
	ClearAuthKey bool    `json:"clear_auth_key,omitempty"`
}

func (s *server) networkPath() string     { return filepath.Join(s.config, "network.toml") }
func (s *server) networkAuthPath() string { return filepath.Join(s.config, "network.authkey") }

func (s *server) loadNetworkConfig() (networkConfig, error) {
	path := s.networkPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return networkConfig{Mode: networkModeTailscale}, nil
	} else if err != nil {
		return networkConfig{}, err
	}

	cfg := networkConfig{
		Mode:        strings.ToLower(strings.TrimSpace(sec(path, "network", "mode"))),
		LoginServer: strings.TrimSpace(sec(path, "network", "login_server")),
	}
	if cfg.Mode != networkModeTailscale && cfg.Mode != networkModeHeadscale {
		return networkConfig{}, fmt.Errorf("invalid network.mode %q in %s", cfg.Mode, path)
	}
	if cfg.LoginServer != "" {
		normalized, err := normalizeLoginServer(cfg.LoginServer)
		if err != nil {
			return networkConfig{}, fmt.Errorf("invalid network.login_server in %s: %w", path, err)
		}
		cfg.LoginServer = normalized
	}
	if cfg.Mode == networkModeHeadscale && cfg.LoginServer == "" {
		return networkConfig{}, fmt.Errorf("headscale mode requires login_server in %s", path)
	}
	return cfg, nil
}

func normalizeLoginServer(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("login_server is required")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" || u.User != nil {
		return "", fmt.Errorf("login_server must be an http(s) URL without credentials")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("login_server must use http or https")
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("login_server must not include a query or fragment")
	}
	u.Path = strings.TrimRight(u.Path, "/")
	return strings.TrimRight(u.String(), "/"), nil
}

func (s *server) saveNetworkConfig(cfg networkConfig) error {
	if cfg.Mode != networkModeTailscale && cfg.Mode != networkModeHeadscale {
		return fmt.Errorf("invalid network mode %q", cfg.Mode)
	}
	if cfg.Mode == networkModeHeadscale && strings.TrimSpace(cfg.LoginServer) == "" {
		return fmt.Errorf("headscale mode requires login_server")
	}
	if err := os.MkdirAll(s.config, 0700); err != nil {
		return err
	}
	content := fmt.Sprintf(`# constellation-MaxQ network control plane (managed by MaxQ settings)
# Tailscale is the default. Headscale requires an operator-supplied login server.
# Authentication material is stored separately in network.authkey and is never written here.

[network]
mode = %q
login_server = %q
`, cfg.Mode, cfg.LoginServer)
	return writePrivateFileAtomic(s.config, "network-*.tmp", s.networkPath(), []byte(content))
}

func writePrivateFileAtomic(dir, pattern, dest string, content []byte) error {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, dest)
}

func (s *server) saveNetworkAuthKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("auth_key must not be empty; use clear_auth_key to remove the stored key")
	}
	return writePrivateFileAtomic(s.config, "network-auth-*.tmp", s.networkAuthPath(), []byte(key+"\n"))
}

func (s *server) clearNetworkAuthKey() error {
	err := os.Remove(s.networkAuthPath())
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func (s *server) networkAuthConfigured() bool {
	info, err := os.Stat(s.networkAuthPath())
	return err == nil && info.Mode().IsRegular() && info.Size() > 0
}

func (s *server) networkState(cfg networkConfig) networkState {
	return networkState{
		Mode:              cfg.Mode,
		LoginServer:       cfg.LoginServer,
		AuthKeyConfigured: s.networkAuthConfigured(),
	}
}

func (s *server) applyNetworkUpdate(req networkUpdateReq) (networkState, error) {
	current, err := s.loadNetworkConfig()
	if err != nil {
		return networkState{}, err
	}
	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode != networkModeTailscale && mode != networkModeHeadscale {
		return networkState{}, networkInputError{message: "mode must be tailscale or headscale"}
	}
	if req.AuthKey != nil && req.ClearAuthKey {
		return networkState{}, networkInputError{message: "auth_key and clear_auth_key cannot be used together"}
	}
	if req.AuthKey != nil && strings.TrimSpace(*req.AuthKey) == "" {
		return networkState{}, networkInputError{message: "auth_key must not be empty; use clear_auth_key to remove the stored key"}
	}

	next := current
	next.Mode = mode
	loginServer := strings.TrimSpace(req.LoginServer)
	if mode == networkModeHeadscale {
		if loginServer == "" {
			return networkState{}, networkInputError{message: "headscale mode requires login_server; refusing to fall back to Tailscale SaaS"}
		}
		next.LoginServer, err = normalizeLoginServer(loginServer)
		if err != nil {
			return networkState{}, networkInputError{message: err.Error()}
		}
	} else if loginServer != "" {
		next.LoginServer, err = normalizeLoginServer(loginServer)
		if err != nil {
			return networkState{}, networkInputError{message: err.Error()}
		}
	}

	if err := s.saveNetworkConfig(next); err != nil {
		return networkState{}, err
	}
	if req.ClearAuthKey {
		if err := s.clearNetworkAuthKey(); err != nil {
			return networkState{}, fmt.Errorf("failed to clear network auth key: %w", err)
		}
	} else if req.AuthKey != nil {
		if err := s.saveNetworkAuthKey(*req.AuthKey); err != nil {
			return networkState{}, networkInputError{message: err.Error()}
		}
	}

	args := []string{"up"}
	if next.Mode == networkModeHeadscale {
		args = append(args, "--login-server="+next.LoginServer)
		if s.networkAuthConfigured() {
			args = append(args, "--auth-key=file:"+s.networkAuthPath())
		}
	} else if current.Mode == networkModeHeadscale {
		args = append(args, "--login-server="+tailscaleHostedLoginServer)
	}
	if err := s.runTailscale(args...); err != nil {
		return s.networkState(next), networkJoinError{err: err}
	}
	return s.networkState(next), nil
}

var tailscaleCommandRunner func(*server, ...string) error

func (s *server) runTailscale(args ...string) error {
	if tailscaleCommandRunner != nil {
		return tailscaleCommandRunner(s, args...)
	}
	bin := filepath.Join(s.prefix, "bin", "tailscale")
	if info, err := os.Stat(bin); err != nil || info.IsDir() {
		path, lookErr := exec.LookPath("tailscale")
		if lookErr != nil {
			return fmt.Errorf("tailscale binary not found; run maxq apply first")
		}
		bin = path
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, bin, args...)
	out, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return fmt.Errorf("tailscale up timed out")
	}
	if err != nil {
		msg := s.redactNetworkSecret(strings.TrimSpace(string(out)))
		if len(msg) > 800 {
			msg = msg[:800]
		}
		if msg == "" {
			return fmt.Errorf("tailscale up failed: %v", err)
		}
		return fmt.Errorf("tailscale up failed: %v: %s", err, msg)
	}
	return nil
}

func (s *server) redactNetworkSecret(message string) string {
	b, err := os.ReadFile(s.networkAuthPath())
	if err != nil {
		return message
	}
	secret := strings.TrimSpace(string(b))
	if secret == "" {
		return message
	}
	return strings.ReplaceAll(message, secret, "[redacted]")
}
