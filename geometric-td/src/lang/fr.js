// ============================================================
// FRENCH CATALOG (fr) — key → French string.
//
// English is the source of truth and stays inline in the code/markup as
// the fallback passed to t('key', 'English'); this file only supplies
// the French. A MISSING KEY HERE silently shows English, so partial
// translation is always safe and the game never renders blank text.
//
// Keys are dot-namespaced by surface and filled in by phase (see
// I18N_PLAN.md). When adding a phase's keys, append them under the
// matching section header — do NOT re-translate keys an earlier phase
// already provided.
//
// NOT translated on purpose (proper nouns / product names):
//   - Tower names: Laser, Pulse, Slow, Railgun, Rocket
//   - Characters: Indy-7, Bratwurst-XL
//   - Game title: "GEOMETRIC TD"
//
// French length note: French runs ~15–25% longer than English. For
// space-constrained buttons, prefer a SHORTER natural French word over a
// literal translation (e.g. "Next Wave" → "VAGUE ▶", not "Vague
// suivante"), and lean on the [data-lang="fr"] CSS hook for the few that
// still overflow.
// ============================================================

export const FR = {
  // ---------- Phase 0: home-screen menu chrome + language toggle ----------
  "menu.language": "LANGUE",
  "menu.skills": "TALENTS",
  "menu.towers": "TOURELLES",
  "menu.store": "BOUTIQUE",
  "menu.board": "CLASSEMENT",
  "menu.replayIntro": "REVOIR L'INTRO",
  "menu.banter": "DIALOGUES",
  "menu.reset": "TOUT RÉINITIALISER",
  "menu.resetConfirm": "EFFACER TOURELLES, TALENTS & NIVEAUX ? RETAPEZ",
  "menu.welcomeBack": "BON RETOUR",

  // ---------- Phase A: HUD + static overlays (index.html) + ui.js dynamic ----------
  // (filled by Phase A)

  // ---------- Phase B: level/world names, enemy names, tower/skill descriptions ----------
  // (filled by Phase B)

  // ---------- Phase C: tutorial + onboarding intro ----------
  // (filled by Phase C)

  // ---------- Phase D: campaign narrative (beats, barks, enemy intros) ----------
  // (filled by Phase D)

  // ---------- Phase E: results / loot / leaderboard / feedback / misc ----------
  // (filled by Phase E)
};
