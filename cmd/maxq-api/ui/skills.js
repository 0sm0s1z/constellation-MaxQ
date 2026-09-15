"use strict";

const MaxQSkills = (() => {
  const state = { skills: [], root: "", filter: "" };

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

  function splitWhen(desc) {
    const d = String(desc || "").trim();
    const m = d.match(/^Use when\s+(.+)$/i);
    if (!m) return { when: "", body: d };
    return { when: m[1].replace(/[.]+$/, ""), body: d };
  }

  function matchesFilter(s, q) {
    if (!q) return true;
    const hay = [s.name, s.description, s.when, s.excerpt, s.path]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  function render() {
    $("skills-count").textContent = String(state.skills.length);
    $("skills-root").textContent = state.root || "—";
    const q = state.filter.trim().toLowerCase();
    const list = state.skills.filter((s) => matchesFilter(s, q));
    const showing = $("skills-showing");
    if (showing) showing.textContent = q ? `${list.length}/${state.skills.length}` : String(state.skills.length);
    const grid = $("skills-grid");
    if (!state.skills.length) {
      grid.innerHTML = '<article class="p2-card"><h3>No skills yet</h3><p>Drop skill folders into $HOME/.config/maxq/skills.</p></article>';
      return;
    }
    if (!list.length) {
      grid.innerHTML = `<article class="p2-card"><h3>No matches</h3><p>Nothing matches «${escapeHtml(state.filter)}».</p></article>`;
      return;
    }
    grid.innerHTML = list.map((s) => {
      const badges = [];
      if (s.has_skill_md) badges.push('<span class="p2-badge ok">SKILL.md</span>');
      if (s.has_agents) badges.push('<span class="p2-badge secret">agents</span>');
      badges.push(`<span class="p2-badge dim">${escapeHtml(s.age || "—")}</span>`);
      const parts = splitWhen(s.description);
      const when = s.when || parts.when;
      const whenBlock = when
        ? `<p class="skills-when"><span class="k">when</span> ${escapeHtml(when)}</p>`
        : "";
      const excerpt = s.excerpt
        ? `<p class="skills-excerpt">${escapeHtml(s.excerpt)}</p>`
        : (parts.body && !when ? `<p>${escapeHtml(parts.body)}</p>` : "");
      const descFallback = (!when && !s.excerpt)
        ? `<p>${escapeHtml(s.description || "")}</p>`
        : "";
      return `<article class="p2-card skills-card">
        <h3>${escapeHtml(s.name || "")}</h3>
        ${whenBlock}
        ${excerpt || descFallback}
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
      state.root = data.root || "";
      state.skills = data.skills || [];
      render();
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
    const filter = $("skills-filter");
    if (filter) {
      filter.addEventListener("input", () => {
        state.filter = filter.value || "";
        render();
      });
    }
    refresh();
  }

  return { boot, refresh };
})();
