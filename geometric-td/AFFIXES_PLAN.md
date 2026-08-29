# Geometric TD — Affix (Mods) Build Plan

Build plan for the **affix system** — behavioral gear modifiers ("**Mods**")
that change tower and enemy behavior. Requirements source: **`plans/affixes.md`**
(read it for the full mechanic specs; this file is the *how we build it* plan).
**Read `HANDOFF.md` first** for architecture, constraints, and the
balance-testing recipe.

> **Terminology note.** `plans/affixes.md` calls these "Affixes." The codebase
> already uses `item.affixes` for the shipped **stat-roll** system
> (`[{stat,value}]`, LOOT_DESIGN §5). To avoid clobbering that (and its 50k-item
> self-test), the behavioral system lives in a **separate** field, `item.mods`.
> In player-facing UI/fiction we may still say "affix"; in code it is always
> **mods**. A "mod" is one behavioral affix = `{ id, power }`.

Status: **NOT STARTED.** Update the phase checkboxes as they land.

---

## 0. Cardinal rules (from CLAUDE.md / HANDOFF.md — do not violate)

- Plain HTML5 / Canvas / vanilla JS ES modules. No framework, build step, deps,
  or TypeScript.
- **Every tunable number lives in `config.js`** (`LOOT.mods`). Never hardcode a
  balance value in combat logic.
- **Never break or wipe existing localStorage saves.** New fields get a
  `save.js` default AND a post-`loadSave()` backfill in `progression.js`. Gear
  with no `mods` field must behave as `mods: []`.
- Keep the game runnable after every phase.
- **Do not degrade framerate.** No per-frame scans of all enemies × all towers.
  See §5 (Performance contract) — it is a hard requirement, not a nice-to-have.
- Bump `src/version.js APP_VERSION` on **every** phase that ships to the player
  (each mod is its own ship — see §7).

---

## 1. Build philosophy — one mod at a time

The player debuts each mod on the iPhone as it ships, then we build the next.
Therefore:

1. **Phase 0 (foundation) ships first** and is invisible — data model, registry,
   hook layer, config skeleton, drop/store integration, debug tools. No gameplay
   change yet (registry is empty), saves stay compatible.
2. **Each subsequent phase adds exactly one mod** (or one tight family — the 3
   secondary Broadcasts), is independently shippable, and is obtainable
   on-device the moment it ships (foundation put `mods` in the drop pool).
3. Order below is a **recommendation** — the player picks the debut order for
   testing/fun. Only Phase 0 is a hard prerequisite for everything else.

**Delegation:** each phase is delegated to **Codex** (MCP, high reasoning) as a
cold read of *this file*. Codex gotchas (HANDOFF "Delegating work to Codex"):
- Set `cwd` to the **repo root** `C:\Projects\First-Game` if it needs git.
- **Codex cannot verify in a browser** — real-browser verification is the Claude
  orchestrator's job (`preview_start` → `serve.ps1`, state/DOM assertions per
  HANDOFF; no canvas capture).
- **Review every phase diff for intent, not just instruction-following.**
- Give it an explicit file list to stage; never `git add -A`.
- The orchestrator (Claude) does the single `version.js` bump + commit + push
  per phase.

---

## 2. Data model & save compatibility (Phase 0)

### 2a. Item shape — add one field
```js
{ id, slot, rarity, towerType, ilvl, reqLevel, reqMastery,
  affixes: [ {stat, value}, ... ],   // UNCHANGED — shipped stat rolls
  mods:    [ {id, power}, ... ],      // NEW — behavioral affixes; default []
  unique }
```
- `mods` defaults to `[]` everywhere. A loaded item without `mods` is treated as
  `mods: []` (read via a helper `itemMods(item)` → `item.mods || []`; never
  assume the field exists).
- `power` is the **rolled** strength stored on the item (spec §6) — never
  re-derived from rarity at load time, so variable rolls (spec §6) drop in later
  with no save migration.
