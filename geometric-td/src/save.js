// ============================================================
// SAVE — localStorage read/write/reset. Kept deliberately simple
// and human-readable: open DevTools > Application > Local Storage
// to inspect or hand-edit the save while testing.
// ============================================================

const KEY = "geometric-td-save-v1";

const DEFAULT_SAVE = {
  version: 1,
  skillPoints: 0,
  skills: {},           // { skillId: tier } — see config.js SKILLS
  roster: [],           // records also gain gear: { optic, emitter, capacitor, frame }
  completedLevels: [],  // level ids won at least once
  wins: 0,
  seenTowerGuide: false, // tower guide auto-opens once at level 2
  endlessBest: {},       // { levelId: bestWaveReached } in Endless mode
  shards: 0,             // Shards ◆ — persistent loot-store currency (LOOT_DESIGN.md)
  stash: [],              // owned unequipped items
  pendingLoot: [],        // unclaimed end-of-run drops shown in triage
  store: { stock: [], rerolls: 0, skillPointPurchases: 0 },
  storeUnlocks: [],   // rarities unlocked for store rolls: ["enhanced", "rare", ...]
  stashUpgrades: 0,   // purchased stash-expansion tiers (LOOT.stash.upgradeCosts)
  autoJunkTier: -1,   // highest purchased auto-junk tier index (LOOT.autoJunk.tiers), -1 = none
  autoJunkPaused: [], // owned rarities ("common", "enhanced", ...) currently paused
  endlessRewards: {},
  levelMilestones: {}, // { levelId: [claimedMilestoneId, ...] } — per-level challenges (B5)
  tutorialDone: false, // first-play walkthrough (T4) shown once on level_001's first campaign start
  playerName: null,      // set during onboarding; null = not yet named (fallback "Operator")
  onboardingDone: false, // first-load story intro (P1) shown once
  narrativeSeen: {},     // { beatId: true } — per-level START/WIN story beats (P2), beatId = `${levelId}.start`|`${levelId}.win`
  seenEnemyIntros: [],   // enemy type ids whose first-appearance Indy-7 bark (P3) has fired
  seenTowerIntros: [],   // late tower type ids whose pre-battle recruit card has fired
  seenTowerBarks: [],    // tower type ids whose one-liner has fired (once ever, first placement)
  barksEnabled: true,    // master toggle for in-battle banter (enemy intros / boss / tower barks)
  visualEffects: "auto", // "auto" adapts per device; "full" | "reduced" force a mode
  debugMode: false,      // shows rendered FPS + effective VFX mode during battles
  lang: "en",            // UI language: "en" (default) | "fr" — see i18n.js, getLang/setLang
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    // Merge over defaults so older saves gain new fields safely.
    return { ...structuredClone(DEFAULT_SAVE), ...JSON.parse(raw) };
  } catch (err) {
    console.warn("Save unreadable, starting fresh:", err);
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not write save:", err);
  }
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
