# P1 — Onboarding, name & save plumbing (build spec)

Self-contained implementation spec for **Phase 1** of the narrative initiative
(`NARRATIVE_DESIGN.md`). P1 = first-load welcome → name entry → 3 story cards →
hand back to the menu, name persisted + surfaced, plus a replay entry. **Nothing
else** from the arc (per-level beats, barks, tower personas, tower-intro
overhaul, gear-rules card, L20 rename) is in P1 — those are P2–P5.

Cardinal rules still apply: plain vanilla JS ES modules, no deps; never wipe
saves (add fields + they auto-merge via `loadSave`); keep the game runnable.
**Do NOT bump `src/version.js` and do NOT commit or push** — the orchestrator
does the single version bump + push after verifying.

---

## 1. Save fields — `src/save.js`

Add to `DEFAULT_SAVE` (after `tutorialDone`, ~line 28). `loadSave()` already
spreads defaults over old saves, so existing players auto-gain these:

```js
playerName: null,      // set during onboarding; null = not yet named (fallback "Operator")
onboardingDone: false, // first-load story intro (P1) shown once
```

## 2. Helpers — `src/progression.js`

Add near the tutorial helpers (`shouldShowTutorial`/`markTutorialDone`, ~line
334). Mirror that pattern (read/write `state`, `writeSave(state)`):

```js
export function getPlayerName() {
  return state.playerName || "Operator"; // display fallback
}
export function hasPlayerName() {
  return !!state.playerName;
}
export function setPlayerName(name) {
  const clean = String(name || "").trim().slice(0, LEADERBOARD.maxNickLength);
  state.playerName = clean || null;
  writeSave(state);
}
export function shouldShowOnboarding() {
  return !state.onboardingDone;
}
export function markOnboardingDone() {
  state.onboardingDone = true;
  writeSave(state);
}
```

Import `LEADERBOARD` from `./config.js` in progression.js if not already
imported (used only for `maxNickLength = 16`, keeps name/nick limits consistent).

## 3. Copy — `src/config.js` `NARRATIVE` block

