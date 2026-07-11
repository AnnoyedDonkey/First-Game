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
  store: { stock: [], rerolls: 0 },
  endlessRewards: {},
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
