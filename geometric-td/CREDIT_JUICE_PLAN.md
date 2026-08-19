# Credit Juice — plan (2026-08-19)

Make earning credits **felt**. Today a kill silently increments `game.money`;
the only cue is a number changing in the HUD. Requested by the player's
daughter after comparing the game to Block Blast.

Four deliverables:
1. **Coins drop on the track** when a regular enemy dies.
2. **Bosses explode into coins** — a bigger, more satisfying burst.
3. **HUD gold pulse** whenever CREDITS goes up.
4. **Gear-drop flash** — a small rarity-colored gear icon flashes at the
   enemy when it drops a loot item.

Scope note from the player: **do not optimize for on-screen clutter yet.**
Err generous; every count/rate is a knob and we tune after seeing it on a
phone. Do not add throttling that isn't specified below.

---

## Cardinal rules for every phase

- Plain ES modules, no deps, no build step, no TypeScript.
- **Every number goes in `config.js`.** No tunable may be hardcoded in
  `particles.js`, `renderer.js`, `enemies.js`, or `ui.js`.
- Keep the game runnable after each phase.
- **No save-format change** — all of this is runtime-only. Do not touch
  `save.js` or `progression.js`.
- **Do not bump `src/version.js`. Do not `git add`, commit, or push.** The
  orchestrating session does that once at the end. The working tree contains
  unrelated in-flight work — only touch the files each phase names.
- Speed compensation: one-shot VFX decay on the speed-scaled game clock.
  Multiply one-shot lifetimes by `game.effectiveSpeed || 1` so they last a
  constant REAL-time length at x2/x4 — the same trick
  `particles.js emitLevelUpSplash` already uses. Physics (gravity, arc) stays
  on honest game time.
- Additive pass: `renderer.js:314` sets `globalCompositeOperation = "lighter"`
  before `drawEffects` + `drawParticles`. Gold blooms there for free —
  **never** add per-particle `shadowBlur` (mobile Safari perf guardrail).
  Use the existing `drawGlow(ctx, x, y, radius, color, alpha)` helper.

---

## Phase 1 — Coins (`config.js`, `particles.js`, `renderer.js`, `enemies.js`)

### 1a. Config

Add a `coins` block inside the existing `VFX` object in `src/config.js`
(it already contains `circuit`, `warp`, `levelUp`, `gear`, …):

```js
coins: {
  // --- regular kills ---
  perKill: [2, 4],        // random count per normal enemy death
  // --- boss kills ---
  bossPerKill: [18, 26],  // the "explosion of coins" moment
  bossSpeedMult: 1.6,     // bosses throw them harder and wider
  // --- physics (game-time, not speed-compensated) ---
  speed: [55, 130],       // initial burst speed, px/s
  upBias: 0.55,           // 0..1, how much of the burst is aimed upward
  gravity: 420,           // px/s^2 pulling coins back down to the board
  drag: 0.6,              // horizontal air drag (lower than the 2.2 sparks use)
  landSpreadTiles: 0.45,  // how far below the death point a coin may settle
  // --- look ---
  color: "#ffe24a",       // matches --neon-yellow / the CREDITS HUD color
  rimColor: "#fff6c0",    // bright rim so the coin reads as metal
  size: [2.6, 4.2],       // coin radius in px
  spin: [6, 13],          // flip speed, rad/s (drawn as a horizontal squash)
  glowMult: 2.6,          // glow sprite radius as a multiple of coin size
  // --- lifetime ---
  flightTtl: [0.55, 0.9], // arc time before landing
  restTtl: [0.7, 1.3],    // how long a landed coin lies there before fading
},
```

### 1b. `particles.js` — `emitCoins(game, x, y, count, speedMult = 1)`

New exported emitter next to `emitLevelUpSplash`. Follow that file's existing
style exactly (`rand()` helper, `push()` for the cap).

- Emit `count` particles of a **new** `kind: "coin"`.
- Angle: full circle but biased upward — e.g. pick `a` in `[0, 2π)`, then
  blend its vertical component toward -1 by `upBias`, so the spray fountains
  up and rains down rather than firing sideways.
