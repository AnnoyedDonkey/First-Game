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
    location.reload();
  });

  // Re-tapping a backgrounded home-screen icon fires visibilitychange
  // (not a reload), so this is the key hook for standalone mode.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });

  check();
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
