# Level Difficulty Calculator — design, findings, and status

Started 2026-08-14. A local-only tool to reason about level difficulty vs.
player power, RPG-style. **Not player-facing**; no version bump, no
auto-commit — same safety posture as the Balance Lab.

## ⭐ The actual deliverable = a CALCULATOR (not the simulator)

Reframed 2026-08-15: the goal is a **calculator that reduces levels and arsenals
to comparable numbers** for balancing (RPG "recommended power" bands) — NOT a
battle simulator. The simulator (`balance-sim.js`) is only the **calibration
oracle** for the calculator's constants.

**Shared currency = effective firepower on the path (DPS).** A level *demands*
firepower; an arsenal *supplies* it; ratio → RPG band. All three questions below
fall out of one demand-vs-supply model.

**DELIVERED — level difficulty (demand side), 2026-08-15:**
`src/level-difficulty.js` (pure analytic, no engine) + page
`balance-difficulty.html`. Per wave, demand = `max(swarm, burst)` where
`swarm = ΣeffHP / killWindow` (`killWindow = spawnSpan + coverage/speed`, i.e.
enemies linger in range) and `burst = effHP·speed / coverage` (drop one tank in
transit). `effHP = baseHealth·healthMults / bestCounterMult` (best damage type
available by that level: laser+pulse, +railgun@L5, +rocket@L10). Units = DPS →
converted to **base-laser-equivalents** (÷ laserDPS × utilization). Knob:
`DIFF_TUNING.utilization = 0.8`. **Calibrated against the oracle:** L1 W1 → 1.8
laser-eq (2 clear it), W2 → 4.4 (4 clear it).

**Two DISTINCT bottlenecks per level (reported separately — conflating them was a
bug, see correction below):**
- **Peak firepower = the LEVEL DIFFICULTY** = the wave needing the most firepower
  (usually a late/boss wave). e.g. **L1 = ~17 laser-eq at W10** (the boss). This
  matches a real ~14-tower mixed roster and explains losing W10 (needs ~17, you
  field ~15). Campaign curve: L1 17 → L2–3 20–24 → L4–8 31–35 → L9–11 35–71 →
  L12–18 45–208 → **L19 5245 (spike)** → L20 273.
- **Economy crunch** = the wave where demand most outruns *early* money (usually
  W1–W3). e.g. L1 = W2, 1.3× affordable. A separate lens, not the difficulty.

**Findings the tool surfaced:** L19 W1 = **60 armored @5760 HP** (group ×12 and
wave ×8 healthMults *stack* to 96× — verify intended, not a typo); L20 has
**55/96 tiles blocked** (coverage 1.05t) → geometry-hard by design. Late-level
"crunch" is inflated because the base-laser lens ignores the real arsenal a
player brings — that's the supply side, now DELIVERED (below).

### Correction — the "4 laser-eq for L1" headline was WRONG (fixed)
The first version headlined each level with the *economy-crunch* wave's req
(L1 = W2 = 4.4), which reads absurdly low for the whole level. The difficulty is
the **peak-firepower** wave (L1 = W10 = ~17). `analyzeLevel` now returns both:
`reqLasers`/`peakWave` (firepower peak = difficulty) and
`ecoRatio`/`ecoWave` (money crunch).

**DELIVERED — arsenal power (supply side) + the map, 2026-08-15:**
`src/arsenal-power.js` (pure analytic, reuses EXPORTED `towers.js careerStatsFor`
for the real DPS curve). `towerFirepower(spec)` → laser-eq = `rawDPS/22.86 ×
splashWeight × powerMult`. `arsenalPower({towers}, levelId)` gates supply through a
greedy **buy+upgrade economy** (place @baseCost, then upgrade L→L+1 @ real
upgradeCost×mult, always taking the best marginal laser-eq/gold until
`startingMoney+Σbounty` runs out) → the power a roster REACHES by end-of-level.
Goal #3 = the **recommended-level map** built into `balance-difficulty.html`:
per level × sample roster, `supply÷demand` colored green(≥1.3)/yellow(0.7–1.3
fair)/orange/red(<0.45 wall).
- **Base laser = 1.00 laser-eq** to the decimal; maxed range 111 (L5) → 1405 DPS /
  61 laser-eq (L10 + mastery cap +75%) — bounded, no runaway.
