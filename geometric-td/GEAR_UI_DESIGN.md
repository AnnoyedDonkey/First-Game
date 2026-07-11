# Geometric TD — Gear UI Redesign Spec

Build spec for the redesigned tower/gear interface. **Read `HANDOFF.md` first**
(architecture, constraints, verification recipe), and `LOOT_DESIGN.md` for the
loot system this UI sits on top of (P0–P6 shipped).

Status: **U0, U1, U2, and U3 shipped. Remaining: U4, U5.**
Update the "Build status" checkboxes as
phases land. Token strategy is the same as LOOT_DESIGN §14: **one phase per
fresh session, `/clear` between; the handoff is the committed files + these
checkboxes, not the conversation. No subagents.**

**Approved interactive mockup: `mockups/gear-ui-mockup.html`** — open it in a
browser before building any UI phase; it is the visual source of truth (user
approved it enthusiastically). It's a self-contained static file with fake
data; serve it or open directly (no ES modules in it, `file://` works).

---

## 0. Why (assessment of the old GEAR panel)

The shipped P4 GEAR panel is one flat scroll of text rows (pending / equipped /
stash). At scale (30 towers, 40 items) it fails:

- ~170 rows in one scroll; EQUIPPED renders 4 slot lines per tower even when
  all empty.
- Equip flow is item→tower via a 30-entry `<select>` — backwards; players
  think tower-first ("gear up my Railgun").
- No comparison, no sort/filter, no icons — a log file, not a loot screen.
- Every action calls `renderGearPanel()` → full rebuild → **scroll resets to
  top** (worst single defect).
- Inline SELL with no confirm; small touch targets.
- Redundant with the main-menu TOWERS (Tower Guide) overlay.

User-provided reference screenshots (mecha-TD style): icon tiles in a grid,
rarity = tile glow, slot glyph on the tile, tap → detail popup with big
action buttons, character-centric equip screen, one Filter button, badges.
Icons over text everywhere.

---

## 1. New rules (user-decided, these change game logic, not just UI)

### 1a. Mastery-1 equip gate
A tower **cannot equip anything until Mastery rank ≥ 1** (~8,300 career XP).
Supersedes LOOT_DESIGN §2c's "Common/Enhanced at maxLevel 1–5"; the per-item
reqLevel/reqMastery fields and Rare ≥1 / Prismatic ≥10 / Singularity ≥20
gates stay as-is on top of it.

**Grandfathering:** towers already wearing gear but below Mastery 1 keep it
(functional, shown); they just can't equip anything *new*. No migration, no
surprise unequips. Enforce in the equip path (`equipment.js canEquipItem` +
UI), never by stripping saves.

### 1b. Auto-equip on earn
When loot is earned (kill drop, guaranteed end-drop, Endless milestone — NOT
store purchases), instead of always going to pendingLoot:

1. Find eligible towers: Mastery ≥ 1, meets the item's req, type-compatible,
   and the item's **slot is empty** on that tower.
2. Priority: highest Mastery rank, tie-break career maxLevel, then XP.
3. Auto-equip **fills empty slots only — never replaces** an equipped item.
4. No taker → stash (or pendingLoot/triage only if the stash is full, same as
   today).
5. The end-of-battle summary lists what happened per item:
   "▲ RARE EMITTER → Rocket-01" or "→ STASH". The loot moment must stay
   visible — don't let auto-equip eat the dopamine (see §4 reveal).

Knobs: `config.js LOOT.autoEquip = { enabled: true, fillEmptyOnly: true }`
(priority order can be hardcoded; expose if the user asks).

This mostly dissolves the UNCLAIMED DROPS triage section: it only appears
when the stash is genuinely full.

### 1c. Merge the TOWERS menu into this screen
The old main-menu TOWERS entry (Tower Guide overlay) is **deleted**. One menu
entry — **TOWERS** — opens the new two-tab screen (TOWERS / STASH). The GEAR
menu entry is deleted too (its `N NEW` badge moves to the TOWERS button).

