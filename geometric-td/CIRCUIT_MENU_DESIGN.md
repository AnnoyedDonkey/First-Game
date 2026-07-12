# Circuit-Board Main Menu — Build Spec

Approved design (2026-07-12, Fable session). Interactive mockup:
`mockups/circuit-menu-mockup.html` — **the mockup is the visual contract**;
when in doubt, match it. Serve the folder (`serve.ps1`, port 8420) and open
`/mockups/circuit-menu-mockup.html` to see it.

Build one phase per fresh session (`/clear` between). The handoff is the
committed files + the "Build status" checkboxes at the bottom, not the
conversation. After each phase: verify in-browser, bump `src/version.js`
APP_VERSION, commit, push.

## 1. What changes

The main-menu level select (`ui.js renderWorld` and its DOM in
`index.html` / `styles.css`) is replaced: instead of a vertical list of
level rows, each world renders a full-screen **neon circuit board** (SVG
in the DOM, not canvas) whose 5 levels are circular "chips" wired
together top-to-bottom by a main trace, plus decorative dead-end traces
and pads.

Per-world board languages (echo each world's in-game palette):

- **INNER GRID** — cyan `#22d6ff`; orthogonal PCB traces, 90° bends,
  round via pads.
- **OUTER VOID** — amber `#ff9d3c`; 45° diagonal traces, hexagonal pads.
- **PRISM DEEP** — magenta `#e05cff`; radial shard lines + concentric
  arcs converging on a center point.

Node states (all readable WITHOUT tapping — approved rules):

- **Cleared:** filled glowing circle + level number; the connector trace
  to the next node lights in the world accent and carries a slow white
  energy pulse (dash-offset animation).
- **Frontier** (next uncleared, world unlocked): hollow circle, pulsing
  outer ring.
- **Locked:** dim dashed ring + 🔒. Whole world locked = every node
  locked + the existing unlock banner text.
- **Endless:** a small **∞ pad** wired off the node's lower-right —
  appears only once the level is cleared; green-dim stroke when unlocked
  but unplayed, hot-pink glow once `endlessBest > 0`.
- **Milestones:** a **segmented tick-ring** around cleared nodes — one
  arc segment per milestone, lit gold when achieved. Ring appears ONLY
  once the level is cleared (user decision: no empty teaser ring).
  Segment gap shrinks when a track has >10 milestones so 20 fit (see
  mockup `tickRing`, `gapDeg`).

Tap a node → **bottom sheet** (same visual family as the gear screen's
sheet): level name, flavor `desc`, status chips (✓ CLEARED / ∞ ENDLESS
best wave / ★ n/total), full milestone list (wave threshold + reward,
gold when achieved), PLAY / ENDLESS buttons. Locked levels show why
they're locked instead of the milestone list.

**Unchanged:** world paging (◀ ▶ arrows + `bindWorldSwipe` horizontal
swipe), the pinned `#menu-actions` footer (SKILLS/TOWERS/STORE/BOARD +
RESET), world-lock rules (`isWorldUnlocked`), `pick()`/HUD toggling, and
all progression plumbing. This is a `renderWorld` body replacement plus
one new sheet.

## 2. Known gotchas that apply here

- `#level-overlay` z-index is 30; skill tree (40) must stay on top. The
  new bottom sheet lives INSIDE `#level-overlay` (like the gear sheet
  lives inside `#gear-overlay`) so it never fights other overlays.
- Any new nested flex row needs `min-width: 0` (HANDOFF "Tower panel"
  gotcha).
- Multi-file deploys can serve mixed versions for a minute — belt-and-
  suspenders any new save/config reads (HANDOFF "Running it").
- Swipe-vs-scroll: the board is one non-scrolling SVG, so the old
  horizontal-dominant swipe guard still works; keep `touch-action:
  pan-y` on the SVG so taps stay responsive.
- No framework, no build step. SVG is built as a string and assigned via
  `innerHTML`, exactly like the mockup.

## 3. Phases

### M0 — Data groundwork (no visible change)
- `levels.js`: add a short `desc` string to every level (write fresh
  flavor text in the game's voice; the mockup's are placeholders — keep
  each ≤ ~140 chars). Header comment documents the field.
- `levels.js WORLDS[i]`: add `accent`, `accent2`, `boardStyle`
  (`"grid" | "diagonal" | "prism"`), and `nodePos` (array of `{x,y}` in
  the board's 0–100 × 0–130 viewBox space; start from the mockup's
  `LAYOUTS`). Adding a world stays a data edit.
- `config.js`: milestone entries get a human `label` (e.g. "Reach wave
  20") OR a small formatter helper in ui.js derives label + reward text
  (`◆ 350` / `RARE LOOT` / `SINGULARITY`) from the existing fields —
  builder's choice, but the sheet must not hardcode reward strings.
- Verify: game runs, menu unchanged, no console errors.

### M1 — The board
- Replace `renderWorld`'s level-row loop with the SVG board:
  `#level-list` becomes the board host (`flex: 1`, board fills it,
  `preserveAspectRatio="xMidYMid meet"`). Port from the mockup:
  `decoTraces` (all three styles), `connector` (per-style path between
  consecutive nodes), `tickRing`, node rendering for all states, the
  ∞ pad, the vignette rect, the glow filter.
- Wire node data from real progression: `completedIds`,
  `getBestEndlessWave`, `getEndlessMilestones`, `isWorldUnlocked`.
  Frontier = first level of the world not in `completedIds` (world
  unlocked only).
- Node tap targets: invisible r≈13 hit circle per node (mockup pattern);
  for M1 tapping a node can directly `pick(level, false)` for cleared/
  frontier nodes (sheet comes in M2).
- Locked-world preview: render the board with every node in the locked
  state + the existing banner text.
- Keep `appendGlobalMenuButtons()` and the world-nav header exactly as
  they are.
- Verify: all three worlds render on a phone-shaped viewport; a seeded
  save shows cleared/frontier/locked/∞/tick-ring states; footer never
  scrolls away; world swipe still works; no z-order regressions
  (skill tree still opens on top).

### M2 — The detail sheet
- New bottom sheet inside `#level-overlay` (own ids, e.g.
  `#level-sheet` + `#level-sheet-veil`), styled per the mockup: title in
  world accent, LEVEL n — WORLD tag, `desc`, status chips, milestone
  list (tick + label + reward, `.done` gold treatment), PLAY / ENDLESS
  buttons.
- Node tap now opens the sheet (replacing M1's direct pick). PLAY →
  `pick(level, false)`; ENDLESS → `pick(level, true)` (disabled until
  cleared). Veil tap closes. Locked node: sheet still opens, shows the
  lock reason, PLAY disabled.
- Milestone rows come from `getEndlessMilestones(level.id)` + the M0
  label/formatter — already per-level, so a future 20-entry track
  renders automatically.
- Verify: every state reachable (locked world, locked level, frontier,
  cleared with/without endless best, milestones partially claimed);
  buttons start the right mode; sheet scrolls if content overflows.

### M3 — Pizzazz + polish
- Energy pulse traveling along cleared connectors (mockup `trace-flow`),
  frontier ring pulse, ∞ pad glow. All behind
  `prefers-reduced-motion` (match U4's pattern).
- Entry flourish when the board renders or the world flips (e.g. traces
  draw in / nodes ignite in sequence — keep it < 500ms, it runs on
  every world swipe). Err dramatic; the user will say if it's too much.
- Perf sanity on iPhone: SVG glow filters can be heavy — if the board
  janks, swap `filter="url(#glow)"` for pre-blurred strokes or CSS
  `drop-shadow` and re-test.
- Verify on the deployed build on the user's iPhone (this phase is
  feel, not correctness).

### M4 — 20-milestone readiness (data-shape only, content later)
- Restructure `ENDLESS_REWARDS` so a milestone track can be per-level
  (e.g. `tracksByLevel[levelId] ?? defaultTrack`) without changing the
  save format (`endlessRewards[levelId]` claimed-id sets already keyed
  by milestone id — keep ids stable).
- `getEndlessMilestones` / `grantEndlessRewards` read through the new
  shape; tick-ring + sheet already handle any count.
- Do NOT author the 20-milestone content here — that's a later balance/
  content pass with the user.
- Verify: existing 5-milestone saves migrate cleanly (claimed sets
  untouched), grants still fire exactly once, ★ readouts correct.

## 4. Suggested model per phase

| Phase | Model | Why |
|-------|-------|-----|
| M0 | Sonnet | Mechanical data edits + flavor text; cheap, low risk. |
| M1 | Opus (or Fable) | Biggest phase: SVG port, state wiring, layout — where the flexbox/z-order gotchas live. |
| M2 | Sonnet | Sheet is a known pattern (gear sheet); mockup HTML is a near-direct port. |
| M3 | Opus | Animation feel + mobile perf judgment calls. |
| M4 | Sonnet | Careful but small refactor with a clear invariant (stable milestone ids). |

## 5. Build status

- [x] M0 — data groundwork (`desc`, WORLDS board fields, milestone labels)
- [x] M1 — SVG circuit board replaces level rows (2026-07-12). `renderWorld`
  in `ui.js` now builds the mockup's board as an SVG string into `#level-list`
  (new `.board-host` mode in styles.css: non-scrolling frame, `min-width:0`
  safe). Ported helpers: `boardDecoTraces` (grid/diagonal/prism),
  `boardConnector`, `boardTickRing`, `buildBoardSvg`. Node states derived from
  progression (cleared/frontier/locked; locked-world = all-locked preview +
  banner overlay). Hit targets painted last: node→`pick(level,false)`,
  ∞ pad→`pick(level,true)` (M1 launches directly; the detail sheet is M2).
  `trace-flow`/`frontier-pulse` animations gated behind
  `prefers-reduced-motion`. Verified in-browser (mobile viewport, seeded save
  across all three worlds): every node state, campaign + endless launch,
  pinned footer, skill-tree z-order intact, no console errors. APP_VERSION →
  2026.07.12-3, pushed to main.
- [ ] M2 — level detail bottom sheet
- [ ] M3 — pizzazz + iPhone perf pass
- [ ] M4 — per-level milestone tracks (20-ready data shape)
