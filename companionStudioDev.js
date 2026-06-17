/**
 * FA7 OS “Studio” layer — self-repair and capability hooks (Fard-style dev:*).
 * Root: the FA7 project folder (where companion.js lives), not the user sandbox.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createTwoFilesPatch } = require('./lib/two-files-patch');

const STUDIO_ROOT = path.resolve(__dirname);
const DEV_READ_MAX = 512 * 1024;
const DEV_WRITE_MAX = 2 * 1024 * 1024;
const DEV_DIFF_PREVIEW_MAX = 120000;
const DEV_NPM_OUTPUT_MAX = 400000;
const DEV_NPM_TIMEOUT_MS = 600000;

function realPathSafe(p) {
  try {
    const r = path.resolve(String(p || ''));
    return fs.existsSync(r) ? fs.realpathSync(r) : r;
  } catch {
    try {
      return path.resolve(String(p || ''));
    } catch {
      return '';
    }
  }
}

/** Self-repair is allowed only when the IDE’s open project is the FA7 source root (same folder as companion). */
function isSelfRepairAllowed(getActiveProjectRoot) {
  const fn = typeof getActiveProjectRoot === 'function' ? getActiveProjectRoot : () => '';
  const active = realPathSafe(fn());
  const studio = realPathSafe(STUDIO_ROOT);
  if (!active || !studio) return false;
  if (process.platform === 'win32') {
    return active.toLowerCase() === studio.toLowerCase();
  }
  return active === studio;
}

function resolveSafeStudioPath(rel) {
  const raw = String(rel || '').trim();
  if (!raw) {
    throw new Error('Invalid path');
  }
  const norm = path.normalize(raw);
  if (path.isAbsolute(norm)) {
    throw new Error('Only relative paths under the studio root are allowed');
  }
  const full = path.resolve(STUDIO_ROOT, norm);
  const rootWithSep = STUDIO_ROOT + path.sep;
  if (full !== STUDIO_ROOT && !full.startsWith(rootWithSep)) {
    throw new Error('Path escapes the studio folder');
  }
  const relFromRoot = path.relative(STUDIO_ROOT, full);
  const top = relFromRoot.split(path.sep)[0];
  const blocked = new Set(['node_modules', '.git', 'dist', 'sandbox']);
  if (blocked.has(top)) {
    throw new Error('This path is blocked for safety');
  }
  return full;
}

function validateNpmSpawnArgs(parts) {
  if (!Array.isArray(parts) || parts.length < 1) return false;
  const a = parts.map(String);
  if (a[0] === 'run') {
    return a.length === 2 && /^[\w-]+$/.test(a[1]);
  }
  if (['install', 'ci', 'test', 'audit', 'update', 'outdated'].includes(a[0])) {
    return a.length === 1;
  }
  return false;
}

