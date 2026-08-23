# Co-op Multiplayer Plan

Two players, one board, building together against endless waves.

**Status: DESIGN ONLY — build not started, not approved.** Written 2026-08-22,
revised through four ideation rounds the same day (mode/lobby, mechanics,
HUD). Read `HANDOFF.md` first. This file is the single source for co-op
work; each phase is written to be cold-read by a delegated agent.

⚠️ **Section 12 (Open questions) is deliberately unresolved.** Do not pick
answers for it unilaterally.

---

## 1. The mode in one paragraph

Co-op is **its own mode**, not a co-op layer over the campaign. A CO-OP button
at the bottom of the main menu opens a session browser. A player hosts a
session (public = listed, private = code required) and picks one of their
**cleared** campaign levels, which is played in **Endless** mode; the session
is **auto-named**, never typed. The host starts playing immediately and alone;
a second player can **drop in at any wave**. Both players build from their own
rosters, both earn the full bounty on every kill, either can upgrade any tower,
and only the owner can sell their own. v1 ships **2 players**, with the schema
and protocol designed for **up to 4**.

---

## 2. Decisions locked with the player

### Round 1 (2026-08-22)

| Decision | Choice | Consequence |
|---|---|---|
| **Wallets** | **Separate wallets, FULL bounty to each player** | Every kill pays the full bounty to *both* players. Each player's own `getMoneyMult()` applies to their own wallet only. |
| **Simulation** | **Host-authoritative** | The host runs the real `updateGame`; the guest sends intents and renders snapshots. Desync is impossible by construction. |
| **Ownership** | Place from your own roster; **anyone** may upgrade **any** tower; **only the owner** may sell theirs | The player's stated rule. |
| **Transport** | **WebRTC DataChannel, peer-to-peer** | The only browser transport that can do this at all. |
| **Signaling** | **The existing Supabase project** | Same project as the leaderboard/telemetry (`config.js LEADERBOARD.url`). No new account. |

### Round 2 (2026-08-22, this pass)

| Decision | Choice | Consequence |
|---|---|---|
| **Mode** | **Its own mode, Endless only** | Deletes the entire co-op balance problem — see §3. |
| **Level choice** | Host picks any level they have **cleared** | Endless is gated on clearing, not unlocking (`ui.js:890`). |
| **Lobby** | Session browser with **public (listed)** and **private (code)** sessions | One `listed` boolean on the same row; supporting both is nearly free. |
| **Start** | **Host starts alone; guest drops in at any wave** | Strictly dominates "wait for a player" — a host who wants to wait simply waits. |
| **Reach** | **Free public STUN now; Cloudflare TURN committed as Phase 5** | Public browsing genuinely works (~80–85% of network pairs). The LAN-only constraint from round 1 is **superseded**. |
| **Drop-in economy** | **Share of the host's TOTAL EARNED** (not current balance) | See §3 — the share has an exact meaning, which makes it tunable rather than guesswork. |
| **Board space** | **No restriction on the host; the lobby row shows free buildable tiles** | Joiners self-select away from full boards. |

### Round 3 (2026-08-22, mechanics pass)

| Decision | Choice | Consequence |
|---|---|---|
| **Session naming** | **Auto-generated — the player cannot type a session name** | Closes the public-lobby free-text surface. See §9.2 for what the generated name is made of. |
| **Player count** | **Ship 2; host picks 2–4 later** | **Design the schema and protocol for 4 NOW, ship the UI for 2.** `max_players` in the session row from day one — cheap now, painful to retrofit. |
| **Leaderboard** | **v1 posts nothing.** Co-op never writes `endlessBest` or the solo board. A separate co-op board comes later | Prevents permanent, unfixable pollution of a live shared board. Store `coopBest` as its own save field. |
| **Rewards** | **Full rewards to both players** — milestone loot, shards, roster XP | Accepted risk: co-op becomes the most efficient way to farm. Revisit only if it distorts solo play. |
| **Kick / terminate** | **Later, not v1** | Host-authoritative makes both trivial to add; noted in §9.6 so the protocol leaves room. |
| **Co-op conduits** | **Later** — parked in §13 | Liked, but not v1. |
| **Shared overcharge meter** | **Wanted** — parked in §13 as the lead identity feature | Reuses the shipped level-up surge almost wholesale. |

