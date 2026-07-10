// ============================================================
// LEVEL DATA — add new maps here, no game-logic changes needed.
//
// A level defines:
//   gridWidth / gridHeight  - size of the board in tiles
//   startingMoney           - money at battle start
//   coreHealth              - AI Core hit points
//   timeBetweenWaves        - overrides WAVE_DEFAULTS (optional)
//   autoStartNextWave       - overrides WAVE_DEFAULTS (optional)
//   pathCorners             - the enemy path as corner points; the
//                             code fills in every tile between
//                             corners (segments must be straight
//                             horizontal or vertical lines)
//   blockedTiles            - tiles where nothing can be built
//   waves                   - the wave list (see below)
//
// WAVES — each wave is { groups: [...] } plus optional wave-wide
// multipliers. Each GROUP spawns one run of enemies:
//   type          - "basic" | "fast" | "armored" | "boss"
//   count         - how many enemies
//   spawnInterval - seconds between each spawn (default from config)
//   startDelay    - seconds after wave start before this group begins
//   healthMult    - multiply this group's health (default 1)
//   speedMult     - multiply this group's speed (default 1)
//   bountyMult    - multiply money earned per kill (default 1)
//   xpMult        - multiply tower XP per kill (default 1)
//
// Wave-wide healthMult/speedMult multiply ON TOP of group values,
// so you can scale a whole wave with one number.
// ============================================================

const level001 = {
  id: "level_001",
  name: "First Contact",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 100,
  coreHealth: 20,
  timeBetweenWaves: 6,

  // Enemies enter at the first corner and exit at the last (the AI Core).
  pathCorners: [
    { x: 0, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 4 },
    { x: 1, y: 4 },
    { x: 1, y: 7 },
    { x: 6, y: 7 },
    { x: 6, y: 10 },
    { x: 3, y: 10 },
    { x: 3, y: 11 },
  ],

  blockedTiles: [
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 0, y: 5 },
    { x: 7, y: 5 },
    { x: 4, y: 8 },
    { x: 2, y: 11 },
  ],

  waves: [
    // Wave 1 — gentle introduction
    { groups: [{ type: "basic", count: 8, spawnInterval: 0.9 }] },

    // Wave 2 — more of the same, slightly tighter
    { groups: [{ type: "basic", count: 12, spawnInterval: 0.7 }] },

    // Wave 3 — first fast enemies, arriving after the basics
    { groups: [
      { type: "basic", count: 8, spawnInterval: 0.7 },
      { type: "fast", count: 4, spawnInterval: 0.5, startDelay: 4 },
    ] },

    // Wave 4 — a fast rush
    { groups: [{ type: "fast", count: 12, spawnInterval: 0.45, healthMult: 1.3 }] },

    // Wave 5 — tougher basics escorted by fasts
    { groups: [
      { type: "basic", count: 12, spawnInterval: 0.55, healthMult: 2.4 },
      { type: "fast", count: 6, spawnInterval: 0.5, startDelay: 3, healthMult: 2.0 },
    ] },

    // Wave 6 — first armored enemies
    { groups: [{ type: "armored", count: 9, spawnInterval: 1.1, healthMult: 2.0 }] },

    // Wave 7 — armor up front, fasts sneak in behind
    { groups: [
      { type: "armored", count: 7, spawnInterval: 1.0, healthMult: 2.4 },
      { type: "fast", count: 12, spawnInterval: 0.4, startDelay: 5, healthMult: 2.4 },
    ] },

    // Wave 8 — a long mixed assault
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.4, healthMult: 3.8 },
      { type: "armored", count: 7, spawnInterval: 1.0, startDelay: 4, healthMult: 2.8 },
    ] },

    // Wave 9 — everything at once
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.35, healthMult: 3.0 },
      { type: "armored", count: 10, spawnInterval: 0.85, startDelay: 2, healthMult: 3.0 },
    ] },

    // Wave 10 — the boss, with escorts
    { groups: [
      { type: "boss", count: 1, healthMult: 2.8 },
      { type: "basic", count: 12, spawnInterval: 0.6, startDelay: 3, healthMult: 3.8 },
      { type: "armored", count: 6, spawnInterval: 1.1, startDelay: 8, healthMult: 2.8 },
    ] },
  ],
};

