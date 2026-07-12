// ============================================================
// TOWERS — placement, targeting, and firing.
//
// Targeting rule: towers shoot the enemy FURTHEST along the path
// that is inside their range ("first" targeting).
// ============================================================

import { TOWERS, TOWER_UPGRADES, LOOT } from "./config.js";
import { enemyPosition, damageEnemy, slowEnemy } from "./enemies.js";
import { spawnPulseOrb, spawnRocket } from "./projectiles.js";
import {
  getTowerDamageMult, getSlowDurationMult, takeRosterUnit, isTowerUnlocked,
  getTowerLevelCap, getRailBeamLengthMult,
} from "./progression.js";
import { emitHitSparks } from "./particles.js";
import {
  aggregateGear, masteryRankFor, normalizeGear, xpToNextMastery,
} from "./equipment.js";

let nextTowerId = 1;
const rosterCounters = {}; // per-rosterPrefix counters for names like Laser-01

function nextRosterName(def) {
  rosterCounters[def.rosterPrefix] = (rosterCounters[def.rosterPrefix] || 0) + 1;
  return `${def.rosterPrefix}-${String(rosterCounters[def.rosterPrefix]).padStart(2, "0")}`;
}

// Continue name numbering after saved roster units (so a fresh Laser-03
// can't collide with a persisted Laser-03).
export function seedRosterCounters(roster) {
  for (const rec of roster) {
    const [prefix, num] = rec.name.split("-");
    const n = parseInt(num, 10);
    if (!Number.isNaN(n)) {
      rosterCounters[prefix] = Math.max(rosterCounters[prefix] || 0, n);
    }
  }
}

// rosterRecord (optional): deploy this persistent unit instead of a
// brand-new tower — it keeps its name, XP, kills, and unlocked level.
export function createTower(type, tileX, tileY, grid, rosterRecord = null) {
  const def = TOWERS[type];
  if (!def) throw new Error(`Unknown tower type: ${type}`);

  const tower = {
    id: nextTowerId++,
    name: rosterRecord ? rosterRecord.name : nextRosterName(def),
    type,
    def,
    tileX,
    tileY,
    pos: grid.tileCenter(tileX, tileY),
    level: 1,                 // everyone re-enters battle at level 1
    maxUnlockedLevel: rosterRecord ? rosterRecord.maxLevel : 1,
    xp: rosterRecord ? rosterRecord.xp : 0,
    kills: rosterRecord ? rosterRecord.kills : 0,
    gear: normalizeGear(rosterRecord && rosterRecord.gear),
    cooldown: 0,              // seconds until the tower may fire again
    _shotCounter: 0,
    aimAngle: -Math.PI / 2,
    invested: def.baseCost,   // total money spent (build + upgrades)
  };
  recomputeStats(tower, grid);
  return tower;
}

// Re-apply skill-tree modifiers to every deployed tower (used after
// buying a skill so the effect is immediate).
export function refreshTowerStats(game) {
  for (const t of game.towers) recomputeStats(t, game.grid);
}

