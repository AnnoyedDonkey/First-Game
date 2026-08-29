// ============================================================
// MODS — behavioral gear modifiers. Pure registry + explicit hook
// dispatch: no DOM, save writes, or game-loop ownership.
// ============================================================

import { LOOT } from "./config.js";
import { aggregateMods } from "./equipment.js";

// Fault storage stays lazy: the overwhelming majority of enemies never need
// an `enemy.faults` object. These helpers are deliberately generic so later
// Faults can share stack/query/clear behavior without entering combat code.
export function getFault(enemy, id) {
  return enemy?.faults?.[id] || null;
}

export function hasFault(enemy, id) {
  return !!getFault(enemy, id);
}

export function getFaultStacks(enemy, id) {
  return getFault(enemy, id)?.stacks || 0;
}

export function getFaultCount(enemy) {
  return enemy?.faults ? Object.keys(enemy.faults).length : 0;
}

export function addFaultStacks(enemy, id, amount, maxStacks, metadata = null) {
  if (!enemy || !id || !Number.isFinite(amount) || amount <= 0) return getFault(enemy, id);
  const faults = (enemy.faults ||= {});
  const fault = (faults[id] ||= { stacks: 0 });
  if (metadata) Object.assign(fault, metadata);
  fault.stacks = Math.min(maxStacks, Math.max(0, fault.stacks || 0) + amount);
  return fault;
}

export function removeFaultStacks(enemy, id, amount) {
  const fault = getFault(enemy, id);
  if (!fault || !Number.isFinite(amount) || amount <= 0) return fault;
  fault.stacks = Math.max(0, (fault.stacks || 0) - amount);
  if (fault.stacks === 0) clearFault(enemy, id);
  return getFault(enemy, id);
}

export function clearFault(enemy, id) {
  if (!enemy?.faults || !Object.hasOwn(enemy.faults, id)) return false;
  delete enemy.faults[id];
  if (Object.keys(enemy.faults).length === 0) delete enemy.faults;
  return true;
}

export function clearFaults(enemy) {
  if (!enemy?.faults) return false;
  delete enemy.faults;
  return true;
}

function sourceHasMod(source, id) {
  return !!source?.gearMods?.[id]?.length;
}

// Overexpose (network-wide Amplifier) raises Exposed's per-stack % and cap.
function exposedTuning(game) {
  const cfg = LOOT.mods.powers.exposed;
  const oe = game?.modNetwork?.overexpose;
  return {
    perStack: cfg.perStack + (oe?.perStack || 0),
    maxStacks: cfg.maxStacks + (oe?.cap || 0),
  };
}

function exposedOnHit(ctx) {
  if (!ctx?.enemy || !Number.isFinite(ctx.damage)) return;
  const tune = exposedTuning(ctx.game);

  // The applying hit benefits from its own stack: add first, then read the
  // enemy's current stack total for the centralized damage multiplier.
  if (sourceHasMod(ctx.source, "exposed")) {
    addFaultStacks(ctx.enemy, "exposed", 1, tune.maxStacks);
  }
  const stacks = getFaultStacks(ctx.enemy, "exposed");
  if (stacks > 0) ctx.damage *= 1 + stacks * tune.perStack;
}

// Painted (self Rewarder): this tower deals +power% to any enemy that has Exposed.
function paintedOnHit(ctx) {
  if (!ctx?.enemy || !Number.isFinite(ctx.damage)) return;
  const power = strongestModPower(ctx.source, "painted");
  if (power <= 0) return;
  if (getFaultStacks(ctx.enemy, "exposed") > 0) ctx.damage *= 1 + power;
}

function throttleMaxStacks() {
  const cfg = LOOT.mods.powers.throttle;
  return Math.ceil(cfg.maxSlow / cfg.perStack);
}

function throttleOnHit(ctx) {
  if (!ctx?.enemy || !sourceHasMod(ctx.source, "throttle")) return;
  addFaultStacks(ctx.enemy, "throttle", 1, throttleMaxStacks());
}

// Fork spawns a live tower, which needs towers.js machinery. To avoid an import
// cycle (towers.js imports this module), towers.js injects its spawner here.
let forkSpawner = null;
export function setForkSpawner(fn) {
  forkSpawner = fn;
}

// Overclock changes one live tower's derived fire rate on kill/reset. towers.js
// injects its private recomputeStats wrapper here so this module stays free of
// the affixes.js <-> towers.js import cycle.
let towerStatRecomputer = null;
export function setTowerStatRecomputer(fn) {
  towerStatRecomputer = fn;
}

// Thermal's aura is state-dependent (only while a tower is at MAX Overclock), so a
// tower crossing into/out of max must rebuild the network auras + neighbour stats.
// towers.js injects refreshModNetwork here (same import-cycle dodge as above). The
// crossing is a rare event (reach max once per wave; drop at wave reset), never a
// per-frame scan.
let networkRefresher = null;
export function setNetworkRefresher(fn) {
  networkRefresher = fn;
}

// Cascade grants a free level / mastery rank to a neighbour. The geometry,
// eligibility (caps, ranks), and tower mutation live in towers.js; affixes.js only
// decides IF a grant fires and with what radius/surge. towers.js injects the
// applier here (fn(game, parent, kind, radiusTiles, withSurge)).
let cascadeGrantApplier = null;
export function setCascadeGrantApplier(fn) {
  cascadeGrantApplier = fn;
}

function forkOnKill(ctx) {
  // canProc===false marks a triggered (non-primary) hit — Fork never chains off
  // those, and forked towers are gearless so they can't carry Fork anyway.
  if (!ctx?.source || !ctx.game || ctx.canProc === false) return;
  const power = strongestModPower(ctx.source, "fork");
  if (power <= 0) return;
  const rng = ctx.game.rng || Math.random;
  if (rng() >= power) return;
  const spawned = forkSpawner?.(ctx.game, ctx.source);
  // Warm Boot (self Bridge -> Overclock): a successful Fork spawn feeds the parent
  // some Overclock stacks (no-op if the parent carries no Overclock).
  if (spawned) {
    const wb = strongestModPower(ctx.source, "warmBoot"); // stored power == stacks
    if (wb > 0) addOverclockStacks(ctx.game, ctx.source, Math.round(wb));
  }
}

// Desync tracks the strongest active per-stack power in the sequence, so a
// carrier's contribution is the MAX Desync power among its equipped mods.
function strongestModPower(source, id) {
  const list = source?.gearMods?.[id];
  if (!Array.isArray(list)) return 0;
  let max = 0;
  for (const m of list) if (Number.isFinite(m.power) && m.power > max) max = m.power;
  return max;
}

