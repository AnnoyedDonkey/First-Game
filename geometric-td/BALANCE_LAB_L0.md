# Balance Lab — L0: inventory and schema contract

Status: **complete** · 2026-07-18 · Phase L0 of `BALANCE_LAB_PLAN.md`.

L0 is a pure discovery/design phase: it changes **no runtime behavior**. No
game module (`config.js`, `levels.js`, anything in `src/`) was edited. The
deliverables are this contract document plus a browser-runnable validation
probe (`balance-lab-l0-probe.html`). L1 and L2 implement the migration this
contract specifies; nothing here ships to players and `src/version.js` is not
bumped.

## What L0 delivers

1. A verified inventory of every `config.js` export and every `LEVELS` /
   `WORLDS` field (below).
2. A classification of each value: **editable** (Lab writes it), **reference**
   (read-only, stays code/presentation), or **deferred** (out of first-release
   scope).
3. A single stable data home (dot-path) for every editable value — the
   `balance-data.js` shape L1/L2 build against.
4. Validation rules: types, numeric ranges, enums, reference integrity, unique
   IDs, positive wave values, valid world links, structural map checks.
5. A validation probe that loads the real modules and asserts the contract
   holds against the live data (15 levels, all 159 waves, all 313 groups).

## Acceptance check (from the plan)

> the schema represents all 15 levels and all current wave groups; every
> editable value has one home; no runtime behavior changes.

- **All 15 levels + all wave groups represented** — the path scheme and the
  probe cover every level, every wave, every group field. ✔
- **Every editable value has one home** — §"Data home" gives each a unique
  dot-path; no value maps to two homes. ✔
- **No runtime behavior changes** — L0 adds only this doc and a standalone
  probe page not referenced by `index.html` or any game module. ✔

## Verified data-shape facts (build `2026.07.17-1`)

Counted directly from `src/levels.js` (non-comment lines):

| Fact | Value |
|---|---|
| Worlds | 3 (`world_1..3`), 5 levels each |
| Levels | 15 (`level_001..015`) |
| Waves (total) | **159** |
| Wave groups (total) | **313** |
| Enemy types spawned in waves | 6 — `basic, fast, armored, boss, splitter, regenerator` |
| Enemy types defined but never spawned directly | 1 — `splitling` (death-spawn only, via `splitter.splitInto`) |

Per level (waves / groups): L1 10/17 · L2 12/22 · L3 12/23 · L4 12/21 · L5
13/25 · L6 10/18 · L7 10/19 · L8 9/18 · L9 9/17 · L10 10/22 · L11 10/21 · L12
10/20 · L13 10/20 · L14 10/22 · L15 12/28.

> **Plan correction:** `BALANCE_LAB_PLAN.md` L2 says "all 111 wave groups."
> That figure predates the H1–H4 hard-mode expansion. The current data has
> **313 groups across 159 waves**. The probe asserts the real numbers; when L2
> lands, update the plan's acceptance line to 313/159 (or make it assert
> "every group the probe finds," not a frozen count).

Optional group multipliers, actual usage in current data:

| Group field | Uses | Notes |
|---|---|---|
| `type` | 313 | required, enum |
| `count` | 313 | required, int ≥ 1 |
| `healthMult` | 311 | optional, default 1 (2 boss groups omit it) |
| `spawnInterval` | 297 | optional; falls back to level/`WAVE_DEFAULTS` |
| `startDelay` | 154 | optional, default 0 |
| `speedMult` | 61 | optional, default 1 |
| `bountyMult` | 0 (group) | documented valid; only used at **level** level today (13 levels) |
| `xpMult` | 0 | documented valid; unused today |

The schema must still **allow** `bountyMult`/`xpMult` per group (the header
documents them and enemies.js consumes them) even though current data doesn't
use them — otherwise a designer couldn't add one.

## Classification legend

- **EDIT** — first-release editable; the Lab reads and writes it. Lives in
  `balance-data.js`.