### Round 4 (2026-08-22, HUD pass)

| Decision | Choice | Consequence |
|---|---|---|
| **Credits visibility** | **Own wallet only.** A player never sees another player's CREDITS | Scales to 4 players with no HUD redesign — this is what closed the "HUD doesn't scale" open question. |
| **Presence** | **A connected-players indicator replaces SKILLS + the speed controls** | Players must be able to see someone joined and, more importantly, that someone *left*. See §9a. |
| **SKILLS button** | **Removed in co-op — skills are LOCKED at join** | Not just space: this is what keeps the Phase 4 join payload valid (see §10.1). |
| **Speed controls** | **Removed entirely in co-op — no x0.5, no x2, no pause, for anyone** | Deletes the clock-divergence landmine from §8. Both players get an identical HUD. Accepted cost: long Endless runs play at 1x. |
| **Exit (✕)** | **Stays for everyone** | Guest ✕ = leave session. Host ✕ = end session. |

---

## 3. Why these choices work (the two non-obvious wins)

**Endless deletes the balance problem.** The previous revision of this plan
carried a whole phase to stop two rosters from trivializing levels tuned for
one, with a `COOP.difficulty` block and a real tuning pass. Endless has no win
condition to trivialize: two players simply push the wave counter higher before
they die. **The endless ramp IS the co-op difficulty scaling.** No retune, and
zero risk of disturbing single-player balance while chasing it. That phase is
deleted, not deferred.

**Full-bounty-to-each gives the drop-in grant an exact meaning.** Because every
kill pays both players in full, the host's **total earned** is precisely what a
second player *would have* earned had they been present since wave 1. So:

```
grant = COOP.dropIn.earningsShare × hostTotalEarned   (capped by maxGrant)
```

`earningsShare: 1.0` = full retroactive credit, no penalty for joining late.
`0.6` = joining late costs you something. It is a knob with a meaning rather
than a number to guess at.

**Use total earned, NOT the host's current balance.** Balance rewards a
hoarding host and punishes one who invested well — they would read as "poor" at
wave 40 despite a rich session. Total earned is spending-independent.
**`game.totalEarned[ownerId]` does not exist yet** and must be accumulated at
the bounty site (`enemies.js:251`).

---

## 4. Architecture

```
   HOST DEVICE                              GUEST DEVICE
   ───────────                              ────────────
   real updateGame()  <-- intents --------  UI taps (place/upgrade/sell)
   authoritative state
   game.wallets[hostId]                     game.wallets[guestId] (mirrored)
          |                                        ^
          +-- snapshots (10Hz) --------------------+
          +-- events (reliable) -------------------+   towerFired, kill,
          |                                            waveStart, gearDrop,
          +-- heartbeat (10s) --> Supabase lobby row   playerJoined/Left
```

- **Two data channels.** `cmd` — ordered + reliable, for intents, events, and
  the join/battle-end handshakes. `state` — unordered + `maxRetransmits: 0`,
  for the snapshot stream (a dropped snapshot must never delay the next).
- **The guest never simulates.** It renders the last snapshot with
  extrapolation and runs its own cosmetic layer.
- **Drop-in is nearly free in this model** — a joiner just starts receiving
  snapshots. (Under lockstep it would have needed full state transfer and a
  deterministic resume. Another point for host-authoritative.)
- **No host migration in v1.** Host drops → the session ends.

### New files
```
src/net.js          transport: RTCPeerConnection, ICE config, the two channels,
                    connection state machine, send/recv
src/lobby.js        session directory: create/list/join/heartbeat against
                    Supabase, room codes, public/private, stale-row filtering
src/coop.js         game-layer protocol: intent encode/apply, snapshot
                    build/apply, event fan-out, join + drop-in handshakes
```
All tunables (snapshot rate, timeouts, room-code length, interpolation window,
heartbeat interval, `dropIn.earningsShare` / `maxGrant`) go in a new `COOP`
block in `config.js` — nothing hardcoded in logic, per the cardinal rule.

---

## 5. What makes this cheap (survey facts, 2026-08-22)

