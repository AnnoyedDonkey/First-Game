# Roguelike Gear-Visual Reuse — Build Plan

**Status:** approved 2026-08-30. Goal: the roguelike mode should reuse the main
game's gear presentation instead of its own weaker parallel copies. Today the run
gear-reward / shop / roster screens show **text-only** item cards — no slot icon,
no rarity-glow tile, no mod power values, and equipping into an occupied slot is
**blind** (no compare-vs-equipped). The campaign gear UI (`ui.js`) has all of
this. We extract the campaign's pure presentation primitives into a shared leaf
module and adopt them in the run.

Read `HANDOFF.md`, `CLAUDE.md`, and `ROGUELIKE_REDESIGN_PLAN.md` first — this
plan assumes them. This file is the **cold-read source for each delegated
Sonnet phase**.

## Delegation model

Each phase is a cold read of its section here. **Phase 1 was built by a Sonnet
agent (DONE — see AS BUILT below). Phases 2–3 are delegated to Codex Sol
(`--model gpt-5.6-sol --effort high`)** per the user's instruction (2026-08-30).
The **Opus orchestrator**: reviews every diff for intent, does ALL in-browser
verification at 375px, bumps `src/version.js` once at the end, and commits +
pushes. Phases run **strictly sequentially** (2 depends on 1's module; 3 depends
on 2). Phase 4 is deferred until 1–3 are shipped and eyeballed on a phone.

