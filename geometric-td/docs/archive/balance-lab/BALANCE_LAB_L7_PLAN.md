# Balance Lab — L7 build plan (QA, handoff & phone readiness)

Execution plan for the final phase **L7** of `BALANCE_LAB_PLAN.md`. Read
`BALANCE_LAB_PLAN.md` (the whole arc), `BALANCE_LAB_L0.md` (schema), and skim the
L3–L6 plan files. L7 is **not** a feature build — it is QA, documentation, git
hygiene, and documenting the deferred phone path. Its goal: a reliable
**non-developer workflow**. Minimal code changes (in-Lab help polish only, if
needed); mostly testing + docs + a one-time history cleanup.

## Golden rules

- Do **not** change any gameplay/data value. This phase must not alter balance;
  the parity probes (L0 18/18, L1 17/17, L2 6/6) must stay green throughout.
- Plain HTML/CSS/vanilla ES modules + PowerShell + Markdown. No new deps.
- **Do not auto-commit and do not push.** L7 *prepares and proposes* the commit
  (grouping + messages) and leaves the actual `git commit` to the user (or this
  orchestrator) — committing stays a deliberate human action, and pushing only
  when explicitly requested. Never modify `.gitignore` to exclude Lab data/
  history.
- The only code you may touch is `balance-lab.*` (help-text polish) and the two
  cleanup targets in Part B. Do not touch `config.js`, `levels.js`,
  `balance-schema.js`, game modules, `index.html`, `serve.ps1`, or `version.js`.
- After edits, sweep for iCloud ` 2` conflict filenames and rename any back.

## Part A — Comprehensive QA pass

Run through `serve.ps1` on localhost; assert on DOM/console/state — **never
capture the game canvas**. Record pass/fail for each.
1. **Data validity:** `validate(BALANCE).ok === true`; validate the baseline
   snapshot's `.data`; after Part B, validate every shipped history snapshot.
2. **Game startup:** `index.html` boots console-clean; main menu renders.
3. **Sampled campaign:** construct/enter L1, L5, L10, L15 — path fills, blocked
   tiles off-path, wave/group counts match the data; run a short wave sim on at
   least L1 (use `window.game`/`step()`); no console errors. Reload the page
   before each isolated sim (roster/module-state contamination gotcha from
   HANDOFF).
4. **Endless:** confirm an Endless run still generates past the authored waves on
   at least one level (it reads `config.js` → `balance-data`); no errors.
5. **localStorage save load:** confirm an existing `geometric-td-save-v1` save
   loads cleanly (L1–L6 never touched `save.js`; verify roster/menu load with a
   pre-existing save present — back it up first, never wipe it).
6. **Schema versioning:** `migrate()` no-ops a v1 file, rejects a newer/unknown
   version (re-confirm the L1 self-test).
7. **Server restart + restore:** stop and restart `serve.ps1`; confirm
   `GET /api/balance` still returns current on-disk data, and a save + restore
   still work after restart (persistence survives a restart).
8. **Full non-developer loop (the acceptance rehearsal):** in the Lab, edit a
   tower stat and a wave value, Save with a note, reload the game to see the
   change, then Restore the prior revision through the Lab — all without editing
   any JavaScript. Then return to baseline.

## Part B — One-time history cleanup (pre-ship hygiene)

Verification across L3/L5/L6 left **acceptance-test revisions** in
`balance-history/` (money±1 / cost±N / restore snapshots). The shipped Lab should
start from a clean history containing only the **L2 baseline**. Do this once,
carefully, and re-verify:
1. Back up `balance-history/`, `src/balance-data.json`, `src/balance-data.js`
   first.
2. Set `src/balance-data.json` to the **baseline snapshot's `.data`** (the
   `…-baseline.json` file's `data`), and regenerate `src/balance-data.js` from it
   (same generated shape L3 uses — `BALANCE` must stay byte-identical to
   baseline; the parity probes are the gate).
3. Delete the test snapshot files, keeping only
   `balance-history/<…>-baseline.json`.
4. Rewrite `balance-history/manifest.json` to contain only the baseline revision,
   with `activeRevision` = the baseline id.
5. Re-verify: `GET /api/balance` returns the baseline revision + values
   (50 / 20 / 100 for laser cost / basic HP / L1 money); L0 18/18, L1 17/17,
   L2 6/6; game boots clean; the Lab's History shows a single baseline revision.

