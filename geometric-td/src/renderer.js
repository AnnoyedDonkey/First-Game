// ============================================================
// RENDERER — all canvas drawing. The neon look lives here.
// ============================================================

import { enemyPosition } from "./enemies.js";
import { isUpgradeEligible } from "./towers.js";
import { SHAPE_SIDES, VFX, ENEMIES } from "./config.js";
import { GEAR_SLOTS } from "./equipment.js";

// Rarity accent colors for in-battle gear orbitals (B4). Mirrors the
// RARITY_COLOR map in ui.js — kept local so the renderer takes no UI import.
export const GEAR_RARITY_COLOR = {
  common: "#b7c0d5", enhanced: "#4affa1", rare: "#35e0ff",
  prismatic: "#ff3fd4", singularity: "#ffe24a",
};
const GEAR_RARITY_RANK = { common: 0, enhanced: 1, rare: 2, prismatic: 3, singularity: 4 };

// Visual tuning — tweak the look here.
const LOOK = {
  background: "#05060f",
  gridLine: "rgba(80, 120, 255, 0.09)",
  gridLineMajor: "rgba(80, 120, 255, 0.16)", // tile-boundary lines
  buildableDot: "rgba(80, 120, 255, 0.22)",
  pathChannel: "rgba(8, 32, 44, 0.85)",   // dark channel interior
  pathEdge: "rgba(53, 224, 255, 0.55)",   // glowing channel edges
  pathFlow: "rgba(53, 224, 255, 0.7)",    // the animated dashes
  pathFlowSpeed: 40,                       // dash scroll speed, px/sec
  blockedFill: "rgba(255, 74, 94, 0.07)",
  blockedEdge: "rgba(255, 74, 94, 0.4)",
  coreColor: "#4affa1",
  portalColor: "#ffe24a",
  healthArc: "#4affa1",
  towerRadius: 0.22,      // tower size as fraction of tile (was 0.3)
  lineWidth: 1.5,         // main stroke width (was 2)
};

// ---------- Glow sprites ----------
// Pre-rendered radial-gradient discs, drawn with additive blending.
// Far cheaper on mobile Safari than per-frame shadowBlur.
const glowCache = new Map();

function glowSprite(color) {
  let sprite = glowCache.get(color);
  if (sprite) return sprite;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(color, c);
  return c;
}

function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

// Per-level palette: levels may override any LOOK color via their
// `palette` field (see levels.js). Cached per level id.
let pal = LOOK;
const paletteCache = new Map();
const circuitCache = new Map();
const RENDER_CACHE_LIMIT = 8;

function cacheRenderAsset(cache, key, value) {
  // The real board and tower-intro demos alternate every frame while a card
  // is open. Keep both hot, but bound the cache so visiting many levels does
  // not retain every offscreen canvas for the lifetime of the page.
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > RENDER_CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
  return value;
}

function activePalette(game) {
  const key = game.level.id;
  if (paletteCache.has(key)) {
    pal = cacheRenderAsset(paletteCache, key, paletteCache.get(key));
  } else {
    pal = cacheRenderAsset(
      paletteCache,
      key,
      game.level.palette ? { ...LOOK, ...game.level.palette } : LOOK
    );
  }
  return pal;
}

// ---------- Circuit-board map decoration ----------
// The world menus draw levels as neon circuit boards; this carries the same
// vocabulary (traces, solder pads, vias, silkscreen hexes) onto the battle
// map itself. The layout is deterministic per level (seeded by level id),
// tinted from the level palette, and pre-rendered ONCE to an offscreen
// canvas — the per-frame cost is a single drawImage. Knobs: VFX.circuit.

// Tiny deterministic RNG (mulberry32) seeded from the level id.
function circuitRng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "r, g, b" out of a palette color (rgba(...) or #rrggbb) so the layer can
// re-alpha the level's accent for traces/pads.
function rgbOf(color) {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) return m[1].split(",").slice(0, 3).map((s) => s.trim()).join(",");
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  return "53,224,255";
}

function buildCircuitLayer(game) {
  const grid = game.grid;
  const ts = grid.tileSize;
  const knobs = VFX.circuit;
  const rng = circuitRng(game.level.id);
  const rgb = rgbOf(pal.pathEdge);
  const tint = (a) => `rgba(${rgb},${a})`;

  const c = document.createElement("canvas");
  c.width = grid.width * ts;
  c.height = grid.height * ts;
  const g = c.getContext("2d");
  g.lineJoin = "round";
  g.lineCap = "round";

  const key = (x, y) => `${x},${y}`;
  const used = new Set(); // tiles already carrying a trace — keeps it clean

  const pad = (x, y, r, alpha) => {
    g.strokeStyle = tint(alpha);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = tint(alpha * 0.8);
    g.beginPath();
    g.arc(x, y, r * 0.4, 0, Math.PI * 2);
    g.fill();
  };

  // Wandering traces: orthogonal walks across buildable tiles (the menu
  // boards' right-angle "grid" style), each ending in a solder pad.
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let attempt = 0; attempt < knobs.traceCount; attempt++) {
    let x = Math.floor(rng() * grid.width);
    let y = Math.floor(rng() * grid.height);
    if (!grid.isBuildable(x, y) || used.has(key(x, y))) continue;

    const corners = [[x, y]];
    const tiles = [[x, y]];
    let dir = DIRS[Math.floor(rng() * 4)];
    const segments = 2 + Math.floor(rng() * 3);
    for (let s = 0; s < segments; s++) {
      const len = 1 + Math.floor(rng() * 3);
      let moved = 0;
      for (let i = 0; i < len; i++) {
        const nx = x + dir[0], ny = y + dir[1];
        if (!grid.isBuildable(nx, ny) || used.has(key(nx, ny))) break;
        x = nx; y = ny;
        tiles.push([x, y]);
        moved++;
      }
      if (moved > 0) corners.push([x, y]);
      // Turn perpendicular for the next segment.
      dir = dir[0] !== 0
        ? [0, rng() < 0.5 ? 1 : -1]
        : [rng() < 0.5 ? 1 : -1, 0];
    }
    if (tiles.length < 3) continue; // too stubby to read as a trace

    for (const [tx, ty] of tiles) used.add(key(tx, ty));
    const pts = corners.map(([cx, cy]) => grid.tileCenter(cx, cy));

    g.strokeStyle = tint(knobs.traceAlpha);
    g.lineWidth = knobs.traceWidth;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();

    // Via dots on the interior corners, solder pads on both ends.
    g.fillStyle = tint(knobs.padAlpha * 0.7);
    for (let i = 1; i < pts.length - 1; i++) {
      g.beginPath();
      g.arc(pts[i].x, pts[i].y, knobs.traceWidth * 0.9, 0, Math.PI * 2);
      g.fill();
    }
    pad(pts[0].x, pts[0].y, ts * 0.07, knobs.padAlpha * 0.7);
    pad(pts[pts.length - 1].x, pts[pts.length - 1].y, ts * 0.11, knobs.padAlpha);
  }

  // Lone vias + silkscreen hexes on tiles no trace touched.
  const sprinkle = (count, draw) => {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rng() * grid.width);
      const y = Math.floor(rng() * grid.height);
      if (!grid.isBuildable(x, y) || used.has(key(x, y))) continue;
      used.add(key(x, y));
      const p = grid.tileCenter(x, y);
      draw(p);
    }
  };
  sprinkle(knobs.viaCount, (p) => pad(p.x, p.y, ts * 0.06, knobs.viaAlpha));
  sprinkle(knobs.hexCount, (p) => {
    g.strokeStyle = tint(knobs.hexAlpha);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = (Math.PI / 3) * i - Math.PI / 6;
      const hx = p.x + ts * 0.2 * Math.cos(t);
      const hy = p.y + ts * 0.2 * Math.sin(t);
      i ? g.lineTo(hx, hy) : g.moveTo(hx, hy);
    }
    g.closePath();
    g.stroke();
  });

  // The core is the board's CPU: concentric rings + four diagonal stub
  // traces fanning out to pads (the PRISM DEEP menu's "rings" style).
  const core = grid.pathPoints[grid.pathPoints.length - 1];
  g.lineWidth = 1;
  for (const [r, a] of [[0.55, 1], [0.8, 0.6]]) {
    g.strokeStyle = tint(knobs.coreRingAlpha * a);
    g.beginPath();
    g.arc(core.x, core.y, ts * r, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = tint(knobs.coreRingAlpha * 0.8);
  g.lineWidth = knobs.traceWidth;
  for (let i = 0; i < 4; i++) {
    const t = (Math.PI / 2) * i + Math.PI / 4;
    const x0 = core.x + ts * 0.8 * Math.cos(t);
    const y0 = core.y + ts * 0.8 * Math.sin(t);
    const x1 = core.x + ts * 1.3 * Math.cos(t);
    const y1 = core.y + ts * 1.3 * Math.sin(t);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    pad(x1, y1, ts * 0.08, knobs.coreRingAlpha);
  }

  // Pad ring under the spawn portal — enemies arrive through a socket.
  const portal = grid.pathPoints[0];
  g.strokeStyle = tint(knobs.portalRingAlpha);
  g.lineWidth = 1;
  g.setLineDash([3, 4]);
  g.beginPath();
  g.arc(portal.x, portal.y, ts * 0.48, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  return c;
}

function drawCircuitLayer(ctx, game) {
  const cacheKey = `${game.level.id}:${game.grid.tileSize}`;
  const circuitCanvas = circuitCache.has(cacheKey)
    ? cacheRenderAsset(circuitCache, cacheKey, circuitCache.get(cacheKey))
    : cacheRenderAsset(circuitCache, cacheKey, buildCircuitLayer(game));
  ctx.drawImage(circuitCanvas, 0, 0);
}

// uiState: { selectedType, selectedTower, hoverTile } from main.js
export function render(ctx, game, time, uiState = {}) {
  const { grid } = game;
  const ts = grid.tileSize;
  const w = grid.width * ts;
  const h = grid.height * ts;
  activePalette(game);

  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, w, h);

  drawCircuitLayer(ctx, game);
  drawWarpGrid(ctx, game);
  drawPath(ctx, grid, time);
  drawBlockedTiles(ctx, grid);
  drawFields(ctx, grid, time);
  drawConduits(ctx, grid, time);
  drawPortal(ctx, game, time);
  drawWormholes(ctx, grid, time);
  drawCore(ctx, game, time);
  drawPlacementPreview(ctx, game, uiState);
  drawTowers(ctx, game, uiState);
  drawEnemies(ctx, game);

  // Additive pass: everything glowing blooms where it overlaps.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawSurgeAura(ctx, game);
  drawTowerGear(ctx, game);
  drawProjectiles(ctx, game);
  drawEffects(ctx, game);
  drawParticles(ctx, game);
  ctx.restore();
}

// Sustained golden aura around a tower for the whole level-up buff window
// (game.time < tower._surgeUntil). Pulses like a heartbeat and tapers out over
// the buff's final moments, so the "powered up" state is unmissable and lasts
// as long as the boost — the fix for a one-frame flash getting lost at x2/x4.
// Runs in the additive pass (pre-rendered glow sprite, no shadowBlur). Knobs in
// config.js VFX.levelUp.
function drawSurgeAura(ctx, game) {
  const lu = VFX.levelUp;
  const ts = game.grid.tileSize;
  const time = game.time;
  for (const tower of game.towers) {
    const remain = (tower._surgeUntil || 0) - time;
    if (remain <= 0) continue;
    const pulse = 0.5 + 0.5 * Math.sin(time * lu.auraPulseRate); // 0..1 heartbeat
    let alpha = lu.auraAlpha * (1 + lu.auraPulseDepth * (pulse - 0.5) * 2);
    if (remain < lu.auraFadeSeconds) alpha *= remain / lu.auraFadeSeconds; // taper out
    const radius = ts * lu.auraRadiusTiles * (1 + 0.08 * (pulse - 0.5) * 2);
    drawGlow(ctx, tower.pos.x, tower.pos.y, radius, lu.color, alpha);
  }
}

// Orbiting rarity diamonds + aura for towers carrying gear (B4). Runs inside
// the additive pass so the diamonds and aura bloom. Answers "which towers
// have gear" at a glance and rewards good equipment with pizzazz. Knobs in
// config.js VFX.gear.
function drawTowerGear(ctx, game) {
  const ts = game.grid.tileSize;
  const time = game.time;
  const g = VFX.gear;
  const orbitR = ts * g.orbitRadius;
  const half = g.diamondSize / 2;

  for (const tower of game.towers) {
    const gear = tower.gear;
    if (!gear) continue;

    // Collect equipped items in a stable slot order (one orbital each).
    const colors = [];
    let bestColor = null, bestRank = -1, hasSingularity = false;
    for (const slot of GEAR_SLOTS) {
      const item = gear[slot];
      if (!item) continue;
      const color = GEAR_RARITY_COLOR[item.rarity] || GEAR_RARITY_COLOR.common;
      colors.push(color);
      const rank = GEAR_RARITY_RANK[item.rarity] ?? 0;
      if (rank > bestRank) { bestRank = rank; bestColor = color; }
      if (item.rarity === "singularity") hasSingularity = true;
    }
    if (!colors.length) continue;

    const cx = tower.pos.x, cy = tower.pos.y;

    // Faint aura tinted by the best rarity; singularity gear makes it shimmer.
    let auraAlpha = g.auraAlpha;
    if (hasSingularity) {
      auraAlpha *= 1 + g.shimmerDepth * (0.5 + 0.5 * Math.sin(time * g.shimmerSpeed));
    }
    drawGlow(ctx, cx, cy, ts * g.auraRadius, bestColor, auraAlpha);

    // Orbiting diamonds, evenly spaced, slow rotation.
    const n = colors.length;
    for (let i = 0; i < n; i++) {
      const ang = time * g.orbitSpeed + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(ang) * orbitR;
      const y = cy + Math.sin(ang) * orbitR;
      drawGlow(ctx, x, y, g.orbitGlow, colors[i], g.orbitGlowAlpha);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4); // square rotated 45° reads as a diamond
      ctx.fillStyle = colors[i];
      ctx.fillRect(-half, -half, g.diamondSize, g.diamondSize);
      ctx.restore();
    }
  }
}

