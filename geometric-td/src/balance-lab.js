import { validate } from "./balance-schema.js";
import { TOWERS, ENEMIES } from "./config.js";
import { LEVELS, WORLDS } from "./levels.js";

const DAMAGE_TYPES = ["energy", "pulse", "control", "rail", "blast"];
const RARITIES = ["common", "enhanced", "rare", "prismatic", "singularity"];
const mount = document.querySelector("#lab-mount");
const summary = document.querySelector("#lab-summary");
const searchInput = document.querySelector("#lab-search");
const reloadButton = document.querySelector("#reload-button");
const resetButton = document.querySelector("#reset-button");
const dirtyState = document.querySelector("#dirty-state");
const noteInput = document.querySelector("#revision-note");
const saveButton = document.querySelector("#save-button");
const saveDirtyCount = document.querySelector("#save-dirty-count");
const saveValidation = document.querySelector("#save-validation");
const saveMessage = document.querySelector("#save-message");

let server, draft, revision, history, validation = { ok: false, errors: [] };
let selectedWorldId, selectedLevelId, searchTerm = "", historyFilter = "", selectedHistoryId = null, saving = false, conflict = false;
const openWaves = new Set();
const fieldErrors = new Map();
const historySnapshots = new Map();
let historyChangeCounts = new Map();

const towerName = (id) => TOWERS[id]?.name || id;
const enemyName = (id) => ENEMIES[id]?.name || id;
const levelName = (id) => LEVELS.find((level) => level.id === id)?.name || id;
const worldName = (id) => WORLDS.find((world) => world.id === id)?.name || id;
const clone = (value) => structuredClone(value);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
const displayValue = (value) => value === undefined ? "—" : value === null ? "null" : typeof value === "object" ? JSON.stringify(value) : String(value);

function deepEqual(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
}

