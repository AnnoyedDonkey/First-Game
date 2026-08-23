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
//
// `lastDiagnostics` is captured BEFORE a session is torn down, because
// failSession() nulls currentSession — without it, a dropped connection
// reported nothing about why, at exactly the moment it mattered.
let lastDiagnostics = null;

export function getDiagnostics() {
  const s = currentSession;
  if (!s) {
    return lastDiagnostics
      ? { ...lastDiagnostics, state: connectionState, stale: true }
      : { state: connectionState, role: null, code: null };
  }
  return snapshotDiagnostics(s);
}

function snapshotDiagnostics(s) {
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
    candidateTypes: s.candidateTypes || null,
    iceErrors: s.iceErrors || [],
    iceHistory: s.iceHistory || [],
    turnStatus: s.turnStatus || null,
    connectedAt: s.connectedAt || null,
    connectedSeconds: s.connectedAt
      ? Math.round((Date.now() - s.connectedAt) / 1000)
      : null,
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

  // Async because the ICE server list may be fetched (TURN credentials are
  // minted per session and cannot be baked into a static site). The room code
  // is already minted above, so hostSession() can still expose it immediately.
  (async () => {
    assertRuntimeAvailable();
    const iceServers = await resolveIceServers(session);
    setupPeerConnection(session, iceServers);
    await runner(session);
  })().catch((error) => failSession(session, error));

  return connected;
}

// TURN credentials are short-lived, so they are cached only for their own TTL.
let cachedIce = null; // { servers, expiresAt }

