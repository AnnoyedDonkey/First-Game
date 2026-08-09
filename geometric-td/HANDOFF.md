# Geometric TD — Developer Handoff

Read this first when working on the project. Historical release detail lives
in `docs/archive/HANDOFF_HISTORY_2026-07.md`; the original pre-cleanup
handoff is preserved in Git at commit `2650204`.

## Current state — 2026-08-09

The current deployed build is `2026.08.09-4`. Stash management got two new
Shard sinks: **stash expansion** (base 100 slots, 10 escalating purchases
of +20 slots each, 50→4000 Shards, caps at 300 — `config.js LOOT.stash`,
`progression.js getStashCap/buyStashUpgrade`) and **auto-junk** (4
sequential per-rarity tiers — Common 500 / Enhanced 750 / Rare 1000 /
Prismatic 1500 Shards; Singularity is never junkable — `config.js
LOOT.autoJunk`, `progression.js autoJunkMaxRarity/buyAutoJunkTier`).
Ownership and activation are separate (`-4`, player-requested): a
purchased tier is permanent, but a `PAUSE`/`RESUME` toggle in the STASH
SETTINGS sheet (`progression.js isAutoJunkEnabled/setAutoJunkEnabled`, new
save field `autoJunkEnabled`) can switch it off without losing the
purchase — e.g. to hoard Commons for a build without re-buying the tier
later. `autoJunkMaxRarity()` (what `bankEarnedItem` actually checks)
returns `null` while paused; `ownedAutoJunkRarity()` is the separate
always-true getter the settings sheet displays so "paused" doesn't read
as "never bought". Once a tier is owned AND active, loot EARNED in play
(kill drops, the guaranteed end-drop, Endless milestones — not store
buys) at or below that rarity auto-sells
for Shards instead of taking a stash/triage slot, checked in
`bankEarnedItem` *after* the existing auto-equip attempt fails (so a
still-useful Common can equip before the junk check ever sees it). New
placement dest `"junked"` flows through the drop-reveal card ("→
AUTO-SOLD ◆n") and the results-screen loot tile (a dimmed `.junked-tile`
with the sold value as its corner tag, reusing the Store's price-tag
styling). New save fields `stashUpgrades`/`autoJunkTier`/`autoJunkEnabled`
(save.js default + progression.js backfill, standard pattern).

The STASH tab's controls went through two rounds of phone feedback before
landing on the current design (`ui.js renderStashTab`, `.gear-mini-action`
in `styles.css`): a row of three equal, distinctly-colored pill buttons —
**FILTER** (cyan), **SELL** (yellow), **CONFIG** (magenta) — sits right
below the item count.
- `-1`'s first pass put the settings entry point behind a bare 26px
  outline `⚙` icon next to the `?` guide; it read as invisible against the
  neon UI on an actual phone. `-2` moved it to a tappable `STASH n/cap`
  text link in the header. `-3` replaced both with the explicit **CONFIG**
  button (`openStashSettingsSheet`) — the header text is plain again.
- `-1` also shipped bulk-sell as an always-visible row of per-rarity
  "SELL X (n)" pills, which was itself the space complaint (1-2 full rows
  above the grid, another in triage). `-2` collapsed it into one
  `.gear-mini-action` "SELL ▾" trigger opening a compact sheet
  (`openBulkSellSheet` — reuses the bottom-sheet pattern;
  `sellAllStashRarity`/`sellAllPendingRarity` unchanged underneath); `-3`
  kept this as-is, just restyled to match FILTER/CONFIG.
- The pre-existing OPTIC/EMITTER/.../SINGULARITY filter chips (9 total)
  are now **hidden by default** behind the **FILTER** button
  (`gearFiltersOpen` module state, reset on panel open) instead of always
  showing. `-2` had tried a horizontally-scrolling single row to save
  space, but a scroll-to-reveal row silently hides chips off-screen with
  no signal more exist — most players won't discover it. `-3` shows ALL
  chips, wrapped across as many rows as needed, only once FILTER is
  tapped; the button's label shows an active-filter count
  (`FILTER (1) ▾`/`▴`) so it stays legible even while collapsed.

