// ============================================================
// ROGUELIKE — run state machine + sandbox (DEBUG-gated mode).
//
// A run-based gauntlet layered on the existing TD engine: survive procedurally
// chosen encounters across ROGUELIKE.floorCount floors and beat the final boss
// to win. See ROGUELIKE_PLAN.md for the full design and phase map, and
// ROGUELIKE_SOURCE_EXTRACT.md for the reusable engine systems.
//
// PHASE A (foundation, shipped): the run object, the save-sandbox wiring, and
// a single hand-built placeholder encounter.
//
// PHASE B (shipped): the real procedural generator + the full encounter pool.
// Everything tunable lives in config.js ROGUELIKE — no run number is
// hardcoded here. See the "Non-combat resolver contract" comment below for
// how the Phase C UI drives this file.
//
// PHASE D (this pass): draftable run upgrades are now WIRED — the "upgrade"
// node kind (resolveUpgradeNode/pickRunUpgrade/applyRunUpgrade below) mutates
// the live run.context.mults/.unlockedTowers/run.maxCoreIntegrity that the
// sandbox already reads, so a drafted upgrade changes the very next tower's
// stats. Also: elites now stage a guaranteed bonus gear reward on win (see
// onBattleEnd), and content/difficulty tables got a balance pass. See
// ROGUELIKE_PLAN.md §9 for the open-question decisions this pass made.
//
// SANDBOX CONTRACT (the reason this mode is safe): a run NEVER reads or writes
// the real save. Fresh, gearless, level-1 towers come free from placeTower via
// the run's own player roster; the skill/economy getters return fresh-account
// values while a run is active (progression.js setRunContext); and end-of-battle
// is intercepted in main.js BEFORE the campaign's recordBattleEnd / telemetry /
// loot-to-stash ever run. Mastery/XP deliberately do NOT carry across floors —
// run power comes from drafted gear + upgrades (Phase D), not a mastery grind.
//
// GEAR-EQUIP NOTE: the account gear UI gates equips on Mastery
// (equipment.js canEquipItem / LOOT.equipGate.minMastery) because a real
// tower's Mastery is earned from banked XP. A run roster's XP intentionally
// never accrues Mastery (see above), so that gate would make every drafted
// item permanently unequippable in a run. Per ROGUELIKE_SOURCE_EXTRACT.md's
// stated reuse angle ("drop the Mastery req-gate, offer gear as draft
// rewards"), run gear is attached directly to the roster record
// (`record.gear[slot] = item`) — it bypasses canEquipItem entirely (that's a
// real-save UI affordance, not a combat-time requirement; towers.js's
// aggregateGear reads whatever is in `gear` unconditionally). Drafted items
// also have `reqLevel`/`reqMastery` zeroed for the same reason.
// ============================================================

import { ROGUELIKE, TOWERS } from "./config.js";
import { makeRng, generateItem, rollRarity } from "./loot.js";
import { emptyGear } from "./equipment.js";
import { setRunContext } from "./progression.js";
import { saveRoguelikeRun, loadRoguelikeRun, clearRoguelikeRun } from "./save.js";

// Snapshot schema version — bump if the persisted run shape below changes so a
// stale snapshot from an older build is ignored rather than mis-restored. This
// is a schema tag, not a gameplay tunable, so it lives here (not config.js).
const RUN_SNAPSHOT_VERSION = 1;

// The active run, or null when no run is in progress. Module-local — a page
// reload abandons the run (acceptable for a DEBUG feature; the save is untouched
// either way). Phase E may add opt-in persistence via save.js.
let run = null;

// main.js injects the battle launcher (it owns the canvas + frame loop + the
// `game` variable). roguelike.js stays UI/engine-agnostic so it has no import
// cycle with ui.js/main.js.
let launchBattle = null;
export function setBattleLauncher(fn) { launchBattle = fn; }

export function getRun() { return run; }
export function isRunActive() { return !!run; }

// ---------- Small local helpers (rng-driven, no Math.random) ----------

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Weighted pick from an object like { normal: 50, elite: 15, ... }. Falls
// back to the first key if weights are somehow all zero/missing (defensive;
// never throws on a malformed band).
function weightedPick(weights, rng) {
  let total = 0;
  for (const k in weights) total += weights[k];
  if (total <= 0) return Object.keys(weights)[0];
  let r = rng() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return Object.keys(weights)[0];
}

// Partial Fisher-Yates: `count` distinct entries from `arr`, rng-driven.
function sampleWithoutReplacement(arr, count, rng) {
  const pool = arr.slice();
  const out = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out;
}

// `count` distinct entries from `entries` (objects with a `.weight`),
// weighted without replacement — repeatedly weightedPick over the shrinking
// pool. Used for run-upgrade offers so the same upgrade never appears twice
// in one offer, while rarer/stronger picks (lower weight) show up less often.
function weightedSampleDistinct(entries, count, rng) {
  const pool = entries.slice();
  const out = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const weights = {};
    pool.forEach((e, idx) => { weights[idx] = e.weight || 1; });
    const idx = Number(weightedPick(weights, rng));
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

// First band whose maxDepth >= depth (bands sorted ascending; last is
// typically Infinity, so this always resolves).
function pickBand(bands, depth) {
  for (const band of bands) {
    if (depth <= band.maxDepth) return band;
  }
  return bands[bands.length - 1];
}

// ---------- Run lifecycle ----------

// Build the fresh run roster: one unit of each starter tower, level 1, no XP,
// no gear. Names are unique per type so takeRosterUnit's deployed-name guard
// works. Gear drafts attach to these records and persist across floors;
// XP/maxLevel intentionally stay fresh every floor.
function buildStarterRoster() {
  return ROGUELIKE.starterTowers.map((type) => {
    const def = TOWERS[type];
    return {
      name: `${def?.rosterPrefix || type}-01`,
      type,
      maxLevel: 1,
      xp: 0,
      kills: 0,
      gear: emptyGear(),
    };
  });
}

// The sandbox context handed to createGame + read by the shimmed progression
// getters for the whole run. `mults`/`speeds` start at the fresh-account
// baseline; Phase D raises them from drafted run upgrades. `coreHealth` is the
// carried Core Integrity, refreshed before each battle. `unlockedTowers` is
// the SAME array reference as `r.unlockedTowers` by default; an elite node's
// "restricted towers" modifier temporarily swaps it for a narrower array and
// restores the original reference after the battle (see applyEliteModifier*).
function buildRunContext(r) {
  return {
    roster: r.roster,
    unlockedTowers: r.unlockedTowers,
    coreHealth: r.coreIntegrity,
    speeds: ROGUELIKE.baseSpeeds.slice(),
    mults: { ...ROGUELIKE.baseMults },
  };
}

// Start a fresh run. `seed` is optional (deterministic runs / future daily
// seeds); a random one is chosen otherwise. Sets the sandbox context for the
// whole run and rolls the first floor's choices. Returns the run object.
export function startRun(seed = (Math.random() * 0x7fffffff) >>> 0) {
  run = {
    seed,
    rng: makeRng(seed),
    floorIndex: 0,                                  // 0-based; floorCount total
    maxCoreIntegrity: ROGUELIKE.startingCoreIntegrity,
    coreIntegrity: ROGUELIKE.startingCoreIntegrity, // carries across floors
    salvage: ROGUELIKE.startingSalvage,
    roster: buildStarterRoster(),
    unlockedTowers: ROGUELIKE.starterTowers.slice(),
    choices: [],
    currentNode: null,
    pendingChoice: null,      // staged non-combat resolution (gear/shop/event) — see contract below
    phase: "choosing",        // choosing | battle | reward | shop | event | won | lost
    log: [],
    draftedUpgrades: [],      // { id, label } for every upgrade actually applied this run (Phase E summary)
  };
  run.context = buildRunContext(run);
  setRunContext(run.context);                       // sandbox ON for the whole run
  rollFloorChoices();
  persist();                                        // immediately resumable (Phase E)
  return run;
}

// End the run and turn the sandbox OFF, so the campaign/menu see the real save
// again. Called when a run finishes (win/lose) or the player abandons it.
export function endRun(reason = "ended") {
  if (run) run.log.push(`run ${reason} at floor ${run.floorIndex + 1}`);
  run = null;
  setRunContext(null);
  clearRoguelikeRun();                              // no run to resume anymore
}

// ---------- Run persistence (Phase E) ----------
// The run is serialized to its OWN localStorage key (save.js, never the real
// save object) after every out-of-battle state change, so a page reload can
// resume it. The sandbox contract is preserved: resumeRun re-arms setRunContext
// so a resumed run STILL never reads or writes real progression. The rng is
// persisted by its internal state (loot.js makeRng exposes rng.state()), so a
// resumed run continues the exact same deterministic stream. `context.roster` /
// `context.unlockedTowers` are NOT stored separately — they are the same array
// references as run.roster / run.unlockedTowers and are re-linked on restore.

function serializeRun() {
  if (!run) return null;
  return {
    v: RUN_SNAPSHOT_VERSION,
    seed: run.seed,
    rngState: run.rng.state ? run.rng.state() : undefined,
    floorIndex: run.floorIndex,
    maxCoreIntegrity: run.maxCoreIntegrity,
    coreIntegrity: run.coreIntegrity,
    salvage: run.salvage,
    roster: run.roster,
    unlockedTowers: run.unlockedTowers,
    choices: run.choices,
    currentNode: run.currentNode,
    pendingChoice: run.pendingChoice,
    phase: run.phase,
    draftedUpgrades: run.draftedUpgrades,
    log: run.log,
    mults: run.context.mults,
    speeds: run.context.speeds,
  };
}

// Write the current run to storage. No-op without a run. Called after each
// out-of-battle mutation (see call sites). During a battle only the clean,
// pre-modifier state is ever persisted (see resolveCombatNode), so a resumed
// run never inherits a transient elite/farm battle modifier.
function persist() {
  if (!run) return;
  saveRoguelikeRun(serializeRun());
}

// True when a valid, still-in-progress run snapshot exists (won/lost runs are
// not resumable — they clear their snapshot on end). Drives the RESUME button.
export function hasResumableRun() {
  const snap = loadRoguelikeRun();
  return !!(snap && snap.v === RUN_SNAPSHOT_VERSION &&
    snap.phase && snap.phase !== "won" && snap.phase !== "lost");
}

// Rebuild the run from its snapshot and re-arm the sandbox. Returns the run, or
// null if there is no valid snapshot. A reload DURING a battle can't rebuild the
// in-progress combat, so the run drops back to the current floor's node choices
// with no penalty (Core Integrity was persisted pre-battle).
export function resumeRun() {
  const snap = loadRoguelikeRun();
  if (!snap || snap.v !== RUN_SNAPSHOT_VERSION) return null;
  run = {
    seed: snap.seed,
    rng: makeRng(snap.seed, snap.rngState),
    floorIndex: snap.floorIndex,
    maxCoreIntegrity: snap.maxCoreIntegrity,
    coreIntegrity: snap.coreIntegrity,
    salvage: snap.salvage,
    roster: snap.roster,
    unlockedTowers: snap.unlockedTowers,
    choices: snap.choices || [],
    currentNode: snap.currentNode || null,
    pendingChoice: snap.pendingChoice || null,
    phase: snap.phase,
    log: snap.log || [],
    draftedUpgrades: snap.draftedUpgrades || [],
  };
  run.context = {
    roster: run.roster,                 // re-link: same reference the getters read
    unlockedTowers: run.unlockedTowers, // re-link: shop/upgrade push onto this
    coreHealth: run.coreIntegrity,
    speeds: Array.isArray(snap.speeds) ? snap.speeds.slice() : ROGUELIKE.baseSpeeds.slice(),
    mults: snap.mults ? { ...snap.mults } : { ...ROGUELIKE.baseMults },
  };
  if (run.phase === "battle") {          // abandoned mid-combat — return to choices
    run.phase = "choosing";
    run.currentNode = null;
    run.pendingChoice = null;
    run._modifierBackup = null;
  }
  setRunContext(run.context);            // re-arm the sandbox for the resumed run
  persist();                             // rewrite the (possibly coerced) snapshot
  return run;
}

// ---------- Floors & nodes ----------

// True on the last floor — the boss = the run's win condition.
function isBossFloor(floorIndex) {
  return floorIndex >= ROGUELIKE.floorCount - 1;
}

// Depth-weighted encounter pool (normal/elite/farm/gear/shop/event/recovery),
// or a single forced boss node on the final floor. "elite" is stripped from
// whatever band applies before floor `eliteMinDepth`. A node's kind-specific
// extra detail (elite modifier / event definition) is rolled here too, at
// node-generation time, so the SAME seed always produces the SAME choices
// with the SAME sub-details (determinism the console/UI can rely on) — no
// re-rolling happens later when a node is actually chosen.
function rollFloorChoices() {
  if (isBossFloor(run.floorIndex)) {
    run.choices = [{ kind: "boss", label: "CORE BREACH — BOSS", depth: run.floorIndex }];
    return;
  }

  const depth = run.floorIndex;
  const band = pickBand(ROGUELIKE.nodeWeights.bands, depth);
  const weights = { ...band.weights };
  if (depth < ROGUELIKE.eliteMinDepth) delete weights.elite;

  const chosenKinds = [];
  for (let i = 0; i < ROGUELIKE.choicesPerFloor; i++) {
    // Prefer a kind not already offered this floor (nicer variety), but allow
    // a repeat rather than loop forever on a narrow weight table.
    let kind = weightedPick(weights, run.rng);
    for (let attempt = 0; attempt < 3 && chosenKinds.includes(kind); attempt++) {
      kind = weightedPick(weights, run.rng);
    }
    chosenKinds.push(kind);
  }

  run.choices = chosenKinds.map((kind) => makeNode(kind, depth));
}

function makeNode(kind, depth) {
  const node = { kind, depth };
  switch (kind) {
    case "normal":
      node.label = "HOSTILE WAVE";
      break;
    case "elite":
      node.modifier = pick(ROGUELIKE.eliteModifiers, run.rng);
      node.label = `ELITE — ${node.modifier.label}`;
      break;
    case "farm":
      node.label = "SUPPLY DRONE";
      break;
    case "gear":
      node.label = "SALVAGE CACHE";
      break;
    case "shop":
      node.label = "TRADE POST";
      break;
    case "event":
      node.event = pick(ROGUELIKE.events, run.rng);
      node.label = node.event.label;
      break;
    case "recovery":
      node.label = "REPAIR BAY";
      break;
    case "upgrade":
      node.label = "SYSTEM UPGRADE";
      break;
    default:
      node.label = kind.toUpperCase();
  }
  return node;
}

// Advance to the next floor and roll fresh choices. Shared by every resolver
// that finishes a floor WITHOUT going through onBattleEnd (recovery resolves
// immediately; gear/shop/event finish via their follow-up calls). Returns a
// small snapshot so callers can fold it into their own result descriptor.
function advanceFloor() {
  run.floorIndex += 1;
  run.context.coreHealth = run.coreIntegrity;
  run.phase = "choosing";
  run.currentNode = null;
  run.pendingChoice = null;
  rollFloorChoices();
  persist();
  return { floor: run.floorIndex, floorCount: ROGUELIKE.floorCount, choices: run.choices };
}

// ---------- Non-combat resolver contract (for the Phase C UI) ----------
// chooseNode(index) is the single entry point for picking a floor's node.
// What happens next depends on the node's kind:
//
//   normal / elite / farm  -> launches a battle (same as Phase A). The floor
//   boss                      completes via onBattleEnd(game), called by
//                              main.js after the battle resolves.
//
//   recovery  -> resolves FULLY inside chooseNode: restores Core Integrity
//                and calls advanceFloor() itself. No follow-up call needed.
//                Returns { ok, kind:"recovery", restored, coreIntegrity, floor, ... }.
//
//   gear      -> STAGES: rolls `reward.choiceCount` items into
//                run.pendingChoice, sets run.phase = "reward", and returns
//                { ok, kind:"gear", items }. The UI must then call
//                pickGearReward(itemIndex, rosterIndex) — or
//                pickGearReward(-1) to skip/sell all — which attaches the
//                item (or grants salvage) and calls advanceFloor().
//
//   shop      -> STAGES: rolls stock into run.pendingChoice, sets
//                run.phase = "shop", and returns { ok, kind:"shop", gearStock,
//                towerOffers, repairPrice, repairMaxPoints }. The UI may call
//                shopBuyGear(stockIndex, rosterIndex), shopBuyTowerUnlock(type),
//                shopBuyRepair(points), and shopReroll() any number of times
//                (each debits/mutates immediately and returns an updated
//                snapshot), then MUST call shopLeave() to advance the floor.
//
//   event     -> STAGES: sets run.phase = "event" and returns
//                { ok, kind:"event", event } (the event's label/desc/options
//                come straight from the node, already rolled). The UI must
//                then call resolveEventOption(optionIndex), which applies the
//                chosen (possibly risky) outcome and calls advanceFloor().
//
//   upgrade   -> STAGES (Phase D): rolls `runUpgrades.choiceCount` distinct
//                options into run.pendingChoice, sets run.phase = "reward",
//                and returns { ok, kind:"upgrade", options }. The UI must then
//                call pickRunUpgrade(optionIndex) — or pickRunUpgrade(-1) to
//                skip all for flat salvage — which mutates run.context.mults /
//                .unlockedTowers / run.maxCoreIntegrity (effective on the very
//                next battle) and calls advanceFloor().
//
// An elite win also stages a BONUS "reward" (Phase D, ROGUELIKE.reward.
// eliteBonusReward): onBattleEnd rolls 3 higher-ilvl gear items into
// run.pendingChoice / run.phase = "reward" (kind:"gear", same as a gear node)
// immediately after an elite combat is won, BEFORE advancing the floor. The
// UI's normal pickGearReward(itemIndex, rosterIndex) flow resolves it exactly
// like a gear node and advances the floor itself; the caller of onBattleEnd
// can tell this happened via the returned result's `bonusReward` field.
//
// Every resolver is a pure function of run.rng — no Math.random anywhere in
// this file.
export function chooseNode(index) {
  if (!run || run.phase !== "choosing") return { ok: false, reason: "not-choosing" };
  const node = run.choices[index];
  if (!node) return { ok: false, reason: "no-node" };
  run.currentNode = node;

  switch (node.kind) {
    case "normal":
    case "elite":
    case "farm":
    case "boss":
      return resolveCombatNode(node);
    case "gear":
      return resolveGearNode(node);
    case "shop":
      return resolveShopNode(node);
    case "event":
      return resolveEventNode(node);
    case "recovery":
      return resolveRecoveryNode(node);
    case "upgrade":
      return resolveUpgradeNode(node);
    default:
      return { ok: false, reason: "unhandled-kind" };
  }
}

// ---------- Combat resolver (normal / elite / farm / boss) ----------

function resolveCombatNode(node) {
  if (!launchBattle) return { ok: false, reason: "no-launcher" };
  run.phase = "battle";
  run.context.coreHealth = run.coreIntegrity;      // carry current vitality in
  persist();                                       // snapshot CLEAN pre-modifier state; a
                                                   // reload mid-battle resumes to this floor's
                                                   // choices (phase coerced), never mid-combat.

  run._modifierBackup = null;
  if (node.kind === "elite" && node.modifier) {
    run._modifierBackup = applyEliteModifierToContext(node.modifier);
  } else if (node.kind === "farm") {
    run._modifierBackup = applyFarmModifierToContext();
  }

  const level = generateCombatLevel(node.depth, run.rng, node.kind);
  level.coreHealth = run.coreIntegrity;             // consistency (createGame reads runContext.coreHealth)
  if (node.kind === "elite" && node.modifier) applyEliteModifierToLevel(level, node.modifier);

  launchBattle(level, run.context);
  return { ok: true, kind: node.kind };
}

// Elite "restricted towers": narrow run.context.unlockedTowers (a NEW array)
// to a random subset of the run's actually-unlocked towers for this battle
// only. Returns a backup object onBattleEnd uses to restore the original
// reference.
function applyEliteModifierToContext(modifier) {
  const backup = {};
  if (modifier.restrictTowerCount) {
    backup.prevContextUnlocked = run.context.unlockedTowers;
    const subset = sampleWithoutReplacement(run.unlockedTowers, modifier.restrictTowerCount, run.rng);
    run.context.unlockedTowers = subset.length ? subset : run.unlockedTowers.slice(0, 1);
  }
  return backup;
}

// XP Farm: temporarily boost run.context.mults.xpMult so this battle's kills
// bank extra tower XP. Restored after the battle in onBattleEnd.
function applyFarmModifierToContext() {
  const backup = { prevXpMult: run.context.mults.xpMult };
  run.context.mults.xpMult = backup.prevXpMult * ROGUELIKE.difficulty.farmXpMult;
  return backup;
}

// Post-process a generated level's wave groups for an elite's non-context
// modifiers (speed/health/count). Kept separate from generateCombatLevel so
// that function's signature stays exactly generateCombatLevel(depth, rng, kind).
function applyEliteModifierToLevel(level, modifier) {
  for (const wave of level.waves) {
    for (const group of wave.groups) {
      if (modifier.enemySpeedMult) group.speedMult = (group.speedMult || 1) * modifier.enemySpeedMult;
      if (modifier.extraHealthMult) group.healthMult = (group.healthMult || 1) * modifier.extraHealthMult;
      if (modifier.extraCountMult) group.count = Math.max(1, Math.round(group.count * modifier.extraCountMult));
    }
  }
}

function restoreBattleModifiers() {
  const backup = run._modifierBackup;
  run._modifierBackup = null;
  if (!backup) return;
  if ("prevContextUnlocked" in backup) run.context.unlockedTowers = backup.prevContextUnlocked;
  if ("prevXpMult" in backup) run.context.mults.xpMult = backup.prevXpMult;
}

// ---------- Procedural level generator ----------

// depth: run.floorIndex (0-based). kind: "normal" | "elite" | "farm" | "boss".
// Builds a valid `level` object: straight-segment pathCorners (from a
// template, optionally mirrored/flipped), in-bounds blockedTiles, and waves
// composed from the depth-appropriate enemy pool. Does NOT know about `run`
// (pure function of its 3 args, per the Phase B contract) — the caller
// (resolveCombatNode) is responsible for setting level.coreHealth from
// run.coreIntegrity afterward, same as Phase A's placeholder did.
export function generateCombatLevel(depth, rng, kind) {
  const { corners, blockedTiles } = pickPathLayout(rng);
  const waves = generateWaves(depth, rng, kind);
  return {
    id: `rogue_floor_${depth + 1}`,
    name: kind === "boss" ? "CORE BREACH" : `FLOOR ${depth + 1}`,
    gridWidth: ROGUELIKE.board.gridWidth,
    gridHeight: ROGUELIKE.board.gridHeight,
    startingMoney: ROGUELIKE.startingMoney[kind] ?? ROGUELIKE.startingMoney.normal,
    coreHealth: ROGUELIKE.startingCoreIntegrity, // placeholder; caller overwrites with run.coreIntegrity
    pathCorners: corners,
    blockedTiles,
    waves,
  };
}

// Pick a template, optionally mirror/flip it, and derive its blocked tiles.
// Mirroring/flipping is a reflection of an axis-aligned polyline about the
// grid's center — every segment stays axis-aligned and in-bounds by
// construction, so this can never violate expandPathCorners.
function pickPathLayout(rng) {
  const { gridWidth, gridHeight } = ROGUELIKE.board;
  const template = pick(ROGUELIKE.pathTemplates, rng);
  const mirrorX = rng() < ROGUELIKE.mirrorChance;
  const flipY = rng() < ROGUELIKE.flipChance;
  const tx = (p) => ({
    x: mirrorX ? gridWidth - 1 - p.x : p.x,
    y: flipY ? gridHeight - 1 - p.y : p.y,
  });

  const corners = template.corners.map(tx);
  const pathKeys = new Set(corners.map((p) => `${p.x},${p.y}`));
  // Straight-segment expansion for the full on-path tile set (not just
  // corners), so blocked-candidate filtering below is exact.
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i], b = corners[i + 1];
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    let { x, y } = a;
    while (x !== b.x || y !== b.y) {
      x += dx; y += dy;
      pathKeys.add(`${x},${y}`);
    }
  }

  const candidates = (template.blockedCandidates || [])
    .map(tx)
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < gridWidth && p.y < gridHeight)
    .filter((p) => !pathKeys.has(`${p.x},${p.y}`)); // defensive: never block a path tile

  const [lo, hi] = ROGUELIKE.blockedTileCountRange;
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const blockedTiles = sampleWithoutReplacement(candidates, count, rng);

  return { corners, blockedTiles };
}

function enemyPoolFor(depth) {
  const band = pickBand(ROGUELIKE.enemyTemplates.bands, depth);
  return band.pool;
}

function generateWaves(depth, rng, kind) {
  const d = ROGUELIKE.difficulty;

  if (kind === "boss") return generateBossWaves(depth, rng);

  const healthKindMult = kind === "elite" ? d.eliteHealthMult : kind === "farm" ? d.farmHealthMult : 1;
  const bountyKindMult = kind === "elite" ? d.eliteBountyMult : kind === "farm" ? d.farmBountyMult : 1;
  const countKindMult = kind === "elite" ? d.eliteCountMult : kind === "farm" ? d.farmCountMult : 1;

  const healthMult = (1 + d.healthPerDepth * depth) * healthKindMult;
  const bountyMult = (1 + d.bountyPerDepth * depth) * bountyKindMult;
  const groupTotal = Math.max(3, Math.round((d.baseGroupCount + d.groupCountPerDepth * depth) * countKindMult));
  const spawnInterval = Math.max(d.spawnIntervalMin, d.spawnIntervalBase + d.spawnIntervalPerDepth * depth);
  const waveCount = Math.min(d.maxWaves, d.baseWaveCount + Math.floor(depth / d.wavesPerDepthEvery));

  const pool = enemyPoolFor(depth);
  const [loTypes, hiTypes] = ROGUELIKE.enemyTemplates.typesPerWaveRange;

  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const typesThisWave = Math.min(pool.length, loTypes + Math.floor(rng() * (hiTypes - loTypes + 1)));
    const types = sampleWithoutReplacement(pool, Math.max(1, typesThisWave), rng);
    const groups = types.map((type, i) => {
      const share = Math.max(2, Math.round(groupTotal / types.length));
      return {
        type,
        count: share,
        spawnInterval,
        healthMult,
        bountyMult,
        ...(i > 0 ? { startDelay: i * d.groupStartDelayStep } : {}),
      };
    });
    waves.push({ groups });
  }
  return waves;
}

