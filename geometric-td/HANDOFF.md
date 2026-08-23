# Geometric TD — Developer Handoff

Read this first when working on the project. Completed-work and build-by-build
changelog detail lives in `docs/archive/HANDOFF_HISTORY_2026-07.md` (now covers
July **and** August 2026); the original pre-cleanup handoff is preserved in Git
at commit `2650204`. This file keeps only what you need to start work:
current state, non-obvious mechanics, rules, tuning locations, and the file map.

## Current state — 2026-08-23

**IN PROGRESS — French localization (i18n).** A discreet `EN|FR` language
toggle (default English) so the player's dad can play in French. Read
**`I18N_PLAN.md`** first for any i18n work. Phase 0 (engine + toggle +
persistence) shipped & verified 2026-08-16; Phases A–E (chrome, gameplay
data, tutorial/onboarding, narrative, misc) translate the rest, delegated to
Sonnet agents cold-reading the plan. Architecture: English stays inline as
the fallback; French lives only in `src/lang/fr.js`; `src/i18n.js` `t(key,
en)` looks it up; `lang` save field via `progression.js getLang/setLang`;
`<html data-lang="fr">` is the CSS hook for length tweaks. **Never translate
proper nouns** (tower names Laser/Pulse/Slow/Railgun/Rocket, Indy-7,
Bratwurst-XL, "GEOMETRIC TD").

**Deployed build: `2026.08.23-11`.**

### Tower tray icons + firing preview (`2026.08.23-6` .. `-11`)
The bottom-HUD tower tray shows a **live micro-sim per tower** (its real shape +
price) instead of the old name+price chips, freeing room for future towers.
- **Real firing, not a lookalike.** `src/tray-icon.js` builds a one-tower sim
  (modeled on `tower-demo.js`) driving the real `updateTowers`/projectiles/
  effects/particles, rendered by a new **bare mode** in `renderer.js render()`
  (`uiState.bare` — draws only the tower + additive shot layers on a transparent,
  caller-cleared/cropped surface). An invisible, pinned, huge-HP dummy target one
  tile "up" makes the tower fire real shots that leave the cropped frame and hit
  nothing on the board (no coins/gear/loot). All knobs in `config.js VFX.trayIcon`
  (tile/view size, grid, aim target, dt clamp).
- **Only the SELECTED tower animates** (one rAF loop total, in `ui.js`); others
  paint a single idle frame. Loop stops when the upgrade panel covers the tray,
  the tab hides, or under reduced-motion (static fallback).
- **Icon size matches the on-screen in-game tower** (`tilePx 46`, `viewTiles 1.0`).
- **States (all `styles.css`):** selected = a colored box (border+glow+fill) reappears
  around the armed tower (a permanently-reserved transparent border keeps the layout
  from shifting). Unaffordable = the icon greys to a UNIFORM light grey
  (`brightness(0) invert()` flattens any hue to one grey) — this ALWAYS wins, even
  when the unaffordable tower is the armed one. Locked keeps its dim + unlock label.
- **Tap-to-deselect:** tower buttons use a `.disabled` **class**, NOT the DOM
  `disabled` attribute, so a tap on an unbuyable tower still fires — `main.js`'s
  select handler treats it as "never mind" and cancels the current selection.
- **`#action-bar` has a fixed `min-height`** so swapping the (taller) tray for the
  (shorter) upgrade panel no longer jumps the board.

### CSS cache-buster (`2026.08.23-11`)
`update.js` now stamps `styles.css?v=APP_VERSION` onto the stylesheet `<link>` on
import, so a **CSS-only** change plus a version bump can't leave a manual browser
refresh stranded on the old stylesheet (GitHub Pages `max-age=600`, no filename
hash). The static `<link>` still paints first (no unstyled flash); the browser
keeps the current sheet until the versioned one loads, and same-version loads hit
cache. The in-app TAP TO RELOAD (`hardReload`) already busted CSS; this covers the
manual-refresh path too. A service worker (PWA plan) remains the durable fix.

### Settings + adaptive performance (`2026.08.23-4`)

- The main menu's old BANTER button is now **SETTINGS**. The panel owns Story
  Banter, Visual Effects (`AUTO` / `FULL` / `REDUCED`), Debug Mode, Language,
  and the only Reset All Progress control (two-tap confirmation). Preferences
  persist via `save.js` defaults **and** `progression.js` backfills.
