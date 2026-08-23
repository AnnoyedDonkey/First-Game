// ============================================================
// PERFORMANCE — per-device rendered-FPS monitor and effective VFX mode.
//
// This module never reads or writes co-op state. A slow guest can reduce its
// own cosmetic work while the host (and every other guest) keeps its own mode.
// Persistence lives in progression.js; main/ui feed the saved preference in.
// ============================================================

import { PERFORMANCE } from "./config.js";

const MODES = new Set(["auto", "full", "reduced"]);

export function normalizeVisualEffectsMode(mode) {
  return MODES.has(mode) ? mode : "auto";
}

export function createFrameRateMonitor(knobs = PERFORMANCE.monitor) {
  let lastFrameAt = null;
  let windowStartedAt = null;
  let framesInWindow = 0;
  let fps = 0;
  let slowForMs = 0;
  let fastForMs = 0;
  let autoReduced = false;

  function reset(now = null) {
    lastFrameAt = Number.isFinite(now) ? now : null;
    windowStartedAt = Number.isFinite(now) ? now : null;
    framesInWindow = 0;
    slowForMs = 0;
    fastForMs = 0;
  }

  function sample(now) {
    if (!Number.isFinite(now)) return { fps, autoReduced };
    if (lastFrameAt === null) {
      reset(now);
      return { fps, autoReduced };
    }

    const gap = now - lastFrameAt;
    lastFrameAt = now;
    if (gap < 0 || gap > knobs.resetGapMs) {
      reset(now);
      return { fps, autoReduced };
    }

    framesInWindow += 1;
    const elapsed = now - windowStartedAt;
    if (elapsed < knobs.sampleWindowMs) return { fps, autoReduced };

    fps = framesInWindow * 1000 / elapsed;
    framesInWindow = 0;
    windowStartedAt = now;

    if (fps < knobs.reduceBelowFps) {
      slowForMs += elapsed;
      fastForMs = 0;
    } else if (fps > knobs.restoreAboveFps) {
      fastForMs += elapsed;
      slowForMs = 0;
    } else {
      slowForMs = 0;
      fastForMs = 0;
    }

    if (!autoReduced && slowForMs >= knobs.reduceHoldMs) {
      autoReduced = true;
      slowForMs = 0;
    } else if (autoReduced && fastForMs >= knobs.restoreHoldMs) {
      autoReduced = false;
      fastForMs = 0;
    }
    return { fps, autoReduced };
  }

  return {
    sample,
    reset,
    snapshot: () => ({ fps, autoReduced }),
  };
}

const monitor = createFrameRateMonitor();
let selectedMode = "auto";

function syncDocumentHook() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.visualEffectsMode = selectedMode;
  root.dataset.visualEffects = visualEffectsReduced() ? "reduced" : "full";
}

export function setVisualEffectsMode(mode) {
  selectedMode = normalizeVisualEffectsMode(mode);
  syncDocumentHook();
}

export function visualEffectsReduced() {
  if (selectedMode === "reduced") return true;
  if (selectedMode === "full") return false;
  return monitor.snapshot().autoReduced;
}

export function sampleFrameRate(now) {
  monitor.sample(now);
  syncDocumentHook();
  return getPerformanceSnapshot();
}

export function resetFrameRateMonitor(now) {
  monitor.reset(now);
  syncDocumentHook();
}

export function getPerformanceSnapshot() {
  const measured = monitor.snapshot();
  return {
    fps: measured.fps,
    selectedMode,
    reduced: visualEffectsReduced(),
  };
}
