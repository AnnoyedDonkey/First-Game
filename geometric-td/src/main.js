// ============================================================
// MAIN — entry point: canvas setup, game loop, wiring.
// ============================================================

import { DEBUG, TOWERS } from "./config.js";
import { LEVELS } from "./levels.js";
import { createGame, updateGame, startNextWave } from "./game.js";
import {
  placeTower, towerAt, tryUpgradeTower, sellTower,
  seedRosterCounters, refreshTowerStats,
} from "./towers.js";
import {
  getProgress, shouldShowTowerGuide, markTowerGuideSeen, forfeitBattle,
  equipItem, unequipItem, debugGrantGear,
} from "./progression.js";
import { render } from "./renderer.js";
import { bindCanvasInput } from "./input.js";
import {
  updateHUD, onWaveButtonTap, showOverlay,
  initTowerButtons, updateTowerButtons,
  updateUpgradePanel, onUpgradeButtonTap, onSellButtonTap,
  initSkillTree, showLevelSelect, openSkillTree, hideOverlay,
  initSpeedControls, openTowerGuide, onExitButtonTap, openLeaderboard,
  openGearPanel,
} from "./ui.js";
import { submitScore, isEnabled as lbEnabled } from "./leaderboard.js";
import { initUpdateCheck } from "./update.js";
import * as loot from "./loot.js";

const TILE_SIZE = 64; // internal render resolution per tile

// Debug handle for the loot generator (P2) — console-testable per
// LOOT_DESIGN.md, e.g. `loot.lootSelfTest()` or
// `loot.generateItem({ rarity: 'rare', ilvl: 60 })` in DevTools.
window.loot = loot;

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let game = null;
let overlayShown = false;

function refreshDeployedGear(towerName) {
  if (!game) return;
  const rec = getProgress().roster.find((r) => r.name === towerName);
  const tower = game.towers.find((t) => t.name === towerName);
  if (!rec || !tower) return;
  tower.gear = structuredClone(rec.gear);
  refreshTowerStats(game);
}

// Temporary P3 console bridge until P4 adds the stash/equip screens.
// Examples:
//   gear.grant("Laser-01", { unique: "prismLens" })
//   gear.grant("Rocket-01", { unique: "fractalWarhead" })
window.gear = {
  roster: () => getProgress().roster,
  equip(towerName, item) {
    const result = equipItem(towerName, item);
    if (result.ok) refreshDeployedGear(towerName);
    return result;
  },
  unequip(towerName, slot) {
    const result = unequipItem(towerName, slot);
    if (result.ok) refreshDeployedGear(towerName);
    return result;
  },
  grant(towerName, options = {}) {
    const result = debugGrantGear(towerName, options);
    if (result.ok) refreshDeployedGear(towerName);
    return result;
  },
};

function startLevel(level, endless = false) {
  game = createGame(level, TILE_SIZE, endless);
  overlayShown = false;
  hideOverlay();
  // Clear any leftover selection from the previous battle.
  uiState.selectedType = null;
  uiState.selectedDef = null;
  uiState.selectedTower = null;
  uiState.hoverTile = null;
  window.game = game; // debug handle: inspect/tweak state from the console
  // Debug: simulate N seconds instantly (e.g. step(30) in the console).
  window.step = (seconds) => {
    for (let i = 0; i < seconds * 60 && game; i++) updateGame(game, 1 / 60);
  };

  // Internal resolution matches the grid; CSS scales it to fit the
  // screen while preserving aspect ratio.
  canvas.width = level.gridWidth * TILE_SIZE;
  canvas.height = level.gridHeight * TILE_SIZE;
  fitCanvas();

  // First visit to level 2: explain tower classes and specialties.
  if (level.id === "level_002" && shouldShowTowerGuide()) {
    markTowerGuideSeen();
    openTowerGuide();
  }
}

// Size the canvas element to the largest rectangle that fits the
// game area without distorting the grid.
function fitCanvas() {
  const area = document.getElementById("game-area");
  const scale = Math.min(
    area.clientWidth / canvas.width,
    area.clientHeight / canvas.height
  );
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
}

window.addEventListener("resize", fitCanvas);

onWaveButtonTap(() => {
  if (game) startNextWave(game);
});

// ---------- Selection & placement ----------
// uiState is shared with the renderer for previews and range rings.
const uiState = {
  selectedType: null,   // tower type armed for placement
  selectedDef: null,
  selectedTower: null,  // existing tower tapped (shows range)
  hoverTile: null,      // mouse-only ghost preview
  hoverOccupied: false,
};

initTowerButtons((type) => {
  // Tapping the same button again disarms it.
  uiState.selectedType = uiState.selectedType === type ? null : type;
  uiState.selectedDef = uiState.selectedType ? TOWERS[type] : null;
  uiState.selectedTower = null;
});