// An Overclock item's stored power is its per-kill gain. The cap remains tied
// to that item's rarity in config, so resolve the strongest equipped copy from
// the live gear while still using gearMods as the carrier/source-of-power cache.
function overclockParams(tower) {
  const perKill = strongestModPower(tower, "overclock");
  if (perKill <= 0) return null;

  let cap = 0;
  for (const item of Object.values(tower.gear || {})) {
    const configured = LOOT.mods.powers.overclock[item?.rarity];
    if (!configured) continue;
    for (const mod of item?.mods || []) {
      if (mod?.id === "overclock" && mod.power === perKill) {
        cap = Math.max(cap, configured.cap);
      }
    }
  }
  // Synthetic/debug towers may provide gearMods directly. Exact config powers
  // still resolve without requiring a fake item shell.
  if (cap <= 0) {
    for (const configured of Object.values(LOOT.mods.powers.overclock)) {
      if (configured.perKill === perKill) cap = Math.max(cap, configured.cap);
    }
  }
  // Hyperthread is self-only and its Rare power is deliberately 0, so its
  // presence comes from gearMods while its cap bonus comes from the carrying
  // item's rarity (never from the stored power magnitude).
  let hyperthreadCapBonus = 0;
  if (sourceHasMod(tower, "hyperthread")) {
    for (const item of Object.values(tower.gear || {})) {
      const configured = LOOT.mods.powers.hyperthread[item?.rarity];
      if (!configured) continue;
      if ((item?.mods || []).some((mod) => mod?.id === "hyperthread")) {
        hyperthreadCapBonus = Math.max(hyperthreadCapBonus, configured.capBonus);
      }
    }
  }
  // Turbo is self-only: its strongest equipped copy raises this wearer's
  // Overclock ramp and cap. Resolve rarity-backed values from live gear so a
  // carried Turbo can never affect a tower without Overclock.
  let turbo = { perKillBonus: 0, capBonus: 0 };
  if (sourceHasMod(tower, "turbo")) {
    for (const item of Object.values(tower.gear || {})) {
      const configured = LOOT.mods.powers.turbo[item?.rarity];
      if (!configured) continue;
      if ((item?.mods || []).some((mod) => mod?.id === "turbo") &&
          (configured.perKill > turbo.perKillBonus ||
           (configured.perKill === turbo.perKillBonus && configured.cap > turbo.capBonus))) {
        turbo = { perKillBonus: configured.perKill, capBonus: configured.cap };
      }
    }
  }
  return cap > 0
    ? { perKill: perKill + turbo.perKillBonus, cap: cap + hyperthreadCapBonus + turbo.capBonus }
    : null;
}

function overclockOnKill(ctx) {
  const tower = ctx?.source;
  if (!tower || !ctx.game || ctx.canProc !== true || !overclockParams(tower)) return;

  const now = ctx.game.time;
  if (!Number.isFinite(now)) return;
  const state = tower._overclock || { stacks: 0, lastStackAt: -Infinity };
  const lastStackAt = Number.isFinite(state.lastStackAt) ? state.lastStackAt : -Infinity;
  if (!sourceHasMod(tower, "hyperthread") && now - lastStackAt < LOOT.mods.overclock.killCooldownSec) return;

  state.stacks = Math.max(0, state.stacks || 0) + 1;
  state.lastStackAt = now;
  tower._overclock = state;
  towerStatRecomputer?.(ctx.game, tower);
  maybeSyncThermal(ctx.game, tower); // may have just crossed INTO max Overclock
}

function overclockOnWaveStart(game, tower) {
  // Do not create runtime state for a fresh carrier. Once a tower has earned a
  // stack, every wave start resolves the board-wide Nonvolatile cache and
  // refreshes derived stats.
  if (!tower?._overclock) return;
  const oldStacks = Math.max(0, tower._overclock.stacks || 0);
  const frac = game.modNetwork?.nonvolatile || 0;
  tower._overclock.stacks = Math.floor(oldStacks * frac);
  towerStatRecomputer?.(game, tower);
  maybeSyncThermal(game, tower); // the reset may have dropped it BELOW max Overclock
}

export function overclockFireRateMult(tower) {
  const configured = overclockParams(tower);
  if (!configured) return 1;
  const stacks = Math.max(0, tower?._overclock?.stacks || 0);
  return 1 + Math.min(configured.cap, stacks * configured.perKill);
}

// A tower is at MAX Overclock when its accumulated stacks reach the (Turbo/
// Hyperthread-adjusted) cap. No Overclock -> never at max. This is the gate for
// Thermal's aura and for its crossing detection.
function overclockAtMax(tower) {
  const configured = overclockParams(tower);
  if (!configured) return false;
  const stacks = Math.max(0, tower?._overclock?.stacks || 0);
  return stacks * configured.perKill >= configured.cap;
}

// Thermal (Bridge -> Broadcast): while the source sits at max Overclock it emits a
// fire-rate aura to towers within broadcastRadiusTiles, folded into the same
// _broadcast.fireRate the other Broadcasts use (read by recomputeStats). Gated
// applyBroadcastAura variant — only at-max Thermal carriers contribute. Runs inside
// onNetworkChange (network change OR a crossing-triggered refresh), never per frame.
function applyThermalAura(game) {
  const towers = game.towers || [];
  if (towers.length === 0) return;
  const ts = game.grid?.tileSize || 0;
  const radius = LOOT.mods.broadcastRadiusTiles * ts;
  const r2 = radius * radius;
  const selfBuffs = LOOT.mods.broadcastSelfBuffs;
  for (const source of towers) {
    const power = strongestModPower(source, "thermal");
    if (power <= 0 || !overclockAtMax(source)) continue;
    source._broadcastRadius = radius; // selection ring, only while emitting
    for (const target of towers) {
      if (target === source && !selfBuffs) continue;
      const dx = target.pos.x - source.pos.x;
      const dy = target.pos.y - source.pos.y;
      if (dx * dx + dy * dy <= r2) target._broadcast.fireRate += power;
    }
  }
}

// Called after an Overclock stack change / wave reset for a Thermal carrier. Only
// when the tower CROSSES into or out of max (a rare, bounded event) do we rebuild
// the network so the aura enters/leaves neighbours' _broadcast — never per frame.
function maybeSyncThermal(game, tower) {
  if (!game || !sourceHasMod(tower, "thermal")) return;
  const active = overclockAtMax(tower);
  if (active === !!tower._thermalActive) return;
  tower._thermalActive = active;
  networkRefresher?.(game);
}