> This direct file cleanup is a deliberate one-time developer action (the API is
> intentionally append-only and can't delete). It is the only place L7 edits the
> data/history files, and it must not change any *value* — only prune history.

## Part C — Documentation

1. **Create `BALANCE_LAB_USAGE.md`** — a concise, non-developer guide:
   - Start the server (`./serve.ps1`), open `http://localhost:8420/balance-lab.html`.
   - Edit a value / add-or-edit a wave group; watch validation + previews.
   - Save with a revision note (required); what "stale — reload" means.
   - Test locally (reload the game), and how to Restore a prior revision.
   - Review the change in git and commit manually (the Lab never commits/pushes).
   - What each file is (`balance-data.json` canonical, `balance-data.js`
     generated, `balance-history/`), and the read-only-for-now items (map
     geometry). Keep it short and task-oriented — a non-dev should follow it
     without reading any other doc.
2. **Finalize in-Lab help** (from L6) so it matches the usage guide; polish only.
3. **Update `HANDOFF.md`:** mark the Balance Lab **complete (L0–L7)**; add a
   short "Using the Balance Lab" pointer to `BALANCE_LAB_USAGE.md`; ensure the
   file map lists `balance-lab.*`, `balance-data.json/.js`, `balance-schema.js`,
   `balance-history/`, and the API in `serve.ps1`.
4. **Update `BALANCE_LAB_PLAN.md`:** mark L7 ✅ DONE and note the Lab shipped
   locally (still no player-facing change / no `version.js` bump).

## Part D — Deferred phone path (`serve.ps1 -LabLan`)

Document, do **not** build:
- Add a short "Deferred: home-LAN phone access" note (in `BALANCE_LAB_USAGE.md`
  or `HANDOFF.md`) describing how a future `serve.ps1 -LabLan` would bind beyond
  localhost for phone editing on the home network, the security posture it must
  keep (LAN-only, **never public-internet exposure**, still localhost-default,
  the loopback check relaxed only under the explicit flag), and that GitHub Pages
  is never a writable admin surface. Leave it clearly unbuilt/deferred.

## Part E — Git hygiene + commit proposal (do not commit/push yourself)

1. `git status` + `git diff` review of everything the Lab work touched:
   modified `src/config.js`, `src/levels.js`, `serve.ps1`, `HANDOFF.md`; new
   `src/balance-data.json`, `src/balance-data.js`, `src/balance-schema.js`,
   `src/balance-lab.js`, `balance-lab.html/.css`, `balance-history/`, the
   `BALANCE_LAB_*.md` docs, the probes, `docs/`.
2. Confirm `.gitignore` does **not** exclude any Lab data/history/source file
   (they must all be committable).
3. **Propose** a small-unit commit plan with suggested messages, e.g.:
   - L0 inventory/schema docs + probe
   - L1 config-side `balance-data`/`balance-schema` + `config.js` re-export
   - L2 levels/waves migration + `levels.js` re-export + baseline history
   - L3 `serve.ps1` local API + JSON canonicalization
   - L4 read-only Lab shell
   - L5 editable controls
   - L6 history/restore
   - L7 docs/usage/handoff
   (Retroactive splitting is imperfect since the tree is intermingled; a smaller
   number of logical commits is fine. Present the grouping and messages; let the
   user decide.)
4. **Stop there.** Do not run `git commit` or `git push` unless the user
   explicitly authorizes it in-session. Report the proposed plan.

## Step — Verify (L7 acceptance)

The acceptance is workflow-level: **a non-developer can edit a tower/wave, save
with a note, test locally, restore it, and manually commit without editing
JavaScript.** Prove it end-to-end:
1. Following only `BALANCE_LAB_USAGE.md`, perform: edit a tower stat + a wave
   group value → Save with a note → reload the game and see the change → Restore
   the previous revision via the Lab → confirm the values revert. No JS was
   edited at any point.
2. Confirm the git diff for that experiment shows the expected data/history file
   changes and that committing would be a normal `git add`/`commit` (do not
   actually commit).
3. Return on-disk data to the clean baseline (Part B state); L0/L1/L2 parity
   probes green; `index.html` console-clean; Lab works at 375px portrait.
4. Full QA checklist (Part A) all pass; history is the single clean baseline
   (Part B); docs updated (Part C); phone path documented (Part D); commit plan
   proposed (Part E, uncommitted).
5. Sweep for ` 2` iCloud conflict files.

Report: the Part A QA results (each item), confirmation the history is reset to
the clean baseline and parity is green, the new `BALANCE_LAB_USAGE.md` +
HANDOFF/plan updates, the deferred `-LabLan` note, and the **proposed** commit
plan (with a clear statement that nothing was committed or pushed). If any QA item
fails, STOP and report it rather than papering over it.

## Acceptance (L7, from the master plan)

- A non-developer can edit a tower/wave, save with a note, test locally, restore
  it, and manually commit without editing JavaScript. ✔ (Verify Steps 1–2 + the
  usage guide)

## Files this phase creates or edits

```
CREATE  BALANCE_LAB_USAGE.md      non-developer usage guide (+ deferred -LabLan note)
EDIT    HANDOFF.md                Lab complete (L0–L7); usage pointer; file map
EDIT    BALANCE_LAB_PLAN.md       mark L7 DONE; Lab shipped locally
EDIT    (optional) balance-lab.*  in-Lab help polish only
RESET   src/balance-data.json/.js, balance-history/*   Part B one-time cleanup to clean baseline
```

Do not change gameplay values, `config.js`, `levels.js`, `balance-schema.js`,
game modules, `index.html`, `serve.ps1`, or `version.js`. Do not modify
`.gitignore`. Do not commit or push (propose only). Leave everything in the
working tree for the user's review.

## Deferred after L7 (documented, not built)

- Explicit home-LAN phone access (`serve.ps1 -LabLan`), LAN-only, no public
  exposure.
- Read-only GitHub Pages Lab, if useful.
- Simulation/telemetry analysis inside the Lab.
- VFX/layout controls, presets/import-export, in-draft undo/redo, a safe map
  (grid/path/blocked) editor.
```