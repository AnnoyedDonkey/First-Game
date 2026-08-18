// ============================================================
// ARSENAL POWER CALCULATOR (LOCAL TOOLING) — analytic, no engine.
//
// The SUPPLY side of the level-balance model. Its counterpart is the DEMAND
// side in level-difficulty.js; both speak the SAME currency:
//
//   base-laser-equivalents (laser-eq) = applied DPS ÷ one base laser's DPS.
//
// A base laser is 8 dmg / 0.35s = 22.86 raw DPS. level-difficulty.js expresses
// each wave as `reqLasers` (how many base lasers of applied DPS clear it); this
// file expresses an ARSENAL as `supplyLaserEq` (how many base lasers of applied
// DPS it can field). Divide supply ÷ demand for the RPG "recommended power" band
// (goal #3, built on top of this).
//
// Reuses the REAL tower math: careerStatsFor() from towers.js gives each tower's
// damage/fireInterval after level growth, specialty, mastery (banked XP), gear,
// and skill multipliers — no reimplementation of the curve here.
//
// UNIT CONSISTENCY / avoiding double-counting:
//   • Demand's effHP is ALREADY divided by the best available counter
//     (bestCounterMult), i.e. it assumes the player brings the right damage type.
//     So supply is measured as NEUTRAL raw DPS (careerDPS) and does NOT re-apply
//     a resist bonus — the type advantage lives on the demand side only. A
//     coverage/adequacy penalty (arsenal LACKS a needed type) is a goal-#3 hook,
//     stubbed at 1 here (see resistCoverage).
//   • utilization appears on both sides and cancels in the ratio; kept explicit
//     so it stays visibly matched to DIFF_TUNING.utilization.
//   • Splash (pulse/rocket) genuinely adds throughput one single-target DPS
//     figure can't show (one shot, many enemies) → splashWeight > 1.
//   • Slow deals ~no damage but force-multiplies the rest of the arsenal
//     (+30% vulnerability debuff, longer time-in-range) → a capped arsenal-wide
//     controlMult rather than direct laser-eq.
//
// Local-tooling rules: never bump version.js, never auto-commit. careerStatsFor
// reads skill multipliers from the LIVE save (progression.js getters), so run
// this on a page with the intended save loaded — a fresh/empty save = no skills
// = 1x, which is the calibration baseline. Seeding a hypothetical skill loadout
// = snapshot the save, write skills, recompute, restore byte-for-byte.
// ============================================================

import { LEVELS } from "./levels.js";
import { ENEMIES, TOWERS, TOWER_UPGRADES } from "./config.js";
import { careerStatsFor } from "./towers.js";

const LASER_BASE_DPS = TOWERS.laser.baseDamage / TOWERS.laser.baseFireRate; // 22.86

// --- Tunable constants (calibrate against the balance-sim oracle) ---
export const ARSENAL_TUNING = {
  // Must mirror DIFF_TUNING.utilization. Cancels in the supply/demand ratio;
  // kept here so the match is visible and either side can be re-tuned in step.
  utilization: 0.8,

  // Splash towers apply their DPS to SEVERAL enemies per shot on a swarm, so one
  // tower is worth more than its single-target DPS suggests. Single-target
  // towers (laser/railgun) are 1.0.
  //   pulse 1.55 — ORACLE-CALIBRATED (balance-sim.js): on L1 W3 (50-enemy swarm)
  //     6 base lasers vs 5 base pulses clear it → 6/(5×0.785)=1.53; L3 W10 agreed
  //     (≥1.59). Two waves, integer thresholds, so ±0.1.
  //   rocket 1.9 — EXTRAPOLATED from pulse by splash radius (0.9 vs 0.7 ≈ ×1.29),
  //     NOT directly oracle-tested (rocket unlocks L10, in geometry-heavy levels).
  splashWeight: { laser: 1, railgun: 1, pulse: 1.55, rocket: 1.9, slow: 0 },

  // Pierce (railgun): one shot passes through up to `basePierce` enemies in a
  // LINE, so on bunched/lane waves one railgun does the work of several lasers.
  // ORACLE-CALIBRATED (balance-sim): on the dense L3 W10, 4 railguns clear what
  // 10+ lasers cannot → ≈2.5–3.6× a laser per tower; on the scattered fast L1 W3
  // it's ~1.7×. 2.5 is a representative middle. This is DENSITY-DEPENDENT (a flat
  // number can't capture it) and is the single biggest correction to the map —
  // without it railgun read as single-target and looked weaker than it plays.
  pierceWeight: { laser: 1, railgun: 2.5, pulse: 1, rocket: 1, slow: 1 },

  // Slow contributes ~no direct damage; it multiplies the arsenal via its 30%
  // vulnerability debuff and by holding enemies in range longer. Modeled as an
  // arsenal-wide multiplier with diminishing returns (a second slow adds little).
  //   0.20/tower — ORACLE-CALIBRATED: on L1 W3, 6 lasers alone vs 5 lasers + 1
  //     slow clear it → the slow replaced 1 laser out of 6 = +20%. Single-wave,
  //     first-slow only; the cap bounds stacking (slow only helps enemies in its
  //     radius, not the whole field).
  slowSupportPerTower: 0.20,
  slowSupportCap: 1.4,
};

