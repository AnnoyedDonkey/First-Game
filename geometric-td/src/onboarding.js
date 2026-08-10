// ============================================================
// ONBOARDING — first-load narrative intro state machine (P1).
//
// Simpler cousin of tutorial.js: a linear tap-through over
// NARRATIVE.intro, no spotlight/freeze plumbing (it only ever shows over
// the menu, never mid-battle). Copy lives in config.js NARRATIVE. The
// persistent `onboardingDone` flag + `playerName` live in save.js/
// progression.js (shouldShowOnboarding/markOnboardingDone/setPlayerName),
// mirroring the tutorial's shouldShowTutorial/markTutorialDone pattern.
//
// Game/UI-free logic — importable with zero side effects. ui.js
// subscribes via onOnboardingChange to render the DOM overlay; it never
// drives gameplay.
// ============================================================

import { NARRATIVE } from "./config.js";
import { markOnboardingDone, setPlayerName } from "./progression.js";

let active = false;
let index = -1;
const listeners = [];

function emit() {
  for (const fn of listeners) fn();
}

// Subscribe to every state change (start / advance / skip / finish).
// Handlers should read the new state via currentCard()/isOnboardingActive()
// rather than trusting any argument — kept a plain no-arg event on purpose.
export function onOnboardingChange(fn) {
  listeners.push(fn);
}

export function isOnboardingActive() {
  return active;
}

export function currentCard() {
  return active && index >= 0 ? NARRATIVE.intro[index] : null;
}

export function cardNumber() {
  return index + 1;
}

export function totalCards() {
  return NARRATIVE.intro.length;
}

// Called at boot (when the player hasn't seen it yet) and from the menu's
// REPLAY INTRO entry (re-runs the sequence any time; markOnboardingDone
// is idempotent so replaying never un-marks it for a fresh player).
export function startOnboarding() {
  if (!NARRATIVE.enabled) return;
  active = true;
  index = 0;
  emit();
}

function finish() {
  active = false;
  index = -1;
  markOnboardingDone();
  emit();
}

// Advance to the next card. On the name step, pass the input's current
// value — it's persisted (setPlayerName) before advancing; an empty value
// leaves the name null (display fallback "Operator"). Past the last card,
// finishes instead.
export function advance(nameValue) {
  if (!active) return;
  const card = currentCard();
  if (card?.isNameStep) setPlayerName(nameValue);
  index += 1;
  if (index >= NARRATIVE.intro.length) finish();
  else emit();
}

// SKIP — available on every card, finishes immediately.
export function skip() {
  if (!active) return;
  finish();
}
