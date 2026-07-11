// ============================================================
// UI — the HTML parts around the canvas: HUD, buttons, overlays.
// ============================================================

import {
  TOWERS, ENEMIES, SKILLS, SKILL_VALUES, SKILL_TIERS, TOWER_UPGRADES, LOOT,
} from "./config.js";
import {
  xpThresholdFor, upgradeCostFor, isUpgradeEligible, sellValueOf,
  masteryRankFor, xpToNextMastery,
} from "./towers.js";
import {
  getSkillTier, nextTierCost, getSkillPoints, buySkill, resetProgress,
  isTowerUnlocked, getProgress, getBestEndlessWave, getShards, getEndlessMilestones,
  getStash, getPendingLoot, stashSlotsFree, claimPendingLoot,
  discardPendingLoot, sellStashItem, sellPendingItem, sellAllStashRarity,
  equipStashItem, unequipToStash,
  getStoreStock, storeRerollCost, rerollStore, buyStoreItem,
} from "./progression.js";
import { canEquipItem, GEAR_SLOTS, masteryRankFor as gearMasteryRankFor } from "./equipment.js";
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
  actionBar: document.getElementById("action-bar"),
  towerOverlay: document.getElementById("tower-overlay"),
  towerList: document.getElementById("tower-list"),
  towerClose: document.getElementById("tower-close"),
  gearOverlay: document.getElementById("gear-overlay"),
  gearList: document.getElementById("gear-list"),
  gearLine: document.getElementById("gear-line"),
  gearClose: document.getElementById("gear-close"),
  storeOverlay: document.getElementById("store-overlay"),
  storeList: document.getElementById("store-list"),
  storeLine: document.getElementById("store-line"),
  storeClose: document.getElementById("store-close"),
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
forwardWheel(el.gearOverlay, el.gearList);
forwardWheel(el.storeOverlay, el.storeList);

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
  renderWorld();
}

