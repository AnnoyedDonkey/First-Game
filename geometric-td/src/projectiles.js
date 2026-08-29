// ============================================================
// PROJECTILES & EFFECTS — pulse orbs, and the short-lived visual
// effects list (beams, rings, bursts, tile flashes).
// ============================================================

import { enemyPosition, damageEnemy } from "./enemies.js";
import { emitHitSparks } from "./particles.js";
import { VFX, LOOT } from "./config.js";

// Visual/feel tuning for projectiles.
const ORB = {
  hitDistance: 8,          // px from target that counts as impact
};

export function spawnPulseOrb(game, tower, targetEnemy, shot) {
  const start = { x: tower.pos.x, y: tower.pos.y };
  const projectile = {
    kind: "orb",
    x: start.x,
    y: start.y,
    target: targetEnemy,             // homes while the enemy lives
    lastTargetPos: enemyPosition(targetEnemy, game.grid),
    speed: tower.def.projectileSpeed * tower.projectileSpeedMult * game.grid.tileSize,
    damage: shot.damage,
    crit: shot.crit,
    splashRadius: tower.splashRadius,
    color: shot.color || tower.def.color, // gold while the tower is surging (level-up buff)
    sourceTower: tower,
  };
  // Combat-only recursion context must not ride the serialized co-op cosmetic
  // projectile payload (it contains a live tower reference).
  Object.defineProperty(projectile, "_hitCtx", { value: shot.ctx, writable: true });
  game.projectiles.push(projectile);
}

// A rocket: like a pulse orb but faster and launched from ANYWHERE at the
// target (the Rocket Launcher has global range). Explodes with splash on
// impact via the shared explode() below.
export function spawnRocket(game, tower, targetEnemy, shot) {
  const projectile = {
    kind: "rocket",
    x: tower.pos.x,
    y: tower.pos.y,
    target: targetEnemy,
    lastTargetPos: enemyPosition(targetEnemy, game.grid),
    speed: tower.def.projectileSpeed * tower.projectileSpeedMult * game.grid.tileSize,
    damage: shot.damage,
    crit: shot.crit,
    splashRadius: tower.splashRadius,
    color: shot.color || tower.def.color, // gold while the tower is surging (level-up buff)
    sourceTower: tower,
  };
  Object.defineProperty(projectile, "_hitCtx", { value: shot.ctx, writable: true });
  game.projectiles.push(projectile);
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
  const rocket = orb.kind === "rocket";
  game.effects.push({
    kind: "ring",
    x: orb.x,
    y: orb.y,
    color: orb.color,
    radius: orb.splashRadius,
    ttl: rocket ? 0.35 : 0.25,
    maxTtl: rocket ? 0.35 : 0.25,
  });
  // Rockets go off with a bigger flash, more sparks, and a heavier
  // ground shock than a pulse orb.
  if (rocket) {
    game.effects.push({
      kind: "burst", x: orb.x, y: orb.y, color: orb.color,
      radius: orb.splashRadius * 1.1, ttl: 0.4, maxTtl: 0.4,
    });
  }
  // A mirrored projectile recreates these impact sparks locally. When the
  // host has its co-op sink, do not also duplicate the same burst over `cmd`.
  const syncImpactSparks = !game.coopEventSink;
  emitHitSparks(game, orb.x, orb.y, orb.color, rocket ? 34 : 18, syncImpactSparks);
  if (orb.crit) {
    emitHitSparks(game, orb.x, orb.y, "#ffffff", 18, syncImpactSparks);
    game.effects.push({
      kind: "ring", x: orb.x, y: orb.y, color: "#ffffff",
      radius: orb.splashRadius * 0.7, ttl: 0.22, maxTtl: 0.22,
    });
  }
  game.springGrid.applyShock(
    orb.x, orb.y,
    game.grid.tileSize * VFX.warp.shockRadiusTiles * (rocket ? 1.6 : 1),
    VFX.warp.hitShock * (rocket ? 4 : 2)
  );

  // Cosmetic guest projectiles own flight and impact presentation only. The
  // host's snapshots remain the sole source of enemy health and deaths.
  if (!orb.cosmetic) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const pos = enemyPosition(e, game.grid);
      const dx = pos.x - orb.x;
      const dy = pos.y - orb.y;
      if (dx * dx + dy * dy <= orb.splashRadius * orb.splashRadius) {
        damageEnemy(game, e, orb.sourceTower, orb.damage, orb._hitCtx);
      }
    }
  }

  const fractalWarhead = orb.cosmetic
    ? orb.fractalWarhead
    : orb.sourceTower.gearUniques && orb.sourceTower.gearUniques.has("fractalWarhead");
  if (rocket && fractalWarhead) {
    explodeBomblets(game, orb);
  }
}

function explodeBomblets(game, orb) {
  const count = LOOT.combat.fractalBomblets;
  const offset = LOOT.combat.fractalOffsetTiles * game.grid.tileSize;
  const radius = orb.splashRadius * LOOT.combat.fractalRadius / 100;
  const damage = orb.damage * LOOT.combat.fractalDamage / 100;
  const sourceAimAngle = orb.cosmetic ? orb.sourceAimAngle : orb.sourceTower.aimAngle;
  const hitCtx = orb.cosmetic ? null : {
    source: orb.sourceTower, sourceType: orb.sourceTower.type,
    triggered: true, canProc: false,
  };
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + sourceAimAngle;
    const x = orb.x + Math.cos(angle) * offset;
    const y = orb.y + Math.sin(angle) * offset;
    game.effects.push({
      kind: "burst", x, y, color: orb.color,
      radius, ttl: 0.28, maxTtl: 0.28,
    });
    emitHitSparks(game, x, y, orb.color, 10, !game.coopEventSink);
    if (orb.cosmetic) continue;
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      const pos = enemyPosition(enemy, game.grid);
      const dx = pos.x - x;
      const dy = pos.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        damageEnemy(game, enemy, orb.sourceTower, damage, hitCtx);
      }
    }
  }
}

// Tick down all transient visual effects.
export function updateEffects(game, dt) {
  for (const fx of game.effects) {
    fx.ttl -= dt;
    // An effect may ask for the moment it finishes to be stamped on the game
    // (`expireStamp: "someField"`), so other systems can react to it ending
    // without this module knowing what the effect was. The gear-drop flash
    // uses it to tell Indy-7's face it just swallowed a piece of loot.
    if (fx.ttl <= 0 && fx.expireStamp) game[fx.expireStamp] = game.time;
  }
  game.effects = game.effects.filter((fx) => fx.ttl > 0);
}
