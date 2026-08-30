# Roguelike Mode — Build Plan

**Status:** designed 2026-08-29; **Phases A–E all shipped** (A–D by 2026-08-29,
E — polish + run persistence — 2026-08-30, build `2026.08.30-1`). See the
per-phase "AS BUILT" sections (§5b–§5f) for the exact interfaces. Remaining work
is playtest balance tuning, not new phases. Read this first for any
roguelike work. Companion reference: **`ROGUELIKE_SOURCE_EXTRACT.md`** (a
data-faithful snapshot of every reusable system — towers, enemies, gear,
economy, map modifiers — with file:line anchors). This plan assumes it.

## 1. What we're building

A **DEBUG-gated** run-based mode (Slay-the-Spire shape) layered on the existing
tower-defense engine. The player survives a gauntlet of procedurally chosen
**encounters** across ~12–15 **floors** and beats a final **boss** floor to win.

**Locked design decisions (2026-08-29):**
1. **Procedural floors** — each combat's map + waves are generated fresh from
   the enemy templates; not the real campaign levels.
2. **New run-only currency** — working name **"Salvage"**. Earned in-run, spent
   in shops, reset each run. Fully sandboxed from real Shards.
3. **Carried run vitality** — one persistent **Core Integrity** pool that *is*
   each combat's core HP. Leaks carry across floors; hitting 0 mid-combat ends
   the run; **Recovery** encounters restore it.

**Fresh start every run:** the run seeds its own roster of the 3 starter towers
(Laser/Pulse/Slow), **no gear, mastery 0, base skills**. The real save's roster,
mastery, gear, shards, skill points, and telemetry are **never read or written**
by this mode.

## 2. Cardinal constraints (do not violate)

- Plain HTML5 / Canvas 2D / vanilla-JS ES modules. No framework, build step, or
  dependency. (CLAUDE.md)
- **Every tunable number lives in `config.js ROGUELIKE`** — never hardcode a
  tunable in logic.
- **Never read or write the real save from run logic.** No skill point on a run
  win, no loot to the real stash, no shard mutation, no telemetry submit, no
  `recordBattleEnd`. See §4 (the sandbox) — this is the make-or-break.
- Keep the game runnable after every phase. The campaign and co-op paths must be
  **byte-for-byte behaviorally unchanged** when not in a run.
- Target iPhone Safari portrait, touch-first; mouse must work too.
- Perf ceiling ~300–400 concurrent enemies on mobile. Scale difficulty with
  `healthMult`/`bountyMult`, NOT raw counts.

## 3. Architecture at a glance

New files:
- **`src/roguelike.js`** — the run state machine: run object, RNG, floor/node
  generation, encounter resolution, reward application, win/lose. The only place
  that mutates run state.
- **`src/roguelike-ui.js`** *(or a section of `ui.js` — Phase C decides)* — the
  mode's overlays: entry, node-choice map, run HUD, shop, event, reward, and
  run-end screens.

Touched files (surgically):
- `config.js` — new `ROGUELIKE` tunables block (§7).
- `game.js` `createGame` — accept an optional run context so core HP and the
  economy come from the run, not the real save (§4).
- `main.js` — a `startRoguelikeBattle` launch path parallel to `startLevel`, and
  a run-aware branch in `checkEndState` that routes end-of-battle to the run
  instead of the campaign overlay (§4).
- `progression.js` — a run-override shim so the skill getters return run values
  during a run battle (§4). Additive; campaign path unchanged.
- `index.html` / `styles.css` — the mode's overlays (Mod Lab overlay is the
  pattern to copy).

### Verified engine hooks (already true — re-confirm at these anchors)
- **Fresh roster is free.** `towers.js placeTower` (~L398–405) deploys a veteran
  from `game.players[ownerId].roster`; when that roster is `[]` (as the co-op
  guest already does, `game.js` ~L52) you get a fresh, gearless, level-1 tower.
  Seed the run's local player with `roster: []` → fresh towers, no engine change.