// Resolve a Cascade parent's grant parameters for one form ("level" -> Upgrade
// Cascade, "mastery" -> Mastery Cascade). Returns { chance, radius, withSurge } or
// null when the parent doesn't carry that form's Cascade. Domino (self-only) raises
// the chance and widens the radius; Power Surge (self-only) flags the receiver surge.
function cascadeParams(parent, kind) {
  const modId = kind === "mastery" ? "masteryCascade" : "upgradeCascade";
  const base = strongestModPower(parent, modId); // stored power == the chance
  if (base <= 0) return null;
  let chance = base;
  let radius = LOOT.mods.cascade.radiusTiles;
  if (sourceHasMod(parent, "domino")) {
    let best = null;
    for (const item of Object.values(parent.gear || {})) {
      const cfg = LOOT.mods.powers.domino[item?.rarity];
      if (!cfg) continue;
      if ((item?.mods || []).some((m) => m?.id === "domino") &&
          (!best || cfg.chance > best.chance)) best = cfg;
    }
    if (best) { chance += best.chance; radius = Math.max(radius, best.radius); }
  }
  return { chance, radius, withSurge: sourceHasMod(parent, "powerSurge") };
}

// Shared roll+grant for both Cascade forms. The granted step is applied directly in
// towers.js (never via the paid-upgrade / XP path), so it CANNOT re-enter these
// hooks — the "no recursion" guarantee.
function cascadeRollAndGrant(game, parent, kind) {
  const p = cascadeParams(parent, kind);
  if (!p) return;
  const rng = game.rng || Math.random;
  if (rng() >= p.chance) return;
  cascadeGrantApplier?.(game, parent, kind, p.radius, p.withSurge);
}

// Resolve the strongest per-rarity config object carried by ANY tower on the board
// for `modId` (network-wide rule mods: Overexpose/Buffer Overflow/Malware). Ranks by
// `rankKey`; returns the winning config entry or null.
function strongestConfigOnBoard(game, modId, table, rankKey) {
  let best = null;
  for (const t of game?.towers || []) {
    if (!sourceHasMod(t, modId)) continue;
    for (const item of Object.values(t.gear || {})) {
      const cfg = table[item?.rarity];
      if (!cfg) continue;
      if ((item?.mods || []).some((m) => m?.id === modId) &&
          (!best || cfg[rankKey] > best[rankKey])) best = cfg;
    }
  }
  return best;
}

// Resolve the strongest per-rarity config carried by ONE tower (self-only mods:
// Signal Boost, Inheritance, Warm Boot). Ranks by `rankKey`.
function selfStrongestConfig(tower, modId, table, rankKey) {
  if (!sourceHasMod(tower, modId)) return null;
  let best = null;
  for (const item of Object.values(tower.gear || {})) {
    const cfg = table[item?.rarity];
    if (!cfg) continue;
    if ((item?.mods || []).some((m) => m?.id === modId) &&
        (!best || cfg[rankKey] > best[rankKey])) best = cfg;
  }
  return best;
}

// Add Overclock stacks to a tower (Warm Boot). Respects Overclock presence + the
// tower's recompute + Thermal crossing, like a kill would.
function addOverclockStacks(game, tower, n) {
  if (n <= 0 || !overclockParams(tower)) return;
  const state = tower._overclock || { stacks: 0, lastStackAt: -Infinity };
  state.stacks = Math.max(0, state.stacks || 0) + n;
  tower._overclock = state;
  towerStatRecomputer?.(game, tower);
  maybeSyncThermal(game, tower);
}

function startDesync(enemy, towerType, powerPerStack) {
  const faults = (enemy.faults ||= {});
  faults.desync = {
    stacks: Math.min(LOOT.mods.desyncMaxStacks, 1),
    towerType,
    powerPerStack,
  };
}

// Desync is a tower-SEQUENCING Fault (spec §9-11). Same-type hits from Desync
// carriers build stacks to the configured cap and the strongest participating
// power wins (a weaker source never lowers it). The first hit of a DIFFERENT
// tower type consumes the whole sequence and amplifies THAT hit by stacks *
// powerPerStack — regardless of whether the consumer carries Desync; a
// consuming carrier then immediately opens a fresh 1-stack sequence of its own.
// Buffer Overflow (network-wide Amplifier): more stacks per same-type hit, higher cap.
function desyncBuild(game) {
  const bo = game?.modNetwork?.bufferOverflow;
  return {
    stacksPerHit: bo?.stacksPerHit || 1,
    cap: bo?.cap || LOOT.mods.desyncMaxStacks,
  };
}

function desyncOnHit(ctx) {
  if (!ctx?.enemy || !ctx.sourceType) return; // only real tower hits interact
  const sType = ctx.sourceType;
  const carrierPower = strongestModPower(ctx.source, "desync");
  const fault = getFault(ctx.enemy, "desync");

  if (fault && sType !== fault.towerType) {
    // CONSUME: amplify this hit (composes multiplicatively with Exposed via the
    // shared ctx.damage), clear the sequence, then maybe start a new one.
    const consumed = fault.stacks;
    if (Number.isFinite(ctx.damage)) ctx.damage *= 1 + consumed * fault.powerPerStack;
    // Overvolt (self Rewarder): consuming >= threshold stacks guarantees a crit —
    // adds a crit's worth of damage if this hit wasn't already a crit.
    const overvolt = strongestModPower(ctx.source, "overvolt"); // stored power == threshold
    if (overvolt > 0 && consumed >= overvolt && ctx.crit !== true &&
        Number.isFinite(ctx.damage) && ctx.source) {
      ctx.damage *= 1 + (ctx.source.critDamage || 0);
      ctx.crit = true;
    }
    // Payload (self Bridge -> Corruption): the consume also applies Corruption
    // equal to floor(consumed * ratio) to the target.
    const payload = strongestModPower(ctx.source, "payload"); // stored power == ratio
    if (payload > 0) {
      const stacks = Math.floor(consumed * payload);
      if (stacks > 0) applyCorruptionStacks(ctx.enemy, stacks, ctx.game?.time ?? 0);
    }
    clearFault(ctx.enemy, "desync");
    if (carrierPower > 0) startDesync(ctx.enemy, sType, carrierPower);
    return;
  }
  // BUILD: only Desync carriers accumulate stacks.
  if (carrierPower > 0) {
    const build = desyncBuild(ctx.game);
    if (!fault) {
      startDesync(ctx.enemy, sType, carrierPower); // first hit = stack 1
    } else {
      fault.stacks = Math.min(build.cap, fault.stacks + build.stacksPerHit);
      // Stronger same-type source raises active power; weaker never lowers it.
      if (carrierPower > fault.powerPerStack) fault.powerPerStack = carrierPower;
    }
  }
}

