// ============================================================
// GEAR VISUALS — pure gear-presentation primitives shared by the campaign
// gear panel (ui.js) and the roguelike run UI (roguelike-ui.js). No DOM
// references, no game-state reads/writes: everything here is a pure
// function of its arguments, moved verbatim out of ui.js so both callers
// stop carrying duplicate copies.
//
// Import graph: this module is a LEAF. It may import ONLY from i18n.js,
// config.js, affixes.js, and equipment.js. It must NOT import ui.js,
// roguelike-ui.js, main.js, game.js, towers.js, or renderer.js.
// ============================================================

import { t, tf } from "./i18n.js";
import { TOWERS, LOOT, VFX } from "./config.js";
import { getMod } from "./affixes.js";
import { GEAR_SLOTS, itemMods } from "./equipment.js";

// ---- Item identity ----

export function itemUniqueName(item) {
  if (!item || !item.unique) return "";
  const named = LOOT.gen.uniques.named.find((u) => u.id === item.unique);
  const minor = LOOT.gen.uniques.minor.find((u) => u.id === item.unique);
  return (named || minor || {}).name || item.unique;
}

export function itemTitle(item) {
  const slot = slotLabel(item.slot);
  const lock = item.towerType ? tf("gear.towerOnly", "{prefix}-ONLY", { prefix: TOWERS[item.towerType].rosterPrefix.toUpperCase() }) : t("gear.universal", "UNIVERSAL");
  const unique = itemUniqueName(item);
  return unique ? `${unique.toUpperCase()} ${slot}` : `${rarityLabel(item.rarity)} ${slot} ${lock}`;
}

// ---- Tile components shared by both tabs + the bottom sheet ----

export const SLOT_LABEL = { optic: "OPTIC", emitter: "EMITTER", capacitor: "CAPACITOR", frame: "FRAME" };
// i18n display helpers (Phase E) — analogous to the Phase B name helpers
// near the top of ui.js; SLOT_LABEL/the raw rarity id stay the English
// fallback so every item.rarity/item.slot render site can wrap uniformly.
export function rarityLabel(rarity) {
  return t(`rarity.${rarity}`, rarity.toUpperCase());
}
export function slotLabel(slot) {
  return t(`slot.${slot}`, SLOT_LABEL[slot] || slot.toUpperCase());
}
// Raw hex (not var()) so JS can append alpha for glow shadows below.
export const RARITY_COLOR = {
  common: "#b7c0d5", enhanced: "#4affa1", rare: "#35e0ff",
  prismatic: "#ff3fd4", singularity: "#ffe24a",
};
export const RARITY_CLASS = { common: "rc", enhanced: "re", rare: "rr", prismatic: "rp", singularity: "rs" };
export const RARITY_ORDER = ["singularity", "prismatic", "rare", "enhanced", "common"];

