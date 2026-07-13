// ============================================================
// PROGRESSION — the persistent layer: tower roster and skill tree.
//
// Roster rule: a tower's maxLevel is its UNLOCKED POTENTIAL. When a
// veteran is redeployed it starts at level 1, but can be re-upgraded
// to its unlocked level for money alone (no fresh XP needed).
// Veterans deploy automatically: placing a tower type uses your best
// available roster unit of that type before creating a new one.
// ============================================================

import {
  endlessTrackFor, LOOT, SKILLS, SKILL_VALUES, SKILL_TIERS, TOWER_UPGRADES, TOWERS,
  TOWER_SKILL_SPEC, TOWER_SKILL_LAYOUT, ECONOMY_SKILL_SPEC, ECONOMY_LAYOUT,
} from "./config.js";
import { levelMilestonesFor, updateMilestoneResults } from "./milestones.js";
import { loadSave, writeSave, clearSave } from "./save.js";
import { dropIlvl, generateGuaranteedDrop, generateItem, RARITIES } from "./loot.js";
import {
  canEquipItem, emptyGear, masteryRankFor, normalizeGear,
} from "./equipment.js";

let state = loadSave();
migrateSkills();
// Belt-and-suspenders alongside save.js's DEFAULT_SAVE merge: GitHub
// Pages can briefly serve a stale save.js from one file while ui.js/
// progression.js are already the new version (multi-file CDN
// propagation lag right after a deploy), so don't trust every new
// field to exist yet even right after loadSave().
state.endlessBest ||= {};
state.shards ??= 0;
state.stash ||= [];
state.pendingLoot ||= [];
state.store ||= { stock: [], rerolls: 0 };
state.store.stock ||= [];
state.store.rerolls ??= 0;
state.endlessRewards ||= {};
state.seenLoot ||= [];
state.storeUnlocks ||= [];
state.levelMilestones ||= {};
state.skills ||= {};
migrateSkillGraph(); // fold pre-per-tower skills into the new tower branches
backfillGear();
migrateRosterNames();

function backfillGear() {
  state.roster ||= [];
  for (const rec of state.roster) rec.gear = normalizeGear(rec.gear);
}

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

// Fold pre-per-tower skills into the new tower-branch graph. Old single-node
// per-tower damage (laserDamage tier k) becomes that tower's root + damage
// boxes 1..k; the old GLOBAL level-cap spine (towerCap6..10) is grandfathered
// onto EVERY tower (nobody loses the cap they'd unlocked, and no points are
// refunded or re-charged). Idempotent: it only touches known legacy ids.
function migrateSkillGraph() {
  const sk = state.skills;
  if (!sk || typeof sk !== "object") return;
  let changed = false;
  const own = (id) => { if (sk[id] !== 1) { sk[id] = 1; changed = true; } };
  const drop = (id) => { if (id in sk) { delete sk[id]; changed = true; } };

  const oldDamage = {
    laser: "laserDamage", pulse: "pulseDamage", slow: "slowDuration",
    railgun: "railDamage", rocket: "rocketDamage",
  };
  for (const [t, oldId] of Object.entries(oldDamage)) {
    const tier = sk[oldId] | 0;
    if (tier >= 1) {
      own(`${t}_root`);
      for (let i = 1; i <= Math.min(tier, TOWER_SKILL_LAYOUT.damageSteps); i++) own(`${t}_dmg${i}`);
      drop(oldId);
    }
  }

  const capNodes = ["towerCap6", "towerCap7", "towerCap8", "towerCap9", "towerCap10"];
  const capOwned = capNodes.filter((id) => (sk[id] | 0) >= 1).length;
  if (capOwned > 0) {
    for (const t of Object.keys(TOWER_SKILL_SPEC)) {
      own(`${t}_root`);
      for (let k = 0; k < Math.min(capOwned, TOWER_SKILL_LAYOUT.levelSteps); k++) own(`${t}_lvl${6 + k}`);
    }
  }
  for (const id of capNodes) drop(id);

  // Economy: old single multi-tier nodes → per-stat sub-branch chains under
  // the money root. tier k → boxes 1..k of that stat's chain.
  const oldEco = {
    eco_money: "moneyPerKill", eco_xp: "xpGain", eco_shard: "shardFind",
    eco_intrate: "interestRate", eco_intcap: "interestCap",
  };
  let anyEco = false;
  for (const [key, oldId] of Object.entries(oldEco)) {
    const tier = sk[oldId] | 0;
    if (tier >= 1) {
      for (let i = 1; i <= Math.min(tier, ECONOMY_LAYOUT.steps); i++) own(`${key}${i}`);
      drop(oldId);
      anyEco = true;
    }
  }
  if (anyEco) own("money_root");

  // railPen kept its id; make sure its railgun root is owned so it isn't
  // orphaned/locked after the reshuffle.
  if ((sk.railPen | 0) >= 1) own("railgun_root");

  if (changed) writeSave(state);
}

