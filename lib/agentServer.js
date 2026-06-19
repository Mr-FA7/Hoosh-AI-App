/**
 * Headless Agent REST API (OpenHands-inspired).
 */
function mountAgentServer(app, deps) {
  const { kernel, indexer, agentSessions, hitlGraph, getProjectRoot } = deps;

  app.get('/api/agent/v1/health', (req, res) => {
    res.json({ ok: true, service: 'hoosh-agent', version: '1.0.0' });
  });

  app.post('/api/agent/v1/mission', async (req, res) => {
    try {
      const { goal, mode, sessionId } = req.body || {};
      if (!goal) return res.status(400).json({ ok: false, error: 'goal required' });
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      const write = (obj) => res.write(JSON.stringify(obj) + '\n');
      if (sessionId && agentSessions) await agentSessions.setStatus(sessionId, 'running');
      await kernel.executeAutonomousLoop(goal, {
        mode: mode || 'agent',
        onEvent: (ev) => write({ agent_event: ev })
      });
      if (sessionId && agentSessions) await agentSessions.setStatus(sessionId, 'idle');
      write({ done: true });
      res.end();
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/agent/v1/gather', async (req, res) => {
    try {
      const { GatherMode } = require('./gatherMode');
      const gather = new GatherMode(kernel, indexer);
      const context = await gather.gather(req.body?.goal || '', {
        onEvent: (type, data) => { /* noop for REST */ }
      });
      res.json({ ok: true, context });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/agent/v1/sessions', async (req, res) => {
    if (!agentSessions) return res.json({ sessions: [] });
    res.json({ sessions: await agentSessions.list() });
  });

  app.post('/api/agent/v1/sessions', async (req, res) => {
    if (!agentSessions) return res.status(503).json({ error: 'No project' });
    const s = await agentSessions.create(req.body?.title);
    res.json({ ok: true, session: s });
  });

  app.get('/api/agent/v1/workflows', (req, res) => {
    res.json({ workflows: hitlGraph?.list() || [] });
  });

  app.post('/api/agent/v1/workflows', (req, res) => {
    const wf = hitlGraph.create(req.body?.name, req.body?.steps);
    res.json({ ok: true, workflow: wf });
  });

  app.post('/api/agent/v1/workflows/:id/approve', (req, res) => {
    const wf = hitlGraph.approve(req.params.id, req.body?.approved !== false);
    res.json({ ok: true, workflow: wf });
  });

  app.get('/api/agent/v1/repo-map', (req, res) => {
    const map = indexer.getRepoMap ? indexer.getRepoMap(req.query.q || '', { maxChars: 12000 }) : '';
    res.json({ map, projectRoot: getProjectRoot?.() });
  });
}

module.exports = { mountAgentServer };