function pathParts(path) { return path.replace(/\[(\d+)\]/g, ".$1").split("."); }
function getByPath(object, path) { return pathParts(path).reduce((value, key) => value?.[key], object); }
function setByPath(object, path, value) {
  const parts = pathParts(path); let target = object;
  parts.slice(0, -1).forEach((key, index) => { if (target[key] === undefined) target[key] = /^\d+$/.test(parts[index + 1]) ? [] : {}; target = target[key]; });
  target[parts.at(-1)] = value;
}
function diffValues(before, after, path = "", changes = []) {
  if (deepEqual(before, after)) return changes;
  if (before && after && typeof before === "object" && typeof after === "object" && Array.isArray(before) === Array.isArray(after)) {
    if (Array.isArray(before) && before.length !== after.length) changes.push({ path: `${path}.length`, before: before.length, after: after.length, kind: "array-length" });
    const keys = Array.isArray(before) ? Array.from({ length: Math.max(before.length, after.length) }, (_, i) => i) : [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    keys.forEach((key) => diffValues(before[key], after[key], Array.isArray(before) ? `${path}[${key}]` : (path ? `${path}.${key}` : key), changes));
  } else changes.push({ path, before, after, kind: before === undefined ? "added" : after === undefined ? "removed" : "changed" });
  return changes;
}
function flatten(value, path = "", rows = []) {
  if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => flatten(item, Array.isArray(value) ? `${path}[${key}]` : (path ? `${path}.${key}` : key), rows));
  else rows.push({ path, value });
  return rows;
}
function countCampaign(data) {
  const levels = Object.values(data.levels); const waves = levels.reduce((total, level) => total + level.waves.length, 0);
  return { levels: levels.length, waves, groups: levels.reduce((total, level) => total + level.waves.reduce((sum, wave) => sum + wave.groups.length, 0), 0) };
}
function table(headers, rows) { return `<div class="table-scroll"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`; }
function section(id, title, body, note = "") { return `<section id="${id}" class="lab-section"><div class="section-heading"><h2>${escapeHtml(title)}</h2>${note ? `<span class="section-note">${escapeHtml(note)}</span>` : ""}</div>${body}</section>`; }
function diffGroup(path) { return path.split(/[.[\]]/)[0] || "root"; }
function renderStructuredDiff(before, after, beforeLabel, afterLabel, emptyMessage) {
  const changes = diffValues(before, after);
  if (!changes.length) return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  const groups = new Map();
  changes.forEach((change) => { const key = diffGroup(change.path); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(change); });
  const body = [...groups.entries()].map(([group, rows]) => `<article class="diff-group"><h4>${escapeHtml(group)} <span class="subtle">${rows.length} ${rows.length === 1 ? "change" : "changes"}</span></h4>${table(["Path", beforeLabel, afterLabel, "Kind"], rows.map((change) => `<tr><td><code>${escapeHtml(change.path)}</code></td><td>${escapeHtml(displayValue(change.before))}</td><td>${escapeHtml(displayValue(change.after))}</td><td><span class="diff-status ${escapeHtml(change.kind)}">${escapeHtml(change.kind)}</span></td></tr>`))}</article>`).join("");
  return `<p class="diff-summary">${changes.length} ${changes.length === 1 ? "changed value" : "changed values"} across ${groups.size} ${groups.size === 1 ? "area" : "areas"}.</p>${body}`;
}
function localTimestamp(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString(); }
function isIntegerPath(path) { return /(?:baseCost|basePierce|coreDamage|count|shardTier|maxLevel|maxRanks|bossEvery|threshold|xpThresholds|upgradeCosts|costs|steps|Cost|startingMoney|coreHealth|skillPoints|amount)$/.test(path) || /\[(?:\d+)\]$/.test(path) && /(xpThresholds|upgradeCosts|costs|levelCosts)/.test(path); }
function options(values, selected) { return values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`).join(""); }
function advisoryFor(path, value) {
  if (typeof value !== "number") return "";
  if (path.endsWith("baseCost") && value > 1000) return "Advisory: unusually expensive tower.";
  if ((path.endsWith("baseHealth") || path.endsWith("baseDamage")) && value > 10000) return "Advisory: unusually high combat value.";
  if (path.endsWith("spawnInterval") && value > 10) return "Advisory: unusually slow spawn interval.";
  return "";
}
function fieldHelp(path) {
  if (path.endsWith("baseFireRate")) return "Seconds between shots.";
  if (path.endsWith("baseRange")) return "Tiles of targeting range.";
  if (path.endsWith("speed") || path.endsWith("speedMult")) return "Movement multiplier / tiles per second.";
  if (path.endsWith("spawnInterval")) return "Seconds between spawns.";
  if (path.endsWith("startDelay")) return "Seconds before this group starts.";
  if (path.endsWith("slowPercent")) return "Fraction from 0 to 1.";
  return "";
}
function selectValues(path) {
  if (path.endsWith("damageType")) return DAMAGE_TYPES;
  if (path.endsWith("splitInto.type")) return Object.keys(draft.enemies);
  if (/\.groups\[\d+\]\.type$/.test(path)) return Object.keys(draft.enemies).filter((id) => id !== "splitling");
  if (path.endsWith("reward.kind")) return ["shards", "loot"];
  if (path.endsWith("reward.rarity")) return RARITIES;
  return null;
}
function fieldControl(path, value, { readOnly = false } = {}) {
  const error = fieldErrors.get(path), help = fieldHelp(path), warning = advisoryFor(path, value);
  if (readOnly) return `<span class="readonly-value">${escapeHtml(displayValue(value))}</span>`;
  const select = selectValues(path);
  let input;
  if (select) input = `<select data-edit-path="${escapeHtml(path)}" data-kind="string">${options(select, value)}</select>`;
  else if (typeof value === "boolean") input = `<label class="field-control checkbox"><input type="checkbox" data-edit-path="${escapeHtml(path)}" data-kind="boolean" ${value ? "checked" : ""} /><span>${value ? "On" : "Off"}</span></label>`;
  else input = `<input type="number" data-edit-path="${escapeHtml(path)}" data-kind="${isIntegerPath(path) ? "integer" : "number"}" value="${escapeHtml(value)}" step="${isIntegerPath(path) ? "1" : "any"}" />`;
  return `<div class="field-control">${input}${help ? `<span class="field-help">${escapeHtml(help)}</span>` : ""}${warning ? `<span class="field-warning">${escapeHtml(warning)}</span>` : ""}${error ? `<span class="field-error">${escapeHtml(error)}</span>` : ""}</div>`;
}
function editableObject(value, rootPath, isReadOnly = () => false) {
  const rows = flatten(value, rootPath); if (!rows.length) return '<p class="empty">No values present.</p>';
  return table(["Path", "Value"], rows.map(({ path, value }) => `<tr class="searchable" data-search="${escapeHtml(`${path} ${value}`.toLowerCase())}"><td><code>${escapeHtml(path)}</code></td><td>${fieldControl(path, value, { readOnly: isReadOnly(path) })}</td></tr>`));
}

function renderOverview() {
  const campaign = countCampaign(draft), active = history?.revisions?.find((entry) => entry.id === revision);
  const metrics = [["Schema", draft.schemaVersion], ["Active revision", revision], ["Created", active?.createdAt || "unknown"], ["Validation", validation.ok ? "Valid" : "Invalid"], ["Towers", Object.keys(draft.towers).length], ["Enemies", Object.keys(draft.enemies).length], ["Levels", campaign.levels], ["Waves", campaign.waves], ["Wave groups", campaign.groups], ["Worlds", Object.keys(draft.worlds).length]];
  const content = metrics.map(([label, value]) => `<div class="metric searchable" data-search="${escapeHtml(`${label} ${value}`.toLowerCase())}"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-value">${label === "Validation" ? `<span class="badge ${validation.ok ? "valid" : "invalid"}">${escapeHtml(value)}</span>` : escapeHtml(value)}</span></div>`).join("");
  const errors = validation.ok ? "" : `<ul class="validation-errors">${validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
  return section("overview", "Overview", `<div class="overview-grid">${content}</div>${errors}`);
}
function renderTowers() {
  const keys = ["baseCost", "baseDamage", "baseRange", "baseFireRate", "basePierce", "splashRadius", "projectileSpeed", "slowPercent", "slowDuration", "vulnerability", "pierceWidth", "upgradeCostMult", "damageType"];
  const rows = Object.entries(draft.towers).map(([id, tower]) => `<tr class="searchable" data-search="${escapeHtml(`${id} ${towerName(id)} ${JSON.stringify(tower)}`.toLowerCase())}"><td>${escapeHtml(towerName(id))}<br><span class="subtle mono">${escapeHtml(id)}</span><br><span class="derived">DPS: ${(tower.baseDamage / tower.baseFireRate).toFixed(2)}</span></td>${keys.map((key) => `<td>${tower[key] === undefined ? '<span class="readonly-value">—</span>' : fieldControl(`towers.${id}.${key}`, tower[key])}</td>`).join("")}</tr>`);
  return section("towers", "Towers", table(["Tower / derived DPS", ...keys], rows), "Editable values use the live API draft");
}
function renderEnemies() {
  const stats = ["baseHealth", "speed", "coreDamage", "bounty", "xp", "shardTier", "regenRate"];
  const rows = Object.entries(draft.enemies).map(([id, enemy]) => `<tr class="searchable" data-search="${escapeHtml(`${id} ${enemyName(id)} ${JSON.stringify(enemy)}`.toLowerCase())}"><td>${escapeHtml(enemyName(id))}<br><span class="subtle mono">${escapeHtml(id)}</span></td>${stats.map((key) => `<td>${enemy[key] === undefined ? "—" : fieldControl(`enemies.${id}.${key}`, enemy[key])}</td>`).join("")}<td>${enemy.splitInto ? `${fieldControl(`enemies.${id}.splitInto.type`, enemy.splitInto.type)}${fieldControl(`enemies.${id}.splitInto.count`, enemy.splitInto.count)}` : "—"}</td></tr>`);
  const counters = Object.entries(draft.enemies).map(([id, enemy]) => `<tr class="searchable" data-search="${escapeHtml(`${id} ${enemyName(id)} damage counters`.toLowerCase())}"><td>${escapeHtml(enemyName(id))}</td>${DAMAGE_TYPES.map((type) => `<td>${fieldControl(`enemies.${id}.damageMult.${type}`, enemy.damageMult?.[type] ?? 1)}</td>`).join("")}</tr>`);
  return section("enemies", "Enemies", `<h3>Core stats</h3>${table(["Enemy", ...stats, "Split into"], rows)}<h3>Damage counters</h3><p class="subtle">Every damage type is editable; a displayed 1 is the neutral default until changed.</p>${table(["Enemy", ...DAMAGE_TYPES], counters)}`);
}
function readonlyUpgradePath(path) { return path.includes("levelMilestones") && (/\.id$/.test(path) || /\.label$/.test(path) || path.includes(".check")); }
function renderUpgrades() {
  const blocks = [["Tower upgrades", draft.towerUpgrades, "towerUpgrades"], ["Economy", draft.economy, "economy"], ["Wave defaults", draft.waveDefaults, "waveDefaults"], ["Loot · XP and shards", draft.loot, "loot"], ["Skills", draft.skills, "skills"], ["Campaign milestones", draft.levelMilestones, "levelMilestones"]];
  return section("upgrades", "Upgrades & Economy", blocks.map(([title, value, path]) => `<h3>${escapeHtml(title)}</h3>${editableObject(value, path, readonlyUpgradePath)}`).join(""));
}
function pickerOptions(items, selected, labeler) { return items.map((id) => `<option value="${escapeHtml(id)}" ${id === selected ? "selected" : ""}>${escapeHtml(labeler(id))}</option>`).join(""); }
function groupPreview(group, wave) { return Math.round(group.count * (draft.enemies[group.type]?.baseHealth || 0) * (group.healthMult ?? 1) * (wave.healthMult ?? 1)); }
function waveButtons(levelId, waveIndex) { return `<div class="crud-row"><button type="button" data-crud="wave-add" data-level="${levelId}" data-wave="${waveIndex}">Add wave after</button><button type="button" data-crud="wave-up" data-level="${levelId}" data-wave="${waveIndex}">↑</button><button type="button" data-crud="wave-down" data-level="${levelId}" data-wave="${waveIndex}">↓</button><button type="button" data-crud="wave-delete" data-level="${levelId}" data-wave="${waveIndex}">Delete wave</button></div>`; }
function groupButtons(levelId, waveIndex, groupIndex) { return `<div class="crud-row"><button type="button" data-crud="group-add" data-level="${levelId}" data-wave="${waveIndex}" data-group="${groupIndex}">Add after</button><button type="button" data-crud="group-duplicate" data-level="${levelId}" data-wave="${waveIndex}" data-group="${groupIndex}">Duplicate</button><button type="button" data-crud="group-up" data-level="${levelId}" data-wave="${waveIndex}" data-group="${groupIndex}">↑</button><button type="button" data-crud="group-down" data-level="${levelId}" data-wave="${waveIndex}" data-group="${groupIndex}">↓</button><button type="button" data-crud="group-delete" data-level="${levelId}" data-wave="${waveIndex}" data-group="${groupIndex}">Delete</button></div>`; }
function renderCampaign() {
  const worldIds = Object.keys(draft.worlds); if (!selectedWorldId || !draft.worlds[selectedWorldId]) selectedWorldId = worldIds[0];
  const levelIds = draft.worlds[selectedWorldId].levelIds; if (!selectedLevelId || !levelIds.includes(selectedLevelId)) selectedLevelId = levelIds[0];
  const level = draft.levels[selectedLevelId], meta = ["gridWidth", "gridHeight", "startingMoney", "coreHealth", "bountyMult", "timeBetweenWaves", "autoStartNextWave"];
  const metaRows = meta.map((key) => `<tr class="searchable" data-search="${escapeHtml(`${selectedLevelId} ${key}`.toLowerCase())}"><td><code>levels.${selectedLevelId}.${key}</code></td><td>${fieldControl(`levels.${selectedLevelId}.${key}`, level[key], { readOnly: key === "gridWidth" || key === "gridHeight" })}</td></tr>`);
  const waves = level.waves.map((wave, waveIndex) => {
    const groupCount = wave.groups.reduce((sum, group) => sum + group.count, 0), totalHp = wave.groups.reduce((sum, group) => sum + groupPreview(group, wave), 0);
    const groupDefaults = { spawnInterval: draft.waveDefaults.spawnInterval, startDelay: 0, healthMult: 1, speedMult: 1, bountyMult: 1, xpMult: 1 };
    const groups = wave.groups.map((group, groupIndex) => { const base = `levels.${selectedLevelId}.waves[${waveIndex}].groups[${groupIndex}]`; return `<tr class="group-row searchable" data-search="${escapeHtml(`${selectedLevelId} wave ${waveIndex + 1} group ${groupIndex + 1} ${JSON.stringify(group)}`.toLowerCase())}"><td>Group ${groupIndex + 1}</td><td>${fieldControl(`${base}.type`, group.type)}</td><td>${fieldControl(`${base}.count`, group.count)}</td>${["spawnInterval", "startDelay", "healthMult", "speedMult", "bountyMult", "xpMult"].map((key) => `<td>${fieldControl(`${base}.${key}`, group[key] ?? groupDefaults[key])}</td>`).join("")}<td>${groupButtons(selectedLevelId, waveIndex, groupIndex)}</td></tr>`; }).join("");
    return `<article class="wave-editor"><header><h3>Wave ${waveIndex + 1}</h3>${waveButtons(selectedLevelId, waveIndex)}</header><div class="crud-row"><label>Health ${fieldControl(`levels.${selectedLevelId}.waves[${waveIndex}].healthMult`, wave.healthMult ?? 1)}</label><label>Speed ${fieldControl(`levels.${selectedLevelId}.waves[${waveIndex}].speedMult`, wave.speedMult ?? 1)}</label><button type="button" data-crud="group-add" data-level="${selectedLevelId}" data-wave="${waveIndex}" data-group="${wave.groups.length - 1}">Add group</button></div><p class="preview">Derived: ${groupCount} enemies · rough total HP ${totalHp.toLocaleString()}</p>${table(["Group", "Type", "Count", "Spawn interval", "Start delay", "Health", "Speed", "Bounty", "XP", "Actions"], [groups])}</article>`;
  }).join("");
  const picker = `<div class="picker"><label>World<select id="world-picker">${pickerOptions(worldIds, selectedWorldId, (id) => `${worldName(id)} (${id})`)}</select></label><label>Level<select id="level-picker">${pickerOptions(levelIds, selectedLevelId, (id) => `${levelName(id)} (${id})`)}</select></label></div>`;
  return section("campaign", "Campaign Levels", `${picker}<h3>${escapeHtml(levelName(selectedLevelId))} <span class="subtle mono">${selectedLevelId}</span></h3>${table(["Path", "Value"], metaRows)}<p class="subtle">Map geometry is read-only: ${level.pathCorners.length} path corners · ${level.blockedTiles.length} blocked tiles.</p><h3>Waves</h3>${waves}`);
}
function isReadonlyEndless(path) { return /\.id$|\.label$|\.type$/.test(path); }
function renderEndless() {
  const tracks = [["Default track", draft.endlessRewards.defaultTrack, "endlessRewards.defaultTrack"], ...Object.entries(draft.endlessRewards.tracksByLevel).map(([id, track]) => [`${levelName(id)} (${id})`, track, `endlessRewards.tracksByLevel.${id}`])];
  return section("endless", "Endless", `<h3>Endless knobs</h3>${editableObject(draft.endless, "endless")}<h3>Rewards</h3>${tracks.map(([name, values, path]) => `<h3>${escapeHtml(name)}</h3>${editableObject(values, path, isReadonlyEndless)}`).join("")}`);
}
function renderHistory() {
  const entries = [...(history?.revisions || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const filter = historyFilter.trim().toLowerCase();
  const visible = entries.filter((entry) => !filter || `${entry.id} ${entry.createdAt} ${entry.note || ""}`.toLowerCase().includes(filter));
  const rows = visible.map((entry) => {
    const changeCount = historyChangeCounts.get(entry.id);
    const countLabel = entry.baseline ? "baseline" : changeCount === null || changeCount === undefined ? "unavailable" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`;
    const status = `${entry.baseline ? '<span class="badge baseline">baseline</span>' : ""}${entry.id === history?.activeRevision ? ' <span class="badge active">active</span>' : ""}` || "—";
    return `<tr><td><code>${escapeHtml(entry.id)}</code></td><td>${escapeHtml(localTimestamp(entry.createdAt))}</td><td class="history-note">${escapeHtml(entry.note || "—")}</td><td><span class="change-count">${escapeHtml(countLabel)}</span></td><td>${status}</td><td><div class="history-actions"><button type="button" data-history-action="diff" data-history-id="${escapeHtml(entry.id)}">View diff</button><button type="button" data-history-action="restore" data-history-id="${escapeHtml(entry.id)}">Restore</button></div></td></tr>`;
  });
  const selected = entries.find((entry) => entry.id === selectedHistoryId);
  const snapshot = selected && historySnapshots.get(selected.id);
  const detail = selected ? `<div class="diff-review"><h3>${escapeHtml(selected.id)} vs active data</h3>${snapshot?.data ? renderStructuredDiff(snapshot.data, server, "Revision", "Active", "This revision already matches the active data.") : '<p class="empty">The revision snapshot could not be loaded.</p>'}</div>` : "";
  const body = `<div class="history-tools"><label for="history-filter">Filter revisions<input id="history-filter" type="search" value="${escapeHtml(historyFilter)}" placeholder="Search note, id, or date" autocomplete="off" /></label><p class="subtle">${visible.length} of ${entries.length} revisions shown. Change counts are against the prior revision.</p></div>${visible.length ? table(["Revision", "Created", "Note", "Changes", "Status", "Actions"], rows) : '<p class="empty">No revisions match this filter.</p>'}${detail}`;
  return section("history", "History", body, "Newest first · immutable snapshots · restore loads a reviewable draft");
}
function renderWorkflow() {
  return section("workflow", "Git-friendly workflow", `<ol class="workflow-list"><li>Edit balance values in the draft.</li><li>Validate and review the structured Changes diff.</li><li>Save with a clear revision note.</li><li>Test locally, then inspect <code>git diff</code> and <code>git status</code>.</li><li>Manually run <code>git add</code>, <code>git commit</code>, and <code>git push</code> only when you are ready.</li></ol><p class="workflow-note">If a save is stale, Reload from server discards this draft and loads the latest revision. The Lab writes only local balance data and append-only history files. It never commits or pushes. To reverse an experiment, Restore a revision (which creates a new revision) or use a normal <code>git checkout</code> of the data files. See <code>BALANCE_LAB_USAGE.md</code> for the task guide.</p>`, "Review deliberately; commit deliberately");
}
function renderChanges() { return section("changes", "Changes", renderStructuredDiff(server, draft, "Server", "Draft", "No changes — the draft matches the last fetched server data."), "Review before saving"); }

