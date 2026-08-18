// ============================================================
// LEVEL DIFFICULTY CALCULATOR (LOCAL TOOLING) — analytic, no engine.
//
// Reduces every level to comparable NUMBERS for balancing, in a shared currency:
// "effective firepower on the path" (DPS actually applied to enemies).
//
//   A level DEMANDS firepower to clear each wave with 0 leaks.
//   An arsenal SUPPLIES firepower (gated by what the economy lets you field).
//   difficulty = demand ÷ supply  →  the RPG "recommended power" band.
//
// This file is the DEMAND side + a base-laser reference for supply. It is pure
// formula over levels.js + config.js — fast, tunable, no simulation. The headless
// engine (balance-sim.js) is the CALIBRATION oracle for the constants below, not
// a runtime dependency here.
//
// A wave's demand is the MAX of two regimes:
//   • swarm (throughput-bound): Σ effHP  ÷  killWindow             — sustained DPS
//        killWindow = spawnSpan + timeInRange; enemies LINGER in range, so the
//        transit time is buffer on top of the spawn span (using spawn rate alone
//        badly overcounts — it ignores that buffer).
//   • boss  (burst-bound):      effHP_perEnemy × speed / coverage  — DPS to kill
//                                                                     one in transit
// Both come out in DPS, the same unit as arsenal supply.
// ============================================================

import { LEVELS } from "./levels.js";
import { ENEMIES, TOWERS, WAVE_DEFAULTS } from "./config.js";
import { createGridModel } from "./grid.js";

const TILE = 64;

// --- Tunable constants (calibrate against the balance-sim oracle) ---
export const DIFF_TUNING = {
  // Calibrated against the balance-sim oracle on L1 (2 lasers clear W1, 4 clear
  // W2): utilization 0.8 fits both (clustered lasers apply ~80% of raw DPS —
  // matches the "≥83% efficient when clustered" finding).
  utilization: 0.8,        // fraction of raw DPS actually applied (targeting/coverage)
  coverageTopK: 8,         // "a good player's" placement = avg of the top-K coverage tiles
  spawnIntervalDefault: WAVE_DEFAULTS?.spawnInterval ?? 0.5,
  // Mid-wave income: a player buys towers as bounty flows in DURING the wave, not
  // only from money banked before it. Since demand is an average over the wave's
  // kill-window, the fair yardstick is the AVERAGE money in hand across that
  // window ≈ budgetBefore + 0.5·thisWaveBounty (mean of a linear income ramp).
  // Without this, early waves read as false "crunches" (e.g. L1 W2 showed
  // afford 3.4 vs a 4th laser you can clearly place in time). 0.5 = steady
  // buying; raise toward 1 for front-loaded bounty, lower toward 0 for a burst
  // that's over before its bounty lands. Used as the FALLBACK only (a wave with
  // no bounty) and when opts.midWaveCapture forces a flat value; otherwise each
  // wave gets its OWN captureFrac from bounty timing (see analyzeWave).
  midWaveCapture: 0.5,
  // Auto per-wave capture tuning. transit = the delay from a group spawning to its
  // bounty landing, as a fraction of timeInRange (enemies must travel to the kill
  // zone AND be killed before their bounty lands, so it's most of the window).
  // ORACLE-CALIBRATED: drove the real engine (a clearing roster, no mid-wave buys)
  // on L1-L3 and measured the actual bounty-arrival integral ∫B(t)/B(1)dt per wave.
  // Early swarm waves came out ~0.30-0.42 (not the naive 0.5 — bounty lands late);
  // a sweep fit transitFrac 0.8 best (RMSE 0.062 on L1, confirmed on L2/L3). Boss
  // waves measure a touch higher (~0.5-0.62); the model under-reads them slightly
  // but those are late/rich waves that never drive an economy-crunch flag.
  captureTransitFrac: 0.8,
  captureClamp: [0.1, 0.9],
};