- The architecture supports **multiple mods per item** even though initial
  generation rolls at most one (spec §4).

### 2b. Save backfill
No migration needed (additive optional field). But follow the deploy-propagation
gotcha: items live inside `state.stash`, `state.pendingLoot`, `state.store.stock`,
and each `rec.gear` slot. None require a rewrite — a missing `mods` reads as `[]`.
Add a defensive normalize in `loot.js`/`equipment.js` load paths only where an
item object is first touched, not a bulk save rewrite.

### 2c. Aggregation
`equipment.js aggregateGear()` stays as-is for stat rolls. Add a **parallel**
`aggregateMods(gear)` → returns the equipped mods grouped by id with their
powers, e.g. `{ array: [{power:0.07}], damageBroadcast: [{power:0.16}] }`.
This is the single read point combat uses; it does NOT mutate tower base stats.

---

## 3. Registry & config architecture (Phase 0)

### 3a. `src/affixes.js` — new pure module (the registry)
- No DOM, no save writes, no game-loop ownership.
- Exports a `MODS` registry keyed by id. Each entry:
  ```js
  {
    id: "array",
    category: "protocol",        // "protocol" | "fault"
    nameKey, descKey,            // i18n keys (English inline fallback)
    // behavior is attached as hook fns — see §4. Absent hooks = no-op.
  }
  ```
- Adding a mod = register its definition here + implement its hook(s). It must
  NOT require editing every tower/enemy path (spec §3, §7).
- Helper queries used by combat/UI: `getMod(id)`, `isFault(id)`, `isProtocol(id)`.

### 3b. `config.js LOOT.mods` — all numbers
```js
LOOT.mods = {
  testDropRate: <generous, e.g. 0.5 of drops carry a mod>,  // spec §27
  // per-mod, per-rarity power tables (spec §5 table):
  powers: {
    array:  { common:0.03, uncommon:0.05, rare:0.07, epic:0.09, legendary:0.12 },
    desync: { common:0.01, ... },        // per stack
    throttle: { perStack:0.02, maxSlow:0.50, ... },
    exposed: { perStack:0.02, maxStacks:20, ... },
    fork:   { common:0.01, ..., legendary:0.05 },
    damageBroadcast:  { common:0.08, ..., legendary:0.25 },
    fireRateBroadcast:{ ... },
    rangeBroadcast:   { ... },
    critBroadcast:    { common:0.04, ... },   // percentage POINTS
  },
  arrayExtraSourceBonus: 0.01,   // +1pp per additional same-type Array source
  broadcastRadiusTiles: <configurable, spec §20>,
  broadcastSelfBuffs: false,     // source buffs itself only if true (spec §20)
  fork: { levelBelowParent: 1, minLevel: 1 },
  // stack caps / durations / stacking modes per §26 as each mod lands.
}
```
> **Rarity note.** `plans/affixes.md` §5 uses common/uncommon/rare/epic/legendary.
> The game's rarities are **common/enhanced/rare/prismatic/singularity**
> (LOOT_DESIGN §4b). **Map the spec's tiers onto the game's five** (uncommon→
> enhanced, epic→prismatic, legendary→singularity) rather than inventing new
> rarities. Document the mapping in the config comment.

### 3c. Effective-stat order — DOCUMENT IT (spec §25)
Mods fold into the EXISTING `towers.js recomputeStats` pipeline, which already
rebuilds from base every time (never overwrites base). Canonical order, extend
the existing chain:
```
base
 × level growth × specialty × mastery × global skill mult × gear stat rolls
 × Array           (protocol, cached per type)
 × Broadcast dmg/fireRate/range   (aura, cached per tower)
 × conduit × surge (existing, stay LAST)
crit chance += Broadcast crit (percentage points), clamp 1
```
Enemy-side faults (Throttle/Exposed/Desync) apply in `enemies.js`
(`updateEnemies` movement + `damageEnemy`), NOT in recomputeStats.

---

## 4. Hook layer + recursion protection (Phase 0)

**Minimal explicit hooks — NOT a generic event bus** (perf + house style).
The initial 9 mods need only four touch points, all at functions that already
run:

| Hook | Call site (existing fn) | Used by |
|---|---|---|
| `onHit(ctx)` | `enemies.js damageEnemy`, before `enemy.health -= dmg` | Desync (apply/consume), Throttle, Exposed |
| `onKill(ctx)` | `damageEnemy` death branch | Fork |
| stat pipeline | `towers.js recomputeStats` | Array, all Broadcasts |
| `onNetworkChange(game)` | tower placed / sold / gear equipped-unequipped | rebuild Array + Broadcast caches, then `recomputeStatsAll` |

### 4a. Recursion context (spec §33) — thread it now
Combat calls pass a small **reused** context object (avoid per-hit allocation
where possible — one object per originating shot, not per victim):
```js
ctx = { source: tower, sourceType: tower.type, triggered: false, canProc: true }
```
- A primary hit: `triggered:false, canProc:true`.
- Any effect-spawned hit/attack sets `triggered:true` and, where a mod must not
  chain, `canProc:false`.
- Mods that can spawn actions (Fork now; Duplicate/Cascade/Relay later) MUST
  check `ctx.canProc` before proc'ing. This is the loop guard the spec demands.
- Fork specifically: a Fork-spawned tower does NOT inherit gear (spec §17), so it
  can't carry Fork → no loop today. The ctx plumbing is insurance for the future
  set (spec §36), built now so later mods don't have to retrofit it.

---

## 5. Performance contract (spec §34 — HARD requirement)

- **No per-frame O(enemies × towers) scans.** Ever.
- **Array**: recomputed only on `onNetworkChange`, cached on
  `game.modNetwork.array[type] = { count, effectivePower }`. `recomputeStats`
  reads the cache — O(1) per tower.
- **Broadcast**: auras recomputed only on `onNetworkChange`, cached per tower as
  a resolved multiplier set (`tower._broadcast = {damage, fireRate, range, crit}`).
  The range test (which towers are in which aura) runs at network-change time,
  not per frame.
- **Faults**: applied when we're already iterating that one enemy (on-hit) and
  read when already iterating it (movement / next hit). No extra passes. Store
  faults as `enemy.faults = {}` (created lazily; most enemies never get one).
- **Fork**: placement search runs only on a kill where the killer carries Fork
  AND the proc roll succeeds — bounded, rare. Never queue/search speculatively.
- `recomputeStats` will need a `game` handle (for the caches). Pass `game`
  through (or stash the cache on `grid`) — small signature change, note it in P0.
- Verify with DEBUG MODE FPS on a heavy board (e.g. L19 onslaught) that a
  fully-modded roster holds framerate vs. an unmodded baseline.

---

## 6. Debug / testing tools (Phase 0, spec §29–31)

On-device testing matters (player is on iPhone, no console). Provide **all three**:

- **Console** (`window` handles, desktop — for the orchestrator's verification):
  extend `window.loot`/`window.gear` — `spawnMod(id, power|rarity)`,
  `dumpFaults(enemyIndex)`, `dumpArray(type)`.
- **Real drop/store pool**: mods ride the drop pool from P0 at `testDropRate`, so
  shipped mods also appear organically in found/bought gear.
- **On-device MOD LAB panel — REQUIRED in P0** (the player's targeted-testing
  path; the player asked for it). Design:
  - **Gated behind the existing DEBUG MODE toggle** (Settings). Off by default ⇒
    normal players never see it. Client-side only; touches only the local save;
    never reaches leaderboard/co-op (mods are per-save; co-op locks skills at join
    and never writes the Endless board). This gate is the "other players won't see
    it" guarantee.
  - **Spawn mod gear**: pick mod id + rarity (or explicit power) + slot +
    tower-type → `generateItem` with the mod pinned → item lands in the stash.
  - **Seed test roster**: one tap sets the 5 tower types to a chosen `maxLevel` +
    mastery rank so gear is equippable and count-based mods (Array) are testable.
    **Reuse `progression.js seedRoster`/`seedSkills`** (the tooling exports balance
    sims already use) — do not write a parallel seeder.
  - **Save safety**: snapshot the real save on entering the Lab and offer one-tap
    **restore**, so seeding/spawning can't corrupt real progression. (A fully
    separate sandbox save-slot is deferred; snapshot+restore is the P0 version.)
  - The player then equips via the normal GEAR screen and plays **any** level as
    the sandbox — no dedicated test level needed.
