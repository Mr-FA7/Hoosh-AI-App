/**
 * پروکسی pull استریم به Ollama + اعتبارسنجی URL مرورگر
 */

const { Readable } = require('stream');
const companionOllama = require('./companionOllamaRuntime');

function getOllamaBase() {
  return companionOllama.getActiveOllamaBase();
}

function getAuthHeaders() {
  return companionOllama.getOllamaAuthHeaders ? companionOllama.getOllamaAuthHeaders() : {};
}

function isAllowedHttpUrl(urlStr) {
  try {
    const u = new URL(String(urlStr).trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function streamPullToResponse(name, res, req) {
  const base = getOllamaBase();
  const ac = new AbortController();
  const stopUpstream = () => {
    try {
      ac.abort();
    } catch {
      /* ignore */
    }
  };
  req.once('aborted', stopUpstream);
  res.once('close', () => {
    if (!res.writableEnded) stopUpstream();
  });

  let r;
  try {
    r = await fetch(`${base}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name: String(name || '').trim(), stream: true }),
      signal: ac.signal
    });
  } catch (e) {
    if (e?.name === 'AbortError' && !res.headersSent) {
      res.status(499).json({ ok: false, error: 'cancelled' });
      return;
    }
    throw e;
  }
  if (!r.ok) {
    const t = await r.text();
    res.status(r.status).json({ ok: false, error: t || String(r.status) });
    return;
  }
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  if (r.body && typeof Readable.fromWeb === 'function') {
    Readable.fromWeb(r.body).pipe(res).on('error', () => stopUpstream());
  } else {
    const reader = r.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    res.end();
  }
}

function mountOllamaPullRoutes(app) {
  app.post('/api/ollama/pull-stream', async (req, res) => {
    const name = req.body?.name;
    if (!name) {
      res.status(400).json({ ok: false, error: 'name required' });
      return;
    }
    try {
      await streamPullToResponse(name, res, req);
    } catch (e) {
      if (e?.name === 'AbortError') {
        if (!res.headersSent) res.status(499).json({ ok: false, error: 'cancelled' });
        return;
      }
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: e.message });
      }
    }
  });

  app.post('/api/browser/validate-url', (req, res) => {
    const url = req.body?.url;
    res.json({ ok: isAllowedHttpUrl(url), url: String(url || '').trim() });
  });
}

module.exports = { mountOllamaPullRoutes, getOllamaBase, isAllowedHttpUrl };
