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

## 3b. PHASE 1b — World-flow revision (windowed choices) — **Sol**

**Supersedes Phase 1's "show all remaining + always-available LEAVE" node map.**
The player never sees the whole world — each screen offers a WINDOW of 3 cards,
the boss stays hidden until the world is nearly cleared, and beating the boss
does NOT auto-advance the world. Runs AFTER Phase 2 lands, so it reconciles with
Phase 2's onBattleEnd reward code.

**Files (stage exactly these):** `src/roguelike.js`, `src/config.js`,
`src/roguelike-ui.js`.

### 3b.1 The model
- Each world still pre-generates its shuffled `encounterPool` (3 combat + 4
  event) + one boss (boss is NOT a pool entry). New config:
  `choicesPerScreen: 3` (the window size) and `bossOfferThreshold: 2` (the boss
  becomes selectable once `encounterPool.length <= this`).
- New per-world run flag `bossDefeated` (reset false in `startWorld`; persisted).
- **Choice window each "choosing" screen:**
  - `visible = encounterPool.slice(0, choicesPerScreen)` — up to 3 remaining
    encounters (the head of the shuffled pool; picking one removes it, so the
    window naturally advances).
  - If `!bossDefeated && encounterPool.length <= bossOfferThreshold`: the **boss**
    is offered as an ADDITIONAL card (so 2 remaining → 2 enc + boss; 1 → 1 +
    boss; 0 → boss only). Before the threshold the boss is NOT shown — the player
    cannot rush it.
  - If `bossDefeated`: the boss card is gone; instead a **"LEAVE FOR WORLD n+1"**
    card is always offered alongside the (windowed) remaining encounters. If the
    pool is empty, only the LEAVE card shows.
  - The boss card and the LEAVE card are mutually exclusive (boss before defeat,
    LEAVE after).