// Shared by carrier hits and death transfer. Creating the Fault stamps its
// lifetime origin once; adding to an existing infection never resets the age.
export function applyCorruptionStacks(enemy, amount, gameTime) {
  const existing = getFault(enemy, "corruption");
  const metadata = existing ? null : { corruptedAt: gameTime };
  return addFaultStacks(
    enemy, "corruption", amount, LOOT.mods.corruption.maxStacks, metadata
  );
}

function corruptionOnHit(ctx) {
  if (!ctx?.enemy || !ctx.source) return;
  const power = strongestModPower(ctx.source, "corruption");
  if (power <= 0) return;
  applyCorruptionStacks(ctx.enemy, power, ctx.game?.time ?? 0);
}

export function corruptionTickDamage(enemy, game, dt) {
  const fault = getFault(enemy, "corruption");
  if (!fault) return 0;
  const rootkitCap = game?.modNetwork?.rootkit || 0;
  const started = Number.isFinite(fault.corruptedAt) ? fault.corruptedAt : game?.time;
  const secondsCorrupted = Number.isFinite(game?.time) && Number.isFinite(started)
    ? Math.max(0, game.time - started)
    : 0;
  const ramp = Math.min(
    rootkitCap, LOOT.mods.rootkit.rampPerSec * secondsCorrupted
  );
  return (fault.stacks || 0) * dt * (1 + ramp);
}

// Malware (network-wide Transformer, Rare+): death spreads 100% (not 50%) to N (not
// 1) nearest enemies. The transfer is still one-shot per death (never re-entrant), so
// there is no exponential blow-up — the spread is bounded by N per kill.
export function corruptionSpreadAmount(enemy, game = null) {
  const frac = game?.modNetwork?.malware ? 1.0 : LOOT.mods.corruption.spreadFrac;
  return Math.floor(getFaultStacks(enemy, "corruption") * frac);
}

export function corruptionSpreadTargets(game) {
  return game?.modNetwork?.malware?.targets || LOOT.mods.corruption.spreadTargets;
}

export function backdoorExposedFloor(enemy, game) {
  const ratio = game?.modNetwork?.backdoor || 0;
  if (ratio <= 0) return 0;
  return Math.min(
    exposedTuning(game).maxStacks, // respects Overexpose's raised cap
    Math.floor(getFaultStacks(enemy, "corruption") * ratio)
  );
}

// Broadcast Protocols share ONE aura applicator. A source carrying `modId` adds
// its power to the given `_broadcast` field of every tower within
// broadcastRadiusTiles (itself only if broadcastSelfBuffs). Sources stack
// ADDITIVELY (spec §20). Runs ONLY on network change (place/sell/gear), never
// per frame (spec §5); recomputeStats then reads the resolved _broadcast.
function applyBroadcastAura(game, modId, field) {
  const towers = game.towers || [];
  if (towers.length === 0) return;
  const ts = game.grid?.tileSize || 0;
  const baseRadius = LOOT.mods.broadcastRadiusTiles * ts;
  const selfBuffs = LOOT.mods.broadcastSelfBuffs;
  for (const source of towers) {
    const power = strongestModPower(source, modId);
    if (power <= 0) continue;
    // Signal Boost (self Amplifier): raises THIS source's aura power + radius.
    const sb = selfStrongestConfig(source, "signalBoost", LOOT.mods.powers.signalBoost, "power");
    const effPower = power + (sb?.power || 0);
    const radius = baseRadius + (sb?.radius || 0) * ts;
    const r2 = radius * radius;
    source._broadcastRadius = radius; // drives the selection aura ring
    for (const target of towers) {
      if (target === source && !selfBuffs) continue;
      const dx = target.pos.x - source.pos.x;
      const dy = target.pos.y - source.pos.y;
      if (dx * dx + dy * dy <= r2) target._broadcast[field] += effPower;
    }
  }
}

// Array is a per-tower-TYPE Protocol (spec §12-16). For each type with at least
// one Array carrier: effectivePower = strongest Array power + (extra carriers ×
// arrayExtraSourceBonus); the per-tower damage bonus = (tower count of that type)
// × effectivePower, applied to EVERY tower of the type. Cached per type and read
// O(1) by recomputeStats (arrayBonus = count × effectivePower). Rebuilt only on
// network change.
function rebuildArrayNetwork(game) {
  const byType = {};
  for (const t of game.towers || []) {
    const e = (byType[t.type] ||= { count: 0, powers: [] });
    e.count += 1;
    const p = strongestModPower(t, "array");
    if (p > 0) e.powers.push(p);
  }
  const net = (game.modNetwork.array = {});
  for (const type in byType) {
    const { count, powers } = byType[type];
    if (powers.length === 0) continue; // no Array on this type -> no entry
    const strongestPower = Math.max(...powers);
    const sources = powers.length;
    // The +1pp per EXTRA source raises the per-tower power (spec §13) — it is
    // NOT added to the final bonus afterward.
    const effectivePower = strongestPower + (sources - 1) * LOOT.mods.arrayExtraSourceBonus;
    // The tower count is capped for the bonus (config arrayMaxTowers) so spamming
    // same-type towers can't scale Array without bound. `count` stays the true
    // count for display; `effectiveCount` drives the damage bonus.
    const effectiveCount = Math.min(count, LOOT.mods.arrayMaxTowers);
    net[type] = {
      type, count, effectiveCount, sources, strongestPower, effectivePower,
      bonus: effectiveCount * effectivePower,
    };
  }
}

// Quarantine (network-wide Rewarder): the first N Corrupted enemies killed each wave
// pay credits to every wallet (economy pulse). Counts any Corrupted death — including
// a Corruption-tick kill (null source) — capped per wave; the counter resets in the
// mod's onWaveStart.
function quarantineOnKill(ctx) {
  const game = ctx?.game;
  if (!game) return;
  const credits = game.modNetwork?.quarantine || 0;
  if (credits <= 0) return;
  if (getFaultStacks(ctx.enemy, "corruption") <= 0) return;
  const used = game._quarantineKills || 0;
  if (used >= LOOT.mods.quarantineCapPerWave) return;
  game._quarantineKills = used + 1;
  for (const id of Object.keys(game.wallets || {})) {
    game.wallets[id] += credits;
    if (game.totalEarned) game.totalEarned[id] = (game.totalEarned[id] || 0) + credits;
  }
}