// The spring-mesh background grid — lines pass through the simulated
// node positions, so shockwaves visibly ripple across the board.
function drawWarpGrid(ctx, game) {
  const grid = game.grid;
  const sg = game.springGrid;
  const ts = grid.tileSize;
  // How many mesh nodes per tile boundary (spacing 0.5 tiles -> 2).
  const perTile = Math.round(ts / sg.spacing);

  ctx.lineWidth = 1;
  for (let r = 0; r < sg.rows; r++) {
    ctx.strokeStyle = r % perTile === 0 ? pal.gridLineMajor : pal.gridLine;
    ctx.beginPath();
    for (let c = 0; c < sg.cols; c++) {
      const x = sg.homeX(c) + sg.dispX(c, r);
      const y = sg.homeY(r) + sg.dispY(c, r);
      if (c === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let c = 0; c < sg.cols; c++) {
    ctx.strokeStyle = c % perTile === 0 ? pal.gridLineMajor : pal.gridLine;
    ctx.beginPath();
    for (let r = 0; r < sg.rows; r++) {
      const x = sg.homeX(c) + sg.dispX(c, r);
      const y = sg.homeY(r) + sg.dispY(c, r);
      if (r === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Small dot on every buildable tile so players can read the board.
  ctx.fillStyle = pal.buildableDot;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.isBuildable(x, y)) continue;
      const c = grid.tileCenter(x, y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// GeoDefense-style path: a dark outlined channel with rounded
// corners and glowing edges, instead of filled tiles.
function drawPath(ctx, grid, time) {
  const ts = grid.tileSize;
  const pts = grid.pathPoints;
  const channelWidth = ts * 0.62;

  function tracePath() {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Wide glowing stroke first...
  ctx.strokeStyle = pal.pathEdge;
  ctx.lineWidth = channelWidth;
  tracePath();
  ctx.stroke();
  // ...then a slightly narrower dark stroke, leaving 2px neon edges.
  ctx.strokeStyle = pal.pathChannel;
  ctx.lineWidth = channelWidth - 4;
  tracePath();
  ctx.stroke();

  // Animated dashes flowing toward the core.
  ctx.strokeStyle = pal.pathFlow;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 16]);
  ctx.lineDashOffset = -time * pal.pathFlowSpeed;
  tracePath();
  ctx.stroke();
  ctx.restore();
}

// Blocked tiles read as soldered IC chips: a dark package body with pin
// stubs down both sides and a small X inside (kept so "can't build here"
// still reads at a glance). Matches the circuit-board decoration layer.
function drawBlockedTiles(ctx, grid) {
  const ts = grid.tileSize;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.isBlocked(x, y)) continue;
      const px = x * ts;
      const py = y * ts;
      const inset = ts * 0.18;   // chip body inset from the tile edge
      const bx = px + inset, by = py + inset;
      const bw = ts - inset * 2, bh = ts - inset * 2;

      // Pin stubs first, so the body edge overlaps their roots.
      ctx.strokeStyle = pal.blockedEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const pinY = by + bh * (0.25 + 0.25 * i);
        ctx.moveTo(bx - ts * 0.09, pinY);
        ctx.lineTo(bx, pinY);
        ctx.moveTo(bx + bw, pinY);
        ctx.lineTo(bx + bw + ts * 0.09, pinY);
      }
      ctx.stroke();

      // Package body.
      ctx.fillStyle = "rgba(10, 8, 14, 0.85)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = pal.blockedFill;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = pal.blockedEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);

      // Pin-1 notch dot, like a real IC package.
      ctx.fillStyle = pal.blockedEdge;
      ctx.beginPath();
      ctx.arc(bx + bw * 0.2, by + bh * 0.2, ts * 0.035, 0, Math.PI * 2);
      ctx.fill();

      // Small X so "unbuildable" still reads instantly.
      const xr = ts * 0.12;
      const cx = bx + bw / 2, cy = by + bh / 2;
      ctx.strokeStyle = pal.blockedEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - xr, cy - xr);
      ctx.lineTo(cx + xr, cy + xr);
      ctx.moveTo(cx + xr, cy - xr);
      ctx.lineTo(cx - xr, cy + xr);
      ctx.stroke();
    }
  }
}

