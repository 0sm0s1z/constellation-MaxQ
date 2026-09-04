// MaxQ thin settings sheet (compiled from sheet.ts; no framework).
"use strict";

let activePage = "overview";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}

async function postJSON(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    let extra = "";
    try {
      const j = await r.json();
      extra = j.error ? ": " + j.error : "";
    } catch {
      extra = "";
    }
    throw new Error(path + " " + r.status + extra);
  }
  try {
    return await r.json();
  } catch {
    return {};
  }
}

function showMsg(text) {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text;
}

function formatBytes(v) {
  if (!Number.isFinite(v) || v < 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return n.toFixed(i < 2 ? 0 : 1) + " " + units[i];
}

function setPage(name) {
  activePage = name;
  document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el.dataset.page === name));
  document.querySelectorAll(".page").forEach((el) => el.classList.toggle("active", el.dataset.pagePanel === name));
  if (name === "resources") refreshResources().catch(showError);
  if (name === "triggers") refreshTriggers().catch(showError);
}

function showError(e) {
  showMsg(e instanceof Error ? e.message : String(e));
}

function renderStatus(s) {
  $("st-state").textContent = s.state;
  $("st-theme").textContent = s.theme;
  $("theme-current").textContent = s.theme;
  const g = s.gost.enabled ? "enabled" : "off";
  const run = s.gost.running ? "running" : "stopped";
  $("st-gost").textContent = g + " / " + run;
  const bits = [s.clis.installed, s.clis.preexisting].filter((x) => x && x.length);
  $("st-clis").textContent = bits.join(" ") || "—";
  $("st-api").textContent = s.api.listen;
  $("proxy-listen").value = s.gost.listen || "127.0.0.1:8080";
  $("proxy-upstream").value = s.gost.upstream || "";
  $("proxy-iface").value = s.gost.iface || "";
  $("proxy-intercept").checked = !!s.gost.intercept;
  $("proxy-runtime").textContent = "enabled=" + !!s.gost.enabled + " / running=" + !!s.gost.running + " / intercept=" + !!s.gost.intercept;
  $("fw-mode").textContent = s.listen_policy.mode;
  $("fw-api").textContent = s.listen_policy.api;
  $("fw-ports").textContent = s.listen_policy.ports_opened ? "opened" : "none opened";
  $("vault-note").textContent = s.vault.note;
  $("oauth-note").textContent = s.oauth.note;
  $("skills-root").textContent = s.skills.root;
  const skillList = $("skills-list");
  skillList.textContent = s.skills.packs && s.skills.packs.length ? s.skills.packs.join(", ") : "No skill packs installed.";
  const pill = $("pill");
  pill.textContent = s.state;
  pill.className = "pill " + (s.state === "applied" ? "on" : "off");
}

async function refreshStatus() {
  renderStatus(await getJSON("/status"));
}

function renderResources(r) {
  const h = r.host;
  $("res-cpu").textContent = h.cpu_used_percent.toFixed(1) + "% used / " + h.cpu_available_percent.toFixed(1) + "% available (" + h.cpu_total_cores + " cores)";
  $("res-ram").textContent = formatBytes(h.ram_used_bytes) + " used / " + formatBytes(h.ram_available_bytes) + " available / " + formatBytes(h.ram_total_bytes) + " total";
  $("res-swap").textContent = h.no_swap ? "none" : formatBytes(h.swap_used_bytes) + " used / " + formatBytes(h.swap_total_bytes) + " total";

  const body = $("chrome-rows");
  body.replaceChildren();
  (r.chrome || []).forEach((c) => {
    const tr = document.createElement("tr");
    const display = document.createElement("td");
    display.textContent = c.display;
    if (c.this_agent) {
      const badge = document.createElement("span");
      badge.className = "badge me";
      badge.textContent = "this agent";
      display.append(" ", badge);
    }
    const profile = document.createElement("td");
    profile.textContent = c.profile;
    const rss = document.createElement("td");
    rss.textContent = formatBytes(c.rss_bytes);
    const procs = document.createElement("td");
    procs.textContent = String(c.process_count);
    tr.append(display, profile, rss, procs);
    body.append(tr);
  });
  if (!(r.chrome || []).length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No matching DISPLAY + chrome-profile-N groups found.";
    tr.append(td);
    body.append(tr);
  }
  $("agent-chrome-note").textContent = r.agent.note + (r.agent.display ? " (" + r.agent.display + " / " + (r.agent.profile || "no profile") + ")" : "");
  $("btn-chrome-trim").disabled = !r.agent.mutable;
  $("btn-chrome-restart").disabled = !r.agent.mutable;
}

