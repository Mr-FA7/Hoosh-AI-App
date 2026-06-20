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
 * Installs an axios interceptor that rewrites all /api/... requests
 * to http://127.0.0.1:3001/api/... so EVERY component works automatically.
 */
let _interceptorInstalled = false;
export function installCompanionInterceptor(): void {
  if (_interceptorInstalled || !isHostedWebApp()) return;
  _interceptorInstalled = true;

  axios.interceptors.request.use((config) => {
    const url = config.url ?? '';
    // Rewrite relative /api/... calls to the local companion
    if (url.startsWith('/api') || url.startsWith('api/')) {
      const path = url.startsWith('/') ? url : `/${url}`;
      config.url = `${COMPANION_DIRECT}${path}`;
      // Ensure no baseURL mismatch
      if (config.baseURL && config.baseURL.startsWith('/')) {
        config.baseURL = COMPANION_DIRECT;
      }
    }
    return config;
  });
}

export function isInterceptorInstalled(): boolean {
  return _interceptorInstalled;
}
