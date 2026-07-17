# Geometric TD — Developer Handoff

Read this first if you are an AI assistant (or human) picking up this project.
Companion docs: `GAME_BRIEF.md` (original spec + feature history),
`LOOT_DESIGN.md` (loot system spec + build log), `GEAR_UI_DESIGN.md`
(gear-screen redesign log), `CIRCUIT_MENU_DESIGN.md` (main-menu board log).
The user's design taste and workflow preferences are at the bottom — follow
them.

**State (July 2026):** 15-level campaign across 3 worlds, 5 towers (Railgun
unlocks after level 5, Rocket after level 10), 7 enemy types, damage-type
counter system with visible hit feedback, a branching SVG skill tree
(17 nodes: per-class damage, tower levels 6-10, cash interest, shard find,
railgun over-penetration), permanent per-class
specialties, post-cap Mastery ranks, per-level palettes, GeoDefense-style
VFX, ¼x–4x speed controls, Endless mode per level with a 5-milestone reward
track, per-level campaign challenges (2/level, each awards 1 skill point +
shards) with live milestone toasts + an end-screen recap, forfeit button, a full
Diablo-style loot/equipment system (Shards ◆
currency, per-tower gear in 4 slots, 5 rarities, drops/stash/triage, store,
gear visible on towers in-battle as orbiting rarity diamonds, old-vs-new
equip comparison), a tower-first gear UI, an SVG circuit-board main menu,
and circuit-board battle-map decoration (traces/pads/vias/IC chips, tinted
per level palette — knobs in `VFX.circuit`). All deployed and
playable at the GitHub Pages URL below. No known bugs.