- Fault inspection (spec §30) and Array inspection (spec §31): console first; the
  Mod Lab can grow a minimal on-screen readout as mods land if wanted.

---

## 7. Shipping each phase

Each phase = its own player-facing ship:
1. Codex builds it as a cold read of its phase section, staging only the listed
   files.
2. Claude orchestrator verifies in-browser (state/DOM/console-clean; no canvas
   capture), reviews the diff for intent.
3. Claude bumps `src/version.js APP_VERSION`, commits deliberately, pushes.
4. Player tests on iPhone; feedback steers the next phase.

---

## 8. Phases

Legend for per-mod sections: **Files** (what Codex touches) · **Behavior** ·
**Config** · **Landmines** · **Verify**.

### [ ] P0 — Foundation (invisible ship)
- **Files:** `src/affixes.js` (new), `src/config.js` (`LOOT.mods` skeleton),
  `src/equipment.js` (`aggregateMods`, `itemMods` helper), `src/loot.js` (roll an
  optional mod onto a drop behind `testDropRate`; leave registry empty so nothing
  actually rolls yet — the plumbing is what ships), `src/towers.js`
  (`recomputeStats` gains a `game` handle + reads empty mod caches harmlessly;
  `onNetworkChange` stub called on place/sell/equip), `src/enemies.js` (`onHit`/
  `onKill` hook calls + `ctx`, no-op with empty registry), `src/main.js`
  (`window` debug handles), `src/ui.js` (tooltip shows mods if present — none yet;
  **MOD LAB panel** gated by DEBUG MODE — §6), `styles.css` (Mod Lab styles),
  `index.html` (Mod Lab overlay shell if needed), `src/progression.js` (Mod Lab
  reuses `seedRoster`/`seedSkills`; save snapshot/restore helper).
- **Behavior:** none visible in normal play. Registry empty ⇒ no mod rolls, all
  hooks no-op. Mod Lab visible only with DEBUG MODE on (spawns nothing usable yet
  since the registry is empty — it's the harness, ready for P1).
- **Verify:** game runs unchanged; existing loot self-test still passes; saves
  load; a hand-injected `mods:[{id:"_test",power:0.1}]` survives save→reload and
  shows in the tooltip; Mod Lab appears only under DEBUG MODE and its snapshot/
  restore round-trips a save byte-for-byte; FPS baseline captured for §5.
- **Ship:** yes (bump version — plumbing live, behavior neutral).

> Recommended debut order after P0 (each independently shippable, reorder freely).
> Faults first prove the enemy-fault system on the simplest member; Protocols
> first prove the network cache. Player's stated interest was **Array** — fine to
> lead with P6 instead; only P0 must precede everything.

### [x] P1 — Exposed (Fault) — SHIPPED `2026.08.28-2`
- **Behavior:** hits from a tower carrying Exposed add +1 stack; +2%/stack damage
  taken; cap 20 (+40% max). Applied in the **centralized** `damageEnemy` (spec
  §22) alongside existing `vulnMult`/`_fieldDmg`.
- **Config:** `LOOT.mods.powers.exposed {perStack, maxStacks}` (global, not
  per-rarity — Exposed is intentionally absent from the §5 rarity table; item
  still stores a `power` so per-rarity scaling can be added later by reading it).
- **As built:** implemented ENTIRELY as an `onHit` handler in `affixes.js` —
  `enemies.js` untouched. Order = add the carrier's stack, then amplify this hit
  by current stacks (so the applying hit benefits from its own stack). Any tower's
  hit is amplified; only Exposed-carriers add stacks. Generic fault store landed
  here with the full reusable helper set (`addFaultStacks`/`removeFaultStacks`/
  `getFault*`/`hasFault`/`clearFault(s)`/`inspectFaults`/`faultInspectionLines`) —
  Throttle/Desync reuse it. `enemy.faults` is created lazily (fault-free enemies
  keep no property — perf).
- **Verified in-browser:** controlled sequence 102/104/…/110 (stack-first then
  amplify), non-carrier hit amplified with no new stack, cap = 20, fault-free
  enemies stay propertyless, item `power:0.02` survives save/reload, live firing
  path drove Exposed to cap, `faultInspectionLines` → "Exposed: / Stacks: 20 /
  Damage taken: +40%", console clean. (`dumpFaults` reads the real-play module
  `game`; returned null only in a synthetic test that bypassed `startLevel`.)