Both Shard sinks — **stash expansion** (base 100 slots, 10 escalating
purchases of +20 slots each, 50→4000 Shards, caps at 300 —
`config.js LOOT.stash`, `progression.js getStashCap/buyStashUpgrade`) and
**auto-junk** (4 sequential per-rarity tiers — Common 500 / Enhanced 750 /
Rare 1000 / Prismatic 1500 Shards; Singularity is never junkable —
`config.js LOOT.autoJunk`, `progression.js autoJunkMaxRarity/
buyAutoJunkTier`) — are unchanged since `-1`. Once a tier is owned, loot
EARNED in play (kill drops, the guaranteed end-drop, Endless milestones —
not store buys) at or below that rarity auto-sells for Shards instead of
taking a stash/triage slot, checked in `bankEarnedItem` *after* the
existing auto-equip attempt fails (so a still-useful Common can equip
before the junk check ever sees it). New placement dest `"junked"` flows
through the drop-reveal card ("→ AUTO-SOLD ◆n") and the results-screen
loot tile (a dimmed `.junked-tile` with the sold value as its corner tag,
reusing the Store's price-tag styling). New save fields
`stashUpgrades`/`autoJunkTier` (save.js default + progression.js
backfill, standard pattern).

Verified via seeded-save console testing (dynamic `import()` of
`progression.js`/`ui.js`) covering both purchase ladders, the
junk-vs-stash fallback with an empty roster, and live DOM clicks/computed-
style checks at a 375px mobile viewport: FILTER/SELL/CONFIG render in
three distinct high-contrast colors, the filter row is genuinely hidden
until toggled and shows every chip wrapped (not scrolled) once open, and
the active-filter count survives collapsing the row — no console errors.

The campaign is now **four worlds / 20 levels** — World 4 (SINGULARITY,
`level_016`–`level_020`) shipped
across builds `2026.08.08-1`..`-18`. World 4's identity is **one spotlight
tower per level** (L16 Laser, L17 Slow, L18 Pulse, L19 Railgun, L20 Rocket),
achieved through map geometry + a resist-matched enemy roster (see
`WORLD_4_PLAN.md` for the original design; several levels have since diverged).
Adding a world needs no code: `WORLDS` unlock automatically when the previous
world's levels are all completed; `balance-schema.js KNOWN_LEVEL_IDS` was
extended to 20; Endless uses `defaultTrack`.

### New data-driven special-tile mechanics (World 4)
Three optional per-level features, all validated in `balance-schema.js`,
carried through `levels.js buildLevel`, resolved in `grid.js`, rendered in
`renderer.js`, tunable in `config.js VFX.*`, and explained by tapping the tile
(`ui.js maybeShowTileInfo`, reuses the milestone-toast). Data shapes:

- **Wormholes** — `wormholes: [{enter:{x,y}, exit:{x,y}, types?:[enemyId]}]`.
  Teleport an enemy from `enter` to `exit` along the path (both tiles on the
  path; forward only, exit path-distance > enter). Optional `types` filter =
  only those enemy types warp (others walk through, which is what makes the
  track between the portals meaningful); the portal is tinted to the filtered
  enemy's color. Code: `grid.wormholes`, `enemies.js updateEnemies` (teleport +
  once-per-enemy guard), `renderer.js drawWormholes`, `config VFX.wormhole`.
- **Fields** — `fields: [{tiles:[{x,y}...], speedMult?, damageMult?}]` (tiles on
  path). `speedMult` scales movement (>1 speed pad, <1 tar); `damageMult`
  scales damage taken (>1 weak zone, <1 shield). Code: `grid.fieldAt/fieldTiles`,
  `enemies.js` (movement + `damageEnemy`), `renderer.js drawFields`,
  `config VFX.field`.