// Count owned single-tier skill nodes whose id starts with `prefix`
// (e.g. "laser_dmg", "railgun_lvl") — the per-tower chains are contiguous.
function ownedSkillCount(prefix) {
  let n = 0;
  for (const id in state.skills) {
    if (id.startsWith(prefix) && (state.skills[id] | 0) >= 1) n++;
  }
  return n;
}

// GEAR_UI_DESIGN.md U2: roster names moved from single-letter prefixes
// (L-01, K-02...) to full tower names (Laser-01, Rocket-02...). Rewrite
// once on load, keeping each tower's existing number so counters/veteran
// identity stay stable; idempotent (already-migrated names are skipped).
function migrateRosterNames() {
  let changed = false;
  for (const rec of state.roster) {
    const def = TOWERS[rec.type];
    if (!def || rec.name.startsWith(`${def.rosterPrefix}-`)) continue;
    rec.name = `${def.rosterPrefix}-${rec.name.split("-").pop()}`;
    changed = true;
  }
  if (changed) writeSave(state);
}

export function getProgress() {
  return state;
}

// ---------- Skill tree (5 tiers per skill) ----------

export function getSkillTier(id) {
  return state.skills[id] || 0;
}

// Per-node max tier / cost table (fall back to the shared defaults).
export function skillMaxTier(id) {
  return SKILLS[id]?.maxTier ?? SKILL_TIERS.maxTier;
}
function skillCosts(id) {
  return SKILLS[id]?.costs ?? SKILL_TIERS.costs;
}

// Cost of the NEXT tier, or null if maxed.
export function nextTierCost(id) {
  const tier = getSkillTier(id);
  const max = skillMaxTier(id);
  if (tier >= max) return null;
  const costs = skillCosts(id);
  return costs[Math.min(tier, costs.length - 1)];
}

// A node is BUYABLE if it isn't maxed and — for its FIRST tier only — its
// parent prerequisite has at least one tier. Once a node is owned (tier>=1)
// the parent gate no longer applies, so pre-B3 saves keep upgrading skills
// that happen to sit deeper in the new graph.
export function isSkillUnlocked(id) {
  const node = SKILLS[id];
  if (!node) return false;
  if (getSkillTier(id) >= 1) return true;
  return !node.parent || getSkillTier(node.parent) >= 1;
}

export function getSkillPoints() {
  return state.skillPoints;
}

export function buySkill(id) {
  if (!SKILLS[id]) return false;
  const cost = nextTierCost(id);
  if (cost === null || state.skillPoints < cost) return false;
  if (!isSkillUnlocked(id)) return false; // parent prerequisite not met
  state.skillPoints -= cost;
  state.skills[id] = getSkillTier(id) + 1;
  writeSave(state);
  return true;
}

// ---------- Skill effects ----------

// Per-tower level cap: base 5 plus that tower's owned Overclock boxes
// (`<type>_lvl6..10`). With no type it falls back to the base cap. Mastery is
// intentionally NOT re-anchored to the cap (see equipment.js) — it stays at the
// base-cap XP threshold for every tower, so unlocking higher levels never nerfs
// a veteran's mastery ranks.
export function getTowerLevelCap(type) {
  const base = TOWER_UPGRADES.maxLevel;
  if (!type) return base;
  return base + ownedSkillCount(`${type}_lvl`);
}

