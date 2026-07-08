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
  return 1;
}

// The Railgun is the reward for clearing the first campaign.
export function isTowerUnlocked(type) {
  if (type === "railgun") return state.completedLevels.includes("level_005");
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

// Called once when a battle ends (win or lose): every tower that
// fought joins/updates the roster, and wins earn a skill point.
export function recordBattleEnd(game, won) {
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

  if (won) {
    state.skillPoints += 1;
    state.wins += 1;
    if (!state.completedLevels.includes(game.level.id)) {
      state.completedLevels.push(game.level.id);
    }
  }
  writeSave(state);
}

export function resetProgress() {
  clearSave();
  state = loadSave();
}
