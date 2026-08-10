# Avatars — character faces on the story cards + world-end beats (build spec)

Add animated character avatars (Indy-7 = green hexagon, Bratwurst-XL = twin
yellow squares, with line-stroke eyes that change by mood) to the narrative
cards and the results-screen world-end exchanges, and **unify the speaker name
color to green (Indy) / yellow (Bratwurst)**. Approved mockup: layout is the
avatar INLINE with the speaker name; shapes animate (spin) with the eyes held
static as the face. Builds on shipped P1-P4.

Cardinal rules: plain vanilla JS ES modules, no deps, no build step; keep the
game runnable; never wipe saves (no new save fields here). **Do NOT bump
`src/version.js`, and do NOT commit or push** — the orchestrator does that after
review.

---

## 1. Unify speaker colors to green/yellow — `styles.css`

Add two tokens to `:root` (the game's core/portal colors):
```css
--indy-color: #4affa1;   /* Indy-7 = the core's green */
--brat-color: #ffe24a;   /* Bratwurst-XL = the portal's yellow */
```
Then change ONLY these 5 speaker rule-pairs from cyan/red to the new tokens
(and green/yellow glows). Do NOT touch any other `--neon-cyan`/`--neon-red`
usage (HUD, buttons, gear, etc. stay as they are):
- `.bark-name.hl-indy` / `.bark-name.hl-villain` (~line 299-300)
- `#story-speaker.hl-indy` / `#story-speaker.hl-villain` (~500-501)
- `#story-card-text .hl-indy` / `#story-card-text .hl-villain` (~502-503)
- `.overlay-narrative-speaker.hl-indy` / `.hl-villain` (~2437-2438)
- `.overlay-narrative-text .hl-indy` / `.hl-villain` (~2445-2446)

For each: `hl-indy` → `color: var(--indy-color)` with
`text-shadow: 0 0 8px rgba(74,255,161,.5)`; `hl-villain` →
`color: var(--brat-color)` with `text-shadow: 0 0 8px rgba(255,226,74,.5)`
(use the lighter .4 alpha where the original used .4). Net effect: names go
green/yellow everywhere (cards, bark ticker, overlay beats) in one place.

## 2. Avatar generator — `src/ui.js`

Add this (ported from the approved study; returns an inline SVG string,
animated via SMIL, eyes static, reduced-motion aware). Colors reference the
tokens from §1.

```js
// A speaker avatar built from the game's own track shapes: Indy-7 the green
// hexagon core, Bratwurst-XL the twin yellow spawn squares. Eyes are line
// strokes that change with `mood`; the shapes slowly spin (held still under
// reduced-motion) while the eyes stay upright as the face. Returns "" for any
// non-character speaker.
function avatarEye(cx, cy, r, mood, side) {
  switch (mood) {
    case "happy":   return `<path d="M ${cx-r} ${cy+r*.55} L ${cx} ${cy-r*.7} L ${cx+r} ${cy+r*.55}"/>`;
    case "smile":   return `<path d="M ${cx-r} ${cy-r*.2} Q ${cx} ${cy+r} ${cx+r} ${cy-r*.2}"/>`;
    case "worried": return `<path d="M ${cx-r} ${cy+r*.3} Q ${cx} ${cy-r*.7} ${cx+r} ${cy+r*.3}"/>`;
    case "smug":    return `<line x1="${cx-r}" y1="${cy-r*.1}" x2="${cx+r}" y2="${cy-r*.1}"/>`;
    case "angry": { const inX = side==="l"?cx+r:cx-r, outX = side==="l"?cx-r:cx+r;
                    return `<line x1="${outX}" y1="${cy-r*.6}" x2="${inX}" y2="${cy+r*.4}"/>`; }
    case "crash":   return `<path d="M ${cx-r} ${cy-r} L ${cx+r} ${cy+r} M ${cx+r} ${cy-r} L ${cx-r} ${cy+r}"/>`;
    default:        return `<line x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${cy+r}"/>`; // neutral
  }
}
function speakerAvatarSvg(code, mood) {
  if (code !== "indy" && code !== "bratwurst") return "";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const color = code === "indy" ? "var(--indy-color)" : "var(--brat-color)";
  const eyeCol = code === "indy" ? "#eafff5" : "#fff7d1";
  const m = mood || (code === "indy" ? "neutral" : "smug");
  const spin = (child, dur, dir) => reduce ? child :
    `<g>${child}<animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 50 50" to="${360*dir} 50 50" dur="${dur}" repeatCount="indefinite"/></g>`;
  let shape, ey;
  if (code === "indy") {
    const pts = Array.from({length:6}, (_,i) => { const a = Math.PI/180*(60*i-90);
      return `${(50+30*Math.cos(a)).toFixed(1)},${(50+30*Math.sin(a)).toFixed(1)}`; }).join(" ");
    shape = spin(`<polygon points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`, "16s", 1);
    ey = 44;
  } else {
    const rect = (rot) => `<rect x="24" y="24" width="52" height="52" rx="2" fill="none" stroke="${color}" stroke-width="2.6" transform="rotate(${rot} 50 50)"/>`;
    shape = spin(rect(-14), "9s", 1) + spin(rect(14), "9s", -1);
    ey = 47;
  }
  const eyes = `<g fill="none" stroke="${eyeCol}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">`
    + avatarEye(41, ey, 6, m, "l") + avatarEye(59, ey, 6, m, "r") + `</g>`;
  return `<svg viewBox="0 0 100 100" class="spk-avatar" aria-hidden="true">`
    + `<g filter="drop-shadow(0 0 3px ${color})">${shape}${eyes}</g></svg>`;
}
```
(If `filter="drop-shadow(...)"` as an SVG attribute is unreliable, move the glow
to CSS: `.spk-avatar{filter:drop-shadow(0 0 3px currentColor)}` won't know the
color — instead set it inline per-svg or drop the glow. Prefer a CSS rule
`.spk-avatar path,.spk-avatar polygon,.spk-avatar rect,.spk-avatar line{}` only
if needed. A glow is nice-to-have; correctness of shape/eyes/color is the bar.)

## 3. Cards — inline avatar beside the nameplate (`index.html` + `ui.js` + `styles.css`)

- `index.html`: replace `<div id="story-speaker"></div>` inside `#story-card`
  with a row:
  ```html
  <div id="story-speaker-row">
    <span id="story-avatar"></span>
    <div id="story-speaker"></div>
  </div>
  ```