Codex cannot verify in a browser here (serve.ps1 can't bind under its sandbox);
real-browser verification is the orchestrator's job. Codex reviews per HANDOFF's
"Delegating work to Codex" section: stage only the named files, no version bump,
no commit, review the diff for intent not just literal instruction-following.

## Cardinal constraints (every phase — do not violate)

- Plain HTML5 / Canvas 2D / vanilla-JS ES modules. No framework, build step, or
  dependency. (CLAUDE.md)
- **Preserve the one-directional import graph.** `ui.js` must NOT import
  `roguelike-ui.js`, and `roguelike-ui.js` must NOT import `ui.js`. Both import
  the NEW leaf module `src/gear-visuals.js`. The leaf imports only from
  `i18n.js`, `config.js`, `affixes.js`, and `equipment.js` (all confirmed
  cycle-free leaves). Do NOT make `gear-visuals.js` import `ui.js`,
  `roguelike-ui.js`, `main.js`, `game.js`, `towers.js`, or `renderer.js`.
- **Sandbox contract (roguelike):** run logic never reads/writes the real save
  (`geometric-td-save-v1`). These are UI-only phases — do not touch
  `roguelike.js` run-state, `recordBattleEnd`, `syncRoster`, or `game.isRun`
  guards. The real save must stay byte-identical across a full run + reload.
- **Stage only the files each phase names.** Never `git add -A` (the tree holds
  unrelated in-flight work). Do NOT bump `src/version.js`. Do NOT `git commit`.
- Keep the game runnable after every phase; the campaign and co-op paths must be
  behaviorally unchanged when not in a run.
- Target iPhone Safari portrait, touch-first; mouse must work too. No horizontal
  scroll at 375px. Respect `prefers-reduced-motion`.
- **You (the Sonnet agent) cannot verify in a browser here.** Report exactly what
  you did and did NOT verify. When unsure, say "I could not verify this" — do not
  imply coverage. The orchestrator does the real-browser pass.
- **i18n:** new player-facing strings use `t("key", "ENGLISH")` /
  `tf("key", "ENGLISH {x}", {x})` inline English fallbacks. **Do NOT add French
  to `src/lang/fr.js`** — French is deferred (see "Deferred work" below); the
  orchestrator will handle it in a later pass.

---

## PHASE 1 — Create `src/gear-visuals.js` + migrate `ui.js` to it — **Sonnet — AS BUILT (2026-08-30)**

**Shipped & orchestrator-verified in-browser.** New `src/gear-visuals.js`
exports 22 symbols: the moved primitives (`RARITY_COLOR/CLASS/ORDER`,
`SLOT_LABEL`, `slotLabel`, `rarityLabel`, `slotGlyph`, `affixDef`, `affixLabel`,
`modName`, `modPower`, `modPowerValue`, `modPowerSuffix`, `modPowerText`,
`itemStatMap`, `itemTitle`, `itemUniqueName`, `modFaultBadgesHtml`, `escapeHtml`)
plus the new builders `compareRowsHtml(current, incoming)`,
`gearTileHtml(item, opts)`, `gearTileEmptyHtml(slot, opts)`. Imports only
i18n/config/affixes/equipment (no cycle). `ui.js` imports them and its duplicate
definitions are deleted; `openCompareSheet` calls `compareRowsHtml`;
`renderTowersTab` calls `gearTileHtml`/`gearTileEmptyHtml` (data-attrs passed via
`opts.dataAttrs`, `just-equipped` via `opts.justEquipped`). Zero visual/behavior
change confirmed: agent's byte-for-byte builder tests (8 cases) pass; live
campaign gear panel renders identical tiles (rare `rr` class, glyph, correct
data-attrs); `compareRowsHtml` renders valid delta rows; clean load, no console
errors. **Note:** the plan's `ui.js` import list included `SLOT_LABEL`,
`itemStatMap`, `modPowerValue`, `modPowerSuffix` — after extraction these have no
remaining `ui.js` call sites, so they were correctly left out of `ui.js`'s import
(still exported for Phases 2–3). Original spec below.

**Goal:** a new shared leaf module holding the campaign's pure gear-presentation
primitives, with `ui.js` rewired to consume them. This is a **strict zero
visual/behavior-change refactor** of `ui.js` — the campaign gear panel, item
sheets, and compare sheet must look and behave identically afterward.

**Files (stage exactly these):** `src/gear-visuals.js` (new), `src/ui.js`.

### 1.1 New module `src/gear-visuals.js`

Move these definitions **out of `ui.js`** and into the new module as `export`s
(cut from `ui.js`, paste here — keep the bodies identical unless noted):

- Constants: `RARITY_COLOR` (ui.js ~L1731), `RARITY_CLASS` (~L1735),
  `RARITY_ORDER` (~L1736), `SLOT_LABEL` (~L1720).
- Labels: `slotLabel(slot)` (~L1727), `rarityLabel(rarity)` (~L1724).
- Affixes: `affixDef(stat)` (~L1768 — the GEAR_SLOTS-iterating version; import
  `GEAR_SLOTS` from `equipment.js`), `affixLabel(def, stat)` (~L1778).
- Mods: `modName(id)` (~L1782), `modPower(power)` (~L1788),
  `modPowerValue(id, power)` (~L1792), `modPowerSuffix(id)` (~L1796),
  `modPowerText(id, power)` (~L1800). Import `getMod` from `affixes.js`.
- Item helpers: `itemStatMap(item)` (~L2143), `itemTitle(item)` (~L1703),
  `itemUniqueName(item)` (~L1696).
- Glyph: `slotGlyph(slot, color)` (~L1751-1766).
- `escapeHtml(s)` (~L3416).
- `modFaultBadgesHtml(item)` (~L1934). Import `VFX` from `config.js` and
  `itemMods` from `equipment.js`.

Imports the new module needs: `import { t, tf } from "./i18n.js";`,
`import { LOOT, TOWERS, TOWER_UPGRADES, VFX } from "./config.js";` (include only
what the moved bodies actually reference — `itemTitle` uses `TOWERS`+`tf`;
`affixDef` uses `LOOT`; `modFaultBadgesHtml` uses `VFX`),
`import { getMod } from "./affixes.js";`,
`import { GEAR_SLOTS, itemMods } from "./equipment.js";`.

**Two NEW exported builders** (extracted so both callers share one source):

1. `compareRowsHtml(current, incoming)` — the pure row/mod/unique HTML string
   currently inline in `ui.js openCompareSheet` (~L2161-2201): the stat rows
   (union of `itemStatMap` keys, `▲/▼` deltas via `.cmp-delta up/down`), the
   mod rows (compare by mod id, `modPowerText`/`modPowerValue`/`modPowerSuffix`),
   and the unique row (`itemUniqueName`). Returns the concatenated
   `rows + modRows + uniqueRow` string. It must produce byte-identical markup to
   what `openCompareSheet` builds today. `openCompareSheet` keeps its
   overlay/DOM/footer/event-wiring logic and just calls this for the middle.

2. `gearTileHtml(item, opts = {})` — the `.gear-tile filled` markup currently
   inline in `ui.js renderTowersTab` (~L2486-2489):
   `<button class="gear-tile filled ${RARITY_CLASS[item.rarity]}${opts.justEquipped ? " just-equipped" : ""}" ...>` + `slotGlyph(...)` + `modFaultBadgesHtml(item)` + the rarity-colored `.tile-label`.
   Accept `opts.justEquipped` (bool), `opts.dataAttrs` (string of extra
   attributes for the button, so `ui.js` can pass its `data-item-tower`/
   `data-item-slot`), and `opts.asButton` (default true; when false, emit a
   `<div>` — the run's roster/reward tiles are not the campaign's edit buttons).
   Also export a matching `gearTileEmptyHtml(slot, opts={})` for the empty
   `.gear-tile empty` markup (~L2481-2482) so the empty state is shared too.
   Keep the campaign render site producing identical DOM (same classes, same
   data-attributes, same glyph color) — verify by diffing the generated string.

### 1.2 Rewire `ui.js`

- Add `import { ... } from "./gear-visuals.js";` for every symbol moved above,
  and DELETE the now-duplicate private definitions from `ui.js`.
- Replace the inline compare-middle in `openCompareSheet` with a call to
  `compareRowsHtml(current, incoming)`.
- Replace the inline gear-tile markup in `renderTowersTab` (the filled + empty
  branches ~L2480-2489) with `gearTileHtml` / `gearTileEmptyHtml`, passing the
  existing `data-item-tower`/`data-item-slot` / `data-picker-tower`/
  `data-picker-slot` via `opts.dataAttrs` so the click delegation is unchanged.
- Leave everything else in `ui.js` as-is. `SLOT_LABEL`/`RARITY_*` referenced
  elsewhere in `ui.js` now come from the import.
- Watch for other `ui.js` call sites of the moved functions (e.g.
  `renderGearShowcase` ~L3990, item detail sheets ~L2086/2125, `openPickerSheet`,
  `openEquipTargetSheet`) — they keep working via the new imports. Grep the file
  for each moved name and confirm every reference resolves to the import.

### 1.3 Done when

`gear-visuals.js` exists and exports the primitives + `compareRowsHtml` +
`gearTileHtml`/`gearTileEmptyHtml`; `ui.js` imports them and has no duplicate
copies; the campaign gear panel, item sheets, and compare sheet are byte-for-byte
identical in output (the agent diffs the generated HTML strings where it can, and
reports what it could not verify without a browser). No console errors; no
import cycle (the module imports only i18n/config/affixes/equipment).

---

## PHASE 2 — Roguelike reward / shop / roster adopt shared icons + tiles — **Codex Sol — AS BUILT (2026-08-30)**

**Shipped & orchestrator-verified in-browser.** `roguelike-ui.js` now imports the
shared primitives from `./gear-visuals.js` and its duplicate helpers are gone
(`RARITY_COLOR`, `SLOT_LABEL`, `escapeHtml`, `rarityLabel`, `slotLabel`,
`affixDef`, `affixLabel`; `modLabel`→`modName`; the `getMod`/`LOOT` imports were
dropped as newly-unused). `itemBodyHtml` + `rosterGearSlotHtml` were restructured
into an icon+copy flex layout (`.rogue-item-summary`/`.rogue-item-icon`/
`.rogue-item-copy` and the roster equivalents) leading with
`gearTileHtml(item, { asButton:false, dataAttrs:'role="img" aria-label=…' })` on
a rarity tile; empty roster slots use `gearTileEmptyHtml`. Mod lines now show the
POWER value via `modPowerText` (e.g. "Thermal +6%", "Upgrade Cascade +15%") — a
real content gain over the old name-only lines. Small scoped CSS added to
`styles.css` (flex layouts + `cursor:default` on the non-interactive tile; reuses
the global `.gear-tile`/`RARITY_CLASS`). Verified: gear-reward (5 cards, glyph +
rc/re tiles + mod power), shop stock cards, and VIEW ROSTER (empty + filled slots
with glyphs) all render correctly; no horizontal overflow at 375px; console
clean. Built by Codex Sol; sandbox couldn't stage (git-lock) — orchestrator will
stage/commit. **Plan note Codex flagged:** the `slotGlyph` import is redundant
when using `gearTileHtml`/`gearTileEmptyHtml` (retained anyway; harmless).
Original spec below.

**Goal:** the run's gear cards get the real slot icon, rarity-glow tile, and mod
power values, and stop carrying duplicate helper copies.

**Files (stage exactly these):** `src/roguelike-ui.js`, `styles.css` (only if a
small wrapper class is needed — prefer reusing existing global `.gear-tile`).

### 2.1 Delete the duplicates, import the shared module

In `roguelike-ui.js` add
`import { RARITY_COLOR, slotLabel, rarityLabel, affixDef, affixLabel, modName, modPowerText, slotGlyph, gearTileHtml, gearTileEmptyHtml, escapeHtml, itemTitle } from "./gear-visuals.js";`
and DELETE the local copies: `RARITY_COLOR` (~L55), `SLOT_LABEL` (~L59),
`escapeHtml` (~L78), `rarityLabel` (~L83), `slotLabel` (~L84), `modLabel` (~L85 —
replace all `modLabel(id)` call sites with `modName(id)`), `affixDef` (~L86 —
note the shared one takes `(stat)` not `(slot, stat)`; update call sites),
`affixLabel` (~L89). Keep `KIND_ICON` and `COMBAT_KINDS` (run-specific).

### 2.2 Rebuild the item body to lead with the icon

Rewrite `itemBodyHtml(item)` (~L243) so each item card shows, campaign-style:
- the `slotGlyph(item.slot, RARITY_COLOR[item.rarity])` on a rarity tile (reuse
  the global `.gear-tile`/`RARITY_CLASS` look — you MAY wrap the glyph in a small
  `.rogue-item-icon` that composes with the existing `.gear-tile` classes, or use
  `gearTileHtml(item, { asButton:false })` directly),
- the rarity-colored title (`itemTitle(item)` or the existing rarity+slot line),
- the lock line (UNIVERSAL / {TOWER} ONLY) — keep as today,
- affix lines (unchanged text) PLUS **mod lines that now include the power
  value** via `modPowerText(m.id, m.power)` (today they show only the mod name —
  this is a real content gain). Keep the affix/mod line CSS classes.

Apply the same icon treatment to the **VIEW ROSTER** slot rows
(`rosterGearSlotHtml`, ~L350): show the slot glyph + rarity tile for filled
slots, and mod power values. The empty slot uses `gearTileEmptyHtml` or the
existing empty style.

The **shop** stock cards (`renderShop`, ~L572) render via `itemBodyHtml`, so they
inherit the new look automatically — verify they still lay out at 375px.

### 2.3 Done when

Run gear-reward, shop, and roster item cards show the neon slot glyph on a
rarity-glow tile and mod power values, matching the campaign's idiom, with no
duplicate helper definitions left in `roguelike-ui.js`. No horizontal scroll at
375px (agent notes it cannot verify layout without a browser). Real save
untouched. No console errors.

---

## PHASE 3 — Compare-before-equip in the run (headline fix) — **Codex Sol — AS BUILT (2026-08-30, build `-8`)**

**Shipped & orchestrator-verified in-browser.** New `renderGearCompare(current,
incoming, itemIndex, rosterIndex, items)` in `roguelike-ui.js` repaints
`#rogue-body` with the campaign compare layout — `.gear-sheet-title` +
`slotGlyph`, a `.cmp-head` two-column header (current/new, rarity-colored), the
shared pure `compareRowsHtml(current, incoming)` body, and EQUIP NEW / KEEP
CURRENT actions. `renderGearReward`'s equip handler routes an OCCUPIED target
slot (`run.roster[idx].gear[item.slot]` truthy) into it; empty slots equip
directly as before. EQUIP NEW → `roguelike.pickGearReward(i, idx)` + node map;
KEEP CURRENT → `renderGearReward(items)` (pick NOT consumed). Minimal phone-safe
`.rogue-compare` / `.rogue-compare-actions` CSS added (reuses the global `.cmp-*`
grid). Does NOT call `ui.js openCompareSheet` (z-index-correct: gear-sheet
overlay 5 < rogue overlay 42). Verified in a real run (seed 3): occupied
capacitor slot → "COMPARE · CAPACITOR" with glyph, 2 columns, correct downgrade
deltas (▼3% / ▼11%); KEEP returns to the 5-item reward with the slot unchanged;
EQUIP NEW commits (slot rare→enhanced) and returns to the map; no horizontal
overflow at 375px; console clean; real save byte-identical (Codex sentinel +
UI-only change). Original spec below.

**Goal:** equipping a run gear reward into an **occupied** slot first shows the
side-by-side compare (stat deltas, EQUIP NEW / KEEP CURRENT), exactly like the
campaign — but rendered INSIDE the rogue overlay (the shared gear-sheet overlay
is `z-index:5`, below `#rogue-overlay`'s `z-index:42`, so it cannot be reused
directly; render into `#rogue-body` instead).

**Files (stage exactly these):** `src/roguelike-ui.js`, `styles.css`.

### 3.1 The flow

In `rosterTargetButtons` / the gear-reward equip handler (`renderGearReward`
~L492 and `rosterTargetButtons` ~L473): when the chosen roster target's
`rec.gear[item.slot]` is **occupied**, do NOT equip immediately. Instead render a
rogue-local compare screen into `#rogue-body`:
- Title reusing `slotGlyph(slot, ...)` + COMPARE + slot label.
- Two-column header (CURRENT / NEW) rarity-colored (reuse the campaign's
  `.cmp-head` classes — they're global CSS).
- Body = `compareRowsHtml(current, incoming)` from `gear-visuals.js`.
- Footer: **EQUIP NEW** (`roguelike.pickGearReward(itemIndex, rosterIndex)` then
  `renderNodeMap()`) and **KEEP CURRENT** / BACK (returns to `renderGearReward`
  with the same items — the pick is not consumed).
When the slot is **empty**, equip directly (today's behavior).

Wrap the compare markup in a `.rogue-compare` container so the global `.cmp-*`
rules render correctly within `#rogue-body`; add a minimal `.rogue-compare` /
`.rogue-compare-actions` block in `styles.css` (spacing/scroll only — reuse
`.cmp-row/.cmp-cell/.cmp-delta/.cmp-head` for the grid). Buttons use the run's
`.big-button` classes for touch sizing. No horizontal scroll at 375px.

New strings: `t("rogue.gear.compare", "COMPARE")`,
`t("rogue.gear.equipNew", "EQUIP NEW")`, `t("rogue.gear.keepCurrent", "KEEP CURRENT")`
(inline English fallbacks only — no `fr.js`).

### 3.2 Guardrails

- Do NOT call `ui.js openCompareSheet` (would open the wrong-z-index overlay and
  couple the modules). Use the shared pure `compareRowsHtml` and render locally.
- The SKIP-ALL path and the "NO COMPATIBLE TOWER" path are unchanged.
- Do NOT change `roguelike.js` — `pickGearReward(itemIndex, rosterIndex)` already
  does the equip; the UI only decides whether to confirm via compare first.

### 3.3 Done when

Tapping a run gear reward onto a tower whose slot is filled shows the compare
(correct deltas, EQUIP/KEEP), EQUIP NEW swaps and returns to the map, KEEP
returns to the reward; empty slots still equip directly. Real save untouched, no
console errors, no horizontal scroll at 375px (agent reports browser-unverified
items).

---

## PHASE 4 — Run-end LOOT showcase + roster consistency — **Codex Sol — AS BUILT (2026-08-30, build `-9`)**

**Shipped & orchestrator-verified in-browser.** (4.1) `ui.js tileHtml` moved to
`gear-visuals.js` as exported `itemTileHtml(item, opts)`; its `isItemSeen`
dependency became caller-supplied `opts.isNew` (default false). All four campaign
call sites migrated (triage/stash/store/results); the stash-grid caller passes
`isNew: item.id && !isItemSeen(item.id)` (Codex's equivalent for the `opts.stashId`
the plan named — that site has no `opts` var), so the NEW tag is byte-identical.
Verified live: campaign STASH tiles keep NEW tags, STORE tiles keep price tags,
all render the glyph + correct rarity class. (4.2) `renderRunEnd` gains a
rarest-first "ARSENAL BUILT" grid of every non-null `run.roster[].gear` item via
`itemTileHtml`; tapping a tile opens `renderRunEndItemDetail` (a rogue-local
reveal-card into `#rogue-body` — NOT `ui.js showItemDetail`, whose `#drop-reveal`
is z-index 15 < rogue 42), BACK returns via a captured `runEndResult` module var.
Verified: 5 tiles ordered `rs→rp→rr→re→rc`, tap → "PRISM LENS OPTIC · SINGULARITY"
detail, BACK returns. (4.3) VIEW ROSTER header now reads `LV {maxLevel} · ★{rank}`.
Minimal phone-safe CSS added (5-col loot grid ≤300px, reveal-card detail). No
console errors, no horizontal overflow at 375px, real save untouched. New
`rogue.end.loot` / `rogue.end.lootDetailBack` strings are inline-English (French
deferred). Original spec below.

**Goal:** the run-end screen shows a campaign-style rarest-first grid of the
gear the run built (reusing the campaign's `.item-tile` builder), with tappable
tiles opening a rogue-local detail card; and the VIEW ROSTER tower header adopts
the campaign's `LV n · ★rank` idiom. Approved scope (2026-08-30): tappable loot
tiles → rogue-local detail; 4B included.

**Files (stage exactly these):** `src/gear-visuals.js`, `src/ui.js`,
`src/roguelike-ui.js`, `styles.css`. (No `roguelike.js` change — read from
`getRunSummary()` / the run roster.)

### 4.1 Extract the loot-tile builder into `gear-visuals.js`
- Move `tileHtml(item, opts)` (`ui.js` ~L1852, the `.item-tile` builder: rarity
  class + `slotGlyph` + corner tag + `modFaultBadgesHtml` + optional NEW tag) into
  `gear-visuals.js` as exported `itemTileHtml(item, opts)`. **Drop the
  `isItemSeen` save dependency** — replace the internal `isNew = opts.stashId &&
  !isItemSeen(item.id)` with `isNew = !!opts.isNew` (caller-supplied). `ui.js`
  imports it and, at the ONE stash-grid call site that wants the NEW tag, passes
  `isNew: opts.stashId && !isItemSeen(item.id)` so campaign behavior is
  byte-identical. All other `tileHtml` call sites (STORE/results/triage) pass no
  `isNew` and are unchanged. Verify every `tileHtml(` call site in `ui.js` now
  resolves to the import and renders identical markup.
- Keep `itemTileHtml` pure: imports it needs (`RARITY_CLASS`, `slotGlyph`,
  `modFaultBadgesHtml`, `TOWERS`, `t`) are already in `gear-visuals.js`.

### 4.2 Run-end LOOT showcase (`roguelike-ui.js renderRunEnd`)
- Gather the run's built gear: iterate `roguelike.getRun().roster`, collect every
  non-null `rec.gear[slot]` into a flat list. Sort rarest-first (mirror the
  campaign: higher `RARITIES.indexOf(rarity)` = rarer — reuse `RARITY_ORDER` from
  gear-visuals or `RARITIES` from loot.js; match the campaign's ordering).
- Render a grid (reuse `.overlay-items`-style / a new `.rogue-loot-grid`) of
  `itemTileHtml(item, { resultIndex: i })` tiles, placed in the run-end screen
  (e.g. under the summary, above the buttons). Empty list ⇒ omit the grid.
- **Tappable → rogue-local detail** (do NOT call `ui.js showItemDetail` — its
  `#drop-reveal` overlay is z-index 15, BELOW `#rogue-overlay` 42). Add a
  `renderRunEndItemDetail(item, items)` that repaints `#rogue-body` with a
  detail card reusing the campaign reveal-card visual vocabulary (`slotGlyph`,
  `itemTitle`, `rarityLabel`, `slotLabel`, rarity color/glow, affix/mod lines via
  the existing rogue `itemBodyHtml` or a compact inline list) + a BACK button that
  returns to `renderRunEnd(result)`. Keep the run-end `result` available (capture
  it in a module var or pass it through) so BACK can re-render.
- No horizontal scroll at 375px. Read-only — no save/run-state writes.

### 4.3 Roster consistency (4B, `roguelike-ui.js renderRoster`)
- The tower card header currently shows `★ {rank}` + a `MASTERY +{pct}% DMG` sub.
  Add the campaign's compact `LV {maxLevel} · ★{rank}` idiom (the run roster
  records carry `maxLevel`; `getRunRoster()` already returns it). Keep the card
  read-only; keep the mastery-bonus sub line. Small text-format change only — no
  new interactive component.

### 4.4 New strings / i18n
- Any new strings use `t("rogue.end.loot", "ARSENAL BUILT")`,
  `t("rogue.end.lootDetailBack", "BACK")`, etc. — inline English fallbacks ONLY.
  **Do NOT edit `src/lang/fr.js`** (French deferred).

### 4.5 Done when
Run-end shows a rarest-first grid of the run's equipped gear as campaign-style
`.item-tile`s; tapping a tile opens a rogue-local detail (BACK returns to
run-end); VIEW ROSTER headers read `LV n · ★rank`; the campaign results/stash/
store grids are byte-identical (the `isItemSeen`→`opts.isNew` seam preserved);
no console errors, no horizontal scroll at 375px, real save untouched. Report
what you did and did NOT verify (no browser here).

### Deferred beyond Phase 4
A fully shared interactive tower-card component (campaign gear panel ↔ run roster)
was considered and NOT done — the interactive-vs-read-only mismatch makes it low
value. Revisit only if a concrete need appears.

## Deferred work (orchestrator, after the phases land)

- **French translation.** All new strings added in Phases 2–3 use inline English
  `t(...)` fallbacks only. The matching `rogue.gear.compare`,
  `rogue.gear.equipNew`, `rogue.gear.keepCurrent` (and any other new keys) still
  need French added to `src/lang/fr.js` — TODO in a later i18n pass. Do NOT
  translate proper nouns / tower names (see HANDOFF i18n rules).
- **Single `version.js` bump + commit + push** once all phases are verified.