// Live stats = base stats scaled by level (compound growth per level).
// SPECIALTY bonuses are PERMANENT: they follow the highest level the
// tower has EVER reached (maxUnlockedLevel), so a maxed veteran keeps
// its full specialty even while re-leveling from 1 in a new battle.
function recomputeStats(tower, grid) {
  const def = tower.def;
  const g = TOWER_UPGRADES;
  const spec = g.specialties[tower.type] || {};
  const lv = tower.level - 1; // level 1 = base stats
  // Career-best level drives the specialty (in-battle level can
  // temporarily exceed maxUnlockedLevel before the battle ends).
  const specLv = Math.max(tower.level, tower.maxUnlockedLevel || 1) - 1;
  const gear = aggregateGear(tower.gear);
  const gs = gear.stats;
  tower.gearStats = gs;
  tower.gearUniques = gear.uniques;

  // Mastery: permanent damage from banked XP (see masteryRankFor).
  tower._masteryRank = masteryRankFor(tower.xp);

  tower.damage =
    def.baseDamage *
    Math.pow(1 + g.damageGrowth, lv) *
    Math.pow(1 + (spec.damageGrowth || 0), specLv) *
    (1 + g.mastery.damagePerRank * tower._masteryRank) *
    getTowerDamageMult(tower.type) *
    (1 + gs.damage / 100);
  tower.range =
    def.baseRange * grid.tileSize *
    Math.pow(1 + g.rangeGrowth, lv) *
    Math.pow(1 + (spec.rangeGrowth || 0), specLv) *
    (1 + gs.range / 100);
  tower.fireInterval =
    def.baseFireRate /
    (Math.pow(1 + g.fireRateGrowth, lv) *
      Math.pow(1 + (spec.fireRateGrowth || 0), specLv) *
      (1 + gs.fireRate / 100));
  if (def.splashRadius) {
    tower.splashRadius =
      def.splashRadius * grid.tileSize *
      Math.pow(1 + g.splashGrowth, lv) *
      Math.pow(1 + (spec.splashGrowth || 0), specLv) *
      (1 + gs.splash / 100);
  }
  if (def.slowPercent) {
    tower.slowPercent = Math.min(
      LOOT.combat.maxSlowPercent / 100,
      def.slowPercent * (1 + gs.slowPotency / 100)
    );
    tower.slowDuration =
      def.slowDuration * Math.pow(1 + g.slowGrowth, lv) *
      getSlowDurationMult() * (1 + gs.slowDuration / 100);
    tower.vulnerability = def.vulnerability || 0;
  }
  if (def.pierceWidth) {
    tower.pierceWidth = def.pierceWidth * grid.tileSize;
  }
  // Railgun over-penetration (skill: railPen) — the rail's damage corridor
  // reaches beyond the tower's range ring. Only affects the railgun; the
  // laser's own pierce uses tower.range directly.
  tower.beamLengthMult = tower.type === "railgun" ? getRailBeamLengthMult() : 1;
  tower.pierce = Math.max(1, (def.basePierce || 1) + gs.pierce);
  tower.projectileSpeedMult = 1 + gs.projSpeed / 100;
  tower.critChance = Math.min(1, gs.critChance / 100);
  tower.critDamage = (LOOT.combat.baseCritDamage + gs.critDamage) / 100;
  tower.doubleShotChance = Math.min(1, gs.overcharge / 100);
  tower.xpGainMult = 1 + gs.xpGain / 100;
  tower.shardFindMult = 1 + gs.shardFind / 100;
  tower.bountyMult = 1 + gs.bounty / 100;
}

// Re-exported for the existing UI imports; implementation lives beside the
// equipment requirement checks so both use exactly the same career-XP math.
export { masteryRankFor, xpToNextMastery };

// Career-best stats for the menu (GEAR_UI_DESIGN.md §2a tower stat sheet).
// Same math as recomputeStats, but keyed off a roster record's maxLevel/xp/
// gear rather than a live in-battle tower — range stays in tiles (no grid
// to scale to pixels) and there's no in-battle "current level" to blend in
// (a career-best veteran is always shown at its unlocked potential).
export function careerStatsFor(rec) {
  const def = TOWERS[rec.type];
  const g = TOWER_UPGRADES;
  const spec = g.specialties[rec.type] || {};
  const lv = (rec.maxLevel || 1) - 1;
  const gear = aggregateGear(normalizeGear(rec.gear));
  const gs = gear.stats;
  const masteryRank = masteryRankFor(rec.xp || 0);
  const damage =
    def.baseDamage *
    Math.pow(1 + g.damageGrowth, lv) *
    Math.pow(1 + (spec.damageGrowth || 0), lv) *
    (1 + g.mastery.damagePerRank * masteryRank) *
    getTowerDamageMult(rec.type) *
    (1 + gs.damage / 100);
  const range =
    def.baseRange *
    Math.pow(1 + g.rangeGrowth, lv) *
    Math.pow(1 + (spec.rangeGrowth || 0), lv) *
    (1 + gs.range / 100);
  const fireInterval =
    def.baseFireRate /
    (Math.pow(1 + g.fireRateGrowth, lv) *
      Math.pow(1 + (spec.fireRateGrowth || 0), lv) *
      (1 + gs.fireRate / 100));
  const specStat = spec.damageGrowth ? "damageGrowth"
    : spec.rangeGrowth ? "rangeGrowth"
    : spec.fireRateGrowth ? "fireRateGrowth"
    : spec.splashGrowth ? "splashGrowth" : null;
  const specialtyPct = specStat ? Math.round((Math.pow(1 + spec[specStat], lv) - 1) * 100) : 0;
  return {
    damage, range, fireInterval,
    fireRate: 1 / fireInterval,
    dps: damage / fireInterval,
    masteryRank,
    masteryPct: Math.round(g.mastery.damagePerRank * masteryRank * 1000) / 10,
    specialtyLabel: spec.label || "",
    specialtyPct,
  };
}

