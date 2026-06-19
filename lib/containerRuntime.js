/**
 * Container runtime bridge — uses installed Docker or Podman CLI (no embedded Moby/Podman code).
 * Podman exposes a Docker-compatible API; compose subcommands work the same way.
 */
const { spawn } = require('child_process');

const RUNTIME_CANDIDATES = ['docker', 'podman'];

function runCommand(bin, args, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 60000);
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, code: 124, stdout, stderr: stderr + '\n(timeout)', bin, args });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code: code ?? 1, stdout, stderr, bin, args });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: 1, stdout: '', stderr: err.message, bin, args });
    });
  });
}

async function probeRuntime(bin) {
  const version = await runCommand(bin, ['version', '--format', '{{.Server.Version}}'], { timeoutMs: 8000 });
  if (!version.ok) {
    const fallback = await runCommand(bin, ['version'], { timeoutMs: 8000 });
    if (!fallback.ok) return null;
    return {
      engine: bin,
      version: (fallback.stdout || fallback.stderr || '').split('\n')[0].trim(),
      compose: [bin, 'compose']
    };
  }
  const composeProbe = await runCommand(bin, ['compose', 'version'], { timeoutMs: 8000 });
  return {
    engine: bin,
    version: String(version.stdout || '').trim() || 'unknown',
    composeAvailable: composeProbe.ok,
    compose: composeProbe.ok ? [bin, 'compose'] : null,
    composeVersion: composeProbe.ok ? String(composeProbe.stdout || '').trim() : ''
  };
}

let _cachedRuntime = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 30_000;

async function detectRuntime(force = false) {
  const now = Date.now();
  if (!force && _cachedRuntime && (now - _cachedAt) < CACHE_TTL_MS) {
    return _cachedRuntime;
  }
  for (const bin of RUNTIME_CANDIDATES) {
    const info = await probeRuntime(bin);
    if (info) {
      _cachedRuntime = info;
      _cachedAt = now;
      return info;
    }
  }
  _cachedRuntime = null;
  _cachedAt = now;
  return null;
}

function clearRuntimeCache() {
  _cachedRuntime = null;
  _cachedAt = 0;
}

async function runCompose(projectRoot, composeArgs, options = {}) {
  const runtime = await detectRuntime();
  if (!runtime?.compose) {
    return { ok: false, stderr: 'No container runtime with compose support found (install Docker or Podman).', stdout: '' };
  }
  const args = ['compose'];
  if (options.file) args.push('-f', options.file);
  args.push(...composeArgs);
  return runCommand(runtime.engine, args, { cwd: projectRoot, timeoutMs: options.timeoutMs });
}

async function runEngine(args, options = {}) {
  const runtime = await detectRuntime();
  if (!runtime) {
    return { ok: false, stderr: 'No container runtime found (install Docker or Podman).', stdout: '' };
  }
  if (options.stdin !== undefined) {
    return runCommandWithStdin(runtime.engine, args, String(options.stdin), options);
  }
  return runCommand(runtime.engine, args, options);
}

function runCommandWithStdin(bin, args, stdinText, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 60000);
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, code: 124, stdout, stderr: stderr + '\n(timeout)', bin, args });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.stdin.write(stdinText);
    child.stdin.end();
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code: code ?? 1, stdout, stderr, bin, args });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: 1, stdout: '', stderr: err.message, bin, args });
    });
  });
}

module.exports = {
  RUNTIME_CANDIDATES,
  runCommand,
  detectRuntime,
  clearRuntimeCache,
  runCompose,
  runEngine
};
