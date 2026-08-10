# P3 — In-battle barks (build spec)

Self-contained implementation spec for **Phase 3** of the narrative initiative
(`NARRATIVE_DESIGN.md`). Builds on shipped P1/P2 (`config.js NARRATIVE`,
`src/onboarding.js`, per-level beats, the `narrativeSeen` save field, the
`storyCardHtml` colorizer).

**P3 delivers** short, non-blocking in-battle one-liners on the existing
milestone-toast:
1. **Contextual enemy intros** — the first time (ever) an enemy TYPE appears in
   a campaign battle, one Indy-7 toast naming it and its counter.
2. **Bratwurst-XL intrusions + Indy-7 roasts** — when the first Boss of a battle
   spawns, a cold Bratwurst-XL taunt, then an Indy-7 roast reply.

Cardinal rules still apply: plain vanilla JS ES modules, no deps; never wipe
saves (new fields auto-merge via `loadSave`); keep the game runnable. **Do NOT
bump `src/version.js`, and do NOT commit or push** — the orchestrator does the
single version bump + push after reviewing and verifying.

The copy below is authored — use it VERBATIM. Do not invent extra lines.

---

## 1. Copy data — `src/config.js` `NARRATIVE`

Extend the existing `NARRATIVE` export (keep `intro`, `speakers`, `beats`). Add:

```js
// In-battle barks (P3). enemyIntros: first-ever appearance of a type in a
// campaign battle → one Indy-7 toast (name + counter). bratwurstBarks/
// indyRoasts: a cold taunt + a roast reply when the first Boss of a battle
// spawns (picked at random, see main.js updateBarks).
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

Notes: intros cover the 6 fightable types; `splitling` (the death-spawn child)
gets none. `{name}` isn't used in these lines, but pass them through the same
render path anyway so future edits with `{name}` still work.

## 2. Save field + helpers — `src/save.js` + `src/progression.js`

- `save.js` `DEFAULT_SAVE`: add `seenEnemyIntros: []` (array of type ids shown).
- `progression.js` helpers (near `shouldShowBeat`/`markBeatSeen`):
  ```js
  export function shouldShowEnemyIntro(type) { return !state.seenEnemyIntros.includes(type); }
  export function markEnemyIntroSeen(type) {
    if (state.seenEnemyIntros.includes(type)) return;
    state.seenEnemyIntros.push(type);
    writeSave(state);
  }
  ```
- **Migration (spare veterans):** in the post-`loadSave` backfill, if the save
  has ANY `completedLevels`, mark ALL `NARRATIVE.enemyIntros` keys seen — an
  existing player already knows the roster; only brand-new players (no
  completions) get the enemy tutorials. Guard with `state.seenEnemyIntros ||= []`
  first; idempotent. (Bratwurst/Indy boss barks are flavor and fire for
  everyone; they are NOT gated by save state, only by the per-battle flag.)

## 3. Toast speaker coloring — `src/ui.js` `showMilestoneToast`

Give the toast an optional speaker so barks match the story palette:

- Change signature to `showMilestoneToast(text, kind)` (default `kind`
  undefined → existing plain behavior, so wormhole/field/conduit tooltip callers
  are unaffected).
- When `kind === "indy"` add class `toast-indy`; `kind === "bratwurst"` add
  `toast-bratwurst`; otherwise no extra class. Set the class on
  `el.milestoneToast` when the toast is rendered (in `runNextToast`, alongside
  setting the text — the queue must carry the kind, so push `{ text, kind }`
  instead of a bare string; update `toastQueue` usage accordingly).
- `styles.css`: `.toast-indy { color: var(--neon-cyan); }` and
  `.toast-bratwurst { color: var(--neon-red); }` on the toast (or a child); keep
  the existing toast box styling. Make sure the class is cleared between toasts.

## 4. The bark driver — `src/main.js`

- Import `showMilestoneToast` (already imported for tooltips? confirm — it's
  exported from ui.js), `NARRATIVE`, and
  `shouldShowEnemyIntro`/`markEnemyIntroSeen`.
- Module-level `let barkState = null;`. In `startLevel` (~line 82), after
  `game = createGame(...)`, set `barkState = { bossBarked: false };` (fresh per
  battle).
- Add `updateBarks(game)` and call it from the game loop `frame()` right next to
  `updateTutorialOverlay(game)` (only while a battle is live — i.e. when
  `game.phase` is `"wave"`/`"countdown"`/`"ready"`, and skip if
  `overlayShown`). Implementation:
  ```js
  function updateBarks(game) {
    if (!game || game.endless || !NARRATIVE.enabled || !barkState) return;
    for (const e of game.enemies) {
      // First-ever appearance of a type → Indy-7 intro (once ever, save-backed).
      if (shouldShowEnemyIntro(e.type) && NARRATIVE.enemyIntros[e.type]) {
        markEnemyIntroSeen(e.type);
        showMilestoneToast(NARRATIVE.enemyIntros[e.type], "indy");
      }
      // First Boss of THIS battle → Bratwurst taunt, then an Indy roast reply.
      if (e.type === "boss" && !barkState.bossBarked) {
        barkState.bossBarked = true;
        showMilestoneToast(pickOne(NARRATIVE.bratwurstBarks), "bratwurst");
        showMilestoneToast(pickOne(NARRATIVE.indyRoasts), "indy");
      }
    }
  }
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  ```
  Scanning `game.enemies` each frame is cheap (small array). The once-ever gate
  (enemy intros) and once-per-battle flag (boss) prevent repeats. The toast
  queue serializes multiple barks that fire on the same frame.

## 5. Verification (DOM/state only — NO canvas capture)

Preview via the `td` launch config (Browser pane; `autoPort` may reassign the
port; the pane may report viewport 0x0 — drive via `javascript_tool` /
`read_console_messages`, not `computer` clicks). This browser profile's
`localStorage` is a scratch save. Reload before isolated checks.

- **Enemy intro:** fresh save, start `level_001`, start the first wave (via the
  wave button or `window.startNextWave`/`window.step`); as a `basic`/`fast`
  enemy spawns, `#milestone-toast` shows the exact Indy-7 line with the
  `toast-indy` class (cyan), and `seenEnemyIntros` gains that type. Reload +
  replay the level → that intro does NOT fire again.
- **Boss barks:** reach or seed a wave containing a `boss` (e.g. force via
  `game.spawnQueue`/`window.step` on a level whose waves include a boss). On the
  first boss spawn, two toasts queue — a `toast-bratwurst` (red) taunt then a
  `toast-indy` (cyan) roast — and only once for the whole battle (no repeat when
  the next boss spawns).
- **Migration:** hand-seed a save with non-empty `completedLevels` and empty
  `seenEnemyIntros` → after load, ALL enemyIntro keys are marked seen (a veteran
  gets no enemy tutorials); a brand-new save (no completions) still shows them.
- **No regressions:** the wormhole/field/conduit tile tooltips (existing
  `showMilestoneToast(text)` callers with no kind) still render normally with no
  speaker color. No console errors; confirm the ui.js module loaded clean (a
  syntax/duplicate-identifier error silently breaks the whole module — check
  `read_console_messages`).
- Endless battles fire NO barks (campaign-only guard).

Report: files changed + what each adds; exactly what you verified and the
result (including the console-clean/module-loaded check); anything unverified or
any deviation; and confirm `version.js` is unbumped and nothing was committed or
pushed. Do not claim verifications you did not run.
