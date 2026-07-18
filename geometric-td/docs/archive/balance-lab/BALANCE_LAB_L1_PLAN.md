# Balance Lab — L1 build plan (config-side migration)

Execution plan for phase **L1** of `BALANCE_LAB_PLAN.md`. Read `BALANCE_LAB_L0.md`
first — it is the schema contract this phase implements. This file is the
step-by-step for the implementing agent. **Scope is `config.js`-side data only.**
Levels/waves/worlds are L2 — do **not** touch `levels.js` in this phase.

## Golden rule: ZERO balance change

Every value `config.js` exports today must remain **byte-for-byte identical**
after the migration. You are only changing *where the numbers live*, never the
numbers. Parity is proven by the L1 probe (Step 6), which must go fully green
before you are done. If any exported value differs, the migration is wrong —
fix the migration, never the baseline.

Also non-negotiable (from HANDOFF / CLAUDE.md):
- Plain vanilla ES modules. No framework, build step, dependency, or TypeScript.
- Keep the game runnable and console-clean after the change.
- Do not break or migrate localStorage saves (L1 touches none of that).
- Do **not** bump `src/version.js` (local tooling, no player-facing change).
- Do **not** commit or push. Leave changes in the working tree.
- After editing, sweep for iCloud ` 2` conflict filenames and rename any back.

## Confirmed decisions (from L0, approved 2026-07-18)

- **LOOT scope:** migrate only `LOOT.xp.slowWeightPerSec`,
  `LOOT.shards.perKillBase`, `LOOT.shards.perLevelMult`. Everything else under
  `LOOT` (`combat`, `gen`, `drops`, `stash`, `equipGate`, `autoEquip`, `store`)
  **stays in `config.js` untouched** — deferred to a later Lab section.
- **damageType:** migrates as an editable enum value (no special handling in L1;
  the guarded-dropdown concern is an L5 UI matter).

## What L1 migrates (the config-side EDIT set)

Per the L0 path scheme, `balance-data.js` holds only the **EDIT** numbers below.
Presentation/REF fields (names, colors, shapes, labels, icons, `unlockLabel`,
`prefix`, `rosterPrefix`, `trayName`) **stay in `config.js`** and are merged back
onto the public exports.

- `enemies.<id>`: baseHealth, speed, coreDamage, bounty, xp, shardTier,
  regenRate?, damageMult?, splitInto?
- `towers.<id>`: baseCost, baseDamage, baseRange, baseFireRate, basePierce?,
  splashRadius?, projectileSpeed?, slowPercent?, slowDuration?, vulnerability?,
  pierceWidth?, upgradeCostMult?, damageType
- `towerUpgrades`: maxLevel, damageGrowth, rangeGrowth, fireRateGrowth,
  splashGrowth, slowGrowth, xpThresholds[9], upgradeCosts[9], mastery{…},
  specialties.<towerId>.{ <growthKey> } (specialty **label** stays in config)
- `economy`: moneyPerKillMultiplier, xpPerKillMultiplier, interest.enabled
- `waveDefaults`: timeBetweenWaves, autoStartNextWave, allowEarlyStart,
  spawnInterval
- `endless`: all 9 knobs
- `endlessRewards`: defaultTrack[], tracksByLevel{} (ids/labels are data here;
  they carry through as-is)
- `levelMilestones.<levelId>`: array of { id, label, check, reward } — carried
  through as-is (id/label/check are REF but travel with the data object)
- `loot`: xp.slowWeightPerSec, shards.perKillBase, shards.perLevelMult
- `skills`: tiers{maxTier,costs}, tower.<id>.damageStep, towerLayout{…},
  economy.<id>.step, economyLayout{…}, values{coreHealth, railPen}

**Stays entirely in `config.js` (do not migrate in L1):** DEBUG, VFX,
SHAPE_SIDES, RESULT_ROASTS, TUTORIAL, LEADERBOARD, FEEDBACK, SKILL_BRANCH_COLORS,
the presentation halves of ENEMIES/TOWERS/specialties/skill-specs, the
`buildSkillGraph()` function, and all deferred `LOOT` subsections.

---

## Step 1 — Capture the parity baseline FIRST (before any refactor)

You must freeze the current exports before changing anything.

