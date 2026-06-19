/**
 * VS Code-style extension activation events (simplified).
 */
const fs = require('fs-extra');
const path = require('path');
const { readExtensionPackages } = require('./extensionBridge');

function globToRegex(glob) {
  const g = String(glob || '').replace(/^\.\//, '');
  const escaped = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

async function walkFiles(projectRoot, max = 400) {
  const out = [];
  async function walk(dir) {
    if (out.length >= max) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= max) break;
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.fa7') continue;
      const abs = path.join(dir, e.name);
      const rel = path.relative(projectRoot, abs).replace(/\\/g, '/');
      if (e.isDirectory()) {
        await walk(abs);
      } else {
        out.push(rel);
      }
    }
  }
  await walk(projectRoot);
  return out;
}

function matchesActivation(event, ctx) {
  const ev = String(event || '').trim();
  if (!ev || ev === '*') return true;
  if (ev === 'onStartupFinished') return true;

  if (ev.startsWith('onLanguage:')) {
    const lang = ev.slice('onLanguage:'.length);
    return ctx.openLanguages?.includes(lang);
  }

  if (ev.startsWith('workspaceContains:')) {
    const pattern = ev.slice('workspaceContains:'.length);
    const re = globToRegex(pattern);
    return ctx.files?.some((f) => re.test(f));
  }

  if (ev.startsWith('onCommand:')) {
    return false;
  }

  return false;
}

async function buildActivationContext(projectRoot, openFiles = [], workspaceManager = null) {
  const folders = workspaceManager?.folders?.length
    ? workspaceManager.folders
    : (projectRoot ? [{ path: projectRoot }] : []);
  const files = [];
  const perFolder = Math.max(80, Math.floor(400 / Math.max(folders.length, 1)));
  for (const folder of folders) {
    const part = await walkFiles(folder.path, perFolder);
    files.push(...part);
  }
  const extSet = new Set();
  for (const f of [...files, ...openFiles]) {
    const ext = path.extname(f).toLowerCase();
    if (ext) extSet.add(ext.slice(1));
  }
  const langMap = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', rs: 'rust', go: 'go', md: 'markdown', json: 'json', css: 'css', html: 'html'
  };
  const openLanguages = [...extSet].map((e) => langMap[e] || e);
  return { files, openLanguages, openFiles };
}

async function listExtensionActivations(projectRoot, openFiles = [], workspaceManager = null) {
  if (!projectRoot) return [];
  const ctx = await buildActivationContext(projectRoot, openFiles, workspaceManager);
  const out = [];

  for (const { pkg, dir } of await readExtensionPackages(projectRoot)) {
    const events = pkg.activationEvents || (pkg.main || pkg.browser ? ['onStartupFinished'] : []);
    const active = events.some((ev) => matchesActivation(ev, ctx));
    out.push({
      extension: pkg.displayName || pkg.name,
      id: pkg.name || dir,
      activationEvents: events,
      active,
      contributes: {
        commands: (pkg.contributes?.commands || []).length,
        keybindings: (pkg.contributes?.keybindings || []).length,
        languages: (pkg.contributes?.languages || []).length
      }
    });
  }
  return out;
}

async function listExtensionKeybindings(projectRoot) {
  const out = [];
  if (!projectRoot) return out;

  for (const { pkg } of await readExtensionPackages(projectRoot)) {
    for (const kb of pkg.contributes?.keybindings || []) {
      out.push({
        key: kb.key,
        command: kb.command,
        when: kb.when || '',
        extension: pkg.displayName || pkg.name,
        mac: kb.mac,
        linux: kb.linux,
        win: kb.win
      });
    }
  }
  return out;
}

module.exports = {
  listExtensionActivations,
  listExtensionKeybindings,
  matchesActivation,
  buildActivationContext
};
