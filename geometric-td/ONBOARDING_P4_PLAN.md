# P4 — "Meet the Squad" + tower personas (build spec)

Phase 4 of the narrative initiative (`NARRATIVE_DESIGN.md` §5/§8). Builds on
shipped P1/P2 and the P3-revival bark ticker (`showBark` + `#bark-ticker` in
ui.js, `NARRATIVE` in config.js). Two pieces:

1. **"Meet the Squad"** — replace the clunky level-2 auto tower-guide with an
   Indy-7-narrated card sequence introducing Laser/Pulse/Slow as characters.
2. **Tower placement barks** — the first time each tower TYPE is placed in a
   battle, the tower quips on the bark ticker, its name prefix tinted its own
   color.

Cardinal rules: plain vanilla JS ES modules, no deps; never wipe saves; keep the
game runnable. **Do NOT bump `src/version.js`, and do NOT commit or push** — the
orchestrator does that after review. Copy below is authored — use it VERBATIM.

Out of scope (later): tower level-up/mastery barks (user chose placement-only
for now); Railgun/Rocket unlock "recruit" cards; the gear-rules L2→L3 card and
L1-tutorial reword (that's P5).

---

## 1. Copy — `src/config.js` `NARRATIVE`

Add two keys to the `NARRATIVE` export (keep everything else).

`squad` — the Meet-the-Squad cards (played through the existing card overlay;
`\n\n` renders as paragraph breaks via the card's `white-space: pre-line`).
All spoken by Indy-7 (`speaker: "indy"`):

```js
squad: [
  { speaker: "indy", cta: "TAP TO CONTINUE",
    text: "Right, {name} — you survived first contact, and you did it leaning on my towers. Problem is, I never actually introduced you. Rude of me. Let's fix that — meet the squad, properly this time." },
  { speaker: "indy", cta: "TAP TO CONTINUE",
    text: "First up, the Laser. Fast, precise, locks onto one target and never lets go. Your reliable bread-and-butter — build these early and often.\n\nL-01: \"Hi hi hi! Did you SEE me last fight? I can do it again!\"\n\n...He's eager. We're working on it." },
  { speaker: "indy", cta: "TAP TO CONTINUE",
    text: "Next, the Pulse. Slower, but it lobs a blast that hits everything in a little zone at once. When they come in crowds — and they will — this is your answer.\n\nP-02: \"PULSE in the house! Everybody in the blast radius, say hi!\"\n\nSubtle, it is not." },
  { speaker: "indy", cta: "TAP TO CONTINUE",
    text: "And the Slow. Barely dents them — not its job. It drags them to a crawl and makes them take extra damage, so everyone else does the dinging. Force multiplier. Deeply underrated.\n\nS-01: \"I won't rush this introduction. Neither, shortly, will they.\"\n\nSee — that one gets it." },
  { speaker: "indy", cta: "LET'S GO",
    text: "That's your starting three, {name}: Laser to poke, Pulse for crowds, Slow to set the table. Oh — and the shapes you're shooting aren't all the same. Some shrug off certain weapons; some melt to them. Match your tower to your target and you'll do triple the work for the same shard. Now — level two. Let's give the squad something to shoot." },
],
```

`towerBarks` — the placement quip per tower type (the roster NAME is supplied by
the prefix at render time, so it is NOT repeated in the line):

```js
towerBarks: {
  laser:   "Online! Did you SEE me last fight? I can do it again! Just point me at something!",
  pulse:   "In the house! Everybody in the blast radius, say hi. ...That's the last thing most of 'em say.",
  slow:    "I won't rush this. Neither, shortly, will they.",
  railgun: "One line. Everything on it. ...Too dramatic? No. Exactly dramatic enough.",
  rocket:  "You rang? This had better be worth the fuel budget. I do NOT deploy for skirmishes, darling.",
},
```

## 2. "Meet the Squad" — `src/main.js` `startLevel`

Replace the legacy level-2 auto tower-guide (currently ~lines 104-107):
```js
if (level.id === "level_002" && shouldShowTowerGuide()) {
  markTowerGuideSeen();
  openTowerGuide();
}
```
with the card sequence (reuse `playCards`, already imported):
```js
if (level.id === "level_002" && shouldShowTowerGuide()) {
  markTowerGuideSeen();
  playCards(NARRATIVE.squad);
}
```
- Keep gating on `shouldShowTowerGuide()`/`markTowerGuideSeen()` (the existing
  `seenTowerGuide` flag) — so existing players who already saw the old guide do
  NOT get Meet the Squad, and new players see it once. No new save field.
- `openTowerGuide` is now unused in main.js — remove it from the ui.js import
  list (leave the export in ui.js; the gear "?" help button is separate and
  unaffected). Intended side effect: the gear-management panel no longer
  auto-opens at L2 — gear rules move to a dedicated L2→L3 card in P5; they
  remain reachable any time via the gear panel's "?" button.

## 3. Tinted tower placement barks — `src/ui.js` `showBark`

Extend `showBark` so a bark can carry a tower's own name + color, while the
existing string-code calls (`"indy"`/`"bratwurst"`) keep working:

- Signature stays `showBark(speaker, text)`, but `speaker` may now be **either**
  a string code (looked up in `NARRATIVE.speakers` → colored via the `hl-*`
  class, as today) **or** an object `{ name, color }` (a tower: mixed-case name
  + an inline hex color).
- In `runNextBark`, build the name span accordingly:
  ```js
  let nameHtml;
  if (typeof speaker === "string") {
    const spk = NARRATIVE.speakers?.[speaker] || { name: "Indy-7", cls: "hl-indy" };
    nameHtml = `<span class="bark-name ${spk.cls}">${escapeHtml(spk.name)}:</span>`;
  } else {
    // tower speaker: inline tint from the tower's def color (trusted hex from config)
    nameHtml = `<span class="bark-name" style="color:${speaker.color}">${escapeHtml(speaker.name)}:</span>`;
  }
  t.innerHTML = nameHtml + " " + escapeHtml(substituteName(text));
  ```
  (Body stays white; only the prefix is tinted — same as the indy/bratwurst
  barks.) Keep the queue carrying `{ speaker, text }`.

## 4. Fire the placement bark — `src/main.js`

- Extend the per-battle `barkState` (set in `startLevel`) to
  `{ bossBarked: false, placedTypes: new Set() }`.
- At the placement site (~line 216, right after
  `const result = placeTower(game, uiState.selectedType, x, y);` and the
  existing `tutorial.notifyPlacement(result.ok);`), add:
  ```js
  if (result.ok && !game.endless && barkState && result.tower &&
      !barkState.placedTypes.has(result.tower.type) &&
      NARRATIVE.towerBarks?.[result.tower.type]) {
    barkState.placedTypes.add(result.tower.type);
    showBark({ name: result.tower.name, color: result.tower.color },
             NARRATIVE.towerBarks[result.tower.type]);
  }
  ```
  Campaign only (`!game.endless`), once per type per battle (the `placedTypes`
  Set, reset each `startLevel`). `result.tower` has `.type`, `.name` (roster
  name like "L-03"), and `.color` (its def color — laser #35e0ff, pulse
  #ff3fd4, slow #4affa1, railgun #ff9d3f, rocket #ff5e3a).

## 5. Verification (DOM/state only — NO canvas capture)

Preview via the `td` launch config (Browser pane; `autoPort` may reassign the
port; the pane is HEADLESS — no live rAF frames, viewport may be 0x0 — so drive
via `javascript_tool` against live modules/`window.game`, and read
`read_console_messages`). Scratch save; reload before isolated checks.

- **Console clean / module loaded** after load (`typeof ui.showBark`,
  `typeof (await import('./src/onboarding.js')).playCards` are functions); a
  duplicate/syntax error silently breaks ui.js — confirm it loaded.
- **Meet the Squad:** fresh save (`seenTowerGuide` false), start `level_002`
  (real level-select → sheet → PLAY) → `#story-overlay` shows the first squad
  card (INDY-7 nameplate, exact §1 text); tapping through all 5 cards ends the
  sequence; `seenTowerGuide` is now true; re-entering L2 does NOT reshow it. The
  gear panel does NOT auto-open at L2.
- **Existing-player skip:** seed `seenTowerGuide: true` → L2 shows neither the
  squad cards nor the old guide.
- **Tower placement bark (tinted):** in a live campaign battle
  (`window.game`), call `placeTower` via the real tap flow OR seed a placement,
  then invoke the placement-bark branch — the ticker prefix reads the tower's
  roster name (e.g. `L-01:`) in the tower's color (laser → computed
  `rgb(53,224,255)`), body white; a SECOND laser placement in the same battle
  fires NO bark; a first Pulse placement DOES (magenta `rgb(255,63,212)`).
  Confirm `barkState.placedTypes` resets on a new `startLevel`.
- **Campaign-only:** no tower bark fires in an Endless battle.
- **String-code barks unaffected:** `showBark("indy", ...)` /
  `showBark("bratwurst", ...)` still render cyan/red via the `hl-*` classes.
- No console errors anywhere.

Report: files changed + what each adds; exactly what you verified + results
(incl. console-clean/module-loaded, the tinted prefix colors, and the
once-per-type gate); anything unverified or any deviation; confirm `version.js`
unbumped and nothing committed/pushed. Do not claim verifications you did not run.
