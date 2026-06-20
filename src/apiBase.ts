/** Companion API base — resolved from runtime (dev proxy, local companion, hosted web). */

import axios from 'axios';
import { getRuntimeEnvSync, isHostedWebApp, isLocalDevWeb } from './runtimeEnv';

const COMPANION_DIRECT = 'http://127.0.0.1:3001';

function normalizeBase(raw: string): string {
  return raw.replace(/\/$/, '');
}

function readStoredApiBase(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem('fa7_api_base')?.trim();
    return v ? normalizeBase(v) : null;
  } catch {
    return null;
  }
}

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) return normalizeBase(fromEnv);

  const stored = readStoredApiBase();
  if (stored) return stored;

  if (import.meta.env.DEV) return '/api';

  if (typeof window !== 'undefined') {
    if (isHostedWebApp()) return '/api';
    if (isLocalDevWeb()) return 'http://localhost:3001/api';
    return '/api';
  }

  return 'http://localhost:3001/api';
}

export const API_BASE = resolveApiBase();

/** Whether API calls should target a local companion backend. */
export function expectsCompanionBackend(): boolean {
  return getRuntimeEnvSync().usesCompanionApi;
}

/**
 * Call once when companion direct connection is confirmed.
 * Patches BOTH axios AND window.fetch so every /api/... call
 * in every component is redirected to http://127.0.0.1:3001/api/...
 */
let _interceptorInstalled = false;

export function installCompanionInterceptor(): void {
  if (_interceptorInstalled || !isHostedWebApp()) return;
  _interceptorInstalled = true;

  // --- 1. Axios interceptor ---
  axios.interceptors.request.use((config) => {
    const url = config.url ?? '';
    if (url.startsWith('/api') || url.startsWith('api/')) {
      const path = url.startsWith('/') ? url : `/${url}`;
      config.url = `${COMPANION_DIRECT}${path}`;
      if (config.baseURL?.startsWith('/')) config.baseURL = COMPANION_DIRECT;
    }
    return config;
  });

  // --- 2. window.fetch patch (for streaming calls like /api/ai/chat) ---
  if (typeof window !== 'undefined') {
    const _origFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      let url = typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : (input as Request).url;

      if (url.startsWith('/api') || url.startsWith('api/')) {
        const path = url.startsWith('/') ? url : `/${url}`;
        const newUrl = `${COMPANION_DIRECT}${path}`;
        if (typeof input === 'string') {
          return _origFetch(newUrl, init);
        } else if (input instanceof URL) {
          return _origFetch(new URL(newUrl), init);
        } else {
          return _origFetch(new Request(newUrl, input as Request), init);
        }
      }
      return _origFetch(input, init);
    };
  }
}

export function isInterceptorInstalled(): boolean {
  return _interceptorInstalled;
}
