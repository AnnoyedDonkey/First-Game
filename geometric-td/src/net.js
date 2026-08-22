// ============================================================
// CO-OP TRANSPORT — Phase 0 connection spike only.
//
// Supabase carries a single complete offer/answer exchange. WebRTC then
// carries messages over two channels: reliable `cmd` and lossy `state`.
// No gameplay protocol belongs here.
// ============================================================

import { COOP, LEADERBOARD } from "./config.js";

// Table name is a COOP knob, mirroring LEADERBOARD.table / FEEDBACK.table.
const SESSION_TABLE = COOP.table;

export const CONNECTION_STATES = Object.freeze({
  IDLE: "idle",
  SIGNALING: "signaling",
  WAITING_FOR_PEER: "waiting-for-peer",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  FAILED: "failed",
  CLOSED: "closed",
});

const ALLOWED_TRANSITIONS = {
  [CONNECTION_STATES.IDLE]: [CONNECTION_STATES.SIGNALING],
  [CONNECTION_STATES.SIGNALING]: [
    CONNECTION_STATES.WAITING_FOR_PEER,
    CONNECTION_STATES.CONNECTING,
    CONNECTION_STATES.FAILED,
    CONNECTION_STATES.CLOSED,
  ],
  [CONNECTION_STATES.WAITING_FOR_PEER]: [
    CONNECTION_STATES.CONNECTING,
    CONNECTION_STATES.FAILED,
    CONNECTION_STATES.CLOSED,
  ],
  [CONNECTION_STATES.CONNECTING]: [
    CONNECTION_STATES.CONNECTED,
    CONNECTION_STATES.DISCONNECTED,
    CONNECTION_STATES.FAILED,
    CONNECTION_STATES.CLOSED,
  ],
  [CONNECTION_STATES.CONNECTED]: [
    CONNECTION_STATES.DISCONNECTED,
    CONNECTION_STATES.FAILED,
    CONNECTION_STATES.CLOSED,
  ],
  [CONNECTION_STATES.DISCONNECTED]: [
    CONNECTION_STATES.CONNECTED,
    CONNECTION_STATES.FAILED,
    CONNECTION_STATES.CLOSED,
  ],
  [CONNECTION_STATES.FAILED]: [CONNECTION_STATES.SIGNALING],
  [CONNECTION_STATES.CLOSED]: [CONNECTION_STATES.SIGNALING],
};

const stateListeners = new Set();
const messageListeners = new Set();

let currentSession = null;
let connectionState = CONNECTION_STATES.IDLE;
let lastStateEvent = {
  state: CONNECTION_STATES.IDLE,
  previous: null,
  role: null,
  code: null,
};

// The host promise exposes `.code` immediately, then resolves only once both
// data channels are open:
//   const pending = hostSession(); show(pending.code); await pending;
export function hostSession() {
  const code = mintRoomCode();
  const pending = startSession("host", code, runHost);
  Object.defineProperty(pending, "code", { value: code, enumerable: true });
  return pending;
}

// Resolves with { role, code } once both data channels are open.
export function joinSession(code) {
  const normalized = normalizeRoomCode(code);
  return startSession("guest", normalized, runGuest);
}

export function onConnectionState(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Connection-state callback must be a function");
  }
  stateListeners.add(callback);
  callback(lastStateEvent);
  return () => stateListeners.delete(callback);
}

// callback({ channel: "cmd" | "state", data, event })
export function onMessage(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Message callback must be a function");
  }
  messageListeners.add(callback);
  return () => messageListeners.delete(callback);
}

export function sendMessage(channelName, data) {
  const channel = currentSession?.channels[channelName];
  if (!channel || channel.readyState !== "open") {
    throw new Error(`Data channel "${channelName}" is not open`);
  }
  channel.send(serializeMessage(data));
}

export function getConnectionState() {
  return connectionState;
}

export function getRoomCode() {
  return currentSession?.code || null;
}

export function closeSession(reason = "Session closed") {
  const session = currentSession;
  if (!session) return;

  if (!session.settled) {
    session.settled = true;
    session.reject(new Error(reason));
  }
  cleanupSession(session);
  transition(session, CONNECTION_STATES.CLOSED, { reason });
  currentSession = null;
}

