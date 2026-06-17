/**
 * پلاگین‌های FA7 (جدا از UAT) — پوشه fa7-plugins
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadFa7Plugins() {
  const root = path.join(__dirname, 'fa7-plugins');
  if (!fs.existsSync(root)) {
    console.log('[FA7 plugins] no fa7-plugins directory');
    return;
  }
  const api = {
    log: (...a) => console.log('[fa7-plugin]', ...a),
    getProjectRoot: () => path.join(__dirname)
  };
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const idx = path.join(root, ent.name, 'index.js');
    if (!fs.existsSync(idx)) continue;
    try {
      const mod = await import(pathToFileURL(idx).href);
      const m = mod.default || mod;
      if (typeof m.register === 'function') {
        m.register(api);
        console.log('[FA7 plugins] loaded:', ent.name);
      }
    } catch (e) {
      console.error('[FA7 plugins] failed:', ent.name, e.message);
    }
  }
}

module.exports = { loadFa7Plugins };