// ---------- Upgrades ----------
// XP makes a tower ELIGIBLE; money pays for the actual upgrade.

// Total XP required to become eligible for the next level (null at max).
// The cap is the account-wide unlocked level (base 5, up to 10 via skills).
export function xpThresholdFor(tower) {
  if (tower.level >= getTowerLevelCap()) return null;
  const t = TOWER_UPGRADES.xpThresholds;
  return t[Math.min(tower.level - 1, t.length - 1)];
}

export function upgradeCostFor(tower) {
  if (tower.level >= getTowerLevelCap()) return null;
  const c = TOWER_UPGRADES.upgradeCosts;
  const base = c[Math.min(tower.level - 1, c.length - 1)];
  // Each tower type can scale its own upgrade cost (Pulse pricier, etc.).
  return Math.round(base * (tower.def.upgradeCostMult || 1));
}

export function isUpgradeEligible(tower) {
  const threshold = xpThresholdFor(tower);
  if (threshold === null) return false;
  // Veterans can re-buy up to their unlocked level without new XP.
  if (tower.level < tower.maxUnlockedLevel) return true;
  return tower.xp >= threshold;
}

// Try to buy the upgrade. Returns true if it went through.
export function tryUpgradeTower(game, tower) {
  if (!isUpgradeEligible(tower)) return false;
  const cost = upgradeCostFor(tower);
  if (game.money < cost) return false;

  game.money -= cost;
  tower.level += 1;
  tower.invested += cost;
  recomputeStats(tower, game.grid);

  game.effects.push({
    kind: "ring",
    x: tower.pos.x,
    y: tower.pos.y,
    color: "#ffffff",
    radius: game.grid.tileSize * 0.6,
    ttl: 0.4,
    maxTtl: 0.4,
  });
  return true;
}

export function towerAt(game, tileX, tileY) {
  return game.towers.find((t) => t.tileX === tileX && t.tileY === tileY) || null;
}

// Try to place a tower. Returns { ok, reason }.
export function placeTower(game, type, tileX, tileY) {
  const def = TOWERS[type];
  if (!isTowerUnlocked(type)) return { ok: false, reason: "locked" };
  if (!game.grid.isBuildable(tileX, tileY)) return { ok: false, reason: "blocked" };
  if (towerAt(game, tileX, tileY)) return { ok: false, reason: "occupied" };
  if (game.money < def.baseCost) return { ok: false, reason: "money" };

  game.money -= def.baseCost;
  // Deploy your best available roster veteran of this type, if any.
  const deployedNames = new Set(game.towers.map((t) => t.name));
  const veteran = takeRosterUnit(type, deployedNames);
  const tower = createTower(type, tileX, tileY, game.grid, veteran);
  game.towers.push(tower);
  (game.typesUsed ||= new Set()).add(type); // B5: survives sells, unlike scanning game.towers

  // Placement flash so building feels responsive.
  game.effects.push({
    kind: "ring",
    x: tower.pos.x,
    y: tower.pos.y,
    color: def.color,
    radius: game.grid.tileSize * 0.5,
    ttl: 0.3,
    maxTtl: 0.3,
  });
  return { ok: true, tower };
}

