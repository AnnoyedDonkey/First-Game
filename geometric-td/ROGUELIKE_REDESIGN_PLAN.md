# Roguelike Redesign — Build Plan (Worlds + Mastery + Visual Overhaul)

**Status:** approved 2026-08-30. Layered on top of the shipped roguelike mode
(build `2026.08.30-1`). Read `ROGUELIKE_PLAN.md` (original design + AS-BUILT
interfaces) and `ROGUELIKE_SOURCE_EXTRACT.md` (reusable engine systems) FIRST —
this document assumes both. It is the cold-read source for each delegated phase.

This redesign is delegated to Codex agents. **Sol** = Opus-tier work
(`--model gpt-5.6-sol --effort high`); **Terra** = Sonnet-tier work
(`--model gpt-5.6-terra`). The Claude orchestrator (Opus 4.8) reviews every diff
for INTENT, wires i18n strings, calibrates balance in-browser, does the single
`version.js` bump, and pushes. No phase bumps `version.js` or commits.

---

## 0. What we're changing (the whole picture)

The current mode is a flat 13-floor gauntlet: each floor rolls a 1-of-3 weighted
node choice, difficulty ramps continuously with `floorIndex`, and the boss exists
only on the final floor. We are replacing that with a **3-world** structure and
adding two gameplay systems and a full visual overhaul.

**Approved decisions (do not re-litigate):**

1. **Three worlds.** Each world is an **open area** containing **3 combat
   encounters + 4 event encounters** (7 total), plus **1 world boss** that gates
   the next world. Beat World 3's boss to win the run.
