/**
 * skillSandbox — capability-gated runtime for Skill-provided code (S1 isolation).
 *
 * Extends the project's existing vm-isolate model (lib/extensionSandbox.js):
 *  - runs Skill code in `vm.runInNewContext` with require/process/Buffer denied,
 *  - injects ONLY a `hoosh` capability object built from the user-GRANTED
 *    permissions (deny-by-default),
 *  - every capability call forwards to the Tool Layer (`kernel.executeTool`),
 *    which re-checks approval/allowlist/secret-redaction (defense in depth),
 *  - every call is written to an audit sink, attributed to the skillId.
 *
 * `executeTool` and `audit` are injected so this module is unit-testable with
 * mocks and has no hard dependency on the kernel.
 */
const vm = require('vm');

/** First token of a shell command (for allowlist checks). */
function commandHead(cmd) {
  return String(cmd || '').trim().split(/\s+/)[0] || '';
}

/** Host of a URL, lowercased. */
function urlHost(url) {
  const m = String(url || '').match(/^https?:\/\/([^/]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function hostAllowed(host, allowlist) {
  if (!host) return false;
  return (allowlist || []).some((h) => host === String(h).toLowerCase() || host.endsWith('.' + String(h).toLowerCase()));
}

/**
 * Build the `hoosh` capability object for a Skill from its granted permissions.
 * Each method enforces the grant, then routes to the Tool Layer.
 */
function buildCapabilityObject(granted, { executeTool, audit, skillId }) {
  const g = granted || {};
  const fsScope = g.filesystem || 'none';
  const shellAllow = (g.shell && g.shell.allowlist) || [];
  const netAllow = g.network || [];
  const mcpAllow = g.mcp || [];

  const record = (capability, detail, denied = false) => {
    try { audit && audit({ skillId, capability, detail, denied, ts: Date.now() }); } catch { /* never throw from audit */ }
  };
  const deny = (capability, detail) => {
    record(capability, detail, true);
    return Promise.reject(new Error(`Permission denied: Skill "${skillId}" did not request capability "${capability}" (${detail}).`));
  };

  return {
    skillId,
    fs: {
      read(p) {
        if (fsScope === 'none') return deny('filesystem.read', p);
        record('filesystem.read', p);
        return executeTool('readFile', { path: p });
      },
      write(p, content) {
        if (fsScope === 'none') return deny('filesystem.write', p);
        record('filesystem.write', p);
        return executeTool('writeFile', { path: p, content });
      },
      patch(p, args) {
        if (fsScope === 'none') return deny('filesystem.patch', p);
        record('filesystem.patch', p);
        return executeTool('patchFile', { path: p, ...(args || {}) });
      }
    },
    shell(cmd) {
      const head = commandHead(cmd);
      if (!shellAllow.includes(head)) return deny('shell', `command "${head}" not in allowlist [${shellAllow.join(', ')}]`);
      record('shell', cmd);
      return executeTool('executeCommand', { command: cmd });
    },
    research(query) {
      if (!netAllow.length) return deny('network.research', 'no network hosts granted');
      record('network.research', query);
      return executeTool('deepResearch', { query });
    },
    fetch(url) {
      const host = urlHost(url);
      if (!hostAllowed(host, netAllow)) return deny('network.fetch', `host "${host}" not in allowlist [${netAllow.join(', ')}]`);
      record('network.fetch', url);
      return executeTool('fetchUrl', { url });
    },
    mcp(toolId, args) {
      if (!mcpAllow.includes(toolId)) return deny('mcp', `mcp tool "${toolId}" not granted`);
      record('mcp', toolId);
      return executeTool('mcpTool', { tool: toolId, ...(args || {}) });
    },
    memory: {
      remember(text, opts) { record('memory.remember', String(text).slice(0, 60)); return executeTool('remember', { text, ...(opts || {}) }); },
      recall(query) { record('memory.recall', query); return executeTool('recall', { query }); }
    }
  };
}

/**
 * Run Skill-provided JS in the isolate. The code may export `run(hoosh, input)`
 * via `module.exports.run = ...`. Returns the awaited result.
 */
async function runSkillCode(code, { granted, executeTool, audit, skillId, input = {}, timeoutMs = 8000 } = {}) {
  if (typeof executeTool !== 'function') throw new Error('executeTool is required');
  const hoosh = buildCapabilityObject(granted, { executeTool, audit, skillId });
  const moduleObj = { exports: {} };
  const sandbox = {
    module: moduleObj,
    exports: moduleObj.exports,
    hoosh,
    console: {
      log: (...a) => audit && audit({ skillId, capability: 'log', detail: a.map(String).join(' '), ts: Date.now() }),
      warn: (...a) => audit && audit({ skillId, capability: 'log', detail: a.map(String).join(' '), ts: Date.now() }),
      error: (...a) => audit && audit({ skillId, capability: 'log', detail: a.map(String).join(' '), ts: Date.now() })
    },
    setTimeout, clearTimeout,
    // hard denials — Skills get no ambient authority
    require: (id) => { throw new Error(`require("${id}") is blocked in the Skill sandbox`); },
    process: undefined,
    Buffer: undefined,
    global: undefined,
    globalThis: undefined
  };
  const script = new vm.Script(`${code}\n//# sourceURL=skill:${skillId}`, { filename: `skill:${skillId}` });
  script.runInNewContext(sandbox, { timeout: timeoutMs, displayErrors: true });
  const run = moduleObj.exports.run || moduleObj.exports.default;
  if (typeof run !== 'function') return { ok: true, ran: false, reason: 'no run(hoosh, input) export' };
  const result = await run(hoosh, input);
  return { ok: true, ran: true, result };
}

module.exports = { buildCapabilityObject, runSkillCode, commandHead, urlHost, hostAllowed };