// Economy effects sum the owned boxes in each stat's sub-branch chain
// (`eco_*` id prefix), times that stat's per-box step from ECONOMY_SKILL_SPEC.
function ecoSum(key) {
  return ECONOMY_SKILL_SPEC[key].step * ownedSkillCount(key);
}

// Cash interest applied each wave-clear (game.js): floor(money*rate), capped.
export function getInterestRate() {
  return ecoSum("eco_intrate");
}
export function getInterestCap() {
  return ecoSum("eco_intcap");
}

// Account-wide shard-find multiplier (composes with per-tower gear shardFind).
export function getSkillShardFindMult() {
  return 1 + ecoSum("eco_shard");
}

// Railgun beam-length multiplier (over-penetration): x1.0 up to x2.0.
export function getRailBeamLengthMult() {
  return 1 + SKILL_VALUES.railPen * getSkillTier("railPen");
}

export function getMoneyMult() {
  return 1 + ecoSum("eco_money");
}

export function getXpMult() {
  return 1 + ecoSum("eco_xp");
}

export function getCoreBonus() {
  return SKILL_VALUES.coreHealth * getSkillTier("coreHealth");
}

// Per-tower damage multiplier = 1 + step x owned damage boxes for that tower.
// The Slow tower's chain feeds duration instead (getSlowDurationMult), so it
// contributes no damage here.
export function getTowerDamageMult(type) {
  const spec = TOWER_SKILL_SPEC[type];
  if (!spec || spec.stat !== "damage") return 1;
  return 1 + spec.damageStep * ownedSkillCount(`${type}_dmg`);
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

// The Slow tower's damage chain feeds slow-effect duration.
export function getSlowDurationMult() {
  const spec = TOWER_SKILL_SPEC.slow;
  return 1 + spec.damageStep * ownedSkillCount("slow_dmg");
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
      rec = {
        name: t.name, type: t.type, maxLevel: 1, xp: 0, kills: 0,
        gear: normalizeGear(t.gear),
      };
      state.roster.push(rec);
    }
    rec.maxLevel = Math.max(rec.maxLevel, t.level);
    rec.xp = t.xp;      // XP carries across battles
    rec.kills = t.kills;
  }
  // shardsEarned accumulates as a float per-kill (enemies.js damageEnemy);
  // round once here so the wallet always holds a whole number.
  state.shards += Math.round(game.shardsEarned || 0);
}

export function getShards() {
  return state.shards;
}

// ---------- Store (P5) ----------

function storeIlvlFromRoster() {
  const store = LOOT.store;
  let strongest = 0;
  for (const rec of state.roster) {
    const score = (rec.maxLevel || 1) * store.ilvlPerMaxLevel +
      masteryRankFor(rec.xp || 0) * store.ilvlPerMasteryRank;
    strongest = Math.max(strongest, score);
  }
  return Math.max(1, Math.min(LOOT.gen.ilvlMax, store.ilvlBase + strongest));
}

function generateStoreStock() {
  const { stockSize, rarityUnlocks } = LOOT.store;
  const unlocks = state.storeUnlocks || [];
  // Zero out rarities the player hasn't unlocked yet; common is always allowed.
  const weights = {};
  for (const [rarity, w] of Object.entries(LOOT.gen.rarityWeights)) {
    weights[rarity] = !(rarity in rarityUnlocks) || unlocks.includes(rarity) ? w : 0;
  }
  state.store.stock = Array.from(
    { length: stockSize },
    () => generateItem({ ilvl: storeIlvlFromRoster(), weights })
  );
}

function normalizeStore() {
  state.store ||= { stock: [], rerolls: 0 };
  state.store.stock ||= [];
  state.store.rerolls ??= 0;
  if (!state.store.stock.length) {
    generateStoreStock();
    writeSave(state);
  }
}

export function getStoreStock() {
  normalizeStore();
  return state.store.stock;
}

