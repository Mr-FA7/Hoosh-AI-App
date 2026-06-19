/**
 * Podman Kubernetes YAML — podman kube play/down (Podman only).
 */
const path = require('path');
const fs = require('fs-extra');
const { detectRuntime, runEngine } = require('./containerRuntime');

function resolveKubeFile(projectRoot, file) {
  const root = path.resolve(projectRoot);
  const rel = String(file || 'kube.yaml').replace(/^[/\\]+/, '');
  const abs = path.join(root, rel);
  if (!abs.startsWith(root)) throw new Error('Invalid kube file path');
  if (!fs.existsSync(abs)) throw new Error(`Kube YAML not found: ${rel}`);
  return rel;
}

async function kubePlay(projectRoot, file) {
  const runtime = await detectRuntime();
  if (!runtime) return { ok: false, error: 'No container runtime found' };
  if (runtime.engine !== 'podman') {
    return { ok: false, error: 'kube play requires Podman (install Podman or use compose stacks with Docker)' };
  }
  const rel = resolveKubeFile(projectRoot, file);
  const r = await runEngine(['kube', 'play', rel], { cwd: projectRoot, timeoutMs: 300000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr, file: rel };
}

async function kubeDown(projectRoot, file, options = {}) {
  const runtime = await detectRuntime();
  if (!runtime || runtime.engine !== 'podman') {
    return { ok: false, error: 'kube down requires Podman' };
  }
  const rel = resolveKubeFile(projectRoot, file);
  const args = ['kube', 'down'];
  if (options.volumes) args.push('--volumes');
  args.push(rel);
  const r = await runEngine(args, { cwd: projectRoot, timeoutMs: 120000 });
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr, file: rel };
}

module.exports = { kubePlay, kubeDown };
