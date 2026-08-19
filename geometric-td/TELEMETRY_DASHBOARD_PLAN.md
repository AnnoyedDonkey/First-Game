# Player Telemetry Dashboard — build plan (Scope A: dashboard-only)

Self-contained spec for a cold-reading implementation agent. Read this whole
file, then implement. **Do NOT** commit, push, bump `src/version.js`, touch any
game code, or change the telemetry payload — Scope A is read-only display of
data we ALREADY collect. A later Scope B (adding fields to the payload) is out
of scope here.

## Goal

Add a **"Player telemetry"** section to the existing analytic dashboard page
`balance-difficulty.html`. It fetches the live `feedback` Supabase table
client-side and renders aggregates that answer real product/balance questions
from actual play. It is read-only, phone-friendly, and must fail soft (paused
project / empty table / network error → a clear message, never a broken page).

## The ONLY file you may edit

- `balance-difficulty.html`

Everything is inline in that one file (its existing pattern). No new modules, no
build step, vanilla JS ES-module `<script type="module">`, no dependencies.

## What the page looks like today (so you slot in, not rebuild)

- A `<nav class="toc">` of anchor links, each pointing at an `<h2 id="…">`.
- All current content is computed **synchronously** from imported calculator
  modules and pushed as HTML strings into `<main id="out">`. A `#status` div
  shows "Computing…" then the result.
- Reusable CSS already present: `table`, `.scroll` (horizontal-scroll wrapper
  for wide tables — wrap every wide table in `<div class="scroll">…</div>`),
  `.num`/`.mono` (tabular numerals), `.tag` (the little heading pill),
  `.note` (muted caption). **Reuse these — do not invent new table styling.**
- Read the file first to match its exact `push(...)`/render idiom and its
  responsive `@media` rules.

## Data source

Reuse the existing keys — do NOT hardcode new ones:

```js
import { LEADERBOARD, FEEDBACK } from "./src/config.js";
import { APP_VERSION } from "./src/version.js";
```

Fetch (same auth shape as `src/feedback.js`):

```js
const res = await fetch(
  `${LEADERBOARD.url}/rest/v1/${FEEDBACK.table}` +
    `?select=*&order=created_at.desc&limit=5000`,
  { headers: {
      apikey: LEADERBOARD.anonKey,
      Authorization: `Bearer ${LEADERBOARD.anonKey}`,
  }}
);
```

- If `!LEADERBOARD.url || !LEADERBOARD.anonKey` → render "Telemetry not
  configured" and stop (no fetch).
- On network error, non-2xx, or `res.status` implying a paused project →
  render a soft message: "Couldn't reach telemetry (the Supabase project may
  be paused, or there's no data yet)." NEVER throw into the page.
- On empty array → "No runs recorded yet."
- Each row's shape (see `SUPABASE_SETUP.md` § Feedback table and
  `src/main.js runTelemetry`):
  - Columns: `run_id, client_id, level_id, mode, outcome ('won'|'lost'|
    'forfeit'), app_version, waves_cleared, total_waves, core_health,
    duration_sec, rating ('too_easy'|'just_right'|'too_hard'|null), note,
    created_at`.
  - `details` (jsonb, already an object): `towers[]` (each `{type, level,
    kills, invested, gear:[rarity,…]}`), `typesUsed[]`, `kills`, `leaks`,
    `moneyLeft`, `shardsEarned`, `skills{}`, `unspentSkillPoints`.

## Render flow (async, non-blocking)

1. Leave all existing synchronous sections exactly as they are.
2. Add ONE new nav link `Player telemetry` → `#telemetry`, and append an
   `<h2 id="telemetry">Player telemetry <span class="tag">from real play</span></h2>`
   section with a placeholder `<div id="tele-body">Loading telemetry…</div>`.
3. After the synchronous render, `fetch` the table, then fill `#tele-body`.
   Do not let a telemetry failure affect the analytic sections.

