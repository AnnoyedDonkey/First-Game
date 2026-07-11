// ============================================================
// GLOBAL TUNING — the main place to tweak game balance.
//
// Everything here is a DEFAULT. Levels and individual waves can
// override most of it (see levels.js for how).
// ============================================================

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
export const ENEMIES = {
  basic: {
    name: "Basic",
    shape: "triangle",
    baseHealth: 20,
    speed: 1.4,
    coreDamage: 1,
    bounty: 5,
    xp: 10,
    shardTier: 1,
    size: 0.28,          // radius as a fraction of tile size
    color: "#35e0ff",    // neon cyan
    // Neutral to everything — the baseline enemy.
  },
  fast: {
    name: "Fast",
    shape: "diamond",
    baseHealth: 11,
    speed: 2.6,
    coreDamage: 1,
    bounty: 6,
    xp: 12,
    shardTier: 1,
    size: 0.22,
    color: "#ffe24a",    // neon yellow
    // Fragile flyers — Lasers (fast fire) shred them; slow Pulse orbs and
    // lobbed Rockets struggle to catch them. ANSWER: Laser (or Slow to pin).
    damageMult: { energy: 1.3, pulse: 0.7, blast: 0.6 },
  },
  armored: {
    name: "Armored",
    shape: "hexagon",
    baseHealth: 60,
    speed: 0.9,
    coreDamage: 2,
    bounty: 12,
    xp: 25,
    shardTier: 2,
    size: 0.32,
    color: "#ff3fd4",    // neon magenta
    // Plated: lasers & slow-zaps clang off harmlessly. Concussive Pulse
    // splash rattles it, and a Railgun punches clean through.
    // ANSWER: Pulse early, Railgun once unlocked. NOT Laser.
    damageMult: { energy: 0.4, control: 0.5, pulse: 1.2, rail: 1.6 },
  },
  boss: {
    name: "Boss",
    shape: "octagon",
    baseHealth: 400,
    speed: 0.55,
    coreDamage: 5,
    bounty: 100,
    xp: 150,
    shardTier: 4,
    size: 0.42,
    color: "#ff4a5e",    // neon red
    // Massive lone target: shrugs off slows, and small splash is wasted on
    // a single body — but a direct Rocket blast hits hard. Focused fire wins.
    // ANSWER: Railgun / Rocket / Laser focus. NOT Pulse, NOT Slow.
    damageMult: { control: 0.4, pulse: 0.75, rail: 1.2, blast: 1.3 },
  },
  // Splits into 2 splitlings on death — punishes single-target builds.
  splitter: {
    name: "Splitter",
    shape: "square",
    baseHealth: 42,
    speed: 1.1,
    coreDamage: 2,
    bounty: 10,
    xp: 20,
    shardTier: 2,
    size: 0.28,
    color: "#ff7a2f",    // neon orange
    splitInto: { type: "splitling", count: 2 },
    // Pulse splash and Rocket blasts hit the parent AND both children at
    // once; a single-line Railgun wastes most of its shot on one body.
    // ANSWER: Pulse / Rocket. NOT Railgun.
    damageMult: { pulse: 1.5, blast: 1.4, rail: 0.6 },
  },
  splitling: {
    name: "Splitling",
    shape: "diamond",
    baseHealth: 10,
    speed: 2.4,
    coreDamage: 1,
    bounty: 3,
    xp: 5,
    shardTier: 1,
    size: 0.16,
    color: "#ff7a2f",
    damageMult: { pulse: 1.5, blast: 1.4 },
  },
  // Heals itself while alive — punishes chip damage, rewards burst.
  regenerator: {
    name: "Regenerator",
    shape: "pentagon",
    baseHealth: 70,
    speed: 0.85,
    coreDamage: 2,
    bounty: 14,
    xp: 28,
    shardTier: 2,
    size: 0.30,
    color: "#7dff4a",    // acid green
    regenRate: 0.05,     // heals 5% of max health per second
    // Out-heals steady laser chip almost entirely; only a Railgun's burst
    // outruns the regen. ANSWER: Railgun. NOT Laser.
    damageMult: { energy: 0.45, rail: 1.6 },
  },
};

// ---------- Waves ----------
export const WAVE_DEFAULTS = {
  timeBetweenWaves: 6,     // seconds of build time after a wave is cleared
  autoStartNextWave: true, // false = player must tap START for every wave
  allowEarlyStart: true,   // tap START during the countdown to skip the wait
  spawnInterval: 0.8,      // default seconds between enemies in a group
};

