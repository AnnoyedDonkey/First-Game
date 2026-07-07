// ============================================================
// UI — the HTML parts around the canvas: HUD, buttons, overlays.
// ============================================================

import { TOWERS, SKILLS } from "./config.js";
import { xpThresholdFor, upgradeCostFor, isUpgradeEligible } from "./towers.js";
import { hasSkill, getSkillPoints, buySkill, resetProgress } from "./progression.js";

const el = {
  towerButtons: document.getElementById("tower-buttons"),
  upgradePanel: document.getElementById("upgrade-panel"),
  upName: document.getElementById("up-name"),
  upLevel: document.getElementById("up-level"),
  upXp: document.getElementById("up-xp"),
  upKills: document.getElementById("up-kills"),
  upgradeButton: document.getElementById("upgrade-button"),
  skillsButton: document.getElementById("skills-button"),
  skillPoints: document.getElementById("skill-points-value"),
  skillOverlay: document.getElementById("skill-overlay"),
  skillPointsLine: document.getElementById("skill-points-line"),
  skillList: document.getElementById("skill-list"),
  skillClose: document.getElementById("skill-close"),
  resetSave: document.getElementById("reset-save"),
  levelOverlay: document.getElementById("level-overlay"),
  levelList: document.getElementById("level-list"),
  money: document.getElementById("money-value"),
  wave: document.getElementById("wave-value"),
  core: document.getElementById("core-value"),
  waveButton: document.getElementById("wave-button"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlaySubtitle: document.getElementById("overlay-subtitle"),
  overlayButtons: document.getElementById("overlay-buttons"),
};

// Cache last-drawn values so we only touch the DOM when they change.
const last = {};

function setText(node, key, value) {
  if (last[key] === value) return;
  last[key] = value;
  node.textContent = value;
}

export function updateHUD(game) {
  setText(el.money, "money", String(game.money));

  const waveNum = Math.min(game.waveIndex + 1, game.totalWaves);
  setText(el.wave, "wave", `${waveNum}/${game.totalWaves}`);

  setText(el.core, "core", `${game.coreHealth}/${game.maxCoreHealth}`);
  el.core.classList.toggle("danger", game.coreHealth <= game.maxCoreHealth * 0.3);

  setText(el.skillPoints, "skillPoints", String(getSkillPoints()));

  updateWaveButton(game);
}

function updateWaveButton(game) {
  let label;
  let disabled;

  switch (game.phase) {
    case "ready":
      label = `START WAVE ${game.waveIndex + 1}`;
      disabled = false;
      break;
    case "countdown":
      label = `NEXT IN ${Math.ceil(game.countdown)}s`;
      disabled = false; // tapping starts the wave early
      break;
    case "wave":
      label = `WAVE ${game.waveIndex + 1} ACTIVE`;
      disabled = true;
      break;
    default:
      label = "—";
      disabled = true;
  }

  setText(el.waveButton, "waveButton", label);
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

// Highlight the selected type; grey out unaffordable towers.
export function updateTowerButtons(game, selectedType) {
  for (const [type, btn] of Object.entries(towerButtonRefs)) {
    const affordable = game.money >= TOWERS[type].baseCost;
    const stateKey = `towerBtn:${type}`;
    const state = `${affordable}:${selectedType === type}`;
    if (last[stateKey] === state) continue;
    last[stateKey] = state;
    btn.disabled = !affordable;
    btn.classList.toggle("selected", selectedType === type);
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

  setText(el.upName, "upName", tower.name);
  // Veterans show their unlocked potential, e.g. "LV 1/3".
  const lvText = tower.maxUnlockedLevel > tower.level
    ? `LV ${tower.level}/${tower.maxUnlockedLevel}`
    : `LV ${tower.level}`;
  setText(el.upLevel, "upLevel", lvText);
  setText(el.upKills, "upKills", `${tower.kills} KILLS`);
  setText(
    el.upXp, "upXp",
    threshold === null ? `XP ${tower.xp}` : `XP ${tower.xp}/${threshold}`
  );

  // Button: what's between this tower and its next level?
  let label, disabled;
  if (threshold === null) {
    label = "MAX LEVEL";
    disabled = true;
  } else if (!eligible) {
    label = "NEED XP";
    disabled = true;
  } else if (game.money < cost) {
    label = `$${cost}`;
    disabled = true;
  } else {
    // "Restore" when re-buying a level the veteran already earned.
    const verb = tower.level < tower.maxUnlockedLevel ? "RESTORE" : "UPGRADE";
    label = `${verb} $${cost}`;
    disabled = false;
  }

  setText(el.upgradeButton, "upBtn", label);
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

// ---------- Level select ----------

// Shows the mission list; completed levels get a check. onPick(level)
// fires when the player chooses one.
export function showLevelSelect(levels, completedIds, onPick) {
  el.levelList.innerHTML = "";
  for (const level of levels) {
    const done = completedIds.includes(level.id);
    const btn = document.createElement("button");
    btn.className = "level-button";
    btn.innerHTML =
      `<span>${level.name.toUpperCase()}</span>` +
      (done ? `<span class="level-done">✓ CLEARED</span>` : `<span></span>`);
    btn.addEventListener("click", () => {
      el.levelOverlay.classList.add("hidden");
      onPick(level);
    });
    el.levelList.appendChild(btn);
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

  el.levelOverlay.classList.remove("hidden");
}

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

function renderSkillList(onSkillBought) {
  el.skillPointsLine.textContent = `AVAILABLE POINTS: ${getSkillPoints()} — win battles to earn more`;
  el.skillList.innerHTML = "";

  for (const [id, def] of Object.entries(SKILLS)) {
    const row = document.createElement("div");
    row.className = "skill-row";

    const text = document.createElement("div");
    text.className = "skill-text";
    text.innerHTML =
      `<span class="skill-name">${def.name}</span>` +
      `<span class="skill-desc">${def.desc}</span>`;

    const buy = document.createElement("button");
    buy.className = "skill-buy";
    if (hasSkill(id)) {
      buy.textContent = "OWNED";
      buy.classList.add("owned");
      buy.disabled = true;
    } else {
      buy.textContent = `${def.cost} PT`;
      buy.disabled = getSkillPoints() < def.cost;
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
