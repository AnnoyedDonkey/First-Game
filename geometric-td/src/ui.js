// ============================================================
// UI — the HTML parts around the canvas: HUD, buttons, overlays.
// ============================================================

import {
  TOWERS, ENEMIES, SKILLS, SKILL_VALUES, SKILL_TIERS, TOWER_UPGRADES, LOOT,
} from "./config.js";
import {
  xpThresholdFor, upgradeCostFor, isUpgradeEligible, sellValueOf,
  masteryRankFor, xpToNextMastery, careerStatsFor,
} from "./towers.js";
import {
  getSkillTier, nextTierCost, getSkillPoints, buySkill, resetProgress,
  isTowerUnlocked, getProgress, getBestEndlessWave, getShards, getEndlessMilestones,
  getStash, getPendingLoot, stashSlotsFree, claimPendingLoot,
  discardPendingLoot, sellStashItem, sellPendingItem, sellAllStashRarity,
  equipStashItem, unequipToStash,
  getStoreStock, storeRerollCost, rerollStore, buyStoreItem,
  getStoreUnlocks, buyStoreUnlock,
  countUnseenStash, isItemSeen, markItemSeen,
} from "./progression.js";
import {
  canEquipItem, GEAR_SLOTS, normalizeGear, masteryRankFor as gearMasteryRankFor,
} from "./equipment.js";
import {
  isEnabled as lbEnabled, getNickname, setNickname,
  fetchAllBoards, publishAllLocalBests,
} from "./leaderboard.js";
import { WORLDS } from "./levels.js";

const el = {
  towerButtons: document.getElementById("tower-buttons"),
  upgradePanel: document.getElementById("upgrade-panel"),
  upName: document.getElementById("up-name"),
  upLevel: document.getElementById("up-level"),
  upXp: document.getElementById("up-xp"),
  upgradeButton: document.getElementById("upgrade-button"),
  upgradeBtnLabel: document.getElementById("upgrade-btn-label"),
  upgradeBtnSub: document.getElementById("upgrade-btn-sub"),
  sellButton: document.getElementById("sell-button"),
  sellBtnSub: document.getElementById("sell-btn-sub"),
  skillsButton: document.getElementById("skills-button"),
  skillPoints: document.getElementById("skill-points-value"),
  skillOverlay: document.getElementById("skill-overlay"),
  skillPointsLine: document.getElementById("skill-points-line"),
  skillList: document.getElementById("skill-list"),
  skillClose: document.getElementById("skill-close"),
  resetSave: document.getElementById("reset-save"),
  hud: document.getElementById("hud"),
  levelOverlay: document.getElementById("level-overlay"),
  levelList: document.getElementById("level-list"),
  shardsValue: document.getElementById("shards-value"),
  menuActions: document.getElementById("menu-actions"),
  worldPrev: document.getElementById("world-prev"),
  worldNext: document.getElementById("world-next"),
  worldName: document.getElementById("world-name"),
  worldDots: document.getElementById("world-dots"),
  levelSheetOverlay: document.getElementById("level-sheet-overlay"),
  levelSheet: document.getElementById("level-sheet"),
  actionBar: document.getElementById("action-bar"),
  gearOverlay: document.getElementById("gear-overlay"),
  gearWallet: document.getElementById("gear-wallet"),
  gearHelp: document.getElementById("gear-help"),
  gearTabTowers: document.getElementById("gear-tab-towers"),
  gearTabStash: document.getElementById("gear-tab-stash"),
  gearStashBadge: document.getElementById("gear-stash-badge"),
  gearScroll: document.getElementById("gear-scroll"),
  gearViewTowers: document.getElementById("gear-view-towers"),
  gearViewStash: document.getElementById("gear-view-stash"),
  gearClose: document.getElementById("gear-close"),
  gearSheetOverlay: document.getElementById("gear-sheet-overlay"),
  gearSheet: document.getElementById("gear-sheet"),
  storeOverlay: document.getElementById("store-overlay"),
  storeWallet: document.getElementById("store-wallet"),
  storeScroll: document.getElementById("store-scroll"),
  storeActions: document.getElementById("store-actions"),
  storeGrid: document.getElementById("store-grid"),
  storeClose: document.getElementById("store-close"),
  storeSheetOverlay: document.getElementById("store-sheet-overlay"),
  storeSheet: document.getElementById("store-sheet"),
  money: document.getElementById("money-value"),
  wave: document.getElementById("wave-value"),
  core: document.getElementById("core-value"),
  waveButton: document.getElementById("wave-button"),
  waveBtnLabel: document.getElementById("wave-btn-label"),
  waveBtnSub: document.getElementById("wave-btn-sub"),
  exitButton: document.getElementById("exit-button"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlaySubtitle: document.getElementById("overlay-subtitle"),
  overlayButtons: document.getElementById("overlay-buttons"),
  overlayNote: document.getElementById("overlay-note"),
  overlayItems: document.getElementById("overlay-items"),
  dropReveal: document.getElementById("drop-reveal"),
  leaderboardOverlay: document.getElementById("leaderboard-overlay"),
  leaderboardList: document.getElementById("leaderboard-list"),
  leaderboardMsg: document.getElementById("leaderboard-msg"),
  leaderboardClose: document.getElementById("leaderboard-close"),
  nicknameInput: document.getElementById("nickname-input"),
  nicknameSave: document.getElementById("nickname-save"),
  publishScores: document.getElementById("publish-scores"),
};

// Cache last-drawn values so we only touch the DOM when they change.
const last = {};

// Desktop: the mouse wheel only scrolls the element under the cursor,
// but these lists are narrow columns — forward wheel input from the
// whole overlay so scrolling works anywhere on screen.
function forwardWheel(overlay, list) {
  overlay.addEventListener(
    "wheel",
    (e) => {
      list.scrollTop += e.deltaY;
      e.preventDefault();
    },
    { passive: false }
  );
}
forwardWheel(el.levelOverlay, el.levelList);
forwardWheel(el.skillOverlay, el.skillList);
forwardWheel(el.leaderboardOverlay, el.leaderboardList);
forwardWheel(el.gearOverlay, el.gearScroll);
forwardWheel(el.storeOverlay, el.storeScroll);

function setText(node, key, value) {
  if (last[key] === value) return;
  last[key] = value;
  node.textContent = value;
}

export function updateHUD(game) {
  setText(el.money, "money", String(game.money));

  const waveNum = game.waveIndex + 1;
  const waveText = game.endless
    ? `${waveNum} ∞`
    : `${Math.min(waveNum, game.totalWaves)}/${game.totalWaves}`;
  setText(el.wave, "wave", waveText);

  setText(el.core, "core", `${game.coreHealth}/${game.maxCoreHealth}`);
  el.core.classList.toggle("danger", game.coreHealth <= game.maxCoreHealth * 0.3);

  setText(el.skillPoints, "skillPoints", String(getSkillPoints()));

  updateWaveButton(game);
}

function updateWaveButton(game) {
  let label;
  let sub;
  let disabled;

  switch (game.phase) {
    case "ready":
      label = "START WAVE";
      sub = String(game.waveIndex + 1);
      disabled = false;
      break;
    case "countdown":
      label = "NEXT IN";
      sub = `${Math.ceil(game.countdown)}s`;
      disabled = false; // tapping starts the wave early
      break;
    case "wave":
      label = `WAVE ${game.waveIndex + 1}`;
      sub = "ACTIVE";
      disabled = true;
      break;
    default:
      label = "—";
      sub = "";
      disabled = true;
  }

  setText(el.waveBtnLabel, "waveBtnLabel", label);
  setText(el.waveBtnSub, "waveBtnSub", sub);
  if (last.waveButtonDisabled !== disabled) {
    last.waveButtonDisabled = disabled;
    el.waveButton.disabled = disabled;
  }
}

// ---------- Tower buttons ----------

const towerButtonRefs = {}; // type -> button element

// Build one button per tower type from config. onSelect(type) fires on tap.
export function initTowerButtons(onSelect) {
  for (const [type, def] of Object.entries(TOWERS)) {
    const btn = document.createElement("button");
    btn.className = "tower-button";
    btn.style.setProperty("--tower-color", def.color);
    btn.innerHTML =
      `<span class="tower-button-name">${(def.trayName || def.name.replace(" Tower", "")).toUpperCase()}</span>` +
      `<span class="tower-button-cost">$${def.baseCost}</span>`;
    btn.addEventListener("click", () => onSelect(type));
    el.towerButtons.appendChild(btn);
    towerButtonRefs[type] = btn;
  }
}

// Highlight the selected type; grey out unaffordable/locked towers.
export function updateTowerButtons(game, selectedType) {
  for (const [type, btn] of Object.entries(towerButtonRefs)) {
    const unlocked = isTowerUnlocked(type);
    const affordable = game.money >= TOWERS[type].baseCost;
    const stateKey = `towerBtn:${type}`;
    const state = `${unlocked}:${affordable}:${selectedType === type}`;
    if (last[stateKey] === state) continue;
    last[stateKey] = state;
    btn.disabled = !unlocked || !affordable;
    btn.classList.toggle("selected", selectedType === type);
    btn.classList.toggle("locked", !unlocked);
    const costSpan = btn.querySelector(".tower-button-cost");
    costSpan.textContent = unlocked
      ? `$${TOWERS[type].baseCost}`
      : (TOWERS[type].unlockLabel || "LOCKED");
  }
}

// ---------- Upgrade panel ----------
// Shown in place of the tower buttons while a placed tower is selected.

export function updateUpgradePanel(game, tower) {
  const show = !!tower;
  if (last.panelShown !== show) {
    last.panelShown = show;
    el.upgradePanel.classList.toggle("hidden", !show);
    el.towerButtons.style.display = show ? "none" : "";
  }
  if (!tower) return;

  const threshold = xpThresholdFor(tower);
  const cost = upgradeCostFor(tower);
  const eligible = isUpgradeEligible(tower);

  const rank = masteryRankFor(tower.xp);
  const dps = tower.damage / tower.fireInterval;
  const dpsText = `${dps >= 100 ? Math.round(dps) : dps.toFixed(1)} DPS`;
  setText(el.upName, "upName", tower.name + (rank > 0 ? ` ★${rank}` : ""));
  // Veterans show their unlocked potential, e.g. "LV 1/3".
  const lvText = tower.maxUnlockedLevel > tower.level
    ? `LV ${tower.level}/${tower.maxUnlockedLevel}`
    : `LV ${tower.level}`;
  setText(el.upLevel, "upLevel", lvText);
  // Past level 5, the XP line tracks mastery progress instead.
  let xpText;
  if (threshold !== null && tower.xp < threshold) {
    xpText = `XP ${tower.xp}/${threshold}`;
  } else if (threshold !== null) {
    // Eligible (or a veteran re-leveling): no confusing 99999/100.
    xpText = rank > 0 ? `★${rank} · XP READY` : `XP READY`;
  } else {
    const toNext = xpToNextMastery(tower.xp);
    const pct = Math.round(rank * TOWER_UPGRADES.mastery.damagePerRank * 100);
    xpText = toNext === null
      ? `★${rank} MAX · +${pct}% DMG`
      : `★${rank} (+${pct}%) · NEXT ★ IN ${toNext} XP`;
  }
  setText(el.upXp, "upXp", `${dpsText} · ${xpText}`);

  // Button: what's between this tower and its next level?
  let label, sub, disabled;
  if (threshold === null) {
    label = "MAX";
    sub = "LEVEL";
    disabled = true;
  } else if (!eligible) {
    label = "NEED";
    sub = "XP";
    disabled = true;
  } else {
    label = "UPGRADE";
    sub = `$${cost}`;
    disabled = game.money < cost;
  }

  setText(el.upgradeBtnLabel, "upBtnLabel", label);
  setText(el.upgradeBtnSub, "upBtnSub", sub);
  setText(el.sellBtnSub, "sellBtnSub", `$${sellValueOf(tower)}`);
  if (last.upBtnDisabled !== disabled) {
    last.upBtnDisabled = disabled;
    el.upgradeButton.disabled = disabled;
  }
  const glow = eligible && !disabled;
  if (last.upBtnGlow !== glow) {
    last.upBtnGlow = glow;
    el.upgradeButton.classList.toggle("eligible", glow);
  }
}

export function onUpgradeButtonTap(handler) {
  el.upgradeButton.addEventListener("click", handler);
}

export function onSellButtonTap(handler) {
  el.sellButton.addEventListener("click", handler);
}

// ---------- Level select ----------
//
// The mission list is paged by WORLD (levels.js WORLDS): one world per
// page, navigated with the ◀ ▶ arrows or a horizontal swipe. A world is
// LOCKED until every level of the previous world is cleared; a locked
// world can still be PREVIEWED (greyed rows + an unlock banner) so the
// player can see what's ahead. The global menu entries (skill tree,
// towers, leaderboard, reset) live below the levels on every page.

// Set by showLevelSelect; read by the module-level nav handlers so the
// arrow/swipe listeners can stay bound once instead of per-open.
let menuCtx = null; // { levelById, completedIds, pick }
let currentWorld = 0;

// Shows the mission list. onPick(level, endless) fires when a playable
// level (or its Endless mode) is chosen.
export function showLevelSelect(levels, completedIds, onPick) {
  el.actionBar.classList.add("hidden"); // no tower tray on the menu
  el.hud.classList.add("hidden");       // top HUD is in-battle only
  closeLevelSheet();
  menuCtx = {
    levelById: new Map(levels.map((l) => [l.id, l])),
    levels,
    completedIds,
    pick: (level, endless) => {
      el.levelOverlay.classList.add("hidden");
      el.actionBar.classList.remove("hidden");
      el.hud.classList.remove("hidden"); // battle starting — show the HUD
      onPick(level, endless);
    },
  };
  currentWorld = 0; // always open on the first world
  renderWorld();
  el.levelOverlay.classList.remove("hidden");
}

// World i is unlocked when every level of world i-1 has been cleared.
function isWorldUnlocked(i) {
  if (i === 0) return true;
  return WORLDS[i - 1].levelIds.every((id) => menuCtx.completedIds.includes(id));
}

function navigateWorld(delta) {
  if (!menuCtx) return;
  const target = currentWorld + delta;
  if (target < 0 || target >= WORLDS.length) return; // clamp at the ends
  currentWorld = target;
  closeLevelSheet();
  renderWorld();
}

// ---------- Circuit-board menu (CIRCUIT_MENU_DESIGN.md M1) ----------
// The level list is drawn as a neon SVG circuit board: 5 level "chips"
// wired top→bottom by a per-world trace, decorative dead-end traces/pads,
// milestone tick-rings on cleared nodes, and an ∞ pad per cleared level.
// Ported from mockups/circuit-menu-mockup.html (the visual contract).

// Decorative circuit traces + pads, per world style. `a` = world accent.
function boardDecoTraces(style, a) {
  const seg = [];
  const line = (d, w, o, cls = "") =>
    seg.push(
      `<path d="${d}" fill="none" stroke="${a}" stroke-width="${w}" opacity="${o}" stroke-linecap="round" class="${cls}" ${cls ? 'stroke-dasharray="3 9"' : ""}/>`
    );
  const pad = (x, y, r, o) =>
    seg.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${a}" stroke-width=".5" opacity="${o}"/><circle cx="${x}" cy="${y}" r="${r * 0.35}" fill="${a}" opacity="${o * 0.8}"/>`
    );
  const hex = (x, y, r, o) => {
    let p = "";
    for (let i = 0; i < 6; i++) {
      const t = (Math.PI / 3) * i - Math.PI / 6;
      p += (i ? "L" : "M") + (x + r * Math.cos(t)).toFixed(1) + " " + (y + r * Math.sin(t)).toFixed(1);
    }
    seg.push(`<path d="${p}Z" fill="none" stroke="${a}" stroke-width=".5" opacity="${o}"/>`);
  };

  if (style === "grid") {
    line("M6 8 H40 V22 H14 V40", 0.7, 0.22); pad(14, 40, 1.6, 0.5);
    line("M94 6 V26 H86 V48", 0.7, 0.22); pad(86, 48, 1.6, 0.5);
    line("M4 70 H16 V92 H8 V118", 0.7, 0.18); pad(8, 118, 1.6, 0.4);
    line("M96 66 V88 H88 V112 H94", 0.7, 0.18); pad(94, 112, 1.6, 0.4);
    line("M10 55 H20", 0.5, 0.3); pad(10, 55, 1.2, 0.5);
    line("M90 58 H82", 0.5, 0.3); pad(90, 58, 1.2, 0.5);
    line("M48 2 V8 H60", 0.5, 0.25); pad(60, 8, 1.2, 0.45);
  } else if (style === "diagonal") {
    line("M4 22 L18 8 H34", 0.7, 0.22); hex(4, 22, 2.2, 0.5);
    line("M96 30 L84 18 H70", 0.7, 0.22); hex(96, 30, 2.2, 0.5);
    line("M6 64 L18 52", 0.6, 0.25); hex(6, 64, 2, 0.45);
    line("M94 78 L82 66", 0.6, 0.25); hex(94, 78, 2, 0.45);
    line("M10 122 L26 106 H40", 0.7, 0.18); hex(10, 122, 2.2, 0.4);
    line("M92 118 L78 104", 0.6, 0.2); hex(92, 118, 2, 0.45);
    line("M50 2 L58 10", 0.5, 0.25); hex(50, 2, 1.8, 0.4);
  } else {
    line("M50 64 L12 20", 0.5, 0.15); line("M50 64 L88 20", 0.5, 0.15);
    line("M50 64 L8 96", 0.5, 0.12); line("M50 64 L92 96", 0.5, 0.12);
    seg.push(`<circle cx="50" cy="64" r="44" fill="none" stroke="${a}" stroke-width=".4" opacity=".14"/>`);
    seg.push(`<circle cx="50" cy="64" r="55" fill="none" stroke="${a}" stroke-width=".4" opacity=".09"/>`);
    pad(12, 20, 1.6, 0.4); pad(88, 20, 1.6, 0.4); pad(8, 96, 1.4, 0.35); pad(92, 96, 1.4, 0.35);
  }
  return seg.join("");
}

