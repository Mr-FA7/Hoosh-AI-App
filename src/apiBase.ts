/** Companion API base — resolved from runtime (dev proxy, local companion, hosted web). */

import { getRuntimeEnvSync, isHostedWebApp, isLocalDevWeb } from './runtimeEnv';

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
