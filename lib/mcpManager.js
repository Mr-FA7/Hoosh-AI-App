const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const GLOBAL_MCP = path.join(os.homedir(), '.hoosh-os', 'mcp.json');
const PROJECT_MCP = '.fa7/mcp.json';

class McpManager {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
    this.config = { mcpServers: {} };
  }

  async loadConfig(projectRoot) {
    const merged = { mcpServers: {} };
    for (const cfgPath of [GLOBAL_MCP, projectRoot ? path.join(projectRoot, PROJECT_MCP) : null]) {
      if (!cfgPath || !(await fs.pathExists(cfgPath))) continue;
      try {
        const data = await fs.readJson(cfgPath);
        if (data && data.mcpServers) {
          Object.assign(merged.mcpServers, data.mcpServers);
        }
      } catch (e) {
        console.warn('[MCP] Failed to parse', cfgPath, e.message);
      }
    }
    this.config = merged;
    return merged;
  }

  async connectAll(projectRoot) {
    await this.disconnectAll();
    await this.loadConfig(projectRoot);
    const servers = this.config.mcpServers || {};
    for (const [name, def] of Object.entries(servers)) {
      if (def.disabled) continue;
      try {
        await this.connectServer(name, def);
      } catch (e) {
        console.error(`[MCP] Failed to connect ${name}:`, e.message);
      }
    }
    return this.listTools();
  }

  buildTransport(def) {
    if (def.url) {
      const url = new URL(String(def.url));
      const type = String(def.type || 'http').toLowerCase();
      const headers = def.headers || {};
      const requestInit = { headers };
      if (type === 'sse') {
        return new SSEClientTransport(url, { requestInit });
      }
      return new StreamableHTTPClientTransport(url, { requestInit });
    }
    if (!def.command) {
      throw new Error('MCP server needs command (stdio) or url (http/sse)');
    }
    return new StdioClientTransport({
      command: def.command,
      args: def.args || [],
      env: { ...process.env, ...(def.env || {}) },
      cwd: def.cwd || undefined
    });
  }

  async connectServer(name, def) {
    const transport = this.buildTransport(def);
    const client = new Client({ name: 'hoosh-ai', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    this.clients.set(name, { client, transport, def });
    const listed = await client.listTools();
    for (const tool of listed.tools || []) {
      this.tools.set(`${name}:${tool.name}`, { server: name, tool });
    }
    console.log(`[MCP] Connected ${name} — ${(listed.tools || []).length} tools`);
  }

  async disconnectAll() {
    for (const [name, entry] of this.clients.entries()) {
      try {
        await entry.client.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
    this.tools.clear();
  }

  listTools() {
    return Array.from(this.tools.entries()).map(([id, { server, tool }]) => ({
      id,
      server,
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {}
    }));
  }

  async callTool(toolId, args = {}) {
    const entry = this.tools.get(toolId);
    if (!entry) throw new Error(`Unknown MCP tool: ${toolId}`);
    const conn = this.clients.get(entry.server);
    if (!conn) throw new Error(`MCP server not connected: ${entry.server}`);
    const result = await conn.client.callTool({ name: entry.tool.name, arguments: args });
    const text = (result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    return { ok: !result.isError, text, raw: result };
  }

  getStatus() {
    return {
      servers: Array.from(this.clients.keys()),
      toolCount: this.tools.size,
      configPaths: [GLOBAL_MCP, PROJECT_MCP]
    };
  }

  async listResources() {
    const out = [];
    for (const [name, entry] of this.clients.entries()) {
      try {
        const listed = await entry.client.listResources();
        for (const r of listed.resources || []) {
          out.push({ server: name, uri: r.uri, name: r.name, description: r.description || '', mimeType: r.mimeType });
        }
      } catch { /* optional */ }
    }
    return out;
  }

  async readResource(uri) {
    for (const [, entry] of this.clients.entries()) {
      try {
        const result = await entry.client.readResource({ uri });
        return { ok: true, uri, contents: result.contents || [] };
      } catch { /* try next */ }
    }
    return { ok: false, error: `Resource not found: ${uri}` };
  }

  async listPrompts() {
    const out = [];
    for (const [name, entry] of this.clients.entries()) {
      try {
        const listed = await entry.client.listPrompts();
        for (const p of listed.prompts || []) {
          out.push({ server: name, name: p.name, description: p.description || '', arguments: p.arguments || [] });
        }
      } catch { /* optional */ }
    }
    return out;
  }

  async getPrompt(name, args = {}) {
    for (const [server, entry] of this.clients.entries()) {
      try {
        const listed = await entry.client.listPrompts();
        const found = (listed.prompts || []).find((p) => p.name === name);
        if (!found) continue;
        const result = await entry.client.getPrompt({ name, arguments: args });
        return { ok: true, server, prompt: result };
      } catch { /* try next */ }
    }
    return { ok: false, error: `Prompt not found: ${name}` };
  }
}

module.exports = { McpManager, GLOBAL_MCP, PROJECT_MCP };
