const COMPANION_HOSTS = ['http://127.0.0.1:3001', 'http://localhost:3001'];

async function proxyFetch({ path, method = 'GET', headers = {}, body }) {
  const rel = path.startsWith('http') ? new URL(path).pathname + new URL(path).search : (path.startsWith('/') ? path : `/${path}`);
  let lastErr = null;

  for (const host of COMPANION_HOSTS) {
    const url = path.startsWith('http') ? path : `${host}${rel}`;
    try {
      const init = { method, headers: { ...headers } };
      if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!init.headers['Content-Type'] && !init.headers['content-type']) {
          init.headers['Content-Type'] = 'application/json';
        }
      }
      const res = await fetch(url, init);
      const text = await res.text();
      let data = text;
      try { data = text ? JSON.parse(text) : null; } catch { /* plain text */ }
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        data,
        headers: Object.fromEntries(res.headers.entries()),
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Companion not reachable on port 3001');
}

// Firefox uses browser.runtime but also supports chrome.runtime
const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;

runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'hoosh-bridge-ping') {
    proxyFetch({ path: '/api/v3/ping', method: 'GET' })
      .then((result) => sendResponse({ ok: result.ok && result.status === 200, result }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }

  if (msg?.type !== 'hoosh-bridge-fetch') return false;

  proxyFetch(msg.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});
