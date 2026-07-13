// ============================================================
// UI — the HTML parts around the canvas: HUD, buttons, overlays.
// ============================================================

import {
  TOWERS, ENEMIES, SKILLS, SKILL_VALUES, TOWER_UPGRADES, LOOT,
  SKILL_BRANCH_COLORS, SKILL_TREE_VIEWBOX,
} from "./config.js";
import {
  xpThresholdFor, upgradeCostFor, isUpgradeEligible, sellValueOf,
  masteryRankFor, xpToNextMastery, careerStatsFor,
} from "./towers.js";
import {
  getSkillTier, nextTierCost, getSkillPoints, buySkill, resetProgress,
  skillMaxTier, isSkillUnlocked, getTowerLevelCap,
  isTowerUnlocked, getProgress, getBestEndlessWave, getShards, getEndlessMilestones,
  getLevelMilestones,
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
  skillSheetOverlay: document.getElementById("skill-sheet-overlay"),
  skillSheet: document.getElementById("skill-sheet"),
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
  overlayMilestones: document.getElementById("overlay-milestones"),
  overlayLootHead: document.getElementById("overlay-loot-head"),
  overlayItems: document.getElementById("overlay-items"),
  dropReveal: document.getElementById("drop-reveal"),
  milestoneToast: document.getElementById("milestone-toast"),
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
    // Campaign milestones are earnable as soon as the level is playable.
    const campaign = (level && state !== "locked") ? getLevelMilestones(id) : [];
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
      campaign,
      campaignDone: campaign.filter((m) => m.claimed).length,
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
  if (reward.kind === "skillPoint") return `&#9733; ${reward.amount} SKILL PT`;
  if (reward.kind === "loot" || reward.rarity) {
    return reward.rarity === "singularity" ? "SINGULARITY" : `${reward.rarity.toUpperCase()} LOOT`;
  }
  // Combined campaign-challenge shape: { skillPoints, shards }, both optional.
  const parts = [];
  if (reward.skillPoints) parts.push(`&#9733; ${reward.skillPoints} SKILL PT`);
  if (reward.shards) parts.push(`&#9670; ${reward.shards}`);
  return parts.join(" + ");
}

