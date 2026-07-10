// ============================================================
// LEADERBOARD — shared online high-score board (per-level Endless
// best-wave). This is a BOLT-ON layer: it deliberately keeps its own
// localStorage key (nickname + clientId + what's been published) and
// never touches the game save (geometric-td-save-v1), so it can't
// interact with the save-migration / deploy-propagation gotchas.
//
// Backend is Supabase, reached with plain fetch() against its
// auto-generated REST API — no SDK, no build step, no dependency.
// Fill in LEADERBOARD.url + anonKey in config.js to switch it on;
// while either is blank isEnabled() is false and every function here
// no-ops safely. See SUPABASE_SETUP.md for the one-time server setup.
//
// Every network call is BEST-EFFORT: failures are swallowed (logged to
// console) and never thrown into game code — a dead network must never
// block the RUN OVER overlay or the menu.
// ============================================================

import { LEADERBOARD } from "./config.js";

const KEY = "geometric-td-leaderboard-v1";

// ---------- Local identity (nickname + client id) ----------

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Leaderboard local data unreadable:", err);
  }
  return {};
}

function saveLocal(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Could not write leaderboard local data:", err);
  }
}

// The board is live only once both credentials are present.
export function isEnabled() {
  return !!(LEADERBOARD.url && LEADERBOARD.anonKey);
}

// A stable random id minted once per browser, so a player UPDATES their
// own row per level (upsert on client_id + level_id) instead of piling
// up duplicate rows every time they beat their best.
export function getClientId() {
  const data = loadLocal();
  if (!data.clientId) {
    data.clientId =
      (crypto.randomUUID && crypto.randomUUID()) ||
      "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    saveLocal(data);
  }
  return data.clientId;
}

export function getNickname() {
  return loadLocal().nickname || "";
}

// Returns the cleaned-and-stored nickname (may be "" if cleared).
export function setNickname(name) {
  const clean = sanitizeNick(name);
  const data = loadLocal();
  data.nickname = clean;
  saveLocal(data);
  return clean;
}

function sanitizeNick(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LEADERBOARD.maxNickLength);
}

// ---------- REST helpers ----------

function authHeaders() {
  return {
    apikey: LEADERBOARD.anonKey,
    Authorization: `Bearer ${LEADERBOARD.anonKey}`,
    "Content-Type": "application/json",
  };
}

// ---------- Submit ----------

// Upsert this client's best wave for one level. Best-effort: returns a
// boolean, never throws. Requires a nickname (that's the player's
// identity on the board); silently no-ops without one.
export async function submitScore(levelId, wave) {
  if (!isEnabled()) return false;
  const nickname = getNickname();
  if (!nickname) return false;

  const best = Math.max(1, Math.min(LEADERBOARD.maxWave, Math.floor(wave)));
  const row = {
    client_id: getClientId(),
    level_id: levelId,
    nickname,
    best_wave: best,
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `${LEADERBOARD.url}/rest/v1/${LEADERBOARD.table}` +
        `?on_conflict=client_id,level_id`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          // Upsert: overwrite the existing (client_id, level_id) row.
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      }
    );
    if (!res.ok) {
      console.warn("Leaderboard submit failed:", res.status, await safeText(res));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Leaderboard submit error:", err);
    return false;
  }
}

// Push every locally-known Endless best (the save's endlessBest map).
// Used by the "PUBLISH MY SCORES" button — also re-stamps the player's
// current nickname onto existing rows. Returns { ok, fail } counts.
export async function publishAllLocalBests(endlessBest) {
  if (!isEnabled() || !getNickname()) return { ok: 0, fail: 0 };
  let ok = 0;
  let fail = 0;
  for (const [levelId, wave] of Object.entries(endlessBest || {})) {
    if (!wave) continue;
    const success = await submitScore(levelId, wave);
    if (success) ok++;
    else fail++;
  }
  return { ok, fail };
}

// ---------- Fetch ----------

// Returns { levelId: [{ nickname, wave }, ...] }, each list sorted
// best-first and trimmed to LEADERBOARD.topN. Throws on network/HTTP
// error so the UI can show a distinct "couldn't reach" state.
export async function fetchAllBoards() {
  if (!isEnabled()) return {};
  const url =
    `${LEADERBOARD.url}/rest/v1/${LEADERBOARD.table}` +
    `?select=level_id,nickname,best_wave&order=best_wave.desc`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const rows = await res.json();

  const byLevel = {};
  for (const r of rows) {
    (byLevel[r.level_id] ||= []).push({ nickname: r.nickname, wave: r.best_wave });
  }
  // Global desc order preserves per-level order; just cap each list.
  for (const id of Object.keys(byLevel)) {
    byLevel[id] = byLevel[id].slice(0, LEADERBOARD.topN);
  }
  return byLevel;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