### [x] P2 — Throttle (Fault) — SHIPPED `2026.08.28-3`
- **Behavior:** +1 stack/hit from a Throttle-carrier; −2%/stack speed; cap 50%
  (25 stacks). Effective speed computed from base × modifiers so removing Throttle
  restores speed (spec §21) — `enemy.speedTilesPerSec` base never mutated.
- **Config:** `LOOT.mods.powers.throttle {perStack:0.02, maxSlow:0.50}` (global,
  like Exposed; item still stores a power).
- **As built:** stack application in `throttleOnHit` (affixes.js); the movement
  effect is a single generic `faultMovementMult(enemy)` helper called once in
  `enemies.js updateEnemies` next to `slowFactor`/`fieldSpeed` — no Throttle-
  specific branch in enemies.js. Composition with Slow-tower slow is
  **multiplicative** (independent factors). `addFaultStacks(enemy,id,amount,
  maxStacks,meta)` — cap is passed by the caller (throttle passes
  `ceil(maxSlow/perStack)`).
- **Verified in-browser:** `faultMovementMult` = 0.98/0.8/0.5(cap)/capped; a live
  enemy's per-second advance halved at cap (67.2→33.6) and restored to 67.2 on
  clear with base speed untouched; Slow×Throttle = 0.5×0.9 = 0.45 exactly;
  Exposed regression intact; console clean.

### [x] P3 — Desync (Fault) — SHIPPED `2026.08.28-4` (built directly, Codex was rate-limited)
- **As built:** `desyncOnHit` in affixes.js. `enemy.faults.desync = {stacks,
  towerType, powerPerStack}`. Same-type carrier hits build stacks and the
  strongest participating power wins (weaker never lowers); the first
  different-type hit (any tower, carrier or not) consumes and amplifies THAT hit
  by `stacks × powerPerStack` (composes multiplicatively with Exposed via shared
  `ctx.damage`), clears, and a consuming carrier opens a fresh 1-stack sequence.
  Same-type non-carrier / sourceless hits are no-ops. **First rarity-scaled mod:**
  `powerForRarity` reads `LOOT.mods.powers.desync` (0.01→0.03), item stores the
  rolled power. Config table already existed (P0 scaffold) — only affixes.js
  changed.
- **Verified in-browser (full §39 checklist):** start=1; same-type accrues;
  stronger 0.01→0.02 upgrades, weaker 0.01 never downgrades; non-carrier
  different-type consume = +6% then cleared; carrier-consumer restarts at 1×3%;
  same-type non-carrier no-op; per-rarity power (rare 0.02 / sing 0.03); save
  round-trip keeps power; §30 debug lines correct; Exposed+Throttle regressions
  intact; self-test green; console clean.
- (original spec retained below)
- **Behavior:** sequencing mechanic. First hit from a Desync-carrier = 1 stack,
  records `towerType` + active `powerPerStack`. Same-type hits add stacks; a
  **stronger** same-type Desync raises active power, a weaker one never lowers it
  (spec §10). A **different-type** hit consumes all stacks and amplifies that hit
  by `stacks × power`; if the consumer also carries Desync, immediately start a
  fresh 1-stack sequence for the new type (spec §9).
