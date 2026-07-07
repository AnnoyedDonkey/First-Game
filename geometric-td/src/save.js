// ============================================================
// SAVE — localStorage read/write/reset. Kept deliberately simple
// and human-readable: open DevTools > Application > Local Storage
// to inspect or hand-edit the save while testing.
// ============================================================

const KEY = "geometric-td-save-v1";

const DEFAULT_SAVE = {
  version: 1,
  skillPoints: 0,
  skills: [],           // owned skill ids from config.js SKILLS
  roster: [],           // [{ name, type, maxLevel, xp, kills }]
  completedLevels: [],  // level ids won at least once
  wins: 0,
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
