# Geometric TD — Developer Handoff

Read this first if you are an AI assistant (or human) picking up this project.
Companion docs: `GAME_BRIEF.md` (original spec + feature history). The user's
design taste and workflow preferences are at the bottom — follow them.

**State at handoff (July 2026, end of the Claude Fable 5 sessions):**
10-level campaign, 4 towers (Railgun unlocks after level 5), 7 enemy types,
5-tier skill tree, permanent per-class specialties, post-level-5 Mastery
ranks, per-level palettes, GeoDefense-style VFX, ¼x–4x speed controls,
deployed and playable at the GitHub Pages URL below. Everything committed
and pushed through `65cb098`. No known bugs. Next up: the backlog at the
bottom of this file, and whatever the user asks for.

**Since then (July 2026, Claude Sonnet 5 sessions):** polished the bottom
action bar shown when a tower is selected — fixed it resizing/reflowing
per tower state, shrank the upgrade/sell/wave buttons into a two-row
label+cost layout, and added a live DPS readout. See "Tower panel /
bottom action bar" under Key mechanics below for the details and a real
flexbox gotcha worth knowing before touching that markup again. Also
added **Endless mode** per level (unlocked once that level is beaten,
waves escalate forever) — see "Endless mode" under Key mechanics.

## What this is

A portrait, mobile-browser tower defense game inspired by geoDefense /
Geometry Wars. Neon vector visuals on a warping grid. The player defends an
AI Core against waves of geometric enemies across a 10-level campaign.

**The core differentiator:** towers are persistent RPG-like units, not
disposable buildings. Each tower has a name (L-01, P-02, R-01...), earns XP
and kills, and lives in a permanent roster across battles. A persistent
5-tier skill tree adds account-wide progression.

## Hard constraints (do not violate)

- Plain HTML5 + Canvas 2D + vanilla JS ES modules. **No framework, no build
  system, no TypeScript, no dependencies.** This is deliberate (user choice).
- Primary target: iPhone Safari, portrait, touch-first. Mouse must also work.
- Everything tunable lives in data (`config.js`, `levels.js`) — the user
  tweaks numbers himself. Never bury a gameplay constant in logic code.
- Keep the game runnable after every change.
- Saves must survive updates: migrate old localStorage formats, never break
  them (see `progression.js migrateSkills()` for the pattern).

## Running it

- Local: serve the `geometric-td/` folder over HTTP (ES modules won't load
  from `file://`). This machine has **no Node or Python**; use
  `serve.ps1` (PowerShell static server, port 8420).
- Live: https://annoyeddonkey.github.io/First-Game/geometric-td/
  GitHub Pages serves the `main` branch of github.com/AnnoyedDonkey/First-Game
  (public repo). **Pushing to main deploys automatically** (~1 min delay).
  The user plays on iPhone via this URL (added to home screen).
- Git: repo root is `First Game/` (one level above this folder). Commit
  after each verified feature; the user expects push-to-play.

## File map

```
index.html        page shell: HUD, canvas, overlays, tower tray
styles.css        portrait layout, dark theme, all overlay styling
src/
  config.js       ALL tuning: towers, enemies, XP/upgrade tables, economy,
                  VFX (particles + grid warp), skills. START HERE for balance.
  levels.js       10 levels, pure data: pathCorners, blockedTiles, waves,
                  per-level palette. Header comment documents the format.
  endless.js      procedural wave generator for Endless mode (past the
                  end of a level's authored waves)
  main.js         entry: canvas sizing, game loop (rAF), input wiring,
                  end-of-battle flow, speed controls, debug helpers
  game.js         state machine: waves, spawn queue, money, core HP, win/loss
  grid.js         tile math, path expansion (corners -> tiles), placement
  towers.js       targeting, firing (incl. railgun pierce), upgrades,
                  selling, roster deployment, name generation
  enemies.js      movement, damage/death (bounty/XP/shatter), slow debuff,
                  regeneration, splitting
  projectiles.js  pulse orbs + the transient effects list (beams, rings...)
  particles.js    sparks + polygon-shard death explosions (capped)
  springgrid.js   Geometry Wars warping background grid (spring mesh)
  renderer.js     ALL canvas drawing; LOOK constants; palette merging;
                  additive "lighter" pass; pre-rendered glow sprites
  input.js        unified pointer (touch + mouse) -> canvas coords
  ui.js           DOM: HUD, tower tray, upgrade/sell panel, skill tree,
                  level select, overlays, speed buttons, wheel forwarding
  progression.js  persistent layer: roster, skill tiers, unlocks
  save.js         localStorage read/write/reset (key: geometric-td-save-v1)
```

## Key mechanics (the rules that aren't obvious from code skimming)

- **XP vs money:** XP makes a tower *eligible* for its next level; money pays
  for the upgrade. Thresholds/costs in `config.js TOWER_UPGRADES`.
