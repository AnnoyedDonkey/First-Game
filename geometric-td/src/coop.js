// ============================================================
// CO-OP PROTOCOL — host-authoritative gameplay over net.js.
//
// The transport only moves JSON strings. This module owns everything those
// strings mean: intents on `cmd`, snapshots on `state`, and the guest mirror.
// ============================================================

import {
  COOP, ECONOMY, ECONOMY_LAYOUT, ECONOMY_SKILL_SPEC, ENEMIES, TOWERS,
  TOWER_UPGRADES,
} from "./config.js";
import {
  closeSession, CONNECTION_STATES, getConnectionState, hostSession, joinSession,
  onConnectionState, onMessage, rearmHostSession, sendMessage,
} from "./net.js";
import {
  codenameForCode, countFreeTiles, heartbeatHostSession, publishHostSession,
} from "./lobby.js";
import {
  applyLevelUpSurge, createTower, isUpgradeEligible, placeTower,
  refreshTowerStats, sellTower, tryUpgradeTower, upgradeCostFor,
} from "./towers.js";
import { GEAR_SLOTS, masteryRankFor } from "./equipment.js";
import { emitGearDropEffect } from "./enemies.js";
import {
  emitCoins, emitDeathShards, emitHitSparks, updateParticles,
} from "./particles.js";
import { updateEffects, updateProjectiles } from "./projectiles.js";
import {
  bankCoopRun, getInterestCap, getInterestRate, getMoneyMult, getProgress,
  isTowerUnlocked, validateCoopLootItem, validateCoopTowerRecord,
} from "./progression.js";

const ROLES = Object.freeze({ HOST: "host", GUEST: "guest" });
const OWNER_IDS = Object.freeze({ host: "coop-host", guest: "coop-guest" });
const OWNER_ORDER = Object.freeze([OWNER_IDS.host, OWNER_IDS.guest]);
const OWNER_CODE = new Map(OWNER_ORDER.map((ownerId, index) => [ownerId, index]));
const PHASE_ORDER = Object.freeze(["ready", "wave", "countdown", "won", "lost"]);
const PHASE_CODE = new Map(PHASE_ORDER.map((phase, index) => [phase, index]));
const JOINABLE_PHASES = new Set(["ready", "wave", "countdown"]);
const SHOT_EFFECT_KINDS = new Set(["beam", "muzzle", "ring", "burst"]);
const SHOT_PROJECTILE_KINDS = new Set(["orb", "rocket"]);

// The hot 10Hz path uses positional arrays: JSON field names repeated once per
// enemy were most of the old payload. These indexes are the wire contract for
// COOP.protocolVersion; descriptive names stay here in code, not on the wire.
const SNAP = Object.freeze({
  VERSION: 0, SEQ: 1, LEVEL_ID: 2, TIME_MS: 3, PHASE: 4, WAVE: 5,
  CORE: 6, GUEST_WALLET: 7, ENEMIES: 8, TOWERS: 9, LENGTH: 10,
});
const ENEMY_STATE = Object.freeze({
  ID: 0, TYPE: 1, DISTANCE: 2, HEALTH: 3, FLAGS: 4, LENGTH: 5,
});
const TOWER_STATE = Object.freeze({
  ID: 0, LEVEL: 1, UPGRADE_COST: 2, FLAGS: 3, MASTERY: 4, LENGTH: 5,
});
const TOWER_DESC = Object.freeze({
  ID: 0, TYPE: 1, TILE_X: 2, TILE_Y: 3, OWNER: 4, NAME: 5, GEAR: 6,
  LENGTH: 7,
});
const ENEMY_FLAG = Object.freeze({ SLOW: 1, VULN: 2, HIT_FLASH: 4 });
const TOWER_FLAG = Object.freeze({ UPGRADE_READY: 1 });
const ENEMY_TYPE_ORDER = Object.freeze(Object.keys(ENEMIES));
const ENEMY_TYPE_CODE = new Map(
  ENEMY_TYPE_ORDER.map((type, index) => [type, index])
);
const TOWER_TYPE_ORDER = Object.freeze(Object.keys(TOWERS));
const TOWER_TYPE_CODE = new Map(
  TOWER_TYPE_ORDER.map((type, index) => [type, index])
);
const GEAR_RARITY_ORDER = Object.freeze([
  null, "common", "enhanced", "rare", "prismatic", "singularity",
]);
const GEAR_RARITY_CODE = new Map(
  GEAR_RARITY_ORDER.map((rarity, index) => [rarity, index])
);
const GEAR_BITS_PER_SLOT = 3;
const GEAR_PACK_LIMIT = 2 ** (GEAR_BITS_PER_SLOT * GEAR_SLOTS.length);

let activeGame = null;
let activeRole = null;
let snapshotSequence = 0;
let lastSnapshotSentAt = -Infinity;
let latestSnapshot = null;
let guestSnapshotJitterMs = 0;
let guestInterpDelayMs = COOP.interpDelayMs;
let guestInterpDelayTargetMs = COOP.interpDelayMs;
let guestLastSnapshotReceivedAt = null;
let guestLastUpdateAt = null;
let guestJoined = false;
let guestPresent = false;
let sessionConnected = false;
let hostEvents = [];
let guestEvents = [];
let hostShots = [];
let guestShots = [];
let hostLobby = null;
let guestProfileSent = false;
let guestProfileApplied = false;
let hostRunBanked = false;
let hostResultSent = false;
let guestRunBanked = false;
let hostRearmScheduled = false;
let hostTowerCatalogDirty = false;
let guestTowerCatalog = new Map();
let latestTowerStates = [];

