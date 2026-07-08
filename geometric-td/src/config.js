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
  maxParticles: 400,       // hard cap; oldest particles are dropped first
  hitSparkCount: 3,        // sparks per projectile/beam hit
  deathSparkCount: 6,      // extra sparks on top of shards when a unit dies
  shardSpeed: [50, 170],   // px/sec range for flying shards
  shardTtl: [0.45, 0.9],   // seconds range before a shard fades out

  // The warping background grid (spring mesh).
  warp: {
    spacingTiles: 0.5,     // grid node spacing as a fraction of a tile
    homeStiffness: 42,     // pull back toward rest position
    neighborStiffness: 14, // coupling that makes ripples propagate
    damping: 5.5,          // how fast the wobble dies down
    maxDisplacement: 5,    // px clamp — keeps the board readable
    hitShock: 26,          // impulse strengths...
    deathShock: 95,
    bossShock: 300,
    leakShock: 220,        // the core "flinches" when damaged
    shockRadiusTiles: 1.6, // impulse falloff radius
  },
};

// Polygon sides for each enemy shape (renderer + shard explosions).
export const SHAPE_SIDES = { triangle: 3, diamond: 4, hexagon: 6, octagon: 8 };

// ---------- Permanent skill tree ----------
// Starter set: each is a one-time purchase costing skill points.
// The player earns 1 skill point per level won.
export const SKILLS = {
  laserDamage:  { name: "Laser Calibration", desc: "+10% Laser Tower damage",   cost: 1 },
  pulseDamage:  { name: "Pulse Amplifier",   desc: "+10% Pulse Tower damage",   cost: 1 },
  slowDuration: { name: "Stasis Field",      desc: "+10% slow effect duration", cost: 1 },
  moneyPerKill: { name: "Salvage Protocol",  desc: "+10% money per kill",       cost: 1 },
  xpGain:       { name: "Combat Learning",   desc: "+10% tower XP gain",        cost: 1 },
  coreHealth:   { name: "Core Plating",      desc: "+5 AI Core health",         cost: 1 },
};

// Effect sizes for the skills above — tweak strengths here.
export const SKILL_VALUES = {
  laserDamage: 0.10,
  pulseDamage: 0.10,
  slowDuration: 0.10,
  moneyPerKill: 0.10,
  xpGain: 0.10,
  coreHealth: 5,
};