// ---------- Endless mode ----------
// Unlocked per level once its campaign is beaten. Reuses the level's own
// 10 authored waves unchanged, then generates waves procedurally past
// that (see endless.js), anchored to the difficulty of the level's own
// final wave. Everything compounds per "extra" wave k (k=1 is the wave
// right after the campaign ends), so this ramps up FAST — only a
// heavily-upgraded/high-Mastery roster should push deep into it.
export const ENDLESS = {
  healthGrowthPerWave: 0.16,     // enemy health compounds +16% per wave
  countGrowthPerWave: 0.05,      // enemy count grows +5% per wave...
  maxCountMult: 3,               // ...capped at 3x the seed wave's count
  speedGrowthPerWave: 0.012,     // +1.2% enemy speed per wave...
  maxSpeedMult: 1.6,             // ...capped at 1.6x
  intervalShrinkPerWave: 0.985,  // spawns get denser over time...
  minSpawnIntervalMult: 0.4,     // ...never denser than 40% of the base interval
  bossEvery: 5,                  // an extra boss group every N endless waves
  bossHealthGrowthPerWave: 0.20, // bosses scale even faster than the swarm
};

// One-time-per-level Endless milestones (LOOT_DESIGN.md §10). Same
// threshold list applies to EVERY level's Endless mode — each level
// tracks its own claimed set (save.js endlessRewards[levelId]), so a
// level with an easier seed wave and one with a brutal seed wave both
// chase the same wave numbers, just at different difficulty. Grants are
// automatic (no separate claim step) the moment a run's best-ever wave
// for that level crosses a threshold — see progression.js
// grantEndlessRewards(). Loot rewards land in pendingLoot (same triage
// flow as any other drop); shard rewards bank immediately.
// Reference: an 8-tower level-1 laser wall (fresh, no Mastery) died on
// endless wave 18 in first-pass bot testing (HANDOFF.md) — thresholds
// are set around and past that bar.
export const ENDLESS_REWARDS = {
  milestones: [
    { id: "wave10", type: "wave", threshold: 10, reward: { kind: "shards", amount: 100 } },
    { id: "wave20", type: "wave", threshold: 20, reward: { kind: "loot", rarity: "rare" } },
    { id: "wave35", type: "wave", threshold: 35, reward: { kind: "shards", amount: 350 } },
    { id: "wave50", type: "wave", threshold: 50, reward: { kind: "loot", rarity: "prismatic" } },
    { id: "wave75", type: "wave", threshold: 75, reward: { kind: "loot", rarity: "singularity" } },
  ],
};

// ---------- Towers ----------
// (Used from Checkpoint B onward — defined now so all knobs live together.)
export const TOWERS = {
  laser: {
    name: "Laser Tower",
    prefix: "L",           // single-letter gear lock-tag glyph (e.g. STASH corner dot)
    rosterPrefix: "Laser", // roster names: Laser-01, Laser-02...
    baseCost: 50,
    baseDamage: 8,
    baseRange: 1.9,        // in tiles
    baseFireRate: 0.35,    // seconds between shots
    basePierce: 1,         // max enemies hit by one beam before gear
    damageType: "energy",
    color: "#35e0ff",
  },
  pulse: {
    name: "Pulse Tower",
    prefix: "P",           // single-letter gear lock-tag glyph
    rosterPrefix: "Pulse",
    baseCost: 75,
    baseDamage: 14,
    splashRadius: 0.7,     // in tiles
    baseRange: 1.6,
    baseFireRate: 1.1,
    projectileSpeed: 5.5,  // tiles per second
    damageType: "pulse",
    color: "#ff3fd4",
    // Expensive to level, but scales into a swarm-clearing monster (see
    // its bigger splash specialty in TOWER_UPGRADES). Costs 60% more per
    // upgrade than the shared table.
    upgradeCostMult: 1.6,
  },
  slow: {
    name: "Slow Tower",
    prefix: "S",           // single-letter gear lock-tag glyph
    rosterPrefix: "Slow",
    baseCost: 60,
    baseDamage: 2,
    baseRange: 1.6,
    baseFireRate: 0.8,
    slowPercent: 0.35,     // 0.35 = enemies move 35% slower
    slowDuration: 1.5,     // seconds
    // FORCE MULTIPLIER: a slowed enemy also takes extra damage from ALL
    // sources for the slow's duration. This is the Slow Tower's real job —
    // it makes every other tower hit harder, so it earns a slot in a combo.
    vulnerability: 0.30,   // +30% damage taken while slowed
    damageType: "control",
    color: "#4affa1",
    // Cheap to level (it's support, not DPS).
    upgradeCostMult: 0.8,
  },
  // Unlocked by clearing Core Siege (level 5). Slow, long-ranged,
  // devastating — the shot PIERCES every enemy along the beam line.
  railgun: {
    name: "Railgun Tower",
    prefix: "R",           // single-letter gear lock-tag glyph
    rosterPrefix: "Railgun",
    baseCost: 100,
    baseDamage: 48,
    baseRange: 3.5,
    baseFireRate: 3.0,
    basePierce: 4,         // max enemies hit by one rail before gear
    pierceWidth: 0.18,     // beam corridor half-width, in tiles
    damageType: "rail",
    color: "#ff9d3f",
    unlockLabel: "CLEAR LV 5",
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
    baseCost: 120,
    baseDamage: 44,
    splashRadius: 0.9,     // explosive AoE, in tiles
    baseRange: 999,        // effectively the whole board
    baseFireRate: 2.8,     // slow reload
    projectileSpeed: 9,    // tiles per second
    damageType: "blast",
    color: "#ff5e3a",      // rocket red-orange (distinct from railgun amber)
    unlockLabel: "CLEAR LV 10",
  },
};

