// ============================================================
// ROGUELIKE UI — Phase C: the player-facing screens for the DEBUG-gated run
// mode. Drives roguelike.js's exported API ONLY (startRun/endRun/chooseNode
// + the staged non-combat resolvers documented above chooseNode in
// roguelike.js) — no run-state logic lives here. See ROGUELIKE_PLAN.md §5c
// for the resolver contract this file is built against.
//
// Shell: one full-screen `#rogue-overlay` (index.html) with a fixed HUD strip
// (`#rogue-hud`: Core Integrity bar, Salvage, floor progress) above a
// scrollable `#rogue-body` that this module repaints per screen (node map,
// gear reward, shop, event, a generic outcome banner for recovery/event
// results, and the run-end victory/defeat screen). Content is built via
// innerHTML + delegated listeners, matching the mod-lab-form / gear-overlay
// pattern already used elsewhere in this codebase — no framework.
//
// Battle chrome: combat/elite/farm/boss nodes hide this overlay and reveal
// the NORMAL in-battle #hud/#action-bar (unchanged campaign HUD) before
// calling roguelike.chooseNode(), which synchronously invokes main.js's
// injected launcher. onRunBattleEnd() (called from main.js checkEndState)
// reverses that: hide battle chrome, show this overlay, render the next
// screen. main.js still owns `game`/canvas/the frame loop; this file never
// touches them directly.
//
// Menu wiring: the DEBUG-gated "ROGUELIKE" entry button lives in ui.js
// appendGlobalMenuButtons (mirrors the MOD LAB gate) and calls this file's
// enterRoguelike() via ui.js's onRoguelikeButtonTap(handler), wired from
// main.js — keeping the import graph one-directional (main.js -> both ui.js
// and roguelike-ui.js; neither of those two import each other).
// ============================================================

import * as roguelike from "./roguelike.js";
import { ROGUELIKE, TOWERS, LOOT } from "./config.js";
import { getMod } from "./affixes.js";
import { t, tf } from "./i18n.js";

const el = {
  overlay: document.getElementById("rogue-overlay"),
  body: document.getElementById("rogue-body"),
  floor: document.getElementById("rogue-floor"),
  salvage: document.getElementById("rogue-salvage"),
  coreLabel: document.getElementById("rogue-core-label"),
  coreFill: document.getElementById("rogue-core-fill"),
  hud: document.getElementById("hud"),
  actionBar: document.getElementById("action-bar"),
  levelOverlay: document.getElementById("level-overlay"),
};

const COMBAT_KINDS = new Set(["normal", "elite", "farm", "boss"]);
const KIND_ICON = {
  normal: "⚔", elite: "☠", farm: "⚡", gear: "🎁",
  shop: "🛒", event: "❓", recovery: "🔧", boss: "👑", upgrade: "🛠",
};
const RARITY_COLOR = {
  common: "#b7c0d5", enhanced: "#4affa1", rare: "#35e0ff",
  prismatic: "#ff3fd4", singularity: "#ffe24a",
};
const SLOT_LABEL = { optic: "OPTIC", emitter: "EMITTER", capacitor: "CAPACITOR", frame: "FRAME" };

// Set once from main.js (setBattleLauncher-style wiring) — returning to the
// main menu needs main.js's `startLevel` (via its own goToMainMenu), which
// this module must not import directly (would risk a cycle back through
// main.js's other imports). See file header.
let exitToMenuHandler = null;
export function initRoguelikeUI(onExitToMenu) {
  exitToMenuHandler = onExitToMenu;
}

// Shop screen only: which roster member gear purchases currently target.
// Reset to 0 whenever a fresh shop node is entered.
let selectedRosterIndex = 0;
let abandonArmed = false;
let abandonTimer = null;