**Active work:** B1–B6 (economy rebalance,
`C:\Users\fthia\.claude\plans\purring-knitting-lake.md`) all shipped, and the
first real-play tuning pass T1–T4 (railgun/rocket nerfs, boss/counter pass,
World 3 difficulty + bounty trim, first-play tutorial) landed 2026-07-16 from
telemetry + user notes — plan + feedback summary at
`C:\Users\fthia\.claude\plans\feedback-tuning-2026-07.md`. Next: iPhone
re-playtest of the retuned levels, then a second pass from fresh telemetry
(compare `app_version` in the feedback table).

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
  feedback.js     run telemetry + difficulty ratings (Supabase REST, same
                  project as the leaderboard, `feedback` table); best-effort
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
- **Skill tree:** a branching prerequisite GRAPH of 17 nodes across 3
  branches (`SKILLS`/`SKILL_VALUES`/`SKILL_TIERS`/`SKILL_BRANCH_COLORS`/
  `SKILL_TREE_VIEWBOX` in config.js). Each node: `{ branch, parent, pos,
  glyph, maxTier, costs, kind }`. Default tier costs 1/1/2/2/3; single-tier
  nodes (towerCap6-10, interestCap) override `maxTier`/`costs`. A node's FIRST
  tier needs its parent owned (`isSkillUnlocked`); already-owned nodes always
  keep upgrading (old saves never stuck). 1 point per battle won (replays
  farmable, awarded in `recordBattleEnd`). Rendered as an SVG board
  (`ui.js buildSkillTreeSvg`), tap a node → `#skill-sheet-overlay` sheet.
  New-skill effects live in `progression.js`: `getTowerLevelCap`,
  `getInterestRate`/`getInterestCap`, `getSkillShardFindMult`,
  `getRailBeamLengthMult`. Tower cap 6-10 also re-anchors Mastery
  (`syncMasteryAnchor` → `equipment.setMasteryXpStart`).
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
- **Per-level bounty multiplier (`level.bountyMult`, added T3):** a level-wide
  multiplier on money earned per kill, default 1, documented alongside the
  other level fields at the top of `levels.js`. Stacks with a wave group's
  own `bountyMult` (unchanged, still per-spawn-group). Consumed in
  `enemies.js damageEnemy()`'s bounty payout line. Late-game economy knob —
  trims accumulated leftover cash on levels a strong roster clears easily
  without touching enemy HP/waves. Currently set to `0.75` on all five World
  3 levels (L11-15).
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
- **First-play tutorial (T4):** a 5-step, skippable walkthrough shown ONCE,
  only on level_001's very first campaign start (new player report: the red
  ✕ blocked tiles read as "build here"). State machine in `src/tutorial.js`
  (game/UI-free, mirrors the milestone-toast split — it only tracks the
  active step and gates advancement on REAL actions notified from main.js:
  tray selection, a successful `placeTower`, the wave-button tap); copy +
  enable switch + the two illustrative tile coordinates live in `config.js
  TUTORIAL`. Persistent flag: `save.js DEFAULT_SAVE.tutorialDone` +
  `progression.js` backfill (auto-true for any save with a completed level
  or non-empty roster — mirrors `seenTowerGuide`). DOM in `index.html`
  (`#tutorial-overlay`: a freeze-catcher + card for the two static steps —
  welcome and the blocked-tile callout, tap anywhere to continue, sim frozen
  via `tutorial.isTutorialFreezing()` in main.js's dt calc — and a
  pointer-events:none banner + spotlight ring for the other three, so the
  REAL tray chip / canvas tile / wave button still receives the tap); ui.js
  repositions the ring every frame (`updateTutorialOverlay`, called from
  main.js's frame loop) using `getBoundingClientRect()` off the real
  elements — never drawn into the canvas. **To re-trigger for testing:**
  clear `localStorage['geometric-td-save-v1']` (or set `tutorialDone:
  false` with an empty `roster`/`completedLevels`) and start level_001's
  campaign; `TUTORIAL.enabled = false` in config.js disables it entirely.
- **Main menu:** world-paged SVG circuit board (`ui.js renderWorld` /
  `buildBoardSvg`), swipe/arrows between worlds, tap node → level-detail
  bottom sheet (desc, milestones, PLAY/ENDLESS). Global actions live in the
  pinned `#menu-actions` footer (`appendGlobalMenuButtons`), never in the
  scrolling list. HUD is battle-only (`#hud.hidden` on the menu).
  Campaign-challenge rows in that sheet are **tap-to-expand** (`.mile-desc`),
  revealing a "how to earn this" line from `ui.js milestoneDescText(check)` —
  derived from the challenge's `check` clauses (never hardcoded), so cryptic
  labels like "Battle-Hardened" / "Flawless" explain themselves.
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
  Any new nested flex row in the action bar needs the same. The `#wave-button`
  itself is capped narrow (`max-width: 58px`) with its label allowed to wrap to
  two lines ("START WAVE" stacked), and `#tower-buttons` + `.tower-button` both
  carry `min-width: 0` so a full 5-tower tray shrinks to equal chips and the
  wave button always stays on-screen (verified at 375px).
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

Debug helpers on `window`: `game` (full state), `step(seconds)`
(instantly simulates N seconds — the main balance tool), and
`checkEndState()` (runs the end-of-battle resolution — overlay, telemetry,
feedback strip — from the console; needed headless because it normally
only runs in the rAF frame, and rAF pauses in hidden tabs).

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
in this harness — verify via DOM queries instead. **Do NOT try to capture,
decode, or POST the canvas image out of the page either (toDataURL chunks,
local HTTP listeners, etc.) — user directive: it's slow, error-prone and
not worth it. For visual changes, assert on state/DOM (render() throws
nothing, console clean, sample logic-level facts) and let the user eyeball
on iPhone after the push.** Pointer simulation needs
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
- **UI polish (2026-07-12, v2026.07.12-13)** — three fixes from an iPhone
  report: (1) level-sheet campaign challenges are now tap-to-expand with a
  data-derived description (see Main menu bullet); (2) store REROLL button no
  longer stretches to the tall "unlock rarities" block — `#store-actions` now
  stacks vertically (`flex-direction: column`) so reroll keeps its natural
  38px height and sits below the unlock tiles; (3) `#wave-button` narrowed +
  two-line label and the tower tray given `min-width: 0` so it never runs off
  a 375px screen (see Tower panel / bottom action bar bullet).
- **UI polish (2026-07-12, v2026.07.12-14)** — end-screen + skill-tree
  clarity: (1) end-of-battle challenge recap rows that carry a `check` clause
  are now tap-to-expand (`.recap-mile.challenge` → `.recap-desc`), reusing
  `milestoneDescText`; `campaignRecapEntries` in main.js now passes `check`
  through, and a "CHALLENGES · tap to learn" head appears when any recap entry
  is expandable (Endless wave milestones have no `check`, so they stay static).
  (2) A "LOOT EARNED" header (`#overlay-loot-head`, toggled with the loot grid)
  now labels the end-screen tile row. (3) Skill tree restyled toward the towers
  screen: uniform 1.6 node border across all states (was 0.7–1.3, the "different
  thickness" complaint), bigger 9-unit rounded tiles, a taller respread
  `SKILL_TREE_VIEWBOX` (116×208, was 120×168) so the board is roomier and
  scrolls vertically, and the scroll area framed as a `--panel` card. New
  `ui.js colorFill()` helper tints the owned-node interior. All node
  geometry knobs (`R`/`RX`/`STROKE`) live at the top of `buildSkillTreeSvg`;
  layout in `config.js SKILLS[*].pos`.
- **Skill-tree visual match (2026-07-12, v2026.07.12-15)** — from an iPhone
  compare vs the towers screen. Node borders are now a crisp 1px line via
  `vector-effect="non-scaling-stroke"` (constant screen weight regardless of
  the SVG's fit-to-width scale — the old fat "blob" squares were a scaled
  1.6-unit stroke); the neon glow is a separate blurred rect drawn BEHIND each
  tile (like the gear tile's box-shadow) so filtering never fattens the crisp
  line. Single-letter glyphs replaced by data-driven vector icons: each skill
  gained an `icon` key in `config.js SKILLS`, rendered by `ui.js
  skillIconBody()` / `skillIcon()` (stroke-only, authored in a 0..100 box,
  mirrors `slotGlyph`). NOTE: the per-tower branch restructure the user asked
  for (each tower a colored root with damage + level sub-branches, tower-
  specific unlockables like railPen) is NOT done yet — pending a decision on
  whether tower level caps go per-tower (currently the global `towerCap6-10`
  spine + `getTowerLevelCap()`).
- **Per-tower skill branches (2026-07-12, v2026.07.12-16)** — skill tree
  restructured so each tower has its OWN branch (user-approved: per-tower level
  caps). `config.js` now GENERATES the graph via `buildSkillGraph()` from
  `TOWER_SKILL_SPEC` (per-tower color/icon/stat/damageStep) + `TOWER_SKILL_LAYOUT`
  (chain lengths + costs). Layout: shared CORE (coreHealth) + ECONOMY chain down
  the center, then each tower = a colored root that forks into a DAMAGE chain
  (each box +10% to that tower's damage, or slow duration) running down-left and
  a LEVEL chain (`<t>_lvl6..10`, each +1 cap) down-right; railPen hangs off the
  railgun damage chain. `SKILL_TREE_VIEWBOX` is computed (tall+narrow → vertical
  scroll). 62 nodes total. `progression.js`: `getTowerLevelCap(type)` = 5 +
  owned `<type>_lvl*`; `getTowerDamageMult(type)`/`getSlowDurationMult()` sum the
  owned `<type>_dmg*` boxes × `TOWER_SKILL_SPEC[type].damageStep`; new
  `ownedSkillCount(prefix)` helper. **Mastery is deliberately NO LONGER
  re-anchored to the cap** — `syncMasteryAnchor` removed, anchor stays at the
  base xpStart for every tower (unlocking higher levels never nerfs a veteran's
  mastery; veterans who'd raised the old global cap get a small mastery buff,
  never a nerf). `towers.js xpThreshold/upgradeCostFor` pass `tower.type`.
  **Save migration** (`progression.migrateSkillGraph`, idempotent): old
  `<t>Damage` tier k → `<t>_root` + `<t>_dmg1..k`; old GLOBAL `towerCap6..10`
  grandfathered onto EVERY tower's level chain (nobody loses a cap, no points
  refunded/recharged); `railPen` id kept. `ui.js`: nodes carry their own
  `color`; chain boxes render a value label (`+10%` / `L6`) instead of an icon;
  legend now CORE/ECON + one chip per tower. Verified: migration (laserDamage:3
  → +30% preserved, caps grandfathered to all 5), per-tower cap gate, damage/
  duration mults, node-sheet text, a full L1 bot battle runs with no throw,
  console clean. **NOTE (dev-env):** iCloud briefly created a `ui 2.js`
  sync-conflict copy mid-edit; renamed back to `ui.js`. If files "vanish" or
  gain a " 2" suffix again, that's iCloud, not a bug. **Deferred (user said
  "later"):** more tower-specific unlockables beyond railPen.
- **Skill tree: horizontal layout + economy sub-branches + pan/zoom
  (2026-07-12, v2026.07.12-17)** — reworked per an iPhone screenshot the user
  liked. `config.js buildSkillGraph()` now lays branch HEADS in one row across
  the top (order: laser, pulse, slow, railgun, rocket, then MONEY, then CORE),
  each fanning downward; viewbox is wide + shallow so the whole tree fits on
  screen at the default zoom. The economy branch is now a **money head +
  one sub-branch chain per stat** (`ECONOMY_SKILL_SPEC`: eco_money / eco_xp /
  eco_shard / eco_intrate / eco_intcap, each a 5-box chain; `ECONOMY_LAYOUT`);
  `progression.js` economy getters sum owned `eco_*` boxes via
  `ownedSkillCount` (`ecoSum` helper) and `migrateSkillGraph` folds the old
  single economy nodes (moneyPerKill/xpGain/shardFind/interestRate/interestCap
  tier k → boxes 1..k). coreHealth stays a single multi-tier node.
  **Pan/zoom (ui.js):** the board is drawn once; `layoutSkillTree` sizes the
  SVG in px = fit-to-pane × `skillZoom` (default 1 = whole tree visible),
  `setSkillZoom` zooms toward a focal point, `bindSkillTreeGestures` wires
  two-finger pinch (+ ctrl/⌘-wheel on desktop), and `.skill-zoom` +/- buttons
  step 1.5×. Zoom + scroll persist across re-renders (buying a node rebuilds
  the SVG); `openSkillTree` shows the overlay before measuring, resets to fit.
  Branch heads render a text label (LASER/MONEY/…) above them; the old legend
  row is gone. `SKILL_TREE_VIEWBOX` is computed. Verified: 83 nodes, head order
  + alignment, economy migration + effects, fit-at-default / zoom-in-scrolls /
  zoom-persists-after-buy, in-battle economy effects run with no throw, console
  clean. Knobs: `TOWER_SKILL_LAYOUT` / `ECONOMY_LAYOUT` (chain lengths/costs),
  `SKILL_ZOOM_MIN/MAX/STEP` in ui.js, layout consts in `buildSkillGraph`.

- **Challenge rewards + circuit-board maps (2026-07-12, v2026.07.12-19)** —
  (1) EVERY campaign challenge now awards **1 skill point + shards**:
  `LEVEL_MILESTONES` rewards changed from `{kind, amount}` to
  `{ skillPoints, shards }` (both optional, both paid in
  `progression.grantLevelMilestones`); `ui.js milestoneRewardText` renders
  the combined shape ("★ 1 SKILL PT + ◆ 30") and still handles the old
  `kind` shape used by Endless reward tracks. No save migration needed —
  saves store only claimed ids. 30 challenges ⇒ up to 30 bonus skill
  points account-wide. (2) **Circuit-board map decoration**: the world-menu
  circuit vocabulary now lives on the battle maps themselves.
  `renderer.js buildCircuitLayer` pre-renders (ONCE per level, offscreen
  canvas, zero per-frame cost) a static layer of wandering PCB traces
  ending in solder pads, via dots on corners, lone vias, silkscreen hexes,
  concentric "CPU" rings + 4 stub pads around the core, and a dashed
  socket ring under the spawn portal. Layout is deterministic (mulberry32
  seeded by level id) and auto-tinted from the level palette's `pathEdge`
  (rgbOf parses rgba/hex), so every world's maps match its menu board with
  no levels.js changes. Traces avoid path/blocked tiles and never share a
  tile (occupancy set). Drawn between the background fill and the warp
  grid. Blocked tiles restyled as soldered **IC chips** (dark package,
  side pin stubs, pin-1 notch dot, small X kept for "can't build" read) in
  `drawBlockedTiles`, now using `pal` so palettes may override. All knobs
  in `config.js VFX.circuit` (traceCount/Width/Alpha, padAlpha, viaCount,
  hexCount, coreRingAlpha, portalRingAlpha…). Verified in-browser: L1
  bot-cleared laser-only/no-leak → both challenges latch, +2 SP + 70◆ on
  top of run earnings, claimed ids persist; sheet + recap show combined
  reward text; L1 (cyan) and L6 (ember) map renders eyeballed via canvas
  export — deco tints per palette, console clean.

- **Balance feedback + telemetry (2026-07-13, v2026.07.13-1)** — the data
  pipeline for rebalancing levels from real play. New `src/feedback.js`
  (mirrors leaderboard.js: same Supabase project/keys, own `feedback`
  table, plain fetch, best-effort — a missing table or dead network only
  console.warns). EVERY battle end (win/loss/forfeit, campaign AND
  endless) auto-inserts one telemetry row: level_id, mode, outcome,
  waves_cleared, total_waves, core_health, duration_sec, app_version,
  client_id (leaderboard's anonymous id), plus a `details` jsonb (towers
  with type/level/kills/invested/gear rarities, typesUsed, kills, leaks,
  moneyLeft, shardsEarned, full skills spread + unspent points via new
  `progression.getSkillsSnapshot()`). Rows are keyed by a per-run
  `run_id`; the CAMPAIGN end screen also shows a one-tap difficulty strip
  (`#overlay-feedback`, `ui.js renderFeedbackStrip`, `.fb-*` styles):
  TOO EASY / JUST RIGHT / TOO HARD chips — one tap upserts the rating
  onto the run row, then an optional note input appears (SEND upserts
  again; re-taps just overwrite). Endless gets telemetry only (a rating
  against procedural waves says nothing about the level). Knobs in
  `config.js FEEDBACK` (enabled/table/maxNoteLength); telemetry built by
  `main.js runTelemetry()`; table SQL + console test recipe in
  `SUPABASE_SETUP.md` § "Feedback table" (RUN THAT SQL ONCE or every
  submit 404s harmlessly). **Analysis workflow:** pull rows with the anon
  key (`GET {url}/rest/v1/feedback?select=*` with apikey header, or
  filter `?level_id=eq.level_003`), aggregate per level — attempts, win
  rate, rating split, avg waves_cleared on losses, tower/skill spreads —
  then tune `levels.js` waves / `config.js` counters and note the change
  here. Verified: all three end paths submit correct payloads (fetch
  intercepted + inspected), strip renders/upserts/clears correctly,
  forfeit-confirm overlay never shows it, console clean apart from the
  expected dormant-table warns.

- **T1: Tower economics (2026-07-16)** — first phase of the feedback-tuning
  plan (`C:\Users\fthia\.claude\plans\feedback-tuning-2026-07.md`), driven by
  real telemetry ("Railgun is overpowered or too cheap" / "Rocket should be
  more expensive to upgrade"). `config.js TOWERS.railgun`: `baseCost` 100→140
  + new `upgradeCostMult: 1.3`. `config.js TOWERS.rocket`: new
  `upgradeCostMult: 1.4` (global range stays the expensive-to-scale option,
  cf. pulse's 1.6×). `towers.js upgradeCostFor` already applies
  `tower.def.upgradeCostMult` generically — confirmed, not rewritten.
  Verified in-browser (fresh profile, no save to restore): cumulative L1→L5
  upgrade cost is 98/163/260/390 for railgun (base 75/125/200/300 × 1.3,
  exactly) and 105/175/280/420 for rocket (× 1.4, exactly); pulse/slow
  multipliers unchanged (1.6/0.8). `level_006 startingMoney` is 130 — a
  player saving for the new 140-cost railgun is 10g short at the door, a
  reasonable early save-up target (not a hard wall). A pre-capitalized
  8-laser-wall bot sim (mirrors the documented "fresh 8-tower wall" reference)
  clears all 10 L1 waves 0-leak at full core (227 kills, grew to 39 towers by
  the end) — confirms no regression, unrelated to this railgun/rocket-only
  change. Console clean throughout. **Test-script gotcha hit and fixed**: an
  early bot script called `updateGame(game, 1)` (1-second dt) instead of
  substepping at `1/60` — this desyncs the enemy/projectile/targeting sim and
  produces bogus losses (enemies "stuck", no kills, phantom leaks). Always
  substep via `for (i=0; i<seconds*60; i++) updateGame(game, 1/60)`, matching
  `window.step()`, when driving `game.js` from a script instead of the rAF
  loop. New `.claude/launch.json` (repo root) added a `"td"` config wrapping
  `geometric-td/serve.ps1` for the preview harness.

- **T2: Boss & counter pass (2026-07-16)** — second phase of the
  feedback-tuning plan, `levels.js`-only (no `config.js`/`ENEMIES` changes,
  so no cross-level knock-on to check). Driven by telemetry: L2 "the boss
  wave should be harder"; L5 "no wave came close to the core .. way too
  easy" (an 11-laser wall won); L6 "Railgun should almost be mandatory to
  use but I could have done the map without it"; L7 "Boss should be way
  harder" (L7 itself stays the veteran-gated wall — only its boss got
  meaner). **L2** (`level_002`): wave 7 mini-boss `healthMult` 1.1→1.65,
  wave 12 (final, twin boss) `healthMult` 2.4→3.6 (both +50%). **L5**
  (`level_005`): punished the mono-laser wall via wave COMPOSITION (armored
  is the energy-resist enemy — preferred lever per the plan, no global
  `ENEMIES.armored.damageMult` change needed). Armored `count`/`healthMult`
  raised across waves 3/5/7/8/9/11/13: 10/3.0→12/3.4, 12/3.8→14/4.2,
  10/4.4→14/5.6, 12/5.0→18/6.2, 12/5.4→18/6.8, 20/7.2→28/8.6,
  12/7.8→18/9.4 (spawnIntervals tightened to match the higher counts;
  waves 1/2/4/6/10/12 untouched). **L6** (`level_006`): wave 6 first-boss
  `healthMult` 2.4→3.6, wave 10 final twin-boss `healthMult` 3.6→5.2
  (+50%/+44%); boss already resists Pulse (`damageMult.pulse: 0.75`, see
  `config.js ENEMIES.boss`) so a heavier boss makes an all-Pulse
  splitter-only build genuinely worse than one with Railgun/focused Laser
  — the counter math did the work, only HP moved. Also fixed a stale
  `desc` that promised Regenerators (a Level 7 enemy, never spawned on L6)
  and rewrote it to name the real Pulse-vs-Splitter / Railgun-vs-boss
  tension. **L7** (`level_007`): wave 5 boss `healthMult` 2.6→3.9 (+50%),
  wave 10 final twin-boss `healthMult` 3.6→5.4 (+50%) plus thicker escorts
  (regenerator 10→12, splitter 12→14). **Verified** (bot sims via the
  `td` preview + console, substepped at 1/60, no canvas capture; a
  pre-existing local test-profile save was backed up and restored after):
  (a) L5 11-laser wall, all towers precapitalized to level 5 (mirrors the
  reported "11 lasers, max level 5" win) — now LOSES at wave 11/13, core
  0, 5 leaks. (b) L5 mixed 4-laser/4-pulse/3-slow comp, same total tower
  count and same level-5 precap methodology — WINS with a full-core,
  0-leak clear (374 kills). (c) L2: a 7-tower laser/pulse/slow spread
  (mid-level, not maxed) cleared the buffed wave 7 mini-boss AND wave 12
  final boss in isolation with 0 leaks/full core — the buffs don't break
  fresh-player survivability. (d) Bankroll rule: L5 wave 1 unaffected
  (untouched) and clears 0-leak on starting money; L2/L6/L7 wave 1 (also
  untouched) clear 0-leak for a roster carrying realistic prior-world
  tower levels — note a truly from-scratch level-1-tower opener still
  struggles on L6/L7 wave 1, but that's pre-existing (wave 1 there is
  unchanged) and those levels assume some carried-over roster strength
  from clearing the prior world, not a first-ever campaign attempt.
  Console clean throughout. No `" 2"` iCloud conflict copies found.

- **T3: World 3 difficulty + late-game economy (2026-07-16)** — third phase
  of the feedback-tuning plan (`C:\Users\fthia\.claude\plans\feedback-tuning-2026-07.md`),
  driven by telemetry: every W3 (L11-15) win was first-try with 1,500-5,100
  leftover money (L15: "Leftover 5000 coins"); L11 rated "way too easy"; L13
  was the only W3 level with any leaks (5). **Waves** (`levels.js`, waves 2
  through the end of each level — wave 1 left untouched everywhere per the
  bankroll rule): `healthMult` raised on every non-boss group and boss group
  in L11 (×1.35 / ×1.40), L12 (×1.30 / ×1.40), L14 (×1.30 / ×1.40), L15
  (×1.35 / ×1.40); L13 got a lighter dose (×1.25 / ×1.35) since it already
  produced the only W3 leaks. Every number is an old→new HP multiplier bump
  (e.g. L11 wave 10 final boss 4.8→6.7, L15 wave 12 final boss 5.2→7.3);
  full before/after values are in the diff, not repeated here. **Economy:**
  new per-level `bountyMult` data knob (see Key mechanics above) added and
  set to `0.75` on L11-15, trimming late-game bounty income 25% without
  touching enemy HP/waves. Verified the knob is actually consumed: an
  isolated `damageEnemy` call with `bountyMult:0.75` vs `1` on the same kill
  paid 5 vs 7 money (exact 0.75 ratio once rounding is accounted for) — not
  applied is the same as `1` (confirmed via an undefined-field control).
  **Verified** (bot sims via the `td` preview + console, substepped at
  1/60, no canvas capture): seeded a near-max account (6 railgun + 6 rocket
  veterans at unlocked level 10 with mastery XP, 4 laser + 4 pulse at level
  7, 3 slow at level 6, full tower-cap/damage skill chains, `completedLevels`
  through L10) — backed up the pre-existing local test-profile save first
  and restored it after. **Sim-methodology gotcha hit and fixed:** running
  multiple sims back-to-back in the same page session silently contaminates
  results — `recordBattleEnd` writes the roster's in-battle XP/level gains
  back to the live `progression.js` module state after every win/loss, so a
  later sim in the same session starts from an already-leveled-up roster,
  not the pristine seed. Fixed by re-writing the seed to `localStorage` and
  reloading the page before every single sim run (fresh module state each
  time) — a second cheapest-tower-first build-order variant was also tried
  and discarded (it starved the exact railgun/rocket veterans whose
  specialty+mastery bonuses apply even at battle-level 1, producing bogus
  losses on levels that clearly won under a like-for-like re-test; per
  HANDOFF's "debug the test before nerfing the game" rule). Clean,
  uncontaminated results with a "rocket/pulse/railgun/laser/slow"-priority
  strong comp (21 towers): L11 WON, wave 10/10, core 37/37 (full), 0 leaks,
  358 kills, 84 leftover. L12 WON, wave 10/10, core 31/35, 2 leaks, 430
  kills, 213 leftover. L15 WON, wave 12/12, core 37/37 (full), 0 leaks, 614
  kills, 48 leftover. None hit the stretch target of winning at ≤ half core,
  but all three are decisive improvements on the 1,500-5,100 leftover-cash
  problem and none is a trivial stomp — a mismatched comp (railgun-heavy
  against L12's splitter/regenerator-heavy waves) lost outright at wave 3 in
  an earlier (later found contaminated, but independently reproduced clean)
  run, showing comp/counter choice now genuinely matters on L12, consistent
  with the counter-system's "punish mono-focus" design. **Wave-1 openers**
  verified on all five W3 levels with a cheap laser/slow/pulse opening build
  paid for by `startingMoney` alone (no mid-wave bounty income spent): all
  five cleared wave 1 without losing the core (L11-15 core remaining
  18/11/24/7/37 out of 35-37 max) — wave 1 itself was never touched, so this
  is an unregression check, not new tuning. Console clean throughout. No
  `" 2"` iCloud conflict copies found. Did NOT bump `src/version.js` or
  push, per the phase's shared rules — the orchestrator does that once after
  T4.

- **T4: First-play interactive tutorial (2026-07-16)** — fourth and final
  phase of the feedback-tuning plan, driven by a new-player observation
  (watching a friend play): the red ✕ blocked tiles read as "build HERE",
  costing them a confused minute before their first placement. A 5-step,
  skippable, tap-gated walkthrough now runs ONCE on level_001's very first
  campaign start — see the "First-play tutorial (T4)" bullet under Key
  mechanics above for the full architecture (`src/tutorial.js` state
  machine, `config.js TUTORIAL` copy/knobs, `save.js`/`progression.js`
  `tutorialDone` flag + backfill, `index.html`/`styles.css`/`ui.js` overlay).
  Steps: (1) welcome card ("Defend the AI Core…"), TAP TO START or SKIP;
  (2) spotlight the tray's LASER chip, gated on the real tray-selection
  click; (3) spotlight a buildable tile, gated on any real successful
  `placeTower` (not just the illustrated one); (4) callout on a real
  blocked tile ("✕ chips are part of the circuit board — no building
  there" — the actual fix), tap-anywhere to continue; (5) spotlight the
  real START WAVE button, gated on the real wave-button click, which ends
  the tutorial and saves the flag. SKIP is reachable on every step.
  **Verified in-browser** (fresh + seeded saves via the `td` preview,
  console-driven real-DOM interactions — real tray click, a real
  `pointerdown` dispatched on the canvas at the target tile's actual
  screen coordinates, a real wave-button click — no synthetic module-API
  shortcuts for the gated steps, no canvas capture): (1) fresh save → all
  5 steps advanced only on their real action in order, tutorial ended,
  `tutorialDone` saved true, game fully playable afterward (botted wave 1,
  no throw); (2) replaying L1 and reloading the page both show no
  tutorial; (3) SKIP on step 2 removed the tutorial and saved the flag
  without disturbing the in-progress battle; (4) a hand-built save with
  `completedLevels`/`roster` but no `tutorialDone` field at all (simulating
  a pre-T4 save) backfilled the flag to `true` on load, no tutorial shown;
  (5) `tutorial.maybeStartTutorial` returns/stays inactive for level_002
  campaign and level_001 Endless on a fresh save (level_001-campaign-only,
  by construction). Spotlight math double-checked against
  `getBoundingClientRect()` of the real tray button, canvas tile, and wave
  button — exact match every time. Console clean throughout every run.
  Hit and worked around the documented "rAF pauses in a hidden/background
  tab" gotcha (HANDOFF § How to verify changes) while testing the
  per-frame spotlight repositioning: called `ui.updateTutorialOverlay`
  directly to confirm the math, since the automation harness's tab isn't
  the OS-focused foreground tab — gating logic itself runs from click
  handlers, not the frame loop, so it was unaffected. No `" 2"` iCloud
  conflict copies found. Original local test-profile save backed up
  before testing and restored byte-for-byte after (verified: shards,
  wins, roster count, stash count all matched post-restore). Did NOT bump
  `src/version.js` or push, per the phase's shared rules.

- **H1: Pulse tower nerf (2026-07-17)** — first phase of the round-2
  hard-mode tuning plan (`C:\Users\fthia\.claude\plans\hard-mode-tuning-2026-07.md`),
  driven by fresh telemetry: Pulse appeared in 13/15 winning campaign
  builds and was usually the highest-invested tower, plus two independent
  player notes ("Pulse tower should have a slower firing cadence and
  smaller range. It's overpowered" — L5; "Pulse tower should cost more to
  buy" — L10). `config.js TOWERS.pulse`: `baseFireRate` 1.1→0.78 (slower
  cadence), `baseRange` 1.6→1.35 (now the shortest-range tower in the
  set, below laser 1.9 and slow 1.6 — the L5 note's exact ask), `baseCost`
  75→105 (the L10 note's exact ask). `upgradeCostMult` left at 1.6
  (already the highest in the game). Also trimmed
  `TOWER_UPGRADES.specialties.pulse.splashGrowth` 0.16→0.12 (still above
  the shared 0.10 baseline, so Pulse keeps its bigger-explosions identity,
  just less generous per level). **Verified** (bot sims via the `td`
  preview + console, substepped at 1/60, no canvas capture; a pre-existing
  local test-profile save was backed up and restored byte-for-byte after
  — verified wins/shards/roster/stash counts matched post-restore):
  (a) **L15 economy A/B**, same money-earning bot script (build queue:
  4×pulse + slow + rocket, funded only by starting money + earned bounty,
  upgrading opportunistically when XP-eligible) run twice back-to-back —
  once with the new nerfed Pulse config, once with the pre-H1 values
  monkey-patched back in for a controlled comparison, same tile
  placements, same build order: OLD config cleared in 342 sim-seconds
  with 75g leftover; NEW (nerfed) config took 410 seconds (+20%) to clear
  the identical level with 340g leftover (towers leveled up more slowly
  since the weaker Pulse killed slower and hit its XP thresholds later)
  — both still won at full core/0 leaks with this heavily-funded comp
  (expected; H1 is a stat nerf, not a wave-HP change — H2-H4 handle the
  wave/economy side), but the same investment now measurably
  underperforms its old self. (b) **L1 pulse-only-wall vs mixed-wall**,
  same $2000 budget, all towers placed before wave 1, mirrors the old
  "11-laser wall" test pattern: an all-Pulse wall (19 towers fit at the
  new 105g cost) ended the level at 15/20 core with 1 leak; a
  laser/pulse/slow mixed wall of the same budget (28 towers fit, cheaper
  average cost) cleared at full core (20/20) with 0 leaks — the mono-Pulse
  investment is now measurably weaker than a diversified comp on identical
  spend. Console clean throughout both test families. No `" 2"` iCloud
  conflict copies found (repo-wide sweep). **Test-methodology note**: an
  early version of the wall test placed a single lone tower and delayed
  it slightly past wave start, which reproducibly got 0 kills even though
  the tower was firing normally and enemies were in range — traced to a
  genuine early-wave timing/positioning quirk (a lone tower's kill window
  is narrow at the very entrance), not a script bug; switched to the
  pre-funded whole-wall pattern (matches T2's precapitalized methodology)
  for a clean signal. Did NOT bump `src/version.js` or push, per the
  phase's shared rules — the orchestrator does that once after H4.

- **H2: World 1 hard pass, L1-L5 (2026-07-17)** — second phase of the
  round-2 hard-mode tuning plan, `levels.js`-only, driven by telemetry:
  L1 was the only `just_right` rating ("boss could have been a little
  harder"); L3 "none of the waves felt challenging, need to boost across
  the board"; L4 "way too easy"; L5 still rated too-easy despite T2's
  armored composition-punish. All changes are wave `healthMult` (plus one
  `bountyMult` knob); wave 1 untouched on every level (bankroll rule).
  **L1** (`level_001`): only the wave 10 boss touched, `healthMult` 5.2→6.8
  (+31%) — a smaller, targeted bump since this was the one level already
  rated right. **L2** (`level_002`): non-boss waves 2-6 ended up net ×2.4-
  2.6 vs the pre-H2 baseline (e.g. wave 5 basic 2.6→6.2), but waves 7-12
  needed THREE escalating passes before the test comp's outcome actually
  moved — the first two passes (~×1.7-2.0, then another ~+40%) produced
  bit-for-bit identical sim results (same kill count, same core, same
  leak count) despite the multiplier change, so those waves got pushed
  hard: final wave 12 twin-boss `healthMult` 3.6→18.2 (~×5 net). **L3**
  (`level_003`): after two passes (~×1.8/×2.2, then ~×2.9/×3.5) both still
  won FULL core with 0 leaks against the test comp, a console probe (see
  Verified below) found the actual threshold and every wave 2-12 group got
  an additional ×3 on top of the second pass — e.g. the final wave 12
  twin-boss `healthMult` ended at 36.0 (boss) / 41.4 (fast escort) / 45.6
  (armored escort), net ~×8.6-10.6 vs the pre-H2 baseline depending on the
  group. **L4** (`level_004`): non-boss/boss waves net ~×2.4/
  ×3.0 vs the pre-H2 baseline (e.g. wave 9 fast blitz 4.0→9.7, wave 12 twin
  boss 3.0→8.9). **L5** (`level_005`): T2's composition-punish (armored
  count/healthMult raised on waves 3,5,7,8,9,11,13 to break mono-laser
  walls) stays; on top, a first pass (~×1.85/×2.25, armored counts +15%)
  still won FULL core 0 leaks, so every wave 2-13 healthMult was doubled
  again (net ~×3.7 non-boss / ×4.5 boss vs pre-H2) after a console probe
  confirmed that multiplier reliably loses. **Economy:** added
  `level.bountyMult: 0.82` to L3/L4/L5 (L1/L2 left at default 1 — the plan
  only flagged L3-L5 as bounty-trim candidates). **Verified** (bot sims via
  the `td` preview + console, substepped at 1/60, no canvas capture; the
  pre-existing local test-profile save was backed up first — verified
  wins/shards/roster/stash counts matched byte-for-byte after restore).
  Test comp: an 11-tower level-5 laser/pulse/slow wall (4/4/3), mirroring
  T2's own "L5 mixed 4-laser/4-pulse/3-slow" methodology, precapitalized
  via the veteran-repurchase path (`maxUnlockedLevel` set, then
  `tryUpgradeTower` called with temporary funds) rather than a save/roster
  — this sidesteps T3's documented cross-sim contamination gotcha
  entirely by creating games directly via `game.js createGame`/
  `startNextWave`/`updateGame`, never touching the DOM or save. **New
  gotcha hit and fixed this phase:** running multiple LEVELS' sims back
  to back in one page session (not just multiple sims of the SAME level,
  which T3 already documented) also contaminates results — `towers.js`
  keeps module-scope globals (`nextTowerId`, `rosterCounters`) that keep
  incrementing across every `createTower` call in a session, and at least
  one borderline level (L5) produced a clean FULL-CORE WIN in an isolated
  fresh page load but a LOSS when run after 4 other levels' sims in the
  same session — same config, different result. Fixed by reloading the
  page (fresh module state) before every single level's sim, not just
  before repeat sims of one level. Final clean isolated results: L1 WON
  full core (20/20) 0 leaks — expected, only the boss was touched. L2 WON
  at 5/15 core (33%) with 2 leaks. L3 LOST on the final wave (12/12), core
  0, 3 leaks. L4 LOST on the final wave (12/12), core 0, 2 leaks. L5 LOST
  on the final wave (13/13), core 0, 3 leaks — all four hit or
  near-enough-hit the "loss or ≤30% core" target the plan asked for,
  where the same comp previously stomped these levels at full core per
  this round's telemetry. **Bankroll rule re-confirmed:** a from-scratch,
  starting-money-only build (no precap) clears wave 1 at full core with
  sane tower placement on all five levels — an earlier naive test script
  that placed a single L2 tower at an arbitrary buildable tile (not near
  the path) produced 12 leaks; re-tested by scanning every buildable tile
  for the single best placement and it clears wave 1 clean (0 leaks, full
  15/15 core), confirming the "12 leaks" reading was a test-script
  placement artifact, not a real bankroll violation (wave 1 numbers were
  untouched on every level this phase anyway). Console clean throughout.
  No `" 2"` iCloud conflict copies found (repo-wide sweep). Did NOT bump
  `src/version.js` or push, per the phase's shared rules — the
  orchestrator does that once after H4.

- **H3: World 2 hard pass, L6-L10 (2026-07-17)** — third phase of the
  round-2 hard-mode tuning plan, `levels.js`/`config.js`-only, driven by
  telemetry: this world was never touched by last round's rebalance, and
  leftover money at full-core wins ran 943g (L6) / 1442g (L7) / 445g (L8) /
  899g (L9) / 495g (L10). All changes are wave `healthMult` bumps plus a new
  `bountyMult` per level; wave 1 untouched everywhere (bankroll rule).
  **`config.js ENEMIES.boss`:** `damageMult.pulse` eased 0.75→0.85 — this
  global boss-resists-Pulse lever (from T2) was stacking with H1's direct
  Pulse nerf into a double-nerf; softened rather than removed (still a real
  resist, just not doubled-up). **L6** (`level_006`): non-boss waves net
  ~x11.4, boss/final waves net ~x13.65 vs the pre-H3 baseline (e.g. wave 10
  twin-boss `healthMult` 5.2→70.9); `bountyMult` 0.8 added. **L7**
  (`level_007`): non-boss net ~x7, boss/final net ~x8.4 (wave 10 twin-boss
  5.4→45.2); `bountyMult` 0.8 added. **L8** (`level_008`): the one W2 level
  with real pressure this round (3 leaks, core 4/10) yet still rated
  too_easy — pushed hardest of the five, non-boss net ~x8.3, boss/final net
  ~x10.1 (wave 9 final twin-boss 3.6→36.4); `bountyMult` 0.78 (lowest of the
  five, matching its already-higher pressure). **L9** (`level_009`):
  non-boss net ~x2.45, boss/final net ~x2.94 (wave 9 final twin-boss
  3.8→33.6) — needed far less than its siblings since its everything-is-fast
  design already punishes an unfocused build hard; `bountyMult` 0.8 added.
  **L10** (`level_010`): non-boss net ~x5.25, boss/final net ~x6.3 (wave 10
  final triple-boss 4.6→29.1); `bountyMult` 0.8 added. **Verified** (bot
  sims via the `td` preview + console, substepped at 1/60, no canvas
  capture; a pre-existing local test-profile save was backed up first and
  restored byte-for-byte after — confirmed identical length/content).
  Test comp: an 11-tower level-5 laser/pulse/slow/railgun wall (mirrors
  H2's methodology, extended with Railgun since World 2 assumes it
  unlocked), precapitalized via the veteran-repurchase path off a seeded
  save (`completedLevels` through level_005 to unlock Railgun; roster
  entries with `maxLevel:5`), built via direct `game.js`/`towers.js` calls
  (no DOM), fresh page reload before every level's sim per HANDOFF's
  documented gotcha. **New sim-methodology gotcha hit and fixed this
  phase:** `recordBattleEnd` (called automatically at every win/loss)
  writes the roster's in-battle XP back into the live `progression.js`
  module state — this means running MULTIPLE THRESHOLD-SEARCH TRIALS of
  the SAME level back-to-back in one page session (not just multiple
  DIFFERENT levels, which T3/H2 already documented) also contaminates
  results, because each trial's mastery-XP gain carries into the next
  trial's roster before a page reload. This produced a bogus "loss found at
  x3.5" reading for L8 that a clean, reload-before-every-single-trial
  re-test showed was actually still a FULL-CORE WIN — L8's real threshold
  was x1.25 on top of that (found by reloading before every trial from
  then on), and L9's, L10's initial reads were re-verified clean too (L9
  needed revising down from a bogus x3 to a real x1.4 net; L10's original
  contaminated-session finding happened to still hold clean). Final clean
  isolated results (fresh reload, single trial per level): **L6** WON at
  17% core (2/12), 2 leaks — near-loss. **L7** WON at 17% core (2/12), 2
  leaks — near-loss. **L8** LOST on the final wave, core 0, 5 leaks. **L9**
  LOST on the final wave, core 0, 2 leaks. **L10** LOST on the final wave,
  core 0, 4 leaks. All five hit the "loss or ≤30% core" target the plan
  asked for, matching H2's precedent exactly (L6/L7's 17% core mirrors L2's
  accepted 33% core). **Bankroll rule:** wave 1 groups were never edited on
  any of the five levels; re-confirmed via a realistic level-3
  carried-over-roster build (not a from-scratch level-1 opener, consistent
  with T2's documented precedent that L6-L10's wave 1 assumes some carried
  W1 roster strength) — all five clear wave 1 full-core, 0-leak. A
  from-scratch level-1-only opener still struggles on wave 1 of several of
  these levels, which is pre-existing (wave 1 numbers untouched) and
  matches T2's prior finding, not a new regression. Console clean
  throughout. No `" 2"` iCloud conflict copies found (repo-wide sweep). Did
  NOT bump `src/version.js` or push, per the phase's shared rules — the
  orchestrator does that once after H4.

- **H4: World 3 round-2 hard pass, L11-L15 (2026-07-17)** — final phase of
  the round-2 hard-mode plan. All five Prism Deep levels received a second,
  deliberately aggressive pass on waves 2 onward; wave 1 remains exactly as
  before to preserve the bankroll opener. Non-boss health multipliers were
  raised by roughly 60–75% over the T3 values, while boss/final groups rose
  by roughly 80–100% (for example, L11's final three-boss group 6.7→12.4
  and L15's four-boss finale 7.3→13.5). L13 now receives the same full pass
  as its siblings because fresh telemetry showed its prior leak advantage
  had disappeared. `bountyMult` is 0.58 on L11–15 (from 0.75), tightening
  the late-game cash surplus alongside the extra combat pressure. **Verified
  at module level:** every World 3 level constructs through `createGridModel`,
  no blocked tile intersects its path, and all 111 wave groups have valid
  positive health/count/interval data. Browser bot simulation could not run
  in this sandbox because the local Windows HTTP listener is unavailable;
  re-run the documented L11/L12/L15 telemetry-composition sims before the
  final deploy if a browser-capable session is available. No version bump or
  push in this phase; the orchestrator owns the final round-wide deploy.

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
  - **DONE — B3 (2026-07-12):** branching SVG skill tree + 4 new skill
    families. `config.js SKILLS` is now a prerequisite GRAPH — each node has
    `{ branch, parent, pos, glyph, maxTier, costs, kind }`; layout coords live
    in `SKILLS[*].pos` (viewbox `SKILL_TREE_VIEWBOX` 120×168) and branch colors
    in `SKILL_BRANCH_COLORS` — all tunable. 3 branches: CORE (cyan) =
    coreHealth root + the towerCap6→10 spine; COMBAT (red) = laser/pulse/slow/
    rail damage chain with railPen forking off railDamage; ECONOMY (yellow) =
    money/xp/shardFind + interestRate→interestCap fork. The 8 original skill ids
    are unchanged so old `state.skills` carries over. `ui.js buildSkillTreeSvg`
    (replaces `renderSkillList`) draws square nodes + lit/dim connectors, states
    bought/available(pulse)/locked; tap → `#skill-sheet-overlay` bottom sheet
    with pips + BUY (reuses the store-sheet pattern). Vertically pannable
    (`.skill-tree-scroll`). New skills: **tower levels 6–10** (5 chained
    single-tier nodes; `progression.getTowerLevelCap()` = 5 + owned cap nodes,
    routed through `towers.xpThresholdFor/upgradeCostFor`; `xpThresholds`/
    `upgradeCosts` extended to length 9). **Cash interest** (interestRate 2→10%,
    interestCap 50→250/wave) applied in `game.js applyWaveInterest` at each
    wave-clear (gold ring VFX at core; `game.lastInterest` left for B5 toast).
    **Shard find** (2→10%, `getSkillShardFindMult` composed into the enemies.js
    shard accumulation). **Railgun over-penetration** (railPen, beam ×1.0→2.0)
    via `tower.beamLengthMult` threaded through `collectLineVictims`
    (new `maxLength` param — laser unaffected), the rail fire endpoint, and
    `findRailgunAim`. buySkill gained a parent gate (first tier only — owned
    nodes always keep upgrading, so pre-B3 saves never get stuck) and per-node
    `maxTier`/`costs`. **Mastery anchor decision:** `equipment.masteryRankFor`
    now reads a settable `masteryXpStart`; `progression.syncMasteryAnchor` moves
    it to the unlocked cap's XP threshold (`xpThresholds[cap-2]`) so leveling
    6–10 doesn't double-count as mastery. Base cap 5 → stays 700, so EXISTING
    veterans are NOT nerfed until they choose to unlock higher caps. Verified:
    parent-gating, cap→10 + enforcement, interest (+38 under a 50 cap on a 1000
    bank), rail reach 224→314 at ×1.4, old array-form save migrates clean
    (mastery probe unchanged at 1100). Next: B4 gear visible on towers.
  - **DONE — B4 (2026-07-12):** gear now visible on towers in-battle + an
    old-vs-new equip comparison sheet. **In-battle visuals:** new
    `renderer.js drawTowerGear` (runs in the additive `lighter` pass, no
    shadowBlur) draws one slow-orbiting rarity-colored diamond per equipped
    item (up to 4) around each geared tower, plus a faint aura glow tinted by
    the tower's BEST rarity; singularity gear makes the aura shimmer-pulse.
    All knobs in `config.js VFX.gear` (orbitRadius/orbitSpeed/diamondSize/
    orbitGlow/orbitGlowAlpha/auraRadius/auraAlpha/shimmerSpeed/shimmerDepth).
    Rarity colors are a local `GEAR_RARITY_COLOR` map in renderer.js
    (mirrors ui.js `RARITY_COLOR`; kept local so the renderer takes no UI
    import); renderer now imports `VFX` from config + `GEAR_SLOTS` from
    equipment.js. **Compare sheet:** new `ui.js openCompareSheet(current,
    incoming, {onEquip, readOnly})` — two columns (CURRENT / NEW) with
    title+rarity, per-affix rows aligned by stat with green up / red down
    deltas, a UNIQUE row, and affixes present on only one side greyed
    (`.cmp-absent`). Footer EQUIP NEW / KEEP CURRENT (or CLOSE when
    `readOnly`). Both displacing equip paths now route through it when the
    destination slot is filled: `openEquipTargetSheet`'s target tap (the real
    path: stash item -> EQUIP -> pick a tower whose slot is full) and
    `openPickerSheet`'s pick (guarded, but that picker only opens on empty
    slots today). Styling in styles.css `.cmp-*` classes. Verified:
    multi-frame render of 1-item and 4-item towers incl. singularity shimmer
    throws nothing + console clean; compare sheet shows correct columns/deltas/
    unique row; EQUIP NEW swaps and banks the displaced item to stash; KEEP
    CURRENT is non-destructive. Next: B5 milestone toasts + recap + per-level
    milestones.
  - **DONE — B5 (2026-07-12):** milestone live toasts + end-screen recap +
    per-level campaign challenges. **Live toast:** new `#milestone-toast`
    DOM element (index.html) + `ui.js showMilestoneToast(text)` — a queued,
    auto-fading gold banner (2.3s, pointer-events none, `prefers-reduced-motion`
    aware, z-index 8 so it sits under the win/loss overlay). Fired from
    `game.js queueMilestoneToasts` at each wave-clear: Endless crossings
    (`★ WAVE N — MILESTONE!` when `waveIndex+1` hits a track threshold,
    display-only — grants still fire at run end) and campaign milestone
    attainment. game.js pushes texts onto `game.newMilestoneToasts`; main.js
    drains them each frame (keeps game.js UI-free). **New per-level
    milestones:** `config.js LEVEL_MILESTONES` (2 per level ×15), evaluated by
    new pure `src/milestones.js`. Condition vocabulary (data, combinable):
    `kills`, `towersAtLevel:[count,level]`, `clearNoLeaks`, `onlyTowers`,
    `withoutTowers`, `throughWave` (window gate). Whole-run constraints
    (clearNoLeaks, bare onlyTowers/withoutTowers) resolve at WIN only;
    kills/towersAtLevel/wave-windowed ones latch mid-run into
    `game.milestoneResults` (a Set, never un-earned once latched). Rewards:
    `{kind:"shards"}` or `{kind:"skillPoint"}`; the marquee "Flawless"
    (clearNoLeaks) plus a hard tactical challenge per level, skill points on
    the toughest. **Run tracking:** `game.kills` (enemies.js death branch),
    `game.leaks` (game.js leak loop), `game.typesUsed` Set (towers.js
    placeTower — survives sells). **Persistence:** new save field
    `state.levelMilestones {levelId:[claimedIds]}` (save.js DEFAULT_SAVE +
    progression.js top backfill). Granted in `progression.grantLevelMilestones`
    (called from `recordBattleEnd` won/lost + `forfeitBattle`; endless runs
    never grant campaign milestones); idempotent — a claimed id re-toasts but
    pays nothing. **Recap:** `showOverlay` gained a `milestones` param →
    `#overlay-milestones` gold list above the loot grid (each entry
    label/reward/isNew, `— NEW!` + glow on first attainment). main.js builds it
    from `game.campaignMilestones` (campaign) or `game.endlessResult.newRewards`
    (endless — replaces the old `endlessRewardLine()` subtitle hack, now
    deleted along with the orphaned `placementText`). **Display:** level-detail
    sheet gained a CAMPAIGN CHALLENGES section + `⚑ done/total` chip
    (`getLevelMilestones`). Verified via full bot sims: L1 clear with one-shot
    lasers → both milestones latch, persist to save, grant +70◆; a loss grants
    neither win-only milestone; endless run toasts exactly once at wave 10;
    toast + recap + level-sheet DOM all render with correct reward text;
    console clean on load.
  - **DONE — B6 (2026-07-12):** playtest tuning pass (a-priori knob sweep,
    no iPhone report yet). `config.js` changes: store rarity unlock prices
    `enhanced 100→80, rare 350→300` (slightly more accessible first unlock);
    L6-10 XP thresholds tightened on the steep top end
    `[…1500,2100,2900,3900] → […1350,1800,2400,3200]`; L6-10 upgrade costs
    similarly reduced `[…650,900,1250,1700] → […600,800,1100,1500]`; gear
    orbital visuals bumped for more pizzazz — `orbitRadius 0.36→0.40`,
    `diamondSize 4.0→5.0`, `orbitGlowAlpha 0.85→0.90`, `auraAlpha
    0.13→0.18`, `shimmerDepth 0.6→0.75`; Endless wave-35 shard reward
    `90→110`. All knobs remain in `config.js VFX.gear` / `TOWER_UPGRADES`
    / `LOOT.store.rarityUnlocks` / `ENDLESS_REWARDS`. Next: iPhone playtest
    → second B6 pass from user reports.
- **Loot P7 balance pass** — largely superseded by B1/B6; read
  `LOOT_DESIGN.md` §15 before tuning drops.
- **DONE — playtest tuning T1–T4 (2026-07-16):** first pass from real play.
  Telemetry verdict (43 rows, one player): 19/26 ratings "too easy", zero
  "too hard"; L1→L15 cleared in ~70 min; only walls were L3/L7/L8 (the L7/L8
  lose-then-level-then-win shape was explicitly ENJOYED — that's the
  calibration anchor); all of W3 fell first-try with 1.5–5.1k leftover money;
  named culprits: railgun ("overpowered or too cheap"), rocket upgrades too
  cheap, soft bosses (L2/L7), L5 mono-laser wall win, L6 railgun optional.
  Fixes: T1 railgun 140g + 1.3× / rocket 1.4× upgrade mults; T2 boss +
  counter pass (L5 11-laser wall now LOSES); T3 W3 waves +25–40% + new
  per-level `bountyMult` knob (leftovers now <250 in sims); T4 first-play
  tutorial (new-player watcher thought blocked-tile ✕ = tower socket).
  Details in the build-history entries below + plan file
  `feedback-tuning-2026-07.md`. **Re-playtest on iPhone pending** — next
  pass should diff telemetry by `app_version`.
- Retune `config.js ENDLESS` ramp (seeds off the re-tuned final waves).
- Unscheduled ideas: save export/import (iOS evicts localStorage after ~7
  idle days), sound, more towers (Tesla chain-lightning runner-up),
  pre-battle loadouts.
