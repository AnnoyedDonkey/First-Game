// ============================================================
// CO-OP LOBBY — public session metadata over Supabase REST.
//
// net.js owns only signaling and WebRTC. This module deliberately updates the
// other columns on the same row without teaching the transport game concepts.
// ============================================================

import { COOP, LEADERBOARD } from "./config.js";
import { onLangChange, t, tf } from "./i18n.js";

const SESSION_FIELDS = [
  "code", "codename", "listed", "host_nick", "level_id", "wave",
  "players", "max_players", "free_tiles", "last_seen",
].join(",");

export function isLobbyEnabled() {
  return !!(LEADERBOARD.url && LEADERBOARD.anonKey && COOP.table);
}

export function normalizeRoomCode(value) {
  const allowed = new Set(COOP.roomCodeAlphabet);
  return String(value || "")
    .toUpperCase()
    .split("")
    .filter((char) => allowed.has(char))
    .join("")
    .slice(0, COOP.roomCodeLength);
}

// FNV-1a plus a second integer mix gives two deterministic word indexes from
// the room code. The generated value is persisted on the row, so a later
// config or language change cannot rename a session already in progress.
export function codenameForCode(code) {
  const normalized = normalizeRoomCode(code);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const adjectives = COOP.codenames.adjectives;
  const nouns = COOP.codenames.nouns;
  const adjectiveIndex = (hash >>> 0) % adjectives.length;
  const mixed = Math.imul(hash ^ (hash >>> 16), 2246822519);
  const nounIndex = (mixed >>> 0) % nouns.length;
  const adjective = t(
    `coop.codename.adjective.${adjectiveIndex}`,
    adjectives[adjectiveIndex]
  );
  const noun = t(`coop.codename.noun.${nounIndex}`, nouns[nounIndex]);
  return tf("coop.codename.format", "{adjective} {noun}", { adjective, noun })
    .slice(0, COOP.codenameMaxLength);
}

export function countFreeTiles(game) {
  if (!game?.grid) return 0;
  let buildable = 0;
  for (let y = 0; y < game.grid.height; y++) {
    for (let x = 0; x < game.grid.width; x++) {
      if (game.grid.isBuildable(x, y)) buildable++;
    }
  }
  return Math.max(0, buildable - game.towers.length);
}

export async function publishHostSession(code, metadata) {
  return patchSession(code, {
    codename: cleanText(metadata.codename, COOP.codenameMaxLength),
    listed: !!metadata.listed,
    host_nick: cleanNullableText(metadata.hostNick, COOP.hostNickMaxLength),
    level_id: cleanText(metadata.levelId, COOP.levelIdMaxLength),
    wave: cleanCount(metadata.wave, 0),
    players: cleanCount(metadata.players, 1),
    max_players: cleanCount(metadata.maxPlayers, COOP.maxPlayers),
    free_tiles: cleanCount(metadata.freeTiles, 0),
    last_seen: new Date().toISOString(),
  });
}

export async function heartbeatHostSession(code, metadata) {
  return patchSession(code, {
    wave: cleanCount(metadata.wave, 0),
    players: cleanCount(metadata.players, 1),
    free_tiles: cleanCount(metadata.freeTiles, 0),
    last_seen: new Date().toISOString(),
  });
}

export async function fetchPublicSessions() {
  requireConfig();
  const cutoff = new Date(Date.now() - COOP.staleSeconds * 1000);
  const url = new URL(sessionTableUrl());
  url.searchParams.set("select", SESSION_FIELDS);
  url.searchParams.set("listed", "eq.true");
  url.searchParams.set("last_seen", `gte.${cutoff.toISOString()}`);
  url.searchParams.set("order", "last_seen.desc");
  url.searchParams.set("limit", String(COOP.browserSessionLimit));
  const response = await fetch(url, { headers: authHeaders() });
  await requireOk(response, "Could not load co-op sessions");
  const rows = await response.json();
  return rows.map(normalizeSessionRow).filter((row) =>
    row && row.listed && isFresh(row, cutoff.getTime())
  );
}