// ---------- Small local render helpers (no ui.js import — see header) ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
function rarityLabel(r) { return t(`rarity.${r}`, r.toUpperCase()); }
function slotLabel(s) { return t(`slot.${s}`, SLOT_LABEL[s] || s.toUpperCase()); }
function modLabel(id) { return getMod(id)?.name || id; }
function affixDef(slot, stat) {
  return (LOOT.gen.slots[slot] || []).find((a) => a.stat === stat) || null;
}
function affixLabel(def, stat) {
  return ((def && def.name) || stat).replace(/ %| \+N$/, "");
}

// ---------- Chrome toggles ----------

function showRogueOverlay() { el.overlay.classList.remove("hidden"); }
function hideRogueOverlay() { el.overlay.classList.add("hidden"); }
function showBattleChrome() { el.hud.classList.remove("hidden"); el.actionBar.classList.remove("hidden"); }
function hideBattleChrome() { el.hud.classList.add("hidden"); el.actionBar.classList.add("hidden"); }

function exitToMenu() {
  hideRogueOverlay();
  hideBattleChrome();
  if (exitToMenuHandler) exitToMenuHandler();
}

// ---------- Entry / battle-end hooks (called from main.js) ----------

// Tapped from the main menu (DEBUG-gated button, ui.js). Also usable from the
// console (`window.startRun(seed)` in main.js aliases this) with an optional
// seed for deterministic runs. With no seed, the player sees the run-start
// screen (NEW RUN / DAILY RUN / BACK) instead of starting immediately; a
// provided seed (console/replay/daily) still starts the run right away, same
// as before this screen existed.
export function enterRoguelike(seed) {
  el.levelOverlay.classList.add("hidden");
  hideBattleChrome();
  if (seed === undefined) {
    showRogueOverlay();
    renderRunStart();
    return;
  }
  roguelike.startRun(seed);
  showRogueOverlay();
  renderNodeMap();
}

// ---------- Run-start screen ----------

function renderRunStart() {
  const seed = roguelike.dailySeed();
  const canResume = roguelike.hasResumableRun();
  const resumeHtml = canResume
    ? `<button class="big-button rogue-wide" type="button" id="rogue-start-resume">${t("rogue.start.resume", "RESUME RUN")}</button>`
    : "";
  el.body.innerHTML = `
    <div class="rogue-runstart">
      <div class="rogue-runstart-title">${t("rogue.start.title", "ROGUELIKE GAUNTLET")}</div>
      <p class="rogue-runstart-sub">${t("rogue.start.sub", "13 floors. Fresh towers. Beat the core breach.")}</p>
      ${resumeHtml}
      <button class="big-button rogue-wide" type="button" id="rogue-start-new">${t("rogue.start.new", "NEW RUN")}</button>
      <button class="big-button rogue-wide" type="button" id="rogue-start-daily">${t("rogue.start.daily", "DAILY RUN")}</button>
      <p class="rogue-runstart-seed">${tf("rogue.start.dailySeed", "Today's seed: {seed}", { seed })}</p>
      <button class="big-button rogue-secondary rogue-wide" type="button" id="rogue-start-back">${t("rogue.start.back", "BACK")}</button>
    </div>
  `;
  if (canResume) {
    document.getElementById("rogue-start-resume").addEventListener("click", () => {
      if (roguelike.resumeRun()) { selectedRosterIndex = 0; renderCurrentScreen(); }
      else renderRunStart(); // snapshot was invalid — fall back to the start screen
    });
  }
  document.getElementById("rogue-start-new").addEventListener("click", () => {
    roguelike.startRun();
    renderNodeMap();
  });
  document.getElementById("rogue-start-daily").addEventListener("click", () => {
    roguelike.startRun(roguelike.dailySeed());
    renderNodeMap();
  });
  document.getElementById("rogue-start-back").addEventListener("click", exitToMenu);
}