// ---- Reactive endpoint faces (config VFX.face) ----
// Indy-7 (core) and Bratwurst-XL (portal) wear eyes that react to the battle.
// EYES ONLY: no nose or mouth is ever drawn. The eye vocabulary mirrors the
// story-card avatars (ui.js avatarEye).
function strokeEye(ctx, ex, ey, er, mood, side) {
  ctx.beginPath();
  switch (mood) {
    case "happy": // ^ chevron — pleased
      ctx.moveTo(ex - er, ey + er * 0.55);
      ctx.lineTo(ex, ey - er * 0.7);
      ctx.lineTo(ex + er, ey + er * 0.55);
      break;
    case "worried": // ∩ raised brow — under threat
      ctx.moveTo(ex - er, ey + er * 0.3);
      ctx.quadraticCurveTo(ex, ey - er * 0.7, ex + er, ey + er * 0.3);
      break;
    case "smug": // flat line — condescending (Bratwurst at rest)
      ctx.moveTo(ex - er, ey - er * 0.1);
      ctx.lineTo(ex + er, ey - er * 0.1);
      break;
    case "angry": { // \  / slash angled down toward the nose — mean (attacking)
      const inX = side === "l" ? ex + er : ex - er;
      const outX = side === "l" ? ex - er : ex + er;
      ctx.moveTo(outX, ey - er * 0.6);
      ctx.lineTo(inX, ey + er * 0.4);
      break;
    }
    case "crash": // X — hit / knocked out
      ctx.moveTo(ex - er, ey - er);
      ctx.lineTo(ex + er, ey + er);
      ctx.moveTo(ex + er, ey - er);
      ctx.lineTo(ex - er, ey + er);
      break;
    case "blink": // — shut lid (a shallow closed curve)
      ctx.moveTo(ex - er, ey);
      ctx.quadraticCurveTo(ex, ey + er * 0.4, ex + er, ey);
      break;
    default: // neutral — a calm vertical bar
      ctx.moveTo(ex, ey - er);
      ctx.lineTo(ex, ey + er);
      break;
  }
  ctx.stroke();
}

// Deterministic idle blink: eyes shut for `blinkDuration` once per `interval`,
// `phase` desyncs the two personas. Some cycles get a quick second blink (a
// deterministic per-cycle roll). Time-based, so no extra per-frame state.
function isBlinking(time, interval, phase) {
  const k = VFX.face;
  const t = time + phase;
  const cycle = Math.floor(t / interval);
  const local = t - cycle * interval; // seconds into this blink cycle
  const d = k.blinkDuration;
  if (local < d) return true; // first blink
  // Roll once per cycle whether it's a double-blink; if so, a second blink
  // follows after a brief eyes-open gap.
  const roll = Math.abs(Math.sin(cycle * 91.73 + phase) * 4283.11) % 1;
  if (roll < k.doubleBlinkChance) {
    const s = d + k.blinkGap;
    if (local >= s && local < s + d) return true; // second blink
  }
  return false;
}

