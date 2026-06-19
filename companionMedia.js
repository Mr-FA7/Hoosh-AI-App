/**
 * Hoosh Media Studio API
 */
const { MEDIA_CATEGORIES, listCapabilities, STACK_CAPABILITIES } = require('./lib/mediaCatalog');
const {
  probeAll,
  probeCapability,
  initMediaStack,
  initAllMediaStacks,
  runMediaAction,
  runCapability,
  clearProbeCache,
  getExampleRoot
} = require('./lib/mediaBridge');
const { installCapabilityDeps, installAllDeps } = require('./lib/mediaInstall');
const { listPipelines, runPipeline } = require('./lib/mediaPipelines');
const { bootstrapMediaStudio, getBootstrapStatus } = require('./lib/mediaBootstrap');
const { randomUUID } = require('crypto');

const bootstrapJobs = new Map();

function mountMediaRoutes(app, getProjectRoot) {
  app.get('/api/v3/media/catalog', (_req, res) => {
    res.json({
      ok: true,
      exampleRoot: getExampleRoot(),
      categories: MEDIA_CATEGORIES,
      stackCapabilities: STACK_CAPABILITIES,
      capabilities: listCapabilities()
    });
  });

  app.get('/api/v3/media/status', async (_req, res) => {
    try {
      clearProbeCache();
      res.json({ ok: true, ...(await probeAll()) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/media/pipelines', (_req, res) => {
    res.json({ ok: true, pipelines: listPipelines() });
  });

  app.get('/api/v3/media/probe/:id', async (req, res) => {
    try {
      const cap = require('./lib/mediaCatalog').getCapability(req.params.id);
      if (!cap) return res.status(404).json({ ok: false, error: 'Unknown capability' });
      res.json({ ok: true, ...(await probeCapability(cap)) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/media/init-stack', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      res.json(await initMediaStack(root, req.body?.capabilityId || req.body?.id));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/media/init-all-stacks', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      res.json(await initAllMediaStacks(root));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/media/install-deps', async (req, res) => {
    try {
      const id = req.body?.capabilityId || req.body?.id;
      if (id) {
        res.json(await installCapabilityDeps(id));
      } else {
        res.json(await installAllDeps(req.body?.category));
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/media/bootstrap-status', async (_req, res) => {
    try {
      res.json({ ok: true, ...(await getBootstrapStatus()) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/media/bootstrap', async (req, res) => {
    try {
      const root = getProjectRoot();
      if (!root) return res.status(400).json({ ok: false, error: 'No project open' });
      const jobId = randomUUID();
      bootstrapJobs.set(jobId, { status: 'running', startedAt: new Date().toISOString(), events: [] });
      res.json({ ok: true, jobId, message: 'Bootstrap started — poll /api/v3/media/bootstrap/:jobId' });

      bootstrapMediaStudio(root, {
        pip: req.body?.pip !== false,
        exampleReqs: req.body?.exampleReqs !== false,
        initStacks: req.body?.initStacks !== false,
        startStacks: !!req.body?.startStacks,
        stackMode: req.body?.stackMode || 'bundle',
        pipOnly: !!req.body?.pipOnly
      }, (ev) => {
        const job = bootstrapJobs.get(jobId);
        if (job) job.events.push({ ...ev, at: new Date().toISOString() });
      }).then((report) => {
        bootstrapJobs.set(jobId, {
          status: report.ok ? 'completed' : 'failed',
          report,
          events: bootstrapJobs.get(jobId)?.events || [],
          finishedAt: new Date().toISOString()
        });
      }).catch((e) => {
        bootstrapJobs.set(jobId, {
          status: 'error',
          error: e.message,
          events: bootstrapJobs.get(jobId)?.events || []
        });
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/media/bootstrap/:jobId', (req, res) => {
    const job = bootstrapJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
    res.json({ ok: true, jobId: req.params.jobId, ...job });
  });

  app.post('/api/v3/media/run', async (req, res) => {
    try {
      const root = getProjectRoot();
      const body = req.body || {};
      const ctx = { projectRoot: root };
      let result;
      if (body.pipelineId) {
        result = await runPipeline(body.pipelineId, body.input || body, ctx);
      } else if (body.capabilityId) {
        result = await runCapability(body.capabilityId, body, ctx);
      } else if (body.action) {
        result = await runMediaAction(body.action, body, ctx);
      } else {
        return res.status(400).json({ ok: false, error: 'pipelineId, capabilityId, or action required' });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountMediaRoutes };
