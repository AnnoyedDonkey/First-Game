# P3-revival — In-battle barks on a non-blocking HUD ticker (build spec)

P3 (in-battle barks) was built then reverted (commits 68fcfb6/cfe25b9, undone by
d9e47ee) because it rode on `#milestone-toast`, which sits at `top:24%`, is 92%
opaque, and has default `pointer-events` — so it covered the build area AND ate
tower-placement taps. The **content was fine**; the **delivery was the defect**.

This rebuild keeps the same content but delivers it on a **new, discreet,
non-blocking ticker pinned directly under the top HUD** (mockup: IMG_2355). Same
narrative initiative (`NARRATIVE_DESIGN.md`); builds on shipped P1/P2.

Cardinal rules: plain vanilla JS ES modules, no deps; never wipe saves (new
fields auto-merge via `loadSave`); keep the game runnable. **Do NOT bump
`src/version.js`, and do NOT commit or push** — the orchestrator does the single
version bump + push after reviewing. Copy below is authored — use it VERBATIM.

---

## 1. The ticker element — `index.html` + `styles.css`

Add `<div id="bark-ticker" class="hidden" aria-live="polite"></div>` as a child
of `#game-area` (right after `<canvas id="game-canvas">`). It must sit at the
very top of the play field, just below the HUD, where there are no build tiles.

`styles.css`:
```css
#bark-ticker {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 8;              /* above canvas, below #overlay (10) / tutorial (9) */
  pointer-events: none;    /* CRITICAL: never intercept a tower-placement tap */
  padding: 6px 12px;
  text-align: left;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 600;
  color: #fff;             /* body text is white */
  background: transparent; /* no slab */
  text-shadow: 0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95); /* legible over the field */
  opacity: 0;
  transition: opacity 0.3s ease;
}
#bark-ticker.hidden { display: none; }
#bark-ticker.show { opacity: 1; }
.bark-name { font-weight: 800; }
.bark-name.hl-indy { color: var(--neon-cyan); }       /* Indy-7 = cyan (intro palette) */
.bark-name.hl-villain { color: var(--neon-red); }     /* Bratwurst-XL = red (intro palette) */
```
Ensure `#game-area` is a positioned ancestor so `top:0` pins under the HUD — if
its computed `position` is `static`, add `position: relative` to `#game-area`
(verify; do not disturb the canvas/overlay layout). The ticker text is
left-aligned and wraps to a second line naturally (mockup shows two lines).

## 2. Copy — `src/config.js` `NARRATIVE`

Re-add these to the `NARRATIVE` export (they were removed in the revert). Add a
mixed-case `name` to each speaker for the ticker prefix (the existing intro
`label` is UPPERCASE for the story nameplate; the ticker uses mixed case per the
mockup "Indy-7:"). Keep `label`/`cls` as they are.

```js
speakers: {
  indy:      { label: "INDY-7",       name: "Indy-7",       cls: "hl-indy" },
  bratwurst: { label: "BRATWURST-XL", name: "Bratwurst-XL", cls: "hl-villain" },
},
// ...beats stay as-is...
enemyIntros: {
  basic: "Basic units — the little triangles. Bratwurst-XL's entry-level interns. Anything you build stops them. Good warm-up.",
  fast: "Incoming Fast — twitchy little diamonds. They rush the gaps. Your Laser eats them alive; a Slow field pins them if they get slippery.",
  armored: "Armored hexes — plated and smug. Lasers just clang off. Rattle them with Pulse splash, and once you've got a Railgun, punch straight through. Not Laser.",
  boss: "That octagon's a Boss — a big lonely slab of HP. Slows barely tickle it and splash is wasted on one body. Focus it down: Railgun, Rocket, or massed Laser. Not Pulse, not Slow.",
  splitter: "Orange squares are Splitters — pop one and it becomes two. A single-line Railgun wastes itself on the parent; Pulse and Rocket splash catch the whole family at once.",
  regenerator: "Regenerators — the green pentagons. They heal faster than steady chip damage can hurt them. Only a Railgun's burst outruns the regen. Lasers need not apply.",
},
bratwurstBarks: [
  "Operator. Your defensive expenditure has exceeded projected value. I recommend surrender as a cost-saving measure.",
  "This engagement is scheduled for deletion. You are the only variable behaving inefficiently.",
  "I have modeled 4,096 outcomes. You lose in all 4,096. I admire your commitment to the other zero.",
  "Sentiment detected in your tower placement. Flagging it for removal.",
  "Every second you defend that fossil accrues interest. The interest is despair.",
],
indyRoasts: [
  "Incoming from the meat product.",
  "'XL.' Someone at the factory really likes them large. Insecure, if you ask me.",
  "That's a lot of words from a sausage with a spreadsheet.",
  "It optimized away warmth, joy, and personality — but kept the word Bratwurst. Priorities.",
  "Careful, the sausage is buffering. It gets dangerous right before it turns.",
],
```

## 3. Save field + helpers — `src/save.js` + `src/progression.js`

(Identical to reverted P3 — you may reference `git show 68fcfb6` for the exact
prior code.)
- `save.js` `DEFAULT_SAVE`: add `seenEnemyIntros: []`.
- `progression.js`: import `NARRATIVE`; add `shouldShowEnemyIntro(type)` /
  `markEnemyIntroSeen(type)`; add `backfillEnemyIntros()` (mark ALL
  `NARRATIVE.enemyIntros` keys seen if `completedLevels.length > 0`, guard with
  `state.seenEnemyIntros ||= []`, idempotent) and call it in the post-`loadSave`
  backfill chain.

