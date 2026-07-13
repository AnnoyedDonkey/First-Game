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
track, per-level campaign challenges (2/level, some award skill points) with
live milestone toasts + an end-screen recap, forfeit button, a full
Diablo-style loot/equipment system (Shards ◆
currency, per-tower gear in 4 slots, 5 rarities, drops/stash/triage, store,
gear visible on towers in-battle as orbiting rarity diamonds, old-vs-new
equip comparison), a tower-first gear UI, and an SVG circuit-board main menu. All deployed and
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
- **PLAYTEST-PENDING:** counter re-tune + Rocket + World 3 difficulty is
  bot-calibrated only; expect a tuning pass from iPhone play (L2/L4/L5 and
  all of W3 flagged). If counters don't drive combo choices: harsher resists
  or waves that hard-require a tower.
- Retune `config.js ENDLESS` ramp (seeds off the re-tuned final waves).
- Unscheduled ideas: save export/import (iOS evicts localStorage after ~7
  idle days), sound, more towers (Tesla chain-lightning runner-up),
  pre-battle loadouts.