- Fields: `x, y, vx, vy, size, color, rot` (start random), `spin`
  (`±rand(spin)` so some flip each way), `landY = y + rand(0,
  landSpreadTiles) * tileSize`, `landed = false`, `ttl` from `flightTtl`,
  `maxTtl` matching.
- `speedMult` multiplies the initial speed (bosses pass `bossSpeedMult`).
- `emitCoins` needs `tileSize`; pass it in from the caller rather than
  importing grid state.

### 1c. `particles.js` — coin physics in `updateParticles`

`updateParticles` currently applies one uniform `drag = 2.2` to everything.
Branch it: keep today's behaviour for `spark`/`shard`, and for `kind ===
"coin"`:

- while `!landed`: `vy += gravity * dt`, apply `drag` to `vx` only,
  integrate, spin. When `p.y >= p.landY` **and** `vy > 0`: set `landed =
  true`, zero `vx`/`vy`, snap `y = landY`, reset `ttl`/`maxTtl` from
  `restTtl`, and damp `spin` toward 0 so it settles flat.
- while `landed`: hold position, let `ttl` run out.

Do not change spark/shard behaviour.

### 1d. `renderer.js` — draw the coin

In `drawParticles`, add a `p.kind === "coin"` branch **before** the existing
spark `else`:

- Draw a filled ellipse: full `size` radius vertically, horizontally squashed
  by `Math.abs(Math.cos(p.rot))` so it reads as a spinning disc flipping
  edge-on. Clamp the minimum width to ~15% so it never fully disappears.
- Fill `color`, then stroke a thin `rimColor` arc on top for the metal edge.
- `drawGlow(ctx, p.x, p.y, p.size * glowMult, p.color, life)` for the bloom.
- Alpha: `life` (they fade as ttl runs down), same as the spark branch.
- Landed coins may read slightly dimmer — optional, your call, no new knob.

### 1e. `enemies.js` — hook the death site

In the kill block (the `enemy.alive = false` path, around line 243):

- The money award at line 245 currently discards its value. Capture it:
  `const earned = Math.round(...)` then `game.money += earned`. **Do not
  change the formula.**
- After `const pos = enemyPosition(...)` and `const ts = ...` (~line 271),
  next to the existing `burst` effect and `emitDeathShards` call, emit coins:
  - `const isBoss = enemy.type === "boss";` — note this local is already
    computed a few lines below for the spring shock; reuse it by hoisting the
    existing declaration rather than declaring it twice.
  - count from `perKill` or `bossPerKill`, speed mult `1` or `bossSpeedMult`.
  - `emitCoins(game, pos.x, pos.y, count, mult, ts)`.
- `earned` is not used by Phase 1 beyond being captured — Phase 2 uses it.
  Capturing it now keeps Phase 2 to one file.

### Phase 1 verification

- Game loads with no console errors; a battle runs.
- `window.game.particles.some(p => p.kind === "coin")` is true shortly after
  a kill.
- Coins fall and settle rather than drifting like sparks.
- Boss death produces visibly more coins than a basic kill.

---

## Phase 2 — HUD gold pulse (`config.js`, `ui.js`, `styles.css`)

### 2a. Config

```js
creditGain: {
  hudPulseMs: 420,        // duration of the HUD pulse animation
  hudPulseMinGapMs: 90,   // don't retrigger faster than this (retrigger only)
},
```

### 2b. `ui.js`

`updateHUD` (line ~222) calls `setText(el.money, "money", String(game.money))`.
`setText` already diffs, so the change moment is known.

- Keep a module-local `lastMoney` (initialised `null`).
- In `updateHUD`, **before** the `setText` call, compare `game.money` to
  `lastMoney`. If `lastMoney !== null && game.money > lastMoney`, trigger the
  pulse. Always update `lastMoney` afterwards.
- **Only on increase.** Spending money must not pulse.
- **Not on the first update of a battle** (`lastMoney === null`), or every
  level start would flash. Reset `lastMoney = null` wherever the HUD is
  initialised for a new battle if such a hook exists; if not, the `null` guard
  plus natural first-frame ordering is enough — do not invent a new lifecycle
  hook.
- Trigger = restart a CSS animation on `el.money`: remove the class, force
  reflow (`void el.money.offsetWidth`), re-add it. Clear the class on a
  `hudPulseMs` timer so the node doesn't accumulate state.
- Respect `hudPulseMinGapMs`: if the last trigger was more sooner than that,
  let the running animation continue instead of restarting it (kills strobing
  at x4 speed without suppressing the effect).

### 2c. `styles.css`

Next to `#hud-money .hud-value` (line ~88) add a `.credit-gain` class with a
keyframe animation: the gold text brightens toward white-hot, the existing
`text-shadow` blooms to a much larger gold glow, and a subtle `scale(1.12)`
pop settles back to 1. Use the existing `--neon-yellow` token; do not add new
color literals where a token exists.