// Friendly tower names for challenge descriptions (challenge labels like
// "Battle-Hardened" don't say what to DO — this spells it out from the data).
const CHALLENGE_TOWER_LABEL = {
  laser: "Laser", pulse: "Pulse", slow: "Slow", railgun: "Railgun", rocket: "Rocket",
};
function challengeTowerList(types) {
  const names = types.map((t) => CHALLENGE_TOWER_LABEL[t] || t);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// Human "how to earn this" text, derived from a milestone's `check` clauses
// (config.js milestones.js vocabulary) — never hardcoded per challenge, so
// new challenges explain themselves.
function milestoneDescText(check) {
  const parts = [];
  if (check.clearNoLeaks) parts.push("Clear the level without letting a single enemy reach the core.");
  if (check.onlyTowers) {
    parts.push(`Win the level using only ${challengeTowerList(check.onlyTowers)} towers.`);
  }
  if (check.withoutTowers) {
    parts.push(`Win the level without building any ${challengeTowerList(check.withoutTowers)} towers.`);
  }
  if (check.towersAtLevel) {
    const [count, lvl] = check.towersAtLevel;
    parts.push(`Have ${count} tower${count > 1 ? "s" : ""} at level ${lvl} or higher deployed at the same time.`);
  }
  if (check.kills != null) parts.push(`Destroy at least ${check.kills} enemies.`);
  if (check.throughWave != null) parts.push(`(Must be held through wave ${check.throughWave}.)`);
  return parts.join(" ") || "Complete the level.";
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
  if (nd.campaign && nd.campaign.length) {
    chips.push(`<span class="level-chip gold">&#9873; ${nd.campaignDone}/${nd.campaign.length} CHALLENGES</span>`);
  }
  if (cleared) chips.push(`<span class="level-chip gold">&#9733; ${nd.done}/${nd.total} MILESTONES</span>`);

  // Campaign challenges — shown whenever the level is playable (not locked).
  // Each row is tappable to expand a data-derived "how to earn this" line, so
  // labels like "Battle-Hardened" or "Flawless" actually explain themselves.
  let campaignHtml = "";
  if (!locked && nd.campaign && nd.campaign.length) {
    const rows = nd.campaign.map((m, i) =>
      `<div class="level-mile challenge ${m.claimed ? "done" : ""}" data-mi="${i}">` +
      `<div class="tick"></div>` +
      `<span class="m-label">${escapeHtml(m.label)}</span>` +
      `<span class="m-reward">${milestoneRewardText(m.reward)}</span>` +
      `<span class="m-chev">&#9662;</span></div>` +
      `<div class="mile-desc" data-mi-desc="${i}">${escapeHtml(milestoneDescText(m.check))}</div>`
    ).join("");
    campaignHtml = `<div class="level-mile-head">CAMPAIGN CHALLENGES <span class="mile-hint">tap to learn</span></div>${rows}`;
  }

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
    campaignHtml +
    milestoneHtml +
    `<div class="level-sheet-actions">` +
    `<button class="level-sheet-btn play" id="level-sheet-play"${locked ? " disabled" : ""}>&#9654; PLAY</button>` +
    `<button class="level-sheet-btn endless" id="level-sheet-endless"${cleared ? "" : " disabled"}>&#8734; ENDLESS</button>` +
    `</div>`;

  el.levelSheetOverlay.classList.remove("hidden");

  // Expand/collapse a challenge's description on tap.
  el.levelSheet.querySelectorAll(".level-mile.challenge").forEach((row) => {
    row.addEventListener("click", () => {
      const i = row.getAttribute("data-mi");
      const desc = el.levelSheet.querySelector(`.mile-desc[data-mi-desc="${i}"]`);
      const open = row.classList.toggle("open");
      if (desc) desc.classList.toggle("open", open);
    });
  });

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

// Sum an item's affixes into a { stat: value } map (an affix stat can, in
// principle, appear twice — add them).
function itemStatMap(item) {
  const m = {};
  for (const a of item.affixes || []) m[a.stat] = (m[a.stat] || 0) + a.value;
  return m;
}

// Old-vs-new comparison sheet (B4). Two columns (CURRENT / NEW), one row per
// affix aligned by stat with green/red deltas; affixes present on only one
// side render greyed on the other. Opened when equipping into a filled slot
// (footer EQUIP NEW / KEEP CURRENT) or read-only for inspection (footer CLOSE).
function openCompareSheet(current, incoming, opts = {}) {
  const readOnly = !!opts.readOnly;
  const slot = incoming.slot;
  const curColor = RARITY_COLOR[current.rarity];
  const newColor = RARITY_COLOR[incoming.rarity];
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

  const footer = readOnly
    ? `<div class="gear-sheet-actions"><button class="gear-sheet-btn" id="cmp-close">CLOSE</button></div>`
    : `<div class="gear-sheet-actions">` +
      `<button class="gear-sheet-btn" id="cmp-equip">EQUIP NEW</button>` +
      `<button class="gear-sheet-btn sell" id="cmp-keep">KEEP CURRENT</button></div>`;

  el.gearSheet.innerHTML =
    `<div class="gear-sheet-title">${slotGlyph(slot, "#8fa0c8")} COMPARE &middot; ${SLOT_LABEL[slot]}</div>` +
    `<div class="cmp-head"><span class="cmp-label"></span>` +
    `<span class="cmp-cell" style="color:${curColor}">${escapeHtml(itemTitle(current))}` +
    `<small>${current.rarity.toUpperCase()}</small></span>` +
    `<span class="cmp-cell" style="color:${newColor}">${escapeHtml(itemTitle(incoming))}` +
    `<small>${incoming.rarity.toUpperCase()}</small></span></div>` +
    rows + uniqueRow + footer;
  openSheet();

  if (readOnly) {
    document.getElementById("cmp-close").addEventListener("click", closeSheet);
  } else {
    document.getElementById("cmp-equip").addEventListener("click", () => opts.onEquip());
    document.getElementById("cmp-keep").addEventListener("click", closeSheet);
  }
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
      const doEquip = () => {
        equipStashItem(rec.name, btn.dataset.equipItem);
        equipFlashTarget = { towerName: rec.name, slot };
        closeSheet();
        renderGearPanel();
      };
      // The picker only opens on empty slots today, but guard the displacing
      // case: if this slot is already filled, compare before swapping.
      const current = normalizeGear(rec.gear)[slot];
      const incoming = candidates.find((c) => c.id === btn.dataset.equipItem);
      if (current && incoming) openCompareSheet(current, incoming, { onEquip: doEquip });
      else doEquip();
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
      const targetName = btn.dataset.targetTower;
      const doEquip = () => {
        equipStashItem(targetName, item.id);
        equipFlashTarget = { towerName: targetName, slot: item.slot };
        closeSheet();
        renderGearPanel();
      };
      // If the destination slot already holds gear, show the compare sheet
      // (CURRENT vs NEW) instead of silently displacing it (B4).
      const rec = getProgress().roster.find((r) => r.name === targetName);
      const current = rec && normalizeGear(rec.gear)[item.slot];
      if (current) openCompareSheet(current, item, { onEquip: doEquip });
      else doEquip();
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
// Show the overlay FIRST so the scroll pane has real dimensions when
// layoutSkillTree measures it, then start at fit-to-screen (zoom reset).
export function openSkillTree() {
  el.skillOverlay.classList.remove("hidden");
  skillZoom = 1;
  renderSkillTree(skillBoughtCallback, true);
}

function resetConfirmState() {
  el.resetSave.classList.remove("confirming");
  el.resetSave.textContent = "RESET SAVE";
}

// Cumulative effect text at a given tier, from the node's `kind`. Per-tower
// chain boxes carry their own `step` (damage) or `lvl` (level cap); shared
// core/economy nodes read their per-tier value from SKILL_VALUES.
function skillEffectText(id, tier) {
  const node = SKILLS[id];
  if (node.kind === "unlock") return `Unlocks ${node.name.replace(/ Core$/, "")} upgrades`;
  if (node.kind === "level") return `Level cap &rarr; ${node.lvl}`;
  const step = SKILL_VALUES[id] ?? node.step ?? 0;
  const kind = node.kind || (step < 1 ? "pct" : "flat");
  switch (kind) {
    case "pct":   return `+${Math.round(step * tier * 100)}%`;
    case "cap":   return `${step * tier}/wave`;
    case "mult":  return `&times;${(1 + step * tier).toFixed(1)}`;
    default:      return `+${step * tier}`;
  }
}

// Translucent fill from a #rrggbb branch color (for the "owned but not maxed"
// tile — a tinted interior under a full-strength glowing border).
function colorFill(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Vector skill icons, authored in a 0..100 box centered on 50,50 and drawn
// stroke-only to match the towers-screen gear glyphs (slotGlyph). Keyed by the
// `icon` field on each SKILLS entry (config.js) so the art stays data-driven.
// Returned as a positioned <g> scaled/centered on the node.
function skillIconBody(icon, color) {
  const s = `stroke="${color}" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`;
  const dot = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`;
  switch (icon) {
    case "core": // shield
      return `<path d="M50 12 L82 26 V52 C82 74 66 86 50 92 C34 86 18 74 18 52 V26 Z" ${s}/>` + dot(50, 50, 8);
    case "level": // double up-chevron (a level gain)
      return `<polyline points="26,52 50,30 74,52" ${s}/><polyline points="26,72 50,50 74,72" ${s}/>`;
    case "levelMax": // star (cap crown)
      return `<polygon points="50,12 60,40 90,40 66,58 75,88 50,70 25,88 34,58 10,40 40,40" ${s}/>`;
    case "laser": // focusing lens + horizontal beam
      return `<circle cx="50" cy="50" r="18" ${s}/><line x1="6" y1="50" x2="30" y2="50" ${s}/>` +
        `<line x1="70" y1="50" x2="94" y2="50" ${s}/>` + dot(50, 50, 6);
    case "pulse": // concentric shock rings
      return `<circle cx="50" cy="50" r="30" ${s}/><circle cx="50" cy="50" r="16" ${s}/>` + dot(50, 50, 5);
    case "slow": // hourglass (time / stasis)
      return `<polygon points="26,16 74,16 54,50 74,84 26,84 46,50" ${s}/>`;
    case "rail": // long piercing arrow
      return `<line x1="12" y1="50" x2="78" y2="50" ${s}/><polyline points="62,32 88,50 62,68" ${s}/>`;
    case "rocket": // blast burst
      return `<line x1="50" y1="12" x2="50" y2="88" ${s}/><line x1="12" y1="50" x2="88" y2="50" ${s}/>` +
        `<line x1="24" y1="24" x2="76" y2="76" ${s}/><line x1="76" y1="24" x2="24" y2="76" ${s}/>` + dot(50, 50, 8);
    case "pierce": // arrow punching through a plate
      return `<line x1="10" y1="50" x2="80" y2="50" ${s}/><polyline points="64,34 90,50 64,66" ${s}/>` +
        `<line x1="46" y1="24" x2="46" y2="76" stroke="${color}" fill="none" stroke-width="5" stroke-dasharray="7 7"/>`;
    case "coin": // coin with a value stroke
      return `<circle cx="50" cy="50" r="30" ${s}/><line x1="50" y1="30" x2="50" y2="70" ${s}/>` +
        `<line x1="40" y1="40" x2="60" y2="40" ${s}/><line x1="40" y1="60" x2="60" y2="60" ${s}/>`;
    case "xp": // up arrow (growth)
      return `<line x1="50" y1="24" x2="50" y2="82" ${s}/><polyline points="28,46 50,22 72,46" ${s}/>`;
    case "shard": // faceted diamond
      return `<polygon points="50,14 80,50 50,86 20,50" ${s}/><line x1="20" y1="50" x2="80" y2="50" ${s}/>`;
    case "interest": // percent
      return `<line x1="30" y1="72" x2="70" y2="28" ${s}/><circle cx="34" cy="34" r="9" ${s}/>` +
        `<circle cx="66" cy="66" r="9" ${s}/>`;
    case "cap": // capped reservoir bar
      return `<rect x="30" y="42" width="40" height="44" rx="4" ${s}/><line x1="20" y1="30" x2="80" y2="30" ${s}/>`;
    default:
      return dot(50, 50, 10);
  }
}

// Position an icon body on a node: centered on (cx,cy), scaled to `size` units.
function skillIcon(icon, color, cx, cy, size) {
  const k = size / 100;
  return `<g transform="translate(${cx} ${cy}) scale(${k}) translate(-50 -50)">${skillIconBody(icon, color)}</g>`;
}

// Build the branching skill-tree SVG. Modeled on buildBoardSvg: connectors
// under square nodes, per-branch accent color, invisible hit targets last.
function buildSkillTreeSvg() {
  const { w, h } = SKILL_TREE_VIEWBOX;
  const points = getSkillPoints();
  let svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="skill-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="1.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

  // Node geometry. The border is a crisp 1px line via vector-effect
  // non-scaling-stroke, so it renders the SAME thin weight as the towers-screen
  // gear tiles no matter how far the SVG is scaled to fit the width — the old
  // fat, blurred, blob-like squares were a scaled 1.6-unit stroke. Glow is a
  // SEPARATE blurred rect drawn behind (like a CSS box-shadow) so filtering
  // never fattens the crisp line on top.
  const R = 9, RX = 3;
  const box = (rx, ry, s, extra) => `x="${rx}" y="${ry}" width="${s}" height="${s}" rx="${RX}" ${extra}`;

  // Connectors (under nodes): lit once the PARENT owns a tier.
  for (const node of Object.values(SKILLS)) {
    if (!node.parent) continue;
    const p = SKILLS[node.parent].pos, c = node.pos;
    const color = node.color || SKILL_BRANCH_COLORS[node.branch] || "#8aa";
    const lit = getSkillTier(node.parent) >= 1;
    if (lit) {
      svg += `<path d="M${p.x} ${p.y} L${c.x} ${c.y}" fill="none" stroke="${color}" stroke-width="3" opacity=".35" filter="url(#skill-glow)"/>` +
        `<path d="M${p.x} ${p.y} L${c.x} ${c.y}" fill="none" stroke="${color}" stroke-width="1.4" vector-effect="non-scaling-stroke" opacity=".9"/>`;
    } else {
      svg += `<path d="M${p.x} ${p.y} L${c.x} ${c.y}" fill="none" stroke="rgba(120,140,170,.32)" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3"/>`;
    }
  }

  // Nodes.
  for (const [id, node] of Object.entries(SKILLS)) {
    const { x, y } = node.pos;
    const color = node.color || SKILL_BRANCH_COLORS[node.branch] || "#8aa";
    const tier = getSkillTier(id);
    const max = skillMaxTier(id);
    const owned = tier >= 1;
    const maxed = tier >= max;
    const available = !owned && isSkillUnlocked(id);
    const affordable = available && points >= (nextTierCost(id) || Infinity);
    const rx = x - R, ry = y - R, s = R * 2;
    const iconSize = 12;

    // Node contents: a short value label ("+10%", "L6") for the chain boxes,
    // otherwise the vector icon. Fill flips to dark ink on a solid maxed tile.
    const content = (fill) => node.chainLabel
      ? `<text x="${x}" y="${y + 2.2}" text-anchor="middle" font-weight="700" ` +
        `font-size="${node.chainLabel.length > 3 ? 5.4 : 7}" fill="${fill}">${node.chainLabel}</text>`
      : skillIcon(node.icon, fill, x, y, iconSize);

    // Soft outer glow behind the tile (only lit states) — mimics the gear
    // tile's box-shadow without fattening the crisp border above.
    if (maxed || owned || affordable) {
      const gA = maxed ? 0.55 : affordable ? 0.5 : 0.32;
      svg += `<rect ${box(rx, ry, s, `fill="none" stroke="${color}" stroke-width="3" opacity="${gA}" filter="url(#skill-glow)"`)}/>`;
    }

    if (maxed) {
      // Fully-owned: solid tile + dark contents — the "complete" look.
      svg += `<rect ${box(rx, ry, s, `fill="${color}" opacity=".92"`)}/>` +
        `<rect ${box(rx, ry, s, `fill="none" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"`)}/>` +
        content("#04121a");
    } else if (owned) {
      svg += `<rect ${box(rx, ry, s, `fill="${colorFill(color, 0.16)}" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke"`)}/>` +
        content(color);
    } else if (available) {
      // Pulse ring only when the player can actually afford it.
      if (affordable) {
        svg += `<rect x="${rx - 2.6}" y="${ry - 2.6}" width="${s + 5.2}" height="${s + 5.2}" rx="4" fill="none" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke" class="skill-pulse"/>`;
      }
      svg += `<rect ${box(rx, ry, s, `fill="#0a1220" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke" opacity="${affordable ? 1 : 0.85}"`)}/>` +
        content(color);
    } else { // locked (parent not owned)
      svg += `<rect ${box(rx, ry, s, `fill="#0a0f18" stroke="rgba(120,140,170,.5)" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3"`)}/>` +
        content("rgba(140,160,190,.6)");
    }

    // Multi-tier progress badge (e.g. 3/5) below the node.
    if (max > 1) {
      svg += `<text x="${x}" y="${y + R + 5.4}" text-anchor="middle" font-size="4.6" fill="${owned ? color : "rgba(150,170,200,.6)"}">${tier}/${max}</text>`;
    }
    // Branch-head label above the top-row heads (LASER / PULSE / MONEY / …).
    if (node.headLabel) {
      svg += `<text x="${x}" y="${y - R - 3}" text-anchor="middle" font-size="4.8" font-weight="700" letter-spacing="0.4" fill="${color}" opacity=".92">${node.headLabel}</text>`;
    }
  }

  // Invisible hit targets last so taps always land.
  for (const [id, node] of Object.entries(SKILLS)) {
    svg += `<rect x="${node.pos.x - R - 2}" y="${node.pos.y - R - 2}" width="${R * 2 + 4}" height="${R * 2 + 4}" fill="rgba(0,0,0,0)" data-skill="${id}" style="cursor:pointer"/>`;
  }

  svg += `</svg>`;
  return svg;
}

// ---- Skill-tree zoom / pan ----
// The whole board is drawn at once; the pane starts at fit-to-screen (zoom 1 =
// entire tree visible) and the player pinches or taps +/- to zoom in, then
// drags/scrolls to pan. Zoom + scroll persist across re-renders (buying a node
// rebuilds the SVG) so the view doesn't jump.
let skillZoom = 1;
let skillScroll = { left: 0, top: 0 };
const SKILL_ZOOM_MIN = 1, SKILL_ZOOM_MAX = 5, SKILL_ZOOM_STEP = 1.5;

function skillPane() { return el.skillList.querySelector(".skill-tree-scroll"); }

// Size the SVG in px: fit the viewbox into the pane, then multiply by zoom.
function layoutSkillTree(recenter) {
  const pane = skillPane();
  const svg = pane && pane.querySelector("svg");
  if (!pane || !svg) return;
  const vb = SKILL_TREE_VIEWBOX;
  const cw = pane.clientWidth, ch = pane.clientHeight;
  if (!cw || !ch) return;
  const fit = Math.min(cw / vb.w, ch / vb.h);
  svg.style.width = (vb.w * fit * skillZoom) + "px";
  svg.style.height = (vb.h * fit * skillZoom) + "px";
  if (recenter) {
    pane.scrollLeft = Math.max(0, (svg.clientWidth - cw) / 2);
    pane.scrollTop = 0;
    skillScroll = { left: pane.scrollLeft, top: pane.scrollTop };
  } else {
    pane.scrollLeft = skillScroll.left;
    pane.scrollTop = skillScroll.top;
  }
}

// Zoom toward a focal point (pinch midpoint, or pane center for the buttons),
// keeping the content under that point stationary.
function setSkillZoom(z, focal) {
  const pane = skillPane();
  if (!pane) return;
  const prev = skillZoom;
  skillZoom = Math.max(SKILL_ZOOM_MIN, Math.min(SKILL_ZOOM_MAX, z));
  if (skillZoom === prev) return;
  const fx = focal ? focal.x : pane.clientWidth / 2;
  const fy = focal ? focal.y : pane.clientHeight / 2;
  const ratio = skillZoom / prev;
  const nl = (pane.scrollLeft + fx) * ratio - fx;
  const nt = (pane.scrollTop + fy) * ratio - fy;
  layoutSkillTree(false);
  pane.scrollLeft = nl; pane.scrollTop = nt;
  skillScroll = { left: pane.scrollLeft, top: pane.scrollTop };
}

function touchDist(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

function bindSkillTreeGestures() {
  const pane = skillPane();
  if (!pane) return;
  pane.addEventListener("scroll", () => {
    skillScroll = { left: pane.scrollLeft, top: pane.scrollTop };
  });
  let startDist = 0, startZoom = 1;
  const midOf = (touches) => {
    const r = pane.getBoundingClientRect();
    return { x: (touches[0].clientX + touches[1].clientX) / 2 - r.left,
             y: (touches[0].clientY + touches[1].clientY) / 2 - r.top };
  };
  pane.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) { startDist = touchDist(e.touches); startZoom = skillZoom; }
  }, { passive: true });
  pane.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && startDist) {
      e.preventDefault(); // we own the pinch; don't let the page zoom
      setSkillZoom(startZoom * touchDist(e.touches) / startDist, midOf(e.touches));
    }
  }, { passive: false });
  const end = () => { startDist = 0; };
  pane.addEventListener("touchend", end);
  pane.addEventListener("touchcancel", end);
  // Desktop convenience: ctrl/⌘ + wheel to zoom.
  pane.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const r = pane.getBoundingClientRect();
    setSkillZoom(skillZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });
}