- **Level-up specialties:** all towers share base growth per level, but each
  class gets an extra specialty (TOWER_UPGRADES.specialties): laser +range,
  pulse +splash radius, slow +fire speed, railgun +damage. Specialties are
  PERMANENT — they follow the tower's career-best level (maxUnlockedLevel),
  so a maxed veteran keeps its full specialty while re-leveling from 1
  (user-specified rule). Base growth follows current in-battle level.
  Explained in the Tower Guide overlay (auto-opens once at level 2 via save
  flag `seenTowerGuide`; always reachable from the main menu TOWERS entry).
- **Final-hit XP:** only the killing tower gets XP. Known consequence: Slow
  towers never level (backlog item: split XP among contributors).
- **Veterans:** placing a tower type auto-deploys your best not-yet-deployed
  roster unit of that type (highest maxLevel first). Veterans re-enter at
  level 1 but re-buy up to their unlocked level with money alone (no XP
  gate — `isUpgradeEligible`). The button says UPGRADE either way (the user
  rejected "RESTORE" wording). Panel shows "LV 1/4" for unlocked potential.
- **Selling:** refunds 50% of `tower.invested` (build + upgrades). Roster
  record survives; XP earned during the current battle by a sold tower is lost.
- **Roster recording:** `recordBattleEnd` runs inside game.js at the moment
  of win/loss (NOT in the render loop — background tabs pause rAF).
- **Mastery (post-level-5 progression):** XP past the level-5 threshold
  converts to permanent damage ranks: +2%/rank, 600 XP/rank, capped at 25
  (+50%). Derived purely from saved `xp` (retroactive, no new save fields);
  follows the tower forever like specialties. Ranks up live mid-battle
  (checked in `updateTowers`). Shown as ★N in the panel and Tower Guide.
  Knobs: `TOWER_UPGRADES.mastery`. This exists so grinding earlier levels
  pays off (user-requested loop).
- **Skill tree:** 7 skills x 5 tiers, +10%/tier (core: +5HP/tier), tier costs
  1/1/2/2/3 points. 1 point per battle won (replays farmable by design).
- **Railgun:** unlocked when `level_005` is in completedLevels. Pierces all
  enemies along the beam corridor. Tray shows "CLEAR LV 5" until then.
- **Splitter** spawns 2 splitlings on death (children inherit the wave's
  mods). **Regenerator** heals `regenRate` (5%) of max HP per second.
- **1 skill point per win** — awarded in `recordBattleEnd`.
- **Tower panel / bottom action bar** (`#upgrade-panel` in index.html,
  `updateUpgradePanel` in ui.js): tapping a placed tower swaps the tower
  tray for a compact 2-row info block (name + ★mastery on row 1; DPS +
  XP/mastery status, dim grey, on row 2) plus narrow two-row UPGRADE/SELL
  buttons (label on top, cost below via `.stack-button`/`.stack-button-sub`
  — the wave button uses the same pattern). DPS is computed live as
  `tower.damage / tower.fireInterval`, no cached field.
  Deliberately fixed-size: `.upgrade-row span` is `white-space: nowrap` +
  `text-overflow: ellipsis` so long text (mastery strings especially)
  truncates instead of wrapping and growing the bar — the bar height must
  stay constant whether or not a tower is selected.
  **Flexbox gotcha (bit us once, don't repeat it):** `#upgrade-panel` is
  itself a flex container nested inside `#action-bar`'s flex row. A
  nested flex container's default `min-width: auto` makes it claim its
  full content width when shrinking, ignoring siblings — it pushed the
  `#wave-button` completely off the right edge of the screen once the
  name/DPS text got long. Fix was `min-width: 0` on `#upgrade-panel`
  itself, not just on the leaf spans. Any new nested flex row added to
  the action bar needs the same treatment.
- **Endless mode:** unlocked per level once `completedLevels` includes
  that level's id (main menu shows a second `∞ ENDLESS` row under any
  cleared level, via `showLevelSelect` in ui.js). `createGame(level,
  tileSize, endless)` sets `game.endless = true`; `startNextWave` in
  game.js plays the level's own 10 authored waves unchanged, then calls
  `generateEndlessWave(level, waveIndex)` (endless.js) once `waveIndex`
  runs past `level.waves.length`. Generation is a **deterministic**
  function of `waveIndex` (no RNG) so it stays reproducible with the
  `step()` bot-testing recipe below. Difficulty is anchored to the
  level's own final wave and compounds every extra wave — knobs in
  `config.js ENDLESS` (health/count/speed growth rates, boss cadence).
  Endless runs never hit `"won"` (that branch is guarded with
  `!game.endless` in both places in `updateGame`) — they only end in
  `"lost"`, which calls `recordEndlessResult` (progression.js) instead of
  `recordBattleEnd`: roster/XP still syncs the same way, but instead of
  `completedLevels`/`wins`/`skillPoints` it records the best wave reached
  per level (`save.js endlessBest: { levelId: waveNumber }`, shown on the
  main menu button and in the "RUN OVER" overlay). Loss overlay branches
  on `game.endless` in main.js `checkEndState` (RUN OVER / RETRY ENDLESS
  vs CORE DESTROYED / RETRY). HUD wave counter drops the `/total` ceiling
  in endless (`${wave} ∞` instead of `${wave}/${totalWaves}`), since
  `totalWaves` isn't a meaningful cap once waves are generated.

