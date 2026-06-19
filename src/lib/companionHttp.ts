import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE } from '../apiBase';
import { isHostedWebApp } from '../runtimeEnv';
import {
  bridgeDelete,
  bridgeGet,
  bridgePost,
  probeLocalBridge,
  shouldUseLocalBridge,
} from './localBridge';

function normalizeApiPath(path: string): string {
  if (path.startsWith('http')) {
    const u = new URL(path);
    return u.pathname.startsWith('/api') ? u.pathname : `/api${u.pathname}`;
  }
  if (path.startsWith('/api/') || path === '/api') return path;
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

function toAxiosLike<T = unknown>(r: { data: unknown; status: number; statusText: string }) {
  return { data: r.data as T, status: r.status, statusText: r.statusText };
}

export async function ensureBridgeReady(): Promise<boolean> {
  if (!isHostedWebApp()) return false;
  return probeLocalBridge();
}

export async function companionGet<T = unknown>(path: string, config?: AxiosRequestConfig) {
  const apiPath = normalizeApiPath(path);
  if (isHostedWebApp() && shouldUseLocalBridge()) {
    const q = config?.params
      ? `?${new URLSearchParams(Object.entries(config.params as Record<string, string>).map(([k, v]) => [k, String(v)]))}`
      : '';
    return toAxiosLike<T>(await bridgeGet(`${apiPath}${q}`));
  }
  const rel = apiPath.replace(/^\/api/, '');
  return axios.get<T>(`${API_BASE}${rel}`, config);
}

export async function companionPost<T = unknown>(path: string, body?: unknown, config?: AxiosRequestConfig) {
  const apiPath = normalizeApiPath(path);
  if (isHostedWebApp() && shouldUseLocalBridge()) {
    return toAxiosLike<T>(await bridgePost(apiPath, body));
  }
  const rel = apiPath.replace(/^\/api/, '');
  return axios.post<T>(`${API_BASE}${rel}`, body, config);
}

export async function companionDelete<T = unknown>(path: string, config?: AxiosRequestConfig) {
  const apiPath = normalizeApiPath(path);
  if (isHostedWebApp() && shouldUseLocalBridge()) {
    return toAxiosLike<T>(await bridgeDelete(apiPath, config?.data));
  }
  const rel = apiPath.replace(/^\/api/, '');
  return axios.delete<T>(`${API_BASE}${rel}`, config);
}
