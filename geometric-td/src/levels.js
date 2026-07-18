// ============================================================
// LEVEL DATA — presentation + assembly.
//
// BALANCE LAB L2: the editable numbers (grid size, money, core health,
// bountyMult, timeBetweenWaves, pathCorners, blockedTiles, waves, and world
// levelIds) now live in src/balance-data.js under BALANCE.levels/BALANCE.worlds
// — see BALANCE_LAB_L0.md for the schema contract and BALANCE_LAB_L2_PLAN.md
// for the migration. This file keeps the PRESENTATION half (id/name/desc/
// palette for levels; id/name/accent/accent2/boardStyle/nodePos for worlds)
// and merges it with BALANCE at module load to rebuild the exact `LEVELS`/
// `WORLDS` shape every other module already imports — nothing downstream
// changes. To add a new level: add its numbers to BALANCE.levels in
// balance-data.js (schema-validated) and its presentation row here.
//
// A level (BALANCE.levels.<id>) defines:
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
//   pathCorners             - the enemy path as corner points; the
//                             code fills in every tile between
//                             corners (segments must be straight
//                             horizontal or vertical lines)
//   blockedTiles            - tiles where nothing can be built
//   waves                   - the wave list (see below)
//
// desc (LEVEL_PRESENTATION) - short flavor text (~140 chars) shown on the
//                             circuit-board menu's level detail sheet
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

import { BALANCE } from "./balance-data.js";

