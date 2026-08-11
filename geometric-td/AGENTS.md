# Geometric TD — agent instructions

Instructions for any coding agent working in this repo (Codex and friends).
Claude Code reads `CLAUDE.md`, which carries the same cardinal rules — if you
change one, change both.

## Read these first, in this order

1. `HANDOFF.md` — current state, architecture, the mechanics that aren't
   obvious from the code, tuning locations, the testing recipe, and the
   owner's preferences. **Always read this before making any change.**
2. `CLAUDE.md` — the cardinal rules (same ones restated below).
3. Any plan/design doc named by your task or listed in HANDOFF's "Related
   documents" (e.g. `TOWER_INTRO_CARDS_PLAN.md`, `NARRATIVE_DESIGN.md`,
   `WORLD_4_PLAN.md`, `BALANCE_LAB_USAGE.md`).

`GAME_BRIEF.md` is the original spec — only read it if the task actually needs
the history; it's long.

## Where the code lives

- Canonical checkout: **`C:\Projects\First-Game`**; the game is in the
  **`geometric-td\`** subfolder. Repo root is one level above.
- **Never read or write the retired iCloud copy** at
  `C:\Users\fthia\iCloudDrive\AI\Projects\First game`. It has corrupted `.git`
  internals before. If your working directory is anywhere under `iCloudDrive`,
  STOP and say so instead of proceeding.

## Cardinal rules

- **Plain HTML5 / Canvas 2D / vanilla JS ES modules.** No frameworks, no build
  step, no dependencies, no TypeScript. Target iPhone Safari in portrait,
  touch-first; mouse must also work.
- **No hardcoded tunables.** Every gameplay number lives in `src/config.js` and
  `src/levels.js`; every *presentation* knob for a feature gets its own config
  block (see `NARRATIVE.enemyIntro` for the pattern). If you find yourself
  typing a magic number into logic or UI code, it belongs in config.
- **Balance data is a dual file.** `src/balance-data.json` is canonical;
  `src/balance-data.js` is its generated synchronous re-export and is what the
  game actually imports. Edit both in lockstep or the change won't load.
  `src/balance-schema.js` is the authoritative validator. Don't touch any of
  these for a presentation-only task.
- **Never break or wipe localStorage saves.** Key: `geometric-td-save-v1`.
  Migrate formats instead (pattern: `progression.js migrateSkills`). A new save
  field needs BOTH a default in `save.js` AND a post-`loadSave()` backfill in
  `progression.js` — CDN edges can serve mixed module versions after a deploy,
  so defaults alone are not enough.
- **Keep the game runnable after every change.** Build in small, verifiable
  increments. Propose a plan before a large feature.

## Running and verifying

- Local server: `./serve.ps1`, then `http://localhost:8420`. ES modules do not
  work from `file://`.
- Debug helpers in the browser console: `window.game`, `window.step(seconds)`,
  `checkEndState()`.
- Reload the page before **every** isolated balance simulation or threshold
  search — module globals and battle-end recording contaminate later runs.
- **Do not capture or export the game canvas for verification.** Assert on game
  state, DOM, logic-level facts, and console cleanliness. The owner reviews
  visuals on a real iPhone; a screenshot from here proves nothing about that.
- Report verification honestly, including what you did NOT check. A simulated
  loss is strong evidence; a simulated win is weak.
- Never wipe the real save while testing. Back it up and restore it
  byte-for-byte if you need a seeded profile.

## Do not do these unless explicitly asked

- Don't bump `src/version.js` — a shipped feature gets ONE bump, at the end,
  by whoever ships it.
- Don't `git commit` and don't `git push`. Pushing `main` deploys to GitHub
  Pages, where the owner plays on iPhone. Leave the working tree for review.
- Don't let Balance Lab tooling auto-commit, auto-push, or rewrite source text.
- Don't refactor beyond your task's scope.

## Rendering and UI guardrails

- Use the pre-rendered glow sprites and the additive `lighter` pass. **Never**
  add per-particle `shadowBlur` — it wrecks mobile Safari performance.
- Perf ceiling: ~300–400 concurrent enemies is the playable mobile target.
  Raising enemy HP is free; raising enemy *count* is not.
- Respect `prefers-reduced-motion`; no perpetual expensive SVG filters.
- New nested flex rows in the bottom action bar need `min-width: 0`, or the
  wave button gets pushed off-screen.
- Per-level palettes override renderer look values; enemy and tower colors are
  deliberately stable across levels.

## Code style

Match the surrounding code — its comment density, naming, and idiom. This
codebase comments the *why* and the non-obvious mechanics, not the syntax.
Keep that.
