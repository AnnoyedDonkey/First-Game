# Geometric TD — Developer Handoff

Read this first if you are an AI assistant (or human) picking up this project.
Companion docs: `GAME_BRIEF.md` (original spec + feature history). The user's
design taste and workflow preferences are at the bottom — follow them.

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
- **Skill tree:** 7 skills x 5 tiers, +10%/tier (core: +5HP/tier), tier costs
  1/1/2/2/3 points. 1 point per battle won (replays farmable by design).
- **Railgun:** unlocked when `level_005` is in completedLevels. Pierces all
  enemies along the beam corridor. Tray shows "CLEAR LV 5" until then.
- **Splitter** spawns 2 splitlings on death (children inherit the wave's
  mods). **Regenerator** heals `regenRate` (5%) of max HP per second.
- **1 skill point per win** — awarded in `recordBattleEnd`.

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

## Backlog (user-approved, not yet built)

- Split XP among damage contributors (fixes Slow towers never leveling).
- Possibly stiffen level 6 if real play finds it too easy.
- Ideas floated but unscheduled: endless mode, save export/import (iOS
  Safari evicts localStorage after ~7 days unused), sound, more levels/
  towers (Tesla chain-lightning was the runner-up), pre-battle loadouts.