export function startHost(game, { listed = false, hostNick = null } = {}) {
  requireStartableGame(game);
  const pending = hostSession();
  activate(game, ROLES.HOST);
  hostLobby = {
    code: pending.code,
    codename: codenameForCode(pending.code),
    listed: !!listed,
    hostNick,
    published: false,
    writePending: false,
    lastWriteAt: -Infinity,
  };
  Object.defineProperty(pending, "codename", {
    value: hostLobby.codename,
    enumerable: true,
  });
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

export function stopSession(reason = "Co-op session closed") {
  closeSession(reason);
  deactivate();
}

// Local solo/host actions and remote guest actions all reach the same real
// tower functions here. A guest only transmits; `{pending:true}` explicitly
// tells main.js not to run success/failure presentation against stale state.
export function sendIntent(game, intent) {
  if (!isActive(game)) {
    return applyIntent(game, intent, game.actingPlayerId || game.localPlayerId);
  }
  if (isHost(game)) {
    const result = applyIntent(game, intent, OWNER_IDS.host);
    if (intent?.op === "place" && result?.ok) hostTowerCatalogDirty = true;
    return result;
  }

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
  if (!isHost(game)) return;
  if (game.phase === "won" || game.phase === "lost") bankHostRun(game);
  updateHostLobby(game, now);
  if (getConnectionState() !== CONNECTION_STATES.CONNECTED) return;
  if (!guestJoined) acceptGuest(game, now);
  flushHostTowerCatalog(game);
  flushHostEvents();
  flushHostShots();
  if (game.phase === "won" || game.phase === "lost") {
    sendGuestResult(game, now);
    return;
  }
  const intervalMs = 1000 / COOP.snapshotHz;
  if (now < lastSnapshotSentAt + intervalMs) return;

  sendSnapshot(game, now);
}

// Guests never call updateGame. Their render clock follows the newest host
// time behind a small buffer, and every enemy advances from its own observed
// authoritative speed until another snapshot corrects it.
export function updateGuest(game, now) {
  if (!isGuest(game)) return;
  sendGuestProfile(game);
  if (!latestSnapshot) return;

  advanceGuestInterpDelay(now);
  const elapsedSinceSnapshot = Math.max(0, now - latestSnapshot.receivedAt) / 1000;
  const bufferedElapsed = latestSnapshot.clockAdvancing
    ? elapsedSinceSnapshot - guestInterpDelayMs / 1000
    : 0;
  const renderTime = Math.max(
    0,
    latestSnapshot.time + bufferedElapsed
  );
  const previousTime = game.time;
  game.time = renderTime;
  const cosmeticDt = Math.max(0, renderTime - previousTime);
  if (game.phase === "countdown" && renderTime > previousTime) {
    game.countdown = Math.max(0, game.countdown - (renderTime - previousTime));
  }

  const pathEnd = game.grid.totalPathLength;
  const tileSize = game.grid.tileSize;
  for (const enemy of game.enemies) {
    const authoritativeDistance = guestEnemyDistanceAt(enemy, renderTime, tileSize);
    const correctionElapsed = Math.max(0, now - enemy._coopCorrectionStartedAt);
    const correctionDuration = Math.max(
      0,
      enemy._coopCorrectionEndsAt - enemy._coopCorrectionStartedAt
    );
    const correctionRemaining = correctionDuration > 0
      ? Math.max(0, 1 - correctionElapsed / correctionDuration)
      : 0;
    const distance = authoritativeDistance +
      enemy._coopCorrectionOffset * correctionRemaining;
    enemy.distance = Math.max(0, Math.min(pathEnd, distance));
  }

  // The guest owns a cosmetic-only layer. Mirrored projectiles advance through
  // the existing visual path, with their damage gate enforced in explode().
  updateProjectiles(game, cosmeticDt);
  updateEffects(game, cosmeticDt);
  updateParticles(game, cosmeticDt);
  let refreshNeeded = false;
  for (const tower of game.towers) {
    if (tower._surgeActive && game.time >= tower._surgeUntil) {
      tower._surgeActive = false;
      refreshNeeded = true;
    }
  }
  if (refreshNeeded) refreshTowerStats(game);
  replayGuestEvents(game);
  replayGuestShots(game);
}

function requireStartableGame(game) {
  if (!game?.grid || !game?.level) throw new Error("Start a battle before starting co-op");
  if (activeGame) throw new Error("A co-op game is already active in this tab");
}

function activate(game, role) {
  activeGame = game;
  activeRole = role;
  game.coop = true;
  game.coopRole = role;
  game.coopHostId = OWNER_IDS.host;
  delete game.coopEndReason;
  snapshotSequence = 0;
  lastSnapshotSentAt = -Infinity;
  latestSnapshot = null;
  if (role === ROLES.GUEST) resetGuestMotion();
  guestJoined = false;
  guestPresent = false;
  sessionConnected = false;
  hostEvents = [];
  guestEvents = [];
  hostShots = [];
  guestShots = [];
  hostLobby = null;
  guestProfileSent = false;
  guestProfileApplied = false;
  hostRunBanked = false;
  hostResultSent = false;
  guestRunBanked = false;
  hostRearmScheduled = false;
  hostTowerCatalogDirty = role === ROLES.HOST;
  guestTowerCatalog = new Map();
  latestTowerStates = [];
  preparePlayers(game, role);
  if (role === ROLES.HOST) {
    game.coopEventSink = (event) => {
      if (event?.kind === "shot") {
        queueHostShot(game, event.effects, event.projectiles);
      } else {
        queueHostEvent(game, event);
      }
    };
  }
  if (role === ROLES.GUEST) {
    delete game.coopEventSink;
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

function deactivate() {
  if (activeGame) {
    delete activeGame.coopEventSink;
    delete activeGame.coop;
    delete activeGame.coopRole;
    delete activeGame.coopHostId;
    delete activeGame.coopEndReason;
  }
  activeGame = null;
  if (activeRole === ROLES.GUEST) resetGuestMotion();
  activeRole = null;
  latestSnapshot = null;
  guestPresent = false;
  sessionConnected = false;
  hostLobby = null;
  hostEvents = [];
  guestEvents = [];
  hostShots = [];
  guestShots = [];
  guestProfileSent = false;
  guestProfileApplied = false;
  hostRunBanked = false;
  hostResultSent = false;
  guestRunBanked = false;
  hostRearmScheduled = false;
  hostTowerCatalogDirty = false;
  guestTowerCatalog = new Map();
  latestTowerStates = [];
}

function updateHostLobby(game, now, force = false) {
  if (!hostLobby) return;
  if (hostLobby.writePending) {
    if (force) hostLobby.forceWrite = true;
    return;
  }
  const state = getConnectionState();
  const rowExists = state === CONNECTION_STATES.WAITING_FOR_PEER ||
    state === CONNECTION_STATES.CONNECTING ||
    state === CONNECTION_STATES.CONNECTED;
  if (!rowExists) return;

  const intervalMs = COOP.heartbeatSeconds * 1000;
  if (!force && now < hostLobby.lastWriteAt + intervalMs) return;
  const lobby = hostLobby;
  const metadata = {
    wave: game.waveIndex + 1,
    players: game.ownerIds.length,
    freeTiles: countFreeTiles(game),
  };
  const write = lobby.published
    ? heartbeatHostSession(lobby.code, metadata)
    : publishHostSession(lobby.code, {
        ...metadata,
        codename: lobby.codename,
        listed: lobby.listed,
        hostNick: lobby.hostNick,
        levelId: game.level.id,
        maxPlayers: COOP.maxPlayers,
      });

  lobby.writePending = true;
  lobby.lastWriteAt = now;
  write.then(() => {
    if (hostLobby !== lobby) return;
    lobby.published = true;
  }).catch((error) => {
    // Signaling and play remain independent from this best-effort directory
    // write. The heartbeat schedule retries without hammering Supabase.
    console.warn("Co-op lobby update failed:", error);
  }).finally(() => {
    if (hostLobby === lobby) {
      lobby.writePending = false;
      if (lobby.forceWrite) {
        lobby.forceWrite = false;
        lobby.lastWriteAt = -Infinity;
      }
    }
  });
}

// Deterministic ids let both tabs apply the ownership/wallet rules without
// sending identity data every snapshot. The remote placeholder is replaced by
// the guest's one-shot roster/economy profile after the cmd channel opens.
function preparePlayers(game, role) {
  const localOwnerId = role === ROLES.HOST ? OWNER_IDS.host : OWNER_IDS.guest;
  const remoteOwnerId = role === ROLES.HOST ? OWNER_IDS.guest : OWNER_IDS.host;
  const oldLocalId = game.localPlayerId;
  const oldPlayer = game.players?.[oldLocalId] || {};
  const oldWallet = game.wallets?.[oldLocalId] ?? game.level.startingMoney;
  const oldEarned = game.totalEarned?.[oldLocalId] || 0;
  const oldShards = typeof game.shardsEarned === "number"
    ? game.shardsEarned
    : game.shardsEarned?.[oldLocalId] || 0;

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
      ...(ownerId === remoteOwnerId ? { roster: [], unlockedTowerTypes: [] } : {}),
    };
  }

  // Presence starts local-only on both sides. The CONNECTED transition adds
  // the peer, so neither HUD claims somebody is present during signaling.
  game.ownerIds = [localOwnerId];
  game.players = players;
  game.wallets = role === ROLES.HOST
    ? { [OWNER_IDS.host]: oldWallet }
    : {
        [OWNER_IDS.host]: game.level.startingMoney,
        [OWNER_IDS.guest]: oldWallet,
      };
  game.totalEarned = role === ROLES.HOST
    ? { [OWNER_IDS.host]: oldEarned }
    : { [OWNER_IDS.host]: 0, [OWNER_IDS.guest]: oldEarned };
  game.shardsEarned = role === ROLES.HOST
    ? { [OWNER_IDS.host]: oldShards, [OWNER_IDS.guest]: 0 }
    : { [OWNER_IDS.host]: 0, [OWNER_IDS.guest]: oldShards };
  game.localPlayerId = localOwnerId;
  game.actingPlayerId = localOwnerId;
  game.progressionOwnerId = localOwnerId;
  for (const tower of game.towers) {
    // A host may build during signaling. Towers created before co-op activation
    // still carry the single-player id, so adopt them into the local identity.
    if (!OWNER_ORDER.includes(tower.ownerId)) tower.ownerId = localOwnerId;
  }
}

function exactRecord(record, keys) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const actual = Object.keys(record);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(record, key));
}

