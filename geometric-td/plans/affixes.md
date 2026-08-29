# Geometric TD — Affix Gear System Requirements

**Version:** 0.1  
**Status:** Initial implementation / gameplay testing

## 1. Objective

Extend the existing Geometric TD gear system so gear can contain **Affixes** that materially change tower and enemy behavior.

Affix gear should be obtainable through the game's existing progression mechanisms, including:

- Gear earned during or after levels
- Gear available through existing purchase mechanisms
- Existing gear inventory/equipment systems

The immediate goal is **gameplay experimentation**.

We want to be able to create, equip, tune, and test new affixes without restructuring the combat system every time a new mechanic is introduced.

This system will eventually support a roguelike mode, but **do not build the roguelike mode as part of this work**.

The priority is creating a flexible affix foundation that can later be reused by the roguelike.

---

# 2. Terminology

Affixes fall broadly into two categories.

## Faults

Faults are effects placed on enemies.

Initial examples:

- Desync
- Throttle
- Exposed

Potential future examples:

- Corruption
- Fatal Error
- other status effects

Faults generally track information such as:

- stacks
- duration
- source tower type
- source affix strength
- thresholds

## Protocols

Protocols affect towers or the player's tower network.

Initial examples:

- Array
- Fork
- Broadcast

Potential future examples:

- Sync
- Relay
- Linked
- Duplicate

This distinction should be reflected where useful in the underlying architecture.

---

# 3. Core Architecture

Affixes must be **data-driven**.

Do not individually hard-code every affix throughout tower and combat logic.

An affix definition should contain information conceptually similar to:

```js
{
  id: "array",
  name: "Array",
  category: "protocol",
  description: "...",
  power: 0.07
}
```

Exact architecture should follow existing project conventions.

The important requirement is that adding a new simple affix should normally require:

1. Creating/registering its definition.
2. Implementing/registering its behavior.

It should NOT require modifying every tower class.

---

# 4. Gear Integration

Existing gear should be extended to support zero or more affixes.

Conceptually:

```js
gear = {
  ...
  affixes: [
    {
      id: "array",
      power: 0.07
    }
  ]
}
```

Existing gear without affixes must continue functioning normally.

Treat missing affixes as:

```js
affixes: []
```

The architecture must support multiple affixes on one gear item even if initial gear generation normally creates only one.

For example, this should eventually be representable:

```text
Rare Processor

Array +7%
Fork 3%
```

---

# 5. Affix Power and Gear Rarity

The same affix can appear at different power levels.

Higher-rarity gear should generally provide stronger versions of an affix.

Do NOT hard-code one universal strength for each affix.

For example:

```text
Common Array
+3%

Uncommon Array
+5%

Rare Array
+7%

Epic Array
+9%

Legendary Array
+12%
```

Initial proposed values:

| Rarity | Desync | Array | Fork | Broadcast Damage / Fire Rate / Range | Broadcast Crit |
|---|---:|---:|---:|---:|---:|
| Common | +1%/stack | +3%/tower | 1% | +8% | +4 percentage points |
| Uncommon | +1.5%/stack | +5%/tower | 2% | +12% | +6 pp |
| Rare | +2%/stack | +7%/tower | 3% | +16% | +8 pp |
| Epic | +2.5%/stack | +9%/tower | 4% | +20% | +10 pp |
| Legendary | +3%/stack | +12%/tower | 5% | +25% | +12 pp |

These are **initial testing values**, not final balance decisions.

All values should live in configuration and be easy to change.

---

# 6. Store Rolled Affix Power on Gear

Gear should store the actual rolled affix strength.

For example:

```js
{
  rarity: "rare",
  affixes: [
    {
      id: "array",
      power: 0.07
    }
  ]
}
```

Do NOT derive the affix strength from rarity every time the item is loaded.

This is important because we may eventually introduce variable rolls.

For example:

```text
Rare Array:
+6% to +8%
```

Two Rare Array items could eventually therefore have:

```text
Rare Array +6.3%
Rare Array +7.8%
```

Variable rolls do NOT need to be implemented now.

The data model simply needs to support them later without requiring a save-format redesign.

---

# 7. Event / Hook System

Affixes will eventually react to many different gameplay events.