1. Create `balance-lab-l1-probe.html` at repo root (sibling of the L0 probe).
   It imports **the live** `./src/config.js` and dumps a canonical JSON of every
   migrated export into `window.__L1_EXPORTS__` and pretty-prints it. Include:
   ENEMIES, TOWERS, TOWER_UPGRADES, ECONOMY, WAVE_DEFAULTS, ENDLESS,
   ENDLESS_REWARDS, LEVEL_MILESTONES, the migrated `LOOT.xp`/`LOOT.shards`
   subset, SKILL_TIERS, TOWER_SKILL_SPEC, TOWER_SKILL_LAYOUT, ECONOMY_SKILL_SPEC,
   ECONOMY_LAYOUT, SKILL_VALUES, **and** the *generated* `SKILLS` +
   `SKILL_TREE_VIEWBOX` (these prove `buildSkillGraph()` still produces identical
   output). Use a stable-key JSON serializer (sort object keys) so comparison is
   order-independent.
2. Serve with `serve.ps1` (via the preview tool / `.claude/launch.json` name
   `geometric-td`). Load the probe, copy `window.__L1_EXPORTS__`, and save it to
   `balance-lab-l1-baseline.json` at repo root. This frozen file is the
   parity oracle. Do not edit it again this phase.

## Step 2 — Create `src/balance-schema.js`

Exports:
- `SCHEMA_VERSION = 1`.
- `deepClone(data)` — structuredClone-based deep copy (no shared refs).
- `migrate(data)` — version ladder. v1 is baseline: if `data.schemaVersion` is
  missing, treat as 1; if `=== SCHEMA_VERSION`, return clone unchanged; if newer
  or unknown, throw a clear error (never silently downgrade). Leave a commented
  slot for future `1 -> 2` steps.
- `validate(data)` — implements the L0 §"Validation-rule catalog" for the
  **config-side** slices present in `balance-data.js` (enemies, towers,
  towerUpgrades, economy, waveDefaults, endless, endlessRewards, levelMilestones,
  loot, skills). Return `{ ok: true }` or `{ ok: false, errors: [strings] }`
  with specific, human-readable messages (path + what failed). Do NOT throw on
  invalid data — return the error list so callers decide.
- Keep it dependency-free and pure (no DOM, no fetch). It must be importable in
  both the browser and a future Node context.

Validation rules to enforce now (config-side subset of L0's catalog): types;
numeric ranges (mostly `> 0`, fractions/enums/lengths as L0 specifies); enums
(`damageType` ∈ {energy,pulse,control,rail,blast}; reward.kind ∈ {shards,loot};
rarity ∈ the 5 rarities); reference integrity (damageMult keys, splitInto.type,
specialties/skills.tower/tracksByLevel/levelMilestones keys, milestone
onlyTowers/withoutTowers → real ids); unique ids; `xpThresholds`/`upgradeCosts`
length 9; `xpThresholds` ascending; endless-track thresholds ascending;
`skills.tiers.costs.length === maxTier`.

Reference sets for validation come from `balance-data.js` itself (its enemy,
tower, level-milestone keys). Level-id references (`tracksByLevel`,
`levelMilestones` keys) validate against the literal `level_001..015` id list —
add an exported `KNOWN_LEVEL_IDS` array to the schema module for this, since
L1 must not import `levels.js`.

## Step 3 — Create `src/balance-data.js`

- `export const SCHEMA_VERSION` re-exported (or import from schema) and
  `balanceData` object literal following the L0 top-level shape, config-side
  slices only, with `schemaVersion: 1`.
- Populate every field with the **exact literal value copied from the current
  `config.js`**. Copy numbers verbatim; do not re-type or round.
- `export const BALANCE = balanceData;` (or default export — pick one and be
  consistent; named export preferred to match the codebase style).
- Optionally run `validate(BALANCE)` at module load in dev and `console.error`
  the errors — but do NOT throw at import time (must never break the game).
  A soft guard is fine; a hard throw is not.

## Step 4 — Refactor `config.js` to consume `balance-data.js`

For each migrated export, keep the **public name and exact shape**, but build it
by merging balance-data numbers with the presentation fields that remain in
`config.js`. The merge must reproduce today's object exactly (same keys, same
order where the app relies on iteration order — e.g. `TOWERS` key order drives
skill-branch layout, so preserve it).

Guidance per export:
- `ENEMIES`: keep a `const ENEMY_PRESENTATION = { <id>: { name, shape, size,
  color } }` in config; build `ENEMIES` by merging `BALANCE.enemies[id]` over/into
  it. Preserve key order and only-present optional fields (don't inject
  `regenRate`/`damageMult`/`splitInto` onto enemies that lack them).
- `TOWERS`: same pattern with a `TOWER_PRESENTATION` table (name, prefix,
  rosterPrefix, trayName?, color, unlockLabel?). Merge stats from
  `BALANCE.towers[id]`. Preserve key order (laser,pulse,slow,railgun,rocket).
- `TOWER_UPGRADES`: numbers from `BALANCE.towerUpgrades`; re-attach specialty
  `label` strings from a presentation table keyed by tower.