// Neon slot glyph as an inline SVG string (stroke-only, no fills — matches
// the approved mockup's vector-outline look). No glow filter here (the
// tile's own box-shadow provides that) — an SVG <filter> would need a
// unique id per tile, which repeated grids make awkward.
export function slotGlyph(slot, color) {
  const s = `stroke="${color}" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`;
  let body = "";
  if (slot === "optic") {
    body = `<circle cx="50" cy="50" r="26" ${s}/><circle cx="50" cy="50" r="6" fill="${color}" stroke="none"/>` +
      `<line x1="50" y1="10" x2="50" y2="24" ${s}/><line x1="50" y1="76" x2="50" y2="90" ${s}/>` +
      `<line x1="10" y1="50" x2="24" y2="50" ${s}/><line x1="76" y1="50" x2="90" y2="50" ${s}/>`;
  } else if (slot === "emitter") {
    body = `<polygon points="50,14 86,80 14,80" ${s}/><circle cx="50" cy="62" r="7" fill="${color}" stroke="none"/>`;
  } else if (slot === "capacitor") {
    body = `<polyline points="56,10 30,54 50,54 42,90 72,42 52,42 62,10" ${s}/>`;
  } else if (slot === "frame") {
    body = `<polygon points="50,10 85,30 85,70 50,90 15,70 15,30" ${s}/><polygon points="50,32 68,42 68,60 50,70 32,60 32,42" ${s}/>`;
  }
  return `<svg class="glyph" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// ---- Affixes ----

export function affixDef(stat) {
  for (const slot of GEAR_SLOTS) {
    const def = LOOT.gen.slots[slot].find((a) => a.stat === stat);
    if (def) return def;
  }
  return null;
}

// Config affix names carry a " %" or " +N" suffix for documentation
// (config.js), which would duplicate the "+N%" already shown next to it.
export function affixLabel(def, stat) {
  return ((def && def.name) || stat).replace(/ %| \+N$/, "");
}

// ---- Mods ----

export function modName(id) {
  const def = getMod(id);
  const fallback = def?.name || id.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
  return def?.nameKey ? t(def.nameKey, fallback) : fallback;
}

export function modPower(power) {
  return Math.round(power * 10000) / 100;
}

export function modPowerValue(id, power) {
  return getMod(id)?.powerFormat === "flat" ? power : modPower(power);
}

export function modPowerSuffix(id) {
  return getMod(id)?.powerSuffix ?? "%";
}

export function modPowerText(id, power) {
  return `+${modPowerValue(id, power)}${modPowerSuffix(id)}`;
}

// Sum an item's affixes into a { stat: value } map (an affix stat can, in
// principle, appear twice — add them).
export function itemStatMap(item) {
  const m = {};
  for (const a of item.affixes || []) m[a.stat] = (m[a.stat] || 0) + a.value;
  return m;
}

// Small E/T/D pips for the Fault mods an item carries — the SAME glyphs the
// afflicted enemy shows (VFX.faultMarker.types is the single source of truth),
// so a player connects gear -> tower -> enemy. Only Faults appear here (Protocols
// aren't in that map); returns "" when the item carries none.
export function modFaultBadgesHtml(item) {
  const types = VFX.faultMarker?.types;
  if (!types) return "";
  const ids = new Set(itemMods(item).map((m) => m.id));
  const pips = [];
  for (const id in types) {
    if (!ids.has(id)) continue;
    const m = types[id];
    pips.push(`<span class="mod-pip" style="background:${m.color}">${m.label}</span>`);
  }
  return pips.length ? `<span class="mod-pips">${pips.join("")}</span>` : "";
}

// Nicknames come from other players — always escape before innerHTML.
export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ---- Item tile shared by stash/store/results and the run-end arsenal ----
// Callers own stateful concerns such as whether a stash item is unseen; this
// leaf only renders the caller-supplied opts.isNew flag.

export function itemTileHtml(item, opts = {}) {
  const color = RARITY_COLOR[item.rarity];
  const lockLetter = item.towerType ? TOWERS[item.towerType].prefix : "";
  const isNew = !!opts.isNew;
  const dataAttr = opts.stashId ? `data-stash-item="${item.id}"`
    : opts.pendingId ? `data-pending-item="${item.id}"`
    : opts.storeId ? `data-store-item="${item.id}"`
    : opts.resultIndex != null ? `data-result-item="${opts.resultIndex}"` : "";
  const cornerTag = opts.priceTag
    ? `<span class="price-tag">&#9670;${opts.priceTag}</span>`
    : lockLetter ? `<span class="lock-dot" style="color:${color}">${lockLetter}</span>` : "";
  const extraClass = (opts.unaffordable ? " unaffordable" : "") + (opts.tileClass ? ` ${opts.tileClass}` : "");
  return `<button class="item-tile ${RARITY_CLASS[item.rarity]}${extraClass}" ${dataAttr}>` +
    slotGlyph(item.slot, color) +
    cornerTag +
    modFaultBadgesHtml(item) +
    (isNew ? `<span class="new-tag">${t("reward.new", "NEW")}</span>` : "") +
    `</button>`;
}

