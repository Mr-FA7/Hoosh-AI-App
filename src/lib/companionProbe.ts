import {
  isBridgeExtensionInstalled,
  probeLocalBridge,
  resetBridgeProbeCache,
  waitForBridgeExtension,
} from '../lib/localBridge';
import { getRuntimeEnvSync, isHostedWebApp } from '../runtimeEnv';
import { installCompanionInterceptor } from '../apiBase';

const COMPANION_DIRECT_URL = 'http://127.0.0.1:3001';

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
let directCompanionReachable = false;

/** Try fetching companion directly (no extension) — works when server adds PNA headers */
async function probeDirectLocalhost(): Promise<boolean> {
  try {
    const res = await fetch(`${COMPANION_DIRECT_URL}/api/v3/system/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function probeDirectCompanion(): Promise<boolean> {
  const { default: axios } = await import('axios');
  const { API_BASE } = await import('../apiBase');
  try {
    await axios.get(`${API_BASE}/v3/project/path`, { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

export function isDirectCompanionReachable(): boolean {
  return directCompanionReachable;
}

export function getCompanionDirectUrl(): string {
  return COMPANION_DIRECT_URL;
}

export async function probeCompanionReachable(force = false): Promise<boolean> {
  if (isHostedWebApp()) {
    if (!force && cached !== null) return cached;
    if (!force && inflight) return inflight;

    inflight = (async () => {
      // 1. Try direct localhost (no extension needed — PNA headers on companion)
      const direct = await probeDirectLocalhost();
      if (direct) {
        directCompanionReachable = true;
        installCompanionInterceptor(); // redirect ALL axios /api/... calls to localhost
        return true;
      }
      directCompanionReachable = false;
      // 2. Fall back to extension bridge
      return probeLocalBridge(force);
    })().finally(() => { inflight = null; });

    cached = await inflight;
    return cached;
  }

  const { isLocalDevWeb } = await import('../runtimeEnv');
  if (!isLocalDevWeb()) return false;
  if (!force && cached !== null) return cached;
  if (!force && inflight) return inflight;

  inflight = probeDirectCompanion().finally(() => { inflight = null; });
  cached = await inflight;
  return cached;
}

export async function getRuntimeEnv() {
  const { getRuntimeEnvSync: sync } = await import('../runtimeEnv');
  if (isHostedWebApp()) {
    const bridgeOk = await probeCompanionReachable();
    if (bridgeOk) {
      return {
        ...sync(true),
        surface: 'bridge' as const,
        usesCompanionApi: true,
        usesWebWorkspace: false,
        labelKey: 'runtime.modeBridge' as const,
        browseHintKey: 'runtime.browseCompanion' as const,
      };
    }
    return sync(false);
  }

  const { isLocalDevWeb } = await import('../runtimeEnv');
  if (!isLocalDevWeb()) return sync(false);
  const reachable = await probeCompanionReachable();
  return sync(reachable);
}

export function resetCompanionProbeCache(): void {
  cached = null;
  inflight = null;
  directCompanionReachable = false;
  resetBridgeProbeCache();
}

export async function checkBridgeSetup(): Promise<{
  extension: boolean;
  companion: boolean;
  direct: boolean;
  hintKey?: 'bridge.hintNoExtension' | 'bridge.hintNoCompanion' | 'bridge.hintRefreshPage';
}> {
  // First try direct (no extension)
  const direct = await probeDirectLocalhost();
  if (direct) return { extension: true, companion: true, direct: true };

  // Then try extension bridge
  const extension = isBridgeExtensionInstalled() || (await waitForBridgeExtension(2000));
  if (!extension) return { extension: false, companion: false, direct: false, hintKey: 'bridge.hintNoExtension' };

  const companion = await probeLocalBridge(true);
  if (!companion) return { extension: true, companion: false, direct: false, hintKey: 'bridge.hintNoCompanion' };

  return { extension: true, companion: true, direct: false };
}
