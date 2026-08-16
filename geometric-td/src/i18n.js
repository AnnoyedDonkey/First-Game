// ============================================================
// I18N — lightweight localization engine (no build step, no deps).
//
// English is the SOURCE OF TRUTH: every UI string stays inline in the
// code/markup as the fallback, and French lives in one catalog
// (src/lang/fr.js) keyed by dot-namespaced ids. A missing French key
// silently falls back to English, so nothing can break by being left
// untranslated — partial translation is always safe.
//
//   t('hud.credits', 'CREDITS')   ->  'CRÉDITS' in FR, 'CREDITS' in EN
//
// The active language is chosen by the player (a discreet EN|FR toggle
// on the home screen + a menu entry), persisted in the save (`lang`
// field — see save.js and progression.js getLang/setLang), and defaults
// to English so the vast majority of players are unaffected.
//
// Design notes:
// - This module imports NOTHING from the app (only the fr catalog), so
//   it can be imported anywhere without circular-dependency risk.
// - progression.js seeds the active language at load and re-points it on
//   toggle; consumers just call t() at RENDER time so the current
//   language is always reflected.
// ============================================================

import { FR } from "./lang/fr.js";

const CATALOGS = { fr: FR };
export const LANGS = ["en", "fr"];

let active = "en";
const listeners = new Set();

export function getLang() {
  return active;
}

// Point the engine at a language. Sets <html lang>/<html data-lang> (the
// latter is a CSS hook for French-only layout tweaks — e.g. tightening a
// button that a longer French label would overflow), re-applies static
// [data-i18n] markup, and notifies subscribers so generated UI can
// re-render.
export function setActiveLang(lang) {
  active = LANGS.includes(lang) ? lang : "en";
  const root = document.documentElement;
  if (root) {
    root.setAttribute("lang", active);
    root.setAttribute("data-lang", active);
  }
  applyStaticI18n();
  listeners.forEach((fn) => {
    try { fn(active); } catch (err) { console.warn("i18n listener failed:", err); }
  });
}

// Translate a keyed string. `en` is the English source/fallback and is
// returned verbatim when the language is English or the key is missing
// from the active catalog. Callers keep the English inline, so the code
// stays readable and can never render an empty string.
export function t(key, en) {
  if (active === "en") return en ?? key;
  const cat = CATALOGS[active];
  const hit = cat && cat[key];
  return (hit == null) ? (en ?? key) : hit;
}

// Fill {placeholders} in a translated string. Order-independent, so a
// French rendering can reposition tokens relative to the English.
//   tf('menu.worldLocked', 'clear {prev} to unlock {world}', {prev, world})
export function tf(key, en, params) {
  let s = t(key, en);
  if (params) {
    for (const k in params) s = s.split("{" + k + "}").join(params[k]);
  }
  return s;
}

// Subscribe to language changes. Returns an unsubscribe fn. Used by UI
// that must rebuild generated content (menus, lists) on toggle.
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Swap textContent / attributes on static [data-i18n] markup in index.html.
// The element's AUTHORED English is captured once (data-i18n-en) as the
// fallback, so toggling back to English restores it exactly.
//   <span data-i18n="hud.credits">CREDITS</span>
//   <input data-i18n-attr="placeholder:lb.nickname" ...>
export function applyStaticI18n(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll("[data-i18n]").forEach((elm) => {
    const key = elm.getAttribute("data-i18n");
    if (elm.dataset.i18nEn == null) elm.dataset.i18nEn = elm.textContent;
    elm.textContent = t(key, elm.dataset.i18nEn);
  });
  root.querySelectorAll("[data-i18n-attr]").forEach((elm) => {
    elm.getAttribute("data-i18n-attr").split(",").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s && s.trim());
      if (!attr || !key) return;
      const cacheKey = "i18nAttr_" + attr;
      if (elm.dataset[cacheKey] == null) elm.dataset[cacheKey] = elm.getAttribute(attr) || "";
      elm.setAttribute(attr, t(key, elm.dataset[cacheKey]));
    });
  });
}
