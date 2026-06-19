/**
 * Docker/Podman engine operations via CLI (no embedded Moby/Podman code).
 */
const { runEngine, detectRuntime } = require('./containerRuntime');

function parseJsonLines(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || t[0] !== '{') continue;
    try { rows.push(JSON.parse(t)); } catch { /* skip */ }
  }
  return rows;
}

async function listImages() {
  const r = await runEngine(['images', '--format', '{{json .}}'], { timeoutMs: 20000 });
  if (!r.ok) return { ok: false, images: [], error: r.stderr };
  return {
    ok: true,
    images: parseJsonLines(r.stdout).map((row) => ({
      id: (row.ID || '').slice(0, 12),
      repository: row.Repository || '',
      tag: row.Tag || '',
      size: row.Size || '',
      created: row.CreatedSince || row.CreatedAt || ''
    }))
  };
}

async function pullImage(image) {
  const name = String(image || '').trim();
  if (!name) return { ok: false, error: 'Image name required' };
  const r = await runEngine(['pull', name], { timeoutMs: 600000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function listContainers(all = true) {
  const args = ['ps'];
  if (all) args.push('-a');
  args.push('--format', '{{json .}}');
  const r = await runEngine(args, { timeoutMs: 20000 });
  if (!r.ok) return { ok: false, containers: [], error: r.stderr };
  return {
    ok: true,
    containers: parseJsonLines(r.stdout).map((row) => ({
      id: (row.ID || row.Id || '').slice(0, 12),
      name: row.Names || row.Name || '',
      image: row.Image || '',
      state: row.State || row.Status || '',
      ports: row.Ports || '',
      created: row.CreatedAt || ''
    }))
  };
}

async function containerAction(action, idOrName) {
  const target = String(idOrName || '').trim();
  if (!target) return { ok: false, error: 'Container id or name required' };
  const allowed = { start: ['start'], stop: ['stop'], restart: ['restart'], remove: ['rm', '-f'] };
  const args = allowed[action];
  if (!args) return { ok: false, error: 'Unknown action' };
  const r = await runEngine([...args, target], { timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function execInContainer(idOrName, command, options = {}) {
  const target = String(idOrName || '').trim();
  const cmd = String(command || '').trim();
  if (!target || !cmd) return { ok: false, error: 'Container and command required' };
  const args = ['exec'];
  if (options.workdir) args.push('-w', options.workdir);
  args.push(target, '/bin/sh', '-lc', cmd);
  const r = await runEngine(args, { timeoutMs: options.timeoutMs || 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr, output: (r.stdout || '') + (r.stderr || '') };
}

async function inspectContainer(idOrName) {
  const target = String(idOrName || '').trim();
  if (!target) return { ok: false, error: 'Container id or name required' };
  const r = await runEngine(['inspect', target], { timeoutMs: 15000 });
  if (!r.ok) return { ok: false, error: r.stderr };
  try {
    const data = JSON.parse(r.stdout || '[]');
    return { ok: true, inspect: Array.isArray(data) ? data[0] : data };
  } catch {
    return { ok: false, error: 'Invalid inspect JSON' };
  }
}

async function listNetworks() {
  const r = await runEngine(['network', 'ls', '--format', '{{json .}}'], { timeoutMs: 15000 });
  if (!r.ok) return { ok: false, networks: [], error: r.stderr };
  return {
    ok: true,
    networks: parseJsonLines(r.stdout).map((row) => ({
      id: (row.ID || '').slice(0, 12),
      name: row.Name || '',
      driver: row.Driver || '',
      scope: row.Scope || ''
    }))
  };
}

async function listVolumes() {
  const r = await runEngine(['volume', 'ls', '--format', '{{json .}}'], { timeoutMs: 15000 });
  if (!r.ok) return { ok: false, volumes: [], error: r.stderr };
  return {
    ok: true,
    volumes: parseJsonLines(r.stdout).map((row) => ({
      name: row.Name || row.name || '',
      driver: row.Driver || row.driver || '',
      mountpoint: row.Mountpoint || row.mountpoint || ''
    }))
  };
}

async function containerStats(idOrName) {
  const target = String(idOrName || '').trim();
  const args = target
    ? ['stats', '--no-stream', '--format', '{{json .}}', target]
    : ['stats', '--no-stream', '--format', '{{json .}}'];
  const r = await runEngine(args, { timeoutMs: 20000 });
  if (!r.ok) return { ok: false, stats: [], error: r.stderr };
  return { ok: true, stats: parseJsonLines(r.stdout) };
}

async function engineInfo() {
  const runtime = await detectRuntime();
  if (!runtime) return { ok: false, available: false };
  const info = await runEngine(['info', '--format', '{{json .}}'], { timeoutMs: 15000 });
  let parsed = null;
  if (info.ok) {
    try { parsed = JSON.parse(info.stdout); } catch { /* ignore */ }
  }
  return { ok: true, available: true, runtime, info: parsed };
}

module.exports = {
  listImages,
  pullImage,
  listContainers,
  containerAction,
  execInContainer,
  inspectContainer,
  listNetworks,
  listVolumes,
  containerStats,
  engineInfo
};