function renderSkillTree(onSkillBought, recenter = false) {
  const points = getSkillPoints();
  el.skillPointsLine.innerHTML =
    `AVAILABLE POINTS: <b>${points}</b> &mdash; win battles to earn more &middot; pinch or &plusmn; to zoom`;
  el.skillList.classList.add("skill-tree-host");
  el.skillList.innerHTML =
    `<div class="skill-tree-scroll">${buildSkillTreeSvg()}</div>` +
    `<div class="skill-zoom">` +
    `<button type="button" class="skill-zoom-btn" data-zoom="out" aria-label="Zoom out">&minus;</button>` +
    `<button type="button" class="skill-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>` +
    `</div>`;

  // On fresh open, zoom so the deepest branch nearly fills the pane height.
  if (recenter) {
    const pane = skillPane();
    if (pane && pane.clientWidth && pane.clientHeight) {
      const vb = SKILL_TREE_VIEWBOX;
      const fit = Math.min(pane.clientWidth / vb.w, pane.clientHeight / vb.h);
      skillZoom = Math.max(1, pane.clientHeight / (vb.h * fit));
    }
  }
  layoutSkillTree(recenter);
  bindSkillTreeGestures();

  el.skillList.querySelectorAll("[data-zoom]").forEach((b) => {
    b.addEventListener("click", () =>
      setSkillZoom(b.dataset.zoom === "in" ? skillZoom * SKILL_ZOOM_STEP : skillZoom / SKILL_ZOOM_STEP));
  });
  el.skillList.querySelectorAll("[data-skill]").forEach((hit) => {
    hit.addEventListener("click", () => openSkillSheet(hit.dataset.skill, onSkillBought));
  });
}