// Sell a deployed tower for half of everything spent on it. The
// tower leaves the battle but its roster record (XP, unlocked level)
// is untouched — it can be redeployed later.
export function sellValueOf(tower) {
  return Math.floor(tower.invested / 2);
}

export function sellTower(game, tower) {
  const refund = sellValueOf(tower);
  game.money += refund;
  game.towers = game.towers.filter((t) => t !== tower);
  game.effects.push({
    kind: "ring",
    x: tower.pos.x,
    y: tower.pos.y,
    color: "#ffe24a",
    radius: game.grid.tileSize * 0.5,
    ttl: 0.35,
    maxTtl: 0.35,
  });
  return refund;
}

function findTarget(game, tower, excluded = null) {
  let best = null;
  for (const e of game.enemies) {
    if (!e.alive || e === excluded) continue;
    const pos = enemyPosition(e, game.grid);
    const dx = pos.x - tower.pos.x;
    const dy = pos.y - tower.pos.y;
    if (dx * dx + dy * dy > tower.range * tower.range) continue;
    if (!best || e.distance > best.distance) best = e;
  }
  return best;
}

// Railgun aiming: pick the firing LINE (through some in-range enemy) that
// pierces the MOST enemies, so lining the tower up with a straight run of
// the path clears the whole lane. Ties break toward the enemy furthest
// along the path. Returns { angle, target } or null.
function findRailgunAim(game, tower) {
  // Over-penetration (railPen skill) lets the rail aim through and hit
  // enemies out to railLength, not just the range ring.
  const railLength = tower.range * (tower.beamLengthMult || 1);
  const r2 = railLength * railLength;
  const inRange = [];
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const pos = enemyPosition(e, game.grid);
    const dx = pos.x - tower.pos.x;
    const dy = pos.y - tower.pos.y;
    if (dx * dx + dy * dy > r2) continue;
    inRange.push({ e, dx, dy });
  }
  if (!inRange.length) return null;

  let best = null;
  for (const c of inRange) {
    const len = Math.hypot(c.dx, c.dy) || 1;
    const dirX = c.dx / len;
    const dirY = c.dy / len;
    let count = 0;
    for (const o of inRange) {
      const along = o.dx * dirX + o.dy * dirY;
      if (along < 0 || along > railLength) continue;
      const perp = Math.abs(o.dx * dirY - o.dy * dirX);
      if (perp <= tower.pierceWidth + game.grid.tileSize * o.e.def.size) count++;
    }
    const score = Math.min(count, tower.pierce);
    if (!best || score > best.count ||
        (score === best.count && c.e.distance > best.target.distance)) {
      best = { angle: Math.atan2(c.dy, c.dx), count: score, target: c.e };
    }
  }
  return best;
}

export function updateTowers(game, dt) {
  for (const tower of game.towers) {
    // Rank up live: kills mid-battle can push a tower over its next
    // mastery threshold, buffing its damage on the spot.
    if (masteryRankFor(tower.xp) !== tower._masteryRank) {
      recomputeStats(tower, game.grid);
      game.effects.push({
        kind: "ring", x: tower.pos.x, y: tower.pos.y, color: "#ffe24a",
        radius: game.grid.tileSize * 0.55, ttl: 0.5, maxTtl: 0.5,
      });
    }

    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    // Railgun aims down the line that pierces the most enemies (placement
    // matters); every other tower shoots the enemy furthest along the path.
    if (tower.type === "railgun") {
      const aim = findRailgunAim(game, tower);
      if (!aim) continue;
      tower.aimAngle = aim.angle;
      tower.cooldown = tower.fireInterval;
      fire(game, tower, aim.target, enemyPosition(aim.target, game.grid));
      continue;
    }

    const target = findTarget(game, tower);
    if (!target) continue;

    const tpos = enemyPosition(target, game.grid);
    tower.aimAngle = Math.atan2(tpos.y - tower.pos.y, tpos.x - tower.pos.x);
    tower.cooldown = tower.fireInterval;

    fire(game, tower, target, tpos);
  }
}