function guestProfileMessage() {
  const roster = getProgress().roster.map((record) => ({
    name: record.name,
    type: record.type,
    maxLevel: record.maxLevel,
    xp: record.xp,
    kills: record.kills,
    gear: structuredClone(record.gear),
  }));
  return {
    type: "guestProfile",
    protocol: COOP.protocolVersion,
    ownerId: OWNER_IDS.guest,
    roster,
    unlockedTowerTypes: Object.keys(TOWERS).filter(isTowerUnlocked),
    economy: {
      moneyMult: getMoneyMult(),
      interestRate: getInterestRate(),
      interestCap: getInterestCap(),
    },
  };
}

function sendGuestProfile(game) {
  if (!isGuest(game) || guestProfileSent ||
      getConnectionState() !== CONNECTION_STATES.CONNECTED) return;
  const message = guestProfileMessage();
  if (!validGuestProfile(message)) {
    game.coopJoinError = "Local co-op roster data is invalid.";
    return;
  }
  try {
    sendMessage("cmd", message);
    guestProfileSent = true;
  } catch {
    // updateGuest retries until one send succeeds or the connection closes.
  }
}

function validGuestProfile(message) {
  if (!exactRecord(message, [
    "type", "protocol", "ownerId", "roster", "unlockedTowerTypes", "economy",
  ]) ||
      message.type !== "guestProfile" || message.protocol !== COOP.protocolVersion ||
      message.ownerId !== OWNER_IDS.guest ||
      !Array.isArray(message.roster) ||
      message.roster.length > COOP.progressionExchange.maxRosterRecords ||
      !Array.isArray(message.unlockedTowerTypes) ||
      message.unlockedTowerTypes.length > Object.keys(TOWERS).length ||
      !exactRecord(message.economy, ["moneyMult", "interestRate", "interestCap"])) {
    return false;
  }
  const names = new Set();
  for (const record of message.roster) {
    if (!validateCoopTowerRecord(record, true) || names.has(record.name)) return false;
    names.add(record.name);
  }
  const unlockedTypes = new Set();
  for (const type of message.unlockedTowerTypes) {
    if (typeof type !== "string" || !Object.hasOwn(TOWERS, type) || unlockedTypes.has(type)) {
      return false;
    }
    unlockedTypes.add(type);
  }

  const moneyMax = 1 +
    ECONOMY_SKILL_SPEC.eco_money.step * ECONOMY_LAYOUT.steps;
  const interestRateMax =
    ECONOMY_SKILL_SPEC.eco_intrate.step * ECONOMY_LAYOUT.steps;
  const interestCapMax = (ECONOMY.interest?.baseCap || 0) +
    ECONOMY_SKILL_SPEC.eco_intcap.step * ECONOMY_LAYOUT.steps;
  const { moneyMult, interestRate, interestCap } = message.economy;
  return Number.isFinite(moneyMult) && moneyMult >= 1 && moneyMult <= moneyMax &&
    Number.isFinite(interestRate) && interestRate >= 0 && interestRate <= interestRateMax &&
    Number.isFinite(interestCap) && interestCap >= 0 && interestCap <= interestCapMax;
}

function applyGuestProfile(game, message) {
  if (!game || guestProfileApplied || !validGuestProfile(message)) return;
  game.players[OWNER_IDS.guest].roster = structuredClone(message.roster);
  game.players[OWNER_IDS.guest].unlockedTowerTypes = [...message.unlockedTowerTypes];
  game.players[OWNER_IDS.guest].economy = { ...message.economy };
  guestProfileApplied = true;
}

