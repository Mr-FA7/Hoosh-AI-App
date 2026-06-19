/**
 * Multi-root workspace — VS Code-style folder list under .fa7/workspace.json
 */
const fs = require('fs-extra');
const path = require('path');

const WORKSPACE_FILE = '.fa7/workspace.json';

class WorkspaceManager {
  constructor(primaryRoot) {
    this.primaryRoot = primaryRoot ? path.resolve(primaryRoot) : null;
    /** @type {Array<{ name: string, path: string }>} */
    this.folders = [];
  }

  static async load(primaryRoot) {
    const wm = new WorkspaceManager(primaryRoot);
    await wm.reload();
    return wm;
  }

  async reload() {
    if (!this.primaryRoot) {
      this.folders = [];
      return this;
    }
    const cfgPath = path.join(this.primaryRoot, WORKSPACE_FILE);
    const defaults = [{
      name: path.basename(this.primaryRoot),
      path: this.primaryRoot
    }];
    try {
      if (await fs.pathExists(cfgPath)) {
        const raw = await fs.readJson(cfgPath);
        const folders = (raw.folders || []).map((f) => ({
          name: String(f.name || path.basename(f.path)),
          path: path.resolve(String(f.path))
        })).filter((f) => f.path && !f.path.includes('..'));
        this.folders = folders.length ? folders : defaults;
      } else {
        this.folders = defaults;
      }
    } catch {
      this.folders = defaults;
    }
    return this;
  }

  async save() {
    if (!this.primaryRoot) return null;
    const cfgPath = path.join(this.primaryRoot, WORKSPACE_FILE);
    await fs.ensureDir(path.dirname(cfgPath));
    const data = {
      folders: this.folders.map((f) => ({ name: f.name, path: f.path }))
    };
    await fs.writeJson(cfgPath, data, { spaces: 2 });
    return data;
  }

  list() {
    return this.folders.map((f) => ({ name: f.name, path: f.path }));
  }

  findFolder(nameOrPath) {
    const key = String(nameOrPath || '');
    return this.folders.find(
      (f) => f.name === key || f.path === key || f.path.endsWith(key)
    );
  }

  async addFolder(folderPath, name) {
    const abs = path.resolve(folderPath);
    if (!(await fs.pathExists(abs))) throw new Error('Folder does not exist');
    const stat = await fs.stat(abs);
    if (!stat.isDirectory()) throw new Error('Not a directory');
    if (this.folders.some((f) => f.path === abs)) return this.folders;
    this.folders.push({
      name: name || path.basename(abs),
      path: abs
    });
    await this.save();
    return this.folders;
  }

  async removeFolder(folderPath) {
    const abs = path.resolve(folderPath);
    this.folders = this.folders.filter((f) => f.path !== abs);
    if (!this.folders.length && this.primaryRoot) {
      this.folders = [{ name: path.basename(this.primaryRoot), path: this.primaryRoot }];
    }
    await this.save();
    return this.folders;
  }

  /**
   * Resolve a workspace file reference:
   * - "src/foo.ts" → primary root
   * - "backend:src/foo.ts" → named folder
   * - absolute path under a known folder
   */
  resolveFile(ref) {
    const s = String(ref || '').replace(/^\.\//, '');
    if (!s) return null;

    if (s.includes(':') && !path.isAbsolute(s)) {
      const idx = s.indexOf(':');
      const folderKey = s.slice(0, idx);
      const rel = s.slice(idx + 1);
      const folder = this.findFolder(folderKey);
      if (!folder) return null;
      const abs = path.join(folder.path, rel);
      if (!abs.startsWith(folder.path)) return null;
      return { abs, folder: folder.name, rel, root: folder.path };
    }

    const primary = this.folders[0]?.path || this.primaryRoot;
    if (!primary) return null;
    const abs = path.isAbsolute(s) ? s : path.join(primary, s);
    if (!abs.startsWith(primary) && !this.folders.some((f) => abs.startsWith(f.path))) {
      return null;
    }
    const folder = this.folders.find((f) => abs.startsWith(f.path)) || this.folders[0];
    return {
      abs,
      folder: folder?.name || path.basename(primary),
      rel: path.relative(folder?.path || primary, abs).replace(/\\/g, '/'),
      root: folder?.path || primary
    };
  }

  /** Checkpoint manifest entry: { folder, path } relative to folder root */
  toCheckpointRef(absPath) {
    const abs = path.resolve(absPath);
    const folder = this.folders.find((f) => abs.startsWith(f.path + path.sep) || abs === f.path);
    if (!folder) return null;
    return {
      folder: folder.name,
      path: path.relative(folder.path, abs).replace(/\\/g, '/')
    };
  }

  fromCheckpointRef(entry) {
    const folder = this.findFolder(entry.folder) || this.folders[0];
    if (!folder) return null;
    const rel = String(entry.path || '').replace(/^\.\//, '');
    if (rel.includes('..')) return null;
    return path.join(folder.path, rel);
  }
}

module.exports = { WorkspaceManager, WORKSPACE_FILE };