// Level 2 — harder: a SHORTER path (less time to shoot), blocked
// tiles denying the prime inner-corner spots, tighter money, a more
// fragile core, and 12 waves that ramp faster and end with two bosses.
const level002 = {
  id: "level_002",
  name: "Signal Breach",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 90,
  coreHealth: 15,
  timeBetweenWaves: 5,

  pathCorners: [
    { x: 0, y: 2 },
    { x: 5, y: 2 },
    { x: 5, y: 6 },
    { x: 2, y: 6 },
    { x: 2, y: 9 },
    { x: 7, y: 9 },
  ],

  blockedTiles: [
    { x: 1, y: 1 },
    { x: 4, y: 4 },   // denies the prime inner-corner spot...
    { x: 4, y: 5 },   // ...and its neighbor
    { x: 3, y: 7 },
    { x: 6, y: 8 },
    { x: 0, y: 6 },
    { x: 7, y: 3 },
    { x: 2, y: 10 },
  ],

  waves: [
    // 1-2 — no warmup this time
    { groups: [{ type: "basic", count: 10, spawnInterval: 0.7 }] },
    { groups: [
      { type: "basic", count: 10, spawnInterval: 0.6, healthMult: 1.2 },
      { type: "fast", count: 4, spawnInterval: 0.5, startDelay: 3 },
    ] },

    // 3-4 — fast pressure, then early armor
    { groups: [{ type: "fast", count: 12, spawnInterval: 0.4, healthMult: 1.2 }] },
    { groups: [
      { type: "armored", count: 5, spawnInterval: 1.2 },
      { type: "basic", count: 8, spawnInterval: 0.5, startDelay: 2, healthMult: 1.4 },
    ] },

    // 5-6 — sustained mixed assault
    { groups: [
      { type: "basic", count: 12, spawnInterval: 0.5, healthMult: 2.2 },
      { type: "fast", count: 8, spawnInterval: 0.4, startDelay: 3, healthMult: 1.8 },
    ] },
    { groups: [
      { type: "armored", count: 7, spawnInterval: 1.0, healthMult: 1.8 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 4, healthMult: 2.0 },
    ] },

    // 7 — mini-boss checkpoint
    { groups: [
      { type: "boss", count: 1, healthMult: 0.9, speedMult: 1.2 },
      { type: "basic", count: 10, spawnInterval: 0.5, startDelay: 2, healthMult: 2.4 },
    ] },

    // 8-9 — the grind
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.4, healthMult: 3.0 },
      { type: "armored", count: 6, spawnInterval: 1.0, startDelay: 3, healthMult: 2.2 },
    ] },
    { groups: [
      { type: "fast", count: 16, spawnInterval: 0.3, healthMult: 2.4, speedMult: 1.1 },
      { type: "armored", count: 8, spawnInterval: 0.9, startDelay: 2, healthMult: 2.5 },
    ] },

    // 10-11 — heavy armor columns
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.8, healthMult: 2.8 },
      { type: "fast", count: 10, spawnInterval: 0.35, startDelay: 5, healthMult: 2.8 },
    ] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 3.8 },
      { type: "armored", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 3.0 },
    ] },

    // 12 — twin bosses with escorts
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 1.8 },
      { type: "armored", count: 6, spawnInterval: 1.0, startDelay: 3, healthMult: 2.8 },
      { type: "fast", count: 10, spawnInterval: 0.4, startDelay: 10, healthMult: 2.8 },
    ] },
  ],
};

