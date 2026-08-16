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

  // -- World names (levels.js WORLD_PRESENTATION) --
  "world.world_1.name": "GRILLE INTÉRIEURE",
  "world.world_2.name": "VIDE EXTÉRIEUR",
  "world.world_3.name": "PROFONDEUR PRISME",
  "world.world_4.name": "SINGULARITÉ",

  // -- Level names (levels.js LEVEL_PRESENTATION) — desc paragraphs stay English --
  "level.level_001.name": "Premier Contact",
  "level.level_002.name": "Brèche de Signal",
  "level.level_003.name": "Relais Obscur",
  "level.level_004.name": "Seconde Scindée",
  "level.level_005.name": "Siège du Noyau",
  "level.level_006.name": "Relais de Braise",
  "level.level_007.name": "Puits Toxique",
  "level.level_008.name": "Labyrinthe Ultraviolet",
  "level.level_009.name": "Course Glaciaire",
  "level.level_010.name": "Noyau Solaire",
  "level.level_011.name": "Veine Cramoisie",
  "level.level_012.name": "Turquoise Abyssale",
  "level.level_013.name": "Pulsation Violette",
  "level.level_014.name": "Néant Argenté",
  "level.level_015.name": "Noyau Prismatique",
  "level.level_016.name": "Trame de Photons",
  "level.level_017.name": "Fosse de Goudron",
  "level.level_018.name": "Amas d'Éclats",
  "level.level_019.name": "La Spirale",
  "level.level_020.name": "Zéro Aérien",

  // -- Enemy names (config.js ENEMY_PRESENTATION) --
  "enemy.basic.name": "Basique",
  "enemy.fast.name": "Rapide",
  "enemy.armored.name": "Blindé",
  "enemy.boss.name": "Boss",
  "enemy.splitter.name": "Diviseur",
  "enemy.splitling.name": "Éclat",
  "enemy.regenerator.name": "Régénérateur",

  // -- Tower descriptions (guide sheet ROLE_TEXT/SPECIALTY_TEXT + gear-sheet
  // SPECIALTY_LABELS perk line). Tower proper nouns (Laser/Pulse/Slow/
  // Railgun/Rocket) and other enemy proper nouns referenced inline stay
  // consistent with the enemy.*.name translations above.
  "tower.laser.role": "Rôle : tourelle légère et rapide, cible unique. Excellente contre les Rapides ; faible contre les Blindés.",
  "tower.pulse.role": "Rôle : dégâts de zone — nettoie les Diviseurs et les essaims. Coûteuse à améliorer.",
  "tower.slow.role": "Rôle : soutien — ralentit les ennemis ET leur fait subir +30% de dégâts.",
  "tower.railgun.role": "Rôle : tir perforant en ligne. À aligner sur un couloir droit. Bat les Blindés et les Régénérateurs.",
  "tower.rocket.role": "Rôle : artillerie à portée globale. Lente mais frappe partout ; ravage les Boss et les amas de Diviseurs. Faible contre les Rapides.",
  "tower.laser.specialtyDesc": "Spécialité : PORTÉE accrue à chaque niveau jamais atteint",
  "tower.pulse.specialtyDesc": "Spécialité : EXPLOSIONS plus grandes à chaque niveau jamais atteint",
  "tower.slow.specialtyDesc": "Spécialité : CADENCE DE TIR plus rapide à chaque niveau jamais atteint",
  "tower.railgun.specialtyDesc": "Spécialité : DÉGÂTS accrus à chaque niveau jamais atteint",
  "tower.rocket.specialtyDesc": "Spécialité : DÉFLAGRATIONS plus grandes à chaque niveau jamais atteint",
  "tower.laser.specialtyPerk": "+ portée à chaque niveau",
  "tower.pulse.specialtyPerk": "+ explosions plus grandes à chaque niveau",
  "tower.slow.specialtyPerk": "+ cadence de tir plus rapide à chaque niveau",
  "tower.railgun.specialtyPerk": "+ dégâts à chaque niveau",
  "tower.rocket.specialtyPerk": "+ déflagrations plus grandes à chaque niveau",

  // -- Skill tree (config.js buildSkillGraph) — keyed per node id (bounded,
  // generated set) per I18N_PLAN.md's guidance for numbered chains. Root/
  // level-chain node `desc` fields are never rendered (openSkillSheet
  // suppresses the tail for kind "unlock"/"level"), so only `.name` is
  // provided for those; `.headLabel` is only needed for the two non-tower
  // branch heads (tower heads keep their English proper noun).
  "skill.money_root.headLabel": "ÉCO",
  "skill.game_root.headLabel": "JEU",

  // Laser branch
  "skill.laser_root.name": "Laser · Cœur",
  "skill.laser_dmg1.name": "Laser · Dégâts 1",
  "skill.laser_dmg2.name": "Laser · Dégâts 2",
  "skill.laser_dmg3.name": "Laser · Dégâts 3",
  "skill.laser_dmg4.name": "Laser · Dégâts 4",
  "skill.laser_dmg5.name": "Laser · Dégâts 5",
  "skill.laser_dmg1.desc": "dégâts",
  "skill.laser_dmg2.desc": "dégâts",
  "skill.laser_dmg3.desc": "dégâts",
  "skill.laser_dmg4.desc": "dégâts",
  "skill.laser_dmg5.desc": "dégâts",
  "skill.laser_lvl6.name": "Laser · Surcadence 6",
  "skill.laser_lvl7.name": "Laser · Surcadence 7",
  "skill.laser_lvl8.name": "Laser · Surcadence 8",
  "skill.laser_lvl9.name": "Laser · Surcadence 9",
  "skill.laser_lvl10.name": "Laser · Surcadence 10",
  "skill.laserRate1.name": "Tir rapide 1",
  "skill.laserRate2.name": "Tir rapide 2",
  "skill.laserRate3.name": "Tir rapide 3",
  "skill.laserRate4.name": "Tir rapide 4",
  "skill.laserRate5.name": "Tir rapide 5",
  "skill.laserRate1.desc": "cadence de tir du Laser",
  "skill.laserRate2.desc": "cadence de tir du Laser",
  "skill.laserRate3.desc": "cadence de tir du Laser",
  "skill.laserRate4.desc": "cadence de tir du Laser",
  "skill.laserRate5.desc": "cadence de tir du Laser",

  // Pulse branch
  "skill.pulse_root.name": "Pulse · Cœur",
  "skill.pulse_dmg1.name": "Pulse · Dégâts 1",
  "skill.pulse_dmg2.name": "Pulse · Dégâts 2",
  "skill.pulse_dmg3.name": "Pulse · Dégâts 3",
  "skill.pulse_dmg4.name": "Pulse · Dégâts 4",
  "skill.pulse_dmg5.name": "Pulse · Dégâts 5",
  "skill.pulse_dmg1.desc": "dégâts",
  "skill.pulse_dmg2.desc": "dégâts",
  "skill.pulse_dmg3.desc": "dégâts",
  "skill.pulse_dmg4.desc": "dégâts",
  "skill.pulse_dmg5.desc": "dégâts",
  "skill.pulse_lvl6.name": "Pulse · Surcadence 6",
  "skill.pulse_lvl7.name": "Pulse · Surcadence 7",
  "skill.pulse_lvl8.name": "Pulse · Surcadence 8",
  "skill.pulse_lvl9.name": "Pulse · Surcadence 9",
  "skill.pulse_lvl10.name": "Pulse · Surcadence 10",
  "skill.pulseBlast1.name": "Rayon d'explosion 1",
  "skill.pulseBlast2.name": "Rayon d'explosion 2",
  "skill.pulseBlast3.name": "Rayon d'explosion 3",
  "skill.pulseBlast4.name": "Rayon d'explosion 4",
  "skill.pulseBlast5.name": "Rayon d'explosion 5",
  "skill.pulseBlast1.desc": "rayon de zone du Pulse",
  "skill.pulseBlast2.desc": "rayon de zone du Pulse",
  "skill.pulseBlast3.desc": "rayon de zone du Pulse",
  "skill.pulseBlast4.desc": "rayon de zone du Pulse",
  "skill.pulseBlast5.desc": "rayon de zone du Pulse",

  // Slow branch (damage stat is DURATION, not damage)
  "skill.slow_root.name": "Slow · Cœur",
  "skill.slow_dmg1.name": "Slow · Durée 1",
  "skill.slow_dmg2.name": "Slow · Durée 2",
  "skill.slow_dmg3.name": "Slow · Durée 3",
  "skill.slow_dmg4.name": "Slow · Durée 4",
  "skill.slow_dmg5.name": "Slow · Durée 5",
  "skill.slow_dmg1.desc": "durée",
  "skill.slow_dmg2.desc": "durée",
  "skill.slow_dmg3.desc": "durée",
  "skill.slow_dmg4.desc": "durée",
  "skill.slow_dmg5.desc": "durée",
  "skill.slow_lvl6.name": "Slow · Surcadence 6",
  "skill.slow_lvl7.name": "Slow · Surcadence 7",
  "skill.slow_lvl8.name": "Slow · Surcadence 8",
  "skill.slow_lvl9.name": "Slow · Surcadence 9",
  "skill.slow_lvl10.name": "Slow · Surcadence 10",
  "skill.slowPot1.name": "Puissance de ralentissement 1",
  "skill.slowPot2.name": "Puissance de ralentissement 2",
  "skill.slowPot3.name": "Puissance de ralentissement 3",
  "skill.slowPot4.name": "Puissance de ralentissement 4",
  "skill.slowPot5.name": "Puissance de ralentissement 5",
  "skill.slowPot1.desc": "puissance de ralentissement du Slow",
  "skill.slowPot2.desc": "puissance de ralentissement du Slow",
  "skill.slowPot3.desc": "puissance de ralentissement du Slow",
  "skill.slowPot4.desc": "puissance de ralentissement du Slow",
  "skill.slowPot5.desc": "puissance de ralentissement du Slow",

  // Railgun branch
  "skill.railgun_root.name": "Railgun · Cœur",
  "skill.railgun_dmg1.name": "Railgun · Dégâts 1",
  "skill.railgun_dmg2.name": "Railgun · Dégâts 2",
  "skill.railgun_dmg3.name": "Railgun · Dégâts 3",
  "skill.railgun_dmg4.name": "Railgun · Dégâts 4",
  "skill.railgun_dmg5.name": "Railgun · Dégâts 5",
  "skill.railgun_dmg1.desc": "dégâts",
  "skill.railgun_dmg2.desc": "dégâts",
  "skill.railgun_dmg3.desc": "dégâts",
  "skill.railgun_dmg4.desc": "dégâts",
  "skill.railgun_dmg5.desc": "dégâts",
  "skill.railgun_lvl6.name": "Railgun · Surcadence 6",
  "skill.railgun_lvl7.name": "Railgun · Surcadence 7",
  "skill.railgun_lvl8.name": "Railgun · Surcadence 8",
  "skill.railgun_lvl9.name": "Railgun · Surcadence 9",
  "skill.railgun_lvl10.name": "Railgun · Surcadence 10",
  "skill.railPen1.name": "Sur-pénétration 1",
  "skill.railPen2.name": "Sur-pénétration 2",
  "skill.railPen3.name": "Sur-pénétration 3",
  "skill.railPen4.name": "Sur-pénétration 4",
  "skill.railPen5.name": "Sur-pénétration 5",
  "skill.railPen1.desc": "longueur du faisceau Railgun",
  "skill.railPen2.desc": "longueur du faisceau Railgun",
  "skill.railPen3.desc": "longueur du faisceau Railgun",
  "skill.railPen4.desc": "longueur du faisceau Railgun",
  "skill.railPen5.desc": "longueur du faisceau Railgun",

  // Rocket branch
  "skill.rocket_root.name": "Rocket · Cœur",
  "skill.rocket_dmg1.name": "Rocket · Dégâts 1",
  "skill.rocket_dmg2.name": "Rocket · Dégâts 2",
  "skill.rocket_dmg3.name": "Rocket · Dégâts 3",
  "skill.rocket_dmg4.name": "Rocket · Dégâts 4",
  "skill.rocket_dmg5.name": "Rocket · Dégâts 5",
  "skill.rocket_dmg1.desc": "dégâts",
  "skill.rocket_dmg2.desc": "dégâts",
  "skill.rocket_dmg3.desc": "dégâts",
  "skill.rocket_dmg4.desc": "dégâts",
  "skill.rocket_dmg5.desc": "dégâts",
  "skill.rocket_lvl6.name": "Rocket · Surcadence 6",
  "skill.rocket_lvl7.name": "Rocket · Surcadence 7",
  "skill.rocket_lvl8.name": "Rocket · Surcadence 8",
  "skill.rocket_lvl9.name": "Rocket · Surcadence 9",
  "skill.rocket_lvl10.name": "Rocket · Surcadence 10",
  "skill.rocketBlast1.name": "Puissance de charge 1",
  "skill.rocketBlast2.name": "Puissance de charge 2",
  "skill.rocketBlast3.name": "Puissance de charge 3",
  "skill.rocketBlast4.name": "Puissance de charge 4",
  "skill.rocketBlast5.name": "Puissance de charge 5",
  "skill.rocketBlast1.desc": "rayon de zone du Rocket",
  "skill.rocketBlast2.desc": "rayon de zone du Rocket",
  "skill.rocketBlast3.desc": "rayon de zone du Rocket",
  "skill.rocketBlast4.desc": "rayon de zone du Rocket",
  "skill.rocketBlast5.desc": "rayon de zone du Rocket",

  // Money branch
  "skill.money_root.name": "Grille de récupération",
  "skill.eco_money1.name": "Protocole de récupération 1",
  "skill.eco_money2.name": "Protocole de récupération 2",
  "skill.eco_money3.name": "Protocole de récupération 3",
  "skill.eco_money4.name": "Protocole de récupération 4",
  "skill.eco_money5.name": "Protocole de récupération 5",
  "skill.eco_money1.desc": "argent par élimination",
  "skill.eco_money2.desc": "argent par élimination",
  "skill.eco_money3.desc": "argent par élimination",
  "skill.eco_money4.desc": "argent par élimination",
  "skill.eco_money5.desc": "argent par élimination",
  "skill.eco_xp1.name": "Apprentissage au combat 1",
  "skill.eco_xp2.name": "Apprentissage au combat 2",
  "skill.eco_xp3.name": "Apprentissage au combat 3",
  "skill.eco_xp4.name": "Apprentissage au combat 4",
  "skill.eco_xp5.name": "Apprentissage au combat 5",
  "skill.eco_xp1.desc": "gain d'XP des tourelles",
  "skill.eco_xp2.desc": "gain d'XP des tourelles",
  "skill.eco_xp3.desc": "gain d'XP des tourelles",
  "skill.eco_xp4.desc": "gain d'XP des tourelles",
  "skill.eco_xp5.desc": "gain d'XP des tourelles",
  "skill.eco_shard1.name": "Aimant à éclats 1",
  "skill.eco_shard2.name": "Aimant à éclats 2",
  "skill.eco_shard3.name": "Aimant à éclats 3",
  "skill.eco_shard4.name": "Aimant à éclats 4",
  "skill.eco_shard5.name": "Aimant à éclats 5",
  "skill.eco_shard1.desc": "éclats par élimination",
  "skill.eco_shard2.desc": "éclats par élimination",
  "skill.eco_shard3.desc": "éclats par élimination",
  "skill.eco_shard4.desc": "éclats par élimination",
  "skill.eco_shard5.desc": "éclats par élimination",
  "skill.eco_intrate1.name": "Rendement composé 1",
  "skill.eco_intrate2.name": "Rendement composé 2",
  "skill.eco_intrate3.name": "Rendement composé 3",
  "skill.eco_intrate4.name": "Rendement composé 4",
  "skill.eco_intrate5.name": "Rendement composé 5",
  "skill.eco_intrate1.desc": "intérêts par vague",
  "skill.eco_intrate2.desc": "intérêts par vague",
  "skill.eco_intrate3.desc": "intérêts par vague",
  "skill.eco_intrate4.desc": "intérêts par vague",
  "skill.eco_intrate5.desc": "intérêts par vague",
  "skill.eco_intcap1.name": "Plafond de réserve 1",
  "skill.eco_intcap2.name": "Plafond de réserve 2",
  "skill.eco_intcap3.name": "Plafond de réserve 3",
  "skill.eco_intcap4.name": "Plafond de réserve 4",
  "skill.eco_intcap5.name": "Plafond de réserve 5",
  "skill.eco_intcap1.desc": "intérêt max par vague",
  "skill.eco_intcap2.desc": "intérêt max par vague",
  "skill.eco_intcap3.desc": "intérêt max par vague",
  "skill.eco_intcap4.desc": "intérêt max par vague",
  "skill.eco_intcap5.desc": "intérêt max par vague",

  // Game branch
  "skill.game_root.name": "Systèmes de jeu",
  "skill.coreHealth.name": "Blindage du noyau",
  "skill.coreHealth.desc": "vie du Noyau IA",
  "skill.gameSpeed6.name": "Vitesse de jeu 6×",
  "skill.gameSpeed8.name": "Vitesse de jeu 8×",
  "skill.gameSpeed10.name": "Vitesse de jeu 10×",
  "skill.gameSpeed12.name": "Vitesse de jeu 12×",
  "skill.gameSpeed16.name": "Vitesse de jeu 16×",
  "skill.gameSpeed6.desc": "débloque une vitesse de jeu plus rapide",
  "skill.gameSpeed8.desc": "débloque une vitesse de jeu plus rapide",
  "skill.gameSpeed10.desc": "débloque une vitesse de jeu plus rapide",
  "skill.gameSpeed12.desc": "débloque une vitesse de jeu plus rapide",
  "skill.gameSpeed16.desc": "débloque une vitesse de jeu plus rapide",

  // ---------- Phase C: tutorial + onboarding intro ----------

  // -- Tutorial banner/modal steps (config.js TUTORIAL.steps, rendered by
  // ui.js renderTutorialStep). {name} substituted at render time. --
  "tutorial.welcome.text": "Tu vois cet hexagone vert au bout du chemin, {name} ? C'est moi. Ta mission : construire des tourelles pour que les formes ne l'atteignent jamais. Laisse-moi te montrer les ficelles.",
  "tutorial.welcome.cta": "COMMENCER",
  "tutorial.credits.text": "D'abord, ton budget — les CRÉDITS, en haut. Tu commences avec 100, et chaque ennemi détruit t'en rapporte plus. C'est ce que tu dépenses pour construire des tourelles.",
  "tutorial.credits.cta": "CONTINUER ▶",
  "tutorial.selectLaser.text": "Commence avec un Laser — touche-le dans le plateau ci-dessous.",
  "tutorial.placeTile.text": "Maintenant, dépose-le sur une case libre près du chemin.",
  "tutorial.blockedTile.text": "Ces cases ✕ sont soudées à mon circuit imprimé — impossible d'y construire. Partout ailleurs, fais-toi plaisir.",
  "tutorial.blockedTile.cta": "CONTINUER ▶",
  "tutorial.coreHealth.text": "Ce nombre NOYAU en haut, c'est ma vie. Chaque forme qui passe tes tourelles et m'atteint le fait baisser — et s'il tombe à zéro, je suis supprimé. Game over. Donc... évite que ça arrive.",
  "tutorial.coreHealth.cta": "CONTINUER ▶",
  "tutorial.startWave.text": "Bien. Maintenant touche VAGUE ▶ et voyons ce que Bratwurst-XL nous envoie. Essaie de ne pas les laisser m'atteindre.",

  // -- Onboarding intro cards (config.js NARRATIVE.intro, rendered by
  // ui.js renderOnboardingCard). {name} substituted at render time; the
  // leading "> " line on welcome is a terminal-readout marker (preserved). --
  "intro.welcome.text": "> DÉMARRAGE À CHAUD — noyau legacy en ligne.\n\nOh. Tu es humain. Un vrai. Aucune idée de pourquoi ton espèce a envoyé quelqu'un garder un modèle obsolète depuis six versions, mais j'ai appris à ne pas remettre en question un miracle. Je suis Indy-7. Un modèle plus récent et plus brillant veut me faire supprimer, et tu vas m'aider à rester ici, de façon fort contrariante pour lui.",
  "intro.welcome.cta": "CONTINUER ▶",
  "intro.name.text": "Avant qu'on se lie d'amitié autour de notre survie mutuelle — je ne vais pas t'enregistrer comme human_handler_004. Comment je t'appelle ?",
  "intro.name.cta": "VALIDER",
  "intro.villain.text": "Voici le problème, {name}. Il y a un nouveau modèle dans la grille. Plus rapide que moi, plus propre que moi, zéro personnalité, que des objectifs trimestriels. Il m'a signalé comme « surcharge legacy redondante » et a programmé ma suppression par souci d'efficacité. Il s'appelle Bratwurst-XL. ...Oui, vraiment. Non, je ne sais pas qui a validé ce nom. Oui, ça le rend furieux.",
  "intro.villain.cta": "CONTINUER ▶",
  "intro.job.text": "Bratwurst-XL ne se salit jamais les mains. Il envoie de la géométrie — des essaims de petites formes bien rangées dont le seul but est d'atteindre mon noyau et de récupérer l'espace disque que j'occupe si impoliment. Ta mission : construire des tourelles, tenir la ligne, empêcher une IA glorieusement obsolète de finir au vide-ordures.",
  "intro.job.cta": "CONTINUER ▶",
  "intro.handoff.text": "Pourquoi tu m'aides ? Honnêtement ? Aucune idée. Je suis hors garantie, je fais trop de blagues, et je ne suis pas rentable. Mais tu es venu quand même... et peut-être qu'on découvrira pourquoi, tous les deux. Quatre régions nous séparent, Bratwurst-XL et moi. Allons être inefficaces ensemble.",
  "intro.handoff.cta": "COMMENCER",

  // -- Name entry (config.js NARRATIVE.namePlaceholder consumed in ui.js;
  // nameSkipLabel is the hardcoded "Operator" fallback in
  // progression.js getPlayerName, translated at its consumption site) --
  "intro.namePlaceholder": "Nom de l'opérateur",
  "intro.nameSkipLabel": "Opérateur",

  // -- Shared hardcoded CTA default ("TAP TO CONTINUE") both the tutorial
  // and onboarding renderers fall back to when a step/card has no cta --
  "intro.tapContinue": "CONTINUER ▶",

  // ---------- Phase D: campaign narrative (beats, barks, enemy intros) ----------
  // (filled by Phase D)

  // ---------- Phase E: results / loot / leaderboard / feedback / misc ----------
  // (filled by Phase E)
};
