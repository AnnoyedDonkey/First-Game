// ============================================================
// ONBOARDING — narrative card-sequence player (P1 intro, generalized in P2
// for per-level story beats and the ▶ STORY replay control).
//
// Simpler cousin of tutorial.js: a linear tap-through over an arbitrary
// card list, no spotlight/freeze plumbing (it only ever shows over the
// menu or the pre-battle build phase, never mid-wave). Copy lives in
// config.js NARRATIVE. The persistent `onboardingDone` flag + `playerName`
// live in save.js/progression.js (shouldShowOnboarding/markOnboardingDone/
// setPlayerName); per-level beat-seen state lives in progression.js
// shouldShowBeat/markBeatSeen, mirroring the tutorial's
// shouldShowTutorial/markTutorialDone pattern.
//
// Game/UI-free logic — importable with zero side effects. ui.js
// subscribes via onOnboardingChange to render the DOM overlay; it never
// drives gameplay.
// ============================================================

import { NARRATIVE } from "./config.js";
import { markOnboardingDone, setPlayerName } from "./progression.js";

let active = false;
let index = -1;
let cards = NARRATIVE.intro; // the list currently playing
let onDone = null;           // callback fired when the list finishes
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
  return active && index >= 0 ? cards[index] : null;
}

export function cardNumber() {
  return index + 1;
}

export function totalCards() {
  return cards.length;
}

// Play an arbitrary card list ([{ text, speaker?, cta?, isNameStep? }, ...]),
// calling `onDone` (if given) once the player taps through the last card or
// hits SKIP. Used by the intro (below) and by per-level story beats /
// ▶ STORY replay (main.js / ui.js openLevelSheet).
export function playCards(list, doneCallback) {
  if (!list || !list.length) return;
  cards = list;
  onDone = doneCallback || null;
  active = true;
  index = 0;
  emit();
}

// Called at boot (when the player hasn't seen it yet) and from the menu's
// REPLAY INTRO entry (re-runs the sequence any time; markOnboardingDone
// is idempotent so replaying never un-marks it for a fresh player).
export function startOnboarding() {
  if (!NARRATIVE.enabled) return;
  playCards(NARRATIVE.intro, markOnboardingDone);
}

function finish() {
  active = false;
  index = -1;
  const cb = onDone;
  cards = NARRATIVE.intro;
  onDone = null;
  if (cb) cb();
  emit();
}

// Advance to the next card. On the name step, pass the input's current
// value — it's persisted (setPlayerName) before advancing; an empty value
// leaves the name null (display fallback "Operator"). `isNameStep` is only
// ever set on the intro's name card — story beats never set it. Past the
// last card, finishes instead.
export function advance(nameValue) {
  if (!active) return;
  const card = currentCard();
  if (card?.isNameStep) setPlayerName(nameValue);
  index += 1;
  if (index >= cards.length) finish();
  else emit();
}

// SKIP — available on every card, finishes immediately.
export function skip() {
  if (!active) return;
  finish();
}