- `styles.css`:
  ```css
  #story-speaker-row{display:flex; align-items:center; gap:10px}
  #story-avatar{flex:none; width:38px; height:38px}
  #story-avatar:empty{display:none}
  #story-avatar svg{width:38px; height:38px; display:block}
  ```
- `ui.js renderOnboardingCard`: cache `el.storyAvatar`; when rendering a card,
  set `el.storyAvatar.innerHTML = speakerAvatarSvg(card.speaker || "indy", card.mood)`.
  (Intro/START/squad/replay cards all flow through here; `card.speaker` is
  already used for the nameplate class + label.)

## 4. World-end beats — avatar beside each speaker line (`ui.js showOverlay` + `styles.css`)

In `showOverlay`'s narrative render, prefix each line's speaker nameplate with
its avatar. Change the per-line markup to:
```js
`<div class="overlay-narrative-line">` +
  `<div class="overlay-narrative-head">` +
    `<span class="ov-avatar">${speakerAvatarSvg(line.s, line.m)}</span>` +
    `<div class="overlay-narrative-speaker ${cls}">${escapeHtml(label)}</div>` +
  `</div>` +
  `<p class="overlay-narrative-text">${storyCardHtml(line.t)}</p>` +
`</div>`
```
`styles.css`: `.overlay-narrative-head{display:flex; align-items:center; gap:8px}
.ov-avatar{flex:none; width:30px; height:30px} .ov-avatar svg{width:30px;height:30px;display:block}`.
(`line.m` is the optional per-line mood from §5.)