Load-bearing discoveries. Re-verify before trusting them.

- **Enemies are one-dimensional.** `enemies.js:32` — position is `e.distance`
  along the path; `grid.positionOnPath(dist)` gives x/y. An enemy syncs in
  ~10 bytes and the guest **extrapolates** between snapshots. Even ~370
  concurrent enemies is ~4KB/snapshot — trivial.
- **Projectiles, particles, and effects never cross the wire.** The guest
  spawns its own from `towerFired` events. Pure presentation.
- **Player intent has exactly three chokepoints** — `main.js:247`
  (`placeTower`), `main.js:214` (`tryUpgradeTower`), `main.js:219`
  (`sellTower`). That is the entire input surface to intercept.
- **`game.money` is mutated at exactly 5 sites** — `enemies.js:251` (bounty),
  `game.js:196` (wave interest), `towers.js:269` (upgrade), `towers.js:298`
  (placement), `towers.js:328` (sell refund).
- **Endless already works per level.** `startLevel(level, endless)`
  (`main.js:88`) → `createGame(level, tileSize, true)` → `generateEndlessWave`
  (`endless.js`), which is **deterministic, no RNG**. Per-level `endlessBest`
  already exists. Co-op needs no new wave code.
- **The menu button has a home.** `#menu-actions` (`index.html:172`) is
  already "account-wide entries, pinned below the scrolling level list."
- **Endless is gated on CLEARED, not unlocked** — `ui.js:890` disables the
  button unless `cleared`.

### Why not lockstep
The frame loop is **variable-`dt` rAF** (`main.js:712`) and `Math.random` is
called directly in `enemies.js:293`, `particles.js` (6 sites), and
`towers.js:572,598`. Bit-exact determinism would be a real refactor, and any
residual float drift desyncs with no recovery. Host-authoritative needs none
of it — and drop-in would have been painful under lockstep.

### Why not a LAN WebSocket server on the PC
GitHub Pages serves over HTTPS, and an HTTPS page is blocked from opening
`ws://` to a LAN box (mixed content). WebRTC is specifically **exempt** from
the mixed-content rule.

---

## 6. Phase 0 — Connection spike (throwaway; de-risks everything)

**Goal:** prove two devices establish a WebRTC DataChannel from the deployed
HTTPS build on iOS Safari. If this fails, every later phase is moot.

1. **Supabase table `coop_sessions`** — document the SQL in
   `SUPABASE_SETUP.md` beside `scores` / `feedback`:
   `code` (PK), `codename`, `listed` (bool), `host_nick`, `level_id`, `wave`,
   `players`, `max_players`, `free_tiles`, `offer`, `answer`, `last_seen`,
   `created_at`. RLS anon insert/select/update, same friendly-not-cheat-proof
   posture as the leaderboard.
   **`max_players` ships in the schema from day one even though v1 is 2-only**
   (round 3) — the lobby needs "2/4" and a full-session filter, and adding a
   column to a live table with rows in it is worse than carrying an unused one.
   There is **no free-text `name` column**, deliberately.
2. **`src/net.js`** — `hostSession()` returns a room code and resolves on
   connect; `joinSession(code)` resolves on connect. Include free public STUN
   in `iceServers` from the start (`COOP.iceServers`).
3. **Throwaway page `coop-spike.html`** (not linked from the menu, same
   posture as `balance-lab.html`) — host/join, connection state, round-trip
   timer.
4. **Verify on real devices** over the deployed HTTPS build: iPhone Safari
   plus a second device, both on the same WiFi *and* on separate networks.

**Deliverable:** measured round-trip time, and a written yes/no for iOS Safari
on-LAN and cross-network. Report honestly if it could not be verified on a
phone.

**Landmines:** ICE gathering must complete (or use trickle) or the offer is
incomplete; iOS Safari wants the connection attempted from a user gesture; the
Supabase project **auto-pauses after ~7 idle days** and takes signaling with
it (`HANDOFF.md` → "Ops").

---

### Phase 0 — AS BUILT (2026-08-22, delegated to Codex)

Code complete; **the two-device verification that is Phase 0's actual
deliverable has NOT happened yet.** What exists:

