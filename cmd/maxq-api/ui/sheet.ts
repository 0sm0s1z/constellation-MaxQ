// MaxQ settings sheet (TypeScript, no framework).
type Gost = { enabled: boolean; running: boolean; listen: string; upstream: string; iface: string; intercept: boolean };
type Clis = { installed: string; skipped: string };
type Status = { state: string; theme: string; gost: Gost; clis: Clis; api: { listen: string } };
type Network = { mode: "tailscale" | "headscale"; login_server: string; auth_key_configured: boolean; status?: "up" | "down" };
type Policy = { approvals: { mode: "off" | "on"; always_allow: boolean }; network: Network; source: string; skip_auto_review: boolean };
type Connection = { id: string; name: string; base_url: string; auth_configured: boolean };
type Desktop = { [key: string]: unknown; id?: string; name?: string; title?: string; box_identity?: string; connection_id?: string; connection_name?: string; source_api?: string };
type HAEntity = { id: string; label?: string };
type HAConnection = { base_url: string; token_configured: boolean; configured: boolean; source: string };
type HAAllowlist = { entities: HAEntity[]; source: string; semantics: "curated-allowlist-not-full-dump"; bot_visible_only: boolean };
type EntitlementEntry = { action: "allow" | "deny"; kind: string; value: string; label?: string; source: string };
type Entitlements = { entries: EntitlementEntry[]; source: string; semantics: "merged-allow-deny-with-source-labels" };
type VaultMeta = { id: string; label: string; purpose: string; created_at: string; expires_at: string };
type VaultList = { credentials: VaultMeta[]; semantics: string; note?: string };

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
async function getHAConnection(): Promise<HAConnection> { return requestJSON<HAConnection>("/ha/connection"); }
async function getHAAllowlist(): Promise<HAAllowlist> { return requestJSON<HAAllowlist>("/ha/allowlist"); }
async function getEntitlements(): Promise<Entitlements> { return requestJSON<Entitlements>("/entitlements"); }
async function getConnections(): Promise<{ connections: Connection[] }> { return requestJSON("/connections"); }
async function getDesktops(): Promise<{ desktops: Desktop[]; errors: { connection_name: string; error: string }[] }> { return requestJSON("/desktops"); }
async function getVault(): Promise<VaultList> { return requestJSON("/vault/credentials"); }
async function deleteJSON(path: string): Promise<void> { await requestJSON(path, { method: "DELETE" }); }
async function postJSON(path: string, body: unknown): Promise<unknown> {
  return requestJSON(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
}
async function putJSON(path: string, body: unknown): Promise<unknown> {
  return requestJSON(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
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
let haAvailable = false;
let entitlementsAvailable = false;
let busyState = false;
let haEntities: HAEntity[] = [];
let operatorEntitlements: EntitlementEntry[] = [];
let importedEntitlements: EntitlementEntry[] = [];
let entitlementsSource = "";

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
  const mode = ($("network-mode") as HTMLSelectElement).value;
  const headscale = mode === "headscale";
  $("headscale-fields").hidden = !headscale;
  $("headscale-enrollment-hint").hidden = !headscale;
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
  else parts.push("no auth key stored");
  $("st-network").textContent = parts.join(" · ");
  mode.disabled = busyState;
  loginServer.disabled = busyState;
  ($("network-auth-key") as HTMLInputElement).disabled = busyState;
  ($("btn-network-save") as HTMLButtonElement).disabled = busyState;
  ($("btn-network-leave") as HTMLButtonElement).disabled = busyState;
  ($("btn-network-clear-key") as HTMLButtonElement).disabled = busyState || !network.auth_key_configured;
}

function renderNetworkUnavailable(message: string): void {
  networkAvailable = false;
  ["network-mode", "network-login-server", "network-auth-key", "btn-network-save", "btn-network-leave", "btn-network-clear-key"].forEach((id) => { ($(id) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = true; });
  $("st-network").textContent = "Unavailable · " + message;
}


function setHAActionMsg(text: string): void {
  const el = $("st-ha-action");
  el.hidden = !text;
  el.textContent = text;
}
async function runHAAction(entityId: string, action: string, temperature?: number): Promise<void> {
  setHAActionMsg("");
  await act(async () => {
    const body: { entity_id: string; action: string; temperature?: number } = { entity_id: entityId, action };
    if (typeof temperature === "number") body.temperature = temperature;
    const result = await postJSON<{ ok: boolean; error?: string; before?: { state?: string }; after?: { state?: string } }>("/ha/action", body);
    const before = result.before?.state ? String(result.before.state) : "?";
    const after = result.after?.state ? String(result.after.state) : "?";
    setHAActionMsg(entityId + " · " + action + " · " + before + " → " + after);
  });
}
function renderHAConnection(conn: HAConnection): void {
  ($("ha-base-url") as HTMLInputElement).value = conn.base_url || "";
  const parts = [];
  if (conn.configured) parts.push("Ready");
  else if (conn.base_url && !conn.token_configured) parts.push("URL set · token missing");
  else if (!conn.base_url && conn.token_configured) parts.push("Token stored · URL missing");
  else parts.push("Not configured");
  if (conn.token_configured) parts.push("token stored");
  else parts.push("no token stored");
  $("st-ha-connection").textContent = parts.join(" · ");
}

function renderHA(): void {
  const list = $("ha-entities");
  list.replaceChildren();
  if (!haEntities.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "Allowlist is empty. No HA entities are bot-visible.";
    list.append(empty);
  } else {
    haEntities.forEach((entity, index) => {
      const item = document.createElement("li"); item.className = "connection";
      const text = document.createElement("div");
      const id = document.createElement("strong"); id.textContent = entity.id; text.append(id);
      if (entity.label) { const detail = document.createElement("small"); detail.textContent = entity.label; text.append(detail); }
      const actions = document.createElement("div"); actions.className = "row";
      const domain = entity.id.split(".")[0];
      if (domain === "light" || domain === "switch" || domain === "input_boolean" || domain === "fan") {
        const on = document.createElement("button"); on.type = "button"; on.textContent = "On";
        on.addEventListener("click", () => runHAAction(entity.id, "turn_on"));
        const off = document.createElement("button"); off.type = "button"; off.textContent = "Off";
        off.addEventListener("click", () => runHAAction(entity.id, "turn_off"));
        actions.append(on, off);
      } else if (domain === "climate") {
        const bump = document.createElement("button"); bump.type = "button"; bump.textContent = "Set 72°F";
        bump.addEventListener("click", () => runHAAction(entity.id, "set_temperature", 72));
        actions.append(bump);
      }
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove"; remove.textContent = "Remove";
      remove.addEventListener("click", () => { haEntities.splice(index, 1); renderHA(); });
      actions.append(remove);
      item.append(text, actions); list.append(item);
    });
  }
  $("st-ha").textContent = haEntities.length + " curated entit" + (haEntities.length === 1 ? "y" : "ies") + " · not a full HA inventory";
  ($("ha-entity-id") as HTMLInputElement).disabled = busyState || !haAvailable;
  ($("ha-entity-label") as HTMLInputElement).disabled = busyState || !haAvailable;
  ($("btn-ha-add") as HTMLButtonElement).disabled = busyState || !haAvailable;
  ($("btn-ha-save") as HTMLButtonElement).disabled = busyState || !haAvailable;
}

function renderHAAllowlist(allowlist: HAAllowlist): void {
  haAvailable = true;
  haEntities = Array.isArray(allowlist.entities) ? allowlist.entities.map((entity) => ({ id: entity.id, label: entity.label || "" })) : [];
  renderHA();
}

function renderHAUnavailable(message: string): void {
  haAvailable = false;
  haEntities = [];
  const list = $("ha-entities"); list.replaceChildren();
  const item = document.createElement("li"); item.className = "msg"; item.textContent = "Unavailable · " + message; list.append(item);
  $("st-ha").textContent = "Unavailable · " + message;
  ["ha-entity-id", "ha-entity-label", "btn-ha-connection-save", "btn-ha-token-clear", "btn-ha-add", "btn-ha-save"].forEach((id) => { ($(id) as HTMLInputElement | HTMLButtonElement).disabled = true; });
}

function addHAEntityFromInputs(): void {
  const idInput = $("ha-entity-id") as HTMLInputElement;
  const labelInput = $("ha-entity-label") as HTMLInputElement;
  const id = idInput.value.trim();
  const label = labelInput.value.trim();
  if (!id) { showMsg("Home Assistant entity ID is required."); return; }
  const existing = haEntities.find((entity) => entity.id === id);
  if (existing) existing.label = label;
  else haEntities.push({ id, label });
  idInput.value = "";
  labelInput.value = "";
  showMsg("");
  renderHA();
}

function entitlementRow(entry: EntitlementEntry, operatorIndex: number | null): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "entitlement-row" + (entry.source === "operator" ? "" : " readonly");

  const action = document.createElement("span");
  action.className = entry.action === "allow" ? "action-allow" : "action-deny";
  action.textContent = entry.action;

  const kind = document.createElement("span");
  kind.textContent = entry.kind;

  const value = document.createElement("span");
  value.className = "entitlement-value";
  const valueText = document.createElement("strong"); valueText.textContent = entry.value; value.append(valueText);
  if (entry.label) { const label = document.createElement("small"); label.textContent = entry.label; value.append(label); }

  const sourceWrap = document.createElement("span"); sourceWrap.className = "source-badge-wrap";
  const source = document.createElement("span"); source.className = "source-badge"; source.textContent = entry.source; sourceWrap.append(source);

  const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove";
  if (operatorIndex === null) {
    remove.textContent = "Linked";
    remove.disabled = true;
  } else {
    remove.textContent = "Remove";
    remove.addEventListener("click", () => { operatorEntitlements.splice(operatorIndex, 1); renderEntitlementRows(); });
  }

  row.append(action, kind, value, sourceWrap, remove);
  return row;
}

function renderEntitlementRows(): void {
  const list = $("entitlements");
  list.replaceChildren();
  if (!operatorEntitlements.length && !importedEntitlements.length) {
    const empty = document.createElement("li"); empty.className = "muted"; empty.textContent = "No entitlement rows are visible."; list.append(empty);
  } else {
    operatorEntitlements.forEach((entry, index) => list.append(entitlementRow(entry, index)));
    importedEntitlements.forEach((entry) => list.append(entitlementRow(entry, null)));
  }
  const total = operatorEntitlements.length + importedEntitlements.length;
  $("st-entitlements").textContent = total + " visible row" + (total === 1 ? "" : "s") + " · " + operatorEntitlements.length + " operator · " + importedEntitlements.length + " imported · operator source " + (entitlementsSource || "—");
  ["entitlement-action", "entitlement-kind", "entitlement-value", "entitlement-label", "btn-entitlement-add", "btn-entitlement-save"].forEach((id) => {
    ($(id) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = busyState || !entitlementsAvailable;
  });
}

function renderEntitlements(state: Entitlements): void {
  entitlementsAvailable = true;
  entitlementsSource = state.source || "";
  const entries = Array.isArray(state.entries) ? state.entries : [];
  operatorEntitlements = entries.filter((entry) => entry.source === "operator").map((entry) => ({ ...entry, source: "operator" }));
  importedEntitlements = entries.filter((entry) => entry.source !== "operator").map((entry) => ({ ...entry }));
  renderEntitlementRows();
}

function renderEntitlementsUnavailable(message: string): void {
  entitlementsAvailable = false;
  operatorEntitlements = [];
  importedEntitlements = [];
  entitlementsSource = "";
  const list = $("entitlements"); list.replaceChildren();
  const item = document.createElement("li"); item.className = "msg"; item.textContent = "Unavailable · " + message; list.append(item);
  $("st-entitlements").textContent = "Unavailable · " + message;
  ["entitlement-action", "entitlement-kind", "entitlement-value", "entitlement-label", "btn-entitlement-add", "btn-entitlement-save"].forEach((id) => {
    ($(id) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = true;
  });
}

function addEntitlementFromInputs(): void {
  const action = $("entitlement-action") as HTMLSelectElement;
  const kind = $("entitlement-kind") as HTMLSelectElement;
  const value = $("entitlement-value") as HTMLInputElement;
  const label = $("entitlement-label") as HTMLInputElement;
  const trimmedValue = value.value.trim();
  if (!trimmedValue) { showMsg("Entitlement value is required."); return; }
  const entry: EntitlementEntry = {
    action: action.value === "deny" ? "deny" : "allow",
    kind: kind.value,
    value: trimmedValue,
    label: label.value.trim(),
    source: "operator",
  };
  const existing = operatorEntitlements.find((candidate) => candidate.action === entry.action && candidate.kind === entry.kind && candidate.value === entry.value);
  if (existing) existing.label = entry.label;
  else operatorEntitlements.push(entry);
  value.value = "";
  label.value = "";
  showMsg("");
  renderEntitlementRows();
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
function humanizeNetworkError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("expired") || s.includes("authkey expired") || s.includes("auth key expired")) {
    return "Auth key expired. Paste a new key from your Tailscale/Headscale admin, then Save & join. Or Clear stored key first.";
  }
  if (s.includes("invalid") && (s.includes("auth") || s.includes("key") || s.includes("preauth"))) {
    return "Auth key invalid. Paste a fresh key, then Save & join. Or Clear stored key.";
  }
  if (s.includes("checkprefs") || s.includes("access denied")) {
    return "Tailscale permission error on this box (operator/prefs). Fix local Tailscale operator access, then retry Save & join.";
  }
  if (s.includes("login_server") || s.includes("login server")) {
    return "Headscale login server missing or invalid. Set the login server URL, then Save & join.";
  }
  return raw;
}
function setNetworkError(text: string): void {
  const el = $("st-network-error");
  el.hidden = !text;
  el.textContent = text;
}
function showMsg(text: string): void { const el = $("msg"); el.hidden = !text; el.textContent = text; }
function busy(on: boolean): void {
  busyState = on;
  ["btn-apply", "btn-revert", "btn-proxy-on", "btn-proxy-off", "btn-network-save", "btn-network-leave", "btn-network-clear-key", "btn-ha-connection-save", "btn-ha-token-clear", "btn-ha-add", "btn-ha-save", "btn-entitlement-add", "btn-entitlement-save"].forEach((id) => { ($(id) as HTMLButtonElement).disabled = on; });
  ($("approvals-enabled") as HTMLInputElement).disabled = on || !policyAvailable;
  ($("network-mode") as HTMLSelectElement).disabled = on || !networkAvailable;
  ($("network-login-server") as HTMLInputElement).disabled = on || !networkAvailable;
  ($("network-auth-key") as HTMLInputElement).disabled = on || !networkAvailable;
  ($("ha-entity-id") as HTMLInputElement).disabled = on || !haAvailable;
  ($("ha-entity-label") as HTMLInputElement).disabled = on || !haAvailable;
  ($("entitlement-action") as HTMLSelectElement).disabled = on || !entitlementsAvailable;
  ($("entitlement-kind") as HTMLSelectElement).disabled = on || !entitlementsAvailable;
  ($("entitlement-value") as HTMLInputElement).disabled = on || !entitlementsAvailable;
  ($("entitlement-label") as HTMLInputElement).disabled = on || !entitlementsAvailable;
}
async function act(fn: () => Promise<unknown>, opts?: { network?: boolean }): Promise<void> {
  showMsg("");
  if (opts?.network) setNetworkError("");
  busy(true);
  try {
    await fn();
    await refresh();
    if (opts?.network) setNetworkError("");
  } catch (e) {
    const raw = errorText(e);
    const msg = opts?.network ? humanizeNetworkError(raw) : raw;
    showMsg(msg);
    if (opts?.network) {
      setNetworkError(msg);
      $("st-network").textContent = "Error · " + msg;
    }
  } finally {
    busy(false);
  }
}
function renderVault(list: VaultList): void {
  const pending = list.credentials || [];
  $("st-vault").textContent = pending.length
    ? pending.length + " pending · bot claims via POST /vault/credentials/{id}/claim"
    : "Empty · paste above for an ephemeral bot handoff";
  const ul = $("vault-pending");
  ul.replaceChildren();
  pending.forEach((c) => {
    const item = document.createElement("li"); item.className = "connection";
    const text = document.createElement("div");
    const strong = document.createElement("strong"); strong.textContent = c.label; text.append(strong);
    const detail = document.createElement("small");
    detail.textContent = c.purpose + " · expires " + c.expires_at + " · id " + c.id;
    text.append(detail);
    const actions = document.createElement("div"); actions.className = "row";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "remove"; cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => act(async () => { await deleteJSON("/vault/credentials/" + encodeURIComponent(c.id)); }));
    actions.append(cancel);
    item.append(text, actions);
    ul.append(item);
  });
}

function renderVaultUnavailable(message: string): void {
  $("st-vault").textContent = "Unavailable · " + message;
  $("vault-pending").replaceChildren();
}

async function refresh(): Promise<void> {
  const [status, policy, haConn, ha, entitlements, connections, desktops, vault] = await Promise.allSettled([getStatus(), getPolicy(), getHAConnection(), getHAAllowlist(), getEntitlements(), getConnections(), getDesktops(), getVault()]);
  const errors: string[] = [];

  if (status.status === "fulfilled") renderStatus(status.value);
  else { const message = errorText(status.reason); renderStatusUnavailable(message); errors.push("status: " + message); }

  if (policy.status === "fulfilled") { renderPolicy(policy.value); renderNetwork(policy.value.network); }
  else { const message = errorText(policy.reason); renderPolicyUnavailable(message); renderNetworkUnavailable(message); errors.push("settings: " + message); }

  if (haConn.status === "fulfilled") renderHAConnection(haConn.value);
  else { $("st-ha-connection").textContent = "Unavailable · " + errorText(haConn.reason); errors.push("HA connection: " + errorText(haConn.reason)); }
  if (ha.status === "fulfilled") renderHAAllowlist(ha.value);
  else { const message = errorText(ha.reason); renderHAUnavailable(message); errors.push("HA allowlist: " + message); }

  if (entitlements.status === "fulfilled") renderEntitlements(entitlements.value);
  else { const message = errorText(entitlements.reason); renderEntitlementsUnavailable(message); errors.push("entitlements: " + message); }

  if (connections.status === "fulfilled") renderConnections(connections.value.connections);
  else { const message = errorText(connections.reason); renderConnectionsUnavailable(message); errors.push("connections: " + message); }

  if (desktops.status === "fulfilled") renderDesktops(desktops.value.desktops, desktops.value.errors || []);
  else { const message = errorText(desktops.reason); renderDesktops([], [{ connection_name: "Desktops", error: message }]); errors.push("desktops: " + message); }

  if (vault.status === "fulfilled") renderVault(vault.value);
  else { const message = errorText(vault.reason); renderVaultUnavailable(message); errors.push("vault: " + message); }

  showMsg(errors.join(" · "));
}

window.addEventListener("DOMContentLoaded", () => {
  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => act(() => postJSON("/revert", {})));
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));
  $("btn-network-leave").addEventListener("click", () => act(() => postJSON("/policy", { network: { action: "leave" } }), { network: true }));
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
    }, { network: true });
  });
  $("btn-network-clear-key").addEventListener("click", () => act(async () => {
    const mode = $("network-mode") as HTMLSelectElement;
    const loginServer = $("network-login-server") as HTMLInputElement;
    await postJSON("/policy", { network: { mode: mode.value, login_server: loginServer.value, clear_auth_key: true } });
    ($("network-auth-key") as HTMLInputElement).value = "";
  }, { network: true }));
  $("ha-connection-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const baseURL = ($("ha-base-url") as HTMLInputElement).value;
    const token = ($("ha-token") as HTMLInputElement).value;
    act(async () => {
      const body: { base_url: string; token?: string } = { base_url: baseURL };
      if (token.trim()) body.token = token;
      await putJSON("/ha/connection", body);
      ($("ha-token") as HTMLInputElement).value = "";
    });
  });
  $("btn-ha-token-clear").addEventListener("click", () => act(async () => {
    const baseURL = ($("ha-base-url") as HTMLInputElement).value;
    await putJSON("/ha/connection", { base_url: baseURL, clear_token: true });
  }));
  $("btn-ha-add").addEventListener("click", addHAEntityFromInputs);
  $("ha-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(() => putJSON("/ha/allowlist", { entities: haEntities }));
  });
  $("btn-entitlement-add").addEventListener("click", addEntitlementFromInputs);
  $("entitlements-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(() => putJSON("/entitlements", { entries: operatorEntitlements }));
  });
  $("connection-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("connection-name") as HTMLInputElement;
    const baseURL = $("connection-url") as HTMLInputElement;
    const auth = $("connection-auth") as HTMLInputElement;
    act(async () => { await postJSON("/connections", { name: name.value, base_url: baseURL.value, auth: auth.value }); name.value = ""; baseURL.value = ""; auth.value = ""; });
  });
  $("vault-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const label = ($("vault-label") as HTMLInputElement).value;
    const purpose = ($("vault-purpose") as HTMLInputElement).value;
    const secret = ($("vault-secret") as HTMLInputElement).value;
    act(async () => {
      await postJSON("/vault/credentials", { label, purpose, secret });
      ($("vault-label") as HTMLInputElement).value = "";
      ($("vault-purpose") as HTMLInputElement).value = "";
      ($("vault-secret") as HTMLInputElement).value = "";
    });
  });
  busy(false);
  refresh().catch((e) => showMsg(errorText(e)));
});
