/**
 * بارگذاری UAT (کپی از Fard) به‌صورت ESM داینامیک — مسیرهای HTTP
 */

const path = require('path');
const { pathToFileURL } = require('url');

let uatCache = null;

async function loadUat() {
  if (uatCache) return uatCache;
  const href = pathToFileURL(path.join(__dirname, 'uat', 'src', 'index.js')).href;
  uatCache = await import(href);
  return uatCache;
}

function mountUatRoutes(app) {
  app.get('/api/uat/profile', async (req, res) => {
    try {
      const uat = await loadUat();
      res.json(await uat.getOSProfile());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/uat/nl-to-command', async (req, res) => {
    try {
      const uat = await loadUat();
      const r = await uat.naturalLanguageToCommand(req.body?.text || '', req.body?.options || {});
      res.json({ ok: true, command: r.command, raw: r.raw });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/uat/evaluate', async (req, res) => {
    try {
      const uat = await loadUat();
      res.json(uat.evaluateCommand(req.body?.command || ''));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/uat/execute', async (req, res) => {
    try {
      const uat = await loadUat();
      const command = req.body?.command || '';
      const policy = uat.evaluateCommand(command);
      if (policy.action === 'block') {
        res.json({ ok: false, policy, error: 'blocked' });
        return;
      }
      const result = await uat.executeCommand(command, req.body?.execOpts || {});
      uat.logExecution({ command, policy, exitCode: result.exitCode });
      res.json({ ok: true, policy, result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/uat/route-execute', async (req, res) => {
    try {
      const uat = await loadUat();
      const r = await uat.routeAndExecute(req.body?.input || '', req.body?.execOpts || {});
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/uat/plugins', async (req, res) => {
    try {
      const uat = await loadUat();
      const dir = path.join(__dirname, 'uat', 'plugins');
      const loaded = await uat.loadPlugins(dir);
      res.json({
        ok: true,
        plugins: loaded.map((p) => ({ name: p.name, version: p.version }))
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountUatRoutes, loadUat };