export function storeRerollCost() {
  normalizeStore();
  return LOOT.store.rerollCost + state.store.rerolls * LOOT.store.rerollCostIncrement;
}

export function rerollStore() {
  const cost = storeRerollCost();
  if (state.shards < cost) return { ok: false, reason: "shards", cost };
  state.shards -= cost;
  state.store.rerolls += 1;
  generateStoreStock();
  writeSave(state);
  return { ok: true, cost, stock: state.store.stock };
}

export function buyStoreItem(itemId) {
  normalizeStore();
  const item = state.store.stock.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: "missing" };
  if (getStash().length >= LOOT.stash.stashSize) return { ok: false, reason: "stash" };
  const cost = LOOT.store.prices[item.rarity] || 0;
  if (state.shards < cost) return { ok: false, reason: "shards", cost };
  state.shards -= cost;
  state.store.stock = state.store.stock.filter((candidate) => candidate.id !== itemId);
  state.stash.push(structuredClone(item));
  writeSave(state);
  return { ok: true, item, cost };
}

export function getStoreUnlocks() {
  state.storeUnlocks ||= [];
  return state.storeUnlocks;
}

export function buyStoreUnlock(rarity) {
  const cost = LOOT.store.rarityUnlocks[rarity];
  if (cost === undefined) return { ok: false, reason: "invalid" };
  state.storeUnlocks ||= [];
  if (state.storeUnlocks.includes(rarity)) return { ok: false, reason: "owned" };
  if (state.shards < cost) return { ok: false, reason: "shards", cost };
  state.shards -= cost;
  state.storeUnlocks.push(rarity);
  generateStoreStock();
  writeSave(state);
  return { ok: true, cost };
}

// Each game begins a fresh store visit: replace all remaining stock and reset
// the escalating reroll price. Called alongside every battle-result save.
function refreshStoreAfterRun() {
  state.store ||= { stock: [], rerolls: 0 };
  state.store.rerolls = 0;
  generateStoreStock();
}

export function getStash() {
  state.stash ||= [];
  return state.stash;
}

// ---------- Seen-loot tracking (GEAR_UI_DESIGN.md §2b NEW badges) ----------
// A magenta NEW tag marks stash items the player hasn't opened yet. Tracked
// as a plain id list rather than a flag on the item object (simpler, and
// items are structuredClone'd around a lot). Pruned to ids still actually
// in the stash so it can't grow unbounded.
function pruneSeenLoot() {
  state.seenLoot ||= [];
  const live = new Set(getStash().map((item) => item.id));
  state.seenLoot = state.seenLoot.filter((id) => live.has(id));
}

export function isItemSeen(itemId) {
  state.seenLoot ||= [];
  return state.seenLoot.includes(itemId);
}

export function markItemSeen(itemId) {
  state.seenLoot ||= [];
  if (!state.seenLoot.includes(itemId)) {
    state.seenLoot.push(itemId);
    writeSave(state);
  }
}

export function countUnseenStash() {
  pruneSeenLoot();
  return getStash().filter((item) => !state.seenLoot.includes(item.id)).length;
}

export function getPendingLoot() {
  state.pendingLoot ||= [];
  return state.pendingLoot;
}

export function stashSlotsFree() {
  return Math.max(0, LOOT.stash.stashSize - getStash().length);
}

function itemSellValue(item) {
  return LOOT.gen.sellValues[item && item.rarity] || 0;
}

function removeItemById(list, itemId) {
  const i = list.findIndex((item) => item.id === itemId);
  if (i < 0) return null;
  return list.splice(i, 1)[0];
}

function addToStashOrPending(item) {
  if (!item) return "none";
  if (getStash().length < LOOT.stash.stashSize) {
    state.stash.push(structuredClone(item));
    return "stash";
  }
  state.pendingLoot.push(structuredClone(item));
  return "pending";
}

export function claimPendingLoot() {
  const moved = [];
  while (state.pendingLoot.length && state.stash.length < LOOT.stash.stashSize) {
    moved.push(state.pendingLoot.shift());
    state.stash.push(moved[moved.length - 1]);
  }
  writeSave(state);
  return { moved: moved.length, remaining: state.pendingLoot.length };
}