// Live view of the connection internals, for the spike page. Phase 0's whole
// job is diagnosis, and a phone that only says "it didn't work" costs a whole
// test cycle — this makes the failing STEP visible on the device itself.
export function getDiagnostics() {
  const s = currentSession;
  if (!s) return { state: connectionState, role: null, code: null };
  return {
    state: connectionState,
    role: s.role,
    code: s.code,
    step: s.step || null,
    iceGathering: s.pc ? s.pc.iceGatheringState : null,
    iceConnection: s.pc ? s.pc.iceConnectionState : null,
    signaling: s.pc ? s.pc.signalingState : null,
    peer: s.pc ? s.pc.connectionState : null,
    localCandidates: s.localCandidates || 0,
    channels: {
      cmd: s.channels.cmd ? s.channels.cmd.readyState : null,
      state: s.channels.state ? s.channels.state.readyState : null,
    },
  };
}

// Records the named step so a stalled attempt names where it stopped. This
// deliberately does NOT go through transition() — the connection state machine
// has its own legal transitions, and a diagnostic breadcrumb is not one of
// them. The spike page polls getDiagnostics() instead.
function step(session, name) {
  session.step = name;
}

function startSession(role, code, runner) {
  validateConfig();
  if (currentSession) closeSession("Replaced by a new connection attempt");

  let resolve;
  let reject;
  const connected = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  const session = {
    role,
    code,
    pc: null,
    channels: { cmd: null, state: null },
    abortController: new AbortController(),
    timeoutId: null,
    resolve,
    reject,
    settled: false,
  };
  currentSession = session;
  transition(session, CONNECTION_STATES.SIGNALING);

  session.timeoutId = setTimeout(() => {
    failSession(session, new Error("Connection attempt timed out"));
  }, COOP.connectTimeoutMs);

  try {
    assertRuntimeAvailable();
    setupPeerConnection(session);
    runner(session).catch((error) => failSession(session, error));
  } catch (error) {
    failSession(session, error);
  }

  return connected;
}

function setupPeerConnection(session) {
  const pc = new RTCPeerConnection({ iceServers: COOP.iceServers });
  session.pc = pc;
  session.localCandidates = 0;

  // Diagnostic only. A stalled attempt reporting 0 candidates means ICE never
  // produced anything (blocked/odd network); a healthy count with a stalled
  // gathering state means Safari simply never said "complete" — two very
  // different problems that look identical from the outside.
  pc.onicecandidate = (event) => {
    if (event.candidate) session.localCandidates += 1;
  };

  pc.onconnectionstatechange = () => {
    if (session !== currentSession) return;
    if (pc.connectionState === "connected") {
      markConnectedIfReady(session);
    } else if (pc.connectionState === "disconnected") {
      if (
        connectionState === CONNECTION_STATES.CONNECTING ||
        connectionState === CONNECTION_STATES.CONNECTED
      ) {
        transition(session, CONNECTION_STATES.DISCONNECTED);
      }
    } else if (pc.connectionState === "failed") {
      failSession(session, new Error("WebRTC peer connection failed"));
    } else if (pc.connectionState === "closed") {
      closeSession("Peer connection closed");
    }
  };

  if (session.role === "host") {
    attachDataChannel(session, pc.createDataChannel("cmd", { ordered: true }));
    attachDataChannel(
      session,
      pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 })
    );
  } else {
    pc.ondatachannel = (event) => attachDataChannel(session, event.channel);
  }
}

function attachDataChannel(session, channel) {
  if (channel.label !== "cmd" && channel.label !== "state") {
    channel.close();
    return;
  }
  if (session.channels[channel.label]) {
    channel.close();
    return;
  }

  session.channels[channel.label] = channel;
  channel.binaryType = "arraybuffer";
  channel.onopen = () => markConnectedIfReady(session);
  channel.onmessage = (event) => {
    for (const callback of messageListeners) {
      try {
        callback({ channel: channel.label, data: event.data, event });
      } catch (error) {
        console.error("Co-op message callback failed:", error);
      }
    }
  };
  channel.onclose = () => {
    if (session !== currentSession) return;
    if (!session.settled) {
      failSession(session, new Error(`Data channel "${channel.label}" closed`));
    } else if (connectionState === CONNECTION_STATES.CONNECTED) {
      transition(session, CONNECTION_STATES.DISCONNECTED);
    }
  };
  channel.onerror = () => {
    if (!session.settled) {
      failSession(session, new Error(`Data channel "${channel.label}" failed`));
    }
  };
}