// Connector path between two consecutive nodes, per world style.
function boardConnector(p1, p2, style) {
  if (style === "grid") {
    const my = (p1.y + p2.y) / 2;
    return `M${p1.x} ${p1.y} V${my} H${p2.x} V${p2.y}`;
  }
  if (style === "diagonal") {
    const dx = p2.x - p1.x, sy = p2.y - Math.abs(dx);
    return `M${p1.x} ${p1.y} V${sy} L${p2.x} ${p2.y}`;
  }
  return `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`;
}

// Milestone tick-ring around a cleared node. Works for 5 or 20 ticks
// (tighter gap past 10 so a full 20-track still fits).
function boardTickRing(x, y, r, done, total) {
  if (!total) return "";
  let out = "";
  const gapDeg = total > 10 ? 6 : 14;
  const arc = 360 / total;
  for (let i = 0; i < total; i++) {
    const a0 = -90 + i * arc + gapDeg / 2, a1 = -90 + (i + 1) * arc - gapDeg / 2;
    const p = (a) => {
      const t = (a * Math.PI) / 180;
      return `${(x + r * Math.cos(t)).toFixed(2)} ${(y + r * Math.sin(t)).toFixed(2)}`;
    };
    const lit = i < done;
    out += `<path d="M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}" fill="none" stroke="${lit ? "#ffd76a" : "rgba(120,140,170,.28)"}" stroke-width="${lit ? 1.4 : 1}" stroke-linecap="round" ${lit ? 'filter="url(#board-glow)"' : ""}/>`;
  }
  return out;
}