- **Unlock gating is overridable.** `placeTower(game, type, x, y, ownerId,
  unlockedTowerTypes)` takes an explicit unlocked-set (`towers.js` L384) — the
  run passes its own unlocked towers, bypassing the L5/L10 campaign gates.
- **Core HP source.** `createGame` sets `coreHealth = level.coreHealth +
  getCoreBonus()` (`game.js` L83). The run must inject its carried Core Integrity
  and skip `getCoreBonus` (a real-save skill).
- **End-of-battle routing.** `main.js checkEndState` (L668) is the single funnel
  for win/lost. Today it submits telemetry (`submitRun`), records the campaign
  win, and drops loot to the real stash. The run must intercept before all of
  that.
- **Win/lose is set in the engine already:** `game.js` sets `game.phase =
  "won"` when all waves clear with core > 0, `"lost"` when core hits 0. The run
  reads `game.phase` and `game.coreHealth`; no new win/lose logic in the engine.
- **Real-save writers to keep OUT of the run path:** `progression.js
  recordBattleEnd` (L1343), `feedback.js submitRun`, loot→stash in
  `checkEndState`, skill-point award, and the skill getters listed in §4.

## 4. The sandbox (the hard part — Phase A, Opus 4.8)

A run battle must behave as if the player has a *fresh account*: base skills,
run-defined economy, carried core HP, and its own roster — while the campaign
and co-op paths keep using the real save. Approach:

- **Run context object** passed from `roguelike.js` into the launch path,
  carrying: `roster` (the run's tower records), `coreHealth` (carried Core
  Integrity), `unlockedTowers`, `economy` (money/interest defaults + any drafted
  run upgrades), and `skillMults` (all default 1.0 for v1; drafted run upgrades
  raise them later).
- **`createGame` change:** accept the run context; when present, seed the local
  player's `roster`/`economy` from it (mirroring the co-op-guest branch that
  already exists) and set `coreHealth`/`maxCoreHealth` from the run instead of
  `level.coreHealth + getCoreBonus()`.
- **Progression getter shim:** a module-level `activeRunContext` in
  `progression.js` (set on run-battle start, cleared on end). Each gameplay
  getter returns the run value when a run is active, else the real-save value.
  The getters to shim (verified list): `getTowerLevelCap`, `getInterestRate`,
  `getInterestCap`, `getRailChargeSpeedMult`, `getMoneyMult`, `getXpMult`,
  `getCoreBonus`, `getTowerDamageMult`, `getSlowDurationMult`,
  `getSlowPotencyMult`, `getLaserFireRateMult`, `getPulseBlastRadiusMult`,
  `getRocketBlastRadiusMult`, `getSkillShardFindMult`, `isTowerUnlocked`,
  `getUnlockedSpeeds`. For v1 they return **base values** (fresh account); Phase
  D wires drafted run upgrades into the context. *Confirm this list against the
  live exports before coding — grep `export function get` in progression.js.*
- **End-of-battle intercept:** at the very top of `checkEndState`, if a run is
  active, call `roguelike.onBattleEnd(game)` and **return** — skipping
  `submitRun`, `recordBattleEnd`, the skill point, and loot→stash entirely. The
  run reads `game.phase`/`game.coreHealth`, updates Core Integrity + Salvage,
  and shows the run's own overlay.

**Landmine:** many modules import these getters directly; the shim must live in
`progression.js` so every importer sees run values transparently. Do **not**
fork the getters at each call site.

**Verification for Phase A (console-drivable, no UI yet):** back up the real
save; start a run from the console; confirm (a) placed towers are level-1 &
gearless, (b) core HP carries across two combats, (c) a loss ends the run, (d)
the real save's shards/skill points/roster/stash are **unchanged** byte-for-byte
after a full run, (e) leaving the run and playing a normal campaign level behaves
exactly as before.

## 5. Phase breakdown & model assignment

