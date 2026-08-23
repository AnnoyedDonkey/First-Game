// ============================================================
// CO-OP PROTOCOL — host-authoritative gameplay over net.js.
//
// The transport only moves JSON strings. This module owns everything those
// strings mean: intents on `cmd`, snapshots on `state`, and the guest mirror.
// ============================================================

import {
  COOP, ENEMIES, TOWERS, TOWER_UPGRADES,
} from "./config.js";
import {
  CONNECTION_STATES, getConnectionState, hostSession, joinSession,
  onMessage, sendMessage,
} from "./net.js";
import {
  createTower, placeTower, refreshTowerStats, sellTower, tryUpgradeTower,
  xpThresholdFor,
} from "./towers.js";

const ROLES = Object.freeze({ HOST: "host", GUEST: "guest" });
const OWNER_IDS = Object.freeze({ host: "coop-host", guest: "coop-guest" });
const OWNER_ORDER = Object.freeze([OWNER_IDS.host, OWNER_IDS.guest]);
const PHASES = new Set(["ready", "wave", "countdown", "won", "lost"]);

let activeGame = null;
let activeRole = null;
let snapshotSequence = 0;
let lastSnapshotSentAt = -Infinity;
let latestSnapshot = null;

export function startHost(game) {
  requireStartableGame(game);
  const pending = hostSession();
  activate(game, ROLES.HOST);
  return pending;
}

export function startGuest(game, code) {
  requireStartableGame(game);
  const pending = joinSession(code);
  activate(game, ROLES.GUEST);
  return pending;
}

export function isActive(game = activeGame) {
  return !!game && game === activeGame && activeRole !== null;
}

export function isHost(game = activeGame) {
  return isActive(game) && activeRole === ROLES.HOST;
}

export function isGuest(game = activeGame) {
  return isActive(game) && activeRole === ROLES.GUEST;
}

export function getRole() {
  return activeRole;
}

export function getState() {
  return getConnectionState();
}

// Local solo/host actions and remote guest actions all reach the same real
// tower functions here. A guest only transmits; `{pending:true}` explicitly
// tells main.js not to run success/failure presentation against stale state.
export function sendIntent(game, intent) {
  if (!isActive(game)) {
    return applyIntent(game, intent, game.actingPlayerId || game.localPlayerId);
  }
  if (isHost(game)) return applyIntent(game, intent, OWNER_IDS.host);

  let sent = false;
  if (getConnectionState() === CONNECTION_STATES.CONNECTED) {
    try {
      sendMessage("cmd", intent);
      sent = true;
    } catch {
      // Connection state owns failure reporting. Most importantly, a failed
      // send must never fall through into optimistic guest-side application.
    }
  }
  return { pending: true, sent };
}

// Called after the authoritative simulation tick. Scheduling from real time
// avoids snapshot bursts when game time is frozen or a browser frame is late.
export function updateHost(game, now) {
  if (!isHost(game) || getConnectionState() !== CONNECTION_STATES.CONNECTED) return;
  const intervalMs = 1000 / COOP.snapshotHz;
  if (now < lastSnapshotSentAt + intervalMs) return;

  const snapshot = buildSnapshot(game, ++snapshotSequence);
  try {
    sendMessage("state", snapshot);
    lastSnapshotSentAt = now;
  } catch {
    // A lost state send is disposable by design. Do not move the schedule
    // forward, so the next frame can try the newest state immediately.
  }
}

// Guests never call updateGame. Their render clock follows the newest host
// time behind a small buffer, and every enemy advances from its own observed
// authoritative speed until another snapshot corrects it.
export function updateGuest(game, now) {
  if (!isGuest(game) || !latestSnapshot) return;

  const elapsedSinceSnapshot = Math.max(0, now - latestSnapshot.receivedAt) / 1000;
  const bufferedElapsed = latestSnapshot.clockAdvancing
    ? elapsedSinceSnapshot - COOP.interpDelayMs / 1000
    : 0;
  const renderTime = Math.max(
    0,
    latestSnapshot.time + bufferedElapsed
  );
  const previousTime = game.time;
  game.time = renderTime;
  if (game.phase === "countdown" && renderTime > previousTime) {
    game.countdown = Math.max(0, game.countdown - (renderTime - previousTime));
  }

  const pathEnd = game.grid.totalPathLength;
  const tileSize = game.grid.tileSize;
  for (const enemy of game.enemies) {
    const snapshotTime = enemy._coopSnapshotTime;
    let distance;
    if (enemy._coopPreviousTime != null && renderTime <= snapshotTime) {
      const span = snapshotTime - enemy._coopPreviousTime;
      const alpha = span > 0
        ? Math.max(0, Math.min(1, (renderTime - enemy._coopPreviousTime) / span))
        : 1;
      distance = enemy._coopPreviousDistance +
        (enemy._coopSnapshotDistance - enemy._coopPreviousDistance) * alpha;
    } else {
      distance = enemy._coopSnapshotDistance +
        enemy.speedTilesPerSec * tileSize * (renderTime - snapshotTime);
    }
    enemy.distance = Math.max(0, Math.min(pathEnd, distance));
  }
}

