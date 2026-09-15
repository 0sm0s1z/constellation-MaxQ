(() => {
  "use strict";

  const API = "/api/stubs/files";

  const state = {
    path: "",
    data: null,
    filter: "",
    loading: false,
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function text(el, value) {
    el.textContent = value == null ? "" : String(value);
  }

  function normalizePath(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .filter((part) => part && part !== ".")
      .join("/");
  }

  function parentPath(path) {
    const parts = normalizePath(path).split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  function setBusy(busy) {
    state.loading = busy;
    els.refreshButton.disabled = busy;
    els.upButton.disabled = busy || !state.path;
    text(els.apiState, busy ? "API · loading" : "API · live");
    els.apiState.className = busy ? "badge warn" : "badge ok";
  }

  function setError(message) {
    els.fileRows.replaceChildren();
    const box = document.createElement("div");
    box.className = "empty";
    const inner = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = "Unable to browse this path";
    const detail = document.createElement("div");
    detail.textContent = message || "The Go API rejected the request.";
    inner.append(strong, detail);
    box.append(inner);
    els.fileRows.append(box);

    text(els.apiState, "API · error");
    els.apiState.className = "badge blocked";
  }

  function formatBytes(bytes, kind) {
    if (kind === "directory") return "—";
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = units[0];

    for (let i = 1; i < units.length && value >= 1024; i += 1) {
      value /= 1024;
      unit = units[i];
    }

    return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
  }

  function formatTime(raw) {
    if (!raw) return "—";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function iconFor(entry) {
    if (entry.restricted) return { label: "!", className: "restricted" };
    if (entry.kind === "directory") return { label: "DIR", className: "" };
    if (entry.kind === "symlink") return { label: "↗", className: "link" };
    return { label: "FILE", className: "file" };
  }

  function kindBadge(entry) {
    const badge = document.createElement("span");

    if (entry.restricted) {
      badge.className = "badge blocked";
      badge.textContent = "restricted";
      return badge;
    }

    if (entry.kind === "directory") {
      badge.className = "badge ok";
      badge.textContent = "folder";
      return badge;
    }

    if (entry.kind === "symlink") {
      badge.className = "badge warn";
      badge.textContent = "symlink";
      return badge;
    }

    badge.className = "badge";
    badge.textContent = entry.kind || "file";
    return badge;
  }

  function renderBreadcrumbs() {
    els.breadcrumbs.replaceChildren();

    const home = document.createElement("button");
    home.type = "button";
    home.className = "crumb";
    home.textContent = "$HOME";
    home.addEventListener("click", () => navigate(""));
    els.breadcrumbs.append(home);

    const parts = normalizePath(state.path).split("/").filter(Boolean);
    let accumulated = "";

    parts.forEach((part) => {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "/";
      els.breadcrumbs.append(sep);

      accumulated = accumulated ? `${accumulated}/${part}` : part;
      const target = accumulated;

      const crumb = document.createElement("button");
      crumb.type = "button";
      crumb.className = "crumb";
      crumb.textContent = part;
      crumb.addEventListener("click", () => navigate(target));
      els.breadcrumbs.append(crumb);
    });

    els.upButton.disabled = state.loading || parts.length === 0;
  }

  function renderEntries() {
    els.fileRows.replaceChildren();

    const entries = Array.isArray(state.data?.entries) ? state.data.entries : [];
    const needle = state.filter.trim().toLocaleLowerCase();

    const filtered = needle
      ? entries.filter((entry) => String(entry.name || "").toLocaleLowerCase().includes(needle))
      : entries;

    if (filtered.length === 0) {
      const box = document.createElement("div");
      box.className = "empty";
      const inner = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = needle ? "No matching entries" : "This folder is empty";
      const detail = document.createElement("div");
      detail.textContent = needle
        ? "Clear the filter to restore the full directory view."
        : "No browseable metadata was returned.";
      inner.append(strong, detail);
      box.append(inner);
      els.fileRows.append(box);
    } else {
      for (const entry of filtered) {
        const row = document.createElement(entry.navigable ? "button" : "div");
        row.className = "file-row";
        if (entry.navigable) {
          row.type = "button";
          row.addEventListener("click", () => navigate(entry.path));
        }

        const nameCell = document.createElement("div");
        nameCell.className = "file-name-cell";

        const iconMeta = iconFor(entry);
        const icon = document.createElement("div");
        icon.className = `file-icon ${iconMeta.className}`.trim();
        icon.textContent = iconMeta.label;

        const main = document.createElement("div");
        main.className = "file-main";

        const name = document.createElement("div");
        name.className = "file-name";
        name.textContent = entry.name || "(unnamed)";

        const detail = document.createElement("div");
        detail.className = "file-detail";
        if (entry.restricted) {
          detail.textContent = "blocked by safe-path policy";
        } else if (entry.kind === "symlink") {
          detail.textContent = "link target intentionally not followed";
        } else if (entry.hidden) {
          detail.textContent = "hidden";
        } else {
          detail.textContent = entry.navigable ? "open folder" : "metadata only";
        }

        main.append(name, detail);
        nameCell.append(icon, main);

        const kind = document.createElement("div");
        kind.append(kindBadge(entry));

        const size = document.createElement("div");
        size.className = "cell";
        size.textContent = formatBytes(Number(entry.size), entry.kind);

        const modified = document.createElement("div");
        modified.className = "cell";
        modified.textContent = formatTime(entry.modified);

        row.append(nameCell, kind, size, modified);
        els.fileRows.append(row);
      }
    }

    text(els.entryCount, `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`);
    text(els.pathStatus, state.path ? `$HOME/${state.path}` : "$HOME");
    text(
      els.filteredProof,
      `${Number(state.data?.filtered || 0)} sensitive ${Number(state.data?.filtered || 0) === 1 ? "entry" : "entries"}`
    );
  }

  function render() {
    renderBreadcrumbs();
    renderEntries();
  }

  async function load(path) {
    if (state.loading) return;

    const next = normalizePath(path);
    setBusy(true);

    try {
      const response = await fetch(`${API}?path=${encodeURIComponent(next)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      state.path = normalizePath(payload?.path || "");
      state.data = payload || { entries: [] };

      const hashPath = state.path ? `#/${encodeURI(state.path)}` : "#/";
      if (window.location.hash !== hashPath) {
        history.replaceState(null, "", hashPath);
      }

      setBusy(false);
      render();
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : String(error));
      renderBreadcrumbs();
    }
  }

  function navigate(path) {
    load(path);
  }

  function pathFromHash() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    try {
      return normalizePath(decodeURI(raw));
    } catch {
      return normalizePath(raw);
    }
  }

  function bind() {
    els.fileRows = $("fileRows");
    els.breadcrumbs = $("breadcrumbs");
    els.upButton = $("upButton");
    els.refreshButton = $("refreshButton");
    els.searchInput = $("searchInput");
    els.entryCount = $("entryCount");
    els.pathStatus = $("pathStatus");
    els.filteredProof = $("filteredProof");
    els.apiState = $("apiState");

    els.upButton.addEventListener("click", () => {
      if (state.path) navigate(parentPath(state.path));
    });

    els.refreshButton.addEventListener("click", () => load(state.path));

    els.searchInput.addEventListener("input", (event) => {
      state.filter = event.target.value || "";
      if (state.data) renderEntries();
    });

    window.addEventListener("hashchange", () => {
      const next = pathFromHash();
      if (next !== state.path) load(next);
    });

    window.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        document.activeElement !== els.searchInput &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        els.searchInput.focus();
      }

      if (event.key === "Escape" && document.activeElement === els.searchInput) {
        els.searchInput.value = "";
        state.filter = "";
        renderEntries();
        els.searchInput.blur();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    load(pathFromHash());
  });
})();
