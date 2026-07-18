# Balance Lab — L4 build plan (read-only Lab shell)

Execution plan for phase **L4** of `BALANCE_LAB_PLAN.md`. Read `BALANCE_LAB_L0.md`
(the schema/data-shape contract) and skim `BALANCE_LAB_L3_PLAN.md` (the API this
page consumes) first. L4 builds the **read-only** admin UI: a separate page that
fetches the live balance data through the L3 API and renders every editable value
clearly and navigably. **No editing and no writes in this phase** — editable
controls + save are L5; restore/diff are L6. This is a front-end (HTML/CSS/vanilla
ES module) task.

## Golden rules

- Plain HTML/CSS/vanilla ES modules. No framework, build step, package, or CDN.
- **Read-only: the page must never POST.** It calls only `GET /api/balance` and
  `GET /api/balance/history`. No call to `/save`, `/restore`, or `/validate`
  (server-side validate is a POST; do client-side `validate()` instead — see D3).
- Separate surface: create `balance-lab.html`; **do not touch `index.html`** or
  any player game file. The player menu must be completely untouched.
- Responsive and phone-portrait-friendly (works at 375px wide) — mobile-first.
- No `version.js` bump, no commit/push, no `.gitignore` change.
- After edits, sweep for iCloud ` 2` conflict filenames and rename any back.

## What L3 gives you (the response contract to build against)

Verified working. Serve with `serve.ps1` (launch config name `geometric-td`),
then:
- `GET /api/balance` → `200 { schemaVersion, revision, data }`. `data` is the
  full `BALANCE` object (the canonical editable data — see its shape in
  `BALANCE_LAB_L0.md` "Data home"). `revision` is the active revision id.
- `GET /api/balance/history` → `200 { schemaVersion, activeRevision,
  revisions:[ { id, createdAt, note, dataSchemaVersion, file, baseline? } ] }`.
- All responses are `no-store`. The API is localhost-only; the page only works
  when served by `serve.ps1` locally.

`data` contains **editable numbers only** — NOT presentation (tower/enemy names,
colors, level names, palettes live in `config.js`/`levels.js`). See D2 for how to
label things.

## Design decisions

### D1 — Separate local-only page, graceful when opened wrong
- Entry point `balance-lab.html` at repo root, loaded via
  `http://localhost:8420/balance-lab.html` (or the harness port). Not linked from
  the player menu; reachable only by typing the URL.
- On load, fetch `GET /api/balance`. If the fetch fails (opened from `file://`,
  from GitHub Pages, or without `serve.ps1`), render a clear, friendly panel:
  "Balance Lab needs the local server — run `./serve.ps1` and open this page from
  `http://localhost:…`." Never blank-screen or throw.

### D2 — Render editable values from the API; enrich labels from the game modules (read-only)
- All **values** come from the API `data` (so the Lab shows exactly what will be
  edited/saved later).
- For human-friendly **labels** (tower display names/colors, enemy names, level
  names), the page MAY additionally `import { TOWERS, ENEMIES } from
  "./src/config.js"` and `{ LEVELS, WORLDS } from "./src/levels.js"` purely for
  presentation. This import is read-only and must never feed back into a save.
  (Alternative: show raw ids like `laser`, `level_001` — acceptable but less
  friendly.) Recommended: import for labels; fall back to ids if an id is missing
  from the presentation source.

### D3 — Wire the authoritative validator now (read-only sanity)
- `import { validate } from "./src/balance-schema.js"` and run it on the loaded
  `data`; show a validity badge in the Overview (should be "valid"). This proves
  the L5 save path's client-side gate is wired and gives an early warning if
  on-disk data ever drifts invalid. Do not block rendering on it.

### D4 — Draft infrastructure as inert scaffolding for L5 (no persistence)
Build the plumbing L5 will hook editable inputs into, but keep it dormant:
- Hold `server = data` (last fetched) and `draft = structuredClone(data)`.
- **Reload from server** control: re-fetches `GET /api/balance`, replaces
  `server` + `draft`, re-renders. Reflects out-of-band changes (e.g., a save made
  in another tab).
- **Reset draft** control: `draft = structuredClone(server)` (no-op while
  read-only, but present).
- **Dirty state**: `isDirty = !deepEqual(draft, server)` — always false in L4
  (nothing edits `draft` yet). Show a dirty indicator area that stays "no unsaved
  changes."
- **beforeunload guard**: warn only when `isDirty` (inert in L4). This is the
  unsaved-change warning L5 relies on.
- **No Save button wired.** If you show one, disable it with a "editing arrives in
  L5" tooltip. Do NOT wire any POST.

## Sections (all read-only)

A left/na v or top-tab layout with these sections; each renders from `draft`
(== server in L4):

1. **Overview** — schema version, active revision id + `createdAt` timestamp,
   validity badge (D3), and computed counts: #towers, #enemies, #levels, #waves,
   #wave-groups (159/313 today), #worlds. A one-line "read-only — editing in L5"
   notice.
2. **Towers** — per-tower table: baseCost, baseDamage, baseRange, baseFireRate,
   and the present optional stats (basePierce, splashRadius, projectileSpeed,
   slowPercent, slowDuration, vulnerability, pierceWidth, upgradeCostMult,
   damageType). Label rows with tower display names (D2).
3. **Enemies** — per-enemy: baseHealth, speed, coreDamage, bounty, xp, shardTier,
   and present optionals (regenRate, splitInto). Render `damageMult` counters as
   a readable matrix (enemy × damage type), highlighting resist (<1) vs weak (>1).