// Paint whichever screen matches the live run's phase — used after resumeRun()
// so a restored run lands where the player left off. Mirrors the routing that
// onChooseNode / onRunBattleEnd perform for each staged non-combat phase.
function renderCurrentScreen() {
  const run = roguelike.getRun();
  if (!run) { renderRunStart(); return; }
  const pc = run.pendingChoice;
  switch (run.phase) {
    case "reward":
      if (pc && pc.kind === "upgrade") renderUpgradeReward(pc.options);
      else if (pc && pc.kind === "gear") renderGearReward(pc.items);
      else renderNodeMap();
      break;
    case "shop": renderShop(); break;
    case "event":
      if (pc && pc.event) renderEvent(pc.event);
      else renderNodeMap();
      break;
    default: // choosing (and any coerced-from-battle phase) -> the node map
      renderNodeMap();
  }
}

// Called by main.js checkEndState the instant a run battle resolves
// (game.phase won/lost), BEFORE any campaign save-write. Advances the run
// (roguelike.onBattleEnd) and shows either the run-end screen or the next
// floor's node map.
export function onRunBattleEnd(game) {
  const result = roguelike.onBattleEnd(game);
  if (!result) return;
  hideBattleChrome();
  showRogueOverlay();
  if (result.runOver) renderRunEnd(result);
  // Elite guaranteed bonus reward (Phase D): onBattleEnd staged a gear choice
  // instead of advancing the floor — show it exactly like a gear node's
  // reward screen; picking (or skipping) it advances the floor itself.
  else if (result.bonusReward) renderGearReward(result.bonusReward.items);
  else renderNodeMap();
}

// ---------- HUD strip (Core Integrity bar + Salvage + floor progress) ----------

function updateHudStrip(run) {
  el.floor.textContent = tf("rogue.hud.floor", "FLOOR {n} / {total}",
    { n: run.floorIndex + 1, total: ROGUELIKE.floorCount });
  el.salvage.textContent = `◆ ${run.salvage}`;
  el.coreLabel.textContent = `${run.coreIntegrity}/${run.maxCoreIntegrity}`;
  const pct = run.maxCoreIntegrity > 0
    ? Math.max(0, Math.min(100, (run.coreIntegrity / run.maxCoreIntegrity) * 100))
    : 0;
  el.coreFill.style.width = `${pct}%`;
  el.coreFill.classList.toggle("low", pct <= 30);
  el.coreFill.classList.toggle("mid", pct > 30 && pct <= 60);
}

// ---------- Item card (shared by gear-reward + shop screens) ----------

function itemBodyHtml(item) {
  const color = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const lock = item.towerType
    ? tf("rogue.item.lock", "{tower} ONLY", { tower: (TOWERS[item.towerType]?.name || item.towerType).toUpperCase() })
    : t("rogue.item.universal", "UNIVERSAL");
  const affixLines = (item.affixes || []).slice(0, 3).map((a) => {
    const def = affixDef(item.slot, a.stat);
    const suffix = def && def.int ? "" : "%";
    return `<div class="rogue-item-affix">${escapeHtml(affixLabel(def, a.stat))} +${a.value}${suffix}</div>`;
  }).join("");
  const modLines = (item.mods || []).map((m) =>
    `<div class="rogue-item-mod">${escapeHtml(modLabel(m.id))}</div>`
  ).join("");
  return `
    <div class="rogue-item-head" style="color:${color};border-color:${color}">
      <span class="rogue-item-rarity">${escapeHtml(rarityLabel(item.rarity))}</span>
      <span class="rogue-item-slot">${escapeHtml(slotLabel(item.slot))}</span>
    </div>
    <div class="rogue-item-lock">${escapeHtml(lock)}</div>
    <div class="rogue-item-affixes">${affixLines}${modLines}</div>
  `;
}

// ---------- Node-choice map ----------