// Damage types a competent player can bring BY a given level (1-based).
// laser=energy & pulse=pulse are always available; railgun(rail) unlocks at L5,
// rocket(blast) at L10 (progression.js). Slow's "control" is not a damage type.
function availableDamageTypes(levelNum) {
  const t = ["energy", "pulse"];
  if (levelNum >= 5) t.push("rail");
  if (levelNum >= 10) t.push("blast");
  return t;
}

// Best damage multiplier a competent roster gets vs this enemy, among the damage
// types actually AVAILABLE by this level. An unlisted type is neutral (1×). Do
// NOT floor at 1: if EVERY available type is resisted (<1), the player is stuck
// dealing reduced damage and the enemy's effective HP is genuinely higher. (The
// old `best = 1` start hid that — it assumed a neutral option always exists.)
function bestCounterMult(enemyDef, levelNum) {
  const dm = enemyDef.damageMult || {};
  let best = 0;
  for (const ty of availableDamageTypes(levelNum)) best = Math.max(best, dm[ty] ?? 1);
  return best || 1; // guard: no available types (shouldn't happen)
}

// Effective HP = raw HP you must chew through with your best available counter.
function effHP(enemyDef, healthMult, levelNum) {
  return (enemyDef.baseHealth * healthMult) / bestCounterMult(enemyDef, levelNum);
}

// Nominal on-path coverage (tiles) of a well-placed laser — avg of the top-K
// buildable tiles by path-arc inside range. Captures the level's geometry
// (corner pockets ≈ 1.6× a straight; a turny track is easier than a straight one).
function nominalCoverageTiles(level) {
  const grid = createGridModel(level, TILE);
  const range = TOWERS.laser.baseRange * TILE;
  const pts = grid.pathPoints;
  const covers = [];
  for (let y = 0; y < level.gridHeight; y++)
    for (let x = 0; x < level.gridWidth; x++) {
      if (!grid.isBuildable(x, y)) continue;
      const c = grid.tileCenter(x, y);
      let covered = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.round(segLen / 3)), piece = segLen / n;
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const dx = a.x + (b.x - a.x) * t - c.x, dy = a.y + (b.y - a.y) * t - c.y;
          if (dx * dx + dy * dy <= range * range) covered += piece;
        }
      }
      covers.push(covered);
    }
  covers.sort((p, q) => q - p);
  const k = Math.min(DIFF_TUNING.coverageTopK, covers.length) || 1;
  const avgPx = covers.slice(0, k).reduce((s, v) => s + v, 0) / k;
  return avgPx / TILE; // tiles
}