export async function fetchSessionByCode(value) {
  requireConfig();
  const code = normalizeRoomCode(value);
  if (code.length !== COOP.roomCodeLength) return null;
  const url = new URL(sessionTableUrl());
  url.searchParams.set("select", SESSION_FIELDS);
  url.searchParams.set("code", `eq.${code}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: authHeaders() });
  await requireOk(response, "Could not find co-op session");
  const rows = await response.json();
  const row = normalizeSessionRow(rows[0]);
  return row && isFresh(row, Date.now() - COOP.staleSeconds * 1000)
    ? row
    : null;
}

async function patchSession(value, fields) {
  requireConfig();
  const code = normalizeRoomCode(value);
  const url = new URL(sessionTableUrl());
  url.searchParams.set("code", `eq.${code}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(fields),
  });
  await requireOk(response, "Could not update co-op session");
  const rows = await response.json();
  if (!rows.length) throw new Error("Co-op signaling row is not ready");
  return normalizeSessionRow(rows[0]);
}

function normalizeSessionRow(row) {
  if (!row || typeof row !== "object") return null;
  const code = normalizeRoomCode(row.code);
  if (code.length !== COOP.roomCodeLength || typeof row.level_id !== "string") return null;
  return {
    code,
    codename: cleanText(row.codename, COOP.codenameMaxLength),
    listed: !!row.listed,
    hostNick: cleanNullableText(row.host_nick, COOP.hostNickMaxLength),
    levelId: cleanText(row.level_id, COOP.levelIdMaxLength),
    wave: cleanCount(row.wave, 0),
    players: cleanCount(row.players, 1),
    maxPlayers: cleanCount(row.max_players, COOP.maxPlayers),
    freeTiles: cleanCount(row.free_tiles, 0),
    lastSeen: typeof row.last_seen === "string" ? row.last_seen : "",
  };
}

function isFresh(row, cutoff) {
  const lastSeen = Date.parse(row.lastSeen);
  return Number.isFinite(lastSeen) && lastSeen >= cutoff;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanNullableText(value, maxLength) {
  const clean = cleanText(value, maxLength);
  return clean || null;
}

function cleanCount(value, fallback) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function sessionTableUrl() {
  return `${LEADERBOARD.url.replace(/\/+$/, "")}/rest/v1/${COOP.table}`;
}

function authHeaders() {
  return {
    apikey: LEADERBOARD.anonKey,
    Authorization: `Bearer ${LEADERBOARD.anonKey}`,
    "Content-Type": "application/json",
  };
}

function requireConfig() {
  if (!isLobbyEnabled()) throw new Error("Co-op lobby is not configured");
}

async function requireOk(response, message) {
  if (response.ok) return;
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    // Status remains enough to diagnose a failed best-effort lobby request.
  }
  throw new Error(`${message} (${response.status})${detail ? `: ${detail}` : ""}`);
}

// ---------- Touch lobby UI ----------

const ui = {
  overlay: document.getElementById("coop-overlay"),
  header: document.getElementById("coop-header"),
  back: document.getElementById("coop-back"),
  title: document.getElementById("coop-title"),
  subtitle: document.getElementById("coop-subtitle"),
  content: document.getElementById("coop-content"),
  status: document.getElementById("coop-status"),
  actions: document.getElementById("coop-actions"),
};

let menuOptions = null;
let currentView = "browser";
let selectedVisibility = true;
let visibleSessions = [];
let browserPollId = null;
let browserRequest = 0;
let browserFetchPending = false;
let browserLoaded = false;
let codeRequest = 0;
let activeAttempt = null;

export function initLobbyMenu(options) {
  menuOptions = options;
}

export function openLobbyMenu(messageKey = null) {
  if (!menuOptions || !ui.overlay) return;
  ui.overlay.classList.remove("hidden");
  renderBrowser(messageKey);
}

function closeLobbyMenu() {
  stopBrowserPolling();
  ui.overlay.classList.add("hidden");
}

function setHeader(title, subtitle, onBack) {
  ui.title.textContent = title;
  ui.subtitle.textContent = subtitle;
  ui.back.setAttribute("aria-label", t("coop.back", "Back"));
  ui.back.onclick = onBack;
}

function setStatus(text = "", kind = "") {
  ui.status.textContent = text;
  ui.status.className = kind;
}

function button(label, className = "") {
  return `<button class="big-button ${className}">${escapeHtml(label)}</button>`;
}