- **ARSENAL_TUNING oracle-calibrated** (balance-sim `simulateWave`, L1 W3 50-enemy
  swarm + L3 W10): 6 lasers = 5 pulses = 5 lasers+1 slow to clear → **splashWeight
  .pulse 1.55**, **slowSupportPerTower 0.20**; rocket 1.9 extrapolated by splash
  radius (untested). L2 W9 unclearable by base towers → excluded.
- **Skills/gear** = `spec.powerMult` (Fresh ×1 / Mid ×1.4 / Veteran ×2), grounded
  in the real damage-skill max (+10%/box × 5 = ×1.5) + gear. Real gear can be
  passed via `spec.gear` (careerStatsFor applies it); skills stay a powerMult
  because `state.skills` is module-private.
- **Map reads right:** Veteran facerolls W1-3 (15/15 fair+, L1 2.63×), Mid
  comfortable (10/15), Fresh grinds (3/15, 7 walls). **World 4 reads falsely-hard**
  — pierce/conduit/spiral force-multipliers are unmodeled (flagged on-page); W4 is
  really too EASY for a maxed roster. That's the last modeling gap.

To CONTINUE cheaply, read `LEVEL_CALCULATOR_RESUME.md` (not this whole plan).

## The three questions it must answer

1. **Minimum roster to clear** — for each level, the fewest towers + unlocks
   (and placement) that beat it.
2. **Arsenal power** — reduce a player's roster (tower XP levels, gear, skills)
   to a single "power" score.
3. **Difficulty ↔ power map** — a level's difficulty as one number, compared to
   arsenal power, to give an RPG "recommended level" band (under-powered / fair
   fight / trivial).

## Approved architecture — "Plan C" (two layers)

The difficulty of this game is dominated by **geometry + targeting dynamics**
that a closed-form model cannot reliably capture (proven below). So:

1. **Fast analytic front-end** — the difficulty CALCULATOR (`level-difficulty.js`)
   + coverage ranking + economy/affordability. Instant, tunable. Reduces each
   level to a firepower number and flags spikes. **This is the deliverable.**
   (Difficulty AND arsenal-power sides BUILT 2026-08-15; recommended-level map too.)
2. **Ground-truth oracle** — a **headless run of the real game engine**
   (`game.js updateGame` loop), NOT a reimplementation. Returns true
   leak/clear numbers because it *is* the game. Now used purely to **calibrate**
   the analytic constants (not the product). (Built — see "What exists".)

The oracle calibrates the analytic numbers; the analytic calculator is what you
use day-to-day. Build order: oracle (done) → economy/whole-level validation
(done) → analytic difficulty number (done) → arsenal power (done) →
recommended-level map + oracle-calibrated tuning (done). All delivered 2026-08-15.

## Modeling findings (the physics — do not re-derive)

Hard-won during ideation; a naive model gets these wrong.

- **Coverage = path-arc-length inside a tower's range circle.** Damage to an
  enemy = `DPS × time-in-range`, and `time-in-range = coverage ÷ enemy speed`.
  `def.speed` is literally tiles/sec (`enemies.js`: `speedTilesPerSec =
  def.speed`), so this is exact.
- **Corner premium ≈ 1.62×.** A tower in an elbow pocket sees *two* path legs
  in one range circle; a straight-adjacent tower sees one. Measured on L1:
  corner tile ≈ 5.22 tiles covered vs 3.22 for a straight tile. Hairpins can
  see 3 legs. "A good player fills the best pockets first" = **greedy marginal
  coverage** (submodular; discount already-covered path per pick).