function nodePreview(node) {
  switch (node.kind) {
    case "normal": return t("rogue.node.normal", "Standard hostile wave.");
    case "elite": return node.modifier?.desc || t("rogue.node.elite", "Tougher fight, bigger reward.");
    case "farm": return t("rogue.node.farm", "Weak wave — bonus tower XP.");
    case "gear": return tf("rogue.node.gear", "Choose 1 of {n} gear rewards.", { n: ROGUELIKE.reward.choiceCount });
    case "shop": return t("rogue.node.shop", "Spend Salvage on gear, unlocks & repairs.");
    case "event": return node.event?.desc || t("rogue.node.event", "A risky choice.");
    case "recovery": return t("rogue.node.recovery", "Restore Core Integrity.");
    case "upgrade": return tf("rogue.node.upgrade", "Choose 1 of {n} permanent run upgrades.", { n: ROGUELIKE.runUpgrades.choiceCount });
    case "boss": return t("rogue.node.boss", "Final battle. Win to complete the run.");
    default: return "";
  }
}

function renderNodeMap() {
  const run = roguelike.getRun();
  if (!run) return;
  updateHudStrip(run);
  abandonArmed = false;
  clearTimeout(abandonTimer);

  const cardsHtml = run.choices.map((node, i) => `
    <button class="rogue-node-card rogue-kind-${node.kind}" type="button" data-node="${i}">
      <span class="rogue-node-icon">${KIND_ICON[node.kind] || "?"}</span>
      <span class="rogue-node-text">
        <span class="rogue-node-label">${escapeHtml(node.label)}</span>
        <span class="rogue-node-preview">${escapeHtml(nodePreview(node))}</span>
      </span>
    </button>
  `).join("");

  el.body.innerHTML = `
    <div class="rogue-panel-title">${t("rogue.map.title", "CHOOSE YOUR ENCOUNTER")}</div>
    <div class="rogue-node-grid">${cardsHtml}</div>
    <button class="big-button rogue-wide rogue-abandon-btn" type="button" id="rogue-abandon">${t("rogue.abandon", "ABANDON RUN")}</button>
  `;

  el.body.querySelectorAll("[data-node]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.node);
      onChooseNode(i, run.choices[i]);
    });
  });
  bindAbandonButton(document.getElementById("rogue-abandon"));
}

function bindAbandonButton(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!abandonArmed) {
      abandonArmed = true;
      btn.textContent = t("rogue.abandonConfirm", "TAP AGAIN TO ABANDON");
      btn.classList.add("armed");
      clearTimeout(abandonTimer);
      abandonTimer = setTimeout(() => {
        abandonArmed = false;
        btn.textContent = t("rogue.abandon", "ABANDON RUN");
        btn.classList.remove("armed");
      }, 3000);
      return;
    }
    clearTimeout(abandonTimer);
    roguelike.endRun("abandoned");
    exitToMenu();
  });
}

function onChooseNode(i, node) {
  if (COMBAT_KINDS.has(node.kind)) {
    hideRogueOverlay();
    showBattleChrome();
    roguelike.chooseNode(i); // synchronously launches the battle (main.js startRoguelikeBattle)
    return;
  }
  const result = roguelike.chooseNode(i);
  if (!result || !result.ok) return; // shouldn't happen from a UI-driven tap; nothing to show
  switch (result.kind) {
    case "gear": renderGearReward(result.items); break;
    case "shop": selectedRosterIndex = 0; renderShop(); break;
    case "event": renderEvent(result.event); break;
    case "upgrade": renderUpgradeReward(result.options); break;
    case "recovery": {
      const run = roguelike.getRun();
      renderOutcome({
        title: t("rogue.recovery.title", "REPAIR BAY"),
        lines: [
          tf("rogue.recovery.restored", "+{n} CORE INTEGRITY", { n: result.restored }),
          tf("rogue.recovery.now", "NOW {cur}/{max}", { cur: result.coreIntegrity, max: run.maxCoreIntegrity }),
        ],
      });
      break;
    }
    default: renderNodeMap();
  }
}

// ---------- Gear reward screen ----------