## Balance & difficulty philosophy (user's words)

"A game becomes addictive when it's just hard enough that you don't beat
each level on first try, only by levelling up or changing your tactics."

Calibration targets used so far:
- L1-2: beatable fresh with good play; sloppy play loses.
- L3+: fresh accounts lose even with optimal play; veterans win.
- L5: same maxed roster LOSES with perimeter towers, WINS from the three
  interior spiral pockets — tactics puzzles are the ideal.
- L9: campaign-1-only roster dies ~wave 4; batch-2 veterans required.
- L10: near-maxed roster wins at ~half core.
- **Bankroll rule:** wave 1 of every level must be survivable with starting
  money. Two levels shipped broken this way (economy death-spiral: leaks pay
  no bounty -> no money -> more leaks). Check openers first when tuning.
- **Endless mode (first-pass calibration, untuned by real play yet):** an
  8-tower level-1 laser wall with fresh (non-veteran, no Mastery) towers,
  continuously upgrading, died on endless wave 18 (8 waves past the
  10-wave campaign). That's the rough bar — a genuinely strong/high-Mastery
  roster should push well past that. `ENDLESS` knobs in config.js are a
  first pass; retune after real play.

## How to verify changes (no test framework — use the browser)

Debug helpers exposed on `window`: `game` (full state) and `step(seconds)`
(instantly simulates N seconds — the main balance tool).

**Balance testing recipe** (superhuman bot; humans are worse — treat "bot
loses" as strong signal, "bot wins flawlessly" as weak signal):

```js
// In the browser console / eval: pick a level, then
const T = await import('./src/towers.js');
game.money = 200;
T.placeTower(game, 'laser', 3, 3);        // build via module API
document.getElementById('wave-button').click();
while (!['won','lost'].includes(game.phase)) {
  step(1);
  // each sim-second: build from a queue when affordable,
  // rotate T.tryUpgradeTower(game, tower) across towers when money > reserve
}
console.log(game.phase, game.waveIndex + 1, game.coreHealth);
```

To test specific accounts, write the save directly then reload:
`localStorage.setItem('geometric-td-save-v1', JSON.stringify({...}))` —
schema in `save.js DEFAULT_SAVE`. **Never wipe the save without restoring or
warning the user** — his real progress lives in the same browser.

Gotchas when testing:
- rAF pauses in hidden tabs: DOM/HUD won't update, but `step()` drives pure
  game logic fine. UI modules can be exercised via dynamic `import()` since
  it returns the live module instances.
- Pointer-event simulation needs the canvas to have layout (fails at 0x0 in
  hidden tabs) — prefer the module API for placement in tests.
- Sim scripts have caused false alarms twice (policy bugs, not game bugs) —
  when a result looks insane, debug the test before nerfing the game.

## Rendering notes

- Glow = pre-rendered radial-gradient sprites + `globalCompositeOperation:
  "lighter"` additive pass. **Never put shadowBlur on per-particle drawing**
  (mobile Safari perf). Budget verified: ~2.4ms/frame at the 900-particle cap.
- The background grid is a spring mesh (`springgrid.js`); explosions call
  `game.springGrid.applyShock(...)`. Displacement clamped (VFX.warp
  .maxDisplacement) to protect readability.
- Per-level palettes: `level.palette` overrides `LOOK` keys in renderer.js
  (background, grid, path colors). Enemy/tower colors intentionally constant.
- Overlay z-order: end-of-battle overlay (10) < level select (30) < skill
  tree (40). The skill tree must stay on top — this was a real bug.

## User preferences (learned over the project)

- Wants a plan proposed before big builds; small runnable increments.
- Loves tunable variables — expose knobs, tell him where they are.
- Visual taste: "pizzazz" — glowing, dramatic, fireworks-like. When asked
  "subtle or dramatic?" he started subtle then asked for more. Err dramatic.
- Report verification honestly (what was simulated vs eyeballed).
- He plays on iPhone; always push after a verified feature so he can test.
- Speaks plainly about issues; treat his bug reports as accurate (the skill
  tree "sometimes nothing happens" report was a real z-index bug).

Other UI facts: speed controls cycle ◀ 1x->½x->¼x->1x and ▶ 1x->2x->4x->1x
(pause in the middle); the bottom action bar is hidden while the mission
selector is open. To offset the specialty power gain, all healthMult values
in levels 3-10 were scaled x1.2 (levels 1-2 intentionally untouched).

## Backlog (user-approved, not yet built)

- Split XP among damage contributors (fixes Slow towers never leveling).
- Possibly stiffen level 6 if real play finds it too easy.
- Ideas floated but unscheduled: endless mode, save export/import (iOS
  Safari evicts localStorage after ~7 days unused), sound, more levels/
  towers (Tesla chain-lightning was the runner-up), pre-battle loadouts.