// Level 3 — "Dark Relay": the path hugs the map edges, so towers only
// cover it from one side; the juicy center is mostly walled off.
// Waves lean on armor. Designed for players with a leveled roster.
const level003 = {
  id: "level_003",
  name: "Dark Relay",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 90,
  coreHealth: 12,
  timeBetweenWaves: 5,

  pathCorners: [
    { x: 7, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 5 },
  ],

  blockedTiles: [
    { x: 3, y: 4 }, { x: 4, y: 4 },
    { x: 4, y: 5 }, { x: 3, y: 6 },
    { x: 4, y: 6 }, { x: 2, y: 3 },
    { x: 5, y: 8 }, { x: 7, y: 7 },
    { x: 0, y: 11 },
  ],

  waves: [
    { groups: [{ type: "basic", count: 12, spawnInterval: 0.6, healthMult: 1.6 }] },
    { groups: [
      { type: "basic", count: 10, spawnInterval: 0.5, healthMult: 2 },
      { type: "fast", count: 6, spawnInterval: 0.4, startDelay: 3, healthMult: 1.7 },
    ] },
    { groups: [{ type: "armored", count: 6, spawnInterval: 1.1, healthMult: 1.8 }] },
    { groups: [
      { type: "fast", count: 14, spawnInterval: 0.35, healthMult: 2.6 },
      { type: "basic", count: 10, spawnInterval: 0.5, startDelay: 4, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "armored", count: 8, spawnInterval: 1.0, healthMult: 2.9 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 4, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 1.7, speedMult: 1.2 },
      { type: "basic", count: 12, spawnInterval: 0.45, startDelay: 2, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 4.6 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 3, healthMult: 3.6 },
    ] },
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.3, healthMult: 3.8, speedMult: 1.1 },
      { type: "armored", count: 8, spawnInterval: 0.85, startDelay: 2, healthMult: 4.2 },
    ] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.7, healthMult: 4.6 },
      { type: "fast", count: 10, spawnInterval: 0.35, startDelay: 6, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "basic", count: 22, spawnInterval: 0.3, healthMult: 6 },
      { type: "armored", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 5 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 7, healthMult: 2.4 },
      { type: "armored", count: 8, spawnInterval: 0.9, startDelay: 3, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 3.4 },
      { type: "fast", count: 14, spawnInterval: 0.35, startDelay: 4, healthMult: 4.8 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 10, healthMult: 5.3 },
    ] },
  ],
};

// Level 4 — "Split Second": a brutally SHORT path. Towers get very
// little time per enemy; slow towers and kill-zone stacking are
// almost mandatory. Fast enemies everywhere.
const level004 = {
  id: "level_004",
  name: "Split Second",
  gridWidth: 8,
  gridHeight: 12,
  // Generous opening money: the short path demands instant density.
  startingMoney: 150,
  coreHealth: 10,
  timeBetweenWaves: 5,

  pathCorners: [
    { x: 3, y: 0 },
    { x: 3, y: 4 },
    { x: 5, y: 4 },
    { x: 5, y: 8 },
    { x: 2, y: 8 },
    { x: 2, y: 11 },
  ],

  blockedTiles: [
    { x: 4, y: 3 }, { x: 4, y: 5 },
    { x: 4, y: 6 }, { x: 3, y: 9 },
    { x: 1, y: 5 }, { x: 6, y: 6 },
    { x: 0, y: 9 }, { x: 6, y: 1 },
  ],

  waves: [
    { groups: [{ type: "basic", count: 12, spawnInterval: 0.55, healthMult: 1.4 }] },
    { groups: [{ type: "fast", count: 10, spawnInterval: 0.4, healthMult: 1.6 }] },
    { groups: [
      { type: "basic", count: 12, spawnInterval: 0.45, healthMult: 2.2 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 3, healthMult: 1.8 },
    ] },
    { groups: [
      { type: "armored", count: 7, spawnInterval: 0.9, healthMult: 2.2 },
      { type: "fast", count: 8, spawnInterval: 0.3, startDelay: 4, healthMult: 2.4 },
    ] },
    { groups: [{ type: "fast", count: 20, spawnInterval: 0.25, healthMult: 2.6, speedMult: 1.1 }] },
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.35, healthMult: 3.6 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 3, healthMult: 2.9 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 1.6, speedMult: 1.3 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 2, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.7, healthMult: 3.4 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 5, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "fast", count: 24, spawnInterval: 0.22, healthMult: 3.6, speedMult: 1.15 },
      { type: "basic", count: 14, spawnInterval: 0.4, startDelay: 3, healthMult: 4.8 },
    ] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.65, healthMult: 4.3 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 5, healthMult: 4.1 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 2.2, speedMult: 1.15 },
      { type: "fast", count: 14, spawnInterval: 0.3, startDelay: 4, healthMult: 3.6 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 2.6, speedMult: 1.2 },
      { type: "armored", count: 8, spawnInterval: 0.8, startDelay: 6, healthMult: 4.1 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 12, healthMult: 4.1 },
    ] },
  ],
};

