# Geometric TD — Developer Handoff

Read this first if you are an AI assistant (or human) picking up this project.
Companion docs: `GAME_BRIEF.md` (original spec + feature history). The user's
design taste and workflow preferences are at the bottom — follow them.

**State at handoff (July 2026, latest Claude Opus 4.8 session):**
**15-level campaign across 3 worlds**, **5 towers** (Railgun unlocks after
level 5, **Rocket Launcher after level 10**), 7 enemy types, an
**enemy-counter system with visible hit feedback**, 5-tier skill tree
(now 8 skills), permanent per-class specialties, post-level-5 Mastery
ranks, per-level palettes, GeoDefense-style VFX, ¼x–4x speed controls,
**Endless mode** per level (unlocked once beaten, waves escalate forever,
tracked as best-wave-reached, and now has a **5-milestone reward track**
per level — Shards/loot auto-granted on crossing wave thresholds), and a
**forfeit button** to abandon a battle mid-run — plus a full **Diablo-style
loot/equipment system** (Shards currency, per-tower gear across 4 slots,
5 rarities, drops/stash/triage, a store) — all deployed and playable at
the GitHub Pages URL below. No known bugs. **Loot build P0–P6 are shipped;
P7 (balance pass) is next** — see `LOOT_DESIGN.md` and the backlog below.

