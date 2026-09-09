/**
 * Bootstrap Hoosh Local Runtime credentials for the Control Plane.
 * Stores device token and attaches it to axios + fetch.
 */
import axios from 'axios';
import { API_BASE } from '../apiBase';

const TOKEN_KEY = 'hoosh_device_token_v1';
const DEVICE_KEY = 'hoosh_device_id_v1';

let installed = false;
let cachedToken: string | null = null;

function readToken(): string | null {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

function writeToken(token: string, deviceId?: string) {
  cachedToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
    if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId);
  } catch {
    /* ignore */
  }
}

function attachAuthHeader(headers: HeadersInit | undefined, token: string): HeadersInit {
  if (!headers) return { 'X-Hoosh-Device-Token': token };
  if (headers instanceof Headers) {
    headers.set('X-Hoosh-Device-Token', token);
    return headers;
  }
  if (Array.isArray(headers)) {
    return [...headers, ['X-Hoosh-Device-Token', token]];
  }
  return { ...headers, 'X-Hoosh-Device-Token': token };
}

export function installRuntimeAuthInterceptors(): void {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const token = readToken();
    if (!token) return config;
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['X-Hoosh-Device-Token'] = token;
    return config;
  });

  if (typeof window !== 'undefined') {
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const token = readToken();
      if (!token) return orig(input, init);
      const nextInit: RequestInit = { ...(init || {}) };
      nextInit.headers = attachAuthHeader(nextInit.headers, token);
      return orig(input, nextInit);
    };
  }
}

export async function bootstrapRuntimeAuth(): Promise<{ ok: boolean; deviceId?: string; error?: string }> {
  installRuntimeAuthInterceptors();
  try {
    const existing = readToken();
    if (existing) return { ok: true };

    // Prefer direct loopback bootstrap (required when auth is on).
    const urls = [
      'http://127.0.0.1:3001/api/v3/runtime/bootstrap',
      `${API_BASE.replace(/\/$/, '')}/v3/runtime/bootstrap`.replace('/api/api/', '/api/')
    ];
    // Normalize proxy path: API_BASE is often `/api` → `/api/v3/...`
    const viaProxy = API_BASE.endsWith('/api') || API_BASE.endsWith('/api/')
      ? `${API_BASE.replace(/\/$/, '')}/v3/runtime/bootstrap`
      : null;
    const tryUrls = viaProxy ? [viaProxy, urls[0]] : urls;

    for (const url of tryUrls) {
      try {
        const res = await axios.get(url, { timeout: 2500 });
        const token = String(res.data?.deviceToken || '').trim();
        const deviceId = String(res.data?.deviceId || '').trim();
        if (token) {
          writeToken(token, deviceId || undefined);
          return { ok: true, deviceId };
        }
      } catch {
        /* try next */
      }
    }
    return { ok: false, error: 'runtime_bootstrap_failed' };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'bootstrap_error' };
  }
}

export function getCachedDeviceToken(): string | null {
  return readToken();
}

export function storePairingSession(opts: {
  sessionToken: string;
  deviceToken?: string;
  deviceId?: string;
}): void {
  installRuntimeAuthInterceptors();
  writeToken(opts.sessionToken || opts.deviceToken || '', opts.deviceId);
  if (opts.deviceToken && opts.deviceToken !== opts.sessionToken) {
    try {
      localStorage.setItem('hoosh_device_token_long_v1', opts.deviceToken);
    } catch {
      /* ignore */
    }
  }
}

export function clearCachedDeviceToken(): void {
  cachedToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem('hoosh_device_token_long_v1');
  } catch {
    /* ignore */
  }
}