export const MODS = Object.freeze({
  throttle: Object.freeze({
    id: "throttle",
    category: "fault",
    nameKey: "mod.throttle.name",
    name: "Throttle",
    descKey: "mod.throttle.desc",
    description: "Hits from this tower slow the target by {power}% per stack, up to {maxSlow}% total.",
    descriptionParams(mod) {
      const maxSlow = LOOT.mods.powers.throttle.maxSlow;
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.throttle.perStack,
        maxSlow: Math.round(maxSlow * 10000) / 100,
      };
    },
    // Like Exposed, v1 uses one global per-stack value. It is still stored on
    // every item so the mod data shape remains uniform across future scaling.
    powerForRarity() {
      return LOOT.mods.powers.throttle.perStack;
    },
    movementMult(fault) {
      const cfg = LOOT.mods.powers.throttle;
      const penalty = Math.min(cfg.maxSlow, (fault.stacks || 0) * cfg.perStack);
      return 1 - penalty;
    },
    inspect(fault) {
      const cfg = LOOT.mods.powers.throttle;
      return {
        ...fault,
        movementPenalty: Math.min(cfg.maxSlow, (fault.stacks || 0) * cfg.perStack),
      };
    },
    debugLines(fault) {
      const cfg = LOOT.mods.powers.throttle;
      const penalty = Math.min(cfg.maxSlow, (fault.stacks || 0) * cfg.perStack);
      return [`Stacks: ${fault.stacks || 0}`, `Movement penalty: -${Math.round(penalty * 10000) / 100}%`];
    },
    onHit: throttleOnHit,
  }),
  exposed: Object.freeze({
    id: "exposed",
    category: "fault",
    nameKey: "mod.exposed.name",
    name: "Exposed",
    descKey: "mod.exposed.desc",
    description: "Hits from this tower make the target take +{power}% more damage per stack, up to {maxStacks} stacks.",
    descriptionParams(mod) {
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.exposed.perStack,
        maxStacks: LOOT.mods.powers.exposed.maxStacks,
      };
    },
    // Exposed intentionally has no rarity table in v1. Store the global
    // per-stack value anyway so every mod item keeps the same {id, power}
    // shape and can adopt per-rarity scaling later without a save migration.
    powerForRarity() {
      return LOOT.mods.powers.exposed.perStack;
    },
    inspect(fault) {
      return {
        ...fault,
        damageTakenBonus: (fault.stacks || 0) * LOOT.mods.powers.exposed.perStack,
      };
    },
    debugLines(fault) {
      const bonus = (fault.stacks || 0) * LOOT.mods.powers.exposed.perStack;
      return [`Stacks: ${fault.stacks || 0}`, `Damage taken: +${Math.round(bonus * 10000) / 100}%`];
    },
    onHit: exposedOnHit,
  }),
  desync: Object.freeze({
    id: "desync",
    category: "fault",
    nameKey: "mod.desync.name",
    name: "Desync",
    descKey: "mod.desync.desc",
    description: "Consecutive hits from this tower type build Desync; a hit from another tower type consumes it and deals +{power}% more damage per stack.",
    descriptionParams(mod) {
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.desync.rare,
      };
    },
    // Desync scales with rarity (spec §5): the item's rolled power IS the
    // per-stack bonus, so it must come from the per-rarity table, not a global.
    powerForRarity(rarity) {
      return LOOT.mods.powers.desync[rarity];
    },
    inspect(fault) {
      return { ...fault, pendingBonus: (fault.stacks || 0) * (fault.powerPerStack || 0) };
    },
    debugLines(fault) {
      const pct = (v) => Math.round((v || 0) * 10000) / 100;
      return [
        `Stacks: ${fault.stacks || 0}`,
        `Tower Type: ${fault.towerType || "—"}`,
        `Power: +${pct(fault.powerPerStack)}% per stack`,
        `Next different-type hit: +${pct((fault.stacks || 0) * (fault.powerPerStack || 0))}%`,
      ];
    },
    onHit: desyncOnHit,
  }),
  corruption: Object.freeze({
    id: "corruption",
    category: "fault",
    nameKey: "mod.corruption.name",
    name: "Corruption",
    descKey: "mod.corruption.desc",
    powerFormat: "flat",
    powerSuffix: " stacks/hit",
    description: "Hits add {power} permanent Corruption stacks. Corruption deals damage per second equal to its stacks and transfers {spread}% to the nearest enemy on death, up to {maxStacks} stacks.",
    descriptionParams(mod) {
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.corruption.rare,
        spread: Math.round(LOOT.mods.corruption.spreadFrac * 10000) / 100,
        maxStacks: LOOT.mods.corruption.maxStacks,
      };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.corruption[rarity];
    },
    inspect(fault, enemy, game) {
      const now = Number.isFinite(game?.time) ? game.time : fault.corruptedAt;
      const started = Number.isFinite(fault.corruptedAt) ? fault.corruptedAt : now;
      return {
        ...fault,
        currentDps: corruptionTickDamage(enemy, game, 1),
        secondsCorrupted: Math.max(0, (now || 0) - (started || 0)),
      };
    },
    debugLines(fault, enemy, game) {
      const now = Number.isFinite(game?.time) ? game.time : fault.corruptedAt;
      const started = Number.isFinite(fault.corruptedAt) ? fault.corruptedAt : now;
      const seconds = Math.max(0, (now || 0) - (started || 0));
      return [
        `Stacks: ${fault.stacks || 0}`,
        `Current DPS: ${Math.round(corruptionTickDamage(enemy, game, 1) * 100) / 100}`,
        `Corrupted for: ${Math.round(seconds * 10) / 10}s`,
      ];
    },
    onHit: corruptionOnHit,
  }),
  rootkit: Object.freeze({
    id: "rootkit",
    category: "protocol",
    nameKey: "mod.rootkit.name",
    name: "Rootkit",
    descKey: "mod.rootkit.desc",
    description: "Corrupted enemies take +{ramp}% more Corruption damage per second, up to +{power}%.",
    descriptionParams(mod) {
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.rootkit.rare,
        ramp: Math.round(LOOT.mods.rootkit.rampPerSec * 10000) / 100,
      };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.rootkit[rarity];
    },
    onNetworkChange(game) {
      let strongest = 0;
      for (const tower of game.towers || []) {
        strongest = Math.max(strongest, strongestModPower(tower, "rootkit"));
      }
      game.modNetwork.rootkit = strongest;
    },
  }),
  backdoor: Object.freeze({
    id: "backdoor",
    category: "protocol",
    nameKey: "mod.backdoor.name",
    name: "Backdoor",
    descKey: "mod.backdoor.desc",
    description: "Corrupted enemies are also Exposed (Exposed = {power}% of Corruption).",
    descriptionParams(mod) {
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.backdoor.rare,
      };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.backdoor[rarity];
    },
    onNetworkChange(game) {
      let strongest = 0;
      for (const tower of game.towers || []) {
        strongest = Math.max(strongest, strongestModPower(tower, "backdoor"));
      }
      game.modNetwork.backdoor = strongest;
    },
  }),
  damageBroadcast: Object.freeze({
    id: "damageBroadcast",
    category: "protocol",
    nameKey: "mod.damageBroadcast.name",
    name: "Damage Broadcast",
    descKey: "mod.damageBroadcast.desc",
    description: "Nearby towers deal +{power}% more damage.",
    descriptionParams(mod) {
      return { power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.damageBroadcast.rare };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.damageBroadcast[rarity];
    },
    onNetworkChange(game) {
      applyBroadcastAura(game, "damageBroadcast", "damage");
    },
  }),
  fireRateBroadcast: Object.freeze({
    id: "fireRateBroadcast",
    category: "protocol",
    nameKey: "mod.fireRateBroadcast.name",
    name: "Fire Rate Broadcast",
    descKey: "mod.fireRateBroadcast.desc",
    description: "Nearby towers fire +{power}% faster.",
    descriptionParams(mod) {
      return { power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.fireRateBroadcast.rare };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.fireRateBroadcast[rarity];
    },
    onNetworkChange(game) {
      applyBroadcastAura(game, "fireRateBroadcast", "fireRate");
    },
  }),
  rangeBroadcast: Object.freeze({
    id: "rangeBroadcast",
    category: "protocol",
    nameKey: "mod.rangeBroadcast.name",
    name: "Range Broadcast",
    descKey: "mod.rangeBroadcast.desc",
    description: "Nearby towers gain +{power}% range.",
    descriptionParams(mod) {
      return { power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.rangeBroadcast.rare };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.rangeBroadcast[rarity];
    },
    onNetworkChange(game) {
      applyBroadcastAura(game, "rangeBroadcast", "range");
    },
  }),
  critBroadcast: Object.freeze({
    id: "critBroadcast",
    category: "protocol",
    nameKey: "mod.critBroadcast.name",
    name: "Critical Broadcast",
    descKey: "mod.critBroadcast.desc",
    // Crit is added as percentage POINTS to crit chance (spec §19), not a mult.
    description: "Nearby towers gain +{power} percentage points of critical hit chance.",
    descriptionParams(mod) {
      return { power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.critBroadcast.rare };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.critBroadcast[rarity];
    },
    onNetworkChange(game) {
      applyBroadcastAura(game, "critBroadcast", "crit");
    },
  }),
  array: Object.freeze({
    id: "array",
    category: "protocol",
    nameKey: "mod.array.name",
    name: "Array",
    descKey: "mod.array.desc",
    description: "All towers of this type gain +{power}% damage for every tower of this type on the battlefield. Additional towers of this type carrying Array add +1% each.",
    descriptionParams(mod) {
      return { power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.array.rare };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.array[rarity];
    },
    onNetworkChange(game) {
      rebuildArrayNetwork(game);
    },
  }),
  fork: Object.freeze({
    id: "fork",
    category: "protocol",
    nameKey: "mod.fork.name",
    name: "Fork",
    descKey: "mod.fork.desc",
    description: "Kills have a {power}% chance to create a free lower-level copy of this tower nearby.",
    descriptionParams(mod) {
      return { power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.fork.rare };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.fork[rarity];
    },
    onKill: forkOnKill,
  }),
  overclock: Object.freeze({
    id: "overclock",
    category: "protocol",
    nameKey: "mod.overclock.name",
    name: "Overclock",
    descKey: "mod.overclock.desc",
    description: "Killing blows grant +{power}% fire rate per stack, up to +{cap}%. Resets at the start of each wave.",
    descriptionParams(mod) {
      const table = LOOT.mods.powers.overclock;
      let configured = table.rare;
      if (Number.isFinite(mod?.power)) {
        configured = Object.values(table).find((entry) => entry.perKill === mod.power) || configured;
      }
      return {
        power: Number.isFinite(mod?.power) ? mod.power : configured.perKill,
        cap: Math.round(configured.cap * 10000) / 100,
      };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.overclock[rarity]?.perKill;
    },
    onKill: overclockOnKill,
    onWaveStart: overclockOnWaveStart,
  }),
  hyperthread: Object.freeze({
    id: "hyperthread",
    category: "protocol",
    nameKey: "mod.hyperthread.name",
    name: "Hyperthread",
    descKey: "mod.hyperthread.desc",
    description: "Overclock gains a stack on every kill instead of once per 0.5s, and raises the Overclock cap by +{power}%.",
    descriptionParams(mod) {
      return {
        power: Number.isFinite(mod?.power) ? mod.power : LOOT.mods.powers.hyperthread.rare.capBonus,
      };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.hyperthread[rarity]?.capBonus;
    },
  }),
  turbo: Object.freeze({
    id: "turbo",
    category: "protocol",
    nameKey: "mod.turbo.name",
    name: "Turbo",
    descKey: "mod.turbo.desc",
    description: "This tower's Overclock gains +{power}% more fire rate per stack and +{cap}% higher cap.",
    descriptionParams(mod) {
      const table = LOOT.mods.powers.turbo;
      let configured = table.rare;
      if (Number.isFinite(mod?.power)) {
        configured = Object.values(table).find((entry) => entry.perKill === mod.power) || configured;
      }
      return {
        power: Number.isFinite(mod?.power) ? mod.power : configured.perKill,
        cap: Math.round(configured.cap * 10000) / 100,
      };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.turbo[rarity]?.perKill;
    },
  }),
  thermal: Object.freeze({
    id: "thermal",
    category: "protocol",
    nameKey: "mod.thermal.name",
    name: "Thermal",
    descKey: "mod.thermal.desc",
    description: "While this tower is at maximum Overclock, nearby towers fire +{power}% faster.",
    descriptionParams(mod) {
      return { power: mod?.power };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.thermal[rarity];
    },
    onNetworkChange(game) {
      applyThermalAura(game);
    },
  }),
  upgradeCascade: Object.freeze({
    id: "upgradeCascade",
    category: "protocol",
    nameKey: "mod.upgradeCascade.name",
    name: "Upgrade Cascade",
    descKey: "mod.upgradeCascade.desc",
    description: "When you buy a level-up on this tower, {power}% chance to grant a free level to an adjacent tower.",
    descriptionParams(mod) {
      return { power: mod?.power };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.upgradeCascade[rarity];
    },
    onLevelUp(game, parent) {
      cascadeRollAndGrant(game, parent, "level");
    },
  }),
  masteryCascade: Object.freeze({
    id: "masteryCascade",
    category: "protocol",
    nameKey: "mod.masteryCascade.name",
    name: "Mastery Cascade",
    descKey: "mod.masteryCascade.desc",
    description: "When this tower ranks up from XP, {power}% chance to grant a free mastery rank to an adjacent tower.",
    descriptionParams(mod) {
      return { power: mod?.power };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.masteryCascade[rarity];
    },
    onMasteryUp(game, parent) {
      cascadeRollAndGrant(game, parent, "mastery");
    },
  }),
  domino: Object.freeze({
    id: "domino",
    category: "protocol",
    nameKey: "mod.domino.name",
    name: "Domino",
    descKey: "mod.domino.desc",
    description: "Raises this tower's Cascade chance by +{power}% and extends its reach to adjacent-of-adjacent towers.",
    descriptionParams(mod) {
      return { power: mod?.power };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.domino[rarity]?.chance;
    },
  }),
  powerSurge: Object.freeze({
    id: "powerSurge",
    category: "protocol",
    nameKey: "mod.powerSurge.name",
    name: "Power Surge",
    descKey: "mod.powerSurge.desc",
    description: "A tower that receives a Cascade level or rank from this tower also gets a brief power surge.",
    powerForRarity(rarity) {
      return LOOT.mods.powers.powerSurge[rarity];
    },
  }),
  nonvolatile: Object.freeze({
    id: "nonvolatile",
    category: "protocol",
    nameKey: "mod.nonvolatile.name",
    name: "Nonvolatile",
    descKey: "mod.nonvolatile.desc",
    description: "Overclock keeps {power}% of its stacks at the start of each wave instead of resetting to zero.",
    descriptionParams(mod) {
      return { power: mod?.power };
    },
    powerForRarity(rarity) {
      return LOOT.mods.powers.nonvolatile[rarity];
    },
    onNetworkChange(game) {
      let strongest = 0;
      for (const tower of game.towers || []) {
        strongest = Math.max(strongest, strongestModPower(tower, "nonvolatile"));
      }
      game.modNetwork.nonvolatile = strongest;
    },
  }),
  // --- Batch 5 depth mods ---
  overexpose: Object.freeze({
    id: "overexpose", category: "protocol",
    nameKey: "mod.overexpose.name", name: "Overexpose", descKey: "mod.overexpose.desc",
    description: "Raises Exposed to +{power}% extra damage per stack and its cap by +{cap} stacks.",
    descriptionParams(mod) {
      const t = LOOT.mods.powers.overexpose; let c = t.rare;
      if (Number.isFinite(mod?.power)) c = Object.values(t).find((e) => e.perStack === mod.power) || c;
      return { power: Number.isFinite(mod?.power) ? mod.power : c.perStack, cap: c.cap };
    },
    powerForRarity(rarity) { return LOOT.mods.powers.overexpose[rarity]?.perStack; },
    onNetworkChange(game) {
      game.modNetwork.overexpose = strongestConfigOnBoard(game, "overexpose", LOOT.mods.powers.overexpose, "cap") || null;
    },
  }),
  painted: Object.freeze({
    id: "painted", category: "protocol",
    nameKey: "mod.painted.name", name: "Painted", descKey: "mod.painted.desc",
    description: "This tower deals +{power}% damage to enemies that are Exposed.",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.painted[rarity]; },
    onHit: paintedOnHit,
  }),
  bufferOverflow: Object.freeze({
    id: "bufferOverflow", category: "protocol", powerFormat: "flat", powerSuffix: "",
    nameKey: "mod.bufferOverflow.name", name: "Buffer Overflow", descKey: "mod.bufferOverflow.desc",
    description: "Desync builds +{power} stacks per same-type hit and its cap rises to {cap}.",
    descriptionParams(mod) {
      const t = LOOT.mods.powers.bufferOverflow; let c = t.rare;
      if (Number.isFinite(mod?.power)) c = Object.values(t).find((e) => e.stacksPerHit === mod.power) || c;
      return { power: Number.isFinite(mod?.power) ? mod.power : c.stacksPerHit, cap: c.cap };
    },
    powerForRarity(rarity) { return LOOT.mods.powers.bufferOverflow[rarity]?.stacksPerHit; },
    onNetworkChange(game) {
      game.modNetwork.bufferOverflow = strongestConfigOnBoard(game, "bufferOverflow", LOOT.mods.powers.bufferOverflow, "cap") || null;
    },
  }),
  overvolt: Object.freeze({
    id: "overvolt", category: "protocol", powerFormat: "flat", powerSuffix: "",
    nameKey: "mod.overvolt.name", name: "Overvolt", descKey: "mod.overvolt.desc",
    description: "Consuming {power} or more Desync stacks guarantees a critical hit.",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.overvolt[rarity]; },
  }),
  payload: Object.freeze({
    id: "payload", category: "protocol",
    nameKey: "mod.payload.name", name: "Payload", descKey: "mod.payload.desc",
    description: "Consuming Desync also applies Corruption equal to {power}% of the consumed stacks.",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.payload[rarity]; },
  }),
  malware: Object.freeze({
    id: "malware", category: "protocol", powerFormat: "flat", powerSuffix: "",
    nameKey: "mod.malware.name", name: "Malware", descKey: "mod.malware.desc",
    description: "On death, Corrupted enemies pass 100% of their Corruption to {power} nearby enemies.",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.malware[rarity]?.targets; },
    onNetworkChange(game) {
      game.modNetwork.malware = strongestConfigOnBoard(game, "malware", LOOT.mods.powers.malware, "targets") || null;
    },
  }),
  quarantine: Object.freeze({
    id: "quarantine", category: "protocol", powerFormat: "flat", powerSuffix: "◆",
    nameKey: "mod.quarantine.name", name: "Quarantine", descKey: "mod.quarantine.desc",
    description: "The first {cap} Corrupted enemies killed each wave grant +{power} credits.",
    descriptionParams(mod) { return { power: mod?.power, cap: LOOT.mods.quarantineCapPerWave }; },
    powerForRarity(rarity) { return LOOT.mods.powers.quarantine[rarity]; },
    onNetworkChange(game) {
      let s = 0;
      for (const t of game.towers || []) s = Math.max(s, strongestModPower(t, "quarantine"));
      game.modNetwork.quarantine = s;
    },
    onWaveStart(game) { game._quarantineKills = 0; },
    onKill: quarantineOnKill,
  }),
  inheritance: Object.freeze({
    id: "inheritance", category: "protocol", powerFormat: "flat", powerSuffix: "",
    nameKey: "mod.inheritance.name", name: "Inheritance", descKey: "mod.inheritance.desc",
    description: "Towers created by this tower's Fork spawn +{power} level higher (never above this tower).",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.inheritance[rarity]; },
  }),
  warmBoot: Object.freeze({
    id: "warmBoot", category: "protocol", powerFormat: "flat", powerSuffix: "",
    nameKey: "mod.warmBoot.name", name: "Warm Boot", descKey: "mod.warmBoot.desc",
    description: "When this tower's Fork spawns a tower, it gains {power} Overclock stacks.",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.warmBoot[rarity]; },
  }),
  signalBoost: Object.freeze({
    id: "signalBoost", category: "protocol",
    nameKey: "mod.signalBoost.name", name: "Signal Boost", descKey: "mod.signalBoost.desc",
    description: "Raises this tower's Broadcast auras by +{power} points and their radius by +{radius} tiles.",
    descriptionParams(mod) {
      const t = LOOT.mods.powers.signalBoost; let c = t.rare;
      if (Number.isFinite(mod?.power)) c = Object.values(t).find((e) => e.power === mod.power) || c;
      return { power: Number.isFinite(mod?.power) ? mod.power : c.power, radius: c.radius };
    },
    powerForRarity(rarity) { return LOOT.mods.powers.signalBoost[rarity]?.power; },
  }),
  receiver: Object.freeze({
    id: "receiver", category: "protocol",
    nameKey: "mod.receiver.name", name: "Receiver", descKey: "mod.receiver.desc",
    description: "This tower gains +{power}% extra effect from every Broadcast aura it sits under.",
    descriptionParams(mod) { return { power: mod?.power }; },
    powerForRarity(rarity) { return LOOT.mods.powers.receiver[rarity]; },
    // Runs LAST (registered last) so every aura is already resolved on _broadcast.
    onNetworkChange(game) {
      for (const t of game.towers || []) {
        const p = strongestModPower(t, "receiver");
        if (p <= 0 || !t._broadcast) continue;
        const m = 1 + p;
        t._broadcast.damage *= m; t._broadcast.fireRate *= m;
        t._broadcast.range *= m; t._broadcast.crit *= m;
      }
    },
  }),
});

