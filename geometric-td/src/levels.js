// ============================================================
// LEVEL DATA — add new maps here, no game-logic changes needed.
//
// A level defines:
//   gridWidth / gridHeight  - size of the board in tiles
//   startingMoney           - money at battle start
//   coreHealth              - AI Core hit points
//   bountyMult              - LEVEL-WIDE multiplier on money earned per
//                             kill (optional, default 1). Stacks with a
//                             wave group's own bountyMult. Late-game economy
//                             knob: trims accumulated leftover cash on
//                             levels a strong roster clears easily, without
//                             touching enemy HP/waves. Consumed in
//                             enemies.js damageEnemy().
//   timeBetweenWaves        - overrides WAVE_DEFAULTS (optional)
//   autoStartNextWave       - overrides WAVE_DEFAULTS (optional)
//   desc                    - short flavor text (~140 chars) shown on the
//                             circuit-board menu's level detail sheet
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
  desc: "A gentle serpentine through the inner lattice. Grunts only — learn the grid, plant your first Laser.",
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

    // Wave 10 — the boss, with escorts. Playtest (2026-07-17, hard-mode
    // pass H2): L1 was the one `just_right` level — a smaller, targeted
    // bump (boss only, +31%), not a rewrite.
    { groups: [
      { type: "boss", count: 1, healthMult: 6.8 },
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
  desc: "Fast movers slip through a chevron zigzag. Lasers shred them — if they can reach.",
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
    // 1 — warmup basics (bankroll rule: untouched, survivable on starting money)
    { groups: [{ type: "basic", count: 12, spawnInterval: 0.6, healthMult: 1.3 }] },

    // 2 — FAST rush (Laser check). Hard-mode pass (H2, 2026-07-17): a first
    // sim vs an 11-tower level-5 laser/pulse/slow wall still won at 67% core
    // — pushed further (net ~×2.4 vs the pre-H2 baseline).
    { groups: [{ type: "fast", count: 14, spawnInterval: 0.35, healthMult: 3.4 }] },

    // 3 — first ARMORED wall (Pulse check — lasers clang off)
    { groups: [{ type: "armored", count: 8, spawnInterval: 0.9, healthMult: 4.3 }] },

    // 4 — mixed: fast AND armored at once (need both answers)
    { groups: [
      { type: "fast", count: 12, spawnInterval: 0.35, healthMult: 4.3 },
      { type: "armored", count: 6, spawnInterval: 1.0, startDelay: 3, healthMult: 4.8 },
    ] },

    // 5 — basics + fast pressure
    { groups: [
      { type: "basic", count: 16, spawnInterval: 0.4, healthMult: 6.2 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 4, healthMult: 5.2 },
    ] },

    // 6 — armored column with fast chasers
    { groups: [
      { type: "armored", count: 11, spawnInterval: 0.8, healthMult: 5.7 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 5, healthMult: 5.7 },
    ] },

    // 7 — mini-boss (Laser focus; Pulse/Slow are weak on it). T2 playtest
    // (2026-07-16): "boss wave should be harder" (+50%). H2 hard-mode pass
    // (2026-07-17): waves 2-6 already produced the sim's only leak; waves
    // 7-12 weren't moving the needle at the first two passes (an 11-tower
    // level-5 wall cleared them identically at both +70%/+100% and a
    // further push, ending at the same 67% core) — pushed hard here,
    // net ~×4.3-4.8 boss / ~×3.7-4.2 escort vs the pre-H2 baseline.
    { groups: [
      { type: "boss", count: 1, healthMult: 8.3, speedMult: 1.2 },
      { type: "basic", count: 12, spawnInterval: 0.45, startDelay: 2, healthMult: 12.8 },
    ] },

    // 8-9 — the grind
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 15.3 },
      { type: "armored", count: 8, spawnInterval: 0.9, startDelay: 3, healthMult: 12.1 },
    ] },
    { groups: [
      { type: "fast", count: 22, spawnInterval: 0.24, healthMult: 12.8, speedMult: 1.15 },
      { type: "armored", count: 9, spawnInterval: 0.8, startDelay: 2, healthMult: 13.7 },
    ] },

    // 10 — heavy ARMORED wall (real Pulse gate)
    { groups: [
      { type: "armored", count: 15, spawnInterval: 0.7, healthMult: 14.6 },
      { type: "fast", count: 10, spawnInterval: 0.32, startDelay: 5, healthMult: 14.6 },
    ] },

    // 11 — basics flood + armored
    { groups: [
      { type: "basic", count: 28, spawnInterval: 0.26, healthMult: 19.6 },
      { type: "armored", count: 9, spawnInterval: 0.75, startDelay: 4, healthMult: 15.3 },
    ] },

    // 12 — twin bosses with escorts (final wave). T2 playtest (2026-07-16):
    // "boss wave should be harder" (+50%). H2 hard-mode pass (2026-07-17)
    // stacks another, bigger pass on top — world 1 finale should be a real
    // fight, superhuman-bot-loseable, still fresh-beatable with good
    // play/veterans.
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 18.2 },
      { type: "armored", count: 7, spawnInterval: 0.9, startDelay: 3, healthMult: 14.6 },
      { type: "fast", count: 12, spawnInterval: 0.35, startDelay: 10, healthMult: 14.6 },
    ] },
  ],
};