- **REF** — read-only reference: presentation (name/color/shape/label), a
  derived/computed value, or infrastructure. Stays in code; the Lab may
  display it but never writes it.
- **DEFER** — a real gameplay knob, but out of first-release scope (loot
  generator, gear-combat internals, store, skill-graph layout math). Gets a
  later Lab section; L1/L2 leave it in `config.js`.

First-release scope, per the plan: towers, enemies/counters, upgrades,
economy/progression knobs affecting combat, campaign levels/waves, Endless.
Excluded: VFX, layout, presentation.

---

## `config.js` inventory

### `ENEMIES` — EDIT (per-enemy)  → `enemies.<id>`
Home per field. IDs are the object keys (`basic`, `fast`, `armored`, `boss`,
`splitter`, `splitling`, `regenerator`) — REF, stable, must stay unique.

| Field | Class | Path | Rules |
|---|---|---|---|
| `baseHealth` | EDIT | `enemies.<id>.baseHealth` | number > 0 |
| `speed` | EDIT | `enemies.<id>.speed` | number > 0 (tiles/sec) |
| `coreDamage` | EDIT | `enemies.<id>.coreDamage` | int ≥ 0 |
| `bounty` | EDIT | `enemies.<id>.bounty` | number ≥ 0 |
| `xp` | EDIT | `enemies.<id>.xp` | number ≥ 0 |
| `shardTier` | EDIT | `enemies.<id>.shardTier` | number > 0 (grunt 1 / heavy 2 / boss 4) |
| `regenRate` | EDIT (opt) | `enemies.<id>.regenRate` | number ≥ 0; only `regenerator` today |
| `damageMult.<type>` | EDIT (opt) | `enemies.<id>.damageMult.<dmgType>` | number > 0; key ∈ DamageType enum |
| `splitInto` | EDIT (opt) | `enemies.<id>.splitInto` | `{ type: enemyId, count: int≥1 }`; `type` must reference a real enemy |
| `name`, `shape`, `size`, `color` | REF | — | presentation / hitbox visual |

`damageMult` keys and `splitInto.type` are **reference-checked**: a key must be
a valid DamageType, a `splitInto.type` must be an existing enemy id.

DamageType enum (the union of tower `damageType`s + any counter key in data):
`energy, pulse, control, rail, blast`.

### `WAVE_DEFAULTS` — EDIT  → `waveDefaults`
`timeBetweenWaves` (num ≥ 0), `autoStartNextWave` (bool), `allowEarlyStart`
(bool), `spawnInterval` (num > 0).

### `ENDLESS` — EDIT  → `endless`
All nine knobs are numbers: growth rates > 0, `maxCountMult`/`maxSpeedMult` ≥
1, `minSpawnIntervalMult` in (0,1], `intervalShrinkPerWave` in (0,1],
`bossEvery` int ≥ 1, `bossHealthGrowthPerWave` > 0.

### `ENDLESS_REWARDS` — EDIT (rewards) / REF (ids)  → `endlessRewards`
`defaultTrack[]` and `tracksByLevel{}`. Each milestone `{ id, type, threshold,
label, reward }`.
- `id` — REF, **unique within its track**, stable once shipped (claimed sets
  reference it by id).
- `type` — enum `"wave"` (only value today).
- `threshold` — int ≥ 1, **strictly ascending** within a track.
- `label` — REF (presentation text).
- `reward` — EDIT: `{ kind: "shards", amount:int>0 }` **or** `{ kind: "loot",
  rarity: Rarity }`.
- `tracksByLevel` keys must be valid level ids.

Rarity enum: `common, enhanced, rare, prismatic, singularity`.

### `LEVEL_MILESTONES` — EDIT (rewards) / REF (id, label, check)  → `levelMilestones.<levelId>`
Per-level array of `{ id, label, check, reward }`.
- keys of `LEVEL_MILESTONES` must be valid level ids.
- `id` — REF, unique across all milestones, stable.
- `label` — REF.
- `check` — REF-structural first release (the condition DSL: `kills`,
  `towersAtLevel`, `clearNoLeaks`, `onlyTowers`, `withoutTowers`,
  `throughWave`; tower-type lists must reference real tower ids). Validated
  for shape; **not** an editable control in L5's first pass.
