// ============================================================
// RENDERER — all canvas drawing. The neon look lives here.
// ============================================================

import { enemyPosition } from "./enemies.js";
import { isUpgradeEligible } from "./towers.js";
import { SHAPE_SIDES } from "./config.js";

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
let palLevelId = null;

function activePalette(game) {
  if (game.level.id !== palLevelId) {
    pal = game.level.palette ? { ...LOOK, ...game.level.palette } : LOOK;
    palLevelId = game.level.id;
  }
  return pal;
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

  drawWarpGrid(ctx, game);
  drawPath(ctx, grid, time);
  drawBlockedTiles(ctx, grid);
  drawPortal(ctx, grid, time);
  drawCore(ctx, game, time);
  drawPlacementPreview(ctx, game, uiState);
  drawTowers(ctx, game, uiState);
  drawEnemies(ctx, game);

  // Additive pass: everything glowing blooms where it overlaps.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawProjectiles(ctx, game);
  drawEffects(ctx, game);
  drawParticles(ctx, game);
  ctx.restore();
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

function drawBlockedTiles(ctx, grid) {
  const ts = grid.tileSize;
  ctx.fillStyle = LOOK.blockedFill;
  ctx.strokeStyle = LOOK.blockedEdge;
  ctx.lineWidth = 1.5;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.isBlocked(x, y)) continue;
      const px = x * ts;
      const py = y * ts;
      const pad = ts * 0.18;
      ctx.fillRect(px, py, ts, ts);
      // Draw an X.
      ctx.beginPath();
      ctx.moveTo(px + pad, py + pad);
      ctx.lineTo(px + ts - pad, py + ts - pad);
      ctx.moveTo(px + ts - pad, py + pad);
      ctx.lineTo(px + pad, py + ts - pad);
      ctx.stroke();
    }
  }
}

// Spawn portal at the path entrance: two counter-rotating squares.
function drawPortal(ctx, grid, time) {
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
  // Inner heart of the core.
  ctx.fillStyle = LOOK.coreColor;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

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
    ctx.shadowBlur = 8;
    ctx.lineWidth = LOOK.lineWidth;

    const sides = SHAPE_SIDES[e.def.shape] ?? 3;
    // Rotate slowly as they move so they feel alive.
    const angle = e.distance * 0.01;
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

const TOWER_SIDES = { laser: 4, pulse: 12, slow: 6, railgun: 3 };

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

  // Range ring for the selected tower — dashes slowly rotate.
  const sel = uiState.selectedTower;
  if (sel) {
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

  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, def.baseRange * ts, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Projectiles & effects ----------

// NOTE: drawProjectiles/drawEffects/drawParticles run inside the
// additive ("lighter") pass — glow sprites instead of shadowBlur.

function drawProjectiles(ctx, game) {
  for (const p of game.projectiles) {
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
      ctx.lineWidth = fx.width || 2;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
      drawGlow(ctx, fx.x2, fx.y2, 6 + (fx.width || 2) * 2, fx.color, life * 0.8);
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
    }

    ctx.restore();
  }
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