Delegation is via **Claude agents** (Agent tool). **Sonnet** does every phase it
can; the one phase that rewrites shared save/economy plumbing uses **Opus 4.8**
(model id `claude-opus-4-8` — *not* Opus 5). Because the orchestrator session is
already Opus 4.8, it executes the Opus phase **inline** (cheaper than spawning a
second Opus agent, and guarantees the 4.8 model). Sonnet phases are delegated to
Sonnet subagents, each a **cold read of this file** — pass the phase section, not
a re-brief. Orchestrator reviews every diff for *intent* (not just instruction-
following), does the single `version.js` bump, and pushes.

> Each phase must leave the game runnable and the campaign path unchanged.

### Phase A — Run foundation & sandbox — **Opus 4.8 (inline)**
The risky shared-code work. Deliver:
- `src/roguelike.js`: run object (`seed`, `rng` via existing `makeRng`,
  `floorIndex`, `coreIntegrity`, `maxCoreIntegrity`, `salvage`, `roster[]`,
  `unlockedTowers`, `economy`, `skillMults`, `nodeMap`, `phase`), plus
  `startRun(seed?)`, `beginEncounter(node)`, `onBattleEnd(game)`, and a
  console/debug handle (`window.roguelike`).
- The §4 sandbox: `createGame` run-context support, the `progression.js` getter
  shim, the `startRoguelikeBattle` launch path in `main.js`, and the
  `checkEndState` run intercept.
- `config.js ROGUELIKE` skeleton (§7) with the numbers Phase A needs
  (starterTowers, startingSalvage, startingCoreIntegrity, floorCount).
- One placeholder procedural combat (a single hardcoded template) so a run can
  be played end-to-end **from the console** — no player UI required.

**Done when:** the Phase A verification (§4) passes with the real save proven
untouched.

### Phase B — Encounter & node generation — **Sonnet**
Pure logic against Phase A's interfaces. Deliver, all driven by `ROGUELIKE`
config + the run `rng`:
- `generateCombatLevel(depth, rng, kind)` → a valid `level` object (grid, path,
  `blockedTiles`, `startingMoney`, waves built from enemy templates, carried
  `coreHealth`). Validate against `balance-schema.js` shapes.
- `generateNodeMap(run)` / `rollFloorChoices(run)` → 3 depth-weighted encounter
  choices per floor. Depth gates: no Elite/Boss early; Boss only on the final
  floor; farm/gear/shop/event/recovery weighted by depth.
- Encounter resolvers for the **non-combat** types (return run-state deltas):
  XP Farm (trivial high-XP combat via A's launch), Gear/reward (roll 3 via
  `loot.js generateItem`, seedable), Shop (inventory + prices), Choice/event
  (risk/reward table), Recovery (restore Core Integrity / refund).
- Combat resolvers (Normal, Elite, Boss) call A's `startRoguelikeBattle` with the
  generated level + run context + kind modifiers.

**Done when:** a full run can be played from the console choosing among 3 real
nodes per floor, all 8 encounter types resolve, difficulty ramps by depth.

### Phase C — Mode UI & entry — **Sonnet**
DOM/CSS following the **Mod Lab overlay** pattern (`ui.js` ~L1340–1427, its
overlay in `index.html`, styles in `styles.css`). Deliver:
- DEBUG-gated **"ROGUELIKE"** entry (visible only when `getDebugMode()`), wired
  to `roguelike.startRun()`.
- **Node-choice overlay** — 3 encounter cards with icon/name/preview, floor
  progress, and the run HUD (Core Integrity bar + Salvage count).
- **Shop / event / reward** overlays and the **run-end** (victory / defeat)
  screens with a "NEW RUN" button.
- Neon "pizzazz" consistent with the game; respect reduced-motion.

**Done when:** a full run is playable start-to-finish on a phone via touch, no
console needed.

### Phase D — Content, rewards & balance — **Sonnet**
Fill and tune (all in `ROGUELIKE` config): enemy-composition templates per
depth, Elite/Boss modifiers (restricted towers, `speedMult`, map tiles via the
existing wormhole/field/conduit data), shop inventory + prices, reward tables,
draftable run upgrades (wire them into the Phase A `skillMults`/economy context),
and the floor-by-floor difficulty ramp. Playtest-tune the numbers.

