// ============================================================
// LOOT — the item generator (LOOT_DESIGN.md P2). A PURE module: it
// rolls item objects and nothing else — no DOM, no save writes, no
// game state. Drops (P4) and the store (P5) will call generateItem()
// with an ilvl/rarity; combat (P3) will read the item's affixes/unique.
//
// All tunables live in config.js LOOT.gen — this file is only the roll
// logic. Console-testable per HANDOFF.md: main.js exposes `window.loot`,
// so you can run e.g. `loot.lootSelfTest(20000)` or
// `loot.generateItem({ rarity: 'singularity' })` from DevTools.
//
// Item shape (LOOT_DESIGN.md §11):
//   { id, slot, rarity, towerType, ilvl, reqLevel, reqMastery,
//     affixes: [{ stat, value }, ...], unique }
//   towerType: null = universal (any tower); else locked to one type.
//   unique:    null, a minor id (Prismatic), or a named id (Singularity).
// ============================================================

import { LOOT } from "./config.js";

// The four typed slots (§4a) and the five tower types gear can lock to.
export const SLOTS = ["optic", "emitter", "capacitor", "frame"];
export const RARITIES = ["common", "enhanced", "rare", "prismatic", "singularity"];
export const TOWER_TYPES = ["laser", "pulse", "slow", "railgun", "rocket"];

// ---------- RNG ----------
// Default is Math.random, but every entry point accepts an injected rng()
// so tests can be deterministic (HANDOFF values reproducibility). makeRng
// is a tiny mulberry32 PRNG: makeRng(123) always yields the same stream.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Sample `count` distinct entries from `arr` (partial Fisher-Yates on a
// copy). Returns fewer than `count` only if `arr` is too small.
function sampleWithoutReplacement(arr, count, rng) {
  const pool = arr.slice();
  const out = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out;
}

// Weighted pick from an object like { common: 60, rare: 10, ... }.
function weightedPick(weights, rng) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = rng() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return Object.keys(weights)[0]; // numeric-safety fallback
}

let idCounter = 0;
function makeId(rng) {
  idCounter = (idCounter + 1) % 1e9;
  return "i" + Date.now().toString(36) + "_" + idCounter.toString(36) +
    Math.floor(rng() * 1e6).toString(36);
}

// ---------- Rolls ----------

// Roll a rarity from weights (the generator's default when a caller doesn't
// pin one). Drops (P4) can pass biased weights.
export function rollRarity(rng = Math.random, weights = LOOT.gen.rarityWeights) {
  return weightedPick(weights, rng);
}

// Is this affix allowed on an item locked to `towerType` (null = universal)?
// Universal affixes go anywhere; a type-specific affix needs a restricted
// item whose type it lists. This is the §4c intersection rule — because we
// fix towerType first and only ever admit compatible affixes, the whole
// item stays type-consistent by construction.
function affixAllowed(affix, towerType) {
  if (affix.types === "universal") return true;
  if (towerType === null) return false;
  return affix.types.includes(towerType);
}

// Roll one affix's value within its per-rarity band, nudged toward the top
// by ilvl and boosted if the item is restricted.
function rollAffixValue(affix, rarity, ilvl, restricted, rng) {
  const [lo, hi] = affix.ranges[rarity];
  const g = LOOT.gen;
  const t = Math.max(0, Math.min(1, ilvl / g.ilvlMax));
  const base = rng();
  const frac = base + (1 - base) * (t * g.ilvlTopBias); // never below `base`
  let v = lo + frac * (hi - lo);
  if (restricted) v *= g.restrictedRollBonus; // may exceed hi — intended (§4c)
  v = Math.round(v);
  return Math.max(lo, v); // floor at the band minimum; bonus only raises
}

