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

## Backlog (user-requested)
- Fast-forward button: toggle 2x game speed during waves (DEBUG.gameSpeed exists;
  needs a UI button + probably per-battle, not global)
- Split XP among damage contributors so Slow towers can level (currently final-hit only)

**Phase 1 complete** (July 2026). Roster rules implemented: veterans auto-deploy
(best maxLevel first) when placing their type; they re-enter battle at level 1
and can be RESTOREd to their unlocked level with money alone; beyond that, XP
rules apply. 1 skill point per battle won. Save key: `geometric-td-save-v1`.

The full original brief lives in the project chat history; this file is the
working reference.