The architecture should therefore provide reusable hooks/events where appropriate.

Potential events include:

- attack
- projectile fired
- hit
- critical hit
- kill
- enemy death
- Fault applied
- Fault consumed
- Fault tick
- tower placed
- tower sold
- tower removed
- tower upgraded
- wave start
- wave end

Avoid spreading logic such as:

```js
if (tower.hasArray) ...
if (tower.hasFork) ...
if (tower.hasDesync) ...
```

throughout unrelated combat systems.

Use the project's existing event architecture if one already exists.

---

# 8. Generic Fault System

Enemies should support multiple simultaneous Faults.

Conceptually:

```js
enemy.faults = {
  desync: {
    stacks: 8,
    towerType: "laser",
    powerPerStack: 0.02
  },

  throttle: {
    stacks: 4
  },

  exposed: {
    stacks: 3
  }
}
```

Exact implementation may differ.

The Fault system should be capable of supporting:

- adding stacks
- removing stacks
- consuming all stacks
- stack caps
- durations
- permanent Faults
- ticking Faults
- querying whether an enemy has a Fault
- querying stack counts
- querying number of unique Faults
- clearing Faults
- reacting when Faults are applied
- reacting when Faults are consumed
- reacting when thresholds are reached
- storing additional Fault-specific metadata when required

---

# 9. DESYNC

## Purpose

Desync rewards attacking an enemy repeatedly with one tower type and then switching to another tower type for a payoff.

It is fundamentally a **tower sequencing mechanic**.

---

## Starting Desync

If an enemy does not currently have Desync:

> The first hit from a tower carrying the Desync affix creates 1 Desync stack.

Example:

```text
Laser with Desync hits enemy.

Desync: 1
Tower type: Laser
```

The first hit counts as stack 1.

---

## Same Tower Type

Additional attacks from the SAME tower type add Desync.

The exact tower instance does not matter.

Example:

```text
Laser A hits → Desync 1
Laser B hits → Desync 2
Laser C hits → Desync 3
Laser A hits → Desync 4
```

All are Lasers, so Desync continues accumulating.

---

## Different Tower Type

When an enemy with Desync is hit by a DIFFERENT tower type:

1. Consume all existing Desync stacks.
2. Increase the damage of that hit based on the accumulated Desync.
3. Clear the previous Desync sequence.
4. If the new attacking tower also carries Desync, immediately begin a new sequence with 1 stack belonging to the new tower type.

Formula:

```text
bonus damage % =
Desync stacks × active Desync power
```

Example:

Enemy:

```text
Desync: 10
Tower type: Laser
Power: +2% per stack
```

Rocket hits.

The Rocket receives:

```text
10 × 2% = +20% damage
```

Therefore:

```text
Rocket damage × 1.20
```

The Laser Desync is consumed.

---

## New Attacker Also Has Desync

If the Rocket also carries Desync:

```text
Old Laser Desync consumed.

Rocket hit receives Desync bonus.

New state:
Desync: 1
Tower type: Rocket
```

If the Rocket does NOT carry Desync:

```text
Old Laser Desync consumed.

Enemy now has no Desync.
```

---

# 10. Multiple Desync Strengths

Different towers of the same type may have different strengths of Desync.

Example:

```text
Laser A:
Desync +1%

Laser B:
Desync +2%
```

Laser A attacks first:

```text
Desync 1 @ 1%
```

Laser B attacks next.

Because Laser is still the same tower type:

```text
Desync 2
```

The active Desync strength should become the strongest Desync that has participated in the current sequence:

```text
Desync 2 @ 2%
```

A weaker Desync tower should NEVER reduce the active Desync strength.

Therefore:

```text
Laser B (+2%)
Laser A (+1%)
Laser A (+1%)
```

results in:

```text
Desync 3 @ 2%
```

---

# 11. Desync Enemy Data

Desync requires more than a generic stack count.

It needs to remember at minimum:

```js
{
  stacks: 8,
  towerType: "laser",
  powerPerStack: 0.02
}
```

This information should be inspectable through developer/debug tools.

---

# 12. ARRAY

## Purpose

Array rewards players for specializing heavily in one tower type and placing many copies of that tower.

Array is a **tower-network Protocol**, not an enemy Fault.

