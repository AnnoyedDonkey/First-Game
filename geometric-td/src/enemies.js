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
    mods,               // kept so splitters can pass scaling to children
    health: def.baseHealth * healthMult,
    maxHealth: def.baseHealth * healthMult,
    speedTilesPerSec: def.speed * speedMult,
    bounty: Math.round(def.bounty * (mods.bountyMult ?? 1)),
    xp: Math.round(def.xp * (mods.xpMult ?? 1)),
    coreDamage: def.coreDamage,
    distance: 0,        // pixels traveled along the path
    slowUntil: 0,       // game-time until which the enemy is slowed
    slowFactor: 1,      // current speed multiplier from slow towers
    vulnUntil: 0,       // game-time until which +damage debuff applies
    vulnMult: 1,        // damage multiplier while vulnerable (Slow debuff)
    hitFlash: 0,        // seconds remaining of the "just hit" flash
    healPulse: 0,       // regenerator visual timer
    alive: true,
  };
}

// Advance all enemies. Returns the enemies that reached the core
// this frame (they are marked dead and should damage the core).
export function updateEnemies(game, dt) {
  const { grid } = game;
  const leaked = [];
  for (const e of game.enemies) {
    if (!e.alive) continue;

    const slow = game.time < e.slowUntil ? e.slowFactor : 1;
    e.distance += e.speedTilesPerSec * slow * grid.tileSize * dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    // Regenerators heal while alive (and pulse a soft ring).
    if (e.def.regenRate && e.health < e.maxHealth) {
      e.health = Math.min(e.maxHealth, e.health + e.maxHealth * e.def.regenRate * dt);
      e.healPulse -= dt;
      if (e.healPulse <= 0) {
        e.healPulse = 1.2;
        const pos = grid.positionOnPath(e.distance);
        game.effects.push({
          kind: "ring", x: pos.x, y: pos.y, color: e.def.color,
          radius: grid.tileSize * e.def.size * 1.3, ttl: 0.5, maxTtl: 0.5,
        });
      }
    }

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

  // Damage-type counters: enemies resist / are weak to specific towers
  // (ENEMIES[type].damageMult keyed by the tower's damageType).
  let dmg = amount;
  if (sourceTower) {
    const mult = enemy.def.damageMult && enemy.def.damageMult[sourceTower.def.damageType];
    if (mult != null) dmg *= mult;
  }
  // Slow-tower vulnerability debuff: slowed enemies take extra damage
  // from EVERY source while the debuff lasts.
  if (game.time < enemy.vulnUntil) dmg *= enemy.vulnMult;

  enemy.health -= dmg;
  enemy.hitFlash = 0.1;

  if (enemy.health > 0) {
    // Impact sparks where the shot landed — more from stronger towers.
    const hp = enemyPosition(enemy, game.grid);
    const level = sourceTower ? sourceTower.level : 1;
    emitHitSparks(game, hp.x, hp.y, enemy.def.color, VFX.hitSparkCount + level - 1);
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
  // Stronger killers produce a more violent explosion.
  emitDeathShards(game, pos.x, pos.y, enemy.def, ts, sourceTower ? sourceTower.level : 1);
  const isBoss = enemy.type === "boss";
  game.springGrid.applyShock(
    pos.x, pos.y,
    ts * VFX.warp.shockRadiusTiles * (isBoss ? 2 : 1),
    isBoss ? VFX.warp.bossShock : VFX.warp.deathShock
  );

  // Splitters burst into children that keep marching from the same
  // spot, inheriting the parent's wave scaling.
  if (enemy.def.splitInto) {
    const { type, count } = enemy.def.splitInto;
    for (let i = 0; i < count; i++) {
      const child = createEnemy(type, enemy.mods);
      // Stagger them slightly so they don't overlap perfectly.
      child.distance = Math.max(0, enemy.distance - i * game.grid.tileSize * 0.25);
      game.enemies.push(child);
    }
  }
}

// Apply a slow debuff (from Slow Towers). `vulnerability` (optional) also
// marks the enemy to take extra damage from all sources for `duration`.
export function slowEnemy(game, enemy, slowPercent, duration, vulnerability = 0) {
  enemy.slowFactor = 1 - slowPercent;
  enemy.slowUntil = game.time + duration;
  if (vulnerability > 0) {
    enemy.vulnMult = 1 + vulnerability;
    enemy.vulnUntil = game.time + duration;
  }
}