**Done when:** a run has a satisfying lose→improve→win arc; a fresh 3-tower start
can reach the boss with good drafting, and careless play dies.

### Phase E — Polish & (optional) run persistence — **Sonnet; Opus 4.8 only if touching `save.js`**
Run summary, seed display/share (deterministic daily seeds via `makeRng`),
additional pizzazz. **Optional:** persist an in-progress run so a reload resumes
it — this touches `save.js` and MUST migrate not wipe existing saves, so if built
it is an **Opus 4.8** phase (save-safety judgment). v1 can ship without it (a
DEBUG feature may abandon on reload).

## 5b. Phase A — AS BUILT (2026-08-29, verified)

Foundation + sandbox shipped and headlessly verified. Interfaces the later
phases build on:

- **`src/roguelike.js`** — the run state machine. Exports:
  - `startRun(seed?)` → builds the run, sets the sandbox context for the whole
    run, rolls floor 1's choices, returns the run object.
  - `endRun(reason?)` → clears the run and turns the sandbox OFF.
  - `chooseNode(index)` → resolves `run.choices[index]`; combat/boss nodes call
    the injected launcher. (Phase B adds the non-combat resolvers here.)
  - `onBattleEnd(game)` → called by main.js; carries Core Integrity + Salvage,
    advances the floor (re-rolling choices) or ends the run; returns a snapshot
    descriptor `{won, floor, floorCount, boss, coreIntegrity, maxCoreIntegrity,
    salvage, salvageGained, runOver, runWon, nextFloor?}`.
  - `getRun()`, `isRunActive()`, `setBattleLauncher(fn)`, `debugHandle()`.
  - Run object shape: `{seed, rng, floorIndex, maxCoreIntegrity, coreIntegrity,
    salvage, roster[], unlockedTowers[], choices[], currentNode, phase, log[],
    context}`. `phase ∈ {choosing, battle, won, lost}`.
  - Node shape (Phase A): `{kind:"combat"|"boss", label, depth}`. **Phase B
    replaces `rollFloorChoices` + adds `buildEncounterLevel`'s real generator and
    the other node kinds.** The placeholder generator (`buildEncounterLevel` /
    `buildEncounterWaves` / `PLACEHOLDER_PATH`) is the seam to replace.
- **Sandbox** — `progression.js` `setRunContext(ctx)` / `getRunContext()`. While
  set, these getters return run values: `getTowerLevelCap, getInterestRate,
  getInterestCap, getSkillShardFindMult, getRailChargeSpeedMult, getMoneyMult,
  getXpMult, getCoreBonus, getUnlockedSpeeds, getTowerDamageMult,
  getSlowDurationMult, getSlowPotencyMult, getLaserFireRateMult,
  getPulseBlastRadiusMult, getRocketBlastRadiusMult, isTowerUnlocked`. Values
  come from `run.context.mults` / `.unlockedTowers` / `.speeds`, seeded from
  `config.js ROGUELIKE.baseMults` / `.baseSpeeds`. **Phase D raises these via
  drafted upgrades by mutating `run.context.mults`** (live — next battle sees it).
- **`game.js createGame(level, tileSize, endless, runContext)`** — 4th arg. When
  set: local player roster = `runContext.roster` (fresh towers), core HP =
  `runContext.coreHealth`, and `game.isRun` / `game.runContext` are flagged.
- **`main.js`** — `startRoguelikeBattle(level, runContext)` (the injected
  launcher), a run intercept at the top of `checkEndState` (routes to
  `handleRunBattleEnd`, skipping campaign telemetry/save-writes), an exit-button
  guard (abandon without `forfeitBattle`), an `updateBarks` `isRun` bail, and the
  Phase-A overlay (`handleRunBattleEnd` / `showRunChoices`, reusing `showOverlay`
  — **Phase C replaces this with the real node-map/HUD UI + the DEBUG entry
  button**). Console: `window.startRun(seed?)`, `window.roguelike.*`.

