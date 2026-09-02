// MaxQ thin settings sheet (compiled from sheet.ts; no framework).
"use strict";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

async function getStatus() {
  const r = await fetch("/status");
  if (!r.ok) throw new Error("status " + r.status);
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
}

function render(s) {
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

function showMsg(text) {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text;
}

async function refresh() {
  const s = await getStatus();
  render(s);
}

function busy(on) {
  ["btn-apply", "btn-revert", "btn-proxy-on", "btn-proxy-off"].forEach((id) => {
    $(id).disabled = on;
  });
}

async function act(fn) {
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
