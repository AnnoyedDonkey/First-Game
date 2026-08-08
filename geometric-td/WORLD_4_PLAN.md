# World 4 — SINGULARITY (levels 16–20) — Build Plan

**Status:** approved for execution. Author of specs: orchestrator (Opus).
Executors: sequential cheap Sonnet agents (one phase each). Orchestrator does
the final `version.js` bump + commit + push (Phase 8).

## Goal

Add a 4th campaign world, **SINGULARITY**, of five levels — each level's
geometry + enemy roster spotlight **one tower class**. Difficulty is a notch
above Prism Deep (World 3) but tuned conservatively: no telemetry exists yet,
so ship survivable openers and iterate later via the Balance Lab.

| Level | id | Name | Tower | Why that tower wins |
|-------|----|------|-------|---------------------|
| L16 | level_016 | Photon Weave | **Laser** | Dense serpentine, build tiles beside every track row; fast swarms (energy ×1.3). Laser's cheap high fire-rate shreds them. |
| L17 | level_017 | Tar Pit | **Slow** | Long lanes, fast + armored files. Without slowing the sprint, dwell is too short; Slow + 30% vulnerability turns lanes into kill zones. |
| L18 | level_018 | Splinter Cluster | **Pulse** | Inward spiral bunches enemies at bends; splitter/splitling heavy (pulse ×1.5). Pulse splash (0.7) chains through clusters. |
| L19 | level_019 | Rail Yard | **Railgun** | Long straight lanes; armored + regenerator single-file (rail ×1.6 both). Railgun pierces the file down the lane. |
| L20 | level_020 | No Man's Land | **Rocket** | Blocked core walls off the track — short towers reach only 9.7% of the path. Only Rocket (global range 999) covers it. Boss-heavy finale (blast ×1.3). |

### Design constraints honored
- All maps are 8×12 (every existing level is 8×12).
- Wave 1 of every level is survivable with that level's starting money.
- `damageMult` is **global per enemy type**, so tower spotlighting comes from
  **enemy-type selection + geometry**, never per-level resistances.
- Geometry validated computationally (path straightness, bounds, no
  blocked-on-path, buildable coverage). Coverage results:
  L16 Laser 100% · L17 Slow 100% · L18 Pulse 80% (short 89%) ·
  L19 Railgun 100% · L20 Rocket 100% / short-range only **9.7%**.

---

## Files this world touches

1. **`src/balance-schema.js`** — add the 5 ids to `KNOWN_LEVEL_IDS` (else
   validation rejects the new `levelMilestones`/`worlds` references).