function rosterTargetButtons(item, itemIndex, run) {
  const targets = run.roster
    .map((rec, idx) => ({ rec, idx }))
    .filter(({ rec }) => !item.towerType || item.towerType === rec.type);
  if (!targets.length) {
    return `<div class="rogue-item-note">${t("rogue.gear.noTarget", "NO COMPATIBLE TOWER")}</div>`;
  }
  return `<div class="rogue-item-targets">${targets.map(({ rec, idx }) => {
    const replacing = rec.gear[item.slot];
    const sub = replacing
      ? tf("rogue.gear.replaces", "replaces {r} {s}", { r: rarityLabel(replacing.rarity), s: slotLabel(replacing.slot) })
      : t("rogue.gear.emptySlot", "empty slot");
    const color = TOWERS[rec.type]?.color || "#35e0ff";
    return `<button class="big-button rogue-target-btn" type="button" style="color:${color};border-color:${color}" data-equip="${itemIndex}:${idx}">
      <span>${escapeHtml(rec.name.toUpperCase())}</span><span class="rogue-target-sub">${escapeHtml(sub)}</span>
    </button>`;
  }).join("")}</div>`;
}

function renderGearReward(items) {
  const run = roguelike.getRun();
  updateHudStrip(run);
  el.body.innerHTML = `
    <div class="rogue-panel-title">${t("rogue.gear.title", "SALVAGE CACHE")}</div>
    <p class="rogue-panel-sub">${t("rogue.gear.sub", "PICK ONE ITEM TO EQUIP")}</p>
    <div class="rogue-gear-grid">
      ${items.map((item, i) => `
        <div class="rogue-item-card">
          ${itemBodyHtml(item)}
          ${rosterTargetButtons(item, i, run)}
        </div>
      `).join("")}
    </div>
    <button class="big-button rogue-secondary rogue-wide" type="button" id="rogue-gear-skip">${tf("rogue.gear.skip", "SKIP ALL (+{n} SALVAGE)", { n: ROGUELIKE.reward.skipSalvage })}</button>
  `;
  el.body.querySelectorAll("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [i, idx] = btn.dataset.equip.split(":").map(Number);
      roguelike.pickGearReward(i, idx);
      renderNodeMap();
    });
  });
  document.getElementById("rogue-gear-skip").addEventListener("click", () => {
    roguelike.pickGearReward(-1);
    renderNodeMap();
  });
}

// ---------- Run-upgrade screen (Phase D) ----------
// Reuses the event screen's option-button classes (.rogue-event-option/-opt-
// label/-opt-desc) — same "pick one of N labeled choices" shape, no new CSS.

function renderUpgradeReward(options) {
  const run = roguelike.getRun();
  updateHudStrip(run);
  const optionsHtml = options.map((u, i) => `
    <button class="rogue-event-option" type="button" data-upgrade="${i}">
      <span class="rogue-event-opt-label">${escapeHtml(u.label)}</span>
      <span class="rogue-event-opt-desc">${escapeHtml(u.desc)}</span>
    </button>
  `).join("");
  el.body.innerHTML = `
    <div class="rogue-panel-title">${t("rogue.upgrade.title", "SYSTEM UPGRADE")}</div>
    <p class="rogue-panel-sub">${t("rogue.upgrade.sub", "PICK ONE — PERMANENT FOR THE REST OF THE RUN")}</p>
    <div class="rogue-event-options">${optionsHtml}</div>
    <button class="big-button rogue-secondary rogue-wide" type="button" id="rogue-upgrade-skip">${tf("rogue.upgrade.skip", "SKIP ALL (+{n} SALVAGE)", { n: ROGUELIKE.runUpgrades.skipSalvage })}</button>
  `;
  el.body.querySelectorAll("[data-upgrade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      roguelike.pickRunUpgrade(Number(btn.dataset.upgrade));
      renderNodeMap();
    });
  });
  document.getElementById("rogue-upgrade-skip").addEventListener("click", () => {
    roguelike.pickRunUpgrade(-1);
    renderNodeMap();
  });
}

