// ============================================================
// EQUIPMENT - save-safe gear helpers and combat stat aggregation.
// Pure data logic: no DOM, game loop, or save writes.
// ============================================================

import { LOOT, TOWER_UPGRADES } from "./config.js";

export const GEAR_SLOTS = ["optic", "emitter", "capacitor", "frame"];

export function emptyGear() {
  return { optic: null, emitter: null, capacitor: null, frame: null };
}

export function normalizeGear(gear) {
  return { ...emptyGear(), ...(gear || {}) };
}

// Mastery remains derived from career XP, so old saves need no new field.
export function masteryRankFor(xp) {
  const m = TOWER_UPGRADES.mastery;
  const x = xp - m.xpStart;
  if (x <= 0) return 0;
  const b = m.baseXpPerRank;
  const k = m.xpRankIncrement;
  let rank;
  if (k === 0) {
    rank = Math.floor(x / b);
  } else {
    rank = Math.floor((-(b - k / 2) + Math.sqrt((b - k / 2) ** 2 + 2 * k * x)) / k);
  }
  return Math.max(0, Math.min(m.maxRanks, rank));
}

function masteryCumulativeXp(n, m) {
  return m.baseXpPerRank * n + m.xpRankIncrement * n * (n - 1) / 2;
}

export function xpToNextMastery(xp) {
  const m = TOWER_UPGRADES.mastery;
  const rank = masteryRankFor(xp);
  if (rank >= m.maxRanks) return null;
  return m.xpStart + masteryCumulativeXp(rank + 1, m) - xp;
}

export function canEquipItem(record, item) {
  if (!record || !item || !GEAR_SLOTS.includes(item.slot)) return { ok: false, reason: "invalid" };
  if (item.towerType && item.towerType !== record.type) return { ok: false, reason: "towerType" };
  if ((record.maxLevel || 1) < (item.reqLevel || 0)) return { ok: false, reason: "level" };
  if (masteryRankFor(record.xp || 0) < (item.reqMastery || 0)) {
    return { ok: false, reason: "mastery" };
  }
  return { ok: true };
}

export function aggregateGear(gear) {
  const stats = {
    range: 0, critChance: 0, critDamage: 0,
    damage: 0, projSpeed: 0, pierce: 0, splash: 0,
    fireRate: 0, slowPotency: 0, slowDuration: 0, overcharge: 0,
    xpGain: 0, shardFind: 0, bounty: 0,
  };
  const uniques = new Set();

  for (const slot of GEAR_SLOTS) {
    const item = gear && gear[slot];
    if (!item) continue;
    for (const affix of item.affixes || []) {
      if (Object.hasOwn(stats, affix.stat)) stats[affix.stat] += affix.value;
    }
    if (item.unique) uniques.add(item.unique);
  }

  for (const unique of LOOT.gen.uniques.minor) {
    if (!uniques.has(unique.id)) continue;
    if (unique.id === "doubleShot") stats.overcharge += unique.value;
    if (unique.id === "critEdge") stats.critChance += unique.value;
    if (unique.id === "piercer") stats.pierce += unique.value;
  }
  if (uniques.has("cascadeRail")) stats.pierce += LOOT.combat.cascadeBonusPierce;

  return { stats, uniques };
}
