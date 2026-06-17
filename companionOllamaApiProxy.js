/**
 * Ollama API proxy + config (local vs cloud)
 *
 * Exposes:
 * - GET  /api/ollama/config
 * - POST /api/ollama/config
 * - GET  /api/ollama/version
 * - GET  /api/ollama/ps
 * - POST /api/ollama/embed
 * - POST /api/ollama/show
 * - POST /api/ollama/copy
 * - DELETE /api/ollama/delete
 * - POST /api/ollama/create  (supports streaming passthrough)
 * - POST /api/ollama/push    (supports streaming passthrough)
 */

const { Readable } = require('stream');
const companionOllama = require('./companionOllamaRuntime');

function ollamaBase() {
  return companionOllama.getActiveOllamaBase();
}

function authHeaders() {
  return companionOllama.getOllamaAuthHeaders ? companionOllama.getOllamaAuthHeaders() : {};
}

async function fetchJson(route, { method = 'GET', body } = {}) {
  const r = await fetch(`${ollamaBase()}/api/${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t || String(r.status));
  return t ? JSON.parse(t) : {};
}

async function passthrough(route, req, res) {
  const url = `${ollamaBase()}/api/${route}`;
  const body = req.body ?? {};
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });

  res.status(r.status);
  const ct = r.headers.get('content-type');
  if (ct) res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'no-cache');

  if (!r.body) {
    const t = await r.text();
    res.end(t);
    return;
  }

  if (typeof Readable.fromWeb === 'function') {
    Readable.fromWeb(r.body).pipe(res);
    return;
  }

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

function mountOllamaApiProxyRoutes(app) {
  app.get('/api/ollama/config', (req, res) => {
    res.json({ ok: true, ...companionOllama.getOllamaConfig(), activeBase: ollamaBase() });
  });

  app.post('/api/ollama/config', async (req, res) => {
    try {
      const updated = companionOllama.setOllamaConfig(req.body || {});
      // apply immediately for consumers (companion.js already uses getActiveOllamaBase per request)
      res.json({ ok: true, ...updated, activeBase: ollamaBase() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.get('/api/ollama/version', async (req, res) => {
    try {
      const j = await fetchJson('version');
      res.json({ ok: true, ...j });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.get('/api/ollama/ps', async (req, res) => {
    try {
      const j = await fetchJson('ps');
      res.json({ ok: true, ...j });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.post('/api/ollama/embed', async (req, res) => {
    try {
      const j = await fetchJson('embed', { method: 'POST', body: req.body || {} });
      res.json({ ok: true, ...j });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.post('/api/ollama/show', async (req, res) => {
    try {
      const j = await fetchJson('show', { method: 'POST', body: req.body || {} });
      res.json({ ok: true, ...j });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.post('/api/ollama/copy', async (req, res) => {
    try {
      const j = await fetchJson('copy', { method: 'POST', body: req.body || {} });
      res.json({ ok: true, ...j });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.delete('/api/ollama/delete', async (req, res) => {
    try {
      const j = await fetchJson('delete', { method: 'DELETE', body: req.body || {} });
      res.json({ ok: true, ...j });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // potentially streaming endpoints
  app.post('/api/ollama/create', async (req, res) => {
    try {
      await passthrough('create', req, res);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.post('/api/ollama/push', async (req, res) => {
    try {
      await passthrough('push', req, res);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });
}

module.exports = { mountOllamaApiProxyRoutes };

