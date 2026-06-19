/**
 * Hoosh Stacks API — compose up/down/ps/logs via Docker or Podman CLI.
 */
const { StackRunner, runtimeStatus, ps } = require('./lib/stackRunner');
const { clearRuntimeCache } = require('./lib/containerRuntime');
const { readDevProfile, initStackExample } = require('./lib/hooshDevProfile');
const { collectPreviewUrlsFromServices } = require('./lib/stackPorts');

function mountStacksRoutes(app, getProjectRoot) {
  app.get('/api/v3/stacks/runtime', async (_req, res) => {
    try {
      clearRuntimeCache();
      const status = await runtimeStatus();
      res.json({ ok: true, ...status });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/stacks/profile', async (_req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.json({ ok: true, file: null, profile: null });
      const data = await readDevProfile(root);
      res.json({ ok: true, ...data });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/stacks/discover', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.json({ ok: true, files: [], runtime: await runtimeStatus(), profile: null });
      const runner = new StackRunner(root);
      const [files, runtime, devProfile] = await Promise.all([
        runner.discover(),
        runtimeStatus(),
        readDevProfile(root)
      ]);
      res.json({ ok: true, files, runtime, profile: devProfile.profile, profileFile: devProfile.file });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/stacks/preview', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const snap = await ps(root, req.query?.file);
      const { profile } = await readDevProfile(root);
      const preview = collectPreviewUrlsFromServices(snap.services || [], profile);
      res.json({ ok: true, ...preview, services: snap.services || [], composeFile: snap.composeFile });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/stacks/ps', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const runner = new StackRunner(root);
      const result = await runner.ps(req.query?.file);
      const { profile } = await readDevProfile(root);
      const preview = collectPreviewUrlsFromServices(result.services || [], profile);
      res.json({ ok: true, ...result, preview });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/stacks/containers', async (_req, res) => {
    try {
      const root = getProjectRoot();
      const runner = new StackRunner(root || process.cwd());
      const result = await runner.containers();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/stacks/up', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const runner = new StackRunner(root);
      const { profile } = await readDevProfile(root);
      const result = await runner.up({
        composeFile: req.body?.composeFile || profile?.compose || undefined,
        build: req.body?.build !== false,
        services: Array.isArray(req.body?.services) ? req.body.services
          : (profile?.services?.length ? profile.services : undefined),
        waitHealthy: req.body?.waitHealthy ?? profile?.waitHealthy ?? true
      });
      res.json({ ok: result.ok, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/stacks/down', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const runner = new StackRunner(root);
      const result = await runner.down({
        composeFile: req.body?.composeFile,
        volumes: !!req.body?.volumes
      });
      res.json({ ok: result.ok, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/stacks/init-example', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const result = await initStackExample(root, { force: !!req.body?.force });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/stacks/logs', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const runner = new StackRunner(root);
      const result = await runner.logs({
        composeFile: req.query?.file,
        service: req.query?.service,
        tail: Number(req.query?.tail) || 120
      });
      res.json({ ok: result.ok, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountStacksRoutes };
