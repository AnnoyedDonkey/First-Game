// ============================================================
// TOWERS — placement, targeting, and firing.
//
// Targeting rule: towers shoot the enemy FURTHEST along the path
// that is inside their range ("first" targeting).
// ============================================================

import { TOWERS, TOWER_UPGRADES } from "./config.js";
import { enemyPosition, damageEnemy, slowEnemy } from "./enemies.js";
import { spawnPulseOrb } from "./projectiles.js";
import {
  getTowerDamageMult, getSlowDurationMult, takeRosterUnit,
} from "./progression.js";

let nextTowerId = 1;
const rosterCounters = {}; // per-prefix counters for names like L-01

function nextRosterName(def) {
  rosterCounters[def.prefix] = (rosterCounters[def.prefix] || 0) + 1;
  return `${def.prefix}-${String(rosterCounters[def.prefix]).padStart(2, "0")}`;
}

// Continue name numbering after saved roster units (so a fresh L-03
// can't collide with a persisted L-03).
export function seedRosterCounters(roster) {
  for (const rec of roster) {
    const [prefix, num] = rec.name.split("-");
    const n = parseInt(num, 10);
    if (!Number.isNaN(n)) {
      rosterCounters[prefix] = Math.max(rosterCounters[prefix] || 0, n);
    }
  }
}

// rosterRecord (optional): deploy this persistent unit instead of a
// brand-new tower — it keeps its name, XP, kills, and unlocked level.
export function createTower(type, tileX, tileY, grid, rosterRecord = null) {
  const def = TOWERS[type];
  if (!def) throw new Error(`Unknown tower type: ${type}`);

  const tower = {
    id: nextTowerId++,
    name: rosterRecord ? rosterRecord.name : nextRosterName(def),
    type,
    def,
    tileX,
    tileY,
    pos: grid.tileCenter(tileX, tileY),
    level: 1,                 // everyone re-enters battle at level 1
    maxUnlockedLevel: rosterRecord ? rosterRecord.maxLevel : 1,
    xp: rosterRecord ? rosterRecord.xp : 0,
    kills: rosterRecord ? rosterRecord.kills : 0,
    cooldown: 0,              // seconds until the tower may fire again
    aimAngle: -Math.PI / 2,
  };
  recomputeStats(tower, grid);
  return tower;
}

// Re-apply skill-tree modifiers to every deployed tower (used after
// buying a skill so the effect is immediate).
export function refreshTowerStats(game) {
  for (const t of game.towers) recomputeStats(t, game.grid);
}

// Live stats = base stats scaled by level (compound growth per level).
function recomputeStats(tower, grid) {
  const def = tower.def;
  const g = TOWER_UPGRADES;
  const lv = tower.level - 1; // level 1 = base stats

  tower.damage =
    def.baseDamage * Math.pow(1 + g.damageGrowth, lv) * getTowerDamageMult(tower.type);
  tower.range = def.baseRange * grid.tileSize * Math.pow(1 + g.rangeGrowth, lv);
  tower.fireInterval = def.baseFireRate / Math.pow(1 + g.fireRateGrowth, lv);
  if (def.splashRadius) {
    tower.splashRadius = def.splashRadius * grid.tileSize * Math.pow(1 + g.splashGrowth, lv);
  }
  if (def.slowPercent) {
    tower.slowPercent = def.slowPercent;
    tower.slowDuration =
      def.slowDuration * Math.pow(1 + g.slowGrowth, lv) * getSlowDurationMult();
  }
}

// ---------- Upgrades ----------
// XP makes a tower ELIGIBLE; money pays for the actual upgrade.

// Total XP required to become eligible for the next level (null at max).
export function xpThresholdFor(tower) {
  if (tower.level >= TOWER_UPGRADES.maxLevel) return null;
  const t = TOWER_UPGRADES.xpThresholds;
  return t[Math.min(tower.level - 1, t.length - 1)];
}

export function upgradeCostFor(tower) {
  if (tower.level >= TOWER_UPGRADES.maxLevel) return null;
  const c = TOWER_UPGRADES.upgradeCosts;
  return c[Math.min(tower.level - 1, c.length - 1)];
}

export function isUpgradeEligible(tower) {
  const threshold = xpThresholdFor(tower);
  if (threshold === null) return false;
  // Veterans can re-buy up to their unlocked level without new XP.
  if (tower.level < tower.maxUnlockedLevel) return true;
  return tower.xp >= threshold;
}