// Level 5 — "Core Siege": a long spiral into the center. Interior
// pockets are devastating tower spots (the path passes them three
// times) but there are only a few — earn them. Enemy health is
// enormous; this is the roster's final exam.
const level005 = {
  id: "level_005",
  name: "Core Siege",
  gridWidth: 8,
  gridHeight: 12,
  // Big war chest: the siege starts heavy and never lets up.
  startingMoney: 240,
  coreHealth: 10,
  timeBetweenWaves: 5,

  pathCorners: [
    { x: 0, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 10 },
    { x: 1, y: 10 },
    { x: 1, y: 3 },
    { x: 4, y: 3 },
    { x: 4, y: 8 },
  ],

  // Interior pockets are triple-coverage monsters — most are walled
  // off. Only (2,4), (3,5) and (3,7) survive: earn them, defend them.
  blockedTiles: [
    { x: 2, y: 5 }, { x: 3, y: 6 },
    { x: 2, y: 8 }, { x: 3, y: 4 },
    { x: 2, y: 6 }, { x: 3, y: 8 },
    { x: 2, y: 7 }, { x: 7, y: 4 },
    { x: 0, y: 5 }, { x: 5, y: 11 },
    { x: 7, y: 11 },
  ],

  waves: [
    { groups: [{ type: "basic", count: 14, spawnInterval: 0.5, healthMult: 1.8 }] },
    { groups: [
      { type: "fast", count: 12, spawnInterval: 0.35, healthMult: 1.9 },
      { type: "basic", count: 10, spawnInterval: 0.5, startDelay: 4, healthMult: 2.4 },
    ] },
    { groups: [{ type: "armored", count: 8, spawnInterval: 0.9, healthMult: 2.4 }] },
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.4, healthMult: 3.6 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 4, healthMult: 2.9 },
    ] },
    { groups: [
      { type: "armored", count: 10, spawnInterval: 0.8, healthMult: 3.1 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 5, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 1.8 },
      { type: "basic", count: 14, spawnInterval: 0.4, startDelay: 2, healthMult: 4.1 },
    ] },
    { groups: [
      { type: "basic", count: 24, spawnInterval: 0.3, healthMult: 4.8 },
      { type: "armored", count: 8, spawnInterval: 0.8, startDelay: 3, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "fast", count: 20, spawnInterval: 0.25, healthMult: 3.8, speedMult: 1.15 },
      { type: "armored", count: 10, spawnInterval: 0.7, startDelay: 3, healthMult: 4.3 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 8, healthMult: 2.2 },
      { type: "armored", count: 10, spawnInterval: 0.8, startDelay: 3, healthMult: 4.8 },
    ] },
    { groups: [
      { type: "basic", count: 28, spawnInterval: 0.26, healthMult: 7.8 },
      { type: "fast", count: 16, spawnInterval: 0.28, startDelay: 5, healthMult: 6 },
    ] },
    { groups: [
      { type: "armored", count: 18, spawnInterval: 0.55, healthMult: 6.6, speedMult: 1.3 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 6, healthMult: 6.6, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 3.6, speedMult: 1.25 },
      { type: "basic", count: 18, spawnInterval: 0.32, startDelay: 4, healthMult: 7.8, speedMult: 1.3 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 4.1, speedMult: 1.3 },
      { type: "armored", count: 12, spawnInterval: 0.65, startDelay: 8, healthMult: 7.2, speedMult: 1.35 },
      { type: "fast", count: 16, spawnInterval: 0.28, startDelay: 14, healthMult: 7.2, speedMult: 1.3 },
    ] },
  ],
};

// ============================================================
// BATCH 2 (levels 6-10) — new palettes, Splitters, Regenerators,
// and waves that assume the Railgun is unlocked.
// A level's `palette` overrides renderer colors (see renderer.js LOOK).
// ============================================================