function renderWorld() {
  el.shardsValue.textContent = String(getShards());

  const world = WORLDS[currentWorld];
  const unlocked = isWorldUnlocked(currentWorld);
  const { completedIds, levelById, pick } = menuCtx;

  // --- Header: name (+ lock accent), page dots, arrow states ---
  el.worldName.textContent = world.name;
  el.worldName.classList.toggle("locked", !unlocked);
  el.worldDots.innerHTML = WORLDS.map(
    (_, i) => `<span class="dot${i === currentWorld ? " active" : ""}"></span>`
  ).join("");

  el.worldPrev.disabled = currentWorld === 0;
  const hasNext = currentWorld < WORLDS.length - 1;
  el.worldNext.disabled = !hasNext;
  // A next world that's still gated gets the gold "locked" arrow accent
  // (it's tappable — tapping previews it).
  el.worldNext.classList.toggle("locked", hasNext && !isWorldUnlocked(currentWorld + 1));

  // --- Level rows for this world ---
  el.levelList.innerHTML = "";

  if (!unlocked) {
    const note = document.createElement("div");
    note.className = "world-locked-note";
    note.textContent =
      `LOCKED — clear all of ${WORLDS[currentWorld - 1].name} to unlock ${world.name}.`;
    el.levelList.appendChild(note);
  }

  for (const id of world.levelIds) {
    const level = levelById.get(id);
    if (!level) continue;
    const done = completedIds.includes(level.id);

    const row = document.createElement("div");
    row.className = "level-row";

    const btn = document.createElement("button");
    btn.className = "level-button" + (unlocked ? "" : " locked");
    const tag = done
      ? `<span class="level-done">✓ CLEARED</span>`
      : unlocked
        ? `<span></span>`
        : `<span class="level-done">🔒</span>`;
    btn.innerHTML = `<span>${level.name.toUpperCase()}</span>` + tag;
    if (unlocked) btn.addEventListener("click", () => pick(level, false));
    else btn.disabled = true;
    row.appendChild(btn);

    // Endless mode: unlocked once the campaign level is beaten. Waves
    // never stop and escalate fast — see endless.js.
    if (unlocked && done) {
      const best = getBestEndlessWave(level.id);
      const milestones = getEndlessMilestones(level.id);
      const claimedCount = milestones.filter((m) => m.claimed).length;
      const endlessBtn = document.createElement("button");
      endlessBtn.className = "level-button endless-button";
      endlessBtn.innerHTML =
        `<span>∞ ENDLESS</span>` +
        `<span class="level-done">${best > 0 ? `BEST W${best}` : "NEW"}</span>` +
        `<span class="level-done endless-milestones">★ ${claimedCount}/${milestones.length}</span>`;
      endlessBtn.addEventListener("click", () => pick(level, true));
      row.appendChild(endlessBtn);
    }

    el.levelList.appendChild(row);
  }

  appendGlobalMenuButtons();
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

  // Tower guide: class specialties + the player's roster.
  const towersBtn = document.createElement("button");
  towersBtn.className = "level-button skill-entry";
  towersBtn.innerHTML = `<span>TOWERS</span><span class="level-done">—</span>`;
  towersBtn.addEventListener("click", openTowerGuide);
  topRow.appendChild(towersBtn);

  const pending = getPendingLoot().length;
  const stash = getStash().length;
  const gearBtn = document.createElement("button");
  gearBtn.className = "level-button skill-entry gear-entry";
  gearBtn.innerHTML =
    `<span>GEAR</span>` +
    `<span class="${pending ? "level-points" : "level-done"}">` +
    (pending ? `${pending} NEW` : `${stash}/${LOOT.stash.stashSize}`) +
    `</span>`;
  gearBtn.addEventListener("click", () => openGearPanel());
  topRow.appendChild(gearBtn);

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

export function openTowerGuide() {
  el.towerList.innerHTML = "";

  const classHeader = document.createElement("div");
  classHeader.className = "tower-section";
  classHeader.textContent = "TOWER CLASSES";
  el.towerList.appendChild(classHeader);

  for (const [type, def] of Object.entries(TOWERS)) {
    const row = document.createElement("div");
    row.className = "skill-row";
    const locked = !isTowerUnlocked(type);
    const rangeStr = def.baseRange >= 50 ? "GLOBAL" : def.baseRange;
    const stats =
      `DMG ${def.baseDamage} · RANGE ${rangeStr} · ` +
      `${def.baseFireRate}s/shot · $${def.baseCost}` +
      (locked ? ` · LOCKED (${def.unlockLabel || "locked"})` : "");
    row.innerHTML =
      `<div class="skill-text">` +
      `<span class="skill-name" style="color:${def.color}">${def.name.toUpperCase()}</span>` +
      `<span class="skill-desc">${stats}</span>` +
      `<span class="skill-desc">${ROLE_TEXT[type] || ""}</span>` +
      `<span class="skill-desc">${SPECIALTY_TEXT[type] || ""}</span>` +
      `</div>`;
    el.towerList.appendChild(row);
  }

  // Enemy cheat-sheet: what beats what (drives combo choices per level).
  const enemyHeader = document.createElement("div");
  enemyHeader.className = "tower-section";
  enemyHeader.textContent = "KNOW YOUR ENEMY";
  el.towerList.appendChild(enemyHeader);

  for (const [, edef] of Object.entries(ENEMIES)) {
    if (edef.name === "Splitling") continue; // covered by Splitter
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML =
      `<div class="skill-text">` +
      `<span class="skill-name" style="color:${edef.color}">${edef.name.toUpperCase()}</span>` +
      `<span class="skill-desc">${counterText(edef)}</span>` +
      `</div>`;
    el.towerList.appendChild(row);
  }

  const rosterHeader = document.createElement("div");
  rosterHeader.className = "tower-section";
  rosterHeader.textContent = "YOUR ROSTER";
  el.towerList.appendChild(rosterHeader);

  const roster = [...getProgress().roster].sort(
    (a, b) => b.maxLevel - a.maxLevel || b.kills - a.kills
  );
  if (roster.length === 0) {
    const empty = document.createElement("div");
    empty.className = "skill-row";
    empty.innerHTML =
      `<div class="skill-text"><span class="skill-desc">` +
      `No towers yet — every tower you build joins your permanent roster ` +
      `and keeps its XP between battles.</span></div>`;
    el.towerList.appendChild(empty);
  }
  for (const rec of roster) {
    const def = TOWERS[rec.type];
    const rank = masteryRankFor(rec.xp);
    const pct = Math.round(rank * TOWER_UPGRADES.mastery.damagePerRank * 100);
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML =
      `<div class="skill-text">` +
      `<span class="skill-name" style="color:${def.color}">${rec.name}` +
      (rank > 0 ? ` <span class="skill-pips">★${rank}</span>` : "") +
      `</span>` +
      `<span class="skill-desc">${def.name} · MAX LV ${rec.maxLevel}` +
      (rank > 0 ? ` · MASTERY +${pct}% DMG` : "") +
      ` · ${rec.xp} XP · ${rec.kills} kills</span>` +
      `</div>`;
    el.towerList.appendChild(row);
  }

  el.towerOverlay.classList.remove("hidden");
}

el.towerClose.addEventListener("click", () => {
  el.towerOverlay.classList.add("hidden");
});

// ---------- Gear overlay ----------

let gearCloseMode = "normal";

function itemUniqueName(item) {
  if (!item || !item.unique) return "";
  const named = LOOT.gen.uniques.named.find((u) => u.id === item.unique);
  const minor = LOOT.gen.uniques.minor.find((u) => u.id === item.unique);
  return (named || minor || {}).name || item.unique;
}

function itemTitle(item) {
  const slot = item.slot.toUpperCase();
  const lock = item.towerType ? `${TOWERS[item.towerType].prefix}-ONLY` : "UNIVERSAL";
  const unique = itemUniqueName(item);
  return unique ? `${unique.toUpperCase()} ${slot}` : `${item.rarity.toUpperCase()} ${slot} ${lock}`;
}

function itemReqText(item) {
  return item.reqMastery ? `REQ STAR ${item.reqMastery}` : `REQ LV ${item.reqLevel}`;
}

function itemAffixText(item) {
  const affixes = (item.affixes || []).map((a) => `${a.stat} +${a.value}`).join(" / ");
  const unique = itemUniqueName(item);
  return `${itemReqText(item)} / ILVL ${item.ilvl}` +
    (item.towerType ? ` / ${TOWERS[item.towerType].name}` : " / any tower") +
    (unique ? ` / ${unique}` : "") +
    (affixes ? ` / ${affixes}` : "");
}

function itemClass(item) {
  return `gear-item rarity-${item.rarity}`;
}

function compatibleRoster(item) {
  return [...getProgress().roster].filter((rec) => canEquipItem(rec, item).ok);
}

function renderItemText(item) {
  const text = document.createElement("div");
  text.className = "gear-text";
  text.innerHTML =
    `<span class="gear-name">${escapeHtml(itemTitle(item))}</span>` +
    `<span class="gear-desc">${escapeHtml(itemAffixText(item))}</span>`;
  return text;
}

function renderPendingSection() {
  const pending = getPendingLoot();
  if (!pending.length) return;

  const header = document.createElement("div");
  header.className = "tower-section gear-section";
  header.textContent = "UNCLAIMED DROPS";
  el.gearList.appendChild(header);

  const actions = document.createElement("div");
  actions.className = "gear-actions-row";

  const claim = document.createElement("button");
  claim.className = "gear-action";
  claim.textContent = `CLAIM (${stashSlotsFree()} FREE)`;
  claim.disabled = stashSlotsFree() <= 0;
  claim.addEventListener("click", () => { claimPendingLoot(); renderGearPanel(); });
  actions.appendChild(claim);

  const discard = document.createElement("button");
  discard.className = "gear-action danger";
  discard.textContent = "LEAVE DROPS";
  discard.addEventListener("click", () => {
    if (discard.classList.contains("confirming")) {
      discardPendingLoot();
      renderGearPanel();
    } else {
      discard.classList.add("confirming");
      discard.textContent = "LOSE THEM? TAP AGAIN";
    }
  });
  actions.appendChild(discard);
  el.gearList.appendChild(actions);

  for (const item of pending) {
    const row = document.createElement("div");
    row.className = itemClass(item);
    row.appendChild(renderItemText(item));
    const sell = document.createElement("button");
    sell.className = "gear-mini";
    sell.textContent = `SELL +${LOOT.gen.sellValues[item.rarity] || 0}`;
    sell.addEventListener("click", () => { sellPendingItem(item.id); renderGearPanel(); });
    row.appendChild(sell);
    el.gearList.appendChild(row);
  }
}

function renderRosterGear() {
  const roster = [...getProgress().roster].sort(
    (a, b) => b.maxLevel - a.maxLevel || b.xp - a.xp
  );
  const header = document.createElement("div");
  header.className = "tower-section gear-section";
  header.textContent = "EQUIPPED";
  el.gearList.appendChild(header);

  if (!roster.length) {
    const empty = document.createElement("div");
    empty.className = "gear-empty";
    empty.textContent = "Build towers in battle to create roster units that can wear gear.";
    el.gearList.appendChild(empty);
    return;
  }

  for (const rec of roster) {
    const def = TOWERS[rec.type];
    const rank = gearMasteryRankFor(rec.xp);
    const row = document.createElement("div");
    row.className = "gear-roster-row";
    row.innerHTML =
      `<div class="gear-roster-title" style="color:${def.color}">` +
      `${escapeHtml(rec.name)} / ${escapeHtml(def.name)} / LV ${rec.maxLevel}` +
      (rank ? ` / STAR ${rank}` : "") +
      `</div>`;
    const slots = document.createElement("div");
    slots.className = "gear-slots";
    const gear = rec.gear || {};
    for (const slot of GEAR_SLOTS) {
      const slotRow = document.createElement("div");
      slotRow.className = "gear-slot";
      const item = gear[slot];
      slotRow.innerHTML =
        `<span class="gear-slot-name">${slot.toUpperCase()}</span>` +
        `<span class="gear-slot-item">${item ? escapeHtml(itemTitle(item)) : "empty"}</span>`;
      if (item) {
        const unequip = document.createElement("button");
        unequip.className = "gear-mini";
        unequip.textContent = "UNEQUIP";
        unequip.addEventListener("click", () => { unequipToStash(rec.name, slot); renderGearPanel(); });
        slotRow.appendChild(unequip);
      }
      slots.appendChild(slotRow);
    }
    row.appendChild(slots);
    el.gearList.appendChild(row);
  }
}

function renderStashSection() {
  const stash = getStash();
  const header = document.createElement("div");
  header.className = "tower-section gear-section";
  header.textContent = `STASH ${stash.length}/${LOOT.stash.stashSize}`;
  el.gearList.appendChild(header);

  const bulk = document.createElement("div");
  bulk.className = "gear-actions-row";
  for (const rarity of ["common", "enhanced", "rare"]) {
    const btn = document.createElement("button");
    btn.className = `gear-action rarity-${rarity}`;
    btn.textContent = `SELL ${rarity.toUpperCase()}`;
    btn.addEventListener("click", () => { sellAllStashRarity(rarity); renderGearPanel(); });
    bulk.appendChild(btn);
  }
  el.gearList.appendChild(bulk);

  if (!stash.length) {
    const empty = document.createElement("div");
    empty.className = "gear-empty";
    empty.textContent = "No stored gear yet. Every battle now grants at least one drop.";
    el.gearList.appendChild(empty);
    return;
  }

  for (const item of stash) {
    const row = document.createElement("div");
    row.className = itemClass(item);
    row.appendChild(renderItemText(item));

    const controls = document.createElement("div");
    controls.className = "gear-item-controls";
    const compatible = compatibleRoster(item);
    const select = document.createElement("select");
    select.className = "gear-select";
    if (compatible.length) {
      for (const rec of compatible) {
        const opt = document.createElement("option");
        opt.value = rec.name;
        opt.textContent = rec.name;
        select.appendChild(opt);
      }
    } else {
      const opt = document.createElement("option");
      opt.textContent = "NO MATCH";
      select.appendChild(opt);
      select.disabled = true;
    }
    controls.appendChild(select);

    const equip = document.createElement("button");
    equip.className = "gear-mini";
    equip.textContent = "EQUIP";
    equip.disabled = !compatible.length;
    equip.addEventListener("click", () => { equipStashItem(select.value, item.id); renderGearPanel(); });
    controls.appendChild(equip);

    const sell = document.createElement("button");
    sell.className = "gear-mini";
    sell.textContent = `SELL +${LOOT.gen.sellValues[item.rarity] || 0}`;
    sell.addEventListener("click", () => { sellStashItem(item.id); renderGearPanel(); });
    controls.appendChild(sell);

    row.appendChild(controls);
    el.gearList.appendChild(row);
  }
}

function renderGearPanel() {
  const pending = getPendingLoot().length;
  el.gearClose.classList.remove("confirming");
  el.gearClose.textContent = "CLOSE";
  el.gearLine.textContent =
    `SHARDS ${getShards()} / STASH ${getStash().length}/${LOOT.stash.stashSize}` +
    (pending ? ` / ${pending} UNCLAIMED` : "");
  el.gearList.innerHTML = "";
  renderPendingSection();
  renderRosterGear();
  renderStashSection();
}

export function openGearPanel({ closeMode = "normal" } = {}) {
  gearCloseMode = closeMode;
  renderGearPanel();
  el.gearOverlay.classList.remove("hidden");
}

function closeGearPanel() {
  if (getPendingLoot().length && gearCloseMode === "triage") {
    if (!el.gearClose.classList.contains("confirming")) {
      el.gearClose.classList.add("confirming");
      el.gearClose.textContent = `${getPendingLoot().length} DROPS UNCLAIMED - TAP TO LEAVE`;
      return;
    }
    discardPendingLoot();
  }
  el.gearClose.classList.remove("confirming");
  el.gearClose.textContent = "CLOSE";
  el.gearOverlay.classList.add("hidden");
}

el.gearClose.addEventListener("click", closeGearPanel);

// ---------- Store overlay ----------

function renderStorePanel() {
  const stock = getStoreStock();
  const free = stashSlotsFree();
  const rerollCost = storeRerollCost();
  el.storeLine.textContent = `SHARDS ${getShards()} / STASH ${getStash().length}/${LOOT.stash.stashSize}`;
  el.storeList.innerHTML = "";

  const actions = document.createElement("div");
  actions.className = "gear-actions-row";
  const reroll = document.createElement("button");
  reroll.className = "gear-action store-reroll";
  reroll.textContent = `REROLL ◆ ${rerollCost}`;
  reroll.disabled = getShards() < rerollCost;
  reroll.addEventListener("click", () => { rerollStore(); renderStorePanel(); });
  actions.appendChild(reroll);
  el.storeList.appendChild(actions);

  if (!stock.length) {
    const empty = document.createElement("div");
    empty.className = "gear-empty";
    empty.textContent = "SOLD OUT — reroll to restock.";
    el.storeList.appendChild(empty);
    return;
  }

  for (const item of stock) {
    const row = document.createElement("div");
    row.className = itemClass(item);
    row.appendChild(renderItemText(item));
    const buy = document.createElement("button");
    buy.className = "gear-action store-buy";
    const price = LOOT.store.prices[item.rarity] || 0;
    buy.textContent = free > 0 ? `BUY ◆ ${price}` : "STASH FULL";
    buy.disabled = free <= 0 || getShards() < price;
    buy.addEventListener("click", () => { buyStoreItem(item.id); renderStorePanel(); });
    row.appendChild(buy);
    el.storeList.appendChild(row);
  }
}

export function openStorePanel() {
  renderStorePanel();
  el.storeOverlay.classList.remove("hidden");
}

el.storeClose.addEventListener("click", () => {
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
export function showOverlay({ title, subtitle, type, buttons }) {
  el.overlayTitle.textContent = title;
  el.overlaySubtitle.textContent = subtitle;
  el.overlay.className = type; // "win" or "loss"

  el.overlayButtons.innerHTML = "";
  for (const spec of buttons) {
    const btn = document.createElement("button");
    btn.className = "big-button" + (spec.secondary ? " secondary" : "");
    btn.textContent = spec.text;
    btn.addEventListener("click", spec.onTap);
    el.overlayButtons.appendChild(btn);
  }
}

export function hideOverlay() {
  el.overlay.className = "hidden";
}
