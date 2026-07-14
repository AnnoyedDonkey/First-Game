// ============================================================
// FEEDBACK — anonymous run telemetry + player difficulty ratings,
// for balancing levels from real play instead of bot guesses.
//
// Like leaderboard.js this is a BOLT-ON layer: same Supabase project
// (reuses LEADERBOARD.url/anonKey), its own `feedback` table, plain
// fetch(), no SDK. See SUPABASE_SETUP.md § "Feedback table" for the
// one-time SQL. Knobs in config.js FEEDBACK.
//
// Flow per battle:
//   1. main.js builds a telemetry snapshot at the win/loss/forfeit
//      moment and calls submitRun() — one INSERT, fire-and-forget.
//   2. If the player taps a rating chip on the end screen (campaign
//      only), submitRating() UPSERTS the same row (keyed by run_id)
//      with the rating — and again if they add an optional note.
//
// Every call is BEST-EFFORT: failures are swallowed (console.warn)
// and never thrown into game code. A missing table (before the SQL
// has been run), a dead network, or a paused Supabase project must
// never block the RUN OVER overlay.
// ============================================================

import { LEADERBOARD, FEEDBACK } from "./config.js";
import { getClientId } from "./leaderboard.js";
import { APP_VERSION } from "./version.js";

export function isEnabled() {
  return !!(FEEDBACK.enabled && LEADERBOARD.url && LEADERBOARD.anonKey);
}

// The last-submitted run row, kept so a later rating/note tap can
// upsert onto it. One battle at a time, so a single slot is enough.
let currentRow = null;

function mintRunId() {
  return (
    (crypto.randomUUID && crypto.randomUUID()) ||
    "r_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

// POST with upsert-on-run_id semantics (same Prefer trick as the
// leaderboard): first call inserts, repeat calls overwrite the row.
async function push(row) {
  try {
    const res = await fetch(
      `${LEADERBOARD.url}/rest/v1/${FEEDBACK.table}?on_conflict=run_id`,
      {
        method: "POST",
        headers: {
          apikey: LEADERBOARD.anonKey,
          Authorization: `Bearer ${LEADERBOARD.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      }
    );
    if (!res.ok) {
      console.warn("Feedback submit failed:", res.status, await safeText(res));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Feedback submit error:", err);
    return false;
  }
}

// Insert this battle's telemetry row. `telemetry` supplies the game
// facts (level_id, mode, outcome, waves, details…) — built in main.js
// so this module stays free of game-state imports.
export async function submitRun(telemetry) {
  if (!isEnabled()) return false;
  currentRow = {
    run_id: mintRunId(),
    client_id: getClientId(),
    app_version: APP_VERSION,
    ...telemetry,
  };
  return push(currentRow);
}

// Attach the player's difficulty rating (and optional note) to the run
// just submitted. Re-taps / note sends simply upsert again, so the row
// always holds their latest answer.
export async function submitRating(rating, note) {
  if (!isEnabled() || !currentRow) return false;
  currentRow = {
    ...currentRow,
    rating,
    note: String(note || "").trim().slice(0, FEEDBACK.maxNoteLength) || null,
  };
  return push(currentRow);
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