- `reward` — EDIT: `{ skillPoints:int≥0 (opt), shards:int≥0 (opt) }`, at least
  one present.

### `TOWERS` — EDIT (stats) / REF (identity)  → `towers.<id>`
IDs: `laser, pulse, slow, railgun, rocket` — REF, unique.

| Field | Class | Rules |
|---|---|---|
| `baseCost` | EDIT | int > 0 |
| `baseDamage` | EDIT | number > 0 |
| `baseRange` | EDIT | number > 0 (tiles; `rocket` uses 999 = whole board) |
| `baseFireRate` | EDIT | number > 0 (seconds between shots) |
| `basePierce` | EDIT (opt) | int ≥ 1 (laser, railgun) |
| `splashRadius` | EDIT (opt) | number > 0 (pulse, rocket) |
| `projectileSpeed` | EDIT (opt) | number > 0 (pulse, rocket) |
| `slowPercent` | EDIT (opt) | 0–1 (slow) |
| `slowDuration` | EDIT (opt) | number > 0 (slow) |
| `vulnerability` | EDIT (opt) | number ≥ 0 (slow) |
| `pierceWidth` | EDIT (opt) | number > 0 (railgun) |
| `upgradeCostMult` | EDIT (opt) | number > 0 (default 1.0) |
| `damageType` | EDIT-enum | ∈ DamageType; drives the counter table |
| `name, prefix, rosterPrefix, trayName, color, unlockLabel` | REF | presentation / roster naming |

### `TOWER_UPGRADES` — EDIT  → `towerUpgrades`
- `maxLevel` (int ≥ 1; base cap, skill tree raises to 10)
- `damageGrowth, rangeGrowth, fireRateGrowth, splashGrowth, slowGrowth`
  (numbers ≥ 0, per-level fractions)
- `xpThresholds` — array of int > 0, **length 9**, strictly ascending
- `upgradeCosts` — array of int > 0, **length 9**
- `mastery.{xpStart, baseXpPerRank, xpRankIncrement, damagePerRank, maxRanks}`
  — numbers > 0 (`damagePerRank` a fraction; `maxRanks` int)
- `specialties.<towerId>` — EDIT growth value + REF `label`; key must reference
  a real tower id; the growth key is one of the `*Growth` stat keys.

### `ECONOMY` — EDIT  → `economy`
`moneyPerKillMultiplier` (num > 0), `xpPerKillMultiplier` (num > 0),
`interest.enabled` (bool). Interest **sizes** come from `SKILL_VALUES`/skill
specs, not here.

### `LOOT` — split
- **EDIT** → `loot.xp.slowWeightPerSec` (num > 0), `loot.shards.perKillBase`
  (num > 0), `loot.shards.perLevelMult` (num ≥ 0). These are core XP/shard
  economy knobs affecting every run.
- **DEFER** → `LOOT.combat`, `LOOT.gen` (affix pool, ilvl, rarity weights,
  uniques), `LOOT.drops`, `LOOT.stash`, `LOOT.equipGate`, `LOOT.autoEquip`,
  `LOOT.store`. The loot/gear/store subsystem is its own later Lab section;
  L1/L2 leave it in `config.js`.

### Skill tree — EDIT (numbers) / REF (presentation, derived)
- `SKILL_TIERS` → `skills.tiers` — `maxTier` (int ≥ 1), `costs` (array int > 0,
  length = `maxTier`).
- `TOWER_SKILL_SPEC.<id>.damageStep` → `skills.tower.<id>.damageStep` (num > 0);
  key must reference a real tower; `name, color, icon, stat` REF.
- `TOWER_SKILL_LAYOUT` → `skills.towerLayout` — `damageSteps, levelSteps` (int
  ≥ 0), `levelCosts` (array int > 0), `damageCost, rootCost` (int > 0).