// Level 3 — "Dark Relay": a PERIMETER GRAND-TOUR. Enemies run the full
// outer border, then spiral inward to a central core. Long sight-lines
// down the edges reward Railguns; the interior pockets are prime but few.
const level003 = {
  id: "level_003",
  name: "Dark Relay",
  desc: "Armored crawlers loop the perimeter before spiraling to the core. Lasers bounce off — bring Pulse.",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 90,
  coreHealth: 12,
  timeBetweenWaves: 5,
  bountyMult: 0.82, // hard-mode pass (H2, 2026-07-17): trim leftover cash after the wave boost

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

  // Hard-mode pass (H2, 2026-07-17): "none of the waves felt challenging,
  // need to boost across the board" — a first sim vs an 11-tower level-5
  // laser/pulse/slow wall (at ×1.8/×2.2) still won at FULL core 0 leaks; a
  // second pass (~×2.9/×3.5) still won FULL core 0 leaks too (this comp
  // clears L3's density comfortably at moderate multipliers — the fast
  // scaling didn't move the needle until pushed much harder). A console
  // probe (temporary, not saved) found the threshold: an extra ×3 on top
  // of the second pass reliably loses on the final wave. Applied here —
  // net ~×8.6/×10.6 vs the pre-H2 baseline. Wave 1 left untouched
  // (bankroll rule).
  waves: [
    { groups: [{ type: "basic", count: 12, spawnInterval: 0.6, healthMult: 1.6 }] },
    { groups: [
      { type: "basic", count: 10, spawnInterval: 0.5, healthMult: 17.4 },
      { type: "fast", count: 6, spawnInterval: 0.4, startDelay: 3, healthMult: 15.0 },
    ] },
    { groups: [{ type: "armored", count: 6, spawnInterval: 1.1, healthMult: 15.3 }] },
    { groups: [
      { type: "fast", count: 14, spawnInterval: 0.35, healthMult: 22.5 },
      { type: "basic", count: 10, spawnInterval: 0.5, startDelay: 4, healthMult: 27.0 },
    ] },
    { groups: [
      { type: "armored", count: 8, spawnInterval: 1.0, healthMult: 24.9 },
      { type: "fast", count: 8, spawnInterval: 0.35, startDelay: 4, healthMult: 27.0 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 17.7, speedMult: 1.2 },
      { type: "basic", count: 12, spawnInterval: 0.45, startDelay: 2, healthMult: 39.9 },
    ] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 39.9 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 3, healthMult: 31.2 },
    ] },
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.3, healthMult: 32.7, speedMult: 1.1 },
      { type: "armored", count: 8, spawnInterval: 0.85, startDelay: 2, healthMult: 36.6 },
    ] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.7, healthMult: 39.9 },
      { type: "fast", count: 10, spawnInterval: 0.35, startDelay: 6, healthMult: 39.9 },
    ] },
    { groups: [
      { type: "basic", count: 22, spawnInterval: 0.3, healthMult: 51.9 },
      { type: "armored", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 43.2 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 7, healthMult: 25.5 },
      { type: "armored", count: 8, spawnInterval: 0.9, startDelay: 3, healthMult: 39.9 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 36.0 },
      { type: "fast", count: 14, spawnInterval: 0.35, startDelay: 4, healthMult: 41.4 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 10, healthMult: 45.6 },
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
  desc: "Splitters double on death down a tight staircase. Slow towers turn the chaos into kill zones.",
  gridWidth: 8,
  gridHeight: 12,
  // Generous opening money: the short path demands instant density.
  startingMoney: 150,
  coreHealth: 10,
  timeBetweenWaves: 5,
  bountyMult: 0.82, // hard-mode pass (H2, 2026-07-17): trim leftover cash after the wave boost

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
  // "blitz" waves (5, 9) are the real Slow-tower gates. Hard-mode pass
  // (H2, 2026-07-17): "way too easy" — a first sim vs an 11-tower level-5
  // laser/pulse/slow wall (at ×1.8/×2.2) still won at 50% core, so pushed
  // further to net ~×2.4/×3.0 vs the pre-H2 baseline. Wave 1 left
  // untouched (bankroll rule).
  waves: [
    { groups: [{ type: "fast", count: 14, spawnInterval: 0.4, healthMult: 1.5 }] },
    { groups: [{ type: "fast", count: 16, spawnInterval: 0.3, healthMult: 4.3, speedMult: 1.1 }] },
    { groups: [
      { type: "basic", count: 14, spawnInterval: 0.4, healthMult: 5.8 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 3, healthMult: 4.9 },
    ] },
    { groups: [
      { type: "armored", count: 7, spawnInterval: 0.9, healthMult: 5.4 },      // Pulse check
      { type: "fast", count: 10, spawnInterval: 0.28, startDelay: 4, healthMult: 6.4 },
    ] },
    // 5 — FAST BLITZ: no Slow tower and these run the staircase untouched.
    { groups: [{ type: "fast", count: 24, spawnInterval: 0.22, healthMult: 6.8, speedMult: 1.2 }] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.32, healthMult: 9.2 },
      { type: "armored", count: 6, spawnInterval: 0.9, startDelay: 3, healthMult: 7.3 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 5.7, speedMult: 1.35 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 2, healthMult: 8.2 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.65, healthMult: 8.8 },
      { type: "fast", count: 12, spawnInterval: 0.26, startDelay: 4, healthMult: 8.8 },
    ] },
    // 9 — the brutal Slow gate.
    { groups: [{ type: "fast", count: 30, spawnInterval: 0.18, healthMult: 9.7, speedMult: 1.3 }] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.6, healthMult: 11.2 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 5, healthMult: 10.7 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 7.7, speedMult: 1.25 },
      { type: "fast", count: 16, spawnInterval: 0.24, startDelay: 4, healthMult: 9.7 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 8.9, speedMult: 1.3 },
      { type: "armored", count: 9, spawnInterval: 0.75, startDelay: 6, healthMult: 11.2 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 12, healthMult: 11.2 },
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
  desc: "The first boss holds a triple spiral. Only the interior pockets survive it — clear this to unlock the RAILGUN.",
  gridWidth: 8,
  gridHeight: 12,
  // Big war chest: the siege starts heavy and never lets up.
  startingMoney: 240,
  coreHealth: 10,
  timeBetweenWaves: 5,
  bountyMult: 0.82, // hard-mode pass (H2, 2026-07-17): trim leftover cash after the wave boost

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
  // counter. Armored walls (waves 3, 5, 7, 8, 9, 11, 13) punish Laser and
  // gate on Pulse/Railgun — T2's composition-punish (raised armored
  // count/healthMult to break mono-laser walls) stays and gets pushed
  // further this pass; the fast surges want Slow+Laser; bosses shrug off
  // Pulse+Slow. A mono-tower wall will leak somewhere. Hard-mode pass
  // (H2, 2026-07-17): "still too easy despite the armored fix" — a first
  // pass (non-boss ×1.85, boss/final ×2.25 on top of T2's numbers, plus
  // armored counts raised ~15%) still won FULL core 0 leaks against an
  // 11-tower level-5 laser/pulse/slow wall, so doubled again (net ~×3.7/
  // ×4.5 vs the pre-H2 baseline) — a console probe confirmed that
  // multiplier reliably loses the same comp on wave 12/13. Wave 1
  // untouched (bankroll rule).
  waves: [
    { groups: [{ type: "basic", count: 16, spawnInterval: 0.5, healthMult: 2.2 }] },
    { groups: [
      { type: "fast", count: 14, spawnInterval: 0.32, healthMult: 8.8 },
      { type: "basic", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 11.2 },
    ] },
    { groups: [{ type: "armored", count: 14, spawnInterval: 0.68, healthMult: 12.6 }] },
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.38, healthMult: 16.2 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 4, healthMult: 12.6 },
    ] },
    { groups: [
      { type: "armored", count: 16, spawnInterval: 0.6, healthMult: 15.6 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 5, healthMult: 14.0 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 10.0 },
      { type: "basic", count: 16, spawnInterval: 0.4, startDelay: 2, healthMult: 17.8 },
    ] },
    { groups: [
      { type: "basic", count: 26, spawnInterval: 0.28, healthMult: 20.8 },
      { type: "armored", count: 21, spawnInterval: 0.58, startDelay: 3, healthMult: 20.8 },
    ] },
    { groups: [
      { type: "fast", count: 22, spawnInterval: 0.24, healthMult: 16.2, speedMult: 1.15 },
      { type: "armored", count: 21, spawnInterval: 0.5, startDelay: 3, healthMult: 23.0 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 7, healthMult: 12.6 },
      { type: "armored", count: 21, spawnInterval: 0.55, startDelay: 3, healthMult: 25.2 },
    ] },
    { groups: [
      { type: "basic", count: 30, spawnInterval: 0.25, healthMult: 31.0 },
      { type: "fast", count: 16, spawnInterval: 0.28, startDelay: 5, healthMult: 24.4 },
    ] },
    { groups: [
      { type: "armored", count: 32, spawnInterval: 0.36, healthMult: 31.8, speedMult: 1.3 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 6, healthMult: 26.0, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 19.0, speedMult: 1.25 },
      { type: "basic", count: 18, spawnInterval: 0.32, startDelay: 4, healthMult: 31.0, speedMult: 1.3 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 21.6, speedMult: 1.3 },
      { type: "armored", count: 21, spawnInterval: 0.47, startDelay: 8, healthMult: 34.8, speedMult: 1.35 },
      { type: "fast", count: 16, spawnInterval: 0.28, startDelay: 14, healthMult: 28.2, speedMult: 1.3 },
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
  desc: "Splitter swarms want Pulse — but the ember boss shrugs off splash. Bring a Railgun for the burst, or it drags on.",
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
  // PULSE SHOWCASE: dense Splitter walls that a single-line Railgun or a
  // laser wall can't clear before the fragments swarm — you need splash.
  // Fast/armored interludes keep Laser and burst in the mix.
  waves: [
    { groups: [{ type: "basic", count: 16, spawnInterval: 0.5, healthMult: 3.2 }] },
    // 2 — first Splitter wall (Pulse check)
    { groups: [{ type: "splitter", count: 10, spawnInterval: 0.7, healthMult: 1.6 }] },
    { groups: [
      { type: "splitter", count: 10, spawnInterval: 0.7, healthMult: 2.0 },
      { type: "fast", count: 10, spawnInterval: 0.32, startDelay: 3, healthMult: 3.2 },
    ] },
    { groups: [
      { type: "armored", count: 9, spawnInterval: 0.85, healthMult: 3.4 },
      { type: "splitter", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 2.2 },
    ] },
    // 5 — big Splitter wall (real Pulse gate; Railgun wastes its shot)
    { groups: [{ type: "splitter", count: 16, spawnInterval: 0.5, healthMult: 2.8 }] },
    // Boss resists Pulse's splash (see ENEMIES.boss damageMult) — the first
    // real reason to bring a Railgun/focused Laser instead of an all-Pulse
    // splitter answer. Playtest: "Railgun should almost be mandatory... but
    // I could have done the map without it" — +50% boss HP.
    { groups: [
      { type: "boss", count: 1, healthMult: 3.6 },
      { type: "splitter", count: 12, spawnInterval: 0.55, startDelay: 3, healthMult: 2.8 },
    ] },
    { groups: [
      { type: "fast", count: 20, spawnInterval: 0.28, healthMult: 4.4, speedMult: 1.1 },
      { type: "armored", count: 10, spawnInterval: 0.8, startDelay: 3, healthMult: 4.0 },
    ] },
    { groups: [
      { type: "splitter", count: 16, spawnInterval: 0.45, healthMult: 4.0 },
      { type: "basic", count: 18, spawnInterval: 0.32, startDelay: 4, healthMult: 6.4 },
    ] },
    { groups: [
      { type: "armored", count: 15, spawnInterval: 0.6, healthMult: 5.6 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 5, healthMult: 4.4 },
    ] },
    // Final wave: twin bosses resist Pulse — a Railgun (or focused Laser)
    // earns its slot here even in an otherwise all-Pulse splitter build.
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 5.2 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 4, healthMult: 5.0 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 10, healthMult: 6.0 },
    ] },
  ],
};

