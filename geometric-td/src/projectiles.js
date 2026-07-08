// ============================================================
// PROJECTILES & EFFECTS — pulse orbs, and the short-lived visual
// effects list (beams, rings, bursts, tile flashes).
// ============================================================

import { enemyPosition, damageEnemy } from "./enemies.js";
import { emitHitSparks } from "./particles.js";
import { VFX } from "./config.js";

// Visual/feel tuning for projectiles.
const ORB = {
  speedTilesPerSec: 5.5,   // pulse orb travel speed
  hitDistance: 8,          // px from target that counts as impact
};

export function spawnPulseOrb(game, tower, targetEnemy) {
  const start = { x: tower.pos.x, y: tower.pos.y };
  game.projectiles.push({
    kind: "orb",
    x: start.x,
    y: start.y,
    target: targetEnemy,             // homes while the enemy lives
    lastTargetPos: enemyPosition(targetEnemy, game.grid),
    speed: ORB.speedTilesPerSec * game.grid.tileSize,
    damage: tower.damage,
    splashRadius: tower.splashRadius,
    color: tower.def.color,
    sourceTower: tower,
  });
}

export function updateProjectiles(game, dt) {
  for (const p of game.projectiles) {
    // Home toward the enemy; if it died mid-flight, fly to its last spot.
    if (p.target && p.target.alive) {
      p.lastTargetPos = enemyPosition(p.target, game.grid);
    }
    const dx = p.lastTargetPos.x - p.x;
    const dy = p.lastTargetPos.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= Math.max(ORB.hitDistance, p.speed * dt)) {
      explode(game, p);
      p.done = true;
      continue;
    }
    p.x += (dx / dist) * p.speed * dt;
    p.y += (dy / dist) * p.speed * dt;
  }
  game.projectiles = game.projectiles.filter((p) => !p.done);
}

function explode(game, orb) {
  game.effects.push({
    kind: "ring",
    x: orb.x,
    y: orb.y,
    color: orb.color,
    radius: orb.splashRadius,
    ttl: 0.25,
    maxTtl: 0.25,
  });
  emitHitSparks(game, orb.x, orb.y, orb.color, 8);
  game.springGrid.applyShock(
    orb.x, orb.y,
    game.grid.tileSize * VFX.warp.shockRadiusTiles,
    VFX.warp.hitShock * 2
  );

  // Splash damage to every enemy inside the radius.
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const pos = enemyPosition(e, game.grid);
    const dx = pos.x - orb.x;
    const dy = pos.y - orb.y;
    if (dx * dx + dy * dy <= orb.splashRadius * orb.splashRadius) {
      damageEnemy(game, e, orb.sourceTower, orb.damage);
    }
  }
}

// Tick down all transient visual effects.
export function updateEffects(game, dt) {
  for (const fx of game.effects) fx.ttl -= dt;
  game.effects = game.effects.filter((fx) => fx.ttl > 0);
}