function markConnectedIfReady(session) {
  if (session !== currentSession) return;
  const bothOpen =
    session.channels.cmd?.readyState === "open" &&
    session.channels.state?.readyState === "open";
  if (!bothOpen) return;

  if (connectionState !== CONNECTION_STATES.CONNECTED) {
    transition(session, CONNECTION_STATES.CONNECTED);
  }
  if (!session.settled) {
    session.settled = true;
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
    session.resolve({ role: session.role, code: session.code });
  }
}

async function runHost(session) {
  step(session, "creating-offer");
  const offer = await session.pc.createOffer();
  await session.pc.setLocalDescription(offer);
  step(session, "gathering-ice");
  await waitForIceGathering(session.pc, session.abortController.signal);
  step(session, "publishing-offer");
  await insertOffer(session);
  step(session, "polling-for-answer");
  transition(session, CONNECTION_STATES.WAITING_FOR_PEER);

  while (session === currentSession && !session.abortController.signal.aborted) {
    const row = await readSessionRow(session.code, "answer");
    if (!row) throw new Error("Signaling session disappeared");
    if (row.answer) {
      step(session, "applying-answer");
      await session.pc.setRemoteDescription(parseDescription(row.answer));
      transition(session, CONNECTION_STATES.CONNECTING);
      return;
    }
    await delay(COOP.signalingPollMs, session.abortController.signal);
  }
}

async function runGuest(session) {
  step(session, "reading-room");
  const row = await readSessionRow(
    session.code,
    "offer,created_at,last_seen"
  );
  if (!row) throw new Error("Room code not found");
  if (!isFreshSession(row)) throw new Error("Room code has expired");
  if (!row.offer) throw new Error("Host offer is not ready");

  step(session, "applying-offer");
  await session.pc.setRemoteDescription(parseDescription(row.offer));
  step(session, "creating-answer");
  const answer = await session.pc.createAnswer();
  await session.pc.setLocalDescription(answer);
  step(session, "gathering-ice");
  await waitForIceGathering(session.pc, session.abortController.signal);
  step(session, "publishing-answer");
  await writeAnswer(session);
  step(session, "awaiting-peer");
  transition(session, CONNECTION_STATES.CONNECTING);
}

async function insertOffer(session) {
  const response = await fetch(sessionTableUrl(), {
    method: "POST",
    headers: {
      ...authHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      code: session.code,
      offer: session.pc.localDescription.toJSON(),
    }),
    signal: session.abortController.signal,
  });
  await requireOk(response, "Could not publish host offer");
}

async function writeAnswer(session) {
  const response = await fetch(sessionRowUrl(session.code), {
    method: "PATCH",
    headers: {
      ...authHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      answer: session.pc.localDescription.toJSON(),
      last_seen: new Date().toISOString(),
    }),
    signal: session.abortController.signal,
  });
  await requireOk(response, "Could not publish guest answer");
}

async function readSessionRow(code, select) {
  const response = await fetch(sessionRowUrl(code, select), {
    headers: authHeaders(),
    signal: currentSession?.abortController.signal,
  });
  await requireOk(response, "Could not read signaling session");
  const rows = await response.json();
  return rows[0] || null;
}

function sessionTableUrl() {
  const base = LEADERBOARD.url.replace(/\/+$/, "");
  return `${base}/rest/v1/${SESSION_TABLE}`;
}

function sessionRowUrl(code, select = null) {
  const url = new URL(sessionTableUrl());
  url.searchParams.set("code", `eq.${code}`);
  if (select) url.searchParams.set("select", select);
  return url.toString();
}

function authHeaders() {
  return {
    apikey: LEADERBOARD.anonKey,
    Authorization: `Bearer ${LEADERBOARD.anonKey}`,
    "Content-Type": "application/json",
  };
}

async function requireOk(response, message) {
  if (response.ok) return;
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    // The status code is still useful if the response body is unreadable.
  }
  throw new Error(`${message} (HTTP ${response.status})${detail ? `: ${detail}` : ""}`);
}