// Level 7 — "Toxic Sink": Regenerators introduced. Chip damage
// bounces off; burst (Railgun) or focused fire is the answer.
const level007 = {
  id: "level_007",
  name: "Toxic Sink",
  desc: "A vertical comb drips with splitter swarms. Pulse and patience clear the sink.",
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
  // RAILGUN SHOWCASE: Regenerator walls out-heal any laser chip — only
  // burst outruns their regen. Splitter escorts punish a pure-Railgun
  // answer, so you juggle burst (Rail) with splash (Pulse).
  waves: [
    { groups: [{ type: "basic", count: 16, spawnInterval: 0.5, healthMult: 3.6 }] },
    // 2 — first Regenerator wall (Railgun check; lasers just tickle them)
    { groups: [{ type: "regenerator", count: 6, spawnInterval: 1.1, healthMult: 1.6 }] },
    { groups: [
      { type: "regenerator", count: 7, spawnInterval: 1.0, healthMult: 2.2 },
      { type: "fast", count: 10, spawnInterval: 0.3, startDelay: 4, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "splitter", count: 9, spawnInterval: 0.7, healthMult: 2.6 },
      { type: "regenerator", count: 6, spawnInterval: 1.0, startDelay: 5, healthMult: 2.6 },
    ] },
    { groups: [
      { type: "armored", count: 11, spawnInterval: 0.7, healthMult: 3.8 },
      { type: "regenerator", count: 7, spawnInterval: 0.9, startDelay: 4, healthMult: 2.9 },
    ] },
    // Playtest feedback (2026-07): "Boss should be way harder" — +50% HP.
    { groups: [
      { type: "boss", count: 1, healthMult: 3.9 },
      { type: "regenerator", count: 8, spawnInterval: 0.8, startDelay: 3, healthMult: 3.4 },
    ] },
    // 7 — heavy Regenerator wall (real Railgun gate)
    { groups: [
      { type: "regenerator", count: 12, spawnInterval: 0.7, healthMult: 3.8 },
      { type: "fast", count: 12, spawnInterval: 0.28, startDelay: 5, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "basic", count: 26, spawnInterval: 0.28, healthMult: 5.8 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 4, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "armored", count: 16, spawnInterval: 0.6, healthMult: 5.4 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 4, healthMult: 4.4 },
    ] },
    // Final wave. Playtest: "Boss should be way harder" — +50% HP plus
    // thicker escorts; L7 stays the veteran-gated wall, just meaner now.
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 5.4 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 4.8 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 10, healthMult: 4.6 },
    ] },
  ],
};

