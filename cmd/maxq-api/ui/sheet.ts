// MaxQ thin settings sheet (TypeScript, no framework).
type Gost = {
  enabled: boolean;
  running: boolean;
  listen: string;
  upstream: string;
  iface: string;
  intercept: boolean;
};
type Clis = { installed: string; skipped: string; preexisting: string };
type Status = {
  state: string;
  theme: string;
  gost: Gost;
  clis: Clis;
  api: { listen: string };
};

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
};

async function getStatus(): Promise<Status> {
  const r = await fetch("/status");
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
  const g = s.gost.enabled ? "enabled" : "off";
  const run = s.gost.running ? "running" : "stopped";
  $("st-gost").textContent = g + " / " + run;
  const bits = [s.clis.installed, s.clis.preexisting].filter((x) => x && x.length);
  $("st-clis").textContent = bits.join(" ") || "—";
  $("st-api").textContent = s.api.listen;
  const pill = $("pill");
  pill.textContent = s.state;
  pill.className = "pill " + (s.state === "applied" ? "on" : "off");
}

function showMsg(text: string): void {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text;
}

async function refresh(): Promise<void> {
  const s = await getStatus();
  render(s);
}

function busy(on: boolean): void {
  ["btn-apply", "btn-revert", "btn-proxy-on", "btn-proxy-off"].forEach((id) => {
    const b = $(id) as HTMLButtonElement;
    b.disabled = on;
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

window.addEventListener("DOMContentLoaded", () => {
  $("btn-apply").addEventListener("click", () => act(() => postJSON("/apply", {})));
  $("btn-revert").addEventListener("click", () => act(() => postJSON("/revert", {})));
  $("btn-proxy-on").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: true })));
  $("btn-proxy-off").addEventListener("click", () => act(() => postJSON("/proxy", { enabled: false })));
  refresh().catch((e) => showMsg(e instanceof Error ? e.message : String(e)));
});
