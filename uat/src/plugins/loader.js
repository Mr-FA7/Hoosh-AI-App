/**
 * Plugin loader — Node.js plugins with a small manifest.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { getUatHome } from '../safety/logger.js';

/**
 * @param {string} pluginsDir
 * @returns {Promise<{ name: string, version: string, module: object }[]>}
 */
export async function loadPlugins(pluginsDir) {
  const dirs = [pluginsDir, path.join(getUatHome(), 'plugins')].filter((d) => fs.existsSync(d));
  const loaded = [];

  for (const root of dirs) {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const manifestPath = path.join(root, ent.name, 'package.json');
      const indexPath = path.join(root, ent.name, 'index.js');
      if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) continue;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const mod = await import(pathToFileURL(indexPath).href);
      const api = mod.default || mod;
      loaded.push({
        name: manifest.name || ent.name,
        version: manifest.version || '0.0.0',
        module: api
      });
    }
  }

  return loaded;
}

/**
 * @param {object} api minimal host API for plugins
 * @param {import('./loader.js').loadPlugins} plugins
 */
export function registerPlugins(api, plugins) {
  for (const p of plugins) {
    if (typeof p.module.register === 'function') {
      p.module.register(api);
    }
  }
}
