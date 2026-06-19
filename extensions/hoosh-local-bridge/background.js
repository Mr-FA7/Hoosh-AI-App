const COMPANION = 'http://127.0.0.1:3001';

async function proxyFetch({ path, method = 'GET', headers = {}, body }) {
  const url = path.startsWith('http') ? path : `${COMPANION}${path.startsWith('/') ? path : `/${path}`}`;
  const init = {
    method,
    headers: { ...headers },
  };
  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!init.headers['Content-Type'] && !init.headers['content-type']) {
      init.headers['Content-Type'] = 'application/json';
    }
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* plain text */
  }
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    data,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'hoosh-bridge-fetch') return false;
  proxyFetch(msg.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});