// Level 8 — "Ultraviolet Maze": both new enemies, tight map with
// denied prime spots.
const level008 = {
  id: "level_008",
  name: "Ultraviolet Maze",
  desc: "Full-width maze sweeps under UV light, denying prime tiles. Splitters and regenerators both show up.",
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
  // JUGGLE EVERYTHING: Splitters (want Pulse), Regenerators (want Railgun)
  // and fast rushes (want Laser) alternate, so no two-tower build covers
  // it — the maze forces you to commit each prime spot to the right answer.
  waves: [
    { groups: [
      { type: "splitter", count: 8, spawnInterval: 0.7, healthMult: 2.8 },
      { type: "regenerator", count: 5, spawnInterval: 1.0, startDelay: 4, healthMult: 2.6 },
    ] },
    // 2 — fast wall (Laser check)
    { groups: [{ type: "fast", count: 18, spawnInterval: 0.25, healthMult: 4.0, speedMult: 1.1 }] },
    { groups: [
      { type: "regenerator", count: 8, spawnInterval: 0.8, healthMult: 3.2 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 4, healthMult: 3.2 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.65, healthMult: 4.4 },
      { type: "fast", count: 12, spawnInterval: 0.3, startDelay: 4, healthMult: 4.4 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.8, speedMult: 1.2 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 3, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "basic", count: 26, spawnInterval: 0.28, healthMult: 6.8 },
      { type: "regenerator", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 3.8 },
    ] },
    { groups: [
      { type: "splitter", count: 14, spawnInterval: 0.45, healthMult: 4.2 },
      { type: "armored", count: 10, spawnInterval: 0.7, startDelay: 4, healthMult: 5.4 },
    ] },
    { groups: [
      { type: "regenerator", count: 14, spawnInterval: 0.55, healthMult: 4.6 },
      { type: "fast", count: 16, spawnInterval: 0.25, startDelay: 5, healthMult: 5.4, speedMult: 1.15 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 3.6 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 5, healthMult: 4.8 },
      { type: "regenerator", count: 8, spawnInterval: 0.7, startDelay: 12, healthMult: 5.2 },
    ] },
  ],
};

// Level 9 — "Glacier Run": long straightaways made for Railguns;
// everything is FAST.
const level009 = {
  id: "level_009",
  name: "Glacier Run",
  desc: "Long frozen straights built for the Railgun — aim down the lanes, and everything is fast.",
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
  // SLOW + LASER SHOWCASE: everything sprints, and Pulse orbs can't catch
  // the diamonds (fast resist splash). Pin them with Slow, finish with
  // Laser. The pure-fast blitz (wave 7) is the Slow-tower gate.
  waves: [
    { groups: [{ type: "fast", count: 18, spawnInterval: 0.3, healthMult: 3.2 }] },
    { groups: [
      { type: "fast", count: 16, spawnInterval: 0.26, healthMult: 4.4, speedMult: 1.15 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 3, healthMult: 3.6, speedMult: 1.1 },
    ] },
    { groups: [
      { type: "armored", count: 12, spawnInterval: 0.6, healthMult: 4.8, speedMult: 1.15 },
      { type: "fast", count: 12, spawnInterval: 0.28, startDelay: 4, healthMult: 4.8, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "regenerator", count: 10, spawnInterval: 0.7, healthMult: 4.0, speedMult: 1.2 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 4, healthMult: 4.0, speedMult: 1.15 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 2.9, speedMult: 1.4 },
      { type: "fast", count: 18, spawnInterval: 0.24, startDelay: 3, healthMult: 5.2, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "basic", count: 28, spawnInterval: 0.24, healthMult: 7.6, speedMult: 1.15 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 4.6, speedMult: 1.15 },
    ] },
    // 7 — mega fast blitz (Slow gate: unpinned, they run the lanes clean)
    { groups: [{ type: "fast", count: 30, spawnInterval: 0.17, healthMult: 6.0, speedMult: 1.3 }] },
    { groups: [
      { type: "armored", count: 18, spawnInterval: 0.5, healthMult: 6.2, speedMult: 1.2 },
      { type: "fast", count: 16, spawnInterval: 0.22, startDelay: 5, healthMult: 6.4, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 3.8, speedMult: 1.35 },
      { type: "fast", count: 20, spawnInterval: 0.2, startDelay: 4, healthMult: 6.8, speedMult: 1.3 },
      { type: "splitter", count: 12, spawnInterval: 0.45, startDelay: 11, healthMult: 5.6, speedMult: 1.2 },
    ] },
  ],
};

