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
| **Reach** | ~~Free public STUN now; Cloudflare TURN committed as Phase 5~~ → **SUPERSEDED 2026-08-22: a TURN relay is the transport, and it is DONE (§11).** | Device testing disproved the "STUN covers ~80–85% of pairs" assumption for this player base. Direct P2P failed on an ordinary home network for two independent reasons, and iOS Private Relay (on by default for iCloud+) breaks it for exactly the players this game has. The LAN-only constraint from round 1 was already superseded; the STUN-only assumption now is too. |
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

### Phase 0 — ✅ COMPLETE AND VERIFIED ON REAL DEVICES (2026-08-22)

**iPhone ↔ PC connected successfully over the deployed HTTPS build**, with both
data channels open. The phase's whole purpose — proving the transport works on
the target device — is discharged.

**The answer, in one line: it works over a TURN relay, and only over a TURN
relay.** Direct peer-to-peer was chased to ground and failed for two
independent reasons on one ordinary home network (see the two findings below).
Every later phase should assume the relay is the transport.

What it took, in order: an ICE-gathering timeout (Safari stalls under Private
Relay), disabling iCloud Private Relay, a relay provider, and holding gathering
open long enough for relay candidates to arrive. The last one nearly went
unnoticed — see "hold for a relay" below.

What exists:

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

**VERIFIED ON REAL DEVICES (2026-08-22):** iPhone (iOS 18.7, Safari 26.6) and a
Windows PC (Firefox 154) connected over the deployed HTTPS build, both channels
open, via the Metered TURN relay.

**Relay gathering — the near-miss worth remembering.** Relay candidates require
a TURN allocation round trip and are the slowest to appear. The original 3s
gathering timeout could publish the offer *before* they existed, discarding the
only candidates that work on this network and looking exactly like "TURN
doesn't work". `COOP.iceGatheringRelayTimeoutMs` (10s) now holds gathering open,
re-checking every 250ms, until a relay candidate exists. Verified: host gathers
8 candidates (host 1, srflx 1, relay 6) with **all 6 relays present in the
stored offer**.

**ICE still prefers a direct pair when one exists** — a loopback test connected
at 0.7ms without touching the relay. So the relay costs no latency and burns no
quota on networks where P2P already works. It is insurance, not a toll booth.

**Still unexercised:** connect-timeout and stale-row handling paths.

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

**About ICE gathering on iOS — corrected.** An earlier revision of this file
claimed iOS Safari *never* reports `iceGatheringState === "complete"`. That was
**wrong**, and it was written from a single observation. With Private Relay
**on**, gathering did stall at `gathering` forever; with it **off**, the very
next test reported `complete`. The stall was Private Relay, not Safari.
`COOP.iceGatheringTimeoutMs` is still worth keeping — it costs nothing and it
protects against exactly that stall, which any user with Private Relay on will
hit — but it is a safety net, not a workaround for a Safari defect. The
published offer was verified complete (3 candidates including both srflx), so
publishing early does **not** truncate the candidate list.

### ⚠️ Phase 0 finding 2 — same-LAN peers still cannot reach each other

With Private Relay fully disabled, a PC-hosts / phone-joins test still failed,
and the SDP shows why the failure is now a *local* one:

```
PC    srflx:  96.250.89.177   + <uuid>.local host (UDP + TCP)
phone srflx:  96.250.89.177   + <uuid>.local host
```

**Identical public IP** — the two devices really are on one network. That
leaves exactly two possible candidate pairings, and both are dead ends:

- **host ↔ host** — both host candidates are mDNS `.local` names. Each side
  must resolve the *other's* name; if either cannot, no packet is ever sent to
  that pair.
- **srflx ↔ srflx** — both resolve to the same public address, so this pair
  only works if the router supports **NAT hairpinning**. Many consumer routers
  do not.

Prime suspects, in order: **AP/client isolation** on the Wi-Fi (blocks
device-to-device traffic outright), **the Windows firewall network profile**
set to Public (blocks inbound), or **mDNS resolution failing** on one or both
sides.

**Chased to ground 2026-08-22 — the answer is: use a relay.** The full trail,
so nobody repeats it:

- `serve.ps1` binds `http://localhost:$Port/` **only** (serve.ps1:507), so it
  cannot be used for a phone-to-PC reachability test without admin rights.
  Ping was used instead.
