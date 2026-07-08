# Geometric TD — Project Brief (condensed)

Portrait, mobile-browser tower defense (iPhone Safari first). Abstract neon/vector
style on a dark grid. The player defends an **AI Core** from geometric enemy waves.

**Key differentiator:** towers are persistent RPG-like units — each tower has a
name (L-01, P-02, S-01…), gains XP and levels, and joins a permanent roster
reusable in later battles. XP makes a tower *eligible* to level; money pays for
the actual upgrade. A tower's roster level is its unlocked *potential* — in each
battle you still pay to climb back up to it.

## Stack
Plain HTML5 + Canvas 2D + vanilla JS ES modules. No framework, no build system,
no backend. Saves in localStorage. Deployable as a static site (GitHub Pages etc).

## Prototype (Phase 1) scope
- One handcrafted level: visible grid, fixed enemy path, buildable + blocked tiles
- 3 towers: **Laser** (fast single-target), **Pulse** (splash), **Slow** (control)
- 4 enemies: **basic** (triangle), **fast** (diamond), **armored** (hexagon), **boss** (octagon)
- 10 waves, money from kills, AI Core health, win/loss screens
- Tower XP (final-hit only for v1), upgrade eligibility, paid linear upgrades (L1–L5)
- Persistent tower roster + starter skill tree in localStorage, reset button
- Skill tree starters: +10% laser dmg, +10% pulse dmg, +10% slow duration,
  +10% money/kill, +10% XP gain, +5 core health. 1 skill point per level completed.

## Non-goals for the prototype
Multiplayer, accounts, backend, ads, IAP, procedural levels, campaign map,
branching tower specializations, big tutorial, sound system.

## Design principles
Mobile-first, portrait-first, touch-first (mouse also works). Clean readability
over visual complexity. Data-driven levels and waves — tuning lives in
`src/config.js` (global) and `src/levels.js` (per map/wave/group). Small working
increments; maintainable over clever; stability over features.

## Build checkpoints
- **A** — grid, animated path, enemy waves, core health, win/loss shell ✅
- **B** — tower placement (touch+mouse), all 3 towers firing, projectiles, effects ✅
- **C** — money/XP economy, upgrade panel, 10 tuned waves, real win/loss ✅
- **D** — localStorage persistence: roster, skill tree, reset button ✅

## Campaign (5 levels, July 2026)
1. **First Contact** — entry level; beatable fresh with good play, punishes sloppy openings
2. **Signal Breach** — short path, denied corners; veterans give the edge
3. **Dark Relay** — edge-hugging path, walled center; requires a leveled roster (fresh optimal play loses)
4. **Split Second** — brutally short path, big opening bankroll, fast enemies; post-L3 roster wins ~6/10 core
5. **Core Siege** — spiral with 3 interior triple-coverage pockets; same roster LOSES with perimeter tactics, wins from the pockets — a tactics puzzle

Difficulty philosophy (user): each level should not fall on the first try —
only through leveling up or changing tactics.

## Visual style (GeoDefense-inspired, July 2026)
Additive-blended neon: hit sparks, polygon-shard death explosions (enemies
shatter into their own edges), pre-rendered glow sprites (no per-particle
shadowBlur — mobile Safari perf), and a Geometry Wars spring-mesh warping
grid (nodes at half-tile spacing; shocks from deaths/explosions/leaks).
Tuning in config.js VFX — currently SUBTLE (5px displacement clamp,
400-particle cap). Path is a dark outlined channel; towers slimmer (0.22
tile radius); enemy health is an arc, not a bar; HUD/tray compacted.

## Batch 2 (levels 6-10, July 2026)
- **Railgun Tower** (R-xx): 100 cost, 60 dmg, 3.5 range, 2.5s interval,
  PIERCES all enemies along the beam. Unlocked by clearing level 5.
  Rail Overcharge added to skill tree.
- **Splitter** (orange square): splits into 2 fast splitlings on death.
  **Regenerator** (acid pentagon): heals 5%/sec — burst counters it.
- Per-level palettes via level.palette: Ember, Toxic, Ultraviolet,
  Glacier, Solar. Enemy/tower colors stay fixed for readability.
- Calibration: L7 tense win w/ campaign-1 roster; L9 kills that roster
  ~wave 4 (needs batch-2 veterans); L10 costs a near-maxed roster half
  its core. L6 is the soft opener — may need a bump after playtests.

## Backlog (user-requested)
- Split XP among damage contributors so Slow towers can level (currently final-hit only)
- Possibly stiffen level 6 if real play finds it too easy

Done from backlog: speed controls (0.5x/pause/2x in HUD), VFX raised from
"subtle" to "pizzazz" tuning + effects scale with the firing tower's level,
RESTORE renamed to UPGRADE, RESET ALL PROGRESS on the main menu.
Later: fireworks-level impact sparks (9 base/hit + streak trails + white-hot
mix, 900 cap), SELL button (50% of build+upgrade cost, roster record kept),
skill tree reworked to 5 tiers per skill (costs 1/1/2/2/3 pts, +10%/tier;
old boolean saves migrate automatically), skill overlay z-index bug fixed.

**Phase 1 complete** (July 2026). Roster rules implemented: veterans auto-deploy
(best maxLevel first) when placing their type; they re-enter battle at level 1
and can be RESTOREd to their unlocked level with money alone; beyond that, XP
rules apply. 1 skill point per battle won. Save key: `geometric-td-save-v1`.

The full original brief lives in the project chat history; this file is the
working reference.
