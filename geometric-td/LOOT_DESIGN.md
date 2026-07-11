# Geometric TD — Loot & Equipment Design Spec

Build spec for the per-tower loot/equipment system (Diablo-style gear) plus
the supporting changes it forces (Mastery curve rework, contributor-weighted
XP, Endless reward tracks). Agreed in a design session; **read `HANDOFF.md`
first** for architecture, constraints, and the balance-testing recipe.

Status: **P5 COMPLETE — P6 Endless reward tracks is next.** Build order is at the bottom.
Update the "Build status" checkboxes as phases land.

---

## 0. Philosophy & how it fits

The game already treats towers as persistent RPG units (names, XP, kills,
career `maxLevel`, Mastery ranks). Gear is the natural next layer: **loot you
find and equip on individual roster towers.**

Two **complementary** progression systems, kept separate:
- **Skill tree** (unchanged) — account-wide *passive* buffs to ALL towers.
- **Gear** (new) — *per-tower* loadouts you find, buy, and equip.

Hard constraints are unchanged from HANDOFF.md: **vanilla JS ES modules, no
build step, no deps; all tunables live in `config.js`; never break saves
(migrate); keep it runnable every change; portrait/touch-first.**

---

## 1. Currency — Shards ◆

- Earned per **enemy kill**, win OR lose (so grinding/forfeiting still pays).
- Amount scales with enemy tier (tougher enemy → more shards).
- Persistent **meta-wallet** (`state.shards`), distinct from in-battle credits.
- Spent at the **store** (buy gear, reroll stock). Selling gear returns Shards.

First-pass knobs (`config.js LOOT.shards`):
- `perKillBase`: 3
- `perKillTierMult`: multiply by enemy's HP-tier factor (e.g. 1 / 2 / 4 for
  grunt / heavy / boss). Final = `round(perKillBase * tierMult)`.
- Sell values by rarity: Common 5, Enhanced 15, Rare 40, Prismatic 100,
  Singularity 300.

---

## 2. Mastery rework (gates gear)

Gear requirements are gated on **Mastery rank**, so the Mastery curve is now
load-bearing. Two changes:

### 2a. 25 → 50 ranks, escalating cost
Replace the flat `xpPerRank` model with an **arithmetic ramp**: rank *n* costs
`base + increment·(n−1)` XP, so every rank costs `increment` more than the one
before it (curve accelerates; cumulative XP is quadratic).

`config.js TOWER_UPGRADES.mastery` becomes:
```js
mastery: {
  xpStart: 700,        // XP where mastery begins (= level-5 threshold)
  baseXpPerRank: 400,  // cost of rank 1
  xpRankIncrement: 80, // each rank costs this much more than the last
  damagePerRank: 0.015,// +1.5% damage per rank (was 0.02 — see note)
  maxRanks: 50,        // +75% damage at cap
}
```

Closed-form rank from XP (keeps `masteryRankFor` a cheap one-liner, still
derived purely from `xp` — no new save field, stays retroactive):
```
x   = xp - xpStart
b   = baseXpPerRank,  k = xpRankIncrement
// cumulative XP to reach rank N: E(N) = b*N + k*N*(N-1)/2
// invert (solve E(N) <= x for max N):
rank = k === 0
  ? floor(x / b)
  : floor( ( -(b - k/2) + sqrt((b - k/2)^2 + 2*k*x) ) / k )
rank = clamp(rank, 0, maxRanks)
```
`xpToNextMastery` = `E(rank+1) + xpStart - xp`.

**Reference points (base 400, inc 80):** rank 1 = 1,100 XP · rank 10 = 8,300 ·
rank 20 = 23,900 · rank 50 = 118,700 total.

