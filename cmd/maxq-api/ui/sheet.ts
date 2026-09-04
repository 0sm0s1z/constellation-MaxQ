// MaxQ settings sheet (TypeScript, no framework).
type Gost = { enabled: boolean; running: boolean; listen: string; upstream: string; iface: string; intercept: boolean };
type Clis = { installed: string; skipped: string; preexisting: string };
type Status = { state: string; theme: string; gost: Gost; clis: Clis; api: { listen: string } };
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
async function getConnections(): Promise<{ connections: Connection[] }> { return requestJSON("/connections"); }
async function getDesktops(): Promise<{ desktops: Desktop[]; errors: { connection_name: string; error: string }[] }> { return requestJSON("/desktops"); }
async function postJSON(path: string, body: unknown): Promise<unknown> {
  return requestJSON(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
}

function renderStatus(s: Status): void {
  $("st-state").textContent = s.state;
  $("st-theme").textContent = s.theme;
  $("st-gost").textContent = (s.gost.enabled ? "enabled" : "off") + " / " + (s.gost.running ? "running" : "stopped");
  $("st-clis").textContent = [s.clis.installed, s.clis.preexisting].filter((x) => x && x.length).join(" ") || "—";
  $("st-api").textContent = s.api.listen;
  const pill = $("pill"); pill.textContent = s.state; pill.className = "pill " + (s.state === "applied" ? "on" : "off");
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

function showMsg(text: string): void { const el = $("msg"); el.hidden = !text; el.textContent = text; }
function busy(on: boolean): void {
  ["btn-apply", "btn-revert", "btn-proxy-on", "btn-proxy-off"].forEach((id) => { ($(id) as HTMLButtonElement).disabled = on; });
}
async function act(fn: () => Promise<unknown>): Promise<void> {
  showMsg(""); busy(true);
  try { await fn(); await refresh(); } catch (e) { showMsg(e instanceof Error ? e.message : String(e)); } finally { busy(false); }
}
async function refresh(): Promise<void> {
  const [status, connections, desktops] = await Promise.all([getStatus(), getConnections(), getDesktops()]);
  renderStatus(status); renderConnections(connections.connections); renderDesktops(desktops.desktops, desktops.errors || []);
}

window.addEventListener("DOMContentLoaded", () => {
  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => act(() => postJSON("/revert", {})));
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));
  $("connection-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("connection-name") as HTMLInputElement;
    const baseURL = $("connection-url") as HTMLInputElement;
    const auth = $("connection-auth") as HTMLInputElement;
    act(async () => { await postJSON("/connections", { name: name.value, base_url: baseURL.value, auth: auth.value }); name.value = ""; baseURL.value = ""; auth.value = ""; });
  });
  refresh().catch((e) => showMsg(e instanceof Error ? e.message : String(e)));
});