export function discardPendingLoot() {
  const discarded = state.pendingLoot.length;
  state.pendingLoot = [];
  writeSave(state);
  return discarded;
}

export function sellStashItem(itemId) {
  const item = removeItemById(getStash(), itemId);
  if (!item) return { ok: false, reason: "missing" };
  const value = itemSellValue(item);
  state.shards += value;
  writeSave(state);
  return { ok: true, value };
}

export function sellPendingItem(itemId) {
  const item = removeItemById(getPendingLoot(), itemId);
  if (!item) return { ok: false, reason: "missing" };
  const value = itemSellValue(item);
  state.shards += value;
  writeSave(state);
  return { ok: true, value };
}

export function sellAllStashRarity(rarity) {
  let sold = 0;
  let value = 0;
  state.stash = getStash().filter((item) => {
    if (item.rarity !== rarity) return true;
    sold += 1;
    value += itemSellValue(item);
    return false;
  });
  state.shards += value;
  writeSave(state);
  return { sold, value };
}

export function equipStashItem(towerName, itemId) {
  const item = removeItemById(getStash(), itemId);
  if (!item) return { ok: false, reason: "missing" };
  const result = equipItem(towerName, item);
  if (!result.ok) {
    state.stash.push(item);
    writeSave(state);
    return result;
  }
  if (result.previous) result.previousStored = addToStashOrPending(result.previous);
  writeSave(state);
  return result;
}

export function unequipToStash(towerName, slot) {
  const result = unequipItem(towerName, slot);
  if (!result.ok || !result.previous) return result;
  result.previousStored = addToStashOrPending(result.previous);
  writeSave(state);
  return result;
}

// ---------- Auto-equip on earn (U0, GEAR_UI_DESIGN.md §1b) ----------
// Loot EARNED in play (kill drops, guaranteed end-drop, Endless milestone
// loot) tries to equip itself before hitting storage. Store purchases
// deliberately skip this — buyStoreItem banks straight into the stash.

// The best roster tower this item may auto-equip onto, or null. Eligible =
// passes canEquipItem (type match, reqs, and the ★1 gate) AND the item's
// slot is empty (with fillEmptyOnly off: occupied by strictly lower rarity).
function autoEquipTarget(item) {
  const candidates = state.roster.filter((rec) => {
    if (!canEquipItem(rec, item).ok) return false;
    const current = normalizeGear(rec.gear)[item.slot];
    if (!current) return true;
    if (LOOT.autoEquip?.fillEmptyOnly ?? true) return false;
    return RARITIES.indexOf(item.rarity) > RARITIES.indexOf(current.rarity);
  });
  candidates.sort((a, b) =>
    masteryRankFor(b.xp || 0) - masteryRankFor(a.xp || 0) ||
    (b.maxLevel || 1) - (a.maxLevel || 1) ||
    (b.xp || 0) - (a.xp || 0)
  );
  return candidates[0] || null;
}

// Bank one earned item: auto-equip, else stash, else pendingLoot triage.
// Returns a placement { item, dest: "equipped"|"stash"|"pending",
// towerName?, displaced? } for the end-of-battle summary. Callers writeSave.
function bankEarnedItem(item) {
  if (!(LOOT.autoEquip?.enabled ?? false)) {
    state.pendingLoot.push(structuredClone(item));
    return { item, dest: "pending" };
  }
  const rec = autoEquipTarget(item);
  if (rec) {
    rec.gear = normalizeGear(rec.gear);
    const previous = rec.gear[item.slot];
    rec.gear[item.slot] = structuredClone(item);
    const placement = { item, dest: "equipped", towerName: rec.name };
    if (previous) placement.displaced = addToStashOrPending(previous);
    return placement;
  }
  return { item, dest: addToStashOrPending(item) };
}

