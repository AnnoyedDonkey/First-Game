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
  "hud.credits": "CRÉDITS",
  "hud.wave": "VAGUE",
  "hud.core": "NOYAU",
  "hud.skills": "TALENTS",

  "ui.speedHalf": "Demi-vitesse",
  "ui.speedPause": "Pause",
  "ui.speedDouble": "Vitesse double",
  "ui.exitBattle": "Quitter la bataille",
  "ui.updateAvailable": "⟲ MISE À JOUR DISPONIBLE — TOUCHER POUR RECHARGER",
  "ui.skipTutorial": "PASSER LE TUTO",
  "ui.skip": "PASSER",
  "ui.lootEarned": "BUTIN GAGNÉ",
  "ui.close": "FERMER",
  "ui.cancel": "ANNULER",
  "ui.tapAgain": "RETAPEZ",
  "ui.sell": "VENDRE",
  "ui.startWave": "VAGUE ▶",
  "ui.nextIn": "DANS",
  "ui.waveN": "VAGUE {n}",
  "ui.active": "ACTIVE",
  "ui.max": "MAX",
  "ui.level": "NIVEAU",
  "ui.need": "BESOIN",
  "ui.upgrade": "AMÉLIORER",
  "ui.xp": "XP",
  "ui.xpReady": "XP PRÊT",
  "ui.lv": "NIV",
  "ui.nextStarIn": "PROCHAINE ★ DANS {n} XP",
  "ui.worldLocked": "VERROUILLÉ — terminez tout {prev} pour débloquer {world}.",

  "gear.towers": "TOURELLES",
  "gear.stash": "RÉSERVE",
  "gear.equip": "ÉQUIPER",
  "gear.unequip": "DÉSÉQUIPER",
  "gear.replace": "REMPLACER",
  "gear.sell": "VENDRE",
  "gear.sellConfirm": "VENDRE ? RETAPEZ",
  "gear.loseConfirm": "LES PERDRE ? RETAPEZ",
  "gear.equipNew": "ÉQUIPER LE NOUVEAU",
  "gear.keepCurrent": "GARDER L'ACTUEL",
  "gear.compare": "COMPARER",
  "gear.sellAll": "TOUT VENDRE",
  "gear.bulkSellTitle": "VENTE GROUPÉE",
  "gear.sellUnclaimedTitle": "VENDRE LES BUTINS NON RÉCLAMÉS",

  "store.title": "BOUTIQUE",
  "store.buy": "ACHETER",
  "store.stashFull": "RÉSERVE PLEINE",
  "store.reroll": "RELANCER",
  "store.buySkillPoint": "ACHETER UN POINT",
  "store.buyOnePoint": "ACHETER 1 POINT",

  "lb.title": "CLASSEMENT",
  "lb.subtitle": "MEILLEURE VAGUE ENDLESS, PAR NIVEAU",
  "lb.nickname": "VOTRE PSEUDO",
  "lb.save": "ENREGISTRER",
  "lb.publish": "PUBLIER MES SCORES",
  "lb.publishing": "PUBLICATION…",

  "skill.title": "ARBRE DE TALENTS",
  "skill.resetSave": "RÉINITIALISER",
  "skill.resetSaveConfirm": "SÛR ? RETAPEZ",
  "skill.free": "DÉBLOQUÉ &mdash; GRATUIT",
  "skill.maxed": "MAXIMISÉ",
  "skill.locked": "VERROUILLÉ",
  "skill.buy": "ACHETER &mdash; {cost} PT",
  "skill.pointsLine": "POINTS DISPONIBLES : <b>{points}</b> &mdash; gagnez des combats ou achetez-en en boutique &middot; pincez ou &plusmn; pour zoomer",

  // ---------- Phase B: level/world names, enemy names, tower/skill descriptions ----------
  // (filled by Phase B)

  // ---------- Phase C: tutorial + onboarding intro ----------
  // (filled by Phase C)

  // ---------- Phase D: campaign narrative (beats, barks, enemy intros) ----------
  // (filled by Phase D)

  // ---------- Phase E: results / loot / leaderboard / feedback / misc ----------
  // (filled by Phase E)
};
