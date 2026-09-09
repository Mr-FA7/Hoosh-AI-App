/**
 * Device / Runtime authentication for Hoosh Local Runtime (Phase 2).
 * Pairing codes, short-lived sessions, revoke, origin allowlist, capabilities.
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const AUTH_PATH = path.join(os.homedir(), '.aivon-os', 'runtime-auth.json');
const SESSIONS_PATH = path.join(os.homedir(), '.aivon-os', 'runtime-sessions.json');
const API_VERSION = 1;
const RUNTIME_VERSION = '1.0.0-runtime';
const PAIR_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'null', // Electron file / some extensions
  'chrome-extension://',
  'moz-extension://'
];

function authEnabled() {
  const v = String(process.env.FA7_DEVICE_AUTH || '1').trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
}

function resolveBindHost() {
  const raw = String(process.env.FA7_BIND || '').trim();
  if (raw) return raw;
  return '127.0.0.1';
}

function isLoopbackAddress(addr) {
  const a = String(addr || '');
  return (
    a === '127.0.0.1' ||
    a === '::1' ||
    a === '::ffff:127.0.0.1' ||
    a.endsWith('127.0.0.1')
  );
}

function loadOrCreateAuth() {
  fs.ensureDirSync(path.dirname(AUTH_PATH));
  try {
    if (fs.existsSync(AUTH_PATH)) {
      const data = fs.readJsonSync(AUTH_PATH);
      if (data?.deviceId && data?.deviceToken) {
        if (!Array.isArray(data.allowedOrigins)) data.allowedOrigins = [...DEFAULT_ORIGINS];
        return data;
      }
    }
  } catch {
    /* recreate */
  }
  const data = {
    deviceId: crypto.randomUUID(),
    deviceToken: crypto.randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
    name: os.hostname() || 'Hoosh Device',
    allowedOrigins: [...DEFAULT_ORIGINS],
    revokedAt: null
  };
  fs.writeJsonSync(AUTH_PATH, data, { spaces: 2 });
  try { fs.chmodSync(AUTH_PATH, 0o600); } catch { /* ignore */ }
  return data;
}

function persistAuth(state) {
  fs.writeJsonSync(AUTH_PATH, state, { spaces: 2 });
  try { fs.chmodSync(AUTH_PATH, 0o600); } catch { /* ignore */ }
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      const data = fs.readJsonSync(SESSIONS_PATH);
      return Array.isArray(data?.sessions) ? data.sessions : [];
    }
  } catch {
    /* empty */
  }
  return [];
}

function persistSessions(sessions) {
  fs.ensureDirSync(path.dirname(SESSIONS_PATH));
  fs.writeJsonSync(SESSIONS_PATH, { sessions }, { spaces: 2 });
  try { fs.chmodSync(SESSIONS_PATH, 0o600); } catch { /* ignore */ }
}

function defaultCapabilities() {
  return {
    filesystem: true,
    terminal: true,
    git: true,
    docker: true,
    browser: true,
    computerUse: process.platform === 'darwin',
    mcp: true,
    skills: true,
    localModels: true,
    apiVersion: API_VERSION,
    os: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    runtimeVersion: RUNTIME_VERSION
  };
}

function extractToken(req) {
  const h = req.headers || {};
  const dedicated = h['x-hoosh-device-token'] || h['x-hoosh-runtime-token'] || h['x-hoosh-session-token'];
  if (dedicated) return String(dedicated).trim();
  const auth = String(h.authorization || '');
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  if (req.query && (req.query.hooshToken || req.query.sessionToken)) {
    return String(req.query.hooshToken || req.query.sessionToken).trim();
  }
  return '';
}

function originAllowed(origin, allowedOrigins) {
  if (!origin) return true; // non-browser clients (CLI)
  const o = String(origin);
  const list = allowedOrigins || DEFAULT_ORIGINS;
  for (const entry of list) {
    if (entry === o) return true;
    if (entry.endsWith('://') && o.startsWith(entry)) return true;
  }
  // Same-machine Vite / Electron common patterns
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(o)) return true;
  return false;
}