export function recordRunLoot(game) {
  state.pendingLoot ||= [];
  // No wave cleared (instant quit/forfeit) = no guaranteed end-drop. Kill
  // drops from whatever was killed still stand — they're already gated by
  // the drop chance roll and rarity gates.
  const guaranteed = game.waveIndex >= 1 ? [generateGuaranteedDrop(game)] : [];
  const drops = [...(game.lootDrops || []), ...guaranteed];
  const placements = drops.map((item) => bankEarnedItem(item));
  game.lootResult = {
    count: drops.length,
    placements,
    pending: state.pendingLoot.length,
    stashFree: stashSlotsFree(),
  };
  return game.lootResult;
}

// Equipment writes are intentionally small and independent from the stash
// (P4). The returned previous item lets a later UI move it back to storage.
export function equipItem(towerName, item) {
  const rec = state.roster.find((r) => r.name === towerName);
  const check = canEquipItem(rec, item);
  if (!check.ok) return check;
  rec.gear = normalizeGear(rec.gear);
  const previous = rec.gear[item.slot];
  rec.gear[item.slot] = structuredClone(item);
  writeSave(state);
  return { ok: true, item: rec.gear[item.slot], previous };
}

export function unequipItem(towerName, slot) {
  const rec = state.roster.find((r) => r.name === towerName);
  if (!rec || !Object.hasOwn(emptyGear(), slot)) return { ok: false, reason: "invalid" };
  rec.gear = normalizeGear(rec.gear);
  const previous = rec.gear[slot];
  rec.gear[slot] = null;
  writeSave(state);
  return { ok: true, previous };
}

// Console-only bridge until the stash/equip UI arrives in P4.
export function debugGrantGear(towerName, options = {}) {
  const { force = true, ...generatorOptions } = options;
  const item = generateItem(generatorOptions);
  const rec = state.roster.find((r) => r.name === towerName);
  if (!rec) return { ok: false, reason: "invalid", generated: item };
  if (item.towerType && item.towerType !== rec.type) {
    return { ok: false, reason: "towerType", generated: item };
  }
  if (!force) return { ...equipItem(towerName, item), generated: item };
  rec.gear = normalizeGear(rec.gear);
  const previous = rec.gear[item.slot];
  rec.gear[item.slot] = structuredClone(item);
  writeSave(state);
  return { ok: true, item: rec.gear[item.slot], previous, generated: item };
}

// Called once when a campaign battle ends (win or lose); wins earn a
// skill point and mark the level cleared (which unlocks its Endless mode).
export function recordBattleEnd(game, won) {
  syncRoster(game);
  recordRunLoot(game);
  refreshStoreAfterRun();
  grantLevelMilestones(game, won);

  if (won) {
    state.skillPoints += 1;
    state.wins += 1;
    if (!state.completedLevels.includes(game.level.id)) {
      state.completedLevels.push(game.level.id);
    }
  }
  writeSave(state);
}

// ---------- Per-level campaign milestones (B5) ----------

function claimedLevelMilestones(levelId) {
  state.levelMilestones ||= {};
  state.levelMilestones[levelId] ||= [];
  return state.levelMilestones[levelId];
}

// Grant any milestones attained this run that haven't been claimed before,
// and stash a recap on `game` for the end screen. `won` unlocks the
// whole-run challenges (Flawless, tower-limit clears). Endless runs never
// grant campaign milestones. Idempotent across replays: a claimed id is
// skipped, so re-attaining it re-toasts (harmless) but pays nothing.
function grantLevelMilestones(game, won) {
  if (game.endless) return;
  updateMilestoneResults(game, { atEnd: won });
  const attained = game.milestoneResults || new Set();
  const claimed = claimedLevelMilestones(game.level.id);
  const newIds = new Set();
  for (const m of levelMilestonesFor(game.level.id)) {
    if (!attained.has(m.id) || claimed.includes(m.id)) continue;
    claimed.push(m.id);
    newIds.add(m.id);
    // Campaign rewards are combined: { skillPoints, shards }, both optional.
    if (m.reward.shards) state.shards += m.reward.shards;
    if (m.reward.skillPoints) state.skillPoints += m.reward.skillPoints;
  }
  game.campaignMilestones = {
    attained: levelMilestonesFor(game.level.id).filter((m) => attained.has(m.id)),
    newIds,
  };
}