// Build the full board SVG string for the current world. `nodes` is a
// per-level array of { level, state, best, done, total }.
function buildBoardSvg(world, nodes) {
  const pts = world.nodePos;
  const a = world.accent;
  const a2 = world.accent2;
  const R = 7.5;

  let svg = `<svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="board-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="1.1" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="board-vign" cx="50%" cy="45%" r="75%">
        <stop offset="60%" stop-color="transparent"/><stop offset="100%" stop-color="rgba(0,0,0,.55)"/>
      </radialGradient>
    </defs>`;

  // Decorative traces fade in together as the board powers on (M3).
  svg += `<g class="board-deco-enter">${boardDecoTraces(world.boardStyle, a)}</g>`;

  // Connectors between consecutive levels — lit once the FROM node is cleared.
  // Lit ones "draw in" (M3 entry flourish) so energy reads as flowing down
  // the board from the top; unlit ones just fade with the deco layer.
  for (let i = 0; i < pts.length - 1; i++) {
    const d = boardConnector(pts[i], pts[i + 1], world.boardStyle);
    const lit = nodes[i].state === "cleared";
    if (lit) {
      // pathLength="1" normalizes the draw-in dash regardless of path length.
      svg += `<path d="${d}" pathLength="1" fill="none" stroke="${a}" stroke-width="1.1" class="board-trace-draw" style="animation-delay:${70 + i * 55}ms" filter="url(#board-glow)"/>`;
      // Perpetual white energy pulse (no filter — it animates forever, so the
      // static glow of the base connector carries the bloom instead; M3 perf).
      svg += `<path d="${d}" fill="none" stroke="#ffffff" stroke-width=".7" opacity=".85" stroke-dasharray="1.5 38.5" class="trace-flow"/>`;
    } else {
      svg += `<path d="${d}" fill="none" stroke="rgba(90,110,140,.35)" stroke-width="0.8" stroke-dasharray="2 3" class="board-deco-enter"/>`;
    }
  }

  // Level node visuals — each ignites in sequence down the board (M3).
  nodes.forEach((nd, i) => {
    const { x, y } = pts[i];
    svg += `<g class="board-node-enter" style="animation-delay:${40 + i * 55}ms">`;
    if (nd.state === "locked") {
      svg += `<circle cx="${x}" cy="${y}" r="${R}" fill="#0a0f18" stroke="rgba(90,110,140,.5)" stroke-width=".8" stroke-dasharray="2 2"/>
        <text x="${x}" y="${y + 1.8}" text-anchor="middle" font-size="5" fill="rgba(120,140,170,.6)">🔒</text>`;
    } else if (nd.state === "frontier") {
      // Pulse ring carries no filter (it animates forever — M3 perf); the
      // inner node's static glow supplies the bloom.
      svg += `<circle cx="${x}" cy="${y}" r="${R + 3.4}" fill="none" stroke="${a}" stroke-width=".6" class="frontier-pulse"/>
        <circle cx="${x}" cy="${y}" r="${R}" fill="#0a1220" stroke="${a}" stroke-width="1.3" filter="url(#board-glow)"/>
        <text x="${x}" y="${y + 2.4}" text-anchor="middle" font-size="6.5" fill="${a}" filter="url(#board-glow)">${nd.n}</text>`;
    } else { // cleared
      svg += boardTickRing(x, y, R + 3.6, nd.done, nd.total);
      svg += `<circle cx="${x}" cy="${y}" r="${R}" fill="rgba(0,60,70,.5)" stroke="${a}" stroke-width="1.2" filter="url(#board-glow)"/>
        <circle cx="${x}" cy="${y}" r="${R - 2.4}" fill="${a}" opacity=".18"/>
        <text x="${x}" y="${y + 2.4}" text-anchor="middle" font-size="6.5" fill="#eaffff" filter="url(#board-glow)">${nd.n}</text>`;
      // ∞ pad wired off the lower-right; hot-pink glow once a best exists.
      const bx = x + R + 4.2, by = y + R + 2.5;
      svg += `<path d="M${x + R * 0.72} ${y + R * 0.72} L${bx - 2} ${by - 1.4}" stroke="${a}" stroke-width=".5" opacity=".6"/>
        <circle cx="${bx}" cy="${by}" r="3.4" fill="#0a1220" stroke="${nd.best > 0 ? "#ff7ccb" : a2}" stroke-width=".8" class="${nd.best > 0 ? "board-inf-live" : ""}" ${nd.best > 0 ? 'filter="url(#board-glow)"' : 'opacity=".75"'}/>
        <text x="${bx}" y="${by + 1.7}" text-anchor="middle" font-size="4.6" fill="${nd.best > 0 ? "#ffb3de" : a2}">∞</text>`;
    }
    svg += `</g>`;
  });

  // Vignette (below the hit layer, above the art).
  svg += `<rect x="0" y="0" width="100" height="130" fill="url(#board-vign)" pointer-events="none"/>`;

  // Invisible hit targets, painted last so they always receive taps. Every
  // node (including locked ones) opens the detail sheet (M2) — the sheet's
  // own PLAY/ENDLESS buttons decide what actually launches. Cleared nodes
  // get a second small target over the ∞ pad since it sits outside the
  // main node's hit radius.
  nodes.forEach((nd, i) => {
    const { x, y } = pts[i];
    svg += `<circle cx="${x}" cy="${y}" r="13" fill="rgba(0,0,0,0)" data-hit="node" data-i="${i}" style="cursor:pointer"/>`;
    if (nd.state === "cleared") {
      const bx = x + R + 4.2, by = y + R + 2.5;
      svg += `<circle cx="${bx}" cy="${by}" r="5" fill="rgba(0,0,0,0)" data-hit="node" data-i="${i}" style="cursor:pointer"/>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

function renderWorld() {
  el.shardsValue.textContent = String(getShards());

  const world = WORLDS[currentWorld];
  const unlocked = isWorldUnlocked(currentWorld);
  const { completedIds, levelById, pick } = menuCtx;

  // --- Header: name (+ lock accent), page dots, arrow states ---
  el.worldName.textContent = world.name;
  el.worldName.classList.toggle("locked", !unlocked);
  el.worldName.style.color = unlocked ? world.accent : "";
  el.worldDots.innerHTML = WORLDS.map(
    (_, i) => `<span class="dot${i === currentWorld ? " active" : ""}"></span>`
  ).join("");

  el.worldPrev.disabled = currentWorld === 0;
  const hasNext = currentWorld < WORLDS.length - 1;
  el.worldNext.disabled = !hasNext;
  // A next world that's still gated gets the gold "locked" arrow accent
  // (it's tappable — tapping previews it).
  el.worldNext.classList.toggle("locked", hasNext && !isWorldUnlocked(currentWorld + 1));

  // --- Derive per-node state from real progression ---
  // Frontier = first not-yet-cleared level of an UNLOCKED world; every node
  // of a locked world renders in the locked state (a preview).
  let frontierAssigned = false;
  const nodes = world.levelIds.map((id) => {
    const level = levelById.get(id);
    const done = !!level && completedIds.includes(id);
    let state;
    if (!unlocked) {
      state = "locked";
    } else if (done) {
      state = "cleared";
    } else if (!frontierAssigned) {
      state = "frontier";
      frontierAssigned = true;
    } else {
      state = "locked";
    }
    const milestones = done ? getEndlessMilestones(id) : [];
    const lockReason = state !== "locked"
      ? null
      : !unlocked
        ? `Clear all of ${WORLDS[currentWorld - 1].name} to unlock ${world.name}.`
        : "Clear the previous level to unlock.";
    return {
      level,
      n: level ? Number(id.slice(-3)) : "",
      state,
      milestones,
      done: milestones.filter((m) => m.claimed).length,
      total: milestones.length,
      best: done ? getBestEndlessWave(id) : 0,
      lockReason,
    };
  });

  // --- Render the board into #level-list (now the board host) ---
  el.levelList.classList.add("board-host");
  el.levelList.innerHTML = buildBoardSvg(world, nodes);

  if (!unlocked) {
    const note = document.createElement("div");
    note.className = "world-locked-note board-note";
    note.textContent =
      `LOCKED — clear all of ${WORLDS[currentWorld - 1].name} to unlock ${world.name}.`;
    el.levelList.appendChild(note);
  }

  // Wire taps: every node opens the detail sheet (M2); PLAY/ENDLESS inside
  // the sheet decide what actually launches.
  el.levelList.querySelectorAll("[data-hit]").forEach((hit) => {
    const nd = nodes[+hit.dataset.i];
    if (!nd || !nd.level) return;
    hit.addEventListener("click", () => openLevelSheet(nd, world, pick));
  });

  appendGlobalMenuButtons();
}

// Human reward text for a milestone, derived from its data (never hardcoded
// per CIRCUIT_MENU_DESIGN.md M0 — a future 20-entry track renders the same way).
function milestoneRewardText(reward) {
  if (reward.kind === "shards") return `&#9670; ${reward.amount}`;
  return reward.rarity === "singularity" ? "SINGULARITY" : `${reward.rarity.toUpperCase()} LOOT`;
}

// ---- Level detail bottom sheet (CIRCUIT_MENU_DESIGN.md M2) ----

function closeLevelSheet() {
  el.levelSheetOverlay.classList.add("hidden");
}
el.levelSheetOverlay.addEventListener("click", (e) => {
  if (e.target === el.levelSheetOverlay) closeLevelSheet();
});

function openLevelSheet(nd, world, pick) {
  const level = nd.level;
  const cleared = nd.state === "cleared";
  const locked = nd.state === "locked";

  const chips = [
    `<span class="level-chip ${cleared ? "on" : ""}">${cleared ? "&#10003; CLEARED" : locked ? "&#128274; LOCKED" : "NOT CLEARED"}</span>`,
    `<span class="level-chip ${cleared ? "on" : ""}">&#8734; ENDLESS ${cleared ? (nd.best > 0 ? `&mdash; BEST W${nd.best}` : "UNLOCKED") : "LOCKED"}</span>`,
  ];
  if (cleared) chips.push(`<span class="level-chip gold">&#9733; ${nd.done}/${nd.total} MILESTONES</span>`);

  let milestoneHtml;
  if (cleared) {
    const rows = nd.milestones.map((m) =>
      `<div class="level-mile ${m.claimed ? "done" : ""}">` +
      `<div class="tick"></div>` +
      `<span class="m-label">${escapeHtml(m.label)}</span>` +
      `<span class="m-reward">${milestoneRewardText(m.reward)}</span></div>`
    ).join("");
    milestoneHtml = `<div class="level-mile-head">ENDLESS MILESTONES</div>${rows}`;
  } else {
    milestoneHtml = `<p class="level-sheet-desc">${
      locked ? escapeHtml(nd.lockReason) : "Beat the campaign level to unlock Endless mode and its milestone rewards."
    }</p>`;
  }

  el.levelSheet.innerHTML =
    `<h2 style="color:${world.accent}">${escapeHtml(level.name.toUpperCase())}</h2>` +
    `<div class="level-sheet-tag">LEVEL ${nd.n} &mdash; ${escapeHtml(world.name)}</div>` +
    `<p class="level-sheet-desc">${escapeHtml(level.desc || "")}</p>` +
    `<div class="level-chip-row">${chips.join("")}</div>` +
    milestoneHtml +
    `<div class="level-sheet-actions">` +
    `<button class="level-sheet-btn play" id="level-sheet-play"${locked ? " disabled" : ""}>&#9654; PLAY</button>` +
    `<button class="level-sheet-btn endless" id="level-sheet-endless"${cleared ? "" : " disabled"}>&#8734; ENDLESS</button>` +
    `</div>`;

  el.levelSheetOverlay.classList.remove("hidden");

  if (!locked) {
    document.getElementById("level-sheet-play").addEventListener("click", () => {
      closeLevelSheet();
      pick(level, false);
    });
  }
  if (cleared) {
    document.getElementById("level-sheet-endless").addEventListener("click", () => {
      closeLevelSheet();
      pick(level, true);
    });
  }
}

// The account-wide entries. Pinned in their own footer (#menu-actions)
// BELOW the scrolling level list, so they stay visible no matter how many
// Endless rows the world has.
function appendGlobalMenuButtons() {
  el.menuActions.innerHTML = "";

  // SKILL TREE + TOWERS share a row to save vertical space.
  const topRow = document.createElement("div");
  topRow.className = "menu-actions-row";

  // Skill tree — with a point count so unspent points can't be missed.
  const points = getSkillPoints();
  const skillBtn = document.createElement("button");
  skillBtn.className = "level-button skill-entry";
  skillBtn.innerHTML =
    `<span>SKILLS</span>` +
    `<span class="${points > 0 ? "level-points" : "level-done"}">` +
    (points > 0 ? `● ${points}` : "—") +
    `</span>`;
  skillBtn.addEventListener("click", openSkillTree);
  topRow.appendChild(skillBtn);

  // TOWERS: merged tower guide + gear screen (GEAR_UI_DESIGN U3). One
  // entry, NEW badge carried over from the old GEAR button.
  const newCount = getPendingLoot().length + countUnseenStash();
  const stash = getStash().length;
  const towersBtn = document.createElement("button");
  towersBtn.className = "level-button skill-entry gear-entry";
  towersBtn.innerHTML =
    `<span>TOWERS</span>` +
    `<span class="${newCount ? "level-points" : "level-done"}">` +
    (newCount ? `${newCount} NEW` : `${stash}/${LOOT.stash.stashSize}`) +
    `</span>`;
  towersBtn.addEventListener("click", () => openGearPanel());
  topRow.appendChild(towersBtn);

  const storeBtn = document.createElement("button");
  storeBtn.className = "level-button skill-entry store-entry";
  storeBtn.innerHTML = `<span>STORE</span><span class="level-done">◆ ${getShards()}</span>`;
  storeBtn.addEventListener("click", openStorePanel);
  topRow.appendChild(storeBtn);

  // Leaderboard — only when a backend is configured (config.js
  // LEADERBOARD). Hidden otherwise so we never ship a dead button.
  if (lbEnabled()) {
    const lbBtn = document.createElement("button");
    lbBtn.className = "level-button skill-entry";
    lbBtn.innerHTML = `<span>BOARD</span><span class="level-done">🏆</span>`;
    lbBtn.addEventListener("click", () => openLeaderboard(menuCtx.levels));
    topRow.appendChild(lbBtn);
  }
  el.menuActions.appendChild(topRow);

  // Reset all progress — two-tap confirm, then reload clean.
  const resetBtn = document.createElement("button");
  resetBtn.className = "menu-reset";
  resetBtn.textContent = "RESET ALL PROGRESS";
  resetBtn.addEventListener("click", () => {
    if (resetBtn.classList.contains("confirming")) {
      resetProgress();
      location.reload();
    } else {
      resetBtn.classList.add("confirming");
      resetBtn.textContent = "WIPE ROSTER, SKILLS & LEVELS? TAP AGAIN";
      setTimeout(() => {
        resetBtn.classList.remove("confirming");
        resetBtn.textContent = "RESET ALL PROGRESS";
      }, 3000);
    }
  });
  el.menuActions.appendChild(resetBtn);
}

// Arrow + swipe navigation, bound once (state lives in menuCtx/currentWorld).
el.worldPrev.addEventListener("click", () => navigateWorld(-1));
el.worldNext.addEventListener("click", () => navigateWorld(1));

// Horizontal swipe on the overlay pages between worlds. Kept distinct
// from the level list's vertical scroll: only a clearly-horizontal drag
// counts, so scrolling the list never accidentally flips the world.
(function bindWorldSwipe() {
  let x0 = null;
  let y0 = null;
  el.levelOverlay.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) { x0 = null; return; }
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true }
  );
  el.levelOverlay.addEventListener(
    "touchend",
    (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        navigateWorld(dx < 0 ? 1 : -1); // swipe left → next, right → prev
      }
    },
    { passive: true }
  );
})();