4. **Upgrades & Economy** — `towerUpgrades` (maxLevel, the five growth rates,
   xpThresholds[9], upgradeCosts[9], mastery block, per-tower specialties),
   `economy`, `waveDefaults`, `loot.xp`/`loot.shards`, and the `skills` block
   (tiers, per-tower damageStep, layouts, economy steps, values).
5. **Campaign Levels** — a **level/world picker** (pick a world, then a level).
   For the selected level: metadata (grid, startingMoney, coreHealth, bountyMult,
   timeBetweenWaves, autoStartNextWave), a path/blocked summary (counts; optional
   tiny grid preview is a nice-to-have, not required), and an **expandable wave
   table**: one row per wave, expandable to its groups (type, count, spawnInterval,
   startDelay, healthMult, speedMult, bountyMult, xpMult). Include **calculated
   read-only summaries** per wave (e.g., total enemies, group count) — clearly
   marked as derived, not editable.
6. **Endless** — `endless` knobs and `endlessRewards` (defaultTrack milestones +
   any tracksByLevel), rendered as a readable table.
7. **History** — from `GET /api/balance/history`: list revisions (id, timestamp,
   note, baseline badge, and a marker on `activeRevision`), newest first.
   Read-only — no restore button (that is L6).
8. **Changes** — a draft-vs-server diff view. In L4 it always shows "no changes."
   Build the diff renderer (path → before/after) as scaffolding L5/L6 reuse.

Add a **search** box that filters visible fields/rows by keyword across sections
(e.g., typing "pierce" or "startingMoney" surfaces matching rows). Keep it simple
(substring match on labels/paths).

## Styling (`balance-lab.css`)

- Mobile-first, single-column at phone width; widen to multi-column/table layout
  on larger screens. Wave/stat tables must scroll horizontally inside their own
  container — the page body must never scroll sideways at 375px.
- Utility aesthetic; a dark neon-ish theme to match the game is fine but legibility
  first. Respect `prefers-reduced-motion` (no perpetual animations).
- Do not import game `styles.css` (avoid coupling); this page has its own CSS.

## Step-by-step

1. `balance-lab.html`: minimal shell (header with revision/schema/validity, section
   nav, search box, a mount point) + `<script type="module" src="./src/balance-lab.js">`.
2. `src/balance-lab.js`: fetch data + history; build `server`/`draft`; import
   `validate` (D3) and optionally presentation (D2); render all sections; wire
   search, level/world picker, wave expand/collapse, reload/reset controls, the
   inert dirty/beforeunload scaffolding. Handle the API-unreachable case (D1).
3. `balance-lab.css`: responsive styles.
4. Verify (Step 5).

## Step 5 — Verify (must pass before done)

Serve with `serve.ps1`; use the browser (localhost). Do NOT capture the game
canvas anywhere; assert on DOM/console/network.
1. **Renders live data:** load `balance-lab.html`; every section renders; spot-
   check that shown values equal `GET /api/balance` `data` (e.g., a tower's
   baseCost, level_001 startingMoney = 100, wave/group counts 159/313, a
   damageMult counter). Overview shows the active revision + "valid" badge.
2. **Hard reload persists:** hard-refresh; values still render (fetched fresh, no
   reliance on cache).
3. **Read-only — proves no writes:** capture the active revision from
   `/api/balance`, click through every section/control (including Reload and
   Reset), then re-GET — `activeRevision` unchanged, and network shows **zero POST
   requests** to `/api/balance/*`. (Use the network panel or wrap `fetch` to log
   method.)
4. **Live re-fetch works:** in a second tab (or via curl), POST a trivial
   save through the API, then hit **Reload from server** in the Lab — the changed
   value appears; **restore the baseline afterward** so on-disk data ends at the
   L2 baseline (and confirm the L0/L1/L2 parity probes are still green).
5. **Phone portrait:** at 375px width, layout is single-column, no horizontal body
   scroll; wave tables scroll within their own container; picker/search usable.
6. **Player menu untouched:** `index.html` still boots console-clean and is
   visually/behaviorally unchanged; `git status` shows no edit to `index.html` or
   any `src/` game module (only the three new Lab files).
7. **Graceful offline:** load the page in a way the API is unreachable (e.g., stop
   the server and open a cached copy, or point at a bad path) → the friendly
   "run serve.ps1" panel shows, no console error spew.
8. Sweep for ` 2` iCloud conflict files.

Report: what each section renders (with a couple of value spot-checks against the
API), proof of zero POSTs / unchanged active revision after clicking around,
phone-portrait result, confirmation `index.html`/game modules are untouched and
the parity probes stay green, the exact files created, and confirmation of no
version bump / commit / push / `.gitignore` change.

## Acceptance (L4, from the master plan)

- Current values render after hard reload. ✔ (Steps 5.1–5.2)
- No UI action writes data. ✔ (Step 5.3)
- Page works at phone portrait width. ✔ (Step 5.5)
- Normal player menu is untouched. ✔ (Step 5.6)

## Files this phase creates

```
CREATE  balance-lab.html      local admin entry point (read-only shell)
CREATE  balance-lab.css       responsive Lab styles
CREATE  src/balance-lab.js    Lab UI/controller (fetch + render, read-only)
```

Do not edit `index.html`, `config.js`, `levels.js`, `balance-schema.js`,
`balance-data.*`, `serve.ps1`, any other `src/` module, or `version.js`. Do not
modify `.gitignore`. Leave everything in the working tree for review.

## Notes handed to L5

- The draft store, dirty/diff renderer, beforeunload guard, reload/reset, and the
  client-side `validate()` wiring are already built here — L5 adds editable inputs
  bound to `draft`, turns on real dirty state, and wires Save
  (`POST /api/balance/save { baseRevision, note, data: draft }`) with a required
  revision note and the 409-stale "reload" prompt. Keep the page read-only until
  L5.