- **Enemy data:** `enemy.faults.desync = { stacks, towerType, powerPerStack }`
  (spec §11), inspectable.
- **Config:** `LOOT.mods.powers.desync` (per-rarity per-stack values), optional
  stack cap.
- **Landmines:** consume happens on ANY different-type hit (consumer need not
  carry Desync); amplification must apply to that hit's damage BEFORE
  `enemy.health -= dmg`; ordering vs Exposed/typeMult/vuln must be defined and
  documented. Recursion ctx: consumption is not itself a proc that re-triggers.
- **Verify:** the full §39 Desync acceptance checklist (start=1, same-type
  accrues, stronger upgrades / weaker never downgrades, different-type consumes
  with correct bonus, carrier-consumer restarts at 1).

### [x] P4 — Damage Broadcast (Protocol) — SHIPPED `2026.08.28-5` (built directly, Codex rate-limited)
- **As built:** a shared `applyBroadcastAura(game, modId, field)` in affixes.js
  (P5's three broadcasts reuse it) that, on network change, adds each source's
  power to the target `_broadcast` field of every tower within
  `broadcastRadiusTiles` (self excluded unless `broadcastSelfBuffs`; sources
  additive). `recomputeStats` already applied `_broadcast.damage`. Selection aura
  ring added in renderer.js (reads `tower._broadcastRadius`).
- **IMPORTANT ordering fix:** `onNetworkChange` now refreshes each tower's
  `gearMods` from current gear FIRST (imports `aggregateMods`), because
  `refreshModNetwork` runs it BEFORE `refreshTowerStats` — otherwise a gear
  equip/unequip rebuilt the network from STALE gearMods and the aura missed the
  just-changed gear (worked on placement only). This also hardens P6 Array.
- **Verified in-browser:** ungeared neighbor within radius gets +16% (rare),
  out-of-range 0, source not self-buffed (`_broadcast.damage`=0 with stat affixes
  stripped to isolate the aura), sell removes the buff and restores base, radius
  = 3 tiles, Fault regressions intact, self-test green, console clean.
- **Note:** a rare+ broadcast item ALSO rolls normal stat affixes; those buff the
  wearer directly (that's the stat system, not the aura) — expected.
- **Behavior:** reusable **aura** (spec §18): source tower buffs nearby towers'
  damage by its power; configurable radius; source excluded unless
  `broadcastSelfBuffs`; bonus vanishes when source removed; recompute on enter/
  leave (network-change, cached — §5). Multiple same-type broadcasts stack
  additively for now (spec §20, configurable later). Show aura radius when the
  source is selected (spec §20/§32).
- **Files add:** aura resolve in the `onNetworkChange` cache builder;
  `recomputeStats` applies `tower._broadcast.damage`; renderer draws the radius
  ring on selection.
- **Config:** `broadcastRadiusTiles`, `powers.damageBroadcast`,
  `broadcastSelfBuffs`.
- **Landmines:** never mutate base stats (§20); aura is a recompute term. The
  radius test is network-change-time only, never per frame (§5).
- **Verify:** neighbor gains/loses buff on place/sell/move; radius ring shows;
  FPS unaffected.

### [x] P5 — Fire-Rate / Range / Crit Broadcast — SHIPPED `2026.08.28-6` (built directly, Codex rate-limited)
- **As built:** three more MODS entries, each an `onNetworkChange` that calls the
  P4 `applyBroadcastAura` with its field (`fireRate`/`range`/`crit`).
  `recomputeStats` already applied all four. Crit is percentage POINTS
  (`critChance += broadcast.crit`), not a mult. affixes.js only.
- **Verified in-browser:** one source carrying all four broadcasts across its 4
  slots buffs an ungeared neighbor — fireInterval ×0.862 (=1/1.16), range ×1.16,
  crit 0→0.08 points, damage 0.16; self-test green; console clean.
- (Shipped as one debut; could have been split — trivial once the aura existed.)
- **Behavior:** three more auras on the P4 system. Fire-rate & range are % mults;
  **Crit is percentage POINTS** added to crit chance (spec §19), clamp 1.
- **Config:** their `powers.*` tables.
- **Landmines:** crit is additive pp, not a multiplier; goes through the same
  crit path gear crit uses.
- **Verify:** each aura buffs the right stat; crit pp adds correctly.
- **Split note:** may ship as 1, 2, or 3 separate debuts if the player wants.

### [x] P6 — Array (Protocol) — SHIPPED `2026.08.28-7` (built directly, Codex rate-limited)
- **As built:** `rebuildArrayNetwork(game)` in affixes.js builds
  `game.modNetwork.array[type] = {type,count,sources,strongestPower,
  effectivePower,bonus}` per type. `effectivePower = strongest + (sources−1) ×
  arrayExtraSourceBonus` (the +1pp raises PER-TOWER power, not the final bonus);
  `recomputeStats` reads `arrayBonus = count × effectivePower`. Rebuilt only on
  network change; per-type independent. `dumpArray(type)` returns the cache.
- **Verified in-browser (spec §14):** Ex1 3 lasers/one Array 5% → ×1.15; Ex2
  5%+7% → ×1.24; Ex3 6 lasers/3%+5%+7% → ×1.54 (on non-carriers too). Per-type:
  a rocket stayed at its own 1.15, unaffected by the lasers' 0.48. Dynamic recalc:
  selling a non-carrier 0.54→0.45; selling the STRONGEST carrier drops strongest
  0.07→0.05 → bonus 0.24. Self-test green; console clean. (`dumpArray` reads the
  real-play module `game`; synthetic tests read `window.game.modNetwork.array`.)
- **Behavior:** a tower carrying Array activates it for ALL towers of its type
  (source included in count). `effectivePower = strongestArray +
  (extraSources × 1pp)`; `bonus = sameTypeCount × effectivePower`; applied to
  every same-type tower's damage. Per-type independent (spec §15). Recompute on
  any network/gear change (spec §16), cached per type (§5).
- **Config:** `powers.array`, `arrayExtraSourceBonus`.
- **Landmines:** the +1pp raises **per-tower power**, not the final bonus (spec
  §13). Laser Array must never touch Rockets. Never mutate base damage — recompute
  term only. `dumpArray(type)` matches spec §31 example exactly.
- **Verify:** spec §14 examples 1–3 reproduce (15% / 24% / 54%); adding/selling a
  tower updates all same-type towers; gear change updates.

### [x] P7 — Fork (Protocol) — SHIPPED `2026.08.28-8` (built directly, Codex rate-limited) — COMPLETES the initial 9-mod scope
- **As built:** `forkOnKill` in affixes.js (proc-gated on the kill; guarded by
  `ctx.canProc` so triggered hits don't fork). Spawning needs towers.js, so
  towers.js injects `spawnForkTower` via `setForkSpawner` (no import cycle).
  `spawnForkTower` drops a FREE (`invested:0`) same-type gearless tower
  (`createTower(..., null)`) at level `max(minLevel, parent.level −
  levelBelowParent)` on the nearest legal empty tile (`forkTileNear`), flags
  `_forkCreated`, and rebuilds the network (new tower shifts Array/Broadcast).
  No tile free ⇒ nothing (never queued). Gearless ⇒ can't carry Fork ⇒ no chains.
- **Verified in-browser (rng forced to proc):** exactly 1 same-type tower spawns
  at level 2 (parent 3), gearless, `_modEntries` empty, `invested` 0, on a legal
  empty tile; a zero-bounty kill shows `walletDelta 0` (no cost); the forked
  tower's own kill does NOT chain; a `canProc:false` hit does NOT fork; self-test
  green; console clean.
- **Behavior:** on a kill by a Fork-carrier, `power` chance to spawn a free
  same-type tower in a nearby legal empty build tile, one in-level upgrade level
  below the parent (min 1). No currency. Spawned tower flagged Fork-created,
  inherits NO gear, normal mastery rules. If no legal tile: nothing (don't queue).
- **Config:** `powers.fork`, `fork {levelBelowParent, minLevel}`.
- **Landmines:** legal-placement search must reuse existing grid placement rules
  (never overwrite a tower, never off-path/blocked); bounded search near the
  kill; runs only on proc (§5). Simple spawn feedback (spec §32). Guard with
  `ctx.canProc` (spawned tower carries no Fork, so safe today).
- **Verify:** spawns only on legal tiles, no currency spent, spawned level =
  parent−1, no gear inherited; heavy Fork build holds FPS.

### [x] P8 — Polish — SHIPPED `2026.08.29-1` (Codex, after a retry; iterator fix by orchestrator)
- **Gear COMPARE sheet now shows mods** (reported bug): `openCompareSheet`
  (ui.js) renders a mods section paralleling the UNIQUE row — union of mod ids,
  `modName` label, `+modPower%` per side, up/down delta, `cmp-absent` em-dash for
  one-sided. **Orchestrator fix on top:** Codex wrote `newMods.keys().filter(...)`
  (Iterator Helpers, Safari 18.4+ only) which would throw on older iPhone Safari —
  changed to `[...newMods.keys()].filter(...)`.
- **Fault status markers** (spec §32): `renderer.js drawFaultMarkers` draws small
  static colored pips with letters (E/T/D) above enemies carrying Exposed/Throttle/
  Desync; no animation/glow/shadowBlur (guardrails); all knobs in
  `config.js VFX.faultMarker` (enabled/radius/gap/offset/alpha/font/colors/labels).
- **Verified in-browser:** real `render()` runs a full frame with an enemy
  carrying all three faults — no error; config present; clean boot + console.
  Compare-sheet mod rows reviewed + Codex stub-tested (union/deltas/absent/
  legacy-safe). Visual readability + compare-sheet layout = phone eyes.
- **Deliberately NOT done** (no player data yet): per-mod power tuning. Revisit
  after playtest feedback.

**AFFIX SYSTEM COMPLETE** — P0–P8 all shipped (`2026.08.28-1` … `2026.08.29-1`).

### Balance pass 1 (`2026.08.29-2`) — first playtest feedback
- **Array cap:** damage bonus now uses `min(sameTypeCount, LOOT.mods.arrayMaxTowers=10)`
  × effectivePower — spamming same-type towers no longer scales without bound (also
  a perf guard). `rebuildArrayNetwork` stores `effectiveCount` + capped `bonus`;
  `recomputeStats` reads `array.bonus`. `count` stays true for display.
- **Array powers ~halved:** 0.015/0.025/0.035/0.045/0.06 (was 0.03…0.12).
- **Broadcast powers ~halved:** damage/fireRate/range 0.04/0.06/0.08/0.10/0.13
  (was 0.08…0.25); crit 0.02/0.03/0.04/0.05/0.06 (was 0.04…0.12).
- **Fork spawns LOCAL:** `forkTileNear` now caps to `fork.maxRadiusTiles=2`
  (Chebyshev) around the parent; set 1 for strictly-adjacent. (Confirmed forked
  towers are gearless → never inherit Fork → no chaining; the "next tile over"
  was just the nearest legal empty tile when adjacents were path/occupied.)
- All still config-driven — dial further from `config.js LOOT.mods`.

---

## 9. Acceptance (spec §39) — track as phases land
Foundation-level criteria (P0) plus each mod's own criteria from its section.
Existing gear still works · existing saves still load · gear supports 0+ mods ·
mods store rolled power · rarity → power varies · mod gear drops/buys/equips/
unequips/survives save-reload · UI shows mod name+power+desc · debug spawn works ·
recursion ctx present. Per-mod behavioral criteria: see §8 phase sections and
`plans/affixes.md` §39.
