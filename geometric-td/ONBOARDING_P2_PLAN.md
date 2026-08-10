# P2 — Per-level story beats (build spec)

Self-contained implementation spec for **Phase 2** of the narrative initiative
(`NARRATIVE_DESIGN.md`). Builds on shipped P1 (onboarding intro, `playerName`,
the `#story-overlay` card, `config.js NARRATIVE`, `src/onboarding.js`).

**P2 delivers:** a short Indy-7 story beat the FIRST time each level is played
(a pre-battle START card) and the first time each is WON (lines on the results
screen), including the four world-end Indy-7 ↔ Bratwurst-XL exchanges; a
first-play-only gate with a migration that spares existing players; a ▶ STORY
replay control; and the L20 rename.

Cardinal rules still apply: plain vanilla JS ES modules, no deps; never wipe
saves (new fields auto-merge via `loadSave`); keep the game runnable. **Do NOT
bump `src/version.js`, and do NOT commit or push** — the orchestrator does the
single version bump + push after reviewing and verifying.

**Copy is authored already:** transcribe every level's START/WIN lines and the
world-end exchanges VERBATIM from `NARRATIVE_DESIGN.md` §7. Do not rewrite them.

---

## 1. Copy data — `src/config.js` `NARRATIVE`

Extend the existing `NARRATIVE` export (do not remove `intro`). Add a `beats`
map keyed by level id, and a `speakers` map. Each level may have a `start`
(string, Indy-7) and/or `win` (array of `{ s, t }` lines, in order). `s` is a
speaker code; most lines are `"indy"`, world-end villain lines are
`"bratwurst"`. `{name}` is substituted at render time (P1 `substituteName` /
`storyCardHtml` already handle it).

```js
speakers: {
  indy:      { label: "INDY-7",       cls: "hl-indy" },
  bratwurst: { label: "BRATWURST-XL", cls: "hl-villain" },
},
beats: {
  level_001: { start: "Right — first contact. ...", win: [{ s:"indy", t:"Huh. We won. ..." }] },
  level_002: { start: "...", win: [{ s:"indy", t:"..." }] },
  // level_003 … level_020, transcribed from NARRATIVE_DESIGN.md §7.
  level_005: { start:"...", win:[ {s:"indy",t:"...That was closer than I'd like. ..."},
                                  {s:"bratwurst",t:"Operator. You are allocating ..."},
                                  {s:"indy",t:"...and that's the meat product. ..."} ] },
  // …world-end exchanges for level_010 / _015 / _020 likewise fold the
  //   two-hander into that level's `win` array, in speaking order.
},
```

Notes:
- Levels with only a START or only a WIN in §7: include just that key.
- The L20 START line references "Zero Overhead" (the rename, §5 below).

## 2. Gating + helpers — `src/save.js` + `src/progression.js`

- `save.js` `DEFAULT_SAVE`: add `narrativeSeen: {}` (map of beat-id → true).
- `progression.js` helpers (near the P1 onboarding helpers):
  ```js
  export function shouldShowBeat(id) { return !state.narrativeSeen[id]; }
  export function markBeatSeen(id) {
    if (state.narrativeSeen[id]) return;
    state.narrativeSeen[id] = true;
    writeSave(state);
  }
  ```
  Beat ids: `` `${levelId}.start` `` and `` `${levelId}.win` ``.
- **Migration (spares existing players):** in the post-`loadSave` backfill,
  mark every ALREADY-completed level's `.start` and `.win` beats seen, so a
  mid-campaign player is NOT retroactively shown World 1-3 story (they still get
  it on demand via ▶ STORY, and forward/unplayed levels play normally). A brand-
  new save has no `completedLevels`, so nothing is pre-marked. Idempotent — safe
  to run each load.

## 3. Generalize the card player — `src/onboarding.js`

Today it plays `NARRATIVE.intro` and calls `markOnboardingDone()` on finish.
Generalize so the SAME overlay can play any card list with any completion
callback, then have the intro delegate to it:

- Internal state becomes `{ cards, index, onDone }` instead of a hardcoded
  `NARRATIVE.intro`.
- `startOnboarding()` → plays `NARRATIVE.intro` with `onDone = markOnboardingDone`
  (unchanged behavior/exports).
- New export `playCards(cards, onDone)` → plays an arbitrary array
  (`[{ text, speaker?, cta? }, …]`); `finish()` calls `onDone`.
- `currentCard()`, `advance(nameValue)`, `skip()` operate on the active list.
  `advance` still persists the name only on a card with `isNameStep` (intro
  only; beats never set it).
- `ui.js renderOnboardingCard` is already generic — it renders `currentCard()`.
  Make its speaker line honor `card.speaker` (a speaker code): look up
  `NARRATIVE.speakers[code]` for the label; default `"INDY-7"`. Apply the
  matching color class to `#story-speaker` (add/remove `hl-indy`/`hl-villain`).

## 4. START beats (pre-battle card) — `src/main.js` `startLevel`

In `startLevel` (~line 82), after the canvas is sized and BEFORE/around the
existing tutorial + tower-guide hooks (lines 104-113), auto-show the level's
START card via `playCards`, gated so it never collides with another first-visit
overlay:

- Only for **campaign** (`!endless`), when `shouldShowBeat(`${level.id}.start`)`,
  AND the level's `NARRATIVE.beats[level.id]?.start` exists.
