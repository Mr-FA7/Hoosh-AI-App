/**
 * Lightweight bridge for Open VSX extensions installed under .fa7/extensions.
 */
const fs = require('fs-extra');
const path = require('path');

async function readExtensionPackages(projectRoot) {
  const extRoot = path.join(projectRoot, '.fa7', 'extensions');
  const out = [];
  if (!(await fs.pathExists(extRoot))) return out;

  const dirs = await fs.readdir(extRoot);
  for (const dir of dirs) {
    if (dir.startsWith('temp-')) continue;
    const pkgPath = path.join(extRoot, dir, 'package.json');
    if (!(await fs.pathExists(pkgPath))) continue;
    try {
      const pkg = await fs.readJson(pkgPath);
      out.push({ dir, pkg, root: path.join(extRoot, dir) });
    } catch {
      /* skip */
    }
  }
  return out;
}

async function listExtensionLanguages(projectRoot) {
  const out = [];
  for (const { pkg } of await readExtensionPackages(projectRoot)) {
    const contributes = pkg.contributes || {};
    for (const lang of contributes.languages || []) {
      out.push({
        extension: pkg.displayName || pkg.name,
        id: lang.id,
        extensions: lang.extensions || [],
        aliases: lang.aliases || []
      });
    }
  }
  return out;
}

async function listExtensionGrammars(projectRoot) {
  const { mergeGrammars } = require('./builtinGrammars');
  const out = [];
  for (const { pkg, root } of await readExtensionPackages(projectRoot)) {
    const contributes = pkg.contributes || {};
    for (const g of contributes.grammars || []) {
      const grammarPath = g.path ? path.join(root, g.path) : null;
      let exists = false;
      if (grammarPath) exists = await fs.pathExists(grammarPath);
      out.push({
        extension: pkg.displayName || pkg.name,
        language: g.language,
        scopeName: g.scopeName,
        path: g.path,
        grammarPath: exists ? grammarPath : null
      });
    }
  }
  return mergeGrammars(out);
}

async function listExtensionThemes(projectRoot) {
  const out = [];
  for (const { pkg, root } of await readExtensionPackages(projectRoot)) {
    const contributes = pkg.contributes || {};
    for (const t of contributes.themes || []) {
      const themePath = t.path ? path.join(root, t.path) : null;
      let themeJson = null;
      if (themePath && (await fs.pathExists(themePath))) {
        try {
          themeJson = await fs.readJson(themePath);
        } catch { /* ignore */ }
      }
      out.push({
        extension: pkg.displayName || pkg.name,
        id: t.id || t.label,
        label: t.label || t.id,
        uiTheme: t.uiTheme || 'vs-dark',
        path: t.path,
        theme: themeJson
      });
    }
  }
  return out;
}

function languageIdForFile(filePath, languages = []) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (!ext) return 'plaintext';
  for (const lang of languages) {
    const exts = (lang.extensions || []).map((e) => e.toLowerCase());
    if (exts.includes(ext)) return lang.id;
  }
  const map = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.md': 'markdown', '.css': 'css', '.html': 'html', '.json': 'json'
  };
  return map[ext] || 'plaintext';
}

module.exports = {
  listExtensionLanguages,
  listExtensionGrammars,
  listExtensionThemes,
  languageIdForFile,
  readExtensionPackages
};
