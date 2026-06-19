/**
 * Optional container sandbox for agent shell commands (Docker or Podman).
 */
const { spawn } = require('child_process');
const path = require('path');
const { detectRuntime } = require('./containerRuntime');

class SandboxRunner {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.enabled = !!options.enabled;
    this.image = options.image || 'node:20-bookworm-slim';
    this.playwrightImage = options.playwrightImage || 'mcr.microsoft.com/playwright:v1.49.0-jammy';
    this.memory = options.memory || null;
    this.cpus = options.cpus || null;
    this._engine = null;
  }

  isEnabled() {
    return this.enabled;
  }

  async _resolveEngine() {
    if (this._engine) return this._engine;
    const rt = await detectRuntime();
    this._engine = rt?.engine || 'docker';
    return this._engine;
  }

  async run(command, timeoutMs = 120000, imageOverride) {
    if (!this.enabled) return null;
    const engine = await this._resolveEngine();
    const mount = path.resolve(this.projectRoot);
    const image = imageOverride || this.image;
    const args = ['run', '--rm'];
    if (this.memory) args.push('--memory', String(this.memory));
    if (this.cpus) args.push('--cpus', String(this.cpus));
    args.push(
      '-v', `${mount}:/workspace`,
      '-w', '/workspace',
      image,
      '/bin/bash', '-lc', command
    );
    return new Promise((resolve) => {
      const child = spawn(engine, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({ ok: false, stdout, stderr: stderr + '\n(sandbox timeout)', sandbox: true });
      }, timeoutMs);
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ ok: code === 0, stdout, stderr, code, sandbox: true });
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ ok: false, stdout: '', stderr: err.message, sandbox: true });
      });
    });
  }
}

module.exports = { SandboxRunner };