// Level 6 — "Ember Relay": Splitters introduced. Kill zones need
// AoE follow-up or the fragments swarm the core.
const level006 = {
  id: "level_006",
  name: "Ember Relay",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 130,
  coreHealth: 12,
  timeBetweenWaves: 5,
  palette: {
    background: "#170a06",
    gridLine: "rgba(255, 122, 47, 0.08)",
    gridLineMajor: "rgba(255, 122, 47, 0.15)",
    buildableDot: "rgba(255, 140, 80, 0.22)",
    pathChannel: "rgba(46, 16, 8, 0.9)",
    pathEdge: "rgba(255, 122, 47, 0.55)",
    pathFlow: "rgba(255, 170, 90, 0.7)",
  },
  pathCorners: [
    { x: 0, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 },
    { x: 1, y: 5 }, { x: 1, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 11 },
  ],
  blockedTiles: [
    { x: 2, y: 3 }, { x: 6, y: 2 }, { x: 3, y: 6 },
    { x: 0, y: 7 }, { x: 4, y: 8 }, { x: 2, y: 10 }, { x: 7, y: 7 },
  ],
  waves: [
    { groups: [{ type: "basic", count: 14, spawnInterval: 0.5, healthMult: 3 }] },
    { groups: [{ type: "splitter", count: 6, spawnInterval: 1.0, healthMult: 1.2 }] },
    { groups: [
      { type: "splitter", count: 8, spawnInterval: 0.8, healthMult: 1.6 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 4, healthMult: 2.9 },
    ] },
    { groups: [
      { type: "armored", count: 8, spawnInterval: 0.9, healthMult: 3.1 },
      { type: "splitter", count: 6, spawnInterval: 0.9, startDelay: 4, healthMult: 1.9 },
    ] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 4.3 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 3, healthMult: 2.4 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.2 },
      { type: "splitter", count: 10, spawnInterval: 0.6, startDelay: 3, healthMult: 2.6 },
    ] },
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.28, healthMult: 4.1, speedMult: 1.1 },
      { type: "armored", count: 9, spawnInterval: 0.8, startDelay: 3, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "splitter", count: 14, spawnInterval: 0.5, healthMult: 3.8 },
      { type: "basic", count: 16, spawnInterval: 0.35, startDelay: 4, healthMult: 6.2 },
    ] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.65, healthMult: 5.3 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 5, healthMult: 4.3 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 3.4 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 4.8 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 10, healthMult: 5.8 },
    ] },
  ],
};

// Level 7 — "Toxic Sink": Regenerators introduced. Chip damage
// bounces off; burst (Railgun) or focused fire is the answer.
const level007 = {
  id: "level_007",
  name: "Toxic Sink",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 130,
  coreHealth: 12,
  timeBetweenWaves: 5,
  palette: {
    background: "#0a1206",
    gridLine: "rgba(150, 255, 60, 0.07)",
    gridLineMajor: "rgba(150, 255, 60, 0.14)",
    buildableDot: "rgba(150, 255, 60, 0.20)",
    pathChannel: "rgba(18, 36, 8, 0.9)",
    pathEdge: "rgba(150, 255, 60, 0.5)",
    pathFlow: "rgba(190, 255, 120, 0.65)",
  },
  pathCorners: [
    { x: 7, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 },
    { x: 6, y: 6 }, { x: 6, y: 10 }, { x: 0, y: 10 },
  ],
  blockedTiles: [
    { x: 4, y: 3 }, { x: 1, y: 4 }, { x: 5, y: 7 },
    { x: 3, y: 8 }, { x: 7, y: 8 }, { x: 4, y: 11 }, { x: 0, y: 3 },
  ],
  waves: [
    { groups: [{ type: "basic", count: 14, spawnInterval: 0.5, healthMult: 3.4 }] },
    { groups: [{ type: "regenerator", count: 5, spawnInterval: 1.2, healthMult: 1.2 }] },
    { groups: [
      { type: "regenerator", count: 6, spawnInterval: 1.0, healthMult: 1.7 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 4, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "splitter", count: 8, spawnInterval: 0.8, healthMult: 2.4 },
      { type: "regenerator", count: 6, spawnInterval: 1.0, startDelay: 5, healthMult: 2.2 },
    ] },
    { groups: [
      { type: "armored", count: 10, spawnInterval: 0.75, healthMult: 3.6 },
      { type: "regenerator", count: 7, spawnInterval: 0.9, startDelay: 4, healthMult: 2.6 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.4 },
      { type: "regenerator", count: 8, spawnInterval: 0.8, startDelay: 3, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "basic", count: 24, spawnInterval: 0.3, healthMult: 5.4 },
      { type: "splitter", count: 10, spawnInterval: 0.6, startDelay: 4, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "regenerator", count: 12, spawnInterval: 0.6, healthMult: 3.6 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 5, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "armored", count: 16, spawnInterval: 0.6, healthMult: 5 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 4, healthMult: 4.1 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 3.4 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 4, healthMult: 4.6 },
      { type: "splitter", count: 10, spawnInterval: 0.5, startDelay: 10, healthMult: 4.3 },
    ] },
  ],
};

