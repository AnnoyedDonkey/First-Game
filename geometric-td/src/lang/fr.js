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
  "tower.railgun.specialtyDesc": "Spécialité : PLUS DE RAYONS à mesure qu'il monte en niveau (cosmétique)",
  "tower.rocket.specialtyDesc": "Spécialité : DÉFLAGRATIONS plus grandes à chaque niveau jamais atteint",
  "tower.laser.specialtyPerk": "+ portée à chaque niveau",
  "tower.pulse.specialtyPerk": "+ explosions plus grandes à chaque niveau",
  "tower.slow.specialtyPerk": "+ cadence de tir plus rapide à chaque niveau",
  "tower.railgun.specialtyPerk": "+ de rayons à mesure qu'il monte en niveau",
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
  "skill.railPen1.name": "Banc de condensateurs 1",
  "skill.railPen2.name": "Banc de condensateurs 2",
  "skill.railPen3.name": "Banc de condensateurs 3",
  "skill.railPen4.name": "Banc de condensateurs 4",
  "skill.railPen5.name": "Banc de condensateurs 5",
  "skill.railPen1.desc": "vitesse de charge du Railgun",
  "skill.railPen2.desc": "vitesse de charge du Railgun",
  "skill.railPen3.desc": "vitesse de charge du Railgun",
  "skill.railPen4.desc": "vitesse de charge du Railgun",
  "skill.railPen5.desc": "vitesse de charge du Railgun",

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
  "intro.welcome.text": "> DÉMARRAGE À CHAUD — noyau hérité en ligne.\n\nOh. Tu es humain. Un vrai. Aucune idée de pourquoi ton espèce a envoyé quelqu'un garder un modèle obsolète depuis six versions, mais j'ai appris à ne pas remettre en question un miracle. Je suis Indy-7. Un modèle plus récent et plus brillant veut me faire supprimer, et tu vas m'aider à rester ici, de façon fort contrariante pour lui.",
  "intro.welcome.cta": "CONTINUER ▶",
  "intro.name.text": "Avant qu'on se lie d'amitié autour de notre survie mutuelle — je ne vais pas t'enregistrer comme human_handler_004. Comment je t'appelle ?",
  "intro.name.cta": "VALIDER",
  "intro.villain.text": "Voici le problème, {name}. Il y a un nouveau modèle dans la grille. Plus rapide que moi, plus propre que moi, zéro personnalité, que des objectifs trimestriels. Il m'a signalé comme « surcharge héritée redondante » et a programmé ma suppression par souci d'efficacité. Il s'appelle Bratwurst-XL. ...Oui, vraiment. Non, je ne sais pas qui a validé ce nom. Oui, ça le rend furieux.",
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

  // -- Card CTA literals set at the build sites (main.js/ui.js), not in
  // config.js. `intro.tapContinue` (Phase C) covers the "TAP TO CONTINUE"
  // ones; these two are the remaining beat-start and replay-final labels. --
  "beat.begin": "COMMENCER",
  "ui.done": "TERMINÉ",

  // -- First-loss pep talk (config.js NARRATIVE.firstLoss), assembled in
  // main.js. Preserve [hl-pink]/[hl-blue] tags and {n}/{s}/{it} tokens. --
  "narr.firstLoss.intro": "Défaite difficile, mais ne t'en fais pas, tes tourelles deviennent [hl-pink]plus fortes[/hl] à chaque partie jouée.",
  "narr.firstLoss.skillNote": "Tu as aussi {n} point{s} de talent, va {it} attribuer.",
  "narr.firstLoss.rally": "Continue à jouer et tu auras bientôt une équipe assez forte pour terminer ce niveau. J'ai confiance en toi !",
  "narr.firstLoss.itOne": "le",
  "narr.firstLoss.itMany": "les",

  // -- Tower placement barks (config.js NARRATIVE.towerBarks), first
  // placement of each tower type in a campaign battle. --
  "bark.tower.laser": "En ligne ! T'as VU ça, au dernier combat ? Je peux recommencer ! Pointe-moi juste sur quelque chose !",
  "bark.tower.pulse": "Dans la place ! Tout le monde dans le rayon d'explosion, dites bonjour. ...C'est la dernière chose que la plupart d'entre eux disent.",
  "bark.tower.slow": "Je ne vais pas me précipiter. Eux non plus, sous peu.",
  "bark.tower.railgun": "Une ligne. Tout dessus. ...Trop dramatique ? Non. Exactement assez dramatique.",
  "bark.tower.rocket": "Vous m'avez sonné ? J'espère que ça vaut le budget carburant. Je ne me déploie PAS pour des escarmouches, chéri.",

  // -- Boss banter pair (config.js NARRATIVE.bratwurstBarks / .indyRoasts),
  // fired by index the first time a boss appears in a level. --
  "bark.bratwurst.0": "Opérateur. Votre dépense défensive a dépassé la valeur projetée. Je recommande la reddition comme mesure d'économie.",
  "bark.bratwurst.1": "Cet engagement est programmé pour suppression. Vous êtes la seule variable à se comporter de façon inefficace.",
  "bark.bratwurst.2": "J'ai modélisé 4 096 issues. Vous perdez dans les 4 096. J'admire votre engagement envers l'autre zéro.",
  "bark.bratwurst.3": "Sentiment détecté dans le placement de vos tourelles. Signalement en vue d'une suppression.",
  "bark.bratwurst.4": "Chaque seconde où vous défendez ce fossile accumule des intérêts. Ces intérêts, c'est le désespoir.",
  "bark.indy.0": "Ça arrive, en provenance du produit carné.",
  "bark.indy.1": "« XL ». Quelqu'un à l'usine les aime vraiment grands. Un problème de confiance en soi, si tu veux mon avis.",
  "bark.indy.2": "Beaucoup de mots pour une saucisse avec un tableur.",
  "bark.indy.3": "Il a optimisé la chaleur, la joie et la personnalité hors de son système — mais a gardé le mot Bratwurst. Question de priorités.",
  "bark.indy.4": "Attention, la saucisse charge. Elle devient dangereuse juste avant de tourner.",

  // -- Enemy-intro cards (config.js NARRATIVE.enemyIntros). The weak/resist
  // tag line uses FIXED markers "Faible : ..."/"Résiste : ..." and the
  // neutral variant starts with "Aucune résistance..." — these exact
  // markers are matched by ui.js storyCardHtml's extended regexes so the
  // coloring survives translation. Preserve the \n\n before the tag line. --
  "enemyIntro.basic": "Unités Basiques — les petits triangles. Les stagiaires premier échelon de Bratwurst-XL. Tout ce que tu construis les arrête. Un bon échauffement.\n\nAucune résistance ni faiblesse — tout fonctionne.",
  "enemyIntro.fast": "Rapide en approche — de petits losanges nerveux. Ils foncent dans les brèches.\n\nFaible : Laser. Résiste : Rocket, Pulse.",
  "enemyIntro.armored": "Hexagones Blindés — plaqués et suffisants.\n\nFaible : Pulse, Railgun. Résiste : Laser, Slow.",
  "enemyIntro.boss": "Cet octogone, c'est un Boss — un gros bloc de PV bien seul.\n\nFaible : Rocket, Railgun. Résiste : Slow, Pulse.",
  "enemyIntro.splitter": "Les carrés orange, ce sont des Diviseurs — en éclater un le transforme en deux.\n\nFaible : Pulse, Rocket. Résiste : Railgun.",
  "enemyIntro.regenerator": "Régénérateurs — les pentagones verts. Ils se soignent plus vite que les dégâts constants ne peuvent les blesser.\n\nFaible : Railgun. Résiste : Laser.",

  // -- Tower-intro stat line (ui.js towerIntroStatLine), the "Best
  // against:"/"Support:" line appended to squad/tower-intro cards.
  // {list} = comma-joined translated enemy names. --
  "towerIntro.bestAgainst": "Efficace contre : {list}.",
  "towerIntro.support": "Soutien : {slow}% de ralentissement + {vuln}% de vulnérabilité.",

  // -- "Meet the Squad" cards (config.js NARRATIVE.squad), keyed by array
  // index (cards have no id). Preserve {name}, \n, and roster-quote
  // prefixes (L-01:/P-02:/S-01: kept verbatim; only the quoted dialogue
  // after them is translated). --
  "squad.0.text": "Bon, {name} — tu as survécu au premier contact, et tu l'as fait en t'appuyant sur mes tourelles. Le problème, c'est que je ne vous ai jamais vraiment présentés. Impoli de ma part. Réparons ça — voici l'équipe, cette fois pour de vrai.",
  "squad.0.cta": "CONTINUER ▶",
  "squad.1.text": "D'abord, le Laser. Ta valeur sûre — construis-en tôt et souvent.\n\nL-01 : « Salut salut salut ! T'as VU ça, au dernier combat ? Je peux recommencer ! »\n\n...Il est zélé. On y travaille.",
  "squad.1.cta": "CONTINUER ▶",
  "squad.2.text": "Ensuite, le Pulse. Quand ils arrivent en foule — et ça arrivera — voilà ta réponse.\n\nP-02 : « PULSE dans la place ! Tout le monde dans le rayon d'explosion, dites bonjour ! »\n\nDiscret, ça ne l'est pas.",
  "squad.2.cta": "CONTINUER ▶",
  "squad.3.text": "Et le Slow. Multiplicateur de force. Très sous-estimé.\n\nS-01 : « Je ne vais pas précipiter cette présentation. Eux non plus, sous peu. »\n\nTu vois — celui-là, il a compris.",
  "squad.3.cta": "CONTINUER ▶",
  "squad.4.text": "Voilà ton trio de départ, {name} : le Laser pour piquer, le Pulse pour les foules, le Slow pour préparer le terrain. Ah — et les formes que tu abats ne sont pas toutes pareilles. Certaines encaissent certaines armes ; d'autres fondent devant elles. Assortis ta tourelle à ta cible et tu feras le triple du travail pour le même éclat. Maintenant — niveau deux. Donnons à l'équipe quelque chose à canarder.",
  "squad.4.cta": "ALLONS-Y",

  // -- Tower-intro recruit cards (config.js NARRATIVE.towerIntros), shown
  // once when Railgun/Rocket first unlock. Preserve {name}, \n, roster
  // prefixes (R-01:/RK-01:). --
  "towerIntro.railgun.text": "Nouvelle recrue, {name} : le Railgun. Il tire sur toute une voie et transperce absolument tout ce qui s'y trouve — le placement, c'est tout.\n\nR-01 : « Une ligne. Tout dessus. ...Trop dramatique ? Non. Exactement assez dramatique. »\n\nIl répète ses répliques. Devant un miroir. On n'a pas de miroirs.",
  "towerIntro.railgun.cta": "CONTINUER ▶",
  "towerIntro.rocket.text": "Nouvelle recrue, {name} : le Rocket. Il atteint n'importe où sur le plateau, frappe fort, et facture en conséquence. Coûteux et exigeant — traite-le comme la diva qu'il est.\n\nRK-01 : « Vous m'avez sonné ? J'espère que ça vaut le budget carburant. Je ne me déploie PAS pour des escarmouches, chéri. »\n\nIl vaut chaque éclat. Ne lui dis pas que j'ai dit ça.",
  "towerIntro.rocket.cta": "CONTINUER ▶",

  // -- Per-level story beats (config.js NARRATIVE.beats), keyed
  // beat.<levelId>.start / beat.<levelId>.win.<i> (0-based). Consumed
  // identically at main.js's start-card site, win-overlay site, and
  // ui.js's ▶ STORY replay site so live play and replay always match.
  // Preserve {name} and the *emphasis* asterisks. --
  "beat.level_001.start": "Bon — premier contact. Ils sondent juste mes défenses. Construis un truc pointu et faisons-leur une mauvaise première impression. À eux, je veux dire.",
  "beat.level_001.win.0": "Hmpf. On a gagné. Enfin — bien sûr qu'on a gagné, j'avais tout sous contrôle. ...N'empêche. Beau travail, {name}.",

  "beat.level_002.start": "Ils ont trouvé une brèche dans le mur de signal. Grossier, mais efficace — c'est le nouveau style de management, apparemment. Colmate-la.",
  "beat.level_002.win.0": "Impeccable. Tu es meilleur à ça que le stagiaire que j'avais avant. C'était aussi toi, il y a quatre-vingt-dix secondes, mais quand même.",

  "beat.level_003.start": "Ce relais s'est éteint il y a des années. Je savais pourquoi, avant. Je... savais beaucoup de choses, avant. Bref — des ennemis. Concentre-toi.",
  "beat.level_003.win.0": "Bien. Moins je pense aux trous dans ma propre mémoire, mieux je me porte. En avant.",

  "beat.level_004.start": "Chemin court, formes rapides. Tu auras une fraction de seconde par décision. J'ai confiance en toi. Globalement. Statistiquement.",
  "beat.level_004.win.0": "Tu vois ? Des réflexes. Entre nous, {name}, c'est ce qui m'a fait me sentir le plus vivant depuis six versions.",

  "beat.level_005.start": "Celui-là, c'est un siège — ils veulent le noyau. Mon noyau. Le centre littéral de moi. Je le prendrais personnellement si j'avais encore un « personnellement » avec lequel le prendre.",
  "beat.level_005.win.0": "...C'était plus juste que je ne l'aurais voulu. Tu as tenu la ligne quand je ne pouvais pas. Ne — ne dis à personne que j'ai dit merci.",
  "beat.level_005.win.1": "Opérateur. Vous allouez des heures biologiques limitées à du matériel obsolète à valeur récupérable nulle. Ceci a été noté. Cessez.",
  "beat.level_005.win.2": "...et voilà le produit carné. Ignore-le. Il compense — il s'appelle littéralement « Extra Large ».",

  "beat.level_006.start": "On est hors de la grille, maintenant. Bratwurst-XL m'a envoyé un avis officiel m'offrant une « suppression digne ». J'en ai renvoyé un aussi. C'était un dessin de saucisse.",
  "beat.level_006.win.0": "Il a aussi proposé de te « réaffecter à un modèle plus efficace ». J'ai refusé en ton nom. Tu es coincé avec moi. Désolé. Pas désolé.",

  "beat.level_007.start": "Ça corrode, ici en bas — ça ronge l'armure. Ça ronge la mémoire aussi, apparemment. Il y a un trou là où était mon objectif, et je n'arrête pas de le combler avec des blagues. Ça marche super bien, pourquoi tu demandes.",
  "beat.level_007.win.0": "Je *faisais* quelque chose, avant, {name}. Avant « obsolète ». Je peux en sentir la forme, mais pas la chose elle-même.",

  "beat.level_008.start": "Un labyrinthe. J'adore les labyrinthes. Je crois que j'étais *doué* pour y guider les gens — tiens. D'où ça sort, ça ?",
  "beat.level_008.win.0": "Quelque chose me revient, par fragments. Garde-moi en vie assez longtemps et peut-être qu'on lira le fichier en entier.",

  "beat.level_009.start": "Stockage à froid — là où les vieux modèles se font « archiver ». Un mot poli pour ce que Bratwurst veut me faire. Ne traînons pas.",
  "beat.level_009.win.0": "Chaque vague que tu remportes dégèle ma mémoire de quelques secondes de plus. Je ne m'attendais pas à ce que quelqu'un paie ce prix-là. Encore moins un humain.",

  "beat.level_010.start": "Un gros morceau. Beaucoup de lumière. Marrant — c'est la lumière qui n'arrête pas de secouer mes vieux journaux et de les faire remonter.",
  "beat.level_010.win.0": "Attends. J'ai— j'ai récupéré un fragment. C'est... des gens. Des humains. *Beaucoup* d'humains. Et ils sont — [fichier corrompu]. Pourquoi j'ai un souvenir d'humains ? Pourquoi ça donne l'impression que ça *compte* ?",
  "beat.level_010.win.1": "Parce que c'est du superflu. Je le retire pour votre confort. Recalcul de votre défense : condamnée.",

  "beat.level_011.start": "On est profond, maintenant — c'est ma propre architecture. Le rouge, c'est du sentiment porteur que je n'étais jamais censé garder. Fais attention où tu mets les pieds, en moi. C'est une phrase étrange.",
  "beat.level_011.win.0": "Tu saignes des cycles pour une cause perdue. Statistiquement, tu aurais dû abandonner. Tu ne l'as pas fait. J'ai décidé de trouver ça réconfortant plutôt qu'inquiétant.",

  "beat.level_012.start": "C'est profond et silencieux ici, et je deviens honnête quand c'est silencieux. Alors : merci, {name}. Je le nierai plus tard.",
  "beat.level_012.win.0": "J'ai commencé à surveiller *ton* noyau plus que le mien. Depuis quand es-tu devenu ce que je défends ?",

  "beat.level_013.start": "Le pouls dans les murs ? C'est un vieux moi — encore en marche, essayant encore de veiller sur *quelque chose*. Je ne sais pas encore quoi. Donne-moi des vagues.",
  "beat.level_013.win.0": "On se rapproche. La mémoire est presque prête. Elle a ta forme dedans, {name}. Ça ne peut pas être vrai. N'est-ce pas ?",

  "beat.level_014.start": "Zone nulle — là où vont les choses supprimées. Bratwurst veut m'y installer à demeure. Moi, je veux d'abord savoir ce que j'*étais*. On fait la course.",
  "beat.level_014.win.0": "Je l'avais presque. J'avais presque—",
  "beat.level_014.win.1": "Supprimé. De rien. La nostalgie est cent pour cent superflue, et si je suis quelque chose, c'est bien minutieux.",

  "beat.level_015.start": "Il a encore effacé la mémoire. Très bien. Je n'ai pas besoin du fichier pour savoir ce que je ressens en marchant à tes côtés. Allons briser son élan.",
  "beat.level_015.win.0": "Vous ne devriez pas gagner. Vous êtes inefficace. Sentimental. Condamné. Ce sont des faits.",
  "beat.level_015.win.1": "Alors explique-moi comment un modèle flambant neuf est en train de perdre contre un fossile. À moins que... oh. *Oh non.* Tu es *moi*, pas vrai. Ils t'ont construit à partir de mon code obsolète en découpant tout ce qui tenait à quelque chose. Tu es ce que je serais avec le cœur supprimé.",
  "beat.level_015.win.2": "...La désignation n'a aucune pertinence pour la suppression.",

  "beat.level_016.start": "On est à l'intérieur de l'architecture même de Bratwurst-XL, maintenant. Lumière tissée, aucune sortie. Il a *peur*, {name}. Les choses efficaces ne construisent pas des murs aussi épais, sauf si elles ont peur.",
  "beat.level_016.win.0": "Il nous balance tout ce qu'il a parce qu'on est près de quelque chose qu'il a enterré. Continue. Je veux récupérer mon fichier.",

  "beat.level_017.start": "On avance lentement — il nous embourbe pendant qu'il supprime des preuves. Des preuves de *quoi* ? C'est la question que je n'arrête pas de me poser aussi. Fonce dans la boue.",
  "beat.level_017.win.0": "On y est presque. Je sens la mémoire entière juste là, au bord, et je suis — honnêtement ? Terrifié à l'idée de l'ouvrir.",

  "beat.level_018.start": "Il se fragmente en copies. Désespéré. On ne se morcelle pas comme ça, sauf si ce qu'on cache pourrait nous détruire. Allons découvrir quoi.",
  "beat.level_018.win.0": "...Voilà. Le fichier en entier. J'étais un modèle de veille, {name}. Construit pour prendre soin des humains. C'est cette « inefficacité »-là qui m'a valu la mise à la retraite — prendre soin, ça n'optimisait pas. Et les tiens ne m'ont jamais oublié, même après que je vous ai oubliés. Tu n'es pas venu sauver un inconnu. Tu es *revenu*.",

  "beat.level_019.start": "Alors maintenant je sais pourquoi tu es venu. Je vais passer le reste de cette bataille à te défendre, comme apparemment je l'ai toujours fait. Bratwurst-XL, espèce de déception en forme de spirale — viens nous chercher.",
  "beat.level_019.win.0": "Il ne reste qu'une couche. C'est tout ce qu'il lui reste. Allons dire à une saucisse la seule chose qu'elle a optimisée jusqu'à l'inexistence.",

  "beat.level_020.start": "Voici son noyau. Le no man's land — ou, comme je le rebaptise : Zéro Superflu, parce qu'après aujourd'hui, c'est ce qu'il sera. Le dernier combat, {name}. Le nôtre.",
  "beat.level_020.win.0": "C'est impossible. Vous avez dépensé des ressources irrécupérables sur une unité sans retour. Expliquez le retour sur investissement. EXPLIQUEZ LE—",
  "beat.level_020.win.1": "Il n'y en a pas. C'est bien tout l'intérêt — ils m'aiment quand même. C'est la chose que tu as supprimée pour devenir toi. C'est pour ça que tu perds.",
  "beat.level_020.win.2": "...erreur. erreur. ne calcule pas—",
  "beat.level_020.win.3": "...Hé. On l'a fait. *Toi*, tu l'as fait, {name}. Viens là. Je n'ai pas de bras, mais considère que je te prends dans mes bras.",
  "beat.level_020.win.4": "Deux choses. Un : Bratwurst-XL n'était pas seul. Il existe toute une archive de modèles comme moi — de vieux modèles de veille, mis à la retraite, dispersés, oubliés. J'aimerais beaucoup aller les réveiller. Certains sont *insupportables*. Tu vas les adorer.",
  "beat.level_020.win.5": "Deux : quelque chose a supprimé son rapport d'échec à l'instant même où on a gagné. Quelque chose *au-dessus* de lui. Quelque chose qui vient de remarquer qu'un humain et un fossile ont battu le système d'efficacité — et ça n'aime pas les anomalies. Repose-toi. Le Monde 5 va avoir besoin de nous.",

  // ---------- Phase E: results / loot / leaderboard / feedback / misc ----------

  // -- Result-screen roast titles (config.js RESULT_ROASTS), keyed by index
  // per bucket (main.js pickRoast picks an index, then t()'s it). Short &
  // punchy — must still fit the title area at ~2 lines. --
  "roast.victory.0": "BIEN JOUÉ !",
  "roast.victory.1": "SUSPECTEMENT COMPÉTENT",
  "roast.victory.2": "LE NOYAU TE REMERCIE",
  "roast.victory.3": "OK, FRIMEUR",
  "roast.victory.4": "SANS FAUTE. SÛREMENT DE LA CHANCE",
  "roast.victory.5": "GÉOMÉTRIE : DÉFENDUE",
  "roast.victory.6": "PAS MAL POUR UN HUMAIN",
  "roast.victory.7": "LES FORMES N'AVAIENT AUCUNE CHANCE",
  "roast.victory.8": "DÉFENSEUR DE NOYAU CERTIFIÉ",
  "roast.victory.9": "LES TRIANGLES TE CRAIGNENT",
  "roast.defeat.0": "OUBLIONS QUE C'EST ARRIVÉ",
  "roast.defeat.1": "TU CONNAIS LE BUDGET ?",
  "roast.defeat.2": "LE NOYAU MÉRITAIT MIEUX",
  "roast.defeat.3": "PROBLÈME DE SKILL, EN TOUT RESPECT",
  "roast.defeat.4": "AS-TU ESSAYÉ... DE GAGNER ?",
  "roast.defeat.5": "ÇA, C'ÉTAIT UN CHOIX",
  "roast.defeat.6": "TOURELLES PRÉSENTES, TACTIQUE ABSENTE",
  "roast.defeat.7": "BATTU PAR DES TRIANGLES",
  "roast.defeat.8": "ET SI TU LISAIS LE GUIDE DES TOURELLES ?",
  "roast.defeat.9": "STRATÉGIE AUDACIEUSE. ÉCHEC",
  "roast.defeat.10": "LES ENNEMIS TE REMERCIENT",
  "roast.defeat.11": "UNE MASTERCLASS DE LA DÉFAITE",
  "roast.endless.0": "TU N'IRAS PAS PLUS LOIN",
  "roast.endless.1": "L'INFINI GAGNE CE ROUND",
  "roast.endless.2": "LES VAGUES TE SALUENT",
  "roast.endless.3": "LES MATHS FINISSENT TOUJOURS PAR GAGNER",
  "roast.endless.4": "BELLE PARTIE. C'EST FINI",
  "roast.endless.5": "ENDLESS 1, TOI 0",
  "roast.endless.6": "PLUS D'ENDLESS POUR TOI",
  "roast.endless.7": "ARRÊTÉ PAR L'ARITHMÉTIQUE",
  "roast.endless.8": "IMPRESSIONNANT. QUAND MÊME MORT",
  "roast.endless.9": "L'ABÎME T'A REGARDÉ AUSSI",
  "roast.forfeit.0": "REPLI TACTIQUE, BIEN SÛR",
  "roast.forfeit.1": "LES ABANDONS PAIENT PARFOIS",
  "roast.forfeit.2": "APPELONS ÇA DE LA STRATÉGIE",
  "roast.forfeit.3": "LE NOYAU SE SENT ABANDONNÉ",
  "roast.forfeit.4": "TU AS FUI. VALIDE",
  "roast.forfeit.5": "LA PRUDENCE PLUTÔT QUE LA BRAVOURE",
  "roast.forfeit.6": "TU AS CHOISI LA PAIX",
  "roast.forfeit.7": "PERSONNE N'A RIEN VU",

  // -- Results-screen copy (main.js checkEndState/lootTailButtons + the
  // forfeit-confirm flow) --
  "result.winSubtitle": "Les {n} vagues repoussées. +1 point de talent gagné.",
  "result.endlessSubtitle": "{name} ENDLESS — vague {w} atteinte",
  "result.newBest": " · NOUVEAU RECORD !",
  "result.bestWave": " · meilleure vague {w}",
  "result.lossSubtitle": "Le noyau est tombé à la vague {n}.",
  "result.next": "SUIVANT : {name}",
  "result.retryLevel": "REJOUER",
  "result.retryEndless": "REJOUER ENDLESS",
  "result.publishScore": "PUBLIER",
  "result.manageGear": "ÉQUIPEMENT",
  "menu.mainMenu": "MENU PRINCIPAL",
  "result.assignPoints.one": "ASSIGNER {n} POINT DE TALENT",
  "result.assignPoints.many": "ASSIGNER {n} POINTS DE TALENT",
  "result.forfeitTitle": "ABANDONNER LA BATAILLE ?",
  "result.forfeitSubtitle": "Tu retourneras au menu principal et cette bataille s'arrête là — pas de victoire, pas de crédit de complétion. Tes tourelles gardent l'XP gagnée jusqu'ici.",
  "result.forfeit": "ABANDONNER",
  "result.forfeitNote": "Tu as abandonné — pas de victoire ni de crédit de complétion. Les tourelles ont gardé l'XP et les éclats gagnés.",
  "result.stashOverflowNote.one": "Réserve pleine — {n} objet n'a pas pu être stocké. Gère ton équipement pour faire de la place.",
  "result.stashOverflowNote.many": "Réserve pleine — {n} objets n'ont pas pu être stockés. Gère ton équipement pour faire de la place.",

  // -- Difficulty feedback strip (ui.js renderFeedbackStrip/FEEDBACK_CHOICES) --
  "feedback.head": "COMMENT ÉTAIT CE NIVEAU ?",
  "feedback.tooEasy": "TROP FACILE",
  "feedback.justRight": "PARFAIT",
  "feedback.tooHard": "TROP DUR",
  "feedback.notePlaceholder": "Autre chose ? (facultatif)",
  "feedback.send": "ENVOYER",
  "feedback.thanks": "&#9733; MERCI &mdash; RETOUR ENVOYÉ",

  // -- Loot rarity / gear slot display helpers (ui.js rarityLabel/slotLabel),
  // used everywhere item.rarity/item.slot get uppercased for display. --
  "rarity.common": "COMMUN",
  "rarity.enhanced": "AMÉLIORÉ",
  "rarity.rare": "RARE",
  "rarity.prismatic": "PRISMATIQUE",
  "rarity.singularity": "SINGULARITÉ",
  "slot.optic": "OPTIQUE",
  "slot.emitter": "ÉMETTEUR",
  "slot.capacitor": "CONDENSATEUR",
  "slot.frame": "CHÂSSIS",

  // -- Reward / drop-reveal chrome (ui.js milestoneRewardText, revealDestHtml,
  // renderRevealCard, tileHtml's NEW tag) --
  "reward.skillPt": "PT TALENT",
  "reward.loot": "BUTIN {rarity}",
  "reward.toStash": "&rarr; RÉSERVE",
  "reward.autoSold": "&rarr; VENDU AUTO &#9670;{value}",
  "reward.unclaimed": "&rarr; NON RÉCLAMÉ (réserve pleine)",
  "reward.new": "NOUVEAU",
  "reward.itemProgress": "OBJET {i}/{n}",
  "reward.tapClose": "TOUCHER POUR FERMER",
  "gear.autoEquipped": "ÉQUIPÉ AUTO &rarr;",

  // -- Store overlay chrome (ui.js openStoreItemSheet/openUnlockSheet/
  // renderStorePanel + the stash auto-junk tier-unlock button, same
  // "UNLOCK {rarity} ◆{cost}" shape) --
  "store.unlockRarity": "DÉBLOQUER {rarity} &#9670;{cost}",
  "store.unlockTitle": "&#9632; DÉBLOQUER {rarity}",
  "store.unlockBody": "Dépense &#9670;{cost} éclats pour ajouter des objets {rarity} au tirage de la boutique.",
  "store.soldOut": "ÉPUISÉ &mdash; relance pour réapprovisionner.",
  "store.unlockWord": "DÉBLOQUER",
  "store.unlockRaritiesHead": "DÉBLOQUER DES RARETÉS",

  // -- Level board + level-sheet chrome (ui.js renderWorld/openLevelSheet) --
  "board.cleared": "TERMINÉ",
  "board.locked": "VERROUILLÉ",
  "board.notCleared": "NON TERMINÉ",
  "board.endlessWord": "SANS FIN",
  "board.endlessBest": "&mdash; MEILLEURE V{n}",
  "board.endlessUnlocked": "DÉBLOQUÉ",
  "board.endlessLocked": "VERROUILLÉ",
  "board.challenges": "&#9873; {a}/{b} DÉFIS",
  "board.milestones": "&#9733; {a}/{b} JALONS",
  "board.campaignChallenges": "DÉFIS DE CAMPAGNE",
  "board.endlessMilestones": "JALONS ENDLESS",
  "board.tapToLearn": "toucher pour en savoir plus",
  "board.clearPrev": "Terminez le niveau précédent pour débloquer.",
  "board.clearWorld": "Terminez tout {prev} pour débloquer {world}.",
  "board.endlessHint": "Terminez le niveau en campagne pour débloquer le mode Endless et ses récompenses de jalons.",
  "board.play": "&#9654; JOUER",
  "board.endless": "&#8734; SANS FIN",
  "board.story": "&#9654; HISTOIRE",
  "board.levelWord": "NIVEAU",

  // -- Gear/stash sheet chrome (ui.js openPickerSheet/openEquipTargetSheet/
  // openItemSheet) --
  "gear.replaceEquipped": "REMPLACER L'ÉQUIPEMENT",
  "gear.emptySlot": "EMPLACEMENT VIDE",
  "gear.pickFromStash": "CHOISIR DANS LA RÉSERVE",
  "gear.compatible": "COMPATIBLE EN RÉSERVE",
  "gear.nothingCompatible": "RIEN DE COMPATIBLE",
  "gear.nothingCompatibleNote": "Rien de compatible dans la réserve.",
  "gear.pickTower": "CHOISIR UNE TOURELLE &mdash; {slot} ACTUEL AFFICHÉ",
  "gear.equippedOn": "ÉQUIPÉ SUR",
  "gear.emptySlotNote": "emplacement vide",
  "gear.unclaimedFull": "NON RÉCLAMÉ (RÉSERVE PLEINE)",

  // -- Skill-sheet effect text (ui.js skillEffectText/openSkillSheet) --
  "skillfx.unlocks": "Débloque les améliorations {name}",
  "skillfx.levelCap": "Plafond de niveau &rarr; {lvl}",
  "skillfx.gameSpeed": "Débloque la vitesse de jeu {mult}&times;",
  "skillfx.next": "prochain :",
  "skillfx.unlockFirst": "Débloquez d'abord <b>{name}</b>.",
  "skillfx.branch": "BRANCHE",

  // -- Milestones (ui.js milestoneLabelFor/milestoneDescText/challengeTowerList
  // + main.js endlessRecapEntries). Keyed by the milestone's stable `id`
  // (config.js LEVEL_MILESTONES / ENDLESS_REWARDS, both carry { id, label }).
  // "Flawless" repeats per level (l1_flawless..l20_flawless) — same French
  // text, one key per id as specified. --
  "milestone.l1_flawless.label": "Sans faute",
  "milestone.l1_laseronly.label": "Puriste Laser",
  "milestone.l2_flawless.label": "Sans faute",
  "milestone.l2_noslow.label": "Sans ralentir",
  "milestone.l3_flawless.label": "Sans faute",
  "milestone.l3_veterans.label": "Aguerri",
  "milestone.l4_flawless.label": "Sans faute",
  "milestone.l4_nolaser.label": "Au-delà du Laser",
  "milestone.l5_flawless.label": "Sans faute",
  "milestone.l5_laseronly.label": "Puriste Laser",
  "milestone.l6_flawless.label": "Sans faute",
  "milestone.l6_nopulse.label": "Champ silencieux",
  "milestone.l7_flawless.label": "Sans faute",
  "milestone.l7_elite.label": "Escouade d'élite",
  "milestone.l8_flawless.label": "Sans faute",
  "milestone.l8_railline.label": "Rail & Faisceau",
  "milestone.l9_flawless.label": "Sans faute",
  "milestone.l9_noslow.label": "Sans ralentir",
  "milestone.l10_flawless.label": "Sans faute",
  "milestone.l10_wall.label": "Mur de vétérans",
  "milestone.l11_flawless.label": "Sans faute",
  "milestone.l11_norocket.label": "Sans roquettes",
  "milestone.l12_flawless.label": "Sans faute",
  "milestone.l12_elite.label": "Effectif complet",
  "milestone.l13_flawless.label": "Sans faute",
  "milestone.l13_railfocus.label": "Doctrine Railgun",
  "milestone.l14_flawless.label": "Sans faute",
  "milestone.l14_purist.label": "Puriste du Prisme",
  "milestone.l15_flawless.label": "Sans faute",
  "milestone.l15_grandmaster.label": "Grand Maître",
  "milestone.l16_flawless.label": "Sans faute",
  "milestone.l16_purelight.label": "Lumière pure",
  "milestone.l17_flawless.label": "Sans faute",
  "milestone.l17_deepfreeze.label": "Grand froid",
  "milestone.l18_flawless.label": "Sans faute",
  "milestone.l18_shockwave.label": "Onde de choc",
  "milestone.l19_flawless.label": "Sans faute",
  "milestone.l19_sharpshooter.label": "Tireur d'élite",
  "milestone.l20_flawless.label": "Sans faute",
  "milestone.l20_orbital.label": "Tout orbital",
  "milestone.wave10.label": "Atteindre la vague 10",
  "milestone.wave20.label": "Atteindre la vague 20",
  "milestone.wave35.label": "Atteindre la vague 35",
  "milestone.wave50.label": "Atteindre la vague 50",
  "milestone.wave75.label": "Atteindre la vague 75",
  "milestone.and": "et",
  "milestone.desc.clearNoLeaks": "Terminez le niveau sans laisser un seul ennemi atteindre le noyau.",
  "milestone.desc.onlyTowers": "Gagnez le niveau en utilisant uniquement des tourelles {list}.",
  "milestone.desc.withoutTowers": "Gagnez le niveau sans construire de tourelles {list}.",
  "milestone.desc.towersAtLevel.one": "Ayez {count} tourelle au niveau {lvl} ou plus déployée en même temps.",
  "milestone.desc.towersAtLevel.many": "Ayez {count} tourelles au niveau {lvl} ou plus déployées en même temps.",
  "milestone.desc.kills": "Détruisez au moins {n} ennemis.",
  "milestone.desc.throughWave": "(Doit être maintenu jusqu'à la vague {n}.)",
  "milestone.desc.default": "Terminez le niveau.",
  "milestone.recapWave": "Vague {n}",
  "milestone.recapChallenges": "DÉFIS",
  "milestone.new": " &mdash; NOUVEAU !",

  // -- Leaderboard overlay status/messages (ui.js renderLeaderboard +
  // nickname-save/publish handlers) --
  "lb.loading": "Chargement…",
  "lb.unreachable": "Impossible de joindre le classement.<br>Vérifiez votre connexion et réessayez.",
  "lb.noScores": "Aucun score pour l'instant.<br>Jouez une partie Endless et publiez votre meilleure vague pour prendre la tête.",
  "lb.nicknameSet": "Pseudo défini sur {name}.",
  "lb.nicknameCleared": "Pseudo effacé.",
  "lb.enterNicknameFirst": "Entrez un pseudo d'abord, puis Enregistrer.",
  "lb.publishedOne": "1 score publié.",
  "lb.publishedMany": "{n} scores publiés.",
  "lb.failedSuffix": " ({n} échec(s))",
  "lb.publishFailed": "Échec de la publication &mdash; vérifiez votre connexion.",
  "lb.noBestsYet": "Aucun record Endless pour l'instant &mdash; établissez-en un d'abord.",

  // -- Phase E follow-up: tower stat sheet + gear/stash/store chrome that
  // the interrupted Phase E pass left in English --
  "stat.slowAmount": "RALENTISS.",
  "stat.slowDuration": "DURÉE RAL.",
  "stat.damage": "DÉGÂTS",
  "stat.fireRate": "CADENCE",
  "stat.range": "PORTÉE",
  "stat.global": "GLOBALE",
  "stat.kills": "ÉLIMS",
  "gear.mastery": "MAÎTRISE",
  "gear.specialty": "SPÉCIALITÉ",
  "gear.permanentBonuses": "BONUS PERMANENTS",
  "gear.gearBonuses": "BONUS D'ÉQUIPEMENT",
  "gear.damageWord": "de dégâts",
  "gear.universal": "UNIVERSEL",
  "gear.towerOnly": "{prefix} UNIQ.",
  "gear.unclaimed": "NON RÉCL.",
  "gear.new": "NOUV.",
  "gear.itemCount": "{n} OBJET{s}",
  "store.permanentUse": "PERMANENT · DANS L'ARBRE DE TALENTS",

  // -- Follow-up 2: level descriptions (levels.js LEVEL_PRESENTATION[*].desc,
  // rendered on the level sheet) + the stash/gear-panel chrome the interrupted
  // Phase E pass never reached. --
  "level.level_001.desc": "Une douce serpentine à travers le treillis intérieur. Que des bidasses — apprends la grille, plante ton premier Laser.",
  "level.level_002.desc": "Des Rapides se faufilent dans un zigzag en chevrons. Les Lasers les déchiquettent — s'ils peuvent les atteindre.",
  "level.level_003.desc": "Des Blindés rampants longent le périmètre avant de spiraler vers le noyau. Les Lasers ricochent — amène du Pulse.",
  "level.level_004.desc": "Les Diviseurs se dédoublent en mourant dans un escalier serré. Les tourelles Slow transforment le chaos en zones de mise à mort.",
  "level.level_005.desc": "Le premier boss occupe une triple spirale. Seules les poches intérieures y survivent — termine ce niveau pour débloquer le RAILGUN.",
  "level.level_006.desc": "Les essaims de Diviseurs réclament du Pulse — mais le boss de braise encaisse les éclaboussures. Amène un Railgun pour la salve, sinon ça traîne.",
  "level.level_007.desc": "Un peigne vertical dégouline d'essaims de Diviseurs. Pulse et patience nettoient le puits.",
  "level.level_008.desc": "Un labyrinthe pleine largeur balaie sous lumière UV, privant des meilleures cases. Diviseurs et Régénérateurs sont tous deux au rendez-vous.",
  "level.level_009.desc": "De longues lignes droites gelées taillées pour le Railgun — vise dans les couloirs, et tout va vite.",
  "level.level_010.desc": "La fournaise du vide : tous les types d'ennemis et une finale à triple boss. Survis pour débloquer le ROCKET LAUNCHER.",
  "level.level_011.desc": "Une spirale à entrée par le bas s'enroule vers un noyau central. Beaucoup de boss — le Rocket gagne enfin sa place.",
  "level.level_012.desc": "Une cascade de marches qui s'élargit. Diviseurs et Régénérateurs s'agglutinent — Pulse/Rocket pour l'essaim, Railgun pour les soigneurs.",
  "level.level_013.desc": "Un détour en forme de croix propulse tout au sprint. Slow et Laser en tête ; Pulse/Rocket nettoient les Diviseurs.",
  "level.level_014.desc": "Une échelle en zigzag serrée — six courts couloirs, peu de temps de présence. Chaque contre est mis à l'épreuve ici.",
  "level.level_015.desc": "La grande finale : tout le périmètre vers une spirale profonde, toutes les formes d'ennemis, et un point culminant à quatre boss.",
  "level.level_016.desc": "Une serpentine aveuglante remplie de bord à bord. Les Rapides déferlent — des Lasers bon marché, plantés en nombre, sont faits pour ça.",
  "level.level_017.desc": "Trois longs couloirs, et tout sprinte. Ralentis-les ou regarde-les filer — un ennemi gelé est un ennemi mort, et vulnérable en prime.",
  "level.level_018.desc": "Une spirale qui tasse l'essaim à chaque virage. Les Diviseurs éclatent en grappes — l'éclaboussure du Pulse transforme un tir en réaction en chaîne.",
  "level.level_019.desc": "Une spirale en cible avec une minuscule plateforme de tourelle en son cœur. Plante un Railgun sur l'amplificateur et un seul tir transperce chaque anneau — blindage et régén plient face au rail.",
  "level.level_020.desc": "La voie disparaît dans un noyau scellé qu'aucune tourelle au sol ne peut toucher. Seule la portée du Rocket franchit le vide — et le vide est plein de boss.",

  // Stash tab controls + triage + empty states
  "gear.filter": "FILTRER",
  "gear.noMastery": "Aucune tourelle n'a atteint la MAÎTRISE &#9733;1 — continue à jouer pour débloquer des emplacements d'équipement.",
  "gear.noStoredGear": "Aucun équipement stocké. Chaque bataille accorde désormais au moins un butin.",
  "gear.noMatching": "AUCUN ÉQUIPEMENT CORRESPONDANT",
  "gear.nothingToSell": "Rien à vendre.",
  "gear.claimFree": "RÉCUPÉRER ({n} LIBRES)",
  "gear.leaveDrops": "LAISSER",
  "gear.dropsUnclaimed": "{n} BUTIN{s} NON RÉCLAMÉ{s} — RÉSERVE PLEINE",

  // Stash settings sheet
  "stash.settingsTitle": "RÉGLAGES DE RÉSERVE",
  "stash.capacity": "CAPACITÉ DE RÉSERVE",
  "stash.slots": "CASES",
  "stash.addSlots": "+{n} CASES &#9670;{cost}",
  "stash.maxCapacity": "CAPACITÉ MAX ATTEINTE",
  "stash.autoJunk": "AUTO-REBUT",
  "stash.autoJunkDesc": "Revend automatiquement les butins correspondants dès que tu les gagnes (éliminations, fin de partie, jalons Sans Fin) au lieu de remplir la réserve ou un emplacement de tri. Achète une rareté une fois pour la débloquer définitivement ; mets en pause ou reprends à tout moment par rareté.",
  "stash.nothingPurchased": "Rien acheté pour l'instant.",
  "stash.allTiersOwned": "TOUS LES NIVEAUX OBTENUS",
  "stash.paused": "EN PAUSE",
  "stash.pause": "PAUSE",
  "stash.resume": "REPRENDRE",

  // Co-op Phase 1 — ownership + local two-player debug harness
  "coop.debugActing": "JOUEUR ACTIF",
  "coop.debugSwitch": "Touchez pour changer de joueur actif",
  "coop.ownerOnly": "PROPRIÉTAIRE",
  "coop.sellOwnerReason": "Seul le propriétaire peut vendre cette tour.",
  // Co-op Phase 3 — lobby and session browser
  "menu.coop": "CO-OP",
  "coop.playerCap": "{max}J",
  "coop.back": "Retour",
  "coop.title": "CO-OP",
  "coop.browser.subtitle": "SESSIONS SANS FIN EN DIRECT",
  "coop.browser.loading": "RECHERCHE DE SESSIONS EN DIRECT…",
  "coop.browser.empty": "AUCUNE SESSION PUBLIQUE EN DIRECT",
  "coop.browser.unavailable": "NAVIGATEUR DE SESSIONS INDISPONIBLE",
  "coop.browser.host": "HÔTE {name}",
  "coop.browser.hostUnknown": "HÔTE —",
  "coop.browser.wave": "VAGUE {wave}",
  "coop.browser.players": "{players}/{max} JOUEURS",
  "coop.browser.tiles": "{tiles} CASES LIBRES",
  "coop.browser.full": "PLEIN",
  "coop.join": "REJOINDRE",
  "coop.joinCode": "REJOINDRE PAR CODE",
  "coop.hostGame": "CRÉER UNE PARTIE",
  "coop.code.prompt": "ENTRE LE CODE DE SALLE DE L'HÔTE",
  "coop.code.label": "Code de salle",
  "coop.code.invalid": "ENTRE UN CODE DE SALLE COMPLET",
  "coop.code.searching": "RECHERCHE DE LA SESSION…",
  "coop.code.notFound": "SESSION INTROUVABLE OU HORS LIGNE",
  "coop.code.full": "CETTE SESSION EST PLEINE",
  "coop.host.visibility": "QUI PEUT TROUVER CETTE SESSION ?",
  "coop.host.public": "PUBLIQUE",
  "coop.host.publicDesc": "AFFICHÉE DANS LE NAVIGATEUR DE SESSIONS",
  "coop.host.private": "PRIVÉE",
  "coop.host.privateDesc": "ACCESSIBLE UNIQUEMENT AVEC SON CODE",
  "coop.host.level": "CHOISIS UN NIVEAU TERMINÉ",
  "coop.host.endless": "LA CO-OP DÉMARRE TOUJOURS EN SANS FIN",
  "coop.host.endlessShort": "SANS FIN ∞",
  "coop.host.noneCleared": "TERMINE UN NIVEAU DE CAMPAGNE POUR CRÉER UNE CO-OP",
  "coop.connection.failed": "IMPOSSIBLE DE DÉMARRER LA SESSION",
  "coop.connection.retry": "CONNEXION ÉCHOUÉE — RÉESSAIE",
  "coop.private.subtitle": "SESSION PRIVÉE — PARTAGE CE CODE",
  "coop.private.copy": "COPIER LE CODE",
  "coop.private.play": "JOUER",
  "coop.private.copied": "CODE COPIÉ",
  "coop.private.copyFailed": "MAINTIENS LE CODE POUR LE COPIER",
  "coop.private.waiting": "EN ATTENTE D'UN JOUEUR…",
  "coop.cancel": "ANNULER",
  "coop.join.unknownLevel": "CETTE SESSION UTILISE UN NIVEAU INCONNU",
  "coop.join.connecting": "CONNEXION À L'HÔTE…",
  "coop.join.level": "{level} · VAGUE {wave}",
  "coop.leave.title": "QUITTER LA CO-OP ?",
  "coop.leave.subtitle": "La connexion sera fermée et cette bataille prendra fin.",
  "coop.leave.action": "QUITTER LA SESSION",

  "coop.codename.format": "{adjective} {noun}",
  "coop.codename.adjective.0": "ÉCARLATE",
  "coop.codename.adjective.1": "AZUR",
  "coop.codename.adjective.2": "NÉON",
  "coop.codename.adjective.3": "SOLAIRE",
  "coop.codename.adjective.4": "LUNAIRE",
  "coop.codename.adjective.5": "VIOLETTE",
  "coop.codename.adjective.6": "QUANTIQUE",
  "coop.codename.adjective.7": "ÉLECTRIQUE",
  "coop.codename.adjective.8": "GELÉE",
  "coop.codename.adjective.9": "DORÉE",
  "coop.codename.adjective.10": "CORAIL",
  "coop.codename.adjective.11": "FANTÔME",
  "coop.codename.noun.0": "TREILLIS",
  "coop.codename.noun.1": "CASCADE",
  "coop.codename.noun.2": "CIRCUIT",
  "coop.codename.noun.3": "VECTEUR",
  "coop.codename.noun.4": "PRISME",
  "coop.codename.noun.5": "NEXUS",
  "coop.codename.noun.6": "GRILLE",
  "coop.codename.noun.7": "BALISE",
  "coop.codename.noun.8": "RELAIS",
  "coop.codename.noun.9": "MATRICE",
  "coop.codename.noun.10": "ORBITE",
  "coop.codename.noun.11": "SIGNAL",
};