async function refreshResources() {
  renderResources(await getJSON("/resources"));
}

function renderTriggers(t) {
  $("hook-state").textContent = t.webhook_configured ? "configured: " + (t.webhook_hint || "HTTPS destination") : "not configured — hooks disabled";
  const body = $("trigger-rows");
  body.replaceChildren();
  (t.triggers || []).forEach((trigger) => {
    const tr = document.createElement("tr");
    const id = document.createElement("td");
    id.textContent = trigger.id;
    const kind = document.createElement("td");
    kind.textContent = trigger.kind;
    const spec = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = trigger.spec;
    spec.append(code);
    const last = document.createElement("td");
    last.textContent = trigger.last_fire || "—";
    const enabled = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "mini";
    btn.textContent = trigger.enabled ? "on" : "off";
    btn.addEventListener("click", () => act(async () => {
      await postJSON("/triggers/enable", { id: trigger.id, enabled: !trigger.enabled });
      await refreshTriggers();
    }, false));
    enabled.append(btn);
    tr.append(id, kind, spec, last, enabled);
    body.append(tr);
  });
}

async function refreshTriggers() {
  renderTriggers(await getJSON("/triggers"));
}

const actionButtons = [
  "btn-apply", "btn-revert", "btn-proxy-save", "btn-proxy-on", "btn-proxy-off",
  "btn-chrome-trim", "btn-chrome-restart", "btn-hook-set", "btn-hook-clear",
  "btn-hook-test", "btn-trigger-add",
];

function busy(on) {
  actionButtons.forEach((id) => {
    const b = $(id);
    if (on) {
      b.dataset.wasDisabled = b.disabled ? "1" : "0";
      b.disabled = true;
    } else if (b.dataset.wasDisabled !== "1") {
      b.disabled = false;
    }
  });
}

async function act(fn, refreshAfter = true) {
  showMsg("");
  busy(true);
  try {
    await fn();
    if (refreshAfter) await refreshStatus();
  } catch (e) {
    showError(e);
  } finally {
    busy(false);
    if (activePage === "resources") refreshResources().catch(showError);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab").forEach((el) => el.addEventListener("click", () => setPage(el.dataset.page)));

  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => act(() => postJSON("/revert", {}), false));
  $("btn-proxy-save").addEventListener("click", () => act(() => postJSON("/proxy", {
    listen: $("proxy-listen").value,
    upstream: $("proxy-upstream").value,
    iface: $("proxy-iface").value,
    intercept: $("proxy-intercept").checked,
  })));
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));

  $("btn-chrome-trim").addEventListener("click", () => act(() => postJSON("/resources/chrome", { action: "trim" }), false));
  $("btn-chrome-restart").addEventListener("click", () => act(() => postJSON("/resources/chrome", { action: "restart" }), false));

  $("btn-hook-set").addEventListener("click", () => act(async () => {
    await postJSON("/triggers/webhook", { url: $("hook-url").value });
    $("hook-url").value = "";
    await refreshTriggers();
  }, false));
  $("btn-hook-clear").addEventListener("click", () => act(async () => {
    await postJSON("/triggers/webhook", { url: "" });
    $("hook-url").value = "";
    await refreshTriggers();
  }, false));
  $("btn-hook-test").addEventListener("click", () => act(() => postJSON("/triggers/test", {}), false));
  $("btn-trigger-add").addEventListener("click", () => act(async () => {
    await postJSON("/triggers/add", {
      id: $("trigger-id").value,
      kind: $("trigger-kind").value,
      spec: $("trigger-spec").value,
      enabled: true,
    });
    $("trigger-id").value = "";
    $("trigger-spec").value = "";
    await refreshTriggers();
  }, false));

  Promise.all([refreshStatus(), refreshResources(), refreshTriggers()]).catch(showError);
  window.setInterval(() => {
    if (activePage === "resources") refreshResources().catch(showError);
    if (activePage === "triggers") refreshTriggers().catch(showError);
  }, 5000);
});
