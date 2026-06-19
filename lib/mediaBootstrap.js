/**
 * FA7 Media Studio — full bootstrap (venv, pip, stacks, health verify).
 */
const path = require('path');
const fs = require('fs-extra');
const {
  ensureMediaVenv,
  saveBootstrapState,
  loadBootstrapState,
  probeSystemTools,
  getMediaPython,
  MEDIA_HOME
} = require('./mediaEnv');
const { installAllDeps, installCoreDeps } = require('./mediaInstall');
const {
  initAllMediaStacks,
  clearProbeCache,
  probeAll,
  getExampleRoot
} = require('./mediaBridge');
const { STACK_CAPABILITIES } = require('./mediaCatalog');
const { StackRunner } = require('./stackRunner');
const { runtimeStatus } = require('./stackRunner');

const {
  ensureSystemPython312,
  ensureFfmpeg,
  ensureDockerDesktop
} = require('./mediaSystemDeps');

const BOOTSTRAP_PHASES = [
  'system-check',
  'python312',
  'ffmpeg',
  'docker',
  'venv',
  'pip-core',
  'pip-all',
  'example-reqs',
  'init-stacks',
  'stack-up',
  'verify'
];

async function stackUpMediaBundle(projectRoot, options = {}) {
  const composeFile = options.composeFile || '.fa7/media-stacks/media-studio-full.yaml';
  const absCompose = path.join(projectRoot, composeFile.replace(/\//g, path.sep));
  if (!await fs.pathExists(absCompose)) {
    return { ok: false, error: `Compose not found: ${composeFile}. Run init-stacks first.` };
  }
  const runtime = await runtimeStatus();
  if (!runtime.available) {
    return { ok: false, skipped: true, error: 'Docker/Podman not available', runtime };
  }
  const runner = new StackRunner(projectRoot);
  const result = await runner.up({
    composeFile,
    build: false,
    waitHealthy: options.waitHealthy !== false
  });
  return { ok: result.ok !== false, composeFile, result, runtime };
}

async function stackUpAllMediaStacks(projectRoot, onProgress) {
  const runtime = await runtimeStatus();
  if (!runtime.available) {
    return { ok: false, skipped: true, error: 'Docker/Podman not available' };
  }
  const { listCapabilities } = require('./mediaCatalog');
  const results = [];
  for (const cap of listCapabilities({ hasStack: true })) {
    const composeFile = `.fa7/media-stacks/${cap.composeStack}`;
    const abs = path.join(projectRoot, '.fa7', 'media-stacks', cap.composeStack);
    if (!await fs.pathExists(abs)) continue;
    onProgress?.({ phase: 'stack-up', capability: cap.id, composeFile });
    try {
      const runner = new StackRunner(projectRoot);
      const r = await runner.up({ composeFile, build: false, waitHealthy: false });
      results.push({ id: cap.id, composeFile, ok: r.ok !== false, result: r });
    } catch (e) {
      results.push({ id: cap.id, ok: false, error: e.message });
    }
  }
  return { ok: results.some((r) => r.ok), results };
}

/**
 * Full media studio bootstrap.
 * @param {string} projectRoot
 * @param {object} options
 * @param {(ev: object) => void} onProgress
 */
async function bootstrapMediaStudio(projectRoot, options = {}, onProgress) {
  const opts = {
    pip: options.pip !== false,
    exampleReqs: options.exampleReqs !== false,
    initStacks: options.initStacks !== false,
    startStacks: !!options.startStacks,
    installSystem: options.installSystem !== false,
    stackMode: options.stackMode || 'bundle',
    pipOnly: !!options.pipOnly
  };

  const report = {
    ok: false,
    startedAt: new Date().toISOString(),
    phases: {},
    exampleRoot: getExampleRoot(),
    mediaHome: MEDIA_HOME,
    python: null
  };

  const runPhase = async (name, fn) => {
    onProgress?.({ phase: name, status: 'running' });
    try {
      const result = await fn();
      report.phases[name] = { ok: result.ok !== false, ...result };
      onProgress?.({ phase: name, status: result.ok !== false ? 'done' : 'failed', result });
      return result;
    } catch (e) {
      report.phases[name] = { ok: false, error: e.message };
      onProgress?.({ phase: name, status: 'error', error: e.message });
      return { ok: false, error: e.message };
    }
  };

  await runPhase('system-check', async () => {
    const tools = await probeSystemTools();
    const exampleExists = await fs.pathExists(getExampleRoot());
    return { ok: exampleExists, tools, exampleRoot: getExampleRoot(), exampleExists };
  });

  if (opts.installSystem && !opts.pipOnly) {
    await runPhase('python312', ensureSystemPython312);
    await runPhase('ffmpeg', ensureFfmpeg);
    if (opts.startStacks) {
      await runPhase('docker', ensureDockerDesktop);
    }
  }

  await runPhase('venv', () => ensureMediaVenv({ forceRecreate: !!options.forceRecreate }));
  report.python = getMediaPython();

  if (opts.pip) {
    if (opts.pipOnly) {
      await runPhase('pip-core', () => installCoreDeps());
    } else {
      await runPhase('pip-all', () => installAllDeps(null, (ev) => {
        onProgress?.({ phase: 'pip-all', sub: ev });
      }));
    }
  }

  if (opts.exampleReqs && !opts.pipOnly) {
    const { installAllExampleRequirements } = require('./mediaInstall');
    await runPhase('example-reqs', () => installAllExampleRequirements((ev) => {
      onProgress?.({ phase: 'example-reqs', sub: ev });
    }));
  }

  if (opts.initStacks && projectRoot) {
    await runPhase('init-stacks', () => initAllMediaStacks(projectRoot));
  }

  if (opts.startStacks && projectRoot && !opts.pipOnly) {
    if (opts.stackMode === 'all') {
      await runPhase('stack-up', () => stackUpAllMediaStacks(projectRoot, onProgress));
    } else if (opts.stackMode === 'bundle') {
      await runPhase('stack-up', () => stackUpMediaBundle(projectRoot, options));
    }
  }

  await runPhase('verify', async () => {
    clearProbeCache();
    const status = await probeAll();
    const ready = status.summary.available;
    const total = status.summary.total;
    return {
      ok: ready === total,
      ready,
      total,
      summary: status.summary,
      capabilities: status.capabilities.map((c) => ({
        id: c.id,
        available: c.available,
        mode: c.mode,
        sourceAvailable: c.sourceAvailable
      }))
    };
  });

  const verify = report.phases.verify || {};
  report.ok = verify.ok === true || (verify.ready >= verify.total - 1);
  report.finishedAt = new Date().toISOString();
  await saveBootstrapState({ lastBootstrap: report });
  return report;
}

async function getBootstrapStatus() {
  const state = await loadBootstrapState();
  clearProbeCache();
  const probe = await probeAll();
  const tools = await probeSystemTools();
  return {
    state,
    probe: probe.summary,
    capabilities: probe.capabilities,
    tools,
    python: getMediaPython(),
    mediaHome: MEDIA_HOME,
    phases: BOOTSTRAP_PHASES
  };
}

module.exports = {
  BOOTSTRAP_PHASES,
  bootstrapMediaStudio,
  getBootstrapStatus,
  stackUpMediaBundle,
  stackUpAllMediaStacks
};
