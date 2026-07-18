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