// Analyze one wave. `coverageTiles` = the level's nominal coverage.
function analyzeWave(level, wave, levelNum, coverageTiles, opts = {}) {
  const transitFrac = opts.captureTransitFrac ?? DIFF_TUNING.captureTransitFrac;
  const waveHM = wave.healthMult ?? 1;
  const waveSM = wave.speedMult ?? 1;
  let burst = 0;           // max DPS to kill one enemy in its transit (boss demand)
  let burstGroupEffHP = 0; // total effHP of the group that drives `burst`
  let effHPtotal = 0, bounty = 0, xp = 0, count = 0, coreDmg = 0;
  let spawnSpan = 0;       // seconds from first to last spawn (respects startDelay)
  let speedWeighted = 0;   // Σ effHP·speed, for an effHP-weighted mean speed
  let regimeType = "";
  const groupTiming = [];  // {bounty, spawnMid} per group — for mid-wave capture

  for (const g of wave.groups) {
    const def = ENEMIES[g.type];
    if (!def) continue;
    const hm = (g.healthMult ?? 1) * waveHM;
    const sm = (g.speedMult ?? 1) * waveSM;
    const ehp = effHP(def, hm, levelNum);
    const speed = def.speed * sm; // tiles/sec
    const si = g.spawnInterval ?? DIFF_TUNING.spawnIntervalDefault;
    const gEffHP = ehp * g.count;
    const gBounty = (def.bounty || 0) * g.count;

    effHPtotal += gEffHP;
    speedWeighted += gEffHP * speed;
    bounty += gBounty;
    xp += (def.xp || 0) * g.count;
    coreDmg += (def.coreDamage || 0) * g.count;
    count += g.count;
    const gStart = g.startDelay ?? 0;
    const gSpan = Math.max(0, g.count - 1) * si;
    spawnSpan = Math.max(spawnSpan, gStart + gSpan);
    // When this group's bounty lands ≈ its spawn midpoint (+ transit, added below).
    groupTiming.push({ bounty: gBounty, spawnMid: gStart + gSpan / 2 });

    // Burst term: DPS to destroy ONE enemy while it crosses a tower's coverage.
    const b = (ehp * speed) / coverageTiles;
    if (b > burst) { burst = b; regimeType = g.type; burstGroupEffHP = gEffHP; }
  }

  // Swarm term: total effHP over the whole kill window (spawn span + the transit
  // time enemies linger in range = coverage ÷ mean speed).
  const meanSpeed = effHPtotal > 0 ? speedWeighted / effHPtotal : 1;
  const timeInRange = coverageTiles / Math.max(0.1, meanSpeed);
  const killWindow = spawnSpan + timeInRange;
  const swarm = killWindow > 0 ? effHPtotal / killWindow : effHPtotal;

  // Mid-wave capture: the bounty-weighted share of THIS wave's own bounty that
  // arrives early enough to redeploy within the wave. A group's bounty lands at
  // fraction f = (spawnMidpoint + transit) / killWindow of the window, and money
  // arriving at f can fund towers for the remaining (1-f). So capture =
  // Σ (bᵢ/B)·(1-fᵢ). A uniform single-group swarm → 0.5 (the flat baseline); a
  // late-spawning boss → low (its bounty lands too late to spend). transit =
  // captureTransitFrac·timeInRange (time from spawn to the kill zone).
  const transit = transitFrac * timeInRange;
  const totalB = groupTiming.reduce((s, g) => s + g.bounty, 0);
  let captureFrac = DIFF_TUNING.midWaveCapture; // fallback when a wave pays nothing
  if (totalB > 0 && killWindow > 0) {
    let acc = 0;
    for (const g of groupTiming) {
      const f = Math.min(1, Math.max(0, (g.spawnMid + transit) / killWindow));
      acc += (g.bounty / totalB) * (1 - f);
    }
    const [lo, hi] = DIFF_TUNING.captureClamp;
    captureFrac = Math.min(hi, Math.max(lo, acc));
  }

  // Concurrency: a tanky outlier (boss) needs FOCUSED burst DPS while the rest of
  // the wave needs THROUGHPUT — and on a mixed wave both happen at once, so they
  // ADD. Plain max(swarm, burst) under-rated boss+swarm finales: it gave L1 W10
  // only 17 (the boss's burst alone, ignoring the 22 trailing trash). combined =
  // burst(tankiest) + throughput of everything else = 23. VALIDATED against the
  // engine with an EFFICIENT roster: L1 W10 clears with exactly 4 level-5 lasers
  // (≈24 in these reqL units), and 3 do not — so the true min sits right at 23-24.
  // (30 BASE level-1 lasers also clear it, but that's an inefficient deployment
  // inflated by coverage degradation — laser-eq measures well-placed firepower,
  // not a pile of weak towers, so the efficient 24 is the right reference.) For a
  // pure swarm the burst group is tiny, so swarm wins unchanged (anchors L1 W1/W2
  // untouched); for a lone boss swarmRest is 0, reducing to burst. Note: the model
  // still progressively under-reads HARDER finales (L4/L7 by ~30-50% vs the L5
  // oracle) — the next calibration target, though partly confounded by pure-laser
  // resist/targeting inefficiency in that measurement.
  const swarmRest = killWindow > 0 ? (effHPtotal - burstGroupEffHP) / killWindow : 0;
  const combined = burst + swarmRest;
  const demand = Math.max(swarm, combined);
  let regime;
  if (combined >= swarm) {
    regime = swarmRest > 0.15 * burst ? `mixed (${regimeType}+swarm)` : `burst (${regimeType})`;
  } else {
    regime = "swarm";
  }
  return {
    demand, swarm, burst, combined,
    regime,
    effHPtotal, bounty, xp, count, coreDmg, captureFrac,
  };
}

