// MaxQ thin settings sheet (TypeScript, no framework).
type Gost = { enabled: boolean; running: boolean; listen: string; upstream: string; iface: string; intercept: boolean };
type Status = {
  state: string;
  theme: string;
  gost: Gost;
  clis: { installed: string; skipped: string; preexisting: string };
  api: { listen: string };
  listen_policy: { mode: string; api: string; ports_opened: boolean; daemon: boolean };
  vault: { state: string; path: string; note: string };
  oauth: { state: string; path: string; note: string };
  skills: { state: string; root: string; packs: string[]; note: string };
};
type Resources = {
  host: {
    cpu_used_percent: number; cpu_available_percent: number; cpu_total_cores: number;
    ram_used_bytes: number; ram_available_bytes: number; ram_total_bytes: number;
    swap_used_bytes: number; swap_total_bytes: number; no_swap: boolean;
  };
  chrome: Array<{ display: string; profile: string; profile_path: string; rss_bytes: number; process_count: number; this_agent: boolean }>;
  agent: { display: string; profile: string; profile_path: string; rss_bytes: number; process_count: number; mutable: boolean; note: string };
};
type Trigger = { id: string; kind: "schedule" | "probe"; spec: string; enabled: boolean; builtin?: boolean; last_fire: string };
type Triggers = { worker: string; timezone: string; webhook_configured: boolean; webhook_hint: string; triggers: Trigger[] };

let activePage = "overview";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
};

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json() as Promise<T>;
}

async function postJSON(path: string, body: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!r.ok) {
    let extra = "";
    try {
      const j = (await r.json()) as { error?: string };
      extra = j.error ? ": " + j.error : "";
    } catch { extra = ""; }
    throw new Error(path + " " + r.status + extra);
  }
  try { return await r.json() as Record<string, unknown>; } catch { return {}; }
}

function showMsg(text: string): void {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text;
}

function showError(e: unknown): void { showMsg(e instanceof Error ? e.message : String(e)); }