Wrap the animation in a `@media (prefers-reduced-motion: reduce)` override
that keeps the brightness change but drops the scale/pulse motion.

### Phase 2 verification

- Killing an enemy visibly pulses the CREDITS value.
- Buying a tower (money goes DOWN) does not pulse.
- Loading into a level does not pulse.
- No layout shift in the HUD row while the pulse plays (the scale must not
  push its neighbours around — use `display:inline-block` on the value if
  needed).

---

## Phase 3 — Gear-drop flash (`config.js`, `renderer.js`, `enemies.js`)

### 3a. Config

```js
gearDrop: {
  ttl: 1.1,             // seconds on screen (speed-compensated)
  riseTiles: 0.7,       // how far it floats up over its life
  sizeTiles: 0.3,       // diamond half-size as a fraction of a tile
  popScale: 1.6,        // scales up from this to 1 in the first ~20% of life
  ringTtl: 0.45,        // expanding rarity ring behind it
  ringRadiusTiles: 0.85,
  glowMult: 2.2,
},
```

### 3b. `renderer.js` — new `gearFlash` effect kind

`drawEffects` (line ~967) already handles `ring`, `burst`, `tileFlash`,
`floatText`. Add `gearFlash`:

- Draw a **diamond** (a square rotated 45°) in the item's rarity color. This
  is deliberate: equipped gear already orbits towers as rarity-colored
  diamonds (`drawTowerGear`), so the same shape reads instantly as "gear".
- Colors come from the **existing** `GEAR_RARITY_COLOR` map at
  `renderer.js:12` — do not add a second copy.
- Motion: pop in from `popScale` to 1 over the first fifth of its life, drift
  up by `riseTiles`, fade out on `life * life` (same easing as `floatText`).
- Add `drawGlow` behind it at `glowMult * size` so rare drops bloom brighter.
- Also push a short expanding `ring` effect in the same rarity color (reuse
  the existing `ring` kind — no new code needed for it).

### 3c. `enemies.js` — hook the drop

The drop already exists at line ~269:
```js
const drop = rollKillDrop(enemy, game.level, game.waveIndex);
if (drop) game.lootDrops.push(drop);
```
`drop.rarity` is one of `common|enhanced|rare|prismatic|singularity`.

Move/extend this so that when `drop` is truthy, a `gearFlash` effect is
pushed at the enemy position with `rarity: drop.rarity`. It must run **after**
`pos`/`ts` are computed. Do not change drop rates or the `lootDrops` push.

### Phase 3 verification

- Force a drop from DevTools and confirm the flash appears at the enemy.
- The flash color matches the item's rarity.
- With no drop, nothing is drawn (the common case must stay clean).

---

## Files touched (whole feature)

```
src/config.js      VFX.coins, VFX.creditGain, VFX.gearDrop
src/particles.js   emitCoins + coin branch in updateParticles
src/renderer.js    coin branch in drawParticles, gearFlash in drawEffects
src/enemies.js     capture `earned`, emit coins, push gearFlash
src/ui.js          money-increase detection + pulse trigger
styles.css         .credit-gain keyframes (+ reduced-motion override)
```

