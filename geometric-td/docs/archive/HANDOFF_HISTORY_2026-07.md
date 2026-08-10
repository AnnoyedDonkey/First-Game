# Geometric TD — Handoff History Archive (July 2026)

This is the concise archive for completed work removed from `HANDOFF.md` on
2026-07-18. The complete pre-cleanup handoff remains available in Git at
commit `2650204`.

## Completed feature groups

- **Loot P0-P7:** contributor-weighted XP, persistent mastery, shards, item
  generation, gear slots/rarities/affixes, drops/stash/triage, store unlocks,
  gear comparison, and in-battle gear visuals. Later B1/B6 superseded the old
  P7 balance direction.
- **Circuit menu M0-M4:** world-paged SVG circuit board, level sheets,
  mobile layout polish, and map circuit decoration.
- **Result/counter pass:** end-of-battle redesign, damage types with clear
  resisted/super-effective feedback, Railgun/Rocket, world maps, Endless,
  leaderboard, update nudge, and forfeiting.
- **B1-B6 (all complete):** shard/drop rebalance; store rarity unlocks;
  branching skill tree with tower-cap, interest, shard-find, and railgun
  penetration skills; tower gear visuals and comparison; campaign milestones
  and recap; first progression/loot tuning pass.

## Telemetry and tuning history

### T1-T4 — 2026-07-16, deployed as `2026.07.16-1`

Source: 43 telemetry rows from one player, with 19/26 ratings `too_easy` and
zero `too_hard`. L3/L7/L8 provided the desirable lose-then-improve shape;
World 3 was consistently too easy with 1.5k-5.1k money left.

- **T1:** Railgun base cost 100→140 and upgrade multiplier 1.3; Rocket
  upgrade multiplier 1.4.
- **T2:** hardened L2/L7 boss waves; made L5 punish a mono-laser wall;
  increased L6 railgun relevance. Mixed L5 builds still won.
- **T3:** increased World 3 waves and added `level.bountyMult` (0.75) to cut
  late-game cash. Wave 1 remained untouched.
- **T4:** added the one-time, five-step L1 tutorial after a new player read
  blocked-tile markers as tower sockets.

### H1-H4 — 2026-07-17, deployed as `2026.07.17-1`

Source: 25 new-version rows from one player; 15/18 ratings were `too_easy`,
none `too_hard`. Pulse appeared in 13/15 winning campaign builds and was
usually the highest-invested tower. The user explicitly requested an
almost-overdone hard pass.

- **H1 Pulse:** fire rate 1.1→0.78, range 1.6→1.35, base cost 75→105,
  splash specialty growth 0.16→0.12. Upgrade multiplier remained 1.6.
- **H2 World 1:** L1 boss-only small increase; L2-L5 substantial wave-health
  pressure and `bountyMult` on L3-L5. A powerful L5 wall reached loss/near-loss
  on all but L1/L2.
- **H3 World 2:** L6-L10 substantial late-wave pressure plus 0.78-0.8 bounty
  multipliers. Boss Pulse resistance eased 0.75→0.85 to avoid double-nerfing.
- **H4 World 3:** added a second aggressive pass on waves 2 onward and lowered
  `bountyMult` from 0.75 to 0.58. Browser simulations could not run in that
  sandbox, so fresh player telemetry is the required follow-up.

## Durable lessons from the completed work

- Preserve the bankroll rule: wave 1 must be survivable with starting money.
- Each isolated balance simulation/trial needs a fresh page reload. Battle-end
  XP, roster state, and module globals can otherwise contaminate results.
- Re-test an implausible simulation result before tuning from it; poor bot
  placement can create false balance failures.
- Back up a test save before seeding and restore it exactly afterward.
- `recordBattleEnd` can mutate progression state during test runs.
- Game deploys can temporarily serve mixed CDN versions. Backfill new save
  fields after load, not just in `DEFAULT_SAVE`.
- Do not verify visual changes with canvas image export; use state/DOM checks
  and the user's iPhone review.
- iCloud can create conflicting files with a ` 2` suffix; sweep before commit.

# August 2026 build history

Relocated from `HANDOFF.md` on 2026-08-09 to keep the working handoff lean.
These are completed, shipped changes; the current HANDOFF keeps only the
still-relevant mechanics, rules, and file map.

## Stash economy sinks & STASH tab controls (builds `2026.08.09-1`..`-8`)

Two Shard sinks were added to `config.js LOOT` + `progression.js`:
- **Stash expansion** — base 100 slots, 10 escalating +20-slot purchases
  (50→4000 Shards), caps at 300. `LOOT.stash`, `getStashCap`/`buyStashUpgrade`.
- **Auto-junk** — 4 sequential per-rarity tiers (Common 500 / Enhanced 750 /
  Rare 1000 / Prismatic 1500 Shards; Singularity is never junkable).
  `LOOT.autoJunk`, `autoJunkMaxRarity`/`buyAutoJunkTier`. Ownership and
  activation are separate, and — after two feedback rounds — activation is
  **per rarity**: `ownedAutoJunkRarities()`, `isAutoJunkRarityEnabled`/
  `setAutoJunkRarityEnabled`, save field `autoJunkPaused`. The internal
  `shouldAutoJunk(rarity)` (owned AND not paused) is what `bankEarnedItem`
  checks, AFTER the auto-equip attempt fails (so a still-useful Common can
  equip first). Placement dest `"junked"` flows through the drop-reveal card
  ("→ AUTO-SOLD ◆n") and a dimmed `.junked-tile` on the results screen. New
  save fields `stashUpgrades`/`autoJunkTier`/`autoJunkPaused` (save.js default
  + progression.js backfill). A one-build global `autoJunkEnabled` toggle was
  migrated into the per-rarity field, then dropped.