const MOD_IDS = Object.keys(MODS);

export function getMod(id) {
  return MODS[id] || null;
}

export function isFault(id) {
  return getMod(id)?.category === "fault";
}

export function isProtocol(id) {
  return getMod(id)?.category === "protocol";
}

export function modPowerForRarity(id, rarity) {
  const resolved = getMod(id)?.powerForRarity?.(rarity);
  if (Number.isFinite(resolved)) return resolved;
  const configured = LOOT.mods.powers[id]?.[rarity];
  return Number.isFinite(configured) ? configured : null;
}

// Hit handlers see every hit, not only hits from their own carriers. This is
// what lets a target-side Fault such as Exposed affect damage from all towers;
// each definition decides whether the current source also applies its Fault.
function dispatchCombatHook(hook, ctx) {
  if (!ctx) return ctx;
  for (const id of MOD_IDS) MODS[id][hook]?.(ctx);
  return ctx;
}

export function onHit(ctx) {
  return dispatchCombatHook("onHit", ctx);
}

export function onKill(ctx) {
  return dispatchCombatHook("onKill", ctx);
}

// Wave starts are tower-local: walk each tower's equipped mod ids and invoke
// only definitions that declared interest. A duplicate mod id still resets its
// carrier once, and towers without interested mods are skipped entirely.
export function onWaveStart(game) {
  if (!game) return;
  for (const tower of game.towers || []) {
    for (const id of Object.keys(tower.gearMods || {})) {
      const handler = MODS[id]?.onWaveStart;
      if (handler) handler(game, tower);
    }
  }
}

