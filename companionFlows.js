/**
 * Hoosh Flows API — workflow builder & execution (original engine, no n8n code).
 */
const { listFlows, getFlow, saveFlow, deleteFlow, initExampleFlow } = require('./lib/flowStore');

function mountFlowRoutes(app, getProjectRoot, getFlowEngine) {
  app.get('/api/v3/flows', async (_req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.json({ ok: true, flows: [] });
      const flows = await listFlows(root);
      const engine = getFlowEngine();
      engine?.refreshSchedules(flows);
      res.json({ ok: true, flows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/flows/runs', (req, res) => {
    try {
      const engine = getFlowEngine();
      if (!engine) return res.json({ ok: true, runs: [] });
      res.json({ ok: true, runs: engine.listRuns(req.query?.flowId) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/flows/runs/:id', (req, res) => {
    try {
      const engine = getFlowEngine();
      const run = engine?.getRun(req.params.id);
      if (!run) return res.status(404).json({ ok: false, error: 'Run not found' });
      res.json({ ok: true, run });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/flows/:id', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const flow = await getFlow(root, req.params.id);
      if (!flow) return res.status(404).json({ ok: false, error: 'Flow not found' });
      res.json({ ok: true, flow });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/flows', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const flow = await saveFlow(root, req.body || {});
      const engine = getFlowEngine();
      const flows = await listFlows(root);
      engine?.refreshSchedules(flows);
      res.json({ ok: true, flow });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.delete('/api/v3/flows/:id', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      await deleteFlow(root, req.params.id);
      const engine = getFlowEngine();
      const flows = await listFlows(root);
      engine?.refreshSchedules(flows);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/flows/init-example', async (_req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const result = await initExampleFlow(root);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/flows/:id/run', async (req, res) => {
    try {
      const engine = getFlowEngine();
      if (!engine) return res.status(500).json({ ok: false, error: 'Flow engine unavailable' });
      const run = await engine.run(req.params.id, {
        trigger: 'manual',
        input: req.body?.input || {}
      });
      res.json({ ok: run.status !== 'failed', run });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/flows/webhook/:secret', async (req, res) => {
    try {
      const engine = getFlowEngine();
      if (!engine) return res.status(500).json({ ok: false, error: 'Flow engine unavailable' });
      const run = await engine.runWebhook(req.params.secret, req.body || {}, req.headers || {});
      res.json({ ok: run.status !== 'failed', run });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/flows/runs/:id/resume', async (req, res) => {
    try {
      const engine = getFlowEngine();
      if (!engine) return res.status(500).json({ ok: false, error: 'Flow engine unavailable' });
      const run = await engine.resume(req.params.id, {
        approved: req.body?.approved !== false,
        reason: req.body?.reason,
        input: req.body?.input
      });
      res.json({ ok: run.status !== 'failed', run });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/flows/credentials', async (_req, res) => {
    try {
      const { listCredentials } = require('./lib/integrationCredentials');
      res.json({ ok: true, credentials: await listCredentials() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/flows/credentials', async (req, res) => {
    try {
      const { saveCredential } = require('./lib/integrationCredentials');
      const saved = await saveCredential(req.body || {});
      res.json({ ok: true, credential: saved });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.delete('/api/v3/flows/credentials/:id', async (req, res) => {
    try {
      const { deleteCredential } = require('./lib/integrationCredentials');
      await deleteCredential(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountFlowRoutes };
