// ============================================================
// MODS — behavioral gear modifiers. Pure registry + explicit hook
// dispatch: no DOM, save writes, or game-loop ownership.
//
// P0 deliberately ships an empty registry. Adding a mod later means
// registering its definition here and supplying only the hooks it uses.
// ============================================================

export const MODS = Object.freeze({});

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

function dispatchSourceHook(hook, ctx) {
  if (MOD_IDS.length === 0 || !ctx || !ctx.source) return ctx;
  for (const mod of ctx.source._modEntries || []) {
    const fn = MODS[mod.id]?.[hook];
    if (fn) fn(ctx, mod);
  }
  return ctx;
}

export function onHit(ctx) {
  return dispatchSourceHook("onHit", ctx);
}

export function onKill(ctx) {
  return dispatchSourceHook("onKill", ctx);
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
