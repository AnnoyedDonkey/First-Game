# Balance Lab — L3 build plan (local persistence API)

Status: **complete** · 2026-07-18 · Phase L3 of `BALANCE_LAB_PLAN.md`.

Delivered the canonical JSON/generated-module conversion, manifest active
revision pointer, and all five localhost-only API endpoints. Acceptance
verification passed: temporary edits reached a reloaded game; stale, malformed,
structurally invalid, oversized, wrong-method, wrong-content-type, and unknown
revision requests returned the planned status codes without mutating active
data; restore appended a third immutable snapshot and returned active JSON/JS
byte-for-byte to the L2 baseline; static responses were byte-identical; and the
L0/L1/L2 probes finished 18/18, 17/17, and 6/6 with zero diffs.

Execution plan for phase **L3** of `BALANCE_LAB_PLAN.md`. Read `BALANCE_LAB_L0.md`
(schema contract) and skim `BALANCE_LAB_L1_PLAN.md` / `BALANCE_LAB_L2_PLAN.md`
(the migration pattern + the parity-probe habit) first. L3 adds a
**localhost-only read/save/restore API inside `serve.ps1`**. It is a PowerShell +
security task; it does **not** change gameplay data values and must not break the
game or normal static serving.

## Golden rules

- Plain HTML/CSS/ES modules + PowerShell only. No framework, build step,
  package, database, Node, or cloud feature. (Node is NOT installed — do not
  assume it.)
- The API binds to **localhost only**. No LAN/`0.0.0.0` binding in this phase
  (that is the deferred `-LabLan` path). GitHub Pages is never a writable admin
  surface.
- **Never auto-commit, auto-push, or modify `.gitignore`.** `balance-history/`
  and the data files stay git-tracked.
- Do not bump `src/version.js` (local tooling, no player-facing change).
- Saving is atomic and validate-first: a failed or interrupted save changes
  **nothing** that the game reads.
- Keep the game runnable and console-clean; keep normal static serving
  byte-identical for every non-API path.
- After edits, sweep for iCloud ` 2` conflict filenames and rename any back.
- Restore never deletes history; it appends a new revision.

## Design decisions (resolve these the way stated — they are the crux of L3)

### D1 — Canonical data becomes JSON; `balance-data.js` becomes generated

PowerShell cannot safely evaluate a JS object literal, so the API needs a
machine-readable data file. Introduce:

- **`src/balance-data.json`** — the **canonical** editable data (exactly the
  `BALANCE` object; i.e. what `validate()` checks). This is what the API reads,
  writes, and snapshots. Pretty-printed (2-space) so git diffs stay readable.
- **`src/balance-data.js`** — becomes a **generated re-export** that inlines the
  JSON so the browser keeps a *synchronous* import (no async, no import
  attributes, no game changes):

  ```js
  // GENERATED FILE — the Balance Lab rewrites the data block below on every save.
  // Edit balance values through the Lab (or balance-data.json), never here by hand.
  import { SCHEMA_VERSION } from "./balance-schema.js";
  // @BALANCE-DATA-START
  export const BALANCE = /* <pretty-printed JSON, verbatim> */;
  // @BALANCE-DATA-END
  export { SCHEMA_VERSION };
  ```

  Because valid JSON is a valid JS object-literal expression, the generator is
  literally `export const BALANCE = ` + `<json text>` + `;` between the markers —
  no escaping, no `JSON.parse`. The API rewrites **only** the block between
  `@BALANCE-DATA-START` / `@BALANCE-DATA-END`.

**One-time L3 conversion (do first, gate on parity):** extract the current
`BALANCE` to `src/balance-data.json`, then regenerate `src/balance-data.js` in
the generated shape above. The exported `BALANCE` value must stay **byte-for-byte
equal** — the L0/L1/L2 probes must all still pass afterward (Step 6). Keep the
L1 soft dev-validation guard if present, or drop it in favor of the Lab's
validation (either is fine as long as it never throws at import).

> Rationale: keeps the game's synchronous `import { BALANCE }` untouched; gives
> the PowerShell API a pure-JSON file it can read/write with no JS parsing; makes
> snapshots and diffs trivial. `balance-data.js` is now a build artifact of
> `balance-data.json`.

