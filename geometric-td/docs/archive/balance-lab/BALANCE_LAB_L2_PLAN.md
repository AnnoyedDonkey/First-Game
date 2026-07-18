# Balance Lab — L2 build plan (campaign & wave migration)

Execution plan for phase **L2** of `BALANCE_LAB_PLAN.md`. Read `BALANCE_LAB_L0.md`
(the schema contract) and `BALANCE_LAB_L1_PLAN.md` (the pattern L1 established)
first. This phase migrates **`levels.js` data only** into the existing
`src/balance-data.js`, extends validation, and creates the first
`balance-history/` snapshot. Do **not** re-do L1's config-side work.

## Golden rule: ZERO balance change

Everything `levels.js` exports today (`LEVELS`, `WORLDS`) must remain
**byte-for-byte identical** after migration. You are only relocating numbers,
never changing them. Parity is proven by the L2 probe (Step 6) — zero diffs, or
the migration is wrong. Fix the migration, never the baseline.

Also non-negotiable (HANDOFF / CLAUDE.md / master plan shared rules):
- Plain vanilla ES modules. No framework, build step, dependency, or TypeScript.
- Keep the game runnable and console-clean after the change.
- Never source-text-rewrite `config.js`/`levels.js` beyond the mechanical
  refactor described here; write the dedicated balance-data + history files.
- Do not touch save code, `version.js`, `config.js`, or any other `src/` module.
  Do **not** bump version. Do **not** commit, push, or modify `.gitignore`
  (history files must stay tracked, never ignored).
- After editing, sweep for iCloud ` 2` conflict filenames and rename any back.

## Already done in L1 — do NOT touch

`src/balance-data.js` and `src/balance-schema.js` exist and hold the config-side
data (enemies, towers, upgrades, economy, waveDefaults, endless, endlessRewards,
**levelMilestones**, loot xp/shards, skills). The L1 parity probe shows zero
diffs. **`LEVEL_MILESTONES` is already migrated** (it is a `config.js` export →
`BALANCE.levelMilestones`). L2 does NOT re-migrate milestones and does NOT edit
`config.js`. L2 only *adds* the `levels` and `worlds` slices to `balance-data.js`
and *extends* `balance-schema.js` validation to cover them.

Keep `SCHEMA_VERSION = 1`. L2 completes the v1 shape; since no v1-without-levels
data is persisted anywhere yet (the first snapshot is created in this phase), no
migration step is needed — just widen `validate()`.

## What L2 migrates (the levels.js EDIT set)

