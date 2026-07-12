# Geometric TD — Developer Handoff

Read this first if you are an AI assistant (or human) picking up this project.
Companion docs: `GAME_BRIEF.md` (original spec + feature history),
`LOOT_DESIGN.md` (loot system spec + build log), `GEAR_UI_DESIGN.md`
(gear-screen redesign log), `CIRCUIT_MENU_DESIGN.md` (main-menu board log).
The user's design taste and workflow preferences are at the bottom — follow
them.

**State (July 2026):** 15-level campaign across 3 worlds, 5 towers (Railgun
unlocks after level 5, Rocket after level 10), 7 enemy types, damage-type
counter system with visible hit feedback, 8-skill tree, permanent per-class
specialties, post-cap Mastery ranks, per-level palettes, GeoDefense-style
VFX, ¼x–4x speed controls, Endless mode per level with a 5-milestone reward
track, forfeit button, a full Diablo-style loot/equipment system (Shards ◆
currency, per-tower gear in 4 slots, 5 rarities, drops/stash/triage, store),
a tower-first gear UI, and an SVG circuit-board main menu. All deployed and
playable at the GitHub Pages URL below. No known bugs.

**Active work:** economy rebalance + progression expansion, phases B1–B6,
one phase per fresh session — full spec in the approved plan at
`C:\Users\fthia\.claude\plans\purring-knitting-lake.md` (see Backlog below).

## What this is

A portrait, mobile-browser tower defense inspired by geoDefense / Geometry
Wars. Neon vector visuals on a warping grid; the player defends an AI Core
across a 15-level campaign (3 worlds).

**Core differentiator:** towers are persistent RPG-like units, not
disposable buildings. Each tower has a name (Laser-01…), earns XP and kills,
and lives in a permanent roster across battles, with account-wide skill-tree
progression on top.

## Hard constraints (do not violate)

- Plain HTML5 + Canvas 2D + vanilla JS ES modules. **No framework, no build
  system, no TypeScript, no dependencies.** Deliberate user choice.
- Primary target: iPhone Safari, portrait, touch-first. Mouse must also work.
- Everything tunable lives in data (`config.js`, `levels.js`) — the user
  tweaks numbers himself. Never bury a gameplay constant in logic code.
- Keep the game runnable after every change.
- Saves must survive updates: migrate old localStorage formats, never break
  them (see `progression.js migrateSkills()` for the pattern).

## Running it

- Local: serve the `geometric-td/` folder over HTTP (ES modules won't load
  from `file://`). This machine has **no Node or Python**; use `serve.ps1`
  (PowerShell static server, port 8420).
- Live: https://annoyeddonkey.github.io/First-Game/geometric-td/
  GitHub Pages serves `main` of github.com/AnnoyedDonkey/First-Game (public).
  **Pushing to main deploys automatically** (~1 min). The user plays on
  iPhone via this URL (home-screen app).
  **Gotcha:** no build step / hashed filenames, so a deploy can briefly serve
  mixed-version files from different CDN edges. This once soft-locked the
  menu: a new save field existed in fresh `progression.js` but a stale
  `save.js` lacked its DEFAULT_SAVE entry. Fix pattern: don't rely SOLELY on
  `save.js DEFAULT_SAVE` for a new field — also backfill right after
  `loadSave()` in `progression.js` (e.g. `state.endlessBest ||= {}`). If the
  user reports breakage right after a push, have them hard-refresh / wait a
  minute before assuming a real bug.
- Git: repo root is `First Game/` (one level above this folder). Commit
  after each verified feature; the user expects push-to-play.
- **DEPLOY RULE: bump `APP_VERSION` in `src/version.js` on every push** the
  player should pick up — it drives the home-screen update nudge.

## File map

