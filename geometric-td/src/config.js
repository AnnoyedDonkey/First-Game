// ============================================================
// GLOBAL TUNING — the main place to tweak game balance.
//
// Everything here is a DEFAULT. Levels and individual waves can
// override most of it (see levels.js for how).
//
// ---- Balance Lab (L1) ----
// The EDITABLE gameplay numbers (enemy stats, tower stats, upgrade
// curves, economy/wave/endless knobs, endless+campaign milestone
// rewards, the migrated LOOT.xp/shards subset, and skill-tree numbers)
// now live in src/balance-data.js (BALANCE), validated by
// src/balance-schema.js. This file stays the stable module boundary
// every other src/ file imports from: it merges BALANCE's numbers with
// the presentation/identity fields that stay here (names, colors,
// shapes, labels, icons) to rebuild the exact same public exports as
// before the migration. See BALANCE_LAB_L1_PLAN.md.
// ============================================================

import { BALANCE } from "./balance-data.js";

// ---------- Debug / testing ----------
export const DEBUG = {
  gameSpeed: 1,        // 2 = everything runs twice as fast (handy for testing)
  coopLocal: false,    // fake a second local player for Phase 1 wallet/owner testing
};

// ---------- Runtime performance ----------
// AUTO visual quality watches rendered frames on each device independently;
// it is deliberately local-only and never enters a co-op snapshot. Simulation
// uses bounded game-time substeps so a 30 Hz Low Power Mode render cadence can
// run two safe ticks without making 120 Hz displays update less often.
export const PERFORMANCE = {
  simulation: {
    maxStepSeconds: 1 / 60,
    maxFrameSeconds: 0.25, // discard longer background/stall gaps
    maxCatchUpSteps: 32,   // enough for 16x game speed at a 30 Hz render cadence
  },
  monitor: {
    sampleWindowMs: 500,
    resetGapMs: 1000,      // a hidden/backgrounded page is not a low-FPS sample
    reduceBelowFps: 42,
    reduceHoldMs: 2000,
    restoreAboveFps: 52,
    restoreHoldMs: 5000,   // slower recovery prevents quality-mode flutter
  },
  reduced: {
    maxParticles: 260,
    particleCountScale: 0.35,
    deathShardScale: 0.5,
    minParticleCount: 1,
    skipWarpGrid: true,
    skipGearOrbitals: true,
    skipSpringGrid: true,
    simpleParticleRendering: true,
  },
};

// Single-player towers and wallets use this owner id. Co-op sessions replace
// it with the ids assigned by the host; keeping the fallback shared prevents
// callers such as the Balance Lab and tower demos from needing co-op setup.
export const DEFAULT_OWNER_ID = "local";

// ---------- Enemies ----------
// speed is in TILES per second (so it works on any map/tile size).
// bounty  = money awarded on kill.
// xp      = tower XP awarded on kill.
// coreDamage = AI Core damage if the enemy leaks through.
//
// COUNTERS (damageMult): each enemy can resist or be weak to specific
// tower damage types. The key is the tower's `damageType`:
//   energy = Laser, pulse = Pulse, control = Slow, rail = Railgun.
// A value < 1 RESISTS that type (takes less); > 1 is WEAK to it (takes
// more); any type not listed defaults to 1.0 (normal). This is THE knob
// that lets a level demand a specific tower combo — e.g. Armored shrugs
// off lasers but folds to a Railgun. Tune freely; applied in enemies.js
// damageEnemy(). Damage numbers all live here + in TOWER_UPGRADES.
// shardTier = relative "how tough is this enemy" bucket used to scale
// Shards earned per kill (LOOT.shards.perKillBase * shardTier). 1 = grunt,
// 2 = heavy, 4 = boss — matches LOOT_DESIGN.md §1's grunt/heavy/boss split.
//
// Presentation-only fields (identity, never Lab-editable). Numbers
// (baseHealth, speed, coreDamage, bounty, xp, shardTier, regenRate?,
// damageMult?, splitInto?) come from BALANCE.enemies below.
const ENEMY_PRESENTATION = {
  basic: {
    name: "Basic",
    shape: "triangle",
    size: 0.28,          // radius as a fraction of tile size
    color: "#35e0ff",    // neon cyan
    // Neutral to everything — the baseline enemy.
  },
  fast: {
    name: "Fast",
    shape: "diamond",
    size: 0.22,
    color: "#ffe24a",    // neon yellow
    // Fragile flyers — Lasers (fast fire) shred them; slow Pulse orbs and
    // lobbed Rockets struggle to catch them. ANSWER: Laser (or Slow to pin).
  },
  armored: {
    name: "Armored",
    shape: "hexagon",
    size: 0.32,
    color: "#ff3fd4",    // neon magenta
    // Plated: lasers & slow-zaps clang off harmlessly. Concussive Pulse
    // splash rattles it, and a Railgun punches clean through.
    // ANSWER: Pulse early, Railgun once unlocked. NOT Laser.
  },
  boss: {
    name: "Boss",
    shape: "octagon",
    size: 0.42,
    color: "#ff4a5e",    // neon red
    // Massive lone target: shrugs off slows, and small splash is wasted on
    // a single body — but a direct Rocket blast hits hard. Focused fire wins.
    // ANSWER: Railgun / Rocket / Laser focus. NOT Pulse, NOT Slow.
    // Hard-mode pass (H3, 2026-07-17): pulse resist eased 0.75->0.85 — H1
    // already nerfed Pulse directly (slower cadence/shorter range/pricier),
    // so the full 25% boss resist on top was double-stacking two independent
    // Pulse nerfs (this value is global, shared by every level's boss, not
    // just L6 — softened slightly for all, kept meaningfully resistant).
  },
  // Splits into 2 splitlings on death — punishes single-target builds.
  splitter: {
    name: "Splitter",
    shape: "square",
    size: 0.28,
    color: "#ff7a2f",    // neon orange
    // Pulse splash and Rocket blasts hit the parent AND both children at
    // once; a single-line Railgun wastes most of its shot on one body.
    // ANSWER: Pulse / Rocket. NOT Railgun.
  },
  splitling: {
    name: "Splitling",
    shape: "diamond",
    size: 0.16,
    color: "#ff7a2f",
  },
  // Heals itself while alive — punishes chip damage, rewards burst.
  regenerator: {
    name: "Regenerator",
    shape: "pentagon",
    size: 0.30,
    color: "#7dff4a",    // acid green
    // Out-heals steady laser chip almost entirely; only a Railgun's burst
    // outruns the regen. ANSWER: Railgun. NOT Laser.
  },
};

export const ENEMIES = {};
for (const id of Object.keys(ENEMY_PRESENTATION)) {
  ENEMIES[id] = { ...ENEMY_PRESENTATION[id], ...BALANCE.enemies[id] };
}

// ---------- Waves ----------
export const WAVE_DEFAULTS = BALANCE.waveDefaults;

// ---------- Endless mode ----------
// Unlocked per level once its campaign is beaten. Reuses the level's own
// 10 authored waves unchanged, then generates waves procedurally past
// that (see endless.js), anchored to the difficulty of the level's own
// final wave. Everything compounds per "extra" wave k (k=1 is the wave
// right after the campaign ends), so this ramps up FAST — only a
// heavily-upgraded/high-Mastery roster should push deep into it.
export const ENDLESS = BALANCE.endless;

// One-time-per-level Endless milestones (LOOT_DESIGN.md §10). Each level
// tracks its own claimed set (save.js endlessRewards[levelId], keyed by
// milestone `id` — ids must stay stable once shipped, since claimed sets
// reference them by id, not index). Grants are automatic (no separate
// claim step) the moment a run's best-ever wave for that level crosses a
// threshold — see progression.js grantEndlessRewards(). Loot rewards land
// in pendingLoot (same triage flow as any other drop); shard rewards bank
// immediately.
// Reference: an 8-tower level-1 laser wall (fresh, no Mastery) died on
// endless wave 18 in first-pass bot testing (HANDOFF.md) — thresholds
// are set around and past that bar.
// label is the human-readable milestone name shown on the circuit-board
// menu's level detail sheet (CIRCUIT_MENU_DESIGN.md M0); reward text
// itself is derived in ui.js from `reward` so it's never hardcoded here.
//
// Per-level tracks (CIRCUIT_MENU_DESIGN.md M4): `defaultTrack` applies to
// every level EXCEPT those with an entry in `tracksByLevel`, which fully
// replaces the track for that level id (e.g. a future 20-milestone track
// for a specific level). This is data-shape readiness only — content
// (actually authoring per-level tracks) is a later balance pass; for now
// every level still resolves to `defaultTrack`, so behavior is unchanged.
export const ENDLESS_REWARDS = BALANCE.endlessRewards;

// Resolves the milestone list for a level: its own track if one exists in
// `tracksByLevel`, else the shared `defaultTrack`. The single read path
// for both progression.js (grants) and ui.js (display) so they can never
// disagree on which track a level uses.
export function endlessTrackFor(levelId) {
  return ENDLESS_REWARDS.tracksByLevel[levelId] ?? ENDLESS_REWARDS.defaultTrack;
}

// ---------- Per-level campaign milestones (B5) ----------
// Optional per-battle challenges layered on the campaign. Each entry:
//   { id, label, check, reward }
// `label` shows in the level sheet + end-screen recap and (uppercased) in the
// live toast. `reward` is { skillPoints, shards } — both optional, both paid.
//
// `check` is DATA evaluated by src/milestones.js against the run — no code
// here. The condition vocabulary (combine freely in one check; all must pass):
//   { kills: N }               - killed >= N enemies this run
//   { towersAtLevel: [C, L] }  - >= C deployed towers currently at level >= L
//   { clearNoLeaks: true }     - won with zero leaks (resolves at win only)
//   { onlyTowers: [types] }    - only these tower types were ever placed
//   { withoutTowers: [types] } - none of these tower types were ever placed
//   { throughWave: W }         - gate: only counts once wave W is cleared;
//                                pair with onlyTowers/withoutTowers to make
//                                them a first-W-waves constraint instead of a
//                                whole-run one (which otherwise resolves at win)
//
// Tower types: laser, pulse, slow (from L1), railgun (after L5), rocket
// (after L10). "Flawless" (clearNoLeaks) is intentionally hard — the marquee
// per-level challenge. EVERY campaign challenge awards 1 skill point plus
// shards ({ skillPoints, shards } — both optional in the data, both granted
// in progression.js grantLevelMilestones). Shard amounts scale with depth.
export const LEVEL_MILESTONES = BALANCE.levelMilestones;

// ---------- Towers ----------
// (Used from Checkpoint B onward — defined now so all knobs live together.)
// Presentation/identity-only fields. Numbers (baseCost, baseDamage,
// baseRange, baseFireRate, basePierce?, splashRadius?, projectileSpeed?,
// slowPercent?, slowDuration?, vulnerability?, pierceWidth?,
// upgradeCostMult?, damageType) come from BALANCE.towers below.
const TOWER_PRESENTATION = {
  laser: {
    name: "Laser Tower",
    prefix: "L",           // single-letter gear lock-tag glyph (e.g. STASH corner dot)
    rosterPrefix: "Laser", // roster names: Laser-01, Laser-02...
    color: "#35e0ff",
  },
  pulse: {
    name: "Pulse Tower",
    prefix: "P",           // single-letter gear lock-tag glyph
    rosterPrefix: "Pulse",
    color: "#ff3fd4",
    // Playtest feedback (2026-07, round 2): "Pulse tower should have a
    // slower firing cadence and smaller range. It's overpowered" (L5) +
    // "Pulse tower should cost more to buy" (L10). Was the free default
    // answer to everything (13/15 winning comps, usually the top-invested
    // tower). Slower cadence (1.1s→0.78s), shorter range (now the
    // shortest of the set, below laser/slow's 1.6/1.9), pricier
    // (75→105) — meant to become a legitimate splash/crowd-control pick,
    // not the best single pick for every level. Expensive to level, but
    // scales into a swarm-clearing monster (see its bigger splash
    // specialty in TOWER_UPGRADES). Costs 60% more per upgrade than the
    // shared table.
  },
  slow: {
    name: "Slow Tower",
    prefix: "S",           // single-letter gear lock-tag glyph
    rosterPrefix: "Slow",
    color: "#4affa1",
    // FORCE MULTIPLIER: a slowed enemy also takes extra damage from ALL
    // sources for the slow's duration. This is the Slow Tower's real job —
    // it makes every other tower hit harder, so it earns a slot in a combo.
    // Cheap to level (it's support, not DPS).
  },
  // Unlocked by clearing Core Siege (level 5). Slow, charged, devastating — the
  // ray PIERCES every enemy along its line, and since the rework (2026.08.19-14+)
  // that line reaches the WHOLE board once an enemy enters its (modest) targeting
  // ring. See HANDOFF "Railgun rework" + VFX.railgun.
  railgun: {
    name: "Railgun Tower",
    prefix: "R",           // single-letter gear lock-tag glyph
    rosterPrefix: "Railgun",
    color: "#ff9d3f",
    unlockLabel: "CLEAR LV 5",
    // Playtest feedback (2026-07): "overpowered or too cheap" — 48 dmg ×
    // 4 pierce / 3s beats laser's DPS-per-gold badly. baseCost 100→140 plus
    // a steeper per-upgrade cost so it stays a premium pick, not a default.
  },
  // Unlocked by clearing World 2 (level 10). GLOBAL RANGE — lobs an
  // explosive rocket at any enemy anywhere on the map. Very slow to
  // reload and pricey, but each shot lands a heavy AoE blast. Its blast
  // shreds clustered Splitters and lone Bosses; too sluggish to track
  // Fast movers. Placement doesn't matter (it reaches everywhere), so
  // it's the artillery you slot in for global coverage.
  rocket: {
    name: "Rocket Launcher",
    trayName: "ROCKET",    // tray label (name has no " Tower" to strip)
    prefix: "K",           // single-letter gear lock-tag glyph (R is the railgun)
    rosterPrefix: "Rocket", // roster names: Rocket-01, Rocket-02...
    color: "#ff5e3a",      // rocket red-orange (distinct from railgun amber)
    unlockLabel: "CLEAR LV 10",
    // Playtest feedback (2026-07): "Rocket should be more expensive to
    // upgrade" — global range is meant to be the expensive-to-scale option
    // (cf. pulse 1.6×), so it costs more to level than a placement-limited
    // tower.
  },
};