Verified: save byte-untouched across full runs (localStorage stays empty);
fresh gearless level-1 roster; Core Integrity carries across floors; starters-
only unlock overriding a real save that had railgun/rocket unlocked; sandbox
clears after run-over (no campaign leak); a generated combat spawns/fights/wins
in the real engine.

**Not yet done (later phases):** DEBUG entry button + real UI (C); procedural
map/wave + node-weight generator + non-combat resolvers (B); content/balance/
draft upgrades (D). No `version.js` bump yet — Phase A has no player-facing entry
(console-only), so nothing to ship to the phone until Phase C's button lands.

## 5c. Phase B — AS BUILT (2026-08-29, verified)

Procedural generation + full encounter pool shipped in `src/roguelike.js`
(rewritten) + `src/config.js` (`ROGUELIKE` expanded). No other files changed by
the agent. Highlights / contracts later phases depend on:

- **`generateCombatLevel(depth, rng, kind)`** — picks one of 5 straight-segment
  path templates (`ROGUELIKE.pathTemplates`), may mirror/flip (affine reflection
  of an axis-aligned polyline — can't produce an invalid path), derives blocked
  tiles, and builds depth-banded waves (`ROGUELIKE.enemyTemplates.bands`).
  `kind ∈ normal|elite|farm|boss`. Verified: 1,920 generated levels (60 seeds ×
  4 kinds × 8 depths) all pass `expandPathCorners`, all tiles in-bounds; a real
  generated combat is winnable in-engine.
- **`rollFloorChoices`** — depth-weighted pool (`ROGUELIKE.nodeWeights.bands`)
  over all 8 kinds; elite gated by `eliteMinDepth`, boss forced solo on the final
  floor. Elite modifier + event definition are rolled at node-gen time so a seed
  reproduces the same choices with the same sub-details.
- **Non-combat resolver contract (Phase C UI drives these — comment block above
  `chooseNode` in roguelike.js is the source of truth):**
  - combat/elite/farm/boss → `chooseNode` builds the level + launches.
  - recovery → resolves fully inside `chooseNode`.
  - gear → stages 3 items in `run.pendingChoice`; UI calls
    `pickGearReward(itemIndex, rosterIndex)` (`-1` = skip).
  - shop → stages stock; UI calls `shopBuyGear` / `shopBuyTowerUnlock` /
    `shopBuyRepair` / `shopReroll` repeatedly, then `shopLeave()`.
  - event → stages the event; UI calls `resolveEventOption(optionIndex)`.
  - `run.phase ∈ {choosing, battle, reward, shop, event, won, lost}`.
- **Gear-equip decision:** drafted items get `reqLevel`/`reqMastery` zeroed and
  attach directly to `record.gear[slot]`, bypassing `equipment.js canEquipItem`'s
  Mastery gate (a run roster never accrues Mastery, so the gate would make every
  item unequippable). Matches the extract's reuse guidance. Documented in the
  roguelike.js header.
- Determinism verified (same seed → identical floors/choices/gear); all rolls use
  `run.rng` (gear via `generateItem({rng: run.rng})`), never `Math.random`.
- New `ROGUELIKE` config keys: `board`, `pathTemplates`, `blockedTileCountRange`,
  `mirrorChance`/`flipChance`, `startingMoney` (per kind), `difficulty`,
  `nodeWeights.bands`, `eliteModifiers`, `enemyTemplates.bands`, `reward`, `shop`,
  `recovery`, `events`, `salvageRewards`. Starter numbers — **Phase D tunes.**

### Sandbox fix folded in (game.js) — REGRESSION GUARD, do not remove
Phase B testing surfaced a real leak Phase A missed: `game.js updateGame` calls
`recordBattleEnd` the instant `game.phase` flips to won/lost, gated only on
`!game.coop` — so a run's **natural** win/loss wrote the real save (roster
overwrite, skill point, completed-level) *before* main.js `checkEndState`'s run
intercept ran. Fixed by adding **`&& !game.isRun`** to both guards
(`game.js` win + loss branches). Re-verified: a natural run win via `updateGame`
against a non-empty save leaves it byte-identical, while a non-run (campaign)
battle still writes normally. **Any future engine change near battle-end must
keep runs out of `recordBattleEnd`/`recordEndlessResult`/`forfeitBattle`.**

