// ============================================================
// UI — the HTML parts around the canvas: HUD, buttons, overlays.
// ============================================================

import {
  TOWERS, SKILLS, SKILL_VALUES, SKILL_TIERS, TOWER_UPGRADES,
} from "./config.js";
import {
  xpThresholdFor, upgradeCostFor, isUpgradeEligible, sellValueOf,
  masteryRankFor, xpToNextMastery,
} from "./towers.js";
import {
  getSkillTier, nextTierCost, getSkillPoints, buySkill, resetProgress,
  isTowerUnlocked, getProgress, getBestEndlessWave,
} from "./progression.js";

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
  levelOverlay: document.getElementById("level-overlay"),
  levelList: document.getElementById("level-list"),
  actionBar: document.getElementById("action-bar"),
  towerOverlay: document.getElementById("tower-overlay"),
  towerList: document.getElementById("tower-list"),
  towerClose: document.getElementById("tower-close"),
  money: document.getElementById("money-value"),
  wave: document.getElementById("wave-value"),
  core: document.getElementById("core-value"),
  waveButton: document.getElementById("wave-button"),
  waveBtnLabel: document.getElementById("wave-btn-label"),
  waveBtnSub: document.getElementById("wave-btn-sub"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlaySubtitle: document.getElementById("overlay-subtitle"),
  overlayButtons: document.getElementById("overlay-buttons"),
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
      `<span class="tower-button-name">${def.name.replace(" Tower", "").toUpperCase()}</span>` +
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
      : "CLEAR LV 5";
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

// Shows the mission list; completed levels get a check. onPick(level)
// fires when the player chooses one.
export function showLevelSelect(levels, completedIds, onPick) {
  el.actionBar.classList.add("hidden"); // no tower tray on the menu
  el.levelList.innerHTML = "";
  const pick = (level, endless) => {
    el.levelOverlay.classList.add("hidden");
    el.actionBar.classList.remove("hidden");
    onPick(level, endless);
  };

  for (const level of levels) {
    const done = completedIds.includes(level.id);
    const row = document.createElement("div");
    row.className = "level-row";

    const btn = document.createElement("button");
    btn.className = "level-button";
    btn.innerHTML =
      `<span>${level.name.toUpperCase()}</span>` +
      (done ? `<span class="level-done">✓ CLEARED</span>` : `<span></span>`);
    btn.addEventListener("click", () => pick(level, false));
    row.appendChild(btn);

    // Endless mode: unlocked once the campaign is beaten. Waves never
    // stop and escalate fast — see endless.js.
    if (done) {
      const best = getBestEndlessWave(level.id);
      const endlessBtn = document.createElement("button");
      endlessBtn.className = "level-button endless-button";
      endlessBtn.innerHTML =
        `<span>∞ ENDLESS</span>` +
        `<span class="level-done">${best > 0 ? `BEST W${best}` : "NEW"}</span>`;
      endlessBtn.addEventListener("click", () => pick(level, true));
      row.appendChild(endlessBtn);
    }

    el.levelList.appendChild(row);
  }

  // Skill tree entry point on the main menu — with a point count so
  // unspent points are impossible to miss.
  const points = getSkillPoints();
  const skillBtn = document.createElement("button");
  skillBtn.className = "level-button skill-entry";
  skillBtn.innerHTML =
    `<span>SKILL TREE</span>` +
    `<span class="${points > 0 ? "level-points" : "level-done"}">` +
    (points > 0 ? `● ${points} POINT${points === 1 ? "" : "S"} TO SPEND` : "—") +
    `</span>`;
  skillBtn.addEventListener("click", openSkillTree);
  el.levelList.appendChild(skillBtn);

  // Tower guide entry: class specialties + the player's roster.
  const towersBtn = document.createElement("button");
  towersBtn.className = "level-button skill-entry";
  towersBtn.innerHTML = `<span>TOWERS</span><span class="level-done">—</span>`;
  towersBtn.addEventListener("click", openTowerGuide);
  el.levelList.appendChild(towersBtn);

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
  el.levelList.appendChild(resetBtn);

  el.levelOverlay.classList.remove("hidden");
}

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
};

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
    const stats =
      `DMG ${def.baseDamage} · RANGE ${def.baseRange} · ` +
      `${def.baseFireRate}s/shot · $${def.baseCost}` +
      (locked ? " · LOCKED (clear level 5)" : "");
    row.innerHTML =
      `<div class="skill-text">` +
      `<span class="skill-name" style="color:${def.color}">${def.name.toUpperCase()}</span>` +
      `<span class="skill-desc">${stats}</span>` +
      `<span class="skill-desc">${SPECIALTY_TEXT[type] || ""}</span>` +
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

export function onWaveButtonTap(handler) {
  el.waveButton.addEventListener("click", handler);
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