2. **`src/balance-data.json`** (canonical) **and `src/balance-data.js`**
   (generated mirror) — **edit BOTH in lockstep** (see HANDOFF "balance-data
   dual file"): add `levels.level_016..020`, `worlds.world_4`,
   `levelMilestones.level_016..020`.
3. **`src/levels.js`** — add `LEVEL_PRESENTATION` entries (016–020),
   `WORLD_PRESENTATION.world_4`, extend `LEVEL_ID_ORDER` and `WORLD_ID_ORDER`.

No code changes needed for: world unlock (automatic once every previous-world
level is completed), Endless (uses `endlessRewards.defaultTrack`;
`tracksByLevel` stays empty), saves/progression.

### `balance-schema.js` edit
`KNOWN_LEVEL_IDS` becomes 20 ids — append:
```js
  "level_016", "level_017", "level_018", "level_019", "level_020",
```
(Update the "15 campaign level ids" comment to "20".)

### `worlds.world_4` (both data files)
```json
"world_4": { "levelIds": ["level_016","level_017","level_018","level_019","level_020"] }
```

### `levels.js` order arrays
- `LEVEL_ID_ORDER`: append `"level_016","level_017","level_018","level_019","level_020"`.
- `WORLD_ID_ORDER`: append `"world_4"`.

### `WORLD_PRESENTATION.world_4`
```js
world_4: {
  name: "SINGULARITY",
  accent: "#ffd76a",     // gold
  accent2: "#f2f4ff",    // white
  boardStyle: "prism",   // reuse existing style (optional follow-up: a bespoke "singularity" style in renderer)
  nodePos: [
    { x: 50, y: 14 },
    { x: 24, y: 40 },
    { x: 70, y: 60 },
    { x: 30, y: 88 },
    { x: 62, y: 112 },
  ],
},
```

---

## Per-level specifications

Grid is 8 wide (x 0–7) × 12 tall (y 0–11) for all five. `pathCorners` list
the enemy path (straight H/V segments only); the last corner is the AI Core.

Effective enemy HP = baseHealth × group.healthMult × (wave healthMult).
Base HP: basic 20 · fast 11 · armored 60 · regenerator 70 · splitter 42
(+2 splitlings @10) · boss 400.

---

### level_016 — Photon Weave (Laser)

**Params:** `gridWidth:8, gridHeight:12, startingMoney:180, coreHealth:12, bountyMult:0.6`

**pathCorners:**
```json
[{"x":0,"y":1},{"x":7,"y":1},{"x":7,"y":3},{"x":0,"y":3},{"x":0,"y":5},{"x":7,"y":5},{"x":7,"y":7},{"x":0,"y":7},{"x":0,"y":9},{"x":7,"y":9},{"x":7,"y":11}]
```
**blockedTiles:** `[]` (Laser theme = abundant placement)

**Presentation:**
- name: `"Photon Weave"`
- desc: `"A blinding serpentine packed edge to edge. Fast movers pour through — cheap Lasers, planted thick, are made for this."`
- palette:
```js
palette: {
  background: "#14100a",
  gridLine: "rgba(255, 214, 120, 0.08)",
  gridLineMajor: "rgba(255, 214, 120, 0.16)",
  buildableDot: "rgba(255, 226, 140, 0.22)",
  pathChannel: "rgba(40, 32, 10, 0.9)",
  pathEdge: "rgba(255, 214, 120, 0.55)",
  pathFlow: "rgba(255, 240, 180, 0.7)",
}
```
**waves:**
```json
[
 {"groups":[{"type":"fast","count":18,"healthMult":3,"spawnInterval":0.5}]},
 {"groups":[{"type":"basic","count":14,"healthMult":3,"spawnInterval":0.6},{"type":"fast","count":12,"healthMult":3.5,"spawnInterval":0.5,"startDelay":3}]},
 {"groups":[{"type":"fast","count":26,"healthMult":4,"spawnInterval":0.4}]},
 {"groups":[{"type":"basic","count":18,"healthMult":5,"spawnInterval":0.5},{"type":"fast","count":16,"healthMult":4,"spawnInterval":0.45,"startDelay":3}]},
 {"groups":[{"type":"boss","count":1,"healthMult":5},{"type":"fast","count":18,"healthMult":4.5,"spawnInterval":0.4,"startDelay":2}]},
 {"groups":[{"type":"fast","count":32,"healthMult":5,"spawnInterval":0.35,"speedMult":1.1}]},
 {"groups":[{"type":"basic","count":20,"healthMult":7,"spawnInterval":0.45},{"type":"fast","count":18,"healthMult":5,"spawnInterval":0.4,"startDelay":4}]},
 {"groups":[{"type":"fast","count":40,"healthMult":5.5,"spawnInterval":0.3,"speedMult":1.15}]},
 {"groups":[{"type":"boss","count":2,"healthMult":6,"spawnInterval":3},{"type":"fast","count":22,"healthMult":5.5,"spawnInterval":0.35,"startDelay":3}]},
 {"groups":[{"type":"fast","count":30,"healthMult":6,"spawnInterval":0.3,"speedMult":1.2},{"type":"basic","count":18,"healthMult":8,"spawnInterval":0.4,"startDelay":5},{"type":"boss","count":1,"healthMult":7,"startDelay":12}]}
]
```
**milestones:**
```json
[
 {"id":"l16_flawless","label":"Flawless","check":{"clearNoLeaks":true},"reward":{"shards":110,"skillPoints":1}},
 {"id":"l16_purelight","label":"Pure Light","check":{"onlyTowers":["laser"]},"reward":{"shards":130,"skillPoints":1}}
]
```

---

### level_017 — Tar Pit (Slow)

**Params:** `gridWidth:8, gridHeight:12, startingMoney:210, coreHealth:10, bountyMult:0.55`

**pathCorners:**
```json
[{"x":0,"y":0},{"x":2,"y":0},{"x":2,"y":10},{"x":4,"y":10},{"x":4,"y":0},{"x":6,"y":0},{"x":6,"y":11}]
```
**blockedTiles** (outer columns, to concentrate building into the central Slow-overlap pockets):
```json
[{"x":0,"y":1},{"x":0,"y":2},{"x":0,"y":3},{"x":0,"y":4},{"x":0,"y":5},{"x":0,"y":6},{"x":0,"y":7},{"x":0,"y":8},{"x":0,"y":9},{"x":0,"y":10},{"x":7,"y":0},{"x":7,"y":1},{"x":7,"y":2},{"x":7,"y":3},{"x":7,"y":4},{"x":7,"y":5},{"x":7,"y":6},{"x":7,"y":7},{"x":7,"y":8},{"x":7,"y":9},{"x":7,"y":10}]
```
Design note: a Slow tower in column 3 or 5 sits one tile from two lanes at once
(down-col2 & up-col4, or up-col4 & down-col6), so it slows both passes.

**Presentation:**
- name: `"Tar Pit"`
- desc: `"Three long lanes, and everything sprints. Slow it or watch it blow past — a chilled enemy is a dead enemy, and vulnerable too."`
- palette:
```js
palette: {
  background: "#0a0e14",
  gridLine: "rgba(200, 220, 255, 0.08)",
  gridLineMajor: "rgba(200, 220, 255, 0.16)",
  buildableDot: "rgba(220, 235, 255, 0.22)",
  pathChannel: "rgba(16, 26, 40, 0.9)",
  pathEdge: "rgba(200, 220, 255, 0.55)",
  pathFlow: "rgba(235, 245, 255, 0.72)",
}
```
**waves:**
```json
[
 {"groups":[{"type":"fast","count":12,"healthMult":4,"spawnInterval":0.5},{"type":"armored","count":5,"healthMult":2.5,"spawnInterval":0.9,"startDelay":4}]},
 {"groups":[{"type":"fast","count":16,"healthMult":4.5,"spawnInterval":0.45},{"type":"armored","count":8,"healthMult":3,"spawnInterval":0.8,"startDelay":3}]},
 {"groups":[{"type":"fast","count":20,"healthMult":5,"spawnInterval":0.4,"speedMult":1.1},{"type":"armored","count":6,"healthMult":4,"spawnInterval":0.8,"startDelay":4}]},
 {"groups":[{"type":"armored","count":10,"healthMult":5,"spawnInterval":0.7},{"type":"fast","count":20,"healthMult":5,"spawnInterval":0.4,"startDelay":4}]},
 {"groups":[{"type":"boss","count":1,"healthMult":6},{"type":"armored","count":14,"healthMult":4,"spawnInterval":0.7,"startDelay":3}]},
 {"groups":[{"type":"fast","count":26,"healthMult":6,"spawnInterval":0.35,"speedMult":1.2},{"type":"armored","count":10,"healthMult":5,"spawnInterval":0.7,"startDelay":4}]},
 {"groups":[{"type":"armored","count":14,"healthMult":7,"spawnInterval":0.65},{"type":"fast","count":24,"healthMult":6,"spawnInterval":0.35,"startDelay":4}]},
 {"groups":[{"type":"fast","count":30,"healthMult":6.5,"spawnInterval":0.3,"speedMult":1.25},{"type":"armored","count":12,"healthMult":6,"spawnInterval":0.65,"startDelay":4}]},
 {"groups":[{"type":"boss","count":2,"healthMult":7,"spawnInterval":3},{"type":"armored","count":18,"healthMult":6,"spawnInterval":0.6,"startDelay":4}]},
 {"groups":[{"type":"armored","count":16,"healthMult":8,"spawnInterval":0.6},{"type":"fast","count":30,"healthMult":7,"spawnInterval":0.28,"speedMult":1.3,"startDelay":3},{"type":"boss","count":2,"healthMult":8,"startDelay":10}]}
]
```
**milestones:**
```json
[
 {"id":"l17_flawless","label":"Flawless","check":{"clearNoLeaks":true},"reward":{"shards":115,"skillPoints":1}},
 {"id":"l17_deepfreeze","label":"Deep Freeze","check":{"onlyTowers":["slow","laser"]},"reward":{"shards":135,"skillPoints":1}}
]
```

---

### level_018 — Splinter Cluster (Pulse)

**Params:** `gridWidth:8, gridHeight:12, startingMoney:200, coreHealth:10, bountyMult:0.55`

**pathCorners** (inward spiral):
```json
[{"x":0,"y":0},{"x":7,"y":0},{"x":7,"y":11},{"x":1,"y":11},{"x":1,"y":2},{"x":6,"y":2},{"x":6,"y":9},{"x":3,"y":9},{"x":3,"y":5},{"x":5,"y":5}]
```
**blockedTiles:** `[]`

**Presentation:**
- name: `"Splinter Cluster"`
- desc: `"A spiral that packs the swarm tight at every turn. Splitters burst into clusters — Pulse splash turns one shot into a chain reaction."`
- palette:
```js
palette: {
  background: "#100a16",
  gridLine: "rgba(210, 180, 255, 0.08)",
  gridLineMajor: "rgba(210, 180, 255, 0.16)",
  buildableDot: "rgba(225, 200, 255, 0.22)",
  pathChannel: "rgba(30, 18, 44, 0.9)",
  pathEdge: "rgba(210, 180, 255, 0.55)",
  pathFlow: "rgba(235, 215, 255, 0.7)",
}
```
**waves:**
```json
[
 {"groups":[{"type":"splitter","count":8,"healthMult":2.5,"spawnInterval":0.6},{"type":"basic","count":10,"healthMult":3,"spawnInterval":0.5,"startDelay":3}]},
 {"groups":[{"type":"splitter","count":12,"healthMult":3,"spawnInterval":0.55},{"type":"basic","count":8,"healthMult":4,"spawnInterval":0.5,"startDelay":3}]},
 {"groups":[{"type":"splitter","count":16,"healthMult":3.5,"spawnInterval":0.5}]},
 {"groups":[{"type":"splitter","count":10,"healthMult":4,"spawnInterval":0.55},{"type":"splitling","count":20,"healthMult":3,"spawnInterval":0.3,"startDelay":3}]},
 {"groups":[{"type":"boss","count":1,"healthMult":5},{"type":"splitter","count":12,"healthMult":4,"spawnInterval":0.5,"startDelay":3}]},
 {"groups":[{"type":"splitter","count":20,"healthMult":4.5,"spawnInterval":0.45}]},
 {"groups":[{"type":"splitter","count":14,"healthMult":5,"spawnInterval":0.5},{"type":"basic","count":16,"healthMult":6,"spawnInterval":0.4,"startDelay":4}]},
 {"groups":[{"type":"splitter","count":24,"healthMult":5,"spawnInterval":0.4}]},
 {"groups":[{"type":"boss","count":2,"healthMult":6,"spawnInterval":3},{"type":"splitter","count":16,"healthMult":5,"spawnInterval":0.45,"startDelay":3}]},
 {"groups":[{"type":"splitter","count":20,"healthMult":6,"spawnInterval":0.4},{"type":"splitling","count":30,"healthMult":5,"spawnInterval":0.25,"startDelay":4},{"type":"boss","count":2,"healthMult":7,"startDelay":10}]}
]
```
**milestones:**
```json
[
 {"id":"l18_flawless","label":"Flawless","check":{"clearNoLeaks":true},"reward":{"shards":115,"skillPoints":1}},
 {"id":"l18_shockwave","label":"Shockwave","check":{"onlyTowers":["pulse","slow"]},"reward":{"shards":135,"skillPoints":1}}
]
```

---

### level_019 — Rail Yard (Railgun)

**Params:** `gridWidth:8, gridHeight:12, startingMoney:240, coreHealth:12, bountyMult:0.55`

**pathCorners** (comb of long straight lanes: col0 up, col2 down, col4 up, col6 down):
```json
[{"x":0,"y":11},{"x":0,"y":1},{"x":2,"y":1},{"x":2,"y":11},{"x":4,"y":11},{"x":4,"y":1},{"x":6,"y":1},{"x":6,"y":11},{"x":7,"y":11}]
```
**blockedTiles:** `[]`

Design note: enemies march single-file up/down each straight lane. A Railgun
in an adjacent pocket column (1/3/5) aims a vertical pierce line along the lane
and catches up to `pierce` (4+) enemies at once. `spawnInterval ≈ 0.6–0.7`
keeps enemies spaced ~1 tile apart so several sit inside the 3.5-tile beam.
Roster is armored + regenerator (both rail ×1.6) — Laser/Pulse struggle.

**Presentation:**
- name: `"Rail Yard"`
- desc: `"Four long, dead-straight lanes. Line a Railgun down a column and its shot spears the whole file — armor and regen alike fold to rail."`
- palette:
```js
palette: {
  background: "#0c0e10",
  gridLine: "rgba(200, 210, 220, 0.09)",
  gridLineMajor: "rgba(200, 210, 220, 0.18)",
  buildableDot: "rgba(220, 228, 236, 0.24)",
  pathChannel: "rgba(22, 26, 30, 0.9)",
  pathEdge: "rgba(205, 215, 225, 0.6)",
  pathFlow: "rgba(235, 242, 248, 0.74)",
}
```
**waves:**
```json
[
 {"groups":[{"type":"armored","count":8,"healthMult":3,"spawnInterval":0.7}]},
 {"groups":[{"type":"regenerator","count":6,"healthMult":3,"spawnInterval":0.75},{"type":"armored","count":6,"healthMult":3,"spawnInterval":0.7,"startDelay":4}]},
 {"groups":[{"type":"armored","count":12,"healthMult":4,"spawnInterval":0.6}]},
 {"groups":[{"type":"regenerator","count":10,"healthMult":4,"spawnInterval":0.65}]},
 {"groups":[{"type":"boss","count":1,"healthMult":6},{"type":"armored","count":8,"healthMult":4,"spawnInterval":0.65,"startDelay":3}]},
 {"groups":[{"type":"armored","count":14,"healthMult":5,"spawnInterval":0.6},{"type":"regenerator","count":8,"healthMult":5,"spawnInterval":0.65,"startDelay":4}]},
 {"groups":[{"type":"regenerator","count":12,"healthMult":6,"spawnInterval":0.6}]},
 {"groups":[{"type":"armored","count":16,"healthMult":6,"spawnInterval":0.55},{"type":"regenerator","count":10,"healthMult":5,"spawnInterval":0.6,"startDelay":4}]},
 {"groups":[{"type":"boss","count":2,"healthMult":7,"spawnInterval":3},{"type":"armored","count":12,"healthMult":6,"spawnInterval":0.55,"startDelay":3}]},
 {"groups":[{"type":"regenerator","count":14,"healthMult":7,"spawnInterval":0.55},{"type":"armored","count":16,"healthMult":7,"spawnInterval":0.5,"startDelay":4},{"type":"boss","count":2,"healthMult":8,"startDelay":10}]}
]
```
**milestones:**
```json
[
 {"id":"l19_flawless","label":"Flawless","check":{"clearNoLeaks":true},"reward":{"shards":120,"skillPoints":1}},
 {"id":"l19_sharpshooter","label":"Sharpshooter","check":{"onlyTowers":["railgun","slow"]},"reward":{"shards":140,"skillPoints":1}}
]
```

---

### level_020 — No Man's Land (Rocket)  *(World 4 finale)*

**Params:** `gridWidth:8, gridHeight:12, startingMoney:260, coreHealth:12, bountyMult:0.5`

**pathCorners:**
```json
[{"x":3,"y":0},{"x":3,"y":3},{"x":6,"y":3},{"x":6,"y":10},{"x":1,"y":10},{"x":1,"y":4},{"x":4,"y":4},{"x":4,"y":7}]
```
**blockedTiles** (walls off the interior; only the top two rows stay buildable — short towers reach 9.7% of the path, Rocket reaches 100%):
```json
[{"x":0,"y":2},{"x":0,"y":3},{"x":0,"y":4},{"x":0,"y":5},{"x":0,"y":6},{"x":0,"y":7},{"x":0,"y":8},{"x":0,"y":9},{"x":0,"y":10},{"x":0,"y":11},{"x":1,"y":2},{"x":1,"y":3},{"x":1,"y":11},{"x":2,"y":2},{"x":2,"y":3},{"x":2,"y":5},{"x":2,"y":6},{"x":2,"y":7},{"x":2,"y":8},{"x":2,"y":9},{"x":2,"y":11},{"x":3,"y":5},{"x":3,"y":6},{"x":3,"y":7},{"x":3,"y":8},{"x":3,"y":9},{"x":3,"y":11},{"x":4,"y":2},{"x":4,"y":8},{"x":4,"y":9},{"x":4,"y":11},{"x":5,"y":2},{"x":5,"y":4},{"x":5,"y":5},{"x":5,"y":6},{"x":5,"y":7},{"x":5,"y":8},{"x":5,"y":9},{"x":5,"y":11},{"x":6,"y":2},{"x":6,"y":11},{"x":7,"y":2},{"x":7,"y":3},{"x":7,"y":4},{"x":7,"y":5},{"x":7,"y":6},{"x":7,"y":7},{"x":7,"y":8},{"x":7,"y":9},{"x":7,"y":10},{"x":7,"y":11}]
```
Buildable = the 14 tiles in rows y0–y1 that aren't the col-3 entry
(`0,0 1,0 2,0 4,0 5,0 6,0 7,0 0,1 1,1 2,1 4,1 5,1 6,1 7,1`). A Laser/Slow beside
the col-3 entry handles the opener; Rockets anywhere in the pocket reach the
deep interior. **Verify wave 1 is clearable from this pocket before sign-off.**

**Presentation:**
- name: `"No Man's Land"`
- desc: `"The track vanishes into a sealed core no ground tower can touch. Only the Rocket's reach crosses the void — and the void is full of bosses."`
- palette:
```js
palette: {
  background: "#12100a",
  gridLine: "rgba(255, 235, 170, 0.10)",
  gridLineMajor: "rgba(255, 245, 210, 0.20)",
  buildableDot: "rgba(255, 240, 190, 0.26)",
  pathChannel: "rgba(34, 28, 12, 0.9)",
  pathEdge: "rgba(255, 235, 170, 0.6)",
  pathFlow: "rgba(255, 250, 225, 0.8)",
}
```
**waves** (12; boss-heavy gauntlet finale):
```json
[
 {"groups":[{"type":"splitter","count":6,"healthMult":3,"spawnInterval":0.6},{"type":"basic","count":8,"healthMult":3,"spawnInterval":0.5,"startDelay":3}]},
 {"groups":[{"type":"splitter","count":10,"healthMult":3.5,"spawnInterval":0.55},{"type":"boss","count":1,"healthMult":4,"startDelay":4}]},
 {"groups":[{"type":"splitter","count":14,"healthMult":4,"spawnInterval":0.5}]},
 {"groups":[{"type":"boss","count":2,"healthMult":5,"spawnInterval":3},{"type":"splitter","count":12,"healthMult":4,"spawnInterval":0.5,"startDelay":3}]},
 {"groups":[{"type":"splitter","count":20,"healthMult":4.5,"spawnInterval":0.4},{"type":"splitling","count":20,"healthMult":4,"spawnInterval":0.3,"startDelay":3}]},
 {"groups":[{"type":"boss","count":3,"healthMult":6,"spawnInterval":3},{"type":"splitter","count":14,"healthMult":4.5,"spawnInterval":0.45}]},
 {"groups":[{"type":"splitter","count":24,"healthMult":5,"spawnInterval":0.4},{"type":"boss","count":1,"healthMult":7,"startDelay":6}]},
 {"groups":[{"type":"boss","count":4,"healthMult":6,"spawnInterval":2.5},{"type":"splitter","count":18,"healthMult":5,"spawnInterval":0.45,"startDelay":4}]},
 {"groups":[{"type":"splitling","count":30,"healthMult":5,"spawnInterval":0.25},{"type":"splitter","count":16,"healthMult":5.5,"spawnInterval":0.45,"startDelay":3},{"type":"boss","count":2,"healthMult":7,"startDelay":8}]},
 {"groups":[{"type":"boss","count":4,"healthMult":7,"spawnInterval":2.5,"speedMult":1.1},{"type":"splitter","count":20,"healthMult":5.5,"spawnInterval":0.4,"startDelay":4}]},
 {"groups":[{"type":"splitling","count":40,"healthMult":5.5,"spawnInterval":0.22},{"type":"splitter","count":20,"healthMult":6,"spawnInterval":0.4,"startDelay":4},{"type":"boss","count":3,"healthMult":7,"startDelay":10}]},
 {"groups":[{"type":"boss","count":6,"healthMult":8,"spawnInterval":4},{"type":"splitter","count":24,"healthMult":6,"spawnInterval":0.4,"startDelay":5},{"type":"splitling","count":30,"healthMult":6,"spawnInterval":0.2,"speedMult":1.2,"startDelay":12},{"type":"boss","count":2,"healthMult":9,"startDelay":20}]}
]
```
**milestones:**
```json
[
 {"id":"l20_flawless","label":"Flawless","check":{"clearNoLeaks":true},"reward":{"shards":140,"skillPoints":1}},
 {"id":"l20_orbital","label":"Orbital Only","check":{"onlyTowers":["rocket"]},"reward":{"shards":160,"skillPoints":1}}
]
```

---

## Phase breakdown (executors)

Agents run **sequentially** — Phases 1–6 all edit `balance-data.json` +
`.js`, so parallel runs would collide. Each agent must re-read the two data
files, make its edit, and verify before finishing. **No `version.js` bump and
no commit/push in any executor phase** — that is Phase 8 (orchestrator) only.

**Phase 1 — Infra scaffold.**
- `balance-schema.js`: append the 5 ids to `KNOWN_LEVEL_IDS` (+comment).
- Both data files: add `worlds.world_4`; add `levels.level_016..020` and
  `levelMilestones.level_016..020` **as complete entries from this doc**
  (do all five here so later phases only *tune*, not *create* — simplest for
  lockstep). Actually simpler split: Phase 1 adds `world_4`, the schema ids,
  and five **valid minimal** level stubs (real params + pathCorners +
  blockedTiles from this doc, a 1-wave placeholder `[{"groups":[{"type":"basic","count":5,"healthMult":1}]}]`,
  empty `[]` milestones). Phases 2–6 fill the real waves + milestones + presentation.
- `levels.js`: add all five `LEVEL_PRESENTATION` entries (name/desc/palette),
  `WORLD_PRESENTATION.world_4`, extend both order arrays.
- **Verify:** `serve.ps1` runs; open the game; `window.WORLDS.length === 4`;
  schema validation passes (load the Balance Lab or call the validator); menu
  shows a 4th world board with 5 nodes; no console errors.

**Phases 2–6 — one level each (016 → 020).** For its level:
- Replace the placeholder `waves` (both data files, lockstep) with this doc's
  full wave array; set its `levelMilestones` entry.
- **Verify (state/DOM only — never capture the canvas, per HANDOFF):**
  reload the page first (module/roster contamination). Load the level via the
  module API; assert `game.grid` path expands (no throw), the theme tower can
  be *placed* on a buildable tile and its range overlaps ≥1 path tile, and
  wave 1 is survivable (step through it with a couple of towers and confirm the
  core isn't lost). Console clean.

**Phase 7 — Cross-level QA.**
- All 20 levels load; `LEVELS.length === 20`; schema passes; `WORLDS.length === 4`.
- World-4 lock/unlock: with world_3 incomplete, world_4 is locked; simulate
  world_3 completion → world_4 unlocks.
- Menu board renders 5 nodes; Endless is offered per new level after a clear.
- Save round-trip: existing save still loads; no new required save fields.

**Phase 8 — Orchestrator (Opus).** Review the full diff; bump
`src/version.js` `APP_VERSION`; commit; push (deploys to GitHub Pages for
phone testing).

## Verification helpers
- `window.game`, `window.step(seconds)`, `window.checkEndState()`.
- `window.LEVELS`, `window.WORLDS` (if exported) or import in console.
- Reload before every isolated placement/survivability check.
- Do **not** screenshot/export the canvas; assert on state/DOM/logic only.
