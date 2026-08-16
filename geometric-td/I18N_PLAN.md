# French Localization (i18n) — Plan & Living Tracker

Goal: let the player's dad play in **French**, while the default experience
stays **English** for everyone else, switchable via a discreet toggle.
Approved 2026-08-16. Scope: **everything** (UI, gameplay data, tutorial,
onboarding, and the full campaign narrative), delivered in phases.

This file is the **source of truth** for the delegated phases — each agent
should cold-read it and translate exactly one phase's surface.

---

## Architecture (built in Phase 0 — do not change)

- **English is the source of truth.** Every UI string stays inline in the
  code/markup as the fallback. French lives in ONE catalog,
  `src/lang/fr.js`, keyed by dot-namespaced ids.
- **`src/i18n.js`** is the engine. Public API:
  - `t(key, en)` — returns the French for `key` when the active language is
    French and the key exists; otherwise returns `en` (the inline English).
    **Always pass the English as the second arg** so a missing key can never
    render blank.
  - `tf(key, en, {a,b})` — same, then fills `{a}`/`{b}` placeholders
    (order-independent, so French may reorder tokens).
  - `applyStaticI18n(root?)` — swaps `textContent`/attributes on static
    `[data-i18n]` / `[data-i18n-attr]` markup in `index.html`. The authored
    English is cached (`data-i18n-en`) as the fallback.
  - `onLangChange(fn)` — subscribe; used to re-render generated UI on toggle.
  - `getLang()` / `setActiveLang(lang)` — engine-level current language.
- **Persistence:** a `lang` save field (`save.js` default `"en"` +
  `progression.js` backfill). `progression.js` exposes `getLang()` /
  `setLang(lang)`; `setLang` persists and calls `setActiveLang`, which
  re-applies static markup and fires `onLangChange`. The engine is seeded at
  load from the save.
- **CSS hook:** `setActiveLang` sets `<html data-lang="fr">`. Use
  `html[data-lang="fr"] …` selectors for French-only layout tweaks (e.g.
  tightening a button a longer French label would overflow). English layout
  is never touched.

### Two ways to translate, by surface
1. **Static markup** in `index.html` → add `data-i18n="key"` (text) or
   `data-i18n-attr="placeholder:key"` (attributes). Add the French to
   `fr.js`. No JS change needed; `applyStaticI18n` handles it on load/toggle.
2. **Generated strings** (built in JS at render time) → wrap the literal in
   `t('key', 'ENGLISH')`. If the surrounding view is generated once and
   cached, make sure it re-renders on `onLangChange` (the home menu already
   does via `renderWorld`).

---

## Translation rules (apply to every phase)

- **Do NOT translate proper nouns:** tower names (**Laser, Pulse, Slow,
  Railgun, Rocket**), characters (**Indy-7, Bratwurst-XL**), and the title
  **"GEOMETRIC TD"**. Tower *descriptions* ARE translated.
- **Enemy names ARE translated** (descriptive words: Basic→Basique,
  Fast→Rapide, Armored→Blindé, Splitter→Diviseur,
  Regenerator→Régénérateur, Splitling→Éclat, Boss→Boss/keep).
- **Length:** French runs ~15–25% longer. For space-constrained buttons,
  pick a SHORTER natural French word over a literal translation
  (e.g. "Next Wave" → `VAGUE ▶`, not "Vague suivante"). If it still
  overflows, add a `html[data-lang="fr"]` CSS rule — don't distort English.
- **Preserve markup & tokens:** `{name}` and other `{placeholders}`,
  `[hl-pink]/[hl-blue]/[hl-indy]/[hl-villain]/[hl-weak]/[hl-resist]` inline
  tags, `\n` line breaks, and leading `>` boot-log markers must survive.
- **Voice:** the narrative is Indy-7's snarky/warm voice (see
  `NARRATIVE_DESIGN.md`). Match register in French; it will get a
  native-speaker (the dad) proofread, so aim for natural, not literal.