- **`src/net.js`** (532 lines) — `hostSession()` / `joinSession(code)` /
  `sendMessage` / `closeSession`, an 8-state connection machine
  (`idle → signaling → waiting-for-peer → connected`, plus
  `disconnected/failed/closed`), `onConnectionState()` + `onMessage()`
  subscriptions, and abort-aware timeout cleanup. Channels are exactly as
  specified: `cmd` `{ordered:true}`, `state` `{ordered:false,
  maxRetransmits:0}`. ICE gathering is awaited to completion before the SDP
  is published.
- **`config.js COOP`** — `iceServers` (Cloudflare + Google public STUN),
  `table`, `roomCodeLength`, `roomCodeAlphabet`, `signalingPollMs`,
  `connectTimeoutMs`, `sessionTtlMs`. Supabase credentials are **reused** from
  `LEADERBOARD.url` / `.anonKey`, not duplicated.
- **`coop-spike.html`** — throwaway, unlinked: HOST / JOIN / state readout /
  auto + manual `cmd` ping-pong RTT / CLOSE.
- **`SUPABASE_SETUP.md`** — the `coop_sessions` DDL + RLS, including
  `max_players` (shipped early on purpose, round 3).

**Room codes are 6 characters, not 4** — a 32-glyph alphabet with the
ambiguous I/O/0/1 removed, so ~1.1e9 combinations. It is a knob
(`COOP.roomCodeLength`) if 4 reads better on a phone.

**Two convention fixes were applied on review**, both cardinal-rule issues:
the table name was a hardcoded `const` in `net.js` (now `COOP.table`, matching
`LEADERBOARD.table` / `FEEDBACK.table`), and the `COOP` block shipped with no
explanatory comments unlike every block around it.

**The `coop_sessions` table was applied to the live Supabase project**
(`rzwyqvjpjypmiodoojjb`) on 2026-08-22, exactly as documented. Purely
additive — `scores` (25 rows) and `feedback` (1058 rows) untouched.

**VERIFIED end-to-end in a real browser** (two tabs, host + guest, against the
live Supabase signaling path — none of this was possible for Codex, which has
no browser):

- Spike page loads with **zero console errors**, all five controls present.
- `net.js` + `config.js` parse; all nine exports resolve; `RTCPeerConnection`
  available.
- **Full connection path works.** Host: `idle → signaling → waiting-for-peer`,
  publishing a complete offer to Supabase (confirmed by querying the row).
  Guest: `idle → signaling → connecting → connected`.
- **Both data channels carry traffic both ways.** `cmd` ping/pong round-tripped;
  `state` delivered a snapshot-shaped payload intact.
- **RTT 1.1–2.1 ms** — but this is **loopback on one machine**, a floor, not a
  representative number. Real LAN will be tens of ms.
- The HOST button works (an earlier "it does nothing" reading was a
  browser-automation artifact — a programmatic `click()` hosts correctly).
- **Regression check:** the game's own menu still renders clean after the
  `config.js` edit.
- Test rows were deleted afterwards; the table is empty.

**STILL NOT VERIFIED — this is what remains of Phase 0's deliverable:**
**iOS Safari**, on-LAN and cross-network, from the deployed HTTPS build. Two
physical devices, human-in-the-loop. Loopback proves the protocol; it proves
nothing about Safari's WebRTC or about STUN traversal, which is the actual
risk this phase exists to retire. Timeout and stale-row handling are also
still unexercised.

### ⚠️ Phase 0 finding — iCloud Private Relay breaks peer-to-peer (2026-08-22)

**The single most important thing learned in this phase, and it shapes the
feature — not just the spike.**

A two-device test (iPhone hosting, PC joining) reached `connecting` and then
failed ICE. Reading the published SDP out of `coop_sessions` showed why:

```
phone srflx:  146.75.244.0   (Fastly)
phone srflx:  104.28.55.250  (Cloudflare)
pc    srflx:  96.250.89.177  (the real home IP)
```

The phone reported **two different public IPs from two different STUN
servers**, belonging to **Fastly and Cloudflare** rather than the ISP. That is
the signature of **iCloud Private Relay**, which egresses through exactly those
providers. Consequences:

