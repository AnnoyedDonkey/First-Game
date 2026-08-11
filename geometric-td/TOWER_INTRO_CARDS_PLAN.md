# Tower intro cards — live micro-battle rebuild

Status: **SHIPPED in `2026.08.10-11`.** Written and built 2026-08-10. Same
role for the tower cards that `ONBOARDING_ENEMY_INTROS_PLAN.md` played for the
enemy cards.

Each phase below is self-contained and meant to be run in its OWN session by
a cold agent with no memory of the design conversation. Read `HANDOFF.md` and
`CLAUDE.md` first (cardinal rules), then this file, then your phase only.

---

## 0. The ask, and the decision

The player asked: *"improve the cards which introduce each tower. Just like we
did when we introduced the enemies, we should have the tower prominently
featured in the card as it is killing enemies efficiently. Towers should look
and behave in the same way they do in-game."*

Today the tower intros are the three text-only **"Meet the Squad"** cards
(`config.js NARRATIVE.squad`, played once at first entry to L2 from
`main.js startLevel`). There is no visual of a tower anywhere in them.
Railgun (unlocked by clearing L5) and Rocket (L10) get **no intro card at
all** — only a first-placement ticker bark.

The enemy cards earned their fidelity from ONE decision: the parade glyphs are
derived from the renderer's own numbers (`renderer.js ENEMY_LOOK`,
`SHAPE_SIDES`, tile-relative radius) rather than eyeballed. A tower's identity,
though, isn't its silhouette — it's its **firing behaviour** (laser's instant
beam, pulse's lobbed orb + splash, slow's crawl + vulnerability mark, railgun's
white-hot pierce line, rocket's arcing blast). A static SVG can't carry that.

**Decision: the card hosts a small canvas running a real, sandboxed
micro-battle, drawn by `renderer.js render()` itself.** Real towers from
`towers.js`, real enemies from `enemies.js`, real projectiles/effects/
particles. Not a lookalike — the actual engine, in a box.

**Decisions already made by the player (do not relitigate):**
1. Scope = the 3 squad cards **plus new Railgun and Rocket intro cards**
   (closing the "arrive unannounced" gap HANDOFF lists under Active/deferred).
2. The **Slow card demo shows Slow + a Laser partner.** Slow solo cannot
   "kill efficiently" and faking that with demo-only buffs was explicitly
   rejected. Slowing enemies while a partner shreds them IS the Slow tower's
   in-game job, and it matches the copy already written.
3. Railgun/Rocket cards fire at the **start of the next level** (L6 / L11),
   ahead of that level's START beat — not mid-battle, not on the results screen.

---

## 1. Facts already established — do not re-derive these

Verified against the working tree on 2026-08-10. Line numbers are indicative;
grep the symbol if it has moved.

**The sandbox is viable because the update/draw functions take a plain object:**

- `enemies.js updateEnemies(game, dt)` uses only `game.grid/time/effects/
  springGrid` and returns leaked enemies (the demo simply culls them).
- `enemies.js damageEnemy(...)` touches exactly: `game.time`, `game.grid`,
  `game.enemies`, `game.effects`, `game.springGrid`, `game.kills`,
  `game.money`, `game.level`, `game.waveIndex`, `game.shardsEarned`,
  `game.lootDrops`. All in-memory. Nothing is persisted from these — loot and
  XP only reach the save through battle-end sync, which the demo never calls.
- `towers.js updateTowers(game, dt)`, `projectiles.js updateProjectiles/
  updateEffects`, `particles.js updateParticles`, `springgrid.js`'s
  `update(dt)` are all the same shape.
- `renderer.js render(ctx, game, time, uiState = {})` needs
  `game.grid`, `game.level` (for `id` + optional `palette`), `game.time`,
  `game.springGrid`, `game.towers`, `game.enemies`, `game.projectiles`,
  `game.effects`, `game.particles`. `drawCore` uses the LAST path point and
  `drawPortal` the FIRST — so a straight lane gets a portal and a core for
  free, which is exactly the framing we want.

**Three landmines, each with its required fix:**

1. **`game.js updateGame()` MUST NOT be used.** It runs waves, economy,
   milestones, and calls `recordBattleEnd` on win/lose — which writes the
   save. The demo drives the sub-updates directly and owns its own spawner.
2. **`towers.js createTower(type, x, y, grid, rosterRecord = null)` calls
   `nextRosterName(def)` when `rosterRecord` is null** (towers.js:49), which
   increments a module-level counter and would make the player's next real
   tower skip a name (Laser-03 with no Laser-02). **Always pass a synthetic
   roster record** to demo towers, e.g.
   `{ name: "L-01", maxLevel: 1, xp: 0, kills: 0, gear: null }`.
3. **`renderer.js` caches the circuit layer and the palette in single slots**
   (`circuitCanvas`/`circuitKey` ~line 115, `pal`/`palLevelId` ~line 68),
   keyed by `${level.id}:${tileSize}`. `main.js frame()` renders the real
   board EVERY frame even while a story card is up (main.js:630), so a demo
   with a different level id would thrash both caches and rebuild two
   pre-rendered circuit layers per frame — a genuine mobile perf hazard.
   **Phase 1 converts both caches to small `Map`s.**

**Other facts worth having:**

- `enemies.js createEnemy(type, mods)` accepts `{healthMult, speedMult,
  bountyMult, xpMult}`.
- `createTower` → `recomputeStats` applies the **player's real skills and
  gear**, so demo damage varies with progression. Handled by sizing enemy HP
  off the tower's own computed damage (see `shotsToKill` in §3).
- Save-flag pattern to copy for `seenTowerIntros`: `save.js:32-33`
  (`seenEnemyIntros`/`seenTowerBarks` defaults), `progression.js:72-75`
  (post-`loadSave()` backfill), `progression.js:432-451`
  (`shouldShow*`/`mark*Seen`), `progression.js:200-231` (veteran backfills).
- `progression.js isTowerUnlocked(type)` (~line 465) is the unlock source of
  truth: railgun = `level_005` completed, rocket = `level_010`.
- Card plumbing: `onboarding.js playCards(list, doneCallback)`;
  `ui.js renderOnboardingCard` (~3347) renders whatever card is current;
  `ui.js renderEnemyParade` (~3207) is the closest existing precedent;
  `ui.js updateStoryOverlay(game)` (~3273) runs per-frame from `main.js`.
- Card markup lives in `index.html` inside `#story-card` (~line 67-79).
- Squad cards are triggered at `main.js:118-125`; the per-level START beat at
  `main.js:140-147`.
- Enemy weakness source of truth is `ENEMIES[type].damageMult` in
  `src/balance-data.json`, keyed by tower `damageType`
  (`energy`=Laser, `pulse`=Pulse, `control`=Slow, `rail`=Railgun,
  `blast`=Rocket). Never hardcode a weakness list — derive it.

---

## 2. Rules that apply to EVERY phase

- Plain HTML5/Canvas/vanilla JS ES modules. No framework, no build step, no
  dependencies, no TypeScript.
- **Every tunable goes in `config.js NARRATIVE.towerIntro`** — nothing
  hardcoded in `ui.js`/`tower-demo.js`. Same discipline as
  `NARRATIVE.enemyIntro`.
- **The demo must never write to the save.** No `updateGame`,
  no `recordBattleEnd`, no `syncRoster`, no `writeSave`. Verify by snapshotting
  `localStorage["geometric-td-save-v1"]` before and after a demo run and
  asserting it is byte-identical.
- **Do not capture or export canvas images for verification** (standing
  project rule). Assert on state, DOM, and console cleanliness; the player
  eyeballs the visuals on iPhone.
- Keep the game runnable after every change. Local server: `./serve.ps1`,
  then `http://localhost:8420`. Debug helpers: `window.game`, `window.step(s)`.
- **Do not bump `src/version.js` and do not push** — Phase 5 does both, once.
- Do not touch `src/balance-data.json` / `src/balance-data.js`. This is a
  presentation feature; no gameplay numbers change.

---

## 3. Phase 1 — `src/tower-demo.js` (the sandbox)

**Goal:** a headless-testable module that runs a tiny battle and can render
itself into any canvas context. No UI work in this phase.

**3a. Renderer cache fix (prerequisite, same phase).**
In `renderer.js`, convert the single-slot circuit cache and palette cache to
`Map`s keyed by the existing cache key. Keep them bounded (a handful of
entries; clearing on level start is acceptable). Leave all drawing behaviour
identical.
*Done when:* rendering the real board and a demo board alternately rebuilds
each circuit layer once, not once per frame. Assert by counting
`buildCircuitLayer` invocations across ~120 alternating renders (temporary
instrumentation, removed before commit).

**3b. The module.** Public API (keep it this small):

```js
createTowerDemo(towerType)     // -> demo object (sandbox game + metadata)
stepTowerDemo(demo, dt)        // advance the sandbox by dt seconds
renderTowerDemo(demo, ctx)     // renderer.render(ctx, demo.game, demo.game.time, {})
destroyTowerDemo(demo)         // drop references; no timers of its own
```

- **Synthetic level:** an object literal with `id` (unique, e.g.
  `"demo_laser"`), `gridWidth`, `gridHeight`, `pathCorners` (a straight
  lane across the middle), and optionally `palette`. Feed it to the real
  `grid.js createGridModel(level, tilePx)`.
- **Sandbox game object:** `{ level, grid, time: 0, enemies: [], towers: [],
  projectiles: [], effects: [], particles: [], springGrid:
  createSpringGrid(w, h, tilePx), kills: 0, money: 0, shardsEarned: 0,
  lootDrops: [], waveIndex: 0, rng: <seeded, deterministic> }`.
  Anything `damageEnemy` writes to (money, kills, lootDrops) is discarded.
- **Towers:** the featured tower plus an optional support tower, placed at
  config-specified tiles, built with `createTower(..., syntheticRosterRecord)`
  (see landmine 2). The featured tower is the subject of the framing.
- **Enemies:** spawned on a config cadence with
  `createEnemy(type, { healthMult })`, where `healthMult` is solved so that
  **enemy HP ≈ featured tower's computed `tower.damage` × `shotsToKill`**.
  This is what keeps the demo reading the same for a fresh player and a
  fully-geared veteran (see §1). Cap concurrent enemies at `maxEnemies`.
- **Step:** `springGrid.update(dt)` → `updateTowers` → `updateEnemies`
  (cull whatever it returns; the demo has no core to damage) →
  `updateProjectiles` → `updateEffects` → `updateParticles` → advance
  `game.time`. Loop the cast forever while visible.

**3c. Config knobs** — add `NARRATIVE.towerIntro` to `config.js` with a
comment block in the style of `NARRATIVE.enemyIntro`:
`tilePx`, `gridWidth`, `gridHeight`, `laneRow`, `towerTile`, `supportTile`,
`spawnInterval`, `shotsToKill`, `maxEnemies`, plus a per-tower `cast` map.
Recommended cast (presentation choices, each sourced from `damageMult` — put
that reasoning in the comment):

| Card | Enemy cast | Why |
|---|---|---|
| laser | `fast` | weak to energy (1.3); shows single-target lock-on |
| pulse | `basic`, spawned in tight bursts | splash landing on 3 at once; `basic` is a type an L2 player has already met |
| slow | `fast`, **support tower `laser`** | slowing is legible on a fast mover; the partner does the killing |
| railgun | `armored` in a file | weak to rail (1.6); the pierce line hits the whole file |
| rocket | `boss` + a couple of `basic` | boss weak to blast (1.3); shows the arc and the blast radius |

**Do NOT in this phase:** touch `index.html`, `styles.css`, `ui.js`,
`main.js`, or any narrative copy.

**Definition of done:** from the browser console,
`createTowerDemo("laser")` + a loop of `stepTowerDemo(d, 1/60)` produces
`d.game.kills > 0` within a few simulated seconds for all five tower types;
`renderTowerDemo` draws into a scratch canvas without throwing; console is
clean; the save is byte-identical before/after; the roster-name counter is
unchanged (place a real tower afterwards and confirm its name didn't skip).

---

## 4. Phase 2 — card integration (UI)

**Goal:** any story card carrying `towerType` shows the live demo.

- `index.html`: add a `<canvas id="story-tower-demo">` inside `#story-card`,
  beside `#story-enemy-parade`, with a comment explaining it is tower-intro
  cards only (mirror the parade band's comment).
- `styles.css`: size/frame it like the parade band (bordered, rounded, dark
  interior). Internal resolution comes from the sandbox grid; CSS scales it.
- `ui.js renderOnboardingCard`: when `card.towerType` is set, create the demo,
  show the canvas, and start a rAF loop; on any card change/hide, stop the
  loop and `destroyTowerDemo`. Also stop on `visibilitychange` (hidden) and
  restart on return. Under `prefers-reduced-motion`, step a short fixed
  sequence and hold the final frame instead of animating perpetually.
- Add the derived **"Best against: …"** line, the tower-card counterpart of
  the enemy card's "Weak to / Resists" tag: reverse-lookup `ENEMIES[*]
  .damageMult[tower.damageType] > 1`. **Slow has no enemy weak to `control`**
  — for it, fall back to its own support stat line (slow % and the
  `vulnerability` mark) from `TOWERS.slow`. Style it with the existing
  `hl-weak` treatment in `storyCardHtml`.

**Do NOT in this phase:** change any `NARRATIVE.squad` copy, add save fields,
or touch `main.js` triggers. Test by temporarily adding `towerType: "laser"`
to a squad card in the console/dev only, and revert.

**Definition of done:** a card with `towerType` shows a running demo; tapping
through stops the loop (assert no rAF handle survives, no CPU after the
overlay hides); other story cards are visually unchanged; no console errors.

---

## 5. Phase 3 — the three squad cards

- Add `towerType: "laser" | "pulse" | "slow"` to the corresponding
  `NARRATIVE.squad` cards.
- Keep the approved copy. Trim ONLY sentences the demo now makes redundant
  (mechanics restated by the visual). The persona quips (L-01/P-02/S-01) stay
  — they are the point of the card.
- The first and last squad cards (framing/summary) get no demo.

**Definition of done:** first entry to L2 on a fresh save plays 5 cards, three
of which run their tower's demo; the Slow card visibly shows Slow + Laser;
copy renders without stray markdown asterisks; no console errors.

---

## 6. Phase 4 — Railgun and Rocket intro cards (new)

- **Copy:** write two Indy-7-voiced cards in the established voice (see
  `NARRATIVE_DESIGN.md` for the character bible, and `NARRATIVE.squad` for
  register). One card each, `speaker: "indy"`, with `towerType` set. Store as
  `NARRATIVE.towerIntros = { railgun: {...}, rocket: {...} }`.
- **Save field `seenTowerIntros: []`** — `save.js` default plus a
  post-`loadSave()` backfill in `progression.js` (copy the
  `seenEnemyIntros` pattern exactly), with `shouldShowTowerIntro(type)` /
  `markTowerIntroSeen(type)`.
- **Veteran backfill:** anyone who already has the tower unlocked
  (`isTowerUnlocked`) at load time gets it marked seen — no retroactive cards
  for players who have used the Railgun for fifteen levels. Idempotent, runs
  every load, mirrors `backfillEnemyIntros`.
- **Trigger** in `main.js startLevel`, before the START-beat block
  (main.js:140): if the tower is unlocked and unseen, `markTowerIntroSeen` and
  `playCards([...])`. Follow the existing precedent for not stacking two
  first-visit overlays — the tower intro takes the frame and the START beat
  defers to the next visit, exactly as the tutorial/squad guards already do.
  In practice this lands on L6 (Railgun) and L11 (Rocket).
- Gate on `NARRATIVE.enabled`, consistent with the rest of the story layer.
  (These are pre-battle story cards, not in-battle banter, so the STORY BANTER
  toggle does not apply — same as the squad cards.)

**Definition of done:** an existing save loaded once shows no cards and gains
a filled `seenTowerIntros`; a save with L5 complete but the card unseen shows
the Railgun card on entering L6, once, and never again; the L6 START beat is
not lost (it plays on the next visit, and ▶ STORY still replays it); save
migration doesn't disturb any other field.

---

## 7. Phase 5 — verify, document, ship

- Full pass over the verification checklist in §8.
- Update `HANDOFF.md`: "Current state" gets the tower-intro entry; the
  Active/deferred item **"Railgun / Rocket unlocks — awarded with no
  introduction"** is now DONE and comes off the list; add this plan file to
  "Related documents"; add an "As built" section to the bottom of THIS file
  recording what actually shipped and anything that diverged.
- **One** `src/version.js` bump for the whole feature.
- Inspect the diff, commit deliberately, push (deploys to GitHub Pages for
  iPhone testing).

---

## 8. Verification checklist (run in Phase 5; each phase runs its own subset)

- [ ] Save is byte-identical across a demo run (snapshot
      `localStorage["geometric-td-save-v1"]` before/after).
- [ ] Roster naming is unpolluted: place a real tower after a demo has run and
      confirm the name doesn't skip a number.
- [ ] Circuit/palette caches don't rebuild per frame while a demo card is up.
- [ ] rAF loop stops on card advance, overlay hide, and tab hide; nothing
      keeps running behind the menu.
- [ ] `prefers-reduced-motion` → no perpetual animation.
- [ ] All five demos produce kills; none stall (targeting, spawn cadence,
      enemies never walking off unhit).
- [ ] Squad flow on a fresh save: 5 cards, 3 demos, correct order, L2 starts
      normally afterwards.
- [ ] Railgun/Rocket cards: fire once, respect the veteran backfill, don't
      swallow the level's START beat permanently.
- [ ] Enemy-intro cards, boss banter, and tower placement barks are all
      UNCHANGED (regression check — this feature must not touch them).
- [ ] Console clean through a full L1→L2 fresh-save run.
- [ ] Every new number lives in `config.js NARRATIVE.towerIntro`.

## 9. Progress log

**Phase 1 — DONE (2026-08-10), initially headless-only.** Executed by a
delegated Codex session, reviewed here.

Landed: `src/renderer.js` (palette + circuit caches are now bounded LRU `Map`s,
limit 8), `src/tower-demo.js` (new), `src/config.js`
(`NARRATIVE.towerIntro`). Nothing else touched; not committed.

Two defects were found in review and fixed in a second pass — don't
reintroduce either:

1. Enemy HP was sized off `featuredTower.damage`. Slow's base damage is 2 vs
   Laser's 8, so the Slow card's enemies were ~4× more fragile and that demo
   killed FASTER than every other (21 kills/6s, the highest). Now sized off
   `supportTower || featuredTower` — the tower that actually owns the kills.
   Slow's own kill count is now 0, which is the honest depiction §0 decision 2
   asked for.
2. Multi-enemy casts were arrays of duplicates that the spawner cycled one at
   a time — behaviourally identical to a single entry, so Pulse never had a
   clump and Railgun never had a file. Cast entries are now `{type, count}`
   spawned as a group, spaced by `groupSpacingTiles`.

Measured after the fix (headless, 6 simulated seconds): kills — Laser 15,
Pulse 10, Slow 12, Railgun 8, Rocket 5. Pulse's best blast hits 5; Railgun's
rail hits 4. Save byte-identical across a demo run; roster naming stayed
consecutive.

**Phase 1 browser gap, resolved in Phase 2:** `serve.ps1` could not bind under
the delegated Phase 1 session's sandbox, so its stubbed context never exercised
real Canvas2D (`renderer.js glowSprite` calls `document.createElement("canvas")`).
The owner later verified all five demos in a real browser during Phase 2; the
final browser status is recorded in §11.

Latent footgun worth a guard if you touch the spawner: if a cast's total
`count` ever exceeds `maxEnemies`, the spawn condition can never be satisfied
and the demo runs empty forever.

## 10. Open choices left to the builder

- Exact lane geometry and canvas size (start ~7×3 tiles at `tilePx` 48 and
  tune on a phone-width viewport).
- Whether the demo canvas sits above or below the copy in the card. Above
  matches the enemy parade; try that first.
- Whether the featured tower shows its range ring. In-game the ring only
  appears on selection — showing it always may be clearer on the card, but it
  is a deviation, so make it a config flag and let the player decide on phone.

---

## 11. As built

Shipped in `2026.08.10-11` as a plain ES-module presentation feature:

- `renderer.js` now keeps bounded eight-entry LRU `Map`s for level palettes
  and circuit canvases, so the live board and a card demo remain hot while
  alternating every frame.
- `src/tower-demo.js` owns the isolated micro-battle. It calls the combat
  sub-updates directly, passes synthetic roster records to `createTower`, and
  never calls the game/save/battle-end paths. Enemy health is based on the
  actual damage dealer (`supportTower || featuredTower`), which keeps Slow's
  contribution honest: it applies slow/vulnerability while its Laser partner
  owns every kill.
- Cast config uses grouped `{ type, count }` entries plus
  `groupSpacingTiles`; Pulse therefore receives a real clump and Railgun a
  real file rather than decorative duplicate array entries. All geometry,
  pacing, durability, reduced-motion stepping, and cast choices live under
  `NARRATIVE.towerIntro`.
- `index.html`, `styles.css`, and `ui.js` host the 336×144 (7×3 tile) canvas
  above the copy. Cards derive "Best against" from enemy `damageMult`; Slow
  derives its support line from `TOWERS.slow`. Animation stops on card change,
  dismissal, and tab hide, resumes on return, and reduced motion renders one
  fixed sequence with no perpetual rAF.
- The five-card squad sequence now attaches demos only to Laser/Pulse/Slow.
  Railgun and Rocket have one Indy-7 recruit card each. `seenTowerIntros` is
  defaulted and post-load-backfilled; already-unlocked veterans are marked
  seen, while a same-session unlock plays once on the next level and defers
  that level's START beat to a later visit.

Two implementation corrections deliberately diverged from the initial Phase
1 sketch: grouped casts replaced the ineffective duplicate-entry arrays, and
Slow-demo health is sized from its Laser partner instead of the featured Slow
tower. The optional always-visible range ring was not added; the demo matches
normal unselected in-game rendering.

Final headless verification: kills after six simulated seconds were Laser 15,
Pulse 10, Slow 12, Railgun 8, Rocket 5; Slow itself had zero kills. Pulse's
largest blast hit five and Railgun's rail hit four in the Phase 1 measurement.
The save stayed byte-identical across demo runs, roster names remained
consecutive, alternating cached renders produced no rebuilds after warm-up,
the squad order was `[none, laser, pulse, slow, none]`, reduced motion held a
static final frame, and the Railgun/Rocket veteran/once-only/START-deferral
flows passed module/DOM tests.

Browser verification: the owner verified all five Phase 2 demos against real
Canvas2D (about 20k lit pixels each at 336×144), animation, rAF cancellation on
dismissal, hidden canvas/overlay state, and a clean console. The Phase 3 squad
flow and Phase 4 L6/L11 unlock flows have not yet been clicked through in a
real browser; those remain the outstanding browser/iPhone checks.