---

## Basic Array Behavior

A tower carrying Array activates Array for ALL towers of its type.

The Array-equipped tower is included in the tower count.

Formula:

```text
Array damage bonus =
number of towers of this type
×
effective Array power
```

Example:

Player has:

```text
6 Laser towers
```

One Laser carries:

```text
Array +5%
```

Every Laser receives:

```text
6 × 5% = +30% damage
```

This applies to ALL six Lasers, not only the Laser carrying Array.

---

# 13. Multiple Array Sources

Multiple towers of the same type may carry Array gear.

When this happens:

1. Find the strongest Array affix among that tower type.
2. Add +1 percentage point to the Array power for every additional same-type tower carrying Array.

Formula:

```text
baseArrayPower =
strongest active Array

additionalArraySources =
number of additional same-type towers carrying Array

effectiveArrayPower =
baseArrayPower + (additionalArraySources × 1%)

finalArrayDamageBonus =
numberOfSameTypeTowers × effectiveArrayPower
```

IMPORTANT:

The additional +1% increases the **per-tower Array power**.

It is NOT added to the final damage bonus afterward.

---

# 14. Array Examples

## Example 1

Three Lasers.

One has:

```text
Array +5%
```

Effective Array:

```text
5%
```

Tower count:

```text
3
```

Each Laser receives:

```text
3 × 5% = +15% damage
```

---

## Example 2

Three Lasers.

```text
Laser A: Array +5%
Laser B: Array +7%
Laser C: no Array
```

Strongest Array:

```text
7%
```

Additional Array sources:

```text
1
```

Additional power:

```text
+1%
```

Effective Array:

```text
8%
```

Three Lasers:

```text
3 × 8% = +24%
```

Therefore:

> ALL three Lasers receive +24% damage.

---

## Example 3

Six Lasers.

Three carry:

```text
Array +3%
Array +5%
Array +7%
```

Strongest:

```text
7%
```

Two additional Array sources:

```text
+2%
```

Effective Array:

```text
9%
```

Six Lasers:

```text
6 × 9% = +54%
```

ALL six Lasers receive:

> +54% damage.

---

# 15. Array Is Tower-Type Specific

Array calculations are independent for each tower type.

Example:

Player has:

```text
6 Lasers
3 Rockets
```

Effective Laser Array:

```text
8%
```

Effective Rocket Array:

```text
5%
```

Results:

```text
Lasers:
6 × 8% = +48%

Rockets:
3 × 5% = +15%
```

Laser Array must never strengthen Rockets or vice versa.

---

# 16. Dynamic Array Recalculation

Array must recalculate whenever relevant battlefield state changes.

Examples:

- tower placed
- tower sold
- tower removed
- Array gear equipped
- Array gear unequipped
- Array gear changed
- tower type changed, if supported

Do NOT permanently modify tower base damage.

Array should be part of the effective-stat modifier calculation.

---

# 17. FORK

## Purpose

Fork rewards tower replication and board growth.

When a tower carrying Fork kills an enemy:

> It has a configurable percentage chance to create a free lower-level tower of the same type nearby.

Initial values by rarity are listed in the rarity table above.

---

## Fork Rules

- Spawn only in a legal available tower position.
- Prefer a nearby legal position.
- Never overwrite another tower.
- Never spawn outside permitted build locations.
- Player pays no currency.
- Spawned tower is the same tower type.
- Spawned tower should be internally identifiable as Fork-created.
- Spawned tower does NOT inherit the parent's gear.
- Therefore it does NOT inherit Fork unless it independently receives Fork gear through some future mechanic.
- Spawned tower should be one in-level upgrade level below the parent.
- Minimum spawned level is Level 1.
- If no valid position exists, nothing happens.
- Do not queue the spawn for later.

If tower mastery exists independently from in-level upgrades, preserve the normal mastery rules.

"Lower level" refers to the tower's current in-level upgrade level.

---

# 18. BROADCAST

## Purpose

Broadcast rewards positioning and support-oriented tower networks.

A tower carrying Broadcast creates an aura affecting nearby towers.

Broadcast should be implemented as a reusable aura system rather than four unrelated mechanics.

---

# 19. Initial Broadcast Types

