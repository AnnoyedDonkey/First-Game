# Geometric TD — Developer Handoff

Read this first when working on the project. Completed-work and build-by-build
changelog detail lives in `docs/archive/HANDOFF_HISTORY_2026-07.md` (now covers
July **and** August 2026); the original pre-cleanup handoff is preserved in Git
at commit `2650204`. This file keeps only what you need to start work:
current state, non-obvious mechanics, rules, tuning locations, and the file map.

## Current state — 2026-08-10

Deployed build: `2026.08.10-11`. Also recently shipped (details in the
archive): Shard-sink **stash economy** (stash expansion + per-rarity
auto-junk, `config.js LOOT.stash`/`LOOT.autoJunk`); **STASH tab controls**
(FILTER/SELL/CONFIG pill row, `ui.js renderStashTab`); **game-wide contrast**
(`styles.css --text-dim` brightened to ~11:1).

### Narrative & onboarding system (new, 2026.08.09-1 .. 2026.08.10-7)
A full story layer was designed and built this pass: **Indy-7** (the snarky
obsolete AI Core you defend) vs **Bratwurst-XL** (the efficiency-obsessed AI
that wants it deleted). Full premise, arc, and per-level script live in
**`NARRATIVE_DESIGN.md`** — read that first for any narrative work; this is
just the map of what exists in code.

- **First-load onboarding** — welcome/name-entry/3 story cards
  (`src/onboarding.js` `playCards` state machine, `#story-overlay` in
  `index.html`, rendered by `ui.js renderOnboardingCard`). Player name
  (`playerName` save field) substitutes into copy everywhere via
  `ui.js substituteName`/`storyCardHtml`, surfaces as a home-screen greeting,
  and prefills the leaderboard nickname. Replayable via a REPLAY INTRO menu
  button.
- **Per-level story beats** — a pre-battle START card and a post-win overlay
  narrative, first-play-only, data in `config.js NARRATIVE.beats` (keyed
  `level_NNN: {start, win}`). World-end levels (5/10/15/20) interleave an
  Indy-7 ↔ Bratwurst-XL exchange. Gating: `narrativeSeen` save field +
  `progression.js shouldShowBeat`/`markBeatSeen`; existing players are spared
  retroactive story via `backfillNarrativeSeen` (marks already-completed
  levels seen). A ▶ STORY button on the level-detail sheet replays any
  level's beats on demand without touching seen-state.
- **In-battle barks** — a non-blocking ticker (`#bark-ticker`, always
  `pointer-events:none`, pinned under the top HUD — NOT the old mid-screen
  `#milestone-toast`, which got reverted for blocking tower placement) shows
  boss-arrival Bratwurst-XL/Indy-7 banter (once per level's first play,
  `${levelId}.boss` beat) and tower placement one-liners (once ever per tower
  type, `seenTowerBarks`). A **STORY BANTER ON/OFF** menu toggle
  (`barksEnabled` save field) silences all of it. `ui.js showBark(speaker,
  text)` — `speaker` is a string code (`"indy"`/`"bratwurst"`, class-colored)
  or a `{name,color}` object (a tower, inline-tinted).
- **Enemy-type intros** (first-ever appearance of Basic/Fast/Armored/Boss/
  Splitter/Regenerator) are **pause-and-tap story cards**, NOT ticker barks
  (`2026.08.10-8`/`-9`, `ONBOARDING_ENEMY_INTROS_PLAN.md`): `main.js
  updateBarks` queues the frame's new types as one `onboarding.playCards`
  sequence, and `frame()` zeroes dt while `isOnboardingActive()` — the same
  freeze the tutorial's freeze steps use, so mid-battle pause/resume can't
  jump. The copy carries an explicit "Weak to X. Resists Y." tag (sourced
  from `ENEMIES[type].damageMult` — re-derive it if that balance data
  changes), colored via `hl-weak`/`hl-resist`. Cards win the frame over
  ticker barks: a boss's banter defers until its intro card is dismissed.
  Still gated by the one STORY BANTER toggle. Card anatomy, all tunable in
  `config.js NARRATIVE.enemyIntro`, nothing hardcoded in ui/main:
  - `delay` — grace period after the type first appears before the card
    interrupts (per battle in `barkState.introSpottedAt`), so the player
    sees the enemy before being told about it.
  - `#story-spotlight` — a cutout in the veil over the live enemies
    (`ui.js enemySpotlightBox`, `spotlightPadTiles`/`spotlightMinTiles`),
    repositioned every frame by `updateStoryOverlay(game)` from `frame()`.
    The card takes the roomier side and is height-capped to that gap; do
    NOT simplify that to "put the card on the other side", which breaks for
    enemies near mid-screen (see the plan file).
  - `#story-enemy-parade` — `paradeCount` copies of the enemy marching
    across a dashed track (`marchSeconds`), tinted to its own color, sized
    by `glyphTilePx`. The glyphs are NOT decorative lookalikes: `ui.js
    enemyGlyphSvg` draws in a one-tile viewBox using `SHAPE_SIDES` and
    `renderer.js`'s exported `ENEMY_LOOK` (lineWidth/glowBlur/spinPerPx),
    so stroke, tile-relative size, and spin rate are the renderer's own.
    Change enemy look in `ENEMY_LOOK` and both follow; don't re-hardcode.
- **Character avatars** — Indy-7 (spinning green hexagon, the Core's own
  shape) and Bratwurst-XL (counter-rotating yellow squares, the spawn
  portal's shape) as inline SVG, line-stroke eyes that change by mood
  (`ui.js speakerAvatarSvg`/`avatarEye`), shown beside the speaker name on
  story cards, the tutorial card, and world-end overlay beats. Speaker names
  are unified green (Indy)/yellow (Bratwurst) via `--indy-color`/
  `--brat-color` tokens on 5 specific `hl-indy`/`hl-villain` rule-pairs — all
  other `--neon-cyan`/`--neon-red` UI is untouched.
- **"Meet the Squad"** replaced the old level-2 auto-opened gear-panel/rules
  wall (`main.js startLevel`, `NARRATIVE.squad` cards) — new players get an
  Indy-7-narrated intro to Laser/Pulse/Slow; existing players (already
  `seenTowerGuide`) skip it. The gear panel no longer auto-opens at L2.
- **Live tower-intro cards** (`TOWER_INTRO_CARDS_PLAN.md`) — the three squad
  cards plus the later Railgun/Rocket recruit cards carry real renderer-driven
  micro-battles from `src/tower-demo.js`, with all presentation tuning in
  `NARRATIVE.towerIntro`. Railgun and Rocket play once after their unlocks
  (normally L6/L11); `seenTowerIntros` plus a veteran backfill prevents
  retroactive cards, and the level START beat defers to the next visit.
  **Wants phone eyes:** the demo canvas was verified rendering against real
  Canvas2D, but the squad sequence (L2, fresh save) and the Railgun/Rocket
  unlock cards (L6/L11) were only ever verified headlessly.
- **L1 tutorial reworked** in Indy-7's voice (`config.js TUTORIAL`, still
  driven by `src/tutorial.js`), plus two new explainer steps (CREDITS,
  CORE/lose-condition) and phone-feedback polish: the welcome step spotlights
  the Core itself (`target:"core"`, was hidden under the dim veil); the
  compact spotlight-pointer banners now match the card's cyan styling, show
  Indy's nameplate, and float near the actual target instead of a fixed
  corner (`ui.js positionTutorialCard`).
