// MaxQ thin settings sheet (TypeScript, no framework).
type Status = {
  state: string;
  theme: string;
  gost: { enabled: boolean; running: boolean; listen: string; intercept: boolean };
  api: { listen: string };
};

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
};

async function getStatus(): Promise<Status> {
  const r = await fetch("/status", { cache: "no-store" });
  if (!r.ok) throw new Error("status " + r.status);
  return r.json() as Promise<Status>;
}

async function postJSON(path: string, body: unknown): Promise<void> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    let extra = "";
    try {
      const j = (await r.json()) as { error?: string };
      extra = j.error ? ": " + j.error : "";
    } catch {
      extra = "";
    }
    throw new Error(path + " " + r.status + extra);
  }
}

function render(s: Status): void {
  $("st-state").textContent = s.state;
  $("st-theme").textContent = s.theme;
  const enabled = s.gost.enabled ? "enabled" : "off";
  const running = s.gost.running ? "running" : "stopped";
  $("st-gost").textContent = enabled + " / " + running;
  $("st-api").textContent = s.api.listen;
  const pill = $("pill");
  pill.textContent = s.state;
  pill.className = "pill " + (s.state === "applied" ? "on" : "off");
}

function showMsg(text: string, kind = "error"): void {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text;
  el.dataset.kind = kind;
}

async function refresh(): Promise<void> {
  render(await getStatus());
}

function busy(on: boolean): void {
  ["btn-apply", "btn-revert", "btn-proxy-on", "btn-proxy-off"].forEach((id) => {
    ($(id) as HTMLButtonElement).disabled = on;
  });
}

async function act(fn: () => Promise<void>): Promise<void> {
  showMsg("");
  busy(true);
  try {
    await fn();
    await refresh();
  } catch (e) {
    showMsg(e instanceof Error ? e.message : String(e));
  } finally {
    busy(false);
  }
}

async function revert(): Promise<void> {
  showMsg("");
  busy(true);
  try {
    await postJSON("/revert", {});
    $("st-state").textContent = "reverted";
    $("st-gost").textContent = "off / stopped";
    const pill = $("pill");
    pill.textContent = "reverted";
    pill.className = "pill off";
    showMsg("Reverted. The local API is stopped; run maxq apply to start it again.", "ok");
  } catch (e) {
    showMsg(e instanceof Error ? e.message : String(e));
    busy(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => void revert());
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));
  refresh().catch((e) => showMsg(e instanceof Error ? e.message : String(e)));
});