function requireStartableGame(game) {
  if (!game?.grid || !game?.level) throw new Error("Start a battle before starting co-op");
  if (activeGame) throw new Error("A co-op game is already active in this tab");
}

function activate(game, role) {
  activeGame = game;
  activeRole = role;
  game.coop = true;
  snapshotSequence = 0;
  lastSnapshotSentAt = -Infinity;
  latestSnapshot = null;
  preparePlayers(game, role);
  if (role === ROLES.GUEST) {
    // Nothing from the guest's pre-session game is authoritative. Start with
    // an empty mirror and let the first host snapshot populate render objects.
    game.enemies = [];
    game.towers = [];
    game.projectiles = [];
    game.effects = [];
    game.particles = [];
    game.spawnQueue = [];
  }
}

// Phase 4 will replace the remote placeholder with the joining player's real
// roster/economy payload. For core sync, deterministic ids let both tabs apply
// the Phase 1 owner/wallet rules without sending identity data every snapshot.
function preparePlayers(game, role) {
  const localOwnerId = role === ROLES.HOST ? OWNER_IDS.host : OWNER_IDS.guest;
  const remoteOwnerId = role === ROLES.HOST ? OWNER_IDS.guest : OWNER_IDS.host;
  const oldLocalId = game.localPlayerId;
  const oldPlayer = game.players?.[oldLocalId] || {};
  const oldWallet = game.wallets?.[oldLocalId] ?? game.level.startingMoney;
  const oldEarned = game.totalEarned?.[oldLocalId] || 0;

  const players = {};
  for (let i = 0; i < OWNER_ORDER.length; i++) {
    const ownerId = OWNER_ORDER[i];
    const isLocal = ownerId === localOwnerId;
    players[ownerId] = {
      ...(isLocal ? oldPlayer : {}),
      id: ownerId,
      label: `P${i + 1}`,
      color: COOP.ownership.colors[i % COOP.ownership.colors.length],
      economy: isLocal ? (oldPlayer.economy || {}) : {},
      // An explicit empty remote roster prevents the host from accidentally
      // deploying veterans from its own save on behalf of the guest.
      ...(ownerId === remoteOwnerId ? { roster: [] } : {}),
    };
  }

  game.ownerIds = [...OWNER_ORDER];
  game.players = players;
  game.wallets = {
    [OWNER_IDS.host]: localOwnerId === OWNER_IDS.host ? oldWallet : game.level.startingMoney,
    [OWNER_IDS.guest]: localOwnerId === OWNER_IDS.guest ? oldWallet : game.level.startingMoney,
  };
  game.totalEarned = {
    [OWNER_IDS.host]: localOwnerId === OWNER_IDS.host ? oldEarned : 0,
    [OWNER_IDS.guest]: localOwnerId === OWNER_IDS.guest ? oldEarned : 0,
  };
  game.localPlayerId = localOwnerId;
  game.actingPlayerId = localOwnerId;
  game.progressionOwnerId = localOwnerId;
  for (const tower of game.towers) {
    // A host may build during signaling. Towers created before co-op activation
    // still carry the single-player id, so adopt them into the local identity.
    if (!OWNER_ORDER.includes(tower.ownerId)) tower.ownerId = localOwnerId;
  }
}