// ---------- Speed controls ----------
// Half / pause / double. Tapping an active speed button returns to 1x;
// tapping pause again resumes. onChange(factor, paused) fires on every
// state change so main.js can scale (or freeze) the game clock.

export function initSpeedControls(onChange) {
  const slow = document.getElementById("speed-slow");
  const pause = document.getElementById("speed-pause");
  const fast = document.getElementById("speed-fast");
  let factor = 1;
  let paused = false;

  function apply() {
    slow.classList.toggle("active", factor < 1 && !paused);
    fast.classList.toggle("active", factor > 1 && !paused);
    // Active buttons show the current multiplier instead of the arrow.
    slow.innerHTML =
      factor === 0.5 ? "&#189;&#215;" : factor === 0.25 ? "&#188;&#215;" : "&#9664;";
    fast.innerHTML =
      factor === 2 ? "2&#215;" : factor === 4 ? "4&#215;" : "&#9654;";
    pause.classList.toggle("active", paused);
    pause.innerHTML = paused ? "&#9654;" : "&#10074;&#10074;"; // play / pause glyph
    onChange(factor, paused);
  }

  // Each arrow steps further in its direction; one more tap wraps to 1x.
  slow.addEventListener("click", () => {
    factor = factor === 0.5 ? 0.25 : factor === 0.25 ? 1 : 0.5;
    paused = false;
    apply();
  });
  fast.addEventListener("click", () => {
    factor = factor === 2 ? 4 : factor === 4 ? 1 : 2;
    paused = false;
    apply();
  });
  pause.addEventListener("click", () => {
    paused = !paused;
    apply();
  });
}

// ---------- Tower guide overlay ----------
// Explains the per-class level-up specialties and lists the player's
// roster with earned levels/kills. Shown once at level 2, and always
// reachable from the main menu.

const SPECIALTY_TEXT = {
  laser: "Specialty: extra RANGE for every level ever reached",
  pulse: "Specialty: bigger EXPLOSIONS for every level ever reached",
  slow: "Specialty: FASTER FIRING for every level ever reached",
  railgun: "Specialty: extra DAMAGE for every level ever reached",
  rocket: "Specialty: BIGGER BLASTS for every level ever reached",
};

// One-line role hint per class — what each tower is FOR.
const ROLE_TEXT = {
  laser: "Role: cheap, fast single-target. Great vs Fast; weak vs Armored.",
  pulse: "Role: splash damage — clears Splitters & swarms. Pricey to level.",
  slow: "Role: support — slows enemies AND makes them take +30% damage.",
  railgun: "Role: piercing line-shot. Aim it down a straight lane. Beats Armored & Regenerators.",
  rocket: "Role: global-range artillery. Slow but hits anywhere; blasts Bosses & Splitter clusters. Weak vs Fast.",
};

// Damage-type label per tower, for the enemy cheat-sheet.
const TYPE_LABEL = {
  energy: "Laser", pulse: "Pulse", control: "Slow", rail: "Railgun", blast: "Rocket",
};

// Build "weak to / resists" text for an enemy from its damageMult map.
function counterText(def) {
  const m = def.damageMult;
  if (!m) return "No special weaknesses.";
  const weak = [], resist = [];
  for (const [dtype, mult] of Object.entries(m)) {
    const label = TYPE_LABEL[dtype] || dtype;
    if (mult > 1) weak.push(label);
    else if (mult < 1) resist.push(label);
  }
  const parts = [];
  if (weak.length) parts.push(`Weak to ${weak.join(", ")}`);
  if (resist.length) parts.push(`resists ${resist.join(", ")}`);
  return parts.length ? parts.join(" · ") : "No special weaknesses.";
}

// Class list + enemy cheat-sheet, folded into the `?` guide sheet (used to
// be the standalone Tower Guide overlay — GEAR_UI_DESIGN U3 merged it away;
// the roster listing itself is dropped here since the TOWERS tab already
// shows every tower's card).
function guideExtrasHtml() {
  let html = `<div class="tower-section">TOWER CLASSES</div>`;
  for (const [type, def] of Object.entries(TOWERS)) {
    const locked = !isTowerUnlocked(type);
    const rangeStr = def.baseRange >= 50 ? "GLOBAL" : def.baseRange;
    const stats =
      `DMG ${def.baseDamage} · RANGE ${rangeStr} · ` +
      `${def.baseFireRate}s/shot · $${def.baseCost}` +
      (locked ? ` · LOCKED (${def.unlockLabel || "locked"})` : "");
    html +=
      `<div class="skill-row"><div class="skill-text">` +
      `<span class="skill-name" style="color:${def.color}">${def.name.toUpperCase()}</span>` +
      `<span class="skill-desc">${stats}</span>` +
      `<span class="skill-desc">${ROLE_TEXT[type] || ""}</span>` +
      `<span class="skill-desc">${SPECIALTY_TEXT[type] || ""}</span>` +
      `</div></div>`;
  }

  // Enemy cheat-sheet: what beats what (drives combo choices per level).
  html += `<div class="tower-section">KNOW YOUR ENEMY</div>`;
  for (const [, edef] of Object.entries(ENEMIES)) {
    if (edef.name === "Splitling") continue; // covered by Splitter
    html +=
      `<div class="skill-row"><div class="skill-text">` +
      `<span class="skill-name" style="color:${edef.color}">${edef.name.toUpperCase()}</span>` +
      `<span class="skill-desc">${counterText(edef)}</span>` +
      `</div></div>`;
  }
  return html;
}

// ---------- Gear overlay ----------

function itemUniqueName(item) {
  if (!item || !item.unique) return "";
  const named = LOOT.gen.uniques.named.find((u) => u.id === item.unique);
  const minor = LOOT.gen.uniques.minor.find((u) => u.id === item.unique);
  return (named || minor || {}).name || item.unique;
}

function itemTitle(item) {
  const slot = item.slot.toUpperCase();
  const lock = item.towerType ? `${TOWERS[item.towerType].rosterPrefix.toUpperCase()}-ONLY` : "UNIVERSAL";
  const unique = itemUniqueName(item);
  return unique ? `${unique.toUpperCase()} ${slot}` : `${item.rarity.toUpperCase()} ${slot} ${lock}`;
}

function itemReqText(item) {
  return item.reqMastery ? `REQ STAR ${item.reqMastery}` : `REQ LV ${item.reqLevel}`;
}

function compatibleRoster(item) {
  return [...getProgress().roster].filter((rec) => canEquipItem(rec, item).ok);
}

// ---- Tile components shared by both tabs + the bottom sheet ----

const SLOT_LABEL = { optic: "OPTIC", emitter: "EMITTER", capacitor: "CAPACITOR", frame: "FRAME" };
// Raw hex (not var()) so JS can append alpha for glow shadows below.
const RARITY_COLOR = {
  common: "#b7c0d5", enhanced: "#4affa1", rare: "#35e0ff",
  prismatic: "#ff3fd4", singularity: "#ffe24a",
};
const RARITY_CLASS = { common: "rc", enhanced: "re", rare: "rr", prismatic: "rp", singularity: "rs" };
const RARITY_ORDER = ["singularity", "prismatic", "rare", "enhanced", "common"];

let gearTab = "towers";
let gearFilterSlot = null;
let gearFilterRarity = null;
// One-shot flash target for the "brief flash on the slot tile" pizzazz
// (U4 §4): set right before a re-render, consumed (and cleared) by the
// next renderTowersTab() call so it only flashes once.
let equipFlashTarget = null;