- **L20 renamed** "No Man's Land" → **"Zero Overhead"** (`src/levels.js`, ties
  the menu label to Indy's in-fiction joke at the L20 start card).

**Not yet built** (see Active/deferred work + the dedicated plan files):
the P5 gear-rules card at the L2→L3 seam, an end-of-L1 skill-point
walkthrough.

The campaign is **four worlds / 20 levels**. World 4 (SINGULARITY,
`level_016`–`level_020`, builds `2026.08.08-1`..`-18`) has **one spotlight
tower per level** (L16 Laser, L17 Slow, L18 Pulse, L19 Railgun, L20 Rocket),
achieved through map geometry + a resist-matched enemy roster (see
`WORLD_4_PLAN.md`; several levels have since diverged in balance). Adding a
world needs no code: `WORLDS` unlock automatically when the previous world's
levels are all completed; `balance-schema.js KNOWN_LEVEL_IDS` was extended to
20; Endless uses `defaultTrack`.

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

## Non-negotiable constraints

**Balance Lab status:** complete through L7 (local-only tooling; no
player-facing change, nothing auto-committed or auto-pushed). All editable
gameplay data lives canonically in `src/balance-data.json`; `src/balance-data.js`
is its generated synchronous game import; `src/balance-schema.js` is the
authoritative semantic validator. The localhost-only API in `serve.ps1` reads,
validates, atomically saves, and append-only restores named revisions in
`balance-history/`. The Lab lives at `balance-lab.html` (not linked from the
player menu). `BALANCE_LAB_USAGE.md` is the task guide; `BALANCE_LAB_PLAN.md`
has the architecture and deferred follow-ups.

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

## Delegating work to Codex (local, same machine)

Codex is installed as the desktop app and wired up as an **MCP server**, so a
Claude session can hand it a scoped task and get the result back. Used for the
whole `2026.08.10-11` tower-intro build (five phases from
`TOWER_INTRO_CARDS_PLAN.md`); this is the record of how, and what to watch.

**Setup that already exists** (machine-specific, deliberately NOT committed):
- `~/.codex/codex-mcp.ps1` — wrapper that resolves the newest `codex.exe` and
  runs `codex mcp-server`. It exists because the desktop app installs the CLI
  under a build-hashed folder that changes on every update; a hardcoded path
  breaks silently. Don't replace it with a literal path.
- `.mcp.json` in BOTH `C:\Projects\First-Game` and `...\geometric-td`, because
  Claude gets launched from both and project MCP config only loads from the
  launch directory. Adding or changing it needs a Claude restart.
- `geometric-td/AGENTS.md` — what Codex reads instead of `CLAUDE.md`. Keep the
  two in sync; without it Codex works without the cardinal rules.
- `geometric-td/.claude/launch.json` — lets the Claude session run `serve.ps1`
  as a preview server for browser verification.

**Invoking:** `mcp__codex__codex` with `sandbox: workspace-write` and
`approval-policy: never` (a Claude session can't relay interactive approvals;
the sandbox is the real boundary). Continue an existing run with
`mcp__codex__codex-reply` and its `threadId` — it keeps full context across
phases, which is much cheaper than re-briefing.

**Two hard gotchas, both hit during the tower-intro build:**
1. **Set `cwd` to the REPO ROOT (`C:\Projects\First-Game`) if Codex needs
   git.** `.git` lives at the root, so a session scoped to `geometric-td`
   cannot take `.git/index.lock` — Phase 5's commit failed on exactly this and
   the Claude session had to finish it.
2. **Codex cannot reach a browser here.** `serve.ps1` fails to bind
   `HttpListener` under its sandbox and its browser backend reports none
   available. Everything it "verifies" is headless against a stubbed canvas
   context. **Real-browser verification is the Claude session's job** — use
   `preview_start` with the launch.json above.

**What delegation is good and bad at.** Across five phases Codex never
breached a stated constraint: it stayed inside each phase's file boundary,
never bumped the version early, never committed, and respected every landmine
the plan named. What it misses is *intent*. Real examples worth remembering:
it sized demo enemy HP off the featured tower, which made the Slow card — the
one card about NOT killing — the fastest-killing demo of the five; and it
wrote config declaring enemy groups that the spawner then ignored, so the data
described behaviour the code didn't have. **Review every phase diff for
whether it did the right thing, not whether it followed the instruction.**

**Practical rules:** give it an explicit list of paths to stage (never
`git add -A` — the tree usually holds unrelated in-flight work); tell it
plainly to say "I could not verify this" rather than implying coverage, which
it does honestly when asked; and put the phase plan in a file rather than the
prompt, so each run is a cold read of the same source.

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

- **DONE — Enemy-intro rebuild** (`2026.08.10-8`, card reworked in `-9`,
  glyphs made renderer-faithful in `-10`, `ONBOARDING_ENEMY_INTROS_PLAN.md`):
  intros moved off the bark ticker onto pause-and-tap cards with weak/resist
  tags, a spotlight cutout over the real enemies, a pre-card grace delay, and
  a marching enemy parade. Boss and tower barks stayed on the ticker as
  intended. **Wants phone eyes** — these cards only appear on a brand-new
  save, so they're easy to leave unverified; check the spotlight framing and
  the parade on a real iPhone.

  **Enemy debut schedule** (surveyed 2026-08-10 from `balance-data.json`, so
  nobody re-derives it): Basic L1w1, Fast L1w3, Armored L1w6, Boss L1w10,
  Splitter L6w2, Regenerator L7w2; Splitling spawns from Splitter deaths
  (L6+) and is only an authored group at L18w2 — no intro, by design. **No
  new enemy types exist after L7.** The cards trigger on first-ever sighting
  rather than a level list, so every debut is already covered and no
  per-level work is outstanding.
- **NEXT — narrative/onboarding follow-ups** (design + copy already approved,
  none of this is built yet — read the referenced plan file first, each is
  self-contained):
  - **P5 gear-rules card** — `NARRATIVE_DESIGN.md` §8. An Indy-7-voiced
    gear/mastery explainer card at the L2→L3 seam (the useful half of the
    old auto-guide that "Meet the Squad" didn't carry over).
  - **End-of-L1 skill-point walkthrough** — not yet spec'd. Player earns +1
    skill point per level won; new players should be walked through spending
    their first one at the end of L1.
  - **Minor:** story copy occasionally uses `*emphasis*` markdown but
    `ui.js storyCardHtml` doesn't parse it (asterisks render literally
    in-game). Not reported by the player yet; cheap cleanup whenever.
- **IDENTIFIED, not spec'd — onboarding gaps still deferred.** Came out of
  the enemy-debut survey above (2026-08-10); the user has seen these remaining
  two and deliberately deferred both.
  - **World 4 tile mechanics** — wormholes + conduits first appear at L16,
    fields at L17, all three from L18 on. Brand-new mechanics that change how
    a level plays, currently explained ONLY if the player thinks to tap the
    tile (`ui.js maybeShowTileInfo`) — pure discoverability, easy to miss
    entirely. The biggest remaining gap.
  - **L1 is card-heavy** — four of the six enemy cards fire in level 1 alone
    (Basic/Fast/Armored/Boss), on top of the tutorial steps and the L1 story
    beat. Consider spacing them out or folding some together.
- **DONE — Balance Lab (L0-L7):** `BALANCE_LAB_PLAN.md`. Data/schema migration,
  the localhost-only save/restore API in `serve.ps1`, the editable
  `balance-lab.html` with revision history, and L7 QA/docs — all complete and
  verified. Per-phase plans and L0-L2 probes archived in
  `docs/archive/balance-lab/`. Remaining step: a deliberate manual commit.
- **WATCH — World 3 (second pass shipped `2026.07.21-7`):** L11/L15 hardened,
  L12/L14 openers softened, L13 untouched. Confirm with `-7` telemetry: compare
  ratings, core/leaks, remaining money, and composition by `app_version`. Open
  questions the `-6` sample raised but this pass did not address — World 2 front
  (L6/L7 read `too_easy`) and L4 (rated `too_hard`); revisit once `-7` data lands.
- **WATCH — World 4 balance is not settled.** A strong/maxed roster still
  clears heavily-tuned levels. This is a *ceiling* problem, not a broken curve
  (see "Tower power scaling"): roster power ranges ~10× from a modest to a
  fully-maxed 7-tower platform, so a level can't challenge the max without
  walling everyone else. Iterate via phone feedback; HP is a free lever
  (perf-wise), enemy count is not. No telemetry yet for W4 — watch first rounds.
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
- `NARRATIVE_DESIGN.md` — story bible: Indy-7 / Bratwurst-XL / tower personas,
  the campaign arc + full per-level script, the delivery/save model. Most of
  it is now BUILT (see "Current state" above) — read it for the story itself
  and for what's still pending.
- `ONBOARDING_P1_PLAN.md` .. `ONBOARDING_AV_PLAN.md` — build specs for each
  shipped narrative phase (onboarding intro, per-level beats, the bark
  ticker, Meet the Squad, character avatars); kept for reference/pattern.
- `ONBOARDING_ENEMY_INTROS_PLAN.md` — enemy-intro pause-and-tap rebuild:
  the approved copy (with its `damageMult` traceability table), the delivery
  decision, and an "As built" record. SHIPPED in `2026.08.10-8`.
- `TOWER_INTRO_CARDS_PLAN.md` — renderer-faithful tower micro-battles in story
  cards, the Railgun/Rocket one-time unlock flow, and the shipped "As built"
  record for `2026.08.10-11`.
- `LOOT_DESIGN.md` / `GEAR_UI_DESIGN.md` — loot and equipment design/history.
- `CIRCUIT_MENU_DESIGN.md` — menu-board design/history.
- `SUPABASE_SETUP.md` — telemetry and leaderboard database setup.
- `BALANCE_LAB_PLAN.md` — approved Balance Lab architecture and phases.
- `BALANCE_LAB_L0.md` — L0 schema contract: value inventory, data-home paths,
  validation rules (verified data shape: 15 levels / 159 waves / 313 groups).
- `docs/archive/balance-lab/` — per-phase execution plans (L1-L7) plus the
  L0-L2 migration probes and baselines.
- `docs/archive/HANDOFF_HISTORY_2026-07.md` — completed-work and build-by-build
  changelog history (July + August 2026); Git commit `2650204` retains the full
  former handoff.
```