// Per-level stat growth when a tower is upgraded (Checkpoint C).
// Each level multiplies the stat by (1 + value).
export const TOWER_UPGRADES = {
  maxLevel: 5,
  damageGrowth: 0.35,      // +35% damage per level
  rangeGrowth: 0.08,       // +8% range per level
  fireRateGrowth: 0.10,    // fires 10% faster per level
  splashGrowth: 0.10,      // pulse: +10% splash radius per level
  slowGrowth: 0.12,        // slow: +12% slow duration per level
  // XP needed to become ELIGIBLE for each level (index 0 = level 2)
  xpThresholds: [100, 250, 450, 700],
  // Money cost to actually buy each level (index 0 = level 2).
  // A tower can scale this with its own `upgradeCostMult` (see TOWERS) —
  // e.g. Pulse pays 1.6x, Slow pays 0.8x.
  upgradeCosts: [75, 125, 200, 300],

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
  mastery: {
    xpStart: 700,          // XP where mastery begins (= level-5 threshold)
    baseXpPerRank: 400,    // XP cost of rank 1
    xpRankIncrement: 80,   // each rank costs this much more than the last
    damagePerRank: 0.015,  // +1.5% damage per rank (+75% at rank 50)
    maxRanks: 50,          // hard cap
  },

  // Each tower class gains an EXTRA specialty bonus per level, on top
  // of the shared growth above. Explained to the player in the Tower
  // Guide (shown at level 2, and from the main menu).
  specialties: {
    laser:   { rangeGrowth: 0.07,    label: "+ extra range per level" },
    pulse:   { splashGrowth: 0.16,   label: "+ bigger explosions per level" },
    slow:    { fireRateGrowth: 0.10, label: "+ faster firing per level" },
    railgun: { damageGrowth: 0.10,   label: "+ extra damage per level" },
    rocket:  { splashGrowth: 0.12,   label: "+ bigger blasts per level" },
  },
};

// ---------- Economy ----------
export const ECONOMY = {
  moneyPerKillMultiplier: 1.0,  // global multiplier on all bounties
  xpPerKillMultiplier: 1.0,     // global multiplier on all XP gains
};

// ---------- Loot & equipment (see LOOT_DESIGN.md) ----------
// Home for every loot/gear tunable. `xp` (P0) and `shards` (P1) are used
// so far. Later phases (generator, drops, store, stash) add their
// subsections here — keep every number in this object, never hardcode
// one in logic.
export const LOOT = {
  // XP redistribution: a kill's XP pool is split among every tower that
  // contributed to that enemy, by weight, instead of all going to the
  // final-hit tower. Damage dealt = 1 weight per point of damage; slow
  // applied = slowSecondsApplied * slowWeightPerSec. This is what finally
  // pays Slow towers (they rarely land the killing blow).
  xp: {
    slowWeightPerSec: 8,   // weight per second of slow applied
  },

  // Shards ◆ — the persistent meta-currency for loot gear/store systems.
  // Earned per kill, win OR lose, so grinding/forfeiting still pays.
  // Per-kill amount = round(perKillBase * ENEMIES[type].shardTier).
  shards: {
    perKillBase: 3,
  },

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
    rerollCost: 30,
    rerollCostIncrement: 15,
    prices: { common: 25, enhanced: 70, rare: 180, prismatic: 500, singularity: 1500 },
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
// Each skill has 5 TIERS. Tier N gives N x the base value below
// (e.g. Laser Calibration tier 3 = +30% damage). The player earns
// 1 skill point per level won; tier costs escalate.
export const SKILL_TIERS = {
  maxTier: 5,
  costs: [1, 1, 2, 2, 3],  // cost of tier 1, 2, 3, 4, 5
};

export const SKILLS = {
  laserDamage:  { name: "Laser Calibration", desc: "Laser Tower damage" },
  pulseDamage:  { name: "Pulse Amplifier",   desc: "Pulse Tower damage" },
  railDamage:   { name: "Rail Overcharge",   desc: "Railgun Tower damage" },
  rocketDamage: { name: "Warhead Payload",   desc: "Rocket Launcher damage" },
  slowDuration: { name: "Stasis Field",      desc: "slow effect duration" },
  moneyPerKill: { name: "Salvage Protocol",  desc: "money per kill" },
  xpGain:       { name: "Combat Learning",   desc: "tower XP gain" },
  coreHealth:   { name: "Core Plating",      desc: "AI Core health" },
};

// Per-tier effect size (tier N = N x this value).
export const SKILL_VALUES = {
  laserDamage: 0.10,   // +10% per tier
  pulseDamage: 0.10,
  railDamage: 0.10,
  rocketDamage: 0.10,
  slowDuration: 0.10,
  moneyPerKill: 0.10,
  xpGain: 0.10,
  coreHealth: 5,       // +5 HP per tier
};

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
