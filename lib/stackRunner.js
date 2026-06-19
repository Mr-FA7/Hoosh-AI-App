/**
 * Hoosh Stacks — compose-based multi-service dev environments (Docker / Podman CLI).
 */
const fs = require('fs-extra');
const path = require('path');
const {
  detectRuntime,
  runCompose,
  runEngine
} = require('./containerRuntime');

const COMPOSE_FILENAMES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yaml',
  'docker-compose.yml'
];

function resolveComposeFile(projectRoot, composeFile) {
  const root = path.resolve(projectRoot);
  if (composeFile) {
    const rel = String(composeFile).replace(/^[/\\]+/, '');
    const abs = path.join(root, rel);
    if (!abs.startsWith(root)) throw new Error('Invalid compose file path');
    if (!fs.existsSync(abs)) throw new Error(`Compose file not found: ${rel}`);
    return rel;
  }
  for (const name of COMPOSE_FILENAMES) {
    if (fs.existsSync(path.join(root, name))) return name;
  }
  return null;
}

async function discoverComposeFiles(projectRoot) {
  const root = path.resolve(projectRoot);
  const found = [];
  for (const name of COMPOSE_FILENAMES) {
    const abs = path.join(root, name);
    if (await fs.pathExists(abs)) {
      let services = [];
      try {
        services = await listServices(root, name);
      } catch { /* ignore */ }
      found.push({ file: name, services });
    }
  }
  return found;
}

function parseJsonLines(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || t[0] !== '{') continue;
    try { rows.push(JSON.parse(t)); } catch { /* skip */ }
  }
  return rows;
}

async function listServices(projectRoot, composeFile) {
  const file = resolveComposeFile(projectRoot, composeFile);
  if (!file) return [];
  const r = await runCompose(projectRoot, ['config', '--services'], { file, timeoutMs: 20000 });
  if (!r.ok) return [];
  return String(r.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ps(projectRoot, composeFile) {
  const file = resolveComposeFile(projectRoot, composeFile);
  if (!file) {
    return { ok: false, error: 'No compose file found in project root', services: [] };
  }
  let r = await runCompose(projectRoot, ['ps', '-a', '--format', 'json'], { file, timeoutMs: 25000 });
  let services = parseJsonLines(r.stdout);
  if (!services.length && r.stdout) {
    services = parseLegacyPsTable(r.stdout);
  }
  if (!r.ok && !services.length) {
    r = await runCompose(projectRoot, ['ps', '-a'], { file, timeoutMs: 25000 });
    services = parseLegacyPsTable(r.stdout);
  }
  return {
    ok: true,
    composeFile: file,
    services: services.map(normalizeServiceRow),
    raw: r.stdout,
    stderr: r.stderr
  };
}

function parseLegacyPsTable(stdout) {
  const lines = String(stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s{2,}/);
    return {
      Name: parts[0] || '',
      Service: parts[0]?.split('_').pop() || parts[0] || '',
      State: parts[1] || 'unknown',
      Ports: parts[parts.length - 1] || ''
    };
  });
}

