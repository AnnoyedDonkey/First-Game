// ============================================================
// SIMULATION CLOCK — bounded-substep authoritative game-time advancement.
// ============================================================

import { PERFORMANCE } from "./config.js";

export function createSimulationClock(knobs = PERFORMANCE.simulation) {
  return {
    advance(frameSeconds, speed, tick) {
      if (!Number.isFinite(frameSeconds) || frameSeconds < 0 ||
          !Number.isFinite(speed) || speed <= 0) {
        return 0;
      }

      const maxBudget = knobs.maxStepSeconds * knobs.maxCatchUpSteps;
      const elapsed = Math.min(
        Math.min(frameSeconds, knobs.maxFrameSeconds) * speed,
        maxBudget
      );
      if (elapsed <= 0) return 0;

      // The configured step is a maximum, not a forced cadence: a 120 Hz
      // display still advances every frame at ~1/120s, while a 30 Hz display
      // divides its ~1/30s frame into two safe updates. That preserves both
      // ProMotion smoothness and low-framerate gameplay pacing.
      const steps = Math.min(
        Math.max(1, Math.ceil(elapsed / knobs.maxStepSeconds - 1e-9)),
        knobs.maxCatchUpSteps
      );
      const dt = elapsed / steps;
      for (let i = 0; i < steps; i++) tick(dt);
      return steps;
    },
  };
}
