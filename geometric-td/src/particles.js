// ============================================================
// PARTICLES — sparks on hits, polygon-shard explosions on deaths.
//
// GeoDefense-style: enemies shatter into their own edge segments,
// which fly outward, spin, and fade. Everything is drawn with
// additive blending in the renderer so overlaps bloom.
// ============================================================

import { VFX, SHAPE_SIDES } from "./config.js";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Respect the particle cap: drop the oldest when full.
function push(game, particle) {
  if (game.particles.length >= VFX.maxParticles) game.particles.shift();
  game.particles.push(particle);
}

// Spark burst (projectile/beam impacts) — firework-style, with a
// few white-hot sparks mixed in for extra pop.
export function emitHitSparks(game, x, y, color, count = VFX.hitSparkCount) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = rand(VFX.sparkSpeed[0], VFX.sparkSpeed[1]);
    push(game, {
      kind: "spark",
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color: i % 4 === 0 ? "#ffffff" : color,
      size: rand(1.5, 3.2),
      ttl: rand(VFX.sparkTtl[0], VFX.sparkTtl[1]),
      maxTtl: VFX.sparkTtl[1],
    });
  }
}

// The signature effect: the enemy's polygon breaks into its own
// edges, which fly apart as spinning line segments.
// `power` = the killing tower's level: stronger towers blow enemies
// apart into more, faster pieces.
export function emitDeathShards(game, x, y, def, tileSize, power = 1) {
  const sides = SHAPE_SIDES[def.shape] ?? 3;
  const radius = tileSize * def.size;
  const isBoss = def.shape === "octagon";
  // Base pieces per edge, +1 at tower level 3, +1 more at level 5.
  const splits = (isBoss ? 3 : 1) + (power >= 3 ? 1 : 0) + (power >= 5 ? 1 : 0);
  const speedMult = (isBoss ? 1.4 : 1) * (1 + 0.09 * (power - 1));

  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2 - Math.PI / 2;
    const edgeLen = Math.hypot(
      Math.cos(a1) - Math.cos(a0),
      Math.sin(a1) - Math.sin(a0)
    ) * radius;

    for (let s = 0; s < splits; s++) {
      // Midpoint angle of this piece of the edge.
      const t = (s + 0.5) / splits;
      const mid = a0 + (a1 - a0) * t;
      const mx = x + Math.cos(mid) * radius;
      const my = y + Math.sin(mid) * radius;
      const speed = rand(VFX.shardSpeed[0], VFX.shardSpeed[1]) * speedMult;
      push(game, {
        kind: "shard",
        x: mx, y: my,
        vx: Math.cos(mid) * speed + rand(-30, 30),
        vy: Math.sin(mid) * speed + rand(-30, 30),
        rot: mid + Math.PI / 2, // start aligned with the edge
        spin: rand(-7, 7),
        len: edgeLen / splits,
        color: def.color,
        ttl: rand(VFX.shardTtl[0], VFX.shardTtl[1]),
        maxTtl: VFX.shardTtl[1],
      });
    }
  }

  const sparkCount =
    VFX.deathSparkCount * (isBoss ? 3 : 1) + VFX.powerSparkBonus * (power - 1);
  emitHitSparks(game, x, y, def.color, sparkCount);
}

export function updateParticles(game, dt) {
  const drag = 2.2;
  for (const p of game.particles) {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx -= p.vx * drag * dt;
    p.vy -= p.vy * drag * dt;
    if (p.spin) p.rot += p.spin * dt;
  }
  game.particles = game.particles.filter((p) => p.ttl > 0);
}