- **New exports** (UI-facing; keep the file's import graph one-directional):
  - `getCurrentChoices()` → pure read: `{ encounters: encounterPool.slice(0,
    choicesPerScreen), bossOffered: boolean, canLeave: boolean }`. The UI renders
    from this — no window logic in the UI.
  - `fightBoss()` — replaces `leaveArea()`. Guarded: only valid when `bossOffered`
    (`!bossDefeated && pool.length <= bossOfferThreshold`). Builds + launches the
    world-boss combat exactly as Phase 1's `leaveArea` did (`currentNode = {
    kind:"boss", depth: worldDepth(), ... }`, `resolveCombatNode`).
  - `leaveToNextWorld()` — the new "leave". Guarded: only valid when
    `bossDefeated`. Advances: `worldIndex++; startWorld()` (non-combat
    transition, no battle). Returns an `encounterSnapshot()`-style result.
- **onBattleEnd boss handling (revises Phase 2 §4.2):**
  - Boss win, NOT the final world: set `bossDefeated = true`, bank salvage, bank
    Mastery XP (Phase 2, already at the top), stage the post-battle reward
    (advanceOnResolve:false), and RETURN TO THE SAME WORLD'S MAP — **do NOT
    `startWorld()` here** (the player mops up or leaves). Result carries
    `boss:true, bossWin:true, bossDefeated:true, bonusReward`.
  - Boss win, FINAL world (`worldIndex === worldCount-1`): run WON immediately
    (run-end screen) — nothing to mop up or leave to. Unchanged win path.
  - `leaveToNextWorld()` (not a battle) is the ONLY place a non-final world
    advances now.
- **Persistence:** add `bossDefeated` to `serializeRun`/`resumeRun`. A reload
  mid-boss-battle coerces `phase="choosing"` with `bossDefeated` still false (the
  boss is re-offered because the pool is still ≤ threshold) — no penalty, same
  clean-pre-battle pattern. `RUN_SNAPSHOT_VERSION` → 3 (shape changed:
  `bossDefeated` added; old v2 snapshots ignored).

### 3b.2 UI (`roguelike-ui.js`)
- `renderNodeMap()` drives off `getCurrentChoices()`: render the (≤3) encounter
  cards; if `bossOffered`, append a boss card wired to `fightBoss()` (battle
  chrome swap, same as a combat pick); if `canLeave`, append a "LEAVE FOR WORLD
  {n}" card wired to `leaveToNextWorld()` → `renderNodeMap()`. Keep ABANDON.
  Remove the old always-present LEAVE AREA card and the "render every
  encounterPool entry" loop.
- `onChooseNode` maps a visible index 0..2 to `encounterPool[index]` (the window
  is the pool head, so the index matches). Boss/LEAVE cards are their own
  handlers, not `chooseNode`.
- HUD `worldTaken/worldTotal` still reads fine; the boss/leave states are visible
  in the cards. (Phase 4 reskins all of this.)

### 3b.3 Done when
Each choosing screen shows ≤3 encounter cards; the boss appears only at ≤2
remaining and can be deferred; beating a non-final boss returns to the same world
(mop up or LEAVE FOR WORLD n+1); the final boss wins the run; determinism +
sandbox invariant + resume all still hold. `getCurrentChoices()` is a pure read.

## 4. PHASE 2 — Run Mastery (XP carry) + post-battle 5-gear — **Sol**

**Files (stage exactly these):** `src/roguelike.js`, `src/config.js`. No engine
edit is needed — the read path already works (anchors below). If you find one is
required, note it explicitly rather than editing silently.

### 4.0 Verified mechanism (re-confirm at these anchors before editing)
- `towers.js createTower` (~L64): a deployed tower's `xp` is SEEDED from its
  roster record — `xp: rosterRecord ? rosterRecord.xp : 0`; its `name` is the
  record's name. So a run roster record carrying XP ⇒ the redeployed tower starts
  at that Mastery.
- `towers.js recomputeStats` (~L170): `tower._masteryRank =
  masteryRankFor(tower.xp)` — Mastery is derived purely from `tower.xp` (no save
  field). `towers.js` (~L607) fires the golden level-up **surge** mid-battle when
  `masteryRankFor(tower.xp) > tower._masteryRank` — so a tower whose xp climbs
  visibly ranks up. `masteryRankFor` is exported from `equipment.js` (and
  re-exported by `towers.js`); `roguelike.js` may import it from `equipment.js`
  (it already imports `emptyGear` from there).
- `enemies.js` (~L233/357): per-kill XP is `enemy.xp * xpPerKillMultiplier *
  getXpMult()`, split among contributing towers into `tower.xp`. `getXpMult()`
  returns the RUN context value while a run is active (`progression.js` ~L420).
- `progression.js syncRoster` (~L904): the CAMPAIGN carry — `rec.xp = t.xp` by
  name-match. Runs SKIP it (`recordBattleEnd` is gated `!game.isRun`, `game.js`
  ~L206 and ~L228 — both confirmed guarded; DO NOT touch). Phase 2 adds the
  run-local equivalent.

### 4.1 Run Mastery carry-over (the isolated write-back)
- Add `bankRunMasteryXp(game)` in `roguelike.js`, called at the TOP of
  `onBattleEnd(game)` (right after `restoreBattleModifiers()`, before the
  win/loss branch — so a win always carries; on a loss the run ends, harmless).
- For each `t` of `game.towers` owned by the local player, find the EXISTING
  `run.roster` record by `t.name`. **Do NOT create new records** (a duplicate /
  forked tower with no record simply doesn't carry — the one-per-type roster
  towers are the persistent team that climbs). Then:
  `const earned = Math.max(0, t.xp - rec.xp); rec.xp += Math.round(earned *
  ROGUELIKE.mastery.xpGainMult);` and carry `rec.maxLevel = Math.max(rec.maxLevel,
  t.level)`, `rec.kills = t.kills` (mirrors syncRoster; harmless).
- **NEVER** call `syncRoster` / `recordBattleEnd`, and never touch `state.roster`
  or the real save. This writes only `run.roster` (already serialized to the
  rogue key).
- Config: add `ROGUELIKE.mastery = { xpGainMult: 6 }` (STARTER — Phase 5
  calibrates to the ★5–8 / ★10–15 / ★30 targets). Comment that this is
  DECOUPLED from in-battle level eligibility (`baseMults.xpMult` stays `1`, so
  leveling pacing is unchanged) — it accelerates only the BANKED Mastery XP
  carried across encounters. The redeployed tower reads the accelerated `rec.xp`
  next encounter → higher starting Mastery; mid-battle surges still fire on the
  raw in-battle crossings. No engine change (createTower already reads `rec.xp`).
- `RUN_SNAPSHOT_VERSION` stays `2` (run shape unchanged — `rec.xp` was always in
  `run.roster`).

### 4.2 Post-battle 1-of-5 gear reward (unify with the elite bonus)
- `reward.choiceCount` is already `5` (Phase 1). Generalize the existing
  elite-only bonus in `onBattleEnd` into a post-battle reward on ANY combat win
  whose kind is in `ROGUELIKE.reward.postBattleKinds` (default
  `["normal","elite","boss"]` — **farm excluded**, its payoff is the XP/Mastery).
  ilvl bonus: elite and boss wins add `reward.eliteIlvlBonus`; normal adds 0.
  Stage via `run.pendingChoice = { kind:"gear", items, advanceOnResolve:false }`,
  `run.phase="reward"`, and set `result.bonusReward = { items }` (reuse the exact
  Phase 1 flow — `pickGearReward` already honors `advanceOnResolve:false` →
  `finishStagedChoiceWithoutAdvance`).
- **Ordering** (important):
  - Non-boss combat win: `advanceEncounter()` (consume) → stage post-battle
    reward (advanceOnResolve:false) → return with `bonusReward`.
  - Boss win, NOT the final world: bank salvage + capture the cleared world's
    `depth` FIRST, then `startWorld()` (advance), THEN stage the post-battle
    reward at the cleared depth (advanceOnResolve:false) → return `bonusReward`
    (+ `nextWorld`). The reward resolves → `finishStagedChoiceWithoutAdvance` →
    the node map shows the NEW world.
  - Final world boss win: run WON — **no** reward, straight to the run-end screen
    (unchanged).
  - Loss: unchanged (run over).
- The standalone gear NODE stays (choiceCount 5, advanceOnResolve:true) —
  unchanged, coexists per the approved decision.
- UI: `roguelike-ui.js onRunBattleEnd` already renders `result.bonusReward` via
  `renderGearReward` — the unified reward flows through it with no UI change.
  `renderGearReward`'s "no compatible tower" path already lets the player skip.

### 4.3 Roster getter (for Phase 3 + the summary)
- Add a pure export `getRunRoster()` → `run.roster.map(r => ({ name, type,
  masteryRank: masteryRankFor(r.xp||0), xp: r.xp, maxLevel: r.maxLevel,
  gear: r.gear }))`. Phase 3's VIEW ROSTER screen consumes it. Also enrich
  `getRunSummary()`'s `roster` entries with `masteryRank`.

### 4.4 Done when
A run tower's `run.roster` `xp` accumulates across battles (× `xpGainMult`),
`masteryRankFor(rec.xp)` climbs encounter-to-encounter, and the redeployed tower
starts at that Mastery. The real save (`state.roster` xp, shards, skill points)
is byte-identical after a full run (sentinel test). Post-battle 1-of-5 gear
stages on normal/elite/boss wins but NOT farm; the final boss gives no reward.
Determinism holds. Report what you did and did NOT verify (you cannot see the
surge VFX or phone layout).

## 5. PHASE 3 — VIEW ROSTER screen — AS BUILT (2026-08-30, build `-5`)

Built INLINE by the Opus-4.8 orchestrator (Codex hit its usage limit before
starting). Shipped exactly to the spec below: a `renderRoster()` in
`roguelike-ui.js` driven by `getRunRoster()`, a VIEW ROSTER button on the node
map, per-tower cards (★ rank + `TOWER_UPGRADES.mastery.damagePerRank`-derived
+N% dmg + four gear slots via the existing item helpers), a BACK button, and a
`.rogue-roster-*` style block. Verified in-browser at 375px (3 cards, ★ + gear
render, BACK returns, no horizontal scroll, real save untouched). Original spec:

**Files (stage exactly these):** `src/roguelike-ui.js`, `styles.css`. (No
`roguelike.js` change — the getter already exists; no `index.html` change — the
screen renders into the existing `#rogue-body`, like every other rogue screen.)