// One tower's firepower, in laser-eq of raw (neutral) applied DPS.
// spec = { type, level (1..10, = careerStatsFor's maxLevel), xp?, gear?, powerMult? }.
//
// powerMult (default 1) models a player's SKILL + GEAR investment as an explicit,
// documented multiplier — because careerStatsFor reads damage-skill bonuses from
// the live save (empty here), and hand-building valid gear objects is out of
// scope. Grounded in the real ceiling: the damage-skill chain is +10%/box × 5
// boxes = ×1.5 max (balance-data.js skills.tower.*.damageStep), on top of which a
// strong gear set adds more. So a maxed player ≈ ×2 (skills ×1.5 · gear ~×1.3), a
// mid-game player ≈ ×1.4. Passing it here (vs seeding the save) keeps the tool
// pure and never touches the player's real progression. Real gear can still be
// passed via spec.gear when a concrete loadout is being modeled.
export function towerFirepower(spec) {
  const def = TOWERS[spec.type];
  if (!def) throw new Error(`arsenal-power: unknown tower type ${spec.type}`);
  // careerStatsFor keys off a roster record's maxLevel / xp / gear.
  const rec = { type: spec.type, maxLevel: spec.level ?? 1, xp: spec.xp ?? 0, gear: spec.gear };
  const stats = careerStatsFor(rec);         // real growth + specialty + mastery + gear + live-save skills
  const rawDPS = stats.dps;                   // damage / fireInterval
  const splash = ARSENAL_TUNING.splashWeight[spec.type] ?? 1;
  const pierce = ARSENAL_TUNING.pierceWeight[spec.type] ?? 1;
  const laserEq = (rawDPS / LASER_BASE_DPS) * splash * pierce * (spec.powerMult ?? 1);
  return {
    type: spec.type,
    damageType: def.damageType,
    cost: def.baseCost,
    rawDPS: +rawDPS.toFixed(1),
    laserEq: +laserEq.toFixed(2),
    isControl: def.damageType === "control",
    splash,
  };
}

// Real in-battle upgrade cost to go from `level` → `level+1` for a tower type
// (TOWER_UPGRADES.upgradeCosts × the type's upgradeCostMult). Mirrors
// towers.js upgradeCostFor exactly. `level` is 1-based (1 = a just-placed tower).
function upgradeStepCost(type, level) {
  const costs = TOWER_UPGRADES.upgradeCosts;
  const base = costs[Math.min(level - 1, costs.length - 1)];
  return Math.round(base * (TOWERS[type].upgradeCostMult || 1));
}

// laser-eq of one tower at each level 1..targetLevel (splash-weighted, same
// career xp/gear at every level so mastery is constant — a re-leveling veteran
// keeps its banked mastery). Used to price each upgrade step's marginal power.
function laserEqLadder(spec) {
  const ladder = [];
  for (let lv = 1; lv <= (spec.level ?? 1); lv++) {
    ladder.push(towerFirepower({ ...spec, level: lv }).laserEq);
  }
  return ladder;
}

// Money a player has to WORK WITH across this level = starting money + every
// bounty the waves pay out. Mirrors level-difficulty.js's bounty accounting
// (raw def.bounty × count; late-world bounty multipliers are ignored on both
// sides for now — a shared limitation, so the ratio stays consistent).
function levelBudget(level) {
  let budget = level.startingMoney;
  for (const w of level.waves) {
    for (const g of w.groups) {
      const def = ENEMIES[g.type];
      if (def) budget += (def.bounty || 0) * g.count;
    }
  }
  return budget;
}

// Resist-coverage adequacy: does the arsenal actually CARRY a damage type the
// level's enemies are weak to / not resistant against? Demand already assumes an
// optimal counter, so this is a goal-#3 penalty hook for arsenals that don't have
// it. Stubbed at 1 (no penalty) for v1 to avoid a half-calibrated adjustment.
function resistCoverage(/* fieldedTowers, level */) {
  return 1;
}