- Those `srflx` candidates are **proxy addresses that accept no inbound UDP**.
- A **different mapping per destination** is symmetric-NAT behaviour — the one
  case STUN fundamentally cannot solve.
- The only other candidate was an mDNS `.local` host address, and with traffic
  leaving via the relay the peers no longer look co-located.

Both candidate paths were dead before connectivity checks began.

**Per-device fix:** Settings → Wi-Fi → ⓘ on the network → turn off *Limit IP
Address Tracking* (per-network), or the global Private Relay toggle.

**Why this matters beyond the spike:** the player base is **iPhone**, and
Private Relay is on by default for iCloud+ subscribers. **We cannot ask every
player to disable it.** So TURN is not the "~15% of stubborn NATs" nice-to-have
this plan originally assumed (§2, round 2) — for iOS users with Private Relay,
a relay is the **only** path that works. Phase 5 is effectively mandatory for
the real feature, not optional.

**Also confirmed in the same test:** iOS Safari **never** reports
`iceGatheringState === "complete"` — the diagnostics showed `ice gath:
gathering` even after the session failed. The `COOP.iceGatheringTimeoutMs`
fallback is what makes signaling work at all on iOS; without it the guest hangs
forever. Do not remove it. The published offer was verified complete (3
candidates including both srflx), so publishing early did **not** truncate the
candidate list.

### Phase 0 follow-up — row cleanup: DONE (2026-08-22)

The client only *filters* stale rows, so without a sweep every session ever
hosted would accumulate forever. Fixed with both mechanisms (SQL + rationale in
`SUPABASE_SETUP.md` § "Co-op session cleanup"):

- **`pg_cron` sweep every 15 minutes** deleting rows with
  `last_seen < now() - 30 minutes`, via `public.prune_coop_sessions()`. Runs
  server-side whether or not anyone is playing.
- **A delete RLS policy scoped to stale rows only**, so clients can help sweep.
  **The scoping is the security-relevant part:** there is no auth here, so a
  `using (true)` delete policy would let anyone with the public anon key wipe
  every live session in the lobby. Deletes are restricted to already-dead rows.

Verified on apply: a row stamped 40 minutes old was deleted while a fresh row
survived; the `prune-coop-sessions` job is registered and active.

---

## 7. Phase 1 — Ownership + wallets (verifiable with NO networking)

Behind a local `DEBUG.coopLocal` flag that fakes a second player in one
browser, so all of it is testable before any netcode exists.

1. **`ownerId` on towers.** `towers.js createTower` / `placeTower` take an
   owner. Default keeps single-player behaviour byte-identical.
2. **Wallets.** Replace `game.money` with `game.wallets[ownerId]`, keeping
   `game.money` as a **getter alias for the local player's wallet** so the HUD,
   `balance-sim.js`, and the many read sites don't all change at once. Then:
   - `enemies.js:251` — credit **every** wallet the full bounty, each with
     **that player's own** `getMoneyMult()`; also accumulate
     **`game.totalEarned[ownerId]`** (new — drives the drop-in grant, §3).
   - `game.js:196` — wave interest **per wallet** (each player's own rate/cap).
   - `towers.js:269 / :298 / :328` — charge/refund the **acting** player.
3. **Permissions.** `sellTower` rejects a non-owner; `tryUpgradeTower` allows
   anyone but charges the caller. Use the existing `{ok, reason}` shape so the
   UI can explain a refusal.
4. **Roster deployment.** `takeRosterUnit` reads the local save today; under
   co-op it must resolve against **the owning player's** roster (mirrored on
   the host — Phase 4).
5. **UI.** Ownership tint/badge on towers, both players' CREDITS in the HUD,
   sell disabled with a reason on the other player's towers.

**Verify:** single-player unchanged (money, placement, refunds, Balance Lab
sims still run); with the flag on, two wallets diverge correctly, `totalEarned`
tracks both, and the sell gate holds.

---

## 8. Phase 2 — Netcode + drop-in

