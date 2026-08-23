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
  applyLevelUpSurge, createTower, placeTower, refreshTowerStats, sellTower,
  tryUpgradeTower, upgradeCostFor,
} from "./towers.js";
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
const PHASES = new Set(["ready", "wave", "countdown", "won", "lost"]);
const JOINABLE_PHASES = new Set(["ready", "wave", "countdown"]);
const SHOT_EFFECT_KINDS = new Set(["beam", "muzzle", "ring", "burst"]);
const SHOT_PROJECTILE_KINDS = new Set(["orb", "rocket"]);

let activeGame = null;
let activeRole = null;
let snapshotSequence = 0;
let lastSnapshotSentAt = -Infinity;
let latestSnapshot = null;
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
  if (!isHost(game)) return;
  if (game.phase === "won" || game.phase === "lost") bankHostRun(game);
  updateHostLobby(game, now);
  if (getConnectionState() !== CONNECTION_STATES.CONNECTED) return;
  if (!guestJoined) acceptGuest(game, now);
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
  const cosmeticDt = Math.max(0, renderTime - previousTime);
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
    "type", "ownerId", "roster", "unlockedTowerTypes", "economy",
  ]) ||
      message.type !== "guestProfile" || message.ownerId !== OWNER_IDS.guest ||
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
      ownerId: OWNER_IDS.guest,
      levelId: game.level.id,
      wallet: game.wallets[OWNER_IDS.guest],
      grant,
    });
  } catch {
    // The immediate full snapshot below carries the same wallet. If this
    // assignment message is lost to a closing channel, state remains safe.
  }
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

function lootForOwner(game, ownerId) {
  return game.lootDrops
    .filter((item) => item.ownerId === ownerId)
    .map((drop) => {
      const { ownerId: _ownerId, ...item } = drop;
      return structuredClone(item);
    });
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
    loot: lootForOwner(game, OWNER_IDS.host),
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
    loot: lootForOwner(game, OWNER_IDS.guest),
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

function buildSnapshot(game, sequence) {
  return {
    seq: sequence,
    levelId: game.level.id,
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
      upgradeCost: upgradeCostFor(tower),
    })),
  };
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
    if (isHost() && message?.op) {
      applyIntent(activeGame, message, OWNER_IDS.guest);
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
      if (latestSnapshot && message.seq <= latestSnapshot.seq) return;
      if (message.levelId !== activeGame.level.id) {
        activeGame.coopJoinError =
          `Host is playing ${message.levelId}; open that level before joining.`;
        return;
      }
      applySnapshot(activeGame, message, performance.now());
    }
  }
});

function applyJoinAssignment(game, message) {
  if (!game || message.ownerId !== OWNER_IDS.guest ||
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
  if (!snapshot || typeof snapshot !== "object" ||
      !Number.isInteger(snapshot.seq) || typeof snapshot.levelId !== "string" ||
      !Number.isFinite(snapshot.time) ||
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
    Number.isInteger(tower.level) && tower.level >= 1 &&
    (tower.upgradeCost === null ||
      (Number.isSafeInteger(tower.upgradeCost) && tower.upgradeCost >= 0)) &&
    OWNER_ORDER.includes(tower.ownerId)
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
    // The snapshot omits XP/unlocked-level data. Do not invent eligibility on
    // the guest mirror; its panel sends the intent and the host validates the
    // real tower's XP and unlocked level.
    tower.maxUnlockedLevel = state.level;
    tower._coopUpgradeCost = state.upgradeCost;
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