function applyIntent(game, intent, ownerId) {
  if (!game || !intent || typeof intent !== "object") return { ok: false, reason: "intent" };
  switch (intent.op) {
    case "place":
      if (!TOWERS[intent.towerType] ||
          !Number.isInteger(intent.tileX) || !Number.isInteger(intent.tileY)) {
        return { ok: false, reason: "intent" };
      }
      return placeTower(game, intent.towerType, intent.tileX, intent.tileY, ownerId);
    case "upgrade": {
      const tower = towerById(game, intent.towerId);
      return tower ? tryUpgradeTower(game, tower, ownerId) : false;
    }
    case "sell": {
      const tower = towerById(game, intent.towerId);
      return tower ? sellTower(game, tower, ownerId) : { ok: false, reason: "missing" };
    }
    default:
      return { ok: false, reason: "intent" };
  }
}

function towerById(game, towerId) {
  if (!Number.isInteger(towerId)) return null;
  return game.towers.find((tower) => tower.id === towerId) || null;
}

function buildSnapshot(game, sequence) {
  return {
    seq: sequence,
    time: game.time,
    phase: game.phase,
    waveIndex: game.waveIndex,
    coreHealth: game.coreHealth,
    wallets: { ...game.wallets },
    totalEarned: { ...game.totalEarned },
    enemies: game.enemies.filter((enemy) => enemy.alive).map((enemy) => ({
      id: enemy.id,
      type: enemy.type,
      distance: enemy.distance,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      flags: {
        slow: game.time < enemy.slowUntil,
        vuln: game.time < enemy.vulnUntil || game.time < (enemy.gearVulnUntil || 0),
        hitFlash: enemy.hitFlash > 0,
      },
    })),
    towers: game.towers.map((tower) => ({
      id: tower.id,
      type: tower.type,
      tileX: tower.tileX,
      tileY: tower.tileY,
      level: tower.level,
      ownerId: tower.ownerId,
    })),
  };
}

onMessage(({ channel, data }) => {
  // net.js deliberately exposes the DataChannel payload unchanged. Its game
  // messages are JSON strings, never already-parsed objects.
  if (typeof data !== "string") return;
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  if (channel === "cmd" && isHost() && message?.op) {
    applyIntent(activeGame, message, OWNER_IDS.guest);
  } else if (channel === "state" && isGuest() && validSnapshot(message)) {
    if (latestSnapshot && message.seq <= latestSnapshot.seq) return;
    applySnapshot(activeGame, message, performance.now());
  }
});

function validSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" ||
      !Number.isInteger(snapshot.seq) || !Number.isFinite(snapshot.time) ||
      !PHASES.has(snapshot.phase) || !Number.isInteger(snapshot.waveIndex) ||
      !Number.isFinite(snapshot.coreHealth) ||
      !validOwnerNumbers(snapshot.wallets) || !validOwnerNumbers(snapshot.totalEarned) ||
      !Array.isArray(snapshot.enemies) || !Array.isArray(snapshot.towers)) return false;

  return snapshot.enemies.every((enemy) =>
    Number.isInteger(enemy?.id) && !!ENEMIES[enemy.type] &&
    Number.isFinite(enemy.distance) && Number.isFinite(enemy.health) &&
    Number.isFinite(enemy.maxHealth) && enemy.flags && typeof enemy.flags === "object"
  ) && snapshot.towers.every((tower) =>
    Number.isInteger(tower?.id) && !!TOWERS[tower.type] &&
    Number.isInteger(tower.tileX) && Number.isInteger(tower.tileY) &&
    Number.isInteger(tower.level) && tower.level >= 1 && OWNER_ORDER.includes(tower.ownerId)
  );
}

function validOwnerNumbers(record) {
  return !!record && typeof record === "object" &&
    OWNER_ORDER.every((ownerId) => Number.isFinite(record[ownerId]));
}

function applySnapshot(game, snapshot, receivedAt) {
  const clockAdvancing = latestSnapshot
    ? snapshot.time > latestSnapshot.time
    : snapshot.phase !== "won" && snapshot.phase !== "lost";
  const oldPhase = game.phase;
  game.phase = snapshot.phase;
  game.waveIndex = snapshot.waveIndex;
  game.coreHealth = snapshot.coreHealth;
  game.wallets = copyOwnerNumbers(snapshot.wallets);
  game.totalEarned = copyOwnerNumbers(snapshot.totalEarned);
  if (snapshot.phase === "countdown" && oldPhase !== "countdown") {
    game.countdown = game.timeBetweenWaves;
  }

  applyEnemySnapshots(game, snapshot.enemies, snapshot.time);
  applyTowerSnapshots(game, snapshot.towers);
  latestSnapshot = {
    seq: snapshot.seq,
    time: snapshot.time,
    receivedAt,
    clockAdvancing,
  };
}