// Neon slot glyph as an inline SVG string (stroke-only, no fills — matches
// the approved mockup's vector-outline look). No glow filter here (the
// tile's own box-shadow provides that) — an SVG <filter> would need a
// unique id per tile, which repeated grids make awkward.
function slotGlyph(slot, color) {
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

function affixDef(stat) {
  for (const slot of GEAR_SLOTS) {
    const def = LOOT.gen.slots[slot].find((a) => a.stat === stat);
    if (def) return def;
  }
  return null;
}

// Config affix names carry a " %" or " +N" suffix for documentation
// (config.js), which would duplicate the "+N%" already shown next to it.
function affixLabel(def, stat) {
  return ((def && def.name) || stat).replace(/ %| \+N$/, "");
}

// One line summarizing an item ("◈ Cascade Rail / Damage +28% / Projectile
// Speed +31%"), for picker rows and gear-bonus lines.
function itemAffixSummary(item) {
  const unique = itemUniqueName(item);
  const parts = unique ? [`◈ ${unique}`] : [];
  for (const a of item.affixes || []) {
    const def = affixDef(a.stat);
    parts.push(`${affixLabel(def, a.stat)} +${a.value}${def && def.int ? "" : "%"}`);
  }
  return parts.join(" / ");
}

// Full affix rows for the item bottom sheet (one row per affix + a unique
// callout row when present).
function itemAffixRowsHtml(item) {
  const rows = [];
  const unique = itemUniqueName(item);
  if (unique) {
    const cls = item.rarity === "singularity" ? "unique" : "uniqueP";
    const kind = item.rarity === "singularity" ? "UNIQUE" : "MINOR";
    rows.push(`<div class="gear-affix ${cls}"><span>${kind}: ${escapeHtml(unique)}</span></div>`);
  }
  for (const a of item.affixes || []) {
    const def = affixDef(a.stat);
    rows.push(
      `<div class="gear-affix"><span>${escapeHtml(affixLabel(def, a.stat))}</span>` +
      `<span class="val">+${a.value}${def && def.int ? "" : "%"}</span></div>`
    );
  }
  return `<div class="gear-affix-list">${rows.join("")}</div>`;
}

// A grid tile for the STASH tab (5-wide), the triage strip, or the STORE
// grid. `opts.stashId`/`opts.pendingId`/`opts.storeId` sets the data
// attribute the click delegate reads. `opts.priceTag` (STORE only) shows a
// Shard price in the corner instead of the lock-dot, dimmed + red when
// `opts.unaffordable` is set.
function tileHtml(item, opts = {}) {
  const color = RARITY_COLOR[item.rarity];
  const lockLetter = item.towerType ? TOWERS[item.towerType].prefix : "";
  const isNew = opts.stashId && !isItemSeen(item.id);
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
    (isNew ? `<span class="new-tag">NEW</span>` : "") +
    `</button>`;
}

// ---- Drop-reveal sequence (U4 pizzazz) ----
// Called by main.js right before the win/loss overlay, if the battle that
// just ended granted loot (game.lootResult.placements + any Endless
// milestone loot). One rarity-burst card per item, tap to advance; calls
// `onDone` once the player has stepped through all of them (or immediately
// if there's nothing to show).

function revealDestHtml(p) {
  if (p.dest === "equipped") return `AUTO-EQUIPPED &rarr; <b>${escapeHtml(p.towerName)}</b>`;
  if (p.dest === "stash") return "&rarr; STASH";
  return "&rarr; UNCLAIMED (stash was full)";
}

function renderRevealCard(p, index, total, tapLabel = "TAP TO CONTINUE") {
  const item = p.item;
  const color = RARITY_COLOR[item.rarity];
  el.dropReveal.innerHTML =
    `<div class="reveal-burst" style="background: radial-gradient(circle, ${color}66, transparent 65%)"></div>` +
    `<div class="reveal-card ${RARITY_CLASS[item.rarity]}" style="border:1px solid ${color}; box-shadow: inset 0 0 24px ${color}44, 0 0 34px ${color}55">` +
    slotGlyph(item.slot, color) +
    `</div>` +
    `<div id="reveal-name" style="color:${color}; text-shadow:0 0 14px ${color}88">${escapeHtml(itemTitle(item))}</div>` +
    `<div id="reveal-sub">${item.rarity.toUpperCase()} &middot; ${item.slot.toUpperCase()}</div>` +
    `<div id="reveal-dest">${revealDestHtml(p)}</div>` +
    (total > 1 ? `<div id="reveal-progress">ITEM ${index + 1}/${total}</div>` : "") +
    `<div id="reveal-tap">${tapLabel}</div>`;
  el.dropReveal.classList.remove("hidden");
}

// On-demand single-item viewer for the results-screen loot grid: tapping a
// tile pops the same rarity-burst card as the old sequence, tap to dismiss
// back to the results overlay. (The forced one-by-one sequence is gone —
// the grid replaces it — but the card visual is reused here.)
export function showItemDetail(placement) {
  if (!placement) return;
  el.dropReveal.onclick = () => {
    el.dropReveal.classList.add("hidden");
    el.dropReveal.innerHTML = "";
    el.dropReveal.onclick = null;
  };
  renderRevealCard(placement, 0, 1, "TAP TO CLOSE");
}

export function showDropReveal(placements, onDone) {
  const items = (placements || []).filter(Boolean);
  if (!items.length) {
    onDone();
    return;
  }
  let i = 0;
  el.dropReveal.onclick = () => {
    i += 1;
    if (i >= items.length) {
      el.dropReveal.classList.add("hidden");
      el.dropReveal.innerHTML = "";
      el.dropReveal.onclick = null;
      onDone();
      return;
    }
    renderRevealCard(items[i], i, items.length);
  };
  renderRevealCard(items[0], 0, items.length);
}

// ---- Bottom sheet plumbing ----

function openSheet() {
  el.gearSheetOverlay.classList.remove("hidden");
}
function closeSheet() {
  el.gearSheetOverlay.classList.add("hidden");
}
el.gearSheetOverlay.addEventListener("click", (e) => {
  if (e.target === el.gearSheetOverlay) closeSheet();
});

function findEquippedItem(towerName, slot) {
  const rec = getProgress().roster.find((r) => r.name === towerName);
  if (!rec) return null;
  const item = normalizeGear(rec.gear)[slot];
  return item ? { rec, item } : null;
}

function openItemSheet({ stashId, towerName, slot }) {
  let item, equippedOn = null;
  if (stashId) {
    item = getStash().find((i) => i.id === stashId);
    if (!item) return;
    markItemSeen(item.id);
  } else {
    const found = findEquippedItem(towerName, slot);
    if (!found) return;
    item = found.item;
    equippedOn = found.rec;
  }

  const color = RARITY_COLOR[item.rarity];
  const lockTag = item.towerType ? `${TOWERS[item.towerType].rosterPrefix.toUpperCase()}-ONLY` : "UNIVERSAL";
  const sub =
    `${item.rarity.toUpperCase()} &middot; ${item.slot.toUpperCase()} &middot; ${lockTag} &middot; ` +
    `${itemReqText(item)} &middot; ILVL ${item.ilvl}` +
    (equippedOn
      ? `<br>EQUIPPED ON <span style="color:${TOWERS[equippedOn.type].color}">${escapeHtml(equippedOn.name)}</span>`
      : "");

  const needsConfirm = item.rarity === "prismatic" || item.rarity === "singularity";
  const sellVal = LOOT.gen.sellValues[item.rarity] || 0;
  const actionsHtml = equippedOn
    ? `<div class="gear-sheet-actions"><button class="gear-sheet-btn" id="sheet-unequip">UNEQUIP</button></div>`
    : `<div class="gear-sheet-actions">` +
      `<button class="gear-sheet-btn" id="sheet-equip">EQUIP</button>` +
      `<button class="gear-sheet-btn sell" id="sheet-sell">SELL &#9670;${sellVal}</button>` +
      `</div>`;

  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${color}; text-shadow:0 0 10px ${color}55">` +
    `${slotGlyph(item.slot, color)} ${escapeHtml(itemTitle(item))}</div>` +
    `<div class="gear-sheet-sub">${sub}</div>` +
    itemAffixRowsHtml(item) +
    actionsHtml;
  openSheet();

  if (equippedOn) {
    document.getElementById("sheet-unequip").addEventListener("click", () => {
      unequipToStash(equippedOn.name, item.slot);
      closeSheet();
      renderGearPanel();
    });
  } else {
    document.getElementById("sheet-equip").addEventListener("click", () => openEquipTargetSheet(item));
    const sellBtn = document.getElementById("sheet-sell");
    sellBtn.addEventListener("click", () => {
      if (needsConfirm && !sellBtn.classList.contains("armed")) {
        sellBtn.classList.add("armed", "danger");
        sellBtn.textContent = "SELL? TAP AGAIN";
        return;
      }
      sellStashItem(item.id);
      closeSheet();
      renderGearPanel();
    });
  }
}

function openPendingItemSheet(itemId) {
  const item = getPendingLoot().find((i) => i.id === itemId);
  if (!item) return;
  const color = RARITY_COLOR[item.rarity];
  const sellVal = LOOT.gen.sellValues[item.rarity] || 0;
  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${color}; text-shadow:0 0 10px ${color}55">` +
    `${slotGlyph(item.slot, color)} ${escapeHtml(itemTitle(item))}</div>` +
    `<div class="gear-sheet-sub">${item.rarity.toUpperCase()} &middot; ${item.slot.toUpperCase()} &middot; ` +
    `UNCLAIMED (STASH WAS FULL)</div>` +
    itemAffixRowsHtml(item) +
    `<div class="gear-sheet-actions"><button class="gear-sheet-btn sell" id="sheet-sell-pending">SELL &#9670;${sellVal}</button></div>`;
  openSheet();
  document.getElementById("sheet-sell-pending").addEventListener("click", () => {
    sellPendingItem(item.id);
    closeSheet();
    renderGearPanel();
  });
}

function openPickerSheet(towerName, slot) {
  const rec = getProgress().roster.find((r) => r.name === towerName);
  if (!rec) return;
  const def = TOWERS[rec.type];
  const candidates = getStash()
    .filter((it) => it.slot === slot && canEquipItem(rec, it).ok)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

  const rows = candidates.length
    ? candidates.map((it) => {
        const color = RARITY_COLOR[it.rarity];
        return `<button class="gear-picker-row" data-equip-item="${it.id}">` +
          slotGlyph(slot, color) +
          `<span class="pr-main"><span class="pr-name" style="color:${color}">${escapeHtml(itemTitle(it))}</span>` +
          `<span class="pr-sub">${escapeHtml(itemAffixSummary(it))}</span></span>` +
          `<span class="pr-tag">${it.towerType ? TOWERS[it.towerType].rosterPrefix.toUpperCase() : "UNIV"}</span></button>`;
      }).join("")
    : `<div class="gear-empty-note">Nothing compatible in the stash.</div>`;

  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${def.color}">` +
    `${slotGlyph(slot, def.color)} ${escapeHtml(rec.name)} &middot; ${SLOT_LABEL[slot]}</div>` +
    `<div class="gear-sheet-sub">EMPTY SLOT &middot; PICK FROM STASH</div>` +
    `<div class="gear-picker-label">${candidates.length ? "COMPATIBLE IN STASH" : "NOTHING COMPATIBLE"}</div>` +
    rows +
    `<div class="gear-sheet-actions" style="margin-top:6px"><button class="gear-sheet-btn danger" id="sheet-cancel">CANCEL</button></div>`;
  openSheet();
  document.getElementById("sheet-cancel").addEventListener("click", closeSheet);
  el.gearSheet.querySelectorAll("[data-equip-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      equipStashItem(rec.name, btn.dataset.equipItem);
      equipFlashTarget = { towerName: rec.name, slot };
      closeSheet();
      renderGearPanel();
    });
  });
}