// Cascade hooks are per-tower: the ONE tower that just gained a level/rank. Only
// its own mods are consulted. Fired from towers.js (paid upgrade / mastery rank-up).
export function onLevelUp(game, tower) {
  if (!game || !tower) return;
  for (const id of Object.keys(tower.gearMods || {})) MODS[id]?.onLevelUp?.(game, tower);
}

export function onMasteryUp(game, tower) {
  if (!game || !tower) return;
  for (const id of Object.keys(tower.gearMods || {})) MODS[id]?.onMasteryUp?.(game, tower);
}

// Movement-affecting Faults compose multiplicatively. The enemy loop calls
// this once for the enemy it is already updating; no tower scan is involved.
export function faultMovementMult(enemy) {
  if (!enemy?.faults) return 1;
  let mult = 1;
  for (const id in enemy.faults) {
    const movementMult = MODS[id]?.movementMult;
    if (movementMult) mult *= movementMult(enemy.faults[id]);
  }
  return mult;
}

export function inspectFaults(enemy, game = null) {
  const inspected = {};
  for (const [id, fault] of Object.entries(enemy?.faults || {})) {
    inspected[id] = MODS[id]?.inspect
      ? MODS[id].inspect(fault, enemy, game)
      : { ...fault };
  }
  return inspected;
}

