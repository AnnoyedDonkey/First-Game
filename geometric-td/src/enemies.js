// ============================================================
// ENEMIES — creation and movement.
// ============================================================

import { ENEMIES, ECONOMY, VFX, LOOT } from "./config.js";
import { getMoneyMult, getXpMult, getSkillShardFindMult } from "./progression.js";
import { rollKillDrop } from "./loot.js";
import { emitHitSparks, emitDeathShards } from "./particles.js";

let nextEnemyId = 1;

// mods lets a wave group scale this specific enemy:
// { healthMult, speedMult, bountyMult, xpMult }
export function createEnemy(type, mods = {}) {
  const def = ENEMIES[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);

  const healthMult = mods.healthMult ?? 1;
  const speedMult = mods.speedMult ?? 1;

  return {
    id: nextEnemyId++,
    type,
    def,
    mods,               // kept so splitters can pass scaling to children
    health: def.baseHealth * healthMult,
    maxHealth: def.baseHealth * healthMult,
    speedTilesPerSec: def.speed * speedMult,
    bounty: Math.round(def.bounty * (mods.bountyMult ?? 1)),
    xp: Math.round(def.xp * (mods.xpMult ?? 1)),
    coreDamage: def.coreDamage,
    distance: 0,        // pixels traveled along the path
    slowUntil: 0,       // game-time until which the enemy is slowed
    slowFactor: 1,      // current speed multiplier from slow towers
    vulnUntil: 0,       // game-time until which +damage debuff applies
    vulnMult: 1,        // damage multiplier while vulnerable (Slow debuff)
    hitFlash: 0,        // seconds remaining of the "just hit" flash
    healPulse: 0,       // regenerator visual timer
    alive: true,
  };
}

// Advance all enemies. Returns the enemies that reached the core
// this frame (they are marked dead and should damage the core).
export function updateEnemies(game, dt) {
  const { grid } = game;
  const leaked = [];
  for (const e of game.enemies) {
    if (!e.alive) continue;

    const slow = game.time < e.slowUntil ? e.slowFactor : 1;
    e.distance += e.speedTilesPerSec * slow * grid.tileSize * dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    // Regenerators heal while alive (and pulse a soft ring).
    if (e.def.regenRate && e.health < e.maxHealth) {
      e.health = Math.min(e.maxHealth, e.health + e.maxHealth * e.def.regenRate * dt);
      e.healPulse -= dt;
      if (e.healPulse <= 0) {
        e.healPulse = 1.2;
        const pos = grid.positionOnPath(e.distance);
        game.effects.push({
          kind: "ring", x: pos.x, y: pos.y, color: e.def.color,
          radius: grid.tileSize * e.def.size * 1.3, ttl: 0.5, maxTtl: 0.5,
        });
      }
    }

    if (e.distance >= grid.totalPathLength) {
      e.alive = false;
      leaked.push(e);
    }
  }
  return leaked;
}

export function enemyPosition(enemy, grid) {
  return grid.positionOnPath(enemy.distance);
}

// Contributor-weighted XP (loot spec §3): every tower that damages or
// slows an enemy banks "weight" on it; at death the kill's XP pool is
// split by weight instead of all going to the final-hit tower. This is
// what finally levels Slow towers. Stored on the enemy as
// _contrib[towerName] = { tower, weight }; consumed once, at death.
function addContribution(enemy, tower, weight) {
  if (!tower || weight <= 0) return;
  if (!enemy._contrib) enemy._contrib = {};
  const entry = enemy._contrib[tower.name];
  if (entry) entry.weight += weight;
  else enemy._contrib[tower.name] = { tower, weight };
}