// Try to buy the upgrade. Returns true if it went through.
export function tryUpgradeTower(game, tower) {
  if (!isUpgradeEligible(tower)) return false;
  const cost = upgradeCostFor(tower);
  if (game.money < cost) return false;

  game.money -= cost;
  tower.level += 1;
  recomputeStats(tower, game.grid);

  game.effects.push({
    kind: "ring",
    x: tower.pos.x,
    y: tower.pos.y,
    color: "#ffffff",
    radius: game.grid.tileSize * 0.6,
    ttl: 0.4,
    maxTtl: 0.4,
  });
  return true;
}

export function towerAt(game, tileX, tileY) {
  return game.towers.find((t) => t.tileX === tileX && t.tileY === tileY) || null;
}

// Try to place a tower. Returns { ok, reason }.
export function placeTower(game, type, tileX, tileY) {
  const def = TOWERS[type];
  if (!game.grid.isBuildable(tileX, tileY)) return { ok: false, reason: "blocked" };
  if (towerAt(game, tileX, tileY)) return { ok: false, reason: "occupied" };
  if (game.money < def.baseCost) return { ok: false, reason: "money" };

  game.money -= def.baseCost;
  // Deploy your best available roster veteran of this type, if any.
  const deployedNames = new Set(game.towers.map((t) => t.name));
  const veteran = takeRosterUnit(type, deployedNames);
  const tower = createTower(type, tileX, tileY, game.grid, veteran);
  game.towers.push(tower);

  // Placement flash so building feels responsive.
  game.effects.push({
    kind: "ring",
    x: tower.pos.x,
    y: tower.pos.y,
    color: def.color,
    radius: game.grid.tileSize * 0.5,
    ttl: 0.3,
    maxTtl: 0.3,
  });
  return { ok: true, tower };
}

function findTarget(game, tower) {
  let best = null;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const pos = enemyPosition(e, game.grid);
    const dx = pos.x - tower.pos.x;
    const dy = pos.y - tower.pos.y;
    if (dx * dx + dy * dy > tower.range * tower.range) continue;
    if (!best || e.distance > best.distance) best = e;
  }
  return best;
}

export function updateTowers(game, dt) {
  for (const tower of game.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    const target = findTarget(game, tower);
    if (!target) continue;

    const tpos = enemyPosition(target, game.grid);
    tower.aimAngle = Math.atan2(tpos.y - tower.pos.y, tpos.x - tower.pos.x);
    tower.cooldown = tower.fireInterval;

    fire(game, tower, target, tpos);
  }
}

function fire(game, tower, target, targetPos) {
  const def = tower.def;

  // Muzzle flash at the barrel — bigger on higher-level towers.
  const barrel = game.grid.tileSize * 0.22;
  game.effects.push({
    kind: "muzzle",
    x: tower.pos.x + Math.cos(tower.aimAngle) * barrel,
    y: tower.pos.y + Math.sin(tower.aimAngle) * barrel,
    color: def.color,
    radius: 5 + tower.level * 2,
    ttl: 0.07, maxTtl: 0.07,
  });

  if (tower.type === "laser") {
    // Instant beam — thicker as the tower levels up.
    game.effects.push({
      kind: "beam",
      x1: tower.pos.x, y1: tower.pos.y,
      x2: targetPos.x, y2: targetPos.y,
      color: def.color,
      width: 1.5 + tower.level * 0.5,
      ttl: 0.08, maxTtl: 0.08,
    });
    damageEnemy(game, target, tower, tower.damage);

  } else if (tower.type === "pulse") {
    // Slow homing orb that explodes on impact (see projectiles.js).
    spawnPulseOrb(game, tower, target);

  } else if (tower.type === "slow") {
    // Instant zap: light damage + slow debuff.
    game.effects.push({
      kind: "beam",
      x1: tower.pos.x, y1: tower.pos.y,
      x2: targetPos.x, y2: targetPos.y,
      color: def.color,
      width: 1.2 + tower.level * 0.4,
      ttl: 0.12, maxTtl: 0.12,
    });
    slowEnemy(game, target, tower.slowPercent, tower.slowDuration);
    damageEnemy(game, target, tower, tower.damage);
  }
}