```
index.html        page shell: HUD, canvas, overlays, tower tray
styles.css        portrait layout, dark theme, all overlay styling
src/
  config.js       ALL tuning: towers, enemies, XP/upgrade tables, economy,
                  VFX, skills, LOOT, ENDLESS_REWARDS. START HERE for balance.
  levels.js       15 levels, pure data: pathCorners, blockedTiles, waves,
                  palette, desc. Also exports WORLDS (menu world grouping).
  endless.js      procedural wave generator past a level's authored waves
  main.js         entry: canvas sizing, rAF loop, input wiring, end-of-battle
                  flow, speed controls, debug helpers
  game.js         state machine: waves, spawn queue, money, core HP, win/loss
  grid.js         tile math, path expansion, placement
  towers.js       targeting, firing (incl. railgun pierce), upgrades, selling,
                  roster deployment, name generation
  enemies.js      movement, damage/death (bounty/XP/shards/drops), slow
                  debuff, regeneration, splitting
  projectiles.js  pulse orbs, rockets + transient effects (beams, rings...)
  particles.js    sparks + polygon-shard death explosions (capped)
  springgrid.js   Geometry Wars warping background grid (spring mesh)
  renderer.js     ALL canvas drawing; LOOK constants; palettes; additive
                  "lighter" pass; pre-rendered glow sprites
  input.js        unified pointer (touch + mouse) -> canvas coords
  ui.js           DOM: HUD, tray, upgrade panel, skill tree, circuit-board
                  level select, gear/store screens, overlays, sheets
  progression.js  persistent layer: roster, skills, shards, unlocks, loot
                  banking, endless rewards
  equipment.js    gear slots, requirement gates, stat/unique aggregation
  loot.js         pure item generator (generateItem, makeRng, lootSelfTest;
                  exposed as window.loot)
  save.js         localStorage read/write/reset (key: geometric-td-save-v1)
  leaderboard.js  shared online board (Supabase REST via fetch); own
                  localStorage key, never touches the game save
  version.js      APP_VERSION build stamp — BUMP EVERY DEPLOY
  update.js       home-screen "update available" nudge
mockups/          approved interactive HTML mockups (gear UI, circuit menu)
```

## Key mechanics (rules that aren't obvious from code skimming)

- **XP vs money:** XP makes a tower *eligible* for its next level; money pays
  for it. Thresholds/costs in `config.js TOWER_UPGRADES`.
- **Specialties:** all towers share base growth per level; each class adds a
  specialty (laser +range, pulse +splash, slow +fire speed, railgun +damage,
  rocket +blast). Specialties are PERMANENT — they follow career-best level
  (`maxUnlockedLevel`), so a veteran keeps them while re-leveling from 1.
- **Contributor-weighted XP:** a kill's XP pool splits among every tower that
  damaged or slowed the enemy (slow weight: `LOOT.xp.slowWeightPerSec`).
  Tracked on `enemy._contrib`, consumed in `awardKillXp` (enemies.js). Kill
  COUNT still goes to the final-hit tower only. This is what levels Slow towers.
- **Veterans:** placing a type auto-deploys your best undeployed roster unit
  of that type. They re-enter at level 1 but re-buy to their unlocked level
  with money alone (no XP gate). Button always says UPGRADE.
- **Selling:** refunds 50% of `tower.invested`. Roster record survives; XP
  earned this battle by a sold tower is lost.
- **Roster recording:** `recordBattleEnd` runs in game.js at win/loss moment
  (NOT the render loop — background tabs pause rAF).
- **Shards ◆:** earned per kill (win, lose, or forfeit) as
  `LOOT.shards.perKillBase × enemy.def.shardTier` (1/2/4 grunt/heavy/boss),
  banked on `game.shardsEarned` (enemies.js), synced to the wallet in
  `progression.js syncRoster` — shared by every exit path. Read via
  `getShards()`; shown under the menu title.
- **Mastery:** XP past the level cap converts to permanent damage ranks on a
  50-rank escalating curve (`TOWER_UPGRADES.mastery`; +1.5%/rank, cap +75%).
  Derived purely from saved `xp` (retroactive); ranks up live mid-battle.
- **Skill tree:** 8 skills × 5 tiers (`SKILLS`/`SKILL_VALUES`/`SKILL_TIERS` in
  config.js), tier costs 1/1/2/2/3, 1 point per battle won (replays farmable
  by design, awarded in `recordBattleEnd`).
