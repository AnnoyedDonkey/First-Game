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
    { groups: [{ type: "basic", count: 14, spawnInterval: 0.4 }] },

    // Wave 2 — more of the same, slightly tighter
    { groups: [{ type: "basic", count: 16, spawnInterval: 0.3, healthMult: 2.0 }] },

    // Wave 3 — first fast enemies, arriving after the basics
    { groups: [
      { type: "basic", count: 25, spawnInterval: 0.6, healthMult: 2.8 },
      { type: "fast", count: 25, spawnInterval: 0.4, startDelay: 2 },
    ] },

    // Wave 4 — a fast rush
    { groups: [{ type: "fast", count: 25, spawnInterval: 0.4, healthMult: 5.0 }] },

    // Wave 5 — tougher basics escorted by fasts
    { groups: [
      { type: "basic", count: 12, spawnInterval: 0.55, healthMult: 3.4 },
      { type: "fast", count: 6, spawnInterval: 0.5, startDelay: 3, healthMult: 3.0 },
    ] },

    // Wave 6 — first armored enemies
    { groups: [{ type: "armored", count: 9, spawnInterval: 1.1, healthMult: 3.0 }] },

    // Wave 7 — armor up front, fasts sneak in behind
    { groups: [
      { type: "armored", count: 7, spawnInterval: 1.0, healthMult: 3.4 },
      { type: "fast", count: 12, spawnInterval: 0.4, startDelay: 5, healthMult: 3.4 },
    ] },

    // Wave 8 — a long mixed assault
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.4, healthMult: 4.8 },
      { type: "armored", count: 7, spawnInterval: 1.0, startDelay: 4, healthMult: 3.8 },
    ] },

    // Wave 9 — everything at once
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.35, healthMult: 4.0 },
      { type: "armored", count: 10, spawnInterval: 0.85, startDelay: 2, healthMult: 4.0 },
    ] },

    // Wave 10 — the boss, with escorts
    { groups: [
      { type: "boss", count: 1, healthMult: 5.2 },
      { type: "basic", count: 14, spawnInterval: 0.6, startDelay: 3, healthMult: 4.2 },
      { type: "armored", count: 8, spawnInterval: 1.1, startDelay: 8, healthMult: 3.2 },
    ] },
  ],
};

// Level 2 — "Signal Breach": a top-to-bottom CHEVRON ZIGZAG. Enemies
// carve three big Z's down the board, opening interior pockets that two
// passes cover at once. Fragile core, tight money.
const level002 = {
  id: "level_002",
  name: "Signal Breach",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 90,
  coreHealth: 15,
  timeBetweenWaves: 5,

  pathCorners: [
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 9 },
    { x: 2, y: 9 },
    { x: 2, y: 11 },
  ],

  blockedTiles: [
    { x: 5, y: 2 },
    { x: 0, y: 4 },
    { x: 3, y: 7 },
    { x: 5, y: 7 },
    { x: 7, y: 7 },
    { x: 0, y: 8 },
  ],

  // Waves teach the Laser/Pulse split: pure-FAST rushes punish Pulse
  // (fast resists it) and reward Laser/Slow; pure-ARMORED walls clang off
  // Lasers and demand Pulse; the bosses shrug off Pulse+Slow (bring focus).
  waves: [
    // 1 — warmup basics
    { groups: [{ type: "basic", count: 12, spawnInterval: 0.6, healthMult: 1.3 }] },

    // 2 — FAST rush (Laser check)
    { groups: [{ type: "fast", count: 14, spawnInterval: 0.35, healthMult: 1.4 }] },

    // 3 — first ARMORED wall (Pulse check — lasers clang off)
    { groups: [{ type: "armored", count: 8, spawnInterval: 0.9, healthMult: 1.8 }] },

    // 4 — mixed: fast AND armored at once (need both answers)
    { groups: [
      { type: "fast", count: 12, spawnInterval: 0.35, healthMult: 1.8 },
      { type: "armored", count: 6, spawnInterval: 1.0, startDelay: 3, healthMult: 2.0 },
    ] },

    // 5 — basics + fast pressure
    { groups: [
      { type: "basic", count: 16, spawnInterval: 0.4, healthMult: 2.6 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 4, healthMult: 2.2 },
    ] },

    // 6 — armored column with fast chasers
    { groups: [
      { type: "armored", count: 11, spawnInterval: 0.8, healthMult: 2.4 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 5, healthMult: 2.4 },
    ] },

    // 7 — mini-boss (Laser focus; Pulse/Slow are weak on it)
    { groups: [
      { type: "boss", count: 1, healthMult: 1.1, speedMult: 1.2 },
      { type: "basic", count: 12, spawnInterval: 0.45, startDelay: 2, healthMult: 3.0 },
    ] },

    // 8-9 — the grind
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 3.6 },
      { type: "armored", count: 8, spawnInterval: 0.9, startDelay: 3, healthMult: 2.8 },
    ] },
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.28, healthMult: 3.0, speedMult: 1.15 },
      { type: "armored", count: 9, spawnInterval: 0.8, startDelay: 2, healthMult: 3.2 },
    ] },

    // 10 — heavy ARMORED wall (real Pulse gate)
    { groups: [
      { type: "armored", count: 15, spawnInterval: 0.7, healthMult: 3.4 },
      { type: "fast", count: 10, spawnInterval: 0.32, startDelay: 5, healthMult: 3.4 },
    ] },

    // 11 — basics flood + armored
    { groups: [
      { type: "basic", count: 24, spawnInterval: 0.3, healthMult: 4.6 },
      { type: "armored", count: 9, spawnInterval: 0.75, startDelay: 4, healthMult: 3.6 },
    ] },

    // 12 — twin bosses with escorts
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 2.4 },
      { type: "armored", count: 7, spawnInterval: 0.9, startDelay: 3, healthMult: 3.4 },
      { type: "fast", count: 12, spawnInterval: 0.35, startDelay: 10, healthMult: 3.4 },
    ] },
  ],
};