- `ECONOMY_SKILL_SPEC.<id>.step` → `skills.economy.<id>.step` (num > 0); `name,
  icon, kind, desc` REF.
- `ECONOMY_LAYOUT` → `skills.economyLayout` — `steps` (int ≥ 0), `boxCost,
  rootCost` (int > 0).
- `SKILL_VALUES` → `skills.values` — `coreHealth` (num ≥ 0), `railPen` (num ≥
  0).
- `SKILL_BRANCH_COLORS` — REF (presentation).
- `SKILLS`, `SKILL_TREE_VIEWBOX` — **REF / derived**: computed by
  `buildSkillGraph()` from the specs above. The Lab never writes these; L1
  keeps `buildSkillGraph()` in `config.js` and feeds it the migrated numbers.

### Excluded / reference-only exports
| Export | Class | Why |
|---|---|---|
| `DEBUG` | REF (excluded) | test-only speed knob, not player balance |
| `VFX` | REF | presentation (plan excludes VFX) |
| `SHAPE_SIDES` | REF | renderer geometry |
| `RESULT_ROASTS` | REF | flavor text |
| `TUTORIAL` | REF | onboarding UX + tile coords |
| `LEADERBOARD` | REF | Supabase infra |
| `FEEDBACK` | REF | telemetry infra |
| `endlessTrackFor()` | REF | helper function, stays in code |

---

## `levels.js` inventory

### `LEVELS[]` — level fields  → `levels.<id>`
Level ids (`level_001..015`) are REF, unique, and are the map key.

| Field | Class | Path | Rules |
|---|---|---|---|
| `id` | REF | (key) | matches `^level_\d{3}$`, unique |
| `name`, `desc` | REF | — | presentation text (no source-rewrite) |
| `gridWidth`, `gridHeight` | EDIT-structural | `levels.<id>.gridWidth/Height` | int > 0 (all 8×12 today) |
| `startingMoney` | EDIT | `levels.<id>.startingMoney` | int > 0 |
| `coreHealth` | EDIT | `levels.<id>.coreHealth` | int > 0 |
| `bountyMult` | EDIT (opt) | `levels.<id>.bountyMult` | num > 0, default 1 |
| `timeBetweenWaves` | EDIT (opt) | `levels.<id>.timeBetweenWaves` | num ≥ 0, overrides `WAVE_DEFAULTS` |
| `autoStartNextWave` | EDIT (opt) | `levels.<id>.autoStartNextWave` | bool (documented; unused today) |
| `palette` | REF | — | presentation color overrides |
| `pathCorners` | EDIT-structural | `levels.<id>.pathCorners` | see structural rules |
| `blockedTiles` | EDIT-structural | `levels.<id>.blockedTiles` | see structural rules |
| `waves` | EDIT | `levels.<id>.waves` | see wave rules |

Map geometry (`gridWidth/Height`, `pathCorners`, `blockedTiles`) is
represented and **fully validated**, but treated as *advanced/structural*: L5's
first-pass controls target waves + economy, not freehand map editing. The
schema still guards it so a future map editor can't write a broken board.

**Structural rules**
- `pathCorners`: array of `{x,y}` ints, each in-bounds (`0 ≤ x < gridWidth`,
  `0 ≤ y < gridHeight`); ≥ 2 corners; every consecutive pair is a **straight**
  horizontal or vertical segment (`x` equal or `y` equal), never diagonal,
  never zero-length.
- `blockedTiles`: array of `{x,y}` ints, in-bounds, **not on the path**, no
  duplicates.

### Wave / group shape  → `levels.<id>.waves[w].groups[g]`
- Wave: `{ groups: [...], healthMult?, speedMult? }` — `groups` non-empty
  array; wave-wide `healthMult`/`speedMult` optional num > 0.
- Group required: `type` (∈ spawnable enemy enum), `count` (int ≥ 1).
- Group optional: `spawnInterval` (num > 0), `startDelay` (num ≥ 0),
  `healthMult` (num > 0), `speedMult` (num > 0), `bountyMult` (num > 0),
  `xpMult` (num > 0).