- **Conduits** — `conduits: [{tiles:[{x,y}...], damageMult?, rangeMult?,
  fireRateMult?, pierceBonus?}]` on BUILDABLE tiles. A tower placed there gains
  the multipliers; applied at the END of `towers.js recomputeStats`
  (idempotent). `pierceBonus` (+N pierce) benefits line-piercers (Railgun/Laser)
  — a huge force-multiplier on funnel geometry. Code: `grid.conduitAt/
  conduitTiles`, `renderer.js drawConduits`, `config VFX.conduit`.

### L19 "The Coil" (formerly "Rail Yard")
Rebuilt as a **bullseye spiral**: a truncated space-filling inward spiral
leaves only a central 7-tile turret platform by the core (no blocked tiles
needed — the spiral fills everything else). A Railgun on the central **Rail
Amplifier** conduit fires outward and pierces across multiple spiral arms —
the railgun's line-pierce as the whole level's identity. Enemies are a rail-
weak **onslaught** (per-wave counts 60–370; peak ~370 concurrent, chosen off a
perf sweep — see below); three color-filtered wormholes (armored/regen/fast)
scatter the tidy files so pierce can't stack. Heavily balance-iterated
(HP up to ~23M) and still tuning.

### Tower power scaling — IMPORTANT (2026-08-08 investigation)
The in-battle tower **level caps at 10** (base 5, extendable to 10); it resets
to 1 each battle and you PAY to upgrade. In `towers.js recomputeStats` the MAIN
damage/fireRate growth uses the **in-battle level** (so `damageGrowth 0.35` is
raised to ^≤9, never ^49); the SPECIALTY growth uses career `maxUnlockedLevel`;
mastery (★) is a banked-XP rank. A fully-maxed tower is **~2,300 (un-geared) to
~7,000 (geared) DPS** — NOT the "billions" an earlier miscalc suggested. So the
progression curve is fine; "World 4 is too easy for a maxed roster" is ordinary
over-tuning + geometry (pierce on a funnel). **Perf ceiling:** ~300–400
concurrent enemies is the playable mobile target (desktop handles ~800 at
~13ms; iPhone is ~5× slower). Raising HP via `healthMult` costs nothing
(same counts); raising enemy *count* is the perf lever.

### Ops: leaderboard + telemetry
Both hit ONE Supabase project (`config.js` LEADERBOARD/FEEDBACK). It's free-
tier and **auto-pauses after ~7 idle days**, which surfaces in-game as
"Couldn't reach the leaderboard" and silently kills telemetry. Fix = restore
the project (Supabase dashboard, or MCP `restore_project`); ~5 min, no code
change. Data survives the pause. First hit + restored 2026-08-08.

## Prior state — 2026-07-23

Geometric TD is a portrait, mobile-browser tower defense with a (then) 15-level,
three-world campaign; five tower classes; seven enemy types; RPG roster and
mastery progression; skills; loot/equipment; campaign challenges; Endless;
telemetry; and a GitHub Pages deployment.

The current deployed build is `2026.07.23-5`. Builds `2026.07.23-1` through
`-5` gave every tower a third skill-tree branch and reworked the tree's box
art. `TOWER_THIRD_BRANCH` (`config.js`) is now a small data table covering
all five towers instead of one-off Railgun-only code: Over-Penetration
(Railgun, pre-existing), Slow Potency (+% slow amount, `slow_dmg` chain
above it still separately covers +% slow *duration*), Rapid Fire (Laser,
+% fire rate), Blast Radius (Pulse) and Payload Yield (Rocket) — the latter
two both raise splash radius but through independent multipliers gated by
`tower.type`, so investing in one never affects the other even though both
towers share the `def.splashRadius` code path in `towers.js`. Each perk is a
one-line `getXMult()` in `progression.js`. Separately, every box in the tree
now renders a themed icon (`skillIconBody` in `ui.js`) instead of falling
back to plain percentage/level text for chain boxes: all non-Slow damage
chains share one 8-ray burst icon (`damage`), Slow's duration chain and the
four non-Pulse third-branch perks (Rapid Fire/Slow Potency/Over-Penetration/
Payload Yield) each got a bespoke icon (`haste`/`potency`/`overpen`/`yield`/
`duration`); the value text moved to a small tag inside the box's bottom
edge instead of replacing the icon outright.

