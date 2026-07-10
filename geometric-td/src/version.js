// ============================================================
// VERSION — the app's build stamp, and the ONLY thing to bump when
// you deploy an update the player should be nudged to reload.
//
// How the update nudge works (see update.js): the value below is baked
// into the JS the player currently has loaded (and cached). On launch
// — and whenever a backgrounded home-screen app is re-opened — the app
// re-fetches THIS FILE with `cache: "no-store"` and compares the fresh
// value to the baked one. If they differ, a newer version is live and a
// "TAP TO RELOAD" banner appears. So: bump this string every deploy you
// want players to pick up. Any changing string works; the date + a
// same-day counter keeps it readable.
// ============================================================

export const APP_VERSION = "2026.07.10-3";
