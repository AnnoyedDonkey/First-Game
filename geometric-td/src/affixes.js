// ============================================================
// MODS — behavioral gear modifiers. Pure registry + explicit hook
// dispatch: no DOM, save writes, or game-loop ownership.
// ============================================================

import { LOOT } from "./config.js";

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

// Desync tracks the strongest active per-stack power in the sequence, so a
// carrier's contribution is the MAX Desync power among its equipped mods.
function strongestModPower(source, id) {
  const list = source?.gearMods?.[id];
  if (!Array.isArray(list)) return 0;
  let max = 0;
  for (const m of list) if (Number.isFinite(m.power) && m.power > max) max = m.power;
  return max;
}

function startDesync(enemy, towerType, powerPerStack) {
  const faults = (enemy.faults ||= {});
  faults.desync = { stacks: 1, towerType, powerPerStack };
}

// Desync is a tower-SEQUENCING Fault (spec §9-11). Same-type hits from Desync
// carriers build stacks and the strongest participating power wins (a weaker
// source never lowers it). The first hit of a DIFFERENT tower type consumes the
// whole sequence and amplifies THAT hit by stacks * powerPerStack — regardless
// of whether the consumer carries Desync; a consuming carrier then immediately
// opens a fresh 1-stack sequence of its own type.
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
      fault.stacks += 1;
      // Stronger same-type source raises active power; weaker never lowers it.
      if (carrierPower > fault.powerPerStack) fault.powerPerStack = carrierPower;
    }
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

export function inspectFaults(enemy) {
  const inspected = {};
  for (const [id, fault] of Object.entries(enemy?.faults || {})) {
    inspected[id] = MODS[id]?.inspect ? MODS[id].inspect(fault) : { ...fault };
  }
  return inspected;
}

export function faultInspectionLines(enemy) {
  const lines = [];
  for (const [id, fault] of Object.entries(enemy?.faults || {})) {
    const def = MODS[id];
    lines.push(`${def?.name || id}:`);
    if (def?.debugLines) lines.push(...def.debugLines(fault));
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
    tower._broadcast = { damage: 0, fireRate: 0, range: 0, crit: 0 };
  }
  for (const id of MOD_IDS) MODS[id].onNetworkChange?.(game);
}
