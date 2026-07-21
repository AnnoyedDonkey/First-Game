# Geometric TD — Developer Handoff

Read this first when working on the project. Historical release detail lives
in `docs/archive/HANDOFF_HISTORY_2026-07.md`; the original pre-cleanup
handoff is preserved in Git at commit `2650204`.

## Current state — 2026-07-21

Geometric TD is a portrait, mobile-browser tower defense with a 15-level,
three-world campaign; five tower classes; seven enemy types; RPG roster and
mastery progression; skills; loot/equipment; campaign challenges; Endless;
telemetry; and a GitHub Pages deployment.

The current deployed build is `2026.07.21-5`. Baseline was the deliberately
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

**World 3 (L11-L15) still carries the full H1-H4 hardening on the original wave
curves, but the `2026.07.19-9` telemetry round rated all five levels `too_easy`**
(L15 a flawless clear) — the hardening is not translating into felt difficulty
now that the roster/economy sit where they do. A first World 3 pass shipped in
`2026.07.21-1` (moderate economy + pacing; watch L13); confirm the effect by
comparing telemetry by `app_version` before deciding whether it needs more.

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
src/balance-data.json Balance Lab: canonical editable gameplay data (schema v1)
src/balance-data.js Balance Lab: generated synchronous re-export of canonical JSON
src/balance-schema.js Balance Lab: data validation, versioning, migrate/deepClone
src/levels.js       LEVELS/WORLDS re-exports (merges balance-data + presentation: names, palettes, nodePos)
balance-history/    Balance Lab: immutable revision snapshots + manifest.json (git-tracked, append-only)
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
- **NEXT — World 3 pass:** the `2026.07.19-9` round rates L11-L15 all
  `too_easy` (see Current state). Retune World 3 into a real campaign finale.
  Compare ratings, core/leaks, remaining money, and tower composition by
  `app_version` after the pass.
- **DEFERRED — Endless:** retune its ramp after campaign balance stabilizes.
- **DEFERRED:** save export/import for iOS localStorage eviction; sound;
  additional tower classes (Tesla was the runner-up); pre-battle loadouts.

## Related documents

- `BALANCE_LAB_USAGE.md` — local editing, testing, restore, and manual Git
  workflow.

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