function copyOwnerNumbers(record) {
  return {
    [OWNER_IDS.host]: record[OWNER_IDS.host],
    [OWNER_IDS.guest]: record[OWNER_IDS.guest],
  };
}

function applyEnemySnapshots(game, snapshots, snapshotTime) {
  const existing = new Map(game.enemies.map((enemy) => [enemy.id, enemy]));
  const mirrored = [];
  for (const state of snapshots) {
    let enemy = existing.get(state.id);
    if (!enemy || enemy.type !== state.type) enemy = createMirroredEnemy(state, game.grid);

    const oldSnapshotTime = enemy._coopSnapshotTime;
    const oldSnapshotDistance = enemy._coopSnapshotDistance;
    if (oldSnapshotTime != null && snapshotTime > oldSnapshotTime) {
      enemy._coopPreviousTime = oldSnapshotTime;
      enemy._coopPreviousDistance = oldSnapshotDistance;
      const observedSpeed = (state.distance - oldSnapshotDistance) /
        ((snapshotTime - oldSnapshotTime) * game.grid.tileSize);
      if (Number.isFinite(observedSpeed) && observedSpeed >= 0) {
        enemy.speedTilesPerSec = observedSpeed;
      }
    }
    enemy._coopSnapshotTime = snapshotTime;
    enemy._coopSnapshotDistance = state.distance;
    enemy.health = state.health;
    enemy.maxHealth = state.maxHealth;
    enemy.slowUntil = state.flags.slow ? Infinity : 0;
    enemy.vulnUntil = state.flags.vuln ? Infinity : 0;
    enemy.hitFlash = !!state.flags.hitFlash;
    enemy.alive = true;
    mirrored.push(enemy);
  }
  game.enemies = mirrored;
}

function createMirroredEnemy(state, grid) {
  const def = ENEMIES[state.type];
  return {
    id: state.id,
    type: state.type,
    def,
    mods: {},
    health: state.health,
    maxHealth: state.maxHealth,
    speedTilesPerSec: def.speed,
    bounty: def.bounty,
    xp: def.xp,
    coreDamage: def.coreDamage,
    distance: Math.max(0, Math.min(grid.totalPathLength, state.distance)),
    slowUntil: 0,
    slowFactor: 1,
    vulnUntil: 0,
    vulnMult: 1,
    hitFlash: false,
    healPulse: 0,
    alive: true,
    _coopPreviousTime: null,
    _coopPreviousDistance: state.distance,
    _coopSnapshotTime: null,
    _coopSnapshotDistance: state.distance,
  };
}

function applyTowerSnapshots(game, snapshots) {
  const existing = new Map(game.towers.map((tower) => [tower.id, tower]));
  const mirrored = [];
  let refreshNeeded = false;
  for (const state of snapshots) {
    let tower = existing.get(state.id);
    if (!tower || tower.type !== state.type) {
      tower = createTower(state.type, state.tileX, state.tileY, game.grid, null, state.ownerId);
      tower.id = state.id;
      refreshNeeded = true;
    }
    if (tower.tileX !== state.tileX || tower.tileY !== state.tileY) {
      tower.tileX = state.tileX;
      tower.tileY = state.tileY;
      tower.pos = game.grid.tileCenter(state.tileX, state.tileY);
      refreshNeeded = true;
    }
    if (tower.level !== state.level) {
      tower.level = state.level;
      tower.invested = investedAtLevel(tower.def, state.level);
      refreshNeeded = true;
    }
    // The locked snapshot shape omits XP/unlocked-level data, while the
    // unchanged panel suppresses its callback unless the mirror looks eligible.
    // Keep that UI intent path open; the host's real tower remains the authority
    // and rejects an upgrade that is not actually XP-ready.
    tower.maxUnlockedLevel = xpThresholdFor(tower) === null
      ? state.level
      : state.level + 1;
    tower.ownerId = state.ownerId;
    mirrored.push(tower);
  }
  game.towers = mirrored;
  if (refreshNeeded) refreshTowerStats(game);
}

function investedAtLevel(def, level) {
  let invested = def.baseCost;
  const costs = TOWER_UPGRADES.upgradeCosts;
  for (let currentLevel = 1; currentLevel < level; currentLevel++) {
    const base = costs[Math.min(currentLevel - 1, costs.length - 1)];
    invested += Math.round(base * (def.upgradeCostMult || 1));
  }
  return invested;
}