**Bark ticker: NO avatar** (a one-line ticker; the tinted name prefix already
identifies the speaker). Leave `showBark` as-is.

## 5. Moods — `src/config.js` `NARRATIVE`

Render already defaults by speaker (indy→neutral, bratwurst→smug via the `m`
fallback in `speakerAvatarSvg`). Add explicit moods ONLY for these hero
moments (leave everything else to default — moods can be expanded later):

- `intro`: `welcome` → `mood:"happy"`; `handoff` → `mood:"happy"`.
- `squad` (all 5 Indy cards): `mood:"happy"` (upbeat introductions).
- `beats` win-lines — add an `m` field on the specified line:
  - `level_005.win[0]` (Indy "don't tell anyone I said thank you") → `m:"smile"`.
  - `level_010.win[0]` (Indy "why do I have a memory of humans") → `m:"worried"`.
  - `level_014.win[1]` (Bratwurst "Deleted. You're welcome.") → `m:"angry"`.
  - `level_015.win` — Bratwurst lines → `m:"angry"`; Indy "you're *me*, aren't you" → `m:"worried"`.
  - `level_018.win[0]` (Indy the reveal, "You came *back*.") → `m:"smile"`.
  - `level_020.win`: Bratwurst "does not comput—" → `m:"crash"`; Bratwurst earlier lines → `m:"angry"`; Indy "consider yourself hugged" → `m:"smile"`; other Indy seed lines → `m:"happy"`.
- START beats (`beats.*.start`, all Indy) — optional `mood`; add
  `mood:"worried"` to `level_007`/`level_008`/`level_009`/`level_013` starts
  (the memory-loss arc); leave the rest default (neutral).

The card render reads `card.mood`; the overlay render reads `line.m`. Both fall
back to the speaker default when absent.

## 6. Verification (DOM/state only — NO canvas capture)

Preview via the `td` launch config (headless pane — no live frames, viewport
may be 0x0; use `javascript_tool` + `read_console_messages`, reload before
isolated checks).

- **Console clean / module loaded** (`typeof ui.showBark`/`playCards` are
  functions; a syntax/duplicate-identifier error silently breaks ui.js).
- **Color unification:** compute the color of a `#story-speaker.hl-indy` and a
  `.overlay-narrative-speaker.hl-villain` (drive a card / call showOverlay with
  a narrative array) → Indy `rgb(74,255,161)`, Bratwurst `rgb(255,226,74)`.
  Confirm an unrelated cyan element (e.g. `#hud-wave .hud-value`) is UNCHANGED.
- **Card avatar:** start onboarding (fresh save) → `#story-avatar svg` exists,
  contains a `<polygon>` (hexagon) for Indy, stroke resolves to the green
  token; the eyes group has the expected mood path (welcome card = happy →
  a `<path>` caret, not the neutral `<line>`).
- **Bratwurst avatar + mood:** call `showOverlay` with
  `narrative:[{s:"bratwurst",t:"...",m:"crash"}]` → `.ov-avatar svg` has two
  `<rect>`s (stroke = yellow token) and the eyes are the crash `<path>` (two
  crossing strokes).
- **Reduced-motion:** with emulated reduce, the avatar SVG contains NO
  `<animateTransform>`; without it, it does.
- **No regression:** cards/beats still render text + CTA; bark ticker unchanged
  (no avatar); no console errors.

Report: files changed + what each adds; what you verified + results (incl.
console-clean, the green/yellow computed colors, the hexagon/rect + mood-eye
presence, reduced-motion); anything unverified/deviations; confirm version.js
unbumped and nothing committed/pushed. Do not claim unrun verifications.