// Total supply for a given level, gated by the in-battle upgrade ECONOMY.
// arsenal = { towers: [spec...], skills? }.  skills is documentation-only for
// now (careerStatsFor reads the live save — see the header).
//
// The player doesn't walk in with the roster fully deployed; they spend the
// level's money over the battle to PLACE towers and UPGRADE them toward their
// career level. We model that as a greedy economy: each tower is a ladder of
// steps (place 0→1 at baseCost, then upgrade L→L+1 at the real upgradeCost), and
// we repeatedly buy the affordable step with the best marginal laser-eq per gold
// until the money runs out. So supply = the power this roster can REACH by
// end-of-level, given that level's economy — directly comparable to peak demand.
//
// Optimism to keep in mind: we hand the whole level budget at once, so supply is
// "end-of-level" power vs the peak demand wave (usually the last/boss wave, so a
// fair match). XP eligibility isn't a separate gate — spec.level is taken as the
// roster's career-unlocked level, which a veteran can re-buy for money alone
// (towers.js isUpgradeEligible veteran clause). opts.budget overrides the money;
// opts.placementOnly:true reverts to the old place-only gate (no upgrades).
export function arsenalPower(arsenal, levelId, opts = {}) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`arsenal-power: unknown level ${levelId}`);
  const budget = opts.budget ?? levelBudget(level);
  const specs = arsenal.towers || [];

  // Per-tower state: laser-eq ladder + the level we've currently bought up to
  // (0 = not yet placed). Full snapshot (top of ladder) is kept for reporting.
  const units = specs.map((spec) => ({
    spec,
    type: spec.type,
    isControl: TOWERS[spec.type].damageType === "control",
    ladder: laserEqLadder(spec),   // ladder[L-1] = laser-eq at level L
    target: spec.level ?? 1,
    level: 0,                      // fielded level so far
  }));

  let spent = 0;
  if (opts.placementOnly) {
    // Legacy gate: place each tower at its full spec level, placement cost only.
    const ranked = [...units].sort(
      (a, b) => b.ladder[b.target - 1] / TOWERS[b.type].baseCost -
                a.ladder[a.target - 1] / TOWERS[a.type].baseCost
    );
    for (const u of ranked) {
      const cost = TOWERS[u.type].baseCost;
      if (spent + cost <= budget) { spent += cost; u.level = u.target; }
    }
  } else {
    // Greedy marginal economy: keep taking the best affordable next step.
    for (;;) {
      let best = null, bestScore = -1;
      for (const u of units) {
        if (u.level >= u.target) continue;
        const cost = u.level === 0
          ? TOWERS[u.type].baseCost                  // place
          : upgradeStepCost(u.type, u.level);        // upgrade L→L+1
        if (spent + cost > budget) continue;
        const gain = u.ladder[u.level] - (u.level === 0 ? 0 : u.ladder[u.level - 1]);
        // Control towers earn ~0 laser-eq directly; give their PLACE step a tiny
        // positive score so the economy still fields a slow when it can afford to
        // (its real value is the controlMult below), but never over the damage.
        const score = gain > 0 ? gain / cost
          : (u.isControl && u.level === 0 ? 1e-6 : -1);
        if (score > bestScore) { bestScore = score; best = { u, cost }; }
      }
      if (!best || bestScore < 0) break;
      best.u.level += 1;
      spent += best.cost;
    }
  }

  const fielded = units.filter((u) => u.level > 0);
  const benched = units.filter((u) => u.level === 0);
  const nSlow = fielded.filter((u) => u.isControl).length;
  const controlMult = Math.min(
    ARSENAL_TUNING.slowSupportCap,
    1 + ARSENAL_TUNING.slowSupportPerTower * nSlow
  );
  const directLaserEq = fielded.reduce((s, u) => s + u.ladder[u.level - 1], 0);
  const coverage = resistCoverage(fielded, level);
  const supplyLaserEq = directLaserEq * controlMult * coverage;

  const shape = (u) => ({
    type: u.type, level: u.level, target: u.target,
    laserEq: +(u.level ? u.ladder[u.level - 1] : 0).toFixed(2),
    isControl: u.isControl,
  });
  return {
    levelId,
    levelNum: LEVELS.indexOf(level) + 1,
    budget,
    spent,
    requested: units.length,
    fieldedCount: fielded.length,
    directLaserEq: +directLaserEq.toFixed(1),
    controlMult: +controlMult.toFixed(2),
    coverage,
    supplyLaserEq: +supplyLaserEq.toFixed(1),
    fielded: fielded.map(shape),
    benched: benched.map(shape),
  };
}
