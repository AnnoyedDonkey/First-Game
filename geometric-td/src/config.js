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
};

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
  // Unlocked by clearing Core Siege (level 5). Slow, long-ranged,
  // devastating — the shot PIERCES every enemy along the beam line.
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
  railgun: "+ extra damage per level",
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
    gravityDragTiles: 0.22,      // path distance pulled backward per zap
    fractalBomblets: 3,
    fractalDamage: 35,           // each bomblet's damage as % of the main blast
    fractalRadius: 45,           // each bomblet's radius as % of main blast
    fractalOffsetTiles: 0.42,    // bomblet centers from the main impact
    cascadeBonusPierce: 2,
    cascadeDamageRamp: 15,       // added damage per victim already pierced
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

  stash: {
    stashSize: 50,
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
// progression.js exposes one getter per entry (e.g. getRailBeamLengthMult),
// applied at its specific use site in towers.js — not every tower needs one.
const TOWER_THIRD_BRANCH = {
  railgun: { idPrefix: "railPen",    name: "Over-Penetration", desc: "Railgun beam length", icon: "pierce", valueKey: "railPen" },
  slow:    { idPrefix: "slowPot",    name: "Slow Potency",     desc: "Slow Amount",         icon: "slow",   valueKey: "slowPot" },
  laser:   { idPrefix: "laserRate",  name: "Rapid Fire",       desc: "Laser fire rate",     icon: "laser",  valueKey: "laserRate" },
  pulse:   { idPrefix: "pulseBlast", name: "Blast Radius",     desc: "Pulse splash radius", icon: "pulse",  valueKey: "pulseBlast" },
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
        kind: "pct", tower: t, dmg: true, step: spec.damageStep, chainLabel: pctLabel });
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
        eco: key, chainLabel: label });
      p = `${key}${i}`;
    }
  });
  x += ecoSpan + COL + BRANCH_GAP;

  // ----- Core branch: core plating (single multi-tier node) -----
  put("coreHealth", { name: "Core Plating", desc: "AI Core health", branch: "core",
    color: SKILL_BRANCH_COLORS.core, parent: null, pos: { x, y: HEAD_Y }, icon: "core",
    isRoot: true, headLabel: "CORE" });

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
  steps: [
    {
      id: "welcome",
      cta: "TAP TO START",
      text: "Defend the AI Core — build towers to stop the wave.",
    },
    {
      id: "selectLaser",
      target: "trayLaser",
      text: "Tap the LASER tower.",
    },
    {
      id: "placeTile",
      target: "tile",
      text: "Now tap an open tile to build.",
    },
    {
      id: "blockedTile",
      target: "blockedTile",
      cta: "TAP TO CONTINUE",
      text: "✕ chips are part of the circuit board — no building there.",
    },
    {
      id: "startWave",
      target: "waveButton",
      text: "Tap START WAVE to send in the wave!",
    },
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