Builds `2026.07.21-8` through `-10`
added player-facing gear/skill quality-of-life: equipped gear can now be
replaced through the existing compatible-picker + COMPARE flow; gear traits
have tappable descriptions; the Store sells permanent Skill Points on a
50/100/+100-to-1000 Shard curve; skill-tree branch heads are free (previously
purchased heads are refunded once); five-box branch costs are now 1/1/1/2/2;
and Railgun Over-Penetration is a five-box third branch under its head. Slow
tower career sheets now also show computed Slow Amount and Slow Duration. The
Skill Point purchase count is save-backed at `store.skillPointPurchases` with
both a `save.js` default and `progression.js` backfill.

Baseline was the deliberately
aggressive H1-H4 hard-mode pass (`2650204`, `2026.07.17-1`): a Pulse nerf plus
World 1-3 wave and economy hardening. Player feedback then reported the campaign
was too hard, so difficulty was walked back world by world:
- **World 1** softened in two steps — `2026.07.18-1` (Level 2 via the Balance
  Lab) and `2026.07.19-1` (Levels 3-5, `healthMult` only). L3 fixed a severe
  overshoot (total wave HP 274k→38k) and L4/L5 were pulled down so World 1 now
  ramps smoothly (~20k/34k/38k/54k/83k across L1-L5).
- **World 2** rescaled next (`2026.07.19-3` through `-9`, commits for L6-L10):
  full wave-curve rebalances plus economy and regenerator-intro fixes. Latest
  telemetry confirms this landed — L9/L10 now rate `just_right`.

World 3 has now had two balance passes. The first (`2026.07.21-1`, moderate
economy + pacing) landed **L13 at `just_right`** (confirmed in the `-6`
telemetry round). The second pass shipped in **`2026.07.21-7`** targeting what
`-6` telemetry still showed: L11 and L15 rated `too_easy` (L15 a flawless
0-leak clear banking 740), while L12 and L14 walled players on **waves 1-2 only**
(losses died wc0/wc1 in <100s, then the same player cleared all 10 waves).
The `-7` pass, done via `balance-data.json`:
- **L11** — back half (waves 6-10) HP raised ~+10% weighted; openers untouched.
- **L12 / L14** — waves 1-2 softened ~33% (opener survivability); waves 3-10
  left exactly as-is.
