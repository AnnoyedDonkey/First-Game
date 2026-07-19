# Balance Lab — phased implementation plan

Approved 2026-07-18. Build a local-first, responsive admin interface for
tuning game dynamics without hand-editing JavaScript. All source and revision
files stay in the repository and are never added to `.gitignore`. Git commits
and pushes remain deliberate user actions.

## Architecture and safety contract

- Move editable gameplay data into `src/balance-data.js`. Keep `config.js`
  and `levels.js` as stable module boundaries: they retain code, helpers,
  comments, and exports while consuming the data module.
- Add `src/balance-schema.js` for schema versions, migrations, deep cloning,
  and validation. The Lab only writes data that passes the full schema.
- Extend `serve.ps1` with a localhost-only Balance Lab API. It reads current
  on-disk data on every request and sends `Cache-Control: no-store`.
- Save atomically: validate a full draft, write a temporary sibling, replace
  the active data file, then record a snapshot. A failure changes nothing.
- Store timestamped snapshots plus a manifest in `balance-history/`; restore
  creates a new revision and never deletes previous history.
- First-release scope: towers, enemies/counters, upgrades, economy/progression
  knobs affecting combat, campaign levels/waves, and Endless. Exclude VFX,
  layout, and presentation controls.
- Bind only to `localhost` initially. Responsive UI enables a later explicit
  home-LAN mode for phone use; GitHub Pages is never a writable admin path.

Target layout:

```
balance-lab.html                 local admin entry point
balance-lab.css                  responsive Lab styles
src/balance-lab.js               Lab UI/controller
src/balance-data.js              active editable gameplay data
src/balance-schema.js            validation and data migration
balance-history/manifest.json    revision index
balance-history/<id>.json        immutable balance snapshots
serve.ps1                        static server plus local Lab API
```

## Shared implementation rules

- Vanilla HTML/CSS/ES modules and PowerShell only: no framework, build step,
  packages, database, or cloud write feature.
- Never source-text-rewrite `config.js` or `levels.js`; write only the
  dedicated balance data and history files.
- Never auto-commit, auto-push, or modify `.gitignore` for Lab data/history.
- Preserve existing localStorage saves and current public exports.
- Bump `src/version.js` only for an actual deployed player-facing balance
  change, not for local Lab tooling alone.

## L0 — inventory and schema contract  ✅ DONE (2026-07-18)

Delivered in `BALANCE_LAB_L0.md` + `balance-lab-l0-probe.html` (18/18 checks
pass against live data). Verified data shape: 15 levels, 159 waves, **313 wave
groups** (the "111" figure below was pre-hard-mode-expansion).

**Goal:** identify all values and define their single data home.

**Work:** inventory `config.js` exports and all `LEVELS` fields; classify
values as editable, read-only reference, or deferred; define stable paths and
validation rules (numeric ranges, enums, references, unique IDs, positive wave
values, valid world links); create data migration/validation probes.

**Acceptance:** the schema represents all 15 levels and all current wave
groups; every editable value has one home; no runtime behavior changes.

**Delegation:** standalone discovery/design task; must finish before L1/L2.

## L1 — config-side balance-data migration  ✅ DONE (2026-07-18)

Delivered `src/balance-data.js` + `src/balance-schema.js`; `config.js` now
re-exports migrated numbers merged with presentation fields. Verified: parity
probe (`balance-lab-l1-probe.html` vs. `balance-lab-l1-baseline.json`) shows
zero diffs across all migrated exports including the generated `SKILLS`/
`SKILL_TREE_VIEWBOX`; L0 probe still 18/18; game boots console-clean; old saves
load. Scope confirmed: only `LOOT.xp`+`LOOT.shards` migrated (rest of `LOOT`
deferred); `levels.js`/`version.js` untouched; nothing committed or pushed. See
`BALANCE_LAB_L1_PLAN.md`.

**Goal:** centralize global gameplay knobs with zero balance change.

**Work:** create baseline `balance-data.js`; implement validation/versioning in
`balance-schema.js`; migrate towers, enemies, upgrades, economy, approved
loot/progression knobs, skill values, and Endless settings; refactor
`config.js` to import/re-export migrated values while retaining derived helper
functions; add clear validation failures for invalid data.

**Acceptance:** normal game is console-clean; representative exported values
(cost, damage, fire rate, counters, XP, economy) match the baseline exactly;
old saves load.

**Delegation:** sequential after L0; restrict changes to config-side data.

## L2 — campaign and wave migration  ✅ DONE (2026-07-18)

