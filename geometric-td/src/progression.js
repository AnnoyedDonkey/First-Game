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
  COOP, endlessTrackFor, LOOT, SKILLS, SKILL_VALUES, SKILL_TIERS, TOWER_UPGRADES, TOWERS,
  TOWER_SKILL_SPEC, TOWER_SKILL_LAYOUT, ECONOMY_SKILL_SPEC, ECONOMY_LAYOUT, ECONOMY,
  GAME_SPEED_SKILL, LEADERBOARD, NARRATIVE,
} from "./config.js";
import { levelMilestonesFor, updateMilestoneResults } from "./milestones.js";
import {
  loadSave, writeSave, clearSave, backfillItemSaveDefaults,
  snapshotSaveForModLab, restoreModLabSaveSnapshot, hasModLabSaveSnapshot,
} from "./save.js";
import { setActiveLang, t } from "./i18n.js";
import { dropIlvl, generateGuaranteedDrop, generateItem, RARITIES } from "./loot.js";
import {
  canEquipItem, emptyGear, GEAR_SLOTS, masteryRankFor, normalizeGear,
} from "./equipment.js";
import { getMod, modPowerForRarity } from "./affixes.js";

let state = loadSave();
let gearChangeHandler = null;

// ---------- Roguelike run sandbox ----------
// While a roguelike run is active, the gameplay skill/economy getters below
// return RUN values (a fresh account plus any drafted run upgrades) instead of
// the real save's, so a run battle behaves as a clean slate WITHOUT reading or
// writing the save. roguelike.js sets this for the whole run and clears it when
// the run ends. `mults` holds one value per shimmed getter (defaults =
// fresh-account base; see roguelike.js buildRunContext); `unlockedTowers` and
// `speeds` back the two non-numeric shims. Campaign/co-op run with ctx = null,
// so their behavior is byte-for-byte unchanged. Declared here — above the
// module-init backfills that call the shimmed getters — to avoid a TDZ error.
let activeRunContext = null;
export function setRunContext(ctx) { activeRunContext = ctx || null; }
export function getRunContext() { return activeRunContext; }

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
state.store.skillPointPurchases ??= 0;
state.endlessRewards ||= {};
state.seenLoot ||= [];
state.storeUnlocks ||= [];
state.stashUpgrades ??= 0;
state.autoJunkTier ??= -1;
state.autoJunkPaused ||= [];
// Migrate the short-lived single global pause toggle (2026.08.09-4) to the
// per-rarity model (2026.08.09-5): it paused everything owned, so pause
// every owned rarity individually under the new field, then drop the old
// one. Real saves are unlikely to have hit this window, but cheap either way.
if (state.autoJunkEnabled === false) {
  const idx = state.autoJunkTier ?? -1;
  if (idx >= 0) {
    const owned = LOOT.autoJunk.tiers.slice(0, idx + 1).map((t) => t.rarity);
    state.autoJunkPaused = Array.from(new Set([...state.autoJunkPaused, ...owned]));
  }
}
delete state.autoJunkEnabled;
state.levelMilestones ||= {};
state.tutorialDone ??= false;
// Any save that already has real progress (a level cleared or an
// existing roster) belongs to a player well past the tutorial's target
// moment (level_001's very first campaign start) — never show it to
// them retroactively, even if this field predates their save.
if (!state.tutorialDone && (state.completedLevels.length > 0 || state.roster.length > 0)) {
  state.tutorialDone = true;
  writeSave(state);
}
state.skills ||= {};
migrateSkillGraph(); // fold pre-per-tower skills into the new tower branches
migrateFreeSkillRoots(); // refund formerly paid branch-head unlocks once
backfillGear();
backfillItemMods();
migrateRosterNames();
state.narrativeSeen ||= {};
backfillNarrativeSeen(); // P2: spare existing players a retroactive story dump
state.seenEnemyIntros ||= [];
backfillEnemyIntros(); // P3: spare existing players retroactive enemy tutorials
state.seenTowerIntros ||= [];
backfillTowerIntros(); // Tower cards: spare veterans retroactive recruit intros
state.seenTowerBarks ||= [];
if (state.barksEnabled === undefined) state.barksEnabled = true;
if (!["auto", "full", "reduced"].includes(state.visualEffects)) state.visualEffects = "auto";
if (state.debugMode === undefined) state.debugMode = false;
// UI language (default English). Belt-and-suspenders alongside save.js's
// DEFAULT_SAVE merge, then seed the i18n engine so the first render (and
// static [data-i18n] markup) is already in the player's chosen language.
if (state.lang !== "fr" && state.lang !== "en") state.lang = "en";
setActiveLang(state.lang);

function backfillGear() {
  state.roster ||= [];
  for (const rec of state.roster) rec.gear = normalizeGear(rec.gear);
}

