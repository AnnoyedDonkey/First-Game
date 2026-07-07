// ============================================================
// RENDERER — all canvas drawing. The neon look lives here.
// ============================================================

import { enemyPosition } from "./enemies.js";
import { isUpgradeEligible } from "./towers.js";

// Visual tuning — tweak the look here.
const LOOK = {
  background: "#05060f",
  gridLine: "rgba(80, 120, 255, 0.10)",
  buildableDot: "rgba(80, 120, 255, 0.25)",
  pathFill: "rgba(53, 224, 255, 0.07)",
  pathEdge: "rgba(53, 224, 255, 0.35)",
  pathFlow: "rgba(53, 224, 255, 0.8)",   // the animated dashes
  pathFlowSpeed: 40,                      // dash scroll speed, px/sec
  blockedFill: "rgba(255, 74, 94, 0.08)",
  blockedEdge: "rgba(255, 74, 94, 0.45)",
  coreColor: "#4affa1",
  portalColor: "#ffe24a",
  healthBarBack: "rgba(0,0,0,0.6)",
  healthBarFill: "#4affa1",
};

// uiState: { selectedType, selectedTower, hoverTile } from main.js
export function render(ctx, game, time, uiState = {}) {
  const { grid } = game;
  const ts = grid.tileSize;
  const w = grid.width * ts;
  const h = grid.height * ts;

  ctx.fillStyle = LOOK.background;
  ctx.fillRect(0, 0, w, h);

  drawGrid(ctx, grid);
  drawPath(ctx, grid, time);
  drawBlockedTiles(ctx, grid);
  drawPortal(ctx, grid, time);
  drawCore(ctx, game, time);
  drawPlacementPreview(ctx, game, uiState);
  drawTowers(ctx, game, uiState);
  drawEnemies(ctx, game);
  drawProjectiles(ctx, game);
  drawEffects(ctx, game);
}

function drawGrid(ctx, grid) {
  const ts = grid.tileSize;
  ctx.strokeStyle = LOOK.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= grid.width; x++) {
    ctx.moveTo(x * ts, 0);
    ctx.lineTo(x * ts, grid.height * ts);
  }
  for (let y = 0; y <= grid.height; y++) {
    ctx.moveTo(0, y * ts);
    ctx.lineTo(grid.width * ts, y * ts);
  }
  ctx.stroke();

  // Small dot on every buildable tile so players can read the board.
  ctx.fillStyle = LOOK.buildableDot;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.isBuildable(x, y)) continue;
      const c = grid.tileCenter(x, y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPath(ctx, grid, time) {
  const ts = grid.tileSize;

  // Path tiles: soft fill.
  ctx.fillStyle = LOOK.pathFill;
  for (const t of grid.pathTiles) {
    ctx.fillRect(t.x * ts, t.y * ts, ts, ts);
  }

  // Center line with animated dashes flowing toward the core.
  ctx.save();
  ctx.strokeStyle = LOOK.pathFlow;
  ctx.lineWidth = 2;
  ctx.shadowColor = LOOK.pathFlow;
  ctx.shadowBlur = 8;
  ctx.setLineDash([6, 14]);
  ctx.lineDashOffset = -time * LOOK.pathFlowSpeed;
  ctx.beginPath();
  const pts = grid.pathPoints;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
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
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;

    const sides = { triangle: 3, diamond: 4, hexagon: 6, octagon: 8 }[e.def.shape] ?? 3;
    // Rotate slowly as they move so they feel alive.
    const angle = e.distance * 0.01;
    drawPolygon(ctx, pos.x, pos.y, r, sides, angle);
    ctx.stroke();
    ctx.restore();

    // Health bar, only once damaged.
    if (e.health < e.maxHealth) {
      const bw = r * 2;
      const bh = 3;
      const bx = pos.x - r;
      const by = pos.y - r - 7;
      ctx.fillStyle = LOOK.healthBarBack;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = LOOK.healthBarFill;
      ctx.fillRect(bx, by, bw * (e.health / e.maxHealth), bh);
    }
  }
}

// ---------- Towers ----------

const TOWER_SIDES = { laser: 4, pulse: 12, slow: 6 };

function drawTowerShape(ctx, tower, ts, x, y) {
  const r = ts * 0.3;
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
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    drawTowerShape(ctx, tower, ts, tower.pos.x, tower.pos.y);

    // Level pips under the tower (one dot per level above 1).
    if (tower.level > 1) {
      ctx.fillStyle = tower.def.color;
      const n = tower.level - 1;
      const spread = 8;
      for (let i = 0; i < n; i++) {
        const px = tower.pos.x + (i - (n - 1) / 2) * spread;
        ctx.beginPath();
        ctx.arc(px, tower.pos.y + ts * 0.38, 2.2, 0, Math.PI * 2);
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

  // Range ring for the selected tower.
  const sel = uiState.selectedTower;
  if (sel) {
    ctx.save();
    ctx.strokeStyle = sel.def.color;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
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
  ctx.lineWidth = 2;

  drawPolygon(ctx, c.x, c.y, ts * 0.3, TOWER_SIDES[selectedType] ?? 4, Math.PI / 4);
  ctx.stroke();

  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, def.baseRange * ts, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Projectiles & effects ----------

function drawProjectiles(ctx, game) {
  for (const p of game.projectiles) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEffects(ctx, game) {
  for (const fx of game.effects) {
    const life = fx.ttl / fx.maxTtl; // 1 -> 0
    ctx.save();
    ctx.globalAlpha = life;
    ctx.strokeStyle = fx.color;
    ctx.shadowColor = fx.color;
    ctx.shadowBlur = 10;

    if (fx.kind === "beam") {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    } else if (fx.kind === "ring" || fx.kind === "burst") {
      // Rings/bursts expand as they fade.
      const r = fx.radius * (fx.kind === "burst" ? 1.5 - life * 0.5 : 1.2 - life * 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.kind === "tileFlash") {
      const ts = game.grid.tileSize;
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = life * 0.35;
      ctx.fillRect(fx.x * ts, fx.y * ts, ts, ts);
    }

    ctx.restore();
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