function formatBytes(v: number): string {
  if (!Number.isFinite(v) || v < 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return n.toFixed(i < 2 ? 0 : 1) + " " + units[i];
}

function setPage(name: string): void {
  activePage = name;
  document.querySelectorAll<HTMLElement>(".tab").forEach((el) => el.classList.toggle("active", el.dataset.page === name));
  document.querySelectorAll<HTMLElement>(".page").forEach((el) => el.classList.toggle("active", el.dataset.pagePanel === name));
  if (name === "resources") refreshResources().catch(showError);
  if (name === "triggers") refreshTriggers().catch(showError);
}

function renderStatus(s: Status): void {
  $("st-state").textContent = s.state;
  $("st-theme").textContent = s.theme;
  $("theme-current").textContent = s.theme;
  $("st-gost").textContent = (s.gost.enabled ? "enabled" : "off") + " / " + (s.gost.running ? "running" : "stopped");
  const bits = [s.clis.installed, s.clis.preexisting].filter(Boolean);
  $("st-clis").textContent = bits.join(" ") || "—";
  $("st-api").textContent = s.api.listen;
  ( $("proxy-listen") as HTMLInputElement).value = s.gost.listen || "127.0.0.1:8080";
  ( $("proxy-upstream") as HTMLInputElement).value = s.gost.upstream || "";
  ( $("proxy-iface") as HTMLInputElement).value = s.gost.iface || "";
  ( $("proxy-intercept") as HTMLInputElement).checked = !!s.gost.intercept;
  $("proxy-runtime").textContent = `enabled=${!!s.gost.enabled} / running=${!!s.gost.running} / intercept=${!!s.gost.intercept}`;
  $("fw-mode").textContent = s.listen_policy.mode;
  $("fw-api").textContent = s.listen_policy.api;
  $("fw-ports").textContent = s.listen_policy.ports_opened ? "opened" : "none opened";
  $("vault-note").textContent = s.vault.note;
  $("oauth-note").textContent = s.oauth.note;
  $("skills-root").textContent = s.skills.root;
  $("skills-list").textContent = s.skills.packs.length ? s.skills.packs.join(", ") : "No skill packs installed.";
  const pill = $("pill");
  pill.textContent = s.state;
  pill.className = "pill " + (s.state === "applied" ? "on" : "off");
}

async function refreshStatus(): Promise<void> { renderStatus(await getJSON<Status>("/status")); }

function renderResources(r: Resources): void {
  const h = r.host;
  $("res-cpu").textContent = `${h.cpu_used_percent.toFixed(1)}% used / ${h.cpu_available_percent.toFixed(1)}% available (${h.cpu_total_cores} cores)`;
  $("res-ram").textContent = `${formatBytes(h.ram_used_bytes)} used / ${formatBytes(h.ram_available_bytes)} available / ${formatBytes(h.ram_total_bytes)} total`;
  $("res-swap").textContent = h.no_swap ? "none" : `${formatBytes(h.swap_used_bytes)} used / ${formatBytes(h.swap_total_bytes)} total`;
  const body = $("chrome-rows");
  body.replaceChildren();
  r.chrome.forEach((c) => {
    const tr = document.createElement("tr");
    const display = document.createElement("td");
    display.textContent = c.display;
    if (c.this_agent) {
      const badge = document.createElement("span");
      badge.className = "badge me";
      badge.textContent = "this agent";
      display.append(" ", badge);
    }
    const profile = document.createElement("td"); profile.textContent = c.profile;
    const rss = document.createElement("td"); rss.textContent = formatBytes(c.rss_bytes);
    const procs = document.createElement("td"); procs.textContent = String(c.process_count);
    tr.append(display, profile, rss, procs); body.append(tr);
  });
  if (!r.chrome.length) {
    const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 4;
    td.textContent = "No matching DISPLAY + chrome-profile-N groups found."; tr.append(td); body.append(tr);
  }
  $("agent-chrome-note").textContent = r.agent.note + (r.agent.display ? ` (${r.agent.display} / ${r.agent.profile || "no profile"})` : "");
  ( $("btn-chrome-trim") as HTMLButtonElement).disabled = !r.agent.mutable;
  ( $("btn-chrome-restart") as HTMLButtonElement).disabled = !r.agent.mutable;
}

async function refreshResources(): Promise<void> { renderResources(await getJSON<Resources>("/resources")); }

function renderTriggers(t: Triggers): void {
  $("hook-state").textContent = t.webhook_configured ? `configured: ${t.webhook_hint || "HTTPS destination"}` : "not configured — hooks disabled";
  const body = $("trigger-rows"); body.replaceChildren();
  t.triggers.forEach((trigger) => {
    const tr = document.createElement("tr");
    const id = document.createElement("td"); id.textContent = trigger.id;
    const kind = document.createElement("td"); kind.textContent = trigger.kind;
    const spec = document.createElement("td"); const code = document.createElement("code"); code.textContent = trigger.spec; spec.append(code);
    const last = document.createElement("td"); last.textContent = trigger.last_fire || "—";
    const enabled = document.createElement("td"); const btn = document.createElement("button"); btn.className = "mini"; btn.textContent = trigger.enabled ? "on" : "off";
    btn.addEventListener("click", () => act(async () => { await postJSON("/triggers/enable", { id: trigger.id, enabled: !trigger.enabled }); await refreshTriggers(); }, false));
    enabled.append(btn); tr.append(id, kind, spec, last, enabled); body.append(tr);
  });
}

async function refreshTriggers(): Promise<void> { renderTriggers(await getJSON<Triggers>("/triggers")); }

const actionButtons = ["btn-apply", "btn-revert", "btn-proxy-save", "btn-proxy-on", "btn-proxy-off", "btn-chrome-trim", "btn-chrome-restart", "btn-hook-set", "btn-hook-clear", "btn-hook-test", "btn-trigger-add"];
function busy(on: boolean): void {
  actionButtons.forEach((id) => {
    const b = $(id) as HTMLButtonElement;
    if (on) { b.dataset.wasDisabled = b.disabled ? "1" : "0"; b.disabled = true; }
    else if (b.dataset.wasDisabled !== "1") b.disabled = false;
  });
}

async function act(fn: () => Promise<unknown>, refreshAfter = true): Promise<void> {
  showMsg(""); busy(true);
  try { await fn(); if (refreshAfter) await refreshStatus(); }
  catch (e) { showError(e); }
  finally { busy(false); if (activePage === "resources") refreshResources().catch(showError); }
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLElement>(".tab").forEach((el) => el.addEventListener("click", () => setPage(el.dataset.page || "overview")));
  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => act(() => postJSON("/revert", {}), false));
  $("btn-proxy-save").addEventListener("click", () => act(() => postJSON("/proxy", {
    listen: ( $("proxy-listen") as HTMLInputElement).value,
    upstream: ( $("proxy-upstream") as HTMLInputElement).value,
    iface: ( $("proxy-iface") as HTMLInputElement).value,
    intercept: ( $("proxy-intercept") as HTMLInputElement).checked,
  })));
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));
  $("btn-chrome-trim").addEventListener("click", () => act(() => postJSON("/resources/chrome", { action: "trim" }), false));
  $("btn-chrome-restart").addEventListener("click", () => act(() => postJSON("/resources/chrome", { action: "restart" }), false));
  $("btn-hook-set").addEventListener("click", () => act(async () => { await postJSON("/triggers/webhook", { url: ( $("hook-url") as HTMLInputElement).value }); ( $("hook-url") as HTMLInputElement).value = ""; await refreshTriggers(); }, false));
  $("btn-hook-clear").addEventListener("click", () => act(async () => { await postJSON("/triggers/webhook", { url: "" }); ( $("hook-url") as HTMLInputElement).value = ""; await refreshTriggers(); }, false));
  $("btn-hook-test").addEventListener("click", () => act(() => postJSON("/triggers/test", {}), false));
  $("btn-trigger-add").addEventListener("click", () => act(async () => {
    await postJSON("/triggers/add", { id: ( $("trigger-id") as HTMLInputElement).value, kind: ( $("trigger-kind") as HTMLSelectElement).value, spec: ( $("trigger-spec") as HTMLInputElement).value, enabled: true });
    ( $("trigger-id") as HTMLInputElement).value = ""; ( $("trigger-spec") as HTMLInputElement).value = ""; await refreshTriggers();
  }, false));
  Promise.all([refreshStatus(), refreshResources(), refreshTriggers()]).catch(showError);
  window.setInterval(() => { if (activePage === "resources") refreshResources().catch(showError); if (activePage === "triggers") refreshTriggers().catch(showError); }, 5000);
});
