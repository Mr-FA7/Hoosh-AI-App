/**
 * Optional Docker sandbox for agent shell commands.
 */
const { spawn } = require('child_process');
const path = require('path');

class SandboxRunner {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.enabled = !!options.enabled;
    this.image = options.image || 'node:20-bookworm-slim';
    this.playwrightImage = options.playwrightImage || 'mcr.microsoft.com/playwright:v1.49.0-jammy';
  }

  isEnabled() {
    return this.enabled;
  }

  async run(command, timeoutMs = 120000, imageOverride) {
    if (!this.enabled) return null;
    const mount = path.resolve(this.projectRoot);
    const image = imageOverride || this.image;
    const args = [
      'run', '--rm',
      '-v', `${mount}:/workspace`,
      '-w', '/workspace',
      image,
      '/bin/bash', '-lc', command
    ];
    return new Promise((resolve) => {
      const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