function renderBrowser(messageKey = null) {
  currentView = "browser";
  setHeader(
    t("coop.title", "CO-OP"),
    t("coop.browser.subtitle", "LIVE ENDLESS SESSIONS"),
    closeLobbyMenu
  );
  ui.content.innerHTML = `<div id="coop-session-list"></div>`;
  ui.actions.innerHTML =
    button(t("coop.joinCode", "JOIN BY CODE"), "coop-join-code") +
    button(t("coop.hostGame", "HOST GAME"), "coop-host-game");
  ui.actions.querySelector(".coop-join-code").onclick = renderJoinCode;
  ui.actions.querySelector(".coop-host-game").onclick = renderVisibility;
  visibleSessions = [];
  browserLoaded = false;
  renderSessionRows();
  setStatus(
    messageKey ? t(messageKey, "CONNECTION FAILED — TRY AGAIN") :
      t("coop.browser.loading", "SCANNING FOR LIVE SESSIONS…"),
    messageKey ? "error" : ""
  );
  stopBrowserPolling();
  refreshBrowser();
  browserPollId = window.setInterval(refreshBrowser, COOP.browserPollSeconds * 1000);
}

async function refreshBrowser() {
  if (currentView !== "browser" || browserFetchPending) return;
  const request = browserRequest;
  browserFetchPending = true;
  try {
    const sessions = await fetchPublicSessions();
    if (request !== browserRequest || currentView !== "browser") return;
    visibleSessions = sessions;
    browserLoaded = true;
    renderSessionRows();
    setStatus(sessions.length ? "" : t("coop.browser.empty", "NO LIVE PUBLIC SESSIONS"));
  } catch (error) {
    if (request !== browserRequest || currentView !== "browser") return;
    console.warn("Co-op browser refresh failed:", error);
    visibleSessions = [];
    browserLoaded = true;
    renderSessionRows();
    setStatus(t("coop.browser.unavailable", "SESSION BROWSER UNAVAILABLE"), "error");
  } finally {
    if (request === browserRequest) browserFetchPending = false;
  }
}

function renderSessionRows() {
  const list = ui.content.querySelector("#coop-session-list");
  if (!list) return;
  // Empty content area reads as broken; fill the middle with a message. During
  // the very first scan (before any fetch resolves) say so; after that, say the
  // list is genuinely empty and point at HOST GAME.
  if (!visibleSessions.length) {
    const msg = browserLoaded
      ? t("coop.browser.emptyBig", "No live sessions right now.<br>Tap HOST GAME to start one.")
      : t("coop.browser.loadingBig", "Scanning for live sessions…");
    list.innerHTML = `<div class="coop-empty coop-empty-center">${msg}</div>`;
    return;
  }
  list.innerHTML = visibleSessions.map((session) => {
    const level = menuOptions.levels.find((item) => item.id === session.levelId);
    const levelName = level ? menuOptions.levelName(level) : session.levelId;
    const host = session.hostNick
      ? tf("coop.browser.host", "HOST {name}", { name: session.hostNick })
      : t("coop.browser.hostUnknown", "HOST —");
    const isFull = session.players >= session.maxPlayers || session.freeTiles <= 0;
    const joinLabel = isFull ? t("coop.browser.full", "FULL") : t("coop.join", "JOIN");
    return `<article class="coop-session-row">` +
      `<div class="coop-session-copy">` +
        `<strong>${escapeHtml(session.codename)}</strong>` +
        `<span>${escapeHtml(host)}</span>` +
        `<span>${escapeHtml(levelName)} · ${escapeHtml(tf("coop.browser.wave", "WAVE {wave}", { wave: session.wave }))}</span>` +
        `<span>${escapeHtml(tf("coop.browser.players", "{players}/{max} PLAYERS", {
          players: session.players, max: session.maxPlayers,
        }))} · ${escapeHtml(tf("coop.browser.tiles", "{tiles} FREE TILES", {
          tiles: session.freeTiles,
        }))}</span>` +
      `</div>` +
      `<button class="big-button coop-session-join" data-code="${session.code}"${isFull ? " disabled" : ""}>${escapeHtml(joinLabel)}</button>` +
    `</article>`;
  }).join("");
  list.querySelectorAll(".coop-session-join:not(:disabled)").forEach((joinButton) => {
    joinButton.onclick = () => {
      const session = visibleSessions.find((item) => item.code === joinButton.dataset.code);
      if (session) joinKnownSession(session);
    };
  });
}