The user's ask ("look at their roster of towers") is now backed by real run
Mastery (Phase 2). Add an always-available **VIEW ROSTER** screen.

### 5.1 Data (already available — do NOT add getters)
`roguelike.getRunRoster()` returns `[{ name, type, masteryRank, xp, maxLevel,
gear }]` (`gear` is a `{optic,emitter,capacitor,frame}` map of item-or-null).
Item objects have `{ slot, rarity, towerType?, affixes:[{stat,value}],
mods:[{id}] }` — the SAME shape the gear-reward/shop screens already render via
`itemBodyHtml`. Reuse the existing local helpers in `roguelike-ui.js`
(`RARITY_COLOR`, `SLOT_LABEL`/`slotLabel`, `affixDef`/`affixLabel`, `modLabel`,
`escapeHtml`, `TOWERS[type].color`/`.name`). Do NOT import `ui.js`.

### 5.2 The screen (`roguelike-ui.js`)
- Add a **VIEW ROSTER** button to `renderNodeMap()` (a `big-button`, e.g. just
  above ABANDON RUN). Tapping it calls a new `renderRoster()` that repaints
  `#rogue-body`. A **BACK** button returns via `renderNodeMap()`.
- `renderRoster()` lists one card per `getRunRoster()` entry:
  - Header: tower name + type, tinted with `TOWERS[type].color`; a prominent
    **★{masteryRank}** badge, and the Mastery damage bonus as text (compute from
    `TOWER_UPGRADES.mastery.damagePerRank * masteryRank` → `+{pct}% dmg`; import
    `TOWER_UPGRADES` from `config.js`). Optionally `maxLevel`.
  - Four slot rows/chips (optic/emitter/capacitor/frame): each shows the equipped
    item's rarity-colored slot label + its affixes/mods (reuse the compact
    affix/mod line format from `itemBodyHtml`), or an "empty" placeholder.
  - Keep it readable at 375px — no horizontal scroll.