function hasUnique(tower, id) {
  return tower.gearUniques && tower.gearUniques.has(id);
}

function emitCritVfx(game, tower, x, y) {
  emitHitSparks(game, x, y, "#ffffff", 14 + tower.level * 2);
  game.effects.push({
    kind: "ring", x, y, color: "#ffffff",
    radius: game.grid.tileSize * 0.38, ttl: 0.22, maxTtl: 0.22,
  });
}

// maxLength defaults to the tower's range; the railgun passes a longer
// reach for over-penetration (skill: railPen). The laser leaves it default.
function collectLineVictims(game, tower, angle, halfWidth, maxLength = tower.range) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const victims = [];
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    const pos = enemyPosition(enemy, game.grid);
    const relX = pos.x - tower.pos.x;
    const relY = pos.y - tower.pos.y;
    const along = relX * dirX + relY * dirY;
    if (along < 0 || along > maxLength) continue;
    const perp = Math.abs(relX * dirY - relY * dirX);
    if (perp <= halfWidth + game.grid.tileSize * enemy.def.size) {
      victims.push({ enemy, pos, along });
    }
  }
  victims.sort((a, b) => a.along - b.along);
  return victims.slice(0, tower.pierce);
}

function fire(game, tower, target, targetPos) {
  tower._shotCounter += 1;
  fireVolley(game, tower, target, targetPos);

  const rng = game.rng || Math.random;
  let bonusVolleys = rng() < tower.doubleShotChance ? 1 : 0;
  if (hasUnique(tower, "overflowCore") &&
      tower._shotCounter % LOOT.combat.overflowEveryShots === 0) {
    bonusVolleys += 1;
  }
  for (let i = 0; i < bonusVolleys; i++) {
    fireVolley(game, tower, target, targetPos);
  }
}

function fireVolley(game, tower, target, targetPos) {
  const splitTarget = hasUnique(tower, "prismLens")
    ? findTarget(game, tower, target)
    : null;
  fireShot(game, tower, target, targetPos, 1);
  if (splitTarget) {
    fireShot(
      game, tower, splitTarget, enemyPosition(splitTarget, game.grid),
      LOOT.combat.prismLensDamage / 100
    );
  }
}