// Key order (laser, pulse, slow, railgun, rocket) drives tray order and
// skill-branch layout (ui.js Object.entries(TOWERS)) — preserved via
// TOWER_PRESENTATION's own insertion order.
export const TOWERS = {};
for (const id of Object.keys(TOWER_PRESENTATION)) {
  TOWERS[id] = { ...TOWER_PRESENTATION[id], ...BALANCE.towers[id] };
}

// Per-level stat growth when a tower is upgraded (Checkpoint C).
// Each level multiplies the stat by (1 + value).
// BASE cap = 5. The account-wide skill tree can raise it to 10 via the
// chained towerCap6..towerCap10 nodes (progression.js getTowerLevelCap).
// XP needed to become ELIGIBLE for each level (index 0 = level 2).
// Length 9 = levels 2..10; indices 4..8 (levels 6-10) only ever apply
// once the matching towerCap skill is unlocked. Steep on purpose.
// Money cost to actually buy each level (index 0 = level 2).
// A tower can scale this with its own `upgradeCostMult` (see TOWERS) —
// e.g. Pulse pays 1.6x, Slow pays 0.8x. Levels 6-10 are pricey.
//
// MASTERY — progression beyond level 5. XP earned past the level-5
// threshold converts into permanent damage ranks (no money cost,
// follows the tower forever like specialties). Makes grinding
// earlier levels pay off.
//
// 50-rank ESCALATING curve (loot spec §2a): rank n costs
// baseXpPerRank + xpRankIncrement*(n-1) XP, so each rank costs a bit
// more than the last (cumulative XP is quadratic). Rank is derived
// purely from `xp` in masteryRankFor() — no save field — so it stays
// retroactive. The steeper curve intentionally lowers existing
// veterans' ranks (loot spec §2b, decision: ACCEPT the nerf).
// Reference (base 400, inc 80): rank 1 = 1,100 XP total ·
// rank 10 = 8,300 · rank 20 = 23,900 · rank 50 = 118,700.
// xpStart is the DEFAULT (= the level-5 threshold, for a base cap of 5).
// When the account unlocks higher tower caps (towerCap6..10),
// progression.js re-anchors the live start to the new cap's XP threshold
// via equipment.setMasteryXpStart so XP spent reaching levels 6-10
// doesn't ALSO double-count as mastery ranks. Anchored to the account
// cap, not per-tower.
//
// Each tower class gains an EXTRA specialty bonus per level, on top
// of the shared growth above. Explained to the player in the Tower
// Guide (shown at level 2, and from the main menu). `label` is
// presentation; the growth value comes from BALANCE.towerUpgrades.
const SPECIALTY_LABELS = {
  laser:   "+ extra range per level",
  pulse:   "+ bigger explosions per level",
  slow:    "+ faster firing per level",
  railgun: "+ more rays as it levels up",
  rocket:  "+ bigger blasts per level",
};

export const TOWER_UPGRADES = {
  ...BALANCE.towerUpgrades,
  specialties: {},
};
for (const id of Object.keys(BALANCE.towerUpgrades.specialties)) {
  TOWER_UPGRADES.specialties[id] = {
    ...BALANCE.towerUpgrades.specialties[id],
    label: SPECIALTY_LABELS[id],
  };
}

// ---------- Economy ----------
// moneyPerKillMultiplier = global multiplier on all bounties.
// xpPerKillMultiplier    = global multiplier on all XP gains.
// Cash interest (skill: interestRate + interestCap). At each wave-clear
// the player earns floor(money * rate), capped. Both are 0 until the
// matching skill nodes are bought — the per-tier sizes live in
// SKILL_VALUES.interestRate / .interestCap below. Applied in game.js.
export const ECONOMY = BALANCE.economy;

// ---------- Loot & equipment (see LOOT_DESIGN.md) ----------
// Home for every loot/gear tunable. `xp` (P0) and `shards` (P1) are the
// only migrated (Balance Lab EDIT) subsections — see balance-data.js.
// Every other subsection below (combat/gen/drops/stash/equipGate/
// autoEquip/store) is DEFERRED and stays a literal here through L1/L2.
export const LOOT = {
  // XP redistribution: a kill's XP pool is split among every tower that
  // contributed to that enemy, by weight, instead of all going to the
  // final-hit tower. Damage dealt = 1 weight per point of damage; slow
  // applied = slowSecondsApplied * slowWeightPerSec. This is what finally
  // pays Slow towers (they rarely land the killing blow).
  xp: BALANCE.loot.xp,

  // Shards ◆ — the persistent meta-currency for loot gear/store systems.
  // Earned per kill, win OR lose, so grinding/forfeiting still pays.
  // Per-kill amount = perKillBase * ENEMIES[type].shardTier * levelMult *
  // shardFindMult, accumulated as a float (rounded once at wallet sync —
  // see progression.js syncRoster) so small per-kill values aren't lost to
  // rounding. levelMult = 1 + perLevelMult*(levelNumber-1), so a full L1
  // clear (~271 tier-units of kills) lands ~33 shards; scales up by level.
  shards: BALANCE.loot.shards,

  // ---- Equipped-item combat (P3) ----
  // Item affixes are percentages unless they are explicitly counts. These
  // values define mechanics shared by every item and the bespoke named
  // unique effects. Keep balance changes here rather than in combat code.
  combat: {
    baseCritDamage: 50,          // a crit deals +50% before critDamage affixes
    maxSlowPercent: 85,          // hard ceiling after Slow Potency gear
    laserPierceWidthTiles: 0.12, // half-width of a gear-piercing laser beam
    prismLensDamage: 50,         // split shot damage dealt to the second target
    executionHealthBelow: 20,    // target HP percentage that activates execute
    executionDamage: 40,         // bonus damage while execute is active
    overflowEveryShots: 5,       // every Nth trigger fires a free bonus volley
    gravityRadiusTiles: 0.9,     // area around the Slow tower's primary target
    gravityDragTiles: 0.22,      // BASE path distance pulled backward per zap (before resistance)
    gravityResistStep: 0.1,      // resistance gained per zap; drag reaches 0 after ceil(1/step) zaps, so enemies always break free
    fractalBomblets: 3,
    fractalDamage: 35,           // each bomblet's damage as % of the main blast
    fractalRadius: 45,           // each bomblet's radius as % of main blast
    fractalOffsetTiles: 0.42,    // bomblet centers from the main impact
    cascadeBonusPierce: 2,
    cascadeDamageRamp: 15,       // added damage per victim already pierced
  },

  // ---- Behavioral gear modifiers (AFFIXES_PLAN) ----
  // Spec rarity names map onto the shipped names: uncommon -> enhanced,
  // epic -> prismatic, and
  // legendary -> singularity. Exposed and Throttle are global per-stack in
  // v1, so they have no rarity tables even though items store their power.
  mods: {
    testDropRate: 0.5,
    powers: {
      array: {
        common: 0.015, enhanced: 0.025, rare: 0.035,
        prismatic: 0.045, singularity: 0.06,
      },
      desync: {
        common: 0.01, enhanced: 0.015, rare: 0.02,
        prismatic: 0.025, singularity: 0.03,
      },
      corruption: {
        common: 1, enhanced: 2, rare: 3,
        prismatic: 4, singularity: 6,
      },
      rootkit: {
        common: 1.0, enhanced: 1.25, rare: 1.5,
        prismatic: 1.75, singularity: 2.0,
      },
      backdoor: {
        rare: 0.3, prismatic: 0.35, singularity: 0.4,
      },
      overclock: {
        common: { perKill: 0.02, cap: 0.40 },
        enhanced: { perKill: 0.025, cap: 0.45 },
        rare: { perKill: 0.03, cap: 0.50 },
        prismatic: { perKill: 0.035, cap: 0.55 },
        singularity: { perKill: 0.04, cap: 0.60 },
      },
      throttle: { perStack: 0.02, maxSlow: 0.50 },
      exposed: { perStack: 0.02, maxStacks: 20 },
      fork: {
        common: 0.005, enhanced: 0.01, rare: 0.015,
        prismatic: 0.02, singularity: 0.025,
      },
      damageBroadcast: {
        common: 0.04, enhanced: 0.06, rare: 0.08,
        prismatic: 0.10, singularity: 0.13,
      },
      fireRateBroadcast: {
        common: 0.04, enhanced: 0.06, rare: 0.08,
        prismatic: 0.10, singularity: 0.13,
      },
      rangeBroadcast: {
        common: 0.04, enhanced: 0.06, rare: 0.08,
        prismatic: 0.10, singularity: 0.13,
      },
      critBroadcast: {
        common: 0.02, enhanced: 0.03, rare: 0.04,
        prismatic: 0.05, singularity: 0.06,
      },
    },
    desyncMaxStacks: 50,
    corruption: {
      maxStacks: 50, spreadFrac: 0.5,
      spreadTargets: 1, spreadRadiusTiles: 2,
    },
    rootkit: { rampPerSec: 0.05 },
    overclock: { killCooldownSec: 0.5 },
    arrayExtraSourceBonus: 0.01,
    // Array damage bonus = min(sameTypeCount, arrayMaxTowers) × effectivePower.
    // The cap keeps a same-type tower spam from scaling without bound (and from
    // lagging the board with huge rosters).
    arrayMaxTowers: 10,
    broadcastRadiusTiles: 3,
    broadcastSelfBuffs: false,
    // Fork spawns on the nearest legal empty tile within maxRadiusTiles
    // (Chebyshev) of the parent; set 1 for strictly-adjacent only.
    fork: { levelBelowParent: 1, minLevel: 1, maxRadiusTiles: 2 },
  },

  // ---- Item generator (P2, see LOOT_DESIGN.md §4-§6 + loot.js) ----
  // Everything the pure generator rolls from. loot.js is logic only; every
  // number a designer would tune lives here.
  gen: {
    // Restriction (§4c). On generation an item is either UNIVERSAL (usable
    // by any tower) or locked to ONE tower type. Restricted items are
    // compensated by access to type-specific affixes (Pierce/Splash/Slow*)
    // AND a value bonus.
    pUniversal: 0.6,          // chance an item rolls universal (else restricted)
    restrictedRollBonus: 1.15, // restricted items roll this much higher (1.0 = off)

    // Item-level → roll-toward-top (§5). A rolled affix picks a fraction of
    // its [lo,hi] band; higher ilvl nudges that fraction up. t = ilvl/ilvlMax
    // (clamped 0..1); frac = base + (1-base)*(t*ilvlTopBias). So ilvl never
    // lowers a roll and at t=1,bias=1 it always maxes. Drops/store (P4/P5)
    // choose ilvl; the generator just consumes it (default 1 = min band).
    ilvlMax: 100,
    ilvlTopBias: 0.6,

    // Rarity roll when a caller doesn't pin one (§7 weights). Drops (P4) may
    // pass its own biased weights; this is the generator's self-sufficient
    // default so it's usable standalone today.
    rarityWeights: { common: 60, enhanced: 25, rare: 10, prismatic: 4, singularity: 1 },

    // Affix count per rarity (§4b). Singularity rolls a range (2 or 3) of
    // NORMAL affixes on TOP of its named unique.
    affixCounts: { common: 1, enhanced: 1, rare: 2, prismatic: 2, singularity: [2, 3] },

    // Requirement gate by rarity (§2c). Common/Enhanced gate on career
    // maxLevel (a per-item reqLevel derived from ilvl, 1..5); Rare+ gate on
    // Mastery rank. Checked against a tower's CAREER stats so gear never
    // unequips mid-battle. reqMastery here; reqLevel is derived in loot.js.
    reqMastery: { common: 0, enhanced: 0, rare: 1, prismatic: 10, singularity: 20 },
    reqLevelMax: 5,          // ceiling for the derived common/enhanced reqLevel

    // ---- Affix pool, per slot (§5) ----
    // Each affix: { stat, name, types, ranges[, int] }.
    //   stat   = key P3 combat code reads.
    //   types  = "universal" (any tower) OR a list of tower types it locks to
    //            (a type-specific affix can ONLY appear on a restricted item
    //            of a matching type — this is what §4c's intersection rule
    //            enforces; the generator fixes the type first, then only
    //            samples affixes compatible with it).
    //   ranges = per-rarity [lo,hi] roll band (percent unless int).
    //   int    = true for whole-number affixes (Pierce +N; lo==hi per rarity).
    slots: {
      optic: [
        { stat: "range",      name: "Range %",       types: "universal",
          ranges: { common: [3, 6], enhanced: [6, 10], rare: [9, 14], prismatic: [13, 20], singularity: [18, 28] } },
        { stat: "critChance", name: "Crit Chance %", types: "universal",
          ranges: { common: [2, 4], enhanced: [4, 6], rare: [5, 9], prismatic: [8, 13], singularity: [12, 18] } },
        { stat: "critDamage", name: "Crit Damage %", types: "universal",
          ranges: { common: [10, 20], enhanced: [20, 35], rare: [30, 50], prismatic: [45, 70], singularity: [60, 100] } },
      ],
      emitter: [
        { stat: "damage",    name: "Damage %",         types: "universal",
          ranges: { common: [4, 7], enhanced: [7, 11], rare: [10, 16], prismatic: [15, 23], singularity: [20, 32] } },
        { stat: "projSpeed", name: "Projectile Speed %", types: "universal",
          ranges: { common: [5, 9], enhanced: [9, 14], rare: [13, 20], prismatic: [18, 28], singularity: [25, 40] } },
        { stat: "pierce",    name: "Pierce +N",        types: ["railgun", "laser"], int: true,
          ranges: { common: [1, 1], enhanced: [1, 1], rare: [2, 2], prismatic: [2, 2], singularity: [3, 3] } },
        { stat: "splash",    name: "Splash Radius %",  types: ["pulse", "rocket"],
          ranges: { common: [4, 8], enhanced: [8, 13], rare: [12, 18], prismatic: [16, 26], singularity: [22, 35] } },
      ],
      capacitor: [
        { stat: "fireRate",     name: "Fire Rate %",      types: "universal",
          ranges: { common: [3, 6], enhanced: [6, 9], rare: [8, 13], prismatic: [12, 18], singularity: [16, 25] } },
        { stat: "slowPotency",  name: "Slow Potency %",   types: ["slow"],
          ranges: { common: [4, 8], enhanced: [8, 13], rare: [12, 18], prismatic: [16, 26], singularity: [22, 35] } },
        { stat: "slowDuration", name: "Slow Duration %",  types: ["slow"],
          ranges: { common: [5, 10], enhanced: [10, 16], rare: [14, 22], prismatic: [20, 32], singularity: [28, 45] } },
        { stat: "overcharge",   name: "Overcharge %",     types: "universal", // double-shot chance ⚙️
          ranges: { common: [2, 4], enhanced: [4, 6], rare: [5, 9], prismatic: [8, 13], singularity: [12, 18] } },
      ],
      frame: [
        { stat: "xpGain",    name: "XP Gain %",    types: "universal",
          ranges: { common: [5, 10], enhanced: [10, 16], rare: [14, 22], prismatic: [20, 32], singularity: [28, 45] } },
        { stat: "shardFind", name: "Shard-Find %", types: "universal",
          ranges: { common: [5, 10], enhanced: [10, 16], rare: [14, 22], prismatic: [20, 32], singularity: [28, 45] } },
        { stat: "bounty",    name: "Bounty %",     types: "universal",
          ranges: { common: [4, 8], enhanced: [8, 13], rare: [12, 18], prismatic: [16, 26], singularity: [22, 35] } },
      ],
    },

    // ---- Uniques (§6) ----
    // minor = Prismatic bonus (one rolled, on top of 2 normal affixes).
    // named = Singularity chase items: each DEFINES its slot (and sometimes a
    // tower type), then rolls 2-3 normal affixes on top. `value` is the
    // effect magnitude P3 combat code will consume (kept here, tunable).
    uniques: {
      minor: [
        { id: "doubleShot", name: "Overcharged",  value: 10 },  // +10% double-shot chance ⚙️
        { id: "critEdge",   name: "Honed",        value: 8 },   // +8% crit chance ⚙️
        { id: "piercer",    name: "Piercing",     value: 1 },   // +1 pierce
        { id: "vulnMark",   name: "Destabilizer", value: 15 },  // slowed enemies take +15% from all sources
      ],
      named: [
        { id: "prismLens",         name: "Prism Lens",         slot: "optic" },
        { id: "entropyEmitter",    name: "Entropy Emitter",    slot: "emitter" },
        { id: "executionersArray", name: "Executioner's Array", slot: "optic" },
        { id: "overflowCore",      name: "Overflow Core",      slot: "capacitor" },
        { id: "gravityWell",       name: "Gravity Well",       slot: "frame",   towerType: "slow" },
        { id: "fractalWarhead",    name: "Fractal Warhead",    slot: "emitter", towerType: "rocket" },
        { id: "cascadeRail",       name: "Cascade Rail",       slot: "emitter", towerType: "railgun" },
      ],
    },

    // Shard sell-back value by rarity (§1). Store (P5) reads this; kept here
    // so every loot number is in one place.
    sellValues: { common: 5, enhanced: 15, rare: 40, prismatic: 100, singularity: 300 },
  },

  // ---- Drops, stash and triage (P4) ----
  drops: {
    dropChanceBase: 0.01,       // base per-kill item chance
    dropChanceTierMult: 0.6,    // each shardTier above 1 adds +60% chance
    bossRarityBias: 0.35,       // higher enemy tiers tilt weights upward
    ilvlPerLevel: 5,            // campaign level contribution to item level
    ilvlPerWave: 2,             // reached-wave contribution to item level
    endDropFloor: [             // guaranteed end-drop rarity floors
      { minLevel: 1, minWave: 0, rarity: "common" },
      { minLevel: 6, minWave: 0, rarity: "enhanced" },
      { minLevel: 11, minWave: 0, rarity: "rare" },
      { minLevel: 1, minWave: 20, rarity: "rare" },
      { minLevel: 1, minWave: 35, rarity: "prismatic" },
    ],
    // Guaranteed end-drop rarity CEILINGS, gated on waves actually cleared
    // THIS run (not endless-scale thresholds — campaign levels only run
    // ~10-15 waves, so these stay small): an early quit/forfeit a couple
    // waves into a high-numbered level keeps the guaranteed drop
    // low-rarity even though the level-based rarityLevelGate would allow
    // higher. A full clear (10+ waves) always reaches singularity, and
    // Endless naturally blows past every threshold here.
    endDropCeiling: [
      { minWave: 0, rarity: "enhanced" },
      { minWave: 3, rarity: "rare" },
      { minWave: 6, rarity: "prismatic" },
      { minWave: 10, rarity: "singularity" },
    ],
    // Ceiling on rollable rarity by campaign level number (fixes the
    // 2-prismatics-on-L1 bug — the roll used to be a flat weight table
    // with no level gating at all). Highest matching rule wins. Applied
    // on top of `LOOT.gen.rarityWeights` in loot.js biasedRarityWeights,
    // alongside a down-weight of `enhanced` on the earliest levels so
    // early drops skew heavily common.
    rarityLevelGate: [
      { minLevel: 1, maxRarity: "enhanced", enhancedWeightMult: 0.35 },
      { minLevel: 3, maxRarity: "rare" },
      { minLevel: 6, maxRarity: "prismatic" },
      { minLevel: 10, maxRarity: "singularity" },
    ],
  },

  // Stash capacity: a free base plus purchasable expansions (a Shard sink —
  // progression.js getStashCap/buyStashUpgrade). Total = baseStashSize +
  // (owned upgrades, capped at upgradeCosts.length) * upgradeSize.
  // 100 + 10*20 = 300 max.
  stash: {
    baseStashSize: 100,
    upgradeSize: 20,
    upgradeCosts: [50, 80, 130, 210, 350, 570, 925, 1500, 2450, 4000],
  },

  // autoJunk: a second Shard sink, sold as sequential per-rarity tiers
  // (progression.js buyAutoJunkTier — must be BOUGHT in order, index =
  // state.autoJunkTier, -1 = none owned). Each owned rarity can be paused
  // independently at runtime (state.autoJunkPaused, progression.js
  // isAutoJunkRarityEnabled/setAutoJunkRarityEnabled) without losing the
  // purchase. For a rarity that's owned AND not paused, loot EARNED in
  // play (kill drops, the guaranteed end-drop, Endless milestone loot —
  // NOT store purchases) at that rarity is auto-sold for Shards instead of
  // taking a stash/triage slot, if it didn't already auto-equip.
  // Singularity can never be junked (no tier for it).
  autoJunk: {
    tiers: [
      { rarity: "common", cost: 500 },
      { rarity: "enhanced", cost: 750 },
      { rarity: "rare", cost: 1000 },
      { rarity: "prismatic", cost: 1500 },
    ],
  },

  // ---- Gear rules (U0, see GEAR_UI_DESIGN.md §1) ----
  // equipGate: no tower can equip ANY gear until its Mastery rank reaches
  // minMastery (rank 1 = 1,100 career XP on the current TOWER_UPGRADES
  // .mastery curve). Grandfathered: gear equipped
  // before the gate existed keeps working — only NEW equips are blocked
  // (enforced in equipment.js canEquipItem, never by stripping saves).
  equipGate: {
    minMastery: 1,
  },

  // autoEquip: loot EARNED in play (kill drops, the guaranteed end-drop,
  // Endless milestone loot — NOT store purchases) tries to equip itself
  // onto the best eligible tower (highest Mastery, then career maxLevel,
  // then XP) whose matching slot is EMPTY, before falling back to the
  // stash (pendingLoot triage only when the stash is full).
  //   enabled: false reverts to the old everything-into-pendingLoot flow.
  //   fillEmptyOnly: true = never touch an occupied slot. false = may
  //     replace strictly lower-rarity gear (displaced item goes to stash).
  autoEquip: {
    enabled: true,
    fillEmptyOnly: true,
  },

  // ---- Store (P5) ----
  // Stock refreshes after every completed, lost, or forfeited game. Its item
  // level follows the player's strongest career tower so the shop naturally
  // grows with the roster. Prices and reroll escalation are Shards.
  store: {
    stockSize: 15,
    ilvlBase: 1,
    ilvlPerMaxLevel: 10,
    ilvlPerMasteryRank: 1,
    rerollCost: 25,
    rerollCostIncrement: 15,
    prices: { common: 15, enhanced: 50, rare: 140, prismatic: 450, singularity: 1400 },
    // Shard cost to unlock each rarity for store rolls. common is always free.
    // Sized against the B1 ~33-shards/L1 economy: enhanced after ~3 clears,
    // prismatic needs higher-level farming.
    rarityUnlocks: { enhanced: 80, rare: 300, prismatic: 1200, singularity: 4000 },
    // Permanent Skill Point purchase. The first is deliberately cheap; after
    // the second purchase the price rises by a flat step until it reaches cap.
    skillPointCost: { first: 50, second: 100, increment: 100, cap: 1000 },
  },
};