function normalizeServiceRow(row) {
  const name = row.Name || row.name || '';
  const service = row.Service || row.service || name;
  const state = row.State || row.state || row.Status || row.status || 'unknown';
  const ports = row.Ports || row.ports || row.Publishers || '';
  const publishers = Array.isArray(row.Publishers)
    ? row.Publishers.map((p) => `${p.PublishedPort || p.published_port}:${p.TargetPort || p.target_port}`).join(', ')
    : String(ports);
  return { name, service, state, ports: publishers, health: row.Health || row.health || '' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealthy(projectRoot, composeFile, options = {}) {
  const timeoutMs = options.timeoutMs || 120000;
  const intervalMs = options.intervalMs || 2000;
  const servicesFilter = options.services?.length ? new Set(options.services.map(String)) : null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await ps(projectRoot, composeFile);
    const rows = (snap.services || []).filter((r) => !servicesFilter || servicesFilter.has(r.service));
    if (!rows.length) {
      await sleep(intervalMs);
      continue;
    }
    const allUp = rows.every((r) => /running|up/i.test(r.state));
    const healthOk = rows.every((r) => !r.health || /healthy/i.test(r.health));
    if (allUp && healthOk) {
      return { ok: true, services: rows, waitedMs: Date.now() - start };
    }
    await sleep(intervalMs);
  }
  return { ok: false, error: 'Health wait timeout', waitedMs: Date.now() - start };
}

async function up(projectRoot, options = {}) {
  const file = resolveComposeFile(projectRoot, options.composeFile);
  if (!file) return { ok: false, error: 'No compose file found' };
  const args = ['up', '-d'];
  if (options.build) args.push('--build');
  if (options.services?.length) args.push(...options.services);
  const r = await runCompose(projectRoot, args, { file, timeoutMs: options.timeoutMs || 300000 });
  return {
    ok: r.ok,
    composeFile: file,
    stdout: r.stdout,
    stderr: r.stderr,
    code: r.code
  };
}

async function upWithHealth(projectRoot, options = {}) {
  const upResult = await up(projectRoot, options);
  if (!upResult.ok) return { ...upResult, health: null, preview: { urls: [], ports: [] } };

  let health = null;
  if (options.waitHealthy !== false) {
    health = await waitForHealthy(projectRoot, upResult.composeFile, {
      timeoutMs: options.healthTimeoutMs || 120000,
      services: options.services
    });
  }

  const snap = await ps(projectRoot, upResult.composeFile);
  let profile = null;
  try {
    const { readDevProfile } = require('./hooshDevProfile');
    ({ profile } = await readDevProfile(projectRoot));
  } catch { /* ignore */ }
  const { collectPreviewUrlsFromServices } = require('./stackPorts');
  const preview = collectPreviewUrlsFromServices(snap.services || [], profile);

  return {
    ...upResult,
    health,
    preview,
    services: snap.services || []
  };
}

async function down(projectRoot, options = {}) {
  const file = resolveComposeFile(projectRoot, options.composeFile);
  if (!file) return { ok: false, error: 'No compose file found' };
  const args = ['down'];
  if (options.volumes) args.push('-v');
  const r = await runCompose(projectRoot, args, { file, timeoutMs: options.timeoutMs || 120000 });
  return { ok: r.ok, composeFile: file, stdout: r.stdout, stderr: r.stderr, code: r.code };
}

async function logs(projectRoot, options = {}) {
  const file = resolveComposeFile(projectRoot, options.composeFile);
  if (!file) return { ok: false, error: 'No compose file found', logs: '' };
  const args = ['logs', '--tail', String(options.tail || 120)];
  if (options.service) args.push(String(options.service));
  const r = await runCompose(projectRoot, args, { file, timeoutMs: options.timeoutMs || 60000 });
  return {
    ok: r.ok,
    composeFile: file,
    logs: (r.stdout || '') + (r.stderr || ''),
    stdout: r.stdout,
    stderr: r.stderr
  };
}

async function listAllContainers() {
  const r = await runEngine(['ps', '-a', '--format', '{{json .}}'], { timeoutMs: 15000 });
  if (!r.ok) return { ok: false, containers: [], error: r.stderr };
  const containers = parseJsonLines(r.stdout).map((row) => ({
    id: (row.ID || row.Id || '').slice(0, 12),
    name: row.Names || row.Name || '',
    image: row.Image || '',
    state: row.State || row.Status || '',
    ports: row.Ports || ''
  }));
  return { ok: true, containers };
}

async function runtimeStatus() {
  const runtime = await detectRuntime();
  if (!runtime) {
    return { ok: false, available: false, message: 'Install Docker Desktop or Podman to use Hoosh Stacks.' };
  }
  return {
    ok: true,
    available: true,
    engine: runtime.engine,
    version: runtime.version,
    composeAvailable: !!runtime.compose,
    composeVersion: runtime.composeVersion || ''
  };
}

class StackRunner {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot || process.cwd());
  }

  discover() { return discoverComposeFiles(this.projectRoot); }
  ps(composeFile) { return ps(this.projectRoot, composeFile); }
  up(options) { return upWithHealth(this.projectRoot, options); }
  down(options) { return down(this.projectRoot, options); }
  logs(options) { return logs(this.projectRoot, options); }
  status() { return runtimeStatus(); }
  containers() { return listAllContainers(); }
}

module.exports = {
  COMPOSE_FILENAMES,
  StackRunner,
  discoverComposeFiles,
  resolveComposeFile,
  listServices,
  ps,
  up,
  upWithHealth,
  waitForHealthy,
  down,
  logs,
  listAllContainers,
  runtimeStatus
};