onUpgradeButtonTap(() => {
  if (uiState.selectedTower) tryUpgradeTower(game, uiState.selectedTower);
});

onSellButtonTap(() => {
  if (!uiState.selectedTower) return;
  sellTower(game, uiState.selectedTower);
  uiState.selectedTower = null; // panel closes, tower tray returns
});

// Roster names continue from the saved roster (no Laser-01 collisions).
seedRosterCounters(getProgress().roster);

// Skill purchases apply to deployed towers immediately.
initSkillTree(() => {
  if (game) refreshTowerStats(game);
});

// Player speed control: 0.5x / pause / 2x (multiplies the game clock).
let speedFactor = 1;
let gamePaused = false;
initSpeedControls((factor, paused) => {
  speedFactor = factor;
  gamePaused = paused;
});

bindCanvasInput(canvas, {
  onTap(p) {
    if (!game) return;
    const ts = game.grid.tileSize;
    const x = Math.floor(p.x / ts);
    const y = Math.floor(p.y / ts);

    if (uiState.selectedType) {
      const result = placeTower(game, uiState.selectedType, x, y);
      if (!result.ok) {
        // Red flash on the rejected tile, then cancel placement mode —
        // tapping anywhere invalid is the "never mind" gesture.
        game.effects.push({
          kind: "tileFlash", x, y, color: "#ff4a5e", ttl: 0.25, maxTtl: 0.25,
        });
        uiState.selectedType = null;
        uiState.selectedDef = null;
        // If the tap landed on an existing tower, select it instead.
        uiState.selectedTower = towerAt(game, x, y);
      }
      // Stay armed after success so you can place several in a row.
    } else {
      // No type armed: tap selects/deselects an existing tower.
      uiState.selectedTower = towerAt(game, x, y);
    }
  },
  onHover(p) {
    if (!p || !game) {
      uiState.hoverTile = null;
      return;
    }
    const ts = game.grid.tileSize;
    const x = Math.floor(p.x / ts);
    const y = Math.floor(p.y / ts);
    uiState.hoverTile = { x, y };
    uiState.hoverOccupied = !!towerAt(game, x, y);
  },
});

function goToMainMenu() {
  game = null;
  window.game = null;
  hideOverlay();
  showLevelSelect(LEVELS, getProgress().completedLevels, startLevel);
}

// One earned item's fate, as decided by progression.js bankEarnedItem
// (U0 auto-equip): "▲ RARE EMITTER → Laser-01", "→ STASH", or "→ UNCLAIMED"
// (pendingLoot triage, only when the stash is full). Plain text for now —
// the U4 pizzazz pass replaces this with the drop-reveal sequence.
function placementText(p) {
  const label = `${p.item.rarity.toUpperCase()} ${p.item.slot.toUpperCase()}`;
  if (p.dest === "equipped") return `▲ ${label} → ${p.towerName}`;
  if (p.dest === "stash") return `${label} → STASH`;
  return `${label} → UNCLAIMED`;
}

function lootLine() {
  const placements = game && game.lootResult ? game.lootResult.placements : null;
  if (!placements || !placements.length) {
    // Stale-deploy fallback: an old progression.js may still report count only.
    const count = game && game.lootResult ? game.lootResult.count : 0;
    return count ? ` Loot recovered: ${count} item${count === 1 ? "" : "s"}.` : "";
  }
  return ` Loot: ${placements.map(placementText).join(" · ")}.`;
}

// Endless reward-track milestones newly crossed this run (progression.js
// grantEndlessRewards) — shards are already banked, loot already sits in
// pendingLoot, this is just telling the player what happened.
function endlessRewardLine() {
  const rewards = game && game.endlessResult ? game.endlessResult.newRewards : null;
  if (!rewards || !rewards.length) return "";
  const parts = rewards.map((m) => {
    const label = m.reward.kind === "shards"
      ? `+${m.reward.amount} Shards`
      : m.placement ? placementText(m.placement) : `a ${m.reward.rarity} item`;
    return `wave ${m.threshold} (${label})`;
  });
  return ` MILESTONE${parts.length > 1 ? "S" : ""} REACHED: ${parts.join(", ")}!`;
}

// The X button: confirm before abandoning a battle in progress. The
// sim is frozen (via exitConfirming, see frame()) while the prompt is up.
let exitConfirming = false;

onExitButtonTap(() => {
  if (!game || overlayShown || exitConfirming) return;
  exitConfirming = true;
  showOverlay({
    title: "FORFEIT BATTLE?",
    subtitle:
      "You'll return to the main menu and this battle ends early — no " +
      "win, no completion credit. Your towers keep the XP they've " +
      "earned so far.",
    type: "loss",
    buttons: [
      {
        text: "FORFEIT",
        onTap: () => {
          exitConfirming = false;
          forfeitBattle(game);
          game.phase = "lost";
          overlayShown = true;
          showOverlay({
            title: "BATTLE FORFEITED",
            subtitle:
              "You returned with no win or completion credit. Your towers kept " +
              `their XP and shards earned so far.${lootLine()}`,
            type: "loss",
            buttons: [
              { text: "CLAIM LOOT", onTap: () => openGearPanel({ closeMode: "triage" }) },
              { text: "MAIN MENU", onTap: goToMainMenu, secondary: true },
            ],
          });
        },
      },
      {
        text: "CANCEL",
        onTap: () => { exitConfirming = false; hideOverlay(); },
        secondary: true,
      },
    ],
  });
});