- Visual quality is **per device and local-only**. It never enters a co-op join
  payload, command, catalog, event, or recurring snapshot. AUTO samples rendered
  FPS and enters reduced mode after sustained sub-42 FPS, then restores after a
  sustained recovery above 52 FPS; hysteresis/timing and reduced budgets live in
  `config.js PERFORMANCE`.
- Reduced mode keeps gameplay intact while cutting particle counts/cap/glows,
  gear orbitals, and the spring-warp mesh. It applies to campaign, solo Endless,
  co-op host, and co-op guest rendering independently.
- `simulation-clock.js` divides low-FPS/high-speed authoritative frames into
  bounded substeps no larger than 1/60 game-second. It preserves per-render
  updates at 120 Hz and slow motion, while 30 Hz gets two safe ticks and long
  background gaps are capped. Guests remain snapshot-driven.
- DEBUG MODE shows actual rendered FPS plus effective VFX state in battle, e.g.
  `FPS 30 · VFX AUTO→REDUCED`. The main-menu build stamp remains visible and is
  centered. Follow-up `2026.08.23-5` keeps that stamp in the menu's vertical
  flex flow beneath the action rows so it cannot overlap them on short screens.

### Railgun rework (`2026.08.19-14` .. `-20`)
Multi-part Railgun overhaul. **All knobs live in `config.js VFX.railgun`** unless
noted; DPS-balance data is in `balance-data.*`.
- **Unlimited ray range.** The fired ray reaches the WHOLE board
  (`towers.js tower.railReach`, set in `recomputeStats`). The range RING
  (`tower.range`, base **2.6**, was 3.5) is now ONLY the targeting trigger: the
  rail fires when an enemy enters that smaller ring, then pierces everything
  lined up behind it across the map. `findRailgunAim` / `fireShot` /
  `collectLineVictims` all use `railReach`.
- **Charge-up + gradual fade.** It winds up a visible energy charge
  (`renderer.js drawRailCharge` — converging ring + swelling core glow) before
  releasing, then the ray thins and fades out instead of snapping off
  (`fadeWidth` flag on the `beam` effect, drawn in `drawEffects`). Both are
  speed-compensated. The wind-up is a charge→release state machine in
  `updateTowers`; the post-fire cooldown is shortened by `chargeSeconds`, so the
  cadence — and DPS — is **unchanged** (DPS-neutral). Capacitor Bank (below) is
  the only real fire-rate gain.
- **Over-Penetration skill → Capacitor Bank.** The old beam-length skill is
  moot (ray is unlimited), so it became a **charge-speed** perk
  (`progression.js getRailChargeSpeedMult`). Its internal id AND value key stay
  **`railPen`** for save + `fr.js` (`skill.railPenN.*`) + schema stability — only
  the display name/desc/icon and the getter changed. Owned boxes carry over with
  no migration.
- **Cosmetic per-level ray progression** (`rayPatternByLevel`, keyed to the
  BOUGHT in-battle level): L1 one thin ray … L7 one thick … L10 two thick (full
  table + `rayTiers` widths in the config). Extra rays are parallel energy beams
  offset perpendicular to the aim — **damage is unchanged** (all victims are
  collected once on the CENTER line). Rays start `rayStartOffsetTiles` in front
  of the tower triangle (radius 0.22); in 3-ray levels the OUTER rays fade before
  the center (`outerRayFadeFrac`).
- **Scaling nerf.** The Railgun's per-level SPECIALTY used to be raw
  `damageGrowth 0.1` — the ONLY pure-damage specialty (every other tower's is
  utility) — which ballooned it to **2.10× pulse** single-target DPS at max. Its
  specialty is now **empty** (`balance-data towerUpgrades.specialties.railgun {}`),
  flattening it to a constant **~0.89× pulse** at every level AND mastery rank —
  Pulse-adjacent; its 4× pierce + unlimited range are its identity. Base damage
  (48) unchanged. The "specialty" slot now reads as the cosmetic ray upgrade
  (`SPECIALTY_LABELS.railgun`, `ui.js SPECIALTY_TEXT`; the gear sheet drops the
  `(+N%)` for a 0-pct cosmetic specialty).