// Builds the ICE server list: always the static STUN entries, plus TURN relay
// servers minted on demand when COOP.turnEndpoint is configured.
//
// A TURN failure is NEVER fatal here. Without a relay, same-LAN and most
// cross-network pairs still connect on host/srflx candidates; falling back to
// STUN-only preserves every case that already worked, and the reason is
// recorded so the spike page can show it.
async function resolveIceServers(session) {
  const base = [...COOP.iceServers];
  if (!COOP.turnEndpoint) {
    session.turnStatus = "disabled";
    return base;
  }
  if (cachedIce && cachedIce.expiresAt > Date.now()) {
    session.turnStatus = "cached";
    session.expectsRelay = true;
    return [...base, ...cachedIce.servers];
  }
  try {
    const url = `${LEADERBOARD.url.replace(/\/+$/, "")}${COOP.turnEndpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      signal: session.abortController.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      session.turnStatus = `error ${response.status} ${body?.error || ""}`.trim();
      return base;
    }
    const servers = Array.isArray(body?.iceServers) ? body.iceServers : [];
    if (!servers.length) {
      session.turnStatus = "empty";
      return base;
    }
    // Refresh a little before expiry rather than exactly at it.
    const ttlMs = Math.max(60, (body.ttl || 3600) - 60) * 1000;
    cachedIce = { servers, expiresAt: Date.now() + ttlMs };
    session.turnStatus = "ok";
    session.expectsRelay = true;
    return [...base, ...servers];
  } catch (error) {
    session.turnStatus = `failed: ${String(error).slice(0, 60)}`;
    return base;
  }
}

function setupPeerConnection(session, iceServers) {
  const pc = new RTCPeerConnection({ iceServers: iceServers || COOP.iceServers });
  session.pc = pc;
  session.localCandidates = 0;

  // Diagnostic only. A stalled attempt reporting 0 candidates means ICE never
  // produced anything (blocked/odd network); a healthy count with a stalled
  // gathering state means Safari simply never said "complete" — two very
  // different problems that look identical from the outside.
  //
  // The TYPE breakdown is what actually explains an ICE failure:
  //   host  — only reachable on the same LAN, and if it is mDNS-obfuscated
  //           (a .local name) the remote peer has to resolve it, which iOS
  //           Safari does not do reliably for a REMOTE peer's candidate.
  //   srflx — the public address from STUN. Between two peers behind the SAME
  //           router this only works if the router does NAT hairpinning, and
  //           plenty of home routers do not.
  //   relay — a TURN relay. Always works, and is the only fix when the other
  //           two cannot reach each other. Zero relay candidates means there
  //           is no fallback path at all.
  session.candidateTypes = { host: 0, srflx: 0, relay: 0, mdns: 0, other: 0 };
  pc.onicecandidate = (event) => {
    const c = event.candidate;
    if (!c) return;
    session.localCandidates += 1;
    const type = c.type || (c.candidate.match(/ typ (\w+)/) || [])[1] || "other";
    if (type in session.candidateTypes) session.candidateTypes[type] += 1;
    else session.candidateTypes.other += 1;
    // A host candidate whose address is a .local name must be resolved over
    // mDNS by the peer — the exact step that tends to fail on iOS.
    if (type === "host" && /\.local/i.test(c.address || c.candidate)) {
      session.candidateTypes.mdns += 1;
    }
  };

  // Surfaces STUN/TURN server problems, which are otherwise completely silent.
  pc.onicecandidateerror = (event) => {
    session.iceErrors = session.iceErrors || [];
    if (session.iceErrors.length < 5) {
      session.iceErrors.push(`${event.errorCode} ${event.errorText || ""}`.trim());
    }
  };

  pc.oniceconnectionstatechange = () => {
    session.iceHistory = session.iceHistory || [];
    session.iceHistory.push(pc.iceConnectionState);
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
    session.connectedAt = Date.now();
    transition(session, CONNECTION_STATES.CONNECTED);
    startKeepalive(session);
  }
  if (!session.settled) {
    session.settled = true;
    clearTimeout(session.timeoutId);
    session.timeoutId = null;
    session.resolve({ role: session.role, code: session.code });
  }
}

// A silent connection can have its NAT mapping reclaimed mid-session. The real
// game will push snapshots constantly and never go quiet, but the spike page
// sits idle between manual pings — which is exactly the condition that makes a
// connection "work, then die a minute later". Cheap insurance either way.
function startKeepalive(session) {
  if (session.keepaliveId) return;
  session.keepaliveId = setInterval(() => {
    if (session !== currentSession) return;
    if (session.channels.cmd?.readyState !== "open") return;
    try {
      session.channels.cmd.send(JSON.stringify({ type: "keepalive" }));
    } catch {
      // A send failure here is not itself fatal; the connection-state
      // handler owns deciding the session is done.
    }
  }, COOP.keepaliveMs);
}

async function runHost(session) {
  step(session, "creating-offer");
  const offer = await session.pc.createOffer();
  await session.pc.setLocalDescription(offer);
  step(session, "gathering-ice");
  await waitForIceGathering(session.pc, session.abortController.signal, session);
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
  await waitForIceGathering(session.pc, session.abortController.signal, session);
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
function waitForIceGathering(pc, signal, session) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let softTimer = null;
    let hardTimer = null;
    const finish = () => {
      if (softTimer !== null) clearTimeout(softTimer);
      if (hardTimer !== null) clearTimeout(hardTimer);
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

    // Relay candidates are the SLOWEST to appear — they need a TURN
    // allocation round trip — and on this network they are also the only ones
    // that work. Publishing before they exist would throw away the entire
    // reason TURN is configured, so when a relay is expected we hold out for
    // one rather than firing on the base timeout.
    const wantsRelay = !!(session && session.expectsRelay);
    const haveRelay = () => (session?.candidateTypes?.relay || 0) > 0;
    const softMs = COOP.iceGatheringTimeoutMs;
    const hardMs = wantsRelay ? COOP.iceGatheringRelayTimeoutMs : COOP.iceGatheringTimeoutMs;

    const trySoft = () => {
      // Enough is enough once we have what we came for.
      if (!wantsRelay || haveRelay()) {
        finish();
        resolve();
        return;
      }
      // Still no relay: keep waiting, re-checking as candidates trickle in.
      softTimer = setTimeout(trySoft, 250);
    };

    pc.addEventListener("icegatheringstatechange", onStateChange);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }

    softTimer = setTimeout(trySoft, softMs);
    // Absolute ceiling. Resolve rather than reject — partial candidates still
    // beat not connecting, and Safari may never report "complete" at all.
    hardTimer = setTimeout(() => {
      if (session) session.gatheringTimedOut = Math.round((Date.now() - startedAt) / 1000);
      finish();
      resolve();
    }, hardMs);
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
  // Freeze the internals before we tear them down — this snapshot is the only
  // record of why a live connection dropped.
  lastDiagnostics = snapshotDiagnostics(session);
  clearTimeout(session.timeoutId);
  session.timeoutId = null;
  if (session.keepaliveId) {
    clearInterval(session.keepaliveId);
    session.keepaliveId = null;
  }
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