Absorbed from the old overlay:
- The specialties/mastery explainer text → a small `?` button in the new
  screen's header, opening the same text as a bottom sheet. The
  auto-open-at-level-2 (`seenTowerGuide` flag) points at this sheet now.
- Sub-Mastery-1 towers: the "N more towers unlock gear at ★1" footer expands
  on tap into a dim compact list (name + LV/★, no slot row, still tappable
  for the stat detail sheet). No tower becomes invisible.

### 1d. Longer roster names
Roster names change from `L-01`/`K-01` to **`Laser-01`, `Pulse-01`,
`Slow-01`, `Railgun-01`, `Rocket-01`**. This is display-side where possible,
BUT roster records key gear/veteran logic by `rec.name` — decide in U2
whether to (a) migrate saved names once (safer long-term; follow the
`migrateSkills` pattern, map prefix `X-NN` → `FullName-NN`, keep uniqueness)
or (b) keep stored short names and format for display only. **Prefer (a)** —
one migration beats a formatting shim in every render path. In-battle canvas
labels can stay short if space demands (renderer decision, check on phone).

---

## 2. Screen spec (matches the mockup — open it, this is just the contract)

One overlay replacing `#gear-overlay` and the Tower Guide. Header: `GEAR`…
actually title it **TOWERS**; wallet line `◆ N · STASH n/50`; `?` guide
button. Two tab buttons: TOWERS / STASH, magenta `N NEW` badge on STASH.

### 2a. TOWERS tab
- One card per Mastery-1+ tower, sorted by Mastery desc: header row =
  tower name in class color + `LV n · ★n ›` (tappable → stat sheet), below a
  4-wide row of square slot tiles (OPTIC/EMITTER/CAPACITOR/FRAME).
- Slot tile: neon SVG/canvas glyph (◎ optic crosshair-circle, ▲ emitter
  triangle, ⚡ capacitor bolt, ▣ frame double-hex), border+glow = rarity
  color when filled; dim dashed border when empty. Singularity tiles pulse
  (CSS animation, respect `prefers-reduced-motion`).
- Tap empty slot → **picker sheet**: compatible stash items for that slot
  (sorted rarity desc), one row each with glyph, name in rarity color, affix
  summary line, UNIV/type tag. Tap row = equip.
- Tap filled slot → **item sheet** (see 2c) with UNEQUIP.
- Tap tower header → **stat sheet**: 2×2 grid (DAMAGE + mastery %, FIRE
  RATE, DPS in class color, RANGE — "GLOBAL" for rocket), kills; then
  PERMANENT BONUSES (mastery line, specialty line) and GEAR BONUSES (one
  line per equipped item, left-border in rarity color, affix text).
  Stats come from config + career record (career maxLevel stats, not
  in-battle).
- Footer: "N more towers unlock gear at ★1 MASTERY" → expands per §1c.

### 2b. STASH tab
- Header row: item count + sort note; filter chips (4 slots + 5 rarities,
  single-select toggle each group).
