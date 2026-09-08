"use strict";

const MaxQSkills = (() => {
  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    const el = $("skills-msg");
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isErr ? "var(--red)" : "var(--green)";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(data) {
    $("skills-count").textContent = String(data.count || 0);
    $("skills-root").textContent = data.root || "—";
    const grid = $("skills-grid");
    const skills = data.skills || [];
    if (!skills.length) {
      grid.innerHTML = '<article class="p2-card"><h3>No skills yet</h3><p>Drop skill folders into $HOME/.config/maxq/skills.</p></article>';
      return;
    }
    grid.innerHTML = skills.map((s) => {
      const badges = [];
      if (s.has_skill_md) badges.push('<span class="p2-badge ok">SKILL.md</span>');
      if (s.has_agents) badges.push('<span class="p2-badge secret">agents</span>');
      badges.push(`<span class="p2-badge dim">${escapeHtml(s.age || "—")}</span>`);
      return `<article class="p2-card">
        <h3>${escapeHtml(s.name || "")}</h3>
        <p>${escapeHtml(s.description || "")}</p>
        <div class="row">${badges.join("")}</div>
        <div class="path">${escapeHtml(s.path || "")}</div>
      </article>`;
    }).join("");
  }

  async function refresh() {
    $("skills-status").textContent = "loading";
    $("skills-refresh").disabled = true;
    try {
      const data = await MaxQShell.getJSON("/api/stubs/skills");
      render(data);
      $("skills-status").textContent = "live";
      setMsg("");
    } catch (e) {
      $("skills-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    } finally {
      $("skills-refresh").disabled = false;
    }
  }

  function boot() {
    $("skills-refresh").addEventListener("click", () => refresh());
    refresh();
  }

  return { boot, refresh };
})();
