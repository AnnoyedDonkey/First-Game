// ============================================================
// PROGRESSION — the persistent layer: tower roster and skill tree.
//
// Roster rule: a tower's maxLevel is its UNLOCKED POTENTIAL. When a
// veteran is redeployed it starts at level 1, but can be re-upgraded
// to its unlocked level for money alone (no fresh XP needed).
// Veterans deploy automatically: placing a tower type uses your best
// available roster unit of that type before creating a new one.
// ============================================================

import { SKILLS, SKILL_VALUES, SKILL_TIERS } from "./config.js";
import { loadSave, writeSave, clearSave } from "./save.js";

let state = loadSave();
migrateSkills();
// Belt-and-suspenders alongside save.js's DEFAULT_SAVE merge: GitHub
// Pages can briefly serve a stale save.js from one file while ui.js/
// progression.js are already the new version (multi-file CDN
// propagation lag right after a deploy), so don't trust every new
// field to exist yet even right after loadSave().
state.endlessBest ||= {};
state.shards ??= 0;

// Older saves stored skills as an array of owned ids; tiers store
// them as { id: tierNumber }. Convert once on load.
function migrateSkills() {
  if (Array.isArray(state.skills)) {
    const tiers = {};
    for (const id of state.skills) tiers[id] = 1;
    state.skills = tiers;
    writeSave(state);
  }
}

export function getProgress() {
  return state;
}

// ---------- Skill tree (5 tiers per skill) ----------

export function getSkillTier(id) {
  return state.skills[id] || 0;
}

// Cost of the NEXT tier, or null if maxed.
export function nextTierCost(id) {
  const tier = getSkillTier(id);
  if (tier >= SKILL_TIERS.maxTier) return null;
  return SKILL_TIERS.costs[tier];
}

export function getSkillPoints() {
  return state.skillPoints;
}

export function buySkill(id) {
  if (!SKILLS[id]) return false;
  const cost = nextTierCost(id);
  if (cost === null || state.skillPoints < cost) return false;
  state.skillPoints -= cost;
  state.skills[id] = getSkillTier(id) + 1;
  writeSave(state);
  return true;
}

// Skill-derived modifiers: tier N = N x the per-tier value.
export function getMoneyMult() {
  return 1 + SKILL_VALUES.moneyPerKill * getSkillTier("moneyPerKill");
}

export function getXpMult() {
  return 1 + SKILL_VALUES.xpGain * getSkillTier("xpGain");
}

export function getCoreBonus() {
  return SKILL_VALUES.coreHealth * getSkillTier("coreHealth");
}

export function getTowerDamageMult(type) {
  if (type === "laser") return 1 + SKILL_VALUES.laserDamage * getSkillTier("laserDamage");
  if (type === "pulse") return 1 + SKILL_VALUES.pulseDamage * getSkillTier("pulseDamage");
  if (type === "railgun") return 1 + SKILL_VALUES.railDamage * getSkillTier("railDamage");
  if (type === "rocket") return 1 + SKILL_VALUES.rocketDamage * getSkillTier("rocketDamage");
  return 1;
}

// Tower guide auto-opens once, when the player starts level 2.
export function shouldShowTowerGuide() {
  return !state.seenTowerGuide;
}

export function markTowerGuideSeen() {
  state.seenTowerGuide = true;
  writeSave(state);
}

// Late towers are campaign rewards: the Railgun for clearing World 1
// (level 5), the Rocket Launcher for clearing World 2 (level 10).
export function isTowerUnlocked(type) {
  if (type === "railgun") return state.completedLevels.includes("level_005");
  if (type === "rocket") return state.completedLevels.includes("level_010");
  return true;
}

export function getSlowDurationMult() {
  return 1 + SKILL_VALUES.slowDuration * getSkillTier("slowDuration");
}

// ---------- Roster ----------

// Best not-yet-deployed roster unit of a type (veterans first).
export function takeRosterUnit(type, deployedNames) {
  const candidates = state.roster.filter(
    (r) => r.type === type && !deployedNames.has(r.name)
  );
  candidates.sort((a, b) => b.maxLevel - a.maxLevel || b.xp - a.xp);
  return candidates[0] || null;
}

// Shared by recordBattleEnd, recordEndlessResult and forfeitBattle: every
// tower that fought joins/updates the persistent roster, and Shards
// earned this battle (win, lose, or forfeit — see enemies.js damageEnemy)
// are banked into the wallet.
function syncRoster(game) {
  for (const t of game.towers) {
    let rec = state.roster.find((r) => r.name === t.name);
    if (!rec) {
      rec = { name: t.name, type: t.type, maxLevel: 1, xp: 0, kills: 0 };
      state.roster.push(rec);
    }
    rec.maxLevel = Math.max(rec.maxLevel, t.level);
    rec.xp = t.xp;      // XP carries across battles
    rec.kills = t.kills;
  }
  state.shards += game.shardsEarned;
}

export function getShards() {
  return state.shards;
}

// Called once when a campaign battle ends (win or lose); wins earn a
// skill point and mark the level cleared (which unlocks its Endless mode).
export function recordBattleEnd(game, won) {
  syncRoster(game);

  if (won) {
    state.skillPoints += 1;
    state.wins += 1;
    if (!state.completedLevels.includes(game.level.id)) {
      state.completedLevels.push(game.level.id);
    }
  }
  writeSave(state);
}

// Player-initiated exit mid-battle (the X button + confirm). No win/loss
// is recorded either way — just walking away — but towers keep the XP
// they earned so far, same philosophy as an actual loss.
export function forfeitBattle(game) {
  syncRoster(game);
  writeSave(state);
}

// ---------- Endless mode ----------
// No "win" — a run only ends when the core falls. Roster XP still
// carries over like any battle; the score is the wave reached.

export function recordEndlessResult(game) {
  syncRoster(game);
  const waveReached = game.waveIndex + 1;
  const prevBest = state.endlessBest[game.level.id] || 0;
  const isNewBest = waveReached > prevBest;
  if (isNewBest) state.endlessBest[game.level.id] = waveReached;
  writeSave(state);
  return { waveReached, isNewBest, bestWave: state.endlessBest[game.level.id] };
}

export function getBestEndlessWave(levelId) {
  return state.endlessBest[levelId] || 0;
}

export function resetProgress() {
  clearSave();
  state = loadSave();
}