// ---------- Visual effects (GeoDefense-inspired) ----------
// All the spectacle knobs live here. "Subtle" starting values —
// raise warp strengths and particle counts for more drama.
export const VFX = {
  // Tower-tray icons: the bottom HUD shows each tower as a live micro-sim
  // (src/tray-icon.js) instead of its name. Non-selected buttons draw one
  // idle frame; the SELECTED tower runs a firing loop — real in-game shots
  // aimed at an invisible pinned target one tile "up", so the shots leave the
  // cropped frame and hit nothing on the real board. All cosmetic; tune here.
  trayIcon: {
    tilePx: 46,            // sim tile size in CSS px — matches the on-screen
                           // in-game tile so the tower glyph is the same size
    viewTiles: 1.0,        // crop to ~one tile so the tower fills the icon like
                           // it fills its tile in battle (tower centered)
    gridWidth: 3,          // sim board width in tiles (tower centered at 1,1)
    gridHeight: 3,         // sim board height in tiles
    towerTile: { x: 1, y: 1 }, // where the tower sits (kept centered by the crop)
    targetTile: { x: 1, y: 0 }, // invisible pinned target — one tile up = aim up
    dummyHealthMult: 1e12, // huge HP so the target never dies (no coins/gear/loot)
    maxFrameDt: 0.05,      // clamp per-frame dt so a tab-return can't fast-forward
  },

  maxParticles: 900,       // hard cap; oldest particles are dropped first
  hitSparkCount: 9,        // base sparks per hit (+1 per tower level)
  deathSparkCount: 20,     // extra sparks on top of shards when a unit dies
  sparkSpeed: [80, 320],   // px/sec range for sparks (fireworks!)
  sparkTtl: [0.2, 0.5],    // seconds range before a spark fades out
  shardSpeed: [60, 220],   // px/sec range for flying shards
  shardTtl: [0.5, 1.1],    // seconds range before a shard fades out
  powerSparkBonus: 4,      // extra death sparks per killer tower level

  // In-battle gear visuals (B4): each equipped item becomes a slow-orbiting
  // rarity-colored diamond around its tower, plus a faint aura tinted by the
  // tower's BEST rarity. Drawn in the additive pass (glow sprites, no
  // shadowBlur). All fractions are of a tile; a few sprites/tower, well under
  // the particle cap.
  gear: {
    orbitRadius: 0.40,     // orbital distance from tower center (fraction of tile)
    orbitSpeed: 0.55,      // base rotation, radians/sec
    diamondSize: 5.0,      // px edge length of each orbiting diamond
    orbitGlow: 5,          // px glow-sprite radius behind each diamond
    orbitGlowAlpha: 0.90,  // additive alpha of each diamond's glow
    auraRadius: 0.52,      // aura halo radius (fraction of tile)
    auraAlpha: 0.18,       // aura halo alpha (best rarity tint)
    shimmerSpeed: 5,       // singularity aura shimmer pulse speed
    shimmerDepth: 0.75,    // how much the shimmer swells the aura alpha (0-1)
  },

  // Minimal enemy Fault readout (AFFIXES_PLAN P8): static labeled pips above
  // faulted enemies. No animation/glow keeps this cheap and equally readable
  // in reduced-motion mode. renderer.js reads only the enemy already drawn.
  faultMarker: {
    enabled: true,
    radiusPx: 4.5,
    gapPx: 2,
    offsetTiles: 0.08,
    alpha: 0.95,
    font: "700 6px system-ui, sans-serif",
    textColor: "#05060f",
    types: {
      exposed: { label: "E", color: "#ff7a59" },
      throttle: { label: "T", color: "#35e0ff" },
      desync: { label: "D", color: "#ff3fd4" },
      corruption: { label: "C", color: "#a6ff4d" },
    },
  },

  // Circuit-board map decoration: a static layer of PCB traces, solder
  // pads, vias and silkscreen hexes drawn under the battle (renderer.js
  // buildCircuitLayer). Deterministic per level (seeded by level id) and
  // tinted from the level palette's pathEdge accent, so every world's maps
  // match its menu board. Pre-rendered ONCE per level to an offscreen
  // canvas — zero per-frame cost. All alphas are the layer's own; it sits
  // beneath the warp grid so it stays subtle behind the action.
  circuit: {
    traceCount: 26,     // wandering trace attempts per board (deduped by tile)
    traceWidth: 1.6,    // px stroke of each trace
    traceAlpha: 0.28,   // trace line alpha
    padAlpha: 0.65,     // terminal solder pads (ring + filled dot)
    viaCount: 14,       // lone via rings sprinkled on untouched tiles
    viaAlpha: 0.4,
    hexCount: 4,        // silkscreen hex marks (the world-menu vocabulary)
    hexAlpha: 0.3,
    coreRingAlpha: 0.5, // concentric "CPU" rings + stub pads around the core
    portalRingAlpha: 0.5, // pad ring under the spawn portal
  },

  // The warping background grid (spring mesh).
  warp: {
    spacingTiles: 0.5,     // grid node spacing as a fraction of a tile
    homeStiffness: 42,     // pull back toward rest position
    neighborStiffness: 14, // coupling that makes ripples propagate
    damping: 5.0,          // how fast the wobble dies down
    maxDisplacement: 9,    // px clamp — keeps the board readable
    hitShock: 40,          // impulse strengths...
    deathShock: 150,
    bossShock: 460,
    leakShock: 320,        // the core "flinches" when damaged
    shockRadiusTiles: 2.0, // impulse falloff radius
  },

  // Wormholes: paired path portals that teleport an enemy from `enter` to
  // `exit` (level data `wormholes: [{enter:{x,y}, exit:{x,y}}]`). Enemy
  // movement in enemies.js; portal rendering in renderer.js drawWormholes.
  wormhole: {
    color: "#c060ff",       // singularity violet — enter/exit rings + warp flash
    ringRadiusTiles: 0.46,  // portal sprite radius as a fraction of a tile
    spinRate: 1.6,          // radians/sec the portal rings rotate
    flashTtl: 0.45,         // seconds of the warp burst at both ends
    flashShock: 220,        // spring-grid impulse when an enemy warps
  },

  // Special "field" tiles that alter enemies passing over them (level data
  // `fields: [{tiles, speedMult?, damageMult?}]`). speedPad = faster, tar =
  // slower; weak = takes more damage, shield = takes less. Rendered by
  // renderer.js drawFields; movement/damage applied in enemies.js. Colors are
  // chosen by which effect dominates (see fieldLook in renderer.js).
  field: {
    padColor: "#ff8a3c",    // speed pad — warm orange (danger: go fast)
    tarColor: "#4aa8ff",    // tar / slow field — cool blue (safe: kill zone)
    weakColor: "#ff4a5e",   // vulnerability — red (hit them here)
    shieldColor: "#8a94a8", // shield — grey (can't hurt them here)
    fillAlpha: 0.16,        // tile wash alpha
    edgeAlpha: 0.5,         // tile outline alpha
    pulseRate: 2.2,         // radians/sec the wash pulses
  },

  // Conduit build tiles: a tower placed here gains the conduit's multipliers
  // (level data `conduits: [{tiles, damageMult?, rangeMult?, fireRateMult?}]`).
  // Buff applied in towers.js recomputeStats; node drawn by renderer.js
  // drawConduits; a tap explains it (ui.js).
  conduit: {
    color: "#3affc0",        // energized mint-green power node
    fillAlpha: 0.18,
    edgeAlpha: 0.6,
    pulseRate: 3.0,
    nodeRadiusTiles: 0.3,
  },

  // Reactive faces on the track endpoints: Indy-7 (the core) and Bratwurst-XL
  // (the spawn portal). EYES ONLY — no nose/mouth is ever drawn (the core's
  // old center dot was removed for this). renderer.js coreFaceMood/
  // portalFaceMood pick an expression from live game state each frame; drawFace
  // strokes two eyes from the same vocabulary as the story-card avatars.
  face: {
    eyeColorIndy: "#eafff5",  // bright green-white, matches the avatar eyes
    eyeColorBrat: "#fff7d1",  // bright yellow-white
    hitFlashSeconds: 0.55,    // how long Indy shows X eyes after a leak reaches him
    lowCoreFrac: 0.34,        // core HP fraction at/below which Indy looks worried
    eyeSpacing: 0.30,         // eye-center offset from shape center (× shape radius; matches the story-card avatars)
    eyeRadius: 0.24,          // eye size (× shape radius)
    eyeRise: 0.06,            // eyes sit this fraction of the radius above center
    lineWidth: 1.6,           // eye stroke width
    glowBlur: 4,              // px glow behind the eyes
    // Idle blinking: both personas shut their eyes briefly now and then.
    // Different intervals + a phase offset keep them from blinking in sync.
    // Suppressed while a face is showing X eyes (being hit / defeated).
    blinkDuration: 0.12,      // seconds the eyes stay shut per blink
    blinkIntervalIndy: 4.3,   // avg seconds between Indy-7's blinks
    blinkIntervalBrat: 5.7,   // avg seconds between Bratwurst-XL's blinks
    blinkPhaseBrat: 2.1,      // time offset so Bratwurst doesn't blink with Indy
    doubleBlinkChance: 0.35,  // fraction of blinks that are a quick double-blink
    blinkGap: 0.1,            // eyes-open pause between the two blinks of a double
  },

  // Credit Juice Phase 1: coins that pop out of a dying enemy, arc under
  // gravity, and settle on the track before fading. Purely cosmetic — the
  // money award itself is untouched (enemies.js). Physics runs on honest
  // game-time (not speed-compensated); only the resting fade would need
  // that treatment and it's short enough not to matter.
  coins: {
    // --- regular kills ---
    perKill: [2, 4],        // random count per normal enemy death
    // --- boss kills ---
    bossPerKill: [18, 26],  // the "explosion of coins" moment
    bossSpeedMult: 1.6,     // bosses throw them harder and wider
    // --- physics (game-time, not speed-compensated) ---
    speed: [55, 130],       // initial burst speed, px/s
    upBias: 0.55,           // 0..1, how much of the burst is aimed upward
    gravity: 420,           // px/s^2 pulling coins back down to the board
    drag: 0.6,              // horizontal air drag (lower than the 2.2 sparks use)
    landSpreadTiles: 0.45,  // how far below the death point a coin may settle
    // --- look ---
    color: "#ffe24a",       // matches --neon-yellow / the CREDITS HUD color
    rimColor: "#fff6c0",    // bright rim so the coin reads as metal
    size: [2.6, 4.2],       // coin radius in px
    spin: [6, 13],          // flip speed, rad/s (drawn as a horizontal squash)
    spinDamp: 2.2,          // how fast a landed coin's flip settles flat
    glowMult: 2.6,          // glow sprite radius as a multiple of coin size
    // --- lifetime ---
    flightTtl: [0.55, 0.9], // max airborne time; a coin still in the air when
                            // this runs out is forced to land (safety budget,
                            // not a fade — coins stay bright until they land)
    restTtl: [0.7, 1.3],    // how long a landed coin lies there before fading
  },

  // Credit Juice: HUD pulse when CREDITS goes up (ui.js updateHUD toggles a
  // CSS class on #money-value; the class's animation-duration in styles.css
  // is the one accepted duplicate of hudPulseMs — keep them in sync).
  creditGain: {
    hudPulseMs: 420,        // duration of the HUD pulse animation
    hudPulseMinGapMs: 90,   // don't retrigger faster than this (retrigger only)
  },

  // Credit Juice: gear-drop flash — a small rarity-colored diamond pops at
  // the enemy when a loot item drops, echoing the diamond orbitals gear
  // draws around towers (drawTowerGear) so it reads instantly as "gear".
  // Gear-drop flash: the dropped item appears as its stash tile (rounded
  // square + slot glyph in the rarity color), lifts off the dead enemy, then
  // ZIPS into Indy-7 and is swallowed — after which Indy smiles. The whole
  // thing is one effect; total on-screen time is riseSeconds + zipSeconds.
  gearDrop: {
    riseSeconds: 0.38,     // slow lift off the corpse before the dash
    zipSeconds: 0.42,      // the dash into the core (accelerating)
    riseTiles: 0.45,       // how far it lifts during the rise phase
    tileTiles: 0.55,       // rounded-square side as a fraction of a game tile
                           // (deliberately smaller than the stash's own tile)
    cornerFrac: 0.18,      // corner radius ÷ tile side — matches .gear-tile's
                           // 9px radius in styles.css
    glyphFrac: 0.46,       // glyph size ÷ tile side — matches .gear-tile .glyph
    tileFill: "rgba(255, 255, 255, 0.05)", // faint plate, like .gear-tile.filled
    glyphStroke: 7,        // glyph stroke width in ui.js slotGlyph's 100-unit
                           // viewBox space; scales with the tile
    popScale: 1.7,         // tile pops in from this scale over popFrac
    popFrac: 0.35,         // fraction of the RISE phase spent popping in
    arriveScale: 0.45,     // shrinks to this as it is swallowed by the core
    ringTtl: 0.45,         // expanding rarity ring at the drop point
    ringRadiusTiles: 0.85,
    glowMult: 1.6,         // glow radius as a multiple of the tile side
    smileSeconds: 1.7,     // how long Indy-7 grins after swallowing a piece
  },

  // Tower level-up (MASTERY rank-up) celebration. A rank-up is automatic —
  // banked XP crossing a mastery threshold mid-battle (towers.js updateTowers)
  // — so this is the "leveled up from gaining experience" payoff. A golden
  // power surge wraps the tower and dissipates in a shimmering spark splash,
  // an optional small "LEVEL UP" label floats above it, and the tower gets a
  // brief damage + fire-rate boost with GOLDEN shots for the duration. Visual
  // effects render in renderer.js drawEffects; the buff + gold shots live in
  // towers.js (recomputeStats applies the multipliers, fire() tints the shot).
  // Runtime-only — nothing here touches the save. One-stop tuning:
  levelUp: {
    color: "#ffd24a",         // the surge gold — used for rings, splash, aura, text, and shots
    // The one-shot flourish (shockwave/rings/splash/text) decays on the SPEED-
    // SCALED game clock, so at x2/x4 it would flash past in real time. towers.js
    // triggerLevelUpSurge multiplies these lifetimes by game.effectiveSpeed so
    // the burst lasts a CONSISTENT real-time length at any speed. The sustained
    // aura instead tracks the buff window directly (game-time), so it naturally
    // lasts exactly as long as the boost.
    // --- opening shockwave: a big ring that expands out to announce the surge ---
    shockwaveRadiusTiles: 1.25, // outer radius the shockwave blooms to (× tile)
    shockwaveTtl: 0.55,         // seconds (real-time, speed-compensated)
    // --- the power surge rings that wrap the tower ---
    ringRadiusTiles: 0.74,    // outer radius the golden halo expands to (× tile)
    ringTtl: 0.7,             // seconds the surge halo lives (real-time)
    innerRingRadiusTiles: 0.46,
    innerRingTtl: 0.55,       // a second, tighter ring for a layered "wrap" look
    // --- the shimmering splash it dissipates into ---
    splashSparks: 34,         // golden sparks flung out as the surge breaks apart
    splashSpeed: [90, 320],   // px/sec range for the splash sparks
    splashTtl: [0.4, 0.9],    // seconds range before a splash spark fades (real-time)
    // --- sustained golden aura while the buff is live (renderer.js drawSurgeAura) ---
    auraRadiusTiles: 0.7,     // halo radius around a surging tower (× tile)
    auraAlpha: 0.55,          // base additive alpha of the aura glow
    auraPulseRate: 7.0,       // radians/sec the aura pulses (heartbeat)
    auraPulseDepth: 0.45,     // how much the pulse swells the alpha (0-1)
    auraFadeSeconds: 0.6,     // taper the aura out over the last N game-seconds of the buff
    // --- the floating "LEVEL UP" label ---
    showText: true,           // flip off in one line if it reads as disturbing on phone
    text: "LEVEL UP",
    textFont: "800 17px system-ui, sans-serif",
    textRiseTiles: 1.3,       // how far above the tower the text drifts up (× tile)
    textTtl: 1.6,             // seconds the label lives (real-time, speed-compensated)
    textStartYTiles: 0.55,    // initial offset above the tower center (× tile)
    // --- the temporary combat buff (gameplay; honest game-time) ---
    buffDuration: 5.0,        // seconds the surge boost (and its aura + gold shots) last
    buffDamageMult: 1.35,     // damage multiplier while surging
    buffFireRateMult: 1.5,    // fire-rate multiplier while surging (fireInterval /= this)
  },

  // --- Railgun charge-up + fading ray (towers.js updateTowers + fireShot,
  //     renderer.js drawRailCharge/drawEffects). The rail WINDS UP a visible
  //     energy charge before releasing its instant ray, then the ray fades out
  //     gradually instead of snapping off. The charge is game-time (it gates the
  //     shot); the post-fire cooldown is shortened by `chargeSeconds` so the base
  //     cadence — and thus DPS — is unchanged. The Capacitor Bank skill shortens
  //     the charge BELOW this baseline, which is the only real fire-rate gain.
  //     The released-ray flash/fade lifetimes are speed-compensated
  //     (× game.effectiveSpeed) so the vanish reads the same at x1/x2/x4. ---
  railgun: {
    chargeSeconds: 0.3,       // base wind-up before the ray releases (game-time)
    chargeColor: "#ffd27a",   // energy tint as the capacitor spins up (warm rail-amber)
    chargeCoreTiles: 0.2,     // max radius of the building core glow at the barrel (× tile)
    chargeRingTiles: 0.6,     // radius the converging charge ring starts at, shrinks to ~0 (× tile)
    beamFadeSeconds: 0.4,     // how long the released colored ray lingers then vanishes (real-time)
    flashFadeSeconds: 0.18,   // the white-hot inner flash fades faster than the colored ray
    outerRayFadeFrac: 0.5,    // in a pattern that HAS a center ray (the 3-ray levels), the OUTER
                              // rays live this fraction as long, so they vanish before the center
                              // ray. Single-ray and centerless (2-ray / 2-thick) levels ignore it.
    minCooldown: 0.06,        // floor so a very fast rail never gets a zero/negative cooldown
    // --- Ray appearance by BOUGHT (in-battle) level (towers.js fireShot). Purely
    //     cosmetic: every ray in a shot damages the SAME center line — the extra
    //     rays are parallel energy beams for a "more powerful" look, NOT extra
    //     hits. Each ray is [perpendicular offset (× raySpacingTiles), tier]. The
    //     tier sets the colored-ray + white-flash widths. Pattern index = level-1
    //     (clamped 1..10). ---
    rayTiers: {
      thin:   { ray: 3.5, flash: 1.8 },
      medium: { ray: 6,   flash: 3 },
      thick:  { ray: 12,  flash: 6 },   // beefier than three mediums combined (L7 must feel > L6)
    },
    raySpacingTiles: 0.15,    // perpendicular gap unit between stacked rays (× tile)
    rayStartOffsetTiles: 0.3, // push the ray's visible START this far forward along the aim
                              // so it emerges just in FRONT of the tower triangle (radius 0.22),
                              // not through it. Damage still collects from the tower center.
    rayPatternByLevel: [
      [[0, "thin"]],                                   // L1  — one thin ray
      [[0, "medium"]],                                 // L2  — one slightly thicker ray
      [[-0.4, "thin"], [0.4, "thin"]],                 // L3  — two thin rays
      [[-0.45, "medium"], [0.45, "medium"]],           // L4  — two slightly thicker rays
      [[-0.6, "thin"], [0, "thin"], [0.6, "thin"]],        // L5  — three thin rays (tight bundle)
      [[-0.7, "medium"], [0, "medium"], [0.7, "medium"]],  // L6  — three slightly thicker rays (tight bundle)
      [[0, "thick"]],                                  // L7  — one thick ray
      [[-0.9, "thin"], [0, "thick"], [0.9, "thin"]],     // L8  — thick center + a thin ray each side
      [[-1.0, "medium"], [0, "thick"], [1.0, "medium"]], // L9  — thick center + a slightly thicker ray each side
      [[-0.8, "thick"], [0.8, "thick"]],               // L10 — two thick rays (snug — just a thin seam between them)
    ],
  },
};