- **Loot/equipment:** 4 typed slots per tower, 5 rarities
  (common→singularity), affixes + uniques — generator in loot.js, knobs in
  `config.js LOOT`. Kill drops (`LOOT.drops.dropChanceBase`) + one guaranteed
  end-drop per run land via `bankEarnedItem` (auto-equip → stash →
  pendingLoot triage). Rare+ gear gates on Mastery (`LOOT.equipGate`,
  grandfathered). Store: persistent 15-item stock scaling from roster
  level/Mastery, reroll for escalating shards (`LOOT.store`).
- **Railgun** unlocks when `level_005` is completed; pierces along the beam;
  `findRailgunAim` picks the line hitting the most enemies — place it down a
  lane. **Rocket** (`damageType:"blast"`) unlocks after level_010: GLOBAL
  range (`baseRange: 999` skips the range ring), slow reload, homing rocket
  with explosive splash.
- **Counter system:** `ENEMIES[type].damageMult` keyed by attacking tower's
  `damageType` (`energy`/`pulse`/`control`/`rail`/`blast`); >1 weak, <1
  resists; applied in `enemies.js damageEnemy`. THE knob letting a level
  demand a combo. Visible feedback: resisted hit = grey shield-clink,
  super-effective = bright colored halo (essential — no damage numbers).
  Slow applies a +30% vulnerability debuff (`TOWERS.slow.vulnerability`) to
  slowed enemies. Per-tower `upgradeCostMult` (Pulse 1.6×, Slow 0.8×).
  Splitter spawns 2 splitlings on death; Regenerator heals 5% max HP/s.
- **Endless mode:** per level once cleared. Plays the authored waves then
  `generateEndlessWave(level, waveIndex)` (endless.js — deterministic, no
  RNG). Never "won"; ends in "lost" → `recordEndlessResult` records best
  wave per level (`endlessBest`). Knobs in `config.js ENDLESS`.
- **Endless reward tracks:** `config.js ENDLESS_REWARDS` = `{ defaultTrack,
  tracksByLevel }` + `endlessTrackFor(levelId)` resolver; default 5
  milestones (waves 10/20/35/50/75). Grants auto-fire in
  `grantEndlessRewards` keyed to BEST-ever wave (retroactive, idempotent);
  claims in `save.js endlessRewards[levelId]` keyed by milestone id.