### Credit Juice (new, `2026.08.19-8` .. `-13`)
Earning credits used to be silent — the only cue was a number changing. Now
(spec + knob map in **`CREDIT_JUICE_PLAN.md`**; requested by the player's
daughter after comparing the game to Block Blast):
- **Coins on the track** — every kill sprays gold coins that arc under
  gravity, land near the death point, spin flat, and fade
  (`particles.js emitCoins`, `kind:"coin"` branch in `updateParticles` +
  `drawParticles`). Bosses throw a much bigger, harder-flung haul
  (`bossPerKill`/`bossSpeedMult`). **Airborne time burns `flight`, NOT `ttl`**
  — coins stay fully bright for the whole arc and only start fading once
  landed; ticking `ttl` in the air made them fade mid-flight and popped ~2%
  of them out of existence. All knobs in `config.js VFX.coins`.
- **HUD gold pulse** — `#money-value` flashes white-hot and pops whenever
  CREDITS *increases* (`ui.js updateHUD` diffs `game.money`; `.credit-gain`
  keyframes in `styles.css`). Spending never pulses, and the tracker resets
  per battle by comparing `game` object identity, so starting a level richer
  than the last one ended doesn't fire. `VFX.creditGain`.
- **Gear drop → Indy eats it** (`-10`, iterated twice from player feedback).
  The dropped item appears as **its own stash tile** — rounded plate, rarity
  border, slot glyph (optic/emitter/capacitor/frame) — **lifts** off the
  corpse, then **zips into Indy-7 and is swallowed**, after which Indy shows
  **happy eyes** for `smileSeconds`. One effect, two phases on a 0→1 clock
  split by `riseFrac`: ease-OUT rise, then ease-IN dash so it accelerates
  away. All knobs `VFX.gearDrop`.
  - Rejected along the way: a generic rarity **diamond** (`-8`, didn't say
    WHAT dropped), then a static glyph that just rose and faded (`-9`, "not
    that satisfying"). Don't regress to either.
  - `renderer.js drawSlotGlyph` is a **vertex-for-vertex canvas port of
    `ui.js slotGlyph`'s SVG** in the same 100-unit viewBox space; the tile
    plate mirrors `.gear-tile` in `styles.css` (radius, border, fill, 46%
    glyph). These are deliberately **parallel copies** because the renderer
    takes no UI import — **artwork changes must be made in both places**.
  - Only rarity + slot travel on the effect; the renderer owns
    `GEAR_RARITY_COLOR` and draws the ring itself, because `renderer.js`
    already imports from `enemies.js` and resolving color at the drop site
    would make that circular.
  - The smile is wired through a **generic** hook: an effect may carry
    `expireStamp: "<gameField>"` and `projectiles.js updateEffects` stamps
    `game.time` there when it expires. `coreFaceMood` reads
    `lastGearIngestTime`. Ranked below a leak (getting hit still wins) but
    above `worried`.
- **Not yet eyeballed on a phone** — verified by state assertions only
  (coins spawn/land/clean up, pulse fires on gain but not spend, all four
  slot glyphs render, 12 drops → 12 ingest stamps → `happy` mood observed).
  Counts are deliberately generous; the player asked to tune density later
  rather than pre-optimize for clutter.

### First-Mastery moment (new, `2026.08.19-5`, two-card in `-6`)
On the first **Mastery rank-up a player ever sees** mid-battle, the game pauses
and Indy-7 plays a **two-card** story sequence. One-time, save-gated via
`shouldShowBeat("firstMastery")`; fires **even with STORY BANTER off** (it
teaches a mechanic). Trigger: `towers.js updateTowers` sets
`game.pendingFirstMastery` on **any** Mastery rank-up (not just the 0→1
crossing), consumed in `main.js updateBarks` (before the banter bail), which
assembles both cards. **Deliberately NOT backfilled** (`-7`): a seasoned player
who never saw the card still meets it on their next rank-up, even if their
towers are already past rank 1.
- **Card 1 (`NARRATIVE.firstMastery.surge`)** — celebration: runs the
  `NARRATIVE.towerIntro.cast.mastery` tower-demo, which **loops the golden
  level-up surge** on the tower that ranked up (`tower-demo.js` featured-tower
  override + `surgeLoop`; `towers.js applyLevelUpSurge` shared with the live
  rank-up). Explains the permanent + temporary boost.
- **Card 2 (`NARRATIVE.firstMastery.gear`)** — the gear unlock (the real
  `LOOT.equipGate.minMastery` = 1 gate), with a **`showcase`** of four sample
  gear pieces at rising rarities (enhanced→rare→prismatic→singularity). Rendered
  by `ui.js renderGearShowcase` from the game's own `slotGlyph` + `RARITY_COLOR`
  (change a slot/rarity/stat in the config array and the row follows), into
  `#story-gear-showcase` (styles in `styles.css`, `.gear-showcase-tile`).
  **The tiles carry NO rarity name — deliberately (`-13`).** A tile is just the
  slot glyph + the stat, in the rarity's color. Don't add the name back: the
  card's column is only ~278px, so an equal-width tile gives ~56px of text and
  "SINGULARITY" needs 78px at the original 11px. The whole ladder was walked
  and rejected — 11px spilled outside the borders on a phone (`-10`);
  content-sized tiles fit the text but the ragged widths were rejected (`-11`);
  8px in equal tiles fit but crowded the edges (`-12`). **Tiles must stay equal
  width**, and the rarity-colored border/glow plus the card's body text already
  say which rarity is which. Verified no child overflows its tile at 514px,
  393px and 320px viewports.

### Player telemetry dashboard + L004 ease (2026.08.19-1)
- **Player Telemetry** section added to `balance-difficulty.html` (the deployed
  read-only Balance Dashboard): reads the live Supabase `feedback` table and
  aggregates real play — struggle map, killer waves, drop-off funnel, attempts-
  to-clear, tower usage & mix, "forgot to…" adoption (unspent skill points /
  ungeared towers), felt-vs-measured ratings, economy; version + mode filters.
  A **"Hide my runs"** filter excludes the viewer's own `client_id`(s) (owner's
  two saves excluded by default). Reminder: telemetry is sent for EVERY battle
  end automatically; only the difficulty rating is opt-in. Full "as built"
  record + the queued Scope B (mastery★ + `arsenalPower` → power-to-clear) live
  in **`TELEMETRY_DASHBOARD_PLAN.md`**.