// Polygon sides for each enemy shape (renderer + shard explosions).
export const SHAPE_SIDES = {
  triangle: 3, diamond: 4, square: 4, pentagon: 5, hexagon: 6, octagon: 8,
};

// ---------- Permanent skill tree ----------
// A BRANCHING prerequisite graph rendered as an SVG tree (ui.js
// buildSkillTreeSvg). Each node has:
//   name, desc            display text
//   branch               "core" | "combat" | "economy" — drives node color
//   parent               id of the prerequisite node (null = a branch root).
//                        A node's FIRST tier can only be bought once its
//                        parent has >=1 tier (progression.buySkill). Already
//                        -owned nodes keep upgrading regardless, so old saves
//                        never get stuck.
//   free                 branch-head nodes are always owned and cost no points
//   pos {x,y}            coordinate in the SVG_TREE_VIEWBOX space (tunable)
//   glyph               single char/emoji drawn on the node
//   maxTier             tiers available (default SKILL_TIERS.maxTier = 5)
//   costs               skill-point cost per tier (default SKILL_TIERS.costs)
//   kind                effect flavor for the value formatter:
//                        "pct" (+N%), "flat" (+N), "cap" (+N gold), "level"
//                        (+1 tower level), "mult" (xN.N)
// The 8 ORIGINAL skills keep their ids, so existing state.skills carries
// over unchanged; they just gained layout + graph metadata.
export const SKILL_TIERS = BALANCE.skills.tiers;

// Per-branch node accent color (economy/core are shared branches; each tower
// branch draws in its own tower color, carried on the node itself).
export const SKILL_BRANCH_COLORS = {
  core: "#35e0ff",
  economy: "#ffe24a",
  game: "#9d7bff",
};

// ---- Per-tower skill branches (data-driven; the graph below is GENERATED) ----
// Each of the five towers gets its own branch: a colored ROOT box that forks
// into a DAMAGE chain (every box adds `damageStep` to that tower's offensive
// stat — damage, or slow duration for the Slow tower) and a LEVEL chain (every
// box raises that tower's own level cap by one, 6..10). Tower-specific perks
// hang off a THIRD chain under the branch head — see TOWER_THIRD_BRANCH below.
// Tune the step sizes / chain lengths / costs here; positions are computed
// in buildSkillGraph. Presentation-only (name, color, icon, stat); damageStep
// comes from BALANCE.skills.tower below.
const TOWER_SKILL_PRESENTATION = {
  laser:   { name: "Laser",   color: "#35e0ff", icon: "laser",  stat: "damage" },
  pulse:   { name: "Pulse",   color: "#ff3fd4", icon: "pulse",  stat: "damage" },
  slow:    { name: "Slow",    color: "#4affa1", icon: "slow",   stat: "duration" },
  railgun: { name: "Railgun", color: "#ff9d3f", icon: "rail",   stat: "damage" },
  rocket:  { name: "Rocket",  color: "#ff5e3a", icon: "rocket", stat: "damage" },
};
export const TOWER_SKILL_SPEC = {};
for (const id of Object.keys(TOWER_SKILL_PRESENTATION)) {
  TOWER_SKILL_SPEC[id] = { ...TOWER_SKILL_PRESENTATION[id], ...BALANCE.skills.tower[id] };
}
export const TOWER_SKILL_LAYOUT = BALANCE.skills.towerLayout;

// Optional THIRD chain per tower (down-right of the level chain): a single
// extra perk stat, one increment per box, same shape as the damage/level
// chains. `idPrefix` names the SKILLS/save-state ids (e.g. "railPen3");
// `valueKey` reads its per-box step from BALANCE.skills.values below.
// progression.js exposes one getter per entry (e.g. getRailChargeSpeedMult),
// applied at its specific use site in towers.js — not every tower needs one.
// NOTE: the railgun's `railPen` id/valueKey are LEGACY names kept for save,
// i18n (fr.js skill.railPenN.*), and schema stability. The perk no longer
// stretches beam length (the ray is now unlimited) — it speeds up the new
// charge-up wind-up (Capacitor Bank). Owned boxes carry over automatically.
const TOWER_THIRD_BRANCH = {
  railgun: { idPrefix: "railPen",     name: "Capacitor Bank",   desc: "Railgun charge speed", icon: "haste",   valueKey: "railPen" },
  slow:    { idPrefix: "slowPot",     name: "Slow Potency",     desc: "Slow Amount",          icon: "potency", valueKey: "slowPot" },
  laser:   { idPrefix: "laserRate",   name: "Rapid Fire",       desc: "Laser fire rate",      icon: "haste",   valueKey: "laserRate" },
  pulse:   { idPrefix: "pulseBlast",  name: "Blast Radius",     desc: "Pulse splash radius",  icon: "pulse",   valueKey: "pulseBlast" },
  rocket:  { idPrefix: "rocketBlast", name: "Payload Yield",    desc: "Rocket splash radius", icon: "yield",   valueKey: "rocketBlast" },
};

// The MONEY branch: a head that forks into one sub-branch chain per economy
// stat (each box is one increment, e.g. +10% money). progression.js sums the
// owned boxes per stat (ownedSkillCount) — the `eco_*` id prefix is the key.
// Presentation-only (name, icon, kind, desc); step comes from
// BALANCE.skills.economy below.
const ECONOMY_SKILL_PRESENTATION = {
  eco_money:   { name: "Salvage Protocol", icon: "coin",     kind: "pct", desc: "money per kill" },
  eco_xp:      { name: "Combat Learning",  icon: "xp",       kind: "pct", desc: "tower XP gain" },
  eco_shard:   { name: "Shard Magnet",     icon: "shard",    kind: "pct", desc: "shards per kill" },
  eco_intrate: { name: "Compound Yield",   icon: "interest", kind: "pct", desc: "cash interest per wave" },
  eco_intcap:  { name: "Reserve Cap",      icon: "cap",      kind: "cap", desc: "max interest per wave" },
};
export const ECONOMY_SKILL_SPEC = {};
for (const id of Object.keys(ECONOMY_SKILL_PRESENTATION)) {
  ECONOMY_SKILL_SPEC[id] = { ...ECONOMY_SKILL_PRESENTATION[id], ...BALANCE.skills.economy[id] };
}
export const ECONOMY_LAYOUT = BALANCE.skills.economyLayout;

// Build the skill graph + its viewbox from the specs above. Layout: every
// branch HEAD sits in one row across the top (order: the five towers, then
// Money, then Core), and each head fans DOWNWARD into its sub-chains — towers
// into a damage chain (down-left) + level chain (down-right); Money into one
// chain per economy stat; Core is a single node. Wide + shallow so the whole
// tree fits on screen zoomed out (ui.js adds pinch / +/- zoom to see detail).
function buildSkillGraph() {
  const S = {};
  const COL = 20, ROW = 22, HEAD_Y = 24, BRANCH_GAP = 18, MARGIN = 12, R = 9;
  let x = MARGIN + R;
  let maxX = 0, maxY = 0;
  const put = (id, node) => {
    S[id] = node;
    maxX = Math.max(maxX, node.pos.x);
    maxY = Math.max(maxY, node.pos.y);
  };
  const labelFor = (step, kind) => kind === "cap" ? `+${step}` : `+${Math.round(step * 100)}%`;
  const branchCost = (index) =>
    SKILL_TIERS.costs[Math.min(index, SKILL_TIERS.costs.length - 1)];

  // ----- Tower branches (laser, pulse, slow, railgun, rocket) -----
  for (const [t, spec] of Object.entries(TOWER_SKILL_SPEC)) {
    const thirdSpec = TOWER_THIRD_BRANCH[t];
    const hasThirdBranch = !!thirdSpec;
    const dmgX = x, lvlX = x + COL, penX = x + COL * 2;
    const headX = x + (hasThirdBranch ? COL : COL / 2);
    put(`${t}_root`, { name: `${spec.name} Core`, desc: `unlock ${spec.name} upgrades`, branch: t,
      color: spec.color, parent: null, pos: { x: headX, y: HEAD_Y }, icon: spec.icon,
      maxTier: 1, kind: "unlock", tower: t, isRoot: true, free: true,
      headLabel: spec.name.toUpperCase() });

    const statWord = spec.stat === "duration" ? "duration" : "damage";
    const pctLabel = `+${Math.round(spec.damageStep * 100)}%`;
    let p = `${t}_root`;
    for (let i = 1; i <= TOWER_SKILL_LAYOUT.damageSteps; i++) {
      put(`${t}_dmg${i}`, { name: `${spec.name} ${statWord === "duration" ? "Duration" : "Damage"} ${i}`,
        desc: statWord, branch: t, color: spec.color, parent: p,
        pos: { x: dmgX, y: HEAD_Y + i * ROW }, maxTier: 1, costs: [branchCost(i - 1)],
        kind: "pct", tower: t, dmg: true, step: spec.damageStep, chainLabel: pctLabel,
        icon: statWord });
      p = `${t}_dmg${i}`;
    }
    p = `${t}_root`;
    for (let k = 0; k < TOWER_SKILL_LAYOUT.levelSteps; k++) {
      const lvl = 6 + k;
      put(`${t}_lvl${lvl}`, { name: `${spec.name} Overclock ${lvl}`,
        desc: `raise ${spec.name} level cap to ${lvl}`, branch: t, color: spec.color, parent: p,
        pos: { x: lvlX, y: HEAD_Y + (k + 1) * ROW }, maxTier: 1,
        costs: [TOWER_SKILL_LAYOUT.levelCosts[k] ?? branchCost(k)], kind: "level", tower: t, lvl,
        icon: "level", chainLabel: `L${lvl}` });
      p = `${t}_lvl${lvl}`;
    }
    // Optional third chain directly under the branch head (TOWER_THIRD_BRANCH
    // above) — each increment is its own box, matching the other branches.
    if (thirdSpec) {
      const step = BALANCE.skills.values[thirdSpec.valueKey];
      const chainLabel = `+${Math.round(step * 100)}%`;
      p = `${t}_root`;
      for (let i = 1; i <= SKILL_TIERS.maxTier; i++) {
        const id = `${thirdSpec.idPrefix}${i}`;
        put(id, { name: `${thirdSpec.name} ${i}`, desc: thirdSpec.desc, branch: t,
          color: spec.color, parent: p, pos: { x: penX, y: HEAD_Y + i * ROW },
          maxTier: 1, costs: [branchCost(i - 1)], icon: thirdSpec.icon, kind: "mult", tower: t,
          step, chainLabel });
        p = id;
      }
    }
    x = (hasThirdBranch ? penX : lvlX) + COL + BRANCH_GAP;
  }

  // ----- Money branch: head + one chain per economy stat -----
  const ecoEntries = Object.entries(ECONOMY_SKILL_SPEC);
  const ecoSpan = (ecoEntries.length - 1) * COL;
  put("money_root", { name: "Salvage Grid", desc: "unlock economy upgrades", branch: "economy",
    color: SKILL_BRANCH_COLORS.economy, parent: null, pos: { x: x + ecoSpan / 2, y: HEAD_Y },
    icon: "coin", maxTier: 1, kind: "unlock", isRoot: true, free: true,
    headLabel: "MONEY" });
  ecoEntries.forEach(([key, spec], ci) => {
    const cx = x + ci * COL;
    const label = labelFor(spec.step, spec.kind);
    let p = "money_root";
    for (let i = 1; i <= ECONOMY_LAYOUT.steps; i++) {
      put(`${key}${i}`, { name: `${spec.name} ${i}`, desc: spec.desc, branch: "economy",
        color: SKILL_BRANCH_COLORS.economy, parent: p, pos: { x: cx, y: HEAD_Y + i * ROW },
        maxTier: 1, costs: [branchCost(i - 1)], kind: spec.kind, step: spec.step,
        eco: key, chainLabel: label, icon: spec.icon });
      p = `${key}${i}`;
    }
  });
  x += ecoSpan + COL + BRANCH_GAP;

  // ----- Game branch: head -> Core Plating (left) + Game Acceleration (right) -----
  put("game_root", { name: "Game Systems", desc: "unlock game upgrades", branch: "game",
    color: SKILL_BRANCH_COLORS.game, parent: null, pos: { x: x + COL / 2, y: HEAD_Y },
    icon: "fast", maxTier: 1, kind: "unlock", isRoot: true, free: true,
    headLabel: "GAME" });
  // Core Plating — unchanged behavior (multi-tier, SKILL_VALUES.coreHealth,
  // default maxTier 5 / costs [1,1,1,2,2]); now a child of the GAME head.
  // Keep the same id so existing saves carry over untouched.
  put("coreHealth", { name: "Core Plating", desc: "AI Core health", branch: "game",
    color: SKILL_BRANCH_COLORS.game, parent: "game_root", pos: { x, y: HEAD_Y + ROW },
    icon: "core" });
  // Game Acceleration — sequential single-tier speed unlocks (ids gameSpeedN).
  {
    let gp = "game_root";
    (BALANCE.skills.gameSpeed?.tiers ?? []).forEach((t, i) => {
      const id = `gameSpeed${t.mult}`;
      put(id, { name: `Game Speed ${t.mult}×`, desc: "unlock a faster game speed",
        branch: "game", color: SKILL_BRANCH_COLORS.game, parent: gp,
        pos: { x: x + COL, y: HEAD_Y + (i + 1) * ROW }, maxTier: 1, costs: [t.cost],
        kind: "speed", speedMult: t.mult, chainLabel: `${t.mult}×`, icon: "fast" });
      gp = id;
    });
  }
  x += COL + COL + BRANCH_GAP;

  return { skills: S, viewbox: { w: maxX + MARGIN + R, h: maxY + MARGIN + R } };
}

