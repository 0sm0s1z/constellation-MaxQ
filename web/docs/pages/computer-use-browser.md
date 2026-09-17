# Computer-use browser

MaxQ can select Camoufox as the headed browser for computer-use sessions on no-GPU boxes. This is a browser binary choice for GUI mouse and keyboard control. It is not Playwright, SeleniumBase, CDP, or CAPTCHA-solving automation.

## Why Camoufox

On the proved box class, stock headed Chrome exposed SwiftShader Subzero because `/dev/dri` was absent. Cloudflare Turnstile demos stayed blocked after real GUI clicks.

Camoufox `0.5.6` with browser `v152.0.4-beta.30`, headed on Xvfb and driven by GUI clicks, passed both test-key Turnstile demos. A production ChatGPT follow-up showed no Turnstile interstitial; the remaining gate was account MFA.

This is evidence for the browser and fingerprint axis. Test sitekeys are softer than production. Re-prove against the production target when the environment changes.

## Install the binary

```bash
python3 -m venv ~/.cache/camoufox-venv
~/.cache/camoufox-venv/bin/pip install -U camoufox
~/.cache/camoufox-venv/bin/python -m camoufox fetch
```

The binary lands under `~/.cache/camoufox/browsers/official/*/camoufox-bin`. Override discovery with `MAXQ_CAMOUFOX_BIN`.

## Selection

`maxq-open-site` reads `MAXQ_BROWSER`:

| Value | Behavior |
| --- | --- |
| `auto` | On boxes without `/dev/dri`, use Camoufox for ChatGPT, Grok, Claude, and `ai`; otherwise use box Chrome. |
| `camoufox` | Use Camoufox for every site opened through the launcher. |
| `chrome` | Use box Chrome. |

Discord, Slack, and Settings remain on Chrome under `auto`.

## Profiles and locale

Camoufox uses `$HOME/.config/maxq/camoufox-profile` on `:1`, or a display-suffixed profile elsewhere. It never reuses a Chrome profile. Override with `MAXQ_CAMOUFOX_PROFILE`.

Locale precedence is `MAXQ_CAMOUFOX_LOCALE`, then `LC_MESSAGES` or `LANG`, then `en-US` for unset, `C`, or `POSIX` environments.

## Dry run

```bash
MAXQ_OPEN_SITE_DRY_RUN=1 maxq-open-site ai
MAXQ_CAMOUFOX_DRY_RUN=1 maxq-camoufox https://example.com
```

If no binary is fetched, the launcher exits with an install hint.

## Safety

Do not restore Chrome managed proxy policy, enable GOST by default, kill sand-owned displays, or rewrite `/usr/local/bin/box-chrome`. Camoufox does not remove MFA or account authentication requirements.