## 5d. Phase C — AS BUILT (2026-08-29, verified)

Player-facing UI shipped. Files: **`src/roguelike-ui.js`** (new — all screens),
`index.html` (`#rogue-overlay` shell), `styles.css` (`.rogue-*` block),
`src/ui.js` (DEBUG-gated menu button + `onRoguelikeButtonTap`), `src/main.js`
(wiring: `initRoguelikeUI`, launcher stays `setBattleLauncher`, `checkEndState`
run branch → `onRunBattleEnd`). **Import graph is one-directional** — ui.js and
roguelike-ui.js never import each other or roguelike.js's UI; main.js injects
the menu-return callback and registers the button handler.
- Entry: "ROGUELIKE" main-menu button, gated on `getDebugMode()` (Mod Lab
  pattern); the Settings DEBUG toggle now re-renders the menu live.
- Screens: node-choice map + run HUD (Core Integrity bar green/yellow/red,
  Salvage, floor N/floorCount), gear-pick, shop (roster tabs + buy/reroll/
  repair/leave), event, generic outcome banner (recovery/event), run-end
  (victory/defeat → NEW RUN / MAIN MENU). All drive roguelike.js's documented
  exports only.
- Verified (mine + agent): button appears only under DEBUG; node map opens
  (floor 1/13, core 30/30); combat launches; loss → run-end screen; **save
  byte-identical, zero contamination** (roster/skillPoints/completedLevels/
  shards/stash all untouched); no console errors; mobile 375px portrait has no
  horizontal scroll. Not watched personally: the floor-13 boss end-to-end (same
  code path as other combats) and French-locale `rogue.*` strings (fall back to
  English via `t()`).

**Now player-facing** — this is the first shippable increment (needs a
`version.js` bump + push to reach the phone). The mode is DEBUG-gated, so it is
invisible to normal players until DEBUG MODE is on.

## 5e. Phase D — AS BUILT (2026-08-29)

Content, rewards & balance shipped in `config.js` + `roguelike.js` +
`roguelike-ui.js` (3 files).
- **Draftable run-upgrades wired (the structural piece):** `ROGUELIKE.runUpgrades`
  pool (data-only), a new `"upgrade"` node kind. `resolveUpgradeNode` stages 3
  distinct options; `pickRunUpgrade(i)` (`-1` = skip for salvage) →
  `applyRunUpgrade` mutates the LIVE `run.context.mults` / `.unlockedTowers` /
  `run.maxCoreIntegrity` the sandbox reads, so the next tower placed feels it.
  Verified: Laser 8 → 9.2 after a +15% damage draft.
- Elites grant a guaranteed bonus gear reward on win (`reward.eliteBonusReward`,
  a second staged reward round in `onBattleEnd`). §9 decisions: upgrade = one more
  weighted node (not a forced pick); elites guarantee a bonus reward; no mid-run
  mini-bosses (elites fill that role); daily seeds deferred to Phase E.
- Content: enemy pools per depth band (resist-matrix-aware), 6 elite modifiers,
  shop/recovery/event tables, gear/salvage tiers.