// Boss floors get a fixed 3-act script (warm-up -> tougher mix -> boss units
// + chaff), scaled by the same depth ramp as everything else plus
// bossHealthMult/bossBountyMult.
function generateBossWaves(depth, rng) {
  const d = ROGUELIKE.difficulty;
  const healthMult = (1 + d.healthPerDepth * depth) * d.bossHealthMult;
  const bountyMult = (1 + d.bountyPerDepth * depth) * d.bossBountyMult;
  const groupTotal = Math.max(4, Math.round(d.baseGroupCount + d.groupCountPerDepth * depth));
  const spawnInterval = Math.max(d.spawnIntervalMin, d.spawnIntervalBase + d.spawnIntervalPerDepth * depth);
  const pool = enemyPoolFor(depth);
  const g = (type, count, extra = {}) => ({ type, count, spawnInterval, healthMult, bountyMult, ...extra });

  const act1Type = pool.includes("fast") ? "fast" : pool[0];
  const act2TypeA = pool.includes("armored") ? "armored" : pool[0];
  const act2TypeB = pool.includes("splitter") ? "splitter" : pool[Math.min(1, pool.length - 1)];

  return [
    { groups: [g("basic", groupTotal), g(act1Type, Math.round(groupTotal * 0.6), { startDelay: d.groupStartDelayStep })] },
    { groups: [g(act2TypeA, Math.round(groupTotal * 0.7)), g(act2TypeB, Math.round(groupTotal * 0.5), { startDelay: d.groupStartDelayStep })] },
    { groups: [g("boss", d.bossUnitCount, { spawnInterval: spawnInterval * 4 }), g(act2TypeA, Math.round(groupTotal * 0.5), { startDelay: 2 })] },
  ];
}

