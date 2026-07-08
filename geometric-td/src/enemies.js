// ============================================================
// ENEMIES — creation and movement.
// ============================================================

import { ENEMIES, ECONOMY, VFX } from "./config.js";
import { getMoneyMult, getXpMult } from "./progression.js";
import { emitHitSparks, emitDeathShards } from "./particles.js";

let nextEnemyId = 1;

// mods lets a wave group scale this specific enemy:
// { healthMult, speedMult, bountyMult, xpMult }
export function createEnemy(type, mods = {}) {
  const def = ENEMIES[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);

  const healthMult = mods.healthMult ?? 1;
  const speedMult = mods.speedMult ?? 1;

  return {
    id: nextEnemyId++,
    type,
    def,
    health: def.baseHealth * healthMult,
    maxHealth: def.baseHealth * healthMult,
    speedTilesPerSec: def.speed * speedMult,
    bounty: Math.round(def.bounty * (mods.bountyMult ?? 1)),
    xp: Math.round(def.xp * (mods.xpMult ?? 1)),
    coreDamage: def.coreDamage,
    distance: 0,        // pixels traveled along the path
    slowUntil: 0,       // game-time until which the enemy is slowed
    slowFactor: 1,      // current speed multiplier from slow towers
    hitFlash: 0,        // seconds remaining of the "just hit" flash
    alive: true,
  };
}

// Advance all enemies. Returns the enemies that reached the core
// this frame (they are marked dead and should damage the core).
export function updateEnemies(enemies, dt, grid, gameTime) {
  const leaked = [];
  for (const e of enemies) {
    if (!e.alive) continue;

    const slow = gameTime < e.slowUntil ? e.slowFactor : 1;
    e.distance += e.speedTilesPerSec * slow * grid.tileSize * dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    if (e.distance >= grid.totalPathLength) {
      e.alive = false;
      leaked.push(e);
    }
  }
  return leaked;
}

export function enemyPosition(enemy, grid) {
  return grid.positionOnPath(enemy.distance);
}

// Apply damage from a tower (or splash). Handles death: bounty money,
// XP to the source tower (final-hit rule), kill count, and a death burst.
export function damageEnemy(game, enemy, sourceTower, amount) {
  if (!enemy.alive) return;

  enemy.health -= amount;
  enemy.hitFlash = 0.1;

  if (enemy.health > 0) {
    // Impact sparks where the shot landed.
    const hp = enemyPosition(enemy, game.grid);
    emitHitSparks(game, hp.x, hp.y, enemy.def.color);
    return;
  }

  enemy.alive = false;
  game.money += Math.round(enemy.bounty * ECONOMY.moneyPerKillMultiplier * getMoneyMult());

  if (sourceTower) {
    sourceTower.xp += Math.round(enemy.xp * ECONOMY.xpPerKillMultiplier * getXpMult());
    sourceTower.kills += 1;
  }

  const pos = enemyPosition(enemy, game.grid);
  const ts = game.grid.tileSize;
  game.effects.push({
    kind: "burst",
    x: pos.x,
    y: pos.y,
    color: enemy.def.color,
    radius: ts * enemy.def.size * 1.6,
    ttl: 0.35,
    maxTtl: 0.35,
  });

  // GeoDefense-style shatter: edges fly apart + a grid shockwave.
  emitDeathShards(game, pos.x, pos.y, enemy.def, ts);
  const isBoss = enemy.type === "boss";
  game.springGrid.applyShock(
    pos.x, pos.y,
    ts * VFX.warp.shockRadiusTiles * (isBoss ? 2 : 1),
    isBoss ? VFX.warp.bossShock : VFX.warp.deathShock
  );
}

// Apply a slow debuff (from Slow Towers).
export function slowEnemy(game, enemy, slowPercent, duration) {
  enemy.slowFactor = 1 - slowPercent;
  enemy.slowUntil = game.time + duration;
}