function applyIntent(game, intent, ownerId) {
  if (!game || !intent || typeof intent !== "object") return { ok: false, reason: "intent" };
  switch (intent.op) {
    case "place":
      if (!TOWERS[intent.towerType] ||
          !Number.isInteger(intent.tileX) || !Number.isInteger(intent.tileY)) {
        return { ok: false, reason: "intent" };
      }
      return placeTower(
        game,
        intent.towerType,
        intent.tileX,
        intent.tileY,
        ownerId,
        ownerId === OWNER_IDS.guest
          ? game.players?.[ownerId]?.unlockedTowerTypes
          : null
      );
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

function queueHostEvent(game, event) {
  if (!isHost(game) || !guestJoined ||
      getConnectionState() !== CONNECTION_STATES.CONNECTED ||
      !event || typeof event !== "object") return;
  hostEvents.push({ ...event, time: game.time });
}

function flushHostEvents() {
  if (!hostEvents.length) return;
  const events = hostEvents;
  hostEvents = [];
  try {
    // One reliable message per render frame avoids DataChannel overhead for
    // every individual spark burst while preserving event order.
    sendMessage("cmd", { type: "events", events });
  } catch {
    // Cosmetic history is stale once a send fails; snapshots remain the
    // authoritative recovery path.
  }
}

function queueHostShot(game, effects, projectiles) {
  if (!isHost(game) || !guestJoined ||
      getConnectionState() !== CONNECTION_STATES.CONNECTED) return;
  const shotEffects = Array.isArray(effects)
    ? effects.filter((effect) => SHOT_EFFECT_KINDS.has(effect?.kind))
        .map((effect) => ({ ...effect }))
    : [];
  const shotProjectiles = Array.isArray(projectiles)
    ? projectiles.map(encodeShotProjectile).filter(Boolean)
    : [];
  if (!shotEffects.length && !shotProjectiles.length) return;
  hostShots.push({ time: game.time, effects: shotEffects, projectiles: shotProjectiles });
}

function encodeShotProjectile(projectile) {
  if (!SHOT_PROJECTILE_KINDS.has(projectile?.kind)) return null;
  const sourceTower = projectile.sourceTower;
  return {
    kind: projectile.kind,
    x: projectile.x,
    y: projectile.y,
    targetId: projectile.target?.id ?? null,
    lastTargetPos: { ...projectile.lastTargetPos },
    speed: projectile.speed,
    damage: projectile.damage,
    crit: projectile.crit,
    splashRadius: projectile.splashRadius,
    color: projectile.color,
    sourceTowerId: sourceTower?.id ?? null,
    sourceAimAngle: sourceTower?.aimAngle ?? 0,
    fractalWarhead: !!sourceTower?.gearUniques?.has("fractalWarhead"),
  };
}

function flushHostShots() {
  if (!hostShots.length) return;
  const shots = hostShots;
  hostShots = [];
  try {
    // Shot presentation is disposable and must never head-of-line-block an
    // intent or reliable cosmetic event. It deliberately shares the lossy,
    // unordered state channel with snapshots, but remains a separate batch.
    sendMessage("state", { type: "shots", shots });
  } catch {
    // Never retry stale firing art. The next frame carries only new shots.
  }
}

function sendSnapshot(game, now) {
  const snapshot = buildSnapshot(game, ++snapshotSequence);
  try {
    sendMessage("state", snapshot);
    lastSnapshotSentAt = now;
    return true;
  } catch {
    // A lost state send is disposable by design. Do not move the schedule
    // forward, so the next frame can try the newest state immediately.
    return false;
  }
}

function acceptGuest(game, now) {
  if (!isHost(game) || guestJoined || !JOINABLE_PHASES.has(game.phase)) return;
  const hostTotalEarned = game.totalEarned[OWNER_IDS.host] || 0;
  const grant = Math.floor(Math.min(
    COOP.dropIn.maxGrant,
    COOP.dropIn.earningsShare * hostTotalEarned
  ));
  game.ownerIds = [...OWNER_ORDER];
  game.wallets[OWNER_IDS.guest] = game.level.startingMoney + grant;
  game.totalEarned[OWNER_IDS.guest] = 0;
  game.coopDropInGrant = grant;
  guestJoined = true;
  guestPresent = true;
  updateHostLobby(game, now, true);

  try {
    sendMessage("cmd", {
      type: "join",
      protocol: COOP.protocolVersion,
      ownerId: OWNER_IDS.guest,
      levelId: game.level.id,
      wallet: game.wallets[OWNER_IDS.guest],
      grant,
    });
  } catch {
    // The immediate full snapshot below carries the same wallet. If this
    // assignment message is lost to a closing channel, state remains safe.
  }
  hostTowerCatalogDirty = true;
  flushHostTowerCatalog(game);
  sendSnapshot(game, now);
}

function towerProgress(tower, includeType = false) {
  const record = {
    name: tower.name,
    maxLevel: Math.max(tower.maxUnlockedLevel || 1, tower.level || 1),
    xp: tower.xp,
    kills: tower.kills,
    gear: structuredClone(tower.gear),
  };
  return includeType ? { name: record.name, type: tower.type, ...record } : record;
}

// Co-op loot is a shared roll: both local saves receive the exact same items,
// regardless of whose tower landed the killing blow.
function sharedLoot(game) {
  return structuredClone(game.lootDrops);
}

function roundedShardsFor(game, ownerId) {
  const value = game.shardsEarned?.[ownerId] || 0;
  return Math.round(value);
}

function bankHostRun(game) {
  if (hostRunBanked) return;
  const result = bankCoopRun({
    towers: game.towers
      .filter((tower) => tower.ownerId === OWNER_IDS.host)
      .map((tower) => towerProgress(tower, true)),
    loot: sharedLoot(game),
    shards: roundedShardsFor(game, OWNER_IDS.host),
  }, { trustedLocalTowers: true });
  if (!result.ok) {
    game.coopBankError = result.reason;
    return;
  }
  hostRunBanked = true;
  game.lootResult = result.lootResult;
  game.coopResult = {
    waveReached: game.waveIndex + 1,
    lootResult: result.lootResult,
  };
}

function guestResultMessage(game) {
  return {
    type: "sessionEnd",
    ownerId: OWNER_IDS.guest,
    towers: game.towers
      .filter((tower) => tower.ownerId === OWNER_IDS.guest)
      .map((tower) => towerProgress(tower)),
    loot: sharedLoot(game),
    shards: roundedShardsFor(game, OWNER_IDS.guest),
    waveReached: game.waveIndex + 1,
  };
}

function sendGuestResult(game, now) {
  if (hostResultSent || !guestJoined) return;
  const message = guestResultMessage(game);
  if (!validSessionEnd(message)) {
    game.coopBankError = "sessionEnd";
    return;
  }
  try {
    sendMessage("cmd", message);
    hostResultSent = true;
    // The reliable result and terminal snapshot use separate channels; send
    // both immediately and let each channel preserve its own contract.
    sendSnapshot(game, now);
  } catch {
    // updateHost retries while the channel still reports CONNECTED.
  }
}

function validSessionEnd(message) {
  if (!exactRecord(message, [
    "type", "ownerId", "towers", "loot", "shards", "waveReached",
  ]) || message.type !== "sessionEnd" || message.ownerId !== OWNER_IDS.guest ||
      !Array.isArray(message.towers) ||
      message.towers.length > COOP.progressionExchange.maxBattleTowers ||
      !Array.isArray(message.loot) ||
      message.loot.length > COOP.progressionExchange.maxLootDrops ||
      !Number.isSafeInteger(message.shards) || message.shards < 0 ||
      !Number.isSafeInteger(message.waveReached) || message.waveReached < 1) {
    return false;
  }
  const names = new Set();
  for (const tower of message.towers) {
    if (!validateCoopTowerRecord(tower) || names.has(tower.name)) return false;
    names.add(tower.name);
  }
  const itemIds = new Set();
  for (const item of message.loot) {
    if (!validateCoopLootItem(item) || itemIds.has(item.id)) return false;
    itemIds.add(item.id);
  }
  return true;
}

function applySessionEnd(game, message) {
  if (!game || guestRunBanked || !validSessionEnd(message)) return;
  const result = bankCoopRun({
    towers: message.towers,
    loot: message.loot,
    shards: message.shards,
  });
  if (!result.ok) {
    game.coopBankError = result.reason;
    return;
  }
  guestRunBanked = true;
  game.lootResult = result.lootResult;
  game.coopResult = {
    waveReached: message.waveReached,
    lootResult: result.lootResult,
  };
}

function packGearRarities(tower) {
  let packed = 0;
  for (let index = 0; index < GEAR_SLOTS.length; index++) {
    const rarity = tower.gear?.[GEAR_SLOTS[index]]?.rarity || null;
    const code = GEAR_RARITY_CODE.get(rarity) ?? 0;
    packed |= code << (index * GEAR_BITS_PER_SLOT);
  }
  return packed;
}

function unpackGearRarities(packed) {
  return GEAR_SLOTS.map((_, index) => {
    const mask = (1 << GEAR_BITS_PER_SLOT) - 1;
    return GEAR_RARITY_ORDER[(packed >> (index * GEAR_BITS_PER_SLOT)) & mask] || null;
  });
}

function validGearPack(packed) {
  if (!Number.isSafeInteger(packed) || packed < 0 || packed >= GEAR_PACK_LIMIT) {
    return false;
  }
  const mask = (1 << GEAR_BITS_PER_SLOT) - 1;
  for (let index = 0; index < GEAR_SLOTS.length; index++) {
    const code = (packed >> (index * GEAR_BITS_PER_SLOT)) & mask;
    if (code >= GEAR_RARITY_ORDER.length) return false;
  }
  return true;
}

// Tower identity is static and therefore belongs on the reliable channel,
// not repeated ten times a second. Sending the complete catalog on a change
// also makes a drop-in/reconnect self-contained without per-tower ACK state.
function buildTowerCatalog(game) {
  return [COOP.protocolVersion, game.towers.map((tower) => [
    tower.id,
    TOWER_TYPE_CODE.get(tower.type),
    tower.tileX,
    tower.tileY,
    OWNER_CODE.get(tower.ownerId),
    tower.name,
    packGearRarities(tower),
  ])];
}

function flushHostTowerCatalog(game) {
  if (!hostTowerCatalogDirty || !isHost(game) ||
      getConnectionState() !== CONNECTION_STATES.CONNECTED) return;
  try {
    sendMessage("cmd", buildTowerCatalog(game));
    hostTowerCatalogDirty = false;
  } catch {
    // Keep it dirty and retry. A guest never invents an identity for an
    // unknown tower; it waits for this reliable catalog instead.
  }
}

function buildSnapshot(game, sequence) {
  const enemyFlags = (enemy) =>
    (game.time < enemy.slowUntil ? ENEMY_FLAG.SLOW : 0) |
    (game.time < enemy.vulnUntil || game.time < (enemy.gearVulnUntil || 0)
      ? ENEMY_FLAG.VULN : 0) |
    (enemy.hitFlash > 0 ? ENEMY_FLAG.HIT_FLASH : 0);
  const encodedHealth = (enemy) => {
    if (!(enemy.maxHealth > 0) || !(enemy.health > 0)) return 0;
    const ratio = Math.min(1, enemy.health / enemy.maxHealth);
    return Math.max(1, Math.round(ratio * COOP.snapshotHealthScale));
  };

  return [
    COOP.protocolVersion,
    sequence,
    game.level.id,
    Math.round(game.time * 1000),
    PHASE_CODE.get(game.phase),
    game.waveIndex,
    game.coreHealth,
    game.wallets[OWNER_IDS.guest],
    game.enemies.filter((enemy) => enemy.alive).map((enemy) => [
      enemy.id,
      ENEMY_TYPE_CODE.get(enemy.type),
      Math.round(enemy.distance * COOP.snapshotDistanceScale),
      encodedHealth(enemy),
      enemyFlags(enemy),
    ]),
    game.towers.map((tower) => {
      const upgradeCost = upgradeCostFor(tower);
      return [
        tower.id,
        tower.level,
        upgradeCost === null ? -1 : upgradeCost,
        isUpgradeEligible(tower) ? TOWER_FLAG.UPGRADE_READY : 0,
        masteryRankFor(tower.xp),
      ];
    }),
  ];
}

function validTowerCatalog(message) {
  if (!Array.isArray(message) || message.length !== 2 ||
      message[0] !== COOP.protocolVersion || !Array.isArray(message[1]) ||
      message[1].length > COOP.progressionExchange.maxBattleTowers) return false;
  const ids = new Set();
  return message[1].every((desc) => {
    if (!Array.isArray(desc) || desc.length !== TOWER_DESC.LENGTH ||
        !Number.isInteger(desc[TOWER_DESC.ID]) || ids.has(desc[TOWER_DESC.ID]) ||
        !Number.isInteger(desc[TOWER_DESC.TYPE]) ||
        !TOWER_TYPE_ORDER[desc[TOWER_DESC.TYPE]] ||
        !Number.isInteger(desc[TOWER_DESC.TILE_X]) ||
        !Number.isInteger(desc[TOWER_DESC.TILE_Y]) ||
        !Number.isInteger(desc[TOWER_DESC.OWNER]) ||
        !OWNER_ORDER[desc[TOWER_DESC.OWNER]] ||
        typeof desc[TOWER_DESC.NAME] !== "string" ||
        desc[TOWER_DESC.NAME].length < 1 ||
        desc[TOWER_DESC.NAME].length > COOP.progressionExchange.maxNameLength ||
        !validGearPack(desc[TOWER_DESC.GEAR])) return false;
    ids.add(desc[TOWER_DESC.ID]);
    return true;
  });
}

function applyTowerCatalog(game, message) {
  if (!game || !validTowerCatalog(message)) return;
  guestTowerCatalog = new Map(
    message[1].map((desc) => [desc[TOWER_DESC.ID], desc])
  );
  if (latestTowerStates.length) applyTowerSnapshots(game, latestTowerStates);
}

onConnectionState(({ state }) => {
  if (state === CONNECTION_STATES.WAITING_FOR_PEER && isHost()) {
    updateHostLobby(activeGame, performance.now(), true);
  }
  if (state === CONNECTION_STATES.CONNECTED && isActive()) {
    sessionConnected = true;
    if (isGuest()) {
      activeGame.ownerIds = [...OWNER_ORDER];
      sendGuestProfile(activeGame);
    }
    if (isHost() && !guestJoined) {
      acceptGuest(activeGame, performance.now());
    } else if (isHost() && !guestPresent) {
      guestPresent = true;
      activeGame.ownerIds = [...OWNER_ORDER];
      updateHostLobby(activeGame, performance.now(), true);
      hostTowerCatalogDirty = true;
      flushHostTowerCatalog(activeGame);
      sendSnapshot(activeGame, performance.now());
    }
  }
  if (isHost() && guestPresent && state === CONNECTION_STATES.FAILED) {
    releaseGuestSlot(activeGame);
    scheduleHostRearm(activeGame);
  }
  if (
    isGuest() && sessionConnected && (
      state === CONNECTION_STATES.DISCONNECTED ||
      state === CONNECTION_STATES.FAILED ||
      state === CONNECTION_STATES.CLOSED
    )
  ) {
    // For a guest, the only peer is the authority. Losing it ends the battle;
    // main.js turns this into a clean, localized exit instead of a frozen war.
    activeGame.ownerIds = [OWNER_IDS.guest];
    activeGame.coopEndReason ||= "host-left";
  }
  if (
    isHost() && !hostRearmScheduled && (
      state === CONNECTION_STATES.FAILED ||
      state === CONNECTION_STATES.CLOSED
    )
  ) {
    // Do not refresh a dead room. Its last successful heartbeat will cross
    // the browser's stale cutoff and disappear without requiring DELETE RLS.
    hostLobby = null;
  }
});

function releaseGuestSlot(game) {
  guestJoined = false;
  guestPresent = false;
  guestProfileApplied = false;
  hostResultSent = false;
  hostEvents = [];
  hostShots = [];
  game.ownerIds = [OWNER_IDS.host];
  game.players[OWNER_IDS.guest].roster = [];
  game.players[OWNER_IDS.guest].unlockedTowerTypes = [];
  game.players[OWNER_IDS.guest].economy = {};
  updateHostLobby(game, performance.now(), true);
}

function scheduleHostRearm(game) {
  if (hostRearmScheduled || !hostLobby || !JOINABLE_PHASES.has(game.phase)) return;
  hostRearmScheduled = true;
  queueMicrotask(() => {
    if (!isHost(game) || !hostLobby) {
      hostRearmScheduled = false;
      return;
    }
    try {
      const pending = rearmHostSession();
      // Keep the guard raised through startSession's synchronous CLOSED ->
      // SIGNALING transition so the lobby metadata survives replacing the
      // spent peer connection.
      hostRearmScheduled = false;
      pending.catch((error) => {
        console.warn("Could not re-arm co-op guest slot:", error);
      });
    } catch (error) {
      hostRearmScheduled = false;
      console.warn("Could not re-arm co-op guest slot:", error);
    }
  });
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

  if (channel === "cmd") {
    if (isGuest() && Array.isArray(message)) {
      applyTowerCatalog(activeGame, message);
    } else if (isHost() && message?.op) {
      const result = applyIntent(activeGame, message, OWNER_IDS.guest);
      if (message.op === "place" && result?.ok) hostTowerCatalogDirty = true;
    } else if (isHost() && message?.type === "guestProfile") {
      applyGuestProfile(activeGame, message);
    } else if (isGuest() && message?.type === "join") {
      applyJoinAssignment(activeGame, message);
    } else if (isGuest() && message?.type === "sessionEnd") {
      applySessionEnd(activeGame, message);
    } else if (isGuest() && message?.type === "events" && Array.isArray(message.events)) {
      for (const event of message.events) {
        if (validCosmeticEvent(event)) guestEvents.push(event);
      }
    }
  } else if (channel === "state" && isGuest()) {
    if (message?.type === "shots" && Array.isArray(message.shots)) {
      for (const shot of message.shots) {
        if (validShot(shot)) guestShots.push(shot);
      }
    } else if (validSnapshot(message)) {
      if (latestSnapshot && message[SNAP.SEQ] <= latestSnapshot.seq) return;
      if (message[SNAP.LEVEL_ID] !== activeGame.level.id) {
        activeGame.coopJoinError =
          `Host is playing ${message[SNAP.LEVEL_ID]}; open that level before joining.`;
        return;
      }
      applySnapshot(activeGame, message, performance.now());
    } else if (
      (Array.isArray(message) && message[SNAP.VERSION] !== COOP.protocolVersion) ||
      (!Array.isArray(message) && Number.isInteger(message?.seq))
    ) {
      activeGame.coopJoinError = "Co-op versions do not match. Refresh both devices.";
    }
  }
});

function applyJoinAssignment(game, message) {
  if (!game) return;
  if (message.protocol !== COOP.protocolVersion) {
    game.coopJoinError = "Co-op versions do not match. Refresh both devices.";
    return;
  }
  if (message.ownerId !== OWNER_IDS.guest ||
      typeof message.levelId !== "string" ||
      !Number.isFinite(message.wallet) || !Number.isFinite(message.grant)) return;
  if (message.levelId !== game.level.id) {
    game.coopJoinError =
      `Host is playing ${message.levelId}; open that level before joining.`;
    return;
  }
  game.coopDropInGrant = message.grant;
  // Cross-channel ordering is undefined. Do not let a late join assignment
  // roll back a wallet already advanced by a newer state snapshot.
  if (!latestSnapshot) game.wallets[OWNER_IDS.guest] = message.wallet;
}

function validCosmeticEvent(event) {
  if (!event || typeof event !== "object" || !Number.isFinite(event.time)) return false;
  switch (event.kind) {
    case "hit":
      return validPoint(event) && typeof event.color === "string" &&
        Number.isInteger(event.count) && event.count >= 0;
    case "kill":
      return validPoint(event) && !!ENEMIES[event.enemyType] &&
        Number.isInteger(event.coinCount) && event.coinCount >= 0 &&
        Number.isFinite(event.coinSpeedMult) && Number.isFinite(event.power);
    case "levelUp":
      return Number.isInteger(event.towerId);
    case "gearDrop":
      return validPoint(event) && typeof event.rarity === "string" &&
        typeof event.slot === "string";
    default:
      return false;
  }
}

function validPoint(event) {
  return Number.isFinite(event.x) && Number.isFinite(event.y);
}

function validShot(shot) {
  return !!shot && typeof shot === "object" && Number.isFinite(shot.time) &&
    Array.isArray(shot.effects) && shot.effects.every(validShotEffect) &&
    Array.isArray(shot.projectiles) && shot.projectiles.every(validShotProjectile);
}

function validShotEffect(effect) {
  if (!effect || !SHOT_EFFECT_KINDS.has(effect.kind) ||
      typeof effect.color !== "string" ||
      !Number.isFinite(effect.ttl) || !Number.isFinite(effect.maxTtl) ||
      effect.ttl <= 0 || effect.maxTtl <= 0) return false;
  if (effect.kind === "beam") {
    return Number.isFinite(effect.x1) && Number.isFinite(effect.y1) &&
      Number.isFinite(effect.x2) && Number.isFinite(effect.y2) &&
      Number.isFinite(effect.width);
  }
  return validPoint(effect) && Number.isFinite(effect.radius);
}

function validShotProjectile(projectile) {
  return !!projectile && SHOT_PROJECTILE_KINDS.has(projectile.kind) &&
    validPoint(projectile) && validPoint(projectile.lastTargetPos) &&
    (projectile.targetId === null || Number.isInteger(projectile.targetId)) &&
    (projectile.sourceTowerId === null || Number.isInteger(projectile.sourceTowerId)) &&
    Number.isFinite(projectile.speed) && Number.isFinite(projectile.damage) &&
    typeof projectile.crit === "boolean" && Number.isFinite(projectile.splashRadius) &&
    typeof projectile.color === "string" && Number.isFinite(projectile.sourceAimAngle) &&
    typeof projectile.fractalWarhead === "boolean";
}

function replayGuestEvents(game) {
  if (!guestEvents.length) return;
  const waiting = [];
  for (const event of guestEvents) {
    if (event.time > game.time) {
      waiting.push(event);
      continue;
    }
    if (event.kind === "hit") {
      emitHitSparks(game, event.x, event.y, event.color, event.count);
    } else if (event.kind === "kill") {
      emitDeathShards(
        game, event.x, event.y, ENEMIES[event.enemyType],
        game.grid.tileSize, event.power
      );
      emitCoins(
        game, event.x, event.y, event.coinCount,
        event.coinSpeedMult, game.grid.tileSize
      );
    } else if (event.kind === "levelUp") {
      const tower = towerById(game, event.towerId);
      if (tower) {
        applyLevelUpSurge(game, tower);
      } else if (!latestSnapshot || latestSnapshot.time < event.time) {
        // cmd and state are separate channels. A newly placed tower's surge
        // can arrive before the snapshot that first introduces that tower.
        waiting.push(event);
      }
    } else if (event.kind === "gearDrop") {
      emitGearDropEffect(game, event.x, event.y, event.rarity, event.slot);
    }
  }
  guestEvents = waiting;
}

function replayGuestShots(game) {
  if (!guestShots.length) return;
  const waiting = [];
  for (const shot of guestShots) {
    if (shot.time > game.time) {
      waiting.push(shot);
      continue;
    }
    game.effects.push(...shot.effects);
    for (const projectile of shot.projectiles) {
      game.projectiles.push({
        ...projectile,
        target: game.enemies.find((enemy) => enemy.id === projectile.targetId) || null,
        sourceTower: towerById(game, projectile.sourceTowerId),
        // updateProjectiles still owns flight and impact art, but explode()
        // must never let a mirrored projectile touch authoritative enemy HP.
        cosmetic: true,
      });
    }
  }
  guestShots = waiting;
}

function validSnapshot(snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length !== SNAP.LENGTH ||
      snapshot[SNAP.VERSION] !== COOP.protocolVersion ||
      !Number.isSafeInteger(snapshot[SNAP.SEQ]) || snapshot[SNAP.SEQ] < 0 ||
      typeof snapshot[SNAP.LEVEL_ID] !== "string" ||
      !Number.isSafeInteger(snapshot[SNAP.TIME_MS]) || snapshot[SNAP.TIME_MS] < 0 ||
      !Number.isInteger(snapshot[SNAP.PHASE]) || !PHASE_ORDER[snapshot[SNAP.PHASE]] ||
      !Number.isInteger(snapshot[SNAP.WAVE]) || snapshot[SNAP.WAVE] < 0 ||
      !Number.isFinite(snapshot[SNAP.CORE]) ||
      !Number.isFinite(snapshot[SNAP.GUEST_WALLET]) ||
      !Array.isArray(snapshot[SNAP.ENEMIES]) ||
      !Array.isArray(snapshot[SNAP.TOWERS])) return false;

  return snapshot[SNAP.ENEMIES].every((enemy) =>
    Array.isArray(enemy) && enemy.length === ENEMY_STATE.LENGTH &&
    Number.isInteger(enemy[ENEMY_STATE.ID]) && enemy[ENEMY_STATE.ID] > 0 &&
    Number.isInteger(enemy[ENEMY_STATE.TYPE]) &&
    !!ENEMY_TYPE_ORDER[enemy[ENEMY_STATE.TYPE]] &&
    Number.isSafeInteger(enemy[ENEMY_STATE.DISTANCE]) &&
    enemy[ENEMY_STATE.DISTANCE] >= 0 &&
    Number.isInteger(enemy[ENEMY_STATE.HEALTH]) &&
    enemy[ENEMY_STATE.HEALTH] >= 0 &&
    enemy[ENEMY_STATE.HEALTH] <= COOP.snapshotHealthScale &&
    Number.isInteger(enemy[ENEMY_STATE.FLAGS]) &&
    enemy[ENEMY_STATE.FLAGS] >= 0 && enemy[ENEMY_STATE.FLAGS] < 8
  ) && snapshot[SNAP.TOWERS].every((tower) =>
    Array.isArray(tower) && tower.length === TOWER_STATE.LENGTH &&
    Number.isInteger(tower[TOWER_STATE.ID]) && tower[TOWER_STATE.ID] > 0 &&
    Number.isInteger(tower[TOWER_STATE.LEVEL]) && tower[TOWER_STATE.LEVEL] >= 1 &&
    Number.isSafeInteger(tower[TOWER_STATE.UPGRADE_COST]) &&
    tower[TOWER_STATE.UPGRADE_COST] >= -1 &&
    Number.isInteger(tower[TOWER_STATE.FLAGS]) &&
    (tower[TOWER_STATE.FLAGS] & ~TOWER_FLAG.UPGRADE_READY) === 0 &&
    Number.isInteger(tower[TOWER_STATE.MASTERY]) &&
    tower[TOWER_STATE.MASTERY] >= 0 &&
    tower[TOWER_STATE.MASTERY] <= TOWER_UPGRADES.mastery.maxRanks
  );
}