// Full analysis of one level → per-wave demand + peak + economy + recommended power.
export function analyzeLevel(levelId, opts = {}) {
  const util = opts.utilization ?? DIFF_TUNING.utilization;
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`level-difficulty: unknown level ${levelId}`);
  const levelNum = LEVELS.indexOf(level) + 1;
  const coverageTiles = nominalCoverageTiles(level);
  const laserEffDPS = (TOWERS.laser.baseDamage / TOWERS.laser.baseFireRate) * util;

  let cumBounty = level.startingMoney;
  let cumXP = 0;
  const waves = level.waves.map((w, i) => {
    const a = analyzeWave(level, w, levelNum, coverageTiles, opts);
    // Budget available BEFORE this wave (economy earned from prior waves).
    const budgetBefore = cumBounty;
    // Effective spend for THIS wave = banked money + the share of the wave's OWN
    // bounty that arrives early enough to redeploy within the same wave. That
    // share (a.captureFrac) is computed per-wave from bounty timing; opts.
    // midWaveCapture forces a flat value instead (for A/B). The full bounty still
    // carries to the next wave via cumBounty below — this only widens the current
    // wave's affordability.
    const capture = opts.midWaveCapture ?? a.captureFrac;
    const spendableBudget = budgetBefore + capture * a.bounty;
    const reqLasers = a.demand / laserEffDPS;              // firepower needed (base-laser-eq)
    const affordLasers = spendableBudget / TOWERS.laser.baseCost;
    cumBounty += a.bounty;                                 // full payout carries to the next wave
    cumXP += a.xp;
    return {
      wave: i + 1, ...a,
      reqLasers, affordLasers, budgetBefore, spendableBudget, capture,
      ratio: reqLasers / Math.max(0.01, affordLasers),      // >1 = demand outpaces cheap economy
    };
  });

  // TWO distinct bottlenecks, reported separately (conflating them is misleading):
  //  • firepower peak = the wave needing the most firepower = the LEVEL DIFFICULTY.
  //  • economy peak   = the wave where demand most outruns affordable base lasers
  //                     (usually early, when money is scarce) = the money crunch.
  const firePeak = waves.reduce((m, w) => (w.reqLasers > m.reqLasers ? w : m), waves[0]);
  const ecoPeak = waves.reduce((m, w) => (w.ratio > m.ratio ? w : m), waves[0]);
  return {
    levelId, levelNum, coverageTiles: +coverageTiles.toFixed(2),
    coreHealth: level.coreHealth, startingMoney: level.startingMoney,
    // Difficulty = peak required firepower (the hardest wave), in base-laser-eq.
    peakWave: firePeak.wave, peakRegime: firePeak.regime,
    peakDemand: +firePeak.demand.toFixed(1),
    reqLasers: +firePeak.reqLasers.toFixed(1),
    // Economy crunch = the tightest demand-vs-affordability wave (usually early).
    ecoWave: ecoPeak.wave,
    ecoRatio: +ecoPeak.ratio.toFixed(2),
    ecoReqLasers: +ecoPeak.reqLasers.toFixed(1),
    ecoAffordLasers: +ecoPeak.affordLasers.toFixed(1),
    totalXP: cumXP,
    waves,
  };
}

export function analyzeCampaign(opts = {}) {
  return LEVELS.map((l) => analyzeLevel(l.id, opts));
}