## Filters (render as simple `<select>`s at the top of the section)

- **Version:** distinct `app_version` values found in the data, plus an "All
  versions" option. **Default to the current `APP_VERSION`** so stale balance
  doesn't muddy the read. Changing it re-renders the panels (re-aggregate the
  already-fetched rows; don't refetch).
- **Mode:** All / campaign / endless. Default All. (Most panels are
  campaign-centric; endless has no `rating` and procedural waves — see notes.)

Level ordering: sort `level_id` naturally (`level_001`…`level_020`, then any
endless ids). A run count `n=` must appear on every per-level row so the reader
can judge sample size; **dim or footnote any row with n < 5** (thin sample).

## Panels to build (all inside the telemetry section)

Use `<h3>` sub-headings. Each is a reduction over the filtered rows.

1. **Struggle map** (campaign). Per level: `n` runs, win %, forfeit %, median
   `waves_cleared` on LOST runs (the wall), avg `core_health` on WON runs
   (how close wins are). This is the headline "where do they struggle" table.

2. **Killer waves** (campaign, lost runs). Per level: the most common
   `waves_cleared` value on losses (the modal wall wave) and the top 2–3 waves
   by loss count. Small table or inline "L14: wave 7 (12), wave 9 (5)".

3. **Drop-off funnel.** Per level in order: distinct `client_id` count that has
   ANY run at that level. Reads as a descending funnel — the level where the
   count falls off a cliff is where players quit. (This is the single most
   important product signal; make it prominent.)

4. **Attempts to clear.** Per level, among clients who have at least one `won`
   run there: median number of `lost`/`forfeit` runs that client logged at that
   level before their first win. Separates "fair grind" from "frustrating
   wall". If this grouping is fiddly, implement it but keep it in its own
   `<details>` block so it can't break the core panels.

5. **Tower usage & mix** (all modes). Per tower type (laser/pulse/slow/railgun/
   rocket): % of runs it appears in (`details.typesUsed`), and win % of
   campaign runs where it's present. Also a monoculture read: distribution of
   how many distinct types players field (`typesUsed.length`) — if everyone
   fields the same 1–2, that's a signal.

6. **"Forgot to…" adoption.** Headline numbers up top of this sub-panel:
   - % of runs ending with `details.unspentSkillPoints > 0` (and the average
     unspent) — split won vs lost if easy.
   - Ungeared rate: across all `details.towers[]` in filtered runs, % of placed
     towers whose `gear` array is empty. Optionally by tower type.
   These are the two behavioral gaps the user cares most about.

7. **Felt vs. measured** (campaign). Per level: counts of `rating`
   too_easy / just_right / too_hard, shown beside that level's win %. Add a
   `.note` that ratings are OPT-IN so samples are thin — treat as a tiebreaker,
   not proof. Levels where players say "too hard" but win % is high = a clarity
   problem, not a balance one.

8. **Economy** (campaign, won runs), compact / optional `<details>`. Per level:
   avg `details.moneyLeft` on wins (lots left → soft level) and avg
   `details.leaks`. Nice-to-have; keep it from bloating the core panels.

Keep the aggregation code readable — small pure helper functions
(`byLevel`, `median`, `pct`, `distinct`) over the fetched array. No cleverness.

## Constraints / must-nots

- No game-code edits, no `src/version.js` bump, no changes to `runTelemetry` or
  the payload. Display only.
- Do not break the existing synchronous sections or the TOC.
- Handle empty/paused/error states gracefully (see Data source).
- Keep it phone-legible: wide tables in `<div class="scroll">`, respect the
  page's existing responsive `@media` block.
- Do NOT commit, push, or run git. Leave the working tree dirty for the
  orchestrator to verify in a real browser and push.

## Self-check before you report done (headless is fine for these)