function renderJoinCode() {
  stopBrowserPolling();
  codeRequest++;
  currentView = "code";
  setHeader(
    t("coop.joinCode", "JOIN BY CODE"),
    t("coop.code.prompt", "ENTER THE HOST'S ROOM CODE"),
    () => renderBrowser()
  );
  ui.content.innerHTML =
    `<input id="coop-code-input" maxlength="${COOP.roomCodeLength}" inputmode="text"` +
    ` autocomplete="off" autocapitalize="characters" spellcheck="false"` +
    ` aria-label="${escapeHtml(t("coop.code.label", "Room code"))}">`;
  ui.actions.innerHTML = button(t("coop.join", "JOIN"), "coop-code-submit");
  setStatus();
  const input = ui.content.querySelector("#coop-code-input");
  input.addEventListener("input", () => {
    const normalized = normalizeRoomCode(input.value);
    if (input.value !== normalized) input.value = normalized;
  });
  const submit = () => findCodeSession(input.value);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  ui.actions.querySelector(".coop-code-submit").onclick = submit;
  input.focus();
}

async function findCodeSession(value) {
  const code = normalizeRoomCode(value);
  if (code.length !== COOP.roomCodeLength) {
    setStatus(t("coop.code.invalid", "ENTER A COMPLETE ROOM CODE"), "error");
    return;
  }
  const request = ++codeRequest;
  setStatus(t("coop.code.searching", "FINDING SESSION…"));
  try {
    const session = await fetchSessionByCode(code);
    if (currentView !== "code" || request !== codeRequest) return;
    if (!session) {
      setStatus(t("coop.code.notFound", "SESSION NOT FOUND OR NO LONGER LIVE"), "error");
      return;
    }
    if (session.players >= session.maxPlayers || session.freeTiles <= 0) {
      setStatus(t("coop.code.full", "THAT SESSION IS FULL"), "error");
      return;
    }
    joinKnownSession(session);
  } catch (error) {
    if (currentView !== "code" || request !== codeRequest) return;
    console.warn("Co-op code lookup failed:", error);
    setStatus(t("coop.browser.unavailable", "SESSION BROWSER UNAVAILABLE"), "error");
  }
}

function renderVisibility() {
  stopBrowserPolling();
  currentView = "visibility";
  setHeader(
    t("coop.hostGame", "HOST GAME"),
    t("coop.host.visibility", "WHO CAN FIND THIS SESSION?"),
    () => renderBrowser()
  );
  ui.content.innerHTML = `<div class="coop-choice-list">` +
    `<button class="coop-choice" data-listed="true"><strong>${escapeHtml(t("coop.host.public", "PUBLIC"))}</strong>` +
      `<span>${escapeHtml(t("coop.host.publicDesc", "LISTED IN THE SESSION BROWSER"))}</span></button>` +
    `<button class="coop-choice" data-listed="false"><strong>${escapeHtml(t("coop.host.private", "PRIVATE"))}</strong>` +
      `<span>${escapeHtml(t("coop.host.privateDesc", "JOINABLE ONLY WITH ITS CODE"))}</span></button>` +
    `</div>`;
  ui.actions.innerHTML = "";
  setStatus();
  ui.content.querySelectorAll(".coop-choice").forEach((choice) => {
    choice.onclick = () => renderHostLevels(choice.dataset.listed === "true");
  });
}

function renderHostLevels(listed) {
  currentView = "levels";
  selectedVisibility = listed;
  setHeader(
    t("coop.host.level", "PICK A CLEARED LEVEL"),
    t("coop.host.endless", "CO-OP ALWAYS STARTS IN ENDLESS"),
    renderVisibility
  );
  const cleared = menuOptions.levels.filter((level) =>
    menuOptions.getCompletedIds().includes(level.id)
  );
  ui.content.innerHTML = cleared.length
    ? `<div class="coop-level-list">${cleared.map((level) =>
        `<button class="coop-choice" data-level="${escapeHtml(level.id)}">` +
          `<strong>${escapeHtml(menuOptions.levelName(level))}</strong>` +
          `<span>${escapeHtml(t("coop.host.endlessShort", "ENDLESS ∞"))}</span>` +
        `</button>`
      ).join("")}</div>`
    : `<div class="coop-empty">${escapeHtml(t(
        "coop.host.noneCleared", "BEAT A CAMPAIGN LEVEL TO HOST CO-OP"
      ))}</div>`;
  ui.actions.innerHTML = "";
  setStatus();
  ui.content.querySelectorAll(".coop-choice[data-level]").forEach((choice) => {
    choice.onclick = () => {
      const level = cleared.find((item) => item.id === choice.dataset.level);
      if (level) hostLevel(level, listed);
    };
  });
}

