// ============================================================
// BALANCE LAB — schema: version, migrate, validate.
//
// Pure, dependency-free data-shape module (no DOM, no fetch, no game
// imports). Safe to import from the browser today and from a future Node
// tool unchanged. See BALANCE_LAB_L0.md for the full contract this
// implements (path scheme + validation-rule catalog), BALANCE_LAB_L1_PLAN.md
// for what L1 migrated, and BALANCE_LAB_L2_PLAN.md for the campaign/wave
// migration below.
//
// Scope: this module validates every slice that lives in balance-data.js —
// L1's config-side slices (enemies, towers, towerUpgrades, economy,
// waveDefaults, endless, endlessRewards, levelMilestones, loot, skills) and
// L2's campaign slices (levels: fields/map-structure/waves; worlds:
// level-link coverage). `nodePos` (levels.js presentation) is the one
// L0-listed structural check NOT here — it can't be seen from this module
// (it never migrates), so `nodePos.length === levelIds.length` is asserted
// in the assembly/probe layer instead.
// ============================================================

export const SCHEMA_VERSION = 1;

// The 15 campaign level ids, literal (L1 must not import levels.js — see
// BALANCE_LAB_L1_PLAN.md Step 2). Used only to validate that references
// like `endlessRewards.tracksByLevel` / `levelMilestones` keys point at a
// real level. L2 can swap this for a derived value once levels.js is
// migrated too; keep the literal list in sync with levels.js LEVELS until
// then.
export const KNOWN_LEVEL_IDS = [
  "level_001", "level_002", "level_003", "level_004", "level_005",
  "level_006", "level_007", "level_008", "level_009", "level_010",
  "level_011", "level_012", "level_013", "level_014", "level_015",
];

const DAMAGE_TYPES = new Set(["energy", "pulse", "control", "rail", "blast"]);
const RARITIES = new Set(["common", "enhanced", "rare", "prismatic", "singularity"]);
const REWARD_KINDS = new Set(["shards", "loot"]);
const ENDLESS_REWARD_TYPES = new Set(["wave"]);
const GROWTH_KEYS = new Set([
  "damageGrowth", "rangeGrowth", "fireRateGrowth", "splashGrowth", "slowGrowth",
]);

// ---------------------------------------------------------------
// deepClone — structuredClone-based deep copy. No shared references with
// the source object, so callers can freely mutate a clone (e.g. a Lab
// draft) without touching the live BALANCE data.
// ---------------------------------------------------------------
export function deepClone(data) {
  if (typeof structuredClone === "function") return structuredClone(data);
  // Fallback for environments without structuredClone (older WebViews).
  return JSON.parse(JSON.stringify(data));
}

// ---------------------------------------------------------------
// migrate — version ladder. Returns a NEW object (never mutates the input).
// v1 is the baseline this contract defines: if schemaVersion is missing,
// treat the data as v1; if it already equals SCHEMA_VERSION, return a clone
// unchanged; if it's newer/unknown, throw rather than silently downgrading
// (a newer file loaded by older code is a real hazard, not a no-op).
// ---------------------------------------------------------------
export function migrate(data) {
  const out = deepClone(data);
  const version = out.schemaVersion ?? 1;

  if (version === SCHEMA_VERSION) {
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `[balance-schema] data.schemaVersion (${version}) is newer than this ` +
      `build supports (${SCHEMA_VERSION}). Refusing to downgrade.`
    );
  }

  // Ladder for future migrations, e.g.:
  // if (version < 2) { out = migrateV1toV2(out); }

  throw new Error(`[balance-schema] unknown schemaVersion ${version}`);
}