function fireShot(game, tower, target, targetPos, damageScale) {
  const def = tower.def;
  const rng = game.rng || Math.random;
  const crit = rng() < tower.critChance;
  const damage = tower.damage * damageScale * (crit ? 1 + tower.critDamage : 1);

  if (tower.type === "railgun") {
    tower.aimAngle = Math.atan2(targetPos.y - tower.pos.y, targetPos.x - tower.pos.x);
  }

  // Muzzle flash at the barrel — bigger on higher-level towers.
  const barrel = game.grid.tileSize * 0.22;
  game.effects.push({
    kind: "muzzle",
    x: tower.pos.x + Math.cos(tower.aimAngle) * barrel,
    y: tower.pos.y + Math.sin(tower.aimAngle) * barrel,
    color: def.color,
    radius: 5 + tower.level * 2,
    ttl: 0.07, maxTtl: 0.07,
  });

  if (tower.type === "laser") {
    const angle = Math.atan2(targetPos.y - tower.pos.y, targetPos.x - tower.pos.x);
    const victims = tower.pierce > 1
      ? collectLineVictims(
          game, tower, angle, game.grid.tileSize * LOOT.combat.laserPierceWidthTiles
        )
      : [{ enemy: target, pos: targetPos }];
    const beamEnd = tower.pierce > 1
      ? {
          x: tower.pos.x + Math.cos(angle) * tower.range,
          y: tower.pos.y + Math.sin(angle) * tower.range,
        }
      : targetPos;
    // Instant beam — thicker as the tower levels up.
    game.effects.push({
      kind: "beam",
      x1: tower.pos.x, y1: tower.pos.y,
      x2: beamEnd.x, y2: beamEnd.y,
      color: def.color,
      width: 1.5 + tower.level * 0.5,
      ttl: 0.08, maxTtl: 0.08,
    });
    for (const victim of victims) {
      if (crit) emitCritVfx(game, tower, victim.pos.x, victim.pos.y);
      damageEnemy(game, victim.enemy, tower, damage);
    }

  } else if (tower.type === "railgun") {
    // The rail damages enemies along its corridor up to its pierce limit.
    // Over-penetration (railPen skill) extends both the visible beam and
    // the damage cutoff beyond the range ring.
    const railLength = tower.range * (tower.beamLengthMult || 1);
    const dirX = Math.cos(tower.aimAngle);
    const dirY = Math.sin(tower.aimAngle);
    const endX = tower.pos.x + dirX * railLength;
    const endY = tower.pos.y + dirY * railLength;

    // Collect victims first (kills can spawn splitlings mid-loop).
    const victims = collectLineVictims(game, tower, tower.aimAngle, tower.pierceWidth, railLength);

    // White-hot rail flash + sparks at every victim.
    game.effects.push({
      kind: "beam",
      x1: tower.pos.x, y1: tower.pos.y,
      x2: endX, y2: endY,
      color: "#ffffff",
      width: 3 + tower.level,
      ttl: 0.15, maxTtl: 0.15,
    });
    game.effects.push({
      kind: "beam",
      x1: tower.pos.x, y1: tower.pos.y,
      x2: endX, y2: endY,
      color: def.color,
      width: 6 + tower.level * 2,
      ttl: 0.1, maxTtl: 0.1,
    });
    for (let i = 0; i < victims.length; i++) {
      const v = victims[i];
      emitHitSparks(game, v.pos.x, v.pos.y, def.color, 6);
      if (crit) emitCritVfx(game, tower, v.pos.x, v.pos.y);
      const ramp = hasUnique(tower, "cascadeRail")
        ? 1 + i * LOOT.combat.cascadeDamageRamp / 100
        : 1;
      damageEnemy(game, v.enemy, tower, damage * ramp);
    }
    game.springGrid.applyShock(
      tower.pos.x + dirX * tower.range * 0.5,
      tower.pos.y + dirY * tower.range * 0.5,
      game.grid.tileSize * 1.5, 60
    );

  } else if (tower.type === "pulse") {
    // Slow homing orb that explodes on impact (see projectiles.js).
    spawnPulseOrb(game, tower, target, { damage, crit });

  } else if (tower.type === "rocket") {
    // Global-range artillery: lob an explosive rocket at the target.
    spawnRocket(game, tower, target, { damage, crit });

  } else if (tower.type === "slow") {
    // Instant zap: light damage + slow debuff.
    game.effects.push({
      kind: "beam",
      x1: tower.pos.x, y1: tower.pos.y,
      x2: targetPos.x, y2: targetPos.y,
      color: def.color,
      width: 1.2 + tower.level * 0.4,
      ttl: 0.12, maxTtl: 0.12,
    });
    if (hasUnique(tower, "gravityWell")) {
      const radius = LOOT.combat.gravityRadiusTiles * game.grid.tileSize;
      for (const enemy of game.enemies) {
        if (!enemy.alive) continue;
        const pos = enemyPosition(enemy, game.grid);
        const dx = pos.x - targetPos.x;
        const dy = pos.y - targetPos.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        slowEnemy(
          game, enemy, tower.slowPercent, tower.slowDuration,
          tower.vulnerability, tower
        );
        enemy.distance = Math.max(
          0, enemy.distance - LOOT.combat.gravityDragTiles * game.grid.tileSize
        );
      }
      game.effects.push({
        kind: "ring", x: targetPos.x, y: targetPos.y, color: def.color,
        radius, ttl: 0.3, maxTtl: 0.3,
      });
    } else {
      slowEnemy(
        game, target, tower.slowPercent, tower.slowDuration,
        tower.vulnerability, tower
      );
    }
    if (crit) emitCritVfx(game, tower, targetPos.x, targetPos.y);
    damageEnemy(game, target, tower, damage);
  }
}