// ---------- Gear reward node ----------

function rollRewardItems(depth, count, ilvlBonus = 0) {
  const cfg = ROGUELIKE.reward;
  const band = pickBand(cfg.rarityWeightsByDepth, depth);
  const ilvl = Math.min(100, cfg.ilvlBase + cfg.ilvlPerDepth * depth + ilvlBonus);
  const items = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(run.rng, band.weights);
    const item = generateItem({ rarity, ilvl, rng: run.rng });
    // Bypass the account gear UI's Mastery equip-gate — see the file header note.
    item.reqLevel = 0;
    item.reqMastery = 0;
    items.push(item);
  }
  return items;
}

function resolveGearNode(node) {
  const items = rollRewardItems(node.depth, ROGUELIKE.reward.choiceCount);
  run.pendingChoice = { kind: "gear", node, items };
  run.phase = "reward";
  persist();
  return { ok: true, kind: "gear", items };
}

// itemIndex = -1 to skip/sell all offered items for flat salvage.
export function pickGearReward(itemIndex, rosterIndex) {
  if (!run || run.phase !== "reward" || !run.pendingChoice) return { ok: false, reason: "not-reward" };
  const { items } = run.pendingChoice;

  if (itemIndex === -1) {
    run.salvage += ROGUELIKE.reward.skipSalvage;
    run.log.push(`skipped gear reward for ${ROGUELIKE.reward.skipSalvage} salvage (floor ${run.floorIndex + 1})`);
    const snap = advanceFloor();
    return { ok: true, kind: "gear", skipped: true, salvage: run.salvage, ...snap };
  }

  const item = items[itemIndex];
  const rec = run.roster[rosterIndex];
  if (!item) return { ok: false, reason: "no-item" };
  if (!rec) return { ok: false, reason: "no-roster" };
  if (item.towerType && item.towerType !== rec.type) return { ok: false, reason: "towerType" };

  rec.gear[item.slot] = item;
  run.log.push(`equipped ${item.rarity} ${item.slot} on ${rec.name} (floor ${run.floorIndex + 1})`);
  const snap = advanceFloor();
  return { ok: true, kind: "gear", equipped: { item, rosterIndex }, ...snap };
}

// ---------- Shop node ----------

function resolveShopNode(node) {
  const cfg = ROGUELIKE.shop;
  const depth = node.depth;
  const ilvl = Math.min(100, cfg.ilvlBase + cfg.ilvlPerDepth * depth);
  const gearStock = Array.from({ length: cfg.stockSize }, () => {
    const rarity = rollRarity(run.rng, cfg.rarityWeights);
    const item = generateItem({ rarity, ilvl, rng: run.rng });
    item.reqLevel = 0;
    item.reqMastery = 0;
    return { item, price: cfg.priceByRarity[rarity], bought: false };
  });
  const towerOffers = Object.keys(cfg.towerUnlockPrice)
    .filter((type) => !run.unlockedTowers.includes(type))
    .map((type) => ({ type, price: cfg.towerUnlockPrice[type] }));

  run.pendingChoice = { kind: "shop", node, gearStock, towerOffers };
  run.phase = "shop";
  persist();
  return {
    ok: true, kind: "shop",
    gearStock, towerOffers,
    repairPrice: cfg.coreRepairPointPrice,
    repairMaxPoints: cfg.coreRepairMaxPoints,
    salvage: run.salvage,
  };
}

function requireShop() {
  if (!run || run.phase !== "shop" || !run.pendingChoice) return null;
  return run.pendingChoice;
}

export function shopBuyGear(stockIndex, rosterIndex) {
  const shop = requireShop();
  if (!shop) return { ok: false, reason: "not-shop" };
  const entry = shop.gearStock[stockIndex];
  const rec = run.roster[rosterIndex];
  if (!entry || entry.bought) return { ok: false, reason: "no-stock" };
  if (!rec) return { ok: false, reason: "no-roster" };
  if (entry.item.towerType && entry.item.towerType !== rec.type) return { ok: false, reason: "towerType" };
  if (run.salvage < entry.price) return { ok: false, reason: "salvage" };

  run.salvage -= entry.price;
  rec.gear[entry.item.slot] = entry.item;
  entry.bought = true;
  run.log.push(`bought ${entry.item.rarity} ${entry.item.slot} for ${entry.price} salvage (floor ${run.floorIndex + 1})`);
  persist();
  return { ok: true, kind: "shop", bought: "gear", salvage: run.salvage };
}

export function shopBuyTowerUnlock(type) {
  const shop = requireShop();
  if (!shop) return { ok: false, reason: "not-shop" };
  const offer = shop.towerOffers.find((o) => o.type === type && !o.bought);
  if (!offer) return { ok: false, reason: "no-offer" };
  if (run.salvage < offer.price) return { ok: false, reason: "salvage" };

  run.salvage -= offer.price;
  offer.bought = true;
  run.unlockedTowers.push(type);           // same array reference as run.context.unlockedTowers
  run.log.push(`unlocked ${type} for ${offer.price} salvage (floor ${run.floorIndex + 1})`);
  persist();
  return { ok: true, kind: "shop", bought: "tower", type, salvage: run.salvage };
}

export function shopBuyRepair(points) {
  const shop = requireShop();
  if (!shop) return { ok: false, reason: "not-shop" };
  const cfg = ROGUELIKE.shop;
  const missing = run.maxCoreIntegrity - run.coreIntegrity;
  const n = Math.max(0, Math.min(points, cfg.coreRepairMaxPoints, missing));
  const cost = n * cfg.coreRepairPointPrice;
  if (n <= 0) return { ok: false, reason: "no-effect" };
  if (run.salvage < cost) return { ok: false, reason: "salvage" };

  run.salvage -= cost;
  run.coreIntegrity += n;
  run.log.push(`repaired ${n} core integrity for ${cost} salvage (floor ${run.floorIndex + 1})`);
  persist();
  return { ok: true, kind: "shop", bought: "repair", restored: n, coreIntegrity: run.coreIntegrity, salvage: run.salvage };
}

export function shopReroll() {
  const shop = requireShop();
  if (!shop) return { ok: false, reason: "not-shop" };
  const cfg = ROGUELIKE.shop;
  if (run.salvage < cfg.rerollCost) return { ok: false, reason: "salvage" };

  run.salvage -= cfg.rerollCost;
  const ilvl = Math.min(100, cfg.ilvlBase + cfg.ilvlPerDepth * shop.node.depth);
  shop.gearStock = Array.from({ length: cfg.stockSize }, () => {
    const rarity = rollRarity(run.rng, cfg.rarityWeights);
    const item = generateItem({ rarity, ilvl, rng: run.rng });
    item.reqLevel = 0;
    item.reqMastery = 0;
    return { item, price: cfg.priceByRarity[rarity], bought: false };
  });
  persist();
  return { ok: true, kind: "shop", rerolled: true, gearStock: shop.gearStock, salvage: run.salvage };
}

export function shopLeave() {
  const shop = requireShop();
  if (!shop) return { ok: false, reason: "not-shop" };
  const snap = advanceFloor();
  return { ok: true, kind: "shop", left: true, ...snap };
}

// ---------- Choice/event node ----------

function resolveEventNode(node) {
  run.pendingChoice = { kind: "event", node, event: node.event };
  run.phase = "event";
  persist();
  return { ok: true, kind: "event", event: node.event };
}