function readFile(rel) {
  try {
    const full = resolveSafeStudioPath(rel);
    const st = fs.statSync(full);
    if (!st.isFile()) {
      return { ok: false, error: 'Not a file' };
    }
    if (st.size > DEV_READ_MAX) {
      return { ok: false, error: 'File exceeds maximum allowed size' };
    }
    const content = fs.readFileSync(full, 'utf8');
    return { ok: true, path: rel, content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function writeFile(rel, content) {
  try {
    const full = resolveSafeStudioPath(rel);
    const buf = Buffer.from(String(content), 'utf8');
    if (buf.length > DEV_WRITE_MAX) {
      return { ok: false, error: 'Content exceeds maximum allowed size' };
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf, 'utf8');
    return { ok: true, path: rel };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function diffPreview(rel, newContent) {
  try {
    const full = resolveSafeStudioPath(rel);
    let oldContent = '';
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      oldContent = fs.readFileSync(full, 'utf8');
    }
    const next = String(newContent ?? '');
    let patch = createTwoFilesPatch(rel, rel, oldContent, next, '', '') || '';
    if (patch.length > DEV_DIFF_PREVIEW_MAX) {
      patch = patch.slice(0, DEV_DIFF_PREVIEW_MAX) + '\n\n... [truncated for display]';
    }
    return { ok: true, patch, isNewFile: oldContent === '' };
  } catch (e) {
    return { ok: false, error: e.message, patch: '' };
  }
}

function listNpmScripts() {
  try {
    const pkgPath = path.join(STUDIO_ROOT, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { ok: true, scripts: [] };
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const names = Object.keys(pkg.scripts || {});
    return { ok: true, scripts: names };
  } catch (e) {
    return { ok: false, error: e.message, scripts: [] };
  }
}

function spawnNpm(parts) {
  if (!validateNpmSpawnArgs(parts)) {
    return Promise.resolve({
      ok: false,
      error: 'npm command is not allowed',
      code: -1,
      out: '',
      err: ''
    });
  }
  return new Promise((resolve) => {
    const child = spawn('npm', parts, {
      cwd: STUDIO_ROOT,
      env: process.env,
      shell: process.platform === 'win32',
      windowsHide: true
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch (_) {}
    }, DEV_NPM_TIMEOUT_MS);
    child.stdout?.on('data', (d) => {
      const s = d.toString();
      if (out.length < DEV_NPM_OUTPUT_MAX) out += s.slice(0, DEV_NPM_OUTPUT_MAX - out.length);
    });
    child.stderr?.on('data', (d) => {
      const s = d.toString();
      if (err.length < DEV_NPM_OUTPUT_MAX) err += s.slice(0, DEV_NPM_OUTPUT_MAX - err.length);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message, code: -1, out, err });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        out,
        err,
        error: code === 0 ? '' : `Exited with code ${code}`
      });
    });
  });
}

function mountStudioRoutes(app, options = {}) {
  const getActiveProjectRoot = typeof options.getActiveProjectRoot === 'function' ? options.getActiveProjectRoot : () => '';

  function guardSelfRepair(res) {
    if (!isSelfRepairAllowed(getActiveProjectRoot)) {
      res.status(403).json({
        ok: false,
        code: 'SELF_REPAIR_DISABLED',
        message:
          'Self-repair is only enabled when the IDE open folder is exactly the FA7 source root (the folder where companion runs).',
        studioRoot: STUDIO_ROOT,
        activeRoot: String(getActiveProjectRoot() || '')
      });
      return false;
    }
    return true;
  }

  app.get('/api/studio/self-repair-status', (req, res) => {
    const active = String(getActiveProjectRoot() || '');
    res.json({
      ok: true,
      allowed: isSelfRepairAllowed(getActiveProjectRoot),
      studioRoot: STUDIO_ROOT,
      activeRoot: active
    });
  });

  app.get('/api/studio/project-root', (req, res) => {
    res.json({ ok: true, root: STUDIO_ROOT });
  });

  app.post('/api/studio/read', (req, res) => {
    if (!guardSelfRepair(res)) return;
    const rel = req.body?.rel ?? req.body?.path;
    res.json(readFile(rel));
  });

  app.post('/api/studio/write', (req, res) => {
    if (!guardSelfRepair(res)) return;
    const { rel, path: p, content } = req.body || {};
    res.json(writeFile(rel || p, content));
  });

  app.post('/api/studio/diff-preview', (req, res) => {
    if (!guardSelfRepair(res)) return;
    const { rel, path: p, newContent } = req.body || {};
    res.json(diffPreview(rel || p, newContent));
  });

  app.get('/api/studio/npm-scripts', (req, res) => {
    if (!guardSelfRepair(res)) return;
    res.json(listNpmScripts());
  });

  app.post('/api/studio/npm-run', (req, res) => {
    if (!guardSelfRepair(res)) return;
    const parts = req.body?.parts;
    spawnNpm(parts).then((r) => res.json(r));
  });
}

module.exports = {
  mountStudioRoutes,
  STUDIO_ROOT,
  isSelfRepairAllowed,
  resolveSafeStudioPath,
  readFile,
  writeFile,
  diffPreview,
  listNpmScripts,
  spawnNpm
};