- 5-wide grid of square tiles: glyph in rarity color, rarity border/glow,
  first letter of type-lock in the corner, magenta NEW tag on unseen items
  (cleared when the item's sheet is opened).
- Sort: rarity desc, then ilvl desc.
- Tap tile → item sheet.
- Bulk-sell lives with the filters (e.g. long-press a rarity chip or a
  SELL ALL button appearing when a rarity filter is active — builder's
  choice, keep it one tap + confirm).

### 2c. Item sheet (shared)
Bottom sheet, slides up (0.2s). Title: glyph + name in rarity color.
Sub-line: RARITY · SLOT · UNIVERSAL/X-ONLY · REQ · ILVL (+ "EQUIPPED ON
name" when opened from a slot). Affix rows (unique rows border-tinted gold /
magenta). Actions: EQUIP (→ tower-target sheet listing eligible towers,
each row showing what would be swapped out) + SELL ◆n, or UNEQUIP.
Sell confirm: tap-again only for Prismatic/Singularity.

### 2d. Non-negotiable mechanics
- **Scroll preservation**: re-render in place (save/restore `scrollTop` or
  update rows surgically). The old full-rebuild-reset bug must not return.
- All strings HTML-escaped (existing `escapeHtml`).
- `min-width: 0` on any new nested flex row (HANDOFF flexbox gotcha).
- Overlay z-order: keep below skill tree (40); reuse the existing overlay
  layer conventions.

---

## 3. STORE redesign (follow-up, same visual language)

Restyle the STORE overlay with the same tile + sheet components: stock as a
5-tile row (rarity glow, glyph), tap → item sheet with BUY ◆n (disabled when
unaffordable / stash full), REROLL ◆n button styled like the mockup's action
buttons. No logic changes — P5 store logic stays. Purchases do NOT auto-equip
(§1b). Do this only after U1–U3 land so the components exist to reuse.

---

## 4. Pizzazz (user: "err dramatic")

- **Drop reveal** on end-of-battle summary: rarity-colored radial burst +
  card scale-in per item (mockup has the exact animation), line shows
  auto-equip destination. Chain multiple drops one at a time, tap to advance.
- Singularity tiles shimmer/pulse everywhere they appear.
- Equip action: brief flash on the slot tile.
- All CSS/canvas, no deps; respect `prefers-reduced-motion`.

---

## 5. Build status & phase plan

Model + effort per phase (same logic as LOOT_DESIGN: track reasoning needed,
not size; bump to High if a phase flails). **Bump `src/version.js
APP_VERSION` on every push.** Verify per HANDOFF (`window.game`, `step()`,
plus eyeball on phone for UI phases).

| Phase | Model | Effort | Why |
|---|---|---|---|
| U0 Rules (gate + auto-equip) | Opus | High | policy edge cases across drops/milestones/stash-full/triage + save safety |
| U1 Tiles + STASH tab | Sonnet | High | new component system + scroll-preserving render; sets patterns U2/U3 copy |
| U2 TOWERS tab + sheets + name migration | Sonnet | High | picker/equip flows + the rec.name migration touches roster identity |
| U3 Menu merge + guide + locked list | Sonnet | Medium | deletion + rewiring existing entries |
| U4 Pizzazz pass | Sonnet | Medium | CSS/canvas animation, isolated |
| U5 STORE restyle | Sonnet | Medium | reuse U1 components, no logic change |

- [x] **U0 — Rules first (no UI).** DONE (2026-07-11). Mastery-1 equip gate
      (grandfathered per §1a) in `equipment.js canEquipItem` (new failure
      reason `"masteryGate"`, checked before per-item reqs — the old GEAR
      panel's tower `<select>` filters through `canEquipItem`, so it picked
      up the gate for free); auto-equip pipeline (§1b) in `progression.js`
      (`bankEarnedItem` — kill drops + end-drop via `recordRunLoot`, Endless
      milestone loot via `grantEndlessRewards`; store buys untouched);
      summary data on `game.lootResult.placements` (`{item, dest, towerName?,
      displaced?}`, dest = equipped/stash/pending) + `placement` on granted
      milestones, rendered as plain text by main.js `placementText()` in
      `lootLine`/`endlessRewardLine`. Knobs: `LOOT.equipGate.minMastery`
      (rank 1 = 1,100 career XP on the current curve — the ~8,300 in §1a is
      stale) and `LOOT.autoEquip { enabled, fillEmptyOnly }`;
      `enabled: false` reverts to the old everything-into-pendingLoot flow,
      `fillEmptyOnly: false` lets drops replace strictly lower-rarity gear
      (displaced item → stash). Note earn destination changed: with no
      equip taker, loot now lands in the STASH directly; pendingLoot/triage
      only when the stash is full (per §1b.4). Verified via scripted
      `recordRunLoot`/`recordEndlessResult` runs in the browser (all §5
      scenarios: priority by Mastery, never-replaces, stash fallback,
      stash-full → pending, sub-★1 excluded, store buys direct-to-stash,
      milestone loot through the pipeline, grandfathered gear still
      aggregates) + one real bot battle to a loss (placements correct;
      overlay text itself not eyeballed — rAF is suspended in the test
      pane, check on phone).
- [x] **U1 — Tile components + STASH tab.** DONE (2026-07-11). New overlay
      shell (`#gear-overlay`: header/wallet/`?` guide sheet/tabs/scroll,
      `ui.js` "Gear overlay" section), SVG slot-glyph renderer (`slotGlyph`
      — stroke-only, no per-tile `<filter>` since ids would collide across
      a grid; glow comes from the tile's own CSS box-shadow instead),
      rarity tile styles (`.gear-tile`/`.item-tile` + `.rc/.re/.rr/.rp/.rs`
      in styles.css), STASH tab (5-wide grid, slot+rarity filter chips,
      rarity-desc/ilvl-desc sort, SELL ALL <rarity> with tap-again confirm
      when a rarity filter is active), shared item bottom-sheet (`#gear-
      sheet`) with SELL (+tap-again confirm on Prismatic/Singularity) and
      EQUIP→tower-target sheet (`openEquipTargetSheet`, lists eligible
      roster towers via the existing `canEquipItem`, shows swap-out vs
      empty-slot). Scroll position (`el.gearScroll.scrollTop`) is saved/
      restored around every in-place `renderGearPanel()` call — verified
      by filtering, equipping and selling without the view jumping. Old
      flat GEAR panel fully replaced; the pendingLoot/triage strip survives
      as a restyled tile row (`#gear-triage`) at the top of STASH,
      CLAIM/LEAVE unchanged. New: a small `state.seenLoot` id-list backs
      the magenta NEW badges (`progression.js isItemSeen/markItemSeen/
      countUnseenStash`, pruned to ids still in the stash) — cleared when
      an item's sheet is opened; the main-menu GEAR button badge now
      counts pending+unseen instead of just pending.
      **Also folded in most of U2** while the same components were live in
      context: the TOWERS tab (tower cards, 4-wide slot tiles, tap-empty→
      picker sheet, tap-filled→item sheet with UNEQUIP, tap-name→full stat
      sheet with a 2×2 DAMAGE/FIRE RATE/DPS/RANGE grid, PERMANENT BONUSES
      and GEAR BONUSES — `towers.js careerStatsFor`, a pure career-best-
      level version of `recomputeStats` for menu display) and the locked-
      tower footer (collapsed count only, per U2's scope — expansion into
      a tappable list is still U3). Verified end-to-end in a live browser
      session against a seeded save (mixed rarities/slots/tower-types):
      filter chips, sort, triage claim/leave, item sheet EQUIP/SELL(+
      confirm)/UNEQUIP, picker sheet type/mastery filtering, equip-target
      sheet mastery gating (a ★20-req Singularity correctly excluded a
      ★17 tower), tower stat sheet (gear affixes visibly changing RANGE),
      NEW-badge clearing, scroll/filter preservation across re-renders. No
      console errors. Not yet done at the time: roster name migration
      (§1d) and the menu merge (§1c) — the former shipped as "U2
      remainder" below, the latter is still U3.
- [x] **U2 remainder — name migration.** DONE (2026-07-11). Took option (a):
      `progression.js migrateRosterNames()` (mirrors `migrateSkills`, runs
      at module load + inside `resetProgress()`) rewrites `state.roster[i]
      .name` from `X-NN` to `FullName-NN` by looking up `TOWERS[rec.type]
      .rosterPrefix` — keyed off `rec.type`, not the old letter, so it's
      immune to the L/R/K ambiguity. Idempotent (skips names already in
      the new form) and keeps each tower's existing number, so counters
      and veteran identity survive untouched. New `config.js TOWERS[...]
      .rosterPrefix` field (`Laser`/`Pulse`/`Slow`/`Railgun`/`Rocket`)
      drives both the migration and `towers.js nextRosterName`; the old
      single-letter `prefix` field stays put — it still backs the STASH
      tile's 1-character corner "lock-dot" glyph (`ui.js tileHtml`), which
      must stay a single glyph and must NOT collide (Railgun/Rocket both
      start with the same letter if naively derived from the long name —
      the approved mockup actually has this exact collision via `lock[0]`;
      the real game avoids it by keeping the dedicated `L/P/S/R/K` letters).
      Also updated the three `-ONLY` text tags (item title, item-sheet sub-
      line, picker-sheet `pr-tag`) to show the full type name
      ("RAILGUN-ONLY" not "R-ONLY"), matching the mockup's `lock.toUpperCase()
      + "-ONLY"` exactly — these have room for the full word and aren't the
      cramped corner dot. Verified live in-browser: seeded an old-format
      save (`L-01`/`K-02`/`R-01`), confirmed migration output, confirmed
      new tower placement continues numbering with no collision
      (`Laser-02`, `Rocket-03`), confirmed the TOWERS tab cards/STASH tiles/
      item sheet/equip-target sheet/picker sheet all display correctly, and
      confirmed a full equip round-trip (stash → equipped) still resolves
      by the migrated name. No console errors.
- [x] **U3 — Menu merge.** DONE (2026-07-11). Deleted the standalone
      `#tower-overlay` (markup in `index.html`, its CSS block, and the
      `openTowerGuide`-as-Tower-Guide implementation in `ui.js`) and the
      separate GEAR main-menu entry. `appendGlobalMenuButtons` now renders
      one **TOWERS** button that opens the gear/tower screen directly and
      carries the old GEAR button's `N NEW` badge (pending + unseen stash
      count) / stash-size fallback. The old overlay's two cheat-sheets
      (TOWER CLASSES stats/role/specialty per class, KNOW YOUR ENEMY
      weak/resist text) weren't in the U0-era `?` sheet's scope but were
      real content — folded them into `openGearHelpSheet` via a new
      `guideExtrasHtml()` helper (reuses the shared `.tower-section`/
      `.skill-row` classes) so nothing was lost; the old overlay's "YOUR
      ROSTER" listing was dropped since the TOWERS tab's cards already
      cover it. `openTowerGuide` is kept as an exported name in `ui.js`
      (main.js's level-2 first-visit import is unchanged) but now means
      "open the gear panel straight into its `?` guide sheet" —
      `openGearPanel(); openGearHelpSheet();`. Locked (sub-★1) towers:
      the footer note is now a tappable toggle (`lockedListOpen`
      module state, reset on panel open) that expands into a dim
      `.locked-tower-row` list — name + `LV n · ★n`, no slot row per spec
      — each row still opens the full tower stat sheet via the existing
      `openTowerStatSheet`, which already worked for gear-ineligible
      towers (empty `gear` object, mastery rank just renders as ★0).
      Verified live in-browser: seeded a save with one ★1+ tower (card)
      and one sub-★1 tower (collapsed into the locked note), toggled the
      list open, confirmed the locked tower's stat sheet opens with
      correct LV/★/DPS; confirmed `#tower-overlay` no longer exists in the
      DOM; confirmed the `?` sheet contains both TOWER CLASSES and KNOW
      YOUR ENEMY text; confirmed `openTowerGuide()` (the level-2 auto-open
      path) opens the gear overlay with the guide sheet on top. No console
      errors.
- [ ] **U4 — Pizzazz.** Drop-reveal sequence on end-of-battle, equip flash,
      Singularity shimmer (§4).
- [ ] **U5 — STORE restyle.** §3.

Dependencies: U0 independent (do first — it also makes the game nicer with
the OLD UI). U1 → U2 → U3 strictly ordered. U4/U5 after U3, either order.

Note: LOOT_DESIGN **P7 (balance pass)** is still pending and independent of
this track; do it whenever, but after U0 so auto-equip's effect on geared
veterans is included in the sims.