// ---- Compare-sheet middle (stat rows + mod rows + unique row) ----
// Old-vs-new comparison (B4): one row per affix aligned by stat with
// green/red deltas (affixes present on only one side render greyed on the
// other), one row per behavioral mod compared by id, and a UNIQUE row when
// either side carries a unique. Returns the concatenated rows so the caller
// (openCompareSheet in ui.js, or a rogue-local compare screen) supplies its
// own overlay/header/footer/wiring around it.
export function compareRowsHtml(current, incoming) {
  const curMap = itemStatMap(current);
  const newMap = itemStatMap(incoming);

  // Union of stats, keeping current's order first, then new-only stats.
  const stats = [...Object.keys(curMap), ...Object.keys(newMap).filter((s) => !(s in curMap))];
  const rows = stats.map((stat) => {
    const def = affixDef(stat);
    const suffix = def && def.int ? "" : "%";
    const hasCur = stat in curMap, hasNew = stat in newMap;
    const cv = curMap[stat] || 0, nv = newMap[stat] || 0;
    const delta = nv - cv;
    const deltaHtml = delta === 0 ? "" :
      `<span class="cmp-delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "&#9650;" : "&#9660;"}${Math.abs(delta)}${suffix}</span>`;
    return `<div class="cmp-row"><span class="cmp-label">${escapeHtml(affixLabel(def, stat))}</span>` +
      `<span class="cmp-cell${hasCur ? "" : " cmp-absent"}">${hasCur ? `+${cv}${suffix}` : "&mdash;"}</span>` +
      `<span class="cmp-cell${hasNew ? "" : " cmp-absent"}">${hasNew ? `+${nv}${suffix}` : "&mdash;"}${deltaHtml}</span></div>`;
  }).join("");

  // Uniques compared as their own row when either side carries one.
  const curU = itemUniqueName(current), newU = itemUniqueName(incoming);
  const uniqueRow = (curU || newU)
    ? `<div class="cmp-row cmp-uniquerow"><span class="cmp-label">UNIQUE</span>` +
      `<span class="cmp-cell${curU ? "" : " cmp-absent"}">${curU ? escapeHtml(curU) : "&mdash;"}</span>` +
      `<span class="cmp-cell${newU ? "" : " cmp-absent"}">${newU ? escapeHtml(newU) : "&mdash;"}</span></div>`
    : "";

  // Behavioral mods compare by id just like normal affixes compare by stat.
  // Old gear safely contributes an empty list through itemMods().
  const curMods = new Map(itemMods(current).map((mod) => [mod.id, mod]));
  const newMods = new Map(itemMods(incoming).map((mod) => [mod.id, mod]));
  const modIds = [...curMods.keys(), ...[...newMods.keys()].filter((id) => !curMods.has(id))];
  const modRows = modIds.map((id) => {
    const curMod = curMods.get(id), newMod = newMods.get(id);
    const hasCur = !!curMod, hasNew = !!newMod;
    const suffix = modPowerSuffix(id);
    const delta = hasCur && hasNew
      ? modPowerValue(id, newMod.power - curMod.power)
      : 0;
    const deltaHtml = delta === 0 ? "" :
      `<span class="cmp-delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "&#9650;" : "&#9660;"}${Math.abs(delta)}${suffix}</span>`;
    return `<div class="cmp-row"><span class="cmp-label">${escapeHtml(modName(id))}</span>` +
      `<span class="cmp-cell${hasCur ? "" : " cmp-absent"}">${hasCur ? modPowerText(id, curMod.power) : "&mdash;"}</span>` +
      `<span class="cmp-cell${hasNew ? "" : " cmp-absent"}">${hasNew ? modPowerText(id, newMod.power) : "&mdash;"}${deltaHtml}</span></div>`;
  }).join("");

  return rows + modRows + uniqueRow;
}

// ---- Gear tile (filled / empty) shared by the TOWERS tab grid, the run's
// reward/roster/shop cards, etc. `opts.dataAttrs` is a pre-built attribute
// string (e.g. `data-item-tower="..." data-item-slot="..."`) so each caller
// keeps its own click-delegation contract without this module knowing about
// it. `opts.asButton` (default true) renders a <button>; pass false for
// non-interactive contexts (a run reward/roster tile is not the campaign's
// edit button).

export function gearTileHtml(item, opts = {}) {
  const tag = opts.asButton === false ? "div" : "button";
  const color = RARITY_COLOR[item.rarity];
  const dataAttrs = opts.dataAttrs ? ` ${opts.dataAttrs}` : "";
  const justEquipped = opts.justEquipped ? " just-equipped" : "";
  return `<${tag} class="gear-tile filled ${RARITY_CLASS[item.rarity]}${justEquipped}"${dataAttrs}>` +
    slotGlyph(item.slot, color) +
    modFaultBadgesHtml(item) +
    `<span class="tile-label" style="color:${color}">${slotLabel(item.slot)}</span></${tag}>`;
}

export function gearTileEmptyHtml(slot, opts = {}) {
  const tag = opts.asButton === false ? "div" : "button";
  const dataAttrs = opts.dataAttrs ? ` ${opts.dataAttrs}` : "";
  return `<${tag} class="gear-tile empty"${dataAttrs}>` +
    slotGlyph(slot, "#5a668f") + `<span class="tile-label">${slotLabel(slot)}</span></${tag}>`;
}
