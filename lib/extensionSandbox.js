/**
 * Sandboxed VS Code extension host (subset) — vm isolate, no filesystem/network require.
 */
const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');
const { readExtensionPackages } = require('./extensionBridge');

/** @type {Map<string, { commands: Map<string, Function>, subscriptions: Array<{ dispose?: Function }> }>} */
const hostsByProject = new Map();

function projectKey(projectRoot) {
  return path.resolve(String(projectRoot || ''));
}

function getHost(projectRoot) {
  const key = projectKey(projectRoot);
  if (!hostsByProject.has(key)) {
    hostsByProject.set(key, { commands: new Map(), subscriptions: [] });
  }
  return hostsByProject.get(key);
}

function createVscodeStub(host, extensionId) {
  const subs = [];
  return {
    commands: {
      registerCommand(id, handler) {
        const cmd = String(id);
        host.commands.set(cmd, handler);
        const disp = { dispose: () => host.commands.delete(cmd) };
        subs.push(disp);
        return disp;
      }
    },
    window: {
      showInformationMessage: (msg) => String(msg),
      showWarningMessage: (msg) => String(msg),
      showErrorMessage: (msg) => String(msg)
    },
    workspace: {
      getConfiguration: () => ({
        get: (key, def) => def,
        update: async () => undefined
      }),
      workspaceFolders: []
    },
    extensions: {
      getExtension: (id) => (id === extensionId ? { id: extensionId } : undefined)
    },
    Uri: {
      file: (f) => ({ fsPath: String(f), scheme: 'file' })
    },
    __subscriptions: subs
  };
}

function buildActivateContext(vscode, extensionRoot) {
  return {
    subscriptions: vscode.__subscriptions,
    extensionPath: extensionRoot,
    extensionUri: vscode.Uri.file(extensionRoot),
    globalState: {
      get: () => undefined,
      update: async () => undefined
    },
    workspaceState: {
      get: () => undefined,
      update: async () => undefined
    }
  };
}

async function loadExtensionModule(projectRoot, extRoot, pkg) {
  const mainRel = pkg.main || pkg.browser || 'extension.js';
  const mainPath = path.join(extRoot, mainRel);
  if (!(await fs.pathExists(mainPath))) {
    throw new Error(`Extension entry not found: ${mainRel}`);
  }
  const code = await fs.readFile(mainPath, 'utf8');
  const host = { exports: {} };
  const sandbox = {
    module: host,
    exports: host.exports,
    require: (id) => {
      if (id === 'vscode') return sandbox.vscode;
      throw new Error(`require("${id}") blocked in extension sandbox`);
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Buffer: undefined,
    process: undefined,
    __dirname: extRoot,
    __filename: mainPath
  };
  sandbox.vscode = createVscodeStub(getHost(projectRoot), pkg.name || path.basename(extRoot));

  const script = new vm.Script(`${code}\n//# sourceURL=${mainPath}`, { filename: mainPath });
  script.runInNewContext(sandbox, { timeout: 8000, displayErrors: true });

  return { exports: host.exports, vscode: sandbox.vscode, extRoot };
}

async function activateExtension(projectRoot, extensionDir, pkg) {
  const extRoot = path.join(projectRoot, '.fa7', 'extensions', extensionDir);
  const { exports, vscode } = await loadExtensionModule(projectRoot, extRoot, pkg);
  const activate = exports.activate;
  if (typeof activate !== 'function') {
    return { ok: true, activated: false, reason: 'no activate() export' };
  }
  const ctx = buildActivateContext(vscode, extRoot);
  const maybe = activate(ctx);
  if (maybe && typeof maybe.then === 'function') await maybe;
  const host = getHost(projectRoot);
  host.subscriptions.push(...(vscode.__subscriptions || []));
  return {
    ok: true,
    activated: true,
    extension: pkg.displayName || pkg.name,
    commands: [...host.commands.keys()]
  };
}

async function activateAll(projectRoot) {
  const host = getHost(projectRoot);
  host.commands.clear();
  host.subscriptions.forEach((s) => s.dispose?.());
  host.subscriptions = [];

  const results = [];
  for (const { dir, pkg } of await readExtensionPackages(projectRoot)) {
    try {
      results.push(await activateExtension(projectRoot, dir, pkg));
    } catch (e) {
      results.push({
        ok: false,
        extension: pkg.displayName || pkg.name,
        error: e.message
      });
    }
  }
  return {
    ok: true,
    results,
    commandCount: getHost(projectRoot).commands.size
  };
}

async function executeSandboxCommand(projectRoot, commandId, args = {}) {
  const host = getHost(projectRoot);
  const fn = host.commands.get(String(commandId || ''));
  if (!fn) return null;
  const result = await fn(...(Array.isArray(args) ? args : [args]));
  return { ok: true, result, sandbox: true };
}

function sandboxStatus(projectRoot) {
  const host = getHost(projectRoot);
  return {
    ok: true,
    commands: [...host.commands.keys()],
    subscriptionCount: host.subscriptions.length
  };
}

function clearSandbox(projectRoot) {
  const key = projectKey(projectRoot);
  const host = hostsByProject.get(key);
  if (host) {
    host.subscriptions.forEach((s) => s.dispose?.());
    host.commands.clear();
  }
  hostsByProject.delete(key);
}

module.exports = {
  activateAll,
  activateExtension,
  executeSandboxCommand,
  sandboxStatus,
  clearSandbox
};
