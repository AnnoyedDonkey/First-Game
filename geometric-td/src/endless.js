// ============================================================
// ENDLESS — procedural wave generation past the end of a level's
// authored campaign (see levels.js). Deterministic (pure function of
// waveIndex, no RNG) so the step()-driven bot-testing recipe in
// HANDOFF.md stays reproducible.
// ============================================================

import { ENDLESS, WAVE_DEFAULTS } from "./config.js";

const TYPE_CYCLE = ["basic", "fast", "armored", "splitter", "regenerator"];

// Weighted-average effective healthMult across a wave's groups.
function averageWaveHealthMult(wave) {
  const waveMult = wave.healthMult ?? 1;
  let totalCount = 0;
  let weighted = 0;
  for (const g of wave.groups) {
    const gm = (g.healthMult ?? 1) * waveMult;
    weighted += gm * g.count;
    totalCount += g.count;
  }
  return totalCount ? weighted / totalCount : 1;
}

function averageWaveCount(wave) {
  let total = 0;
  for (const g of wave.groups) total += g.count;
  return Math.round(total / wave.groups.length);
}

// Generates one { groups: [...] } wave, same shape buildSpawnQueue
// (game.js) already consumes — for waveIndex PAST the level's own
// authored waves.
export function generateEndlessWave(level, waveIndex) {
  const authoredCount = level.waves.length;
  const k = waveIndex - authoredCount + 1; // 1-based extra-wave number

  const lastWave = level.waves[authoredCount - 1];
  const baseHealthMult = averageWaveHealthMult(lastWave);
  const baseCount = averageWaveCount(lastWave);

  const healthMult = baseHealthMult * Math.pow(1 + ENDLESS.healthGrowthPerWave, k);
  const countMult = Math.min(ENDLESS.maxCountMult, 1 + k * ENDLESS.countGrowthPerWave);
  const speedMult = Math.min(ENDLESS.maxSpeedMult, 1 + k * ENDLESS.speedGrowthPerWave);
  const intervalMult = Math.max(
    ENDLESS.minSpawnIntervalMult,
    Math.pow(ENDLESS.intervalShrinkPerWave, k)
  );

  const primaryType = TYPE_CYCLE[k % TYPE_CYCLE.length];
  const secondaryType = TYPE_CYCLE[(k + 2) % TYPE_CYCLE.length];

  const groups = [
    {
      type: primaryType,
      count: Math.round(baseCount * countMult),
      spawnInterval: WAVE_DEFAULTS.spawnInterval * intervalMult,
      healthMult,
      speedMult,
    },
    {
      type: secondaryType,
      count: Math.round(baseCount * 0.6 * countMult),
      spawnInterval: WAVE_DEFAULTS.spawnInterval * 1.3 * intervalMult,
      startDelay: 3,
      healthMult: healthMult * 0.85,
      speedMult,
    },
  ];

  if (k % ENDLESS.bossEvery === 0) {
    const bossWaves = k / ENDLESS.bossEvery;
    groups.push({
      type: "boss",
      count: 1 + Math.min(4, Math.floor(bossWaves / 2)),
      spawnInterval: 5,
      startDelay: 2,
      healthMult: baseHealthMult * Math.pow(1 + ENDLESS.bossHealthGrowthPerWave, k) * 0.5,
    });
  }

  return { groups };
}
