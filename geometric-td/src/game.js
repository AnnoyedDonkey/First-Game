// ============================================================
// GAME — core state machine: waves, spawning, money, core health.
//
// Phases:
//   "ready"    - waiting for the player to start the next wave
//   "wave"     - enemies spawning / on the field
//   "countdown"- wave cleared, timer until the next auto-start
//   "won" / "lost"
// ============================================================

import { WAVE_DEFAULTS } from "./config.js";
import { createGridModel } from "./grid.js";
import { createEnemy, updateEnemies } from "./enemies.js";
import { updateTowers } from "./towers.js";
import { updateProjectiles, updateEffects } from "./projectiles.js";
import { getCoreBonus, recordBattleEnd, recordEndlessResult } from "./progression.js";
import { updateParticles } from "./particles.js";
import { createSpringGrid } from "./springgrid.js";
import { VFX } from "./config.js";
import { generateEndlessWave } from "./endless.js";

export function createGame(level, tileSize, endless = false) {
  const grid = createGridModel(level, tileSize);

  const game = {
    level,
    grid,
    time: 0,                       // total game time in seconds
    phase: "ready",
    endless,                       // true = waves never stop (see endless.js)
    money: level.startingMoney,
    coreHealth: level.coreHealth + getCoreBonus(),
    maxCoreHealth: level.coreHealth + getCoreBonus(),
    waveIndex: 0,                  // 0-based; wave 1 is index 0
    totalWaves: level.waves.length,
    enemies: [],
    towers: [],
    projectiles: [],
    effects: [],                   // short-lived visuals (beams, rings...)
    particles: [],                 // sparks + death shards
    springGrid: createSpringGrid(
      level.gridWidth * tileSize, level.gridHeight * tileSize, tileSize
    ),
    spawnQueue: [],                // [{ at, type, mods }] sorted by time
    waveClock: 0,                  // seconds since current wave started
    countdown: 0,                  // seconds until next wave auto-starts

    // Settings (level overrides config defaults)
    timeBetweenWaves: level.timeBetweenWaves ?? WAVE_DEFAULTS.timeBetweenWaves,
    autoStartNextWave: level.autoStartNextWave ?? WAVE_DEFAULTS.autoStartNextWave,
  };

  return game;
}

// Build the spawn schedule for a wave from its group definitions.
function buildSpawnQueue(wave) {
  const queue = [];
  const waveMods = {
    healthMult: wave.healthMult ?? 1,
    speedMult: wave.speedMult ?? 1,
  };

  for (const group of wave.groups) {
    const interval = group.spawnInterval ?? WAVE_DEFAULTS.spawnInterval;
    const delay = group.startDelay ?? 0;
    for (let i = 0; i < group.count; i++) {
      queue.push({
        at: delay + i * interval,
        type: group.type,
        mods: {
          healthMult: (group.healthMult ?? 1) * waveMods.healthMult,
          speedMult: (group.speedMult ?? 1) * waveMods.speedMult,
          bountyMult: group.bountyMult ?? 1,
          xpMult: group.xpMult ?? 1,
        },
      });
    }
  }
  queue.sort((a, b) => a.at - b.at);
  return queue;
}

export function startNextWave(game) {
  if (game.phase !== "ready" && game.phase !== "countdown") return;
  if (!game.endless && game.waveIndex >= game.totalWaves) return;

  const authored = game.level.waves;
  const waveDef = game.waveIndex < authored.length
    ? authored[game.waveIndex]
    : generateEndlessWave(game.level, game.waveIndex);
  game.spawnQueue = buildSpawnQueue(waveDef);
  game.waveClock = 0;
  game.phase = "wave";
}

export function updateGame(game, dt) {
  if (game.phase === "won" || game.phase === "lost") return;

  game.time += dt;

  // Spawn scheduled enemies.
  if (game.phase === "wave") {
    game.waveClock += dt;
    while (game.spawnQueue.length > 0 && game.spawnQueue[0].at <= game.waveClock) {
      const s = game.spawnQueue.shift();
      game.enemies.push(createEnemy(s.type, s.mods));
    }
  }

  // Combat: towers fire, projectiles fly, effects fade.
  updateTowers(game, dt);
  updateProjectiles(game, dt);
  updateEffects(game, dt);
  updateParticles(game, dt);
  game.springGrid.update(dt);

  // Move enemies; handle leaks.
  const leaked = updateEnemies(game, dt);
  for (const e of leaked) {
    game.coreHealth -= e.coreDamage;
    // The core flinches: shockwave + red flash at the path exit.
    const core = game.grid.pathPoints[game.grid.pathPoints.length - 1];
    const ts = game.grid.tileSize;
    game.springGrid.applyShock(
      core.x, core.y, ts * VFX.warp.shockRadiusTiles * 1.5, VFX.warp.leakShock
    );
    game.effects.push({
      kind: "ring", x: core.x, y: core.y, color: "#ff4a5e",
      radius: ts * 0.7, ttl: 0.35, maxTtl: 0.35,
    });
  }
  if (game.coreHealth <= 0) {
    game.coreHealth = 0;
    game.phase = "lost";
    if (game.endless) {
      // No "win" in endless — just how far you got. Stashed on the game
      // object so main.js's end-of-battle overlay can read it without
      // calling this (save-writing) function a second time.
      game.endlessResult = recordEndlessResult(game);
    } else {
      recordBattleEnd(game, false); // towers keep their XP even in defeat
    }
    return;
  }

  // Drop dead enemies from the list.
  game.enemies = game.enemies.filter((e) => e.alive);

  // Wave cleared?
  if (game.phase === "wave" && game.spawnQueue.length === 0 && game.enemies.length === 0) {
    game.waveIndex += 1;
    if (!game.endless && game.waveIndex >= game.totalWaves) {
      game.phase = "won";
      recordBattleEnd(game, true); // roster + 1 skill point, saved
    } else if (game.autoStartNextWave) {
      game.phase = "countdown";
      game.countdown = game.timeBetweenWaves;
    } else {
      game.phase = "ready";
    }
  }

  // Countdown to next auto-started wave.
  if (game.phase === "countdown") {
    game.countdown -= dt;
    if (game.countdown <= 0) startNextWave(game);
  }
}
