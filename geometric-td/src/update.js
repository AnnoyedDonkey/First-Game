// ============================================================
// UPDATE CHECK — nudges the player to reload when a newer build is live.
//
// Why this exists: added to an iPhone home screen, the game launches in
// standalone mode with no address bar / reload button, and re-tapping a
// backgrounded icon RESUMES the old session instead of reloading. There
// is no build step (so no hashed filenames to bust caches) and no
// service worker. This module bridges that gap with zero dependencies:
// it re-fetches version.js fresh and, if the deployed APP_VERSION no
// longer matches the one baked into the running code, shows a
// tap-to-reload banner.
//
// Checks run on launch and every time the page becomes visible again —
// which is exactly the moment a home-screen app is re-opened.
// ============================================================

import { APP_VERSION } from "./version.js";

// CSS cache-buster (stopgap until the PWA service worker lands). GitHub Pages
// serves styles.css with `max-age=600` and no filename hash, so a CSS-only
// change plus a version bump can leave a plain browser refresh on the OLD
// stylesheet while the JS updated — the fix silently doesn't apply. (The in-app
// TAP TO RELOAD busts it, but a manual Safari refresh may not.) Stamping the
// build onto the href makes the URL change every deploy, so the browser can't
// serve a stale cached copy. Runs on import (before the app boots). The static
// `<link>` in index.html still paints first, so there is no unstyled flash; the
// browser keeps the current stylesheet applied until the versioned one loads,
// and on same-version loads that versioned copy is already cached (no reflow).
(function stampStylesheetVersion() {
  try {
    for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
      const href = link.getAttribute("href");
      // Only same-origin project CSS, and never double-stamp.
      if (!href || /^(https?:)?\/\//.test(href) || href.includes("?")) continue;
      link.setAttribute("href", `${href}?v=${APP_VERSION}`);
    }
  } catch {
    // Best-effort: a missing DOM or blocked attribute change must never stop boot.
  }
})();

let banner = null;
let lastCheck = 0;
const MIN_INTERVAL = 20000; // don't re-check more than once per 20s

export function initUpdateCheck() {
  // Discreet build stamp on the menu so the current version is always
  // confirmable at a glance (esp. after a home-screen reload).
  const tag = document.getElementById("version-tag");
  if (tag) tag.textContent = "v" + APP_VERSION;

  banner = document.getElementById("update-banner");
  if (!banner) return;

  banner.addEventListener("click", (e) => {
    // The ✕ just dismisses until the next check; anywhere else reloads.
    if (e.target.closest(".update-dismiss")) {
      banner.classList.add("hidden");
      return;
    }
    hardReload();
  });

  // Re-tapping a backgrounded home-screen icon fires visibilitychange
  // (not a reload), so this is the key hook for standalone mode.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });

  check();
}

// A plain location.reload() is NOT enough on GitHub Pages: it serves every
// module with `Cache-Control: max-age=600` and no revalidation, so for ~10
// minutes after a deploy a normal reload re-runs the CACHED modules — the
// running APP_VERSION never changes and the banner reappears forever (seen in
// Firefox; Safari happens to revalidate). Before reloading, we re-fetch each
// already-loaded same-origin asset with `cache: "reload"`, which forces the
// network AND overwrites the HTTP cache entry, so the reload below then boots
// from fresh copies. The Performance API gives us the exact module list, so no
// manifest to maintain. A service worker (PWA plan) would make this obsolete.
async function hardReload() {
  try {
    const urls = new Set();
    for (const entry of performance.getEntriesByType("resource")) {
      const url = entry.name;
      if (url.startsWith(location.origin) && /\.(js|css|json)(\?|$)/.test(url)) {
        urls.add(url);
      }
    }
    urls.add(location.href.split("#")[0]); // the document itself
    await Promise.all(
      [...urls].map((url) => fetch(url, { cache: "reload" }).catch(() => {}))
    );
  } catch {
    // Best-effort: if the refresh fails (offline, blocked), still reload —
    // a normal reload is no worse than the stuck banner.
  }
  location.reload();
}

async function check() {
  const now = Date.now();
  if (now - lastCheck < MIN_INTERVAL) return;
  lastCheck = now;

  try {
    // no-store + a cache-busting query so we always see the live file,
    // never Safari's or the CDN's cached copy.
    const res = await fetch(`./src/version.js?t=${now}`, { cache: "no-store" });
    if (!res.ok) return;
    const text = await res.text();
    const m = text.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
    if (m && m[1] !== APP_VERSION && banner) {
      banner.classList.remove("hidden");
    }
  } catch (err) {
    // Offline or fetch blocked — silently ignore; never disrupt play.
  }
}
