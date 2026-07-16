// ============================================================
// TUTORIAL — first-play walkthrough state machine (T4).
//
// Game/UI-free logic, same philosophy as the milestone-toast pattern:
// this module only tracks which step is active and gates advancement on
// REAL actions notified from the actual code points in main.js (tray
// selection, tower placement, wave-button tap) — never on a synthetic
// or decoy control. ui.js subscribes via onTutorialChange to render the
// DOM overlay and reposition the spotlight; it never drives gameplay.
//
// Copy + enable switch + the two illustrative tile coordinates live in
// config.js TUTORIAL. The persistent `tutorialDone` flag lives in
// save.js/progression.js (shouldShowTutorial/markTutorialDone), mirroring
// the existing seenTowerGuide pattern.
// ============================================================

import { TUTORIAL } from "./config.js";
import { shouldShowTutorial, markTutorialDone } from "./progression.js";

let active = false;
let stepIndex = -1;
const listeners = [];

function emit() {
  for (const fn of listeners) fn();
}

// Subscribe to every step change (start / advance / skip / finish).
// Handlers should read the new state via currentStep()/isTutorialActive()
// rather than trusting any argument — kept a plain no-arg event on purpose.
export function onTutorialChange(fn) {
  listeners.push(fn);
}

export function isTutorialActive() {
  return active;
}

export function currentStep() {
  return active && stepIndex >= 0 ? TUTORIAL.steps[stepIndex] : null;
}

export function stepNumber() {
  return stepIndex + 1;
}

export function totalSteps() {
  return TUTORIAL.steps.length;
}

// Steps with no real action to gate on (the welcome card and the
// blocked-tile callout) are tap-anywhere-to-continue and freeze the sim
// underneath while they're up (main.js mirrors its existing
// exitConfirming freeze — see isTutorialFreezing). The other three steps
// are non-blocking spotlights over the REAL tray chip / canvas tile /
// wave button, so gameplay input passes straight through and the real
// action itself is what advances the step.
const FREEZE_STEP_IDS = new Set(["welcome", "blockedTile"]);

export function isFreezeStep(step) {
  return !!step && FREEZE_STEP_IDS.has(step.id);
}

export function isTutorialFreezing() {
  return isFreezeStep(currentStep());
}

// Called from main.js startLevel() on EVERY level start (campaign or
// endless, any level). Only actually begins the tutorial when it's
// enabled, this is level_001's campaign (not endless), and the player
// hasn't seen it (or already has prior progress — see progression.js
// backfill). Resets any leftover state from a previous battle either way.
export function maybeStartTutorial(level, endless) {
  active = false;
  stepIndex = -1;
  if (
    TUTORIAL.enabled &&
    !endless &&
    level.id === TUTORIAL.targetLevelId &&
    shouldShowTutorial()
  ) {
    active = true;
    stepIndex = 0;
  }
  emit();
  return active;
}

function finish() {
  active = false;
  stepIndex = -1;
  markTutorialDone();
  emit();
}

// Tap-anywhere (freeze steps) / advancing past the last step.
export function advance() {
  if (!active) return;
  stepIndex += 1;
  if (stepIndex >= TUTORIAL.steps.length) finish();
  else emit();
}

// SKIP TUTORIAL — available on every step.
export function skipTutorial() {
  if (!active) return;
  finish();
}

// ---- notify hooks: called from the REAL action code points in main.js ----
// Each is a no-op unless the tutorial is active AND currently sitting on
// the matching step, so calling them during normal (non-tutorial) play
// costs one cheap comparison and nothing else.

export function notifyTraySelect(type) {
  if (active && type === "laser" && currentStep()?.id === "selectLaser") advance();
}

export function notifyPlacement(ok) {
  if (active && ok && currentStep()?.id === "placeTile") advance();
}

export function notifyWaveStart() {
  if (active && currentStep()?.id === "startWave") advance();
}
