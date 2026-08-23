// ============================================================
// TRAY ICON — live micro-sims for the bottom-HUD tower buttons.
//
// The battle HUD shows each tower as its real shape, and the SELECTED tower
// animates its actual in-game firing (laser beam, pulse orbs, slow zap,
// railgun charge->pierce ray, rocket + blast). We get "exactly the in-game
// visuals" by driving the real combat sub-updates + the real renderer's bare
// mode (renderer.js `uiState.bare`) instead of hand-drawing a lookalike.
//
// A single invisible, pinned dummy target sits one tile "up" from the tower so
// the tower keeps acquiring it and firing; the icon is cropped to the tower's
// tile, so the shots leave the frame and never touch the real board. The dummy
// has huge HP so it never dies (no coins/gear/loot side effects). All knobs
// live in config.js VFX.trayIcon.
// ============================================================

import { DEFAULT_OWNER_ID, VFX } from "./config.js";
import { createGridModel } from "./grid.js";
import { createTower, updateTowers } from "./towers.js";
import { createEnemy } from "./enemies.js";
import { updateProjectiles, updateEffects } from "./projectiles.js";
import { updateParticles } from "./particles.js";
import { createSpringGrid } from "./springgrid.js";
import { render } from "./renderer.js";

// A demo roster record so createTower never calls nextRosterName() (which would
// advance the real player's roster-name counter).
function demoRosterRecord(type) {
  return { name: `Tray-${type}`, maxLevel: 1, xp: 0, kills: 0, gear: null };
}

export function createTrayIconSim(type) {
  const knobs = VFX.trayIcon;
  const level = {
    id: `tray_${type}`,
    gridWidth: knobs.gridWidth,
    gridHeight: knobs.gridHeight,
    // Vertical path down the target column so distance 0 = the target tile.
    pathCorners: [
      { x: knobs.targetTile.x, y: knobs.targetTile.y },
      { x: knobs.targetTile.x, y: knobs.gridHeight - 1 },
    ],
  };
  const grid = createGridModel(level, knobs.tilePx);
  const game = {
    level,
    grid,
    time: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    effects: [],
    particles: [],
    springGrid: createSpringGrid(
      knobs.gridWidth * knobs.tilePx,
      knobs.gridHeight * knobs.tilePx,
      knobs.tilePx
    ),
    kills: 0,
    ownerIds: [DEFAULT_OWNER_ID],
    wallets: { [DEFAULT_OWNER_ID]: 0 },
    totalEarned: { [DEFAULT_OWNER_ID]: 0 },
    localPlayerId: DEFAULT_OWNER_ID,
    get money() { return this.wallets[this.localPlayerId]; },
    set money(value) { this.wallets[this.localPlayerId] = value; },
    shardsEarned: 0,
    lootDrops: [],
    waveIndex: 0,
    effectiveSpeed: 1, // railgun ray fade compensates by this; keep real-time
    rng: Math.random,
  };

  const tower = createTower(
    type, knobs.towerTile.x, knobs.towerTile.y, grid, demoRosterRecord(type)
  );
  game.towers.push(tower);

  // The invisible pinned target: distance 0 keeps it at the target tile (we
  // never run updateEnemies, so it never moves or dies). Huge HP guarantees no
  // death → no coins, gear drops, or splitters. It is never drawn (bare render
  // skips drawEnemies), so only the tower's shots streaking at it are visible.
  const dummy = createEnemy("basic", { healthMult: knobs.dummyHealthMult });
  dummy.distance = 0;
  dummy._fieldDmg = 1;
  game.enemies.push(dummy);

  return { type, game, tower, dummy, destroyed: false };
}

export function stepTrayIconSim(sim, dt) {
  if (!sim || sim.destroyed || !sim.game) return;
  const { game } = sim;
  game.springGrid.update(dt);
  updateTowers(game, dt);          // targets the pinned dummy and fires
  updateProjectiles(game, dt);     // orbs / rockets travel and burst
  updateEffects(game, dt);         // beams, muzzle flashes, blasts fade
  updateParticles(game, dt);       // sparks
  game.time += dt;
  // The dummy must never die; if a rounding edge ever drops it, revive it so
  // the icon keeps firing for the whole time the button is selected.
  if (!sim.dummy.alive) {
    sim.dummy.alive = true;
    sim.dummy.health = sim.dummy.maxHealth;
  }
}

// Paint one frame into `ctx`, cropped so the tower tile fills the square canvas
// (tower centered) and shots fly out of frame. The caller sizes the canvas to
// (viewPx * dpr) square; we own the clear + crop transform, bare render draws.
export function renderTrayIconSim(sim, ctx, dpr) {
  if (!sim || sim.destroyed || !sim.game) return;
  const knobs = VFX.trayIcon;
  const T = knobs.tilePx;
  const viewPx = Math.round(knobs.viewTiles * T);
  // Offset so the tower's center lands at the canvas center.
  const towerCx = (knobs.towerTile.x + 0.5) * T;
  const towerCy = (knobs.towerTile.y + 0.5) * T;
  const ox = towerCx - viewPx / 2;
  const oy = towerCy - viewPx / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewPx * dpr, viewPx * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
  render(ctx, sim.game, sim.game.time, { bare: true });
}

// The CSS-pixel edge length of the square icon for the current knobs.
export function trayIconViewPx() {
  const knobs = VFX.trayIcon;
  return Math.round(knobs.viewTiles * knobs.tilePx);
}

export function destroyTrayIconSim(sim) {
  if (!sim || sim.destroyed) return;
  sim.destroyed = true;
  if (sim.game) {
    sim.game.enemies.length = 0;
    sim.game.towers.length = 0;
    sim.game.projectiles.length = 0;
    sim.game.effects.length = 0;
    sim.game.particles.length = 0;
  }
  sim.game = null;
  sim.tower = null;
  sim.dummy = null;
}
