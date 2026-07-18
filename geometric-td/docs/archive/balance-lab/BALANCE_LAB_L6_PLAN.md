# Balance Lab — L6 build plan (revision history & Git-friendly workflow)

Execution plan for phase **L6** of `BALANCE_LAB_PLAN.md`. Read `BALANCE_LAB_L0.md`
(schema), `BALANCE_LAB_L3_PLAN.md` (the API + history/`activeRevision` model), and
skim `BALANCE_LAB_L5_PLAN.md` (the editor + diff/save flow you extend). L6 makes
experimentation **reversible and reviewable**: a real history browser, structured
diffs, restore through the normal save path, a "files changed" view, and an
in-Lab doc of the edit→save→git workflow. It builds on L3/L5 and needs **no
`serve.ps1` change**.

## Golden rules

- Plain HTML/CSS/vanilla ES modules. No framework, build step, package, or CDN.
- The only write path is still `POST /api/balance/save`; restore goes through it
  too (see D1). Never write files directly or hand-edit
  `config.js`/`levels.js`/`balance-data.*`.
- Extend `balance-lab.html` / `balance-lab.css` / `src/balance-lab.js` only. Do
  not touch `index.html`, any `src/` game module, `serve.ps1`,
  `balance-schema.js`, `balance-data.*`, or `version.js`. No commit/push, no
  `.gitignore` change. **The Lab must never auto-commit or auto-push** — this
  phase specifically documents that committing stays a manual user action.
- After edits, sweep for iCloud ` 2` conflict filenames and rename any back.

## What you already have

- `GET /api/balance` → `{ schemaVersion, revision, data }`;
  `GET /api/balance/history` → `{ schemaVersion, activeRevision, revisions:[ {
  id, createdAt, note, dataSchemaVersion, file, baseline? } ] }`.
- Each revision's full snapshot is a **static file** at
  `/balance-history/<file>` (served by `serve.ps1`'s static handler, JSON mime),
  shape `{ schemaVersion, createdAt, note, data }`. **Fetch snapshots directly by
  URL** for diffing/restore — no new endpoint needed.
- L5's diff renderer (path → old → new), the save flow (`POST /save` with
  `baseRevision` + required note, 409-stale handling), `validate()`, and the
  History section (currently a plain read-only list). L6 upgrades all of this.

## Design decisions

### D1 — Restore through the normal validate→save path (reviewable), labeled with the source
When the user clicks **Restore** on a revision:
1. Fetch that revision's snapshot (`/balance-history/<file>`), take `.data`.
2. Load it into `draft` (mark dirty), so the **Changes** review + `validate()`
   run exactly as for a manual edit. The user *sees the structured diff of what
   restoring will change* before committing.
3. Pre-fill the revision note with `restored from <id>` (editable), then the user
   Saves via the normal `POST /api/balance/save { baseRevision, note, data:draft }`.
This satisfies "restore through the normal validation/save path and label it with
the source revision," respects stale-revision (409) detection, and never mutates
the original snapshots (append-only). Do **not** delete or overwrite history.
(The L3 `POST /api/balance/restore` endpoint still exists as a direct path; the
Lab UX uses load-into-draft for reviewability. Either is acceptable if the review
diff is shown, but prefer load-into-draft.)

### D2 — Structured diff against active data (and between revisions)
- Reuse L5's diff renderer. Given two data objects, produce a stable, readable
  list: `path`, `before`, `after`, plus added/removed keys and array-length
  changes (wave groups especially). Group by top-level area
  (towers/enemies/levels/…) and show a total change count.
- The History UI lets the user pick a revision and see its diff **vs active
  data** by default; a compare mode to diff **two selected revisions** is a nice
  addition. Fetch each revision's snapshot statically (cache them in memory).

### D3 — History list with timestamp / note / change count / filter
- Render `revisions` newest-first with: created timestamp (localized), note,
  **change count** (diff size vs the previous revision — compute by diffing
  adjacent snapshots; cache results), and badges for **baseline** and the
  **active** revision.
- A filter/search box over note text (and maybe id/date). Keep it simple
  (substring).
- Each row: **View diff** (D2) and **Restore** (D1) actions.

### D4 — "Files changed" view
- Show which repository files a Lab save/restore writes, so the user knows what
  `git status`/`git diff` will surface before committing:
  `src/balance-data.json`, `src/balance-data.js` (generated),
  `balance-history/<new-id>.json` (new snapshot), and
  `balance-history/manifest.json`. Present it as an informational panel near
  Save/Restore (it is the same set every time — that is the point: predictable,
  reviewable, git-friendly). Do not shell out to git; this is a static,
  explanatory list.