Per L0's path scheme. Presentation/REF fields **stay in `levels.js`** in small
presentation tables (mirror L1's `ENEMY_PRESENTATION` pattern) and are merged
back onto the public exports.

**Per level → `BALANCE.levels.<levelId>`** (EDIT):
gridWidth, gridHeight, startingMoney, coreHealth, bountyMult?, timeBetweenWaves?,
autoStartNextWave?, pathCorners[], blockedTiles[], waves[].
- `waves[]` is the full wave/group structure exactly as authored (each wave
  `{ groups:[...], healthMult?, speedMult? }`; each group `{ type, count,
  spawnInterval?, startDelay?, healthMult?, speedMult?, bountyMult?, xpMult? }`).
  Copy verbatim — do not round, reorder, or normalize optional fields.
- **Stays in `levels.js`** (`LEVEL_PRESENTATION.<id>`): id (the key), name, desc,
  palette? (world 2/3 color overrides). `id` is the stable key.

**Per world → `BALANCE.worlds.<worldId>`** (EDIT-structural):
levelIds[].
- **Stays in `levels.js`** (`WORLD_PRESENTATION.<id>`): id (key), name, accent,
  accent2, boardStyle, nodePos[]. Note `nodePos.length` must equal `levelIds
  .length` — the validator enforces this.

## Step 1 — Capture the parity baseline FIRST

Before any refactor, freeze the current exports:
1. Create `balance-lab-l2-probe.html` at repo root (sibling of the L0/L1 probes).
   In capture mode it imports **the live** `./src/levels.js` and dumps a
   canonical (sorted-key) JSON of `LEVELS` and `WORLDS` into
   `window.__L2_EXPORTS__`.
2. Serve with `serve.ps1` (preview launch config name `geometric-td`), load the
   probe, copy `window.__L2_EXPORTS__`, and save it to
   `balance-lab-l2-baseline.json` at repo root. This is the parity oracle — do
   not edit it again. ES modules do not run from `file://`; use the server.

## Step 2 — Add `levels` + `worlds` to `src/balance-data.js`

- Extend the `BALANCE` object with `levels: { <levelId>: {…} }` and `worlds:
  { <worldId>: { levelIds: [...] } }`, authored in campaign order
  (`level_001..015`, `world_1..3`).
- Copy every value verbatim from the current `levels.js` literals (grid, money,
  coreHealth, bountyMult, timeBetweenWaves, autoStartNextWave, pathCorners,
  blockedTiles, waves). Preserve `{x,y}` corner/tile order and wave/group order
  exactly — order is load-bearing (spawn sequencing, path fill).
- Do not add `levelMilestones` here — it already exists from L1.

## Step 3 — Extend `src/balance-schema.js`

Widen `validate()` to cover the new slices (rules already specified in L0
§"Validation-rule catalog" and already implemented in `balance-lab-l0-probe.html`
— port that logic, don't reinvent it):
- **Level fields:** gridWidth/gridHeight int > 0; startingMoney/coreHealth int
  > 0; bountyMult? > 0; timeBetweenWaves? ≥ 0; autoStartNextWave? boolean.
- **Wave/group:** groups non-empty; `count` int ≥ 1; every present mult
  (`healthMult, speedMult, spawnInterval, bountyMult, xpMult`) > 0; `startDelay?`
  ≥ 0; wave-wide `healthMult?`/`speedMult?` > 0; `type` references a real enemy
  (`BALANCE.enemies` key).
- **Map structure:** ≥ 2 path corners, all in-bounds; every consecutive corner
  pair is a straight H/V segment (never diagonal, never zero-length); blocked
  tiles in-bounds, **not on the filled path**, no duplicates. (Reuse the L0
  probe's `pathTiles()` fill logic.)
- **World links:** each `worlds.*.levelIds` entry is a real level id; the
  concatenation across worlds (in world order) equals every level id exactly
  once, in order; no level in two worlds.
- **Presentation-coupled invariant:** validation can't see `nodePos` (it stays
  in `levels.js`), so the `nodePos.length === levelIds.length` check stays in
  the assembly/probe, not the schema. Note this in a comment.

Keep `validate()` returning `{ ok, errors[] }` (never throw). Keep the module
pure/dependency-free.

## Step 4 — Refactor `levels.js` to consume `balance-data.js`

- `import { BALANCE } from "./balance-data.js";`
- Keep `LEVEL_PRESENTATION` (id→{name, desc, palette?}) and `WORLD_PRESENTATION`
  (id→{name, accent, accent2, boardStyle, nodePos}) as literals in `levels.js`.
- Build `export const LEVELS` as an array in campaign order, each element =
  merge of `BALANCE.levels[id]` (grid/money/core/path/blocked/waves/…) with
  `LEVEL_PRESENTATION[id]` (id/name/desc/palette). Only attach optional fields
  that are actually present (don't inject `palette`/`bountyMult`/
  `timeBetweenWaves`/`autoStartNextWave` onto levels that lack them). Preserve
  key/property order so the merged object matches today's literal.
- Build `export const WORLDS` as an array in world order, each = merge of
  `WORLD_PRESENTATION[id]` with `{ levelIds: BALANCE.worlds[id].levelIds }`.
- Use an explicit ordered id list (or iterate `BALANCE.levels` insertion order,
  which is authored in order) so `LEVELS` array order is guaranteed. Assert in
  a dev-only soft check that `nodePos.length === levelIds.length` per world
  (console.error, never throw).
- `levels.js` stays the stable module boundary — `game.js`, `renderer.js`,
  `ui.js`, `endless.js`, `milestones.js`, etc. import `LEVELS`/`WORLDS`
  unchanged. **No other `src/` file should need editing.** If one does, STOP and
  report — that means a public shape drifted.

## Step 5 — Create the initial baseline history snapshot

Per master plan (§Architecture + L2 work): seed `balance-history/`. Keep it
minimal and forward-compatible — L3 owns the final API/token contract, so don't
over-design; make it additive.
- Create `balance-history/<id>.json` — the immutable baseline snapshot:
  `{ schemaVersion: 1, createdAt: <ISO8601>, note: "L2 baseline — current
  shipped campaign + config data, pre-Lab-edit", data: <full BALANCE serialized
  with stable key order> }`. Use a filesystem-safe id (e.g. a timestamp like
  `2026-07-18T000000Z-baseline` — pick a real UTC time).
- Create `balance-history/manifest.json` — the revision index:
  `{ schemaVersion: 1, revisions: [ { id, createdAt, note, dataSchemaVersion: 1,
  file: "<id>.json", baseline: true } ] }`.
- History is append-only and must stay git-tracked (never `.gitignore`). This
  snapshot is never mutated by later phases; restores create *new* revisions.
- Document the shape briefly in a comment at the top of `manifest.json` is not
  possible (JSON) — instead note it in this plan's report back so L3 can finalize.

## Step 6 — Verify (must be green before done)

1. **L2 parity probe:** update `balance-lab-l2-probe.html` to also import the
   refactored `levels.js`, canonicalize `LEVELS`+`WORLDS`, and **deep-compare
   against `balance-lab-l2-baseline.json`**. Set `window.__L2_PROBE__ =
   { passed, failed, totalDiffs, diffs:[{path, before, after}] }`. Zero diffs
   required. This subsumes the master-plan "L1/L5/L10/L15 setup probes match
   baseline" (all 15 levels are compared, not just those four) — but explicitly
   confirm L1/L5/L10/L15 show in the compared set.
2. **L0 probe still 18/18** and **L1 probe still 17/17** — reload both; both must
   stay green (L0 re-asserts the live level/world contract; L1 config-side is
   untouched).
3. **Schema self-test:** `validate(BALANCE).ok === true` with the new slices.
   Then corrupt a deep clone and confirm targeted errors for: a diagonal path
   corner; a blocked tile placed on the path; a wave group `count: 0`; a wave
   `type` that isn't a real enemy; a `worlds` levelIds list that breaks the
   cover-all-in-order rule. Report the messages.
4. **Baseline snapshot round-trips:** parse `manifest.json` + the snapshot file;
   `validate(snapshot.data).ok === true`; snapshot `data.levels`/`data.worlds`
   deep-equal the live `BALANCE.levels`/`BALANCE.worlds`.
5. **Game boots + a level constructs:** load `index.html` via `serve.ps1`; no
   console errors; open/enter a level (e.g. via `window.game` / start level 1)
   and confirm the path, blocked tiles, and wave count match the level data
   (assert on `window.game` state / DOM — **do NOT capture the game canvas**,
   per project rule). Spot-check L5 and L15 construct too.
6. Sweep for ` 2` iCloud conflict files; rename any back.

Report back: L2 parity result (counts + any diffs — must be zero), L0/L1 probe
status, schema self-test messages, baseline round-trip result, game-boot +
level-construct status, the exact files created/edited, the history file
shapes you used, and confirmation you did not touch `config.js`/other `src/`/
`version.js`/save code and did not commit/push/modify `.gitignore`. If blocked
(a public shape would have to change, another `src/` file needs editing, or a
parity diff you can't resolve), STOP and report rather than work around it.

## Acceptance (L2, from the master plan)

- Every level constructs; all wave groups validate (currently 313 across 159
  waves — assert what the probe finds). ✔ (Steps 3, 5, 6.1)
- L1/L5/L10/L15 setup probes match baseline. ✔ (Step 6.1 compares all 15)
- No changed default gameplay values. ✔ (Step 6.1 zero-diff parity)
- Initial baseline history snapshot created. ✔ (Step 5)

## Files this phase creates or edits

```
EDIT    src/balance-data.js               add levels{} + worlds{} slices (verbatim values)
EDIT    src/balance-schema.js             widen validate(): levels/waves/map-structure/world-links
EDIT    src/levels.js                     import BALANCE; rebuild LEVELS/WORLDS by merging with presentation tables
CREATE  balance-lab-l2-probe.html         capture + parity/diff probe (root)
CREATE  balance-lab-l2-baseline.json      frozen pre-migration LEVELS/WORLDS dump (parity oracle)
CREATE  balance-history/manifest.json     revision index (baseline entry)
CREATE  balance-history/<id>.json         immutable baseline snapshot (full BALANCE)
```

Do not edit `config.js`, any other `src/` module, `version.js`, or save code.
Do not modify `.gitignore`. Leave everything in the working tree for orchestrator
review.
