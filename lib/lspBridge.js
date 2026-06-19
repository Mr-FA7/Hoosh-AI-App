/**
 * Multi-language LSP bridge — routes to typescript / pyright / rust-analyzer.
 */
const path = require('path');
const { LspClient } = require('./lspClient');
const { languageIdForFile } = require('./extensionBridge');

const EXT_LANG_MAP = {
  '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.json': 'json', '.css': 'css', '.html': 'html',
  '.md': 'markdown', '.vue': 'vue', '.svelte': 'svelte'
};

const LSP_SERVERS = [
  {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    command: 'npx',
    args: ['typescript-language-server', '--stdio']
  },
  {
    id: 'python',
    extensions: ['.py'],
    command: 'npx',
    args: ['pyright-langserver', '--stdio']
  },
  {
    id: 'rust',
    extensions: ['.rs'],
    command: 'rust-analyzer',
    args: []
  }
];

function detectLanguageId(filePath, extensionLanguages = []) {
  const fromExt = languageIdForFile(filePath, extensionLanguages);
  if (fromExt && fromExt !== 'plaintext') return fromExt;
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return EXT_LANG_MAP[ext] || 'plaintext';
}

function serverForFile(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return LSP_SERVERS.find((s) => s.extensions.includes(ext)) || LSP_SERVERS[0];
}

class LspBridge {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.extensionLanguages = [];
    /** @type {Map<string, LspClient>} */
    this.clients = new Map();
  }

  setExtensionLanguages(langs) {
    this.extensionLanguages = langs || [];
  }

  _clientFor(filePath) {
    const cfg = serverForFile(filePath);
    if (!this.clients.has(cfg.id)) {
      this.clients.set(cfg.id, new LspClient(this.projectRoot, cfg));
    }
    return this.clients.get(cfg.id);
  }

  async start() {
    return true;
  }

  status() {
    return LSP_SERVERS.map((s) => ({
      id: s.id,
      extensions: s.extensions,
      running: !!this.clients.get(s.id)?.ready,
      command: `${s.command} ${s.args.join(' ')}`
    }));
  }

  async completion(filePath, line, character, content) {
    const client = this._clientFor(filePath);
    const languageId = detectLanguageId(filePath, this.extensionLanguages);
    return client.completion(filePath, line, character, content, languageId);
  }

  async hover(filePath, line, character, content) {
    const client = this._clientFor(filePath);
    const languageId = detectLanguageId(filePath, this.extensionLanguages);
    return client.hover(filePath, line, character, content, languageId);
  }

  async definition(filePath, line, character, content) {
    const client = this._clientFor(filePath);
    const languageId = detectLanguageId(filePath, this.extensionLanguages);
    return client.definition(filePath, line, character, content, languageId);
  }

  stop() {
    for (const c of this.clients.values()) c.stop();
    this.clients.clear();
  }
}

module.exports = { LspBridge, detectLanguageId, LSP_SERVERS };