- `type` is **reference-checked** against `ENEMIES`. First release restricts
  the picker to the 6 spawnable types (excludes `splitling`, a death-spawn),
  but the validator accepts any real enemy id.

### `WORLDS[]`  → `worlds.<id>`
| Field | Class | Rules |
|---|---|---|
| `id` | REF | `^world_\d+$`, unique |
| `name` | REF | presentation |
| `levelIds` | EDIT-structural | non-empty; each must be a real level id; no dup across worlds |
| `accent`, `accent2`, `boardStyle`, `nodePos` | REF | menu presentation |

**World-link integrity** (validated): the concatenation of all `levelIds`, in
world order, must equal `level_001..015` exactly once each — every level
belongs to exactly one world, no gaps, no orphan levels, `nodePos.length ===
levelIds.length` per world.

---

## Data home — `balance-data.js` top-level shape

Every EDIT value resolves to exactly one path under this root. This is the L1
target shape (config-side) plus the L2 additions (levels/waves/worlds):

```
{
  schemaVersion: 1,
  enemies:        { <id>: { baseHealth, speed, coreDamage, bounty, xp,
                            shardTier, regenRate?, damageMult?, splitInto? } },
  towers:         { <id>: { baseCost, baseDamage, baseRange, baseFireRate,
                            basePierce?, splashRadius?, projectileSpeed?,
                            slowPercent?, slowDuration?, vulnerability?,
                            pierceWidth?, upgradeCostMult?, damageType } },
  towerUpgrades:  { maxLevel, damageGrowth, rangeGrowth, fireRateGrowth,
                    splashGrowth, slowGrowth, xpThresholds[9], upgradeCosts[9],
                    mastery{…}, specialties{ <towerId>: {…} } },
  economy:        { moneyPerKillMultiplier, xpPerKillMultiplier,
                    interest{ enabled } },
  waveDefaults:   { timeBetweenWaves, autoStartNextWave, allowEarlyStart,
                    spawnInterval },
  endless:        { …9 knobs… },
  endlessRewards: { defaultTrack[], tracksByLevel{} },
  levelMilestones:{ <levelId>: [ { id, label, check, reward } ] },
  loot:           { xp{ slowWeightPerSec }, shards{ perKillBase, perLevelMult } },
  skills:         { tiers{}, tower{}, towerLayout{}, economy{}, economyLayout{},
                    values{} },
  levels:         { <levelId>: { gridWidth, gridHeight, startingMoney,
                    coreHealth, bountyMult?, timeBetweenWaves?,
                    autoStartNextWave?, pathCorners[], blockedTiles[],
                    waves[] } },
  worlds:         { <worldId>: { levelIds[] } },
}
```

Presentation/REF fields (names, colors, palettes, `nodePos`, `boardStyle`,
labels) **stay in `config.js`/`levels.js`**. L1/L2 merge the two: the code
module keeps identity + helpers and reads numbers from `balance-data.js` by id,
so nothing player-visible moves and old saves are unaffected.

## Validation-rule catalog (what `balance-schema.js` enforces in L1)

1. **Type** — each field matches its declared type (number/int/bool/string/
   array/object).
2. **Range** — numeric bounds above (mostly `> 0`; fractions/enums/lengths as
   noted).
3. **Enum** — `damageType` ∈ DamageType; milestone `reward.kind` ∈
   {shards,loot}; `reward.rarity` ∈ Rarity; `endlessRewards.type` ∈ {wave}.
4. **Reference integrity** — every enemy `type` in a wave, every
   `damageMult` key, every `splitInto.type`, every `specialties`/`skills.tower`
   /`tracksByLevel`/`levelMilestones` key, and every `worlds.*.levelIds` entry
   points at a real id.
5. **Unique IDs** — enemy ids, tower ids, level ids, world ids, milestone ids
   (per track for endless; global for level milestones).