function openEquipTargetSheet(item) {
  const color = RARITY_COLOR[item.rarity];
  const targets = compatibleRoster(item);
  const rows = targets.length
    ? targets.map((rec) => {
        const def = TOWERS[rec.type];
        const current = normalizeGear(rec.gear)[item.slot];
        const rank = gearMasteryRankFor(rec.xp);
        return `<button class="gear-picker-row${current ? " current" : ""}" data-target-tower="${escapeHtml(rec.name)}">` +
          `<span class="pr-main"><span class="pr-name" style="color:${def.color}">${escapeHtml(rec.name)} ` +
          `<span style="color:var(--text-dim); font-weight:400">LV ${rec.maxLevel} &middot; &#9733;${rank}</span></span>` +
          `<span class="pr-sub">${current
            ? `swaps out: <span style="color:${RARITY_COLOR[current.rarity]}">${escapeHtml(itemTitle(current))}</span>`
            : "empty slot"}</span></span></button>`;
      }).join("")
    : `<div class="gear-empty-note">No eligible tower yet — needs &#9733;1 MASTERY and a type match.</div>`;

  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${color}">${slotGlyph(item.slot, color)} EQUIP ${escapeHtml(itemTitle(item))}</div>` +
    `<div class="gear-sheet-sub">PICK A TOWER &mdash; CURRENT ${item.slot.toUpperCase()} SHOWN</div>` +
    rows +
    `<div class="gear-sheet-actions" style="margin-top:6px"><button class="gear-sheet-btn danger" id="sheet-cancel">CANCEL</button></div>`;
  openSheet();
  document.getElementById("sheet-cancel").addEventListener("click", closeSheet);
  el.gearSheet.querySelectorAll("[data-target-tower]").forEach((btn) => {
    btn.addEventListener("click", () => {
      equipStashItem(btn.dataset.targetTower, item.id);
      equipFlashTarget = { towerName: btn.dataset.targetTower, slot: item.slot };
      closeSheet();
      renderGearPanel();
    });
  });
}

function openTowerStatSheet(towerName) {
  const rec = getProgress().roster.find((r) => r.name === towerName);
  if (!rec) return;
  const def = TOWERS[rec.type];
  const stats = careerStatsFor(rec);
  const gear = normalizeGear(rec.gear);
  const bonuses = GEAR_SLOTS.map((slot) => gear[slot]).filter(Boolean).map((item) => {
    const color = RARITY_COLOR[item.rarity];
    return `<div class="gear-bonus-line" style="border-color:${color}">` +
      `<span class="src" style="color:${color}">${item.slot.toUpperCase()} &middot; ${escapeHtml(itemTitle(item))}</span>` +
      `${escapeHtml(itemAffixSummary(item))}</div>`;
  }).join("");

  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${def.color}; text-shadow:0 0 10px ${def.color}55">${escapeHtml(rec.name)}</div>` +
    `<div class="gear-sheet-sub">LV ${rec.maxLevel} &middot; ` +
    `<span style="color:var(--neon-yellow)">&#9733;${stats.masteryRank} MASTERY</span> &middot; ${rec.kills} KILLS</div>` +
    `<div class="gear-stat-grid">` +
    `<div class="gear-stat-box"><div class="k">DAMAGE</div><div class="v">${Math.round(stats.damage)}` +
    (stats.masteryPct ? `<small>+${stats.masteryPct}%</small>` : "") + `</div></div>` +
    `<div class="gear-stat-box"><div class="k">FIRE RATE</div><div class="v">${stats.fireRate.toFixed(1)}/s</div></div>` +
    `<div class="gear-stat-box"><div class="k">DPS</div><div class="v" style="color:${def.color}">${Math.round(stats.dps)}</div></div>` +
    `<div class="gear-stat-box"><div class="k">RANGE</div><div class="v">${def.baseRange >= 50 ? "GLOBAL" : stats.range.toFixed(1)}</div></div>` +
    `</div>` +
    `<div class="gear-picker-label">PERMANENT BONUSES</div>` +
    `<div class="gear-bonus-line" style="border-color:var(--neon-yellow)">` +
    `<span class="src">MASTERY &#9733;${stats.masteryRank}</span>+${stats.masteryPct}% damage</div>` +
    (stats.specialtyLabel
      ? `<div class="gear-bonus-line" style="border-color:${def.color}"><span class="src">SPECIALTY</span>` +
        `${escapeHtml(stats.specialtyLabel)} (+${stats.specialtyPct}%)</div>`
      : "") +
    (bonuses ? `<div class="gear-picker-label" style="margin-top:12px">GEAR BONUSES</div>${bonuses}` : "") +
    `<div class="gear-sheet-actions" style="margin-top:12px"><button class="gear-sheet-btn" id="sheet-close">CLOSE</button></div>`;
  openSheet();
  document.getElementById("sheet-close").addEventListener("click", closeSheet);
}

export function openGearHelpSheet() {
  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:var(--neon-yellow)">TOWERS &amp; GEAR GUIDE</div>` +
    `<div class="gear-guide-text">Every level-up improves damage, range and fire rate — and each ` +
    `class has a permanent SPECIALTY that follows its career-best level forever, even before ` +
    `re-upgrading a redeployed veteran. Past level 5, XP keeps counting: every &#9733; MASTERY rank ` +
    `earned is a permanent damage bonus — grinding earlier levels makes towers stronger. A tower ` +
    `can't equip anything NEW until it reaches &#9733;1 MASTERY (gear already worn before that keeps ` +
    `working). Tap a tower's name for its full stat sheet, an empty slot to equip from the stash, or ` +
    `a filled slot to inspect or unequip.</div>` +
    guideExtrasHtml() +
    `<div class="gear-sheet-actions"><button class="gear-sheet-btn" id="sheet-close">CLOSE</button></div>`;
  openSheet();
  document.getElementById("sheet-close").addEventListener("click", closeSheet);
}
el.gearHelp.addEventListener("click", openGearHelpSheet);

// ---- TOWERS tab ----

function eligibleGearTowers() {
  return [...getProgress().roster]
    .filter((rec) => gearMasteryRankFor(rec.xp) >= (LOOT.equipGate?.minMastery ?? 1))
    .sort((a, b) => gearMasteryRankFor(b.xp) - gearMasteryRankFor(a.xp) || b.maxLevel - a.maxLevel);
}

function lockedGearTowers() {
  return [...getProgress().roster]
    .filter((rec) => gearMasteryRankFor(rec.xp) < (LOOT.equipGate?.minMastery ?? 1))
    .sort((a, b) => b.maxLevel - a.maxLevel || b.xp - a.xp);
}

let lockedListOpen = false;

function renderTowersTab() {
  const roster = eligibleGearTowers();
  const locked = lockedGearTowers();
  const lockedCount = locked.length;

  let html = roster.length
    ? roster.map((rec) => {
        const def = TOWERS[rec.type];
        const rank = gearMasteryRankFor(rec.xp);
        const gear = normalizeGear(rec.gear);
        return `<div class="tower-card">` +
          `<button class="tower-card-head" data-tower="${escapeHtml(rec.name)}">` +
          `<span class="tower-card-name" style="color:${def.color}">${escapeHtml(rec.name)}</span>` +
          `<span class="tower-card-meta">LV ${rec.maxLevel} &middot; <span class="star">&#9733;${rank}</span> ` +
          `<span class="chev">&rsaquo;</span></span></button>` +
          `<div class="slot-row">` +
          GEAR_SLOTS.map((slot) => {
            const item = gear[slot];
            if (!item) {
              return `<button class="gear-tile empty" data-picker-tower="${escapeHtml(rec.name)}" data-picker-slot="${slot}">` +
                slotGlyph(slot, "#5a668f") + `<span class="tile-label">${SLOT_LABEL[slot]}</span></button>`;
            }
            const justEquipped = equipFlashTarget &&
              equipFlashTarget.towerName === rec.name && equipFlashTarget.slot === slot;
            return `<button class="gear-tile filled ${RARITY_CLASS[item.rarity]}${justEquipped ? " just-equipped" : ""}" data-item-tower="${escapeHtml(rec.name)}" data-item-slot="${slot}">` +
              slotGlyph(slot, RARITY_COLOR[item.rarity]) +
              `<span class="tile-label" style="color:${RARITY_COLOR[item.rarity]}">${SLOT_LABEL[slot]}</span></button>`;
          }).join("") +
          `</div></div>`;
      }).join("")
    : `<div class="gear-empty">No towers have reached &#9733;1 MASTERY yet — keep playing to unlock gear slots.</div>`;

  if (lockedCount > 0) {
    html += `<button class="gear-locked-note" id="gear-locked-toggle">` +
      `${lockedCount} more tower${lockedCount === 1 ? "" : "s"} unlock gear at <b>&#9733;1 MASTERY</b>` +
      `<span class="chev">${lockedListOpen ? "&#9662;" : "&rsaquo;"}</span></button>`;
    if (lockedListOpen) {
      html += `<div id="gear-locked-list">` + locked.map((rec) => {
        const def = TOWERS[rec.type];
        const rank = gearMasteryRankFor(rec.xp);
        return `<button class="skill-row locked-tower-row" data-tower="${escapeHtml(rec.name)}">` +
          `<div class="skill-text">` +
          `<span class="skill-name" style="color:${def.color}">${escapeHtml(rec.name)}</span>` +
          `<span class="skill-desc">LV ${rec.maxLevel} &middot; &#9733;${rank}</span>` +
          `</div></button>`;
      }).join("") + `</div>`;
    }
  }
  el.gearViewTowers.innerHTML = html;
  equipFlashTarget = null; // one-shot: consumed by this render

  const lockedToggle = document.getElementById("gear-locked-toggle");
  if (lockedToggle) {
    lockedToggle.addEventListener("click", () => {
      lockedListOpen = !lockedListOpen;
      renderGearPanel();
    });
  }
  el.gearViewTowers.querySelectorAll("[data-tower]").forEach((btn) => {
    btn.addEventListener("click", () => openTowerStatSheet(btn.dataset.tower));
  });
  el.gearViewTowers.querySelectorAll("[data-picker-tower]").forEach((btn) => {
    btn.addEventListener("click", () => openPickerSheet(btn.dataset.pickerTower, btn.dataset.pickerSlot));
  });
  el.gearViewTowers.querySelectorAll("[data-item-tower]").forEach((btn) => {
    btn.addEventListener("click", () => openItemSheet({ towerName: btn.dataset.itemTower, slot: btn.dataset.itemSlot }));
  });
}

// ---- STASH tab ----