- `ECONOMY`, `WAVE_DEFAULTS`, `ENDLESS`: straight from `BALANCE.*` (all fields
  migrated, no presentation half).
- `ENDLESS_REWARDS`, `LEVEL_MILESTONES`: source the objects from `BALANCE.*`.
  Keep `endlessTrackFor()` exactly as-is (it just reads ENDLESS_REWARDS).
- `LOOT`: rebuild the exported `LOOT` object so `LOOT.xp` and `LOOT.shards` come
  from `BALANCE.loot`, while every deferred subsection
  (`combat/gen/drops/stash/equipGate/autoEquip/store`) stays as its current
  literal in config.js. Net `LOOT` shape identical to today.
- Skill graph: rebuild the spec objects `buildSkillGraph()` consumes by merging
  `BALANCE.skills.*` numbers with the presentation halves (SKILL_TIERS costs come
  from data; TOWER_SKILL_SPEC name/color/icon/stat stay in config, damageStep
  from data; ECONOMY_SKILL_SPEC name/icon/kind/desc stay, step from data; layout
  numbers from data; SKILL_VALUES from data). `buildSkillGraph()` itself is
  unchanged. `SKILLS` and `SKILL_TREE_VIEWBOX` stay generated exports.
- Keep all other exports (DEBUG, VFX, SHAPE_SIDES, RESULT_ROASTS, TUTORIAL,
  LEADERBOARD, FEEDBACK, SKILL_BRANCH_COLORS) exactly as they are.

Import `BALANCE` (and helpers if needed) at the top of `config.js` from
`./balance-data.js`. `config.js` stays the stable module boundary every other
file imports — no other `src/` file should need editing in L1. If you find one
that does, stop and report; that means a public export shape drifted.

## Step 5 — Add clear validation failures

Where the game boots (or in `balance-data.js` load), wire a **soft** dev check:
`const r = validate(BALANCE); if (!r.ok) console.error("[balance] invalid data:",
r.errors);`. Never throw. This satisfies L1's "clear validation failures for
invalid data" without risking the runtime.

## Step 6 — Verify (must be green before done)

1. **L1 parity probe:** update `balance-lab-l1-probe.html` to also import the
   now-refactored config, canonicalize the same export set, and **deep-compare
   against `balance-lab-l1-baseline.json`** (fetch it). Render a PASS/FAIL table
   and set `window.__L1_PROBE__ = { passed, failed, diffs: [...] }`. Every field
   must match — including generated `SKILLS`/`SKILL_TREE_VIEWBOX`. Any diff =
   FAIL with the exact path and both values.
2. **L0 probe still green:** re-open `balance-lab-l0-probe.html` — all 18 checks
   must still pass (nothing about the level/enemy/tower contract changed).
3. **Schema self-test:** `validate(BALANCE).ok === true`; confirm `validate`
   catches a deliberately corrupted clone (e.g. set an enemy baseHealth to -1,
   a damageType to "nope", drop an xpThresholds entry) — report the messages.
4. **Game boots clean:** load `index.html` via `serve.ps1`; confirm no console
   errors/warnings and the main menu renders. (Per project rule: assert on
   console cleanliness + DOM/state, do NOT capture the game canvas.) A quick
   `window.game` / start-of-level smoke check that towers carry expected
   baseCost/baseDamage is a bonus.
5. Sweep for ` 2` iCloud conflict files; rename any back.

Report the probe results (counts + any diffs), the schema self-test output, and
console status back to the orchestrator. Do not commit, push, or bump version.

## Acceptance (L1, from the master plan)

- Normal game is console-clean. ✔ (Step 6.4)
- Representative exported values (cost, damage, fire rate, counters, XP,
  economy) match the baseline exactly. ✔ (Step 6.1 — in fact *all* migrated
  values, not just representative ones)
- Old saves load. ✔ (L1 touches no save code; confirm menu/roster loads clean.)

## Files this phase creates or edits

```
CREATE  src/balance-data.js              config-side editable data (schemaVersion 1)
CREATE  src/balance-schema.js            SCHEMA_VERSION, deepClone, migrate, validate, KNOWN_LEVEL_IDS
EDIT    src/config.js                    import BALANCE; rebuild migrated exports by merging with presentation
CREATE  balance-lab-l1-probe.html        parity + schema self-test probe (verification)
CREATE  balance-lab-l1-baseline.json     frozen pre-migration export dump (parity oracle)
```

Do not edit `levels.js`, any other `src/` module, `version.js`, or any save
code. Do not modify `.gitignore`. Leave everything in the working tree for
orchestrator review.