### 2b. Retroactive nerf — DECIDED: accept
Because rank is derived from `xp`, the steeper curve **retroactively lowers
existing towers' ranks**. A tower at the old cap (15,700 XP = old rank 25,
+50%) becomes ~rank 15 on the new curve, and with `damagePerRank` 1.5% that's
+22.5% — a real reduction to maxed veterans.
**Decision (user, locked): ACCEPT.** No grandfathering, no XP top-up. Existing
veterans re-earn ranks on the new 50-rank curve; `damagePerRank` = 1.5%. This
fits the new 50-rank chase and the active rebalance. No special migration
needed (Mastery stays purely derived from `xp`).

### 2c. Gear requirement tiers
| Rarity | Requirement |
|---|---|
| Common | tower `maxLevel` 1–5 (per-item req level) |
| Enhanced | tower `maxLevel` 1–5 |
| Rare | Mastery rank ≥ 1 |
| Prismatic | Mastery rank ≥ 10 |
| Singularity | Mastery rank ≥ 20 |

Requirement checks a tower's **career** `maxLevel` / Mastery (not the in-battle
level that resets to 1 each fight), so gear never unequips mid-progression.
Consequence (intended, not a bug): high-rarity drops can sit unusable in the
stash until you grow a tower into them.

---

## 3. XP rework — contributor-weighted (fixes Slow towers)

Today only the killing tower gets XP, so Slow towers never level → never gain
Mastery → (under gating) could never equip Rare+ gear. Fix: **redistribute one
kill's XP pool among all contributors by weight** (killer no longer takes all).
Keeps total XP-per-kill constant (no economy inflation); accepted slightly
slower leveling.

Contribution weight per tower for a given enemy:
- **Damage dealt** to that enemy → `damage` weight (1 point per point of dmg).
- **Slow/CC applied** → `slowSecondsApplied * slowWeightPerSec` (this is what
  finally pays Slow towers for doing their job).
- Each tower's XP share = `killXp * (myWeight / totalWeight)`.

Track lightweight per-enemy contribution on the enemy object
(`enemy._contrib = { towerName: weight }`), accumulated in `damageEnemy` and
`slowEnemy`, consumed at death. Knobs (`config.js LOOT.xp`):
- `slowWeightPerSec`: 8 (tune so a busy Slow tower levels at a fair clip)
- Rounding: floor per-tower, give any remainder to the killer.

---

## 4. Equipment model

### 4a. Slots — 4 TYPED (one item each)
| Slot | Identity |
|---|---|
| **Optic** | sight / targeting |
| **Emitter** | the projectile / business end |
| **Capacitor** | power / timing |
| **Frame** | chassis / meta |

Typed slots **auto-solve stat-stacking**: each affix lives in exactly one slot,
so you can't stack the same stat 4×. No per-stat cap needed.

### 4b. Rarities & affix counts
| Rarity | Color | Affixes |
|---|---|---|
| Common | grey | 1 |
| Enhanced | green | 1 (higher band) |
| Rare | cyan | 2 |
| Prismatic | magenta | 2 + 1 minor unique |
| Singularity | gold/white | 2–3 + 1 named unique |

### 4c. Universal vs type-restricted (rolled per item)
Each item rolls a restriction at generation: with prob `pUniversal` it's
**universal** (any tower); else it locks to **one random tower type**. Roll is
independent of affix — a Damage Emitter can be universal OR "Laser-only", etc.

Restricted items are compensated two ways:
1. **Type-specific affixes** (Pierce, Splash, Slow Potency/Duration) *only*
   appear on restricted items — restriction buys a better affix pool.
