# Balance Lab — L5 build plan (editable controls & validation UX)

Execution plan for phase **L5** of `BALANCE_LAB_PLAN.md`. Read `BALANCE_LAB_L0.md`
(schema/rule contract), `BALANCE_LAB_L3_PLAN.md` (the save API), and skim
`BALANCE_LAB_L4_PLAN.md` (the read-only shell you extend) first. L5 turns the
read-only Lab into a **safe editor**: bind inputs to the draft, validate, review
changes, and persist through the L3 API. This is the phase that **writes** —
always and only through `POST /api/balance/save`.

## Golden rules

- Plain HTML/CSS/vanilla ES modules. No framework, build step, package, or CDN.
- **The only write path is `POST /api/balance/save`.** Never write files
  directly and never edit `config.js`/`levels.js`/`balance-data.*` by hand — the
  server regenerates the data files atomically (L3). The Lab edits a `draft`
  clone and posts it.
- Extend the existing `balance-lab.html` / `balance-lab.css` / `src/balance-lab.js`
  only. Do not touch `index.html`, any `src/` game module, `serve.ps1`,
  `balance-schema.js`, or `version.js`. No commit/push, no `.gitignore` change.
- Editing one field must change **only** that field in the draft (path-scoped
  mutation on a clone; never mutate `server`).
- Keep the player menu untouched and the page phone-portrait-safe.
- After edits, sweep for iCloud ` 2` conflict filenames and rename any back.

## What L4 already gives you

`src/balance-lab.js` holds `server` (last fetched) + `draft` (clone), renders 8
sections read-only, imports `validate` from `balance-schema.js` and presentation
labels from `config.js`/`levels.js`, and has reload/reset controls + a dirty-state
area + a Changes (diff) section that currently shows "no changes". L5 makes the
fields editable and wires save. **Note:** L4 did not implement the `beforeunload`
guard — add it in L5 (warn when dirty).

## Scope — what becomes editable (first release)

Editable (bind an input, mutate `draft` by path):
- **Towers** (`towers.<id>`): baseCost, baseDamage, baseRange, baseFireRate,
  basePierce, splashRadius, projectileSpeed, slowPercent, slowDuration,
  vulnerability, pierceWidth, upgradeCostMult, **damageType** (guarded dropdown,
  options = the 5 DamageTypes: energy/pulse/control/rail/blast).
- **Enemies** (`enemies.<id>`): baseHealth, speed, coreDamage, bounty, xp,
  shardTier, regenRate, `damageMult.<type>` counters (per damage type),
  `splitInto` {type (enemy dropdown), count}.
- **Upgrades** (`towerUpgrades`): maxLevel, the five growth rates, `xpThresholds`
  (9 ints, ascending), `upgradeCosts` (9 ints), `mastery` block, per-tower
  `specialties` growth values.
- **Economy / pacing**: `economy` (moneyPerKillMultiplier, xpPerKillMultiplier,
  interest.enabled bool), `waveDefaults` (timeBetweenWaves, autoStartNextWave
  bool, allowEarlyStart bool, spawnInterval), `loot.xp.slowWeightPerSec`,
  `loot.shards.perKillBase`, `loot.shards.perLevelMult`.
- **Skills** (`skills`): tiers (maxTier + costs[]), per-tower damageStep, layouts,
  economy steps, values (coreHealth, railPen). Secondary priority; still editable.
- **Levels** (`levels.<id>`): startingMoney, coreHealth, bountyMult,
  timeBetweenWaves, autoStartNextWave.
- **Waves** (`levels.<id>.waves`): per **group** — type (enemy dropdown), count,
  spawnInterval, startDelay, healthMult, speedMult, bountyMult, xpMult; per
  **wave** — wave-wide healthMult, speedMult. Plus wave-group **CRUD** (below).
- **Endless**: `endless` knobs; `endlessRewards` milestones (threshold, reward
  kind + amount/rarity). `levelMilestones.<id>[].reward` (skillPoints/shards)
  editable; milestone `id`/`label`/`check` stay read-only.

