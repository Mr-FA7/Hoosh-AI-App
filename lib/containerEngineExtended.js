/**
 * Extended Docker/Podman CLI operations (Moby/Podman-inspired, original wrappers).
 */
const path = require('path');
const { runEngine, detectRuntime } = require('./containerRuntime');
const { parseJsonLines } = require('./containerManager');

async function registryLogin({ server, username, password }) {
  const user = String(username || '').trim();
  const pass = String(password || '');
  if (!user || !pass) return { ok: false, error: 'username and password required' };
  const args = ['login', '-u', user, '--password-stdin'];
  if (server) args.push(String(server).trim());
  const r = await runEngine(args, { stdin: pass + '\n', timeoutMs: 60000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function registryLogout(server) {
  const args = ['logout'];
  if (server) args.push(String(server).trim());
  const r = await runEngine(args, { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function buildImage({ tag, dockerfile, context, noCache }) {
  const imageTag = String(tag || '').trim();
  if (!imageTag) return { ok: false, error: 'tag required' };
  const ctx = context || '.';
  const args = ['build', '-t', imageTag];
  if (dockerfile) args.push('-f', dockerfile);
  if (noCache) args.push('--no-cache');
  args.push(ctx);
  const r = await runEngine(args, { timeoutMs: 900000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function tagImage(source, target) {
  const r = await runEngine(['tag', String(source), String(target)], { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function pushImage(image) {
  const r = await runEngine(['push', String(image)], { timeoutMs: 900000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function removeImage(image, force = false) {
  const args = ['rmi'];
  if (force) args.push('-f');
  args.push(String(image));
  const r = await runEngine(args, { timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function runContainer(options = {}) {
  const args = ['run', '-d'];
  if (options.name) args.push('--name', String(options.name));
  if (options.ports) args.push('-p', String(options.ports));
  if (options.workdir) args.push('-w', String(options.workdir));
  if (options.env && typeof options.env === 'object') {
    for (const [k, v] of Object.entries(options.env)) args.push('-e', `${k}=${v}`);
  }
  if (options.volume) args.push('-v', String(options.volume));
  if (options.network) args.push('--network', String(options.network));
  args.push(String(options.image || ''));
  if (options.command) args.push('/bin/sh', '-lc', String(options.command));
  const r = await runEngine(args, { cwd: options.cwd, timeoutMs: 300000 });
  const id = String(r.stdout || '').trim();
  return { ok: r.ok, id, stdout: r.stdout, stderr: r.stderr };
}

async function containerLogs(idOrName, options = {}) {
  const args = ['logs', '--tail', String(options.tail || 200)];
  if (options.follow) args.push('-f');
  args.push(String(idOrName));
  const r = await runEngine(args, { timeoutMs: options.timeoutMs || 60000 });
  return { ok: r.ok, logs: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout, stderr: r.stderr };
}

async function containerCp(src, dest) {
  const r = await runEngine(['cp', String(src), String(dest)], { timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function systemDf() {
  const r = await runEngine(['system', 'df'], { timeoutMs: 30000 });
  return { ok: r.ok, output: r.stdout, stderr: r.stderr };
}

async function systemPrune(options = {}) {
  const args = ['system', 'prune', '-f'];
  if (options.volumes) args.push('--volumes');
  const r = await runEngine(args, { timeoutMs: 300000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function imagePrune() {
  const r = await runEngine(['image', 'prune', '-f'], { timeoutMs: 300000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function volumePrune() {
  const r = await runEngine(['volume', 'prune', '-f'], { timeoutMs: 300000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function networkPrune() {
  const r = await runEngine(['network', 'prune', '-f'], { timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function networkCreate(name, driver = 'bridge') {
  const r = await runEngine(['network', 'create', '--driver', driver, String(name)], { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function networkRemove(name) {
  const r = await runEngine(['network', 'rm', String(name)], { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function volumeCreate(name, driver = 'local') {
  const r = await runEngine(['volume', 'create', '--driver', driver, String(name)], { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

async function volumeRemove(name) {
  const r = await runEngine(['volume', 'rm', '-f', String(name)], { timeoutMs: 30000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
}

module.exports = {
  registryLogin,
  registryLogout,
  buildImage,
  tagImage,
  pushImage,
  removeImage,
  runContainer,
  containerLogs,
  containerCp,
  systemDf,
  systemPrune,
  imagePrune,
  volumePrune,
  networkPrune,
  networkCreate,
  networkRemove,
  volumeCreate,
  volumeRemove
};
