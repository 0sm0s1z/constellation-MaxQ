(() => {
  "use strict";

  const API = "/api/stubs/sessions";

  const state = {
    sessions: [],
    filter: "",
    loading: false,
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    el.textContent = value == null ? "" : String(value);
  }

  function setBusy(value) {
    state.loading = value;
    els.refreshButton.disabled = value;
    setText(els.apiState, value ? "API · scanning" : "API · live");
    els.apiState.className = value ? "badge warn" : "badge ok";
  }

  function formatTime(raw) {
    if (!raw) return "No recent activity";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function authBadge(session) {
    const badge = document.createElement("span");

    switch (session.auth_state) {
      case "signed-in":
        badge.className = "badge ok";
        badge.textContent = "signed-in";
        break;
      case "session-data-present":
        badge.className = "badge warn";
        badge.textContent = "session present";
        break;
      default:
        badge.className = "badge dim";
        badge.textContent = "no auth evidence";
        break;
    }

    return badge;
  }

  function evidenceLabel(label, on) {
    const item = document.createElement("span");
    item.className = "dot-label";

    const dot = document.createElement("span");
    dot.className = `dot ${on ? "on" : ""}`.trim();

    const text = document.createElement("span");
    text.textContent = label;

    item.append(dot, text);
    return item;
  }

  function renderMetrics(items) {
    const browsers = new Set(items.map((item) => item.browser).filter(Boolean));

    setText(els.metricProfiles, items.length);
    setText(
      els.metricSignedIn,
      items.filter((item) => Boolean(item.signed_in)).length
    );
    setText(
      els.metricSessionData,
      items.filter((item) => Boolean(item.session_data_present)).length
    );
    setText(els.metricBrowsers, browsers.size);
  }

  function createSessionCard(session) {
    const card = document.createElement("article");
    card.className = "session-card glass";

    const profile = document.createElement("div");
    profile.className = "profile-head";

    const icon = document.createElement("div");
    icon.className = "profile-icon";
    icon.textContent = String(session.browser || "CH")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "CH";

    const copy = document.createElement("div");
    copy.className = "profile-copy";

    const name = document.createElement("div");
    name.className = "profile-name";
    name.textContent = session.profile || "Unknown profile";

    const browser = document.createElement("div");
    browser.className = "profile-browser";
    browser.textContent = session.browser || "Chrome-family browser";

    copy.append(name, browser);
    profile.append(icon, copy);

    const pathField = document.createElement("div");
    const pathLabel = document.createElement("div");
    pathLabel.className = "field-label";
    pathLabel.textContent = "Profile path";

    const pathValue = document.createElement("div");
    pathValue.className = "field-value";
    pathValue.textContent = session.path || "$HOME";

    pathField.append(pathLabel, pathValue);

    const authField = document.createElement("div");
    const authLabel = document.createElement("div");
    authLabel.className = "field-label";
    authLabel.textContent = "Auth state";
    authField.append(authLabel, authBadge(session));

    const evidence = document.createElement("div");
    evidence.className = "evidence";
    evidence.append(
      evidenceLabel("account metadata", Boolean(session.signed_in)),
      evidenceLabel("session DB", Boolean(session.session_data_present))
    );
    authField.append(evidence);

    const activityField = document.createElement("div");
    const activityLabel = document.createElement("div");
    activityLabel.className = "field-label";
    activityLabel.textContent = "Last activity";

    const activityValue = document.createElement("div");
    activityValue.className = "field-value";
    activityValue.textContent = formatTime(session.last_active);

    activityField.append(activityLabel, activityValue);

    card.append(profile, pathField, authField, activityField);
    return card;
  }

  function render() {
    els.sessionList.replaceChildren();

    const needle = state.filter.trim().toLocaleLowerCase();
    const filtered = needle
      ? state.sessions.filter((session) => {
          const haystack = [
            session.browser,
            session.profile,
            session.path,
            session.auth_state,
          ]
            .join(" ")
            .toLocaleLowerCase();

          return haystack.includes(needle);
        })
      : state.sessions;

    renderMetrics(state.sessions);

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty glass";

      const inner = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = needle
        ? "No sessions match this filter"
        : "No Chrome profiles detected";

      const detail = document.createElement("div");
      detail.textContent = needle
        ? "Clear the search field to restore all discovered profiles."
        : "The API found no supported Chrome-family profile directories beneath $HOME.";

      inner.append(strong, detail);
      empty.append(inner);
      els.sessionList.append(empty);
      return;
    }

    filtered.forEach((session) => {
      els.sessionList.append(createSessionCard(session));
    });
  }

  function showError(message) {
    els.sessionList.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty glass";

    const inner = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = "Session inventory unavailable";

    const detail = document.createElement("div");
    detail.textContent = message || "The Go API returned an error.";

    inner.append(strong, detail);
    empty.append(inner);
    els.sessionList.append(empty);

    setText(els.apiState, "API · error");
    els.apiState.className = "badge error";
  }

  async function load() {
    if (state.loading) return;
    setBusy(true);

    try {
      const response = await fetch(API, {
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

      state.sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
      state.sessions.sort((a, b) => {
        const browserCompare = String(a.browser || "").localeCompare(String(b.browser || ""));
        if (browserCompare !== 0) return browserCompare;

        if (a.profile === "Default" && b.profile !== "Default") return -1;
        if (b.profile === "Default" && a.profile !== "Default") return 1;

        return String(a.profile || "").localeCompare(String(b.profile || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });

      setBusy(false);
      setText(
        els.lastRefresh,
        payload?.generated_at
          ? new Date(payload.generated_at).toLocaleTimeString()
          : new Date().toLocaleTimeString()
      );

      render();
    } catch (error) {
      setBusy(false);
      showError(error instanceof Error ? error.message : String(error));
    }
  }

  function bind() {
    els.sessionList = $("sessionList");
    els.refreshButton = $("refreshButton");
    els.searchInput = $("searchInput");
    els.apiState = $("apiState");
    els.metricProfiles = $("metricProfiles");
    els.metricSignedIn = $("metricSignedIn");
    els.metricSessionData = $("metricSessionData");
    els.metricBrowsers = $("metricBrowsers");
    els.lastRefresh = $("lastRefresh");

    els.refreshButton.addEventListener("click", load);

    els.searchInput.addEventListener("input", (event) => {
      state.filter = event.target.value || "";
      render();
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
        render();
        els.searchInput.blur();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    load();
  });
})();