// Roll `count` distinct affixes for a slot, all compatible with towerType.
function rollAffixes(slot, rarity, count, towerType, ilvl, rng) {
  const eligible = LOOT.gen.slots[slot].filter((a) => affixAllowed(a, towerType));
  const chosen = sampleWithoutReplacement(eligible, count, rng);
  const restricted = towerType !== null;
  return chosen.map((a) => ({
    stat: a.stat,
    value: rollAffixValue(a, rarity, ilvl, restricted, rng),
  }));
}

// How many normal affixes a rarity grants (Singularity rolls 2 or 3).
function affixCountFor(rarity, rng) {
  const c = LOOT.gen.affixCounts[rarity];
  return Array.isArray(c) ? c[0] + Math.floor(rng() * (c[1] - c[0] + 1)) : c;
}

// Derive the career-maxLevel requirement for common/enhanced from ilvl
// (1..reqLevelMax). Rare+ gate on Mastery instead, so their reqLevel is 0.
function reqLevelFor(rarity, ilvl) {
  if (rarity !== "common" && rarity !== "enhanced") return 0;
  const g = LOOT.gen;
  const t = Math.max(0, Math.min(1, ilvl / g.ilvlMax));
  return Math.max(1, Math.min(g.reqLevelMax, 1 + Math.floor(t * g.reqLevelMax)));
}

// ---------- Public: generate one item ----------
// opts (all optional):
//   rarity     — pin a rarity, else rolled from weights
//   slot       — pin a slot (ignored for singularity: the unique sets it)
//   ilvl       — item level (default 1 = bottom of the band)
//   towerType  — pin restriction: a type, or null for universal
//   unique     — pin a specific named unique id (forces rarity singularity)
//   rng        — injected rng() for reproducibility
export function generateItem(opts = {}) {
  const g = LOOT.gen;
  const rng = opts.rng || Math.random;
  const ilvl = opts.ilvl ?? 1;

  // A pinned unique id forces a Singularity built around it.
  let rarity = opts.unique ? "singularity" : (opts.rarity || rollRarity(rng));

  let slot, towerType, unique, affixes;

  if (rarity === "singularity") {
    // The named unique DEFINES the item: its slot (and maybe its tower type).
    let pool = g.uniques.named;
    if (opts.unique) pool = pool.filter((u) => u.id === opts.unique);
    else {
      if (opts.slot) pool = pool.filter((u) => u.slot === opts.slot);
      if (opts.towerType !== undefined) {
        pool = pool.filter((u) => (u.towerType ?? null) === opts.towerType);
      }
    }
    if (pool.length === 0) pool = g.uniques.named; // fall back if over-constrained
    const u = pick(pool, rng);
    slot = u.slot;
    towerType = u.towerType ?? null; // named uniques w/o a type are universal
    unique = u.id;
    affixes = rollAffixes(slot, rarity, affixCountFor(rarity, rng), towerType, ilvl, rng);
  } else {
    slot = opts.slot || pick(SLOTS, rng);

    // Restriction (§4c): universal with prob pUniversal, else lock to a type.
    if (opts.towerType !== undefined) {
      towerType = opts.towerType;
    } else {
      towerType = rng() < g.pUniversal ? null : pick(TOWER_TYPES, rng);
    }

    affixes = rollAffixes(slot, rarity, affixCountFor(rarity, rng), towerType, ilvl, rng);

    // A universal roll can still land on a slot/type combo with too few
    // universal affixes to fill the count — fall back to a restriction so
    // the item isn't short an affix. (Doesn't happen with the shipped table,
    // where every slot has >= 2 universal affixes, but stays correct if the
    // table changes.)
    const wantCount = affixCountFor(rarity, () => 0); // min count, deterministic
    if (towerType === null && affixes.length < wantCount) {
      towerType = pick(TOWER_TYPES, rng);
      affixes = rollAffixes(slot, rarity, wantCount, towerType, ilvl, rng);
    }

    unique = rarity === "prismatic" ? pick(g.uniques.minor, rng).id : null;
  }

  return {
    id: makeId(rng),
    slot,
    rarity,
    towerType,
    ilvl,
    reqLevel: reqLevelFor(rarity, ilvl),
    reqMastery: g.reqMastery[rarity],
    affixes,
    unique,
  };
}