// Level 10 — "Solar Core": the batch finale. A long spiral, every
// enemy type, and a triple-boss ending with regenerator escorts.
const level010 = {
  id: "level_010",
  name: "Solar Core",
  desc: "The void's furnace: every enemy type and a triple-boss finale. Survive it to unlock the ROCKET LAUNCHER.",
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
  // BATCH FINALE: every enemy type, every counter tested. Armored walls
  // (Pulse/Rail), Regenerator escorts (Rail), Splitter floods (Pulse) and
  // fast surges (Laser/Slow) stack up — a mono build leaks somewhere.
  waves: [
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.38, healthMult: 4.6 },
      { type: "splitter", count: 8, spawnInterval: 0.7, startDelay: 4, healthMult: 3.4 },
    ] },
    { groups: [
      { type: "regenerator", count: 8, spawnInterval: 0.8, healthMult: 3.8 },
      { type: "fast", count: 14, spawnInterval: 0.28, startDelay: 4, healthMult: 4.6 },
    ] },
    { groups: [
      { type: "armored", count: 15, spawnInterval: 0.55, healthMult: 5.2 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 4, healthMult: 4.2 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 3.4 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 3, healthMult: 4.4 },
    ] },
    { groups: [
      { type: "basic", count: 32, spawnInterval: 0.22, healthMult: 8.4 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 5.0 },
    ] },
    { groups: [
      { type: "fast", count: 24, spawnInterval: 0.2, healthMult: 6.4, speedMult: 1.2 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 5.4 },
    ] },
    { groups: [
      { type: "armored", count: 22, spawnInterval: 0.45, healthMult: 7.2 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 6, healthMult: 5.6 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 4.0 },
      { type: "regenerator", count: 12, spawnInterval: 0.55, startDelay: 4, healthMult: 5.8 },
    ] },
    { groups: [
      { type: "splitter", count: 18, spawnInterval: 0.4, healthMult: 6.4 },
      { type: "fast", count: 18, spawnInterval: 0.22, startDelay: 5, healthMult: 7.6, speedMult: 1.25 },
      { type: "armored", count: 12, spawnInterval: 0.55, startDelay: 10, healthMult: 7.6 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 4.6, speedMult: 1.15 },
      { type: "regenerator", count: 14, spawnInterval: 0.5, startDelay: 6, healthMult: 6.6 },
      { type: "splitter", count: 14, spawnInterval: 0.42, startDelay: 14, healthMult: 7.0 },
    ] },
  ],
};

// ============================================================
// WORLD 3 — "PRISM DEEP" (levels 11-15). Post-Rocket endgame: every
// tower unlocked, so waves stack multiple bosses (Rocket food) and dense
// Splitter/Regenerator clusters that demand the whole toolkit. New bold
// single-hue palettes (crimson, teal, magenta, silver, radiant white) and
// path shapes not used in W1/W2 — a bottom spiral, cascades, a plus-detour,
// a tight switchback ladder, and a full perimeter-into-core grand finale.
// ============================================================

// Level 11 — "Crimson Vein": a spiral that enters from the BOTTOM and
// coils up into a mid-board core. Boss-heavy — the Rocket earns its slot.
const level011 = {
  id: "level_011",
  name: "Crimson Vein",
  desc: "A bottom-entry spiral coils into a mid-board core. Boss-heavy — the Rocket finally earns its slot.",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 240,
  coreHealth: 12,
  timeBetweenWaves: 5,
  bountyMult: 0.75, // late-game economy trim (T3): strong rosters left 1.5-5k idle
  palette: {
    background: "#160406",
    gridLine: "rgba(255, 60, 80, 0.08)",
    gridLineMajor: "rgba(255, 60, 80, 0.16)",
    buildableDot: "rgba(255, 90, 110, 0.22)",
    pathChannel: "rgba(46, 8, 12, 0.9)",
    pathEdge: "rgba(255, 70, 90, 0.55)",
    pathFlow: "rgba(255, 140, 150, 0.7)",
  },
  pathCorners: [
    { x: 4, y: 11 }, { x: 4, y: 8 }, { x: 1, y: 8 }, { x: 1, y: 2 },
    { x: 6, y: 2 }, { x: 6, y: 9 }, { x: 3, y: 9 }, { x: 3, y: 6 },
  ],
  blockedTiles: [
    { x: 5, y: 5 }, { x: 2, y: 4 }, { x: 4, y: 5 },
    { x: 6, y: 11 }, { x: 0, y: 10 }, { x: 3, y: 3 },
  ],
  waves: [
    { groups: [
      { type: "basic", count: 18, spawnInterval: 0.4, healthMult: 4.5 },
      { type: "splitter", count: 8, spawnInterval: 0.6, startDelay: 4, healthMult: 3.6 },
    ] },
    { groups: [{ type: "armored", count: 12, spawnInterval: 0.6, healthMult: 7.0 }] },
    { groups: [
      { type: "boss", count: 1, healthMult: 4.8 },
      { type: "basic", count: 16, spawnInterval: 0.4, startDelay: 2, healthMult: 7.0 },
    ] },
    { groups: [
      { type: "fast", count: 22, spawnInterval: 0.24, healthMult: 7.6, speedMult: 1.15 },
      { type: "armored", count: 10, spawnInterval: 0.7, startDelay: 4, healthMult: 7.3 },
    ] },
    { groups: [
      { type: "splitter", count: 16, spawnInterval: 0.45, healthMult: 6.2 },
      { type: "regenerator", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 5.7 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 5.3 },
      { type: "armored", count: 12, spawnInterval: 0.6, startDelay: 3, healthMult: 7.8 },
    ] },
    { groups: [
      { type: "armored", count: 20, spawnInterval: 0.5, healthMult: 9.5 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 5, healthMult: 8.6 },
    ] },
    { groups: [
      { type: "regenerator", count: 14, spawnInterval: 0.6, healthMult: 6.8 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 6.8 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 6.2 },
      { type: "basic", count: 24, spawnInterval: 0.28, startDelay: 3, healthMult: 11.3 },
      { type: "fast", count: 16, spawnInterval: 0.24, startDelay: 10, healthMult: 9.7 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 6.7, speedMult: 1.1 },
      { type: "armored", count: 14, spawnInterval: 0.55, startDelay: 6, healthMult: 10.8 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 12, healthMult: 8.9 },
    ] },
  ],
};