### Difficulty softening (2026-08-29, off player report "too hard past floor 3–4")
Player tested the live Phase C build — which had NO run-upgrades wired at all, so
towers couldn't build power. Phase D adds that axis; plus an early-ramp softening
in `config.js ROGUELIKE`: `healthPerDepth 0.35→0.24`, `baseGroupCount 7→6`,
`groupCountPerDepth 0.9→0.6`, `bossHealthMult 6→4.5`, `startingMoney` +~30% per
kind, `startingCoreIntegrity 30→40`, early-band `upgrade` node weights up, and
the flagship `overcharge` draft +15%→+20%. Headless bot check (smart placement,
**zero upgrades**, naive AI): loss-wall moved from floor 3 to floors 4–6 across 5
seeds; combats still losable. **First calibration pass — real human playtest is
the true signal; expect further tuning.**

## 5f. Phase E — AS BUILT (2026-08-30, verified)

Polish + run persistence shipped (build `2026.08.30-1`). Files: `src/roguelike.js`,
`src/roguelike-ui.js`, `src/save.js`, `src/loot.js`, `styles.css`, `src/version.js`.
Delegation: the two mechanical UI/CSS phases were built by cold-read **Sonnet**
agents against a spec file; the save-safety persistence phase was done **inline
by the Opus-4.8 orchestrator** (per §5's save-safety rule), then everything was
browser-verified and version-bumped by the orchestrator.

### Polish (Sonnet agents)
- **Run summary** — `roguelike.js getRunSummary()` (a PURE read of the live run)
  feeds a rewritten `renderRunEnd`: floor reached, Core Integrity, salvage,
  towers unlocked, gear drafted count, upgrades taken, and the **seed**. A new
  `run.draftedUpgrades[]` (`{id,label}`, pushed in `pickRunUpgrade`'s apply
  branch only) backs the upgrades row.
- **Seed display / replay / daily** — run-end shows the seed with **COPY SEED**
  (guarded `navigator.clipboard`, silent no-op on iOS/file://), **REPLAY SEED**
  (`startRun(seed)` — deterministic re-run), and **DAILY RUN**. New
  `roguelike.js dailySeed(date=new Date())` = a uint32 from the LOCAL calendar
  date (`y*10000+(m+1)*100+d`), so a given day reproduces one gauntlet.
- **Run-start screen** — `enterRoguelike()` with **no** seed now shows
  `renderRunStart()` (NEW RUN / DAILY RUN + today's seed / BACK, and a **RESUME
  RUN** button when a snapshot exists); a seed passed in (console/replay/daily)
  still starts immediately. `window.startRun(seed)` behaviour unchanged.
- **Pizzazz** — `styles.css` node-card/summary/run-start staggered entrances, a
  one-shot win/loss run-end reveal, and a low-Core-Integrity glow pulse. All
  timings are CSS custom properties on `#rogue-overlay`
  (`--rogue-anim-in/-ease/-stagger/-pulse`); everything is disabled under
  `@media (prefers-reduced-motion: reduce)`. Transform/opacity/box-shadow only.

### Run persistence (Opus-4.8 inline — the save-safety piece)
- **Separate localStorage key, real save NEVER touched.** Persistence lives in
  `save.js` under `${KEY}-rogue-run` (mirrors the Mod Lab snapshot-key pattern),
  entirely OUTSIDE the real save object — so the sandbox invariant *still holds*
  (`geometric-td-save-v1` is byte-identical across a full run + reload) and there
  is **zero migration risk** (no new field on the real save, no backfill). Three
  helpers: `saveRoguelikeRun/loadRoguelikeRun/clearRoguelikeRun`; `clearSave`
  also drops the rogue key.
- **`roguelike.js` serialize/resume.** `serializeRun()` snapshots only plain data
  + the **rng internal state** — `loot.js makeRng(seed, state?)` now exposes
  `rng.state()` and accepts a resume `state` (additive/backward-compatible), so a
  resumed run **continues the exact deterministic stream**. `resumeRun()` rebuilds
  the run, **re-links** `context.roster`/`context.unlockedTowers` to the run's own
  arrays (not the serialized copies), coerces a mid-battle reload back to the
  floor's node choices (no penalty — Core Integrity was persisted pre-battle), and
  **re-arms `setRunContext`** so a resumed run still never writes the real save.
  `RUN_SNAPSHOT_VERSION` guards against stale-shape snapshots.
- **Persist points:** `startRun`, `advanceFloor`, `resolveCombatNode` (the CLEAN
  pre-modifier state — a transient elite/farm battle modifier is never persisted),
  the gear/shop/event/upgrade stagers, every shop mutator, and the elite-bonus
  staging in `onBattleEnd`. **Clear points:** `endRun` (abandon/exit) and the
  win/loss branches of `onBattleEnd`. UI: `renderRunStart`'s RESUME button →
  `resumeRun()` → new `renderCurrentScreen()` phase dispatcher.
- Console: `window.roguelike.hasResumableRun()` / `.resume()`.

**Verified (browser, state/DOM assertions only — no canvas capture):** makeRng
resume is deterministic; `startRun` writes the rogue key while the real save stays
byte-identical; sandbox is OFF before resume and re-armed+re-linked after; across a
real page reload `resumeRun()` restores seed/floor/salvage/roster and the real save
is still byte-identical; abandon and a loss both clear the key + sandbox; the
run-start and run-end summary screens render with the expected classes; console
clean. **Not personally eyeballed (phone job):** the animation feel and the
run-end summary layout at phone widths.

**Optional not built:** none deferred — persistence WAS built this pass (the §5
"optional" item). Remaining is pure playtest tuning.

## 6. Encounter type → engine mapping (design reference)

| Type | Built from | Depth gate |
|---|---|---|
| Normal combat | `generateCombatLevel` + random waves | any |
| Elite/challenge | combat + modifier (restrict towers / `speedMult` / tiles / mini-boss) | **not early** |
| XP Farm | trivial wave, high `xpMult` | any (rarer late) |
| Gear/reward | `loot.js generateItem` ×3, pick 1 (seeded) | any |
| Shop | spend Salvage on gear/towers/upgrades/rerolls | mid+ |
| Choice/event | non-combat risk/reward overlay | any |
| Recovery/reset | restore Core Integrity / refund / re-roll | mid+ |
| Boss/milestone | scripted heavy combat; final = win | checkpoints only |

## 7. `config.js ROGUELIKE` — tunables (skeleton for Phase A to seed, D to fill)

```
ROGUELIKE: {
  floorCount: 13,              // total floors; last is the boss
  startingCoreIntegrity: 30,   // carried run vitality pool
  startingSalvage: 0,
  starterTowers: ["laser", "pulse", "slow"],
  choicesPerFloor: 3,
  nodeWeights: { /* per depth-band: normal/elite/farm/gear/shop/event/recovery/boss */ },
  eliteMinDepth: 3,            // no elites before this floor
  difficulty: { /* per-depth healthMult / bountyMult / count caps */ },
  salvageRewards: { /* per encounter kind */ },
  shop: { /* prices, stock size, reroll cost */ },
  recovery: { /* core-integrity restore amounts */ },
  runUpgrades: { /* draftable per-run skill/economy deltas -> context (Phase D) */ },
  enemyTemplates: { /* per depth-band composition pools */ },
}
```

## 8. Testing recipe

- Local: `./serve.ps1`, open `http://localhost:8420`; DEBUG MODE on in Settings.
- **Back up the real save and restore it byte-for-byte** around any run test
  (HANDOFF rule). The sandbox's whole point is that this backup should be
  identical before and after — that's the key assertion.
- Reload before each isolated run/threshold test (module globals contaminate).
- Assert on state/DOM/logic, not canvas capture. Visual review is on the phone.
- Do **not** bump `version.js` until a phase is player-facing and verified; the
  orchestrator does the single bump + push per shipped increment.

## 9. Open questions (revisit during D)
- Draft cadence: one reward per floor, or per combat only?
- Should Elites offer a guaranteed unique/relic-tier gear reward?
- Boss-floor cadence: single final boss, or mid-run mini-bosses at fixed floors?
- Do we want deterministic daily seeds surfaced in v1 (Phase E) or later?