- **L004 wave-3 eased** off that data (it read as an early wall + retention
  cliff): W3 basic 14@5.0x→12@3.8x, fast 10@4.5x→8@3.4x, +group `bountyMult 1.6`
  (net ~1.3x after the level's 0.82). Reverses the earlier "intentional gate"
  stance — watch whether the L2→L6 drop-off funnel flattens next telemetry.

### Tower level-up surge (new, `2026.08.19-2..-3`)
A mastery **rank-up** mid-battle now gets a golden celebration instead of a lone
yellow ring. **Trigger is mastery ONLY** — banked XP crossing a rank threshold
(fresh towers start earning ranks past `TOWER_UPGRADES.mastery.xpStart` ≈ 700),
fired in `towers.js updateTowers` when `masteryRankFor(xp) > tower._masteryRank`.
Deliberately NOT the paid in-battle level-up: measured that raw XP does not buff
a tower at all (XP only makes it *eligible*; money buys the level), so there was
nothing to celebrate at the eligibility moment. On rank-up:
- **Visual surge** — an expanding shockwave ring, two nested gold rings, and a
  shimmering gold+white spark splash (`particles.js emitLevelUpSplash`), plus an
  optional floating **"LEVEL UP"** label (new `floatText` effect kind in
  `renderer.js drawEffects`, gated by `showText`).
- **Sustained aura** — a pulsing golden halo wraps the tower for the whole buff
  window (`renderer.js drawSurgeAura`, keyed off `tower._surgeUntil`), so the
  "powered up" state is unmissable and lasts as long as the boost.
- **Temporary buff** — ×1.35 damage, ×1.5 fire rate for 5s, with **golden
  shots** for the duration (`towers.js fireShot` `shotColor`; `projectiles.js`
  orbs/rockets accept `shot.color`). Applied at the END of `recomputeStats` from
  `tower._surgeActive`; runtime-only, **no save change**.
- **Speed compensation (the important bit)** — the one-shot VFX decays on the
  speed-scaled game clock, so at x2/x4 it used to flash past. `main.js` exposes
  `game.effectiveSpeed` (= `DEBUG.gameSpeed * speedFactor`) and the surge scales
  those lifetimes UP by it, so the burst lasts a constant REAL-time length at any
  speed. The buff + aura stay honest game-time.
- **All knobs in `config.js VFX.levelUp`** (colors, shockwave/ring/splash/text
  sizes+ttls, aura radius/alpha/pulse, `showText`, `buffDuration` + the two mults).

Older recently-shipped — `2026.08.11-7`, shipped 2026.08.11 (detail in the archive):
- **First-loss pep talk** — one-time Indy-7 encouragement on the first genuine
  campaign defeat (`config.js NARRATIVE.firstLoss`, gated `narrativeSeen.firstLoss`),
  with a conditional unspent-skill-point nudge. Colors "stronger"/count via new
  `[hl-pink]/[hl-blue]` markup in `ui.js storyCardHtml`.
- **Results-screen polish** — two-per-row button grid (`fullWidth` NEXT spans;
  lone trailing button auto-spans), subtitle capped to the 340px column, ASSIGN
  button shows the count in magenta, LOOT EARNED grid sorted rarest-first.
- **Onboarding "job" card demo** — the "doesn't get its hands dirty" intro card
  runs a live two-tower micro-battle (`tower-demo.js` named scenario
  `NARRATIVE.towerIntro.cast.intro`; card field `demo`).
- **Reactive endpoint faces** — see the subsection below.

Older recently-shipped (archive): Shard-sink **stash economy** (`config.js
LOOT.stash`/`LOOT.autoJunk`); **STASH tab controls** (`ui.js renderStashTab`);
**game-wide contrast** (`styles.css --text-dim` ~11:1).

### Reactive endpoint faces (new, 2026.08.11-6..-7)
The track's two endpoints wear EYES that react to the battle — **eyes only, no
nose/mouth** (the core's old center dot was removed for this). `renderer.js
coreFaceMood`/`portalFaceMood` choose an expression from live game state each
frame; `drawFace` strokes two eyes (same vocabulary as the story-card avatars,
`ui.js avatarEye`). **Bratwurst-XL** (spawn portal): smug at rest, mean while a
wave is spawning, gloats (happy) on player loss, X-eyed (defeated) on player
win. **Indy-7** (core): calm neutral, an X-eye flinch for `hitFlashSeconds` each
time an enemy leaks (`game.js` sets `game.lastLeakTime`), worried below
`lowCoreFrac` core HP, happy on win, X on loss. Both **idle-blink** on their own
desynced cadence with occasional **double-blinks**, suppressed while X-eyed. The
**story-card SVG avatars** (`ui.js speakerAvatarSvg`) blink too (SMIL: one single
+ one double blink per loop; skipped under reduced motion and for X-eyed cards).
The demos (no `phase`) read as attacking-Bratwurst + calm-Indy. Everything is
tunable in **`config.js VFX.face`** (eye colors/geometry, hit-flash window,
low-HP threshold, blink timing + double-blink chance).

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
over-tuning + geometry (pierce on a funnel). **One real per-tower exception, since
fixed (`2026.08.19-14`):** the Railgun's specialty was raw damage growth, which
did compound its scaling — now neutralized (see "Railgun rework" above). **Perf
ceiling:** ~300–400
concurrent enemies is the playable mobile target (desktop handles ~800 at
~13ms; iPhone is ~5× slower). Raising HP via `healthMult` costs nothing
(same counts); raising enemy *count* is the perf lever.

### Ops: leaderboard + telemetry
Both hit ONE Supabase project (`config.js` LEADERBOARD/FEEDBACK). It's free-
tier and **auto-pauses after ~7 idle days**, which surfaces in-game as
"Couldn't reach the leaderboard" and silently kills telemetry. Fix = restore
the project (Supabase dashboard, or MCP `restore_project`); ~5 min, no code
change. Data survives the pause. First hit + restored 2026-08-08. The
`balance-difficulty.html` **Player Telemetry** section reads this `feedback`
table to visualize it (see `TELEMETRY_DASHBOARD_PLAN.md`).

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
src/performance.js  per-device FPS monitor + AUTO/FULL/REDUCED effective VFX state
src/simulation-clock.js bounded authoritative simulation substeps across render cadences
src/progression.js  persistent roster, skills, shards, migration/backfills (+ tooling-only seedRoster/seedSkills exports for balance sims)
src/equipment.js    equipped-item stat aggregation and mastery helpers
src/loot.js         item generation
src/endless.js      deterministic Endless generation
src/milestones.js   campaign challenge evaluation
src/tutorial.js     first-play tutorial state machine
src/onboarding.js   first-load story-intro state machine (P1)
src/tower-demo.js   isolated micro-battles for tower-intro / onboarding cards
src/tray-icon.js    live per-tower micro-sim behind each bottom-HUD tower icon (real firing)
src/ui.js           player DOM UI and overlays
src/feedback.js     Supabase run telemetry and difficulty rating
src/leaderboard.js  Supabase Endless board
src/save.js          localStorage schema/read/write/reset
src/version.js       deployed build stamp
src/update.js        home-screen update nudge
serve.ps1            local static server + localhost-only Balance Lab API
src/level-difficulty.js Level Calculator (local): analytic DEMAND side (per-level peak firepower)
src/arsenal-power.js Level Calculator (local): analytic SUPPLY side (arsenal power, economy-gated)
src/balance-sim.js   Level Calculator (local): headless real-engine oracle (drives updateGame)
balance-difficulty.html Level Calculator (local) + deployed read-only Balance Dashboard: difficulty curve, tower balance, skill value, recommended-level map, AND the live Player Telemetry section (reads the Supabase feedback table)
balance-mix.html    Level Calculator (local): Survival Solver — min surviving tower mix per level, fresh vs maxed roster (drives solveLevelMix)
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
  placement — its ray now pierces the WHOLE board once an enemy enters its
  (smaller) targeting ring (see "Railgun rework"); Rocket has global range and
  expensive scaling.
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
- **NEXT — PWA / installable home-screen app (Path A):** full phased plan in
  **`PWA_HOMESCREEN_PLAN.md`** (designed 2026-08-13, **build NOT started**).
  Makes the game an installable, **offline-capable** home-screen app on iOS
  **and** Android (Android gets a true one-tap install button; iOS gets a
  coached "Share → Add to Home Screen" overlay), plus a service worker so it
  launches with no network. Written as delegatable phases; orchestrator does the
  single `version.js` bump + push. **Supersedes two DEFERRED items below:** the
  service worker's `sw.js?v=APP_VERSION` cache-versioning is the durable
  cache-buster, and offline precaching mitigates iOS localStorage eviction (a
  full save export/import is still a separate nice-to-have). **BLOCKED on the
  app icon:** user is supplying artwork; `geometric-td/icons/` exists but
  `icons/source.png` (≥512×512) is not on disk yet — see the plan's Phase 0
  (incl. the busy-screenshot legibility caveat).
- **DONE — Level Difficulty Calculator (local tool):** all three goals delivered
  2026-08-15. Design + findings in **`LEVEL_CALCULATOR_PLAN.md`**; to resume read
  only **`LEVEL_CALCULATOR_RESUME.md`**. A local balancing tool that reduces every
  level and arsenal to comparable numbers in one unit (**base-laser-equivalents**):
  - **Demand** (`src/level-difficulty.js`, analytic) — each level → peak-firepower
    number (L1≈17 laser-eq) + a separate economy-crunch flag.
  - **Supply** (`src/arsenal-power.js`, analytic, reuses `towers.js careerStatsFor`)
    — a roster → economy-gated firepower via a greedy buy+upgrade model.
  - **Recommended-level map** (`balance-difficulty.html`) — per level × roster,
    `supply÷demand` → green/yellow/orange/red RPG band.
  - **Oracle** (`src/balance-sim.js`, drives the real `updateGame`) calibrated the
    constants: `ARSENAL_TUNING` splashWeight.pulse 1.55 / slow 0.20; skills/gear as
    a per-tier `powerMult`. Local tooling only (no version bump; the throwaway
    preview port has its own empty localStorage so the real save is never in
    scope). **Known gap:** World 4's pierce/conduit/spiral force-multipliers are
    unmodeled, so W4 rows read falsely-hard (flagged on the page).
- **NEXT — the daughter's wishlist (2026-08-19).** The player's daughter tried
  the game and asked for four things; **Credit Juice is built** (see Current
  state), the rest are designed-not-built:
  - **Theme picker / pink theme** — she'd play if it had a pink theme. Ideated,
    not spec'd. Four palettes were mocked (Bubblegum hot-pink-on-black /
    Cotton Candy light mode / Sunset Sparkle / Unicorn); **she hasn't picked
    one yet**. Findings from the survey: the canvas side is easy (`renderer.js`
    `LOOK` is already a palette layer with per-level overrides), the CSS side
    is the chore (~150 hardcoded hex/rgba literals in `styles.css` alongside
    the tokens). Two design questions to settle first: whether a theme
    *replaces* per-level palettes or merely *tints* them (recommend tint —
    cheaper, keeps each level's identity), and that enemy/tower colors must
    NOT move (they carry weak/resist meaning). Follow the `lang` toggle's
    pattern: `theme` save field + `<html data-theme>` hook.
  - **Richer circuit-board art** — she wants the board to look more like a real
    PCB (reference: a dense glowing-trace wallpaper). NOTE: the game **already
    has** a procedural circuit layer (`renderer.js buildCircuitLayer`, knobs
    `VFX.circuit`), pre-rendered once per level, so this is enrichment not a
    build. Missing vs the reference: **bus bundles** (parallel traces turning
    together — the biggest win), 45° mitred corners, longer runs, two trace
    weights, comb/edge-connector fingers, IC blocks with pins, ring pads away
    from the core, and glow blooms at pad ends. Density knob is `traceCount`
    (26 today). **Undecided:** "Richer" vs "Dense". Keep it procedural — it
    recolors with the level palette and any future theme for free, which a
    bitmap wallpaper could not. Watch legibility: the glow blooms are the risk
    (they can read as tappable objects), not the traces.
  - **DECIDED AGAINST — haptics / vibration.** She likes Block Blast's tap
    feedback, but **her phone is an iPhone and iOS Safari does not implement
    the Vibration API** — `navigator.vibrate` simply does not exist, and
    installing to the home screen does not change that (same engine). The only
    workaround is a hidden `<input type="checkbox" switch>` that fires one
    fixed system tap; fragile and single-sensation, so not worth building on.
    **Don't re-plan this for iOS.** If Android is ever a target it's an easy
    win (~1h): a feature-detected `haptics.js` with durations in `config.js`,
    an ON/OFF toggle, sharing call sites with the sound layer.
- **CO-OP MULTIPLAYER — v1 SHIPPED + two playtest rounds (2026-08-22):** full
  phased record in **`COOP_MULTIPLAYER_PLAN.md`**. **Phases 0–7 all shipped and
  verified locally**, plus post-playtest fixes from real two-device sessions.
  Real two-player iPhone↔PC Endless co-op runs over the TURN relay.
  Phase list: 0 transport, 1 ownership+wallets, 2a host-authoritative sync,
  2b cosmetic events+drop-in, 2b-3 shot visuals, 3 lobby, 3b co-op HUD,
  4 progression exchange, 5 TURN, 6 post-playtest bug batch, 7 smoother guest
  motion (capped extrapolation / eased correction / adaptive interp buffer for
  poor connections). **Playtest fixes since:** guest tower parity (upgrade
  chevron, gear orbitals, button glow), co-op end-screen when the core falls
  (was stalling), a general update-nudge reload fix (see below), per-owner
  same-name roster deployment, an 83%-smaller compact snapshot protocol
  (`COOP.protocolVersion: 2`; full record in the co-op plan §10d), and shared
  identical loot for both players with a result-ordering guard (§10e), and
  aspect-safe canvas refitting across co-op chrome transitions (§10f).
  Live files: `src/net.js` (transport), `src/coop.js` (game protocol),
  `src/lobby.js` (session directory), `COOP` in `config.js`, `coop-spike.html`
  (unlinked Phase-0 test page), the `coop_sessions` Supabase table +
  `turn-credentials` edge function.
  **Still wants a fresh live two-device session** to shake out the next layer
  — every multi-tab test here drove the loops by hand (automation tabs suspend
  rAF), and each of the two playtest rounds so far surfaced real "works in
  isolation, breaks in a live session" bugs. Deliberate v1 limits: no
  mid-run-leave banking, no lobby kick/terminate, 2-player UI (schema ready
  for 4), no co-op leaderboard.
  Two players (schema/protocol designed for 4) on one board via a CO-OP button
  in `#menu-actions` → session browser → host picks Public/Private + a
  **cleared** level, played in **Endless**. Host starts alone, guest **drops
  in at any wave**. Separate wallets with FULL bounty to each; anyone upgrades
  any tower, only the owner sells. **Host-authoritative** sim over a WebRTC
  DataChannel; the existing Supabase project carries the lobby + signaling
  (`coop_sessions` table) and mints TURN credentials (`turn-credentials` edge
  function, secrets set by the owner, never in this repo).
  **The relay is the transport, not a fallback** — direct P2P was chased to
  ground and fails on an ordinary home network for two independent reasons
  (iCloud Private Relay on iOS, inbound blocking on the LAN). Don't spend time
  re-attempting direct P2P.
  Three things a future session must not undo: co-op must **never** write
  `endlessBest` or the solo Endless board (permanent pollution of a live
  shared board); **skills are locked at join** (the one-shot join payload
  goes stale otherwise); and co-op has **no speed control or pause** (that is
  what removes the clock-divergence problem). Endless-only is deliberate — it
  deletes the co-op balance problem entirely, since the endless ramp *is* the
  difficulty scaling.
- **DEFERRED — Endless:** retune its ramp after campaign balance stabilizes.
- **DEFERRED:** save export/import for iOS localStorage eviction; sound;
  additional tower classes (Tesla was the runner-up); pre-battle loadouts;
  a durable cache-buster (`?v=APP_VERSION` on module imports) to end the
  stale-module-after-deploy confusion on iOS. (Cache-buster + eviction are
  largely addressed by the PWA plan above once built.) **Partial mitigation
  shipped `2026.08.22-21`:** `update.js` tap-to-reload now re-fetches every
  loaded module with `cache:"reload"` before reloading, so the update nudge no
  longer loops on GitHub Pages' `max-age=600` (was stranding Firefox on the
  old build). A service worker would still be the durable fix. **Extended
  `2026.08.23-11`:** `update.js` also stamps `styles.css?v=APP_VERSION` on the
  `<link>` at import, so a CSS-only change plus a version bump can't leave a
  manual browser refresh on the stale stylesheet (the module re-fetch already
  covered JS; the `<link>` was the remaining gap).

## Related documents

- `LEVEL_CALCULATOR_RESUME.md` — **read this first** to continue the Level
  Calculator: current lean state (demand + supply + map all delivered,
  oracle-calibrated), the corrected mistakes, and remaining nice-to-haves.
- `LEVEL_CALCULATOR_PLAN.md` — deep archive: architecture (Plan C: analytic
  front-end + headless real-engine oracle), the modeling findings (coverage/
  corner-premium, bunching, targeting efficiency), the level-1 calibration
  anchors, and the full as-built record. Started 2026-08-14; all 3 goals +
  oracle calibration delivered 2026-08-15.
- `CREDIT_JUICE_PLAN.md` — the coins / HUD-pulse / gear-drop feature: the
  original phase spec **plus an "As built" record** with the corrections the
  plan itself got wrong (coin `ttl` must not tick airborne; `enemies.js` must
  not import `renderer.js`; the HUD tracker needs a per-battle reset) and the
  full rejected ladder for the gear showcase's rarity labels. Read the As-built
  section before trusting the phase spec above it.
- `BALANCE_LAB_USAGE.md` — local editing, testing, restore, and manual Git
  workflow.
- `WORLD_4_PLAN.md` — World 4 (SINGULARITY) design + original maps/waves
  (several levels have since diverged in balance passes; L19 fully redesigned).
- `I18N_PLAN.md` — French localization plan + living tracker: the i18n
  architecture (Phase 0, built), the translation rules, and the per-phase
  breakdown (A–E) for delegated agents. **Read this first for i18n work.**
- `COOP_MULTIPLAYER_PLAN.md` — **read this first for any co-op work.** Two-
  player (designed for up to 4) Endless co-op as its own mode: the locked
  decisions across four ideation rounds, the host-authoritative architecture,
  Phases 0–5 (connection spike → ownership/wallets → netcode+drop-in → lobby
  + co-op HUD → progression exchange → Cloudflare TURN), the still-open
  questions in §12, and the parked identity features in §13. Designed
  2026-08-22, build not started.
- `GAME_BRIEF.md` — original feature specification.
- `PWA_HOMESCREEN_PLAN.md` — phased plan to make the game an installable,
  offline-capable home-screen app (iOS + Android) with an in-game install
  button. Designed 2026-08-13, not yet built; blocked on the app icon source
  file. See "Active and deferred work" above.
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
- `TELEMETRY_DASHBOARD_PLAN.md` — the Player Telemetry section on
  `balance-difficulty.html`: build spec + "as built" record (Scope A dashboard,
  the "Hide my runs" client_id exclusion, first findings) and the queued Scope B
  (mastery★ + `arsenalPower` payload additions → a per-level power-to-clear curve).
- `BALANCE_LAB_PLAN.md` — approved Balance Lab architecture and phases.
- `BALANCE_LAB_L0.md` — L0 schema contract: value inventory, data-home paths,
  validation rules (verified data shape: 15 levels / 159 waves / 313 groups).
- `docs/archive/balance-lab/` — per-phase execution plans (L1-L7) plus the
  L0-L2 migration probes and baselines.
- `docs/archive/HANDOFF_HISTORY_2026-07.md` — completed-work and build-by-build
  changelog history (July + August 2026); Git commit `2650204` retains the full
  former handoff.
```