// ---- Skill node detail bottom sheet (tap a node) ----

function closeSkillSheet() {
  el.skillSheetOverlay.classList.add("hidden");
}
el.skillSheetOverlay.addEventListener("click", (e) => {
  if (e.target === el.skillSheetOverlay) closeSkillSheet();
});

function openSkillSheet(id, onSkillBought) {
  const node = SKILLS[id];
  if (!node) return;
  const color = node.color || SKILL_BRANCH_COLORS[node.branch] || "#8aa";
  const tier = getSkillTier(id);
  const max = skillMaxTier(id);
  const cost = nextTierCost(id); // null when maxed
  const owned = tier >= 1;
  const unlocked = isSkillUnlocked(id);
  const points = getSkillPoints();

  const pips = `<span class="skill-pips">${"&#9679;".repeat(tier)}${"&#9675;".repeat(max - tier)}</span>`;

  // `unlock`/`level` effect text is a full self-contained phrase, so don't
  // also append the node's descriptive noun (that would read redundantly).
  const tail = (node.kind === "unlock" || node.kind === "level") ? "" : ` ${node.desc}`;
  let effectLine;
  if (cost === null) {
    effectLine = `${skillEffectText(id, tier)}${tail} &mdash; MAXED`;
  } else if (tier === 0) {
    effectLine = `next: ${skillEffectText(id, 1)}${tail}`;
  } else {
    effectLine = `${skillEffectText(id, tier)} &rarr; ${skillEffectText(id, tier + 1)}${tail}`;
  }

  // Buy button label / disabled reasoning.
  let btnLabel, disabled = false, lockNote = "";
  if (cost === null) {
    btnLabel = "MAXED"; disabled = true;
  } else if (!unlocked) {
    const parent = SKILLS[node.parent];
    btnLabel = "LOCKED"; disabled = true;
    lockNote = `<div class="skill-sheet-lock">Unlock <b>${parent.name}</b> first.</div>`;
  } else {
    btnLabel = `BUY &mdash; ${cost} PT`;
    disabled = points < cost;
  }

  el.skillSheet.innerHTML =
    `<div class="skill-sheet-title" style="color:${color}; text-shadow:0 0 10px ${color}66">` +
    `${node.glyph ? node.glyph + " " : ""}${node.name}</div>` +
    `<div class="skill-sheet-sub">${node.branch.toUpperCase()} BRANCH &middot; ${pips}</div>` +
    `<div class="skill-sheet-effect">${effectLine}</div>` +
    lockNote +
    `<div class="skill-sheet-actions">` +
    `<button class="skill-sheet-btn" id="skill-sheet-buy"${disabled ? " disabled" : ""}>${btnLabel}</button>` +
    `</div>`;
  el.skillSheetOverlay.classList.remove("hidden");

  if (!disabled) {
    document.getElementById("skill-sheet-buy").addEventListener("click", () => {
      if (buySkill(id)) {
        onSkillBought();
        closeSkillSheet();
        renderSkillTree(onSkillBought); // re-render the board with new state
      }
    });
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
export function showOverlay({ title, subtitle, type, buttons, items, note, milestones }) {
  el.overlayTitle.textContent = title;
  el.overlaySubtitle.textContent = subtitle || "";
  el.overlay.className = type; // "win" or "loss"

  if (note) {
    el.overlayNote.textContent = note;
    el.overlayNote.classList.remove("hidden");
  } else {
    el.overlayNote.classList.add("hidden");
  }

  // Milestone recap — a compact gold list above the loot grid (B5). Each
  // entry: { label, reward, isNew, check? }. `isNew` marks first-time
  // attainment; when a `check` clause is present the row is tap-to-expand,
  // revealing the same data-derived "how to earn this" line the level sheet
  // uses — so a completed challenge explains what it actually was.
  const miles = (milestones || []).filter(Boolean);
  if (miles.length) {
    const anyDesc = miles.some((m) => m.check);
    const head = anyDesc
      ? `<div class="recap-head">CHALLENGES <span class="mile-hint">tap to learn</span></div>`
      : "";
    el.overlayMilestones.innerHTML = head + miles.map((m, i) => {
      const desc = m.check ? milestoneDescText(m.check) : "";
      return `<div class="recap-mile${m.isNew ? " new" : ""}${desc ? " challenge" : ""}" data-rc="${i}">` +
        `<span class="recap-star">&#9733;</span>` +
        `<span class="recap-label">${escapeHtml(m.label)}${m.isNew ? " &mdash; NEW!" : ""}</span>` +
        `<span class="recap-reward">${milestoneRewardText(m.reward)}</span>` +
        (desc ? `<span class="recap-chev">&#9662;</span>` : "") +
        `</div>` +
        (desc ? `<div class="recap-desc" data-rc-desc="${i}">${escapeHtml(desc)}</div>` : "");
    }).join("");
    el.overlayMilestones.classList.remove("hidden");
    el.overlayMilestones.querySelectorAll(".recap-mile.challenge").forEach((row) => {
      row.addEventListener("click", () => {
        const i = row.getAttribute("data-rc");
        const d = el.overlayMilestones.querySelector(`.recap-desc[data-rc-desc="${i}"]`);
        const open = row.classList.toggle("open");
        if (d) d.classList.toggle("open", open);
      });
    });
  } else {
    el.overlayMilestones.innerHTML = "";
    el.overlayMilestones.classList.add("hidden");
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
    el.overlayLootHead.classList.remove("hidden");
    el.overlayItems.querySelectorAll("[data-result-item]").forEach((tile) => {
      tile.addEventListener("click", () =>
        showItemDetail(loot[Number(tile.dataset.resultItem)]));
    });
  } else {
    el.overlayItems.innerHTML = "";
    el.overlayItems.classList.add("hidden");
    el.overlayLootHead.classList.add("hidden");
  }
}

export function hideOverlay() {
  el.overlay.className = "hidden";
}

// ---- Live milestone toast (B5) ----
// Brief celebratory banner fired mid-battle when a milestone is reached.
// Queued so back-to-back milestones (e.g. two in one wave) each get a moment
// on screen. pointer-events:none (see CSS) so it never eats a tap; the fade
// is disabled under prefers-reduced-motion.
const toastQueue = [];
let toastActive = false;

export function showMilestoneToast(text) {
  if (!el.milestoneToast) return;
  toastQueue.push(text);
  if (!toastActive) runNextToast();
}

function runNextToast() {
  const t = el.milestoneToast;
  if (!t || toastQueue.length === 0) { toastActive = false; return; }
  toastActive = true;
  t.textContent = toastQueue.shift();
  t.classList.remove("hidden", "show");
  void t.offsetWidth; // restart the CSS entry animation
  t.classList.add("show");
  setTimeout(() => {
    t.classList.remove("show");
    t.classList.add("hidden");
    setTimeout(runNextToast, 180);
  }, 2300);
}
