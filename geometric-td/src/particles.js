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
export function emitHitSparks(
  game, x, y, color, count = VFX.hitSparkCount, sync = true
) {
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
  if (sync) game.coopEventSink?.({ kind: "hit", x, y, color, count });
}

// Golden level-up splash: the power surge breaks apart into a shimmering
// spray of gold + white-hot sparks. Uses its own VFX.levelUp knobs so the
// shimmer can be tuned independently of combat-hit sparks.
export function emitLevelUpSplash(game, x, y) {
  const lu = VFX.levelUp;
  // Sparks fade on the speed-scaled game clock; scale their lifetime up by the
  // current speed so the splash reads for a constant real-time length at x2/x4.
  const spd = game.effectiveSpeed || 1;
  for (let i = 0; i < lu.splashSparks; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = rand(lu.splashSpeed[0], lu.splashSpeed[1]);
    push(game, {
      kind: "spark",
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color: i % 3 === 0 ? "#ffffff" : lu.color, // white-hot glints shimmer through the gold
      size: rand(1.6, 3.4),
      ttl: rand(lu.splashTtl[0], lu.splashTtl[1]) * spd,
      maxTtl: lu.splashTtl[1] * spd,
    });
  }
}

// Credit Juice: coins that pop out of a dying enemy. Full-circle spray
// biased upward so it fountains up and rains back down, then each coin
// settles at a random spot near the death point and fades. `tileSize` is
// passed in by the caller rather than pulled from grid state (see
// enemies.js). `speedMult` lets bosses throw their haul harder (bossSpeedMult).
export function emitCoins(game, x, y, count, speedMult = 1, tileSize) {
  const c = VFX.coins;
  for (let i = 0; i < count; i++) {
    const rest = rand(c.restTtl[0], c.restTtl[1]);
    const a = Math.random() * Math.PI * 2;
    let dx = Math.cos(a);
    let dy = Math.sin(a);
    // Blend the vertical component toward straight-up by upBias so the
    // spray fountains rather than firing sideways.
    dy = dy * (1 - c.upBias) + -1 * c.upBias;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const speed = rand(c.speed[0], c.speed[1]) * speedMult;
    push(game, {
      kind: "coin",
      x, y,
      vx: dx * speed,
      vy: dy * speed,
      size: rand(c.size[0], c.size[1]),
      color: c.color,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() < 0.5 ? -1 : 1) * rand(c.spin[0], c.spin[1]),
      landY: y + rand(0, c.landSpreadTiles) * tileSize,
      landed: false,
      // A coin is fully bright for its whole flight and only fades once it
      // has settled, so ttl/maxTtl are seeded from restTtl (ttl === maxTtl
      // keeps life at 1 in the air). `flight` is a separate safety budget:
      // a coin flung near-vertically can be airborne longer than any single
      // fade would allow, so airborne time must NOT consume ttl or fast
      // coins would wink out mid-arc.
      flight: rand(c.flightTtl[0], c.flightTtl[1]),
      ttl: rest,
      maxTtl: rest,
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
  // The enclosing kill event recreates the whole shatter on a guest, including
  // these sparks. Do not also fan them out as a separate hit event.
  emitHitSparks(game, x, y, def.color, sparkCount, false);
}

export function updateParticles(game, dt) {
  const drag = 2.2;
  const c = VFX.coins;
  for (const p of game.particles) {
    if (p.kind === "coin") {
      // Coins arc under gravity, land, and settle — unlike sparks/shards
      // they don't just drift-and-fade in a straight line. Airborne time
      // burns `flight`, NOT `ttl`, so a coin stays fully bright for its
      // whole arc and only starts fading once it has landed.
      if (!p.landed) {
        p.flight -= dt;
        p.vy += c.gravity * dt;
        p.vx -= p.vx * c.drag * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        // Land on contact — or force it down if the flight budget runs out,
        // since a near-vertical throw can outlast any single fade window.
        if ((p.y >= p.landY && p.vy > 0) || p.flight <= 0) {
          p.landed = true;
          p.vx = 0;
          p.vy = 0;
          p.y = p.landY;
        }
      } else {
        // Settled flat: spin damps toward 0, position holds until it fades.
        p.ttl -= dt;
        p.spin -= p.spin * c.spinDamp * dt;
        p.rot += p.spin * dt;
      }
      continue;
    }

    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx -= p.vx * drag * dt;
    p.vy -= p.vy * drag * dt;
    if (p.spin) p.rot += p.spin * dt;
  }
  game.particles = game.particles.filter((p) => p.ttl > 0);
}
