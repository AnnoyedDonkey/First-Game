// ============================================================
// MAIN — entry point: canvas setup, game loop, wiring.
// ============================================================

import { DEBUG, TOWERS } from "./config.js";
import { LEVELS } from "./levels.js";
import { createGame, updateGame, startNextWave } from "./game.js";
import {
  placeTower, towerAt, tryUpgradeTower,
  seedRosterCounters, refreshTowerStats,
} from "./towers.js";
import { getProgress } from "./progression.js";
import { render } from "./renderer.js";
import { bindCanvasInput } from "./input.js";
import {
  updateHUD, onWaveButtonTap, showOverlay,
  initTowerButtons, updateTowerButtons,
  updateUpgradePanel, onUpgradeButtonTap,
  initSkillTree, showLevelSelect,
} from "./ui.js";

const TILE_SIZE = 64; // internal render resolution per tile

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

let game = null;
let overlayShown = false;

function startLevel(level) {
  game = createGame(level, TILE_SIZE);
  overlayShown = false;
  window.game = game; // debug handle: inspect/tweak state from the console
  // Debug: simulate N seconds instantly (e.g. step(30) in the console).
  window.step = (seconds) => {
    for (let i = 0; i < seconds * 60; i++) updateGame(game, 1 / 60);
  };

  // Internal resolution matches the grid; CSS scales it to fit the
  // screen while preserving aspect ratio.
  canvas.width = level.gridWidth * TILE_SIZE;
  canvas.height = level.gridHeight * TILE_SIZE;
  fitCanvas();
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

// Roster names continue from the saved roster (no L-01 collisions).
seedRosterCounters(getProgress().roster);

// Skill purchases apply to deployed towers immediately.
initSkillTree(() => {
  if (game) refreshTowerStats(game);
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

function checkEndState() {
  if (overlayShown) return;

  if (game.phase === "won") {
    overlayShown = true;
    showOverlay({
      title: "CORE DEFENDED",
      subtitle:
        `All ${game.totalWaves} waves repelled. +1 skill point. ` +
        `Your towers joined the roster and keep their XP.`,
      buttonText: "PLAY AGAIN",
      type: "win",
      onButton: () => location.reload(),
    });
  } else if (game.phase === "lost") {
    overlayShown = true;
    showOverlay({
      title: "CORE DESTROYED",
      subtitle:
        `The core fell on wave ${game.waveIndex + 1}. ` +
        `Your towers kept their XP — redeploy them and try again.`,
      buttonText: "RETRY",
      type: "loss",
      onButton: () => location.reload(),
    });
  }
}

// ---------- Game loop ----------
let lastTime = performance.now();

function frame(now) {
  // Clamp dt so a backgrounded tab doesn't cause a huge jump.
  const dt = Math.min((now - lastTime) / 1000, 0.05) * DEBUG.gameSpeed;
  lastTime = now;

  if (game) {
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