function hostLevel(level, listed) {
  let pending;
  try {
    pending = menuOptions.onHost(level, {
      listed,
      hostNick: menuOptions.getHostNick(),
    });
  } catch (error) {
    console.warn("Could not start co-op host:", error);
    setStatus(t("coop.connection.failed", "COULD NOT START SESSION"), "error");
    return;
  }
  activeAttempt = pending;
  enterBattleChrome();
  watchAttempt(pending, !listed);
  if (listed) {
    closeLobbyMenu();
  } else {
    renderPrivateRoom(pending.code, pending.codename);
  }
}

function renderPrivateRoom(code, codename) {
  stopBrowserPolling();
  currentView = "private";
  setHeader(
    codename,
    t("coop.private.subtitle", "PRIVATE SESSION — SHARE THIS CODE"),
    cancelActiveSession
  );
  ui.content.innerHTML =
    `<div class="coop-room-code" aria-label="${escapeHtml(t("coop.code.label", "Room code"))}">${escapeHtml(code)}</div>`;
  ui.actions.innerHTML =
    button(t("coop.private.copy", "COPY CODE"), "coop-copy-code") +
    button(t("coop.private.play", "PLAY NOW"), "coop-play-now");
  ui.actions.querySelector(".coop-copy-code").onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus(t("coop.private.copied", "CODE COPIED"), "success");
    } catch {
      setStatus(t("coop.private.copyFailed", "PRESS AND HOLD THE CODE TO COPY"), "error");
    }
  };
  ui.actions.querySelector(".coop-play-now").onclick = closeLobbyMenu;
  setStatus(t("coop.private.waiting", "WAITING FOR A PLAYER…"));
}

function joinKnownSession(session) {
  const level = menuOptions.levels.find((item) => item.id === session.levelId);
  if (!level) {
    setStatus(t("coop.join.unknownLevel", "THIS SESSION USES AN UNKNOWN LEVEL"), "error");
    return;
  }
  stopBrowserPolling();
  currentView = "connecting";
  setHeader(
    session.codename,
    t("coop.join.connecting", "CONNECTING TO HOST…"),
    cancelActiveSession
  );
  ui.content.innerHTML = `<div class="coop-connecting-pulse" aria-hidden="true"></div>`;
  ui.actions.innerHTML = button(t("coop.cancel", "CANCEL"), "coop-cancel");
  ui.actions.querySelector(".coop-cancel").onclick = cancelActiveSession;
  setStatus(tf("coop.join.level", "{level} · WAVE {wave}", {
    level: menuOptions.levelName(level), wave: session.wave,
  }));
  try {
    const pending = menuOptions.onJoin(level, session.code);
    activeAttempt = pending;
    enterBattleChrome();
    watchAttempt(pending, true);
  } catch (error) {
    console.warn("Could not start co-op join:", error);
    setStatus(t("coop.connection.failed", "COULD NOT START SESSION"), "error");
  }
}

function watchAttempt(pending, closeOnConnect = false) {
  pending.then(() => {
    if (activeAttempt !== pending) return;
    activeAttempt = null;
    if (closeOnConnect) closeLobbyMenu();
  }).catch((error) => {
    if (activeAttempt !== pending) return;
    activeAttempt = null;
    console.warn("Co-op connection failed:", error);
    menuOptions.onSessionFailure();
    openLobbyMenu("coop.connection.retry");
  });
}

function cancelActiveSession() {
  activeAttempt = null;
  menuOptions.onCancel();
  openLobbyMenu();
}

function enterBattleChrome() {
  document.getElementById("level-overlay").classList.add("hidden");
  document.getElementById("action-bar").classList.remove("hidden");
  document.getElementById("hud").classList.remove("hidden");
}

function stopBrowserPolling() {
  browserRequest++;
  browserFetchPending = false;
  if (browserPollId !== null) {
    window.clearInterval(browserPollId);
    browserPollId = null;
  }
}

function rerenderCurrentView() {
  if (ui.overlay.classList.contains("hidden")) return;
  if (currentView === "browser") renderBrowser();
  else if (currentView === "code") renderJoinCode();
  else if (currentView === "visibility") renderVisibility();
  else if (currentView === "levels") renderHostLevels(selectedVisibility);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

onLangChange(rerenderCurrentView);