// Level 8 — "Ultraviolet Maze": both new enemies, tight map with
// denied prime spots.
const level008 = {
  id: "level_008",
  name: "Ultraviolet Maze",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 180,
  coreHealth: 10,
  timeBetweenWaves: 5,
  palette: {
    background: "#0d0618",
    gridLine: "rgba(170, 80, 255, 0.08)",
    gridLineMajor: "rgba(170, 80, 255, 0.16)",
    buildableDot: "rgba(190, 110, 255, 0.22)",
    pathChannel: "rgba(30, 10, 52, 0.9)",
    pathEdge: "rgba(190, 110, 255, 0.55)",
    pathFlow: "rgba(220, 160, 255, 0.7)",
  },
  pathCorners: [
    { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 6, y: 3 },
    { x: 6, y: 7 }, { x: 1, y: 7 }, { x: 1, y: 11 },
  ],
  blockedTiles: [
    { x: 2, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 5 },
    { x: 4, y: 6 }, { x: 2, y: 8 }, { x: 2, y: 5 }, { x: 7, y: 9 },
  ],
  waves: [
    { groups: [
      { type: "splitter", count: 8, spawnInterval: 0.7, healthMult: 2.6 },
      { type: "regenerator", count: 5, spawnInterval: 1.0, startDelay: 4, healthMult: 2.4 },
    ] },
    { groups: [{ type: "fast", count: 16, spawnInterval: 0.25, healthMult: 3.8, speedMult: 1.1 }] },
    { groups: [
      { type: "regenerator", count: 8, spawnInterval: 0.8, healthMult: 3.1 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 4, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.65, healthMult: 4.3 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 4, healthMult: 4.3 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.6, speedMult: 1.2 },
      { type: "splitter", count: 10, spawnInterval: 0.6, startDelay: 3, healthMult: 3.6 },
    ] },
    { groups: [
      { type: "basic", count: 26, spawnInterval: 0.28, healthMult: 6.6 },
      { type: "regenerator", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 3.6 },
    ] },
    { groups: [
      { type: "splitter", count: 14, spawnInterval: 0.45, healthMult: 4.1 },
      { type: "armored", count: 10, spawnInterval: 0.7, startDelay: 4, healthMult: 5.3 },
    ] },
    { groups: [
      { type: "regenerator", count: 14, spawnInterval: 0.55, healthMult: 4.6 },
      { type: "fast", count: 16, spawnInterval: 0.25, startDelay: 5, healthMult: 5.3, speedMult: 1.15 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 3.6 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 5, healthMult: 4.8 },
      { type: "regenerator", count: 8, spawnInterval: 0.7, startDelay: 12, healthMult: 5 },
    ] },
  ],
};