- **Suppress the auto START card on `level_001` when the tutorial will run**
  (`shouldShowTutorial()`) and on `level_002` when the legacy tower guide will
  auto-open (`shouldShowTowerGuide()`) — those levels keep their existing
  first-visit flow for now (both remain reachable via ▶ STORY; the L2 case is
  revisited in P4's tower-intro overhaul). L1/L2 WIN beats are unaffected.
- On show, `markBeatSeen(`${level.id}.start`)`. Pass the card as
  `[{ text: beats.start, speaker: "indy", cta: "BEGIN" }]`.

The `#story-overlay` is a z-index-50 modal; over the pre-wave build phase it
simply pauses interaction until the player taps BEGIN. No new freeze plumbing.

## 5. WIN beats (results screen) — `src/main.js` + `src/ui.js` + `index.html`

- `index.html`: add `<div id="overlay-narrative" class="hidden"></div>` inside
  `#overlay`, between `#overlay-note` and `#overlay-milestones`.
- `ui.js showOverlay` (~line 2730): add a `narrative` field to the destructured
  params. When present (array of `{ s, t }`), render each line into
  `#overlay-narrative` as a speaker nameplate (`NARRATIVE.speakers[s]`) + the
  line text run through `storyCardHtml` (for `{name}`/keyword coloring); else
  hide it. Cache `el.overlayNarrative`.
- `main.js checkEndState` (~line 414, the `game.phase === "won"` CAMPAIGN
  branch only — not endless): if `!game.endless` and
  `shouldShowBeat(`${level.id}.win`)` and `beats[level.id]?.win`, pass
  `narrative: beats[level.id].win` into `showOverlay`, and
  `markBeatSeen(`${level.id}.win`)`. (Endless and loss overlays get no beat.)
  Import `shouldShowBeat`/`markBeatSeen` and the `NARRATIVE` beats as needed.

## 6. ▶ STORY replay control — `src/ui.js` `openLevelSheet`

In `openLevelSheet` (~line 723), when the level is **not locked** and has any
beat (`NARRATIVE.beats[level.id]`), add a small ▶ STORY button to the
`.level-sheet-actions` row (next to PLAY/ENDLESS). Tapping it replays that
level's narrative regardless of seen-state, via `playCards`: build a card list
from `start` (if any) then each `win` line (each as its own card with its
speaker), so the player can re-read the whole beat. This does not change any
seen flags. Wire the click after the sheet HTML is set (same pattern as the
existing PLAY/ENDLESS wiring below line 792).

## 7. L20 rename — `src/levels.js`

Change `level_020`'s presentation `name` from `"No Man's Land"` to
`"Zero Overhead"` (the only rename; §10 of the design doc). The L20 START card
copy already refers to it in-fiction.

## 8. Styles — `styles.css`

- `#overlay-narrative`: a readable dialogue block on the results overlay (match
  the story-card body: left-aligned, `line-height` ~1.5, spacing between
  speaker lines). Each line: a small nameplate (reuse `#story-speaker`-style
  rules; the `hl-indy`/`hl-villain` classes already exist) above/inline with the
  text. Mobile-first; must fit a 375px overlay.
- ▶ STORY button: match `.level-sheet-btn` styling (a tertiary variant is fine).

## 9. Verification (DOM/state only — NO canvas capture)

Preview via the `td` launch config (Browser pane; `autoPort` may reassign the
port). **This browser profile's `localStorage` is a scratch save — never rely on
the user's real device save.** Reload before each isolated check (module globals
can carry over).

- **START beat:** a fresh save, start `level_003` (via the real level-select →
  sheet → PLAY) → the START card shows with the correct §7 text and INDY-7
  nameplate; tapping BEGIN hides it and `narrativeSeen["level_003.start"]` is
  true; re-entering the level does NOT reshow it.
- **L1/L2 suppression:** on a fresh save, `level_001` first play shows the
  tutorial (not the START card); `level_002` first visit shows the tower guide
  (not the START card). Both START cards are still reachable via ▶ STORY.
- **WIN beat:** win a campaign level with an unseen `.win` beat (you can seed a
  near-win or use `window.step`/console to force `game.phase="won"` then call
  the end path) → the results overlay shows the Indy-7 line(s);
  `narrativeSeen["<id>.win"]` true; a later win does not reshow it.
- **World-end exchange:** verify a world-end id (e.g. `level_005.win`) renders
  BOTH speakers with distinct nameplates/colors (INDY-7 cyan, BRATWURST-XL red)
  and `{name}` substituted.
- **Migration:** hand-seed a save with `completedLevels` including several
  levels and an empty `narrativeSeen`; after load, those levels' `.start`/`.win`
  are marked seen (no retroactive spam), while an uncompleted level still shows
  its START beat on play.
- **▶ STORY replay:** on a cleared level's sheet, ▶ STORY replays start+win
  cards and does NOT alter any seen flags.
- **L20:** the menu shows "ZERO OVERHEAD" for level 20.
- No console errors anywhere; a normal battle still starts/ends correctly.

Report: files changed + what each adds; exactly what you verified and the
result; anything unverified or any deviation; and confirm `version.js` is
unbumped and nothing was committed/pushed. Do not claim unrun verifications.