function applySearch() { const term = searchTerm.trim().toLowerCase(); document.querySelectorAll(".searchable").forEach((el) => el.classList.toggle("search-hidden", Boolean(term) && !el.dataset.search.includes(term))); }
function updateSaveBar() {
  const changes = server && draft ? diffValues(server, draft) : [], dirty = changes.length > 0, note = noteInput.value.trim();
  saveDirtyCount.textContent = dirty ? `${changes.length} unsaved ${changes.length === 1 ? "change" : "changes"}` : "No changes";
  saveValidation.textContent = validation.ok ? "Draft valid" : `${validation.errors.length} validation ${validation.errors.length === 1 ? "error" : "errors"}`;
  saveValidation.className = validation.ok ? "subtle" : "field-error";
  saveButton.disabled = saving || !dirty || !validation.ok || fieldErrors.size > 0 || !note;
  if (conflict) saveMessage.innerHTML = 'The data changed elsewhere. <button id="stale-reload" type="button">Reload latest data</button> (this discards this draft).';
}
function render() {
  if (!server || !draft) return; validation = validate(draft);
  const active = history?.revisions?.find((entry) => entry.id === revision);
  summary.textContent = `Revision ${revision} · schema ${draft.schemaVersion} · ${validation.ok ? "valid" : "invalid"}${active?.createdAt ? ` · ${active.createdAt}` : ""}`;
  dirtyState.textContent = deepEqual(draft, server) ? "No unsaved changes" : "Unsaved changes — review the Changes section before saving.";
  mount.innerHTML = [renderOverview(), renderTowers(), renderEnemies(), renderUpgrades(), renderCampaign(), renderEndless(), renderHistory(), renderWorkflow(), renderChanges()].join("");
  updateSaveBar(); wireRenderedControls(); applySearch();
}
function localError(path, message, renderAfter = true) { fieldErrors.set(path, message); if (renderAfter) render(); else { validation = validate(draft); updateSaveBar(); } }
function applyEdit(element, renderAfter = true) {
  const path = element.dataset.editPath, kind = element.dataset.kind; let value;
  if (kind === "boolean") value = element.checked;
  else if (kind === "string") value = element.value;
  else { if (element.value.trim() === "") return localError(path, "Enter a value; empty values are not saved.", renderAfter); value = Number(element.value); if (!Number.isFinite(value) || (kind === "integer" && !Number.isInteger(value))) return localError(path, kind === "integer" ? "Enter a whole number." : "Enter a finite number.", renderAfter); }
  fieldErrors.delete(path); setByPath(draft, path, value); conflict = false; saveMessage.textContent = ""; saveMessage.className = "save-message";
  if (renderAfter) render(); else { validation = validate(draft); updateSaveBar(); }
}
function swap(items, from, to) { if (to < 0 || to >= items.length) return; [items[from], items[to]] = [items[to], items[from]]; }
function applyCrud(button) {
  const { crud, level: levelId, wave: waveText, group: groupText } = button.dataset, waveIndex = Number(waveText), groupIndex = Number(groupText);
  const waves = draft.levels[levelId].waves, wave = waves[waveIndex], groups = wave?.groups;
  if (crud === "wave-add") waves.splice(waveIndex + 1, 0, { groups: [{ type: "basic", count: 1 }] });
  if (crud === "wave-up") swap(waves, waveIndex, waveIndex - 1);
  if (crud === "wave-down") swap(waves, waveIndex, waveIndex + 1);
  if (crud === "wave-delete" && confirm(`Delete wave ${waveIndex + 1}?`)) waves.splice(waveIndex, 1);
  if (crud === "group-add") groups.splice(groupIndex + 1, 0, { type: "basic", count: 1 });
  if (crud === "group-duplicate") groups.splice(groupIndex + 1, 0, clone(groups[groupIndex]));
  if (crud === "group-up") swap(groups, groupIndex, groupIndex - 1);
  if (crud === "group-down") swap(groups, groupIndex, groupIndex + 1);
  if (crud === "group-delete" && confirm(`Delete group ${groupIndex + 1} from wave ${waveIndex + 1}?`)) groups.splice(groupIndex, 1);
  conflict = false; render();
}
function wireRenderedControls() {
  document.querySelector("#world-picker")?.addEventListener("change", (event) => { selectedWorldId = event.target.value; selectedLevelId = null; render(); });
  document.querySelector("#level-picker")?.addEventListener("change", (event) => { selectedLevelId = event.target.value; render(); });
  document.querySelector("#history-filter")?.addEventListener("input", (event) => {
    historyFilter = event.target.value; render();
    const filter = document.querySelector("#history-filter");
    filter?.focus(); filter?.setSelectionRange(historyFilter.length, historyFilter.length);
  });
  document.querySelectorAll("[data-edit-path]").forEach((input) => {
    input.addEventListener("input", () => applyEdit(input, false));
    input.addEventListener("change", () => applyEdit(input));
  });
  document.querySelectorAll("[data-crud]").forEach((button) => button.addEventListener("click", () => applyCrud(button)));
  document.querySelectorAll("[data-history-action]").forEach((button) => button.addEventListener("click", () => {
    const entry = history?.revisions?.find((revisionEntry) => revisionEntry.id === button.dataset.historyId);
    if (!entry) return;
    if (button.dataset.historyAction === "diff") { selectedHistoryId = entry.id; render(); }
    if (button.dataset.historyAction === "restore") restoreFromRevision(entry);
  }));
}
async function loadRevisionSnapshot(entry) {
  const cached = historySnapshots.get(entry.id);
  if (cached) return cached;
  const task = fetch(`/balance-history/${encodeURIComponent(entry.file)}`, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load revision ${entry.id}.`);
    const snapshot = await response.json();
    if (!snapshot?.data) throw new Error(`Revision ${entry.id} has no balance data.`);
    return snapshot;
  });
  historySnapshots.set(entry.id, task);
  try { const snapshot = await task; historySnapshots.set(entry.id, snapshot); return snapshot; }
  catch (error) { historySnapshots.delete(entry.id); throw error; }
}
async function prepareHistory() {
  const chronological = [...(history?.revisions || [])].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  await Promise.all(chronological.map((entry) => loadRevisionSnapshot(entry).catch(() => null)));
  historyChangeCounts = new Map();
  chronological.forEach((entry, index) => {
    if (index === 0) { historyChangeCounts.set(entry.id, 0); return; }
    const previous = historySnapshots.get(chronological[index - 1].id), current = historySnapshots.get(entry.id);
    historyChangeCounts.set(entry.id, previous?.data && current?.data ? diffValues(previous.data, current.data).length : null);
  });
}
async function refreshHistory() {
  const response = await fetch("/api/balance/history", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not refresh revision history.");
  history = await response.json();
  await prepareHistory();
}
async function restoreFromRevision(entry) {
  try {
    const snapshot = await loadRevisionSnapshot(entry);
    draft = clone(snapshot.data); fieldErrors.clear(); conflict = false; noteInput.value = `restored from ${entry.id}`;
    saveMessage.textContent = `Loaded ${entry.id} into the draft. Review Changes, then save to create a new revision.`;
    saveMessage.className = "save-message";
    render();
    document.querySelector("#changes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { saveMessage.textContent = error.message; saveMessage.className = "save-message error"; }
}
async function loadFromServer(discarding = false) {
  if (!discarding && server && !deepEqual(draft, server) && !confirm("Reload latest data and discard your unsaved draft?")) return;
  reloadButton.disabled = true;
  try { const response = await fetch("/api/balance", { cache: "no-store" }); if (!response.ok) throw new Error("The Balance Lab API did not return balance data."); const balance = await response.json(); await refreshHistory(); server = balance.data; draft = clone(balance.data); revision = balance.revision; fieldErrors.clear(); conflict = false; saveMessage.textContent = ""; render(); }
  catch (error) { renderOffline(error); } finally { reloadButton.disabled = false; }
}
async function saveDraft() {
  validation = validate(draft); const note = noteInput.value.trim(); if (!validation.ok || !note || deepEqual(server, draft)) { render(); return; }
  saving = true; saveMessage.textContent = "Saving locally…"; saveMessage.className = "save-message"; updateSaveBar();
  try {
    const response = await fetch("/api/balance/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseRevision: revision, note, data: draft }) });
    const result = await response.json().catch(() => ({}));
    if (response.status === 409) { conflict = true; saveMessage.className = "save-message stale"; render(); return; }
    if (!response.ok) throw new Error(result.error || "The server rejected this revision.");
    revision = result.revision; server = clone(draft); noteInput.value = ""; fieldErrors.clear(); conflict = false; await refreshHistory(); saveMessage.textContent = `Saved revision ${revision}.`; saveMessage.className = "save-message success"; render();
  } catch (error) { saveMessage.textContent = error.message; saveMessage.className = "save-message error"; }
  finally { saving = false; updateSaveBar(); }
}
function renderOffline(error) { summary.textContent = "Local server unavailable"; mount.innerHTML = `<section class="offline-panel"><h2>Balance Lab needs the local server</h2><p>Run <code>./serve.ps1</code> and open this page from <code>http://localhost:8420/balance-lab.html</code>.</p><p class="subtle">${escapeHtml(error?.message || "")}</p></section>`; }

reloadButton.addEventListener("click", () => loadFromServer());
resetButton.addEventListener("click", () => { if (!server || ( !deepEqual(draft, server) && !confirm("Reset this draft and discard unsaved changes?"))) return; draft = clone(server); fieldErrors.clear(); conflict = false; saveMessage.textContent = "Draft reset."; saveMessage.className = "save-message"; render(); });
searchInput.addEventListener("input", () => { searchTerm = searchInput.value; applySearch(); });
noteInput.addEventListener("input", updateSaveBar);
saveButton.addEventListener("click", saveDraft);
saveMessage.addEventListener("click", (event) => {
  if (event.target.id === "stale-reload" && confirm("Reload the latest data and discard your unsaved draft?")) loadFromServer(true);
});
window.addEventListener("beforeunload", (event) => { if (server && draft && !deepEqual(draft, server)) { event.preventDefault(); event.returnValue = ""; } });
loadFromServer(true);