// ---------- Shop screen (multi-action; re-reads live run state each render) ----------

function renderShop() {
  const run = roguelike.getRun();
  const shop = run?.pendingChoice;
  if (!run || !shop) { renderNodeMap(); return; }
  if (selectedRosterIndex >= run.roster.length) selectedRosterIndex = 0;
  updateHudStrip(run);

  const cfg = ROGUELIKE.shop;
  const rec = run.roster[selectedRosterIndex];
  const missing = run.maxCoreIntegrity - run.coreIntegrity;
  const repairPts = Math.max(0, Math.min(cfg.coreRepairMaxPoints, missing));
  const repairCost = repairPts * cfg.coreRepairPointPrice;

  const tabsHtml = run.roster.map((r, i) => `
    <button class="rogue-roster-tab ${i === selectedRosterIndex ? "active" : ""}" type="button"
      style="--rc:${TOWERS[r.type]?.color || "#35e0ff"}" data-tab="${i}">${escapeHtml(r.name.toUpperCase())}</button>
  `).join("");

  const stockHtml = shop.gearStock.map((entry, i) => {
    const locked = entry.item.towerType && entry.item.towerType !== rec.type;
    const disabled = entry.bought || run.salvage < entry.price || locked;
    const label = entry.bought ? t("rogue.shop.sold", "BOUGHT")
      : locked ? t("rogue.shop.wrongType", "WRONG TYPE")
      : tf("rogue.shop.buyPrice", "BUY · {price}", { price: entry.price });
    return `<div class="rogue-item-card">
      ${itemBodyHtml(entry.item)}
      <button class="big-button rogue-wide" type="button" data-buy="${i}" ${disabled ? "disabled" : ""}>${label}</button>
    </div>`;
  }).join("");

  const unlocksHtml = shop.towerOffers.length ? `
    <div class="rogue-shop-label">${t("rogue.shop.unlocks", "TOWER UNLOCKS")}</div>
    <div class="rogue-shop-unlocks">${shop.towerOffers.map((o) => `
      <button class="big-button rogue-wide" type="button" data-unlock="${o.type}" ${(o.bought || run.salvage < o.price) ? "disabled" : ""}>
        ${o.bought ? t("rogue.shop.sold", "BOUGHT") : tf("rogue.shop.unlockPrice", "UNLOCK {tower} · {price}", { tower: (TOWERS[o.type]?.name || o.type).toUpperCase(), price: o.price })}
      </button>
    `).join("")}</div>` : "";

  el.body.innerHTML = `
    <div class="rogue-panel-title">${t("rogue.shop.title", "TRADE POST")}</div>
    <div class="rogue-roster-tabs">${tabsHtml}</div>
    <div class="rogue-shop-label">${tf("rogue.shop.gearFor", "GEAR STOCK — for {tower}", { tower: rec.name.toUpperCase() })}</div>
    <div class="rogue-gear-grid">${stockHtml}</div>
    ${unlocksHtml}
    <div class="rogue-shop-label">${t("rogue.shop.repair", "CORE REPAIR")}</div>
    <div class="rogue-shop-repair-row">
      <span>${run.coreIntegrity}/${run.maxCoreIntegrity}</span>
      <button class="big-button" type="button" id="rogue-repair" ${(repairPts <= 0 || run.salvage < repairCost) ? "disabled" : ""}>
        ${tf("rogue.shop.repairBtn", "+{n} INTEGRITY · {cost}", { n: repairPts, cost: repairCost })}
      </button>
    </div>
    <div class="rogue-shop-actions">
      <button class="big-button rogue-secondary" type="button" id="rogue-reroll" ${run.salvage < cfg.rerollCost ? "disabled" : ""}>
        ${tf("rogue.shop.rerollBtn", "REROLL · {cost}", { cost: cfg.rerollCost })}
      </button>
      <button class="big-button rogue-wide" type="button" id="rogue-leave">${t("rogue.shop.leave", "LEAVE SHOP")}</button>
    </div>
  `;

  el.body.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => { selectedRosterIndex = Number(btn.dataset.tab); renderShop(); });
  });
  el.body.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      roguelike.shopBuyGear(Number(btn.dataset.buy), selectedRosterIndex);
      renderShop();
    });
  });
  el.body.querySelectorAll("[data-unlock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      roguelike.shopBuyTowerUnlock(btn.dataset.unlock);
      renderShop();
    });
  });
  const repairBtn = document.getElementById("rogue-repair");
  if (repairBtn) {
    repairBtn.addEventListener("click", () => { roguelike.shopBuyRepair(repairPts); renderShop(); });
  }
  document.getElementById("rogue-reroll").addEventListener("click", () => { roguelike.shopReroll(); renderShop(); });
  document.getElementById("rogue-leave").addEventListener("click", () => { roguelike.shopLeave(); renderNodeMap(); });
}