- **Same-speed bunching is the key dynamic.** Enemies in a wave move at
  identical speed in a tight "train"; the whole train enters a single tower's
  zone almost simultaneously and leaves together. A lone single-target tower
  therefore gets **one brief pass** at the train and lands only ~2–3 kills —
  there are no stragglers to pick off. This is why **spreading / clustering
  towers along the path matters enormously**, and why each added tower removes
  a big chunk of leaks.
- **"Furthest-along" targeting is inefficient on a train.** Towers shoot the
  enemy furthest along the path in range — i.e. the one about to *exit* the far
  edge — so front-runners escape after 1–2 hits, wounded but alive, and leak.
  Single-tower efficiency ≈ **48%** of raw shot damage.
- **Efficiency is NOT constant** — it rises sharply with more/clustered towers
  because of **damage carryover**: a downstream tower finishes the wounded
  escapees an upstream tower softened. (L1 W2: one laser ≈48% efficient; four
  clustered lasers ≥83% → clears.) *This is why a fixed analytic fudge factor
  fails and the real engine is required.*
- **What the analytic layer CAN predict exactly:** coverage, **shots on
  target** (`shots ≈ (trainLen + zoneLen) / speed / fireInterval`; predicted 26
  for the 1-laser L1W1 anchor, engine gave 25), and economy. **What it can't:**
  kill count / leaks → needs the engine.
- A hand-rolled 1-D PowerShell sim (scratchpad, throwaway) was directionally
  right but had movement/spawn bugs and diverged from anchors. Abandoned in
  favor of driving the real engine. **Lesson: don't reimplement combat.**

## Calibration anchors (ground truth from real play)

All **level-1, base lasers, no upgrades/gear/skills**. These are the regression
suite for the oracle.

- **W1** (14 basic @20hp, spawnInterval 0.4): 1 corner laser → **9 leaks, 26
  shots**; 2 lasers (corner or straight) → **clear (0)**.
- **W2** (16 basic @40hp, spawnInterval 0.3): 2 lasers 2nd-on-straight → **12**;
  2 lasers 2nd-in-corner → **10**; 3rd in corner → **6**; 4th in corner → **0**.
- **Placement screenshot (wave 3 state):** player **clusters two lasers per
  elbow pocket** — ~`(5,2)`+`(5,3)` (top-right), ~`(2,5)`+`(2,6)` (center), one
  near spawn. Coordinates cross-checked against the known blocked tiles
  `(3,2)(4,2)(0,5)(7,5)(4,8)(2,11)`.

## What exists (built + validated 2026-08-14)

Local tooling, not imported by `index.html`, no version bump:

- **`src/balance-sim.js`** — headless harness. Drives the real
  `createGame` → `startNextWave` → `updateGame(game, 1/60)` loop (the same path
  `window.step` uses); no renderer/DOM. API:
  - `simulateWave(levelId, waveIndex, placements, opts)` → `{leaks, coreBefore,
    coreAfter, cleared, shots, seconds}`. Places **base** towers via
    `createTower(type,x,y,grid,null)` (bypasses economy + veteran deploy).
  - `simulateLevel(levelId, placements, opts)` → per-wave leaks + final verdict
    (core carries across waves).
  - `buildableTiles(levelId)`, `searchMinClearWave(levelId, waveIndex,
    towerType, maxTowers, opts)` — greedy placement search using the engine as
    oracle (adds towers one at a time, picks the tile that most cuts leaks;
    allows two per pocket).
  - `snapshotSave()` / `restoreSave(snap)` — the harness calls `resetProgress()`
    (which `clearSave()`s!) for a fresh player, so pages **must** snapshot the
    real save (`geometric-td-save-v1`) first and restore it byte-for-byte.