Delivered: `balance-data.js` gained `levels{}` (15) + `worlds{}` (3) slices;
`balance-schema.js` validation widened (level fields, waves, map structure,
world links); `levels.js` now rebuilds `LEVELS`/`WORLDS` by merging migrated
numbers with presentation tables. Verified: L2 parity probe zero diffs across
all 15 levels / 3 worlds (L1/L5/L10/L15 spot-checked); L0 still 18/18; L1 still
17/17; schema self-test rejects diagonal paths, blocked-on-path, count:0, bad
enemy type, broken world links; game boots console-clean and L1/L5/L15
construct. Initial `balance-history/` baseline snapshot + manifest created
(immutable, git-tracked). `levels.js` public exports byte-identical; `config.js`
untouched; no version bump / commit / push. See `BALANCE_LAB_L2_PLAN.md`.

**Goal:** centralize editable levels/waves without affecting maps or paths.

**Work:** migrate level metadata, starting money, bounty multipliers, path/map
data, milestones, and waves; retain `LEVELS`/`WORLDS` module interfaces;
structurally validate grids, blocked paths, enemy types, wave values and world
order; create the initial baseline history snapshot.

**Acceptance:** every level constructs; all wave groups validate (currently 313
across 159 waves — assert what the probe finds, not a frozen count); L1/L5/
L10/L15 setup probes match baseline; no changed default gameplay values.

**Delegation:** sequential after L1, focused data-only migration/verification.

## L3 — local persistence API  ✅ DONE (2026-07-18)

Detailed execution plan written 2026-07-18 in `BALANCE_LAB_L3_PLAN.md`. Key
decisions locked there: `src/balance-data.json` becomes the canonical data file
and `src/balance-data.js` becomes a generated re-export inlining it (keeps the
game's synchronous import, gives PowerShell a JSON file to read/write, `BALANCE`
stays byte-identical); authoritative semantic validation stays client-side in
`balance-schema.js` (PowerShell can't run JS — the server does a structural gate
only); revision tokens are history snapshot ids with an `activeRevision` pointer
in the manifest for stale-save detection; saves are validate-first + atomic
(temp-file + rename), localhost-only, append-only history.

**Goal:** safely read/save data through `serve.ps1`.

**Work:** add `GET /api/balance`, `GET /api/balance/history`, `POST
/api/balance/validate`, `POST /api/balance/save`, and `POST
/api/balance/restore`. Include schema version and revision token in reads;
reject stale save tokens, invalid content types, oversized bodies, unknown
paths, and non-local requests. Use temporary-file + atomic rename writes.

**Acceptance:** refresh sees new on-disk data; stale two-tab saves fail;
invalid/interrupted saves preserve active data; normal static serving remains
unchanged.

Delivered: `src/balance-data.json` is now canonical and
`src/balance-data.js` is its generated synchronous re-export;
`balance-history/manifest.json` tracks `activeRevision`; and `serve.ps1`
implements the five localhost-only endpoints with bounded JSON requests,
structural validation, stale-token rejection, confined atomic writes, and
append-only restore history. Verified a temporary Level 1 money edit reached
the reloaded game, stale/invalid requests did not mutate active files, restore
returned the data byte-for-byte to the L2 baseline while retaining all three
snapshots, static responses stayed byte-identical, and L0/L1/L2 probes remained
green. See `BALANCE_LAB_L3_PLAN.md`.

**Delegation:** isolated PowerShell/security task after L1/L2 file format is
stable.

## L4 — read-only Lab shell  ✅ DONE (2026-07-18)

Delivered `balance-lab.html` + `balance-lab.css` + `src/balance-lab.js` (see
`BALANCE_LAB_L4_PLAN.md`). Verified independently: all 8 sections render live
data from the L3 API (values match — startingMoney 100, laser cost 50, "Valid"
badge + active revision shown); strictly read-only (21 controls clicked → 0
non-GET / 0 POST, active revision unchanged); phone portrait 375px has no body
h-scroll (wide tables scroll in-container); `index.html`/player menu untouched
and console-clean; L1 parity still 17/17; graceful "run serve.ps1" offline
panel present. Labels enriched by read-only import of `config.js`/`levels.js`;
`validate()` wired for the Overview badge. Minor: the `beforeunload` guard was
not implemented (inert in read-only L4) — folded into L5. No version bump /
commit / push.

**Goal:** make current balance data clear and navigable before editing.

**Work:** add the separate Lab page, responsive styles, and controller;
sections: Overview, Towers, Enemies, Upgrades & Economy, Campaign Levels,
Endless, History, Changes; fetch fresh data through L3; show revision/source
timestamp/schema; add search, level/world picker, expandable wave table,
calculated read-only summaries, draft reload/reset, dirty markers, and an
unsaved-change warning.

**Acceptance:** current values render after hard reload; no UI action writes
data; page works at phone portrait width; normal player menu is untouched.

**Delegation:** can run alongside the latter L3 API work once its response
contract is fixed; leave it read-only until L3 passes.

## L5 — editable controls and validation UX  ✅ DONE (2026-07-18)