// Split a dead enemy's XP pool among its contributors by weight. The
// killer always gets the kill count and any flooring remainder; if there
// were somehow no tracked contributors, the killer takes the whole pool.
function awardKillXp(enemy, killer, pool) {
  if (killer) killer.kills += 1;
  if (pool <= 0) return;

  const contrib = enemy._contrib;
  let total = 0;
  if (contrib) for (const name in contrib) total += contrib[name].weight;

  if (!contrib || total <= 0) {
    if (killer) killer.xp += Math.round(pool * (killer.xpGainMult || 1));
    return;
  }

  let distributed = 0;
  for (const name in contrib) {
    const { tower, weight } = contrib[name];
    const share = Math.floor(pool * (weight / total));
    tower.xp += Math.round(share * (tower.xpGainMult || 1));
    distributed += share;
  }
  // Hand the flooring remainder to the killer (a contributor) if there is
  // one, else to any tracked contributor so no XP is silently dropped.
  const remainder = pool - distributed;
  if (remainder > 0) {
    if (killer && contrib[killer.name]) {
      killer.xp += Math.round(remainder * (killer.xpGainMult || 1));
    }
    else {
      const first = contrib[Object.keys(contrib)[0]];
      if (first) first.tower.xp += Math.round(remainder * (first.tower.xpGainMult || 1));
    }
  }
}