Implement four initial Broadcast affixes.

## Damage Broadcast

Nearby towers receive increased damage.

Initial values depend on rarity.

Example:

```text
Rare Damage Broadcast:
Nearby towers deal +16% damage.
```

---

## Fire Rate Broadcast

Nearby towers receive increased firing rate.

Example:

```text
Rare Fire Rate Broadcast:
Nearby towers fire +16% faster.
```

---

## Critical Broadcast

Nearby towers receive increased critical-hit chance.

This should use percentage points rather than multiplying existing crit chance.

Example:

```text
Rare Critical Broadcast:
Nearby towers gain +8 percentage points critical chance.
```

---

## Range Broadcast

Nearby towers receive increased range.

Example:

```text
Rare Range Broadcast:
Nearby towers gain +16% range.
```

---

# 20. Broadcast Rules

- Aura radius must be configurable.
- The source tower does not buff itself unless explicitly configured to do so.
- Aura bonuses disappear immediately when the source tower is removed/sold.
- Towers leaving the aura lose the bonus.
- Towers entering the aura gain the bonus.
- For initial testing, multiple Broadcast effects of the same type stack additively.
- Stacking behavior should be configurable later.
- Broadcast must never permanently overwrite base tower stats.
- Display the Broadcast radius when the source tower is selected.

---

# 21. THROTTLE

## Purpose

Throttle is a movement-control Fault.

Attacks from a tower carrying Throttle apply Throttle stacks.

Initial proposed behavior:

```text
1 stack per qualifying hit
-2% movement speed per stack
maximum slow: 50%
```

These numbers are placeholders and should be configurable.

Do NOT permanently modify enemy base speed.

Enemy effective movement speed should be calculated from its base speed and active modifiers so removing Throttle correctly restores speed.

Bosses may eventually require separate control-effect caps, but this does not need to be finalized yet.

---

# 22. EXPOSED

## Purpose

Exposed is a support Fault that amplifies damage from all towers.

Initial proposed behavior:

```text
+1 Exposed per qualifying hit
+2% damage taken per stack
maximum 20 stacks
```

Therefore maximum initial amplification:

```text
+40% damage
```

These values are placeholders.

Damage amplification must occur through a centralized damage calculation so every tower and relevant damage source interacts with Exposed consistently.

---

# 23. CORRUPTION — PROVISIONAL

Do NOT implement Corruption yet unless specifically requested.

We previously considered:

- Data Leak
- Overheat
- Corruption

as stacking damage mechanics.

They currently feel too mechanically similar.

Data Leak and Overheat have been removed from the initial implementation.

Corruption remains a potential future Fault because it fits the game's AI/computer theme well, but it needs a more distinctive mechanic before implementation.

Leave architectural room for it.

---

# 24. Removed Affixes

The following should NOT be implemented as part of this version:

- Data Leak
- Overheat

They may be revisited later if sufficiently differentiated mechanics are developed.

---

# 25. Effective Stat Calculation

Do not permanently overwrite tower base statistics when Protocols or other temporary modifiers are applied.

Maintain a distinction between:

```text
Base stat
Permanent progression
Gear stat modifiers
Protocol modifiers
Aura modifiers
Situational modifiers
Final effective stat
```

Conceptually:

```text
Base Damage
× permanent progression
× normal gear
× Array
× Broadcast
× situational modifiers
= Effective Damage
```

The exact order of operations should be centralized and documented.

This is important to prevent bugs when:

- equipment changes
- towers enter/leave Broadcast
- Array sources disappear
- temporary effects expire

---

# 26. Stacking Rules

Different affixes should be capable of operating simultaneously.

For example:

```text
Tower:
Array +7%
Fork 3%
```

Same-affix stacking must be configurable because different affixes require different rules.

Possible stacking modes include:

- additive
- multiplicative
- strongest only
- strongest + secondary contribution
- non-stacking
- capped

Array is an example of a custom stacking rule:

```text
strongest value +1% per additional source
```

Do not assume every affix stacks identically.

---

# 27. Gear Acquisition

Affix gear should participate in the existing gear acquisition systems.

This includes:

- gear earned during/after levels
- gear purchase systems
- other existing gear-generation mechanisms where appropriate

For initial testing, carefully balanced drop probabilities are NOT required.

Affix gear should appear frequently enough to test.

---

# 28. Gear UI

Gear descriptions must display:

- affix name
- actual rolled power
- concise description of behavior

Examples:

```text
ARRAY +7%

All towers of this type gain +7% damage for every tower of this type on the battlefield.

Additional towers of this type carrying Array increase Array power by +1% each.
```

Example:

```text
DESYNC +2%

Consecutive hits from this tower type build Desync.

A hit from another tower type consumes Desync and deals +2% damage per stack.
```

Example:

```text
FORK 3%

Kills have a 3% chance to create a free lower-level copy of this tower nearby.
```

---

# 29. Debug / Testing Tools

Testing support is a major requirement.

Do NOT require normal random loot acquisition to test individual affixes.

Provide an existing or new developer mechanism capable of generating specific affix gear.

It should support selecting both:

- affix
- affix power

Examples:

```text
Spawn Desync +1%
Spawn Desync +2%
Spawn Desync +3%

Spawn Array +3%
Spawn Array +7%
Spawn Array +12%

Spawn Fork 1%
Spawn Fork 3%
Spawn Fork 5%

Spawn Damage Broadcast +8%
Spawn Damage Broadcast +25%
```

This can be implemented through:

- developer menu
- console commands
- existing debug interface
- another appropriate project convention

---

# 30. Debug Enemy Inspection

Provide a way to inspect active enemy Faults.

Example:

```text
ENEMY #23

HP: 1,280

Desync:
Stacks: 12
Tower Type: Laser
Power: +2% per stack
Next different-type hit: +24%

Throttle:
Stacks: 7
Movement penalty: -14%

Exposed:
Stacks: 4
Damage taken: +8%
```

Developer-only UI is acceptable.

---

# 31. Debug Array Inspection

Provide a way to inspect Array calculations.

Example:

```text
LASER ARRAY

Laser count: 6

Array sources: 3

Strongest source:
+7%

Additional sources:
+2%

Effective Array:
+9% per Laser

Final Laser damage bonus:
6 × 9% = +54%
```

This will be particularly important when validating Array behavior.

---

# 32. Minimal Visual Feedback

Do not spend significant development time on final visual effects yet.

We do need enough feedback to understand what is happening.

Faults should have some inspectable indication such as:

- status icon
- small status marker
- abbreviated label
- debug display

Broadcast should show its aura radius when selected.

Fork should provide simple feedback when a free tower appears.

Polished VFX can come later.

---

# 33. Recursion Protection

Triggered effects must be distinguishable from primary combat events.

The architecture should support contextual information conceptually similar to:

```js
{
  source: tower,
  sourceType: "laser",
  effectId: "desync",
  triggered: true,
  canProc: false
}
```

Exact implementation is up to the developer.

The goal is to prevent future mechanics from accidentally creating recursive loops.

For example:

```text
effect creates attack
→ attack creates effect
→ effect creates attack
→ ...
```

This becomes particularly important when we later implement:

- Duplicate
- Cascade
- Relay
- triggered attacks
- status propagation

Build recursion protection into the foundation now rather than solving it individually later.

---

# 34. Performance

Avoid unnecessarily scanning every enemy and every tower every frame.

Particular areas to watch:

- Broadcast range calculations
- Array tower counts
- Fault updates
- Fork placement searches

Prefer event-driven recalculation and cached state where appropriate.

For example, Array only needs recalculation when relevant tower/equipment state changes.

This becomes especially important because Fork and Array builds may eventually produce unusually large numbers of towers.

---

# 35. Save Compatibility

Existing saves must continue loading.

Gear without affix data should behave as:

```js
affixes: []
```

All newly added fields should have safe defaults.

Older serialized gear must continue functioning normally.

New gear containing affixes must correctly survive:

```text
save
→ quit/reload
→ load
```

including its actual rolled affix power.

---

# 36. Future Mechanics the Architecture Should Support

Do NOT implement these as part of this version.

The architecture should simply avoid making them unnecessarily difficult to add later.

## Sync

Sequential attacks from different tower types create escalating bonuses.

## Duplicate

Attacks/effects can execute additional times.

## Cascade

Applying Faults can cause additional Fault applications.