- **Forfeit:** ✕ in the HUD → confirm overlay → `forfeitBattle` (syncs
  roster XP + loot, no win credit). Sim frozen during the prompt via
  `exitConfirming` in main.js (doesn't touch pause state).
- **Main menu:** world-paged SVG circuit board (`ui.js renderWorld` /
  `buildBoardSvg`), swipe/arrows between worlds, tap node → level-detail
  bottom sheet (desc, milestones, PLAY/ENDLESS). Global actions live in the
  pinned `#menu-actions` footer (`appendGlobalMenuButtons`), never in the
  scrolling list. HUD is battle-only (`#hud.hidden` on the menu).
- **End-of-battle overlay:** `showOverlay` (ui.js) — random roast title
  (`config.js RESULT_ROASTS`, keep lines under ~34 chars), tappable loot
  tile grid (tap → rarity-burst detail card), buttons per outcome via
  `main.js lootTailButtons`. MANAGE GEAR goes red + note when the stash
  overflowed. ASSIGN SKILL POINTS only shows when points > 0.
- **Tower panel / bottom action bar:** tapping a tower swaps the tray for a
  2-row info block + UPGRADE/SELL. Fixed-size by design (nowrap + ellipsis).
  **Flexbox gotcha (bit us once):** a nested flex container's default
  `min-width: auto` made `#upgrade-panel` claim full content width and push
  `#wave-button` off-screen — fix was `min-width: 0` on the container itself.
  Any new nested flex row in the action bar needs the same.
- **Leaderboard:** per-level Endless best, Supabase REST (leaderboard.js),
  own localStorage key, auto-publish on new best when a nickname is set.
  Config in `config.js LEADERBOARD`; setup in `SUPABASE_SETUP.md`. Escape
  other players' nicknames on render.
- **Update nudge (update.js):** re-fetches version.js (`cache:no-store`) on
  load + visibilitychange; mismatch → tap-to-reload banner. Right after a
  push the banner may reappear until the CDN settles (~10 min).

## Worlds & paths

Three worlds (`levels.js WORLDS`): INNER GRID (1-5), OUTER VOID (6-10),
PRISM DEEP (11-15). Path archetypes deliberately varied (serpentine,
spirals, mazes, switchbacks…). All maps 8×12, single entry→core, orthogonal
segments. Verify a new map by constructing `createGridModel` for every
level: no throw, no blocked tile on the path, ample buildable tiles.

## Balance & difficulty philosophy (user's words)

"A game becomes addictive when it's just hard enough that you don't beat
each level on first try, only by levelling up or changing your tactics."

Calibration targets: L1-2 beatable fresh with good play; L3+ needs veterans;
L5 is a placement puzzle (interior pockets win, perimeter loses); L9 needs
batch-2 veterans; L10 near-maxed roster wins at ~half core.
**Bankroll rule:** wave 1 of every level must be survivable with starting
money (leaks pay no bounty → death spiral). Check openers first when tuning.
Endless first-pass bar: a fresh 8-tower laser wall died at endless wave 18
on L1 — strong rosters should push well past; `ENDLESS` knobs are untuned.

## How to verify changes (no test framework — use the browser)

Debug helpers on `window`: `game` (full state) and `step(seconds)`
(instantly simulates N seconds — the main balance tool).

```js
// Bot recipe (superhuman; "bot loses" = strong signal, "bot wins" = weak):
const T = await import('./src/towers.js');
game.money = 200;
T.placeTower(game, 'laser', 3, 3);        // build via module API
document.getElementById('wave-button').click();
while (!['won','lost'].includes(game.phase)) {
  step(1); // each sim-second: build/upgrade from a queue when affordable
}
console.log(game.phase, game.waveIndex + 1, game.coreHealth);
```

Seed accounts by writing the save then reloading:
`localStorage.setItem('geometric-td-save-v1', JSON.stringify({...}))` —
schema in `save.js DEFAULT_SAVE`. **Never wipe the save without restoring or
warning the user** — his real progress lives in the same browser.

Gotchas: rAF pauses in hidden tabs (DOM won't update; `step()` still works;
dynamic `import()` reaches live modules). Browser-pane screenshots time out
in this harness — verify via DOM queries instead. Pointer simulation needs
the canvas to have layout — prefer the module API for placement. Sim
scripts have caused false alarms twice — when a result looks insane, debug
the test before nerfing the game.

## Rendering notes

- Glow = pre-rendered radial-gradient sprites + `globalCompositeOperation:
  "lighter"` additive pass. **Never put shadowBlur on per-particle drawing**
  (mobile Safari perf). ~2.4ms/frame at the 900-particle cap.
- Background grid is a spring mesh (`springgrid.js`); explosions call
  `applyShock`. Displacement clamped (`VFX.warp.maxDisplacement`).
- Per-level palettes: `level.palette` overrides `LOOK` keys in renderer.js.
  Enemy/tower colors intentionally constant.
- Overlay z-order: end-of-battle (10) < level select (30) < skill tree (40).
  Skill tree must stay on top — this was a real bug.
- Avoid perpetual animations that recompute SVG filters every frame on the
  idle menu (the M3 perf fix); one-shot entry animations may keep filters.
  Gate all animations behind `prefers-reduced-motion`.

## User preferences (learned over the project)

- Wants a plan proposed before big builds; small runnable increments.
- Loves tunable variables — expose knobs, tell him where they are.
- Visual taste: "pizzazz" — glowing, dramatic, fireworks-like. Err dramatic.
- Report verification honestly (what was simulated vs eyeballed).
- He plays on iPhone; always push after a verified feature so he can test.
- Treat his bug reports as accurate (the skill-tree "sometimes nothing
  happens" report was a real z-index bug).
- Usage economy: one phase per fresh session; don't spawn subagents to
  re-explore what the plan/handoff already documents.

Other UI facts: speed controls cycle ◀ 1x→½x→¼x→1x and ▶ 1x→2x→4x→1x
(pause in the middle); the bottom action bar is hidden while the mission
selector is open. Treat `levels.js` as the source of truth on wave numbers.

## Shipped build history (details live in the design docs)

- **Loot P0–P6** — Mastery curve, contributor XP, Shards, generator, combat
  affixes/uniques, drops/stash/triage, store, Endless reward tracks. Full
  log: `LOOT_DESIGN.md` §14 checkboxes.
- **Gear UI U0–U5** — auto-equip + Mastery gate, tower-first TOWERS/STASH
  screen, roster long names, menu merge (Tower Guide folded into `?` sheet),
  drop-reveal pizzazz, STORE restyle. Full log: `GEAR_UI_DESIGN.md`.
- **Circuit menu M0–M4** — board data, SVG board, level-detail sheet,
  entry-animation + perf pass, per-level milestone track scaffolding
  (`tracksByLevel` empty). Full log: `CIRCUIT_MENU_DESIGN.md`.
- **End-of-battle screen rebuild**, **counter/differentiation balance pass**
  (+ Rocket, World 3), **world-paged menu**, **leaderboard**, **update
  nudge** — described under Key mechanics above.

## Backlog

- **ACTIVE: Economy rebalance + progression expansion (B1–B6)** — approved
  plan at `C:\Users\fthia\.claude\plans\purring-knitting-lake.md`. One phase
  per fresh session; suggested models: B1/B2/B6 Sonnet, B3/B4 Opus-class,
  B5 Opus or Sonnet. Summary: B1 shard/drop nerf + no-loot-on-instant-quit;
  B2 store rarity unlocks (shards); B3 branching SVG skill tree + new skills
  (tower levels 6–10, interest, shard find, railgun over-penetration);
  B4 gear visible on towers + old/new equip comparison; B5 milestone toasts,
  recap, per-level milestones (some award skill points); B6 playtest tuning.
  Mark phases done here as they land.
  - **DONE — B1 (2026-07-12):** shards `perKillBase` 3→0.12 + `perLevelMult`
    0.35 (float-accumulated, rounded once at wallet sync); a bot-cleared
    full L1 nets ~32 shards. Drop rarity now level-gated
    (`LOOT.drops.rarityLevelGate`, applied in loot.js
    `biasedRarityWeights`/`weightsWithCeiling`) — L1-2 rolls common/enhanced
    only. Guaranteed end-drop also wave-gated on a ceiling
    (`LOOT.drops.endDropCeiling` + `guaranteedDropCeiling`), floor always
    wins if higher than ceiling. Instant quits (0 waves cleared) skip the
    guaranteed end-drop (`progression.js recordRunLoot`). `ENDLESS_REWARDS`
    shard amounts rescaled 100/350 → 40/90 to match.
  - **DONE — B2 (2026-07-12):** store rarity unlocks. New save field
    `state.storeUnlocks []` (backfilled in both `save.js DEFAULT_SAVE` and
    `progression.js` top-of-module). `config.js LOOT.store.rarityUnlocks`
    `{ enhanced:100, rare:350, prismatic:1200, singularity:4000 }` (sized for
    ~33◆/L1 economy). `generateStoreStock` builds filtered weights — locked
    rarities zeroed out, common always allowed — passed as `opts.weights` into
    `generateItem` (loot.js now accepts that option). New exports
    `getStoreUnlocks` / `buyStoreUnlock`; the latter spends shards, appends to
    `storeUnlocks`, regenerates stock. Store prices rescaled for new economy
    (`common:15, enhanced:50, rare:140, prismatic:450, singularity:1400`);
    rerollCost 30→25. UI: padlock tile row in `renderStorePanel` (above reroll
    button) showing each locked rarity with ◆ price in rarity color; tap →
    bottom-sheet confirm (reuses `#store-sheet-overlay`). Old saves backfill
    cleanly; console clean on load. Next: B3 branching SVG skill tree.
- **Loot P7 balance pass** — largely superseded by B1/B6; read
  `LOOT_DESIGN.md` §15 before tuning drops.
- **PLAYTEST-PENDING:** counter re-tune + Rocket + World 3 difficulty is
  bot-calibrated only; expect a tuning pass from iPhone play (L2/L4/L5 and
  all of W3 flagged). If counters don't drive combo choices: harsher resists
  or waves that hard-require a tower.
- Retune `config.js ENDLESS` ramp (seeds off the re-tuned final waves).
- Unscheduled ideas: save export/import (iOS evicts localStorage after ~7
  idle days), sound, more towers (Tesla chain-lightning runner-up),
  pre-battle loadouts.