1. **Intent path.** The three `main.js` chokepoints become: local player →
   `coop.js sendIntent()`; on the host, intents (local and remote) funnel into
   the real `placeTower`/`tryUpgradeTower`/`sellTower`. **The guest applies
   nothing locally** — it waits for the host's echo. Add an optimistic
   "pending" ghost so placement feels instant despite the round trip.
2. **Snapshot path.** Host builds a snapshot at `COOP.snapshotHz` (start at
   10): enemies (`id, type, distance, hp, statusFlags`), towers
   (`id, type, tile, level, ownerId`), core HP, wave index/phase, both wallets.
   Guest applies and extrapolates `distance` between snapshots.
3. **Event path** (reliable channel): `towerFired`, `kill`, `waveStart`,
   `gearDrop`, `playerJoined`, `playerLeft`. The guest turns these into its own
   local VFX — coins, credit pulse, gear-drop ingest, level-up surge — so all
   the Credit Juice work lands on both screens.
4. **Guest render loop.** `frame()` skips `updateGame` for a guest and runs a
   `coop.js` interpolation step instead. Everything downstream (`render`,
   `updateHUD`, panels) is unchanged.
5. **Clock.** Snapshots carry the host's `game.time`; the guest slaves its
   render clock with a smoothing buffer (`COOP.interpDelayMs`, start ~100).
6. **Drop-in join.** On `playerJoined` mid-battle: host assigns the ownerId,
   applies the grant from §3, sends a full state snapshot, and the guest starts
   rendering at the current wave. The host keeps a low-frequency signaling poll
   alive **during** the battle so a joiner can arrive at any time (one fetch
   every few seconds — negligible beside a 60fps render).

**Landmines:** story cards / enemy-intro cards **zero `dt`** (`main.js:715`)
and that freeze must propagate, or the host's world runs on while the guest's
card is up. Endless mode already skips most narrative (`main.js:513`,
`main.js:615`), which reduces this surface considerably.

**One landmine was deleted by round 4, not solved:** the speed toggle and
pause used to be listed here as "must be host-only or the clocks diverge".
Co-op now has **no speed control and no pause at all** (§9a.3), so the
divergence case cannot arise. If speed control is ever reintroduced, this
landmine comes back with it.

---

## 9. Phase 3 — Lobby and session browser

1. **CO-OP button** appended to `#menu-actions` (`index.html:172`).
2. **Session naming is generated, never typed** (round 3). The lobby row is a
   set of **fields**, not a title string, which removes the naming problem
   almost entirely: level name, current wave, `players/max_players`, free
   buildable tiles, host nickname. The headline handle is a **two-word neon
   codename** ("CRIMSON LATTICE", "AZURE CASCADE") drawn from word lists in
   `config.js COOP.codenames` and **seeded by the room code**, so it is stable
   for the session's life and needs no storage beyond the `codename` column.
   Word lists live in config (tunable, and translatable via `fr.js`).
   - **Why not `{PlayerName}'s Game`:** it would still be user-typed text in a
     public list. Note though that this is a *smaller* hole than it looks —
     `playerName` already prefills the **leaderboard nickname**, which is
     **already published publicly** (`leaderboard.js getNickname`). So showing
     `host_nick` as a secondary field adds no new exposure, and it is how you
     recognise a family member's session. Keep it as a field; keep it out of
     the headline.
3. **Host flow** — HOST GAME → Public or Private → pick a **cleared** level →
   straight into Endless. No naming step. A private session shows its code
   prominently; a public one is listed immediately. (When 3–4 players ship, a
   player-count picker joins this flow.)
4. **Heartbeats.** The host updates `last_seen` (plus wave / players /
   free_tiles) every `COOP.heartbeatSeconds` (~10). The browser lists only rows
   seen within `COOP.staleSeconds` (~30), or the list fills with dead games.
   **This must exist from day one**, not be retrofitted.
5. **Free-tile count** comes from the grid's buildable tiles minus placed
   towers — the signal that lets a joiner avoid a full board (§2, round 2).
   This matters *more* at 3–4 players, where buildable space runs out fast.