function checkEndState() {
  if (overlayShown) return;

  if (game.phase === "won") {
    overlayShown = true;
    const currentIndex = LEVELS.indexOf(game.level);
    const next = LEVELS[currentIndex + 1];
    const buttons = [];
    if (next) {
      buttons.push({ text: `NEXT: ${next.name.toUpperCase()}`, onTap: () => startLevel(next) });
    }
    buttons.push(
      { text: "CLAIM LOOT", onTap: () => openGearPanel({ closeMode: "triage" }), secondary: !!next },
      { text: "ASSIGN SKILL POINTS", onTap: openSkillTree, secondary: !!next },
      { text: "MAIN MENU", onTap: goToMainMenu, secondary: true },
    );
    showOverlay({
      title: "CORE DEFENDED",
      subtitle:
        `All ${game.totalWaves} waves repelled. +1 skill point earned. ` +
        `Your towers joined the roster and keep their XP.${lootLine()}`,
      type: "win",
      buttons,
    });
  } else if (game.phase === "lost") {
    overlayShown = true;
    const level = game.level;
    if (game.endless) {
      const { waveReached, isNewBest, bestWave } = game.endlessResult;
      // Auto-publish a new best to the shared board (best-effort, silent;
      // only fires if a nickname is set — see leaderboard.js). A failed
      // network call can't affect the overlay below.
      if (isNewBest) submitScore(level.id, waveReached);
      const buttons = [
        { text: "RETRY ENDLESS", onTap: () => startLevel(level, true) },
      ];
      if (lbEnabled()) {
        buttons.push({ text: "LEADERBOARD", onTap: () => openLeaderboard(LEVELS), secondary: true });
      }
      buttons.push(
        { text: "CLAIM LOOT", onTap: () => openGearPanel({ closeMode: "triage" }), secondary: true },
        { text: "ASSIGN SKILL POINTS", onTap: openSkillTree, secondary: true },
        { text: "MAIN MENU", onTap: goToMainMenu, secondary: true },
      );
      showOverlay({
        title: "RUN OVER",
        subtitle:
          `${level.name.toUpperCase()} ENDLESS — reached wave ${waveReached}` +
          (isNewBest ? ", a NEW BEST!" : ` (best: wave ${bestWave})`) +
          ` Your towers kept their XP.${lootLine()}${endlessRewardLine()}`,
        type: "loss",
        buttons,
      });
    } else {
      showOverlay({
        title: "CORE DESTROYED",
        subtitle:
          `The core fell on wave ${game.waveIndex + 1}. Your towers kept ` +
          `their XP — spend skill points, redeploy veterans, try new spots.`,
        type: "loss",
        buttons: [
          { text: "RETRY", onTap: () => startLevel(level) },
          { text: "CLAIM LOOT", onTap: () => openGearPanel({ closeMode: "triage" }), secondary: true },
          { text: "ASSIGN SKILL POINTS", onTap: openSkillTree, secondary: true },
          { text: "MAIN MENU", onTap: goToMainMenu, secondary: true },
        ],
      });
    }
  }
}

// ---------- Game loop ----------
let lastTime = performance.now();

function frame(now) {
  // Clamp dt so a backgrounded tab doesn't cause a huge jump.
  // Paused = zero-length ticks: the world freezes but still renders.
  // Also freezes while the forfeit-confirm prompt is up.
  const dt =
    Math.min((now - lastTime) / 1000, 0.05) *
    DEBUG.gameSpeed * (gamePaused || exitConfirming ? 0 : speedFactor);
  lastTime = now;

  if (game) {
    // Self-heal: if the canvas was sized while the page was hidden
    // (layout reports 0), fit it again now that we're visible.
    if (canvas.style.width === "0px") fitCanvas();
    updateGame(game, dt);
    render(ctx, game, game.time, uiState);
    updateHUD(game);
    updateTowerButtons(game, uiState.selectedType);
    updateUpgradePanel(game, uiState.selectedTower);
    checkEndState();
  }

  requestAnimationFrame(frame);
}

// Boot into the mission list; the loop starts once a level is picked.
showLevelSelect(LEVELS, getProgress().completedLevels, startLevel);
requestAnimationFrame(frame);

// Watch for newer deploys (matters most for iPhone home-screen installs).
initUpdateCheck();