export function faultInspectionLines(enemy, game = null) {
  const lines = [];
  for (const [id, fault] of Object.entries(enemy?.faults || {})) {
    const def = MODS[id];
    lines.push(`${def?.name || id}:`);
    if (def?.debugLines) lines.push(...def.debugLines(fault, enemy, game));
    else lines.push(`Stacks: ${fault.stacks || 0}`);
    lines.push("");
  }
  return lines;
}

// Network work is event-driven: placement, removal, and gear changes reset
// the resolved caches, then registered Protocol hooks may rebuild them. No
// enemy×tower work belongs in the frame loop.
export function onNetworkChange(game) {
  if (!game) return;
  game.modNetwork ||= {};
  game.modNetwork.array = {};
  for (const tower of game.towers || []) {
    // Refresh gearMods from current gear FIRST: a gear equip/unequip triggers a
    // network rebuild, and Protocol hooks below read gearMods to find carriers.
    // recomputeStats also sets this, but it runs AFTER onNetworkChange, so the
    // network must not depend on that ordering (would miss just-changed gear).
    tower.gearMods = aggregateMods(tower.gear);
    tower._broadcast = { damage: 0, fireRate: 0, range: 0, crit: 0 };
    tower._broadcastRadius = 0;
  }
  for (const id of MOD_IDS) MODS[id].onNetworkChange?.(game);
}