### D2 — Authoritative semantic validation stays client-side (JS); the server gates structure

`balance-schema.js` `validate()` is JavaScript; PowerShell can't run it, and
re-implementing the full rule catalog in PowerShell would guarantee drift. So:

- **Client (Lab, L4/L5) runs `validate()`** before POSTing — the authoritative
  semantic gate (ranges, enums, references, map structure, world links).
- **Server (`serve.ps1`) performs a structural gate** it can do in PowerShell:
  body parses as JSON; has the expected top-level keys
  (`enemies, towers, towerUpgrades, economy, waveDefaults, endless,
  endlessRewards, levelMilestones, loot, skills, levels, worlds`); `schemaVersion`
  matches; size within cap; revision token current. Only then does it swap.

This satisfies "invalid/interrupted saves preserve active data" (validate-first +
atomic write) without duplicating rule logic. Document the split in a comment.
`POST /api/balance/validate` returns the **server structural** result; note in the
response and docs that deep validation is the client's `balance-schema.js` (and a
future Node harness could run the same module server-side).

### D3 — Revision tokens are history snapshot ids; the active pointer lives in the manifest

- Extend `balance-history/manifest.json` with an **`activeRevision`** field (the
  id of the snapshot representing current on-disk data). Seed it to the L2
  baseline id already present in `revisions[]`.
- A read returns `{ schemaVersion, revision: activeRevision, data }`.
- A save carries `baseRevision`; if `baseRevision !== activeRevision` → **409
  stale** (this is the "stale two-tab save fails" case). On success the new
  snapshot id becomes `activeRevision`.
- Revision ids are server-generated timestamps (existing scheme, e.g.
  `2026-07-18T154357Z-baseline` → new ids like `<UTC>Z-<counter>`). **Never** use
  a client-supplied string as a filename; for restore, match the requested
  revision against `manifest.revisions[].id` exactly and reject anything else
  (path-traversal guard).

## Endpoint contract

All API paths are under `/api/balance`. All responses set
`Cache-Control: no-store` and `Content-Type: application/json; charset=utf-8`.
Non-API paths fall through to the **existing** static handler unchanged.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET  | `/api/balance` | — | `200 { schemaVersion, revision, data }` (data = balance-data.json) | 500 if data files missing |
| GET  | `/api/balance/history` | — | `200 { schemaVersion, activeRevision, revisions:[…] }` (manifest.json) | 500 |
| POST | `/api/balance/validate` | `{ data }` | `200 { ok, errors:[] }` (server structural check) | 400 bad JSON / 413 too large / 415 wrong type |
| POST | `/api/balance/save` | `{ baseRevision, note, data }` | `200 { revision, activeRevision }` | 400 / 409 stale / 413 / 415 / 422 structural-invalid |
| POST | `/api/balance/restore` | `{ revision, note? }` | `200 { revision, activeRevision }` (new revision) | 400 / 404 unknown revision / 409 stale-if-baseRevision-sent |

- `note` on save is required and non-empty (revision-note-required, per L5/L6);
  server rejects empty note with 400.
- Unknown `/api/balance/*` subpaths → 404. Non-GET/POST methods → 405.

## Atomic save/restore algorithm (order matters)

For `save` (and `restore`, which is a save whose `data` = the chosen snapshot's
`data` with note `"restored from <revision>"`):

1. **Gate the request** (before touching any file): loopback-only (see security);
   method POST; `Content-Type: application/json`; body ≤ cap; body parses as
   JSON; required top-level keys present; `schemaVersion` matches; `note`
   non-empty; `baseRevision === activeRevision` (else 409). Any failure → error
   response, **zero files changed**.
2. Generate the new revision id (UTC timestamp + short counter; ensure it does
   not collide with an existing `revisions[].id`).
3. **Write the new snapshot first** (a brand-new file, cannot affect active
   state): `balance-history/<newid>.json` =
   `{ schemaVersion, createdAt, note, data }` via temp-file + atomic rename.
