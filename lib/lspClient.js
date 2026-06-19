/**
 * Single LSP server JSON-RPC client over stdio.
 */
const { spawn } = require('child_process');
const path = require('path');

class LspClient {
  constructor(projectRoot, serverConfig) {
    this.projectRoot = projectRoot;
    this.serverConfig = serverConfig;
    this.proc = null;
    this.buffer = '';
    this.pending = new Map();
    this.nextId = 1;
    this.ready = false;
    /** @type {Map<string, { version: number, languageId: string }>} */
    this.openDocs = new Map();
  }

  get id() {
    return this.serverConfig.id;
  }

  async start() {
    if (this.proc) return this.ready;
    const { command, args = [], env = {} } = this.serverConfig;
    const cmd = process.platform === 'win32' && !command.includes('.') ? `${command}.cmd` : command;
    try {
      this.proc = spawn(cmd, args, {
        cwd: this.projectRoot,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (e) {
      console.warn(`[LSP:${this.id}] spawn failed:`, e.message);
      return false;
    }

    this.proc.stdout.on('data', (chunk) => this._onData(chunk));
    this.proc.stderr.on('data', () => {});
    this.proc.on('exit', () => {
      this.proc = null;
      this.ready = false;
      this.openDocs.clear();
    });

    await this._request('initialize', {
      processId: process.pid,
      rootUri: `file://${this.projectRoot}`,
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true }
        }
      }
    });
    this._notify('initialized', {});
    this.ready = true;
    return true;
  }

  _uri(filePath) {
    return `file://${path.join(this.projectRoot, filePath)}`;
  }

  syncDocument(filePath, content, languageId) {
    const uri = this._uri(filePath);
    const prev = this.openDocs.get(uri);
    if (!prev) {
      this.openDocs.set(uri, { version: 1, languageId });
      this._notify('textDocument/didOpen', {
        textDocument: { uri, languageId, version: 1, text: content }
      });
      return;
    }
    prev.version += 1;
    this._notify('textDocument/didChange', {
      textDocument: { uri, version: prev.version },
      contentChanges: [{ text: content }]
    });
  }

  _onData(chunk) {
    this.buffer += chunk.toString();
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { this.buffer = this.buffer.slice(headerEnd + 4); continue; }
      const len = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) break;
      const body = this.buffer.slice(bodyStart, bodyStart + len);
      this.buffer = this.buffer.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body);
        if (msg.id != null && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch { /* ignore */ }
    }
  }

  _send(payload) {
    if (!this.proc?.stdin.writable) return;
    const body = JSON.stringify(payload);
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  _request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this._send({ jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('LSP timeout'));
        }
      }, 15000);
    });
  }

  _notify(method, params) {
    this._send({ jsonrpc: '2.0', method, params });
  }

  async completion(filePath, line, character, content, languageId) {
    if (!(await this.start())) return [];
    const uri = this._uri(filePath);
    this.syncDocument(filePath, content, languageId);
    try {
      const result = await this._request('textDocument/completion', {
        textDocument: { uri },
        position: { line: line - 1, character }
      });
      const items = Array.isArray(result) ? result : (result?.items || []);
      return items.slice(0, 20).map((item) => ({
        label: item.label,
        kind: item.kind,
        detail: item.detail || '',
        insertText: item.insertText || item.label,
        server: this.id
      }));
    } catch {
      return [];
    }
  }

  async hover(filePath, line, character, content, languageId) {
    if (!(await this.start())) return null;
    const uri = this._uri(filePath);
    this.syncDocument(filePath, content, languageId);
    try {
      const result = await this._request('textDocument/hover', {
        textDocument: { uri },
        position: { line: line - 1, character }
      });
      const c = result?.contents;
      if (!c) return null;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : x.value || '')).join('\n');
      return c.value || '';
    } catch {
      return null;
    }
  }

  async definition(filePath, line, character, content, languageId) {
    if (!(await this.start())) return null;
    const uri = this._uri(filePath);
    this.syncDocument(filePath, content, languageId);
    try {
      const result = await this._request('textDocument/definition', {
        textDocument: { uri },
        position: { line: line - 1, character }
      });
      const loc = Array.isArray(result) ? result[0] : result;
      if (!loc?.uri) return null;
      const rel = path.relative(this.projectRoot, loc.uri.replace('file://', ''));
      return { path: rel, line: (loc.range?.start?.line || 0) + 1, character: loc.range?.start?.character || 0 };
    } catch {
      return null;
    }
  }

  stop() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.ready = false;
    this.openDocs.clear();
  }
}

module.exports = { LspClient };