// For the level-detail sheet: every campaign milestone for a level, tagged
// with whether it's been claimed. Mirrors getEndlessMilestones.
export function getLevelMilestones(levelId) {
  const claimed = new Set(state.levelMilestones[levelId] || []);
  return levelMilestonesFor(levelId).map((m) => ({ ...m, claimed: claimed.has(m.id) }));
}

// Player-initiated exit mid-battle (the X button + confirm). No win/loss
// is recorded either way — just walking away — but towers keep the XP
// they earned so far, same philosophy as an actual loss.
export function forfeitBattle(game) {
  syncRoster(game);
  recordRunLoot(game);
  refreshStoreAfterRun();
  grantLevelMilestones(game, false); // a bail-out isn't a clear — no whole-run challenges
  writeSave(state);
  return game.lootResult;
}

// ---------- Endless mode ----------
// No "win" — a run only ends when the core falls. Roster XP still
// carries over like any battle; the score is the wave reached.

export function recordEndlessResult(game) {
  syncRoster(game);
  const lootResult = recordRunLoot(game);
  refreshStoreAfterRun();
  const waveReached = game.waveIndex + 1;
  const prevBest = state.endlessBest[game.level.id] || 0;
  const isNewBest = waveReached > prevBest;
  if (isNewBest) state.endlessBest[game.level.id] = waveReached;
  // Milestones are keyed to the level's BEST-ever wave, not just this run,
  // so a threshold already cleared by a past run (including ones from
  // before this reward track existed) still grants retroactively.
  const newRewards = grantEndlessRewards(game.level.id, state.endlessBest[game.level.id]);
  writeSave(state);
  return {
    waveReached, isNewBest, bestWave: state.endlessBest[game.level.id],
    lootResult, newRewards,
  };
}

export function getBestEndlessWave(levelId) {
  return state.endlessBest[levelId] || 0;
}

// ---------- Endless reward tracks (LOOT_DESIGN.md §10) ----------

function claimedEndlessIds(levelId) {
  state.endlessRewards ||= {};
  state.endlessRewards[levelId] ||= [];
  return state.endlessRewards[levelId];
}

// Grants every milestone whose threshold is <= bestWave and isn't already
// claimed for this level. Shards bank straight into the wallet; loot goes
// through the same earn pipeline as any other drop (auto-equip → stash →
// pendingLoot triage, U0). Returns the list of milestones newly granted
// this call (for the end-of-run UI), loot ones tagged with `placement`.
function grantEndlessRewards(levelId, bestWave) {
  const claimed = claimedEndlessIds(levelId);
  const granted = [];
  for (const m of endlessTrackFor(levelId)) {
    if (m.type !== "wave" || bestWave < m.threshold || claimed.includes(m.id)) continue;
    claimed.push(m.id);
    if (m.reward.kind === "shards") {
      state.shards += m.reward.amount;
      granted.push(m);
    } else if (m.reward.kind === "loot") {
      const levelNumber = Number(levelId.slice(-3)) || 1;
      state.pendingLoot ||= [];
      const item = generateItem({
        rarity: m.reward.rarity,
        ilvl: dropIlvl(levelNumber, m.threshold),
      });
      granted.push({ ...m, placement: bankEarnedItem(item) });
    }
  }
  return granted;
}

// For the level-select Endless button and any future progress display:
// every milestone for a level, tagged with whether it's been claimed.
export function getEndlessMilestones(levelId) {
  const claimed = new Set(state.endlessRewards[levelId] || []);
  return endlessTrackFor(levelId).map((m) => ({ ...m, claimed: claimed.has(m.id) }));
}

export function resetProgress() {
  clearSave();
  state = loadSave();
  migrateSkills();
  state.endlessBest ||= {};
  state.shards ??= 0;
  state.stash ||= [];
  state.pendingLoot ||= [];
  state.store ||= { stock: [], rerolls: 0 };
  state.store.stock ||= [];
  state.store.rerolls ??= 0;
  state.endlessRewards ||= {};
  state.seenLoot ||= [];
  backfillGear();
  migrateRosterNames();
}
