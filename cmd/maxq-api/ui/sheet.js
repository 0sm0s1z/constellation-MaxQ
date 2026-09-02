// MaxQ thin settings sheet (compiled from sheet.ts; no framework).
"use strict";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

async function getStatus() {
  const r = await fetch("/status", { cache: "no-store" });
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
  const enabled = s.gost.enabled ? "enabled" : "off";
  const running = s.gost.running ? "running" : "stopped";
  $("st-gost").textContent = enabled + " / " + running;
  $("st-api").textContent = s.api.listen;
  const pill = $("pill");
  pill.textContent = s.state;
  pill.className = "pill " + (s.state === "applied" ? "on" : "off");
}

function showMsg(text, kind = "error") {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text;
  el.dataset.kind = kind;
}

async function refresh() {
  render(await getStatus());
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

async function revert() {
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
