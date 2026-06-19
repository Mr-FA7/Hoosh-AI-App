/** Browser extension bridge: aihoosh.com → localhost companion via postMessage. */

const PAGE_SOURCE = 'hoosh-web';
const BRIDGE_SOURCE = 'hoosh-local-bridge';
const COMPANION_API = '/api';

type BridgeResponse = {
  data: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
};

let bridgeReachable: boolean | null = null;
let bridgeProbeInflight: Promise<boolean> | null = null;

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isBridgeExtensionInstalled(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement?.dataset?.hooshBridge === 'extension';
}

export function waitForBridgeExtension(timeoutMs = 4000): Promise<boolean> {
  if (isBridgeExtensionInstalled()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (isBridgeExtensionInstalled()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

function bridgeFetchRaw(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Local bridge timeout'));
    }, 15000);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || msg.source !== BRIDGE_SOURCE || msg.id !== id) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      if (!msg.ok) {
        reject(new Error(msg.error || 'Bridge request failed'));
        return;
      }
      const result = msg.result;
      resolve({
        data: result?.data,
        status: result?.status ?? 500,
        statusText: result?.statusText ?? '',
        headers: result?.headers ?? {},
      });
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      {
        source: PAGE_SOURCE,
        id,
        type: 'hoosh-bridge-fetch',
        payload: {
          path: path.startsWith(COMPANION_API) ? path : `${COMPANION_API}${path.startsWith('/') ? path : `/${path}`}`,
          method,
          body,
          headers,
        },
      },
      '*'
    );
  });
}

export async function probeLocalBridge(force = false): Promise<boolean> {
  if (!isBridgeExtensionInstalled()) {
    const found = await waitForBridgeExtension(1500);
    if (!found) {
      bridgeReachable = false;
      return false;
    }
  }
  if (!force && bridgeReachable !== null) return bridgeReachable;
  if (!force && bridgeProbeInflight) return bridgeProbeInflight;

  bridgeProbeInflight = bridgeFetchRaw('GET', '/api/v3/project/path')
    .then((r) => r.status >= 200 && r.status < 500)
    .catch(() => false)
    .finally(() => {
      bridgeProbeInflight = null;
    });

  bridgeReachable = await bridgeProbeInflight;
  return bridgeReachable;
}

export function resetBridgeProbeCache(): void {
  bridgeReachable = null;
  bridgeProbeInflight = null;
}

export async function bridgeGet(path: string): Promise<BridgeResponse> {
  return bridgeFetchRaw('GET', path);
}

export async function bridgePost(path: string, body?: unknown): Promise<BridgeResponse> {
  return bridgeFetchRaw('POST', path, body);
}

export async function bridgeDelete(path: string, body?: unknown): Promise<BridgeResponse> {
  return bridgeFetchRaw('DELETE', path, body);
}

export function shouldUseLocalBridge(): boolean {
  return bridgeReachable === true;
}
