// ============================================================
// GRID — tile math, path expansion, and placement rules.
// ============================================================

// Turn a list of corner points into every tile the path crosses.
// Corners must line up horizontally or vertically with each other.
export function expandPathCorners(corners) {
  const tiles = [{ x: corners[0].x, y: corners[0].y }];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    if (a.x !== b.x && a.y !== b.y) {
      throw new Error(
        `Path corners ${i} and ${i + 1} are not in a straight line: ` +
        `(${a.x},${a.y}) -> (${b.x},${b.y})`
      );
    }
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let { x, y } = a;
    while (x !== b.x || y !== b.y) {
      x += dx;
      y += dy;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

const key = (x, y) => `${x},${y}`;

// Build everything the game needs to know about the board.
export function createGridModel(level, tileSize) {
  const pathTiles = expandPathCorners(level.pathCorners);
  const pathSet = new Set(pathTiles.map((t) => key(t.x, t.y)));
  const blockedSet = new Set((level.blockedTiles || []).map((t) => key(t.x, t.y)));

  // Pixel-space centers of the path corners — enemies walk this polyline.
  const pathPoints = level.pathCorners.map((c) => ({
    x: (c.x + 0.5) * tileSize,
    y: (c.y + 0.5) * tileSize,
  }));

  // Cumulative distance at each corner, so we can place an enemy
  // anywhere along the path from a single "distance traveled" number.
  const segmentStarts = [0];
  let totalPathLength = 0;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    totalPathLength += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    segmentStarts.push(totalPathLength);
  }

  return {
    width: level.gridWidth,
    height: level.gridHeight,
    tileSize,
    pathTiles,
    pathPoints,
    segmentStarts,
    totalPathLength,

    isInside(x, y) {
      return x >= 0 && y >= 0 && x < level.gridWidth && y < level.gridHeight;
    },
    isPath(x, y) {
      return pathSet.has(key(x, y));
    },
    isBlocked(x, y) {
      return blockedSet.has(key(x, y));
    },
    isBuildable(x, y) {
      return this.isInside(x, y) && !this.isPath(x, y) && !this.isBlocked(x, y);
    },
    tileCenter(x, y) {
      return { x: (x + 0.5) * tileSize, y: (y + 0.5) * tileSize };
    },

    // Pixel position of a point `distance` pixels along the path.
    positionOnPath(distance) {
      const d = Math.max(0, Math.min(distance, totalPathLength));
      // Find which segment we're on.
      let i = 0;
      while (i < segmentStarts.length - 2 && segmentStarts[i + 1] < d) i++;
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const segLen = segmentStarts[i + 1] - segmentStarts[i];
      const t = segLen === 0 ? 0 : (d - segmentStarts[i]) / segLen;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    },
  };
}