// ---------- Level presentation (id/name/desc/palette; numbers come from
// BALANCE.levels[id]). `palette` overrides renderer colors (see
// renderer.js LOOK) — only worlds 2/3 use it. ----------
const LEVEL_PRESENTATION = {
  level_001: {
    name: "First Contact",
    desc: "A gentle serpentine through the inner lattice. Grunts only — learn the grid, plant your first Laser.",
  },
  level_002: {
    name: "Signal Breach",
    desc: "Fast movers slip through a chevron zigzag. Lasers shred them — if they can reach.",
  },
  level_003: {
    name: "Dark Relay",
    desc: "Armored crawlers loop the perimeter before spiraling to the core. Lasers bounce off — bring Pulse.",
  },
  level_004: {
    name: "Split Second",
    desc: "Splitters double on death down a tight staircase. Slow towers turn the chaos into kill zones.",
  },
  level_005: {
    name: "Core Siege",
    desc: "The first boss holds a triple spiral. Only the interior pockets survive it — clear this to unlock the RAILGUN.",
  },
  level_006: {
    name: "Ember Relay",
    desc: "Splitter swarms want Pulse — but the ember boss shrugs off splash. Bring a Railgun for the burst, or it drags on.",
    palette: {
      background: "#170a06",
      gridLine: "rgba(255, 122, 47, 0.08)",
      gridLineMajor: "rgba(255, 122, 47, 0.15)",
      buildableDot: "rgba(255, 140, 80, 0.22)",
      pathChannel: "rgba(46, 16, 8, 0.9)",
      pathEdge: "rgba(255, 122, 47, 0.55)",
      pathFlow: "rgba(255, 170, 90, 0.7)",
    },
  },
  level_007: {
    name: "Toxic Sink",
    desc: "A vertical comb drips with splitter swarms. Pulse and patience clear the sink.",
    palette: {
      background: "#0a1206",
      gridLine: "rgba(150, 255, 60, 0.07)",
      gridLineMajor: "rgba(150, 255, 60, 0.14)",
      buildableDot: "rgba(150, 255, 60, 0.20)",
      pathChannel: "rgba(18, 36, 8, 0.9)",
      pathEdge: "rgba(150, 255, 60, 0.5)",
      pathFlow: "rgba(190, 255, 120, 0.65)",
    },
  },
  level_008: {
    name: "Ultraviolet Maze",
    desc: "Full-width maze sweeps under UV light, denying prime tiles. Splitters and regenerators both show up.",
    palette: {
      background: "#0d0618",
      gridLine: "rgba(170, 80, 255, 0.08)",
      gridLineMajor: "rgba(170, 80, 255, 0.16)",
      buildableDot: "rgba(190, 110, 255, 0.22)",
      pathChannel: "rgba(30, 10, 52, 0.9)",
      pathEdge: "rgba(190, 110, 255, 0.55)",
      pathFlow: "rgba(220, 160, 255, 0.7)",
    },
  },
  level_009: {
    name: "Glacier Run",
    desc: "Long frozen straights built for the Railgun — aim down the lanes, and everything is fast.",
    palette: {
      background: "#060d14",
      gridLine: "rgba(160, 220, 255, 0.08)",
      gridLineMajor: "rgba(160, 220, 255, 0.16)",
      buildableDot: "rgba(190, 235, 255, 0.22)",
      pathChannel: "rgba(10, 28, 44, 0.9)",
      pathEdge: "rgba(160, 220, 255, 0.55)",
      pathFlow: "rgba(220, 245, 255, 0.7)",
    },
  },
  level_010: {
    name: "Solar Core",
    desc: "The void's furnace: every enemy type and a triple-boss finale. Survive it to unlock the ROCKET LAUNCHER.",
    palette: {
      background: "#140e02",
      gridLine: "rgba(255, 210, 80, 0.08)",
      gridLineMajor: "rgba(255, 210, 80, 0.16)",
      buildableDot: "rgba(255, 226, 120, 0.22)",
      pathChannel: "rgba(44, 30, 6, 0.9)",
      pathEdge: "rgba(255, 210, 80, 0.55)",
      pathFlow: "rgba(255, 240, 170, 0.7)",
    },
  },
  level_011: {
    name: "Crimson Vein",
    desc: "A bottom-entry spiral coils into a mid-board core. Boss-heavy — the Rocket finally earns its slot.",
    palette: {
      background: "#160406",
      gridLine: "rgba(255, 60, 80, 0.08)",
      gridLineMajor: "rgba(255, 60, 80, 0.16)",
      buildableDot: "rgba(255, 90, 110, 0.22)",
      pathChannel: "rgba(46, 8, 12, 0.9)",
      pathEdge: "rgba(255, 70, 90, 0.55)",
      pathFlow: "rgba(255, 140, 150, 0.7)",
    },
  },
  level_012: {
    name: "Abyssal Teal",
    desc: "A widening cascade of steps. Splitters and regenerators cluster — Pulse/Rocket for the swarm, Railgun for the healers.",
    palette: {
      background: "#04140f",
      gridLine: "rgba(40, 255, 210, 0.08)",
      gridLineMajor: "rgba(40, 255, 210, 0.16)",
      buildableDot: "rgba(90, 255, 225, 0.22)",
      pathChannel: "rgba(6, 40, 34, 0.9)",
      pathEdge: "rgba(40, 255, 210, 0.5)",
      pathFlow: "rgba(150, 255, 235, 0.7)",
    },
  },
  level_013: {
    name: "Violet Pulse",
    desc: "A plus-shaped detour pulses everything into a sprint. Slow and Laser lead; Pulse/Rocket clean up the splitters.",
    palette: {
      background: "#170518",
      gridLine: "rgba(255, 60, 200, 0.08)",
      gridLineMajor: "rgba(255, 60, 200, 0.16)",
      buildableDot: "rgba(255, 110, 220, 0.22)",
      pathChannel: "rgba(48, 8, 40, 0.9)",
      pathEdge: "rgba(255, 70, 210, 0.55)",
      pathFlow: "rgba(255, 150, 235, 0.7)",
    },
  },
  level_014: {
    name: "Silver Null",
    desc: "A tight switchback ladder — six short lanes, little dwell time. Every counter gets tested here.",
    palette: {
      background: "#0b0d12",
      gridLine: "rgba(200, 215, 240, 0.09)",
      gridLineMajor: "rgba(200, 215, 240, 0.18)",
      buildableDot: "rgba(220, 230, 255, 0.25)",
      pathChannel: "rgba(22, 26, 34, 0.9)",
      pathEdge: "rgba(210, 225, 250, 0.6)",
      pathFlow: "rgba(240, 248, 255, 0.75)",
    },
  },
  level_015: {
    name: "Prismatic Core",
    desc: "The grand finale: the full perimeter into a deep spiral, every enemy form, and a four-boss climax.",
    palette: {
      background: "#0b0820",
      gridLine: "rgba(220, 220, 255, 0.10)",
      gridLineMajor: "rgba(245, 245, 255, 0.20)",
      buildableDot: "rgba(235, 235, 255, 0.26)",
      pathChannel: "rgba(24, 20, 48, 0.9)",
      pathEdge: "rgba(235, 235, 255, 0.6)",
      pathFlow: "rgba(255, 255, 255, 0.8)",
    },
  },
};