function drawFace(ctx, cx, cy, radius, mood, color, time, blinkInterval, blinkPhase) {
  const k = VFX.face;
  const dx = radius * k.eyeSpacing;
  const ey = cy - radius * k.eyeRise;
  const er = radius * k.eyeRadius;
  // Blink only over living expressions — an X-eyed (hit/defeated) face holds.
  const shown = (mood !== "crash" && isBlinking(time, blinkInterval, blinkPhase))
    ? "blink" : mood;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = k.glowBlur;
  ctx.lineWidth = k.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokeEye(ctx, cx - dx, ey, er, shown, "l");
  strokeEye(ctx, cx + dx, ey, er, shown, "r");
  ctx.restore();
}

// Bratwurst-XL's expression from live state. No `phase` (the tower-intro/
// onboarding demos) means "actively sending the swarm" → mean.
export function portalFaceMood(game) {
  if (!game || game.phase === undefined) return "angry";
  if (game.phase === "lost") return "happy"; // player lost → Bratwurst gloats
  if (game.phase === "won") return "crash";  // player won → Bratwurst defeated
  if (game.phase === "wave") return "angry"; // enemies coming out → mean
  return "smug";                             // between waves → condescending
}

// Indy-7's expression from live state. Priority: end states, a brief X-eye
// flinch right after a leak, low-HP worry, then calm.
export function coreFaceMood(game, time) {
  if (!game || game.phase === undefined) return "neutral";
  if (game.phase === "won") return "happy";
  if (game.phase === "lost") return "crash";
  const k = VFX.face;
  if (game.lastLeakTime != null && time - game.lastLeakTime < k.hitFlashSeconds) return "crash";
  // Just swallowed a piece of gear — Indy-7 is briefly delighted. Ranked below
  // a leak (getting hit still wins) but above worried, so the grin reads even
  // on a battered core; it's transient either way.
  if (game.lastGearIngestTime != null &&
      time - game.lastGearIngestTime < VFX.gearDrop.smileSeconds) return "happy";
  if (game.maxCoreHealth && game.coreHealth / game.maxCoreHealth <= k.lowCoreFrac) return "worried";
  return "neutral";
}

// Spawn portal at the path entrance: two counter-rotating squares + Bratwurst's
// reactive eyes (drawn upright, on top of the spinning frames).
function drawPortal(ctx, game, time) {
  const grid = game.grid;
  const p = grid.pathPoints[0];
  const r = grid.tileSize * 0.32;
  ctx.save();
  ctx.strokeStyle = LOOK.portalColor;
  ctx.shadowColor = LOOK.portalColor;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.5;
  for (const dir of [1, -1]) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(dir * time * 0.8);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.restore();
  drawFace(ctx, p.x, p.y, grid.tileSize * 0.32, portalFaceMood(game),
    VFX.face.eyeColorBrat, time, VFX.face.blinkIntervalBrat, VFX.face.blinkPhaseBrat);
}

// Field tiles: a tinted, gently pulsing wash + outline on each special path
// tile, color-coded by its dominant effect (config VFX.field). A tap shows a
// tooltip (ui.js) explaining the exact numbers.
export function fieldColor(f) {
  const k = VFX.field;
  if (f.speedMult > 1) return k.padColor;
  if (f.speedMult < 1) return k.tarColor;
  if (f.damageMult > 1) return k.weakColor;
  if (f.damageMult < 1) return k.shieldColor;
  return k.tarColor;
}
function drawFields(ctx, grid, time) {
  const tiles = grid.fieldTiles;
  if (!tiles || !tiles.length) return;
  const ts = grid.tileSize;
  const k = VFX.field;
  const pulse = 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(time * k.pulseRate));
  ctx.save();
  for (const f of tiles) {
    const col = fieldColor(f);
    const x = f.x * ts;
    const y = f.y * ts;
    ctx.globalAlpha = k.fillAlpha * pulse;
    ctx.fillStyle = col;
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    ctx.globalAlpha = k.edgeAlpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
  }
  ctx.restore();
}