function buildGearFilters() {
  const box = document.getElementById("gear-filters");
  if (!box) return;
  box.innerHTML =
    GEAR_SLOTS.map((s) => `<button class="gear-chip ${gearFilterSlot === s ? "on" : ""}" data-filter-slot="${s}">${SLOT_LABEL[s]}</button>`).join("") +
    RARITY_ORDER.slice().reverse().map((r) => {
      const on = gearFilterRarity === r;
      return `<button class="gear-chip ${on ? "on" : ""}" style="${on ? `color:${RARITY_COLOR[r]};border-color:${RARITY_COLOR[r]}` : ""}" data-filter-rarity="${r}">${r.toUpperCase()}</button>`;
    }).join("");
  box.querySelectorAll("[data-filter-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gearFilterSlot = gearFilterSlot === btn.dataset.filterSlot ? null : btn.dataset.filterSlot;
      renderGearPanel();
    });
  });
  box.querySelectorAll("[data-filter-rarity]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gearFilterRarity = gearFilterRarity === btn.dataset.filterRarity ? null : btn.dataset.filterRarity;
      renderGearPanel();
    });
  });
}

function renderStashTab() {
  const stash = getStash();
  const pending = getPendingLoot();
  let html = "";

  if (pending.length) {
    html += `<div id="gear-triage">` +
      `<div class="gear-triage-title">${pending.length} DROP${pending.length === 1 ? "" : "S"} UNCLAIMED &mdash; STASH IS FULL</div>` +
      `<div class="gear-triage-grid">${pending.map((item) => tileHtml(item, { pendingId: item.id })).join("")}</div>` +
      `<div class="gear-actions-row">` +
      `<button class="gear-action" id="triage-claim"${stashSlotsFree() <= 0 ? " disabled" : ""}>CLAIM (${stashSlotsFree()} FREE)</button>` +
      `<button class="gear-action danger" id="triage-leave">LEAVE DROPS</button>` +
      `</div></div>`;
  }

  const sorted = stash.slice().sort((a, b) =>
    RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || b.ilvl - a.ilvl);
  const shown = sorted.filter((it) =>
    (!gearFilterSlot || it.slot === gearFilterSlot) && (!gearFilterRarity || it.rarity === gearFilterRarity));

  html +=
    `<div class="gear-stash-header"><span class="gear-stash-count">${shown.length} ITEM${shown.length === 1 ? "" : "S"}</span>` +
    `<span class="gear-sort-note">SORTED: RARITY &#9662;</span></div>` +
    `<div id="gear-filters"></div>` +
    (gearFilterRarity && shown.length
      ? `<div class="gear-sellall-row"><button class="gear-action" id="gear-sellall">SELL ALL ${gearFilterRarity.toUpperCase()} (${shown.length})</button></div>`
      : "") +
    `<div id="gear-stash-grid">${shown.length
      ? shown.map((item) => tileHtml(item, { stashId: item.id })).join("")
      : `<div class="gear-grid-empty">${stash.length ? "NO MATCHING GEAR" : "No stored gear yet. Every battle now grants at least one drop."}</div>`
    }</div>`;

  el.gearViewStash.innerHTML = html;
  buildGearFilters();

  if (pending.length) {
    document.getElementById("triage-claim").addEventListener("click", () => { claimPendingLoot(); renderGearPanel(); });
    const leaveBtn = document.getElementById("triage-leave");
    leaveBtn.addEventListener("click", () => {
      if (leaveBtn.classList.contains("confirming")) {
        discardPendingLoot();
        renderGearPanel();
      } else {
        leaveBtn.classList.add("confirming");
        leaveBtn.textContent = "LOSE THEM? TAP AGAIN";
      }
    });
  }
  const sellAllBtn = document.getElementById("gear-sellall");
  if (sellAllBtn) {
    sellAllBtn.addEventListener("click", () => {
      if (sellAllBtn.classList.contains("confirming")) {
        sellAllStashRarity(gearFilterRarity);
        gearFilterRarity = null;
        renderGearPanel();
      } else {
        sellAllBtn.classList.add("confirming");
        sellAllBtn.textContent = "SELL ALL? TAP AGAIN";
      }
    });
  }
  el.gearViewStash.querySelectorAll("[data-stash-item]").forEach((tile) => {
    tile.addEventListener("click", () => openItemSheet({ stashId: tile.dataset.stashItem }));
  });
  el.gearViewStash.querySelectorAll("[data-pending-item]").forEach((tile) => {
    tile.addEventListener("click", () => openPendingItemSheet(tile.dataset.pendingItem));
  });
}

// ---- Shell: header, tabs, scroll-preserving render, open/close ----

function renderGearHeader() {
  const pending = getPendingLoot().length;
  el.gearWallet.innerHTML =
    `<b>&#9670; ${getShards()}</b> &nbsp;&middot;&nbsp; STASH ${getStash().length}/${LOOT.stash.stashSize}` +
    (pending ? ` &nbsp;&middot;&nbsp; ${pending} UNCLAIMED` : "");
  const unseen = countUnseenStash();
  el.gearStashBadge.classList.toggle("hidden", unseen === 0);
  el.gearStashBadge.textContent = `${unseen} NEW`;
}

function renderGearTabs() {
  el.gearTabTowers.classList.toggle("active", gearTab === "towers");
  el.gearTabStash.classList.toggle("active", gearTab === "stash");
  el.gearViewTowers.classList.toggle("hidden", gearTab !== "towers");
  el.gearViewStash.classList.toggle("hidden", gearTab !== "stash");
}

// Re-renders in place, preserving scroll position — the old flat panel's
// worst defect was a full rebuild resetting scroll to the top on every tap.
function renderGearPanel() {
  const scrollTop = el.gearScroll.scrollTop;
  renderGearHeader();
  renderGearTabs();
  if (gearTab === "towers") renderTowersTab();
  else renderStashTab();
  el.gearScroll.scrollTop = scrollTop;
}

function setGearTab(tab) {
  gearTab = tab;
  renderGearPanel();
  el.gearScroll.scrollTop = 0; // switching tabs is a new view, not an in-place update
}
el.gearTabTowers.addEventListener("click", () => setGearTab("towers"));
el.gearTabStash.addEventListener("click", () => setGearTab("stash"));

let gearCloseTriage = "normal";

export function openGearPanel({ closeMode = "normal" } = {}) {
  gearCloseTriage = closeMode;
  gearFilterSlot = null;
  gearFilterRarity = null;
  lockedListOpen = false;
  if (getPendingLoot().length) gearTab = "stash"; // surface triage immediately
  renderGearPanel();
  el.gearScroll.scrollTop = 0;
  el.gearOverlay.classList.remove("hidden");
}

// First visit to level 2 used to auto-open a standalone Tower Guide
// overlay; that overlay is gone (GEAR_UI_DESIGN U3), so this opens the
// merged TOWERS screen straight into its `?` guide sheet instead.
export function openTowerGuide() {
  openGearPanel();
  openGearHelpSheet();
}

function closeGearPanel() {
  if (getPendingLoot().length && gearCloseTriage === "triage") {
    if (!el.gearClose.classList.contains("confirming")) {
      el.gearClose.classList.add("confirming");
      el.gearClose.textContent = `${getPendingLoot().length} DROPS UNCLAIMED - TAP TO LEAVE`;
      return;
    }
    discardPendingLoot();
  }
  el.gearClose.classList.remove("confirming");
  el.gearClose.textContent = "CLOSE";
  closeSheet();
  el.gearOverlay.classList.add("hidden");
}

el.gearClose.addEventListener("click", closeGearPanel);

// ---------- Store overlay (GEAR_UI_DESIGN.md U5) ----------
// Same tile grid + bottom-sheet components as the gear screen (tileHtml,
// slotGlyph, itemAffixRowsHtml, itemTitle, itemReqText) — no store logic
// changes, purely a restyle on top of the existing P5 store functions.

function closeStoreSheet() {
  el.storeSheetOverlay.classList.add("hidden");
}
el.storeSheetOverlay.addEventListener("click", (e) => {
  if (e.target === el.storeSheetOverlay) closeStoreSheet();
});

function openStoreItemSheet(item) {
  const color = RARITY_COLOR[item.rarity];
  const lockTag = item.towerType ? `${TOWERS[item.towerType].rosterPrefix.toUpperCase()}-ONLY` : "UNIVERSAL";
  const sub =
    `${item.rarity.toUpperCase()} &middot; ${item.slot.toUpperCase()} &middot; ${lockTag} &middot; ` +
    `${itemReqText(item)} &middot; ILVL ${item.ilvl}`;
  const price = LOOT.store.prices[item.rarity] || 0;
  const free = stashSlotsFree();
  const buyLabel = free > 0 ? `BUY &#9670;${price}` : "STASH FULL";
  const buyDisabled = free <= 0 || getShards() < price;

  el.storeSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${color}; text-shadow:0 0 10px ${color}55">` +
    `${slotGlyph(item.slot, color)} ${escapeHtml(itemTitle(item))}</div>` +
    `<div class="gear-sheet-sub">${sub}</div>` +
    itemAffixRowsHtml(item) +
    `<div class="gear-sheet-actions"><button class="gear-sheet-btn" id="store-sheet-buy"${buyDisabled ? " disabled" : ""}>${buyLabel}</button></div>`;
  el.storeSheetOverlay.classList.remove("hidden");

  const buyBtn = document.getElementById("store-sheet-buy");
  if (!buyDisabled) {
    buyBtn.addEventListener("click", () => {
      buyStoreItem(item.id);
      closeStoreSheet();
      renderStorePanel();
    });
  }
}

function openUnlockSheet(rarity) {
  const cost = LOOT.store.rarityUnlocks[rarity];
  const color = RARITY_COLOR[rarity];
  const canAfford = getShards() >= cost;
  el.storeSheet.innerHTML =
    `<div class="gear-sheet-title" style="color:${color}; text-shadow:0 0 10px ${color}55">` +
    `&#9632; UNLOCK ${rarity.toUpperCase()}</div>` +
    `<div class="gear-sheet-sub">Spend &#9670;${cost} shards to add ` +
    `${rarity.toUpperCase()} items to the store roll.</div>` +
    `<div class="gear-sheet-actions">` +
    `<button class="gear-sheet-btn" id="store-unlock-confirm"${canAfford ? "" : " disabled"}>` +
    `UNLOCK &#9670;${cost}</button></div>`;
  el.storeSheetOverlay.classList.remove("hidden");
  if (canAfford) {
    document.getElementById("store-unlock-confirm").addEventListener("click", () => {
      buyStoreUnlock(rarity);
      closeStoreSheet();
      renderStorePanel();
    });
  }
}