// Level 12 — "Abyssal Teal": a widening cascade of steps down the board.
// Splitter + Regenerator heavy — Pulse and Rocket for the clusters,
// Railgun burst for the healers.
const level012 = {
  id: "level_012",
  name: "Abyssal Teal",
  desc: "A widening cascade of steps. Splitters and regenerators cluster — Pulse/Rocket for the swarm, Railgun for the healers.",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 220,
  coreHealth: 10,
  timeBetweenWaves: 5,
  bountyMult: 0.75, // late-game economy trim (T3): strong rosters left 1.5-5k idle
  palette: {
    background: "#04140f",
    gridLine: "rgba(40, 255, 210, 0.08)",
    gridLineMajor: "rgba(40, 255, 210, 0.16)",
    buildableDot: "rgba(90, 255, 225, 0.22)",
    pathChannel: "rgba(6, 40, 34, 0.9)",
    pathEdge: "rgba(40, 255, 210, 0.5)",
    pathFlow: "rgba(150, 255, 235, 0.7)",
  },
  pathCorners: [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 },
    { x: 0, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 9 }, { x: 1, y: 9 }, { x: 1, y: 11 },
  ],
  blockedTiles: [
    { x: 5, y: 1 }, { x: 2, y: 5 }, { x: 5, y: 7 },
    { x: 3, y: 10 }, { x: 6, y: 4 }, { x: 2, y: 2 },
  ],
  waves: [
    { groups: [{ type: "splitter", count: 12, spawnInterval: 0.55, healthMult: 4.0 }] },
    { groups: [
      { type: "regenerator", count: 8, spawnInterval: 0.8, healthMult: 4.9 },
      { type: "fast", count: 12, spawnInterval: 0.28, startDelay: 4, healthMult: 6.5 },
    ] },
    { groups: [
      { type: "splitter", count: 16, spawnInterval: 0.45, healthMult: 6.0 },
      { type: "basic", count: 18, spawnInterval: 0.32, startDelay: 4, healthMult: 8.6 },
    ] },
    { groups: [{ type: "armored", count: 14, spawnInterval: 0.55, healthMult: 7.3 }] },
    { groups: [
      { type: "regenerator", count: 12, spawnInterval: 0.6, healthMult: 6.0 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 6.0 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 5.0 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 3, healthMult: 6.0 },
    ] },
    { groups: [
      { type: "fast", count: 26, spawnInterval: 0.2, healthMult: 8.6, speedMult: 1.2 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 4, healthMult: 6.8 },
    ] },
    { groups: [
      { type: "armored", count: 18, spawnInterval: 0.5, healthMult: 9.4 },
      { type: "regenerator", count: 10, spawnInterval: 0.65, startDelay: 4, healthMult: 7.0 },
    ] },
    { groups: [
      { type: "splitter", count: 20, spawnInterval: 0.4, healthMult: 8.3 },
      { type: "boss", count: 1, healthMult: 5.9, startDelay: 2 },
      { type: "fast", count: 16, spawnInterval: 0.24, startDelay: 10, healthMult: 9.1 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 6.4 },
      { type: "regenerator", count: 14, spawnInterval: 0.55, startDelay: 5, healthMult: 8.3 },
      { type: "splitter", count: 16, spawnInterval: 0.42, startDelay: 12, healthMult: 8.8 },
    ] },
  ],
};

// Level 13 — "Violet Pulse": a plus-shaped detour into the center then
// out to the edges. Everything SPRINTS — Slow + Laser, with Pulse/Rocket
// for the splitter clusters.
const level013 = {
  id: "level_013",
  name: "Violet Pulse",
  desc: "A plus-shaped detour pulses everything into a sprint. Slow and Laser lead; Pulse/Rocket clean up the splitters.",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 200,
  coreHealth: 10,
  timeBetweenWaves: 5,
  bountyMult: 0.75, // late-game economy trim (T3): strong rosters left 1.5-5k idle
  palette: {
    background: "#170518",
    gridLine: "rgba(255, 60, 200, 0.08)",
    gridLineMajor: "rgba(255, 60, 200, 0.16)",
    buildableDot: "rgba(255, 110, 220, 0.22)",
    pathChannel: "rgba(48, 8, 40, 0.9)",
    pathEdge: "rgba(255, 70, 210, 0.55)",
    pathFlow: "rgba(255, 150, 235, 0.7)",
  },
  pathCorners: [
    { x: 3, y: 0 }, { x: 3, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 8 },
    { x: 7, y: 8 }, { x: 7, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 11 },
  ],
  blockedTiles: [
    { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 4, y: 4 },
    { x: 6, y: 10 }, { x: 1, y: 3 }, { x: 3, y: 9 },
  ],
  waves: [
    { groups: [{ type: "fast", count: 20, spawnInterval: 0.28, healthMult: 4.0 }] },
    { groups: [
      { type: "fast", count: 18, spawnInterval: 0.24, healthMult: 6.5, speedMult: 1.2 },
      { type: "splitter", count: 10, spawnInterval: 0.6, startDelay: 3, healthMult: 5.2 },
    ] },
    { groups: [
      { type: "basic", count: 24, spawnInterval: 0.28, healthMult: 8.2 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 4, healthMult: 7.0 },
    ] },
    { groups: [
      { type: "splitter", count: 16, spawnInterval: 0.45, healthMult: 6.0 },
      { type: "regenerator", count: 8, spawnInterval: 0.8, startDelay: 4, healthMult: 5.5 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 4.6, speedMult: 1.25 },
      { type: "fast", count: 20, spawnInterval: 0.24, startDelay: 3, healthMult: 7.2, speedMult: 1.2 },
    ] },
    // 6 — fast blitz (Slow gate)
    { groups: [{ type: "fast", count: 30, spawnInterval: 0.16, healthMult: 8.0, speedMult: 1.3 }] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.55, healthMult: 8.0 },
      { type: "fast", count: 16, spawnInterval: 0.24, startDelay: 4, healthMult: 8.2, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "splitter", count: 18, spawnInterval: 0.4, healthMult: 7.2 },
      { type: "regenerator", count: 10, spawnInterval: 0.65, startDelay: 4, healthMult: 6.5 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 5.7, speedMult: 1.2 },
      { type: "fast", count: 22, spawnInterval: 0.22, startDelay: 4, healthMult: 8.8, speedMult: 1.25 },
      { type: "splitter", count: 12, spawnInterval: 0.45, startDelay: 11, healthMult: 7.0 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 5, healthMult: 6.5, speedMult: 1.25 },
      { type: "fast", count: 26, spawnInterval: 0.2, startDelay: 4, healthMult: 9.5, speedMult: 1.3 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 12, healthMult: 7.5 },
    ] },
  ],
};