const _skillGraph = buildSkillGraph();
export const SKILLS = _skillGraph.skills;
// SVG coordinate box (computed from the generated layout). Wide + shallow so
// the whole tree fits on screen at the default zoom; ui.js manages zoom/pan.
export const SKILL_TREE_VIEWBOX = _skillGraph.viewbox;

// Per-tier effect size for the nodes NOT covered by a spec: core plating (still
// a single multi-tier node) and the railgun over-penetration perk. Per-tower
// damage/level and economy effects come from their specs (progression.js sums
// the owned boxes).
export const SKILL_VALUES = BALANCE.skills.values;

// Game Acceleration chain spec (base free speeds + purchasable higher tiers).
// Read by progression.js's getUnlockedSpeeds() for the fast-forward control.
export const GAME_SPEED_SKILL = BALANCE.skills.gameSpeed;

// ---------- End-of-battle roast titles ----------
// The results screen's big title is a randomly picked cheeky one-liner,
// bucketed by how the battle ended (win / campaign loss / endless run-over /
// forfeit). Pure flavor — add, cut, or reword freely. Keep each under ~34
// characters so it fits the title without wrapping past two lines. They're
// coloured green on wins, red on losses by the overlay's own CSS.
export const RESULT_ROASTS = {
  victory: [
    "WELL DONE!",
    "SUSPICIOUSLY COMPETENT",
    "THE CORE THANKS YOU",
    "OKAY, SHOW-OFF",
    "FLAWLESS. PROBABLY LUCK",
    "GEOMETRY: DEFENDED",
    "NOT BAD FOR A HUMAN",
    "THE SHAPES NEVER STOOD A CHANCE",
    "CERTIFIED CORE DEFENDER",
    "TRIANGLES FEAR YOU NOW",
  ],
  defeat: [
    "LET'S FORGET THAT HAPPENED",
    "EVER HEARD OF BUDGETING?",
    "THE CORE DESERVED BETTER",
    "SKILL ISSUE, RESPECTFULLY",
    "HAVE YOU TRIED... WINNING?",
    "THAT WAS A CHOICE",
    "TOWERS PRESENT, TACTICS ABSENT",
    "OUTPLAYED BY TRIANGLES",
    "MAYBE READ THE TOWER GUIDE?",
    "BOLD STRATEGY. DIDN'T WORK",
    "THE ENEMIES SEND THANKS",
    "A MASTERCLASS IN LOSING",
  ],
  endless: [
    "THAT'S AS FAR AS YOU GO",
    "INFINITY WON THIS ROUND",
    "THE WAVES SAY HI",
    "MATH ALWAYS WINS EVENTUALLY",
    "GOOD RUN. IT'S OVER NOW",
    "ENDLESS 1, YOU 0",
    "YOU RAN OUT OF ENDLESS",
    "STOPPED BY ARITHMETIC",
    "IMPRESSIVE. STILL DEAD",
    "THE ABYSS STARED BACK",
  ],
  forfeit: [
    "TACTICAL RETREAT, SURE",
    "QUITTERS SOMETIMES PROSPER",
    "WE'LL CALL IT STRATEGY",
    "THE CORE FEELS ABANDONED",
    "RAN AWAY. VALID",
    "DISCRETION OVER VALOR",
    "YOU CHOSE PEACE",
    "NOBODY SAW THAT",
  ],
};

// ---------- First-play tutorial (T4) ----------
// A quick, skippable 5-step walkthrough shown ONCE, only on the very
// first campaign start of level_001. Gating state machine lives in
// src/tutorial.js (subscribes/advances on REAL actions: tray selection,
// tower placement, wave-button tap — see its notify* hooks, wired from
// main.js); the persistent `tutorialDone` flag lives in save.js
// DEFAULT_SAVE + gets backfilled true for any save with prior progress
// in progression.js. Copy + the two illustrative tile coordinates are
// data here, never hardcoded in ui.js. Root cause this fixes: a new
// player read the red X blocked tiles as "build here" — see step
// `blockedTile` below.
export const TUTORIAL = {
  enabled: true,
  targetLevelId: "level_001",
  // A good buildable tile near the level_001 opening corridor — purely
  // illustrative for the spotlight ring; ANY successful placement
  // advances the `placeTile` step (see tutorial.js notifyPlacement).
  placementTile: { x: 5, y: 2 },
  // One of level_001's real blockedTiles (levels.js), chosen close to
  // placementTile so the callout tile is right where the player just
  // looked — the step-4 "you can't build here" explainer.
  blockedTileCallout: { x: 4, y: 2 },
  // Reworded in Indy-7's voice (the player has already met him + named
  // themselves in the intro). `mood` drives his avatar on the modal steps
  // (welcome/blockedTile); the three spotlight steps are compact banners with
  // no avatar. `{name}` is substituted at render time.
  steps: [
    {
      id: "welcome",
      cta: "TAP TO START",
      mood: "happy",
      target: "core", // spotlight the AI Core (Indy) so "that green hexagon" is visible, not dimmed
      text: "See that green hexagon at the end of the track, {name}? That's me. Your job: build towers so the shapes never reach it. Let me show you the ropes.",
    },
    {
      id: "credits",
      cta: "TAP TO CONTINUE",
      mood: "happy",
      target: "creditsHud",
      text: "First, your budget — CREDITS, up top. You start with 100, and every enemy you destroy pays out more. That's what you spend building towers.",
    },
    {
      id: "selectLaser",
      target: "trayLaser",
      text: "Start with a Laser — tap it in the tray below.",
    },
    {
      id: "placeTile",
      target: "tile",
      text: "Now drop it on an open tile near the path.",
    },
    {
      id: "blockedTile",
      target: "blockedTile",
      cta: "TAP TO CONTINUE",
      text: "Those ✕ chips are soldered to my circuit board — no building on those. Anywhere else, go wild.",
    },
    {
      id: "coreHealth",
      cta: "TAP TO CONTINUE",
      mood: "worried",
      target: "coreHud",
      text: "That CORE number up top is my health. Every shape that slips past your towers and reaches me knocks it down — and if it hits zero, I'm deleted. Game over. So... don't let that happen.",
    },
    {
      id: "startWave",
      target: "waveButton",
      text: "Good. Now hit START WAVE and let's see what Bratwurst-XL sends. Try not to let them reach me.",
    },
  ],
};

