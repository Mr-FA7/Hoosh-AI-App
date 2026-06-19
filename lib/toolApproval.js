const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const CONFIG_PATH = path.join(os.homedir(), '.aivon-os', 'tool-approval.json');

const DEFAULT_CONFIG = {
  yolo: false,
  autoApprove: {
    read: true,
    write: false,
    terminal: false,
    browser: true,
    mcp: false
  },
  /** Per-tool overrides: true = auto-approve, false = always ask */
  perTool: {},
  /**
   * When a terminal command is auto-approved (autoApprove.terminal or
   * perTool.executeCommand), only commands whose every segment starts with one
   * of these prefixes run without a prompt; anything else still asks. This
   * keeps auto/background modes safe without affecting the default (ask) mode.
   */
  commandAllowlist: [
    'npm', 'pnpm', 'yarn', 'bun', 'npx', 'node', 'deno', 'tsc', 'vite',
    'python', 'python3', 'pip', 'pip3', 'pytest', 'jest', 'vitest', 'eslint', 'prettier',
    'go', 'cargo', 'rustc', 'make', 'mvn', 'gradle', './gradlew', 'gradlew',
    'ls', 'cat', 'head', 'tail', 'grep', 'rg', 'find', 'pwd', 'echo', 'which',
    'mkdir', 'touch', 'cp', 'tree', 'wc', 'date', 'env', 'whoami', 'cd', 'git'
  ],
  /** git subcommands that are NOT auto-approved even when 'git' is allowlisted. */
  gitProtectedSubcommands: ['push', 'reset', 'clean', 'rebase', 'cherry-pick', 'remote']
};

function categorizeTool(toolName) {
  const t = String(toolName || '').toLowerCase();
  if (['readfile', 'readdir', 'listdir', 'websearch', 'search', 'deepresearch', 'research', 'fetchurl', 'fetch', 'changedirectory', 'recall', 'remember', 'memory'].includes(t)) return 'read';
  if (['writefile', 'patchfile', 'deletefile', 'createdir', 'buildcompose', 'buildcomposeartifacts'].includes(t)) return 'write';
  if (['executecommand', 'runcommand', 'terminal', 'shell'].includes(t)) return 'terminal';
  if (['mcptool', 'mcp'].includes(t)) return 'mcp';
  if (['browser', 'kavosh', 'navigate', 'browseragent'].includes(t)) return 'browser';
  return 'write';
}

class ToolApprovalManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.pending = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readJsonSync(CONFIG_PATH);
        this.config = {
          ...DEFAULT_CONFIG,
          ...data,
          autoApprove: { ...DEFAULT_CONFIG.autoApprove, ...(data.autoApprove || {}) },
          perTool: { ...DEFAULT_CONFIG.perTool, ...(data.perTool || {}) }
        };
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  save(partial = {}) {
    this.config = {
      ...this.config,
      ...partial,
      autoApprove: { ...this.config.autoApprove, ...(partial.autoApprove || {}) },
      perTool: { ...this.config.perTool, ...(partial.perTool || {}) }
    };
    fs.ensureDirSync(path.dirname(CONFIG_PATH));
    fs.writeJsonSync(CONFIG_PATH, this.config, { spaces: 2 });
    return this.config;
  }

  getConfig() {
    return { ...this.config };
  }

  /**
   * Is every segment of a compound shell command on the allowlist?
   * Splits on &&, ||, ; and | so "npm i && rm -rf /" is NOT auto-approved.
   */
  isCommandAllowlisted(command) {
    const cmd = String(command || '').trim();
    if (!cmd) return false;
    const allow = this.config.commandAllowlist || [];
    const gitProtected = this.config.gitProtectedSubcommands || [];
    const segments = cmd.split(/&&|\|\||;|\|/).map((s) => s.trim()).filter(Boolean);
    if (!segments.length) return false;
    return segments.every((seg) => {
      const tokens = seg.split(/\s+/);
      const head = tokens[0];
      if (!allow.includes(head)) return false;
      if ((head === 'git' || head === 'gradle' || head === './gradlew' || head === 'gradlew')) {
        const sub = (tokens[1] || '').toLowerCase();
        if (head === 'git' && gitProtected.includes(sub)) return false;
      }
      return true;
    });
  }

  needsApproval(toolName, args = {}) {
    if (this.config.yolo) return false;
    const toolKey = String(toolName || '');
    const cat = categorizeTool(toolName);
    if (Object.prototype.hasOwnProperty.call(this.config.perTool || {}, toolKey)) {
      const auto = !!this.config.perTool[toolKey];
      if (auto && cat === 'terminal') return !this.isCommandAllowlisted(args?.command);
      return !auto;
    }
    if (cat === 'mcp' && args?.readOnly) return !this.config.autoApprove.read;
    // Auto-approved terminal commands still prompt unless allowlisted.
    if (cat === 'terminal' && this.config.autoApprove.terminal) {
      return !this.isCommandAllowlisted(args?.command);
    }
    return !this.config.autoApprove[cat];
  }

  setPerTool(toolName, autoApprove) {
    const key = String(toolName || '');
    if (!key) return this.config;
    this.config.perTool = { ...this.config.perTool, [key]: !!autoApprove };
    return this.save();
  }

  listToolCategories() {
    const tools = [
      'readFile', 'readdir', 'listdir', 'webSearch', 'search',
      'writeFile', 'patchFile', 'deleteFile', 'executeCommand', 'runCommand',
      'mcpTool', 'browser', 'kavosh'
    ];
    return tools.map((t) => ({
      tool: t,
      category: categorizeTool(t),
      autoApprove: Object.prototype.hasOwnProperty.call(this.config.perTool || {}, t)
        ? !!this.config.perTool[t]
        : !!this.config.autoApprove[categorizeTool(t)]
    }));
  }

  listPending() {
    return Array.from(this.pending.entries()).map(([id, p]) => ({
      id,
      tool: p.tool,
      category: p.category,
      args: p.args,
      createdAt: p.at
    }));
  }

  requestApproval(toolName, args = {}, timeoutMs = 120000) {
    const id = randomUUID();
    const category = categorizeTool(toolName);
    return new Promise((resolve) => {
      const entry = {
        tool: toolName,
        args,
        category,
        at: Date.now(),
        resolve: (approved) => {
          this.pending.delete(id);
          resolve({ id, approved, category });
        }
      };
      this.pending.set(id, entry);
      setTimeout(() => {
        if (this.pending.has(id)) {
          entry.resolve(false);
        }
      }, timeoutMs);
    });
  }

  respond(id, approved) {
    const entry = this.pending.get(id);
    if (!entry) return { ok: false, error: 'not found' };
    entry.resolve(!!approved);
    return { ok: true };
  }
}

module.exports = { ToolApprovalManager, CONFIG_PATH, categorizeTool, DEFAULT_CONFIG };