// Level 14 — "Silver Null": a tight switchback ladder (six short lanes).
// Little dwell time per lane but heavy coverage — every tower type shows
// up and the maze rewards committing prime tiles to the right counter.
const level014 = {
  id: "level_014",
  name: "Silver Null",
  desc: "A tight switchback ladder — six short lanes, little dwell time. Every counter gets tested here.",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 240,
  coreHealth: 10,
  timeBetweenWaves: 5,
  bountyMult: 0.75, // late-game economy trim (T3): strong rosters left 1.5-5k idle
  palette: {
    background: "#0b0d12",
    gridLine: "rgba(200, 215, 240, 0.09)",
    gridLineMajor: "rgba(200, 215, 240, 0.18)",
    buildableDot: "rgba(220, 230, 255, 0.25)",
    pathChannel: "rgba(22, 26, 34, 0.9)",
    pathEdge: "rgba(210, 225, 250, 0.6)",
    pathFlow: "rgba(240, 248, 255, 0.75)",
  },
  pathCorners: [
    { x: 0, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 3 }, { x: 1, y: 3 },
    { x: 1, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 7 }, { x: 2, y: 7 },
    { x: 2, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 11 },
  ],
  blockedTiles: [
    { x: 7, y: 2 }, { x: 0, y: 4 }, { x: 7, y: 6 },
    { x: 0, y: 8 }, { x: 4, y: 10 }, { x: 3, y: 0 },
  ],
  waves: [
    { groups: [
      { type: "basic", count: 20, spawnInterval: 0.35, healthMult: 5.0 },
      { type: "splitter", count: 8, spawnInterval: 0.6, startDelay: 4, healthMult: 4.0 },
    ] },
    { groups: [
      { type: "armored", count: 14, spawnInterval: 0.55, healthMult: 7.3 },
      { type: "fast", count: 12, spawnInterval: 0.28, startDelay: 4, healthMult: 7.0 },
    ] },
    { groups: [
      { type: "regenerator", count: 10, spawnInterval: 0.7, healthMult: 6.0 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 6.0 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 5.3 },
      { type: "regenerator", count: 10, spawnInterval: 0.7, startDelay: 3, healthMult: 6.2 },
    ] },
    { groups: [
      { type: "fast", count: 26, spawnInterval: 0.2, healthMult: 8.6, speedMult: 1.2 },
      { type: "armored", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 8.3 },
    ] },
    { groups: [
      { type: "splitter", count: 20, spawnInterval: 0.4, healthMult: 8.1 },
      { type: "basic", count: 24, spawnInterval: 0.3, startDelay: 4, healthMult: 10.4 },
    ] },
    { groups: [
      { type: "armored", count: 22, spawnInterval: 0.45, healthMult: 9.9 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 7.3 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 5.9 },
      { type: "fast", count: 20, spawnInterval: 0.24, startDelay: 4, healthMult: 9.4, speedMult: 1.2 },
    ] },
    { groups: [
      { type: "splitter", count: 20, spawnInterval: 0.38, healthMult: 8.6 },
      { type: "regenerator", count: 14, spawnInterval: 0.55, startDelay: 5, healthMult: 7.8 },
      { type: "fast", count: 18, spawnInterval: 0.24, startDelay: 11, healthMult: 9.6, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 6.4 },
      { type: "armored", count: 16, spawnInterval: 0.5, startDelay: 6, healthMult: 10.9 },
      { type: "splitter", count: 16, spawnInterval: 0.42, startDelay: 12, healthMult: 9.1 },
    ] },
  ],
};

