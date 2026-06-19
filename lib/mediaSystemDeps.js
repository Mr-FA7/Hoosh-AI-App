/**
 * FA7 Media — resolve best Python for ML stack (3.12 preferred; 3.14 breaks many wheels).
 */
const fs = require('fs-extra');
const path = require('path');
const { runCommand } = require('./containerRuntime');

const PREFERRED_VERSIONS = ['3.12', '3.11', '3.10', '3.13'];

async function probePythonExe(exe, extraArgs = []) {
  const parts = String(exe).split(/\s+/).filter(Boolean);
  const bin = parts[0];
  const prefix = parts.slice(1);
  const ver = await runCommand(bin, [...prefix, ...extraArgs, '--version'], { timeoutMs: 8000 });
  if (!ver.ok) return null;
  const m = String(ver.stdout || ver.stderr).match(/(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    exe: exe,
    bin,
    prefixArgs: prefix,
    major: Number(m[1]),
    minor: Number(m[2]),
    version: `${m[1]}.${m[2]}`,
    text: String(ver.stdout || ver.stderr).trim()
  };
}

async function findBestPython() {
  if (process.env.FA7_PYTHON) {
    const fixed = await probePythonExe(process.env.FA7_PYTHON);
    if (fixed) return fixed;
  }

  const candidates = [];
  if (process.platform === 'win32') {
    for (const v of PREFERRED_VERSIONS) {
      candidates.push(`py -${v}`);
    }
    candidates.push('python', 'python3');
  } else {
    for (const v of PREFERRED_VERSIONS) {
      candidates.push(`python${v}`);
    }
    candidates.push('python3', 'python');
  }

  const found = [];
  for (const c of candidates) {
    const info = await probePythonExe(c);
    if (info) found.push(info);
  }

  found.sort((a, b) => {
    const score = (x) => {
      let s = x.major * 100 + x.minor;
      if (x.version === '3.12') s += 50;
      if (x.version === '3.11') s += 40;
      if (x.major === 3 && x.minor >= 14) s -= 100;
      return s;
    };
    return score(b) - score(a);
  });

  return found[0] || null;
}

async function runPythonModule(best, module, args = [], options = {}) {
  const cmd = [best.bin, ...best.prefixArgs, '-m', module, ...args];
  return runCommand(cmd[0], cmd.slice(1), {
    timeoutMs: options.timeoutMs || 900000,
    cwd: options.cwd,
    env: options.env
  });
}

async function ensureSystemPython312() {
  if (process.platform !== 'win32') return { ok: true, skipped: true };
  const existing = await probePythonExe('py -3.12');
  if (existing) return { ok: true, installed: false, python: existing };

  const winget = await runCommand('winget', [
    'install', '-e', '--id', 'Python.Python.3.12',
    '--accept-package-agreements', '--accept-source-agreements', '--silent'
  ], { timeoutMs: 600000 });
  if (!winget.ok) {
    return { ok: false, error: winget.stderr || 'winget python 3.12 failed', hint: 'Install Python 3.12 manually' };
  }
  const after = await probePythonExe('py -3.12');
  return { ok: !!after, installed: true, python: after };
}

async function ensureFfmpeg() {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const check = await runCommand(cmd, ['ffmpeg'], { timeoutMs: 5000 });
  if (check.ok) return { ok: true, installed: false };

  if (process.platform !== 'win32') {
    return { ok: false, skipped: true, hint: 'Install ffmpeg via package manager' };
  }

  const winget = await runCommand('winget', [
    'install', '-e', '--id', 'Gyan.FFmpeg',
    '--accept-package-agreements', '--accept-source-agreements', '--silent'
  ], { timeoutMs: 600000 });
  const recheck = await runCommand('where', ['ffmpeg'], { timeoutMs: 5000 });
  return { ok: recheck.ok, installed: winget.ok, stderr: winget.stderr?.slice(-500) };
}

async function ensureDockerDesktop() {
  const check = await runCommand('docker', ['version'], { timeoutMs: 10000 });
  if (check.ok) return { ok: true, installed: false };

  if (process.platform !== 'win32') {
    return { ok: false, skipped: true, hint: 'Install Docker or Podman' };
  }

  const winget = await runCommand('winget', [
    'install', '-e', '--id', 'Docker.DockerDesktop',
    '--accept-package-agreements', '--accept-source-agreements', '--silent'
  ], { timeoutMs: 900000 });
  const recheck = await runCommand('docker', ['version'], { timeoutMs: 15000 });
  return {
    ok: recheck.ok,
    installed: winget.ok,
    needsReboot: !recheck.ok && winget.ok,
    stderr: winget.stderr?.slice(-500)
  };
}

module.exports = {
  findBestPython,
  probePythonExe,
  runPythonModule,
  ensureSystemPython312,
  ensureFfmpeg,
  ensureDockerDesktop,
  PREFERRED_VERSIONS
};