Delivered in `balance-lab.html`/`.css`/`src/balance-lab.js` (see
`BALANCE_LAB_L5_PLAN.md`). Typed `data-edit-path` inputs mutate a draft;
`damageType` is a guarded dropdown; `validate()` is the hard save gate; revision
note required; wave-group add/duplicate/reorder/delete works. Verified
independently by driving the real UI: laser cost 50→55 saved via a single
`POST /api/balance/save`, and API + a fresh game import both read 55; note-
required gating works; `basic.baseHealth=0` disabled Save and clicking it fired
no POST; single-field isolation held (only `towers.laser.baseCost` changed);
baseline restored → LASER 50 / money 100 / 1 group; L1 17/17, L2 6/6,
`index.html` console-clean. Map geometry stayed read-only. Only the 3 Lab files
changed; sole write path is `POST /api/balance/save`. No version bump / commit /
push.

**Goal:** edit all first-release game-dynamics data safely.

**Work:** create controls for tower cost/damage/range/fire rate/projectiles/
specialties; enemy health/speed/bounty/shard tier/counters/regeneration/split;
upgrade XP/costs, starting money, bounty, economy, Endless rewards; and level
wave type/count/health multiplier/spawn interval/group bounty. Support add,
duplicate, reorder and delete wave groups with confirmation. Add inline help,
range warnings, calculated previews, field errors, revision-note-required Save,
and a readable changed-value review.

**Acceptance:** every field survives refresh; invalid values cannot save;
single-field changes do not alter unrelated data; saved tower/wave edits affect
the local game after refresh.

**Delegation:** after shared draft/validation utilities exist, split page work:
Towers/Enemies, Levels/Waves, and Economy/Endless. Integrate one at a time.

## L6 — revision history and Git-friendly workflow  ✅ DONE (2026-07-18)

Delivered in `balance-lab.html`/`.css`/`src/balance-lab.js` (see
`BALANCE_LAB_L6_PLAN.md`): filtered history browser (timestamp/note/change-count,
baseline & active badges), grouped structured diffs, restore-to-draft (review
diff → normal `POST /save`, note "restored from <id>", append-only), files-
changed panel, and in-Lab git workflow help. Verified independently by driving
the real UI: saved laser cost 52, then Restore on an earlier revision loaded a
review diff + pre-filled note with **no silent POST**; committing it returned
active to 50/20/100 with every prior revision still present (append-only) and the
game reading the restored value; L0 18/18, L1 17/17, L2 6/6; `index.html`
console-clean. Snapshots read as static `/balance-history/<file>`; sole write is
`POST /save`; only the 3 Lab files changed. No version bump / commit / push.

**Goal:** make experimentation reversible and reviewable.

**Work:** history list with timestamp/note/change count/filter; structured diff
against active data; restore through normal validation/save path and label it
with the source revision; “files changed” view; document: edit → validate →
save → test locally → inspect Git diff → manually commit/push.

**Acceptance:** save three revisions, restore the first, reload Lab/game, and
confirm original snapshots remain while restored values are active; Git shows
all changes normally.

**Delegation:** sequential after L5.

## L7 — QA, handoff, and future phone readiness  📋 PLANNED — see `BALANCE_LAB_L7_PLAN.md` (not started)

Detailed execution plan written 2026-07-18 in `BALANCE_LAB_L7_PLAN.md`. Final
phase (QA + docs + hygiene, not a feature build): comprehensive QA (validate
baseline+history, sampled campaign construct/sim, Endless, localStorage save
load, server restart + restore, the full non-dev edit→save→restore loop); a
one-time history reset to the clean L2 baseline; a non-developer
`BALANCE_LAB_USAGE.md` guide plus HANDOFF/in-Lab-help updates; a documented but
UNBUILT `serve.ps1 -LabLan` phone path (LAN-only, never public); and a proposed
small-unit commit plan. The Lab never auto-commits or pushes — committing stays a
deliberate user action.

**Goal:** deliver a reliable non-developer workflow.

**Work:** validate baseline plus history; test game startup, sampled campaign,
Endless, save migration, server restart and restore; update docs/HANDOFF and
in-Lab help; inspect Git diff and `.gitignore`; commit phases in small units.
Do not push unless requested. Leave a documented deferred `-LabLan` path,
with no public-internet exposure.

**Acceptance:** a non-developer can edit a tower/wave, save with a note, test
locally, restore it, and manually commit without editing JavaScript.

## Deferred after L7

**L7 status:** **DONE (2026-07-18).** The Lab shipped locally with the QA pass,
single clean L2 baseline history, usage guide, handoff and in-Lab help updates,
the documented-but-unbuilt LAN-phone path, and an uncommitted commit proposal.
There is no player-facing balance change and no `version.js` bump.

- Explicit home-LAN phone access (`serve.ps1 -LabLan`).
- Read-only GitHub Pages Lab, if useful.
- Simulation/telemetry analysis inside the Lab.
- VFX/layout controls, presets/import-export, and in-draft undo/redo.
