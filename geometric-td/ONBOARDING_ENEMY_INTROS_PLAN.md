# Enemy intros — pause-and-tap rebuild (build spec, NOT YET BUILT)

Status: **copy approved by the user (2026-08-10); delivery mechanism decided;
implementation deferred to a future session.** Do not build from this file
without re-confirming the copy is still current (check for any balance
changes to `ENEMIES[type].damageMult` in `balance-data.json` since this was
written — see §2's traceability table).

## 1. Why this exists

Enemy-type intros already ship (`config.js NARRATIVE.enemyIntros`, fired once
per type from `main.js updateBarks` via `ui.js showBark("indy", ...)` onto the
non-blocking `#bark-ticker`). User feedback (2026-08-10) on that delivery:
1. **Hard to read while also fighting** — the ticker is a passing banner; you
   can't read it and place towers / react to the wave at the same time.
2. **Too long** — the current lines are flavor-heavy prose.
3. **Missing the actually-useful info** — no explicit vulnerability/resistance
   callout, which is the whole reason to introduce an enemy.

Two delivery options were discussed: (A) keep them contextual — first
appearance of each type, but as a **pause-and-tap card** — or (B) batch all
enemy intros into a card sequence between levels 2 and 3 (like "Meet the
Squad"). **Decision: (A).** Enemies debut at different points across the
campaign (Basic/Fast in World 1, Armored mid-World-1, Boss/Splitter/
Regenerator only in World 2+); batching them at L2→L3 would front-load
enemies the player won't face for several levels, and they'd be forgotten by
the time they matter. Teaching each enemy the moment it appears is the right
shape — the ticket is fixing the READING problem, not the WHEN.

## 2. Approved copy (verbatim), with sourced weak/resist tags

Keeps the current conversational intro-style sentence, trimmed, plus an
explicit tag line in the user's own format ("Weak to X. Resists Y, Z."). Tags
were cross-checked against `balance-data.json`'s `ENEMIES[type].damageMult`
(not guessed) — see the traceability table below. Damage-type → tower mapping
(`balance-data.json BALANCE.towers[*].damageType`): `energy`=Laser,
`pulse`=Pulse, `control`=Slow, `rail`=Railgun, `blast`=Rocket.

```js
enemyIntros: {
  basic: "Basic units — the little triangles. Bratwurst-XL's entry-level interns. Anything you build stops them. Good warm-up.\n\nNo resistances or weaknesses — anything works.",
  fast: "Incoming Fast — twitchy little diamonds. They rush the gaps.\n\nWeak to Laser. Resists Rocket, Pulse.",
  armored: "Armored hexes — plated and smug.\n\nWeak to Pulse, Railgun. Resists Laser, Slow.",
  boss: "That octagon's a Boss — a big lonely slab of HP.\n\nWeak to Rocket, Railgun. Resists Slow, Pulse.",
  splitter: "Orange squares are Splitters — pop one and it becomes two.\n\nWeak to Pulse, Rocket. Resists Railgun.",
  regenerator: "Regenerators — the green pentagons. They heal faster than steady chip damage can hurt them.\n\nWeak to Railgun. Resists Laser.",
},
```

(`\n\n` renders as a paragraph break via the card's `white-space: pre-line`,
same as other story copy — puts the tag on its own line.)

**Traceability** (re-verify before building if balance has changed):

| Type | `damageMult` (balance-data.json) | Weak to (>1) | Resists (<1) |
|---|---|---|---|
| basic | *(none — neutral)* | — | — |
| fast | `blast:0.6, energy:1.3, pulse:0.7` | Laser | Rocket, Pulse |
| armored | `control:0.5, energy:0.4, pulse:1.2, rail:1.6` | Pulse, Railgun | Laser, Slow |
| boss | `blast:1.3, control:0.4, pulse:0.85, rail:1.2` | Rocket, Railgun | Slow, Pulse |
| splitter | `blast:1.4, pulse:1.5, rail:0.6` | Pulse, Rocket | Railgun |
| regenerator | `energy:0.45, rail:1.6` | Railgun | Laser |

(`splitling`, the child spawned by a Splitter's death, has no intro — same as
today; it's not a type the player targets independently.)

## 3. Delivery mechanism to build

**Move ONLY enemy-type intros off the ticker onto a pause-and-tap card.**
Boss taunts (`bratwurstBarks`/`indyRoasts`) and tower placement barks
(`towerBarks`) are working well on the non-blocking `#bark-ticker` per
existing user feedback — leave those exactly as they are.

The pattern to reuse: **freeze steps**, same mechanism as the tutorial's
`welcome`/`blockedTile`/`credits`/`coreHealth` steps
(`src/tutorial.js FREEZE_STEP_IDS`, `main.js` checking a freeze predicate to
skip `updateGame` for that frame) and the card overlay itself
(`src/onboarding.js playCards`, `ui.js renderOnboardingCard`, `#story-overlay`
markup). Concretely:

1. **Pause the sim while the card is up.** `main.js`'s game loop currently
   skips `updateGame` when `tutorial.isTutorialFreezing()` is true (mirrors
   the existing exit-confirm freeze). Add an equivalent freeze check for "an
   enemy-intro card is active" — either extend `tutorial.js`'s freeze concept
   to be speaker-agnostic, or add a small parallel flag
   (`isEnemyIntroActive()`) that the frame loop also checks. Simplest: reuse
   `onboarding.js`'s `isOnboardingActive()` as an ADDITIONAL freeze condition
   in the main loop (it's already the generic card player) — i.e. whenever
   `playCards` is driving a card mid-battle, freeze `updateGame` for that
   frame, tap-anywhere/CTA to advance like the tutorial's modal steps.
   Caution: onboarding.js today is only used pre-battle/post-battle-adjacent
   (intro, squad, START cards) where freezing doesn't matter because the sim
   isn't running yet. This is the first time a card would need to pause a
   LIVE battle — verify carefully that resuming afterward doesn't skip a
   large `dt` (the tutorial's existing freeze pattern already solves this;
   copy its approach, don't invent a new one).
2. **Trigger:** in `main.js updateBarks`, when
   `shouldShowEnemyIntro(e.type)` is true for a newly-seen type, instead of
   `showBark("indy", NARRATIVE.enemyIntros[e.type])`, call
   `markEnemyIntroSeen(e.type)` and `playCards([{ text: NARRATIVE.enemyIntros[e.type], speaker: "indy", cta: "TAP TO CONTINUE" }])` — reusing the SAME card overlay component (with Indy's avatar) already used for story beats. Still gated by `getBarksEnabled()` (the STORY BANTER toggle) — turning banter off should skip these too.
3. **Multiple new types in one frame:** if two new enemy types spawn the same
   frame (rare but possible on a busy wave), queue their cards sequentially —
   `playCards` already plays a list in order; either batch both into one
   `playCards` call or make sure a second `updateBarks` call while a card is
   still active doesn't stomp the first (check `isOnboardingActive()` before
   triggering a new one, defer to next frame if busy).
4. **Visual (optional, nice-to-have):** the enemy's own shape drawn small
   next to Indy's avatar (matching its renderer color/shape from
   `ENEMY_PRESENTATION` — triangle/diamond/hexagon/octagon/square/pentagon)
   would reinforce "this is what I'm describing." Not required for v1; the
   text alone (with the enemy name in the first line) is enough to identify
   it since it just appeared on screen.
5. **No new save fields** — `seenEnemyIntros`/`shouldShowEnemyIntro`/
   `markEnemyIntroSeen` (progression.js) already exist and gate this
   correctly (once ever per type, veterans backfilled). Reuse as-is.

## 4. Verification checklist (for whoever builds this)

- Pausing/resuming mid-battle doesn't cause a large-`dt` jump on resume (core
  shouldn't take a leak or towers fire on stale cooldowns from the frozen
  interval).
- Card shows Indy's avatar + nameplate (green), the enemy's name, and the
  weak/resist tag on its own line.
- Tap-to-continue resumes the exact same battle state (enemies mid-path don't
  teleport; wave timer doesn't lose the paused duration).
- STORY BANTER off → no enemy-intro card at all (same as today's ticker gate).
- Once-per-type-ever gating still holds (replaying a level doesn't re-show).
- Boss taunts and tower barks are UNCHANGED (still on the ticker, not moved).
- No console errors; verify via DOM/state assertions per HANDOFF's testing
  recipe (no canvas capture).

## 5. Other loose threads from this session (not enemy-intro related, tracked here so nothing is lost)

- **P5 remainder:** a gear/mastery-rules card at the L2→L3 seam (Indy-7
  voiced — the useful half of the old auto-guide that "Meet the Squad" didn't
  carry over). Copy drafted in `NARRATIVE_DESIGN.md` §8. Not yet built.
- **Queued:** an end-of-L1 walkthrough for assigning the player's first skill
  point (they earn +1 per level won). Not yet spec'd.
- **Known minor issue:** story copy uses `*emphasis*` markdown in a few lines
  (e.g. "I used to *do* something") but `ui.js storyCardHtml` does not parse
  markdown — asterisks render literally in-game. Not yet reported by the
  player as a bug; optional cleanup (strip asterisks from copy, or add simple
  emphasis parsing to `storyCardHtml`).