## Overload

Effects trigger from sufficiently large individual hits.

## Zero-Day

Bonuses against enemies that have not previously been attacked.

## Terminate

Bonuses against low-health enemies.

## Fatal Error

Persistent stacks eventually produce a catastrophic payoff or execution.

## Linked

Towers carrying related Protocols strengthen one another.

## Relay

Broadcast effects can propagate through other towers.

Potential future effects should also include:

- tower sacrifice
- effects triggered by selling towers
- tower-level scaling
- mastery-level scaling
- effects based on number of unique Faults
- Fault spreading on enemy death
- effects based on number of different tower types
- effects based on number of same-type towers
- effects triggered at specific Desync thresholds
- Forked towers inheriting selected properties
- legendary affixes that modify the rules of another affix

---

# 37. Initial Implementation Scope

Implement:

### Faults

1. Desync
2. Throttle
3. Exposed

### Protocols

4. Array
5. Fork
6. Damage Broadcast
7. Fire Rate Broadcast
8. Critical Broadcast
9. Range Broadcast

Do NOT implement yet:

- Data Leak
- Overheat
- Corruption
- Sync
- Duplicate
- Cascade
- Overload
- Zero-Day
- Terminate
- Fatal Error
- Linked
- Relay

---

# 38. Initial Test Gear

Create at least one easily obtainable or developer-spawnable gear item for:

1. Desync
2. Throttle
3. Exposed
4. Array
5. Fork
6. Damage Broadcast
7. Fire Rate Broadcast
8. Critical Broadcast
9. Range Broadcast

Ideally allow multiple rarity/power versions to be spawned for testing.

Placeholder names and art are acceptable.

Mechanics are the priority.

---

# 39. Acceptance Criteria

The initial affix system is ready for testing when:

- Existing gear still works.
- Existing saves still load.
- Gear supports zero or more affixes.
- Affixes store their actual power on the gear item.
- Different rarity levels can produce different affix powers.
- Affix gear can be earned through existing gear reward mechanisms.
- Affix gear can appear in existing purchasing mechanisms.
- Affix gear can be equipped.
- Affix gear can be unequipped.
- Affix gear survives saving/loading.
- Gear UI displays the affix and its actual power.
- Multiple Fault types can coexist on an enemy.
- Desync correctly starts with 1 stack on the first qualifying hit.
- Same-type towers correctly accumulate Desync together.
- Higher-powered same-type Desync sources upgrade the active Desync power.
- Lower-powered sources never downgrade it.
- A different tower type correctly consumes Desync.
- The consuming hit receives the correct damage bonus.
- A consuming tower carrying Desync correctly begins a new sequence with 1 stack.
- Array affects ALL towers of the appropriate type.
- Array includes every same-type tower in its tower count.
- Array uses the strongest Array source.
- Each additional same-type Array source adds +1 percentage point to effective Array power.
- Array calculations update correctly when towers are added/removed.
- Array calculations update correctly when gear changes.
- Fork creates free towers without spending currency.
- Fork creates only legal tower placements.
- Forked towers do not inherit gear.
- All four Broadcast types work.
- Broadcast correctly affects nearby towers.
- Broadcast buffs disappear correctly when the source disappears.
- Throttle correctly modifies and restores movement speed.
- Exposed correctly amplifies incoming damage from all towers.
- Affix strengths can be changed through configuration without rewriting combat logic.
- Specific affix/power combinations can be generated through developer tools.
- Enemy Fault state can be inspected.
- Array calculations can be inspected.
- Triggered effects have recursion protection.

---

# 40. Design Principle

Optimize this implementation for **experimentation and extensibility**.

We expect to:

- add many more affixes
- remove affixes that aren't fun
- change numerical values frequently
- introduce new rarities
- change stacking behavior
- create affixes that interact with other affixes
- create legendary effects that alter underlying rules

Values such as:

- affix power
- application amount
- proc chance
- stack cap
- duration
- aura radius
- aura strength
- slow amount
- replication chance
- rarity values
- stacking behavior

should therefore be configurable rather than scattered throughout combat code.

The goal is that once this foundation exists, adding and testing a new affix becomes a relatively small, safe change rather than a modification of the core tower-defense engine.