// Apply damage from a tower (or splash). Handles death: bounty money,
// contributor-weighted XP, kill count, and a death burst.
export function damageEnemy(game, enemy, sourceTower, amount) {
  if (!enemy.alive) return;

  // Damage-type counters: enemies resist / are weak to specific towers
  // (ENEMIES[type].damageMult keyed by the tower's damageType).
  let typeMult = 1;
  if (sourceTower) {
    const m = enemy.def.damageMult && enemy.def.damageMult[sourceTower.def.damageType];
    if (m != null) typeMult = m;
    if (typeMult < 1 && sourceTower.gearUniques &&
        sourceTower.gearUniques.has("entropyEmitter")) {
      typeMult = 1;
    }
  }
  let dmg = amount * typeMult;
  if (sourceTower && sourceTower.gearUniques &&
      sourceTower.gearUniques.has("executionersArray") &&
      enemy.health / enemy.maxHealth < LOOT.combat.executionHealthBelow / 100) {
    dmg *= 1 + LOOT.combat.executionDamage / 100;
  }
  // Destabilizer marks a slowed target, making its bonus global for the
  // rest of that slow. The strongest mark wins rather than stacking.
  if (sourceTower && game.time < enemy.slowUntil &&
      sourceTower.gearUniques && sourceTower.gearUniques.has("vulnMark")) {
    const unique = LOOT.gen.uniques.minor.find((u) => u.id === "vulnMark");
    enemy.gearVulnBonus = Math.max(enemy.gearVulnBonus || 0, unique.value / 100);
    enemy.gearVulnUntil = Math.max(enemy.gearVulnUntil || 0, enemy.slowUntil);
  }
  let vulnMult = game.time < enemy.vulnUntil ? enemy.vulnMult : 1;
  if (game.time < (enemy.gearVulnUntil || 0)) vulnMult += enemy.gearVulnBonus || 0;
  dmg *= vulnMult;

  enemy.health -= dmg;
  enemy.hitFlash = 0.1;

  // Bank this hit's damage as XP-contribution weight (1 per point of
  // damage dealt). Runs before the death check so the killing blow counts.
  addContribution(enemy, sourceTower, dmg);

  if (enemy.health > 0) {
    // Impact feedback that TEACHES the counter: a wrong-tower hit clangs
    // off dull grey with a shield ring; a super-effective hit pops bright
    // white with a colored halo. Neutral hits use the normal spark burst.
    const hp = enemyPosition(enemy, game.grid);
    const level = sourceTower ? sourceTower.level : 1;
    if (typeMult >= 1.2) {
      emitHitSparks(game, hp.x, hp.y, "#ffffff", VFX.hitSparkCount + level + 4);
      game.effects.push({
        kind: "ring", x: hp.x, y: hp.y, color: sourceTower.def.color,
        radius: game.grid.tileSize * enemy.def.size * 1.4, ttl: 0.22, maxTtl: 0.22,
      });
    } else if (typeMult <= 0.75) {
      emitHitSparks(game, hp.x, hp.y, "#8a97ac",
        Math.max(2, Math.round((VFX.hitSparkCount + level - 1) * 0.35)));
      game.effects.push({
        kind: "ring", x: hp.x, y: hp.y, color: "#8a97ac",
        radius: game.grid.tileSize * enemy.def.size * 1.05, ttl: 0.18, maxTtl: 0.18,
      });
    } else {
      emitHitSparks(game, hp.x, hp.y, enemy.def.color, VFX.hitSparkCount + level - 1);
    }
    return;
  }

  enemy.alive = false;
  game.money += Math.round(
    enemy.bounty * ECONOMY.moneyPerKillMultiplier * getMoneyMult() *
    (sourceTower ? sourceTower.bountyMult || 1 : 1)
  );

  // The base XP pool is split without inflation; equipped XP Gain then
  // multiplies each recipient's awarded share.
  const killXp = Math.round(enemy.xp * ECONOMY.xpPerKillMultiplier * getXpMult());
  awardKillXp(enemy, sourceTower, killXp);

  // Shards ◆ (loot spec §1) — persistent currency, earned per kill
  // regardless of win/loss. Banked on `game` and synced to the save at
  // battle end (progression.js syncRoster), same pattern as roster XP.
  // Accumulated as a FLOAT — per-kill values are small (perKillBase
  // 0.12) so rounding every kill would lose most of it; round once when
  // syncing to the wallet instead.
  const levelNumber = game.level && game.level.id ? Number(game.level.id.slice(-3)) || 1 : 1;
  const levelMult = 1 + LOOT.shards.perLevelMult * (levelNumber - 1);
  game.shardsEarned +=
    LOOT.shards.perKillBase * (enemy.def.shardTier ?? 1) * levelMult *
    (sourceTower ? sourceTower.shardFindMult || 1 : 1) *
    getSkillShardFindMult();

  const drop = rollKillDrop(enemy, game.level, game.waveIndex);
  if (drop) game.lootDrops.push(drop);

  const pos = enemyPosition(enemy, game.grid);
  const ts = game.grid.tileSize;
  game.effects.push({
    kind: "burst",
    x: pos.x,
    y: pos.y,
    color: enemy.def.color,
    radius: ts * enemy.def.size * 1.6,
    ttl: 0.35,
    maxTtl: 0.35,
  });

  // GeoDefense-style shatter: edges fly apart + a grid shockwave.
  // Stronger killers produce a more violent explosion.
  emitDeathShards(game, pos.x, pos.y, enemy.def, ts, sourceTower ? sourceTower.level : 1);
  const isBoss = enemy.type === "boss";
  game.springGrid.applyShock(
    pos.x, pos.y,
    ts * VFX.warp.shockRadiusTiles * (isBoss ? 2 : 1),
    isBoss ? VFX.warp.bossShock : VFX.warp.deathShock
  );

  // Splitters burst into children that keep marching from the same
  // spot, inheriting the parent's wave scaling.
  if (enemy.def.splitInto) {
    const { type, count } = enemy.def.splitInto;
    for (let i = 0; i < count; i++) {
      const child = createEnemy(type, enemy.mods);
      // Stagger them slightly so they don't overlap perfectly.
      child.distance = Math.max(0, enemy.distance - i * game.grid.tileSize * 0.25);
      game.enemies.push(child);
    }
  }
}

// Apply a slow debuff (from Slow Towers). `vulnerability` (optional) also
// marks the enemy to take extra damage from all sources for `duration`.
// `sourceTower` (optional) banks XP-contribution weight for the slow so
// Slow towers earn XP even when they never land the killing blow.
export function slowEnemy(game, enemy, slowPercent, duration, vulnerability = 0, sourceTower = null) {
  enemy.slowFactor = 1 - slowPercent;
  enemy.slowUntil = game.time + duration;
  if (vulnerability > 0) {
    enemy.vulnMult = 1 + vulnerability;
    enemy.vulnUntil = game.time + duration;
  }
  addContribution(enemy, sourceTower, duration * LOOT.xp.slowWeightPerSec);
}
