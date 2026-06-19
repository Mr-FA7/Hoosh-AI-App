/**
 * ACP-style external agent backends (bring-your-own CLI agents).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CONFIG_PATH = path.join(os.homedir(), '.aivon-os', 'acp-backends.json');

const DEFAULT_BACKENDS = {
  claude_code: {
    label: 'Claude Code',
    command: 'claude',
    args: ['--print'],
    enabled: false,
    env: {}
  },
  codex: {
    label: 'OpenAI Codex CLI',
    command: 'codex',
    args: ['exec'],
    enabled: false,
    env: {}
  },
  custom: {
    label: 'Custom agent',
    command: '',
    args: [],
    enabled: false,
    env: {}
  }
};

class AcpAdapter {
  constructor() {
    this.config = { backends: { ...DEFAULT_BACKENDS }, active: null };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readJsonSync(CONFIG_PATH);
        this.config = {
          backends: { ...DEFAULT_BACKENDS, ...(data.backends || {}) },
          active: data.active || null
        };
      }
    } catch {
      this.config = { backends: { ...DEFAULT_BACKENDS }, active: null };
    }
    return this.config;
  }

  save(partial = {}) {
    this.config = { ...this.config, ...partial };
    fs.ensureDirSync(path.dirname(CONFIG_PATH));
    fs.writeJsonSync(CONFIG_PATH, this.config, { spaces: 2 });
    return this.config;
  }

  list() {
    return Object.entries(this.config.backends || {}).map(([id, b]) => ({
      id,
      ...b,
      active: this.config.active === id
    }));
  }

  async run(backendId, prompt, cwd) {
    const chunks = [];
    const result = await this.runStream(backendId, prompt, cwd, (line) => chunks.push(line.text));
    return { ...result, stdout: chunks.join('') };
  }

  runStream(backendId, prompt, cwd, onChunk) {
    const b = this.config.backends[backendId] || this.config.backends[this.config.active];
    if (!b || !b.enabled || !b.command) {
      return Promise.resolve({ ok: false, stderr: `Backend ${backendId} not configured`, backend: backendId });
    }
    return new Promise((resolve) => {
      const child = spawn(b.command, [...(b.args || []), prompt], {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...(b.env || {}) },
        shell: process.platform === 'win32'
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => {
        const text = d.toString();
        stdout += text;
        if (onChunk) onChunk({ type: 'stdout', text });
      });
      child.stderr.on('data', (d) => {
        const text = d.toString();
        stderr += text;
        if (onChunk) onChunk({ type: 'stderr', text });
      });
      child.on('close', (code) => {
        resolve({ ok: code === 0, stdout, stderr, backend: backendId || this.config.active });
      });
      child.on('error', (err) => resolve({ ok: false, stderr: err.message, backend: backendId }));
    });
  }
}

module.exports = { AcpAdapter, CONFIG_PATH, DEFAULT_BACKENDS };