function applySnapshot(game, snapshot, receivedAt) {
  const snapshotTime = snapshot[SNAP.TIME_MS] / 1000;
  const phase = PHASE_ORDER[snapshot[SNAP.PHASE]];
  const clockAdvancing = latestSnapshot
    ? snapshotTime > latestSnapshot.time
    : phase !== "won" && phase !== "lost";
  noteGuestSnapshotArrival(receivedAt);
  const renderTimeAtReceipt = Math.max(
    0,
    snapshotTime - (clockAdvancing ? guestInterpDelayMs / 1000 : 0)
  );
  const oldPhase = game.phase;
  game.phase = phase;
  game.waveIndex = snapshot[SNAP.WAVE];
  game.coreHealth = snapshot[SNAP.CORE];
  game.wallets[OWNER_IDS.guest] = snapshot[SNAP.GUEST_WALLET];
  if (phase === "countdown" && oldPhase !== "countdown") {
    game.countdown = game.timeBetweenWaves;
  }

  applyEnemySnapshots(
    game,
    snapshot[SNAP.ENEMIES],
    snapshotTime,
    renderTimeAtReceipt,
    receivedAt
  );
  latestTowerStates = snapshot[SNAP.TOWERS];
  applyTowerSnapshots(game, latestTowerStates);
  latestSnapshot = {
    seq: snapshot[SNAP.SEQ],
    time: snapshotTime,
    receivedAt,
    clockAdvancing,
  };
}