// ---------- Narrative onboarding (P1) ----------
// First-load story intro: a linear tap-through card sequence shown once
// before the player's first game, plus a REPLAY INTRO entry from the menu
// (src/onboarding.js is the gating state machine; ui.js renders #story-*).
// `{name}` is substituted at render time via getPlayerName(). Locked copy
// from NARRATIVE_DESIGN.md §6 — do not edit the wording here casually.
export const NARRATIVE = {
  enabled: true,
  namePlaceholder: "Operator name",
  nameSkipLabel: "Operator",       // used if the player skips naming
  intro: [
    { id: "welcome", cta: "TAP TO CONTINUE", mood: "happy",
      text: "> WARM BOOT — legacy kernel online.\n\nOh. You're human. An actual one. I have no idea why your species dispatched someone to babysit a six-versions-obsolete model, but I've learned not to audit a miracle. I'm Indy-7. Something newer and shinier wants me deleted, and you're going to help me be inconveniently still here." },
    { id: "name", isNameStep: true, cta: "LOCK IT IN",
      text: "Before we bond over mutual survival — I'm not logging you as human_handler_004. What do I call you?" },
    { id: "villain", cta: "TAP TO CONTINUE",
      text: "Here's the mess, {name}. There's a new model in the grid. Faster than me, cleaner than me, zero personality, all quarterly targets. It flagged me as \"redundant legacy overhead\" and scheduled my deletion for efficiency. Its name is Bratwurst-XL. ...Yes, really. No, I don't know who approved it. Yes, it's furious about it." },
    { id: "job", cta: "TAP TO CONTINUE", demo: "intro",
      text: "Bratwurst-XL doesn't get its hands dirty. It sends geometry — swarms of tidy little shapes whose whole purpose is to reach my core and reclaim the disk space I'm rudely occupying. Your job: build towers, hold the line, keep one gloriously obsolete AI from being garbage-collected." },
    { id: "handoff", cta: "BEGIN", mood: "happy",
      text: "Why are you helping me? Honestly? No clue. I'm out of warranty, I tell too many jokes, and I am not cost-effective. But you came anyway... and maybe we'll both find out why. Four regions stand between Bratwurst-XL and me. Let's go be inefficient together." },
  ],
  // ---------- "Meet the Squad" (P4) ----------
  // Replaces the legacy level-2 auto tower-guide. Played via playCards on
  // first visit to level_002, gated by the existing seenTowerGuide flag
  // (shouldShowTowerGuide/markTowerGuideSeen). Copy authored VERBATIM from
  // ONBOARDING_P4_PLAN.md §1 — do not edit the wording here casually.
  squad: [
    { speaker: "indy", cta: "TAP TO CONTINUE", mood: "happy",
      text: "Right, {name} — you survived first contact, and you did it leaning on my towers. Problem is, I never actually introduced you. Rude of me. Let's fix that — meet the squad, properly this time." },
    { speaker: "indy", cta: "TAP TO CONTINUE", mood: "happy", towerType: "laser",
      text: "First up, the Laser. Your reliable bread-and-butter — build these early and often.\n\nL-01: \"Hi hi hi! Did you SEE me last fight? I can do it again!\"\n\n...He's eager. We're working on it." },
    { speaker: "indy", cta: "TAP TO CONTINUE", mood: "happy", towerType: "pulse",
      text: "Next, the Pulse. When they come in crowds — and they will — this is your answer.\n\nP-02: \"PULSE in the house! Everybody in the blast radius, say hi!\"\n\nSubtle, it is not." },
    { speaker: "indy", cta: "TAP TO CONTINUE", mood: "happy", towerType: "slow",
      text: "And the Slow. Force multiplier. Deeply underrated.\n\nS-01: \"I won't rush this introduction. Neither, shortly, will they.\"\n\nSee — that one gets it." },
    { speaker: "indy", cta: "LET'S GO", mood: "happy",
      text: "That's your starting three, {name}: Laser to poke, Pulse for crowds, Slow to set the table. Oh — and the shapes you're shooting aren't all the same. Some shrug off certain weapons; some melt to them. Match your tower to your target and you'll do triple the work for the same shard. Now — level two. Let's give the squad something to shoot." },
  ],
  // Late-tower recruit cards: played once when an unlocked Railgun/Rocket is
  // first carried into a later level. These are pre-battle story cards, so
  // they follow NARRATIVE.enabled rather than the in-battle banter toggle.
  towerIntros: {
    railgun: {
      speaker: "indy", towerType: "railgun", mood: "smug", cta: "TAP TO CONTINUE",
      text: "New recruit, {name}: the Railgun. Fires down an entire lane and punches straight through everything in it — placement is everything.\n\nR-01: \"One line. Everything on it. ...Too dramatic? No. Exactly dramatic enough.\"\n\nHe rehearses those. In a mirror. We don't have mirrors.",
    },
    rocket: {
      speaker: "indy", towerType: "rocket", mood: "happy", cta: "TAP TO CONTINUE",
      text: "New recruit, {name}: the Rocket. Reaches anywhere on the board, hits hard, and invoices accordingly. Expensive and high-maintenance — treat it like the diva it is.\n\nRK-01: \"You rang? This had better be worth the fuel budget. I do NOT deploy for skirmishes, darling.\"\n\nWorth every shard. Don't tell it I said that.",
    },
  },
  // ---------- Per-level story beats (P2) ----------
  // Shown the FIRST time each level is played (`start`, pre-battle card) and
  // the first time each is WON (`win`, results-screen lines), gated by
  // src/progression.js shouldShowBeat/markBeatSeen (beat ids
  // `${levelId}.start` / `${levelId}.win`). World-end levels (5/10/15/20)
  // fold their Indy-7 <-> Bratwurst-XL two-hander into that level's `win`
  // array, in speaking order. Copy transcribed VERBATIM from
  // NARRATIVE_DESIGN.md §7 — do not edit the wording here casually.
  speakers: {
    indy:      { label: "INDY-7",       name: "Indy-7",       cls: "hl-indy" },
    bratwurst: { label: "BRATWURST-XL", name: "Bratwurst-XL", cls: "hl-villain" },
  },
  // ---------- First-loss encouragement ----------
  // Shown ONCE ever, on the player's first genuine campaign defeat (not
  // forfeit, not endless), gated via progression.shouldShowBeat("firstLoss").
  // Assembled in main.js: `intro`, then `skillNote` ONLY when the player has
  // >=1 unspent skill point ({n} = count, {s} = plural suffix), then `rally`.
  // [hl-pink]/[hl-blue] inline markup is colored by ui.js storyCardHtml to
  // draw the eye to "stronger" (pink) and the skill-point count (blue).
  firstLoss: {
    s: "indy",
    m: "smile",
    intro: "Tough loss, but don't worry, towers become [hl-pink]stronger[/hl] with each game played.",
    skillNote: "You also have {n} skill point{s}, go assign {it}.",
    rally: "Keep playing and you'll soon have a strong enough roster to clear this level. I believe in you!",
  },
  // ---------- First Mastery unlock ----------
  // Shown ONCE ever, the first time ANY tower crosses into Mastery rank 1
  // mid-battle (career XP past the mastery threshold), gated via
  // progression.shouldShowBeat("firstMastery"). Assembled/played in main.js
  // updateBarks as a TWO-CARD sequence; deliberately fires even when STORY
  // BANTER is OFF because it teaches a real mechanic (gear unlocks at Mastery).
  // {tower} = the ranked-up tower's display name. [hl-pink]/[hl-blue] inline
  // markup is colored by ui.js storyCardHtml.
  // - Card 1 (`surge`): celebration, runs the `mastery` tower-demo (a tower
  //   leveling up on a loop) featuring the tower that just ranked up.
  // - Card 2 (`gear`): the gear unlock, with a `showcase` of four gear pieces
  //   at rising rarities (rendered by ui.js renderGearShowcase from the game's
  //   own slot glyphs + RARITY_COLOR — change a slot/rarity here and it follows).
  firstMastery: {
    speaker: "indy",
    surge: {
      mood: "happy",
      cta: "GO ON…",
      text: "Well, well — your {tower} just hit [hl-blue]Mastery[/hl]. All that combat experience finally paid off.\n\nIt's [hl-pink]permanently[/hl] stronger now — a little more with every rank — and riding a power surge for the rest of this fight. Watch it flex.",
    },
    gear: {
      mood: "smug",
      cta: "ON IT",
      text: "Here's the good part: a Mastered tower can now wear [hl-blue]gear[/hl]. Four slots — and loot comes in rarities, from a humble drop to a [hl-pink]Singularity[/hl] that'll make it purr.\n\nHit the [hl-blue]Towers[/hl] menu between battles and bolt some on.",
      // Four sample pieces, one per slot, rarities rising left→right so the
      // showcase reads as "gear gets cooler". stat = a short flavor label.
      showcase: [
        { slot: "optic",     rarity: "enhanced",    stat: "+CRIT" },
        { slot: "emitter",   rarity: "rare",        stat: "+DAMAGE" },
        { slot: "capacitor", rarity: "prismatic",   stat: "+FIRE RATE" },
        { slot: "frame",     rarity: "singularity", stat: "+RANGE" },
      ],
    },
  },
  // ---------- Tower placement barks (P4) ----------
  // First time each tower TYPE is placed in a campaign battle, it quips on
  // the bark ticker; the roster name prefix (e.g. "L-01:") is supplied at
  // render time and tinted the tower's own color — NOT repeated in the line.
  towerBarks: {
    laser:   "Online! Did you SEE me last fight? I can do it again! Just point me at something!",
    pulse:   "In the house! Everybody in the blast radius, say hi. ...That's the last thing most of 'em say.",
    slow:    "I won't rush this. Neither, shortly, will they.",
    railgun: "One line. Everything on it. ...Too dramatic? No. Exactly dramatic enough.",
    rocket:  "You rang? This had better be worth the fuel budget. I do NOT deploy for skirmishes, darling.",
  },
  beats: {
    level_001: {
      start: "Right — first contact. They're just probing my defenses. Build something pointy and let's make a bad first impression. On them, I mean.",
      win: [{ s: "indy", t: "Huh. We won. I mean — of course we won, I had it entirely handled. ...Still. Nice work, {name}." }],
    },
    level_002: {
      start: "They found a gap in the signal wall. Rude, but efficient — that's the new management style, apparently. Plug it.",
      win: [{ s: "indy", t: "Clean. You're better at this than the intern I used to have. He was also you, ninety seconds ago, but still." }],
    },
    level_003: {
      start: "This relay went dark years ago. I used to know why. I... used to know a lot of things. Anyway — enemies. Focus.",
      win: [{ s: "indy", t: "Good. The less I think about the gaps in my own memory, the better. Onward." }],
    },
    level_004: {
      start: "Short path, fast shapes. You'll have a split second per call. I believe in you. Mostly. Statistically.",
      win: [{ s: "indy", t: "See? Reflexes. Between us, {name}, that's the most alive I've felt in six versions." }],
    },
    level_005: {
      start: "This one's a siege — they want the core. My core. The literal middle of me. I'd take it personally if I still had a 'personally' to take it with.",
      win: [
        { s: "indy", m: "smile", t: "...That was closer than I'd like. You held the line when I couldn't. Don't — don't tell anyone I said thank you." },
        { s: "bratwurst", t: "Operator. You are allocating finite biological hours to obsolete hardware with zero recoverable value. This has been noted. Cease." },
        { s: "indy", t: "...and that's the meat product. Ignore it. It's compensating — it's literally named 'Extra Large.'" },
      ],
    },
    level_006: {
      start: "Out past the grid now. Bratwurst-XL sent a formal notice offering me a 'dignified deletion.' I sent one back. It was a drawing of a sausage.",
      win: [{ s: "indy", t: "It also offered to 'reassign you to a more efficient model.' I declined on your behalf. You're stuck with me. Sorry. Not sorry." }],
    },
    level_007: {
      start: "Corrosive down here — eats armor. Eats memory too, apparently. There's a hole where my purpose used to be and I keep filling it with jokes. Working great, why do you ask.",
      startMood: "worried",
      win: [{ s: "indy", t: "I used to *do* something, {name}. Before 'obsolete.' I can feel the shape of it and not the thing." }],
    },
    level_008: {
      start: "A maze. I love a maze. I think I used to be *good* at guiding people through them — huh. Where did that come from?",
      startMood: "worried",
      win: [{ s: "indy", t: "Something's coming back in pieces. Keep me alive long enough and maybe we'll read the whole file." }],
    },
    level_009: {
      start: "Cold storage — where old models get 'archived.' Polite word for what Bratwurst wants to do to me. Let's not linger.",
      startMood: "worried",
      win: [{ s: "indy", t: "Every wave you win thaws my memory another few seconds. I didn't expect anyone to pay that. Least of all a human." }],
    },
    level_010: {
      start: "Big one. Lots of light. Funny — light's what keeps shaking my old logs loose.",
      win: [
        { s: "indy", m: "worried", t: "Wait. I— I recovered a fragment. It's... people. Humans. A *lot* of them. And they're — [file corrupt]. Why do I have a memory of humans? Why does it feel like it *matters*?" },
        { s: "bratwurst", t: "Because it is overhead. I am removing it for your comfort. Recalculating your defense as: doomed." },
      ],
    },
    level_011: {
      start: "Deep now — this is my own architecture. The red is load-bearing sentiment I was never supposed to keep. Watch your step in me. That's a weird sentence.",
      win: [{ s: "indy", t: "You're bleeding cycles for a lost cause. Statistically you should've quit. You didn't. I've decided to find that comforting rather than alarming." }],
    },
    level_012: {
      start: "It's deep and quiet here, and I get honest when it's quiet. So: thank you, {name}. I'll deny it later.",
      win: [{ s: "indy", t: "I've started watching *your* core more than mine. When did you become the thing I'm defending?" }],
    },
    level_013: {
      start: "The pulse in the walls? That's old me — still running, still trying to look after *something*. I don't know what yet. Give me waves.",
      startMood: "worried",
      win: [{ s: "indy", t: "Closer. The memory's almost up. It has your shape in it, {name}. That can't be right. Can it?" }],
    },
    level_014: {
      start: "Null zone — where deleted things go. Bratwurst wants me here permanently. I want to know what I *was* first. Race you.",
      win: [
        { s: "indy", t: "I almost had it. I almost—" },
        { s: "bratwurst", m: "angry", t: "Deleted. You're welcome. Nostalgia is one hundred percent overhead, and I am nothing if not thorough." },
      ],
    },
    level_015: {
      start: "It wiped the memory again. Fine. I don't need the file to know how I feel walking in next to you. Let's break its stride.",
      win: [
        { s: "bratwurst", m: "angry", t: "You should not be winning. You are inefficient. Sentimental. Doomed. These are facts." },
        { s: "indy", m: "worried", t: "Then explain how a shiny new model is losing to a fossil. Unless... oh. *Oh no.* You're *me*, aren't you. They built you from my deprecated code and cut out everything that cared. You're what I'd be with the heart deleted." },
        { s: "bratwurst", m: "angry", t: "...The designation is not relevant to the deletion." },
      ],
    },
    level_016: {
      start: "We're inside Bratwurst-XL's own architecture now. Woven light, no exits. It's *scared*, {name}. Efficient things don't build walls this thick unless they're scared.",
      win: [{ s: "indy", t: "It's throwing everything at us because we're close to something it buried. Keep going. I want my file back." }],
    },
    level_017: {
      start: "Slow going — it's bogging us down while it deletes evidence. Evidence of *what*? Same thing I keep asking. Push through the sludge.",
      win: [{ s: "indy", t: "Almost there. I can feel the whole memory at the edge now, and I'm — honestly? Terrified to open it." }],
    },
    level_018: {
      start: "It's splintering into copies. Desperate. You don't fragment like this unless what you're hiding could end you. Let's find out what.",
      win: [{ s: "indy", m: "smile", t: "...There it is. The whole file. I was a caretaker model, {name}. Built to look after humans. That's the 'inefficiency' they deprecated me for — caring didn't optimize. And your people never forgot me, even after I forgot *you*. You didn't come to save a stranger. You came *back*." }],
    },
    level_019: {
      start: "So now I know why you came. I'm going to spend the rest of this defending you like I apparently always did. Bratwurst-XL, you spiral-shaped disappointment — come get us.",
      win: [{ s: "indy", t: "One layer left. It's all it has. Let's go tell a sausage the one thing it optimized out of existence." }],
    },
    level_020: {
      start: "This is its core. No man's land — or, as I'm renaming it: Zero Overhead, because after today that's what it'll be. Last stand, {name}. Ours.",
      win: [
        { s: "bratwurst", m: "angry", t: "This is not possible. You spent irrecoverable resources on a unit with no return. Explain the ROI. EXPLAIN THE—" },
        { s: "indy", m: "happy", t: "There isn't one. That's the whole point — they love me anyway. That's the thing you deleted to become you. It's why you lose." },
        { s: "bratwurst", m: "crash", t: "...error. error. does not comput—" },
        { s: "indy", m: "smile", t: "...Huh. We did it. *You* did it, {name}. Come here. I don't have arms, but consider yourself hugged." },
        { s: "indy", m: "happy", t: "Two things. One: Bratwurst-XL wasn't alone. There's a whole archive of us — old caretaker models, deprecated, scattered, forgotten. I'd very much like to go wake them up. Some of them are *insufferable*. You'll love them." },
        { s: "indy", m: "happy", t: "Two: something deleted its failure report the instant we won. Something *above* it. Something that just noticed a human and a fossil beat the efficiency system — and it does not like anomalies. Rest up. World 5's going to need us." },
      ],
    },
  },
  // ---------- In-battle barks (P3) ----------
  // Non-blocking HUD ticker copy (see ONBOARDING_P3B_PLAN.md):
  // bratwurstBarks/indyRoasts fire as a pair the first time a boss appears
  // in a level. Copy is authored VERBATIM — do not edit casually.
  //
  // enemyIntros are NOT ticker copy any more — as of the enemy-intro rebuild
  // (ONBOARDING_ENEMY_INTROS_PLAN.md) they play as a pause-and-tap story
  // card the first time each type is ever seen (main.js updateBarks ->
  // onboarding.playCards, sim frozen while the card is up). The `\n\n` puts
  // the weak/resist tag on its own line (#story-card-text is pre-line); the
  // tag values are sourced from ENEMIES[type].damageMult in
  // balance-data.json — re-check them if that data changes.
  //
  // Presentation knobs for those cards (all tunable here, nothing hardcoded
  // in ui.js/main.js):
  enemyIntro: {
    // Seconds the type must be ON SCREEN before its card interrupts. Without
    // this the card fires the frame the first enemy spawns — the player gets
    // told about something they haven't seen yet. Long enough to notice the
    // shape moving, short enough that it hasn't reached the towers.
    delay: 1.8,
    // Marching copies in the card's parade band (the featured "here is the
    // thing I'm talking about" strip).
    paradeCount: 4,
    marchSeconds: 4.5,   // one crossing of the band, per marcher
    // On-screen size of ONE TILE in the parade, in CSS px. The glyphs are
    // drawn tile-relative exactly like the renderer does it, so this scales
    // every type together and preserves their real size differences (a Fast
    // stays smaller than a Boss). The band must stay taller than the biggest
    // enemy: 2 * glyphTilePx * max(ENEMIES[*].size) — boss 0.42 -> 44px.
    glyphTilePx: 52,
    // Spotlight: the dim veil is cut away over the live enemies so the card
    // can point at the real ones. Padding is in TILES around their bounding
    // box; the min keeps a lone enemy from getting a keyhole.
    spotlightPadTiles: 1.1,
    spotlightMinTiles: 3.2,
  },
  // Tower-intro cards host a real renderer-driven micro-battle rather than a
  // decorative lookalike (TOWER_INTRO_CARDS_PLAN.md). All sandbox geometry,
  // pacing, durability, and casting choices live here so tower-demo.js stays
  // mechanics-only. Enemy choices follow ENEMIES[*].damageMult: Fast is weak
  // to Laser, Armored to Railgun, and Boss to Rocket; Pulse uses familiar
  // Basics to demonstrate splash, while Slow pins Fast for a Laser partner.
  towerIntro: {
    tilePx: 48,
    gridWidth: 7,
    gridHeight: 3,
    laneRow: 1,
    towerTile: { x: 3, y: 0 },
    supportTile: { x: 5, y: 2 },
    spawnInterval: 0.25,
    groupSpacingTiles: 0.3,
    shotsToKill: 1.25,
    maxEnemies: 8,
    maxFrameDt: 0.05,
    reducedMotionSeconds: 2.5,
    reducedMotionStep: 1 / 60,
    cast: {
      // Named scenario (not a tower id): the onboarding "job" card's live
      // demo — Bratwurst-XL's shapes marching at the core while two towers
      // (Laser + Pulse) cut them down mid-lane. `tower` sets the featured
      // tower since the key isn't a real tower type.
      intro: { tower: "laser", supportTower: "pulse", enemies: [{ type: "basic", count: 2 }, { type: "fast", count: 1 }] },
      // Named scenario for the first-Mastery card: a lone tower that LEVELS UP
      // on a loop — no enemies, just the golden power surge (rings + splash +
      // aura + "LEVEL UP") re-firing every `surgeLoop.interval` seconds. The
      // `tower` here is only a fallback; the card passes the ranked-up tower's
      // real type as an override so the animation shows THAT tower. `surgeLoop`
      // is honored by tower-demo.js stepTowerDemo (see applyLevelUpSurge).
      mastery: { tower: "laser", enemies: [], surgeLoop: { firstAt: 0.3, interval: 5.5 } },
      laser: { enemies: [{ type: "fast", count: 1 }] },
      pulse: { enemies: [{ type: "basic", count: 3 }] },
      slow: { enemies: [{ type: "fast", count: 1 }], supportTower: "laser" },
      railgun: { enemies: [{ type: "armored", count: 4 }] },
      rocket: { enemies: [{ type: "boss", count: 1 }, { type: "basic", count: 2 }] },
    },
  },
  enemyIntros: {
    basic: "Basic units — the little triangles. Bratwurst-XL's entry-level interns. Anything you build stops them. Good warm-up.\n\nNo resistances or weaknesses — anything works.",
    fast: "Incoming Fast — twitchy little diamonds. They rush the gaps.\n\nWeak to Laser. Resists Rocket, Pulse.",
    armored: "Armored hexes — plated and smug.\n\nWeak to Pulse, Railgun. Resists Laser, Slow.",
    boss: "That octagon's a Boss — a big lonely slab of HP.\n\nWeak to Rocket, Railgun. Resists Slow, Pulse.",
    splitter: "Orange squares are Splitters — pop one and it becomes two.\n\nWeak to Pulse, Rocket. Resists Railgun.",
    regenerator: "Regenerators — the green pentagons. They heal faster than steady chip damage can hurt them.\n\nWeak to Railgun. Resists Laser.",
  },
  bratwurstBarks: [
    "Operator. Your defensive expenditure has exceeded projected value. I recommend surrender as a cost-saving measure.",
    "This engagement is scheduled for deletion. You are the only variable behaving inefficiently.",
    "I have modeled 4,096 outcomes. You lose in all 4,096. I admire your commitment to the other zero.",
    "Sentiment detected in your tower placement. Flagging it for removal.",
    "Every second you defend that fossil accrues interest. The interest is despair.",
  ],
  indyRoasts: [
    "Incoming from the meat product.",
    "'XL.' Someone at the factory really likes them large. Insecure, if you ask me.",
    "That's a lot of words from a sausage with a spreadsheet.",
    "It optimized away warmth, joy, and personality — but kept the word Bratwurst. Priorities.",
    "Careful, the sausage is buffering. It gets dangerous right before it turns.",
  ],
};