function renderStorePanel() {
  const scrollTop = el.storeScroll.scrollTop;
  const stock = getStoreStock();
  const free = stashSlotsFree();
  const rerollCost = storeRerollCost();
  const shards = getShards();
  const unlocks = getStoreUnlocks();
  el.storeWallet.innerHTML = `<b>&#9670; ${shards}</b> &nbsp;&middot;&nbsp; STASH ${getStash().length}/${LOOT.stash.stashSize}`;

  el.storeActions.innerHTML = "";

  // Unlock row — shows locked rarities as tap-to-buy tiles
  const rarityUnlocks = LOOT.store.rarityUnlocks;
  const lockedRarities = Object.keys(rarityUnlocks).filter((r) => !unlocks.includes(r));
  if (lockedRarities.length > 0) {
    const row = document.createElement("div");
    row.className = "store-unlock-row";
    row.innerHTML =
      `<div class="store-unlock-label">UNLOCK RARITIES</div>` +
      `<div class="store-unlock-tiles">` +
      lockedRarities.map((rarity) => {
        const cost = rarityUnlocks[rarity];
        const color = RARITY_COLOR[rarity];
        const affordable = shards >= cost;
        const priceColor = affordable ? "var(--neon-yellow)" : "var(--neon-red)";
        return `<button class="store-unlock-tile" data-unlock-rarity="${rarity}" ` +
          `style="border-color:${color}; color:${color}">` +
          `<span class="unlock-padlock">&#9632;</span>` +
          `<span class="unlock-name">${rarity.toUpperCase()}</span>` +
          `<span class="unlock-price" style="color:${priceColor}">&#9670;${cost}</span>` +
          `</button>`;
      }).join("") +
      `</div>`;
    el.storeActions.appendChild(row);
    row.querySelectorAll("[data-unlock-rarity]").forEach((tile) => {
      tile.addEventListener("click", () => openUnlockSheet(tile.dataset.unlockRarity));
    });
  }

  const reroll = document.createElement("button");
  reroll.className = "gear-action store-reroll";
  reroll.textContent = `REROLL ◆ ${rerollCost}`;
  reroll.disabled = shards < rerollCost;
  reroll.addEventListener("click", () => { rerollStore(); renderStorePanel(); });
  el.storeActions.appendChild(reroll);

  el.storeGrid.innerHTML = stock.length
    ? stock.map((item) => {
      const price = LOOT.store.prices[item.rarity] || 0;
      return tileHtml(item, { storeId: item.id, priceTag: price, unaffordable: free <= 0 || shards < price });
    }).join("")
    : `<div class="gear-grid-empty">SOLD OUT &mdash; reroll to restock.</div>`;

  el.storeScroll.scrollTop = scrollTop;

  el.storeGrid.querySelectorAll("[data-store-item]").forEach((tile) => {
    tile.addEventListener("click", () => {
      const item = getStoreStock().find((i) => i.id === tile.dataset.storeItem);
      if (item) openStoreItemSheet(item);
    });
  });
}

export function openStorePanel() {
  renderStorePanel();
  el.storeOverlay.classList.remove("hidden");
}

el.storeClose.addEventListener("click", () => {
  closeStoreSheet();
  el.storeOverlay.classList.add("hidden");
  renderWorld();
});

// ---------- Skill tree overlay ----------

// onSkillBought lets main.js refresh live tower stats after a purchase.
let skillBoughtCallback = () => {};

export function initSkillTree(onSkillBought) {
  skillBoughtCallback = onSkillBought;
  el.skillsButton.addEventListener("click", openSkillTree);
  el.skillClose.addEventListener("click", () => {
    el.skillOverlay.classList.add("hidden");
    resetConfirmState();
  });

  // Reset save: two-tap confirm, then reload into a clean state.
  el.resetSave.addEventListener("click", () => {
    if (el.resetSave.classList.contains("confirming")) {
      resetProgress();
      location.reload();
    } else {
      el.resetSave.classList.add("confirming");
      el.resetSave.textContent = "SURE? TAP AGAIN";
      setTimeout(resetConfirmState, 3000);
    }
  });
}

// Open the skill tree from anywhere (HUD, level select, end-of-battle).
export function openSkillTree() {
  renderSkillList(skillBoughtCallback);
  el.skillOverlay.classList.remove("hidden");
}

function resetConfirmState() {
  el.resetSave.classList.remove("confirming");
  el.resetSave.textContent = "RESET SAVE";
}

// One row per skill: name, tier pips, current -> next effect, buy button.
function renderSkillList(onSkillBought) {
  el.skillPointsLine.textContent = `AVAILABLE POINTS: ${getSkillPoints()} — win battles to earn more`;
  el.skillList.innerHTML = "";

  for (const [id, def] of Object.entries(SKILLS)) {
    const tier = getSkillTier(id);
    const cost = nextTierCost(id); // null when maxed
    const step = SKILL_VALUES[id];
    const isPercent = step < 1;
    const fmt = (t) => (isPercent ? `+${Math.round(step * t * 100)}%` : `+${step * t}`);

    const row = document.createElement("div");
    row.className = "skill-row";

    // Tier pips: ● earned, ○ remaining.
    const pips = "●".repeat(tier) + "○".repeat(SKILL_TIERS.maxTier - tier);
    const effectLine =
      cost === null
        ? `${fmt(tier)} ${def.desc} — MAXED`
        : tier === 0
          ? `next: ${fmt(1)} ${def.desc}`
          : `${fmt(tier)} ${def.desc} → next: ${fmt(tier + 1)}`;

    const text = document.createElement("div");
    text.className = "skill-text";
    text.innerHTML =
      `<span class="skill-name">${def.name} <span class="skill-pips">${pips}</span></span>` +
      `<span class="skill-desc">${effectLine}</span>`;

    const buy = document.createElement("button");
    buy.className = "skill-buy";
    if (cost === null) {
      buy.textContent = "MAX";
      buy.classList.add("owned");
      buy.disabled = true;
    } else {
      buy.textContent = `${cost} PT`;
      buy.disabled = getSkillPoints() < cost;
      buy.addEventListener("click", () => {
        if (buySkill(id)) {
          onSkillBought();
          renderSkillList(onSkillBought); // re-render with new state
        }
      });
    }

    row.appendChild(text);
    row.appendChild(buy);
    el.skillList.appendChild(row);
  }
}

// ---------- Leaderboard overlay ----------
// Shared online best-wave board, grouped by level. Opened from the main
// menu and from the Endless RUN OVER overlay. Read-only fetch here; the
// submit path lives in leaderboard.js (auto on new best) plus the
// "PUBLISH MY SCORES" button below.

let lbLevels = []; // levels list, for id -> display-name lookup

export function openLeaderboard(levels) {
  lbLevels = levels;
  el.nicknameInput.value = getNickname();
  el.leaderboardMsg.textContent = "";
  renderLeaderboard();
  el.leaderboardOverlay.classList.remove("hidden");
}

async function renderLeaderboard() {
  el.leaderboardList.innerHTML = `<div class="lb-status">Loading…</div>`;

  let boards;
  try {
    boards = await fetchAllBoards();
  } catch (err) {
    console.warn("Leaderboard fetch failed:", err);
    el.leaderboardList.innerHTML =
      `<div class="lb-status">Couldn't reach the leaderboard.<br>` +
      `Check your connection and try again.</div>`;
    return;
  }

  const withScores = lbLevels.filter((lv) => boards[lv.id] && boards[lv.id].length);
  if (!withScores.length) {
    el.leaderboardList.innerHTML =
      `<div class="lb-status">No scores yet.<br>` +
      `Play an Endless run and publish your best wave to claim the top spot.</div>`;
    return;
  }

  const me = getNickname();
  let html = "";
  for (const lv of withScores) {
    html += `<div class="lb-section">${escapeHtml(lv.name.toUpperCase())}</div>`;
    boards[lv.id].forEach((row, i) => {
      const mine = me && row.nickname === me ? " lb-me" : "";
      html +=
        `<div class="lb-row${mine}">` +
        `<span class="lb-rank">#${i + 1}</span>` +
        `<span class="lb-nick">${escapeHtml(row.nickname)}</span>` +
        `<span class="lb-wave">W${row.wave}</span>` +
        `</div>`;
    });
  }
  el.leaderboardList.innerHTML = html;
}

// Nicknames come from other players — always escape before innerHTML.
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function flashLbMsg(text) {
  el.leaderboardMsg.textContent = text;
}

el.leaderboardClose.addEventListener("click", () => {
  el.leaderboardOverlay.classList.add("hidden");
});

el.nicknameSave.addEventListener("click", () => {
  const val = setNickname(el.nicknameInput.value);
  el.nicknameInput.value = val;
  flashLbMsg(val ? `Nickname set to ${val}.` : "Nickname cleared.");
});

el.publishScores.addEventListener("click", async () => {
  if (!getNickname()) {
    flashLbMsg("Enter a nickname first, then Save.");
    return;
  }
  el.publishScores.disabled = true;
  el.publishScores.textContent = "PUBLISHING…";
  const { ok, fail } = await publishAllLocalBests(getProgress().endlessBest || {});
  el.publishScores.disabled = false;
  el.publishScores.textContent = "PUBLISH MY SCORES";
  flashLbMsg(
    ok
      ? `Published ${ok} score${ok === 1 ? "" : "s"}.` + (fail ? ` (${fail} failed)` : "")
      : fail
        ? "Publish failed — check your connection."
        : "No Endless bests yet — set one first."
  );
  renderLeaderboard();
});

export function onWaveButtonTap(handler) {
  el.waveButton.addEventListener("click", handler);
}

export function onExitButtonTap(handler) {
  el.exitButton.addEventListener("click", handler);
}

// buttons: [{ text, onTap, secondary }] — first button is the primary
// action, secondary:true renders quieter (skill tree, main menu...).
// Results screen. `items` (optional) is the run's loot as placement objects
// ({ item, dest, towerName? } from bankEarnedItem) — rendered as a tappable
// grid under the buttons, each tile opening its detail card. `note`
// (optional) is a short red warning line (used when loot couldn't fit).
export function showOverlay({ title, subtitle, type, buttons, items, note }) {
  el.overlayTitle.textContent = title;
  el.overlaySubtitle.textContent = subtitle || "";
  el.overlay.className = type; // "win" or "loss"

  if (note) {
    el.overlayNote.textContent = note;
    el.overlayNote.classList.remove("hidden");
  } else {
    el.overlayNote.classList.add("hidden");
  }

  el.overlayButtons.innerHTML = "";
  for (const spec of buttons) {
    const btn = document.createElement("button");
    btn.className = "big-button" +
      (spec.secondary ? " secondary" : "") +
      (spec.danger ? " danger" : "");
    btn.textContent = spec.text;
    btn.addEventListener("click", spec.onTap);
    el.overlayButtons.appendChild(btn);
  }

  const loot = (items || []).filter(Boolean);
  if (loot.length) {
    el.overlayItems.innerHTML = loot.map((p, i) =>
      tileHtml(p.item, {
        resultIndex: i,
        tileClass: p.dest === "equipped" ? "equipped-tile" : "stashed-tile",
      })
    ).join("");
    el.overlayItems.classList.remove("hidden");
    el.overlayItems.querySelectorAll("[data-result-item]").forEach((tile) => {
      tile.addEventListener("click", () =>
        showItemDetail(loot[Number(tile.dataset.resultItem)]));
    });
  } else {
    el.overlayItems.innerHTML = "";
    el.overlayItems.classList.add("hidden");
  }
}

export function hideOverlay() {
  el.overlay.className = "hidden";
}