- **`src/balance-sim.js` (economy layer, added 2026-08-15)** — whole-level
  runner with the REAL in-battle economy (#1). New exports:
  - `simulateLevelEconomy(levelId, policy, opts)` — plays wave 1→N; between
    waves a `policy(game, ctx)` spends `game.money` via the real
    `placeTower` / `tryUpgradeTower` (money+XP gated). Forces
    `autoStartNextWave=false` so there's a spend phase each wave; the engine
    applies wave-clear interest itself. Returns verdict + per-wave money/leak
    log + `wavesReached` + final roster (with in-battle levels).
  - `scriptedPolicy(actions)` — deterministic ordered spend (place/upgrade),
    respects ordering (saves for the next action if unaffordable, drops invalid).
  - `coverageGreedyPolicy(pool)` — "good player": place best-coverage pockets
    as money allows, else deepen (upgrade highest-coverage eligible tower).
  - `coverageRankedTiles(levelId, type)` — buildable tiles by path-arc coverage
    (analytic; pockets first). `findMinArsenalCoverage(levelId, opts)` — grows
    k=1..N top-k pockets until the level clears (upper bound on true optimum).
  - `autoSolveLevel(levelId, opts)` (2026-08-15) — mixed-type engine-oracle greedy
    for goal #1 (survival score + lookahead + 2-pulse pairs stall-breaker). BUILT
    but PARTIAL — plateaus ~wave 7 (greedy lacks global type-allocation foresight;
    see Next-steps #5). The oracle is correct; the search heuristic is the gap.
- **`src/level-difficulty.js` (2026-08-15) — the difficulty CALCULATOR (product).**
  Pure analytic, no engine. `analyzeLevel(levelId)` / `analyzeCampaign()` →
  per-wave demand, peak-firepower (difficulty) + economy-crunch, in base-laser-eq.
  Tunable `DIFF_TUNING`. See the DELIVERED section at top.
- **`balance-sim.html`** — anchor-check page (engine vs. the anchors above).
- **`balance-search.html`** — greedy placement-search page.
- **`balance-economy.html`** — whole-level economy page (#1): coverage ranking,
  fidelity check, pristine full-level run, the infinite-money XP diagnostic.
- **`balance-difficulty.html` — the 20-level difficulty table + campaign curve.**
- Run: `./serve.ps1`, open `http://localhost:8420/balance-difficulty.html` (or
  `balance-economy.html` / `balance-sim.html` / `balance-search.html`). DOM tables
  only (no canvas capture).

**Note:** the OLD `simulateLevel` (free base towers, no economy) is BROKEN — it
never calls `startNextWave`, so it runs zero waves (returns core-full, no
per-wave data). It was never on the validated path; use `simulateLevelEconomy`.
Fix or delete it if it's ever needed.

## Key finding (#1, 2026-08-15): a pristine player CAN clear L1 (1–9)

**A pristine player (`resetProgress` — no veterans/skills/gear) clears L1's waves
1–9, losing only wave 10**, with a clustered **laser + pulse** roster. Verified
two ways: (a) a roster transcribed from a real first-play screenshot clears 1–9
in the engine; (b) a scripted build order under the fixed economy reproduces the
same 0-leak-through-9 run. This **matches real play** (user screenshots, SKILLS 0,
core 20/20 through wave 9).

The mechanism: **buy continuously and hold 0 leaks.** Start $100 = 2 lasers; a
3rd/4th tower is bought **mid-wave** as bounty arrives (a 4th laser injected even
3 s into W2 still gives 0 leaks). Holding 0 leaks banks the **full** bounty of
every enemy → the roster snowballs (W3's 50-enemy swarm alone pays for the
pulses). Pulse's splash makes the swarms robust (∞-money 6-pulse clears with core
15); laser-only is XP-starved and only marginal.

### Correction — the earlier "walls at wave 3" was a TOOL BUG, not a game fact

An earlier version of `simulateLevelEconomy` spent only **between** waves, then
froze the roster for the whole wave. That prevented the just-in-time mid-wave
purchase that holds W2 at 0 leaks, producing a false wall at wave 3 and a fake
"income death spiral." **The engine/oracle was correct all along** — it
reproduces the real roster clearing 1–9. **Fix:** `simulateLevelEconomy` now
spends **continuously** (opts `continuous` default true, `spendEverySec` 0.5) —
the policy is called between waves AND every 0.5 s of sim time during a wave.
Lesson: model the economy at the granularity the real game allows (per-frame
buying), not per-wave.

Safe to run headless: no network in the `updateGame` path (`recordBattleEnd`
only writes localStorage; telemetry lives in `feedback.js`, called from the UI
layer, not the engine).

## Validation results

- **Anchor check:** exact on W1 1-corner leaks (9) and shots (25≈26), W1
  2-corner (0), W2 2-straight (12); within 1–3 leaks on the rest — the residual
  is placement-tile precision (auto-placed greedy elbows vs. the player's
  clustered pockets).
- **Greedy search independently reproduced the anchors:** min **2 lasers** to
  clear L1 W1; min **4 lasers** to clear L1 W2 with 0 leaks; it chose
  `(5,2)`+`(5,3)` — the *same pocket-clustering the screenshot shows* — and its
  leak curve `14→11→7→0` tracks the measured `12→10→6→0`. Fast: ~234 headless
  battles / ~2.4 s for a wave.

## Reference data (verified 2026-08-14)

- **Engine entry:** `updateGame(game, dt)` is pure logic; `TILE_SIZE = 64`
  (`main.js`); `LEVELS` is an array (find by `.id`); `recomputeStats` is
  **not** exported (upgrade a tower via the real `tryUpgradeTower`).
- **DPS/upgrade math:** `towers.js recomputeStats` / `careerStatsFor`;
  `towerUpgrades.damageGrowth 0.35`, `fireRateGrowth 0.10`; base laser
  damage 8 / fireInterval 0.35 → **22.86 DPS**, range 1.9 tiles, energy.
- **Fresh L1 roster:** Laser/Pulse/Slow unlocked; Railgun needs L5, Rocket L10
  (`progression.js isTowerUnlocked`).
- **Resists** (`enemies.js damageMult`): armored ×0.4 energy (the L1 W6 wall),
  fast ×1.3 energy, boss ×1.0 energy; pulse ×1.2 armored is the counter.
- **L1:** grid 8×12, path length 29 tiles, coreHealth 20, startingMoney 100,
  10 waves. Two difficulty regimes: **throughput** (swarms) vs **single-target**
  (tanky/boss — base lasers cannot solo the L10 boss @2720hp; needs upgrades).

## Next steps

1. **Whole-level economy sim — DONE + validated against real play (2026-08-15).**
   Built `simulateLevelEconomy` (continuous spending) + policies +
   `balance-economy.html`. Reproduces a pristine player clearing L1 waves 1–9.

2. **Mixed-type engine-oracle auto-solver — BUILT, PARTIAL (2026-08-15).**
   `autoSolveLevel(levelId, opts)`: plays the full level (continuous economy);
   each round, when it walls at a wave, it asks the engine which affordable buy
   (any type, any ranked tile) best improves SURVIVAL — lexicographic score
   [wavesReached, coreAfter, −totalLeaks, typeRank(pulse>laser>slow), coverage,
   −cost]. Has one-wave `lookahead`, a 2-pulse **pairs stall-breaker** (dense
   swarms need ≥2 clustered pulses — no single tower helps), and separates
   real-progress (survival only) from tie-breakers. Big win over laser-only
   (wave 2 → wave 7). **But it does NOT cleanly clear L1** — it plateaus ~wave 7.
   Root cause (diagnosed): **greedy lacks global type-allocation foresight.** To
   survive waves 1–5 it fills the best central pockets with cheap lasers; those
   are exactly the pockets the wave 6–10 swarms need for PULSES (as the real
   winning roster does). By the time pulses are needed, the good spots are taken
   and no 1–2 tower add flips a late swarm. A human reserves the center for pulse
   from the start. **The engine/oracle is correct** (a transcribed real roster
   clears 1–9); the gap is purely the automatic SEARCH heuristic.
   **Fix path (not yet built):** solve **hardest-wave-first** (find the pulse-heavy
   center roster that holds wave 10, then back-fill/verify earlier waves + the
   economy) or a **beam search** over type-tile assignments. That reserves the
   center for pulse by construction. Meanwhile the tool is already useful as a
   **manual-roster verifier** (proven) and a **relative-difficulty probe** ("how
   far does strategy X get").

3. **Difficulty calculator (goal-adjacent) — DONE 2026-08-15.** `level-difficulty.js`
   + `balance-difficulty.html` (see the DELIVERED section at top). Reduces each
   level to a peak-firepower number + economy-crunch flag; calibrated vs oracle.

4. **Arsenal power (goal #2) — DONE 2026-08-15.** `arsenal-power.js` reduces a
   roster (tower type/level, mastery xp, gear, powerMult) to a **supply** number in
   base-laser-eq, gated by a greedy buy+upgrade economy. See the DELIVERED block
   near the top.

5. **Recommended-level map (goal #3) — DONE 2026-08-15.** Per level ×
   sample roster, `supply ÷ demand` → green/yellow/orange/red band, in
   `balance-difficulty.html`. `ARSENAL_TUNING` oracle-calibrated (pulse 1.55, slow
   0.20); skills/gear via powerMult. See the DELIVERED block near the top.

6. **Min-cost MIX solver — DONE 2026-08-15** (fixes step 2's greedy plateau).
   `balance-sim.js solveLevelMix(levelId, opts)`: searches target compositions
   (nPulse/nLaser/nSlow, pulse claiming the best tiles) and replays each with the
   real continuous economy (`mixedPoolPolicy`: cheapest-affordable placement first
   so lasers survive early and pulses drop onto reserved good tiles once bounty
   accrues). Returns the simplest surviving mix (affordable by construction) or
   null. L2+ veteran carry-over via `progression.js seedRoster` + `opts.seedRoster`.
   Validated on L1: laser-only stalls ~W7; best fresh mix (3P/4L) reaches W10 but
   loses (the intended lose-improve-win); a veteran roster clears (simplest 1P/4L).

7. **Remaining nice-to-haves (deferred).** (a) Model World-4 geometry force-
   multipliers (pierce/conduit/spiral) so W4 rows stop reading falsely-hard.
   (b) Per-wave upgrade-cost economy on the ANALYTIC side. (c) Regime-aware pricing
   of the analytic REQ/AFFORD (swarm channel in pulse, burst in single-target) so
   the fast gauge stops mis-pricing dense swarms. (d) DONE — `balance-mix.html`
   Survival Solver page (fresh vs maxed × 20 levels). (e) Improve the solver's
   World-4 play — coverage tile-ranking misses conduit/spiral placements, so
   L16/17/19/20 show maxed-✗ (solver limit, not real over-tuning).

5. **Deferred:** hardest-wave-first / beam-search auto-solver for goal #1
   (min roster); analytic pruning of oracle search; Balance Lab tab integration.

## Constraints

- Vanilla JS ES modules, runs in-browser via `serve.ps1`; no build step.
- Local tooling only — never imported by the player build, never bumps
  `version.js`, never auto-commits. Snapshot + restore the real save around any
  run. Assert on state/DOM; never capture the game canvas.
- **Exception (2026-08-18): the Balance Dashboard is deployed.**
  `balance-difficulty.html` + `level-difficulty.js` + `arsenal-power.js` are
  committed to the public Pages site for phone viewing (see
  `LEVEL_CALCULATOR_RESUME.md` "Phone access"). It is safe *only because it is
  pure-analytic and never writes `localStorage`*. The engine-driven pages
  (`balance-mix.html` + the calibration harnesses) stay local-only — they write
  the save key and must not share the game's origin. Still no `version.js` bump.