// Explicit campaign order — the array order LEVELS/game code relies on.
// Matches BALANCE.levels' authored (insertion) order; kept as an explicit
// list so LEVELS' order never silently depends on object key iteration.
const LEVEL_ID_ORDER = [
  "level_001", "level_002", "level_003", "level_004", "level_005",
  "level_006", "level_007", "level_008", "level_009", "level_010",
  "level_011", "level_012", "level_013", "level_014", "level_015",
];

// Merge BALANCE.levels[id] (numbers/structure) with LEVEL_PRESENTATION[id]
// (id/name/desc/palette?), preserving the field order today's literals used.
// Only attaches optional fields (bountyMult/timeBetweenWaves/
// autoStartNextWave/palette) that are actually present on the source data.
function buildLevel(id) {
  const data = BALANCE.levels[id];
  const pres = LEVEL_PRESENTATION[id];
  const level = {
    id,
    name: pres.name,
    desc: pres.desc,
    gridWidth: data.gridWidth,
    gridHeight: data.gridHeight,
    startingMoney: data.startingMoney,
    coreHealth: data.coreHealth,
  };
  if (data.timeBetweenWaves !== undefined) level.timeBetweenWaves = data.timeBetweenWaves;
  if (data.bountyMult !== undefined) level.bountyMult = data.bountyMult;
  if (data.autoStartNextWave !== undefined) level.autoStartNextWave = data.autoStartNextWave;
  if (pres.palette !== undefined) level.palette = pres.palette;
  level.pathCorners = data.pathCorners;
  level.blockedTiles = data.blockedTiles;
  level.waves = data.waves;
  return level;
}

export const LEVELS = LEVEL_ID_ORDER.map(buildLevel);

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
//
// levelIds come from BALANCE.worlds[id].levelIds (BALANCE LAB L2); the rest
// (name/accent/accent2/boardStyle/nodePos) is presentation and stays here.
const WORLD_PRESENTATION = {
  world_1: {
    name: "INNER GRID",
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
  world_2: {
    name: "OUTER VOID",
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
  world_3: {
    name: "PRISM DEEP",
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
};

const WORLD_ID_ORDER = ["world_1", "world_2", "world_3"];

function buildWorld(id) {
  const pres = WORLD_PRESENTATION[id];
  const levelIds = BALANCE.worlds[id].levelIds;
  // Dev-only soft check (never throws): nodePos is presentation-only and
  // can't be seen by balance-schema.js's validate(), so its
  // length === levelIds.length invariant (L0 contract) is asserted here.
  if (pres.nodePos.length !== levelIds.length) {
    console.error(
      `[levels] world ${id}: nodePos.length (${pres.nodePos.length}) !== ` +
      `levelIds.length (${levelIds.length})`
    );
  }
  return {
    id,
    name: pres.name,
    levelIds,
    accent: pres.accent,
    accent2: pres.accent2,
    boardStyle: pres.boardStyle,
    nodePos: pres.nodePos,
  };
}

export const WORLDS = WORLD_ID_ORDER.map(buildWorld);