function applyEventDelta(delta) {
  if (!delta) return;
  if (delta.salvageDelta) run.salvage = Math.max(0, run.salvage + delta.salvageDelta);
  if (delta.coreIntegrityDelta) {
    // Never let an event alone end the run — only combat losses do that.
    run.coreIntegrity = Math.max(1, Math.min(run.maxCoreIntegrity, run.coreIntegrity + delta.coreIntegrityDelta));
  }
  if (delta.maxCoreIntegrityDelta) {
    run.maxCoreIntegrity = Math.max(1, run.maxCoreIntegrity + delta.maxCoreIntegrityDelta);
    run.coreIntegrity = Math.min(run.coreIntegrity, run.maxCoreIntegrity);
  }
}

export function resolveEventOption(optionIndex) {
  if (!run || run.phase !== "event" || !run.pendingChoice) return { ok: false, reason: "not-event" };
  const opt = run.pendingChoice.event.options[optionIndex];
  if (!opt) return { ok: false, reason: "no-option" };

  let rolled = null;
  let outcome = opt;
  if (opt.risky) {
    rolled = run.rng() < opt.chance ? "success" : "failure";
    outcome = opt[rolled] || {};
  }
  applyEventDelta(outcome);
  run.log.push(`event "${run.pendingChoice.event.label}" -> "${opt.label}"${rolled ? ` (${rolled})` : ""} (floor ${run.floorIndex + 1})`);

  const snap = advanceFloor();
  return { ok: true, kind: "event", rolled, salvage: run.salvage, coreIntegrity: run.coreIntegrity, ...snap };
}

// ---------- Recovery node ----------
// Resolves fully inside chooseNode — no follow-up call.

function resolveRecoveryNode() {
  const cfg = ROGUELIKE.recovery;
  const missing = run.maxCoreIntegrity - run.coreIntegrity;
  const restore = Math.max(cfg.restoreFlatMin, Math.round(missing * cfg.restoreFraction));
  const applied = Math.max(0, Math.min(missing, restore));
  run.coreIntegrity += applied;
  run.log.push(`recovery: +${applied} core integrity (floor ${run.floorIndex + 1})`);

  const snap = advanceFloor();
  return { ok: true, kind: "recovery", restored: applied, coreIntegrity: run.coreIntegrity, ...snap };
}

// ---------- Run-upgrade node (Phase D) ----------
// The structural piece this pass wires up: drafted upgrades were previously
// unreachable data (ROGUELIKE.runUpgrades was `{}`). This node stages 3
// distinct options from ROGUELIKE.runUpgrades.pool; picking one mutates the
// LIVE run.context (mults / unlockedTowers) or run.maxCoreIntegrity, so the
// very next tower placed / next battle launched sees the effect — same
// mechanism the Elite "restricted towers" modifier already proved works
// (run.context.unlockedTowers/.mults are read fresh by the shimmed
// progression.js getters on every call, not snapshotted once).

function resolveUpgradeNode(node) {
  const cfg = ROGUELIKE.runUpgrades;
  // Drop unlock-tower options for towers already unlocked (nothing to offer).
  const eligible = cfg.pool.filter((u) => !u.unlockTower || !run.unlockedTowers.includes(u.unlockTower));
  const options = weightedSampleDistinct(eligible, cfg.choiceCount, run.rng);
  run.pendingChoice = { kind: "upgrade", node, options };
  run.phase = "reward";
  persist();
  return { ok: true, kind: "upgrade", options };
}

// Applies one drafted upgrade's data-only effect (see the ROGUELIKE.runUpgrades
// config comment for the field vocabulary). The ONLY place these fields are
// interpreted — config.js stays pure data per the cardinal rule.
function applyRunUpgrade(u) {
  if (u.mult) run.context.mults[u.mult] = (run.context.mults[u.mult] || 0) + u.delta;
  if (u.capMult) run.context.mults[u.capMult] = (run.context.mults[u.capMult] || 0) + u.capDelta;
  if (u.maxCoreIntegrityDelta) {
    run.maxCoreIntegrity += u.maxCoreIntegrityDelta;
    run.coreIntegrity = Math.min(run.maxCoreIntegrity, run.coreIntegrity + u.maxCoreIntegrityDelta);
  }
  if (u.coreIntegrityDelta) {
    run.coreIntegrity = Math.min(run.maxCoreIntegrity, run.coreIntegrity + u.coreIntegrityDelta);
  }
  if (u.unlockTower && !run.unlockedTowers.includes(u.unlockTower)) {
    run.unlockedTowers.push(u.unlockTower); // same array reference as run.context.unlockedTowers
  }
}

// optionIndex = -1 to skip/decline all offered upgrades for flat salvage.
export function pickRunUpgrade(optionIndex) {
  if (!run || run.phase !== "reward" || !run.pendingChoice || run.pendingChoice.kind !== "upgrade") {
    return { ok: false, reason: "not-upgrade" };
  }
  const { options } = run.pendingChoice;

  if (optionIndex === -1) {
    run.salvage += ROGUELIKE.runUpgrades.skipSalvage;
    run.log.push(`skipped upgrade for ${ROGUELIKE.runUpgrades.skipSalvage} salvage (floor ${run.floorIndex + 1})`);
    const snap = advanceFloor();
    return { ok: true, kind: "upgrade", skipped: true, salvage: run.salvage, ...snap };
  }

  const upgrade = options[optionIndex];
  if (!upgrade) return { ok: false, reason: "no-upgrade" };

  applyRunUpgrade(upgrade);
  run.draftedUpgrades.push({ id: upgrade.id, label: upgrade.label });
  run.log.push(`drafted upgrade "${upgrade.label}" (floor ${run.floorIndex + 1})`);
  const snap = advanceFloor();
  return { ok: true, kind: "upgrade", applied: upgrade, ...snap };
}