Nothing else. No `save.js`, no `progression.js`, no `version.js`, no git.

---

# As built (2026-08-19, builds `2026.08.19-8` .. `-13`)

All four deliverables shipped. What follows is the record of what actually
landed and — more usefully — what the plan got wrong.

## Delivery

- **`-8`** — Phases 1–3 as specced: coins, HUD pulse, gear-drop flash.
- **`-9`** — gear flash redrawn as the item's **slot glyph** (player: the
  diamond didn't say *what* dropped).
- **`-10`** — gear flash became an **event**: the item appears as its own
  stash tile, lifts, then **zips into Indy-7 and is swallowed**; Indy grins
  after (player: "not that satisfying").
- **`-11`/`-12`/`-13`** — First-Mastery card's gear showcase: rarity-name
  overflow reported from a phone, fixed by removing the names (see below).

## Corrections to this plan — read before trusting it

1. **Coin `ttl` must NOT tick while airborne.** Phase 1 as written had coins
   fading during their arc, and a near-vertical throw could outlive its fade
   and vanish mid-air (~2% of coins). Airborne time now burns a separate
   `flight` budget; `ttl`/`maxTtl` are seeded from `restTtl` so `life` is 1
   for the whole arc. The plan's §1b/§1c are wrong on this point.
2. **`enemies.js` must not import from `renderer.js`.** The first Phase 3
   implementation imported `GEAR_RARITY_COLOR` to color the ring — but
   `renderer.js` already imports `enemyPosition` from `enemies.js`, so that
   closed a cycle. Only `rarity` + `slot` travel on the effect now, and the
   renderer draws the ring itself.
3. **The HUD tracker needs a per-battle reset.** `lastMoney` as a module
   local persists across battles, so starting a level richer than the last
   one ended fired a spurious pulse. Fixed by comparing `game` object
   identity (no new lifecycle hook needed).
4. **`display:inline-block` on the HUD value was a no-op** — `#hud-money` is
   a flex container, so the item is blockified. Transforms never affect
   layout anyway; the declaration was removed.

## Gear showcase: why there are no rarity names

The showcase on the First-Mastery card (`ui.js renderGearShowcase`) shows the
slot glyph + stat only. The full ladder was tried and rejected:

| Build | Attempt | Outcome |
|---|---|---|
| `-10` | 11px names, equal tiles | spilled outside the borders on a phone |
| `-11` | content-sized tiles | text fit, but ragged widths rejected |
| `-12` | 8px names, equal tiles | fit, but crowded the tile edges |
| `-13` | **no names** | shipped |

The card's column is ~278px, so an equal-width tile allows ~56px of text and
"SINGULARITY" needs 78px at 11px. **Tiles must stay equal width.** Rarity is
carried by the border/glow color and by the card's body text.

**Measurement lesson:** `-12` measured as fitting in the desktop browser with
~2px of slack and still overflowed on a real iPhone. Slack smaller than the
font-metric difference between engines is not a fit. Measure with real margin
or don't rely on the measurement.

## Verification actually performed

State/DOM assertions only, per the project's no-canvas-capture rule — **none
of the visuals have been eyeballed on a phone**:

- 121-kill battle: coins spawn on kills, land, settle, and clean up; 400-coin
  physics run lost zero coins mid-air; boss bursts are visibly larger by count.
- HUD pulse fires on gain, not on spend, not on the first frame of a battle;
  resolves to a real `creditGainPulse` animation at 0.42s.
- 23 forced drops: all four slot glyphs rendered; 12 drops → 12 ingest stamps
  → `coreFaceMood` observed returning `happy` (and `crash` on leaks, so the
  priority order holds).
- Showcase: tiles equal and no child overflowing at 514/393/320px viewports.

Open: **density is deliberately generous** — the player asked to tune after
seeing it, not to pre-optimize for clutter. Coin counts, the gear-flash
timing (`riseSeconds`/`zipSeconds`), and `smileSeconds` are the likely dials.