function applyEnemySnapshots(
  game,
  snapshots,
  snapshotTime,
  renderTimeAtReceipt,
  receivedAt
) {
  const existing = new Map(game.enemies.map((enemy) => [enemy.id, enemy]));
  const mirrored = [];
  for (const state of snapshots) {
    const id = state[ENEMY_STATE.ID];
    const type = ENEMY_TYPE_ORDER[state[ENEMY_STATE.TYPE]];
    const distance = state[ENEMY_STATE.DISTANCE] / COOP.snapshotDistanceScale;
    let enemy = existing.get(id);
    const canCorrect = !!enemy && enemy.type === type;
    if (!canCorrect) enemy = createMirroredEnemy(id, type, distance, game.grid);
    const visibleDistance = enemy.distance;

    const oldSnapshotTime = enemy._coopSnapshotTime;
    const oldSnapshotDistance = enemy._coopSnapshotDistance;
    if (oldSnapshotTime != null && snapshotTime > oldSnapshotTime) {
      enemy._coopPreviousTime = oldSnapshotTime;
      enemy._coopPreviousDistance = oldSnapshotDistance;
      const observedSpeed = (distance - oldSnapshotDistance) /
        ((snapshotTime - oldSnapshotTime) * game.grid.tileSize);
      if (Number.isFinite(observedSpeed) && observedSpeed >= 0) {
        enemy.speedTilesPerSec = observedSpeed;
      }
    }
    enemy._coopSnapshotTime = snapshotTime;
    enemy._coopSnapshotDistance = distance;
    if (canCorrect) {
      const authoritativeDistance = guestEnemyDistanceAt(
        enemy,
        renderTimeAtReceipt,
        game.grid.tileSize
      );
      // Keep an active correction's deadline. Restarting a full window on
      // every snapshot can leave a small error lingering forever.
      const correctionEndsAt = enemy._coopCorrectionEndsAt > receivedAt
        ? enemy._coopCorrectionEndsAt
        : receivedAt + COOP.correctionEaseMs;
      enemy._coopCorrectionOffset = visibleDistance - authoritativeDistance;
      enemy._coopCorrectionStartedAt = receivedAt;
      enemy._coopCorrectionEndsAt = correctionEndsAt;
    } else {
      enemy._coopCorrectionOffset = 0;
      enemy._coopCorrectionStartedAt = receivedAt;
      enemy._coopCorrectionEndsAt = receivedAt;
    }
    enemy.health = state[ENEMY_STATE.HEALTH];
    enemy.maxHealth = COOP.snapshotHealthScale;
    const flags = state[ENEMY_STATE.FLAGS];
    enemy.slowUntil = flags & ENEMY_FLAG.SLOW ? Infinity : 0;
    enemy.vulnUntil = flags & ENEMY_FLAG.VULN ? Infinity : 0;
    enemy.hitFlash = !!(flags & ENEMY_FLAG.HIT_FLASH);
    enemy.alive = true;
    mirrored.push(enemy);
  }
  game.enemies = mirrored;
}