// Level 9 — "Glacier Run": long straightaways made for Railguns;
// everything is FAST.
const level009 = {
  id: "level_009",
  name: "Glacier Run",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 220,
  coreHealth: 10,
  timeBetweenWaves: 5,
  palette: {
    background: "#060d14",
    gridLine: "rgba(160, 220, 255, 0.08)",
    gridLineMajor: "rgba(160, 220, 255, 0.16)",
    buildableDot: "rgba(190, 235, 255, 0.22)",
    pathChannel: "rgba(10, 28, 44, 0.9)",
    pathEdge: "rgba(160, 220, 255, 0.55)",
    pathFlow: "rgba(220, 245, 255, 0.7)",
  },
  pathCorners: [
    { x: 0, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 },
    { x: 1, y: 5 }, { x: 1, y: 8 }, { x: 6, y: 8 }, { x: 6, y: 11 },
  ],
  blockedTiles: [
    { x: 3, y: 1 }, { x: 7, y: 3 }, { x: 3, y: 4 },
    { x: 0, y: 6 }, { x: 4, y: 7 }, { x: 2, y: 9 }, { x: 7, y: 10 },
  ],
  waves: [
    { groups: [{ type: "fast", count: 16, spawnInterval: 0.32, healthMult: 2.9 }] },
    { groups: [
      { type: "fast", count: 14, spawnInterval: 0.28, healthMult: 4.1, speedMult: 1.15 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 3, healthMult: 3.4, speedMult: 1.1 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.6, healthMult: 4.6, speedMult: 1.15 },
      { type: "fast", count: 12, spawnInterval: 0.28, startDelay: 4, healthMult: 4.6, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "regenerator", count: 10, spawnInterval: 0.7, healthMult: 3.8, speedMult: 1.2 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 4, healthMult: 3.8, speedMult: 1.15 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.9, speedMult: 1.4 },
      { type: "fast", count: 16, spawnInterval: 0.25, startDelay: 3, healthMult: 5, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "basic", count: 28, spawnInterval: 0.25, healthMult: 7.2, speedMult: 1.15 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 4.3, speedMult: 1.15 },
    ] },
    { groups: [
      { type: "fast", count: 24, spawnInterval: 0.2, healthMult: 5.8, speedMult: 1.25 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 4.8, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "armored", count: 18, spawnInterval: 0.5, healthMult: 6, speedMult: 1.2 },
      { type: "fast", count: 16, spawnInterval: 0.22, startDelay: 5, healthMult: 6.2, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 3.8, speedMult: 1.35 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 5, healthMult: 5.3, speedMult: 1.2 },
      { type: "fast", count: 16, spawnInterval: 0.22, startDelay: 11, healthMult: 6.6, speedMult: 1.3 },
    ] },
  ],
};

// Level 10 — "Solar Core": the batch finale. A long spiral, every
// enemy type, and a triple-boss ending with regenerator escorts.
const level010 = {
  id: "level_010",
  name: "Solar Core",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 260,
  coreHealth: 10,
  timeBetweenWaves: 5,
  palette: {
    background: "#140e02",
    gridLine: "rgba(255, 210, 80, 0.08)",
    gridLineMajor: "rgba(255, 210, 80, 0.16)",
    buildableDot: "rgba(255, 226, 120, 0.22)",
    pathChannel: "rgba(44, 30, 6, 0.9)",
    pathEdge: "rgba(255, 210, 80, 0.55)",
    pathFlow: "rgba(255, 240, 170, 0.7)",
  },
  pathCorners: [
    { x: 7, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 10 },
    { x: 6, y: 10 }, { x: 6, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 8 },
  ],
  blockedTiles: [
    { x: 4, y: 5 }, { x: 4, y: 7 }, { x: 2, y: 6 },
    { x: 5, y: 2 }, { x: 0, y: 5 }, { x: 7, y: 6 }, { x: 2, y: 11 }, { x: 5, y: 11 },
  ],
  waves: [
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.4, healthMult: 4.2 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 4, healthMult: 3.1 },
    ] },
    { groups: [
      { type: "regenerator", count: 8, spawnInterval: 0.8, healthMult: 3.4 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 4, healthMult: 4.3 },
    ] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.6, healthMult: 4.8 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 4, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 3.1 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 3, healthMult: 4.1 },
    ] },
    { groups: [
      { type: "basic", count: 30, spawnInterval: 0.24, healthMult: 7.8 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "fast", count: 22, spawnInterval: 0.22, healthMult: 6, speedMult: 1.2 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 5 },
    ] },
    { groups: [
      { type: "armored", count: 20, spawnInterval: 0.5, healthMult: 6.6 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 6, healthMult: 5.3 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 3.8 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 5.5 },
    ] },
    { groups: [
      { type: "splitter", count: 18, spawnInterval: 0.4, healthMult: 6 },
      { type: "fast", count: 18, spawnInterval: 0.22, startDelay: 5, healthMult: 7.2, speedMult: 1.25 },
      { type: "armored", count: 12, spawnInterval: 0.55, startDelay: 10, healthMult: 7.2 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 4.3, speedMult: 1.15 },
      { type: "regenerator", count: 14, spawnInterval: 0.55, startDelay: 6, healthMult: 6.2 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 14, healthMult: 6.6 },
    ] },
  ],
};

export const LEVELS = [
  level001, level002, level003, level004, level005,
  level006, level007, level008, level009, level010,
];
