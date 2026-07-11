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
export const ENEMIES = {
  basic: {
    name: "Basic",
    shape: "triangle",
    baseHealth: 20,
    speed: 1.4,
    coreDamage: 1,
    bounty: 5,
    xp: 10,
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

// ---------- Towers ----------
// (Used from Checkpoint B onward — defined now so all knobs live together.)
export const TOWERS = {
  laser: {
    name: "Laser Tower",
    prefix: "L",           // roster names: L-01, L-02...
    baseCost: 50,
    baseDamage: 8,
    baseRange: 1.9,        // in tiles
    baseFireRate: 0.35,    // seconds between shots
    damageType: "energy",
    color: "#35e0ff",
  },
  pulse: {
    name: "Pulse Tower",
    prefix: "P",
    baseCost: 75,
    baseDamage: 14,
    splashRadius: 0.7,     // in tiles
    baseRange: 1.6,
    baseFireRate: 1.1,
    damageType: "pulse",
    color: "#ff3fd4",
    // Expensive to level, but scales into a swarm-clearing monster (see
    // its bigger splash specialty in TOWER_UPGRADES). Costs 60% more per
    // upgrade than the shared table.
    upgradeCostMult: 1.6,
  },
  slow: {
    name: "Slow Tower",
    prefix: "S",
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
    prefix: "R",
    baseCost: 100,
    baseDamage: 60,
    baseRange: 3.5,
    baseFireRate: 2.5,
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
    prefix: "K",           // roster names K-01 (R is the railgun)
    baseCost: 120,
    baseDamage: 55,
    splashRadius: 0.9,     // explosive AoE, in tiles
    baseRange: 999,        // effectively the whole board
    baseFireRate: 2.2,     // slow reload
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
  mastery: {
    xpStart: 700,        // XP where mastery begins (= level-5 threshold)
    xpPerRank: 600,      // XP needed per rank
    damagePerRank: 0.02, // +2% damage per rank
    maxRanks: 25,        // soft cap: +50% damage
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
