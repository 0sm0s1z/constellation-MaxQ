"use strict";

const MaxQAI = (() => {
  const SITE_KEYS = ["chatgpt", "grok", "claude", "discord", "slack"];

  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    const el = $("ai-msg");
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isErr ? "var(--red)" : "var(--green)";
  }

  async function postJSON(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data && data.error) || (path + " " + r.status));
    return data;
  }

  function readForm() {
    const sites = {};
    SITE_KEYS.forEach((k) => { sites[k] = ($("site-" + k).value || "").trim(); });
    return { default_ai_chat: $("default-ai").value, sites };
  }

  function render(d) {
    $("default-ai").value = d.default_ai_chat || "chatgpt";
    SITE_KEYS.forEach((k) => { $("site-" + k).value = (d.sites && d.sites[k]) || ""; });
    $("ai-current").textContent = d.default_ai_chat || "—";
    $("ai-sites-count").textContent = String(SITE_KEYS.length);

    const list = $("ai-shortcuts");
    list.textContent = "";
    const entries = [
      ["MaxQ AI Chat", (d.sites && d.sites[d.default_ai_chat]) || d.default_ai_chat],
      ["ChatGPT", d.sites && d.sites.chatgpt],
      ["Grok", d.sites && d.sites.grok],
      ["Claude", d.sites && d.sites.claude],
      ["Discord", d.sites && d.sites.discord],
      ["Slack", d.sites && d.sites.slack],
    ];
    for (const [name, target] of entries) {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.className = "shortcut-name";
      label.textContent = name;
      li.appendChild(label);
      li.appendChild(document.createTextNode(" "));
      if (target && /^https?:\/\//i.test(String(target))) {
        const a = document.createElement("a");
        a.href = String(target);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "shortcut-link";
        a.textContent = String(target);
        li.appendChild(a);
      } else {
        const r = document.createElement("span");
        r.className = "shortcut-target";
        r.textContent = target || "—";
        li.appendChild(r);
      }
      list.appendChild(li);
    }
  }

  async function refresh() {
    $("ai-status").textContent = "loading";
    try {
      const d = await MaxQShell.getJSON("/defaults");
      render(d);
      $("ai-status").textContent = "live";
      setMsg("");
    } catch (e) {
      $("ai-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    }
  }

  async function save(ev) {
    ev.preventDefault();
    $("ai-save").disabled = true;
    $("ai-status").textContent = "saving";
    try {
      const body = readForm();
      const d = await postJSON("/defaults", body);
      render(d.ok === false ? body : (d.default_ai_chat ? d : body));
      // Some handlers return {ok:true}; re-fetch for truth
      await refresh();
      setMsg("defaults saved");
    } catch (e) {
      $("ai-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    } finally {
      $("ai-save").disabled = false;
    }
  }

  function boot() {
    $("ai-form").addEventListener("submit", save);
    $("ai-reload").addEventListener("click", () => refresh());
    refresh();
  }

  return { boot, refresh };
})();