function createDeviceAuth(opts = {}) {
  const state = loadOrCreateAuth();
  let sessions = loadSessions().filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > Date.now());
  /** @type {{ code: string, expiresAt: number, createdAt: string } | null} */
  let pendingPair = null;

  function saveSessions() {
    persistSessions(sessions);
  }

  function bootstrapPayload(port) {
    return {
      deviceId: state.deviceId,
      deviceName: state.name,
      runtimeVersion: RUNTIME_VERSION,
      apiVersion: API_VERSION,
      deviceToken: state.deviceToken,
      bindHost: resolveBindHost(),
      bindPort: Number(port) || 3001,
      authRequired: authEnabled(),
      capabilities: defaultCapabilities(),
      allowedOrigins: state.allowedOrigins || DEFAULT_ORIGINS
    };
  }

  function tokenValid(token) {
    if (!token || state.revokedAt) return false;
    if (token === state.deviceToken) return true;
    const now = Date.now();
    const session = sessions.find((s) => s.token === token && !s.revokedAt);
    if (!session) return false;
    if (new Date(session.expiresAt).getTime() <= now) return false;
    session.lastSeenAt = new Date().toISOString();
    return true;
  }

  function createPairingCode() {
    const code = String(crypto.randomInt(100000, 999999));
    pendingPair = {
      code,
      expiresAt: Date.now() + PAIR_TTL_MS,
      createdAt: new Date().toISOString()
    };
    return {
      ok: true,
      code,
      expiresInSec: Math.floor(PAIR_TTL_MS / 1000),
      deviceId: state.deviceId,
      deviceName: state.name,
      capabilities: defaultCapabilities()
    };
  }

  function getPairingStatus() {
    if (!pendingPair) return { ok: true, active: false };
    if (Date.now() > pendingPair.expiresAt) {
      pendingPair = null;
      return { ok: true, active: false };
    }
    return {
      ok: true,
      active: true,
      code: pendingPair.code,
      expiresInSec: Math.max(0, Math.floor((pendingPair.expiresAt - Date.now()) / 1000)),
      deviceId: state.deviceId,
      deviceName: state.name
    };
  }

  function confirmPairing(code, meta = {}) {
    if (!pendingPair || Date.now() > pendingPair.expiresAt) {
      pendingPair = null;
      return { ok: false, error: 'pairing_expired' };
    }
    if (String(code || '').trim() !== pendingPair.code) {
      return { ok: false, error: 'pairing_code_invalid' };
    }
    pendingPair = null;
    const session = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(32).toString('hex'),
      deviceId: state.deviceId,
      label: String(meta.label || meta.clientName || 'Control Plane').slice(0, 80),
      clientName: String(meta.clientName || 'web').slice(0, 80),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      revokedAt: null
    };
    sessions.push(session);
    saveSessions();

    // Also ensure device is marked paired in auth file
    state.pairedAt = state.pairedAt || new Date().toISOString();
    state.lastSeenAt = new Date().toISOString();
    persistAuth(state);

    if (typeof opts.onPaired === 'function') {
      try { opts.onPaired({ deviceId: state.deviceId, sessionId: session.id, capabilities: defaultCapabilities() }); } catch { /* ignore */ }
    }

    return {
      ok: true,
      deviceId: state.deviceId,
      deviceName: state.name,
      sessionId: session.id,
      sessionToken: session.token,
      deviceToken: state.deviceToken,
      expiresAt: session.expiresAt,
      capabilities: defaultCapabilities(),
      apiVersion: API_VERSION,
      runtimeVersion: RUNTIME_VERSION
    };
  }

  function listSessions() {
    const now = Date.now();
    return sessions
      .filter((s) => !s.revokedAt)
      .map((s) => ({
        id: s.id,
        label: s.label,
        clientName: s.clientName,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        expired: new Date(s.expiresAt).getTime() <= now
      }));
  }

  function revokeSession(sessionId) {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, error: 'session_not_found' };
    s.revokedAt = new Date().toISOString();
    saveSessions();
    return { ok: true, sessionId };
  }

  function revokeAllSessions() {
    const at = new Date().toISOString();
    for (const s of sessions) {
      if (!s.revokedAt) s.revokedAt = at;
    }
    saveSessions();
    return { ok: true };
  }

  function rotateDeviceToken() {
    revokeAllSessions();
    state.deviceToken = crypto.randomBytes(32).toString('hex');
    state.rotatedAt = new Date().toISOString();
    state.revokedAt = null;
    persistAuth(state);
    return { ok: true, deviceToken: state.deviceToken, deviceId: state.deviceId };
  }

  function setDeviceName(name) {
    const n = String(name || '').trim().slice(0, 80);
    if (!n) return { ok: false, error: 'name_required' };
    state.name = n;
    persistAuth(state);
    return { ok: true, deviceName: state.name };
  }

  function addAllowedOrigin(origin) {
    const o = String(origin || '').trim();
    if (!o) return { ok: false, error: 'origin_required' };
    if (!state.allowedOrigins) state.allowedOrigins = [...DEFAULT_ORIGINS];
    if (!state.allowedOrigins.includes(o)) state.allowedOrigins.push(o);
    persistAuth(state);
    return { ok: true, allowedOrigins: state.allowedOrigins };
  }

  function middleware(req, res, next) {
    if (!authEnabled()) return next();
    if (req.method === 'OPTIONS') return next();

    const p = String(req.path || '');
    const publicPaths = new Set([
      '/api/v3/runtime/health',
      '/api/v3/runtime/bootstrap',
      '/api/v3/runtime/doctor',
      '/api/v3/runtime/pair/start',
      '/api/v3/runtime/pair/status',
      '/api/v3/runtime/pair/confirm',
      '/api/v3/runtime/capabilities'
    ]);
    if (publicPaths.has(p)) return next();

    const origin = req.headers?.origin || req.headers?.referer || '';
    if (origin && !originAllowed(origin, state.allowedOrigins)) {
      // Referer may be a full URL — check origin header primarily
      if (req.headers?.origin && !originAllowed(req.headers.origin, state.allowedOrigins)) {
        return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
      }
    }

    const token = extractToken(req);
    if (tokenValid(token)) return next();

    // Same-machine Control Plane / Vite proxy / bridge appear as loopback.
    if (isLoopbackAddress(req.socket?.remoteAddress)) return next();

    return res.status(401).json({
      ok: false,
      error: 'device_auth_required',
      hint: 'Pair via /api/v3/runtime/pair/* or bootstrap from loopback with X-Hoosh-Device-Token'
    });
  }

  return {
    state,
    authEnabled: authEnabled(),
    bindHost: resolveBindHost(),
    bootstrapPayload,
    tokenValid,
    middleware,
    createPairingCode,
    getPairingStatus,
    confirmPairing,
    listSessions,
    revokeSession,
    revokeAllSessions,
    rotateDeviceToken,
    setDeviceName,
    addAllowedOrigin,
    defaultCapabilities,
    AUTH_PATH,
    SESSIONS_PATH,
    API_VERSION,
    RUNTIME_VERSION
  };
}

module.exports = {
  createDeviceAuth,
  resolveBindHost,
  authEnabled,
  isLoopbackAddress,
  originAllowed,
  defaultCapabilities,
  AUTH_PATH,
  SESSIONS_PATH,
  API_VERSION,
  RUNTIME_VERSION,
  DEFAULT_ORIGINS
};