- **L13** — deliberately untouched (it's the success of the first pass).
- **L15** — hardened ~+21% weighted with more bodies from wave 5 on, and the
  12-wave finale turned into a real gauntlet (6 bosses + heavier
  armored/regen/fast). `bountyMult` unchanged (0.52).
Confirm the effect by comparing `-7` telemetry by `app_version`; watch that the
L12/L14 openers are no longer brick walls and that L15 now costs core.

Builds `2026.07.21-2` through `-5` were player-facing UI/UX fixes, no balance
change: first-play tutorial polish (banner no longer overlaps SKIP TUTORIAL;
placement no longer flashes past the blocked-tile step; instructions + skip
now render above the spotlight's dimming veil instead of behind it), the
TOWERS & GEAR GUIDE reworded from a wall of text into short lines and made
mouse-wheel scrollable, and the skill tree now opens scrolled to the leftmost
(Laser) branch instead of the middle. Tutorial state machine lives in
`src/tutorial.js`; its copy + enable switch in `config.js` `TUTORIAL`;
overlay layering in `styles.css` (`#tutorial-*`) and `src/ui.js`.

The in-progress next build is the local-first Balance Lab. Read
`BALANCE_LAB_PLAN.md`; phases L0-L7 define the data migration, local save API,
editing UI, revision history, and QA. **L0 (schema contract), L1 (config-side
data migration), L2 (campaign/levels/waves/worlds migration), L3 (local
persistence API), L4 (read-only Lab shell), L5 (editable controls &
validation UX), L6 (revision history & Git-friendly workflow), and L7 (QA, handoff, and phone readiness) are complete
and verified** — see `BALANCE_LAB_L0.md` and the L1–L6 plan files. All editable gameplay data now lives canonically in
`src/balance-data.json`; `src/balance-data.js` is its generated synchronous game
import, and `src/balance-schema.js` remains the authoritative semantic
validator. The localhost-only API in `serve.ps1` reads, structurally validates,
atomically saves, and append-only restores named revisions in
`balance-history/`. All Balance Lab work remains local-only tooling: no
player-facing change, no `version.js` bump, nothing committed or pushed. The
Lab lives at `balance-lab.html` (open via `http://localhost:PORT/
balance-lab.html`; not linked from the player menu) and is now a working editor:
typed inputs → validated draft → `POST /api/balance/save`. The Balance Lab (L0-L7) is **complete and verified**; the only remaining step is a deliberate manual commit. Deferred follow-ups live in `BALANCE_LAB_PLAN.md`.

## Non-negotiable constraints

**Balance Lab status:** complete through L7. The local Lab is ready for the
non-developer edit → save-with-note → local test → Restore → manual Git review
workflow. `BALANCE_LAB_USAGE.md` is the task guide; its history starts from the
single clean L2 baseline. The deferred `serve.ps1 -LabLan` path is documented
only, not implemented.

- Plain HTML5, Canvas 2D, vanilla JS ES modules; no framework, build system,
  TypeScript, or dependencies.
- Target iPhone Safari in portrait and touch-first; mouse must work too.
- Keep gameplay values data-driven. Editable numbers now live canonically in
  `src/balance-data.json`; generated `src/balance-data.js` keeps synchronous
  game imports and `src/balance-schema.js` provides semantic validation.
  `config.js`/`levels.js` re-export data merged with presentation fields, so
  their public exports remain unchanged.
- Preserve localStorage saves. New save fields require a `save.js` default and
  a post-`loadSave()` backfill in `progression.js`.
- Keep the game runnable after each change.

## Run, test, and deploy

- Local server: run `./serve.ps1`, then open `http://localhost:8420`.
  ES modules do not run correctly from `file://`.
- Repository root is one folder above; this folder is `geometric-td/`. The
  canonical working checkout is `C:\Projects\First-Game` (outside iCloud).
  GitHub Pages deploys `main` from
  `https://github.com/AnnoyedDonkey/First-Game`.
- Bump `src/version.js` for every player-facing push. The update nudge uses
  this stamp. Do not bump it for local-only Balance Lab tooling.
- GitHub CDN edges may briefly mix old/new modules after a push. For any new
  save field, do not rely only on `save.js` defaults; backfill it after
  `loadSave()` as well. Ask the player to hard-refresh or wait before calling
  a just-deployed report a real regression.
- Before a balance deploy, inspect the diff, commit deliberately, and push.
  Balance Lab must never auto-commit or auto-push.

## File map

```
index.html          player page shell and overlays
styles.css          player UI styles
balance-lab.html/.css local Balance Lab page and responsive styles
src/balance-lab.js  Balance Lab editor, validation UX, history, and workflow help
src/config.js       gameplay tuning re-exports (merges balance-data + presentation), skills, loot, VFX, telemetry config
src/balance-data.json Balance Lab: canonical editable gameplay data (schema v1); per-level wormholes/fields/conduits live here
src/balance-data.js Balance Lab: generated synchronous re-export of canonical JSON
src/balance-schema.js Balance Lab: data validation, versioning, migrate/deepClone
src/levels.js       LEVELS/WORLDS re-exports (merges balance-data + presentation: names, palettes, nodePos)
balance-history/    Balance Lab: immutable revision snapshots + manifest.json (git-tracked, append-only)
src/grid.js         tile math, path expansion, placement; wormhole/field/conduit lookups
src/game.js         battle state, waves, money, core, win/loss
src/towers.js       placement, targeting, firing, upgrades, roster use
src/enemies.js      movement, damage/death, bounty, XP, shards, status effects
src/projectiles.js  projectiles and transient combat effects
src/renderer.js     Canvas rendering and visual constants
src/progression.js  persistent roster, skills, shards, migration/backfills
src/equipment.js    equipped-item stat aggregation and mastery helpers
src/loot.js         item generation
src/endless.js      deterministic Endless generation
src/milestones.js   campaign challenge evaluation
src/tutorial.js     first-play tutorial state machine
src/ui.js           player DOM UI and overlays
src/feedback.js     Supabase run telemetry and difficulty rating
src/leaderboard.js  Supabase Endless board
src/save.js          localStorage schema/read/write/reset
src/version.js       deployed build stamp
src/update.js        home-screen update nudge
serve.ps1            local static server + localhost-only Balance Lab API
BALANCE_LAB_PLAN.md  approved Balance Lab L0-L7 plan
```

## Current gameplay rules and tuning locations

- `balance-data.json`: editable tower/enemy stats, upgrade curves, economy,
  skills, Endless, level metadata, wave groups, maps, worlds, starting money,
  and bounty multipliers. `config.js`/`levels.js` retain presentation and merge
  the generated `BALANCE` import into their stable public exports.
- Wave 1 must be survivable with its level's starting money. Do not make a
  level hard by breaking its opener.
- XP makes a tower eligible to level; money pays for it. Veteran towers can
  repurchase unlocked levels. Mastery comes from XP beyond the level cap.
- Kills split XP among all contributors; final-hit kill count remains singular.
  Slow also contributes XP and applies a 30% vulnerability debuff.
- Damage counters use `ENEMIES[type].damageMult` keyed by tower damage type.
  Resists/weaknesses have visible feedback and are a primary combo-design tool.
- Railgun unlocks after L5; Rocket unlocks after L10. Railgun rewards lane
  placement; Rocket has global range and expensive scaling.
- Late-world bounty multipliers are an economy-pressure tool. Prefer them or
  encounter composition before adding uninteresting boss-health sponges.
- Endless begins after authored waves and uses deterministic generation.

## Balance philosophy and verification

- Target: L1-2 beatable fresh with good play; later levels reward veteran
  roster growth and changing tactics. The enjoyed shape is lose, improve, win.
- A bot loss is a strong signal; a bot win is weak. Treat simulation results
  as evidence, not proof of human experience.
- Debug helpers: `window.game`, `step(seconds)`, and `checkEndState()`.
  Use module APIs for automated placement rather than pointer simulation.
- Reload the page before **every** isolated balance simulation and every
  threshold-search trial. Roster XP, module globals, and battle-end recording
  can contaminate later tests in one session.
- Never wipe the real save. Back it up and restore it byte-for-byte if testing
  needs a seeded profile.
- Do not capture/export canvas images for verification. Assert on game state,
  DOM, logic-level facts, and console cleanliness; visual review belongs on
  iPhone.
- Only if working from an iCloud-synced checkout (legacy; avoid — iCloud has
  corrupted `.git` internals before): sweep for sync-conflict filenames with a
  ` 2` suffix before committing, including inside `.git` itself. The
  `C:\Projects\First-Game` checkout is not affected.

## Rendering and UI guardrails

- Use pre-rendered glow sprites and the additive `lighter` pass. Never add
  per-particle `shadowBlur`; it harms mobile Safari performance.
- Per-level palettes override renderer look values. Enemy/tower colors are
  deliberately stable.
- Keep skill tree above lower overlays (z-index bug history). New nested flex
  rows in the bottom action bar need `min-width: 0`, or the wave button can be
  pushed off-screen.
- Respect `prefers-reduced-motion`; avoid perpetual expensive SVG filters.

## User preferences

- Propose a plan before large builds; make small, runnable increments.
- Expose tunable variables and explain where they live.
- Visual direction is dramatic neon “pizzazz,” but report visual verification
  honestly.
- Treat player bug reports as accurate until disproved.
- Push verified player-facing features so the iPhone build can be tested.
- Balance Lab: local PC first, responsive for later home-LAN phone use;
  gameplay dynamics only initially; validated data and named revision history;
  no source-text rewrite, automatic Git commit, or automatic push.

## Active and deferred work

Balance Lab L0-L7 is complete; the legacy phase-by-phase entry below is retained
for historical detail and its "L4 next" wording is superseded by this status.

- **DONE - Balance Lab (L0-L7):** `BALANCE_LAB_PLAN.md`. All phases complete and verified: data/schema migration, the localhost-only save/restore API in `serve.ps1`, the editable `balance-lab.html` with revision history, and L7 QA/docs. Per-phase execution plans (L1-L7) and the L0-L2 migration probes/baselines are archived in `docs/archive/balance-lab/`. History is a single clean baseline; no player-facing change and nothing committed. Remaining step: a deliberate manual commit (workflow in `BALANCE_LAB_USAGE.md`).
- **WATCH — World 3 (second pass shipped `2026.07.21-7`):** L11/L15 hardened,
  L12/L14 openers softened, L13 untouched (see Current state). Confirm with `-7`
  telemetry: compare ratings, core/leaks, remaining money, and composition by
  `app_version`. Open questions the `-6` sample raised but this pass did not
  address — World 2 front (L6/L7 read `too_easy`) and L4 (1W/4L, rated
  `too_hard`); revisit once `-7` W3 data lands.
- **DONE — World 4 (SINGULARITY, L16-20):** shipped `2026.08.08-1`..`-18` with
  three new special-tile mechanics (wormholes/fields/conduits) and the L19
  "The Coil" spiral. See Current state above and `WORLD_4_PLAN.md`.
- **WATCH — World 4 balance is not settled.** A strong/maxed roster still
  clears heavily-tuned levels (e.g. L19 beaten with 3 towers before the ×8 HP
  pass). This is a *ceiling* problem, not a broken curve (see "Tower power
  scaling" above): roster power ranges ~10× from a modest to a fully-maxed
  7-tower platform, so a level can't challenge the max without walling
  everyone else. Iterate via phone feedback; HP is a free lever (perf-wise),
  enemy count is not. No telemetry yet for W4 — watch the first rounds.
- **DEFERRED — Endless:** retune its ramp after campaign balance stabilizes.
- **DEFERRED:** save export/import for iOS localStorage eviction; sound;
  additional tower classes (Tesla was the runner-up); pre-battle loadouts;
  a durable cache-buster (`?v=APP_VERSION` on module imports) to end the
  stale-module-after-deploy confusion on iOS.

## Related documents

- `BALANCE_LAB_USAGE.md` — local editing, testing, restore, and manual Git
  workflow.

- `WORLD_4_PLAN.md` — World 4 (SINGULARITY) design + original maps/waves
  (several levels have since diverged in balance passes; L19 fully redesigned).
- `GAME_BRIEF.md` — original feature specification.
- `LOOT_DESIGN.md` / `GEAR_UI_DESIGN.md` — loot and equipment design/history.
- `CIRCUIT_MENU_DESIGN.md` — menu-board design/history.
- `SUPABASE_SETUP.md` — telemetry and leaderboard database setup.
- `BALANCE_LAB_PLAN.md` — approved Balance Lab architecture and phases.
- `BALANCE_LAB_L0.md` — L0 schema contract: value inventory, data-home paths,
  validation rules (verified data shape: 15 levels / 159 waves / 313 groups).
- `docs/archive/balance-lab/`: per-phase execution plans (L1-L7) plus the L0-L2 migration probes and baselines (Balance Lab build history).
- `docs/archive/HANDOFF_HISTORY_2026-07.md` — condensed completed-work and
  balance history; Git commit `2650204` retains the full former handoff.
