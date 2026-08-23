// ============================================================
// GAME — core state machine: waves, spawning, money, core health.
//
// Phases:
//   "ready"    - waiting for the player to start the next wave
//   "wave"     - enemies spawning / on the field
//   "countdown"- wave cleared, timer until the next auto-start
//   "won" / "lost"
// ============================================================

import {
  COOP, DEBUG, DEFAULT_OWNER_ID, VFX, WAVE_DEFAULTS, endlessTrackFor,
} from "./config.js";
import { updateMilestoneResults } from "./milestones.js";
import { createGridModel } from "./grid.js";
import { createEnemy, updateEnemies } from "./enemies.js";
import { updateTowers } from "./towers.js";
import { updateProjectiles, updateEffects } from "./projectiles.js";
import {
  getCoreBonus, recordBattleEnd, recordEndlessResult,
  getInterestRate, getInterestCap, getMoneyMult,
} from "./progression.js";
import { updateParticles } from "./particles.js";
import { createSpringGrid } from "./springgrid.js";
import { generateEndlessWave } from "./endless.js";

export function createGame(level, tileSize, endless = false) {
  const grid = createGridModel(level, tileSize);
  const ownerIds = DEBUG.coopLocal
    ? [DEFAULT_OWNER_ID, "debug-guest"]
    : [DEFAULT_OWNER_ID];
  const players = {};
  const wallets = {};
  const totalEarned = {};
  for (let i = 0; i < ownerIds.length; i++) {
    const ownerId = ownerIds[i];
    players[ownerId] = {
      id: ownerId,
      label: `P${i + 1}`,
      color: COOP.ownership.colors[i % COOP.ownership.colors.length],
      // The real local owner keeps live progression getters; the fake guest
      // snapshots its own values at battle start. Phase 4 replaces a remote
      // player's snapshot with its resolved join-payload numbers.
      economy: ownerId === DEFAULT_OWNER_ID ? {} : {
        moneyMult: getMoneyMult(),
        interestRate: getInterestRate(),
        interestCap: getInterestCap(),
      },
      // The fake guest starts with no veterans. An absent roster means the
      // real local save, preserving the existing single-player deployment.
      ...(ownerId === DEFAULT_OWNER_ID ? {} : { roster: [] }),
    };
    wallets[ownerId] = level.startingMoney;
    totalEarned[ownerId] = 0;
  }

  const game = {
    level,
    grid,
    time: 0,                       // total game time in seconds
    phase: "ready",
    endless,                       // true = waves never stop (see endless.js)
    ownerIds,
    players,
    wallets,
    totalEarned,
    localPlayerId: DEFAULT_OWNER_ID,
    actingPlayerId: DEFAULT_OWNER_ID,
    progressionOwnerId: DEFAULT_OWNER_ID,
    // Compatibility alias: the many existing readers keep using game.money,
    // while all authoritative mutations below write the explicit owner wallet.
    get money() { return this.wallets[this.localPlayerId]; },
    set money(value) { this.wallets[this.localPlayerId] = value; },
    shardsEarned: 0,                // Shards ◆ banked this battle; synced to the save at battle end
    lootDrops: [],                   // unclaimed items found during this battle
    kills: 0,                        // enemies killed this run (milestone tracking, B5)
    leaks: 0,                        // enemies that reached the core this run (B5)
    lastLeakTime: -Infinity,         // game.time of the last core leak (Indy's X-eye flinch)
    typesUsed: new Set(),            // tower types ever placed this run — survives sells (B5)
    milestoneResults: new Set(),     // latched campaign-milestone ids attained this run (B5)
    newMilestoneToasts: [],          // toast texts main.js drains each frame (B5)
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
  game.leaks += leaked.length; // B5: "Flawless" milestone tracking
  if (leaked.length) game.lastLeakTime = game.time; // Indy's core flinches (X eyes)
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
    applyWaveInterest(game);
    queueMilestoneToasts(game);
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

// Cash interest (skills: interestRate + interestCap). Paid once per cleared
// wave: floor(money * rate), capped. A golden ring at the core sells it.
// `game.lastInterest` is left for the HUD / B5 milestone toast to read.
function applyWaveInterest(game) {
  game.lastInterest = 0;
  game.lastInterestByOwner = {};
  let paidAny = false;
  for (const ownerId of Object.keys(game.wallets)) {
    const economy = game.players?.[ownerId]?.economy;
    const rate = economy?.interestRate ?? getInterestRate();
    const gain = rate > 0
      ? Math.min(
          Math.floor(game.wallets[ownerId] * rate),
          economy?.interestCap ?? getInterestCap()
        )
      : 0;
    game.lastInterestByOwner[ownerId] = gain;
    if (gain <= 0) continue;
    game.wallets[ownerId] += gain;
    paidAny = true;
  }
  game.lastInterest = game.lastInterestByOwner[game.localPlayerId] || 0;
  if (!paidAny) return;
  const core = game.grid.pathPoints[game.grid.pathPoints.length - 1];
  game.effects.push({
    kind: "ring", x: core.x, y: core.y, color: "#ffe24a",
    radius: game.grid.tileSize * 0.9, ttl: 0.6, maxTtl: 0.6,
  });
}

// Queue celebratory milestone toasts crossed by clearing this wave (B5).
// Display-only: Endless track grants still fire at run end (idempotent off
// best wave), and campaign milestones are latched here but granted in
// progression.recordBattleEnd. main.js drains game.newMilestoneToasts.
function queueMilestoneToasts(game) {
  if (game.endless) {
    // The wave number just reached (matches recordEndlessResult's waveReached
    // = waveIndex + 1, so the toast lines up with the actual reward grant).
    const reached = game.waveIndex + 1;
    for (const m of endlessTrackFor(game.level.id)) {
      if (m.type === "wave" && m.threshold === reached) {
        game.newMilestoneToasts.push(`★ WAVE ${reached} — MILESTONE!`);
      }
    }
    return;
  }
  for (const m of updateMilestoneResults(game, { atEnd: false })) {
    game.newMilestoneToasts.push(`★ ${m.label.toUpperCase()}`);
  }
}