// Level 3 — "Dark Relay": a PERIMETER GRAND-TOUR. Enemies run the full
// outer border, then spiral inward to a central core. Long sight-lines
// down the edges reward Railguns; the interior pockets are prime but few.
const level003 = {
  id: "level_003",
  name: "Dark Relay",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 90,
  coreHealth: 12,
  timeBetweenWaves: 5,

  pathCorners: [
    { x: 0, y: 0 },
    { x: 7, y: 0 },
    { x: 7, y: 9 },
    { x: 1, y: 9 },
    { x: 1, y: 3 },
    { x: 5, y: 3 },
    { x: 5, y: 6 },
  ],

  blockedTiles: [
    { x: 3, y: 5 }, { x: 3, y: 6 },
    { x: 2, y: 6 }, { x: 4, y: 7 },
    { x: 0, y: 11 }, { x: 7, y: 11 },
    { x: 3, y: 1 },
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

// Level 4 — "Split Second": a tight STAIRCASE. The path steps down in
// short 2-tile hops with a turn at every landing, so each tower gets an
// enemy for only a heartbeat — Slow towers (and stacked kill-zones on
// the inner corners) are almost mandatory. Fast enemies everywhere.
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
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 3 },
    { x: 4, y: 3 },
    { x: 4, y: 5 },
    { x: 2, y: 5 },
    { x: 2, y: 7 },
    { x: 5, y: 7 },
    { x: 5, y: 9 },
    { x: 2, y: 9 },
    { x: 2, y: 11 },
  ],

  blockedTiles: [
    { x: 1, y: 5 }, { x: 6, y: 8 },
    { x: 0, y: 9 }, { x: 4, y: 8 },
    { x: 1, y: 3 }, { x: 6, y: 2 },
  ],

  // The short staircase gives each tower an enemy for only a heartbeat, so
  // FAST swarms blow through unless you SLOW them (and lasers finish what
  // the slow pins). Armored interludes still demand Pulse. The pure-fast
  // "blitz" waves (5, 9) are the real Slow-tower gates.
  waves: [
    { groups: [{ type: "fast", count: 14, spawnInterval: 0.4, healthMult: 1.5 }] },
    { groups: [{ type: "fast", count: 16, spawnInterval: 0.3, healthMult: 1.8, speedMult: 1.1 }] },
    { groups: [
      { type: "basic", count: 14, spawnInterval: 0.4, healthMult: 2.4 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 3, healthMult: 2.0 },
    ] },
    { groups: [
      { type: "armored", count: 7, spawnInterval: 0.9, healthMult: 2.2 },      // Pulse check
      { type: "fast", count: 10, spawnInterval: 0.28, startDelay: 4, healthMult: 2.6 },
    ] },
    // 5 — FAST BLITZ: no Slow tower and these run the staircase untouched.
    { groups: [{ type: "fast", count: 24, spawnInterval: 0.22, healthMult: 2.8, speedMult: 1.2 }] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.32, healthMult: 3.8 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 3, healthMult: 3.0 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 1.9, speedMult: 1.35 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 2, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.65, healthMult: 3.6 },
      { type: "fast", count: 12, spawnInterval: 0.26, startDelay: 4, healthMult: 3.6 },
    ] },
    // 9 — the brutal Slow gate.
    { groups: [{ type: "fast", count: 30, spawnInterval: 0.18, healthMult: 4.0, speedMult: 1.3 }] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.6, healthMult: 4.6 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 5, healthMult: 4.4 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 2.6, speedMult: 1.25 },
      { type: "fast", count: 16, spawnInterval: 0.24, startDelay: 4, healthMult: 4.0 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 3.0, speedMult: 1.3 },
      { type: "armored", count: 9, spawnInterval: 0.75, startDelay: 6, healthMult: 4.6 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 12, healthMult: 4.6 },
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

  // The roster's final exam: every enemy type, and each demands its
  // counter. Armored walls (waves 3, 5, 9) punish Laser and gate on
  // Pulse/Railgun; the fast surges want Slow+Laser; bosses shrug off
  // Pulse+Slow. A mono-tower wall will leak somewhere.
  waves: [
    { groups: [{ type: "basic", count: 16, spawnInterval: 0.5, healthMult: 2.2 }] },
    { groups: [
      { type: "fast", count: 14, spawnInterval: 0.32, healthMult: 2.4 },
      { type: "basic", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 3.0 },
    ] },
    { groups: [{ type: "armored", count: 10, spawnInterval: 0.85, healthMult: 3.0 }] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.38, healthMult: 4.4 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 4, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.75, healthMult: 3.8 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 5, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.2 },
      { type: "basic", count: 16, spawnInterval: 0.4, startDelay: 2, healthMult: 4.8 },
    ] },
    { groups: [
      { type: "basic", count: 26, spawnInterval: 0.28, healthMult: 5.6 },
      { type: "armored", count: 10, spawnInterval: 0.8, startDelay: 3, healthMult: 4.4 },
    ] },
    { groups: [
      { type: "fast", count: 22, spawnInterval: 0.24, healthMult: 4.4, speedMult: 1.15 },
      { type: "armored", count: 12, spawnInterval: 0.7, startDelay: 3, healthMult: 5.0 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 7, healthMult: 2.8 },
      { type: "armored", count: 12, spawnInterval: 0.75, startDelay: 3, healthMult: 5.4 },
    ] },
    { groups: [
      { type: "basic", count: 30, spawnInterval: 0.25, healthMult: 8.4 },
      { type: "fast", count: 16, spawnInterval: 0.28, startDelay: 5, healthMult: 6.6 },
    ] },
    { groups: [
      { type: "armored", count: 20, spawnInterval: 0.5, healthMult: 7.2, speedMult: 1.3 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 6, healthMult: 7.0, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 4.2, speedMult: 1.25 },
      { type: "basic", count: 18, spawnInterval: 0.32, startDelay: 4, healthMult: 8.4, speedMult: 1.3 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 4.8, speedMult: 1.3 },
      { type: "armored", count: 12, spawnInterval: 0.65, startDelay: 8, healthMult: 7.8, speedMult: 1.35 },
      { type: "fast", count: 16, spawnInterval: 0.28, startDelay: 14, healthMult: 7.6, speedMult: 1.3 },
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
  // VERTICAL COMB: three parallel down-lanes joined at top and bottom.
  // The narrow alleys between lanes are covered from both sides at once —
  // ideal Pulse kill-alleys for the splitter swarms.
  pathCorners: [
    { x: 1, y: 0 }, { x: 1, y: 8 }, { x: 3, y: 8 }, { x: 3, y: 1 },
    { x: 5, y: 1 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 11 },
  ],
  blockedTiles: [
    { x: 4, y: 2 }, { x: 2, y: 5 }, { x: 4, y: 7 },
    { x: 0, y: 9 }, { x: 7, y: 4 }, { x: 2, y: 10 },
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
  // BIG DIAGONAL SWITCHBACKS: wide sweeps march from the top-right down
  // to the bottom-left, each long leg giving focused fire time to out-burst
  // the regenerators' healing.
  pathCorners: [
    { x: 7, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 4 }, { x: 6, y: 4 },
    { x: 6, y: 7 }, { x: 1, y: 7 }, { x: 1, y: 10 }, { x: 5, y: 10 },
    { x: 5, y: 11 },
  ],
  blockedTiles: [
    { x: 4, y: 2 }, { x: 3, y: 5 }, { x: 4, y: 6 },
    { x: 3, y: 8 }, { x: 0, y: 4 }, { x: 7, y: 8 }, { x: 6, y: 9 },
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
  // FULL-WIDTH MAZE SWEEPS: the path lunges wall-to-wall across the board,
  // and dense blocked "walls" between the sweeps carve the buildable space
  // into a maze — prime spots exist, but you thread towers in to reach them.
  pathCorners: [
    { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 5 },
    { x: 7, y: 5 }, { x: 7, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 11 },
  ],
  blockedTiles: [
    { x: 2, y: 3 }, { x: 5, y: 3 }, { x: 3, y: 4 }, { x: 5, y: 6 },
    { x: 2, y: 6 }, { x: 4, y: 7 }, { x: 5, y: 9 }, { x: 3, y: 10 },
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

// ---------- Worlds ----------
// The main menu groups levels into worlds (one page each, navigated by
// swipe / arrows). A world stays LOCKED until every level id in the
// PREVIOUS world is in completedLevels. Add a world here (name + its
// level ids) to grow the campaign — order matters: worlds unlock in
// sequence. Endless mode is still per-level and unchanged.
export const WORLDS = [
  {
    id: "world_1",
    name: "INNER GRID",
    levelIds: ["level_001", "level_002", "level_003", "level_004", "level_005"],
  },
  {
    id: "world_2",
    name: "OUTER VOID",
    levelIds: ["level_006", "level_007", "level_008", "level_009", "level_010"],
  },
];