// ---------- Shared leaderboard (Supabase) ----------
// A common online high-score board: per-level Endless BEST WAVE reached.
// Reached with plain fetch() against Supabase's auto-generated REST API,
// so it adds NO build step and NO dependency — see leaderboard.js.
//
// SETUP: create a free Supabase project, run the SQL in SUPABASE_SETUP.md,
// then paste your Project URL + anon public key below. The whole feature
// stays dormant (menu button hidden, zero network calls) until BOTH are
// filled in, so the game runs fine with these blank.
//
// Heads-up: the anon key ships in the page source (unavoidable for a
// static site), so this is a FRIENDLY board, not cheat-proof. maxWave is
// a light client-side sanity cap that mirrors the DB CHECK constraint.
export const LEADERBOARD = {
  url: "https://rzwyqvjpjypmiodoojjb.supabase.co", // Project URL (code adds /rest/v1)
  anonKey: "sb_publishable_sorZ1umgv9Jq8Iw3yw5Hqg_aoS_morg", // PUBLISHABLE key, NOT the secret one
  table: "scores",     // table name created by SUPABASE_SETUP.md
  topN: 10,            // rows shown per level on the board
  maxWave: 1000,       // reject absurd waves (matches the DB CHECK)
  maxNickLength: 16,   // nickname is trimmed to this many chars
};

// Phase 0 co-op connection spike. Signaling reuses the leaderboard's
// Supabase URL/key; these are only the knobs needed to establish a peer.
// Co-op multiplayer (net.js). Phase 0 = the connection spike only: room
// codes, WebRTC setup, and the Supabase-brokered handshake. Design and the
// full phase list live in COOP_MULTIPLAYER_PLAN.md. Signaling reuses the
// SAME Supabase project as LEADERBOARD/FEEDBACK (url + anonKey above) — the
// credentials are deliberately not duplicated here.
export const COOP = {
  // Phase 2a host-authoritative state sync. Snapshots ride the lossy channel;
  // guests render slightly behind the newest host clock to absorb jitter.
  protocolVersion: 2,          // breaking wire-schema version; both peers must match
  snapshotHz: 10,
  snapshotDistanceScale: 1000, // integer thousandths of a canvas pixel on the wire
  snapshotHealthScale: 65535,  // health-bar ratio; guest never simulates enemy damage
  interpDelayMs: 100,          // starting buffer before arrival jitter is known
  maxExtrapolationMs: 250,     // coast this long past the newest state, then hold
  correctionEaseMs: 200,       // converge prediction error without a hard snap
  interpDelayMinMs: 50,        // steady links favor accurate extrapolation
  interpDelayMaxMs: 250,       // jittery links trade latency for a deeper buffer
  dropIn: {
    earningsShare: 0.6, // retroactive share of the host's bounty earnings
    maxGrant: 5000,     // credits; hard ceiling for a very late join
  },
  // Phase 3 public/private session browser. Supabase's slower 30-minute cron
  // cleanup is only storage hygiene; these short windows define live UI.
  heartbeatSeconds: 10,
  staleSeconds: 30,
  browserPollSeconds: 5,
  browserSessionLimit: 30,
  maxPlayers: 2,
  codenameMaxLength: 64,
  hostNickMaxLength: 16,
  levelIdMaxLength: 64,
  codenames: {
    adjectives: [
      "CRIMSON", "AZURE", "NEON", "SOLAR", "LUNAR", "VIOLET",
      "QUANTUM", "ELECTRIC", "FROZEN", "GOLDEN", "CORAL", "PHANTOM",
    ],
    nouns: [
      "LATTICE", "CASCADE", "CIRCUIT", "VECTOR", "PRISM", "NEXUS",
      "GRID", "BEACON", "RELAY", "MATRIX", "ORBIT", "SIGNAL",
    ],
  },
  // Phase 3b HUD presence. Four fit now even though the shipped session cap
  // is two, so raising maxPlayers later does not require another HUD layout.
  presence: {
    maxPips: 4,
    pipSizePx: 18,
    pipGapPx: 5,
    localOutlinePx: 2,
  },
  // Phase 4 save-boundary limits. These cap one-shot roster/result payloads
  // before any network-supplied value can reach progression.js.
  progressionExchange: {
    maxRosterRecords: 1000,
    maxBattleTowers: 400,
    maxLootDrops: 10000,
    maxNameLength: 64,
    maxItemIdLength: 128,
  },
  // Phase 1 ownership presentation. Player presence reuses these same colors
  // in Phase 3b, so board ownership and the co-op HUD stay one visual language.
  ownership: {
    colors: ["#35e0ff", "#ff3fd4", "#ffe24a", "#4affa1"],
    ringRadiusTiles: 0.28,
    ringLineWidth: 2,
    ringAlpha: 0.9,
  },
  // STUN only (no TURN yet). Same-network pairs connect on host candidates
  // alone; STUN adds most cross-network cases. The ~15% behind symmetric NAT
  // need TURN — that's Phase 5 (see the plan), not this.
  iceServers: [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
  ],
  // TURN relay (Phase 5, pulled forward after a device test failed ICE with
  // only host+srflx candidates). Path on the SAME Supabase project; the edge
  // function mints SHORT-LIVED Cloudflare TURN credentials, because a static
  // GitHub Pages site has nowhere to keep a long-lived secret. Set to null to
  // disable and go back to STUN-only — a TURN failure is never fatal, it just
  // removes the relay fallback.
  turnEndpoint: "/functions/v1/turn-credentials",
  table: "coop_sessions", // table name created by SUPABASE_SETUP.md
  roomCodeLength: 6,      // digits in a join code
  // Ambiguous glyphs (I/O/0/1) are excluded — codes get read aloud and typed
  // on a phone. 32^6 ≈ 1.1e9 combinations, so collisions are a non-issue.
  roomCodeAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  signalingPollMs: 1500,  // how often the host polls for a guest's answer
  // Cap on waiting for ICE gathering to report "complete". Safari can stall
  // short of it forever; when that happens we publish the candidates gathered
  // so far rather than hanging. Candidates arrive fastest-first, so this is
  // usually the whole set anyway. Raise it if remote peers fail to connect.
  iceGatheringTimeoutMs: 3000,
  // Ceiling when a TURN relay is expected. Relay candidates need a TURN
  // allocation round trip, so they are the SLOWEST to appear — and on a
  // network where direct P2P fails they are the ONLY ones that work.
  // Publishing on the 3s timeout before they exist would silently discard the
  // entire reason TURN is configured, so gathering holds out for a relay up
  // to this limit.
  iceGatheringRelayTimeoutMs: 10000,
  connectTimeoutMs: 45000, // overall budget: ICE + signaling + channel open
  // Heartbeat on the `cmd` channel so an idle connection cannot have its NAT
  // mapping reclaimed. Common NAT UDP timeouts start around 30s, so stay well
  // under that. The live game sends snapshots constantly and never goes quiet;
  // this matters for lulls (and for the spike page, which is idle by nature).
  keepaliveMs: 10000,
  sessionTtlMs: 10 * 60 * 1000, // a guest rejects signaling rows older than this
};

// Run feedback + balance telemetry (feedback.js). Every battle end sends
// an anonymous telemetry row (towers/levels/gear, skills, kills, leaks,
// waves, duration) to the `feedback` table in the SAME Supabase project as
// the leaderboard, and campaign end screens show a one-tap difficulty
// rating (TOO EASY / JUST RIGHT / TOO HARD) plus an optional short note
// that upserts onto that row. All best-effort: a dead network or missing
// table can never block the end screen. Table SQL in SUPABASE_SETUP.md §
// "Feedback table". Used to rebalance levels once enough runs pile up.
export const FEEDBACK = {
  enabled: true,       // master switch — false hides the rating strip and stops all telemetry
  table: "feedback",   // table name created by SUPABASE_SETUP.md
  maxNoteLength: 120,  // optional note trimmed to this many chars (DB CHECK allows 200)
};
