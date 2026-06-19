/**
 * Lightweight extension host — list & execute VS Code extension commands.
 */
const fs = require('fs-extra');
const path = require('path');
const { readExtensionPackages } = require('./extensionBridge');
const { executeSandboxCommand } = require('./extensionSandbox');

const BUILTIN_COMMANDS = [
  { id: 'hoosh.index.rebuild', title: 'Hoosh: Rebuild code index', category: 'Hoosh' },
  { id: 'hoosh.lint.run', title: 'Hoosh: Run project lint', category: 'Hoosh' },
  { id: 'hoosh.git.status', title: 'Hoosh: Git status', category: 'Hoosh' },
  { id: 'hoosh.docs.refresh', title: 'Hoosh: Refresh documentation cache', category: 'Hoosh' }
];

async function listExtensionCommands(projectRoot) {
  const out = [...BUILTIN_COMMANDS];
  if (!projectRoot) return out;

  for (const { pkg } of await readExtensionPackages(projectRoot)) {
    const contributes = pkg.contributes || {};
    for (const cmd of contributes.commands || []) {
      out.push({
        id: cmd.command,
        title: cmd.title || cmd.command,
        category: cmd.category || pkg.displayName || pkg.name,
        extension: pkg.displayName || pkg.name,
        builtin: false
      });
    }
  }
  return out;
}

async function executeCommand(projectRoot, commandId, args = {}, ctx = {}) {
  const id = String(commandId || '').trim();
  if (!id) return { ok: false, error: 'Missing command id' };

  switch (id) {
    case 'hoosh.index.rebuild': {
      if (!ctx.indexer?.scan) return { ok: false, error: 'Indexer not available' };
      await ctx.indexer.scan();
      return { ok: true, result: 'Index rebuilt' };
    }
    case 'hoosh.lint.run': {
      if (!ctx.runLint) return { ok: false, error: 'Lint runner not available' };
      const lint = await ctx.runLint(projectRoot, args.files || []);
      return { ok: true, result: lint };
    }
    case 'hoosh.git.status': {
      if (!ctx.gitStatus) return { ok: false, error: 'Git not available' };
      return { ok: true, result: await ctx.gitStatus(projectRoot) };
    }
    case 'hoosh.docs.refresh': {
      if (!projectRoot) return { ok: false, error: 'No project open' };
      const cacheDir = path.join(projectRoot, '.fa7', 'docs-cache');
      if (await fs.pathExists(cacheDir)) await fs.remove(cacheDir);
      return { ok: true, result: 'Docs cache cleared' };
    }
    default: {
      const sandboxResult = await executeSandboxCommand(projectRoot, id, args);
      if (sandboxResult) return sandboxResult;
      return {
        ok: false,
        error: `Command "${id}" is registered but has no host handler (activate extensions via POST /api/v3/extensions/sandbox/activate).`,
        registered: true
      };
    }
  }
}

module.exports = { listExtensionCommands, executeCommand, BUILTIN_COMMANDS };

const { listExtensionActivations, listExtensionKeybindings } = require('./extensionActivation');
module.exports.listExtensionActivations = listExtensionActivations;
module.exports.listExtensionKeybindings = listExtensionKeybindings;
module.exports.listContributions = require('./extensionRuntime').listContributions;
module.exports.filterKeybindings = require('./extensionRuntime').filterKeybindings;
module.exports.registerWebview = require('./extensionRuntime').registerWebview;
module.exports.getWebview = require('./extensionRuntime').getWebview;