- The file still parses; no syntax errors (`node --check` won't work on HTML —
  instead eyeball the `<script type="module">` block for balanced braces, or
  extract and `node --check` just that block if you can).
- The new nav link and `#telemetry` section exist; the analytic sections are
  untouched (diff should be additive).
- Aggregation helpers handle: zero rows, a level with only losses, a run whose
  `details` is missing/partial (older rows), and `rating: null`.
- Report honestly what you could and could NOT verify (you cannot reach a
  browser or the live Supabase table — say so; the orchestrator verifies both).

---

## As built — shipped 2026.08.19

**Scope A (dashboard) — SHIPPED, `commit 3a87444`, no version bump (tooling
page).** A **Player telemetry** section was added to `balance-difficulty.html`:
async read of the live `feedback` table (reuses `LEADERBOARD`/`FEEDBACK` keys,
5000-row cap), version + mode filters (default = current build), fail-soft on
not-configured / paused / network-error / empty. All 8 panels built: struggle
map, killer waves, drop-off funnel, attempts-to-clear (`<details>`), tower usage
& mix, "forgot to…" adoption, felt-vs-measured, economy (`<details>`). Verified
in-browser against **965 live rows**; aggregation cross-checked against the raw
DB (L004 = 108 runs / 25% win, exact match); console clean.

**"Hide my runs" exclusion — `commit ebddeac`; owner's saves excluded by default
— `commit 81f89dc`.** The viewer can exclude their own `client_id`(s) to see
other players. Excluded ids persist in the dashboard page's OWN localStorage
(`tele-exclude-ids`), with a "Hide my runs" toggle (`tele-hide-me`). The current
device's game id is auto-detected **read-only** from the
`geometric-td-leaderboard-v1` key (never mints a phantom via `getClientId`). The
owner's two saves are seeded as `DEFAULT_EXCLUDED` (applied on a fresh visit
only; any manual add/remove then takes over and defaults are never re-injected):
- `fd146ee0-9acd-40ee-ba03-2efd615f73b6` — Home-Screen save (all levels cleared)
- `60c452bb-d4ab-4f51-90d1-66350285e1eb` — Safari browser TESTING save (L1–L8)

Ground-truthed by having the owner forfeit L4 on each save and reading the two
fresh rows. **`e54287f9-…` (185 runs) is a REAL other player** (progressed
through all of World 4), deliberately kept visible.

**Key facts worth remembering:**
- Telemetry is collected for **every** battle end automatically (win/loss/
  forfeit, `main.js runTelemetry` → `feedback.js submitRun`), fire-and-forget,
  no retry. Only the difficulty **rating** is opt-in (and rarely tapped) — lean
  on the behavioral panels.
- **iOS storage split:** a Home-Screen (standalone) web app and the same site in
  Safari keep SEPARATE localStorage, so one phone yields two+ `client_id`s; iOS
  storage eviction can also mint fresh ids over time (fragments telemetry — more
  fuel for the PWA plan).

**First findings (All-versions, ~965 rows):** early wall L3→L4 (win% 61→37→25);
the drop-off funnel matches it (≈half of players gone by L4 — the retention
cliff); World 4 has a **forfeit** problem (L16 48%, L18 62% — quitting mid-
battle, not losing — likely the unexplained special-tile mechanics). L004 wave-3
was eased in response (`2026.08.19-1`; details in HANDOFF's current-state).

## Scope B — QUEUED (not built)

Add per-tower career **mastery★ / maxUnlockedLevel** and a roster **`arsenalPower`**
snapshot (reuse `src/arsenal-power.js`) to the `runTelemetry` payload in
`main.js`, so the dashboard can plot a per-level **power-to-clear** curve
(winners vs losers, in base-laser-equivalents) — directly answering "what
arsenal do you need to clear level X" and calibrating the Level Calculator
against real humans. **Touches game code → needs a `version.js` bump + push**
(unlike Scope A). No save-format change required (read from live state at
battle end).
```