// Conduit build tiles: a pulsing hexagonal power node marking a tile that
// buffs the tower placed on it (config VFX.conduit). Drawn before towers so a
// deployed tower sits on top of its node. A tap explains the exact buff (ui.js).
function drawConduits(ctx, grid, time) {
  const tiles = grid.conduitTiles;
  if (!tiles || !tiles.length) return;
  const ts = grid.tileSize;
  const k = VFX.conduit;
  const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(time * k.pulseRate));
  ctx.save();
  ctx.strokeStyle = k.color;
  ctx.fillStyle = k.color;
  for (const c of tiles) {
    const cx = (c.x + 0.5) * ts;
    const cy = (c.y + 0.5) * ts;
    ctx.globalAlpha = k.fillAlpha * pulse;
    ctx.fillRect(c.x * ts + 3, c.y * ts + 3, ts - 6, ts - 6);
    ctx.globalAlpha = k.edgeAlpha;
    ctx.lineWidth = 1.6;
    drawPolygon(ctx, cx, cy, ts * k.nodeRadiusTiles, 6, time * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

// Wormholes: paired path portals (config VFX.wormhole). Each end is a ring
// with two counter-rotating triangles — a violet "singularity" swirl. Enemies
// crossing the enter end are teleported to the exit end (see enemies.js).
function drawWormholes(ctx, grid, time) {
  const holes = grid.wormholes;
  if (!holes || !holes.length) return;
  const w = VFX.wormhole;
  const r = grid.tileSize * w.ringRadiusTiles;
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.6;
  for (const wh of holes) {
    // A filtered wormhole is tinted to the enemy type it teleports, so the
    // color tells you at a glance which enemies it grabs (default violet).
    const col = wh.types && ENEMIES[wh.types[0]] ? ENEMIES[wh.types[0]].color : w.color;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    for (const p of [wh.enterPos, wh.exitPos]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      for (const dir of [1, -1]) {
        drawPolygon(ctx, p.x, p.y, r * 0.6, 3, dir * time * w.spinRate);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// The AI Core at the path exit: a pulsing glowing hexagon.
function drawCore(ctx, game, time) {
  const grid = game.grid;
  const p = grid.pathPoints[grid.pathPoints.length - 1];
  const pulse = 1 + Math.sin(time * 3) * 0.08;
  const r = grid.tileSize * 0.34 * pulse;

  ctx.save();
  ctx.strokeStyle = LOOK.coreColor;
  ctx.shadowColor = LOOK.coreColor;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 2;
  drawPolygon(ctx, p.x, p.y, r, 6, time * 0.4);
  ctx.stroke();
  ctx.restore();
  // Indy-7's reactive eyes replace the old center dot (eyes only, no mouth).
  // Sized off a stable radius so the face doesn't breathe with the core pulse.
  drawFace(ctx, p.x, p.y, grid.tileSize * 0.34, coreFaceMood(game, time),
    VFX.face.eyeColorIndy, time, VFX.face.blinkIntervalIndy, 0);
}

// The handful of numbers that define how an enemy LOOKS, exported so the
// enemy-intro card's parade (ui.js enemyGlyphSvg) can draw from the same
// values instead of eyeballing them — a mismatch here is exactly what made
// the card's enemies read as "not the ones in the game".
export const ENEMY_LOOK = {
  lineWidth: LOOK.lineWidth, // stroke width, in internal render px
  glowBlur: 8,               // ctx.shadowBlur in the enemy's own color
  // Radians of spin per px travelled — enemies rotate as they move so they
  // feel alive. The card converts this to a duration via the type's speed.
  spinPerPx: 0.01,
};

function drawEnemies(ctx, game) {
  const grid = game.grid;
  const ts = grid.tileSize;

  for (const e of game.enemies) {
    if (!e.alive) continue;
    const pos = enemyPosition(e, grid);
    const r = ts * e.def.size;
    const flashing = e.hitFlash > 0;

    ctx.save();
    ctx.strokeStyle = flashing ? "#ffffff" : e.def.color;
    ctx.shadowColor = e.def.color;
    ctx.shadowBlur = ENEMY_LOOK.glowBlur;
    ctx.lineWidth = ENEMY_LOOK.lineWidth;

    const sides = SHAPE_SIDES[e.def.shape] ?? 3;
    // Rotate slowly as they move so they feel alive.
    const angle = e.distance * ENEMY_LOOK.spinPerPx;
    drawPolygon(ctx, pos.x, pos.y, r, sides, angle);
    ctx.stroke();

    // Health as a thin arc hugging the shape (no floating bars).
    if (e.health < e.maxHealth) {
      const frac = Math.max(0, e.health / e.maxHealth);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = LOOK.healthArc;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 3.5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- Towers ----------

const TOWER_SIDES = { laser: 4, pulse: 12, slow: 6, railgun: 3, rocket: 5 };

function drawTowerShape(ctx, tower, ts, x, y) {
  const r = ts * LOOK.towerRadius;
  const sides = TOWER_SIDES[tower.type] ?? 4;
  drawPolygon(ctx, x, y, r, sides, tower.aimAngle + Math.PI / 4);
  ctx.stroke();

  // Barrel line showing where the tower is aiming.
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(tower.aimAngle) * r, y + Math.sin(tower.aimAngle) * r);
  ctx.stroke();
}

// Railgun wind-up: a shrinking, brightening ring converges on the barrel tip
// while a core glow swells there — reading as energy building toward release.
// Progress p (0->1) tracks tower._chargeStart over tower.chargeSeconds (game-
// time), so it speeds up with the game clock like everything else. Knobs live
// in config VFX.railgun.
function drawRailCharge(ctx, tower, ts, time) {
  const rg = VFX.railgun;
  const dur = tower.chargeSeconds || rg.chargeSeconds;
  const p = Math.min(1, Math.max(0, (time - (tower._chargeStart || time)) / dur));
  const bx = tower.pos.x + Math.cos(tower.aimAngle) * ts * 0.24;
  const by = tower.pos.y + Math.sin(tower.aimAngle) * ts * 0.24;
  ctx.save();
  // Building core glow at the barrel tip (sprite-based; grows with the charge).
  ctx.shadowBlur = 0;
  drawGlow(ctx, bx, by, ts * rg.chargeCoreTiles * (0.3 + 0.7 * p), rg.chargeColor, 0.35 + 0.6 * p);
  // Converging ring: shrinks inward and brightens as the charge builds.
  ctx.strokeStyle = rg.chargeColor;
  ctx.shadowColor = rg.chargeColor;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.35 + 0.55 * p;
  ctx.lineWidth = 1.1 + p * 1.6;
  ctx.beginPath();
  ctx.arc(bx, by, ts * rg.chargeRingTiles * (1 - 0.82 * p), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTowers(ctx, game, uiState) {
  const ts = game.grid.tileSize;
  const time = game.time;
  for (const tower of game.towers) {
    ctx.save();
    ctx.strokeStyle = tower.def.color;
    ctx.shadowColor = tower.def.color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = LOOK.lineWidth;
    drawTowerShape(ctx, tower, ts, tower.pos.x, tower.pos.y);

    // Railgun charge-up: a converging ring + a building core glow at the barrel
    // that swell as the capacitor spins toward release (see towers.js / VFX.railgun).
    if (tower.type === "railgun" && tower._charging) {
      drawRailCharge(ctx, tower, ts, time);
    }

    // Level pips under the tower (one dot per level above 1).
    if (tower.level > 1) {
      ctx.fillStyle = tower.def.color;
      const n = tower.level - 1;
      const spread = 7;
      for (let i = 0; i < n; i++) {
        const px = tower.pos.x + (i - (n - 1) / 2) * spread;
        ctx.beginPath();
        ctx.arc(px, tower.pos.y + ts * 0.32, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pulsing chevron above towers that are ready to upgrade.
    if (isUpgradeEligible(tower)) {
      const bob = Math.sin(time * 5) * 2;
      const cx = tower.pos.x;
      const cy = tower.pos.y - ts * 0.42 + bob;
      ctx.strokeStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 4);
      ctx.lineTo(cx, cy - 3);
      ctx.lineTo(cx + 6, cy + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Range ring for the selected tower — dashes slowly rotate. Skipped for
  // global-range towers (Rocket), whose ring would span the whole board.
  const sel = uiState.selectedTower;
  if (sel && sel.range < game.grid.tileSize * (game.grid.width + game.grid.height)) {
    ctx.save();
    ctx.strokeStyle = sel.def.color;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -time * 14;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(sel.pos.x, sel.pos.y, sel.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Ghost tower + range ring on the hovered tile while a type is selected.
function drawPlacementPreview(ctx, game, uiState) {
  const { selectedType, hoverTile } = uiState;
  if (!selectedType || !hoverTile) return;

  const grid = game.grid;
  const ts = grid.tileSize;
  const { x, y } = hoverTile;
  if (!grid.isInside(x, y)) return;

  const def = uiState.selectedDef;
  const valid = grid.isBuildable(x, y) && !uiState.hoverOccupied;
  const color = valid ? def.color : "#ff4a5e";
  const c = grid.tileCenter(x, y);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = LOOK.lineWidth;

  drawPolygon(ctx, c.x, c.y, ts * LOOK.towerRadius, TOWER_SIDES[selectedType] ?? 4, Math.PI / 4);
  ctx.stroke();

  // Global-range towers (Rocket) cover the whole board — no meaningful
  // range circle to draw.
  if (def.baseRange < 50) {
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, def.baseRange * ts, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Projectiles & effects ----------

// NOTE: drawProjectiles/drawEffects/drawParticles run inside the
// additive ("lighter") pass — glow sprites instead of shadowBlur.

function drawProjectiles(ctx, game) {
  for (const p of game.projectiles) {
    if (p.kind === "rocket") {
      // A fiery exhaust trail behind the warhead, pointing back along travel.
      const dx = p.lastTargetPos.x - p.x;
      const dy = p.lastTargetPos.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const bx = p.x - (dx / d) * 14;
      const by = p.y - (dy / d) * 14;
      drawGlow(ctx, bx, by, 8, p.color, 0.5);
      drawGlow(ctx, p.x, p.y, 15, p.color, 0.95);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawGlow(ctx, p.x, p.y, 10, p.color, 0.9);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects(ctx, game) {
  for (const fx of game.effects) {
    const life = fx.ttl / fx.maxTtl; // 1 -> 0
    ctx.save();
    ctx.globalAlpha = life;
    ctx.strokeStyle = fx.color;

    if (fx.kind === "beam") {
      // fadeWidth beams (the railgun ray) also THIN as they fade, so the ray
      // vanishes gradually instead of just dimming at constant thickness.
      const w = (fx.width || 2) * (fx.fadeWidth ? (0.25 + 0.75 * life) : 1);
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
      drawGlow(ctx, fx.x2, fx.y2, 6 + w * 2, fx.color, life * 0.8);
    } else if (fx.kind === "muzzle") {
      drawGlow(ctx, fx.x, fx.y, fx.radius, fx.color, life);
    } else if (fx.kind === "ring" || fx.kind === "burst") {
      // Rings/bursts expand as they fade.
      const r = fx.radius * (fx.kind === "burst" ? 1.5 - life * 0.5 : 1.2 - life * 0.2);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();
      if (fx.kind === "burst") drawGlow(ctx, fx.x, fx.y, r * 0.8, fx.color, life * 0.6);
    } else if (fx.kind === "tileFlash") {
      const ts = game.grid.tileSize;
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = life * 0.35;
      ctx.fillRect(fx.x * ts, fx.y * ts, ts, ts);
    } else if (fx.kind === "floatText") {
      // Small label that drifts up and fades (e.g. tower "LEVEL UP"). Drawn in
      // the additive pass, so the gold glows over the tower without shadowBlur.
      // Ease-out on both fade and rise so it lingers legibly then whisps away.
      const t = 1 - life;                 // 0 -> 1 over its lifetime
      const y = fx.y - (fx.rise || 0) * (1 - (1 - t) * (1 - t));
      ctx.globalAlpha = life * life;      // hold, then fade quicker at the end
      ctx.fillStyle = fx.color;
      ctx.font = fx.font || "700 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fx.text, fx.x, y);
    } else if (fx.kind === "gearFlash") {
      // Credit Juice: gear-drop flash. Shows the dropped item's own SLOT
      // glyph — the same icon the stash draws, just smaller — in its rarity
      // color, so the player sees WHAT they got, not a generic marker. Pops
      // in, drifts up, and fades on floatText's rise/fade easing.
      const color = GEAR_RARITY_COLOR[fx.rarity] || GEAR_RARITY_COLOR.common;
      const t = 1 - life;                 // 0 -> 1 over its lifetime
      const topY = fx.y - fx.rise;        // where the lift tops out
      let x, y, scale, alpha;
      if (t < fx.riseFrac) {
        // Phase 1 — lift off the corpse, easing out so it slows at the top.
        const rt = t / fx.riseFrac;
        x = fx.x;
        y = fx.y - fx.rise * (1 - (1 - rt) * (1 - rt));
        // Pop in over the first popFrac of the rise.
        scale = rt < fx.popFrac
          ? fx.popScale - (fx.popScale - 1) * (rt / fx.popFrac)
          : 1;
        alpha = Math.min(1, rt / 0.15);   // quick fade-in so it doesn't blink on
      } else {
        // Phase 2 — zip into Indy-7, easing IN so it accelerates away, then
        // shrinks as the core swallows it.
        const zt = (t - fx.riseFrac) / (1 - fx.riseFrac);
        const ease = zt * zt;
        x = fx.x + (fx.tx - fx.x) * ease;
        y = topY + (fx.ty - topY) * ease;
        scale = 1 - (1 - fx.arriveScale) * zt;
        alpha = 1 - zt * zt * zt;         // holds bright, vanishes on arrival
      }
      // Expanding rarity ring over the first ringFrac of the life, anchored at
      // the drop point. Drawn here rather than pushed as a separate `ring`
      // effect so the drop site never has to resolve a color (see enemies.js).
      if (t < fx.ringFrac) {
        const rt = t / fx.ringFrac;       // 0 -> 1 across the ring's own life
        ctx.globalAlpha = (1 - rt) * (1 - rt);
        ctx.strokeStyle = color;
        ctx.lineWidth = LOOK.lineWidth;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.ringRadius * rt, 0, Math.PI * 2);
        ctx.stroke();
      }
      const side = fx.tile * scale;
      ctx.globalAlpha = alpha;
      drawGlow(ctx, x, y, side * fx.glowMult, color, alpha * 0.9);
      // The item's own stash tile: rounded plate, rarity border, slot glyph.
      roundRectPath(ctx, x - side / 2, y - side / 2, side, side, side * fx.cornerFrac);
      ctx.fillStyle = fx.tileFill;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = LOOK.lineWidth;
      ctx.stroke();
      drawSlotGlyph(ctx, fx.slot, x, y, side * fx.glyphFrac, color, fx.glyphStroke);
    }

    ctx.restore();
  }
}

// Rounded-rectangle path. Written by hand rather than using ctx.roundRect so
// older iOS Safari (the target platform) is covered.
function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// Gear SLOT glyph, drawn as a canvas path in the same 100x100 coordinate
// space `ui.js slotGlyph` uses for its SVG — the shapes are ported vertex for
// vertex, so the icon that flashes on the board is the same one the stash
// shows (just smaller). If a slot's artwork changes in ui.js, change it here
// too; the two are deliberately parallel because the renderer takes no UI
// import. `size` is the full box side in px; stroke width is in viewBox units
// and scales with it.
function drawSlotGlyph(ctx, slot, cx, cy, size, color, strokeWidth) {
  const k = size / 100;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const poly = (pts, close) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
      else ctx.lineTo(pts[i], pts[i + 1]);
    }
    if (close) ctx.closePath();
    ctx.stroke();
  };
  const dot = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  if (slot === "optic") {
    ctx.beginPath();
    ctx.arc(50, 50, 26, 0, Math.PI * 2);
    ctx.stroke();
    dot(50, 50, 6);
    poly([50, 10, 50, 24]);
    poly([50, 76, 50, 90]);
    poly([10, 50, 24, 50]);
    poly([76, 50, 90, 50]);
  } else if (slot === "emitter") {
    poly([50, 14, 86, 80, 14, 80], true);
    dot(50, 62, 7);
  } else if (slot === "capacitor") {
    poly([56, 10, 30, 54, 50, 54, 42, 90, 72, 42, 52, 42, 62, 10]);
  } else { // frame
    poly([50, 10, 85, 30, 85, 70, 50, 90, 15, 70, 15, 30], true);
    poly([50, 32, 68, 42, 68, 60, 50, 70, 32, 60, 32, 42], true);
  }
  ctx.restore();
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    const life = p.ttl / p.maxTtl;

    if (p.kind === "shard") {
      // A spinning fragment of the enemy's own outline.
      const half = p.len / 2;
      const cos = Math.cos(p.rot) * half;
      const sin = Math.sin(p.rot) * half;
      ctx.globalAlpha = Math.min(1, life * 1.4);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - cos, p.y - sin);
      ctx.lineTo(p.x + cos, p.y + sin);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.kind === "coin") {
      // A flipping coin: filled disc squashed horizontally by its spin so
      // it reads as a spinning edge-on flip, plus a thin metal rim.
      const c = VFX.coins;
      const squash = Math.max(0.15, Math.abs(Math.cos(p.rot)));
      ctx.globalAlpha = life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(squash, 1);
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = c.rimColor;
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      drawGlow(ctx, p.x, p.y, p.size * c.glowMult, p.color, life * (p.landed ? 0.7 : 1));
    } else {
      // Spark: glowing dot + a motion-trail streak behind it.
      ctx.globalAlpha = life;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawGlow(ctx, p.x, p.y, p.size * 3, p.color, life);
    }
  }
}

function drawPolygon(ctx, cx, cy, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