// Items live in four save branches. Default the additive field in memory but
// do not write a migration: older bytes remain untouched until the player next
// performs an ordinary save-producing action.
function backfillItemMods() {
  const visit = (item) => backfillItemSaveDefaults(item);
  for (const item of state.stash || []) visit(item);
  for (const item of state.pendingLoot || []) visit(item);
  for (const item of state.store?.stock || []) visit(item);
  for (const rec of state.roster || []) {
    const gear = normalizeGear(rec.gear);
    for (const slot of GEAR_SLOTS) visit(gear[slot]);
  }
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
      for (let i = 1; i <= Math.min(tier, TOWER_SKILL_LAYOUT.damageSteps); i++) own(`${t}_dmg${i}`);
      drop(oldId);
    }
  }

  const capNodes = ["towerCap6", "towerCap7", "towerCap8", "towerCap9", "towerCap10"];
  const capOwned = capNodes.filter((id) => (sk[id] | 0) >= 1).length;
  if (capOwned > 0) {
    for (const t of Object.keys(TOWER_SKILL_SPEC)) {
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
  for (const [key, oldId] of Object.entries(oldEco)) {
    const tier = sk[oldId] | 0;
    if (tier >= 1) {
      for (let i = 1; i <= Math.min(tier, ECONOMY_LAYOUT.steps); i++) own(`${key}${i}`);
      drop(oldId);
    }
  }
  // Old Over-Penetration was one five-tier node. Preserve its effective tier
  // by expanding it into the new one-box-per-increment chain.
  const oldRailPenTier = sk.railPen | 0;
  if (oldRailPenTier >= 1) {
    for (let i = 1; i <= Math.min(oldRailPenTier, SKILL_TIERS.maxTier); i++) own(`railPen${i}`);
    drop("railPen");
  }

  if (changed) writeSave(state);
}

// Branch heads used to cost one point but had no effect. They are now free,
// always-owned navigation nodes. Refund saved purchases and remove their
// obsolete entries so this migration is idempotent.
function migrateFreeSkillRoots() {
  const sk = state.skills;
  let refund = 0;
  for (const [id, node] of Object.entries(SKILLS)) {
    if (!node.free || !(sk[id] >= 1)) continue;
    delete sk[id];
    refund += 1; // historical branch-head price
  }
  if (refund > 0) {
    state.skillPoints += refund;
    writeSave(state);
  }
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

// P2 per-level story beats: a mid-campaign player must NOT be shown World
// 1-3 story retroactively just because this field is new to their save. On
// every load, mark the `.start`/`.win` beats of every ALREADY-completed
// level as seen (they can still read them on demand via ▶ STORY); forward/
// unplayed levels are untouched and play their beats normally the first
// time they're reached. A brand-new save has no completedLevels, so nothing
// is pre-marked. Idempotent — safe to run every load.
function backfillNarrativeSeen() {
  state.narrativeSeen ||= {};
  let changed = false;
  for (const levelId of state.completedLevels || []) {
    for (const suffix of ["start", "win", "boss"]) {
      const id = `${levelId}.${suffix}`;
      if (!state.narrativeSeen[id]) {
        state.narrativeSeen[id] = true;
        changed = true;
      }
    }
  }
  // NOTE: the First-Mastery explainer is intentionally NOT backfilled here.
  // Even a seasoned player who has never seen the card should meet it on their
  // next Mastery rank-up (towers.js flags any rank-up; main.js gates on the
  // one-time shouldShowBeat("firstMastery")), so we leave that gate open.
  if (changed) writeSave(state);
}

// Spare veterans (anyone with at least one completed level) a retroactive
// dump of enemy-tutorial barks for a roster they already know by heart —
// mark every NARRATIVE.enemyIntros key seen. Brand-new saves (no
// completions) are untouched and see each intro the first time that type
// actually spawns. Idempotent — safe to run every load.
function backfillEnemyIntros() {
  state.seenEnemyIntros ||= [];
  if ((state.completedLevels || []).length === 0) return;
  let changed = false;
  for (const type of Object.keys(NARRATIVE.enemyIntros || {})) {
    if (!state.seenEnemyIntros.includes(type)) {
      state.seenEnemyIntros.push(type);
      changed = true;
    }
  }
  if (changed) writeSave(state);
}

// Late-tower recruit cards belong at the moment a tower unlocks, not years
// later for an existing player. At load, mark every already-unlocked recruit
// seen; a tower unlocked later in this session remains unseen and gets its
// card on the next level. Idempotent — safe to run every load.
function backfillTowerIntros() {
  state.seenTowerIntros ||= [];
  let changed = false;
  for (const type of Object.keys(NARRATIVE.towerIntros || {})) {
    if (isTowerUnlocked(type) && !state.seenTowerIntros.includes(type)) {
      state.seenTowerIntros.push(type);
      changed = true;
    }
  }
  if (changed) writeSave(state);
}

export function getProgress() {
  return state;
}

// Main installs the one live-battle bridge; menu-only consumers can equip
// normally without importing or owning a game object.
export function setGearChangeHandler(fn) {
  gearChangeHandler = typeof fn === "function" ? fn : null;
}

// ---------- Skill tree (5 tiers per skill) ----------

export function getSkillTier(id) {
  if (SKILLS[id]?.free) return 1;
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

// Read-only copy of the account's skill spread, for the end-of-battle
// balance telemetry (feedback.js): which nodes are owned at what tier,
// plus unspent points — "were they under-levelled or badly specced?".
export function getSkillsSnapshot() {
  return { skills: { ...state.skills }, unspentPoints: state.skillPoints };
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
  if (activeRunContext) return activeRunContext.mults.towerLevelCap;
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
  if (activeRunContext) return activeRunContext.mults.interestRate;
  return ecoSum("eco_intrate");
}
// Cap = a data-driven base (economy.interest.baseCap) PLUS the owned Reserve
// Cap boxes. The base makes Compound Yield pay out the moment it's bought —
// without it, cap starts at 0 and min(interest, 0) zeroes the rate entirely
// until Reserve Cap is also purchased. game.js still gates on rate > 0, so the
// base never grants interest to a player who hasn't bought Compound Yield.
export function getInterestCap() {
  if (activeRunContext) return activeRunContext.mults.interestCap;
  return (ECONOMY.interest?.baseCap || 0) + ecoSum("eco_intcap");
}

// Account-wide shard-find multiplier (composes with per-tower gear shardFind).
export function getSkillShardFindMult() {
  if (activeRunContext) return activeRunContext.mults.shardFindMult;
  return 1 + ecoSum("eco_shard");
}

// Railgun charge-speed multiplier (Capacitor Bank): x1.0 up to ~x2.0. Divides
// the base charge wind-up (config VFX.railgun.chargeSeconds) in towers.js, so a
// maxed capacitor roughly halves the wind-up. The `railPen` id/value are legacy
// (the perk used to stretch beam length before the ray became unlimited).
export function getRailChargeSpeedMult() {
  if (activeRunContext) return activeRunContext.mults.railChargeSpeedMult;
  return 1 + SKILL_VALUES.railPen * ownedSkillCount("railPen");
}

export function getMoneyMult() {
  if (activeRunContext) return activeRunContext.mults.moneyMult;
  return 1 + ecoSum("eco_money");
}

export function getXpMult() {
  if (activeRunContext) return activeRunContext.mults.xpMult;
  return 1 + ecoSum("eco_xp");
}

export function getCoreBonus() {
  if (activeRunContext) return activeRunContext.mults.coreBonus;
  return SKILL_VALUES.coreHealth * getSkillTier("coreHealth");
}

// Unlocked game-speed multipliers for the fast-forward control: the always-free
// base speeds plus each owned Game Acceleration tier (ids gameSpeed6..gameSpeed16).
// Read live so a freshly-bought tier applies on the next battle without a reload.
export function getUnlockedSpeeds() {
  if (activeRunContext) return activeRunContext.speeds.slice();
  const base = (GAME_SPEED_SKILL?.base ?? [2, 4]).slice();
  const owned = (GAME_SPEED_SKILL?.tiers ?? [])
    .filter((t) => (state.skills[`gameSpeed${t.mult}`] | 0) >= 1)
    .map((t) => t.mult);
  return base.concat(owned).sort((a, b) => a - b);
}

// Per-tower damage multiplier = 1 + step x owned damage boxes for that tower.
// The Slow tower's chain feeds duration instead (getSlowDurationMult), so it
// contributes no damage here.
export function getTowerDamageMult(type) {
  if (activeRunContext) return activeRunContext.mults.towerDamageMult;
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

// First-play tutorial (T4): shown once, only on level_001's very first
// campaign start. See src/tutorial.js for the step-gating state machine.
export function shouldShowTutorial() {
  return !state.tutorialDone;
}

export function markTutorialDone() {
  state.tutorialDone = true;
  writeSave(state);
}

// Player name (P1 narrative onboarding): set during the intro sequence,
// surfaced on the home screen and substituted into story copy. Mirrors
// the leaderboard nickname's max length so the two stay consistent.
export function getPlayerName() {
  return state.playerName || t('intro.nameSkipLabel', 'Operator'); // display fallback
}
export function hasPlayerName() {
  return !!state.playerName;
}
export function setPlayerName(name) {
  const clean = String(name || "").trim().slice(0, LEADERBOARD.maxNickLength);
  state.playerName = clean || null;
  writeSave(state);
}

// First-load story intro (P1): shown once, then re-runnable from the menu
// via REPLAY INTRO. See src/onboarding.js for the step-gating state machine.
export function shouldShowOnboarding() {
  return !state.onboardingDone;
}
export function markOnboardingDone() {
  state.onboardingDone = true;
  writeSave(state);
}

// Per-level story beats (P2): shown once each, first START then (later)
// first WIN, per level. Beat ids are `${levelId}.start` / `${levelId}.win`
// (see config.js NARRATIVE.beats). Existing players are spared retroactive
// beats for already-completed levels via backfillNarrativeSeen() above; the
// ▶ STORY replay control (ui.js openLevelSheet) re-plays a level's beats on
// demand without touching this flag.
export function shouldShowBeat(id) {
  return !state.narrativeSeen[id];
}
export function markBeatSeen(id) {
  if (state.narrativeSeen[id]) return;
  state.narrativeSeen[id] = true;
  writeSave(state);
}

// In-battle enemy intros (P3): once-ever per type, first campaign
// appearance, gated the same way as story beats above. Veterans are spared
// via backfillEnemyIntros() at load.
export function shouldShowEnemyIntro(type) {
  return !state.seenEnemyIntros.includes(type);
}
export function markEnemyIntroSeen(type) {
  if (state.seenEnemyIntros.includes(type)) return;
  state.seenEnemyIntros.push(type);
  writeSave(state);
}

// Pre-battle recruit cards for late tower unlocks. Veterans are spared
// retroactive cards via backfillTowerIntros() at load.
export function shouldShowTowerIntro(type) {
  return !state.seenTowerIntros.includes(type);
}
export function markTowerIntroSeen(type) {
  if (state.seenTowerIntros.includes(type)) return;
  state.seenTowerIntros.push(type);
  writeSave(state);
}

// Tower placement one-liners (P4, re-gated): shown ONCE EVER per tower type
// (first placement in any campaign battle), not per level/battle. No veteran
// backfill — everyone hears each tower's line once.
export function shouldShowTowerBark(type) {
  return !state.seenTowerBarks.includes(type);
}
export function markTowerBarkSeen(type) {
  if (state.seenTowerBarks.includes(type)) return;
  state.seenTowerBarks.push(type);
  writeSave(state);
}

// Master toggle for all in-battle banter (enemy intros, boss taunts/roasts,
// tower one-liners). Persisted; flipped from the menu. Defaults ON.
export function getBarksEnabled() {
  return state.barksEnabled !== false;
}
export function setBarksEnabled(on) {
  state.barksEnabled = !!on;
  writeSave(state);
}

// Per-device visual quality. AUTO is intentionally the default: it can react
// to iOS Low Power Mode's lower render cadence without affecting another
// player's presentation or putting any preference on the co-op wire.
export function getVisualEffectsMode() {
  return ["full", "reduced"].includes(state.visualEffects)
    ? state.visualEffects
    : "auto";
}
export function setVisualEffectsMode(mode) {
  state.visualEffects = ["full", "reduced"].includes(mode) ? mode : "auto";
  writeSave(state);
}

export function getDebugMode() {
  return state.debugMode === true;
}
export function setDebugMode(on) {
  state.debugMode = !!on;
  writeSave(state);
}

// On-device Mod Lab safety: the save module keeps the original serialized
// bytes under a separate key, so restore remains exact across reloads.
export function snapshotModLabSave() {
  return snapshotSaveForModLab();
}

export function hasModLabSnapshot() {
  return hasModLabSaveSnapshot();
}

export function restoreModLabSave() {
  const raw = restoreModLabSaveSnapshot();
  if (raw === null) return { ok: false, reason: "missing" };
  state = loadSave();
  backfillGear();
  backfillItemMods();
  return { ok: true, bytes: raw.length };
}

// Shared by the console handles and on-device Lab. A pinned id is allowed even
// before it exists in MODS; registered definitions resolve either a rarity
// table or a global stored power through the same config-backed path as loot.
export function debugSpawnMod(id, powerOrRarity = "common", options = {}) {
  const modId = typeof id === "string" ? id.trim() : "";
  if (!/^[A-Za-z0-9_-]+$/.test(modId)) return { ok: false, reason: "modId" };
  const rarity = typeof powerOrRarity === "string"
    ? powerOrRarity
    : (options.rarity || "common");
  if (!RARITIES.includes(rarity)) return { ok: false, reason: "rarity" };
  const power = typeof powerOrRarity === "number"
    ? powerOrRarity
    : modPowerForRarity(modId, rarity);
  if (!Number.isFinite(power)) return { ok: false, reason: "power" };
  const slot = options.slot || GEAR_SLOTS[0];
  const towerType = options.towerType ?? null;
  if (!GEAR_SLOTS.includes(slot) || (towerType !== null && !Object.hasOwn(TOWERS, towerType))) {
    return { ok: false, reason: "item" };
  }
  const item = generateItem({
    rarity, slot, towerType, ilvl: options.ilvl,
    mods: [{ id: modId, power }],
  });
  state.stash ||= [];
  state.stash.push(item);
  writeSave(state);
  return { ok: true, item, registered: !!getMod(modId) };
}

// UI language. getLang/setLang persist the choice and re-point the i18n
// engine (which re-applies static markup and notifies UI to re-render).
export function getLang() {
  return state.lang === "fr" ? "fr" : "en";
}
export function setLang(lang) {
  state.lang = lang === "fr" ? "fr" : "en";
  writeSave(state);
  setActiveLang(state.lang);
}

// Late towers are campaign rewards: the Railgun for clearing World 1
// (level 5), the Rocket Launcher for clearing World 2 (level 10).
export function isTowerUnlocked(type) {
  if (activeRunContext) return activeRunContext.unlockedTowers.includes(type);
  if (type === "railgun") return state.completedLevels.includes("level_005");
  if (type === "rocket") return state.completedLevels.includes("level_010");
  return true;
}

// The Slow tower's damage chain feeds slow-effect duration.
export function getSlowDurationMult() {
  if (activeRunContext) return activeRunContext.mults.slowDurationMult;
  const spec = TOWER_SKILL_SPEC.slow;
  return 1 + spec.damageStep * ownedSkillCount("slow_dmg");
}

// The Slow tower's third chain (Slow Potency) feeds slow-effect strength
// (% speed reduction), same shape as getRailChargeSpeedMult above.
export function getSlowPotencyMult() {
  if (activeRunContext) return activeRunContext.mults.slowPotencyMult;
  return 1 + SKILL_VALUES.slowPot * ownedSkillCount("slowPot");
}

// The Laser tower's third chain (Rapid Fire) feeds fire-rate multiplier.
export function getLaserFireRateMult() {
  if (activeRunContext) return activeRunContext.mults.laserFireRateMult;
  return 1 + SKILL_VALUES.laserRate * ownedSkillCount("laserRate");
}

// The Pulse tower's third chain (Blast Radius) feeds splash-radius multiplier.
export function getPulseBlastRadiusMult() {
  if (activeRunContext) return activeRunContext.mults.pulseBlastRadiusMult;
  return 1 + SKILL_VALUES.pulseBlast * ownedSkillCount("pulseBlast");
}

// The Rocket tower's third chain (Payload Yield) feeds splash-radius multiplier.
export function getRocketBlastRadiusMult() {
  if (activeRunContext) return activeRunContext.mults.rocketBlastRadiusMult;
  return 1 + SKILL_VALUES.rocketBlast * ownedSkillCount("rocketBlast");
}

// ---------- Roster ----------

const MAX_CAREER_LEVEL = TOWER_UPGRADES.maxLevel + TOWER_SKILL_LAYOUT.levelSteps;

function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(record, keys) {
  if (!plainRecord(record)) return false;
  const actual = Object.keys(record);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(record, key));
}

function safeWhole(value, min, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function validCoopItem(item) {
  const fields = [
    "id", "slot", "rarity", "towerType", "ilvl", "reqLevel",
    "reqMastery", "affixes", "mods", "unique",
  ];
  const legacyFields = fields.filter((field) => field !== "mods");
  if ((!exactKeys(item, fields) && !exactKeys(item, legacyFields)) ||
      typeof item.id !== "string" || item.id.length < 1 ||
      item.id.trim() !== item.id ||
      item.id.length > COOP.progressionExchange.maxItemIdLength ||
      !GEAR_SLOTS.includes(item.slot) || !RARITIES.includes(item.rarity) ||
      (item.towerType !== null && !Object.hasOwn(TOWERS, item.towerType)) ||
      !safeWhole(item.ilvl, 1, LOOT.gen.ilvlMax) ||
      !safeWhole(item.reqLevel, 0, LOOT.gen.reqLevelMax) ||
      !safeWhole(item.reqMastery, 0, TOWER_UPGRADES.mastery.maxRanks) ||
      !Array.isArray(item.affixes) ||
      (item.mods !== undefined && !Array.isArray(item.mods))) return false;

  const expectedLevel = item.rarity === "common" || item.rarity === "enhanced"
    ? Math.max(1, Math.min(
        LOOT.gen.reqLevelMax,
        1 + Math.floor((item.ilvl / LOOT.gen.ilvlMax) * LOOT.gen.reqLevelMax)
      ))
    : 0;
  if (item.reqLevel !== expectedLevel ||
      item.reqMastery !== LOOT.gen.reqMastery[item.rarity]) return false;

  const affixCount = LOOT.gen.affixCounts[item.rarity];
  const minAffixes = Array.isArray(affixCount) ? affixCount[0] : affixCount;
  const maxAffixes = Array.isArray(affixCount) ? affixCount[1] : affixCount;
  if (item.affixes.length < minAffixes || item.affixes.length > maxAffixes) return false;

  const seenStats = new Set();
  for (const affix of item.affixes) {
    if (!exactKeys(affix, ["stat", "value"]) || typeof affix.stat !== "string" ||
        !Number.isSafeInteger(affix.value) || seenStats.has(affix.stat)) return false;
    const def = LOOT.gen.slots[item.slot].find((candidate) => candidate.stat === affix.stat);
    const allowed = def && (def.types === "universal" ||
      (item.towerType !== null && def.types.includes(item.towerType)));
    if (!allowed) return false;
    const [lo, hi] = def.ranges[item.rarity];
    const upper = Math.round(hi * (item.towerType === null ? 1 : LOOT.gen.restrictedRollBonus));
    if (affix.value < lo || affix.value > upper) return false;
    seenStats.add(affix.stat);
  }

  const seenMods = new Set();
  for (const mod of item.mods || []) {
    if (!exactKeys(mod, ["id", "power"]) || typeof mod.id !== "string" ||
        !getMod(mod.id) || !Number.isFinite(mod.power) || seenMods.has(mod.id)) return false;
    seenMods.add(mod.id);
  }

  const minor = LOOT.gen.uniques.minor.find((unique) => unique.id === item.unique);
  const named = LOOT.gen.uniques.named.find((unique) => unique.id === item.unique);
  if (item.rarity === "prismatic") return !!minor;
  if (item.rarity === "singularity") {
    return !!named && named.slot === item.slot &&
      (named.towerType ?? null) === item.towerType;
  }
  return item.unique === null;
}

export function validateCoopGear(gear) {
  if (!exactKeys(gear, GEAR_SLOTS)) return false;
  return GEAR_SLOTS.every((slot) =>
    gear[slot] === null || (validCoopItem(gear[slot]) && gear[slot].slot === slot)
  );
}

export function validateCoopTowerRecord(record, includeType = false) {
  const fields = includeType
    ? ["name", "type", "maxLevel", "xp", "kills", "gear"]
    : ["name", "maxLevel", "xp", "kills", "gear"];
  return exactKeys(record, fields) &&
    typeof record.name === "string" && record.name.length >= 1 &&
    record.name.trim() === record.name &&
    record.name.length <= COOP.progressionExchange.maxNameLength &&
    (!includeType || Object.hasOwn(TOWERS, record.type)) &&
    safeWhole(record.maxLevel, 1, MAX_CAREER_LEVEL) &&
    safeWhole(record.xp, 0) && safeWhole(record.kills, 0) &&
    validateCoopGear(record.gear);
}

export function validateCoopLootItem(item) {
  return validCoopItem(item);
}

function savedItemIds() {
  const ids = new Set();
  const add = (item) => { if (item && typeof item.id === "string") ids.add(item.id); };
  for (const rec of state.roster) {
    const gear = normalizeGear(rec.gear);
    for (const slot of GEAR_SLOTS) add(gear[slot]);
  }
  for (const item of state.stash || []) add(item);
  for (const item of state.pendingLoot || []) add(item);
  for (const item of state.store?.stock || []) add(item);
  return ids;
}

// Co-op deliberately banks only roster combat progress, attributed kill loot,
// and attributed Shards. Network callers cannot create roster records; the
// trusted-local option exists solely for the host's own freshly fielded towers.
export function bankCoopRun(payload, { trustedLocalTowers = false } = {}) {
  if (!exactKeys(payload, ["towers", "loot", "shards"]) ||
      !Array.isArray(payload.towers) ||
      payload.towers.length > COOP.progressionExchange.maxBattleTowers ||
      !Array.isArray(payload.loot) ||
      payload.loot.length > COOP.progressionExchange.maxLootDrops ||
      !safeWhole(payload.shards, 0)) {
    return { ok: false, reason: "shape" };
  }

  const names = new Set();
  for (const tower of payload.towers) {
    if (!validateCoopTowerRecord(tower, trustedLocalTowers) || names.has(tower.name)) {
      return { ok: false, reason: "tower" };
    }
    names.add(tower.name);
  }

  const occupiedItemIds = savedItemIds();
  const lootIds = new Set();
  for (const item of payload.loot) {
    if (!validateCoopLootItem(item) || lootIds.has(item.id) || occupiedItemIds.has(item.id)) {
      return { ok: false, reason: "loot" };
    }
    lootIds.add(item.id);
  }
  if (!Number.isSafeInteger(state.shards + payload.shards)) {
    return { ok: false, reason: "shards" };
  }

  const updates = [];
  for (const tower of payload.towers) {
    let rec = state.roster.find((candidate) => candidate.name === tower.name);
    if (!rec) {
      if (!trustedLocalTowers) continue;
      rec = null;
    } else {
      if (trustedLocalTowers && rec.type !== tower.type) {
        return { ok: false, reason: "towerType" };
      }
      // A returned network record may advance career totals, never roll them back.
      if (!trustedLocalTowers &&
          (tower.maxLevel < rec.maxLevel || tower.xp < rec.xp || tower.kills < rec.kills)) {
        return { ok: false, reason: "towerRollback" };
      }
    }
    updates.push({ rec, tower });
  }

  for (const update of updates) {
    let { rec } = update;
    const { tower } = update;
    if (!rec) {
      rec = {
        name: tower.name, type: tower.type, maxLevel: 1, xp: 0, kills: 0,
        gear: structuredClone(tower.gear),
      };
      state.roster.push(rec);
    }
    rec.maxLevel = Math.max(rec.maxLevel, tower.maxLevel);
    rec.xp = tower.xp;
    rec.kills = tower.kills;
  }
  state.shards += payload.shards;
  const lootResult = bankCoopLoot(payload.loot);
  writeSave(state);
  return {
    ok: true,
    lootResult,
    updatedTowers: updates.length,
    droppedTowers: payload.towers.length - updates.length,
  };
}

// Best not-yet-deployed roster unit of a type (veterans first).
export function takeRosterUnit(type, deployedNames, roster = state.roster) {
  const candidates = roster.filter(
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
    // Phase 1's fake second player must never leak its runtime-only roster into
    // the real local save. Phase 4 will return remote progression to its owner.
    if (t.ownerId && t.ownerId !== (game.progressionOwnerId || game.localPlayerId)) continue;
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
  state.store ||= { stock: [], rerolls: 0, skillPointPurchases: 0 };
  state.store.stock ||= [];
  state.store.rerolls ??= 0;
  state.store.skillPointPurchases ??= 0;
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

export function storeSkillPointCost() {
  normalizeStore();
  const purchased = state.store.skillPointPurchases;
  const curve = LOOT.store.skillPointCost;
  if (purchased === 0) return curve.first;
  return Math.min(curve.cap, curve.second + (purchased - 1) * curve.increment);
}

export function buyStoreSkillPoint() {
  const cost = storeSkillPointCost();
  if (state.shards < cost) return { ok: false, reason: "shards", cost };
  state.shards -= cost;
  state.skillPoints += 1;
  state.store.skillPointPurchases += 1;
  writeSave(state);
  return { ok: true, cost, skillPoints: state.skillPoints };
}

export function buyStoreItem(itemId) {
  normalizeStore();
  const item = state.store.stock.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: "missing" };
  if (getStash().length >= getStashCap()) return { ok: false, reason: "stash" };
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

// ---------- Stash capacity (Shard sink, purchasable expansions) ----------
export function getStashCap() {
  const owned = Math.min(state.stashUpgrades || 0, LOOT.stash.upgradeCosts.length);
  return LOOT.stash.baseStashSize + owned * LOOT.stash.upgradeSize;
}

export function nextStashUpgradeCost() {
  const next = state.stashUpgrades || 0;
  return next < LOOT.stash.upgradeCosts.length ? LOOT.stash.upgradeCosts[next] : null;
}

export function buyStashUpgrade() {
  const next = state.stashUpgrades || 0;
  const cost = LOOT.stash.upgradeCosts[next];
  if (cost === undefined) return { ok: false, reason: "max" };
  if (state.shards < cost) return { ok: false, reason: "shards", cost };
  state.shards -= cost;
  state.stashUpgrades = next + 1;
  writeSave(state);
  return { ok: true, cost, cap: getStashCap() };
}

export function stashSlotsFree() {
  return Math.max(0, getStashCap() - getStash().length);
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
  if (getStash().length < getStashCap()) {
    state.stash.push(structuredClone(item));
    return "stash";
  }
  state.pendingLoot.push(structuredClone(item));
  return "pending";
}

export function claimPendingLoot() {
  const moved = [];
  while (state.pendingLoot.length && state.stash.length < getStashCap()) {
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

export function sellAllPendingRarity(rarity) {
  let sold = 0;
  let value = 0;
  state.pendingLoot = getPendingLoot().filter((item) => {
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

// ---------- Auto-junk (Shard sink, purchasable per-rarity thresholds) ----------
// Tiers must be BOUGHT in order (see config.js LOOT.autoJunk) — owning
// Enhanced implies owning Common too. But each owned rarity can be paused
// independently: a player can keep Common auto-selling while pausing
// Enhanced, without losing either purchase. `autoJunkPaused` is the set of
// owned rarities currently switched off.
export function ownedAutoJunkRarities() {
  const idx = state.autoJunkTier ?? -1;
  return idx >= 0 ? LOOT.autoJunk.tiers.slice(0, idx + 1).map((t) => t.rarity) : [];
}

export function isAutoJunkRarityEnabled(rarity) {
  state.autoJunkPaused ||= [];
  return !state.autoJunkPaused.includes(rarity);
}

export function setAutoJunkRarityEnabled(rarity, enabled) {
  state.autoJunkPaused ||= [];
  const has = state.autoJunkPaused.includes(rarity);
  if (enabled && has) state.autoJunkPaused = state.autoJunkPaused.filter((r) => r !== rarity);
  else if (!enabled && !has) state.autoJunkPaused.push(rarity);
  writeSave(state);
  return { ok: true, rarity, enabled };
}

// What bankEarnedItem actually checks: is this specific rarity owned AND
// not paused right now?
function shouldAutoJunk(rarity) {
  return ownedAutoJunkRarities().includes(rarity) && isAutoJunkRarityEnabled(rarity);
}

export function nextAutoJunkTier() {
  return LOOT.autoJunk.tiers[(state.autoJunkTier ?? -1) + 1] || null;
}

export function buyAutoJunkTier() {
  const next = (state.autoJunkTier ?? -1) + 1;
  const tier = LOOT.autoJunk.tiers[next];
  if (!tier) return { ok: false, reason: "max" };
  if (state.shards < tier.cost) return { ok: false, reason: "shards", cost: tier.cost };
  state.shards -= tier.cost;
  state.autoJunkTier = next;
  writeSave(state);
  return { ok: true, cost: tier.cost, rarity: tier.rarity };
}

// Bank one earned item: auto-equip, else auto-junk (if a purchased rarity
// tier covers it), else stash, else pendingLoot triage. Returns a placement
// { item, dest: "equipped"|"junked"|"stash"|"pending", towerName?, value?,
// displaced? } for the end-of-battle summary. Callers writeSave.
function bankEarnedItem(item) {
  backfillItemSaveDefaults(item);
  if (!(LOOT.autoEquip?.enabled ?? false)) {
    state.pendingLoot.push(structuredClone(item));
    return { item, dest: "pending" };
  }
  const rec = autoEquipTarget(item);
  if (rec) {
    rec.gear = normalizeGear(rec.gear);
    const previous = rec.gear[item.slot];
    rec.gear[item.slot] = structuredClone(item);
    gearChangeHandler?.(rec.name);
    const placement = { item, dest: "equipped", towerName: rec.name };
    if (previous) placement.displaced = addToStashOrPending(previous);
    return placement;
  }
  if (shouldAutoJunk(item.rarity)) {
    const value = itemSellValue(item);
    state.shards += value;
    return { item, dest: "junked", value };
  }
  return { item, dest: addToStashOrPending(item) };
}

function bankCoopLoot(drops) {
  state.pendingLoot ||= [];
  const placements = drops.map((item) => bankEarnedItem(item));
  return {
    count: drops.length,
    placements,
    pending: state.pendingLoot.length,
    stashFree: stashSlotsFree(),
  };
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
  backfillItemSaveDefaults(item);
  const rec = state.roster.find((r) => r.name === towerName);
  const check = canEquipItem(rec, item);
  if (!check.ok) return check;
  rec.gear = normalizeGear(rec.gear);
  const previous = rec.gear[item.slot];
  rec.gear[item.slot] = structuredClone(item);
  writeSave(state);
  gearChangeHandler?.(towerName);
  return { ok: true, item: rec.gear[item.slot], previous };
}

export function unequipItem(towerName, slot) {
  const rec = state.roster.find((r) => r.name === towerName);
  if (!rec || !Object.hasOwn(emptyGear(), slot)) return { ok: false, reason: "invalid" };
  rec.gear = normalizeGear(rec.gear);
  const previous = rec.gear[slot];
  rec.gear[slot] = null;
  writeSave(state);
  gearChangeHandler?.(towerName);
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
  gearChangeHandler?.(towerName);
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
  state.store ||= { stock: [], rerolls: 0, skillPointPurchases: 0 };
  state.store.stock ||= [];
  state.store.rerolls ??= 0;
  state.store.skillPointPurchases ??= 0;
  state.endlessRewards ||= {};
  state.seenLoot ||= [];
  backfillGear();
  backfillItemMods();
  migrateRosterNames();
}

// LOCAL TOOLING ONLY (balance sims — never called by the game). After
// resetProgress(), install a synthetic VETERAN roster so takeRosterUnit deploys
// leveled/mastery/geared towers, modelling the career carry-over a player brings
// into L2+. records: [{ type, maxLevel, xp?, gear?, count? }] — `count` clones the
// record so multiple towers of that type can deploy as veterans. maxLevel is the
// career-UNLOCKED level (a veteran re-buys up to it for money, no XP gate); xp is
// banked mastery. This is separate from in-battle levels, which still reset to 1.
export function seedRoster(records) {
  const roster = [];
  let i = 0;
  for (const r of records || []) {
    for (let c = 0; c < (r.count || 1); c++) {
      roster.push({
        name: `${r.type}-vet-${i++}`, type: r.type,
        maxLevel: r.maxLevel || 1, xp: r.xp || 0, kills: r.kills || 0,
        gear: normalizeGear(r.gear),
      });
    }
  }
  state.roster = roster;
  writeSave(state);
}

// LOCAL TOOLING ONLY (balance sims). Install an owned SKILL set so getTowerDamageMult
// / getTowerLevelCap / economy getters reflect a progressed player. ownedIds =
// array of skill node ids (all set to tier 1), e.g. "laser_dmg1", "laser_lvl6",
// "eco_money1". Skills are a SEPARATE ledger from career levels — a real veteran
// has both; seed both for a faithful roster.
export function seedSkills(spec) {
  const sk = {};
  if (Array.isArray(spec)) { for (const id of spec) sk[id] = 1; }        // ids → tier 1
  else if (spec) { for (const id in spec) sk[id] = spec[id]; }           // {id: tier} (multi-tier)
  state.skills = sk;
  writeSave(state);
}