2. Restricted items roll **`restrictedRollBonus`× higher values** (default
   1.15; set 1.0 to lean only on #1).

**Generator constraint:** an affix's compatible tower types must **intersect**
across the whole item (never Splash[pulse/rocket] + Pierce[rail/laser] on one
Emitter). Restriction type is chosen from that intersection; universal only if
every affix is universal-capable.

Knobs (`config.js LOOT.gen`): `pUniversal` 0.6, `restrictedRollBonus` 1.15.

---

## 5. Affix pool

`⚙️` = needs a new combat mechanic (crit, double-shot). **All ⚙️ are in v1.**
Everything else just scales an existing engine number.

**OPTIC** — Range % *(univ)* · Crit Chance % ⚙️ *(univ)* · Crit Damage % ⚙️ *(univ)*
**EMITTER** — Damage % *(univ)* · Projectile Speed % *(univ)* · Pierce +N *(rail/laser)* · Splash Radius % *(pulse/rocket)*
**CAPACITOR** — Fire Rate % *(univ)* · Slow Potency % *(slow)* · Slow Duration % *(slow)* · Overcharge / double-shot chance % ⚙️ *(univ)*
**FRAME** — XP Gain % *(univ)* · Shard-Find % *(univ)* · Bounty % *(univ)*

### Per-rarity roll ranges (first-pass, all tunable, item-level nudges toward top)
| Affix | Common | Enhanced | Rare | Prismatic | Singularity |
|---|---|---|---|---|---|
| Range % | 3–6 | 6–10 | 9–14 | 13–20 | 18–28 |
| Damage % | 4–7 | 7–11 | 10–16 | 15–23 | 20–32 |
| Fire Rate % | 3–6 | 6–9 | 8–13 | 12–18 | 16–25 |
| Proj. Speed % | 5–9 | 9–14 | 13–20 | 18–28 | 25–40 |
| Splash % | 4–8 | 8–13 | 12–18 | 16–26 | 22–35 |
| Slow Potency % | 4–8 | 8–13 | 12–18 | 16–26 | 22–35 |
| Slow Duration % | 5–10 | 10–16 | 14–22 | 20–32 | 28–45 |
| XP / Shard-Find % | 5–10 | 10–16 | 14–22 | 20–32 | 28–45 |
| Bounty % | 4–8 | 8–13 | 12–18 | 16–26 | 22–35 |
| Pierce (+N) | +1 | +1 | +2 | +2 | +3 |
| Crit Chance % ⚙️ | 2–4 | 4–6 | 5–9 | 8–13 | 12–18 |
| Crit Damage % ⚙️ | 10–20 | 20–35 | 30–50 | 45–70 | 60–100 |

Stacking: additive within a stat (only ever one source per stat via slots).
Apply gear as a multiplier onto the tower's computed stats alongside skills/
Mastery/specialties — see §11 balance note.

---

## 6. Uniques

**Prismatic minor-uniques** (roll one from a light pool): +double-shot chance ⚙️
· +crit chance ⚙️ · +1 pierce · "slowed enemies take +X% from all sources."

**Singularity named uniques** (starter list — hand-designed chase items; each
is a specific item with a fixed unique + normal affixes):
- **Prism Lens** (Optic) — shots split to a 2nd target for 50%.
- **Entropy Emitter** (Emitter) — resisted hits deal FULL damage (ignore the
  counter penalty).
- **Executioner's Array** (Optic) — +40% damage to enemies below 20% HP.
- **Overflow Core** (Capacitor) — every 5th shot fires a free bonus volley.
- **Gravity Well** (Frame, slow) — slow radius also drags enemies backward.
- **Fractal Warhead** (Emitter, rocket) — explosions spawn 3 secondary bomblets.
- **Cascade Rail** (Emitter, railgun) — +2 pierce; each pierced enemy adds
  +15% damage to the next in line.

---

## 7. Drops

- Per-kill **drop chance** (`dropChanceBase`, e.g. 0.02), multiplied up for
  elites/bosses (`dropChanceTierMult`).
- On a drop, roll rarity from **weights** — any enemy can roll any rarity, so a
  Singularity from a grunt is astronomically rare but nonzero:
  Common 60 / Enhanced 25 / Rare 10 / Prismatic 4 / Singularity 1.
  Elites/bosses shift weight toward the top (`bossRarityBias`).
- **Guaranteed 1 drop at end of every game** (win or lose), with a **rarity
  floor** that scales with progress (wave reached / level index) so deep runs
  guarantee better loot.
- Item-level of a drop scales with the enemy / wave that dropped it (feeds the
  affix roll-toward-top).

Knobs live in `config.js LOOT.drops`.

---

## 8. Store

- Random **stock** of `stockSize` (5) items, **rerolled after every game**.
- Item-level of stock scales to the roster's top `maxLevel` (+ Mastery), so
  stronger gear appears as you grow (`storeIlvlFromRoster`).
- **Reroll button** costs Shards (`rerollCost`, escalating within a visit).
- Buy with Shards; **sell** unwanted gear here (§1 sell values).
- Store stock stored in save so it persists between app opens until next game.

---

## 9. Stash & triage

- Stash cap **50** items (`stashSize`).
- **One-click "sell all [rarity]"** (bulk-sell Commons etc.).
- **End-of-game triage:** if the stash is full when a game ends with new loot,
  show a **triage strip beside the stash**. Player frees space (sell/equip) to
  move items in. Items left in the strip are **lost on leaving** — soft loss,
  **guarded by a confirm-on-exit** ("N unclaimed items will be lost — leave?").
- Guaranteed end-drop enters triage rather than vanishing if stash is full.

---

## 10. Endless reward tracks

Per-level, one-time unlockable bonuses to make replaying / pushing higher fun.
Data-driven (`levels.js` per-level, or a new `endlessRewards.js`):
```js
// per level id: a list of milestones
{ id, type: "wave" | "kills" | "noLeak" | ...,
  threshold: 20,
  reward: { kind: "loot", rarity: "rare" } | { kind: "shards", amount: 500 } }
```
- Types: reach wave N, total kills in a run, no-leak clears, etc.
- One-time per level; claimed set tracked in save
  (`state.endlessRewards[levelId] = [claimedIds]`).
- Shown on the Endless entry / RUN OVER overlay as a progress track.
Detailed milestone tables TBD — structure is fixed, numbers come later.

---

## 11. Data model, save schema & migration

New save fields (backfill **right after `loadSave()` in progression.js**, not
only in `save.js DEFAULT_SAVE` — see HANDOFF's deploy-propagation gotcha):
```js
state.shards ??= 0;
state.stash ??= [];                 // array of item objects, cap 50
state.store ??= { stock: [], rerolls: 0 };
state.endlessRewards ??= {};        // { levelId: [claimedMilestoneId, ...] }
// per roster record:
rec.gear ??= { optic: null, emitter: null, capacitor: null, frame: null };
```
Item object shape:
```js
{ id,                 // unique instance id
  slot,               // "optic" | "emitter" | "capacitor" | "frame"
  rarity,             // "common" | "enhanced" | "rare" | "prismatic" | "singularity"
  towerType,          // null (universal) | "laser" | "pulse" | ... (restricted)
  ilvl,               // item level (drives roll-toward-top)
  reqLevel,           // maxLevel requirement (common/enhanced)
  reqMastery,         // mastery requirement (rare+)
  affixes: [ { stat, value }, ... ],
  unique: null | "prismLens" | ...  // unique id when Prismatic/Singularity
}
```
Never wipe/downgrade existing saves; all new fields default safely.

---

## 12. New combat mechanics to build (the ⚙️ set)

- **Crit** — on fire, roll `critChance`; on crit multiply damage by
  `1 + critDamage`. Sum crit stats from gear. Add a bright VFX on crit (pizzazz).
- **Double-shot (Overcharge)** — roll `doubleShotChance` per shot; on success
  fire a second shot same tick.
- **Singularity uniques** — each is bespoke combat code (chain, execute, ignore-
  resist, bomblets, pierce-ramp). Build incrementally; gate a unique behind a
  feature flag if not ready so items can exist before their effect does.

---

## 13. Knobs summary (all under `config.js LOOT`, plus mastery in TOWER_UPGRADES)

`shards` (perKillBase, perKillTierMult, sellValues) · `xp` (slowWeightPerSec) ·
`gen` (pUniversal, restrictedRollBonus, affix roll-range tables, rarity affix
counts) · `drops` (dropChanceBase, dropChanceTierMult, rarityWeights,
bossRarityBias, endDropFloor) · `store` (stockSize, rerollCost, storeIlvl) ·
`stash` (stashSize) · `mastery` (baseXpPerRank, xpRankIncrement, damagePerRank,
maxRanks). Keep every number here — never hardcode in logic.

---

## 14. Suggested build order (small runnable increments)

Each phase must leave the game runnable and be verifiable via the browser /
`window.step` recipe in HANDOFF.md. **Bump `src/version.js APP_VERSION` on any
push the player should pick up.**

**Token strategy:** build one phase per fresh session, `/clear` between them —
the handoff is the FILES (committed code + the checkboxes below), not the
conversation. Don't use subagents (they add an accumulating parent on top of
the same cold re-reads). Model + effort per phase — track the reasoning each
phase needs, not its size:

| Phase | Model | Effort | Why |
|---|---|---|---|
| P0 Mastery/XP math | Opus | High | formula inversion + retroactive-nerf correctness |
| P1 Currency/save | Sonnet | Medium | mechanical field + counter + migration |
| P2 Item generator | Opus | High | the one tricky module (constraints, roll logic) |
| P3 Combat + crit/uniques | Opus | High | stat-plumbing correctness, new mechanics |
| P4 Stash/equip/triage UI | Sonnet | Medium | DOM/CSS following existing ui.js patterns |
| P5 Store UI | Sonnet | Medium | data + UI wiring |
| P6 Endless tracks | Sonnet | Medium | mostly data + display |
| P7 Balance | Opus | High | judgment + bot-sim reasoning |

(Skip Low effort — even the "easy" phases touch save migration / existing UI
where a missed detail costs a round-trip. Bump a Medium phase to High if it
starts flailing rather than defaulting everything High.)

- [x] **P0 — Mastery curve + XP redistribution.** DONE (2026-07-11). 50-rank
      escalating mastery curve (closed-form `masteryRankFor` inversion) +
      contributor-weighted XP (damage + slow weight) that levels Slow towers.
      Knobs: `config.js TOWER_UPGRADES.mastery` (baseXpPerRank/xpRankIncrement/
      damagePerRank 1.5%/maxRanks 50) + `config.js LOOT.xp.slowWeightPerSec`.
      Verified in-browser: rank thresholds exact at 1/10/20/50 (1,100 /8,300/
      23,900/118,700 XP), old cap 15,700 XP → rank 15 (accepted §2b nerf),
      and a real 7-wave battle where a Slow tower earned 162 XP with 0 kills
      (was 0 before), pool conserved.
- [x] **P1 — Shards currency + save schema/migration.** DONE (2026-07-11).
      Earned per kill (win/lose/forfeit alike) via `enemy.def.shardTier`
      (1/2/4 grunt/heavy/boss, new field on `ENEMIES`) x
      `LOOT.shards.perKillBase`. Banked live on `game.shardsEarned`,
      synced into the persistent `state.shards` wallet in
      `progression.js syncRoster` (shared by recordBattleEnd/
      recordEndlessResult/forfeitBattle, so every exit path pays out).
      New save field `shards: 0` in `save.js DEFAULT_SAVE` +
      belt-and-suspenders `state.shards ??= 0` backfill in progression.js
      (deploy-propagation gotcha pattern). Displayed as `◆ N` under the
      main-menu title (`#shards-readout`), updated in `ui.js renderWorld`.
      No gear yet. Verified in-browser: a scripted battle earned 12
      Shards from kills, survived a loss + return-to-menu, and rendered
      correctly on the menu.
- [x] **P2 — Item generator.** DONE (2026-07-11). New pure module
      `src/loot.js` — `generateItem(opts)` rolls the §11 item shape; no DOM,
      no save writes, no game state. Every tunable lives in `config.js
      LOOT.gen` (pUniversal/restrictedRollBonus, ilvlMax/ilvlTopBias,
      rarityWeights, affixCounts, reqMastery, the full per-slot affix table
      from §5, minor+named unique pools from §6, sellValues). Restriction
      (§4c) is satisfied by construction: the tower type is fixed FIRST, then
      affixes are only sampled from the type-compatible pool, so a
      type-specific affix (Pierce/Splash/Slow*) can never land on a universal
      item and the whole-item intersection is never empty. Singularity items
      are defined by their named unique (it sets slot + optional type lock),
      then roll 2–3 compatible normal affixes. ilvl nudges each roll toward
      the top of its band; restricted items roll `restrictedRollBonus`×
      higher (may exceed the band top, intended). Seedable RNG (`makeRng`) +
      `lootSelfTest()` + `itemLabel()` for reproducible console verification;
      `window.loot` exposed in `main.js`. Verified in-browser: 50,000-item
      self-test passed all §4b/§4c/§11 invariants with rarity/slot/universal
      distributions matching config (60/25/10/4/1, 60% universal); every
      named unique produced its correct slot/type lock + compatible affixes;
      ilvl roll-toward-top and restricted bonus both confirmed.
- [x] **P3 — Equip + gear application in combat** incl. crit & double-shot.
      Completed 2026-07-11. Save-compatible roster gear slots, career
      requirement checks, every normal combat/meta affix, Prismatic minor
      uniques, and all seven Singularity effects are active. `window.gear`
      still exposes debug `grant/equip/unequip/roster` helpers alongside the
      P4 player-facing stash UI. All effect magnitudes live in `LOOT.combat`;
      projectile speed and base pierce live on the tower definitions. Verified
      with syntax checks, a 10,000-item integration smoke test, and deterministic
      damage/effect checks covering crit, Overcharge, and every unique.
- [x] **P4 — Drops + guaranteed end-drop + stash + stash/equip UI + triage.**
      Completed 2026-07-11. Kill drops now roll from `LOOT.drops`, every
      win/loss/forfeit adds a guaranteed end-drop, and new items enter
      `pendingLoot` for the GEAR triage strip. Save fields `stash`,
      `pendingLoot`, `store`, and `endlessRewards` are defaulted and
      backfilled. The main menu has a GEAR entry for stash, equipped slots,
      equip/unequip, individual sell, sell-all Common/Enhanced/Rare, claim
      pending drops, and confirm-on-leave for unclaimed triage loot. Verified
      with JS syntax checks, generator/drop invariant checks, and a mocked
      persistence smoke test covering claim/equip/unequip.
- [x] **P5 — Store UI** (stock gen, reroll, buy/sell). Completed 2026-07-11.
      The STORE menu has persistent five-item stock, roster-scaled item level,
      escalating Shard rerolls, stash-cap-safe purchases, and automatic fresh
      stock after every game. GEAR remains the sell path.
- [ ] **P6 — Endless reward tracks.**
- [ ] **P7 — Balance pass** (bot sims; geared-veteran wave-1 spike, drop rates,
      Shard economy, Mastery pacing).

---

## 15. Balance concerns to watch (for P7)

- **Geared-veteran wave-1 spike:** a Mastery-20, fully-geared veteran keeps gear
  bonuses from turn one (re-enters at in-battle level 1). Amplifies the
  veteran-vs-fresh gap; levels likely need a tuning pass.
- **Multiplicative stack:** gear × skills × Mastery × specialties × upgrades.
  Decide additive-vs-multiplicative composition and confirm no runaway.
- **Shard economy:** earn rate vs store/reroll/sell prices; don't trivialize.
- **Drop rarity weights:** the "grunt drops Singularity" thrill vs. flooding.

## 16. Deferred (post-v1)
- **Set bonuses** (equip N of a set for a combo effect).
- Stash-size upgrades as a Shard sink.
- More Singularity uniques; per-slot cosmetic glow tiers.
