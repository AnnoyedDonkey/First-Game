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

function exposedOnHit(ctx) {
  if (!ctx?.enemy || !Number.isFinite(ctx.damage)) return;
  const cfg = LOOT.mods.powers.exposed;

  // The applying hit benefits from its own stack: add first, then read the
  // enemy's current stack total for the centralized damage multiplier.
  if (sourceHasMod(ctx.source, "exposed")) {
    addFaultStacks(ctx.enemy, "exposed", 1, cfg.maxStacks);
  }
  const stacks = getFaultStacks(ctx.enemy, "exposed");
  if (stacks > 0) ctx.damage *= 1 + stacks * cfg.perStack;
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

function forkOnKill(ctx) {
  // canProc===false marks a triggered (non-primary) hit — Fork never chains off
  // those, and forked towers are gearless so they can't carry Fork anyway.
  if (!ctx?.source || !ctx.game || ctx.canProc === false) return;
  const power = strongestModPower(ctx.source, "fork");
  if (power <= 0) return;
  const rng = ctx.game.rng || Math.random;
  if (rng() >= power) return;
  forkSpawner?.(ctx.game, ctx.source);
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
}

export function overclockFireRateMult(tower) {
  const configured = overclockParams(tower);
  if (!configured) return 1;
  const stacks = Math.max(0, tower?._overclock?.stacks || 0);
  return 1 + Math.min(configured.cap, stacks * configured.perKill);
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
function desyncOnHit(ctx) {
  if (!ctx?.enemy || !ctx.sourceType) return; // only real tower hits interact
  const sType = ctx.sourceType;
  const carrierPower = strongestModPower(ctx.source, "desync");
  const fault = getFault(ctx.enemy, "desync");

  if (fault && sType !== fault.towerType) {
    // CONSUME: amplify this hit (composes multiplicatively with Exposed via the
    // shared ctx.damage), clear the sequence, then maybe start a new one.
    if (Number.isFinite(ctx.damage)) ctx.damage *= 1 + fault.stacks * fault.powerPerStack;
    clearFault(ctx.enemy, "desync");
    if (carrierPower > 0) startDesync(ctx.enemy, sType, carrierPower);
    return;
  }
  // BUILD: only Desync carriers accumulate stacks.
  if (carrierPower > 0) {
    if (!fault) {
      startDesync(ctx.enemy, sType, carrierPower); // first hit = stack 1
    } else {
      fault.stacks = Math.min(LOOT.mods.desyncMaxStacks, fault.stacks + 1);
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

export function corruptionSpreadAmount(enemy) {
  return Math.floor(
    getFaultStacks(enemy, "corruption") * LOOT.mods.corruption.spreadFrac
  );
}

export function backdoorExposedFloor(enemy, game) {
  const ratio = game?.modNetwork?.backdoor || 0;
  if (ratio <= 0) return 0;
  return Math.min(
    LOOT.mods.powers.exposed.maxStacks,
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
  const radius = LOOT.mods.broadcastRadiusTiles * ts;
  const r2 = radius * radius;
  const selfBuffs = LOOT.mods.broadcastSelfBuffs;
  for (const source of towers) {
    const power = strongestModPower(source, modId);
    if (power <= 0) continue;
    source._broadcastRadius = radius; // drives the selection aura ring
    for (const target of towers) {
      if (target === source && !selfBuffs) continue;
      const dx = target.pos.x - source.pos.x;
      const dy = target.pos.y - source.pos.y;
      if (dx * dx + dy * dy <= r2) target._broadcast[field] += power;
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
