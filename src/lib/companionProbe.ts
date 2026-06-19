import {
  isBridgeExtensionInstalled,
  probeLocalBridge,
  resetBridgeProbeCache,
  waitForBridgeExtension,
} from '../lib/localBridge';
import { getRuntimeEnvSync, isHostedWebApp } from '../runtimeEnv';

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

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

export async function probeCompanionReachable(force = false): Promise<boolean> {
  if (isHostedWebApp()) {
    if (!force && cached !== null) return cached;
    if (!force && inflight) return inflight;
    inflight = probeLocalBridge(force)
      .then((ok) => ok)
      .finally(() => {
        inflight = null;
      });
    cached = await inflight;
    return cached;
  }

  const { isLocalDevWeb } = await import('../runtimeEnv');
  if (!isLocalDevWeb()) return false;
  if (!force && cached !== null) return cached;
  if (!force && inflight) return inflight;

  inflight = probeDirectCompanion()
    .finally(() => {
      inflight = null;
    });
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
        labelKey: 'runtime.modeBridge' as const,
        browseHintKey: 'runtime.browseCompanion' as const,
      };
    }
    return sync(false);
  }

  const { isLocalDevWeb } = await import('../runtimeEnv');
  if (!isLocalDevWeb()) {
    return sync(false);
  }
  const reachable = await probeCompanionReachable();
  return sync(reachable);
}

export function resetCompanionProbeCache(): void {
  cached = null;
  inflight = null;
  resetBridgeProbeCache();
}

export async function checkBridgeSetup(): Promise<{
  extension: boolean;
  companion: boolean;
}> {
  const extension = isBridgeExtensionInstalled() || (await waitForBridgeExtension(800));
  const companion = extension ? await probeLocalBridge(true) : false;
  return { extension, companion };
}
