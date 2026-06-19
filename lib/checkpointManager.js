const fs = require('fs-extra');
const path = require('path');

const CHECKPOINT_DIR = '.fa7/checkpoints';

function normalizeFileEntry(file, workspace = null) {
  if (file && typeof file === 'object' && file.path) {
    const folder = file.folder || null;
    const rel = String(file.path).replace(/^\.\//, '');
    if (folder && workspace?.fromCheckpointRef) {
      const abs = workspace.fromCheckpointRef({ folder, path: rel });
      return abs ? { abs, manifest: { folder, path: rel } } : null;
    }
    return null;
  }
  const relPath = String(file || '').replace(/^\.\//, '');
  if (!relPath || relPath.includes('..')) return null;
  return { abs: null, relPath, manifest: relPath };
}

class CheckpointManager {
  constructor(projectRoot, workspace = null) {
    this.projectRoot = projectRoot;
    this.workspace = workspace;
    this.baseDir = path.join(projectRoot, CHECKPOINT_DIR);
  }

  setWorkspace(workspace) {
    this.workspace = workspace;
  }

  async ensureDir() {
    await fs.ensureDir(this.baseDir);
  }

  async create(label, files = [], meta = {}) {
    await this.ensureDir();
    const id = `cp_${Date.now()}`;
    const dir = path.join(this.baseDir, id);
    await fs.mkdir(dir, { recursive: true });
    const manifest = {
      id,
      label: label || 'auto',
      createdAt: new Date().toISOString(),
      files: [],
      messageIndex: meta.messageIndex ?? null,
      sessionId: meta.sessionId || null,
      multiRoot: false
    };

    for (const file of files) {
      const entry = normalizeFileEntry(file, this.workspace);
      if (!entry) continue;

      let src;
      let destRel;
      if (entry.abs) {
        src = entry.abs;
        const folder = this.workspace?.findFolder(entry.manifest.folder);
        destRel = path.join(entry.manifest.folder, entry.manifest.path).replace(/\\/g, '/');
        manifest.multiRoot = true;
      } else {
        src = path.join(this.projectRoot, entry.relPath);
        destRel = entry.relPath;
      }

      const dest = path.join(dir, destRel);
      try {
        await fs.ensureDir(path.dirname(dest));
        await fs.copy(src, dest);
        manifest.files.push(entry.manifest);
      } catch {
        /* file may not exist yet */
      }
    }

    await fs.writeJson(path.join(dir, 'manifest.json'), manifest, { spaces: 2 });
    return manifest;
  }

  async list() {
    await this.ensureDir();
    const entries = await fs.readdir(this.baseDir);
    const out = [];
    for (const id of entries) {
      const manifestPath = path.join(this.baseDir, id, 'manifest.json');
      if (await fs.pathExists(manifestPath)) {
        try {
          const m = await fs.readJson(manifestPath);
          out.push(m);
        } catch {
          /* skip */
        }
      }
    }
    return out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async restore(checkpointId) {
    const dir = path.join(this.baseDir, checkpointId);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error('Checkpoint not found');
    }
    const manifest = await fs.readJson(manifestPath);
    const restored = [];

    for (const fileEntry of manifest.files || []) {
      let srcRel;
      let dest;

      if (typeof fileEntry === 'object' && fileEntry.folder && this.workspace) {
        srcRel = path.join(fileEntry.folder, fileEntry.path).replace(/\\/g, '/');
        dest = this.workspace.fromCheckpointRef(fileEntry);
      } else {
        const rel = typeof fileEntry === 'string' ? fileEntry : fileEntry.path;
        srcRel = rel;
        dest = path.join(this.projectRoot, rel);
      }

      if (!dest) continue;
      const src = path.join(dir, srcRel);
      if (await fs.pathExists(src)) {
        await fs.ensureDir(path.dirname(dest));
        await fs.copy(src, dest);
        restored.push(typeof fileEntry === 'object' ? `${fileEntry.folder}:${fileEntry.path}` : fileEntry);
      }
    }
    return { ok: true, restored, checkpoint: manifest };
  }

  async delete(checkpointId) {
    const dir = path.join(this.baseDir, checkpointId);
    await fs.remove(dir);
    return { ok: true };
  }
}

module.exports = { CheckpointManager, CHECKPOINT_DIR, normalizeFileEntry };
