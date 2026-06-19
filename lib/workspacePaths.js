/**
 * Multi-root workspace path resolution for file listing and reads.
 */
const path = require('path');

function primaryFolder(wm) {
  return wm?.folders?.[0] || null;
}

/**
 * @returns {{ mode: 'roots', folders: Array<{name:string,path:string}> } | { mode: 'dir', absDir: string, toEntryPath: (name: string) => string }}
 */
function resolveListRequest(wm, projectRoot, queryPath) {
  const q = String(queryPath || '').replace(/\\/g, '/').replace(/\/$/, '');

  if (!wm || wm.folders.length <= 1) {
    const absDir = q ? path.join(projectRoot, q) : projectRoot;
    return {
      mode: 'dir',
      absDir,
      toEntryPath: (name) => {
        const rel = q ? `${q}/${name}` : name;
        return rel.replace(/\\/g, '/');
      }
    };
  }

  if (!q) {
    return { mode: 'roots', folders: wm.list() };
  }

  if (q.includes(':')) {
    const idx = q.indexOf(':');
    const folderKey = q.slice(0, idx);
    const rel = q.slice(idx + 1).replace(/^\.\//, '');
    const folder = wm.findFolder(folderKey);
    if (!folder) throw new Error(`Unknown workspace folder: ${folderKey}`);
    const absDir = rel ? path.join(folder.path, rel) : folder.path;
    return {
      mode: 'dir',
      absDir,
      toEntryPath: (name) => {
        const part = rel ? `${rel}/${name}` : name;
        return `${folderKey}:${part}`.replace(/\\/g, '/');
      }
    };
  }

  const asFolder = wm.findFolder(q);
  if (asFolder && !q.includes('/')) {
    const isPrimary = asFolder.path === primaryFolder(wm)?.path;
    return {
      mode: 'dir',
      absDir: asFolder.path,
      toEntryPath: (name) => (isPrimary ? name : `${asFolder.name}:${name}`)
    };
  }

  const primary = primaryFolder(wm);
  const absDir = path.join(primary.path, q);
  return {
    mode: 'dir',
    absDir,
    toEntryPath: (name) => {
      const rel = q ? `${q}/${name}` : name;
      return rel.replace(/\\/g, '/');
    }
  };
}

function resolveReadPath(wm, projectRoot, ref) {
  const s = String(ref || '');
  if (!s) return null;
  if (wm?.resolveFile) {
    const resolved = wm.resolveFile(s);
    if (resolved?.abs) return resolved.abs;
  }
  return path.isAbsolute(s) ? s : path.join(projectRoot, s);
}

module.exports = { resolveListRequest, resolveReadPath, primaryFolder };