4. **Swap the active data** atomically: write `src/balance-data.json.tmp`
   (verbatim posted JSON text, pretty-printed), then rename over
   `src/balance-data.json`. Regenerate `src/balance-data.js` the same way
   (write `.tmp`, rename) with the JSON inlined between the markers.
5. **Update the manifest** last: append the new revision to `revisions[]` and set
   `activeRevision = <newid>` via temp-file + atomic rename.
6. Respond `200 { revision: newid, activeRevision: newid }`.

If the process dies mid-way: before step 4's rename, active data is untouched;
after step 4, the game reads the new data and the worst residue is a snapshot
whose manifest entry didn't land (recoverable, and it never corrupts active
data). Persist the **raw posted JSON text** for the data file (do not
round-trip through `ConvertTo-Json`, which would risk key reordering / the
depth-2 default) — the Lab controls formatting and the bytes should survive
untouched. Use `ConvertFrom-Json` only to *inspect* (structural gate), not to
re-serialize the persisted data.

## Security checklist (localhost admin surface — enforce all)

- **Loopback only:** reject any request whose `Request.RemoteEndPoint.Address`
  is not `IPAddress.Loopback` / `::1`, in addition to the listener already
  binding `http://localhost:$Port/`. (Defense in depth for the deferred LAN
  phase.)
- **Path exactness:** API dispatch matches exact `/api/balance[/subpath]`
  strings; never build a filesystem path from the request path or from
  client-supplied `revision`/ids. Restore matches `revision` against the manifest
  whitelist.
- **Method + content-type gating:** as per the table; POST requires
  `application/json`.
- **Body size cap:** e.g. 2 MB; reject larger with 413 before reading fully into
  memory where practical.
- **Confine writes:** only ever write `src/balance-data.json`,
  `src/balance-data.js`, `balance-history/<serverGeneratedId>.json`,
  `balance-history/manifest.json`, and their `.tmp` siblings — all resolved with
  `[IO.Path]::GetFullPath` and asserted to start with `$root` (reuse the existing
  static-serve guard pattern).
- **no-store** on every API response.
- Never expose stack traces; return terse JSON error `{ error, code }`.

## `serve.ps1` integration

- Keep the existing static server exactly as-is for non-API paths (the acceptance
  requires "normal static serving remains unchanged" — verify byte-identical
  responses for `index.html`, `.js`, `.css`).
- Add API routing at the top of the request loop: if `AbsolutePath` starts with
  `/api/balance`, handle via a new dispatch function and `continue`; otherwise
  run the current static branch untouched.
- Read POST bodies from `context.Request.InputStream` with the request's
  encoding; guard against oversized reads.
- PowerShell 5.1 notes: `ConvertFrom-Json` returns `PSCustomObject` (no
  `-AsHashtable`); `ConvertTo-Json` defaults to `-Depth 2` — if you ever
  re-serialize (manifest only, which is shallow), pass a generous `-Depth`. For
  the deep balance data, persist the raw request text (see algorithm) rather than
  re-serializing. Write files UTF-8 **without BOM** (the browser import and JSON
  fetch must not choke on a BOM) — use `[IO.File]::WriteAllText($path, $text,
  (New-Object Text.UTF8Encoding($false)))`.
- Keep the whole API behind the existing single-threaded request loop; a
  localhost single-user tool needs no concurrency beyond the revision-token
  staleness check.

## Step-by-step

1. **D1 conversion + parity gate:** create `src/balance-data.json` from current
   `BALANCE`; regenerate `src/balance-data.js` (generated shape). Serve and
   confirm L0 (18/18), L1 (17/17), L2 (0 diffs) probes still pass and the game
   boots clean. Do not proceed until green.
2. **Manifest `activeRevision`:** add `activeRevision` (= existing baseline id)
   to `balance-history/manifest.json`.
3. **serve.ps1 API:** implement the routing + the five endpoints + the atomic
   algorithm + the security checklist.
4. **Optional helper (browser):** a tiny `src/balance-api.js` client wrapper
   (`getBalance`, `getHistory`, `validate`, `save`, `restore`) is welcome if it
   keeps L4/L5 clean, but keep it thin and dependency-free. Skip if premature.
5. **Verify (Step 6).**

