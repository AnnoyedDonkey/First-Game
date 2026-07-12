// ============================================================
// MILESTONES — per-level campaign challenge evaluator (B5).
//
// Pure logic over run state: given a level's LEVEL_MILESTONES data
// (config.js) and the live `game`, decide which challenges have been
// attained this run. No persistence, no UI — progression.js grants the
// rewards, ui.js renders them, game.js queues the toasts.
//
// Run state this reads (all seeded in game.js createGame):
//   game.kills       - enemies killed this run (enemies.js)
//   game.leaks       - enemies that reached the core (game.js)
//   game.typesUsed   - Set of tower types ever placed (towers.js);
//                      survives sells, unlike scanning game.towers
//   game.towers      - currently-deployed towers (for level checks)
//   game.milestoneResults - Set of attained ids, latched across the run
// ============================================================

import { LEVEL_MILESTONES } from "./config.js";

export function levelMilestonesFor(levelId) {
  return LEVEL_MILESTONES[levelId] || [];
}

// A "whole-run" constraint can only be judged once the battle is won:
// clearNoLeaks, and tower-limit checks that aren't scoped to a wave window
// (a bare onlyTowers/withoutTowers means "for the entire level"). Everything
// else — kills, tower levels, and wave-windowed limits — can latch mid-run.
function resolvesAtEnd(check) {
  if (check.clearNoLeaks) return true;
  if ((check.onlyTowers || check.withoutTowers) && check.throughWave == null) return true;
  return false;
}

// Does the run currently satisfy every clause in `check`?
export function checkPasses(check, game) {
  if (check.throughWave != null && game.waveIndex < check.throughWave) return false;
  if (check.kills != null && (game.kills || 0) < check.kills) return false;
  if (check.clearNoLeaks && (game.leaks || 0) > 0) return false;

  const used = game.typesUsed || new Set();
  if (check.onlyTowers) {
    if (used.size === 0) return false; // "only lasers" needs at least one tower
    for (const t of used) if (!check.onlyTowers.includes(t)) return false;
  }
  if (check.withoutTowers) {
    for (const t of check.withoutTowers) if (used.has(t)) return false;
  }
  if (check.towersAtLevel) {
    const [count, lvl] = check.towersAtLevel;
    const n = (game.towers || []).filter((tw) => tw.level >= lvl).length;
    if (n < count) return false;
  }
  return true;
}

// Latch every milestone whose condition is now met into game.milestoneResults
// and return the ones newly attained on THIS call (for live toasts / grants).
// Once latched a milestone stays attained even if state later changes, so a
// wave-windowed constraint that held through its window can't be un-earned.
// `atEnd` unlocks the whole-run constraints (only pass true on a win).
export function updateMilestoneResults(game, { atEnd = false } = {}) {
  game.milestoneResults ||= new Set();
  const newly = [];
  for (const m of levelMilestonesFor(game.level.id)) {
    if (game.milestoneResults.has(m.id)) continue;
    if (resolvesAtEnd(m.check) && !atEnd) continue;
    if (checkPasses(m.check, game)) {
      game.milestoneResults.add(m.id);
      newly.push(m);
    }
  }
  return newly;
}