// ---------- Event screen ----------

function renderEvent(event) {
  const run = roguelike.getRun();
  updateHudStrip(run);
  const optionsHtml = event.options.map((opt, i) => `
    <button class="rogue-event-option" type="button" data-opt="${i}">
      <span class="rogue-event-opt-label">${escapeHtml(opt.label)}</span>
      <span class="rogue-event-opt-desc">${escapeHtml(opt.desc)}</span>
    </button>
  `).join("");
  el.body.innerHTML = `
    <div class="rogue-panel-title">${escapeHtml(event.label)}</div>
    <p class="rogue-panel-sub">${escapeHtml(event.desc)}</p>
    <div class="rogue-event-options">${optionsHtml}</div>
  `;
  el.body.querySelectorAll("[data-opt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.opt);
      const result = roguelike.resolveEventOption(i);
      if (!result || !result.ok) return;
      const lines = [];
      if (result.rolled) {
        lines.push(result.rolled === "success" ? t("rogue.event.success", "SUCCESS") : t("rogue.event.failure", "SETBACK"));
      }
      lines.push(tf("rogue.event.salvageNow", "SALVAGE {n}", { n: result.salvage }));
      lines.push(tf("rogue.event.coreNow", "CORE INTEGRITY {n}", { n: result.coreIntegrity }));
      renderOutcome({ title: event.label, lines });
    });
  });
}

// ---------- Generic outcome banner (recovery + event results) ----------

function renderOutcome({ title, lines }) {
  const run = roguelike.getRun();
  updateHudStrip(run);
  el.body.innerHTML = `
    <div class="rogue-outcome">
      <div class="rogue-outcome-title">${escapeHtml(title)}</div>
      ${lines.map((l) => `<div class="rogue-outcome-line">${escapeHtml(l)}</div>`).join("")}
      <button class="big-button rogue-wide" type="button" id="rogue-outcome-continue">${t("rogue.continue", "CONTINUE")}</button>
    </div>
  `;
  document.getElementById("rogue-outcome-continue").addEventListener("click", renderNodeMap);
}

// ---------- Run-end screen (victory / defeat) ----------