6. **Positive wave values** — `count ≥ 1`; all present mults `> 0`;
   `startDelay ≥ 0`; non-empty `groups`.
7. **Array lengths** — `xpThresholds`/`upgradeCosts` length 9;
   `skills.tiers.costs` length = `maxTier`; `nodePos.length =
   levelIds.length`.
8. **Ordering** — `xpThresholds` ascending; endless-track `threshold`
   ascending.
9. **World links** — union of `levelIds` == all levels, once each, in order.
10. **Map structure** — path corners straight/in-bounds; blocked tiles
    in-bounds/off-path/unique.

A save is written only if the **entire** draft passes all ten (atomic, per the
plan's safety contract).

## Schema versioning & migration

- `schemaVersion: 1` is the baseline this contract defines.
- L1 adds `balance-schema.js` with `migrate(data)` (version-bump ladder) and a
  deep-clone/validate pair. A file whose `schemaVersion` is older is migrated
  forward in memory before validation; an unknown/newer version is rejected
  (never silently downgraded).
- Baseline equivalence: L1/L2 must prove the migrated `balance-data.js`
  reproduces the current exported values **exactly** (cost, damage, fire rate,
  counters, XP, economy, and every wave group). The probe below is the L0 seed
  of that check; L1/L2 extend it to value-for-value equality against a frozen
  baseline snapshot.

## The probe — `balance-lab-l0-probe.html`

A standalone page (not linked from `index.html`; loads no game logic beyond the
two data modules). Open it under `serve.ps1`:

```
./serve.ps1         # then browse to:
http://localhost:8420/balance-lab-l0-probe.html
```

It imports the **real** `./src/config.js` and `./src/levels.js` and asserts the
contract against live data, printing a PASS/FAIL table (and a machine-readable
`window.__L0_PROBE__` result + console summary). It checks:

- 15 levels, 3 worlds, 159 waves, 313 groups (the counts this doc records).
- Unique enemy/tower/level/world/milestone ids.
- Every wave `type` references a real enemy; every `damageMult` key and
  `splitInto.type` resolves; every tower `damageType` is a valid DamageType.
- Every group: `count` int ≥ 1; every present mult > 0; `startDelay` ≥ 0.
- `xpThresholds`/`upgradeCosts` length 9; `xpThresholds` ascending.
- Endless tracks: ascending thresholds, valid reward shapes, `tracksByLevel`
  keys are real levels.
- Level-milestone keys are real levels; tower-type lists in `check` resolve.
- World links: `levelIds` cover `level_001..015` once each, in order;
  `nodePos.length === levelIds.length`.
- Map structure: path corners straight + in-bounds; blocked tiles in-bounds,
  off-path, unique.

Green across the board = the contract faithfully represents today's data and is
a safe baseline for L1/L2. A red row is a real mismatch between this contract
and the data — fix one or the other before migrating.

## Decisions & open questions handed to L1/L2

1. **313/159, not 111** — update the plan's L2 acceptance line (see correction
   above).
2. **`damageType` editability** — *CONFIRMED 2026-07-18:* kept EDIT (enum)
   because it's a legitimate balance lever, but it re-keys the counter table, so
   L5 presents it as a **guarded dropdown**, not a free text field.
3. **`LOOT` scope** — *CONFIRMED 2026-07-18:* only `LOOT.xp` + `LOOT.shards`
   migrate in first release; the whole loot/gear/store tree
   (`combat/gen/drops/stash/equipGate/autoEquip/store`) is DEFERRED to its own
   later Lab section and stays in `config.js` through L1/L2.
4. **Skill graph** — `buildSkillGraph()` stays a `config.js` helper; only its
   numeric inputs migrate. `SKILLS`/`SKILL_TREE_VIEWBOX` remain derived.
5. **Map geometry** — validated now, but L5's first editing pass is waves +
   economy; a map editor is a later increment.
6. **`bountyMult`/`xpMult` per group** — allowed by schema though unused today,
   so designers can add them.
