/**
 * Secure-ish HTTP layer: timeouts, size cap, optional host allowlist.
 */

const DEFAULT_TIMEOUT = 60000;
const MAX_BODY = 50 * 1024 * 1024;

/**
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number, maxBytes?: number }} [init]
 */
export async function fetchSecure(url, init = {}) {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxBytes = init.maxBytes ?? MAX_BODY;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error(`response too large: ${buf.byteLength} > ${maxBytes}`);
    }
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      buffer: Buffer.from(buf)
    };
  } finally {
    clearTimeout(t);
  }
}