function renderRunEnd(result) {
  const run = roguelike.getRun();
  if (run) updateHudStrip(run);
  const s = roguelike.getRunSummary(); // null only if `run` is somehow already gone — fall back to `result`
  const won = result.runWon;

  const summaryHtml = s ? (() => {
    const towerNames = [...ROGUELIKE.starterTowers, ...s.extraTowers]
      .map((type) => TOWERS[type]?.name || type).join(", ");
    const upgradesText = s.upgrades.length ? s.upgrades.join(", ") : t("rogue.summary.none", "—");
    const row = (key, val) => `
      <div class="rogue-summary-row">
        <span class="rogue-summary-key">${key}</span>
        <span class="rogue-summary-val">${val}</span>
      </div>`;
    return `
      <div class="rogue-summary">
        ${row(t("rogue.summary.floor", "Floor reached"), `${s.floor}/${s.floorCount}`)}
        ${row(t("rogue.summary.core", "Core Integrity"), `${s.coreIntegrity}/${s.maxCoreIntegrity}`)}
        ${row(t("rogue.summary.salvage", "Salvage banked"), s.salvage)}
        ${row(t("rogue.summary.towers", "Towers unlocked"), escapeHtml(towerNames))}
        ${row(t("rogue.summary.gear", "Gear drafted"), s.gearCount)}
        ${row(t("rogue.summary.upgrades", "Upgrades"), escapeHtml(upgradesText))}
        <div class="rogue-summary-row rogue-summary-seed">
          <span class="rogue-summary-key">${t("rogue.summary.seed", "Seed")}</span>
          <span class="rogue-summary-val">${escapeHtml(String(s.seed))}</span>
        </div>
      </div>`;
  })() : "";

  el.body.innerHTML = `
    <div class="rogue-runend ${won ? "win" : "loss"}">
      <div class="rogue-runend-title">${won ? t("rogue.end.win", "RUN COMPLETE") : t("rogue.end.loss", "RUN OVER")}</div>
      <p class="rogue-runend-sub">${won
        ? tf("rogue.end.winSub", "Core breached on floor {floor}. Salvage banked: {salvage}.", { floor: result.floor + 1, salvage: result.salvage })
        : tf("rogue.end.lossSub", "Core Integrity fell on floor {floor} of {total}.", { floor: result.floor + 1, total: result.floorCount })}</p>
      ${summaryHtml}
      <button class="big-button rogue-wide" type="button" id="rogue-newrun">${t("rogue.end.newRun", "NEW RUN")}</button>
      <button class="big-button rogue-wide" type="button" id="rogue-replay-seed" ${s ? "" : "disabled"}>${t("rogue.end.replaySeed", "REPLAY SEED")}</button>
      <button class="big-button rogue-secondary rogue-wide" type="button" id="rogue-daily-run">${t("rogue.end.daily", "DAILY RUN")}</button>
      <button class="big-button rogue-secondary rogue-wide" type="button" id="rogue-copy-seed" ${s ? "" : "disabled"}>${t("rogue.end.copySeed", "COPY SEED")}</button>
      <button class="big-button rogue-secondary rogue-wide" type="button" id="rogue-mainmenu">${t("rogue.end.mainMenu", "MAIN MENU")}</button>
    </div>
  `;
  document.getElementById("rogue-newrun").addEventListener("click", () => {
    roguelike.startRun();
    renderNodeMap();
  });
  const replayBtn = document.getElementById("rogue-replay-seed");
  if (s) {
    replayBtn.addEventListener("click", () => {
      roguelike.startRun(s.seed);
      renderNodeMap();
    });
  }
  document.getElementById("rogue-daily-run").addEventListener("click", () => {
    roguelike.startRun(roguelike.dailySeed());
    renderNodeMap();
  });
  const copyBtn = document.getElementById("rogue-copy-seed");
  if (s) {
    copyBtn.addEventListener("click", () => {
      const original = copyBtn.textContent;
      try {
        const promise = navigator.clipboard?.writeText(String(s.seed));
        if (promise && promise.then) {
          promise.then(() => {
            copyBtn.textContent = t("rogue.end.copied", "COPIED");
            setTimeout(() => { copyBtn.textContent = original; }, 1500);
          }).catch(() => {});
        }
      } catch (e) {
        // clipboard unavailable (iOS/file://) — no-op, label stays as-is
      }
    });
  }
  document.getElementById("rogue-mainmenu").addEventListener("click", () => {
    roguelike.endRun("exited");
    exitToMenu();
  });
}
