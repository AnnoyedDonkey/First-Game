// ============================================================
// TOWER DEMO — isolated micro-battles for tower-intro cards.
//
// This deliberately drives the combat sub-updates instead of updateGame():
// demos have no waves, core damage, battle end, roster sync, or save writes.
// Every presentation knob and cast choice lives in NARRATIVE.towerIntro.
// ============================================================

import { DEFAULT_OWNER_ID, ENEMIES, NARRATIVE } from "./config.js";
import { createGridModel } from "./grid.js";
import { createTower, updateTowers, applyLevelUpSurge } from "./towers.js";
import { createEnemy, updateEnemies } from "./enemies.js";
import { updateProjectiles, updateEffects } from "./projectiles.js";
import { updateParticles } from "./particles.js";
import { createSpringGrid } from "./springgrid.js";
import { render } from "./renderer.js";

function seededRng(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function demoRosterRecord(type) {
  // Passing a record is essential: a null record calls nextRosterName() and
  // would advance the real player's module-level roster-name counter.
  return {
    name: `Demo-${type}`,
    maxLevel: 1,
    xp: 0,
    kills: 0,
    gear: null,
  };
}

function addDemoTower(game, type, tile) {
  const tower = createTower(
    type,
    tile.x,
    tile.y,
    game.grid,
    demoRosterRecord(type)
  );
  game.towers.push(tower);
  return tower;
}

function spawnDemoGroup(demo) {
  // Slow is the featured subject but its Laser partner is the damage dealer;
  // size the cast against whichever tower actually owns the kills.
  const damageDealer = demo.supportTower || demo.featuredTower;
  const targetHealth = damageDealer.damage * demo.knobs.shotsToKill;
  let groupIndex = 0;
  for (const entry of demo.cast.enemies) {
    const healthMult = targetHealth / ENEMIES[entry.type].baseHealth;
    for (let i = 0; i < entry.count; i++) {
      const enemy = createEnemy(entry.type, { healthMult });
      enemy.distance = groupIndex * demo.knobs.groupSpacingTiles * demo.knobs.tilePx;
      demo.game.enemies.push(enemy);
      groupIndex += 1;
    }
  }
}

export function createTowerDemo(demoKey, options = {}) {
  const knobs = NARRATIVE.towerIntro;
  const cast = knobs.cast[demoKey];
  if (!cast) throw new Error(`Unknown tower demo type: ${demoKey}`);
  // The cast key is normally a real tower type (the featured tower). A named
  // scenario (e.g. "intro"/"mastery") instead sets `cast.tower` explicitly so
  // the key can be a label rather than a tower id. An explicit
  // `options.towerType` override wins over both — the first-Mastery card
  // features whichever tower just ranked up.
  const featuredType = options.towerType || cast.tower || demoKey;

  const level = {
    id: `demo_${demoKey}`,
    gridWidth: knobs.gridWidth,
    gridHeight: knobs.gridHeight,
    pathCorners: [
      { x: 0, y: knobs.laneRow },
      { x: knobs.gridWidth - 1, y: knobs.laneRow },
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
    rng: seededRng(level.id),
  };
  const featuredTower = addDemoTower(game, featuredType, knobs.towerTile);
  const supportTower = cast.supportTower
    ? addDemoTower(game, cast.supportTower, knobs.supportTile)
    : null;

  return {
    towerType: featuredType,
    game,
    featuredTower,
    supportTower,
    cast,
    knobs,
    groupSize: cast.enemies.reduce((total, entry) => total + entry.count, 0),
    nextSpawnAt: 0,
    // Level-up loop (mastery card): re-fire the golden surge on the featured
    // tower every surgeLoop.interval seconds. null = no loop (normal demos).
    nextSurgeAt: cast.surgeLoop ? cast.surgeLoop.firstAt : null,
    destroyed: false,
  };
}

export function stepTowerDemo(demo, dt) {
  if (!demo || demo.destroyed || !demo.game) return;
  const { game, knobs } = demo;

  // Enemy-less scenarios (the mastery level-up loop) skip spawning entirely —
  // guarding on groupSize also avoids a no-op catch-up churn on nextSpawnAt.
  if (demo.groupSize > 0) {
    let concurrent = game.enemies.reduce(
      (count, enemy) => count + (enemy.alive ? 1 : 0),
      0
    );
    while (
      game.time >= demo.nextSpawnAt &&
      concurrent + demo.groupSize <= knobs.maxEnemies
    ) {
      spawnDemoGroup(demo);
      concurrent += demo.groupSize;
      demo.nextSpawnAt += knobs.spawnInterval;
    }
    // Do not unleash a catch-up burst after the cast has been held at its cap.
    if (
      concurrent + demo.groupSize > knobs.maxEnemies &&
      game.time >= demo.nextSpawnAt
    ) {
      demo.nextSpawnAt = game.time + knobs.spawnInterval;
    }
  }

  // Loop the golden level-up surge on the featured tower (mastery card only).
  if (demo.nextSurgeAt != null && demo.featuredTower && game.time >= demo.nextSurgeAt) {
    applyLevelUpSurge(game, demo.featuredTower);
    demo.nextSurgeAt = game.time + demo.cast.surgeLoop.interval;
  }

  game.springGrid.update(dt);
  updateTowers(game, dt);
  updateEnemies(game, dt);
  updateProjectiles(game, dt);
  updateEffects(game, dt);
  updateParticles(game, dt);
  game.enemies = game.enemies.filter((enemy) => enemy.alive);
  game.time += dt;
}

export function renderTowerDemo(demo, ctx) {
  if (!demo || demo.destroyed || !demo.game) return;
  render(ctx, demo.game, demo.game.time, {});
}

export function destroyTowerDemo(demo) {
  if (!demo || demo.destroyed) return;
  demo.destroyed = true;
  demo.game.enemies.length = 0;
  demo.game.towers.length = 0;
  demo.game.projectiles.length = 0;
  demo.game.effects.length = 0;
  demo.game.particles.length = 0;
  demo.game = null;
  demo.featuredTower = null;
  demo.supportTower = null;
  demo.cast = null;
  demo.knobs = null;
}