STASH tab controls (`ui.js renderStashTab`, `.gear-mini-action`): a row of
three distinctly-colored pills — **FILTER** (cyan) / **SELL** (yellow) /
**CONFIG** (magenta) — below the item count. FILTER hides the nine
OPTIC/EMITTER/…/SINGULARITY filter chips behind a toggle that shows an
active-filter count (`FILTER (1) ▾`); SELL opens a compact bulk-sell sheet
(`openBulkSellSheet`); CONFIG opens the STASH SETTINGS sheet
(`openStashSettingsSheet`). Landed after two rounds of phone feedback —
earlier passes tried a bare 26px `⚙` icon, a `STASH n/cap` header text link,
always-visible per-rarity sell pills, and a horizontally-scrolling chip row,
all since replaced.

## Game-wide contrast fix (`2026.08.09-7`)

`styles.css --text-dim` (the secondary/label color, 69 uses across the
stylesheet) was `#5a668f` (~3.4:1 against `--panel`/`--bg`, under WCAG AA) at
9–11px text. Brightened to `#b9c2e8` (~11:1) while staying below the near-white
primary `--text` (`#cdd6ff`, ~13.4:1) so the primary/secondary hierarchy
survives. One variable, whole UI.

## Prior state — 2026-07-23 (skill trees, gear QoL, difficulty walk-back)

Geometric TD was then a portrait, mobile-browser tower defense with a 15-level,
three-world campaign; five tower classes; seven enemy types; RPG roster and
mastery progression; skills; loot/equipment; campaign challenges; Endless;
telemetry; and a GitHub Pages deployment. Deployed build `2026.07.23-5`.

- Builds `2026.07.23-1`..`-5` gave every tower a third skill-tree branch and
  reworked the tree's box art. `TOWER_THIRD_BRANCH` (`config.js`) is a data
  table for all five towers: Over-Penetration (Railgun), Slow Potency (+% slow
  amount; the `slow_dmg` chain separately covers +% slow *duration*), Rapid
  Fire (Laser, +% fire rate), Blast Radius (Pulse) and Payload Yield (Rocket) —
  the latter two both raise splash radius via independent `tower.type`-gated
  multipliers over the shared `def.splashRadius` path in `towers.js`. Each perk
  is a one-line `getXMult()` in `progression.js`. Every chain box now renders a
  themed icon (`skillIconBody` in `ui.js`).
- Builds `2026.07.21-8`..`-10` added gear/skill QoL: equipped gear replaceable
  through the compatible-picker + COMPARE flow; tappable gear-trait
  descriptions; the Store sells permanent Skill Points (50/100/+100-to-1000
  Shard curve, save-backed at `store.skillPointPurchases`); free skill-tree
  branch heads (prior purchases refunded); five-box branch costs 1/1/1/2/2;
  Railgun Over-Penetration a five-box third branch. Slow career sheets show
  computed Slow Amount and Slow Duration.
- Baseline was the aggressive H1-H4 hard-mode pass (`2650204`,
  `2026.07.17-1`): a Pulse nerf plus World 1-3 wave/economy hardening. Player
  feedback then reported the campaign was too hard, walked back world by world:
  - **World 1** softened in two steps — `2026.07.18-1` (L2) and `2026.07.19-1`
    (L3-L5, `healthMult` only). L3 fixed a severe overshoot (total wave HP
    274k→38k); World 1 now ramps ~20k/34k/38k/54k/83k across L1-L5.
  - **World 2** rescaled `2026.07.19-3`..`-9` (L6-L10): full wave-curve
    rebalances plus economy and regenerator-intro fixes. Telemetry confirmed
    L9/L10 now rate `just_right`.
- **World 3** had two balance passes. The first (`2026.07.21-1`) landed L13 at
  `just_right`. The second (`2026.07.21-7`, via `balance-data.json`) targeted
  `-6` telemetry: L11 back half (waves 6-10) HP +~10% weighted, openers
  untouched; L12/L14 waves 1-2 softened ~33% (openers only, waves 3-10 as-is);
  L13 untouched; L15 hardened ~+21% weighted with more bodies from wave 5 and a
  12-wave finale gauntlet (6 bosses + heavier armored/regen/fast). `bountyMult`
  unchanged. Open questions the `-6` sample raised: World 2 front (L6/L7
  `too_easy`) and L4 (rated `too_hard`).
- Builds `2026.07.21-2`..`-5` were UI/UX fixes (no balance change): first-play
  tutorial polish (banner/SKIP overlap, placement flashing past the
  blocked-tile step, instructions above the dimming veil), the TOWERS & GEAR
  GUIDE reworded + mouse-wheel scrollable, and the skill tree opening scrolled
  to the leftmost (Laser) branch. Tutorial state machine is `src/tutorial.js`;
  copy + enable switch in `config.js TUTORIAL`.
- The Balance Lab (L0-L7) was completed as local-only tooling in this window;
  its current status lives in the working HANDOFF's constraints and
  `BALANCE_LAB_PLAN.md`/`BALANCE_LAB_USAGE.md`.