**Balance-pass additions (this Opus session — see "Counters &
differentiation" below):** towers were made mechanically distinct so
levels can demand specific combos: a damage-type COUNTER system
(enemies resist / are weak to each tower), VISIBLE feedback that teaches
it (grey shield-clink on a resisted hit, bright colored halo on a
super-effective one), a Slow-tower VULNERABILITY debuff (+30% damage to
slowed enemies), Railgun MAXIMIZE-HITS aiming (place it down a lane),
per-tower `upgradeCostMult`, the global-range Rocket Launcher, and a
counter-gated re-tune of every level's waves. Reshaped the mid-campaign
maps and added World 3 for path variety.

Everything below in "Key mechanics" is current and was expanded across
the last few sessions (bottom action bar rework + live DPS readout,
Endless mode, the forfeit button). Two real gotchas worth reading before
touching related code: a **nested-flexbox min-width bug** that pushed a
button off-screen (see "Tower panel / bottom action bar" below), and a
**GitHub Pages multi-file deploy-propagation** issue that briefly
soft-locked the main menu (see "Running it" below) — both bit us once
each and are now guarded against, but the underlying causes (this
project's flexbox-heavy layout with no build step, and no build
step/hashed filenames on a static host) aren't going away, so new
features in the same areas can hit them again.

## What this is

A portrait, mobile-browser tower defense game inspired by geoDefense /
Geometry Wars. Neon vector visuals on a warping grid. The player defends an
AI Core against waves of geometric enemies across a 15-level campaign (3
worlds).

**The core differentiator:** towers are persistent RPG-like units, not
disposable buildings. Each tower has a name (Laser-01, Pulse-02,
Railgun-01...), earns XP and kills, and lives in a permanent roster across
battles. A persistent 5-tier skill tree adds account-wide progression.

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
  **Gotcha:** there's no build step / hashed filenames, so a deploy can
  briefly leave different static files (e.g. `save.js` vs `ui.js`) served
  from different CDN edge versions for a minute or two. Hit this once: a
  new save field (`endlessBest`) existed in the fresh `progression.js`
  but a save loaded via a momentarily-stale `save.js` lacked it, throwing
  and soft-locking the main menu. Fix pattern: don't rely SOLELY on
  `save.js`'s `DEFAULT_SAVE` merge for a new field — also backfill it
  right after `loadSave()` in `progression.js` (see `state.endlessBest
  ||= {}` there) so it's safe even if `save.js` itself is momentarily
  behind. If the user reports something broken right after you tell them
  to test, ask them to hard-refresh / wait a minute before assuming it's
  a real bug.
- Git: repo root is `First Game/` (one level above this folder). Commit
  after each verified feature; the user expects push-to-play.
- **DEPLOY RULE: bump `APP_VERSION` in `src/version.js` on every push** the
  player should pick up. It drives the home-screen update nudge (see
  "Post-campaign systems" below); a stale string means no nudge fires.

## Post-campaign systems (added July 2026, Opus session)

Three features layered on after the 10-level campaign + Endless. All keep
the hard constraints (vanilla JS, no build, no deps):

- **World-paged main menu.** `showLevelSelect` (ui.js) pages the mission
  list by WORLD (levels.js `WORLDS`): INNER GRID (1-5), OUTER VOID (6-10),
  PRISM DEEP (11-15), one page each, navigated by ◀ ▶ arrows or horizontal
  swipe (`bindWorldSwipe`; horizontal-dominant drag only, so vertical
  list-scroll never flips worlds). A world is locked until every level of
  the previous world is in `completedLevels`; a locked world can still be
  previewed (greyed rows + banner). Add a world = one data edit in WORLDS.
  **Menu layout (Opus UI-polish pass):** `#level-overlay` is a top-down
  flex column — title, world-nav, a **scrolling `#level-list`** (flex:1,
  the only part that scrolls), and a **pinned `#menu-actions` footer**.
  The account-wide entries (SKILLS/TOWERS/BOARD share one row + RESET)
  live in that footer via `appendGlobalMenuButtons` (which clears and
  refills `el.menuActions` each render) — NOT in the level list, so they
  never scroll out of view no matter how many Endless rows a world has.
  Each cleared level is ONE row: `.level-row` is a horizontal flex with
  the campaign button (flex:1) and the `∞ ENDLESS` button (fixed ~108px)
  side by side. If you add per-level menu content, keep it in the list;
  keep global/account actions in the footer.
- **HUD is battle-only.** The top `#hud` (credits/wave/core/skills + speed
  controls) is meaningless on the menu, so `showLevelSelect` adds
  `#hud.hidden` (`display:none`) and the menu's `pick()` removes it when a
  battle starts. Every "return to menu" path goes through
  `showLevelSelect`, and every "menu→battle" path through `pick()`, so the
  toggle stays consistent; post-battle NEXT/RETRY call `startLevel`
  directly but the HUD is already visible then.
- **Shared leaderboard.** Per-level Endless best-wave, published to a
  Supabase table via plain `fetch` (leaderboard.js). Own localStorage key
  (`geometric-td-leaderboard-v1`: nickname + a per-browser clientId +
  published map) — deliberately NOT in the game save. New bests
  auto-publish (silent, best-effort, only with a nickname set); a
  LEADERBOARD menu page + RUN OVER button let players view/publish.
  Dormant until `config.js LEADERBOARD.url`/`anonKey` are set (they are,
  pointing at the user's project — publishable key, safe to ship;
  moderate trolls in the Supabase Table Editor). Setup + SQL in
  `SUPABASE_SETUP.md`. Other players' nicknames are HTML-escaped on render.
- **Update nudge (update.js + version.js).** Exists because iPhone
  home-screen (standalone) launches have no reload button and resume
  backgrounded sessions instead of reloading. On load + every
  `visibilitychange`, re-fetches version.js with `cache:no-store` and
  compares to the baked `APP_VERSION`; on mismatch shows a tap-to-reload
  banner. Reload still respects GitHub Pages' ~10-min cache, so right
  after a push the banner may reappear until the CDN propagates.

## End-of-battle results screen (2026-07-11, Opus session)

Rebuilt the win/loss/endless/forfeit overlay (`showOverlay` in ui.js,
`checkEndState` + the forfeit handler in main.js). Replaced the old
forced one-item-at-a-time drop reveal + wall-of-text subtitle with a
single screen:

- **Roast title.** The big title is now a randomly picked cheeky one-liner
  from `config.js RESULT_ROASTS`, bucketed by outcome (`victory` / `defeat`
  / `endless` / `forfeit`, ~40 lines total). `main.js pickRoast(bucket)`
  chooses one. Green on wins, red on losses via the existing
  `#overlay.win/.loss h1` CSS. Add/reword/cut freely — keep each under ~34
  chars so it doesn't wrap past two lines (title is now 28px/2px, wraps).
- **Loot grid, not a sequence.** `showOverlay` takes an `items` param
  (the run's placements from `allPlacements(game)`) and renders a tappable
  5-wide tile grid (`#overlay-items`, reusing `tileHtml`/`slotGlyph`).
  Tapping a tile pops that item's rarity-burst card via
  `showItemDetail` (ui.js) — the U4 reveal-card visual, now on-demand
  (tap to close) instead of a mandatory pre-overlay walk. The old
  `showDropReveal` sequence is no longer called by main.js (the function
  still exists but is dead — remove if you like).
- **Buttons per state.** Campaign win: NEXT, RETRY LEVEL, MANAGE GEAR,
  MAIN MENU. Endless: RETRY ENDLESS, PUBLISH SCORE (leaderboard, only when
  `lbEnabled()`), MANAGE GEAR, MAIN MENU. Loss/forfeit: RETRY LEVEL,
  MANAGE GEAR, MAIN MENU. Built by `main.js lootTailButtons(items,
  stashFull)` (the shared MANAGE GEAR / skill / MAIN MENU tail).
- **MANAGE GEAR** (replaces the old CLAIM LOOT) shows whenever loot was
  earned. When the stash overflowed (`items.some(p => p.dest ===
  "pending")`) it gets the red `.big-button.danger` style AND `#overlay-note`
  shows a red "stash full" line (`stashOverflowNote`). Opens the gear panel
  in triage mode.
- **ASSIGN SKILL POINTS** now shows ONLY when `getSkillPoints() > 0`
  (user rule: don't offer it with nothing to spend).
- Overlay is now `overflow-y: auto` + `justify-content: safe center` so the
  taller content (buttons + grid) stays reachable in portrait.

## File map

```
index.html        page shell: HUD, canvas, overlays, tower tray
styles.css        portrait layout, dark theme, all overlay styling
src/
  config.js       ALL tuning: towers, enemies, XP/upgrade tables, economy,
                  VFX (particles + grid warp), skills. START HERE for balance.
  levels.js       10 levels, pure data: pathCorners, blockedTiles, waves,
                  per-level palette. Header comment documents the format.
                  Also exports WORLDS (the main-menu world grouping).
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
  equipment.js    gear slots, requirement gates, stat/unique aggregation
  save.js         localStorage read/write/reset (key: geometric-td-save-v1)
  leaderboard.js  shared online board (Supabase REST via fetch); own
                  localStorage key (nickname + clientId), never touches
                  the game save. Config in config.js LEADERBOARD.
  version.js      APP_VERSION build stamp — BUMP THIS every deploy.
  update.js       home-screen "update available" nudge (compares baked
                  APP_VERSION to a no-store re-fetch of version.js).
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
- **Contributor-weighted XP (loot P0, shipped):** a kill's XP pool is split
  among EVERY tower that damaged or slowed the enemy, by weight — damage
  dealt (1/point) plus slow applied (`slowSeconds * LOOT.xp.slowWeightPerSec`).
  Base pool total is unchanged; equipped XP Gain can multiply a recipient's
  share. The kill COUNT still goes only to the final-hit tower. Tracked on
  `enemy._contrib` (accumulated in
  `damageEnemy`/`slowEnemy`, consumed at death in `awardKillXp`, both in
  enemies.js). This finally levels Slow towers, which rarely land the
  killing blow. (Was: final-hit-only, so Slow towers never leveled.)
- **Veterans:** placing a tower type auto-deploys your best not-yet-deployed
  roster unit of that type (highest maxLevel first). Veterans re-enter at
  level 1 but re-buy up to their unlocked level with money alone (no XP
  gate — `isUpgradeEligible`). The button says UPGRADE either way (the user
  rejected "RESTORE" wording). Panel shows "LV 1/4" for unlocked potential.
- **Selling:** refunds 50% of `tower.invested` (build + upgrades). Roster
  record survives; XP earned during the current battle by a sold tower is lost.
- **Roster recording:** `recordBattleEnd` runs inside game.js at the moment
  of win/loss (NOT in the render loop — background tabs pause rAF).
- **Shards ◆ (loot P1, shipped):** persistent meta-currency for gear/store work.
  Earned per kill — win, lose, OR forfeit — as `round(LOOT.shards.perKillBase
  * enemy.def.shardTier)` (`shardTier` is a new per-enemy field, 1/2/4 for
  grunt/heavy/boss). Banked live on `game.shardsEarned` (enemies.js
  `damageEnemy`), synced into the persistent `state.shards` wallet inside
  `progression.js syncRoster` — the function already shared by
  `recordBattleEnd`/`recordEndlessResult`/`forfeitBattle`, so every exit
  path pays out the same way. Save field `shards` (default 0), migrated
  with the usual belt-and-suspenders backfill pattern. Shown as `◆ N` under
  the main-menu title (`#shards-readout` in index.html), refreshed in
  `ui.js renderWorld`. Read via `progression.js getShards()`.
- **Mastery (post-level-5 progression):** XP past the level-5 threshold
  converts to permanent damage ranks on a **50-rank escalating curve** (loot
  P0): rank *n* costs `baseXpPerRank + xpRankIncrement*(n-1)` XP (400 + 80·…),
  +1.5%/rank, capped at 50 (+75%). `masteryRankFor` inverts the cumulative
  sum in closed form. Derived purely from saved `xp` (retroactive, no new
  save fields); follows the tower forever like specialties. Ranks up live
  mid-battle (checked in `updateTowers`). Shown as ★N in the panel and Tower
  Guide. Knobs: `TOWER_UPGRADES.mastery`. NOTE: the P0 curve is steeper than
  the old flat 25-rank/+2% one, so it RETROACTIVELY lowered existing
  veterans' ranks (e.g. old-cap 15,700 XP: rank 25 → rank 15) — an
  accepted, deliberate nerf (LOOT_DESIGN §2b). This exists so grinding
  earlier levels
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
- **Endless reward tracks (loot P6, shipped):** one shared 5-milestone
  wave-threshold list (`config.js ENDLESS_REWARDS.milestones`, waves
  10/20/35/50/75, alternating Shards and loot up to Singularity) applies
  to EVERY level's Endless mode; each level tracks its own claimed set in
  `save.js endlessRewards[levelId]`. Grants are automatic — no separate
  claim step — via `progression.js grantEndlessRewards`, called from
  `recordEndlessResult` and keyed to the level's **best-ever** wave (not
  just the run that just ended), so a threshold already cleared by a past
  run grants retroactively the next time that level's Endless mode ends.
  Shard rewards bank straight into the wallet; loot rewards use the same
  `dropIlvl` scaling as kill/end drops and land in `pendingLoot` — same
  GEAR-panel triage flow as any other drop. Newly-crossed milestones are
  called out in the RUN OVER overlay subtitle (`main.js
  endlessRewardLine()`); the level-select Endless button shows a
  `★ claimed/total` readout (`getEndlessMilestones`, rendered in
  `ui.js renderWorld`).
- **Forfeit button:** the ✕ in the top HUD (`#exit-button`, next to the
  speed controls, wired via `onExitButtonTap` in ui.js). Tapping it while
  a battle is active shows a confirm overlay (reuses `showOverlay`, type
  `"loss"`) explaining the battle ends with no win/completion credit;
  FORFEIT calls `forfeitBattle(game)` (progression.js — syncs roster XP
  only, no `completedLevels`/`wins`/`skillPoints`/`endlessBest` change)
  then returns to the main menu, CANCEL just closes the prompt. While the
  prompt is up the sim is frozen via a module-level `exitConfirming` flag
  in main.js, ORed into the same `dt = 0` check the pause button uses —
  it does NOT touch the pause button's own state, so canceling leaves
  speed/pause exactly as it was. No-ops (does nothing) if tapped from
  the main menu (`game` is null) or while another overlay is already up.

## Counters & tower differentiation (Opus balance pass)

The goal was "make the player rethink which towers they use." Towers now
form a rock-paper-scissors:

- **Counter system.** Each enemy has `ENEMIES[type].damageMult`, keyed by
  the attacking tower's `damageType` (`energy`=Laser, `pulse`=Pulse,
  `control`=Slow, `rail`=Railgun, `blast`=Rocket). `>1` = weak, `<1` =
  resists, missing = 1.0. Applied in `enemies.js damageEnemy`. This is
  THE knob that lets a level demand a combo. Current shape: Fast←Laser,
  Armored←Pulse/Railgun (resists Laser 0.4), Regenerator←Railgun (resists
  Laser 0.45), Splitter←Pulse/Rocket (resists Railgun 0.6), Boss←Railgun/
  Rocket/Laser-focus (resists Pulse/Slow).
- **Visible feedback teaches it.** In `damageEnemy`, a hit with mult ≤0.75
  shows a dull grey spark + steel shield-ring; ≥1.2 shows a bright white
  burst + tower-colored halo; neutral is normal. Without this the counters
  were imperceptible (there are no damage numbers) and players never
  adapted — this was the key fix.
- **Slow = force multiplier.** `TOWERS.slow.vulnerability` (0.30) marks a
  slowed enemy to take +30% from ALL sources for the slow's duration
  (`enemies.js slowEnemy` sets `vulnMult`/`vulnUntil`). Gives Slow a real
  combo role beyond CC.
- **Railgun aims to maximize hits.** `towers.js findRailgunAim` picks the
  firing line that pierces the most enemies, so aligning it with a
  straight run of path clears the lane — placement finally matters.
- **Rocket Launcher (`type: "rocket"`, `damageType: "blast"`).** Unlocks
  on clearing level_010 (`progression.js isTowerUnlocked`). GLOBAL range
  (`baseRange: 999` → skips the range ring in renderer), slow reload,
  heavy hit + explosive splash. Fires a homing rocket
  (`projectiles.js spawnRocket`) that explodes via the shared `explode()`
  (bigger flash/shock for `kind:"rocket"`). Roster prefix **K**. Has its
  own skill "Warhead Payload" (`rocketDamage`) and specialty (bigger
  blasts). Tray auto-adds it; locked label comes from `def.unlockLabel`.
- **Per-tower upgrade economics.** `TOWERS[type].upgradeCostMult` scales
  the shared `TOWER_UPGRADES.upgradeCosts` (Pulse 1.6×, Slow 0.8×).
- All wave lists were re-tuned so each level leans on its signature
  enemy's counter (see the per-level header comments in `levels.js`).

## Worlds & paths

Three worlds (`levels.js WORLDS`): INNER GRID (1-5), OUTER VOID (6-10),
PRISM DEEP (11-15). Path archetypes are now deliberately varied to fight
sameness: serpentine, chevron zigzag, perimeter grand-tour, staircase,
spirals, vertical comb, diagonal switchbacks, full-width maze sweeps,
long straights, bottom-entry spiral, step cascade, plus-detour, switchback
ladder. All maps are still 8×12, single entry→core, orthogonal segments.
Verify a new map with the build-check recipe (construct `createGridModel`
for every level; assert no throw, no blocked tile on the path, ample
buildable tiles flanking the path).

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
selector is open. (Historical note: an earlier pass scaled levels 3-10
healthMult ×1.2 for the specialty power gain; the Opus balance pass has
since rewritten every level's waves, so treat the numbers in `levels.js`
as the source of truth, not that old ×1.2 rule.)

## Backlog (user-approved, not yet built)

- **LOOT & EQUIPMENT SYSTEM (in progress — P6 shipped, P7 next):** full build spec in
  `LOOT_DESIGN.md` — per-tower Diablo-style gear (4 typed slots, 5 rarities,
  affixes + Singularity uniques, Shards currency, store, stash+triage),
  plus the changes it forces (50-rank escalating Mastery curve,
  contributor-weighted XP that finally levels Slow towers, Endless reward
  tracks). Phased build order P0–P7 + knobs list in that doc; tick its
  "Build status" checkboxes as phases land.
  - **P0 DONE (2026-07-11):** 50-rank escalating Mastery curve +
    contributor-weighted XP (both described under "Key mechanics" above).
    §2b retroactive-nerf decision resolved (accepted). Config knobs live in
    `TOWER_UPGRADES.mastery` and the new `LOOT.xp` block in config.js.
  - **P1 DONE (2026-07-11):** Shards ◆ currency + save schema/migration
    (described under "Key mechanics" above).
  - **P2 DONE (2026-07-11):** Item generator — new pure module `src/loot.js`
    (`generateItem`, seedable `makeRng`, `lootSelfTest`, `itemLabel`; exposed
    as `window.loot`). All knobs in `config.js LOOT.gen` (affix table, rarity
    weights, restriction, unique pools, ilvl curve, sellValues). Restriction
    (§4c) satisfied by construction: type is fixed before affixes are sampled.
    Verified via a 50k-item
    console self-test (all invariants + distributions). Details under
    LOOT_DESIGN §14 P2 checkbox.
  - **P3 DONE (2026-07-11):** roster gear slots + migration, equip requirement
    checks, all normal affixes, crit, Overcharge/double-shot, four Prismatic
    minor uniques, and all seven Singularity effects. Combat plumbing is in
    `equipment.js`, `towers.js`, `projectiles.js`, and `enemies.js`; tunables
    are in `config.js LOOT.combat` plus per-tower projectile speed/base pierce.
    Temporary console bridge: `gear.grant("Laser-01", { unique: "prismLens" })`,
    `gear.equip(name, item)`, `gear.unequip(name, slot)`, and `gear.roster()`.
    Forced debug grants bypass level/Mastery gates but still enforce tower type.
  - **P4 DONE (2026-07-11):** drops, guaranteed end-drop, stash, equip UI, and
    triage. Kill drops roll from `LOOT.drops`; every win/loss/forfeit adds one
    guaranteed end-drop; unclaimed loot goes to `pendingLoot` and the main-menu
    GEAR panel lets the player claim, equip, unequip, sell, bulk-sell low
    rarities, or confirm-leave unclaimed drops. New save fields `stash`,
    `pendingLoot`, `store`, and `endlessRewards` are defaulted and backfilled.
  - **P5 — Store UI** — completed (2026-07-11). Persistent stock
    (`LOOT.store.stockSize`, now **15** — was 5) scales from the best roster
    level + Mastery, refreshes after every battle, rerolls for escalating
    Shard costs, and buys safely into the stash. Store prices, reroll costs,
    stock size, and item-level scaling are all in `config.js LOOT.store`;
    existing GEAR-panel selling remains the sell path. NOTE: reroll cost and
    per-item prices weren't scaled up with the 5→15 stock bump, so a reroll
    now refreshes 15 tiles for the same 30◆ — retune there if it feels cheap.

  - **Loot-economy tuning (2026-07-11):** per-kill drop chance halved
    (`LOOT.drops.dropChanceBase` 0.02 → **0.01**) so a long run yields ~10
    items instead of ~20+ (kill drops are the dominant source; the
    guaranteed end-drop and Endless milestones are separate and small). If
    it's still heavy, `dropChanceTierMult` (0.6, per-shardTier bonus) is the
    next lever. Set from a wave-31 endless report, not a fresh sim.
  - **P6 — Endless reward tracks** — completed (2026-07-11). Described in
    full under "Key mechanics" above. Verified by driving `progression.js`
    directly with fake game objects (real combat sims were too fragile to
    reliably push to wave 20+) — confirmed milestones grant exactly once,
    grant retroactively off best-wave rather than the current run, and the
    level-select ★ readout updates correctly.
  - **Next: P7 — Balance pass.** Bot sims on geared/high-Mastery veterans
    (the "wave-1 spike" concern in LOOT_DESIGN §15), drop-rate and Shard-
    economy sanity checks, Mastery pacing. This is the first loot phase
    that's pure judgment rather than a fixed spec — read LOOT_DESIGN §15
    first.
    Build one phase per fresh session (`/clear` between); the handoff is the
    committed files + LOOT_DESIGN checkboxes, not the conversation.


- **GEAR UI REDESIGN — COMPLETE (U0–U5 all shipped):**
  full spec + phase history in `GEAR_UI_DESIGN.md`; approved interactive
  mockup at `mockups/gear-ui-mockup.html`. Replaced the flat P4 GEAR panel
  with a tower-first two-tab screen (TOWERS/STASH, icon tiles, filters),
  merged the Tower Guide menu entry away, renamed roster units to long
  names (Laser-01), and restyled the STORE with the same tile/sheet
  components.
  - **U0 DONE (2026-07-11):** Mastery-1 equip gate (`equipment.js
    canEquipItem`, reason `"masteryGate"`, grandfathered — already-worn
    gear never stripped) + auto-equip-on-earn (`progression.js
    bankEarnedItem`: kill drops/end-drop/Endless milestones equip onto the
    highest-Mastery eligible tower with that slot EMPTY, else stash, else
    pendingLoot; store buys skip it). Earned loot now defaults into the
    STASH, not pendingLoot — triage only appears when the stash is full.
    End-of-battle overlays list each item's fate ("▲ RARE EMITTER →
    Laser-01").
    Knobs: `config.js LOOT.equipGate` + `LOOT.autoEquip`. Details in the
    GEAR_UI_DESIGN U0 checkbox.
  - **U1 DONE (2026-07-11), plus most of U2:** `#gear-overlay` rebuilt as
    the tower-first TOWERS/STASH tabbed screen from the mockup — SVG slot
    glyphs, rarity-glow tiles, STASH grid with slot/rarity filters + sort +
    tap-again SELL ALL, TOWERS tab with per-tower slot-tile cards, a shared
    bottom sheet (item detail / stash-picker / equip-target / tower stat
    sheet / `?` guide) with scroll position preserved across every
    re-render (the old panel's worst bug — full rebuild resetting scroll —
    is gone). New `state.seenLoot` id-list drives magenta NEW badges
    (`progression.js isItemSeen/markItemSeen/countUnseenStash`); new
    `towers.js careerStatsFor` computes menu-display stats (DPS, mastery %,
    specialty %, range) from a roster record with no live battle tower.
    Verified live in-browser against a seeded save covering every rarity/
    slot/tower-type combo — see the GEAR_UI_DESIGN U1 checkbox for the full
    list of what was exercised. Old GEAR panel and its CSS/JS are gone;
    STORE overlay is untouched and still reuses the shared item-row classes
    (U5 restyles it later).
  - **U2 remainder DONE (2026-07-11):** roster name migration (`L-01` →
    `Laser-01`) via a `migrateRosterNames()` pass in `progression.js`
    (mirrors `migrateSkills`), keyed off `rec.type` so it can't confuse
    Railgun/Rocket. New `config.js TOWERS[...].rosterPrefix` field drives it
    plus `towers.js nextRosterName`; the old single-letter `prefix` field is
    kept for the STASH tile's single-glyph corner "lock-dot" (must stay one
    character and non-colliding — the approved mockup's own `lock[0]`
    scheme actually collides Railgun/Rocket on "R"; the shipped code avoids
    that by keeping the dedicated letters). The "-ONLY" text tags (item
    title, item sheet, picker sheet) now show the full type name
    ("RAILGUN-ONLY"), matching the mockup.
  - **U3 DONE (2026-07-11):** menu merge. Deleted the standalone Tower
    Guide overlay (`#tower-overlay` in index.html, its CSS, and the old
    `openTowerGuide` renderer in ui.js) and the separate main-menu GEAR
    button; one **TOWERS** button now opens the gear screen directly and
    carries the `N NEW` badge (pending + unseen stash count). The old
    overlay's TOWER CLASSES and KNOW YOUR ENEMY cheat-sheets were folded
    into the `?` guide sheet (`ui.js guideExtrasHtml()`) so that content
    wasn't lost; its ROSTER listing was dropped as redundant with the
    TOWERS tab's cards. `openTowerGuide` is kept as an exported name
    (main.js's level-2 first-visit hook is unchanged) but now opens the
    gear panel straight into the guide sheet. Locked (sub-★1) towers: the
    footer note is a tap-to-expand toggle (`lockedListOpen`) into a dim
    compact list, each row still opening the full tower stat sheet via
    the existing `openTowerStatSheet`. Verified live in-browser (seeded
    save with an eligible + a locked tower; toggled the list; opened the
    locked tower's stat sheet; confirmed `#tower-overlay` is gone from the
    DOM; confirmed the `?` sheet contains both cheat-sheets; confirmed the
    level-2 auto-open path opens the gear overlay with the guide sheet on
    top). No console errors.
  - **U4 DONE (2026-07-11):** pizzazz pass. New `#drop-reveal` full-screen
    sequence (`ui.js showDropReveal`, markup in index.html, styles in
    styles.css) plays before EVERY end-of-battle overlay (win, campaign
    loss, Endless run-over, forfeit) when the run earned loot — one
    rarity-burst card per item (reusing the mockup's exact burst/card
    keyframes and the shared slot-glyph renderer), tap to advance, calls
    back into the existing `showOverlay(...)` once done (or immediately if
    there's nothing to show). `main.js allPlacements()` combines
    `game.lootResult.placements` with any newly-crossed Endless milestone
    loot. Equip flash: a one-shot `.just-equipped` CSS pulse on the gear
    tile that was just filled (`ui.js equipFlashTarget`, set by both equip
    paths, consumed once by the next `renderTowersTab()`). Singularity
    shimmer (already on every filled Singularity tile since U1) now also
    plays on the drop-reveal card. All three respect
    `prefers-reduced-motion`. Full detail + verification notes in
    `GEAR_UI_DESIGN.md`'s U4 checkbox.
  - **U5 DONE (2026-07-11):** STORE restyle. `#store-overlay` rebuilt on
    the same tile-grid + bottom-sheet components as the TOWERS/STASH
    screen (green accent to stay visually distinct) — 5-wide `#store-grid`
    of `tileHtml(...)` tiles with a Shard-price corner tag, a dedicated
    `#store-sheet-overlay` (own ids, since the gear screen's sheet lives
    inside `#gear-overlay` and can't render while that's hidden) showing
    title/affixes/BUY. No store logic changed (P5's `getStoreStock`/
    `rerollStore`/`buyStoreItem` untouched) — pure restyle, per
    `GEAR_UI_DESIGN.md` §3. Full detail + verification notes in that doc's
    U5 checkbox.
- **CIRCUIT-BOARD MAIN MENU (in progress — M2 shipped, M3 next):** replace
  the level-row list with a per-world neon circuit board (SVG nodes +
  traces), node states readable at a glance (cleared / frontier / locked /
  ∞ pad / milestone tick-ring), tap → bottom-sheet level detail with
  description, endless status, and milestone list. Full phased spec
  (M0–M4, one phase per session, model suggestions included) in
  `CIRCUIT_MENU_DESIGN.md`; approved interactive mockup at
  `mockups/circuit-menu-mockup.html`.
  - **M0 DONE (2026-07-12):** data groundwork, no visible change. Added
    `desc` flavor text to all 15 levels (`levels.js`); `accent`, `accent2`,
    `boardStyle` (`"grid"|"diagonal"|"prism"`), and `nodePos` (5
    `{x,y}` positions in the board's 0–100×130 viewBox, ported from the
    mockup's `LAYOUTS`) added to each `WORLDS` entry; human `label` added
    to each `ENDLESS_REWARDS` milestone (`config.js`) — reward text stays
    derived in ui.js, never hardcoded. Verified via dynamic `import()` in
    the browser console (no level missing `desc`, all three worlds have
    5 `nodePos` entries + board fields, all 5 milestones have labels) plus
    a console-clean page load; menu is visually unchanged as expected.
    Next: **M1** (Opus/Fable recommended) — port the actual SVG board from
    the mockup and wire it to real progression, replacing `renderWorld`'s
    level-row loop.
  - **M1 DONE (2026-07-12):** SVG circuit board replaces the level-row list.
    `ui.js renderWorld` now derives a per-node state array (cleared/frontier/
    locked) from real progression and builds the mockup's board as an SVG
    string into `#level-list`, which switches to a non-scrolling `.board-host`
    frame (still a flex:1 item between the world nav and the pinned footer).
    New module helpers ported from the mockup: `boardDecoTraces`
    (grid/diagonal/prism per world), `boardConnector`, `boardTickRing`
    (cleared nodes only; gap tightens past 10 ticks so a 20-track fits),
    `buildBoardSvg`. Cleared nodes show a milestone tick-ring (gold =
    claimed) + an ∞ pad (hot-pink once `endlessBest>0`, else dim accent2);
    frontier = pulsing hollow ring; locked = dashed 🔒 ring with NO hit
    target. A locked world renders every node locked + the unlock banner
    overlaid (`.world-locked-note.board-note`, absolute). Invisible hit
    targets are painted LAST so taps always land: node → `pick(level,false)`,
    ∞ pad → `pick(level,true)`. The old `.level-row`/`.endless-button` CSS is
    now unused but left in place. World paging/swipe, `#menu-actions` footer,
    and `appendGlobalMenuButtons` are unchanged. `trace-flow`/`frontier-pulse`
    animations respect `prefers-reduced-motion`. Verified live (mobile
    viewport, seeded save across all three worlds): all node states render,
    tick-ring lit-segment count matches claimed milestones, campaign + endless
    both launch from taps, footer stays pinned, skill tree still opens on top
    (z40>z30), no console errors. (Browser-pane screenshots timed out at the
    harness level, so verification was DOM-query based, not eyeballed pixels.)
  - **M2 DONE (2026-07-12):** level-detail bottom sheet. New
    `#level-sheet-overlay`/`#level-sheet` inside `#level-overlay` (same
    sheet positioning/animation pattern as the gear/store sheets — own ids
    so it can't fight them). Every board tap — including locked nodes,
    which needed a hit target for the first time — now opens the sheet
    instead of launching straight into battle: title in world accent,
    `LEVEL n — WORLD` tag, `desc`, status chips (cleared/frontier/locked,
    ∞ Endless state, gold ★ milestone count), full milestone list (tick +
    label + reward, `.done` gold), PLAY/ENDLESS buttons. New
    `milestoneRewardText(reward)` (ui.js) derives the reward string from
    `reward.kind`/`amount`/`rarity` instead of hardcoding it, so the
    sheet is ready for a future 20-milestone track (M4) with no changes.
    Locked nodes show why via `nd.lockReason` (computed in `renderWorld`:
    distinguishes "clear the previous level" within an unlocked world from
    "clear all of \<world\>" for a fully locked world). Veil tap and
    world-swipe/arrow nav both close the sheet so a stale one never lingers
    behind a different world's board. Verified live via DOM/event dispatch
    against a seeded save (screenshots still time out at the harness level,
    same as M1): cleared/frontier/locked-in-unlocked-world/locked-world
    sheets all showed correct content and button enablement, veil-tap
    closed the sheet, PLAY and ENDLESS both launched the right mode
    (`game.level.id`, `game.endless`) — no console errors.
    Next: **M3** (Opus) — pizzazz (traveling energy pulse, entry flourish)
    + an iPhone perf pass on the SVG glow filters.
- **PLAYTEST-PENDING:** the counter re-tune + visible feedback + Rocket +
  World 3 all shipped but the difficulty is calibrated only by bot sims
  (superhuman placement → flawless bot wins are a WEAK signal). The user's
  iPhone playtest is the real instrument — expect a follow-up tuning pass,
  especially "do the counters make me switch towers?" and per-level
  too-easy/too-hard on L2/L4/L5 (he'd flagged those) and all of W3.
- If counters still don't drive combo choices, next levers: harsher
  resist multipliers and/or waves that hard-require a specific tower.
- Retune Endless mode's difficulty ramp (`config.js ENDLESS`) — it uses
  the level's authored final wave as a seed, so the harder re-tuned waves
  feed into it; worth a fresh look.
- Ideas floated but unscheduled: save export/import (iOS Safari evicts
  localStorage after ~7 days unused), sound, more towers (Tesla
  chain-lightning was the runner-up), pre-battle loadouts.