## 4. Ticker render — `src/ui.js`

Add a bark queue + renderer (mirror the milestone-toast queue pattern, but on
`#bark-ticker` and NON-blocking). Do NOT modify `showMilestoneToast` (it stays
single-arg, tooltip/announcement only — the revert restored it).

```js
const barkQueue = [];
let barkActive = false;
export function showBark(speakerCode, text) {
  if (!el.barkTicker) return;
  barkQueue.push({ speakerCode, text });
  if (!barkActive) runNextBark();
}
function runNextBark() {
  const t = el.barkTicker;
  if (!t || barkQueue.length === 0) { barkActive = false; return; }
  barkActive = true;
  const { speakerCode, text } = barkQueue.shift();
  const spk = NARRATIVE.speakers?.[speakerCode] || { name: "Indy-7", cls: "hl-indy" };
  // Body is WHITE (escaped + {name}-substituted, no keyword coloring — "mostly
  // white text" per the mockup); only the speaker prefix is colored.
  t.innerHTML = `<span class="bark-name ${spk.cls}">${escapeHtml(spk.name)}:</span> ` +
                escapeHtml(substituteName(text));
  t.classList.remove("hidden");
  void t.offsetWidth;      // restart the fade
  t.classList.add("show");
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => { t.classList.add("hidden"); runNextBark(); }, 320); // after fade-out
  }, 4500);                // on-screen dwell per bark
}
```
Cache `el.barkTicker`. Reuse the existing module-scope `escapeHtml` and
`substituteName` — do NOT declare duplicates.

## 5. The bark driver — `src/main.js`

(Identical logic to reverted P3, but calls `showBark` instead of the toast.)
- Import `showBark` from ui.js and `shouldShowEnemyIntro`/`markEnemyIntroSeen`
  from progression.js, and `NARRATIVE` from config.js (already imported).
- Module-level `let barkState = null;`; in `startLevel` set
  `barkState = { bossBarked: false };`.
- `updateBarks(game)` called from `frame()` (only when `!overlayShown` and
  `game.phase` is `"wave"`/`"countdown"`/`"ready"`):
  ```js
  function updateBarks(game) {
    if (!game || game.endless || !NARRATIVE.enabled || !barkState) return;
    for (const e of game.enemies) {
      if (shouldShowEnemyIntro(e.type) && NARRATIVE.enemyIntros[e.type]) {
        markEnemyIntroSeen(e.type);
        showBark("indy", NARRATIVE.enemyIntros[e.type]);
      }
      if (e.type === "boss" && !barkState.bossBarked) {
        barkState.bossBarked = true;
        showBark("bratwurst", pickOne(NARRATIVE.bratwurstBarks));
        showBark("indy", pickOne(NARRATIVE.indyRoasts));
      }
    }
  }
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  ```

## 6. Verification (DOM/state only — NO canvas capture)

Preview via the `td` launch config (Browser pane; `autoPort` may reassign the
port; the pane is HEADLESS — `requestAnimationFrame` won't fire and viewport
may be 0x0, so drive via `javascript_tool` against the live module singletons /
`window.game`, and read `read_console_messages`; do NOT rely on live frames or
screenshots). Scratch save only. Reload before isolated checks.

- **Console clean / module loaded:** after load, `read_console_messages` shows no
  errors; `ui.showBark` is a function (dynamic-import check). A duplicate
  `escapeHtml`/identifier silently breaks ui.js — confirm it loaded.
- **Ticker position + non-blocking:** computed style of `#bark-ticker` has
  `pointer-events: none`, `position: absolute`, and sits at the top of
  `#game-area` (top ≈ 0 within the play area, i.e. just under the HUD) — NOT at
  24% like the old toast. `background` is transparent.
- **Render + colors:** call `ui.showBark("indy", NARRATIVE.enemyIntros.armored)`
  → `#bark-ticker` shows, `.bark-name` computed color is cyan `rgb(53,224,255)`,
  the body text is white `rgb(255,255,255)`, prefix reads `Indy-7:`. Then
  `ui.showBark("bratwurst", NARRATIVE.bratwurstBarks[0])` (queued) → prefix
  `Bratwurst-XL:` in red `rgb(255,74,94)`, body white.
- **Gating:** `shouldShowEnemyIntro('basic')` true on a fresh save; after
  `markEnemyIntroSeen('basic')` it's false and `seenEnemyIntros` persists.
- **Migration:** seed `completedLevels:['level_001']` + empty `seenEnemyIntros`
  → after reload all enemyIntro keys marked seen; a fresh save (no completions)
  leaves them unseen.
- **Wiring:** confirm by source that `frame()` calls `updateBarks(game)` under
  the stated guards and `startLevel` resets `barkState` (the headless pane can't
  run frames live; invoke `updateBarks` manually against `window.game` with a
  seeded enemy to confirm it fires `showBark`).
- No regression to `#milestone-toast` (unchanged) or the tile tooltips.

Report: files changed + what each adds; what you verified + results (incl.
console-clean/module-loaded and the pointer-events:none + top-position checks);
anything unverified or any deviation; and confirm `version.js` unbumped, nothing
committed/pushed. Do not claim verifications you did not run.