### D5 — In-Lab workflow help
- Add a concise help panel (in the History or a dedicated "Workflow" area)
  documenting the loop:
  **edit → validate → save (with a note) → test locally → inspect `git diff` →
  manually `git add`/`commit`/`push`.**
- State plainly that the Lab writes only local data/history files and **never
  commits or pushes** — the user reviews the git diff and commits deliberately.
- Mention that `balance-history/` is append-only and git-tracked, and that
  reverting a bad experiment is either a Restore (new revision) or a normal
  `git checkout` of the data files.

## Steps

1. Upgrade the **History** section: fetch `/history`, fetch each snapshot
   statically, compute adjacent-revision change counts (cached), render the list
   (D3) with baseline/active badges + filter.
2. Wire **View diff** (D2) — revision vs active, using L5's diff renderer; group +
   count; optional two-revision compare.
3. Wire **Restore** (D1) — load snapshot into draft, show the review diff,
   pre-fill note, save through the normal path; surface 409 the same way L5 does.
4. Add the **Files changed** panel (D4) and the **Workflow help** (D5).
5. Verify (Step 6).

## Step 6 — Verify (must pass before done, per the master-plan acceptance)

Serve via `serve.ps1`; browser on localhost. Back up `balance-data.*` and
`balance-history/` first; **end with on-disk data restored to the L2 baseline**
and the parity probes green. Assert on DOM/console/network — no canvas capture.
1. **Three revisions:** through the Lab, make and save three distinct edits (e.g.
   laser baseCost, an enemy stat, a level's startingMoney), each with a note →
   three new revisions appear in History with correct notes, timestamps, change
   counts, and an active-badge that moves to the newest.
2. **Diff is correct:** View diff on each of the three shows exactly the intended
   change(s) vs the prior active data.
3. **Restore the first:** Restore the first of those three → review diff shows the
   reversal, save it → active data now equals that first revision's values
   (verify via `GET /api/balance` and a fresh game import); the note reads
   "restored from <id>".
4. **History intact (append-only):** all prior snapshots (baseline + the three +
   the restore) still exist as files in `balance-history/`; nothing deleted; the
   manifest lists them all with `activeRevision` = the restore revision.
5. **Reload Lab + game:** hard-reload the Lab and reload `index.html` → both
   reflect the restored active values; console-clean.
6. **Git shows changes normally:** `git status` shows `src/balance-data.json`,
   `src/balance-data.js`, and `balance-history/*` as changed/added — nothing was
   auto-committed; the Files-changed panel matches reality.
7. **Cleanup + regressions:** restore the L2 baseline, confirm L0/L1/L2 parity
   probes green and `index.html` boots clean; the Lab still works at 375px
   portrait.
8. Sweep for ` 2` iCloud conflict files.

Report: the three-revision + restore-first flow with values verified before/after;
proof snapshots are append-only (file list) and the manifest is correct; that a
fresh Lab + game reflect the restored values; that `git status` shows the data +
history changes and nothing was committed/pushed; the exact files edited; and the
` 2` sweep result.

## Acceptance (L6, from the master plan)

- Save three revisions, restore the first, reload Lab/game → original snapshots
  remain while restored values are active. ✔ (Steps 1, 3–5)
- Git shows all changes normally. ✔ (Step 6)

## Files this phase edits

```
EDIT  balance-lab.html    History browser markup, diff/restore/files-changed/help containers
EDIT  balance-lab.css     history list, diff, badges, help-panel styles
EDIT  src/balance-lab.js  history load + adjacent diffs, view-diff, restore-via-draft, files-changed, workflow help
```

Do not edit `index.html`, `config.js`, `levels.js`, `balance-schema.js`,
`balance-data.*`, `serve.ps1`, other `src/` modules, or `version.js`. Do not
modify `.gitignore`. Leave everything in the working tree for review.

## Notes handed to L7

- L7 (QA + handoff + phone readiness) finalizes: full baseline+history validation,
  a sampled campaign/Endless/save-migration/server-restart test pass, updating
  `HANDOFF.md` + this plan, moving the in-Lab workflow help into the docs, and
  committing the phases in small units (only if the user asks). The deferred
  `serve.ps1 -LabLan` phone path stays documented and unbuilt.
```