## Step 6 — Verify (must pass before done)

Back up `src/balance-data.json`, `src/balance-data.js`, and `balance-history/`
before destructive tests (they are untracked, so `git checkout` won't restore
them). End the phase with the working data equal to the L2 baseline.

Use `serve.ps1` + `Invoke-WebRequest`/`Invoke-RestMethod` (or the browser) —
localhost only:
1. **Static unchanged:** `GET /index.html`, a `.js`, and a probe return 200 with
   identical bytes/behavior; the three parity probes stay green; game boots
   console-clean.
2. **Read:** `GET /api/balance` → `{ schemaVersion:1, revision:<baseline id>,
   data }`; `data` deep-equals `balance-data.json`. `GET /api/balance/history` →
   manifest with `activeRevision` = baseline.
3. **Happy save:** POST `save` with `baseRevision` = current, a note, and `data`
   containing one trivial edit (e.g. `levels.level_001.startingMoney` +1) →
   200 with a new revision; `balance-data.json` on disk reflects it; a fresh
   `GET /api/balance` returns the new revision + data; **reload the game page and
   confirm it now reads the new value** (the "refresh sees new on-disk data"
   acceptance); a new `balance-history/<id>.json` exists and the baseline
   snapshot is untouched.
4. **Stale save fails:** POST `save` again with the *old* `baseRevision` → **409**;
   on-disk data unchanged.
5. **Invalid/interrupted preserves data:** POST `save` with malformed JSON →
   4xx and `balance-data.json` unchanged; POST with a missing top-level key →
   422 and unchanged.
6. **Restore:** `POST /api/balance/restore { revision:<baseline id>, note }` →
   200 new revision; active data returns to baseline values; **the baseline and
   the intermediate snapshots all still exist** (nothing deleted); manifest shows
   all revisions with `activeRevision` = the new restore revision.
7. **Security spot-checks:** wrong method (405), wrong content-type (415),
   oversized body (413), unknown `/api/balance/x` (404), a `restore` with a
   bogus `revision` (404, no file access).
8. Restore working data to the L2 baseline (via the restore endpoint or the
   backups) and re-confirm all three parity probes green + game boots clean.
9. Sweep for ` 2` iCloud conflict files.

Report: each endpoint's behavior (happy + every rejection), proof that a saved
edit reaches the game after refresh, proof that stale/invalid saves don't mutate
active data, proof history is append-only through a restore, that static serving
+ the three probes are still green, the exact files created/edited, and
confirmation of no version bump / commit / push / `.gitignore` change and
localhost-only binding.

## Acceptance (L3, from the master plan)

- Refresh sees new on-disk data. ✔ (Step 6.3)
- Stale two-tab saves fail. ✔ (Step 6.4 — revision token)
- Invalid/interrupted saves preserve active data. ✔ (Steps 6.5, atomic algorithm)
- Normal static serving remains unchanged. ✔ (Step 6.1)

## Files this phase creates or edits

```
CREATE  src/balance-data.json         canonical editable data (pure BALANCE, pretty JSON)
EDIT    src/balance-data.js           becomes generated re-export inlining the JSON (BALANCE byte-identical)
EDIT    balance-history/manifest.json add activeRevision pointer
EDIT    serve.ps1                     add localhost-only /api/balance read/save/restore + atomic writes + security
CREATE  src/balance-api.js            (optional) thin browser client wrapper for L4/L5
```

Do not edit `config.js`, `levels.js`, `balance-schema.js` rules (unless a genuine
structural-gate helper is needed), any other `src/` module, `version.js`, or save
code. Do not modify `.gitignore`. Leave everything in the working tree for review.

## Notes handed to L4+

- L4 (read-only Lab shell) fetches through `GET /api/balance` + `/history` and
  shows `revision` / schema / source timestamp; it must run `validate()` client-
  side and stay read-only until this API is proven.
- L5 save flow: client `validate()` → `POST /api/balance/save { baseRevision,
  note, data }`; surface 409 as "another tab/edit changed the data — reload."
- L6 restore/diff builds on `/history` + `/restore`; the append-only guarantee
  and `activeRevision` semantics are already established here.