// ---------- End of battle ----------
// Called by main.js checkEndState BEFORE any campaign save-write, once the
// battle has resolved to "won"/"lost". Restores any elite/farm battle
// modifier, updates carried Core Integrity + Salvage, then either advances
// the floor (rolling new choices) or ends the run. Returns a snapshot
// descriptor for the caller's overlay; live getters are irrelevant to it, so
// it stays correct even after the sandbox is turned off on a run-over.
export function onBattleEnd(game) {
  if (!run) return null;
  restoreBattleModifiers();

  const won = game.phase === "won";
  run.coreIntegrity = Math.max(0, Math.round(game.coreHealth));

  const node = run.currentNode;
  const kind = node?.kind || "normal";
  const result = {
    won,
    floor: run.floorIndex,
    floorCount: ROGUELIKE.floorCount,
    boss: kind === "boss",
    coreIntegrity: run.coreIntegrity,
    maxCoreIntegrity: run.maxCoreIntegrity,
    salvage: run.salvage,
    salvageGained: 0,
    runOver: false,
    runWon: false,
  };

  if (!won || run.coreIntegrity <= 0) {
    run.phase = "lost";
    result.runOver = true;
    run.log.push(`lost on floor ${run.floorIndex + 1}`);
    setRunContext(null);                 // sandbox OFF — run is over
    clearRoguelikeRun();                 // a lost run is not resumable
    return result;
  }

  // Win: bank salvage for the cleared floor (kind-specific table).
  const rewardCfg = ROGUELIKE.salvageRewards[kind] || ROGUELIKE.salvageRewards.normal;
  const gain = rewardCfg.base + rewardCfg.perDepth * run.floorIndex;
  run.salvage += gain;
  result.salvage = run.salvage;
  result.salvageGained = gain;

  // Elite guaranteed bonus reward (Phase D §9 decision, ROGUELIKE.reward.
  // eliteBonusReward): stage a higher-ilvl 3-item gear choice on top of the
  // salvage above, using the exact same staged-reward shape as a "gear" node
  // (run.pendingChoice.kind = "gear", run.phase = "reward"). Do NOT
  // advanceFloor() here — pickGearReward() does that once the player resolves
  // this bonus, same as it does for a real gear node.
  if (kind === "elite" && ROGUELIKE.reward.eliteBonusReward) {
    const items = rollRewardItems(run.floorIndex, ROGUELIKE.reward.choiceCount, ROGUELIKE.reward.eliteIlvlBonus);
    run.pendingChoice = { kind: "gear", node: null, items };
    run.phase = "reward";
    result.bonusReward = { items };
    run.log.push(`elite clear: bonus gear reward offered (floor ${run.floorIndex + 1})`);
    persist();                           // resume into the staged bonus reward
    return result;
  }

  if (kind === "boss") {
    run.phase = "won";
    result.runOver = true;
    result.runWon = true;
    run.log.push(`WON the run on floor ${run.floorIndex + 1}`);
    setRunContext(null);                 // sandbox OFF — run is over
    clearRoguelikeRun();                 // a completed run is not resumable
    return result;
  }

  // Advance to the next floor and offer fresh choices.
  const snap = advanceFloor();
  result.nextFloor = snap.floor;
  return result;
}

// ---------- Run summary + daily seed (Phase E) ----------

// Count of a roster record's non-null equipped gear slots.
function rosterGearCount(rec) {
  return Object.values(rec.gear).filter(Boolean).length;
}

// A PURE read of the live run for the run-end/summary screens. Returns null
// when no run is active. Never mutates `run` — safe to call any number of
// times (e.g. from the console) without side effects.
export function getRunSummary() {
  if (!run) return null;
  const extraTowers = run.unlockedTowers.filter((t) => !ROGUELIKE.starterTowers.includes(t));
  const gearCount = run.roster.reduce((sum, r) => sum + rosterGearCount(r), 0);
  return {
    seed: run.seed,
    floor: run.floorIndex + 1,
    floorCount: ROGUELIKE.floorCount,
    coreIntegrity: run.coreIntegrity,
    maxCoreIntegrity: run.maxCoreIntegrity,
    salvage: run.salvage,
    unlockedTowers: run.unlockedTowers.slice(),
    extraTowers,
    gearCount,
    upgrades: run.draftedUpgrades.map((u) => u.label),
    roster: run.roster.map((r) => ({ name: r.name, type: r.type, gearCount: rosterGearCount(r) })),
  };
}

// Deterministic uint32 seed from the LOCAL calendar date (not UTC), so every
// player on the same calendar day gets the same "Daily Run" regardless of
// time of day. Encodes as YYYYMMDD-ish (y*10000 + (m+1)*100 + d); >>> 0 keeps
// it a uint32 the way startRun/makeRng expect.
export function dailySeed(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  return ((y * 10000 + (m + 1) * 100 + d) >>> 0);
}

// ---------- Console/debug handle (verification) ----------
// A run can be driven entirely from DevTools until the Phase C UI lands:
//   roguelike.start()            -> begin a run
//   roguelike.state()            -> inspect run state
//   roguelike.choose(0)          -> pick a floor node
//   step(120); checkEndState()   -> resolve a launched battle (existing debug helpers)
// Non-combat follow-ups (see the resolver contract above) are reached via the
// module's named exports, e.g. window.roguelike.run().pendingChoice, or by
// importing roguelike.js directly: `const rg = await import('/src/roguelike.js')`.
export function debugHandle() {
  return {
    start: (seed) => startRun(seed),
    choose: (i = 0) => chooseNode(i),
    end: () => endRun("abandoned"),
    state: () => run && {
      floor: `${run.floorIndex + 1}/${ROGUELIKE.floorCount}`,
      phase: run.phase,
      coreIntegrity: `${run.coreIntegrity}/${run.maxCoreIntegrity}`,
      salvage: run.salvage,
      choices: run.choices.map((c) => c.label),
      unlockedTowers: run.unlockedTowers,
      roster: run.roster.map((r) => ({ name: r.name, gear: r.gear })),
      pendingChoice: run.pendingChoice,
      log: run.log,
    },
    run: () => run,
    // Non-combat follow-ups, exposed for console verification:
    pickGearReward,
    shopBuyGear,
    shopBuyTowerUnlock,
    shopBuyRepair,
    shopReroll,
    shopLeave,
    resolveEventOption,
    pickRunUpgrade,
    getRunSummary,
    dailySeed,
    hasResumableRun,
    resume: () => resumeRun(),
  };
}
