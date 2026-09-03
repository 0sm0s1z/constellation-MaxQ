# MaxQ installer tasks

v0: 1-13, 18-19.

- [x] **1.** Persist layout: HOME/bin, HOME/.config/maxq, HOME/.local
- [x] **2.** Curl installer + maxq CLI
- [x] **3.** Desired-state reconciler (post Update)
- [x] **4.** Shell profile (PATH, kickoff)
- [ ] **5.** Identity: hostname grokbot
- [x] **6.** Catppuccin Mocha system theme (wallpaper + GTK/cursor; latte flag later)
- [x] **7.** Ghostty Mocha config (binary skipped: no official linux amd64)
- [x] **8.** Chrome Mocha theme files + store id (no managed proxy policies)
- [x] **9.** Operator CLIs: herdr, fx, grok, codex, claude, opencode, tailscale
- [ ] **10.** herdr supervises MaxQ daemons
- [x] **11.** GOST local proxy (CONNECT + MITM)
- [x] **12.** MaxQ CA (persist under HOME; trust install documented, not auto)
- [x] **13.** Proxy controls: enable/disable, upstream, outbound interface/tunnel
- [ ] **14.** Tailscale/EVA Headscale operator hop
- [ ] **15.** SSH server on operator net
- [ ] **16.** VNC server on operator net
- [ ] **17.** Firewall / listen-policy
- [x] **18.** Go control API
- [x] **19.** Thin TypeScript settings sheet
- [ ] **20.** Settings pages: theme, proxy, firewall, vault, OAuth, skills, resources, triggers
- [ ] **21.** Credential vault (shared bot accounts)
- [ ] **22.** OAuth seating (Grok Build, etc.)
- [ ] **23.** Account seating / session persist / computer-use reauth
- [ ] **24.** Setup skill (first-run, config, updates, webhook URL)
- [ ] **25.** Skill pack: save tokens
- [ ] **26.** Skill pack: persist/wipe
- [ ] **27.** Skill pack: gh vs UI vs SSH vs API
- [ ] **28.** Skill pack catalog in settings
- [ ] **29.** GitHub SSH key seating
- [ ] **30.** README / homepage copy
- [ ] **31.** Resource monitor/manager in settings: host RAM/CPU (used vs available, no swap), per-display Chrome RSS, this-agent Chrome trim/restart only. Never signal other agents' Chrome. Isolation is DISPLAY + chrome-profile-N on a shared UNIX user.
- [ ] **32.** Trigger/hook engine: persist-safe scheduler + probes; user-visible; cron/schedule is a first-class trigger kind
- [ ] **33.** Dynamic webhook dest: `$HOME/.config/maxq/hooks.toml` (never in git). First-run setup + settings. Empty disables hooks
- [ ] **34.** Settings Triggers page: list, enable, last-fire, set webhook URL, add cron or shell probe
- [ ] **35.** Builtin resource probe: MemAvailable/used%; webhook `warning resource limits exhausted: OOM` with cooldown
- [x] **49.** Desktops workspace: `/desktops` is a full-viewport Catppuccin Mocha operator destination with Global paged live noVNC feed and Crew single-desktop view, slim CPU/RAM/load/MaxQ/GOST/DISPLAY telemetry, persisted visible-count preference, and a hard UI cap that creates RFB streams only for the visible carousel page. Viewer host is always `window.location.hostname`; :1 uses 6080 without a token, :2-:15 use 6081 with encoded websockify token paths.
