# Level Calculator — RESUME (read ONLY this to continue)

Local balancing tool for Geometric TD. Goal: reduce **levels** and **arsenals**
to comparable NUMBERS in a shared unit (**base-laser-equivalents of effective
firepower**) so difficulty can be mapped vs arsenal power, RPG-style
(recommended-level bands). It is a CALCULATOR, not a simulator — the headless
engine is only the calibration oracle.

**Local-tooling rules:** never bump `version.js`, never auto-commit; snapshot +
restore the real save (`geometric-td-save-v1`) around any engine run; assert on
DOM/state, never screenshot the game canvas. Serve with `./serve.ps1` (port 8420).

**Phone access — the ONE deliberate exception (2026-08-18).** The Balance
Dashboard (`balance-difficulty.html` + `src/level-difficulty.js` +
`src/arsenal-power.js`) is committed and deployed to the PUBLIC GitHub Pages
site so it can be viewed on the phone at
`…/First-Game/geometric-td/balance-difficulty.html`. Safe to publish because the
dashboard is **pure-analytic: it reads progression getters but never writes
`localStorage`** (no engine run) — it cannot touch the real save even on the
game's own origin. Still NOT bumped in `version.js` (the game never imports it,
so it's inert for players and won't trigger the update nudge); it is simply
unlinked from every menu. Everything else stays **local-only**: the Survival
Solver (`balance-mix.html`) and the three calibration harnesses
(`balance-economy/search/sim.html`) run the real engine and WRITE the save key,
so they must never share the game's Pages origin. Do not "finish the job" by
deploying those too.

