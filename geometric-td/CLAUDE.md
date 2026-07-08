# Geometric TD

Read `HANDOFF.md` before making changes — it has the architecture, the
mechanics that aren't obvious from code, the balance-testing recipe, and
the user's preferences. `GAME_BRIEF.md` has the original spec and history.

Cardinal rules:
- Plain HTML5/Canvas/vanilla JS ES modules. No frameworks, no build step,
  no dependencies, no TypeScript.
- All gameplay numbers live in `src/config.js` and `src/levels.js` — never
  hardcode a tunable in logic.
- Keep the game runnable after every change; verify in a browser (helpers:
  `window.game`, `window.step(seconds)`), then commit and push — pushing
  main deploys to GitHub Pages where the user plays on iPhone.
- Never break or wipe existing localStorage saves; migrate formats instead
  (key: `geometric-td-save-v1`, pattern in `progression.js migrateSkills`).
- Propose a plan before large features; build in small runnable increments.