// Level 15 — "Prismatic Core": the grand finale. Enemies run the full
// perimeter, then spiral deep to a central core. Every enemy type, huge
// counts, and a FOUR-boss climax — bring the whole arsenal.
const level015 = {
  id: "level_015",
  name: "Prismatic Core",
  desc: "The grand finale: the full perimeter into a deep spiral, every enemy form, and a four-boss climax.",
  gridWidth: 8,
  gridHeight: 12,
  startingMoney: 300,
  coreHealth: 12,
  timeBetweenWaves: 5,
  bountyMult: 0.75, // late-game economy trim (T3): strong rosters left 1.5-5k idle
  palette: {
    background: "#0b0820",
    gridLine: "rgba(220, 220, 255, 0.10)",
    gridLineMajor: "rgba(245, 245, 255, 0.20)",
    buildableDot: "rgba(235, 235, 255, 0.26)",
    pathChannel: "rgba(24, 20, 48, 0.9)",
    pathEdge: "rgba(235, 235, 255, 0.6)",
    pathFlow: "rgba(255, 255, 255, 0.8)",
  },
  pathCorners: [
    { x: 0, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 11 }, { x: 0, y: 11 },
    { x: 0, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 9 }, { x: 2, y: 9 }, { x: 2, y: 5 },
  ],
  blockedTiles: [
    { x: 3, y: 4 }, { x: 4, y: 6 }, { x: 3, y: 7 },
    { x: 6, y: 3 }, { x: 1, y: 7 }, { x: 4, y: 10 },
  ],
  waves: [
    { groups: [
      { type: "basic", count: 22, spawnInterval: 0.34, healthMult: 5.2 },
      { type: "splitter", count: 10, spawnInterval: 0.55, startDelay: 4, healthMult: 4.2 },
    ] },
    { groups: [
      { type: "armored", count: 16, spawnInterval: 0.5, healthMult: 7.8 },
      { type: "fast", count: 14, spawnInterval: 0.26, startDelay: 4, healthMult: 7.6 },
    ] },
    { groups: [
      { type: "regenerator", count: 12, spawnInterval: 0.6, healthMult: 6.5 },
      { type: "splitter", count: 12, spawnInterval: 0.5, startDelay: 4, healthMult: 6.5 },
    ] },
    { groups: [
      { type: "boss", count: 1, healthMult: 5.6 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 3, healthMult: 7.0 },
    ] },
    { groups: [
      { type: "fast", count: 28, spawnInterval: 0.18, healthMult: 9.5, speedMult: 1.2 },
      { type: "splitter", count: 14, spawnInterval: 0.45, startDelay: 4, healthMult: 7.6 },
    ] },
    { groups: [
      { type: "armored", count: 22, spawnInterval: 0.45, healthMult: 10.3 },
      { type: "regenerator", count: 12, spawnInterval: 0.6, startDelay: 4, healthMult: 7.8 },
    ] },
    { groups: [
      { type: "boss", count: 2, spawnInterval: 6, healthMult: 6.2 },
      { type: "basic", count: 28, spawnInterval: 0.26, startDelay: 3, healthMult: 12.2 },
    ] },
    { groups: [
      { type: "splitter", count: 22, spawnInterval: 0.38, healthMult: 9.2 },
      { type: "fast", count: 20, spawnInterval: 0.22, startDelay: 4, healthMult: 10.3, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "armored", count: 24, spawnInterval: 0.42, healthMult: 11.3 },
      { type: "regenerator", count: 14, spawnInterval: 0.55, startDelay: 5, healthMult: 8.6 },
    ] },
    { groups: [
      { type: "boss", count: 3, spawnInterval: 5, healthMult: 6.7 },
      { type: "splitter", count: 18, spawnInterval: 0.42, startDelay: 5, healthMult: 9.5 },
      { type: "fast", count: 20, spawnInterval: 0.22, startDelay: 11, healthMult: 10.8, speedMult: 1.25 },
    ] },
    { groups: [
      { type: "regenerator", count: 18, spawnInterval: 0.5, healthMult: 9.2 },
      { type: "armored", count: 18, spawnInterval: 0.48, startDelay: 4, healthMult: 11.9 },
      { type: "splitter", count: 16, spawnInterval: 0.42, startDelay: 10, healthMult: 9.7 },
    ] },
    { groups: [
      { type: "boss", count: 4, spawnInterval: 5, healthMult: 7.3, speedMult: 1.1 },
      { type: "armored", count: 16, spawnInterval: 0.5, startDelay: 6, healthMult: 12.2 },
      { type: "regenerator", count: 14, spawnInterval: 0.55, startDelay: 12, healthMult: 9.2 },
      { type: "fast", count: 18, spawnInterval: 0.22, startDelay: 18, healthMult: 11.3, speedMult: 1.3 },
    ] },
  ],
};

export const LEVELS = [
  level001, level002, level003, level004, level005,
  level006, level007, level008, level009, level010,
  level011, level012, level013, level014, level015,
];

// ---------- Worlds ----------
// The main menu groups levels into worlds (one page each, navigated by
// swipe / arrows). A world stays LOCKED until every level id in the
// PREVIOUS world is in completedLevels. Add a world here (name + its
// level ids) to grow the campaign — order matters: worlds unlock in
// sequence. Endless mode is still per-level and unchanged.
//
// Circuit-board menu fields (CIRCUIT_MENU_DESIGN.md):
//   accent / accent2  - world's neon palette (accent = primary trace/node
//                        glow, accent2 = secondary, e.g. the ∞ pad tint)
//   boardStyle        - "grid" | "diagonal" | "prism", picks the trace/pad
//                        rendering style for this world's board
//   nodePos           - one {x,y} per level (same order as levelIds), in
//                        the board SVG's 0-100 x 0-130 viewBox space
export const WORLDS = [
  {
    id: "world_1",
    name: "INNER GRID",
    levelIds: ["level_001", "level_002", "level_003", "level_004", "level_005"],
    accent: "#22d6ff",
    accent2: "#2fd6a8",
    boardStyle: "grid",
    nodePos: [
      { x: 24, y: 16 },
      { x: 72, y: 33 },
      { x: 28, y: 56 },
      { x: 66, y: 80 },
      { x: 50, y: 108 },
    ],
  },
  {
    id: "world_2",
    name: "OUTER VOID",
    levelIds: ["level_006", "level_007", "level_008", "level_009", "level_010"],
    accent: "#ff9d3c",
    accent2: "#ffd76a",
    boardStyle: "diagonal",
    nodePos: [
      { x: 70, y: 14 },
      { x: 24, y: 36 },
      { x: 62, y: 58 },
      { x: 30, y: 84 },
      { x: 68, y: 108 },
    ],
  },
  {
    id: "world_3",
    name: "PRISM DEEP",
    levelIds: ["level_011", "level_012", "level_013", "level_014", "level_015"],
    accent: "#e05cff",
    accent2: "#ff5ca8",
    boardStyle: "prism",
    nodePos: [
      { x: 50, y: 14 },
      { x: 22, y: 42 },
      { x: 78, y: 42 },
      { x: 32, y: 84 },
      { x: 64, y: 104 },
    ],
  },
];
