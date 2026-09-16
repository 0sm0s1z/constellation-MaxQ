// MaxQ settings sheet (TypeScript, no framework).
type Gost = { enabled: boolean; running: boolean; listen: string; upstream: string; iface: string; intercept: boolean };
type Clis = { installed: string; skipped: string };
type Status = { state: string; theme: string; gost: Gost; clis: Clis; api: { listen: string } };
type Network = { mode: "tailscale" | "headscale"; login_server: string; auth_key_configured: boolean; status?: "up" | "down" };
type Policy = { approvals: { mode: "off" | "on"; always_allow: boolean }; network: Network; source: string; skip_auto_review: boolean };
type Connection = { id: string; name: string; base_url: string; auth_configured: boolean };
type Desktop = { [key: string]: unknown; id?: string; name?: string; title?: string; box_identity?: string; connection_id?: string; connection_name?: string; source_api?: string };

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
};

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) {
    let extra = "";
    try { const j = (await r.json()) as { error?: string }; extra = j.error ? ": " + j.error : ""; } catch { /* non-json error */ }
    throw new Error(path + " " + r.status + extra);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

async function getStatus(): Promise<Status> { return requestJSON<Status>("/status"); }
async function getPolicy(): Promise<Policy> { return requestJSON<Policy>("/policy"); }
async function getConnections(): Promise<{ connections: Connection[] }> { return requestJSON("/connections"); }
async function getDesktops(): Promise<{ desktops: Desktop[]; errors: { connection_name: string; error: string }[] }> { return requestJSON("/desktops"); }
async function postJSON(path: string, body: unknown): Promise<unknown> {
  return requestJSON(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
}

function renderStatus(s: Status): void {
  $("st-state").textContent = s.state;
  $("st-theme").textContent = s.theme;
  $("st-gost").textContent = (s.gost.enabled ? "enabled" : "off") + " / " + (s.gost.running ? "running" : "stopped");
  $("st-clis").textContent = [s.clis.installed, s.clis.skipped].filter((x) => x && x.length).join(" ") || "—";
  $("st-api").textContent = s.api.listen;
  const pill = $("pill"); pill.textContent = s.state; pill.className = "pill " + (s.state === "applied" ? "on" : "off");
}

function renderStatusUnavailable(message: string): void {
  ["st-state", "st-theme", "st-gost", "st-clis"].forEach((id) => { $(id).textContent = "Unavailable"; });
  const pill = $("pill"); pill.textContent = "status error"; pill.className = "pill off";
  $("st-api").textContent = message;
}

let policyAvailable = false;
let networkAvailable = false;
let busyState = false;

function renderPolicy(policy: Policy): void {
  policyAvailable = true;
  const enabled = $("approvals-enabled") as HTMLInputElement;
  enabled.checked = policy.approvals.mode === "on";
  enabled.disabled = busyState;
  $("st-approvals").textContent = policy.approvals.mode === "off"
    ? "Off · always allow · host Auto-review bypassed"
    : "On · approval prompts allowed";
}

function renderPolicyUnavailable(message: string): void {
  policyAvailable = false;
  const enabled = $("approvals-enabled") as HTMLInputElement;
  enabled.checked = false;
  enabled.disabled = true;
  $("st-approvals").textContent = "Unavailable · " + message;
}

function syncNetworkFields(): void {
  const mode = $("network-mode") as HTMLSelectElement;
  const loginServer = $("network-login-server") as HTMLInputElement;
  const headscale = mode.value === "headscale";
  $("headscale-fields").hidden = !headscale;
  loginServer.required = headscale;
}

function renderNetwork(network: Network): void {
  networkAvailable = true;
  const mode = $("network-mode") as HTMLSelectElement;
  const loginServer = $("network-login-server") as HTMLInputElement;
  mode.value = network.mode;
  loginServer.value = network.login_server || "";
  syncNetworkFields();
  const parts = [network.mode === "headscale" ? "Headscale" : "Tailscale"];
  if (network.status) parts.push(network.status === "down" ? "Disconnected" : "Up");
  if (network.mode === "headscale" && network.login_server) parts.push(network.login_server);
  if (network.auth_key_configured) parts.push("auth key stored");
  $("st-network").textContent = parts.join(" · ");
  mode.disabled = busyState;
  loginServer.disabled = busyState;
  ($("network-auth-key") as HTMLInputElement).disabled = busyState;
  ($("btn-network-save") as HTMLButtonElement).disabled = busyState;
  ($("btn-network-leave") as HTMLButtonElement).disabled = busyState;
}

function renderNetworkUnavailable(message: string): void {
  networkAvailable = false;
  ["network-mode", "network-login-server", "network-auth-key", "btn-network-save", "btn-network-leave"].forEach((id) => { ($(id) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = true; });
  $("st-network").textContent = "Unavailable · " + message;
}

function renderConnections(connections: Connection[]): void {
  const list = $("connections"); list.replaceChildren();
  if (!connections.length) { const empty = document.createElement("li"); empty.className = "muted"; empty.textContent = "No remote APIs connected."; list.append(empty); return; }
  for (const c of connections) {
    const item = document.createElement("li"); item.className = "connection";
    const text = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = c.name; text.append(name);
    const detail = document.createElement("small"); detail.textContent = c.base_url + (c.auth_configured ? " · auth configured" : ""); text.append(detail);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove"; remove.textContent = "Remove";
    remove.addEventListener("click", () => act(async () => { await requestJSON("/connections/" + encodeURIComponent(c.id), { method: "DELETE" }); }));
    item.append(text, remove); list.append(item);
  }
}

function renderConnectionsUnavailable(message: string): void {
  const list = $("connections"); list.replaceChildren();
  const item = document.createElement("li"); item.className = "msg"; item.textContent = "Unavailable · " + message; list.append(item);
}

function renderDesktops(desktops: Desktop[], errors: { connection_name: string; error: string }[]): void {
  const root = $("desktops"); root.replaceChildren();
  for (const error of errors) { const p = document.createElement("p"); p.className = "msg"; p.textContent = error.connection_name + ": " + error.error; root.append(p); }
  if (!desktops.length && !errors.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "No desktops reported by connected APIs."; root.append(p); return; }
  for (const d of desktops) {
    const article = document.createElement("article"); article.className = "desktop";
    const title = document.createElement("strong"); title.textContent = String(d.name || d.title || d.id || "Unnamed desktop");
    const source = document.createElement("small"); source.textContent = String(d.box_identity || d.connection_name || "Unknown box") + " · " + String(d.connection_name || d.source_api || "API");
    article.append(title, source);
    if (d.id && d.connection_id) {
      const watch = document.createElement("button"); watch.type = "button"; watch.textContent = "Watch";
      watch.addEventListener("click", () => act(() => postJSON("/desktops/action", { connection_id: d.connection_id, desktop_id: d.id, action: "watch" })));
      article.append(watch);
    }
    root.append(article);
  }
}

function errorText(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason); }
function showMsg(text: string): void { const el = $("msg"); el.hidden = !text; el.textContent = text; }
function busy(on: boolean): void {
  busyState = on;
  ["btn-apply", "btn-revert", "btn-proxy-on", "btn-proxy-off", "btn-network-save", "btn-network-leave"].forEach((id) => { ($(id) as HTMLButtonElement).disabled = on; });
  ($("approvals-enabled") as HTMLInputElement).disabled = on || !policyAvailable;
  ($("network-mode") as HTMLSelectElement).disabled = on || !networkAvailable;
  ($("network-login-server") as HTMLInputElement).disabled = on || !networkAvailable;
  ($("network-auth-key") as HTMLInputElement).disabled = on || !networkAvailable;
}
async function act(fn: () => Promise<unknown>): Promise<void> {
  showMsg(""); busy(true);
  try { await fn(); await refresh(); } catch (e) { showMsg(errorText(e)); } finally { busy(false); }
}
async function refresh(): Promise<void> {
  const [status, policy, connections, desktops] = await Promise.allSettled([getStatus(), getPolicy(), getConnections(), getDesktops()]);
  const errors: string[] = [];

  if (status.status === "fulfilled") renderStatus(status.value);
  else { const message = errorText(status.reason); renderStatusUnavailable(message); errors.push("status: " + message); }

  if (policy.status === "fulfilled") { renderPolicy(policy.value); renderNetwork(policy.value.network); }
  else { const message = errorText(policy.reason); renderPolicyUnavailable(message); renderNetworkUnavailable(message); errors.push("settings: " + message); }

  if (connections.status === "fulfilled") renderConnections(connections.value.connections);
  else { const message = errorText(connections.reason); renderConnectionsUnavailable(message); errors.push("connections: " + message); }

  if (desktops.status === "fulfilled") renderDesktops(desktops.value.desktops, desktops.value.errors || []);
  else { const message = errorText(desktops.reason); renderDesktops([], [{ connection_name: "Desktops", error: message }]); errors.push("desktops: " + message); }

  showMsg(errors.join(" · "));
}

window.addEventListener("DOMContentLoaded", () => {
  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => act(() => postJSON("/revert", {})));
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));
  $("btn-network-leave").addEventListener("click", () => act(() => postJSON("/policy", { network: { action: "leave" } })));
  $("approvals-enabled").addEventListener("change", () => {
    const enabled = $("approvals-enabled") as HTMLInputElement;
    act(() => postJSON("/policy", { enabled: enabled.checked }));
  });
  $("network-mode").addEventListener("change", syncNetworkFields);
  $("network-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const mode = $("network-mode") as HTMLSelectElement;
    const loginServer = $("network-login-server") as HTMLInputElement;
    const authKey = $("network-auth-key") as HTMLInputElement;
    act(async () => {
      const body: { mode: string; login_server: string; auth_key?: string } = { mode: mode.value, login_server: loginServer.value };
      if (authKey.value.trim()) body.auth_key = authKey.value;
      await postJSON("/policy", { network: body });
      authKey.value = "";
    });
  });
  $("connection-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("connection-name") as HTMLInputElement;
    const baseURL = $("connection-url") as HTMLInputElement;
    const auth = $("connection-auth") as HTMLInputElement;
    act(async () => { await postJSON("/connections", { name: name.value, base_url: baseURL.value, auth: auth.value }); name.value = ""; baseURL.value = ""; auth.value = ""; });
  });
  busy(false);
  refresh().catch((e) => showMsg(errorText(e)));
});