// ---------- Console helpers (verification, not gameplay) ----------

// One-line human summary of an item, for eyeballing in the console.
export function itemLabel(item) {
  const lock = item.towerType ? item.towerType : "universal";
  const aff = item.affixes.map((a) => `${a.stat} ${a.value}`).join(", ");
  const uniq = item.unique ? ` {${item.unique}}` : "";
  const req = item.reqMastery ? `★${item.reqMastery}` : `Lv${item.reqLevel}`;
  return `[${item.rarity}] ${item.slot}/${lock} ilvl${item.ilvl} req${req} — ${aff}${uniq}`;
}

// Batch-generate and assert the design's invariants (§4b/§4c/§11). Returns a
// summary object; throws on the first violated invariant so a broken change
// is loud. Run e.g. loot.lootSelfTest(50000) in the console.
export function lootSelfTest(n = 20000, seed = 12345) {
  const rng = makeRng(seed);
  const g = LOOT.gen;
  const byRarity = {};
  const bySlot = {};
  let universalCount = 0;

  for (let i = 0; i < n; i++) {
    const ilvl = Math.floor(rng() * (g.ilvlMax + 1));
    const it = generateItem({ ilvl, rng });

    byRarity[it.rarity] = (byRarity[it.rarity] || 0) + 1;
    bySlot[it.slot] = (bySlot[it.slot] || 0) + 1;
    if (it.towerType === null) universalCount++;

    // Shape checks.
    if (!SLOTS.includes(it.slot)) throw new Error(`bad slot: ${it.slot}`);
    if (!RARITIES.includes(it.rarity)) throw new Error(`bad rarity: ${it.rarity}`);
    if (it.towerType !== null && !TOWER_TYPES.includes(it.towerType)) {
      throw new Error(`bad towerType: ${it.towerType}`);
    }

    // Affix count matches rarity (§4b).
    const cc = g.affixCounts[it.rarity];
    const [minC, maxC] = Array.isArray(cc) ? cc : [cc, cc];
    if (it.affixes.length < minC || it.affixes.length > maxC) {
      throw new Error(`${it.rarity} affix count ${it.affixes.length} not in [${minC},${maxC}]`);
    }

    // §4c: every affix must be legal for the item's restriction, and no
    // type-specific affix may ride on a universal item.
    const stats = new Set();
    for (const a of it.affixes) {
      const def = g.slots[it.slot].find((d) => d.stat === a.stat);
      if (!def) throw new Error(`affix ${a.stat} not in slot ${it.slot}`);
      if (!affixAllowed(def, it.towerType)) {
        throw new Error(`affix ${a.stat} illegal on ${it.towerType} item`);
      }
      if (stats.has(a.stat)) throw new Error(`duplicate affix ${a.stat}`);
      stats.add(a.stat);
      // Value never below the band floor.
      if (a.value < def.ranges[it.rarity][0]) {
        throw new Error(`affix ${a.stat} value ${a.value} below floor`);
      }
    }

    // Uniques only where they belong (§4b/§6).
    if (it.unique) {
      const isNamed = g.uniques.named.some((u) => u.id === it.unique);
      const isMinor = g.uniques.minor.some((u) => u.id === it.unique);
      if (it.rarity === "singularity" && !isNamed) throw new Error(`sing unique ${it.unique} not named`);
      if (it.rarity === "prismatic" && !isMinor) throw new Error(`prism unique ${it.unique} not minor`);
      if (it.rarity !== "singularity" && it.rarity !== "prismatic") {
        throw new Error(`${it.rarity} should have no unique`);
      }
    } else if (it.rarity === "prismatic" || it.rarity === "singularity") {
      throw new Error(`${it.rarity} missing its unique`);
    }
  }

  return {
    n,
    byRarity,
    bySlot,
    pctUniversal: +(100 * universalCount / n).toFixed(1),
    ok: true,
  };
}