2. **Open-area + LEAVE flow.** The node map shows the world's *remaining*
   encounters as cards plus a persistent **LEAVE AREA** card. Picking an
   encounter consumes it; picking LEAVE AREA advances to that world's boss
   (you MAY leave early, skipping remaining encounters — that's the tension).
3. **Per-world difficulty banding.** Enemies are ~the same difficulty within a
   world and step up between worlds (flat within, tiered between) — NOT the old
   continuous per-floor ramp.
4. **Run towers gain Mastery from XP.** Fresh run towers now accumulate XP across
   floors (isolated from the real save) and climb Mastery ranks on an
   accelerated curve — target feel: a few towers at ★5–8 by end of World 1,
   ★10–15 by World 2, up to ★30 by the end of World 3. Watching towers rank up
   fast is the point.
5. **Post-battle gear pick.** After every combat WIN, the player picks 1 of **5**
   gear items (the standalone gear-cache event ALSO stays as one of the random
   event types — both coexist).
6. **CSS-neon per-world backdrops** (no image assets), banner-style encounter
   cards, restyled HUD, and a **VIEW ROSTER** screen. All in the game's neon
   idiom.

---

## 1. Cardinal constraints (every phase; do not violate)

- Plain HTML5 / Canvas 2D / vanilla-JS ES modules. No framework, build step, or
  dependency. (CLAUDE.md)
- **Every tunable number lives in `config.js ROGUELIKE`** — never hardcode a run
  number in `roguelike.js` or the UI.
- **THE SANDBOX CONTRACT — never read or write the real save from run logic.**
  No `recordBattleEnd`, no telemetry `submitRun`, no loot→stash, no skill-point
  award, no shard mutation, no real-roster write. Run XP/Mastery (new in Phase 2)
  lives ENTIRELY on the run's own roster records + its own localStorage key
  (`save.js` `${KEY}-rogue-run`), never the real save object
  (`geometric-td-save-v1` must stay byte-identical across a full run + reload).
- **Regression guard — do NOT remove `&& !game.isRun`** from the win/loss
  branches in `game.js updateGame` (without it a run's natural win/loss writes
  the real save). Any new battle-end code must keep runs out of
  `recordBattleEnd`/`recordEndlessResult`/`forfeitBattle`.
- Determinism: all randomness uses `run.rng` (from `loot.js makeRng`). **No
  `Math.random` anywhere in `roguelike.js`.** Same seed ⇒ same run.
- Keep the game runnable after every phase; the campaign and co-op paths must be
  behaviorally unchanged when not in a run.
- Target iPhone Safari portrait, touch-first; mouse must work too. No horizontal
  scroll at 375px. Respect `prefers-reduced-motion`.
- Perf ceiling ~300–400 concurrent enemies on mobile — scale difficulty with
  `healthMult`, NOT raw counts.
- **Codex CANNOT verify in a browser here** (serve.ps1 can't bind under its
  sandbox; its canvas is stubbed). Real-browser verification is the
  orchestrator's job. When unsure, say "I could not verify this" — do not imply
  coverage.
- Do NOT bump `src/version.js`. Do NOT `git commit` or `git add -A`. Stage only
  the explicit file list each phase names.

---

## 2. Current-state anchors (verify before editing)

- `roguelike.js` run object today: `{ seed, rng, floorIndex, maxCoreIntegrity,
  coreIntegrity, salvage, roster[], unlockedTowers[], choices[], currentNode,
  pendingChoice, phase, log[], draftedUpgrades[], context }`. `phase ∈
  {choosing, battle, reward, shop, event, won, lost}`.
- Floor machinery to replace: `isBossFloor`, `rollFloorChoices`, `makeNode`,
  `advanceFloor`, and every `ROGUELIKE.floorCount` / `run.floorIndex` /
  `run.choices` / `ROGUELIKE.choicesPerFloor` reference.
- Difficulty today is a pure function of `depth = run.floorIndex` (0-based) via
  `generateWaves(depth, rng, kind)` / `generateCombatLevel(depth, rng, kind)` and
  the depth-banded tables (`enemyTemplates.bands`, `reward.rarityWeightsByDepth`,
  `nodeWeights.bands`). These functions stay pure `(depth, rng, kind)` — we just
  change what `depth` is fed (see Phase 1).
- Persistence: `serializeRun` / `resumeRun` / `RUN_SNAPSHOT_VERSION` (currently
  `1`). `hasResumableRun` gates the RESUME button. Snapshot is written to
  `save.js` `${KEY}-rogue-run` only.
- Floor model is referenced ONLY in `roguelike.js`, `config.js`, and
  `roguelike-ui.js`. `main.js` uses `game.isRun` + `onRunBattleEnd(game)` and
  does NOT read floor fields. Confirm with a grep before finishing.
- The result descriptor returned by `onBattleEnd` (read by
  `roguelike-ui.js renderRunEnd` / `onRunBattleEnd`): `{won, floor, floorCount,
  boss, coreIntegrity, maxCoreIntegrity, salvage, salvageGained, runOver,
  runWon, nextFloor?, bonusReward?}`.

---

## 3. PHASE 1 — World structure & open-area flow — **Sol**

**Goal:** replace the flat-floor machinery with a 3-world / open-area / LEAVE
model, key difficulty per-world, update persistence, and keep the mode playable
end-to-end (minimal UI wiring — Phase 4 does the real reskin).

**Files (stage exactly these):** `src/roguelike.js`, `src/config.js`,
`src/roguelike-ui.js`. (Leave `index.html`/`styles.css` for Phase 4; keep the
existing HUD markup working by repurposing its text.)

### 3.1 Config (`config.js ROGUELIKE`)

Add a per-world model; keep all existing tables (they're reused via effective
depth). New/changed keys (starter values — Phase 5 tunes):

```
worldCount: 3,
combatsPerWorld: 3,
eventsPerWorld: 4,
// Effective "depth" fed to the existing depth-keyed generators, per world
// (0-based worldIndex). Flat within a world ⇒ "same difficulty within a world".
// Chosen to land each world in a distinct enemyTemplates/rarity band.
worldDepths: [1, 5, 9],
// Per-world chance each of the 3 combats is upgraded to an ELITE (0 = never).
eliteChancePerWorld: [0, 0.34, 0.5],
// Weighted event-kind pool for the 4 per-world events. Kinds: gear, farm,
// shop, event, recovery, upgrade (NO combat, NO boss here). Shared across
// worlds for now; Phase 5 may split per world.
eventWeights: { gear: 20, farm: 12, shop: 16, event: 12, recovery: 10, upgrade: 20 },
```

- Keep `startingCoreIntegrity`, `startingSalvage`, `starterTowers`, `baseMults`,
  `baseSpeeds`, `board`, `pathTemplates`, `difficulty`, `eliteModifiers`,
  `enemyTemplates`, `reward`, `shop`, `recovery`, `events`, `salvageRewards`,
  `runUpgrades` — all reused.
- Change `reward.choiceCount: 3 → 5` (post-battle 1-of-5; the Phase 2 post-battle
  reward and the standalone gear node share this count). Keep `skipSalvage`.
- REMOVE (now unused): `floorCount`, `choicesPerFloor`, `nodeWeights` (replaced
  by open-area pool generation — combats/events are now a FIXED per-world
  composition, not a per-floor weighted roll), `eliteMinDepth` (replaced by
  `eliteChancePerWorld`). If removing `nodeWeights` is risky, you MAY leave it in
  place unused and comment it deprecated — but do not read it.
- Boss difficulty continues to use `difficulty.bossHealthMult` /
  `bossBountyMult`, fed the world's effective depth.

### 3.2 Run state machine (`roguelike.js`)

New run object shape (bump `RUN_SNAPSHOT_VERSION` to `2`):

```
run = {
  seed, rng,
  worldIndex,            // 0..worldCount-1
  encounterPool,         // remaining encounter nodes THIS world (combat+event); consumed as chosen
  worldTotal,            // combatsPerWorld + eventsPerWorld (for progress display)
  worldTaken,            // how many consumed so far this world (for progress display)
  bossPending,           // true once LEAVE AREA chosen and the boss is the active fight
  maxCoreIntegrity, coreIntegrity, salvage,
  roster[], unlockedTowers[],
  currentNode, pendingChoice,
  phase,                 // choosing | battle | reward | shop | event | won | lost
  log[], draftedUpgrades[],
  context,
}
```

- `startRun(seed?)` — as today, but instead of `floorIndex=0` + `rollFloorChoices`,
  set `worldIndex=0` and call a new `startWorld()`.
- `startWorld()` — generate the current world's `encounterPool`: build
  `combatsPerWorld` combat nodes (each `kind:"normal"`, upgraded to
  `kind:"elite"` with rolled modifier at `eliteChancePerWorld[worldIndex]`
  probability) + `eventsPerWorld` event nodes (each a weighted pick from
  `eventWeights`, its kind-specific detail — elite modifier / event definition —
  rolled now for determinism, exactly like the old `makeNode`). Shuffle the pool
  with `run.rng` (Fisher-Yates). Reset `worldTaken=0`,
  `worldTotal=pool.length`, `bossPending=false`, `phase="choosing"`. Persist.
  Each node carries `depth: worldDepths[worldIndex]` so the pure generators keep
  working unchanged.
- `chooseNode(index)` — pick from `encounterPool[index]` (open area). On a combat
  kind: same as today (launch battle). On a non-combat kind: stage as today
  (gear/shop/event/upgrade/recovery). The chosen node is REMOVED from
  `encounterPool` when its resolution completes (combat: on win in `onBattleEnd`;
  non-combat: in the resolver's advance step — see `advanceEncounter` below).
- `leaveArea()` — new export. Sets `bossPending=true`, builds the world boss
  combat (`generateCombatLevel(worldDepths[worldIndex], rng, "boss")`), and
  launches it via the injected launcher (same path `resolveCombatNode` uses for a
  boss). `currentNode = { kind:"boss", depth, label }`.
- Replace `advanceFloor()` with `advanceEncounter()` — used by every non-combat
  resolver + a won combat: remove the consumed node from `encounterPool`,
  `worldTaken++`, set `phase="choosing"`, clear `currentNode`/`pendingChoice`,
  persist, and return a snapshot `{ worldIndex, worldTaken, worldTotal, remaining:
  encounterPool.length }`. It does NOT advance worlds — only the boss does.
- `onBattleEnd(game)` — keep the win/loss + salvage + elite-bonus logic, but:
  - Loss (or core ≤ 0): run over (unchanged).
  - A **combat win** that is NOT the boss: consume that combat node
    (`advanceEncounter`) and return to the open-area map. (Phase 2 adds the
    post-battle 5-gear reward staging here.)
  - A **boss win**: if `worldIndex < worldCount-1`, `worldIndex++` and
    `startWorld()` (new area); else the run is WON (unchanged run-won path).
  - Update the result descriptor: replace `floor`/`floorCount` with
    `worldIndex`/`worldCount` (KEEP the old field names populated too — set
    `floor = worldIndex`, `floorCount = worldCount` — so `roguelike-ui.js` and any
    reader keep working during Phase 1; Phase 4 renames them cleanly). Add
    `world: worldIndex`, `worldCount`, `worldTaken`, `worldTotal`, `bossWin`.
- `getRunSummary()` — report `world: worldIndex+1`, `worldCount`, plus the
  existing fields; keep `floor`/`floorCount` populated as aliases
  (`floor=worldIndex+1`, `floorCount=worldCount`) so the run-end screen keeps
  rendering until Phase 4.
- Persistence: `serializeRun`/`resumeRun` snapshot the new fields
  (`worldIndex`, `encounterPool`, `worldTaken`, `worldTotal`, `bossPending`).
  A mid-battle reload coerces back to `phase="choosing"` with the CLEAN
  pre-battle pool (the encounter was NOT yet consumed — combats are consumed only
  on win, and `resolveCombatNode` persists the clean pre-modifier state before
  launching, same pattern as today). `bossPending` reloads to `false` and the
  boss is re-offered via LEAVE AREA (no penalty). `RUN_SNAPSHOT_VERSION=2` means
  old snapshots are ignored (fine — a DEBUG feature).
- `debugHandle()` — update `state()` to print world/encounter info; add
  `leaveArea` to the exposed follow-ups.

### 3.3 Minimal UI wiring (`roguelike-ui.js`)

Keep the existing plain styling; just make the new flow work (Phase 4 reskins):

- `renderNodeMap()` — render one card per `run.encounterPool` entry (reuse the
  existing `.rogue-node-card` markup + `KIND_ICON`/`nodePreview`) PLUS a
  persistent **LEAVE AREA** card that calls `roguelike.leaveArea()` →
  `hideRogueOverlay()` + `showBattleChrome()` (same as choosing a combat). The
  ABANDON RUN button stays.
- `updateHudStrip(run)` — show `WORLD {worldIndex+1} / {worldCount}` and an
  encounter counter `{worldTaken}/{worldTotal}` instead of `FLOOR n/total`. Use
  the new run fields; do not read `ROGUELIKE.floorCount`.
- `onChooseNode` — combat kinds unchanged; the LEAVE AREA card is a separate
  handler calling `leaveArea()`.
- Everywhere `ROGUELIKE.floorCount` / `run.floorIndex` / `run.choices` is read,
  switch to the new fields. Grep the file to catch them all.
- Run-end / summary: keep working via the alias fields above (Phase 4 makes it
  world-aware and pretty).

### 3.4 Done when

A full run is playable end-to-end (console or the minimal UI): 3 worlds, each an
open area you can partially clear then LEAVE to fight the world boss, difficulty
flat within a world and stepping up between worlds, boss win advances the world,
World 3 boss win wins the run. Determinism holds (same seed ⇒ same worlds/pools).
The real save (`geometric-td-save-v1`) is byte-identical across a full run +
reload. No console errors. Report exactly what you did and did NOT verify.

---

## 4. PHASE 2 — Run Mastery (XP carry) + post-battle 5-gear — **Sol**

(Detailed spec written when Phase 1 lands, incorporating its exact interfaces.)
Outline: after each battle, bank each deployed tower's earned XP onto its
`run.roster` record (isolated from the real save), scaled by a run XP→mastery
multiplier tuned to the ★ targets in §0.4; deployed towers next floor read that
banked XP → higher Mastery rank → real damage buff (the existing golden
rank-up surge VFX fires for free). Stage a 1-of-5 gear reward after every combat
win (reuse the gear-reward flow; `reward.choiceCount=5`). Verify the real save is
untouched. Files: `src/roguelike.js` (+ read-path confirmation in
`towers.js`/`progression.js`; edit only if the run roster's banked XP isn't
already read into the deployed tower's Mastery).

## 5. PHASE 3 — VIEW ROSTER screen — **Terra**
(Spec finalized after Phase 2.) A roster-inspection overlay off the node map:
each run tower, its current Mastery ★, and its drafted gear/upgrades. Driven by a
new pure `roguelike.js` getter. Files: `src/roguelike-ui.js` (+ getter in
`src/roguelike.js`), `styles.css` (its own block), maybe an `index.html` button.

## 6. PHASE 4 — Visual overhaul — **Terra**
(Spec finalized after Phase 1/3.) Per-world CSS-neon backdrops, banner-style
encounter cards (medallion + kind color + preview + footer tab, per the
reference), restyled HUD (Core meter + Salvage chip + world/encounter pips +
world badge), rarity-glow item cards, hero run-start/run-end. All tunables in the
`--rogue-*` custom-property block on `#rogue-overlay`; reduced-motion-guarded;
no horizontal scroll at 375px. Files: `styles.css`, `src/roguelike-ui.js`,
`index.html`.

## 7. PHASE 5 — Content & balance tuning — **Terra + orchestrator**
Per-world enemy pools / difficulty bands / event weights / boss tables, and the
Phase 2 mastery-curve numbers. Orchestrator calibrates the mastery multiplier and
world difficulty in-browser (headless XP sim + real-play feel). Files:
`src/config.js`.

---

## 8. i18n note (orchestrator)
New player-facing strings (LEAVE AREA, WORLD n, VIEW ROSTER, mastery labels, etc.)
get English inline fallbacks in the code and `rogue.*` keys; the orchestrator
adds French to `src/lang/fr.js`. Codex agents write the English inline fallback
via `t("rogue.x", "ENGLISH")` and need not touch `fr.js`.
