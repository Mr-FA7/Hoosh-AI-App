/**
 * Extension host runtime (subset) — when-clauses, views, menus, webview registry.
 * Does NOT execute arbitrary extension JS (security); hosts contributions + Hoosh bridges.
 */
const { readExtensionPackages } = require('./extensionBridge');

/** @type {Map<string, { id: string, html: string, extension: string }>} */
const webviewRegistry = new Map();

function evaluateWhen(when, ctx = {}) {
  const expr = String(when || '').trim();
  if (!expr || expr === 'true') return true;
  if (expr === 'false') return false;

  const parts = expr.split(/\s*&&\s*/);
  for (const part of parts) {
    const trimmed = part.trim();
    const neg = trimmed.startsWith('!');
    const clause = neg ? trimmed.slice(1).trim() : trimmed;

    if (clause === 'isMac' && neg) {
      if (process.platform === 'darwin') return false;
      continue;
    }
    if (clause === 'isMac' && !neg) {
      if (process.platform !== 'darwin') return false;
      continue;
    }
    if (clause === 'editorTextFocus' && !neg) {
      if (!ctx.editorTextFocus) return false;
      continue;
    }
    if (clause === 'editorTextFocus' && neg) {
      if (ctx.editorTextFocus) return false;
      continue;
    }

    const langMatch = clause.match(/^resourceLangId\s*==\s*['"]?([^'"]+)['"]?$/);
    if (langMatch) {
      const want = langMatch[1];
      const ok = ctx.resourceLangId === want;
      if (neg ? ok : !ok) return false;
      continue;
    }

    const eqMatch = clause.match(/^(\w+)\s*==\s*['"]?([^'"]+)['"]?$/);
    if (eqMatch) {
      const ok = String(ctx[eqMatch[1]] || '') === eqMatch[2];
      if (neg ? ok : !ok) return false;
      continue;
    }

    if (neg) continue;
    return false;
  }
  return true;
}

async function listContributions(projectRoot) {
  const out = { views: [], menus: [], configuration: [], webviews: [] };
  if (!projectRoot) return out;

  for (const { pkg, root } of await readExtensionPackages(projectRoot)) {
    const contributes = pkg.contributes || {};
    const extName = pkg.displayName || pkg.name;

    for (const view of contributes.views?.explorer || []) {
      out.views.push({ ...view, extension: extName });
    }
    for (const [menuId, items] of Object.entries(contributes.menus || {})) {
      for (const item of items || []) {
        out.menus.push({ menu: menuId, ...item, extension: extName });
      }
    }
    if (contributes.configuration) {
      out.configuration.push({
        extension: extName,
        title: contributes.configuration.title,
        properties: Object.keys(contributes.configuration.properties || {})
      });
    }
  }

  for (const [id, wv] of webviewRegistry.entries()) {
    out.webviews.push({ id, ...wv });
  }
  return out;
}

function registerWebview(id, html, extension = 'hoosh') {
  const key = String(id);
  webviewRegistry.set(key, { id: key, html: String(html || ''), extension });
  return webviewRegistry.get(key);
}

function getWebview(id) {
  return webviewRegistry.get(String(id)) || null;
}

function filterKeybindings(keybindings, ctx) {
  return keybindings.filter((kb) => evaluateWhen(kb.when, ctx));
}

module.exports = {
  evaluateWhen,
  listContributions,
  registerWebview,
  getWebview,
  filterKeybindings,
  webviewRegistry
};