// =================================================================
// validate — returns { ok: true } or { ok: false, errors: [strings] }.
// Never throws on invalid data; callers (dev console guard, future Lab
// save flow) decide what to do with the error list.
// =================================================================
export function validate(data) {
  const errors = [];
  const err = (msg) => errors.push(msg);

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const isInt = (v) => Number.isInteger(v);
  const isBool = (v) => typeof v === "boolean";
  const isStr = (v) => typeof v === "string" && v.length > 0;
  const isPosNum = (v) => isNum(v) && v > 0;
  const isNonNegNum = (v) => isNum(v) && v >= 0;
  const isPosInt = (v) => isInt(v) && v > 0;
  const isNonNegInt = (v) => isInt(v) && v >= 0;
  const uniqueDupes = (arr) => {
    const seen = new Set(), dup = new Set();
    for (const x of arr) { if (seen.has(x)) dup.add(x); else seen.add(x); }
    return [...dup];
  };

  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["data is not an object"] };
  }

  const enemyIds = new Set(Object.keys(data.enemies || {}));
  const towerIds = new Set(Object.keys(data.towers || {}));

  // ---------------- enemies ----------------
  if (!data.enemies || typeof data.enemies !== "object") {
    err("enemies: missing or not an object");
  } else {
    for (const [id, e] of Object.entries(data.enemies)) {
      const p = `enemies.${id}`;
      if (!e || typeof e !== "object") { err(`${p}: not an object`); continue; }
      if (!isPosNum(e.baseHealth)) err(`${p}.baseHealth: must be a number > 0 (got ${e.baseHealth})`);
      if (!isPosNum(e.speed)) err(`${p}.speed: must be a number > 0 (got ${e.speed})`);
      if (!isNonNegInt(e.coreDamage)) err(`${p}.coreDamage: must be an int >= 0 (got ${e.coreDamage})`);
      if (!isNonNegNum(e.bounty)) err(`${p}.bounty: must be a number >= 0 (got ${e.bounty})`);
      if (!isNonNegNum(e.xp)) err(`${p}.xp: must be a number >= 0 (got ${e.xp})`);
      if (!isPosNum(e.shardTier)) err(`${p}.shardTier: must be a number > 0 (got ${e.shardTier})`);
      if (e.regenRate !== undefined && !isNonNegNum(e.regenRate))
        err(`${p}.regenRate: must be a number >= 0 (got ${e.regenRate})`);
      if (e.damageMult !== undefined) {
        if (typeof e.damageMult !== "object") err(`${p}.damageMult: not an object`);
        else for (const [k, v] of Object.entries(e.damageMult)) {
          if (!DAMAGE_TYPES.has(k)) err(`${p}.damageMult key "${k}" is not a valid DamageType`);
          if (!isPosNum(v)) err(`${p}.damageMult.${k}: must be a number > 0 (got ${v})`);
        }
      }
      if (e.splitInto !== undefined) {
        const s = e.splitInto;
        if (!s || typeof s !== "object") err(`${p}.splitInto: not an object`);
        else {
          if (!enemyIds.has(s.type)) err(`${p}.splitInto.type "${s.type}" is not a known enemy id`);
          if (!isPosInt(s.count)) err(`${p}.splitInto.count: must be an int >= 1 (got ${s.count})`);
        }
      }
    }
    const dup = uniqueDupes(Object.keys(data.enemies));
    if (dup.length) err(`enemies: duplicate ids ${dup.join(", ")}`);
  }

  // ---------------- towers ----------------
  if (!data.towers || typeof data.towers !== "object") {
    err("towers: missing or not an object");
  } else {
    for (const [id, t] of Object.entries(data.towers)) {
      const p = `towers.${id}`;
      if (!t || typeof t !== "object") { err(`${p}: not an object`); continue; }
      if (!isPosInt(t.baseCost)) err(`${p}.baseCost: must be an int > 0 (got ${t.baseCost})`);
      if (!isPosNum(t.baseDamage)) err(`${p}.baseDamage: must be a number > 0 (got ${t.baseDamage})`);
      if (!isPosNum(t.baseRange)) err(`${p}.baseRange: must be a number > 0 (got ${t.baseRange})`);
      if (!isPosNum(t.baseFireRate)) err(`${p}.baseFireRate: must be a number > 0 (got ${t.baseFireRate})`);
      if (t.basePierce !== undefined && !isPosInt(t.basePierce))
        err(`${p}.basePierce: must be an int >= 1 (got ${t.basePierce})`);
      if (t.splashRadius !== undefined && !isPosNum(t.splashRadius))
        err(`${p}.splashRadius: must be a number > 0 (got ${t.splashRadius})`);
      if (t.projectileSpeed !== undefined && !isPosNum(t.projectileSpeed))
        err(`${p}.projectileSpeed: must be a number > 0 (got ${t.projectileSpeed})`);
      if (t.slowPercent !== undefined && !(isNum(t.slowPercent) && t.slowPercent >= 0 && t.slowPercent <= 1))
        err(`${p}.slowPercent: must be a number in [0,1] (got ${t.slowPercent})`);
      if (t.slowDuration !== undefined && !isPosNum(t.slowDuration))
        err(`${p}.slowDuration: must be a number > 0 (got ${t.slowDuration})`);
      if (t.vulnerability !== undefined && !isNonNegNum(t.vulnerability))
        err(`${p}.vulnerability: must be a number >= 0 (got ${t.vulnerability})`);
      if (t.pierceWidth !== undefined && !isPosNum(t.pierceWidth))
        err(`${p}.pierceWidth: must be a number > 0 (got ${t.pierceWidth})`);
      if (t.upgradeCostMult !== undefined && !isPosNum(t.upgradeCostMult))
        err(`${p}.upgradeCostMult: must be a number > 0 (got ${t.upgradeCostMult})`);
      if (!DAMAGE_TYPES.has(t.damageType)) err(`${p}.damageType "${t.damageType}" is not a valid DamageType`);
    }
    const dup = uniqueDupes(Object.keys(data.towers));
    if (dup.length) err(`towers: duplicate ids ${dup.join(", ")}`);
  }

  // ---------------- towerUpgrades ----------------
  if (!data.towerUpgrades || typeof data.towerUpgrades !== "object") {
    err("towerUpgrades: missing or not an object");
  } else {
    const u = data.towerUpgrades;
    if (!isPosInt(u.maxLevel)) err(`towerUpgrades.maxLevel: must be an int >= 1 (got ${u.maxLevel})`);
    for (const k of ["damageGrowth", "rangeGrowth", "fireRateGrowth", "splashGrowth", "slowGrowth"]) {
      if (!isNonNegNum(u[k])) err(`towerUpgrades.${k}: must be a number >= 0 (got ${u[k]})`);
    }
    if (!Array.isArray(u.xpThresholds) || u.xpThresholds.length !== 9) {
      err(`towerUpgrades.xpThresholds: must be an array of length 9 (got length ${u.xpThresholds && u.xpThresholds.length})`);
    } else {
      let prev = -Infinity;
      u.xpThresholds.forEach((v, i) => {
        if (!isPosInt(v)) err(`towerUpgrades.xpThresholds[${i}]: must be an int > 0 (got ${v})`);
        if (isNum(v) && v <= prev) err(`towerUpgrades.xpThresholds[${i}]: not strictly ascending (${v} <= ${prev})`);
        prev = v;
      });
    }
    if (!Array.isArray(u.upgradeCosts) || u.upgradeCosts.length !== 9) {
      err(`towerUpgrades.upgradeCosts: must be an array of length 9 (got length ${u.upgradeCosts && u.upgradeCosts.length})`);
    } else {
      u.upgradeCosts.forEach((v, i) => {
        if (!isPosInt(v)) err(`towerUpgrades.upgradeCosts[${i}]: must be an int > 0 (got ${v})`);
      });
    }
    const m = u.mastery;
    if (!m || typeof m !== "object") err("towerUpgrades.mastery: missing or not an object");
    else {
      if (!isPosNum(m.xpStart)) err(`towerUpgrades.mastery.xpStart: must be a number > 0 (got ${m.xpStart})`);
      if (!isPosNum(m.baseXpPerRank)) err(`towerUpgrades.mastery.baseXpPerRank: must be a number > 0 (got ${m.baseXpPerRank})`);
      if (!isPosNum(m.xpRankIncrement)) err(`towerUpgrades.mastery.xpRankIncrement: must be a number > 0 (got ${m.xpRankIncrement})`);
      if (!isPosNum(m.damagePerRank)) err(`towerUpgrades.mastery.damagePerRank: must be a number > 0 (got ${m.damagePerRank})`);
      if (!isPosInt(m.maxRanks)) err(`towerUpgrades.mastery.maxRanks: must be an int > 0 (got ${m.maxRanks})`);
    }
    if (!u.specialties || typeof u.specialties !== "object") {
      err("towerUpgrades.specialties: missing or not an object");
    } else {
      for (const [tid, spec] of Object.entries(u.specialties)) {
        const p = `towerUpgrades.specialties.${tid}`;
        if (!towerIds.has(tid)) err(`${p}: "${tid}" is not a known tower id`);
        if (!spec || typeof spec !== "object") { err(`${p}: not an object`); continue; }
        const growthKeys = Object.keys(spec).filter((k) => k !== "label");
        if (growthKeys.length === 0) err(`${p}: no growth key present`);
        for (const gk of growthKeys) {
          if (!GROWTH_KEYS.has(gk)) err(`${p}.${gk}: not a recognized *Growth stat key`);
          else if (!isNonNegNum(spec[gk])) err(`${p}.${gk}: must be a number >= 0 (got ${spec[gk]})`);
        }
      }
    }
  }

  // ---------------- economy ----------------
  if (!data.economy || typeof data.economy !== "object") {
    err("economy: missing or not an object");
  } else {
    const e = data.economy;
    if (!isPosNum(e.moneyPerKillMultiplier)) err(`economy.moneyPerKillMultiplier: must be a number > 0 (got ${e.moneyPerKillMultiplier})`);
    if (!isPosNum(e.xpPerKillMultiplier)) err(`economy.xpPerKillMultiplier: must be a number > 0 (got ${e.xpPerKillMultiplier})`);
    if (!e.interest || typeof e.interest !== "object" || !isBool(e.interest.enabled))
      err(`economy.interest.enabled: must be a boolean`);
    else if (!isNonNegNum(e.interest.baseCap))
      err(`economy.interest.baseCap: must be a number >= 0 (got ${e.interest.baseCap})`);
  }

  // ---------------- waveDefaults ----------------
  if (!data.waveDefaults || typeof data.waveDefaults !== "object") {
    err("waveDefaults: missing or not an object");
  } else {
    const w = data.waveDefaults;
    if (!isNonNegNum(w.timeBetweenWaves)) err(`waveDefaults.timeBetweenWaves: must be a number >= 0 (got ${w.timeBetweenWaves})`);
    if (!isBool(w.autoStartNextWave)) err(`waveDefaults.autoStartNextWave: must be a boolean`);
    if (!isBool(w.allowEarlyStart)) err(`waveDefaults.allowEarlyStart: must be a boolean`);
    if (!isPosNum(w.spawnInterval)) err(`waveDefaults.spawnInterval: must be a number > 0 (got ${w.spawnInterval})`);
  }

  // ---------------- endless ----------------
  if (!data.endless || typeof data.endless !== "object") {
    err("endless: missing or not an object");
  } else {
    const en = data.endless;
    if (!isPosNum(en.healthGrowthPerWave)) err(`endless.healthGrowthPerWave: must be a number > 0 (got ${en.healthGrowthPerWave})`);
    if (!isPosNum(en.countGrowthPerWave)) err(`endless.countGrowthPerWave: must be a number > 0 (got ${en.countGrowthPerWave})`);
    if (!(isNum(en.maxCountMult) && en.maxCountMult >= 1)) err(`endless.maxCountMult: must be a number >= 1 (got ${en.maxCountMult})`);
    if (!isPosNum(en.speedGrowthPerWave)) err(`endless.speedGrowthPerWave: must be a number > 0 (got ${en.speedGrowthPerWave})`);
    if (!(isNum(en.maxSpeedMult) && en.maxSpeedMult >= 1)) err(`endless.maxSpeedMult: must be a number >= 1 (got ${en.maxSpeedMult})`);
    if (!(isNum(en.intervalShrinkPerWave) && en.intervalShrinkPerWave > 0 && en.intervalShrinkPerWave <= 1))
      err(`endless.intervalShrinkPerWave: must be a number in (0,1] (got ${en.intervalShrinkPerWave})`);
    if (!(isNum(en.minSpawnIntervalMult) && en.minSpawnIntervalMult > 0 && en.minSpawnIntervalMult <= 1))
      err(`endless.minSpawnIntervalMult: must be a number in (0,1] (got ${en.minSpawnIntervalMult})`);
    if (!isPosInt(en.bossEvery)) err(`endless.bossEvery: must be an int >= 1 (got ${en.bossEvery})`);
    if (!isPosNum(en.bossHealthGrowthPerWave)) err(`endless.bossHealthGrowthPerWave: must be a number > 0 (got ${en.bossHealthGrowthPerWave})`);
  }

  // ---------------- endlessRewards ----------------
  if (!data.endlessRewards || typeof data.endlessRewards !== "object") {
    err("endlessRewards: missing or not an object");
  } else {
    const er = data.endlessRewards;
    const validateTrack = (track, label) => {
      if (!Array.isArray(track)) { err(`${label}: not an array`); return; }
      let prev = -Infinity;
      const ids = [];
      track.forEach((m, i) => {
        const p = `${label}[${i}]`;
        if (!m || typeof m !== "object") { err(`${p}: not an object`); return; }
        if (!isStr(m.id)) err(`${p}.id: must be a non-empty string`);
        else ids.push(m.id);
        if (!ENDLESS_REWARD_TYPES.has(m.type)) err(`${p}.type "${m.type}" is not a valid endless-reward type`);
        if (!isPosInt(m.threshold)) err(`${p}.threshold: must be an int >= 1 (got ${m.threshold})`);
        else {
          if (m.threshold <= prev) err(`${p}.threshold: not strictly ascending (${m.threshold} <= ${prev})`);
          prev = m.threshold;
        }
        if (!m.reward || typeof m.reward !== "object") { err(`${p}.reward: not an object`); return; }
        if (!REWARD_KINDS.has(m.reward.kind)) { err(`${p}.reward.kind "${m.reward.kind}" not in {shards,loot}`); return; }
        if (m.reward.kind === "shards") {
          if (!isPosInt(m.reward.amount)) err(`${p}.reward.amount: must be an int > 0 (got ${m.reward.amount})`);
        } else if (m.reward.kind === "loot") {
          if (!RARITIES.has(m.reward.rarity)) err(`${p}.reward.rarity "${m.reward.rarity}" is not a valid rarity`);
        }
      });
      const dup = uniqueDupes(ids);
      if (dup.length) err(`${label}: duplicate milestone ids ${dup.join(", ")}`);
    };
    validateTrack(er.defaultTrack, "endlessRewards.defaultTrack");
    if (!er.tracksByLevel || typeof er.tracksByLevel !== "object") {
      err("endlessRewards.tracksByLevel: missing or not an object");
    } else {
      for (const [lid, track] of Object.entries(er.tracksByLevel)) {
        if (!KNOWN_LEVEL_IDS.includes(lid)) err(`endlessRewards.tracksByLevel key "${lid}" is not a known level id`);
        validateTrack(track, `endlessRewards.tracksByLevel.${lid}`);
      }
    }
  }

  // ---------------- levelMilestones ----------------
  if (!data.levelMilestones || typeof data.levelMilestones !== "object") {
    err("levelMilestones: missing or not an object");
  } else {
    const allIds = [];
    for (const [lid, arr] of Object.entries(data.levelMilestones)) {
      if (!KNOWN_LEVEL_IDS.includes(lid)) err(`levelMilestones key "${lid}" is not a known level id`);
      if (!Array.isArray(arr)) { err(`levelMilestones.${lid}: not an array`); continue; }
      arr.forEach((m, i) => {
        const p = `levelMilestones.${lid}[${i}]`;
        if (!m || typeof m !== "object") { err(`${p}: not an object`); return; }
        if (!isStr(m.id)) err(`${p}.id: must be a non-empty string`);
        else allIds.push(m.id);
        if (!isStr(m.label)) err(`${p}.label: must be a non-empty string`);
        if (!m.check || typeof m.check !== "object") err(`${p}.check: not an object`);
        else for (const key of ["onlyTowers", "withoutTowers"]) {
          if (m.check[key] !== undefined) {
            if (!Array.isArray(m.check[key])) err(`${p}.check.${key}: not an array`);
            else for (const t of m.check[key]) if (!towerIds.has(t)) err(`${p}.check.${key} references unknown tower "${t}"`);
          }
        }
        const r = m.reward || {};
        const hasSkillPoints = r.skillPoints !== undefined;
        const hasShards = r.shards !== undefined;
        if (!hasSkillPoints && !hasShards) err(`${p}.reward: must set skillPoints and/or shards`);
        if (hasSkillPoints && !isNonNegInt(r.skillPoints)) err(`${p}.reward.skillPoints: must be an int >= 0 (got ${r.skillPoints})`);
        if (hasShards && !isNonNegInt(r.shards)) err(`${p}.reward.shards: must be an int >= 0 (got ${r.shards})`);
      });
    }
    const dup = uniqueDupes(allIds);
    if (dup.length) err(`levelMilestones: duplicate milestone ids ${dup.join(", ")}`);
  }

  // ---------------- loot (migrated subset only: xp, shards) ----------------
  if (!data.loot || typeof data.loot !== "object") {
    err("loot: missing or not an object");
  } else {
    const l = data.loot;
    if (!l.xp || !isPosNum(l.xp.slowWeightPerSec))
      err(`loot.xp.slowWeightPerSec: must be a number > 0 (got ${l.xp && l.xp.slowWeightPerSec})`);
    if (!l.shards || !isPosNum(l.shards.perKillBase))
      err(`loot.shards.perKillBase: must be a number > 0 (got ${l.shards && l.shards.perKillBase})`);
    if (!l.shards || !isNonNegNum(l.shards.perLevelMult))
      err(`loot.shards.perLevelMult: must be a number >= 0 (got ${l.shards && l.shards.perLevelMult})`);
  }

  // ---------------- skills ----------------
  if (!data.skills || typeof data.skills !== "object") {
    err("skills: missing or not an object");
  } else {
    const s = data.skills;
    if (!s.tiers || !isPosInt(s.tiers.maxTier)) {
      err(`skills.tiers.maxTier: must be an int >= 1 (got ${s.tiers && s.tiers.maxTier})`);
    } else {
      if (!Array.isArray(s.tiers.costs) || s.tiers.costs.length !== s.tiers.maxTier) {
        err(`skills.tiers.costs: length must equal maxTier (${s.tiers.maxTier}), got ${s.tiers.costs && s.tiers.costs.length}`);
      } else {
        s.tiers.costs.forEach((v, i) => { if (!isPosInt(v)) err(`skills.tiers.costs[${i}]: must be an int > 0 (got ${v})`); });
      }
    }
    if (!s.tower || typeof s.tower !== "object") {
      err("skills.tower: missing or not an object");
    } else {
      for (const [tid, spec] of Object.entries(s.tower)) {
        if (!towerIds.has(tid)) err(`skills.tower.${tid}: "${tid}" is not a known tower id`);
        if (!spec || !isPosNum(spec.damageStep)) err(`skills.tower.${tid}.damageStep: must be a number > 0 (got ${spec && spec.damageStep})`);
      }
    }
    const tl = s.towerLayout;
    if (!tl || typeof tl !== "object") {
      err("skills.towerLayout: missing or not an object");
    } else {
      if (!isNonNegInt(tl.damageSteps)) err(`skills.towerLayout.damageSteps: must be an int >= 0 (got ${tl.damageSteps})`);
      if (!isNonNegInt(tl.levelSteps)) err(`skills.towerLayout.levelSteps: must be an int >= 0 (got ${tl.levelSteps})`);
      if (!Array.isArray(tl.levelCosts)) err("skills.towerLayout.levelCosts: not an array");
      else tl.levelCosts.forEach((v, i) => { if (!isPosInt(v)) err(`skills.towerLayout.levelCosts[${i}]: must be an int > 0 (got ${v})`); });
      if (!isPosInt(tl.damageCost)) err(`skills.towerLayout.damageCost: must be an int > 0 (got ${tl.damageCost})`);
      if (!isPosInt(tl.rootCost)) err(`skills.towerLayout.rootCost: must be an int > 0 (got ${tl.rootCost})`);
    }
    if (!s.economy || typeof s.economy !== "object") {
      err("skills.economy: missing or not an object");
    } else {
      for (const [eid, spec] of Object.entries(s.economy)) {
        if (!spec || !isPosNum(spec.step)) err(`skills.economy.${eid}.step: must be a number > 0 (got ${spec && spec.step})`);
      }
    }
    const el = s.economyLayout;
    if (!el || typeof el !== "object") {
      err("skills.economyLayout: missing or not an object");
    } else {
      if (!isNonNegInt(el.steps)) err(`skills.economyLayout.steps: must be an int >= 0 (got ${el.steps})`);
      if (!isPosInt(el.boxCost)) err(`skills.economyLayout.boxCost: must be an int > 0 (got ${el.boxCost})`);
      if (!isPosInt(el.rootCost)) err(`skills.economyLayout.rootCost: must be an int > 0 (got ${el.rootCost})`);
    }
    if (!s.values || typeof s.values !== "object") {
      err("skills.values: missing or not an object");
    } else {
      if (!isNonNegNum(s.values.coreHealth)) err(`skills.values.coreHealth: must be a number >= 0 (got ${s.values.coreHealth})`);
      if (!isNonNegNum(s.values.railPen)) err(`skills.values.railPen: must be a number >= 0 (got ${s.values.railPen})`);
      if (!isNonNegNum(s.values.slowPot)) err(`skills.values.slowPot: must be a number >= 0 (got ${s.values.slowPot})`);
    }
  }

  // ---------------- levels (L2) ----------------
  // Replicates balance-lab-l0-probe.html's pathTiles()/inBounds() fill logic
  // so blocked-tile/on-path checks match the live game contract exactly.
  const inBounds = (t, lvl) =>
    isInt(t.x) && isInt(t.y) && t.x >= 0 && t.x < lvl.gridWidth && t.y >= 0 && t.y < lvl.gridHeight;

  function pathTiles(lvl, p, errFn) {
    const set = new Set();
    const c = lvl.pathCorners;
    for (let i = 0; i < c.length - 1; i++) {
      const a = c[i], b = c[i + 1];
      if (!a || !b || typeof a.x !== "number" || typeof a.y !== "number" || typeof b.x !== "number" || typeof b.y !== "number") {
        errFn(`${p}.pathCorners[${i}]: not a valid {x,y} point`);
        continue;
      }
      if (a.x !== b.x && a.y !== b.y) {
        errFn(`${p}.pathCorners segment ${i}: diagonal (${a.x},${a.y}) -> (${b.x},${b.y})`);
        continue;
      }
      if (a.x === b.x && a.y === b.y) {
        errFn(`${p}.pathCorners segment ${i}: zero-length (${a.x},${a.y})`);
        continue;
      }
      if (a.x === b.x) {
        const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
        for (let y = lo; y <= hi; y++) set.add(`${a.x},${y}`);
      } else {
        const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
        for (let x = lo; x <= hi; x++) set.add(`${x},${a.y}`);
      }
    }
    return set;
  }

  const enemyIdsForLevels = enemyIds; // alias for clarity in this section
  const knownLevelIdsInData = new Set(Object.keys(data.levels || {}));

  if (!data.levels || typeof data.levels !== "object") {
    err("levels: missing or not an object");
  } else {
    for (const [lid, lvl] of Object.entries(data.levels)) {
      const p = `levels.${lid}`;
      if (!lvl || typeof lvl !== "object") { err(`${p}: not an object`); continue; }

      // ---- level fields ----
      if (!isPosInt(lvl.gridWidth)) err(`${p}.gridWidth: must be an int > 0 (got ${lvl.gridWidth})`);
      if (!isPosInt(lvl.gridHeight)) err(`${p}.gridHeight: must be an int > 0 (got ${lvl.gridHeight})`);
      if (!isPosInt(lvl.startingMoney)) err(`${p}.startingMoney: must be an int > 0 (got ${lvl.startingMoney})`);
      if (!isPosInt(lvl.coreHealth)) err(`${p}.coreHealth: must be an int > 0 (got ${lvl.coreHealth})`);
      if (lvl.bountyMult !== undefined && !isPosNum(lvl.bountyMult))
        err(`${p}.bountyMult: must be a number > 0 (got ${lvl.bountyMult})`);
      if (lvl.timeBetweenWaves !== undefined && !isNonNegNum(lvl.timeBetweenWaves))
        err(`${p}.timeBetweenWaves: must be a number >= 0 (got ${lvl.timeBetweenWaves})`);
      if (lvl.autoStartNextWave !== undefined && !isBool(lvl.autoStartNextWave))
        err(`${p}.autoStartNextWave: must be a boolean (got ${lvl.autoStartNextWave})`);

      // ---- map structure ----
      let path = null;
      if (!Array.isArray(lvl.pathCorners) || lvl.pathCorners.length < 2) {
        err(`${p}.pathCorners: must be an array with >= 2 corners (got ${lvl.pathCorners && lvl.pathCorners.length})`);
      } else {
        for (const c of lvl.pathCorners) {
          if (!inBounds(c, lvl)) err(`${p}.pathCorners: corner out of bounds (${c && c.x},${c && c.y})`);
        }
        path = pathTiles(lvl, p, err);
      }
      if (!Array.isArray(lvl.blockedTiles)) {
        err(`${p}.blockedTiles: must be an array`);
      } else {
        const seen = new Set();
        for (const b of lvl.blockedTiles) {
          if (!inBounds(b, lvl)) { err(`${p}.blockedTiles: tile out of bounds (${b && b.x},${b && b.y})`); continue; }
          const k = `${b.x},${b.y}`;
          if (path && path.has(k)) err(`${p}.blockedTiles: tile (${k}) sits on the path`);
          if (seen.has(k)) err(`${p}.blockedTiles: duplicate tile (${k})`);
          seen.add(k);
        }
      }

      // ---- waves / groups ----
      if (!Array.isArray(lvl.waves) || lvl.waves.length === 0) {
        err(`${p}.waves: must be a non-empty array`);
      } else {
        lvl.waves.forEach((w, wi) => {
          const wp = `${p}.waves[${wi}]`;
          if (!w || typeof w !== "object") { err(`${wp}: not an object`); return; }
          if (w.healthMult !== undefined && !isPosNum(w.healthMult)) err(`${wp}.healthMult: must be a number > 0 (got ${w.healthMult})`);
          if (w.speedMult !== undefined && !isPosNum(w.speedMult)) err(`${wp}.speedMult: must be a number > 0 (got ${w.speedMult})`);
          if (!Array.isArray(w.groups) || w.groups.length === 0) {
            err(`${wp}.groups: must be a non-empty array`);
            return;
          }
          w.groups.forEach((g, gi) => {
            const gp = `${wp}.groups[${gi}]`;
            if (!g || typeof g !== "object") { err(`${gp}: not an object`); return; }
            if (!enemyIdsForLevels.has(g.type)) err(`${gp}.type "${g.type}" is not a known enemy id`);
            if (!isPosInt(g.count)) err(`${gp}.count: must be an int >= 1 (got ${g.count})`);
            for (const m of ["healthMult", "speedMult", "spawnInterval", "bountyMult", "xpMult"])
              if (g[m] !== undefined && !isPosNum(g[m])) err(`${gp}.${m}: must be a number > 0 (got ${g[m]})`);
            if (g.startDelay !== undefined && !isNonNegNum(g.startDelay))
              err(`${gp}.startDelay: must be a number >= 0 (got ${g.startDelay})`);
          });
        });
      }
    }
  }

  // ---------------- worlds (L2) ----------------
  // Note: nodePos (presentation, stays in levels.js) is NOT validated here —
  // `nodePos.length === levelIds.length` per world is checked in the
  // assembly/probe layer, which is the only place that can see both.
  if (!data.worlds || typeof data.worlds !== "object") {
    err("worlds: missing or not an object");
  } else {
    const flat = [];
    for (const [wid, w] of Object.entries(data.worlds)) {
      const p = `worlds.${wid}`;
      if (!w || typeof w !== "object") { err(`${p}: not an object`); continue; }
      if (!Array.isArray(w.levelIds) || w.levelIds.length === 0) {
        err(`${p}.levelIds: must be a non-empty array`);
        continue;
      }
      for (const lid of w.levelIds) {
        if (!knownLevelIdsInData.has(lid)) err(`${p}.levelIds references unknown level id "${lid}"`);
        flat.push(lid);
      }
    }
    const levelKeyOrder = Object.keys(data.levels || {});
    const dup = uniqueDupes(flat);
    if (dup.length) err(`worlds: level(s) linked from more than one world: ${dup.join(", ")}`);
    if (flat.length !== levelKeyOrder.length) {
      err(`worlds: levelIds cover ${flat.length} levels, expected ${levelKeyOrder.length} (every level exactly once)`);
    } else if (flat.join(",") !== levelKeyOrder.join(",")) {
      err(`worlds: levelIds order (${flat.join(",")}) does not match levels order (${levelKeyOrder.join(",")})`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
