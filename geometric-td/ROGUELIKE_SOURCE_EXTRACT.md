# Roguelike Source Extract — Reusable Systems

**Purpose.** A faithful snapshot of the systems in *Geometric TD* that a
roguelike build ("start with 3 towers, draft more towers + power-ups across
levels, goal = beat level 20", à la Slay the Spire / Dungeon Clawler) can
reuse. Every number is copied from the live data as of build `2026.08.23-11`;
file:line pointers let you re-verify. Each section ends with a **↻ Reuse angle**
note — where a run-modifier, reward, or draft could plausibly hook in. Those
notes are the only opinionated part; everything above them is data.

**Source of truth.** Tunable numbers live in
[`src/balance-data.json`](src/balance-data.json) (canonical) mirrored into
`src/balance-data.js` (generated import). Presentation + loot/skill structure
live in [`src/config.js`](src/config.js). Roll logic is
[`src/loot.js`](src/loot.js). Never hardcode a tunable in logic — that rule
carries into any roguelike mode.

**Five damage types** thread through everything (towers deal one, enemies
resist/take-extra by type): `energy` (Laser), `pulse` (Pulse), `control`
(Slow), `rail` (Railgun), `blast` (Rocket).

---

## 1. Towers (5)

Base stats, from [`balance-data.json` towers](src/balance-data.json) (~line
5038) merged with presentation/design intent in
[`config.js`](src/config.js:200-295).

| Tower | Dmg type | Cost | Base dmg | Fire rate* | Range | Pierce | Splash | Special stat | Upgrade-cost mult |
|---|---|---|---|---|---|---|---|---|---|
| **Laser** | energy | 50 | 8 | 0.35 | 1.9 | 1 | — | — | 1.0 (shared table) |
| **Pulse** | pulse | 105 | 14 | 0.78 | 1.35 | — | 0.7 | projSpeed 5.5 | **1.6×** |
| **Slow** | control | 60 | 2 | 0.8 | 1.6 | — | — | slow 35% / 1.5s, **+30% vuln** | **0.8×** |
| **Railgun** | rail | 140 | 48 | 3.0 | 2.6 | **4** | — | pierceWidth 0.18, **board-wide ray** | 1.3× |
| **Rocket** | blast | 120 | 44 | 2.8 | **999 (global)** | — | 0.9 | projSpeed 9 | 1.4× |

\* `baseFireRate` is the **cooldown in seconds between shots** (lower = faster).
Laser 0.35s ≈ ~2.9 shots/s; Railgun 3.0s = one heavy shot every 3s.

**Per-tower identity (from the code comments — this is your design vocabulary):**

- **Laser** — the cheap, fast, reliable baseline. Single-target energy, 1
  pierce. The yardstick the whole balance calculator measures in
  ("base-laser-equivalents"). Specialty grows **range** per level.
- **Pulse** — splash/crowd-control. Deliberately the *shortest* range in the
  set and slow-cadence; expensive to buy and level (1.6×). Scales into a
  swarm-clearer via its **bigger-splash** specialty. Was previously the
  overpowered default pick — nerfed on purpose to force a role.
- **Slow** — support / force-multiplier, not DPS (base dmg 2). A slowed enemy
  is slowed 35% for 1.5s **and takes +30% extra damage from ALL sources** for
  that window. Cheap to level (0.8×). Its job is to make every other tower hit
  harder — earns its slot in a combo, not solo. Specialty grows **fire rate**.
- **Railgun** — slow, charged, devastating line-piercer. Base 48 dmg × **4
  pierce** / 3s. Since the rework its ray reaches the **whole board** once an
  enemy enters its (modest 2.6) targeting ring, piercing everything lined up
  behind. Rewards lane/funnel placement. Premium priced. Unlocks after L5.
  Specialty is now **cosmetic** (extra rays), damage-neutral — its identity is
  pierce + range, not scaling.
- **Rocket** — artillery. **Global range** (999): lobs an AoE blast at any
  enemy anywhere, so placement doesn't matter. Very slow reload, pricey to
  scale (global range is the expensive option). Shreds clustered Splitters and
  lone Bosses; too sluggish to track Fast movers. Unlocks after L10. Specialty
  grows **splash**.

**Unlock gating today:** Laser/Pulse/Slow from the start; Railgun after
clearing L5; Rocket after clearing L10.

**↻ Reuse angle.** These 5 are a clean "starter + unlock" ladder — a roguelike
draft can ignore the L5/L10 gates and instead **offer towers as run rewards**.
The 5 damage types + the distinct roles (single-target / splash / support /
line-pierce / global-artillery) are the axes to spin new towers along: pick a
damage type, a delivery shape (single / splash / line / global), and a
"specialty" growth stat. New towers only need a `towers.<id>` stat block + a
presentation entry + a damage type in the resist matrix — no new engine code.
Base cost is your draft/economy currency lever.

---

## 2. Upgrades, Mastery & Specialties

From [`balance-data.json` towerUpgrades](src/balance-data.json:4986) and
[`config.js`](src/config.js:305-357). **Two independent progression axes:**
per-battle **level** (bought with in-battle money, resets each battle) and
career **Mastery** (permanent, from banked XP).

### In-battle level (resets to 1 every battle)

- **Shared growth per level:** damage ×(1+0.35), fire-rate ×(1+0.1), range
  ×(1+0.08), slow ×(1+0.12) — applied to the *in-battle* level (capped 5, so
  exponent ≤ 4 base).
- **Level cap:** base **5**, extendable to **10** via the account skill tree
  (`towerCapN` / "Overclock" nodes).
- **XP eligibility ladder** (XP needed to be *allowed* to buy each level 2→10;
  money still buys it): `[100, 250, 450, 700, 1050, 1350, 1800, 2400, 3200]`.
- **Money upgrade costs** (level 2→10, before the tower's own mult):
  `[75, 125, 200, 300, 450, 600, 800, 1100, 1500]`.
- XP makes a tower *eligible*; **money buys the level**. XP alone never buffs.

### Specialties (per-level bonus, on top of shared growth)

Uses **career** max-unlocked-level, not in-battle level.

| Tower | Specialty growth |
|---|---|
| Laser | +7% range/level |
| Pulse | +12% splash/level |
| Slow | +10% fire-rate/level |
| Rocket | +12% splash/level |
| Railgun | **{} (empty — cosmetic only)** |

### Mastery (permanent, no money)

XP earned *past* the level-5 (or current cap) threshold becomes permanent
**damage ranks** that follow the tower forever.

- `damagePerRank` **+1.5% damage/rank**, `maxRanks` **50**.
- Escalating cost: rank *n* = `baseXpPerRank(400) + xpRankIncrement(80)*(n-1)` XP.
- Reference totals: rank 1 = 1,100 XP · rank 10 = 8,300 · rank 20 = 23,900 ·
  rank 50 = 118,700.
- Rank is derived purely from banked `xp` (`masteryRankFor()`), no save field —
  stays retroactive. `xpStart` re-anchors when the account unlocks higher caps.

**A fully-maxed tower is ~2,300 (un-geared) to ~7,000 (geared) DPS** — the curve
is well-behaved, not runaway (per HANDOFF's 2026-08-08 investigation).

**↻ Reuse angle.** In a run-based roguelike you likely **drop the permanent
Mastery grind** (it's a meta-progression, at odds with fresh runs) and keep the
**in-battle level curve** as the per-battle power ramp. The XP-eligibility vs
money-buy split is a nice two-resource tension you can keep or collapse. The
specialty stats are ready-made "this tower's upgrade path" flavor for a
per-tower upgrade card. `damageGrowth 0.35` etc. are the single knobs that set
how steep a tower powers up within one battle.

---

## 3. Skills (account-wide tree)

From [`config.js buildSkillGraph`](src/config.js:1050-1161) +
[`balance-data.json` skills](src/balance-data.json:4904). Bought with **skill
points** (1 per level won, + milestone rewards + a Shard-purchasable point).
Wide-and-shallow tree; every box is one increment.

**Per-tower branches (×5), each a head fanning into three chains:**
- **Damage chain** — 5 boxes, +10% damage each (Slow's is duration).
- **Overclock chain** — 5 boxes, each raises the **level cap** (L6→L10).
  Costs `[1,1,1,2,2]`.
- **Third perk chain** — 5 boxes of one tower-specific stat:
  - Laser → **Rapid Fire** (+10% fire rate/box)
  - Pulse → **Blast Radius** (+10% splash/box)
  - Slow → **Slow Potency** (+10% slow amount/box)
  - Railgun → **Capacitor Bank** (+20% charge speed/box; legacy id `railPen`)
  - Rocket → **Payload Yield** (+10% splash/box)

**Money branch** — head + one 5-box chain per economy stat:
- Salvage Protocol (+10% money/kill), Combat Learning (+10% tower XP),
  Shard Magnet (+2% shards/kill), Compound Yield (+2% cash interest/wave),
  Reserve Cap (+50 max interest/wave).

**Game branch** — head + Core Plating (5 tiers, +5 core HP each) + Game
Acceleration (sequential speed unlocks 6×/8×/10×/12×/16×, base speeds 2×/4×).

**Tier costs** (shared where a chain doesn't override): `[1,1,1,2,2]`, maxTier 5.

**↻ Reuse angle.** This whole tree is a **persistent meta-upgrade** system —
the roguelike analog is a between-runs "ascension/unlock" tree (keep as-is) OR
a source of **draftable in-run power-ups** (strip a chain into individual
cards: "+10% laser damage", "raise a tower's cap", "+10% splash"). The economy
and game branches are ready-made "run relic" effects (more gold, faster clock,
tougher core). Step sizes are all in `skills.values` / `skills.economy` — one
place to retune for a faster roguelike power curve.

---

## 4. Enemies (7)

From [`balance-data.json` enemies](src/balance-data.json:76-168). `damageMult`
is keyed by **tower damage type**; **>1 = weak to, <1 = resists**, absent = 1.0
(neutral). This matrix is the primary combo-design lever.

| Enemy | HP | Speed | Bounty | XP | Core dmg | Shard tier | Notes |
|---|---|---|---|---|---|---|---|
| **Basic** | 20 | 1.4 | 5 | 10 | 1 | 1 | no resists (neutral to all) |
| **Fast** | 11 | **2.6** | 6 | 12 | 1 | 1 | glass cannon runner |
| **Armored** | 60 | 0.9 | 12 | 25 | 2 | 2 | tanky |
| **Regenerator** | 70 | 0.85 | 14 | 28 | 2 | 2 | **heals 5% HP/s** (`regenRate 0.05`) |
| **Splitter** | 42 | 1.1 | 10 | 20 | 2 | 2 | on death → **2× Splitling** |
| **Splitling** | 10 | 2.4 | 3 | 5 | 1 | 1 | spawned only (+ L18w2) |
| **Boss** | **400** | 0.55 | 100 | 150 | 5 | 4 | slow heavy hitter |

**Resist / weakness matrix** (`damageMult`; blank = 1.0 neutral):

| vs → | energy (Laser) | pulse (Pulse) | control (Slow) | rail (Railgun) | blast (Rocket) |
|---|---|---|---|---|---|
| Basic | — | — | — | — | — |
| Fast | **1.3 weak** | 0.7 resist | — | — | 0.6 resist |
| Armored | 0.4 resist | 1.2 weak | 0.5 resist | **1.6 weak** | — |
| Regenerator | 0.45 resist | — | — | **1.6 weak** | — |
| Splitter | — | **1.5 weak** | — | 0.6 resist | 1.4 weak |
| Splitling | — | **1.5 weak** | — | — | 1.4 weak |
| Boss | — | 0.85 resist | 0.4 resist | 1.2 weak | 1.3 weak |

Reading it: Fast dies to Laser but shrugs off Rocket/Pulse; Armored &
Regenerator are Railgun food but resist energy; Splitters melt to splash
(Pulse/Rocket) but resist rail; Bosses want rail/blast and laugh at control.

**Wave data** lives per-level under `levels.level_NNN.waves[].groups[]`, each
group: `{type, count, spawnInterval, healthMult?, speedMult?, bountyMult?,
startDelay?}`. Difficulty scaling is mostly `healthMult` (perf-free) not raw
counts (counts are the perf lever; ~300–400 concurrent is the mobile ceiling).

**Debut schedule (campaign):** Basic L1w1, Fast L1w3, Armored L1w6, Boss L1w10,
Splitter L6w2, Regenerator L7w2. **No new enemy types after L7.**

**↻ Reuse angle.** The 7 enemies + the type matrix already give you a full
"weak-to-X, resists-Y" puzzle per encounter — the core of why you'd draft a
diverse tower set. A roguelike can **randomize wave composition** from these
templates and lean on the matrix to make each run's enemy mix demand a
different tower answer. New enemies just need a stat block + a `damageMult` row.
`healthMult`/`speedMult`/`bountyMult` per group are the run-difficulty and
elite-modifier knobs (e.g. "this run: all Fast are +50% HP"). `regenRate` and
`splitInto` are reusable behavior hooks for new enemy gimmicks.

---

## 5. Gear — slots, rarities, affixes, uniques

From [`config.js LOOT`](src/config.js:373-638) and
[`loot.js`](src/loot.js). A pure generator rolls item objects; combat reads
their affixes/uniques.

**4 slots:** `optic`, `emitter`, `capacitor`, `frame`.
**5 rarities:** common → enhanced → rare → prismatic → singularity.
**Restriction:** each item is **universal** (any tower, 60% chance) or **locked
to one tower type** (+15% roll bonus, and access to type-specific affixes).

**Affix counts by rarity:** common 1, enhanced 1, rare 2, prismatic 2 (+1 minor
unique), singularity 2–3 (+1 named unique).
**Requirement gate:** common/enhanced gate on career level (derived 1–5); rare
★1, prismatic ★10, singularity ★20 Mastery. No tower equips *any* gear below
Mastery rank 1.

### Affix pool (per slot, with per-rarity [lo,hi] roll bands, % unless noted)

**Optic** (targeting):
- Range % — C[3,6] E[6,10] R[9,14] P[13,20] S[18,28] — *universal*
- Crit Chance % — C[2,4] E[4,6] R[5,9] P[8,13] S[12,18] — *universal*
- Crit Damage % — C[10,20] E[20,35] R[30,50] P[45,70] S[60,100] — *universal*

**Emitter** (projectile):
- Damage % — C[4,7] E[7,11] R[10,16] P[15,23] S[20,32] — *universal*
- Projectile Speed % — C[5,9] E[9,14] R[13,20] P[18,28] S[25,40] — *universal*
- **Pierce +N** (int) — C1 E1 R2 P2 S3 — *railgun, laser only*
- **Splash Radius %** — C[4,8] E[8,13] R[12,18] P[16,26] S[22,35] — *pulse, rocket only*

**Capacitor** (firing):
- Fire Rate % — C[3,6] E[6,9] R[8,13] P[12,18] S[16,25] — *universal*
- **Slow Potency %** — C[4,8] E[8,13] R[12,18] P[16,26] S[22,35] — *slow only*
- **Slow Duration %** — C[5,10] E[10,16] R[14,22] P[20,32] S[28,45] — *slow only*
- Overcharge % (double-shot chance) — C[2,4] E[4,6] R[5,9] P[8,13] S[12,18] — *universal*

**Frame** (economy/utility):
- XP Gain % — C[5,10] E[10,16] R[14,22] P[20,32] S[28,45] — *universal*
- Shard-Find % — C[5,10] E[10,16] R[14,22] P[20,32] S[28,45] — *universal*
- Bounty % — C[4,8] E[8,13] R[12,18] P[16,26] S[22,35] — *universal*

### Minor uniques (one rolls on every **Prismatic**, on top of 2 affixes)

- **Overcharged** — +10% double-shot chance
- **Honed** — +8% crit chance
- **Piercing** — +1 pierce
- **Destabilizer** — slowed enemies take +15% from all sources

### Named uniques (define a **Singularity** item — its slot & maybe tower type)

Effect magnitudes live in [`LOOT.combat`](src/config.js:394-411):

| Unique | Slot | Locks to | Effect |
|---|---|---|---|
| **Prism Lens** | optic | universal | split shot: 2nd target takes 50% dmg |
| **Entropy Emitter** | emitter | universal | (entropy stacking — see combat cfg) |
| **Executioner's Array** | optic | universal | **execute**: +40% dmg to targets <20% HP |
| **Overflow Core** | capacitor | universal | every 5th trigger fires a free bonus volley |
| **Gravity Well** | frame | **slow** | pulls enemies backward along path (0.22 tiles/zap, resist ramps) |
| **Fractal Warhead** | emitter | **rocket** | spawns 3 bomblets (35% dmg, 45% radius each) |
| **Cascade Rail** | emitter | **railgun** | +2 pierce, +15% dmg per victim already pierced |

**Rarity economics** — sell-back `{C:5, E:15, R:40, P:100, S:300}` shards; store
prices `{C:15, E:50, R:140, P:450, S:1400}`; rarity roll weights
`{C:60, E:25, R:10, P:4, S:1}`.

**↻ Reuse angle.** This is the richest reusable system for a Slay-the-Spire feel
— the affix pool + minor/named uniques are essentially a **relic/card pool**.
For a roguelike you can drop the Mastery req-gate and **offer gear as draft
rewards** between levels, with rarity as the reward-tier lever. The named
uniques are ready-made build-defining "legendaries" (Cascade Rail = a
Railgun-pierce build; Gravity Well = a Slow-control build; Fractal Warhead = a
Rocket-AoE build) — exactly the "run archetype" anchors a draft wants. The
generator (`generateItem`, `generateDrop`) is deterministic-seedable
(`makeRng(seed)`), which is perfect for **reproducible daily-run seeds**.

---

## 6. Also-useful systems

### Economy
[`balance-data.json` economy](src/balance-data.json:2) + loot:
- `moneyPerKillMultiplier 1`, `xpPerKillMultiplier 1` (global bounty/XP dials).
- **Interest:** each wave-clear pays `floor(money × rate)`, capped. Rate/cap are
  0 until skill nodes buy them (`eco_intrate` +2%/box, `eco_intcap` +50/box);
  base cap 50.
- **Shards** (persistent meta-currency, earned win *or* lose):
  `perKillBase 0.12 × shardTier × levelMult`, `levelMult = 1 + 0.35×(level-1)`.
- **XP split:** a kill's XP is divided among all contributing towers by damage
  weight; slow contributes `slowWeightPerSec 8` per second applied (this is how
  Slow towers earn XP despite rarely landing kills).
- Per-battle **starting money** is per-level (L1 = 100, ranges ~90–200).

### Level structure
`levels.level_NNN`: `gridWidth/Height` (mostly 8×12), `coreHealth` (lose when it
hits 0; L1 = 20, tightens to 10 in W1), `pathCorners` (the track),
`blockedTiles`, `startingMoney`, `timeBetweenWaves`, `waves[]`. **20 levels / 4
worlds** (5 each); worlds unlock when the previous world's levels are all
cleared. Endless follows authored waves.

### Milestone challenges (per level, optional bonus objectives)
[`balance-data.json` levelMilestones](src/balance-data.json:169). Each level has
~2: a **Flawless** (no leaks) + a tower-restriction challenge (`onlyTowers` /
`withoutTowers` / `towersAtLevel`), rewarding shards + a skill point.

### World-4 special tiles (data-driven map modifiers)
Three optional per-level features (HANDOFF "special-tile mechanics"):
- **Wormholes** `[{enter, exit, types?}]` — teleport enemies along the path;
  optional type filter.
- **Fields** `[{tiles, speedMult?, damageMult?}]` — path zones that speed/slow
  enemies or scale damage taken (pad/tar/weak/shield).
- **Conduits** `[{tiles, damageMult?, rangeMult?, fireRateMult?, pierceBonus?}]`
  — buildable tiles that buff the tower placed on them.

### Endless scaling constants
[`balance-data.json` endless](src/balance-data.json:10): per-wave growth
`health +16%`, `count +5%`, `speed +1.2%`, interval `×0.985`; boss every 5;
caps count ×3 / speed ×1.6.

**↻ Reuse angle.** The **map-modifier trio (wormholes/fields/conduits)** is the
single most roguelike-ready system here — they're pure data on a level, so a run
generator can **sprinkle them as per-level "room modifiers"** (a Slay-the-Spire
map node type). Milestone challenges are ready-made **optional-objective / elite
rewards**. The Shard meta-currency is your obvious **between-runs progression
currency**. Interest + starting-money are levers for a "build economy this run"
relic. Endless growth constants are a tested template for **infinite/escalating
run scaling** if you want an endless roguelike variant.

---

## 7. Quick "what to reuse vs. build" summary for the design session

| System | Reuse as-is | Likely to change for roguelike |
|---|---|---|
| 5 towers + damage types | ✅ core kit | add more via same stat-block pattern |
| In-battle level curve | ✅ per-battle ramp | keep |
| Mastery (permanent ranks) | meta only | probably **cut** for fresh runs |
| Skill tree | ✅ as meta-unlock | or **shatter into draftable cards** |
| 7 enemies + resist matrix | ✅ the combo puzzle | randomize wave comps |
| Gear affixes + uniques | ✅ **relic/card pool** | drop req-gate, offer as draft rewards |
| Map modifiers (WH/field/conduit) | ✅ **room modifiers** | the roguelike win |
| Milestones | ✅ optional objectives | reframe as elite rewards |
| Shards / economy | ✅ meta-currency + run economy | keep |

**Engine facts that constrain design:** plain vanilla-JS/Canvas, no build step;
all tunables data-driven; localStorage saves must migrate not wipe; ~300–400
concurrent enemies is the mobile perf ceiling (raise HP, not counts, to make
things harder); adding a tower/enemy needs only data + a damage-type row, not
new engine code.
