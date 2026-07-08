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
  },
};

// ---------- Waves ----------
export const WAVE_DEFAULTS = {
  timeBetweenWaves: 6,     // seconds of build time after a wave is cleared
  autoStartNextWave: true, // false = player must tap START for every wave
  allowEarlyStart: true,   // tap START during the countdown to skip the wait
  spawnInterval: 0.8,      // default seconds between enemies in a group
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
    damageType: "control",
    color: "#4affa1",
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
  // Money cost to actually buy each level (index 0 = level 2)
  upgradeCosts: [75, 125, 200, 300],
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
  slowDuration: 0.10,
  moneyPerKill: 0.10,
  xpGain: 0.10,
  coreHealth: 5,       // +5 HP per tier
};