function createMirroredEnemy(id, type, distance, grid) {
  const def = ENEMIES[type];
  return {
    id,
    type,
    def,
    mods: {},
    health: COOP.snapshotHealthScale,
    maxHealth: COOP.snapshotHealthScale,
    speedTilesPerSec: def.speed,
    bounty: def.bounty,
    xp: def.xp,
    coreDamage: def.coreDamage,
    distance: Math.max(0, Math.min(grid.totalPathLength, distance)),
    slowUntil: 0,
    slowFactor: 1,
    vulnUntil: 0,
    vulnMult: 1,
    hitFlash: false,
    healPulse: 0,
    alive: true,
    _coopPreviousTime: null,
    _coopPreviousDistance: distance,
    _coopSnapshotTime: null,
    _coopSnapshotDistance: distance,
    _coopCorrectionOffset: 0,
    _coopCorrectionStartedAt: 0,
    _coopCorrectionEndsAt: 0,
  };
}

function guestEnemyDistanceAt(enemy, renderTime, tileSize) {
  const snapshotTime = enemy._coopSnapshotTime;
  if (enemy._coopPreviousTime != null && renderTime <= snapshotTime) {
    const span = snapshotTime - enemy._coopPreviousTime;
    const alpha = span > 0
      ? Math.max(0, Math.min(1, (renderTime - enemy._coopPreviousTime) / span))
      : 1;
    return enemy._coopPreviousDistance +
      (enemy._coopSnapshotDistance - enemy._coopPreviousDistance) * alpha;
  }

  const extrapolationSeconds = Math.min(
    renderTime - snapshotTime,
    COOP.maxExtrapolationMs / 1000
  );
  return enemy._coopSnapshotDistance +
    enemy.speedTilesPerSec * tileSize * extrapolationSeconds;
}