## Done + working
- **Difficulty (demand side)** — `src/level-difficulty.js` (pure analytic, no
  engine) + page `balance-difficulty.html`. `analyzeLevel(id)` /
  `analyzeCampaign()`. Each level →
  - **PEAK FIREPOWER** = the difficulty (hardest wave's req, base-laser-eq)
  - **ECONOMY-CRUNCH** = separate early-money flag (do NOT confuse the two)
  - wave demand = `max(swarm = ΣeffHP/killWindow, burst = effHP·speed/coverage)`;
    `effHP = baseHealth·healthMults / bestCounterMult(by level)`.
  - Calibrated vs the engine: L1 W1→1.8 laser-eq (2 clear), W2→4.4 (4 clear).
    Knob `DIFF_TUNING.utilization = 0.8`.
  - Campaign difficulty: L1 17 → L2–3 20–24 → L4–8 31–35 → L9–11 35–71 →
    L12–18 45–208 → **L19 5245 (data spike)** → L20 273.
- **Engine oracle (calibration only)** — `src/balance-sim.js` +
  `balance-economy.html`. Validated a pristine player clears L1 waves 1–9 via
  continuous mid-wave buying.
- **Arsenal power (supply side)** — `src/arsenal-power.js` (analytic, no engine).
  `towerFirepower(spec)` (spec `{type, level 1..10, xp?, gear?}`) reuses EXPORTED
  `towers.js careerStatsFor` → laser-eq = rawDPS / 22.86 × splashWeight.
  `arsenalPower({towers,skills}, levelId)` → economy-gated supply via a greedy
  BUY+UPGRADE economy (each tower = a ladder of steps: place @baseCost, then
  upgrade L→L+1 @ real upgradeCost×mult; repeatedly take the best affordable
  marginal laser-eq/gold until budget=startingMoney+Σbounty runs out) → the power
  the roster REACHES by end-of-level. × controlMult (slow) × coverage(stub).
  `opts.placementOnly` reverts to the old place-only gate. `ARSENAL_TUNING`:
  splashWeight {pulse 1.6, rocket 1.8}, slow support +0.15/tower cap 1.4 — all
  UNCALIBRATED, need an oracle pass.
  - **Unit is faithful:** base L1 laser = **1.00** laser-eq (22.9 DPS) to the decimal.
  - **Real maxed range (browser-verified, no skills/gear):** L5 no-mastery 111 DPS
    → L5 mastery-cap 195 → L10 no-mastery 803 → L10 mastery-cap **1405 DPS (61
    laser-eq)**. Mastery caps at rank 50 / **+75% dmg** — bounded, no runaway. The
    old "~650 DPS ≈ 28 laser-eq" note was rough; trust these instead.
  - **No double-count:** demand's effHP already ÷ bestCounterMult, so supply is
    NEUTRAL rawDPS (no resist bonus re-applied); resistCoverage() stubbed at 1.
  - **Watch-out:** careerStatsFor reads skills from the LIVE save (progression
    getters). Fresh/empty save = no skills = 1× = the calib baseline. Hypothetical
    skill loadout = snapshot→writeSave→recompute→restore.

## Corrected mistakes — do NOT repeat
1. "Pristine player can't clear L1 / walls at wave 3" was a TOOL BUG (spending
   only between waves). Pristine DOES clear 1–9. Fixed (continuous spending).
2. "L1 difficulty ≈ 4 laser-eq" was the *economy-crunch* wave, not the
   difficulty. L1 difficulty ≈ **23** (W10 boss+swarm). Report both peaks separately.
3. **PURPOSE of REQ L / AFFORD L = an AFFORDABILITY check, nothing more.** The one
   question is: can the money the player has by wave N buy ENOUGH FIREPOWER for
   that wave? Lasers are just the shared CURRENCY: REQ L = the wave's firepower
   demand in base-laser units; AFFORD L = spending power = money÷$50 in the same
   units; REQ ≤ AFFORD = affordable. The player never actually fields base lasers
   (they buy a few upgraded towers, which deliver more firepower per $); the laser
   is a yardstick/UNIT, not a claim that lasers are the efficient buy. Calibrate
   REQ L as a roster-agnostic DEMAND number, not via laser-only clear tests (which
   conflate demand with laser deployment quirks).
4. **Laser is NOT the cost-efficient firepower baseline — splash breaks the scalar
   model (KNOWN FLAW, 2026-08-15).** A pulse removes `damage × enemies-in-radius`
   per shot, so on a crowd its effHP-removal scales with crowd size; a laser is
   single-target. ORACLE-CONFIRMED: laser-only economy CANNOT clear L1 (stalls
   ~W7/10 at any laser count ≤16); pulse-only stalls at W2 (too pricey early) — so
   L1 needs a MIX (cheap lasers early + pulse for the dense waves). Implication:
   firepower has a SHAPE (single-target vs area). A dense swarm is mis-priced in
   laser units (huge via laser / small via pulse; lasers can't clear it at any
   count). CONCURRENCY: swarmRest should be priced in PULSE (splash), not laser-eq.
   FIX DIRECTION (not built): regime-aware pricing — burst channel in single-target
   cost, swarm channel in pulse cost scaled by crowd density (spawnRate×speed×
   splashRadius). Reuse arsenal-power splashWeight (pulse 1.55), make it crowd-scaled.
5. **"Can they afford to survive?" is a MIN-COST-MIX optimization, not a formula
   (user, 2026-08-15).** A good player buys the tower MIX that counters each wave:
   type-match (pulse counters ARMORED; energy-resist enemies punish laser), splash
   for crowds, SLOW as a force-multiplier (+30% vulnerability to ALL other towers'
   hits on slowed enemies — verified vulnerability 0.3), tower cost × fire-rate ×
   timing (pulse strong but pricey/slow early), all vs money in hand. Closed-form
   laser-eq CAN'T carry this — it's the ORACLE's job (autoSolveLevel). Affordability
   = cheapest surviving mix's cost ≤ budget by wave N. Keep analytic REQ/AFFORD as
   a fast single-target-biased GAUGE; make the oracle mix-solver the AUTHORITY.
   **DONE (2026-08-15): `balance-sim.js solveLevelMix(levelId, opts)`** — searches
   target COMPOSITIONS (nPulse/nLaser/nSlow, pulse claiming the best tiles) and
   replays each with the real continuous economy via `mixedPoolPolicy` (cheapest-
   affordable placement first, so lasers survive early and pulses drop onto reserved
   good tiles once bounty accrues). Any mix that clears did so on the level's OWN
   money → affordable by construction; returns the SIMPLEST survivor or null
   (unsurvivable). Fixed the old greedy's plateau (that put cheap lasers on the best
   tiles, blocking pulses). Default sweepAll:false = stop at first survivor (~3s);
   sweepAll:true = full table (slow, ~85 sims). VALIDATED on L1: laser-only stalls
   ~W7; best FRESH mix (3P/4L) reaches W10 but loses (core 0 = the intended lose-
   improve-win); a VETERAN roster clears (simplest = 1P/4L, core 7).
