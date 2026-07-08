// ============================================================
// SPRING GRID — the Geometry Wars / GeoDefense "screen morph".
//
// The background grid is a mesh of point masses. Each node is
// pulled toward its rest position (home spring) and toward the
// average displacement of its neighbors (coupling — this is what
// makes ripples propagate outward). Explosions push impulses in.
// Tuning lives in config.js VFX.warp; displacement is clamped so
// readability never suffers.
// ============================================================

import { VFX } from "./config.js";

export function createSpringGrid(widthPx, heightPx, tileSize) {
  const w = VFX.warp;
  const spacing = tileSize * w.spacingTiles;
  const cols = Math.round(widthPx / spacing) + 1;
  const rows = Math.round(heightPx / spacing) + 1;

  // Flat typed-ish arrays for speed: displacement + velocity per node.
  const n = cols * rows;
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);

  function idx(c, r) {
    return r * cols + c;
  }

  return {
    cols,
    rows,
    spacing,

    // Rest position of a node (draw code adds displacement).
    homeX(c) { return c * spacing; },
    homeY(r) { return r * spacing; },
    dispX(c, r) { return dx[idx(c, r)]; },
    dispY(c, r) { return dy[idx(c, r)]; },

    // Radial impulse: pushes nearby nodes away from (x, y).
    applyShock(x, y, radiusPx, strength) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = idx(c, r);
          const ox = c * spacing + dx[i] - x;
          const oy = r * spacing + dy[i] - y;
          const d = Math.hypot(ox, oy);
          if (d > radiusPx || d < 0.001) continue;
          const falloff = 1 - d / radiusPx;
          vx[i] += (ox / d) * strength * falloff;
          vy[i] += (oy / d) * strength * falloff;
        }
      }
    },

    update(dt) {
      // Border nodes stay anchored so the frame never tears away.
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const i = idx(c, r);

          // Neighbor coupling: get pulled toward the average
          // displacement of the four neighbors.
          const avgX =
            (dx[i - 1] + dx[i + 1] + dx[i - cols] + dx[i + cols]) / 4;
          const avgY =
            (dy[i - 1] + dy[i + 1] + dy[i - cols] + dy[i + cols]) / 4;

          let ax = -dx[i] * w.homeStiffness + (avgX - dx[i]) * w.neighborStiffness;
          let ay = -dy[i] * w.homeStiffness + (avgY - dy[i]) * w.neighborStiffness;

          vx[i] += ax * dt;
          vy[i] += ay * dt;
          vx[i] -= vx[i] * w.damping * dt;
          vy[i] -= vy[i] * w.damping * dt;
        }
      }
      const m = w.maxDisplacement;
      for (let i = 0; i < n; i++) {
        dx[i] = Math.max(-m, Math.min(m, dx[i] + vx[i] * dt));
        dy[i] = Math.max(-m, Math.min(m, dy[i] + vy[i] * dt));
      }
    },
  };
}