- **Never** change English source text, game logic, or balance data.
- Add each phase's keys under its section header in `fr.js`. Don't
  re-translate keys an earlier phase already provided.

---

## Verification (each phase)

The player tests only on an iPhone after a push, so each delegated phase
must leave the game **runnable** and report honestly what was and wasn't
verified. The orchestrator (Claude/Opus) runs the browser preview
(`serve.ps1` via `.claude/launch.json`, 375px viewport, `data-lang=fr`),
checks the console is clean and nothing clips, then does the single
`version.js` bump + commit + push. **Agents must not bump version, commit,
or push.**

---

## Phases

### Phase 0 — i18n core + toggle  ✅ DONE & verified (2026-08-16)
Engine, save field + backfill, `getLang/setLang`, the home-screen `EN|FR`
pill (`#lang-toggle` in `index.html` + styles), the menu `LANGUE` entry, and
the `onLangChange`→`renderWorld` re-render. **Proof slice already
translated** (do NOT redo in later phases): `menu.*` keys —
skills/towers/store/board/replayIntro/banter/language/reset/resetConfirm/
welcomeBack.

### Phase A — static chrome + core UI  ✅ DONE & verified (2026-08-16, build 2026.08.16-2)
Static `index.html` labels (HUD, overlay headers, CLOSE/SAVE/PUBLISH, tabs,
speed-control titles, nickname placeholder) via `data-i18n`; `ui.js` generated
chrome (wave button `VAGUE ▶`, SELL, upgrade panel, two-tap confirms, gear/
store/skill sheet button verbs, world-locked note) via `t()`/`tf()`. Keys
under the `hud.*/ui.*/gear.*/store.*/lb.*/skill.*` sections of `fr.js`.
Verified at 375px: no clipping on any menu-reachable overlay (skill tree,
store, leaderboard, gear sheets) or the wave/upgrade buttons; no console
errors. Also **removed the home-screen `#lang-toggle` pill** (user: redundant
with the pinned menu LANGUE button) — markup/CSS/JS binding gone, menu toggle
+ `onLangChange` re-render kept.
- **Deferred to a later sweep (agent flagged, intentionally out of Phase A):**
  level-select board/sheet chrome (CLEARED/LOCKED/ENDLESS/PLAY/STORY/
  CHALLENGES/MILESTONES), item rarity/slot labels (OPTIC/COMMON/… → Phase E),
  leaderboard status messages (→ Phase E), and descriptive sheet copy ("PICK A
  TOWER", "REPLACE EQUIPPED GEAR", "COMPATIBLE IN STASH", etc.). These render
  English amid French for now.
- **Unverified (needs a live battle / on-device):** the in-battle upgrade XP
  status line (`up-xp`, e.g. "PROCHAINE ★ DANS 340 XP") — a text line, not a
  button; couldn't measure its flex layout headlessly.

`index.html` static labels + `src/ui.js` generated strings that are NOT
covered by later phases. HUD (CREDITS/WAVE/CORE/SKILLS), speed-control
titles, overlay headers (TOWERS/STASH/STORE/LEADERBOARD/SKILL TREE), all
CLOSE/SAVE/PUBLISH buttons, tab labels, wave button (`VAGUE ▶`), SELL,
upgrade panel, two-tap confirm states ("TAP AGAIN"), world-locked note,
gear/store/skill sheet chrome, nickname placeholder. Keys namespaced
`hud.*`, `ui.*`, `gear.*`, `store.*`, `lb.*`, `skill.*` (chrome only — skill
*names/descriptions* are Phase B).

### Phase B — gameplay data  ✅ DONE & verified (2026-08-16, build 2026.08.16-3)
Level names (20) + world names (4) via three `ui.js` display-name helpers
(`worldNameFor`/`levelNameFor`/`enemyNameFor`, keyed off each object's
injected `id`), wired into every render site (world header, per-node lock
reason, the `ui.worldLocked` `tf` params, level-sheet header/tag, leaderboard
section headers, guide-sheet enemy cheat-sheet, `describeWormhole`). Enemy
names (7). Skill tree names + descriptions (~196 nodes) keyed per node id and
translated at RENDER time in `ui.js` (NOT in `buildSkillGraph`, which runs once
at import — a deliberate landmine) — skill sheet title/desc, branch-head labels
(ÉCO/JEU; tower heads keep their English proper noun), lock note. Tower flavor:
`tower.<id>.role`/`.specialtyDesc` (guide sheet) + `.specialtyPerk` (gear
sheet) — the real player-facing tower-description strings; `TOWER_PRESENTATION`
has no `desc` field, so the planned `tower.<id>.desc` key doesn't exist. 242 FR
keys added under the Phase B header. Verified at 375px `data-lang=fr`: clean
console (EN + FR), no world-name overflow, French rendering confirmed on the
menu/level-sheet/skill-tree/skill-sheet/guide-sheet.
- **Left English on purpose (later phases / not name-or-desc):** level DESC
  paragraphs (user scoped Phase B to *names*); level-sheet board chrome
  (LEVEL/NOT CLEARED/CHALLENGES — already Phase A-deferred to E); skill-sheet
  hardcoded chrome words ("BRANCH", "next:", "MAXED", "Level cap → N"); the
  Meet-the-Squad tower-intro "Best against:" line (`towerIntroStatLine`) and
  `NARRATIVE.enemyIntro` — both **Phase D**; enemy weak/resist `counterText`
  prose (chrome, not a name).

### Phase C — tutorial + onboarding intro  ✅ DONE & verified (2026-08-16, build 2026.08.16-4)
`TUTORIAL.steps[*].text/cta` (7 steps) and `NARRATIVE.intro[*].text/cta`
(5 cards) + `namePlaceholder`, wrapped at their render sites in `ui.js`
(`renderTutorialStep` ~3163, `renderOnboardingCard` ~3585) keyed
`tutorial.<stepId>.*` / `intro.<cardId>.*`. Keying strictly on `card.id`
scopes the shared card renderer to the 5 intro cards — Phase D cards (squad/
towerIntros/beats/enemyIntros) have no `id`, so they fall back to English.
The `nameSkipLabel` in config is **dead** (unconsumed); the real skip
fallback is the hardcoded `"Operator"` in `progression.js getPlayerName()`,
which now returns `t('intro.nameSkipLabel', 'Operator')` → "Opérateur" and
flows through `{name}` everywhere. The no-`cta` tutorial steps use a ternary
(not `t(key, step.cta) || …`) because `t(key, undefined)` returns the key
string, not the fallback. Verified at 375px `data-lang=fr`: intro welcome
(`> ` marker + `human_handler_004` preserved), name card placeholder "Nom de
l'opérateur", villain card `{name}`→"Opérateur", tutorial welcome step + CTA
"COMMENCER"; clean console; CTAs kept short (CONTINUER ▶ / VALIDER /
COMMENCER / ALLONS-Y), no clipping.

### Phase D — campaign narrative  ⬜ TODO (largest)
`config.js NARRATIVE.beats` (per-level start/win + world-end exchanges),
in-battle barks, boss banter, `NARRATIVE.enemyIntro`, "Meet the Squad", and
the tower-intro recruit cards. Preserve every `[hl-*]` tag, `{name}`, and
`\n`. ~23k chars — the big one.

### Phase E — results / loot / misc  ⬜ TODO
`RESULT_ROASTS`, results-screen copy, loot rarity/labels
(`src/loot.js`/`ui.js`), leaderboard messages (`src/leaderboard.js`),
feedback prompts (`src/feedback.js`), update nudge (`src/update.js`),
milestone toasts (`src/milestones.js`).

---

## Push cadence
Push 0: Phase 0 (foundation + toggle) — lets the dad sanity-check the toggle
and button fit on-device. Then push after each subsequent phase (or a small
batch), version-bumped, after browser verification.