// Wait for ICE gathering, but NEVER wait forever.
//
// Safari in particular can leave `iceGatheringState` short of "complete"
// indefinitely, and the original version of this function waited on that state
// alone. The result was silent and total: a guest would gather perfectly good
// candidates, never observe "complete", never publish its answer, and sit
// until the overall connect timeout — leaving a host row with an offer and no
// answer, which is exactly what the first two-device test produced.
//
// Candidates arrive fastest-first (host, then srflx), so whatever we have
// after `COOP.iceGatheringTimeoutMs` is nearly always the full set. Shipping a
// slightly-short candidate list beats not connecting at all.
function waitForIceGathering(pc, signal) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer = null;
    const finish = () => {
      if (timer !== null) clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      signal.removeEventListener("abort", onAbort);
    };
    const onStateChange = () => {
      if (pc.iceGatheringState !== "complete") return;
      finish();
      resolve();
    };
    const onAbort = () => {
      finish();
      reject(new Error("ICE gathering was cancelled"));
    };
    pc.addEventListener("icegatheringstatechange", onStateChange);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }
    // The fallback that makes this safe on Safari. Resolve, don't reject:
    // partial candidates still connect on a LAN.
    timer = setTimeout(() => {
      finish();
      resolve();
    }, COOP.iceGatheringTimeoutMs);
    onStateChange();
  });
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Signaling poll was cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function isFreshSession(row) {
  const timestamp = Date.parse(row.last_seen || row.created_at);
  return Number.isFinite(timestamp) && Date.now() - timestamp <= COOP.sessionTtlMs;
}

function parseDescription(description) {
  return typeof description === "string" ? JSON.parse(description) : description;
}

function serializeMessage(data) {
  const isBlob = typeof Blob !== "undefined" && data instanceof Blob;
  if (
    typeof data === "string" ||
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data) ||
    isBlob
  ) {
    return data;
  }
  return JSON.stringify(data);
}

function mintRoomCode() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random room-code generation is unavailable");
  }
  const alphabet = COOP.roomCodeAlphabet;
  const random = new Uint32Array(COOP.roomCodeLength);
  globalThis.crypto.getRandomValues(random);
  let code = "";
  for (const value of random) code += alphabet[value % alphabet.length];
  return code;
}

function normalizeRoomCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  const valid =
    normalized.length === COOP.roomCodeLength &&
    [...normalized].every((character) => COOP.roomCodeAlphabet.includes(character));
  if (!valid) throw new Error("Invalid room code");
  return normalized;
}

function validateConfig() {
  const alphabet = COOP.roomCodeAlphabet;
  if (
    !Array.isArray(COOP.iceServers) ||
    !COOP.iceServers.length ||
    !Number.isInteger(COOP.roomCodeLength) ||
    COOP.roomCodeLength < 1 ||
    typeof alphabet !== "string" ||
    alphabet.length < 2 ||
    new Set(alphabet).size !== alphabet.length ||
    !(COOP.signalingPollMs > 0) ||
    !(COOP.connectTimeoutMs > 0) ||
    !(COOP.sessionTtlMs > 0)
  ) {
    throw new Error("Invalid COOP configuration");
  }
}

function assertRuntimeAvailable() {
  if (!LEADERBOARD.url || !LEADERBOARD.anonKey) {
    throw new Error("Supabase signaling is not configured");
  }
  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("WebRTC is not available in this browser");
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random room-code generation is unavailable");
  }
}

function failSession(session, error) {
  if (session !== currentSession) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  if (!session.settled) {
    session.settled = true;
    session.reject(failure);
  }
  cleanupSession(session);
  transition(session, CONNECTION_STATES.FAILED, { error: failure.message });
  currentSession = null;
}

function cleanupSession(session) {
  clearTimeout(session.timeoutId);
  session.timeoutId = null;
  session.abortController.abort();

  for (const channel of Object.values(session.channels)) {
    if (!channel) continue;
    channel.onopen = null;
    channel.onmessage = null;
    channel.onclose = null;
    channel.onerror = null;
    if (channel.readyState !== "closed") channel.close();
  }
  if (session.pc) {
    session.pc.onconnectionstatechange = null;
    session.pc.ondatachannel = null;
    if (session.pc.connectionState !== "closed") session.pc.close();
  }
}

function transition(session, nextState, detail = {}) {
  const previous = connectionState;
  if (!ALLOWED_TRANSITIONS[previous]?.includes(nextState)) {
    throw new Error(`Invalid connection-state transition: ${previous} -> ${nextState}`);
  }
  connectionState = nextState;
  lastStateEvent = {
    state: nextState,
    previous,
    role: session.role,
    code: session.code,
    ...detail,
  };
  for (const callback of stateListeners) {
    try {
      callback(lastStateEvent);
    } catch (error) {
      console.error("Co-op state callback failed:", error);
    }
  }
}
