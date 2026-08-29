# Geometric TD — Mods Design Space

Forward design for **behavioral gear mods**. Build record lives in
`AFFIXES_PLAN.md`; requirements in `plans/affixes.md`. This file is the idea
space + the archetype/role map + the first numerical balance model.

**Status:** `[BUILT]` shipped · `[NEXT]` accepted, not built · `[IDEA]` not committed.

**Rarity mapping:** the design talks in Common/Uncommon/Rare/Epic/Legendary; the
game's five rarities are **Common / Enhanced / Rare / Prismatic / Singularity**
(uncommon→enhanced, epic→prismatic, legendary→singularity). All tables below use
the game's five.

---

## 1. The five roles

Every mod plays a role in an **archetype** (a condition or mechanic):

- **Setter** — creates/applies the condition (usually the base mod).
- **Amplifier** — makes the condition *stronger* (more stacks/effect/cap).
- **Rewarder** — grants a benefit *when the condition is present*.
- **Bridge** — connects this archetype to *another*.
- **Transformer** — changes what the archetype is *for* (anti-swarm → anti-boss,
  local → network, per-wave → cross-wave). These are the **rarest, most exciting**
  pieces — gate them to Rare+ / Prismatic+ and make them chase items.

A satisfying build reads Setter → Amplifier → Rewarder, with a Bridge into a
second archetype and, at the top end, a Transformer that redefines it.

---

## 2. Design principles

- **TD-specific**: path geometry, chokepoints, wave/leak structure, targeting
  priority, many-towers-vs-diverse-towers tension.
- **Create a decision, not a bigger number.**
- **Never re-incentivize tower spam** — Array/Fork already push count (perf
  ceiling). Count-based Amplifiers raise *per-tower power*, never the cap.
- **Proc mods scale with attack speed** → low % or an internal per-tower cooldown.
- **Free-resource/economy mods compound** → smallest numbers + a per-wave cap.
- **Scaling mods** → cap AND a reset/decay rule, never one without the other.
- **Recursive mods** (Cascade, spread, Relay, Ricochet) → `canProc` guard + a
  hop/jump/one-target limit; dedupe sources.
- **Execute/threshold mods** → boss carve-outs mandatory.
- Numbers live in `config.js LOOT.mods`; rolled power stored on the item.

---

## 3. Archetype × role matrices (mechanics)

Numbers are in §7. Names are placeholders.

### 3.1 EXPOSED — damage-taken amplification
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Exposed** | Hits add stacks; +2%/stack damage taken (cap 20) | `[BUILT]` |
| Amplifier | **Overexpose** | Raises Exposed per-stack % and cap | `[IDEA]` |
| Rewarder | **Painted** | +X% damage to enemies that have Exposed | `[IDEA]` |
| Bridge → Corruption | **Backdoor** | Corrupted enemies gain Exposed = 0.3–0.4× their Corruption, tuned to stay ≤ the Exposed cap 20 at 50 Corruption so no rarity is wasted (Rare+). Future Transformer-tier could raise the Exposed cap instead | `[NEXT]` |
| Bridge (spread) | **Chain Reaction** | An Exposed enemy's death spreads some Exposed to neighbors | `[IDEA]` |

### 3.2 THROTTLE — slow / crowd control
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Throttle** | Hits add stacks; −2%/stack speed (cap 50%) | `[BUILT]` |
| Amplifier | **Bottleneck** | Raises per-stack slow and the cap (boss caveat) | `[IDEA]` |
| Rewarder | **Sitting Duck** | +X% damage to the target per 10% it is slowed | `[IDEA]` |
| Bridge → Corruption | **Stasis Field** | Throttled enemies take extra Corruption ticks | `[IDEA]` |