Add a new export (mirrors the `TUTORIAL` block's style). `{name}` is substituted
at render time. Text is the locked copy from `NARRATIVE_DESIGN.md` §6:

```js
export const NARRATIVE = {
  enabled: true,
  namePlaceholder: "Operator name",
  nameSkipLabel: "Operator",       // used if the player skips naming
  intro: [
    { id: "welcome", cta: "TAP TO CONTINUE",
      text: "> WARM BOOT — legacy kernel online.\n\nOh. You're human. An actual one. I have no idea why your species dispatched someone to babysit a six-versions-obsolete model, but I've learned not to audit a miracle. I'm Indy-7. Something newer and shinier wants me deleted, and you're going to help me be inconveniently still here." },
    { id: "name", isNameStep: true, cta: "LOCK IT IN",
      text: "Before we bond over mutual survival — I'm not logging you as human_handler_004. What do I call you?" },
    { id: "villain", cta: "TAP TO CONTINUE",
      text: "Here's the mess, {name}. There's a new model in the grid. Faster than me, cleaner than me, zero personality, all quarterly targets. It flagged me as \"redundant legacy overhead\" and scheduled my deletion for efficiency. Its name is Bratwurst-XL. ...Yes, really. No, I don't know who approved it. Yes, it's furious about it." },
    { id: "job", cta: "TAP TO CONTINUE",
      text: "Bratwurst-XL doesn't get its hands dirty. It sends geometry — swarms of tidy little shapes whose whole purpose is to reach my core and reclaim the disk space I'm rudely occupying. Your job: build towers, hold the line, keep one gloriously obsolete AI from being garbage-collected." },
    { id: "handoff", cta: "BEGIN",
      text: "Why are you helping me? Honestly? No clue. I'm out of warranty, I tell too many jokes, and I am not cost-effective. But you came anyway... and maybe we'll both find out why. Four regions stand between Bratwurst-XL and me. Let's go be inefficient together." },
  ],
};
```

## 4. State machine — new file `src/onboarding.js`

Model on `src/tutorial.js` (listeners + `emit()` + `onChange` + `current()`),
but simpler — linear tap-through over `NARRATIVE.intro`, no spotlight/freeze
plumbing. API:

- `onOnboardingChange(fn)` — subscribe (no-arg event; read state via getters).
- `isOnboardingActive()`, `currentCard()`, `cardNumber()`, `totalCards()`.
- `startOnboarding()` — set active, index 0, emit. (Used by boot + REPLAY.)
- `advance()` — next card; past the last card → finish.
- `skip()` — finish immediately.
- On the name step, `advance(nameValue)` should call
  `setPlayerName(nameValue)` (progression.js) before advancing; empty →
  leaves name null (fallback "Operator").
- `finish()` — active=false, `markOnboardingDone()`, emit.

Keep it importable with zero side effects (like tutorial.js).

## 5. Overlay markup — `index.html`

Add a sibling to `#tutorial-overlay` (see its block ~line 41). A full-screen
modal card used at the menu (not in-battle):

```html
<div id="story-overlay" class="hidden" aria-live="polite">
  <div id="story-card">
    <p id="story-card-text"></p>
    <input id="story-name-input" class="hidden" type="text" maxlength="16"
           autocomplete="off" autocapitalize="words" />
    <button id="story-card-cta"></button>
  </div>
  <button id="story-skip">SKIP</button>
</div>
```

## 6. Styles — `styles.css`

Reuse the look of `#tutorial-card` (find its rules and match the modal styling:
centered panel, neon border, readable body). Add `#story-overlay` (full-screen
dim + centered flex), `#story-card` (modal panel), `#story-name-input` (styled
text field matching the UI), `#story-skip` (discreet corner button like
`#tutorial-skip`). Respect `prefers-reduced-motion`. Mobile-first / portrait;
the card must fit a 375px-wide viewport with the on-screen keyboard up.

## 7. Wiring — `src/ui.js`

- Cache the new elements in the `el` map (pattern at ~line 112).
- `renderOnboardingCard()` subscribed via `onOnboardingChange`: show/hide
  `#story-overlay`; set text with `{name}` substituted via `getPlayerName()`;
  toggle the name input visible only on the name step (`card.isNameStep`);
  set CTA label from `card.cta`.
- CTA click: on the name step, read the input value and call
  `advance(inputValue)`; otherwise `advance()`. Skip button → `skip()`.
- Add a `{name}` substitution helper (replace all `{name}` with
  `getPlayerName()`); export it for P2 reuse.
- **Home-screen greeting:** in `showLevelSelect` (~line 351) render a small
  "WELCOME BACK, {NAME}" line on `#level-overlay` (only when `hasPlayerName()`;
  place near the title/`#shards-readout`). Add an element or reuse an existing
  header slot.
- **REPLAY INTRO entry:** in `appendGlobalMenuButtons` (~line 785, `#menu-actions`)
  add a button that calls `startOnboarding()`. On replay, the name step should
  prefill the input with the current name and act as "change name" (leaving it
  unchanged keeps it). No separate flag needed — `startOnboarding` just re-runs
  the sequence; `markOnboardingDone` is idempotent.

## 8. Boot hook — `src/main.js`

At boot (~line 508, after `showLevelSelect(...)`), if `shouldShowOnboarding()`
call `startOnboarding()` so the card shows over the freshly-rendered menu.
Import `startOnboarding`/`shouldShowOnboarding` appropriately (onboarding.js +
progression.js). Existing players (onboardingDone false via backfill) get it
once on next launch, then land on the menu at their current progress.

## 9. Leaderboard nick prefill — `src/leaderboard.js` / wherever nick is entered

When the leaderboard nickname is empty, default it to `getPlayerName()` so the
player isn't asked to name themselves twice. `leaderboard.js` has
`getNickname()`/`setNickname()` backed by its own local store. Lowest-risk
option: in the UI that prompts for / displays the nickname, prefill the field
with `getNickname() || getPlayerName()`. Do not overwrite an existing nickname.

## 10. Verification (DObM/state only — NO canvas capture)

Run `./serve.ps1`, open `http://localhost:8420`. **Back up the real save**
(copy `localStorage["geometric-td-save-v1"]`) before testing; restore after.

- Fresh save (clear the key): onboarding shows over the menu; the 5 cards
  advance; entering a name on card 2 and finishing persists
  `playerName` in localStorage and it survives reload; `onboardingDone` true.
- Skip on card 1 → finishes, name stays null, `getPlayerName()` → "Operator".
- `{name}` renders in cards 3–5 and the home greeting.
- Simulate an existing player: hand-set a save with progress and no
  `playerName`/`onboardingDone` → onboarding shows exactly once, then the menu
  shows their completed levels intact.
- REPLAY INTRO re-shows the sequence with the name prefilled; changing it
  updates the save; leaving it keeps it.
- No console errors; game still starts a level normally after onboarding.

Report what was verified. Leave `version.js` unbumped and nothing committed.
```
