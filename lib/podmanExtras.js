/**
 * Podman-specific CLI wrappers (pods, secrets, machine).
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

async function requirePodman() {
  const rt = await detectRuntime();
  if (!rt) return { ok: false, error: 'No container runtime' };
  if (rt.engine !== 'podman') return { ok: false, error: 'Podman-only feature (install Podman)' };
  return { ok: true, engine: rt.engine };
}

async function listPods() {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const r = await runEngine(['pod', 'ps', '-a', '--format', '{{json .}}'], { timeoutMs: 20000 });
  if (!r.ok) return { ok: false, pods: [], error: r.stderr };
  return { ok: true, pods: parseJsonLines(r.stdout) };
}

async function podAction(action, name) {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const map = { start: ['pod', 'start'], stop: ['pod', 'stop'], remove: ['pod', 'rm', '-f'] };
  const args = map[action];
  if (!args) return { ok: false, error: 'Unknown pod action' };
  const r = await runEngine([...args, String(name)], { timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function listSecrets() {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const r = await runEngine(['secret', 'ls', '--format', '{{json .}}'], { timeoutMs: 15000 });
  if (!r.ok) return { ok: false, secrets: [], error: r.stderr };
  return { ok: true, secrets: parseJsonLines(r.stdout) };
}

async function createSecret(name, data) {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const r = await runEngine(['secret', 'create', String(name), '-'], {
    stdin: String(data || ''),
    timeoutMs: 30000
  });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function removeSecret(name) {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const r = await runEngine(['secret', 'rm', String(name)], { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function machineInfo() {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const r = await runEngine(['machine', 'list', '--format', '{{json .}}'], { timeoutMs: 30000 });
  return { ok: r.ok, machines: parseJsonLines(r.stdout), stderr: r.stderr };
}

async function machineStart(name = '') {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const args = ['machine', 'start'];
  if (name) args.push(String(name));
  const r = await runEngine(args, { timeoutMs: 300000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function machineStop(name = '') {
  const chk = await requirePodman();
  if (!chk.ok) return chk;
  const args = ['machine', 'stop'];
  if (name) args.push(String(name));
  const r = await runEngine(args, { timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

module.exports = {
  listPods,
  podStart: (n) => podAction('start', n),
  podStop: (n) => podAction('stop', n),
  podRemove: (n) => podAction('remove', n),
  listSecrets,
  createSecret,
  removeSecret,
  machineInfo,
  machineStart,
  machineStop
};