**Read-only in L5 (do NOT build editors for these):** map geometry —
`gridWidth`, `gridHeight`, `pathCorners`, `blockedTiles`, and world `levelIds`/
`nodePos`. L0 flagged these as advanced/structural; a safe map editor is a later
increment. Display them read-only; editing them now risks breaking path/world
invariants. Level/enemy/tower **ids** and all presentation (names/colors/palettes)
also stay read-only.

## Wave-group CRUD (master-plan requirement)

Within a level's waves, support on **groups**: **add**, **duplicate**,
**reorder** (up/down or drag), and **delete** (with a confirm). Also support
**add / delete / reorder whole waves** (needed to restructure a level) with the
same confirm-on-delete. After every structural op, re-run the diff + validation.
A new group defaults to a valid shape (e.g. `{ type:"basic", count:1 }`).

## Design decisions

### D1 — Path-scoped, clone-safe editing
- Central helpers: `getByPath(obj, "levels.level_001.startingMoney")` and
  `setByPath(draft, path, value)`. Every input carries its `data-path`; on
  `change`, coerce the value to the field's type and `setByPath(draft, …)`.
- `draft` is a `structuredClone` of `server`; never mutate `server`. Recompute
  `isDirty = !deepEqual(draft, server)` and the diff after each edit.

### D2 — Typed inputs & coercion
- Numbers → `<input type="number">` with a sensible `step`; coerce to Number
  (int fields reject non-integers). Booleans → checkbox. Enums → `<select>`
  (damageType, `splitInto.type`, wave group `type`). Fixed-length arrays
  (`xpThresholds`, `upgradeCosts`) → a row of 9 number inputs.
- Reject empty/NaN at the field (show a field error; do not write NaN into draft).

### D3 — Validation UX: hard errors block, soft warnings don't
- **Authoritative gate:** `validate(draft)` (client-side, from
  `balance-schema.js`) runs before every save. If `!ok`, block save and surface
  each `errors[]` message, mapped to the offending field/section where possible.
- **Field errors:** per-field inline errors for local type/range problems
  (e.g. non-integer count, empty number).
- **Soft range warnings (advisory, never block):** flag values outside a sane
  band with inline help (e.g. tower baseCost ≤ 0 is a hard error, but a wildly
  high value warns). Keep bands loose and clearly advisory.
- **Inline help:** a short hint per field (units + meaning), and **calculated
  previews** that update live — e.g. a wave's total enemy count and rough total
  HP as you edit group count/healthMult; a tower's DPS (`baseDamage /
  baseFireRate`) as you edit those. Mark previews as derived/read-only.

### D4 — Save flow (revision-note-required + changed-value review)
- A sticky **save bar**: dirty count, a **required revision note** input, a
  **Save** button (enabled only when `isDirty && validate(draft).ok && note
  non-empty`), and a **Reset** (revert draft to server, with confirm if dirty).
- The **Changes** section is the "readable changed-value review": path → old →
  new for every diff. Show it (or a summary of it) next to Save so the user sees
  exactly what they're about to persist.
- On Save: run `validate(draft)`; if invalid, block + show errors. Else
  `POST /api/balance/save { baseRevision: server.revision, note, data: draft }`.
  Handle responses:
  - **200** → set `server = draft` (with new revision), clear dirty, clear note,
    toast success, refresh History from `/api/balance/history`.
  - **409 stale** → warn "The data changed elsewhere (another tab/edit). Reload
    to get the latest — this discards your unsaved changes." Offer Reload
    (refetch, discard draft) with confirm. Do not silently overwrite.
  - **400/415/422** → show the server error; draft/dirty unchanged.
- **beforeunload guard:** warn when `isDirty` (make it active in L5).

### D5 — Keep it decoupled and safe
- No new dependencies. The Lab still imports only `validate` + presentation
  labels + the API. Reordering/adding groups must produce data the schema
  accepts (enemy `type` from the dropdown; `count` ≥ 1) so `validate` passes.

## Suggested build order (foundation first, then three editor groups)

The master plan allows splitting page work; build the shared foundation, then the
three groups, integrating and testing **one at a time** (each can be a separate
session if usage is tight):
1. **Foundation:** `getByPath`/`setByPath`, typed input binding, dirty/diff
   recompute, the save bar + note + Save/Reset flow (D4), beforeunload, the
   Changes review. Wire it against **one** simple editable field end-to-end
   (e.g. `economy.moneyPerKillMultiplier`) and prove a full edit→save→refresh
   round-trip before expanding.
2. **Towers / Enemies** editors (incl. damageType dropdown, counters matrix,
   splitInto).
3. **Levels / Waves** editors (level metadata + wave/group fields + group/wave
   CRUD + calculated previews).
4. **Economy / Upgrades / Endless / Skills** editors.
Integrate and verify each group before starting the next.

## Step — Verify (must pass before done)

Serve via `serve.ps1`; browser on localhost. Assert on DOM/console/network — do
NOT capture the game canvas. Back up `balance-data.json`/`.js` and
`balance-history/` before destructive tests; **end with on-disk data restored to
the L2 baseline** and all parity probes green.
1. **Field persists:** edit a value (e.g. laser baseCost 50→55), Save with a
   note; `GET /api/balance` shows 55 + a new revision; **hard-reload the Lab** →
   still 55; **reload `index.html`** → the game reads 55 (tray shows LASER $55).
2. **Saved edits reach the game:** confirm a wave edit and a level
   `startingMoney` edit likewise show up in-game after refresh (assert on
   `window.game`/DOM, no canvas capture).
3. **Invalid cannot save:** set an int field to a bad value (e.g. enemy
   `baseHealth` = 0 or blank, `xpThresholds` out of ascending order) → Save
   disabled/blocked with a clear error; forcing it does not POST and does not
   change on-disk data.
4. **Single-field isolation:** change exactly one field, Save, then diff the new
   snapshot against the previous revision's snapshot in `balance-history/` — only
   that one path differs.
5. **Note required:** with a dirty valid draft and an empty note, Save is
   blocked; adding a note enables it.
6. **Wave-group CRUD:** add, duplicate, reorder, and delete a group (delete
   confirms); Save; reload → structure persists and validates; wave counts update.
7. **409 handling:** make a change in the Lab, then (second tab or curl) save a
   different change through the API, then Save in the first tab → 409 path shows
   the reload prompt; no silent overwrite.
8. **Cleanup + regressions:** restore the L2 baseline (via the History/restore
   path or the API), confirm the L0/L1/L2 parity probes are green, `index.html`
   boots console-clean, and the Lab still works at 375px portrait.
9. Sweep for ` 2` iCloud conflict files.

Report: proof of edit→save→refresh reaching the game; invalid-blocked-and-no-POST;
single-field isolation via snapshot diff; note-required; wave-group CRUD survives
reload; 409 behavior; that the baseline is restored and probes/menu are green; the
exact files edited; and confirmation of no version bump / commit / push /
`.gitignore` change and that only `POST /api/balance/save` writes.

## Acceptance (L5, from the master plan)

- Every field survives refresh. ✔ (Steps 1–2)
- Invalid values cannot save. ✔ (Step 3)
- Single-field changes do not alter unrelated data. ✔ (Step 4)
- Saved tower/wave edits affect the local game after refresh. ✔ (Steps 1–2, 6)

## Files this phase edits

```
EDIT  balance-lab.html    add save bar (note + Save/Reset) + editable control containers
EDIT  balance-lab.css     input / dirty-marker / warning / save-bar styles
EDIT  src/balance-lab.js  editable inputs, path-scoped draft mutation, dirty/diff,
                          validation UX, save flow (POST save), wave-group CRUD, beforeunload
```

(A small optional `src/balance-lab-edit.js` helper is fine if it keeps the
controller readable — thin, no deps.)

Do not edit `index.html`, `config.js`, `levels.js`, `balance-schema.js`,
`balance-data.*`, `serve.ps1`, other `src/` modules, or `version.js`. Do not
modify `.gitignore`. Leave everything in the working tree for review.

## Notes handed to L6

- The diff renderer, revision-note save, and 409/restore-aware flow built here are
  what L6's history/restore UI reuses. L6 adds: restore a chosen revision through
  the normal validate→save path (labeled "restored from <id>"), a structured diff
  against active data, a "files changed" view, and the edit→validate→save→test→
  inspect-git-diff→manual-commit workflow doc. The append-only `balance-history/`
  + `activeRevision` semantics are already in place from L3.
```