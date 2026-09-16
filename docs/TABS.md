# Browser tab hygiene

MaxQ provides a HOME-only Chrome tab helper at `$HOME/bin/maxq-tabs`, surfaced as `maxq tabs ...`. It talks only to a loopback Chrome DevTools Protocol (CDP) endpoint associated with the current MaxQ Chrome profile / `DISPLAY`. It does not rewrite `/usr/local/bin/box-chrome`, add managed Chrome policy, or kill Chrome windows/processes.

## Commands

```bash
maxq tabs list
maxq tabs prune
maxq tabs prune --dry-run
maxq tabs prune --task-url https://example.com/current-task
maxq tabs prune --task-url https://example.com/current-task --keep-host docs.example.com
```

`list` prints current page targets. `prune` has two safety modes:

- Without `--task-url`, pruning is conservative: close exact duplicate URLs and idle blank/new-tab targets only. If those are the only tabs, one remains open.
- With `--task-url`, MaxQ keeps one matching task-host tab, one ChatGPT tab, one GitHub tab, any requested `--keep-host` tabs, and non-web internal pages that are unsafe to classify as leftovers. Other web page targets are eligible for closing. If the supplied task URL is not actually open, MaxQ falls back to conservative pruning instead of guessing.

Use `--no-chatgpt` or `--no-github` only when those optional keep-tabs are not desired.

## CDP discovery and failure behavior

MaxQ first honors an explicit `--cdp-url` or `MAXQ_CDP_URL`, but accepts loopback HTTP endpoints only. Otherwise it looks for `DevToolsActivePort` under the current MaxQ profile (`$HOME/chrome-profile-N`, or the allowed `CHROME_USER_DATA_DIR`) and then inspects same-user Chrome process arguments only when the process `DISPLAY` matches the current `DISPLAY` and its `--user-data-dir` is an allowed MaxQ profile.

If no current-display CDP endpoint is available, `list` / `prune` print a diagnostic, change nothing, and exit successfully. This keeps browser hygiene opportunistic rather than making automation fail because Chrome debugging is unavailable.

## Automation handoff

Agents should invoke tab hygiene at the end of `browserUse` / `computerUse` browser work, while they still know the active task URL:

```bash
maxq tabs prune --task-url "$ACTIVE_TASK_URL"
```

This is intentionally **not** invoked by `maxq apply` or `maxq-reconcile`. Apply/reconcile restore desired state but do not have task context, so automatic pruning there could close an intentional user tab.

A future settings toggle may choose whether browser automation performs this end-of-task call automatically. The helper itself is safe to call repeatedly and is suitable for that integration point.

## Proof / smoke

The helper uses only the Python standard library. Its smoke test creates a temporary loopback fake-CDP server and verifies planning plus list/close behavior without PIL or graphical dependencies:

```bash
maxq tabs selftest
```

Top-level `maxq prove` also runs this self-test before the final #69 graphical release gate.