6. **Room left for kick / terminate (not v1).** Host-authoritative makes both
   easy — kick is "close that peer connection and stop accepting its intents";
   terminate is "stop heartbeating, delete the row, send a clean exit event".
   The protocol should carry a reason code on disconnect so a kicked player
   sees something better than "connection lost". **Open:** whether a kicked
   player's towers stay on the board (they were paid for) or are removed
   (which is what you'd actually want for a griefer).
7. **i18n.** All new strings through `t(key, en)` with French in
   `src/lang/fr.js` (`I18N_PLAN.md`). Don't translate proper nouns.

---

## 9a. Phase 3b — The co-op HUD

The battle HUD is `#hud` in `index.html:101`: **CREDITS | WAVE | CORE |
SKILLS(button) | speed-controls(slow, pause, fast, exit)**. In co-op it becomes
**CREDITS | WAVE | CORE | presence | exit** — identical for every player.

1. **CREDITS shows the local player's wallet only** (round 4). `game.money`
   is already specified as a getter alias for the local wallet (§7.2), so the
   existing `ui.js updateHUD` and the `.credit-gain` pulse keep working
   untouched. **Do not add other players' wallets to the HUD** — that is the
   decision that lets this HUD serve 4 players unchanged.
2. **Presence indicator** fills the space freed by SKILLS + the three speed
   buttons: one pip per connected player, **tinted with that player's owner
   colour — the same colour used to tint their towers on the board**, so
   "whose tower is that" and "who is here" are one visual concept, not two.
   - The local player's pip is emphasised; the **host's pip is marked**, since
     "the host left" ends the session and "a guest left" does not.
   - A pip appearing/disappearing is the join/leave signal. Pair it with a
     line on the **existing bark ticker** — `ui.js showBark` already accepts a
     `{name, color}` speaker and colours it inline, so "CRIMSON LATTICE
     JOINED" costs nothing new.
   - Sizing: four pips fit comfortably in the space that held a labelled
     button plus three speed buttons.
   - Nice-to-have, not v1: a dimmed/pulsing pip for a degraded connection.
3. **No speed controls and no pause** (round 4), for host and guest alike.
4. **Exit ✕ stays.** Guest = leave session; host = end session for everyone.
   The host's ✕ needs a confirm, since it ends other people's game — reuse the
   existing `exitConfirming` flow (`main.js:715`).
5. **i18n:** new strings through `t(key, en)`; the codename word lists in
   `COOP.codenames` need French too.

---

## 10. Phase 4 — Roster & progression exchange

The half that touches the save layer. **Never break or wipe an existing
localStorage save** (cardinal rule).

1. **Join payload (guest → host).** Deployable roster records (name, type,
   career level, mastery XP, gear stats) plus **resolved numbers** for the
   skills the host needs — `getMoneyMult`, interest rate/cap, per-tower
   multipliers. The host must never have to re-derive another player's
   progression.
   - **This payload is sent ONCE and must stay valid for the whole session.**
     That is only true because **skills are locked at join** — the SKILLS
     button is removed from the co-op HUD (§9a, round 4). If skills could be
     spent mid-session, every stat the host computed for that player would go
     stale and the payload would need re-syncing on every change. **Do not
     re-add mid-session skill spending without also solving that.**
2. **Session-end payload (host → guest).** Per-tower XP and mastery gains,
   loot earned by the guest's towers, shards, kills/leaks, wave reached. The
   guest feeds these into its **own** `recordBattleEnd` (`progression.js:1030`)
   so its save is written locally by its own code.
3. **Global-skill conflicts.** Proposed: economy skills apply **per-wallet**
   (each player's own), **core HP takes the host's bonus**, starting money is
   each player's own into their own wallet.
4. **Telemetry.** `feedback.js` rows need a `coop` flag and a role, or co-op
   runs will pollute the balance dashboard's difficulty data. A payload field
   means a `version.js` bump (see `TELEMETRY_DASHBOARD_PLAN.md` Scope B).
5. **Validate everything.** This phase writes progression from data that
   arrived over a network. A malformed payload must never corrupt a roster.

---

## 11. Phase 5 — Cloudflare TURN (committed, not speculative)

STUN alone fails for roughly 15% of network pairs (symmetric NAT). TURN is the
only fix, and this is where the player's Cloudflare account earns its place.

**The constraint that shapes this phase:** TURN credentials are secrets with a
short lifetime, and **you cannot ship a secret in a static GitHub Pages
build.** So Phase 5 is not "add a config line" — it needs a tiny server-side
credential minter:

- **Option A** — a small Cloudflare Worker that mints short-lived TURN
  credentials for Cloudflare's TURN service. Uses the account already created.
- **Option B** — a Supabase **Edge Function** does the minting instead, keeping
  everything on one backend, while the TURN service itself is still
  Cloudflare's. Fewer moving parts overall.

Either way `net.js` only gains an extra entry in `COOP.iceServers`, fetched at
connect time. Decide A vs B when this phase is reached, informed by the actual
Phase 0 failure rate.

---

## 12. Open questions

Still genuinely unresolved after four ideation rounds:

- **Shared or separate tower-type unlocks?** If a joiner hasn't unlocked
  Rocket, can they place one in the host's session?
- **The combined-fire bonus — not yet ruled on.** Proposed but not answered:
  kills already split XP among all contributing towers
  (`enemies.js awardKillXp`), so the game already knows when towers from
  *different players* damaged the same enemy. A bonus multiplier at that one
  existing call site would directly reward interleaving towers instead of each
  player claiming half the map. One multiplier, one call site.
- **Griefing / etiquette.** Anyone can upgrade any tower — including dumping
  credits into one the owner is about to sell. Fine for a family game, or does
  it want a confirm?
- **A disconnected player's towers.** Proposed: they stay (already paid for).
  Alternatives: go dormant, or the remaining player inherits sell rights.
  Related but distinct from the **kicked**-player case in §9.6.
- ~~**HUD at 3–4 players**~~ — **RESOLVED in round 4.** Own-credits-only plus a
  pip-per-player presence indicator serves 2 or 4 with no redesign (§9a).
- **Host upload at 3–4 players.** The host relays snapshots to every peer
  (star topology), so upload scales linearly: ~4KB × 10Hz × 3 peers ≈ 120KB/s
  up from a phone. Fine on WiFi, marginal on cellular. Measure in Phase 0
  before committing to 4.

---

## 13. Parked — post-v1 identity features

The player likes these; they are deliberately **not** in the v1 phases.

- **Shared overcharge meter (the lead candidate).** Kills from both players in
  quick succession fill a shared meter; a full meter fires the golden
  level-up surge on *everyone's* towers at once. Nearly all of this is already
  shipped and speed-compensated — the surge VFX, the temporary buff, the aura,
  and the golden-shot colouring all exist in `towers.js applyLevelUpSurge` /
  `particles.js emitLevelUpSplash` / `renderer.js drawSurgeAura`, with knobs in
  `config.js VFX.levelUp`. This is mostly plumbing plus a meter.
- **Co-op conduits.** Conduits already exist as World 4 build-tiles that
  multiply tower stats, resolved in `grid.js conduitAt` and applied at the end
  of `towers.js recomputeStats`. A linked pair that only activates when *each*
  player has a tower on it is a small extension of shipped machinery, not a new
  system.
- **Emergent asymmetry — free today, playtest before designing.** Slow already
  applies a 30% vulnerability debuff and earns XP without killing, so
  "one player supports, one deals damage" is a real strategy with **zero new
  code**. Worth playing before building asymmetry that may already exist.

---

## 14. Risks

- **Scope.** The largest feature in the project's history. Phases 1, 2, and 4
  each touch the game loop, the economy, or the save layer. Phase 0 is cheap
  and answers the riskiest question first.
- **iOS Safari WebRTC** is the biggest unknown — exactly why Phase 0 exists
  and is throwaway.
- **Real-device verification cannot be delegated to Codex** — it has no browser
  here and verifies headlessly against a stubbed canvas (`HANDOFF.md` →
  "Delegating work to Codex"). Two-device testing is human-in-the-loop.
- **Supabase auto-pause** kills both signaling and the lobby after ~7 idle
  days. Same known ops issue as the leaderboard; the failure must surface as a
  clear in-game message, not a silent hang.
- **A public lobby is public.** Free-text names on an anon key, visible to
  anyone. Cap and sanitize.
- **The save layer is the dangerous part** (Phase 4). Back up the real save
  before any two-device test.