- `updateHudStrip(run)` should still show; call it at the top of `renderRoster()`
  so the HUD stays consistent.

### 5.3 Styles (`styles.css`, in the `.rogue-*` block)
New `.rogue-roster-*` classes following the existing `.rogue-item-card` /
`.rogue-panel-title` visual language (panel bg, panel-border, neon accents).
Nothing fancy — Phase 4 does the full visual pass; this just needs to be clear
and phone-safe. Respect `prefers-reduced-motion` (no new perpetual animation).

### 5.4 Done when
A VIEW ROSTER button on the node map opens a screen showing each run tower's
Mastery ★ (which climbs across the run) and its four gear slots with
affixes/mods; BACK returns to the map. No console errors, no horizontal scroll at
375px, real save untouched (this screen is read-only). New player-facing strings
use `t("rogue.roster.*", "ENGLISH")` inline fallbacks (orchestrator adds French).

## 6. PHASE 4 — Visual overhaul — AS BUILT (2026-08-30, build `-6`)

Built INLINE by the Opus-4.8 orchestrator (Codex was rate-limited, and a visual
pass needs a browser Codex can't reach). Files: `styles.css`, `src/roguelike-ui.js`,
`index.html`. Verified in-browser at 375px (screenshots) — both world themes read
correctly, no horizontal scroll, console clean.

- **Per-world backdrop** on `#rogue-overlay`, keyed by a `data-world` attribute
  set in `updateHudStrip` (0/1/2). Layered radial gradients (two world-hue glows
  over `--bg`) + a masked perspective grid via `#rogue-overlay::before`. Theme
  tokens `--rogue-accent` / `--rogue-h1` / `--rogue-h2` are overridden per
  `[data-world]`: W1 outer-grid cyan/green, W2 ion-storm violet/magenta, W3
  core-breach ember/red. `--rogue-accent` also drives the panel title, world
  badge, and pips. No image assets, no filters (mobile-safe); the grid is static.
- **Banner encounter cards**: `.rogue-node-card` gets a glowing circular
  medallion (`.rogue-node-icon`), a per-kind accent top edge + tinted background +
  kind-colored title. Per-kind colour is a `--kind-color` var set on the existing
  `.rogue-kind-*` classes (combat cyan, elite red, farm/shop/recovery green, gear
  yellow, upgrade magenta, boss gold). Uses `color-mix()` (Safari 16.2+; older
  iOS degrades to the plain earlier `.rogue-node-card` rule — still functional).
- **HUD**: translucent glass strip with a Roman-numeral world badge
  (`#rogue-world-badge`), a Salvage pill, a thicker core meter, and a NEW
  encounter-progress pip row (`#rogue-pips` / `renderProgressPips`): one dot per
  encounter, filling as they clear, plus a trailing ★ that lights on
  `bossDefeated`. New markup: `#rogue-world-badge` + `#rogue-pips` in `index.html`.
- Reduced-motion: no new perpetual animation added (transitions only); the
  existing `@media (prefers-reduced-motion)` block still governs the rogue screens.
- **NOT done (deferred, optional):** the literal reference "footer tab" on cards,
  rarity-glow on item cards, and a bespoke hero run-start/run-end treatment — the
  medallion + accent-bar card reads as a banner without them; revisit if wanted.

## 7. PHASE 5 — Content & balance calibration — AS BUILT (2026-08-30)

Done by the orchestrator (Opus 4.8) in-browser — this is the one phase that needs
real measurement, not a browser-blind Codex agent.

- **Mastery curve calibrated to `xpGainMult: 7`.** Method: an analytic XP-pool
  measurement in the live engine — generate the world's combats + boss at
  `worldDepths` [1,5,9], sum `Σ count × ENEMIES[type].xp` per level, assume a
  focused tower takes ~50% of each combat's pool and engages all combats + bosses
  (excluding farm nodes' 2.5× and the +25% XP upgrade, which real play adds). At
  ×7 that tower reaches ~★5–6 by end of World 1, ~★14 by World 2, ~★23 baseline
  by World 3 (→ ~★30 with farming/focus) — matching the ★5–8 / ★10–15 /
  up-to-★30 design targets. Bump this single knob to retune the whole curve.
  (Measured pools: W1 ~1,270 XP, W2 ~2,980, W3 ~4,930 per world including boss.)
- **Difficulty validated, not changed.** `worldDepths` [1,5,9] already lands each
  world in a distinct `enemyTemplates`/rarity band (boundaries 1/4/8), giving
  three escalating tiers with the existing ramp. Concurrent-enemy counts at
  depth 9 (~11/group, ≤~110 concurrent) stay well under the ~300–400 mobile
  ceiling; the depth-9 boss (~5.7k HP/unit × 2 + chaff) is beatable by a
  focused, geared, ★20+ roster. No count/HP retune needed for a first pass.
- **Content (event weights, salvage, shop/recovery/event tables) left at the
  Phase 1–2 starter values** — reasonable for a first calibration.

**First calibration pass — real human playtest is the true signal** (per the
project's balance philosophy: a bot/analytic result is evidence, not proof).
Expect to retune `mastery.xpGainMult`, `startingCoreIntegrity` (40 across a
24-encounter run may prove tight or loose), and per-world difficulty off real
feedback. Files: `src/config.js`.

---

## 8. i18n note (orchestrator)
New player-facing strings (LEAVE AREA, WORLD n, VIEW ROSTER, mastery labels, etc.)
get English inline fallbacks in the code and `rogue.*` keys; the orchestrator
adds French to `src/lang/fr.js`. Codex agents write the English inline fallback
via `t("rogue.x", "ENGLISH")` and need not touch `fr.js`.