function noteGuestSnapshotArrival(receivedAt) {
  if (guestLastSnapshotReceivedAt != null) {
    const expectedIntervalMs = 1000 / COOP.snapshotHz;
    const arrivalIntervalMs = Math.max(0, receivedAt - guestLastSnapshotReceivedAt);
    const deviationMs = Math.abs(arrivalIntervalMs - expectedIntervalMs);
    // One second's expected samples form the EWMA window, so snapshotHz
    // remains the single cadence knob instead of hiding another constant.
    const sampleWeight = 1 / Math.max(1, COOP.snapshotHz);
    guestSnapshotJitterMs +=
      (deviationMs - guestSnapshotJitterMs) * sampleWeight;
    guestInterpDelayTargetMs = clampGuestInterpDelay(
      COOP.interpDelayMinMs + guestSnapshotJitterMs
    );
  }
  guestLastSnapshotReceivedAt = receivedAt;
}

function advanceGuestInterpDelay(now) {
  if (guestLastUpdateAt == null) {
    guestLastUpdateAt = now;
    return;
  }
  const elapsedMs = Math.max(0, now - guestLastUpdateAt);
  guestLastUpdateAt = now;
  const transitionMs = Math.max(COOP.correctionEaseMs, COOP.interpDelayMaxMs);
  const deltaMs = guestInterpDelayTargetMs - guestInterpDelayMs;
  const stepMs = transitionMs > 0
    ? deltaMs * Math.min(1, elapsedMs / transitionMs)
    : deltaMs;
  if (deltaMs > 0) {
    // Growing the buffer no faster than real time keeps renderTime monotonic.
    guestInterpDelayMs += Math.min(stepMs, elapsedMs);
  } else {
    guestInterpDelayMs += stepMs;
  }
  guestInterpDelayMs = clampGuestInterpDelay(guestInterpDelayMs);
}

function clampGuestInterpDelay(delayMs) {
  return Math.max(
    COOP.interpDelayMinMs,
    Math.min(COOP.interpDelayMaxMs, delayMs)
  );
}

function resetGuestMotion() {
  guestSnapshotJitterMs = 0;
  guestInterpDelayMs = clampGuestInterpDelay(COOP.interpDelayMs);
  guestInterpDelayTargetMs = guestInterpDelayMs;
  guestLastSnapshotReceivedAt = null;
  guestLastUpdateAt = null;
}

function applyTowerSnapshots(game, snapshots) {
  const existing = new Map(game.towers.map((tower) => [tower.id, tower]));
  const mirrored = [];
  let refreshNeeded = false;
  for (const state of snapshots) {
    const id = state[TOWER_STATE.ID];
    const desc = guestTowerCatalog.get(id);
    // cmd/state ordering is intentionally independent. A new tower waits for
    // its reliable descriptor instead of inventing a wrong roster identity.
    if (!desc) continue;
    const type = TOWER_TYPE_ORDER[desc[TOWER_DESC.TYPE]];
    const ownerId = OWNER_ORDER[desc[TOWER_DESC.OWNER]];
    const tileX = desc[TOWER_DESC.TILE_X];
    const tileY = desc[TOWER_DESC.TILE_Y];
    let tower = existing.get(id);
    if (!tower || tower.type !== type) {
      const mirrorRecord = {
        name: desc[TOWER_DESC.NAME], maxLevel: 1, xp: 0, kills: 0, gear: null,
      };
      tower = createTower(type, tileX, tileY, game.grid, mirrorRecord, ownerId);
      tower.id = id;
      refreshNeeded = true;
    }
    tower.name = desc[TOWER_DESC.NAME];
    if (tower.tileX !== tileX || tower.tileY !== tileY) {
      tower.tileX = tileX;
      tower.tileY = tileY;
      tower.pos = game.grid.tileCenter(tileX, tileY);
      refreshNeeded = true;
    }
    const level = state[TOWER_STATE.LEVEL];
    if (tower.level !== level) {
      tower.level = level;
      tower.invested = investedAtLevel(tower.def, level);
      refreshNeeded = true;
    }
    // The guest needs only display/intent gates; host XP and gear stats never
    // enter its combat math. Identity/gear rarity are static catalog data,
    // while the rank and upgrade state remain in the live snapshot.
    tower.maxUnlockedLevel = level;
    const upgradeCost = state[TOWER_STATE.UPGRADE_COST];
    tower._coopUpgradeCost = upgradeCost < 0 ? null : upgradeCost;
    tower._coopUpgradeReady = !!(state[TOWER_STATE.FLAGS] & TOWER_FLAG.UPGRADE_READY);
    tower._coopMasteryRank = state[TOWER_STATE.MASTERY];
    tower._coopGearRarities = unpackGearRarities(desc[TOWER_DESC.GEAR]);
    tower.ownerId = ownerId;
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
