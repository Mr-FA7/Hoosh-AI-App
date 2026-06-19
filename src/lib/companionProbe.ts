import axios from 'axios';
import { API_BASE } from '../apiBase';
import { getRuntimeEnvSync, isHostedWebApp, isLocalDevWeb, type RuntimeEnv } from '../runtimeEnv';

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export async function probeCompanionReachable(force = false): Promise<boolean> {
  if (isHostedWebApp()) return false;
  if (!isLocalDevWeb()) return false;
  if (!force && cached !== null) return cached;
  if (!force && inflight) return inflight;

  inflight = axios
    .get(`${API_BASE}/v3/project/path`, { timeout: 2500 })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      inflight = null;
    });

  cached = await inflight;
  return cached;
}

export async function getRuntimeEnv(): Promise<RuntimeEnv> {
  if (isHostedWebApp() || !isLocalDevWeb()) {
    return getRuntimeEnvSync(false);
  }
  const reachable = await probeCompanionReachable();
  return getRuntimeEnvSync(reachable);
}

export function resetCompanionProbeCache(): void {
  cached = null;
  inflight = null;
}
