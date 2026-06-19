/** Companion API base — dev uses Vite proxy; web uses same-origin; desktop may override. */

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
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    return '/api';
  }

  return 'http://localhost:3001/api';
}

export const API_BASE = resolveApiBase();
