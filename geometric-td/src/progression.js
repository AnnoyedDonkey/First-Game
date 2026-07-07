// ============================================================
// PROGRESSION — the persistent layer: tower roster and skill tree.
//
// Roster rule: a tower's maxLevel is its UNLOCKED POTENTIAL. When a
// veteran is redeployed it starts at level 1, but can be re-upgraded
// to its unlocked level for money alone (no fresh XP needed).
// Veterans deploy automatically: placing a tower type uses your best
// available roster unit of that type before creating a new one.
// ============================================================

import { SKILLS, SKILL_VALUES } from "./config.js";
import { loadSave, writeSave, clearSave } from "./save.js";

let state = loadSave();

export function getProgress() {
  return state;
}

// ---------- Skill tree ----------

export function hasSkill(id) {
  return state.skills.includes(id);
}

export function getSkillPoints() {
  return state.skillPoints;
}

export function buySkill(id) {
  const def = SKILLS[id];
  if (!def || hasSkill(id) || state.skillPoints < def.cost) return false;
  state.skillPoints -= def.cost;
  state.skills.push(id);
  writeSave(state);
  return true;
}

// Skill-derived modifiers, read by the combat/game modules.
export function getMoneyMult() {
  return hasSkill("moneyPerKill") ? 1 + SKILL_VALUES.moneyPerKill : 1;
}

export function getXpMult() {
  return hasSkill("xpGain") ? 1 + SKILL_VALUES.xpGain : 1;
}

export function getCoreBonus() {
  return hasSkill("coreHealth") ? SKILL_VALUES.coreHealth : 0;
}

export function getTowerDamageMult(type) {
  if (type === "laser" && hasSkill("laserDamage")) return 1 + SKILL_VALUES.laserDamage;
  if (type === "pulse" && hasSkill("pulseDamage")) return 1 + SKILL_VALUES.pulseDamage;
  return 1;
}

export function getSlowDurationMult() {
  return hasSkill("slowDuration") ? 1 + SKILL_VALUES.slowDuration : 1;
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