6. **Tower XP / veteran power at L2+ (user, verified in code).** createTower sets
   `level:1` — EVERY tower re-enters battle at in-battle level 1. But a deployed
   VETERAN carries: mastery (banked career XP → permanent damage at any level),
   specialty (scales off career maxUnlockedLevel), and CHEAPER re-leveling (re-buys
   up to unlocked level for MONEY ALONE; a fresh tower is XP-gated each step). So at
   L2 the first Laser is effectively stronger than a raw L1 tower. Career XP-levels
   ≠ in-battle money-levels (which reset each battle) — keep the two ledgers
   SEPARATE. Model L2+ affordability by seeding a realistic veteran roster (XP/gear).
   **DONE: `progression.js seedRoster(records)`** (tooling-only export; records =
   `[{type, maxLevel, xp?, gear?, count?}]`) installs a synthetic veteran roster
   after resetProgress so `takeRosterUnit` deploys veterans. Wired into
   `simulateLevelEconomy` via `opts.seedRoster` (→ solveLevelMix opts.seedRoster).
   MODULE-CACHE GOTCHA: dynamic `import('...balance-sim.js?v=…')` does NOT cache-bust
   its STATIC `import` of progression.js — after editing progression.js you must
   RELOAD THE PAGE (navigate) or the browser keeps the stale module (throws "does
   not provide export seedRoster"). Reload, then re-run.
   **Skills too: `progression.js seedSkills(spec)`** — spec = array of ids (tier 1)
   OR `{id: tier}` for multi-tier. IDs: `${type}_dmg1..5` (+50% dmg), `${type}_lvl6..10`
   (Overclock → cap 10), `eco_money/intrate/intcap 1..5`, `coreHealth` (1..5 → +5 core
   each). Wired via `simulateLevelEconomy` opts.seedSkills. A realistic maxed roster
   needs ALL of these — WITHOUT economy skills + core plating it's money-starved and
   loses tight openers (L11 failed until they were added).

- **Survival Solver page — DONE (2026-08-16): `balance-mix.html`.** Runs
  `solveLevelMix` across all 20 levels × two reference rosters — FRESH (empty) vs
  MAXED (all types L10, all dmg+Overclock+economy skills + core plating, deep
  mastery). Per level: survives? + simplest surviving mix + core left. Progressive
  (Run button, ~30s). Findings: fresh ✗ on EVERY level (no cold clears — the
  lose-improve-win design), maxed ✓ through World 3, maxed ✗ on L16/17/19/20 (the
  World-4 geometry levels — coverage tile-ranking can't find the conduit/spiral
  play; a SOLVER limit, NOT real over-tuning — caveated on the page). Chose
  fresh-vs-MAXED (two well-defined ends) over a per-level "veteran" tier after
  finding that scaling an "appropriate" veteran is an un-calibratable rabbit hole.

- **Recommended-level MAP (goal #3)** — built into `balance-difficulty.html` (new
  "Recommended-level map" section). Per level, per sample roster: cell = `supply ÷
  demand` colored green(≥1.3 over)/yellow(0.7–1.3 fair)/orange(0.45–0.7 hard)/
  red(<0.45 wall). Three preset rosters (Fresh L5 · Mid L7 · Veteran L10) span the
  curve. Browser-verified clean; gradient reads Fresh‹Mid‹Veteran and rises with
  level. W1-3 summary line: Fresh 3/15 fair+, Mid 5/15 (1 wall), Veteran 13/15 (0
  walls) — sensible.
  - **Two honesty caveats ON the page:** (1) NO skills/gear modeled (empty save) →
    every ratio is a LOWER BOUND on a real player. (2) **World 4 (L16-20) reads far
    too harsh** — pierce+conduit+spiral geometry force-multiplies one tower many-
    fold and neither side models it; W4 rows are indicative only (matches HANDOFF
    "geometry, not curve"). W4 is really too EASY for a maxed roster, the OPPOSITE
    of what the raw ratios show.

## Done (both refinements, 2026-08-15)
- **ARSENAL_TUNING oracle-calibrated** via balance-sim `simulateWave` on L1 W3 (50-
  enemy swarm) + L3 W10: min base towers to clear = 6 laser / 5 pulse / 5 laser+1
  slow. → **splashWeight.pulse 1.55** (6/(5×0.785)=1.53; L3W10 agreed ≥1.59);
  **slowSupportPerTower 0.20** (slow replaced 1 of 6 lasers). rocket 1.9 =
  extrapolated by splash radius (0.9/0.7), NOT directly tested. L2W9 was
  unclearable by base towers (needs upgrades) → excluded, correctly.
- **Skills/gear gap closed** via `spec.powerMult` (default 1) in `towerFirepower`,
  applied to laserEq. Grounded in the REAL damage-skill ceiling: +10%/box × 5 =
  ×1.5 max (balance-data skills.tower.damageStep 0.1), + gear estimate. Map tiers:
  Fresh ×1 / Mid ×1.4 / Veteran ×2. Result: Veteran now **facerolls W1-3** (15/15
  fair+, L1 2.63×), Mid comfortable (10/15, 0 walls), Fresh grinds (3/15, 7 walls)
  — the believable RPG gradient. Real gear can still be passed via `spec.gear`
  (careerStatsFor applies it); skills stay a powerMult because `state.skills` is
  module-private (can't seed without mutating the live save).
- **Origin-isolation note:** balance tooling on the throwaway preview port has its
  OWN empty localStorage (≠ the game's 8420 origin), so careerStatsFor reads a
  no-skills baseline there and the player's real save is never in scope. The
  snapshot/restore discipline still applies if ever run on the 8420 origin.

## Done (readability + balance Q&A pass, 2026-08-15)
- **`pierceWeight` added to ARSENAL_TUNING** (railgun **2.5**, others 1), applied in
  `towerFirepower` alongside splashWeight. Oracle-derived: on dense L3W10, 4
  railguns clear what 10+ lasers can't (≈2.5–3.6×); ~1.7× on scattered L1W3.
  Without it the map under-rated railgun (read it single-target). Density-dependent
  — 2.5 is a representative middle.
- **`balance-difficulty.html` fully rebuilt** as a readable **Balance Dashboard**
  (system font, sectioned, callout answer-boxes, collapsible raw tables) that
  answers three balance questions the user asked:
  - **Q1 pacing:** auto-flags curve jumps >40% / dips / inversions / early money
    crunches. Real flags: L1→L2 +41% (L2 is a local spike), L3→L4 +56%, L10→L11
    +54% (World-3 wall), L15 finale spike, L19 off-chart anomaly; W3 money crunch
    on L4/L9/L10.
  - **Q2 towers:** laser-eq-per-100-gold table at L1/L5/L10 + oracle min-to-clear.
    FINDING: **Railgun scales into OP** (best value by L10, ~1.5× laser / ~2.5×
    pulse-rocket per gold, pierce×damage-growth compounding); **Pulse is fine**
    (actually lowest value/gold — feels strong only via reliable splash); Rocket
    looks under-powered.
  - **Q3 skills:** power-per-point table. FINDING: aggregate pace is fine (~20 pts
    ≈ one maxed tower), but the **Level-cap/Overclock chain is the outlier** (~×7
    for 7 pts vs Damage's ×1.5 for 5); Core-Health (+25) and Money (+50%) next most
    generous. Damage chain is the well-tuned yardstick.

## Done (mid-wave economy model, 2026-08-15)
The `afford` column ignored money earned DURING a wave (only counted money banked
before it), so early waves read as false crunches (L1 W2 showed afford 3.4 vs a
4th laser you can clearly place in time). Fixed with a **per-wave mid-wave capture**:
`spendableBudget = budgetBefore + capture·thisWaveBounty` (full bounty still carries
forward via cumBounty — no double-count).
- **Auto-scaled per wave** from bounty timing: `capture = Σ(bᵢ/B)·(1−fᵢ)`, group i's
  bounty landing at `fᵢ=(spawnMid+transit)/killWindow`, `transit=captureTransitFrac·
  timeInRange`. Uniform swarm → the flat baseline; late-spawning boss → low.
- **ORACLE-CALIBRATED:** drove the real engine (clearing roster, no mid-wave buys)
  on L1–L3 and measured the actual bounty-arrival integral ∫B(t)/B(1)dt per wave.
  Early swarms measured ~0.30–0.42 (NOT the naive 0.5 — bounty lands late because
  enemies must travel to the kill zone first); sweep fit **captureTransitFrac 0.8**
  (RMSE 0.062 on L1, confirmed L2/L3). Boss waves measure ~0.5–0.62; model
  under-reads them slightly but they never drive an early-crunch flag.
- Knobs: `DIFF_TUNING.captureTransitFrac 0.8`, `captureClamp [0.1,0.9]`,
  `midWaveCapture 0.5` (fallback for zero-bounty waves / `opts.midWaveCapture`
  flat override). Wave objects now expose `capture` + `spendableBudget`; page shows
  a `cap` column. Net effect: L1 W2 crunch 1.30→1.11, and L1–L3 correctly drop out
  of the crunch flags (early levels ARE clearable, matching the oracle).

## Done (demand model fixes, 2026-08-15)
- **Concurrency fix (boss+swarm waves):** demand was `max(swarm, burst)`, which
  under-rated finale waves that have a tanky boss AND a trailing swarm — you must
  handle both at once. Oracle showed L1 W10 needs ~30 base lasers for 0 leaks (17
  cleared but leaked 5), yet the tool said req 17. Now `demand = max(swarm,
  burst_tankiest + swarm_of_the_rest)`; regime labels a `mixed (type+swarm)` case.
  Pure swarms (swarm wins, W1/W2 anchors unchanged) and lone bosses (swarmRest=0 →
  burst) are untouched. **L1 W10 17→23** (regime mixed); several boss finales rose
  (L4 34, L9 46, L12 60, L17 211…). **L1 difficulty is now 23, not the old ~17.**
  - **Validated with an EFFICIENT roster:** L1 W10 clears with exactly 4 level-5
    lasers (≈24 in reqL units, ÷18.29), and 3 don't — so the true min is ~23-24 and
    the model's 23 is spot-on. The scary "30 BASE lasers" figure was an inefficient
    deployment (30 weak towers on poor tiles = coverage degradation); laser-eq
    measures well-placed firepower, so 24 (not 30) is the right reference. The old
    17 = ~2.8 L5 lasers = doesn't clear, so the fix is correctly calibrated.
  - **Open residual:** the L5-oracle sweep shows the model progressively UNDER-reads
    HARDER finales (L2 25 vs 36, L4 34 vs 55, L7 39 vs 79) — grows with level. Next
    calibration target, but partly confounded by pure-laser resist/targeting
    inefficiency in that measurement (a real mixed roster would need fewer).
- **Resistance floor guard:** `bestCounterMult` started at 1, so it assumed a
  neutral option always exists even if an enemy resisted EVERY available tower.
  Fixed to start at 0 (`return best || 1`). Changed no campaign number (no current
  enemy resists all available types) — a correct latent-bug guard. (Confirmed the
  L1 boss is NOT laser-resistant: energy is unlisted = 1.0×; the W10 leak was
  concurrency, not resistance.)

## NEXT (all 3 goals + refinements + balance Q&A + economy + demand fixes delivered — only nice-to-haves remain)
- Model World-4 geometry force-multipliers (pierce/conduit/spiral) so W4 rows stop
  reading falsely-hard — the last real modeling gap. Hard; deferred.
- Model the in-battle UPGRADE cost more precisely per-wave (currently whole-level
  budget vs peak). Minor.

## Key numbers
- laser DPS 22.86 (8/0.35); pulse 17.9 (14/0.78) + splash; upgrade damageGrowth
  0.35, fireRateGrowth 0.10, maxLevel 5 (→10 with Overclock skill); utilization 0.8.
- Base HP field = `baseHealth` (basic 20, boss 400). L1: core 20, $100 start,
  10 waves. Unlocks: laser/pulse/slow always; railgun L5; rocket L10.

## Data spikes the tool flagged (worth verifying independently of this build)
- L19 W1 = 60 armored @5760 HP (group ×12 AND wave ×8 healthMults stack → 96×).
- L20 = 55/96 tiles blocked → coverage 1.05 tiles.

Deep archive (only if a specific detail is missing): `LEVEL_CALCULATOR_PLAN.md`.