- **Ping PC → phone succeeded**, ruling out AP/client isolation.
- Firefox's mDNS obfuscation was disabled
  (`about:config` → `media.peerconnection.ice.obfuscate_host_addresses` =
  false), and the PC then published its **real LAN IP** (`192.168.68.61`),
  verified in the stored SDP. The phone therefore had a real, routable address
  to send to — **and it still failed**.
- Final reports: the phone gave up at 32.6s (`checking > failed`); the PC was
  **still in `checking`** at 58.4s when the connect timeout fired, having sent
  connectivity checks for 44 seconds and received nothing.
- Only one candidate pair was ever viable (phone → the PC's LAN IP), and
  traffic in that direction never arrived. The successful ping was PC → phone,
  the **opposite** direction — unsolicited **inbound** to an application is
  what Windows Firewall blocks by default.

**Conclusion: direct P2P failed for two INDEPENDENT reasons on one ordinary
home network** — iCloud Private Relay on iOS, and inbound blocking on the LAN.
Neither is fixable in this codebase, and the desktop workarounds used to get
this far (an `about:config` flag, a firewall rule) have **no equivalent on a
phone**. A relay is not a fallback for stubborn networks; it is the transport.

**Do not spend more time making direct P2P work.** Wire TURN, then revisit
whether a direct path is worth attempting as an optimisation.

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

**This phase adds NO networking.** `net.js` is not imported and must not be
touched. Everything here is verifiable in a single browser tab.

### Implementation contract (surveyed 2026-08-22 — verify before trusting)

**The `game.money` getter alias is the key to keeping this small.** There are
~32 `.money` references across `ui.js`, `main.js`, `game.js`, `towers.js`,
`enemies.js`, `balance-sim.js`, and the Balance Lab. Do **not** rewrite them.
Replace the stored field with `game.wallets[ownerId]` and define `game.money`
as an accessor pair on the game object that reads/writes **the local player's**
wallet. Every existing read site (`ui.js:256-258` credit pulse, `ui.js:332`
affordability, `ui.js:403` upgrade cost, `main.js:378` telemetry `moneyLeft`)
then keeps working untouched.

**The five write sites** (these are the only places money changes):
- `enemies.js:251` `game.money += earned` — bounty. Credit **every** wallet the
  FULL amount (locked decision, §2 round 1), each with **that player's own**
  `getMoneyMult()`. Also accumulate **`game.totalEarned[ownerId]`** — a new
  field that does not exist yet and which the drop-in grant depends on (§3).
- `game.js:196` `game.money += gain` — wave interest. Compute **per wallet**
  from each player's own rate/cap.
- `towers.js:269` (upgrade), `towers.js:298` (placement), `towers.js:328`
  (sell refund) — charge/refund the **acting** player, not the local one.

**The three UI chokepoints** are the entire input surface:
`main.js:214` (`tryUpgradeTower`), `main.js:219` (`sellTower`),
`main.js:247` (`placeTower`).

**Ownership rules** (locked, §2 round 1): anyone may upgrade any tower but pays
from their own wallet; **only the owner may sell**. `sellTower` must return the
existing `{ok, reason}` shape on refusal so the UI can explain it.

**`DEBUG.coopLocal`** goes in the existing `DEBUG` block (`config.js:22`, which
currently holds only `gameSpeed`). When on, create a second fake player and
offer a way to switch which one is "acting" so both wallets and the sell-gate
can be exercised in one tab.

### Definition of done
- With `coopLocal` **off**, single-player behaviour is **byte-identical**:
  starting money, placement cost, upgrade cost, sell refund, wave interest, the
  HUD credit pulse, and `balance-sim.js` runs all unchanged.
- With it **on**: two wallets diverge correctly; a kill credits BOTH wallets the
  full bounty; `totalEarned` accumulates per player; selling another player's
  tower is refused with a reason; upgrading another player's tower succeeds and
  charges the actor.

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

**SPLIT INTO 2a AND 2b (2026-08-22).** Phase 2 as originally written bundles
core state sync, cosmetic event fan-out, and drop-in join. That is too much for
one delegated pass — and 2a has a clean, independently verifiable milestone
("two tabs show the same battle"), so it is worth landing on its own.

### Phase 2a — host-authoritative core sync  ← DO THIS ONE FIRST

**Milestone: two browser tabs, one hosting and one joining, show the same
battle.** No cosmetic parity, no drop-in — those are 2b.

**What Phase 1 already gives you** (verify before trusting): `game.ownerIds`,
`game.players[id]` (`{id, label, color, economy, roster}`), `game.wallets[id]`,
`game.totalEarned[id]`, `game.localPlayerId`, `game.actingPlayerId`,
`game.progressionOwnerId`, `tower.ownerId`, and `game.money` as an accessor
onto the local wallet. Placement/upgrade/sell all already take an acting
`ownerId`.

**What Phase 0 already gives you** (`src/net.js`, do not modify):
`hostSession()` (returns a promise with `.code`), `joinSession(code)`,
`onMessage(cb)` → `cb({channel, data, event})` where **`data` is a JSON
STRING**, `sendMessage(channel, obj)`, `onConnectionState(cb)`,
`getConnectionState()`, `closeSession()`, `CONNECTION_STATES`. Channels are
`"cmd"` (reliable, ordered) and `"state"` (unordered, lossy).

**New file `src/coop.js`** owns the game-layer protocol. `net.js` stays pure
transport — do not put game concepts in it.

**Enemies are the whole trick.** An enemy is 1-D: `enemy.distance` plus
`grid.positionOnPath()` is its position, and enemies already carry a stable
`enemy.id` (`enemies.js createEnemy`). The renderer reads `def` — which the
guest rebuilds locally from `ENEMIES[type]` — so **only these cross the wire**:
`{id, type, distance, health, maxHealth, flags}` (flags = slow/vuln/hitFlash as
needed for tinting). The guest reconstructs enemy-shaped objects the existing
renderer can draw **unchanged**.

**Snapshot** (on `state`, at `COOP.snapshotHz`, start 10): `time`, `phase`,
`waveIndex`, `coreHealth`, `wallets`, `totalEarned`, the enemy array above, and
towers as `{id, type, tileX, tileY, level, ownerId}`. **Projectiles, particles
and effects never cross the wire.**

**Intents** (on `cmd`): `{op:"place"|"upgrade"|"sell", ...}`. The guest sends
and **applies nothing locally** — it waits for the host's next snapshot. The
host funnels local AND remote intents into the real
`placeTower`/`tryUpgradeTower`/`sellTower` with the correct acting `ownerId`.

**Guest render loop:** in `main.js frame()`, a guest must **skip `updateGame`
entirely** and instead run a `coop.js` interpolation step that advances each
mirrored enemy's `distance` by its own speed between snapshots. Everything
downstream (`render`, `updateHUD`, the panels) stays as-is.

**Clock:** snapshots carry the host's `game.time`; the guest slaves to it with
a smoothing buffer (`COOP.interpDelayMs`, start ~100).

**Do NOT in 2a:** drop-in join, the earnings grant, cosmetic event fan-out
(coins / credit pulse / gear-drop / level-up surge on the guest), the lobby, or
any `version.js` bump.

### Phase 2b — event fan-out + drop-in  ← implementation contract

Two separable pieces. Land cosmetic parity first; drop-in second.

**What 2a already gives you** (verify before trusting): `src/coop.js` with
`startHost`/`startGuest`/`isActive`/`isHost`/`isGuest`/`sendIntent`/
`updateHost`/`updateGuest`; snapshots on `state` at `COOP.snapshotHz` carrying
`{seq,time,phase,waveIndex,coreHealth,wallets,totalEarned,enemies,towers}`;
intents on `cmd`; `game.coop` present during a session; a guest that never
calls `updateGame`. Owner ids are `"coop-host"` / `"coop-guest"`.

#### 2b-1 — cosmetic event fan-out

The guest currently renders a correct but **silent** battle: no coins, no death
shards, no hit sparks, no level-up surge. All of that is local VFX the guest
can generate itself from small `cmd` events — **none of it should be
synchronised frame-by-frame.**

Emit from the host, replay on the guest using the **existing** emitters
(do not write new particle code):
- `kill` → `particles.js emitCoins(game, x, y, count, speedMult, tileSize)`
  and `emitDeathShards(game, x, y, def, tileSize, power)`. `def` is
  `ENEMIES[type]` locally.
- `towerFired` → **REQUIRED. See the measurement below — an earlier pass
  skipped this and the result was unacceptable.**
- `levelUp` → `towers.js applyLevelUpSurge(game, tower)` on the mirrored tower.
- `gearDrop` → the effect built in `enemies.js` around
  `expireStamp: "lastGearIngestTime"` (`config.js VFX.gearDrop`).
- `waveStart` → whatever the HUD/bark layer needs.

**The HUD credit pulse may already work** — `ui.js updateHUD` diffs
`game.money`, and the guest's wallet arrives in every snapshot. **Check before
building anything for it.**

#### 2b-3 — shot visuals are NOT optional (corrected 2026-08-22)

The first 2b pass skipped `towerFired` on bandwidth grounds. The result was a
guest watching **inert towers** while enemies took damage from nothing and
exploded. In a tower defense game the firing *is* the spectacle; this is not an
acceptable experience and the reasoning does not survive measurement.

**Measured on L001, 8 lasers, 30 seconds of real battle:** 184 beam + 184
muzzle effects = **6.1 shots/sec total, 0.77 per tower per second.** (Well
under the 2.86/sec theoretical rate — towers idle whenever nothing is in
range.) At ~30 bytes per event that is **~185 bytes/sec**. Snapshots already
cost ~40KB/s. A late-game board of 20 fast towers still lands under 2KB/s.

**The real hazard was the channel, not the volume.** High-frequency traffic on
the **reliable, ordered `cmd`** channel can head-of-line-block intents. So:

- **Send shot visuals on the LOSSY `state` channel.** A dropped shot event
  costs exactly one missing muzzle flash and blocks nothing.
- **Forward the effect payloads themselves** (`beam`, `muzzle`, `ray`) rather
  than re-deriving visuals guest-side. They are plain data the renderer already
  understands, so pushing them into the guest's `game.effects` reproduces every
  tower's look exactly — including the Railgun's ray tiers — with no duplicated
  art logic.
- **Projectiles (Pulse orbs, Rockets) carry damage.** A guest-spawned
  projectile must be marked cosmetic so `projectiles.js` skips `damageEnemy`;
  otherwise the guest kills locally and fights its own snapshots.

#### 2b-2 — drop-in join

A guest may join **mid-battle**, at any wave (locked decision, §2 round 2).

- The host accepts a joiner while `phase` is `wave`/`countdown`/`ready`,
  assigns the owner id, and sends a full snapshot so the guest starts from
  authoritative state.
- **The joiner's grant** (§3): `grant = COOP.dropIn.earningsShare ×
  hostTotalEarned`, capped by `COOP.dropIn.maxGrant`. **New knobs.** Use
  `game.totalEarned[hostId]`, **not** the host's current wallet balance — that
  is the whole point of the field (a hoarding host must not pay out more than
  one who invested well).
  `earningsShare: 1.0` means "full retroactive credit"; start at **0.6**.
- The guest must be able to build immediately: it needs the level, the grid,
  and its wallet before the first snapshot is rendered.

**Out of scope for 2b:** the lobby/session browser (Phase 3), the co-op HUD
and presence pips (Phase 3b), roster/progression exchange (Phase 4). Room
codes are still exchanged by hand via `window.coop`.

### Original Phase 2 detail (applies across 2a + 2b)

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

### Implementation contract (surveyed 2026-08-22)

**What already exists — do not rebuild any of it:**
- **The table.** `coop_sessions` is LIVE in Supabase with exactly these columns:
  `code` (PK), `codename`, `listed` (bool), `host_nick`, `level_id`, `wave`,
  `players`, `max_players`, `free_tiles`, `offer`, `answer`, `last_seen`,
  `created_at`. RLS allows anon select/insert/update, plus **delete of stale
  rows only**. A `pg_cron` job prunes rows unseen for 30 minutes. SQL and
  rationale are in `SUPABASE_SETUP.md`.
- **`src/net.js`** — transport. `hostSession()` (promise with `.code`),
  `joinSession(code)`, `onConnectionState`, `getConnectionState`,
  `closeSession`, `CONNECTION_STATES`, `getDiagnostics`. **Do not modify it.**
  It currently writes only `code`, `offer` and `answer`; the lobby metadata
  columns are unused so far.
- **`src/coop.js`** — game protocol: `startHost(game)`, `startGuest(game,
  code)`, `isActive/isHost/isGuest`, `getRole`, `getState`, `sendIntent`,
  `updateHost`, `updateGuest`. Drop-in join and the earnings grant work.
- **`COOP` in config.js** — already holds `roomCodeLength/Alphabet`,
  `sessionTtlMs`, `ownership.colors`, ICE/TURN settings, `dropIn`. Add lobby
  knobs here (heartbeat interval, stale window, codename word lists, poll
  interval, name length caps).
- **`window.coop`** in `main.js` is the temporary console bridge the lobby
  replaces. Remove it once the UI works.
- **`ui.js appendGlobalMenuButtons()`** builds `#menu-actions` rows — the CO-OP
  button belongs here.

**Endless-only, cleared levels only.** Co-op runs a **cleared** campaign level
in **Endless** mode (`startLevel(level, true)`). Endless is gated on having
BEATEN the level (`ui.js` disables the button unless `cleared`) — a brand-new
player can host nothing, and that is correct.

**Session rows must carry live metadata.** `net.js` writes only the handshake
today. The lobby needs `codename`, `listed`, `host_nick`, `level_id`, `wave`,
`players`, `max_players`, `free_tiles` written on create and refreshed by the
heartbeat. Put that in `coop.js` or a new `src/lobby.js` — **not** in `net.js`.

**Free tiles** = buildable tiles minus placed towers. It is the signal that
stops a joiner entering a session with nowhere to build.

**Codenames are generated, never typed** (§2 round 3) — seeded by the room
code so they are stable, from word lists in `COOP.codenames`.

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

### Implementation contract (surveyed 2026-08-22)

**Current `#hud` markup** (`index.html:101`): `#hud-money` → `#hud-wave` →
`#hud-core` → `#skills-button` → `#speed-controls` (which contains
`#speed-slow`, `#speed-pause`, `#speed-fast`, and **`#exit-button`**).

**Note the exit button lives INSIDE `#speed-controls`.** Hiding that container
wholesale in co-op would remove the only way out of a battle. Exit must
survive.

**Already true, do not rebuild:** `game.money` is an accessor onto the LOCAL
player's wallet (Phase 1), so CREDITS already shows own-wallet-only with no
work. `ui.js updateHUD` already resets its credit-pulse baseline when the
owner changes.

**`#coop-debug-bar`** (`index.html:128`) is Phase 1's `DEBUG.coopLocal` actor
switch. It is debug-only and deliberately shows BOTH wallets. Leave it alone —
it is not the presence indicator, and it never appears for real players.

**Owner colours already exist** as `COOP.ownership.colors`, and `renderer.js`
already tints each tower with its owner's colour. **The presence pips must use
the same colours** so "whose tower is that" and "who is here" are one concept.

**Player identity** is on `game.players[id]` → `{id, label, color, economy,
roster}`, with `game.ownerIds` as the ordered list. Owner ids are
`"coop-host"` / `"coop-guest"`.

**A known defect to fix here** (found in 2a): mirrored towers carry no XP, so a
guest's upgrade panel can offer an upgrade the host then rejects. Either send
enough tower state to gate it, or disable the control on a guest with a
reason. The host stays authoritative either way — this is a UI honesty fix.

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

## 11. Phase 5 — TURN relay — ✅ DONE (2026-08-22, pulled forward)

**Built, deployed, and verified on real devices.** Pulled forward from "last
phase" to "prerequisite" once device testing proved direct P2P cannot work
(§ the two Phase 0 findings). As built:

- **Provider: Metered free tier** (~50GB/month, no credit card). Cloudflare's
  TURN was the original plan but requires a card on file, which the owner
  declined. The traffic here is intents and small snapshots, so the free tier
  is generous.
- **`turn-credentials` Supabase edge function** (`verify_jwt: false`) mints
  short-lived credentials. It is **provider-agnostic** — it reads either
  `METERED_SUBDOMAIN` + `METERED_API_KEY` or `CF_TURN_KEY_ID` +
  `CF_TURN_API_TOKEN`, whichever is set, so switching providers is a secrets
  change and not a redeploy. It passes the provider's own error text through,
  because during setup "bad token" vs "wrong id" is the whole diagnosis.
- **Secrets live in Supabase, never in this repo.** The game is a static site
  with nowhere to hold a secret; the browser only ever sees expiring
  credentials. **The owner sets these themselves — do not ask for the values.**
- **Gotcha for Metered:** use the per-credential **API Key** (the "Show API
  Key" button beside a TURN credential), NOT the account-wide **Secret Key**
  from the Developers page. `METERED_SUBDOMAIN` is the bare label
  (`geometric-td`), not the full `geometric-td.metered.live`.
- `COOP.turnEndpoint` points at the function; `null` disables it. A TURN
  failure is never fatal — it falls back to STUN-only and records why in
  diagnostics.

### Historical: the original Cloudflare plan

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