### 3.3 DESYNC — tower-sequencing burst
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Desync** | Same-type builds stacks (**base cap 50**); a different type consumes for burst | `[BUILT]` + cap `[NEXT]` |
| Amplifier | **Buffer Overflow** | Same-type hits add **+2**; raises cap 50 → 75 | `[IDEA]` |
| Rewarder | **Overvolt** | Consuming **≥20** Desync guarantees a crit (commitment, not free) | `[IDEA]` |
| Bridge → Corruption | **Payload** | The consume applies Corruption equal to consumed stacks | `[IDEA]` |

> **Locked change:** base Desync gets a **cap of 50** (contradiction fixed —
> scaling mods need a cap; Desync's reset is switching types). Buffer Overflow is
> the only thing that raises it.

### 3.4 CORRUPTION — contagious damage-over-time  `[NEXT archetype]`
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Corruption** | Hits add Corruption; each second deal damage **equal to** current Corruption; on death **transfer 50% to ONE** nearby enemy; no decay | `[NEXT]` |
| Transformer (lifetime) | **Rootkit** | Corruption damage +5% per second the enemy has been Corrupted, up to a cap → anti-swarm becomes anti-boss | `[NEXT]` |
| Transformer (spread) | **Malware** | Death transfers **100% to up to 3** nearby enemies (Rare+) | `[IDEA]` |
| Rewarder | **Quarantine** | The first **5** Corrupted enemies killed **each wave** grant +credits (capped) | `[IDEA]` |
| Bridge → Exposed | **Backdoor** | see 3.1 (Rare+) | `[NEXT]` |

> **Locked identity:** `stack → damage → death → transfer to ONE`. It's a
> *contagion*, not a generic DoT. No-decay is fine **because propagation is one
> target**. **Malware** is the Transformer that opens multi-target spread — and is
> exactly why base is one-target (dense-wave exponential blowup otherwise). The
> **Backdoor loop** (Corruption → Exposed → stronger Corruption) is intentional
> and *fun* — which is why it's a Rare+ bridge, never common.

### 3.5 ARRAY — mono-type count scaling  (careful: pushes spam)
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Array** | Bonus = **min(count,10)** × (strongest + 1pp/extra source), all same-type | `[BUILT]` |
| Amplifier | **Cluster** | Raises per-tower Array **power** (never the count cap) | `[IDEA]` |
| Rewarder | **Quorum** | At **6+** same-type towers, they gain a flat bonus (milestone, not per-count) | `[IDEA]` |
| Bridge → Broadcast | **Mesh** | A fraction of the Array bonus broadcasts to nearby off-type towers | `[IDEA]` |

### 3.6 FORK — on-kill tower spawn  (careful: pushes spam)
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Fork** | Kills have a **low** % to spawn a free gearless same-type tower nearby (≤2 tiles), one level below parent | `[BUILT]` (proc `[NEXT]`↓) |
| Amplifier | **Replication** | Small additive proc bump (kept low); slightly larger radius | `[IDEA]` |
| Rewarder | **Inheritance** | Forked towers spawn **one level higher** — **levels ONLY, never gear/mods** | `[IDEA]` |
| Bridge → Overclock | **Warm Boot** | A Fork spawn grants the PARENT some Overclock stacks | `[IDEA]` |

> **Locked change:** base Fork proc drops to the **0.5–2.5%** band (shipped at
> 1–5%). **Inheritance is levels-only, hard rule** — never gear/mod inheritance,
> or Fork→Fork chains become possible.

### 3.7 BROADCAST — support auras
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Damage / Fire Rate / Range / Critical Broadcast** | Aura buffs nearby towers | `[BUILT]` |
| Amplifier | **Signal Boost** | +this tower's Broadcast radius / power | `[IDEA]` |
| Rewarder | **Receiver** | +X% extra effect from every Broadcast this tower sits under | `[IDEA]` |
| Transformer | **Relay** | Re-emits received Broadcasts to neighbors — **exactly ONE hop**, and a tower **never receives the same source twice** (dedupe). Singularity: two hops | `[IDEA]` |

> **Locked change:** Relay is **one hop + source-dedupe**, or mesh layouts become
> accidental multiplication machines.

### 3.8 CASCADE — level economy  `[NEXT]`
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Cascade** | On this tower's in-battle level-up, **~20%** to grant **exactly one** free level to one adjacent tower (≤ parent level). **The free level never re-triggers Cascade** | `[NEXT]` |
| Amplifier | **Domino** | Higher chance; radius 2 | `[IDEA]` |
| Rewarder | **Power Surge** | A Cascade-granted level also gives the receiver a brief damage surge | `[IDEA]` |
| Bridge → Overclock | **Clock Multiplier** | A Cascade level grants Overclock stacks | `[IDEA]` |

> **Locked change:** 20% (perceptible) but **strictly one free level, no
> recursion** — bounded instead of the awkward "rare but huge" 5%.

### 3.9 OVERCLOCK — ramping tower power  `[NEXT archetype]`
| Role | Name | Mechanic | Status |
|---|---|---|---|
| Setter | **Overclock** | +X% fire rate when this tower lands a **killing blow**, **max one stack every 0.5s** (so AoE wipes don't dump 12 stacks); capped; **resets at wave start** | `[NEXT]` |
| Transformer (retain) | **Nonvolatile** | Retains a **fraction** of Overclock stacks through the wave reset (e.g. 30% of 20 → 6 carried) — per-wave power becomes cross-wave progression | `[NEXT]` |
| Amplifier | **Turbo** | Higher per-kill % and cap | `[IDEA]` |
| Rewarder | **Redline** | **Threshold** rewards, not another multiplier: 10 OC → +crit chance · 20 → +crit damage · 30 → +1 pierce | `[IDEA]` |
| Bridge → Broadcast | **Thermal** | At max Overclock, emit a fire-rate Broadcast | `[IDEA]` |

> **Locked change:** Overclock triggers on the **killing blow with a 0.5s internal
> cooldown**, so it isn't just a Rocket/AoE mod. Redline uses **thresholds** so
> Overclock progression is milestone-exciting, not "everything ↑."

---

## 4. Cross-archetype bridge map

```
CORRUPTION ──Backdoor──▶ EXPOSED ──Painted──▶ (all damage)
   ▲ ▲                     ▲
   │ └──Payload── DESYNC    └──Stasis Field / Sitting Duck── THROTTLE
 Quarantine (capped economy)

OVERCLOCK ◀──Warm Boot── FORK
   ▲ ▲ ▲
   │ │ └──Clock Multiplier── CASCADE
   │ └──(Desync→OC idea)
   └──Thermal──▶ BROADCAST ◀──Relay/Receiver── (aura web)

ARRAY ──Mesh──▶ BROADCAST
```

Poles: a **Corruption/Exposed "melt"** pole, an **Overclock "tempo"** hub fed by
Fork/Cascade/Desync, and a **Broadcast/Array "network"** pole. Bridges let a build
dip into a second.

---

## 5. New hooks required (for the `[NEXT]` set)

- **onWaveStart(game)** — Overclock reset, Nonvolatile partial retain.
- **onLevelUp(game, tower)** — Cascade (in-battle level, distinct from mastery surge).
- **fault-tick** — per-second pass over `enemy.faults` (Corruption damage, Rootkit
  ramp, Backdoor sync); only iterates enemies that have faults.

Open decision (recommendation): **Fault modifiers (Rootkit, Backdoor, Malware)
act network-wide** (your build applies everywhere); **tower modifiers
(Nonvolatile, Cluster, Signal Boost) are self-only.**

Corruption tick = flat (damage = stack count), **by design** anti-swarm; Rootkit
is what makes it threaten bosses. (%HP tick was rejected — it would make raw
Corruption a boss-melter on its own.)

---

## 6. Applies to ALREADY-SHIPPED mods (needs a balance push)

Two locked changes touch live mods, so they ride a version bump when we build the
next batch (or sooner if wanted):
- **Fork** proc 1–5% → **0.5/1/1.5/2/2.5%**.
- **Desync** gains a **stack cap of 50** (currently uncapped).

---

## 7. First-pass numbers (Common → Enhanced → Rare → Prismatic → Singularity)

**For testing, not final.** The point (per the review) is a single model so we can
ask "is Rare Rootkit worth more than Rare Backdoor?" rather than balancing each
mod in isolation. `—` = doesn't roll at that rarity.

### Faults
| Mod | Common | Enhanced | Rare | Prismatic | Singularity | Notes |
|---|---|---|---|---|---|---|
| Exposed (dmg taken/stack) | 2% | 2% | 2% | 2% | 2% | cap 20 (global) |
| Overexpose (+/stack, +cap) | +0.5%,+5 | +0.5%,+5 | +1%,+10 | +1%,+10 | +1.5%,+15 | `[IDEA]` |
| Painted (+dmg vs Exposed) | 8% | 12% | 16% | 20% | 25% | `[IDEA]` |
| Throttle (slow/stack) | 2% | 2% | 2% | 2% | 2% | cap 50% (global) |
| Bottleneck (+slow/stack, cap) | +0.5%,55% | +0.5%,55% | +1%,60% | +1%,60% | +1.5%,70% | `[IDEA]` |
| Sitting Duck (+dmg per 10% slow) | 4% | 6% | 8% | 10% | 12% | `[IDEA]` |
| Desync (bonus/stack) | 1% | 1.5% | 2% | 2.5% | 3% | **cap 50** |
| Buffer Overflow (stacks/hit, cap) | +2, 60 | +2, 65 | +3, 70 | +3, 72 | +4, 75 | `[IDEA]` — top end adds burst, not just cap |
| Overvolt (crit at ≥ N Desync) | 25 | 22 | 20 | 18 | 15 | `[IDEA]` |
| Payload (Corruption = consumed ×) | 0.5 | 0.6 | 0.75 | 0.9 | 1.0 | `[IDEA]` |
| Corruption (stacks/hit) | 1 | 2 | 3 | 4 | 6 | dmg/s = stacks; cap 50; transfer 50%→1 |
| Rootkit (cap on +%/s ramp @5%/s) | +100% | +125% | +150% | +175% | +200% | Transformer |
| Malware (targets, transfer) | — | — | 2 @100% | 3 @100% | 3 @100% | Transformer, Rare+ |
| Quarantine (+credits/kill, cap/wave) | 4, 5 | 6, 5 | 8, 5 | 10, 5 | 12, 5 | `[IDEA]` capped |
| Backdoor (Exposed = Corruption ×) | — | — | 0.3 | 0.35 | 0.4 | Bridge, Rare+ — capped so it never wastes vs Exposed cap 20 |

### Protocols
| Mod | Common | Enhanced | Rare | Prismatic | Singularity | Notes |
|---|---|---|---|---|---|---|
| Array (power/tower) | 1.5% | 2.5% | 3.5% | 4.5% | 6% | cap 10 towers, +1pp/extra src |
| Cluster (+Array power) | +1pp | +1.5pp | +2pp | +2.5pp | +3pp | `[IDEA]` |
| Quorum (@6+ same-type: +crit) | 8pp | 10pp | 12pp | 13pp | 15pp | `[IDEA]` |
| Fork (proc) | 0.5% | 1% | 1.5% | 2% | 2.5% | **revised down** |
| Replication (+proc, +radius) | +0.5% | +0.5% | +1%,+1 | +1%,+1 | +1.5%,+1 | `[IDEA]` |
| Inheritance (forked level) | +1 | +1 | +1 | +1 | +2 | levels only, ≤ parent |
| Dmg/FireRate/Range Broadcast | 4% | 6% | 8% | 10% | 13% | radius 3 |
| Critical Broadcast (pp) | 2 | 3 | 4 | 5 | 6 | radius 3 |
| Receiver (+received-aura effect) | 10% | 15% | 20% | 25% | 30% | `[IDEA]` |
| Signal Boost (+power, +radius) | +1pp | +1.5pp | +2pp,+1 | +2.5pp,+1 | +3pp,+1 | `[IDEA]` |
| Relay (fraction, hops) | — | — | 0.6, 1 | 0.8, 1 | 1.0, 2 | Transformer, Rare+, dedupe src |
| Cascade (chance, levels) | 12% | 15% | 18% | 20% | 25% | exactly 1 level, radius 1, no recursion |
| Domino (+chance, radius) | +4%,1 | +4%,2 | +5%,2 | +5%,2 | +6%,2 | `[IDEA]` |
| Overclock (+firerate/kill, cap) | 2%,40% | 2.5%,45% | 3%,50% | 3.5%,55% | 4%,60% | 0.5s kill CD, reset @wave |
| Nonvolatile (retain fraction) | 10% | 15% | 20% | 25% | 30% | Transformer |
| Turbo (+per-kill, +cap) | +0.5%,+10% | +0.5%,+10% | +1%,+15% | +1%,+20% | +1.5%,+20% | `[IDEA]` |
| Redline (thresholds fixed 10/20/30) | — | — | +8% cc / +20% cd / +1 pierce | +10% cc / +25% cd / +1 pierce | +12% cc / +30% cd / +1 pierce | `[IDEA]` Rare+ |

---

## 8. Build queue (locked)

Each its own version-bump ship, Mod-Lab-verified:
0. **Balance push** (§6): Fork proc ↓, Desync cap 50 — quick, on already-shipped mods.
1. **Corruption archetype** — Corruption (Setter) → Rootkit (Transformer) →
   Backdoor (Bridge). Adds the fault-tick hook.
2. **Overclock archetype** — Overclock (Setter) → Nonvolatile (Transformer/retain).
   Adds onWaveStart.
3. **Cascade** (Setter). Adds onLevelUp.

`[IDEA]` rows stay here as room to grow — pull one in when a built archetype wants
depth. Kept "largely as written" per review: **Rootkit, Payload, Quorum,
Nonvolatile**.

---

## 9. Benchmark method (deferred until we can play)

Do NOT keep tuning percentages on paper — tower stats and encounter shapes matter
more now. When we benchmark (after Batch 2 is playable in the Mod Lab):

- **Benchmark rarity = Rare** for every mod.
- **~6–8 representative builds** (Rare pieces):
  - *Corruption:* Corruption + Rootkit
  - *Melt:* Corruption + Backdoor + Exposed
  - *Desync burst:* Desync + Buffer Overflow + Overvolt
  - *Contagion burst:* Desync + Payload + Corruption
  - *Mono:* Array + Cluster + Quorum
  - *Replication:* Fork + Replication + Array
  - *Tempo:* Overclock + Nonvolatile + Redline
  - *Network:* Broadcast + Receiver + Relay
- **5 encounters:** swarm · brutes · sprinters · boss · mixed.
- **Health targets (not equal DPS):** a specialist should be ~**120–140%** of
  baseline in its favored encounter, **90–105%** generally, **65–85%** vs its
  counter. Destroying its favored + also swarm + mixed = something's wrong.
- **The real target is gear opportunity cost:** given you're already building an
  archetype, a Rare Rootkit should feel ~as exciting as a Rare Backdoor / Cluster
  / Nonvolatile. Equal *excitement*, not equal math.

### Observations to benchmark, NOT change yet (from review 2)
- **Corruption's 50-stack cap may be low** — base 50 DPS, Singularity Rootkit → 150
  DPS; whether that matters depends entirely on enemy HP (L19 bosses run into tens
  of millions). Benchmark before touching the cap; the flat-vs-%HP identity fork
  is noted in §5.
- **Payload maxes Corruption almost instantly** — a 50-stack Desync consumed with
  Rare Payload makes ~37 Corruption (Singularity: 50). That's *good* — the bridge
  doubles as an alternative Corruption setter — but confirm the burst isn't oppressive.
- **Fork + Replication** is free capital + free DPS + extra Array count at once
  (Singularity 2.5% + Replication 1.5% = 4%). Explicitly benchmark alongside Array.
