"use strict";
/** Shared operator shell: proof strip + connection chip from GET /status. */
async function getJSON(path, accept) {
  const headers = accept ? { Accept: accept } : undefined;
  const r = await fetch(path, headers ? { headers } : undefined);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}

function setConn(ok, label) {
  const el = document.getElementById("op-conn");
  if (!el) return;
  el.classList.toggle("ok", !!ok);
  const text = el.querySelector("[data-label]");
  if (text) text.textContent = label || (ok ? "connected" : "offline");
}

function renderProof(status) {
  const root = document.getElementById("op-proof");
  if (!root) return;
  const state = status && status.state ? String(status.state) : "—";
  const intercept = !!(status && status.gost && status.gost.intercept);
  const applied = state === "applied";
  const provePass = applied && !intercept;
  const api = (status && status.api) || {};
  const apiPub = !!api.api_public;
  const uiPub = !!api.ui_public;
  const anyPublic = apiPub || uiPub;
  root.innerHTML = "";
  const parts = [
    { key: "state", value: state, ok: applied },
    { key: "intercept", value: String(intercept), ok: false, mute: true },
    { key: null, value: "$HOME only", mute: true },
    { key: "prove", value: provePass ? "PASS" : "FAIL", ok: provePass },
  ];
  // Subtle public-bind safety hint (do not change bind — just surface it).
  if (anyPublic) {
    const bits = [];
    if (apiPub) bits.push("api");
    if (uiPub) bits.push("ui");
    parts.push({
      key: "bind",
      value: "public (" + bits.join("+") + ")",
      ok: false,
      mute: false,
      warn: true,
    });
  }
  parts.forEach((p, i) => {
    if (i) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "·";
      root.appendChild(sep);
    }
    const span = document.createElement("span");
    if (p.ok) span.className = "ok";
    else if (p.warn || (!p.mute && p.value === "FAIL")) span.className = "warn";
    else if (p.mute) span.className = "mute";
    span.textContent = p.key ? p.key + "=" + p.value : p.value;
    if (p.warn) {
      span.title =
        "API/UI listening publicly — demo LAN exposure; change bind only from Box if needed";
    }
    root.appendChild(span);
  });
}

async function bootShell() {
  try {
    const status = await getJSON("/status");
    renderProof(status);
    setConn(true, "connected");
    return status;
  } catch (e) {
    renderProof(null);
    setConn(false, "offline");
    throw e;
  }
}

window.MaxQShell = { getJSON, renderProof, setConn, bootShell };
