/**
 * FA7 — embedded QEMU engine under ~/.aivon-os/vm-lab/qemu-runtime/
 * On macOS a prebuilt QEMU tarball (GPL) may be fetched from a public release; third-party hypervisor source is not embedded.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const VM_LAB_ROOT = path.join(os.homedir(), '.aivon-os', 'vm-lab');
const EMBEDDED_QEMU_ROOT = path.join(VM_LAB_ROOT, 'qemu-runtime');
const EMBEDDED_QEMU_BIN = path.join(EMBEDDED_QEMU_ROOT, 'bin');

/** Prebuilt release index URL for download (technical only; not duplicated in UI copy) */
const FA7_QEMU_UPSTREAM_RELEASE_API = 'https://api.github.com/repos/utmapp/qemu/releases/latest';

let qemuDownloadInProgress = false;

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
}

async function ghFetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FA7OS/1.0'
    }
  });
  if (!res.ok) throw new Error('GitHub API: ' + res.status);
  return res.json();
}

async function downloadUrlToFileWithSha256(url, dest, digestExpected) {
  const res = await fetch(url, { headers: { 'User-Agent': 'FA7OS/1.0' } });
  if (!res.ok) throw new Error('Download failed: ' + res.status);
  if (!res.body) throw new Error('Empty response body');
  ensureDir(path.dirname(dest));
  const hash = crypto.createHash('sha256');
  const ws = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        hash.update(Buffer.from(value));
        await new Promise((resolve, reject) => {
          ws.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
        });
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  await new Promise((resolve, reject) => ws.end((err) => (err ? reject(err) : resolve())));
  const hex = hash.digest('hex');
  if (digestExpected) {
    const want = String(digestExpected)
      .replace(/^sha256:/i, '')
      .trim()
      .toLowerCase();
    if (want && hex !== want) {
      try {
        fs.unlinkSync(dest);
      } catch (_) {}
      throw new Error('SHA256 mismatch');
    }
  }
  return hex;
}

function findFileNamedRecursive(root, baseName) {
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === baseName) return p;
    }
  }
  return null;
}

function pickBundledQemuTarballAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  return (
    list.find((a) => a && typeof a.name === 'string' && /^qemu-.+-utm\.tar\.xz$/i.test(a.name.trim())) || null
  );
}

function whichBin(name) {
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('where', [name], { encoding: 'utf8', timeout: 6000, windowsHide: true });
      if (r.status !== 0) return null;
      return String(r.stdout || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find(Boolean);
    }
    const r = spawnSync('which', [name], { encoding: 'utf8', timeout: 6000 });
    if (r.status !== 0) return null;
    return String(r.stdout || '').trim() || null;
  } catch (_) {
    return null;
  }
}

function resolveQemuSystemBinary() {
  const prefer =
    process.platform === 'win32'
      ? ['qemu-system-x86_64.exe', 'qemu-system-aarch64.exe', 'qemu-system-i386.exe']
      : ['qemu-system-x86_64', 'qemu-system-aarch64', 'qemu-system-i386'];
  for (const n of prefer) {
    const inEmbedded = findFileNamedRecursive(EMBEDDED_QEMU_BIN, n) || findFileNamedRecursive(EMBEDDED_QEMU_ROOT, n);
    if (inEmbedded && fs.existsSync(inEmbedded)) return { path: inEmbedded, source: 'embedded' };
  }
  for (const n of prefer) {
    const w = whichBin(n);
    if (w && fs.existsSync(w)) return { path: w, source: 'path' };
  }
  return { path: null, source: 'none' };
}

function resolveQemuImg() {
  const n = process.platform === 'win32' ? 'qemu-img.exe' : 'qemu-img';
  const inEmb = findFileNamedRecursive(EMBEDDED_QEMU_BIN, n) || findFileNamedRecursive(EMBEDDED_QEMU_ROOT, n);
  if (inEmb && fs.existsSync(inEmb)) return { path: inEmb, source: 'embedded' };
  const w = whichBin(n);
  if (w && fs.existsSync(w)) return { path: w, source: 'path' };
  return { path: null, source: 'none' };
}

function getEmbeddedQemuStatus() {
  const sys = resolveQemuSystemBinary();
  const img = resolveQemuImg();
  return {
    policy:
      'FA7 stores its QEMU engine under ~/.aivon-os/vm-lab/qemu-runtime (optional one-click fetch on macOS).',
    embeddedRoot: EMBEDDED_QEMU_ROOT,
    qemuSystem: sys.path ? { path: sys.path, source: sys.source } : null,
    qemuImg: img.path ? { path: img.path, source: img.source } : null,
    canOneClickDownload: process.platform === 'darwin',
    license:
      'QEMU is GPLv2. Prebuilt binary is fetched from a public release index when you use ensure; source requests: qemu.org.'
  };
}

async function ensureEmbeddedQemuDownload() {
  if (qemuDownloadInProgress) {
    throw new Error('VM engine download already in progress.');
  }
  if (process.platform !== 'darwin') {
    throw new Error(
      'One-click QEMU download is only available on macOS for now. On this system install qemu-system on PATH or place binaries under ' +
        EMBEDDED_QEMU_BIN +
        '.'
    );
  }

  const existing = resolveQemuSystemBinary();
  if (existing.path && existing.source === 'embedded') {
    return { ok: true, cached: true, ...getEmbeddedQemuStatus() };
  }

  qemuDownloadInProgress = true;
  ensureDir(EMBEDDED_QEMU_ROOT);
  const cacheDir = path.join(EMBEDDED_QEMU_ROOT, '.cache');
  ensureDir(cacheDir);

  try {
    const release = await ghFetchJson(FA7_QEMU_UPSTREAM_RELEASE_API);
    const asset = pickBundledQemuTarballAsset(release.assets);
    if (!asset || !asset.browser_download_url) {
      throw new Error('No qemu-*-utm.tar.xz asset in latest release');
    }

    const archivePath = path.join(cacheDir, asset.name);
    await downloadUrlToFileWithSha256(asset.browser_download_url, archivePath, asset.digest || '');

    const staging = path.join(EMBEDDED_QEMU_ROOT, '.extract-' + Date.now());
    ensureDir(staging);
    const tar = spawnSync('tar', ['-xf', archivePath, '-C', staging], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (tar.status !== 0) {
      throw new Error(tar.stderr || 'tar.xz extraction failed');
    }

    ensureDir(EMBEDDED_QEMU_BIN);
    const names = ['qemu-system-x86_64', 'qemu-system-aarch64', 'qemu-system-i386', 'qemu-img'];
    const copied = [];
    for (const base of names) {
      const found = findFileNamedRecursive(staging, base);
      if (!found) continue;
      const dest = path.join(EMBEDDED_QEMU_BIN, base);
      try {
        fs.unlinkSync(dest);
      } catch (_) {}
      fs.copyFileSync(found, dest);
      try {
        fs.chmodSync(dest, 0o755);
      } catch (_) {}
      copied.push(base);
    }

    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch (_) {}
    try {
      fs.unlinkSync(archivePath);
    } catch (_) {}

    if (!copied.length) {
      throw new Error('No qemu-system or qemu-img binary found in archive');
    }

    return {
      ok: true,
      cached: false,
      tag: release.tag_name || '',
      copied,
      ...getEmbeddedQemuStatus()
    };
  } finally {
    qemuDownloadInProgress = false;
  }
}

function validateIsoPath(input) {
  if (!input || typeof input !== 'string') return null;
  let p = path.resolve(input.trim());
  if (!p.toLowerCase().endsWith('.iso')) return null;
  let real;
  try {
    real = fs.realpathSync(p);
  } catch {
    return null;
  }
  try {
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  const home = os.homedir();
  const rl = real.toLowerCase();
  const hl = home.toLowerCase();
  if (rl.startsWith(hl + path.sep) || rl === hl) return real;
  if (process.platform === 'darwin' && real.startsWith('/Volumes/')) return real;
  if (process.platform === 'linux' && (real.startsWith('/media/') || real.startsWith('/mnt/'))) return real;
  if (process.platform === 'win32') return real;
  return null;
}

function bootIsoFromEmbedded({ isoPath, memoryMb }) {
  const iso = validateIsoPath(isoPath);
  if (!iso) throw new Error('Invalid ISO path (real file under Home or /Volumes)');

  let mem = Number(memoryMb);
  if (!Number.isFinite(mem)) mem = 2048;
  mem = Math.max(256, Math.min(8192, Math.floor(mem)));

  const { path: qemu } = resolveQemuSystemBinary();
  if (!qemu) {
    throw new Error('qemu-system not found. Use “Install FA7 engine” on macOS or install qemu on PATH.');
  }

  const isX86 = path.basename(qemu).includes('x86_64') || path.basename(qemu).includes('i386');
  const args = ['-m', String(mem), '-cdrom', iso, '-boot', 'd'];
  if (process.platform === 'darwin') {
    args.push('-display', 'cocoa');
    if (isX86 && process.arch === 'arm64') args.push('-accel', 'tcg');
  } else if (process.platform === 'linux') {
    args.push('-display', 'default');
  } else {
    args.push('-display', 'default');
  }

  const child = spawn(qemu, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  if (!child.pid) {
    throw new Error('Failed to start QEMU');
  }
  return { ok: true, pid: child.pid, qemu, args };
}

function mountEmbeddedQemuRoutes(app) {
  app.get('/api/v3/vm-lab/embedded/status', (req, res) => {
    try {
      res.json({ ok: true, ...getEmbeddedQemuStatus() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'embedded status failed' });
    }
  });

  app.post('/api/v3/vm-lab/embedded/qemu/ensure', async (req, res) => {
    try {
      const out = await ensureEmbeddedQemuDownload();
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'ensure qemu failed' });
    }
  });

  app.post('/api/v3/vm-lab/embedded/qemu/boot-iso', (req, res) => {
    try {
      const r = bootIsoFromEmbedded({
        isoPath: req.body?.isoPath,
        memoryMb: req.body?.memoryMb
      });
      res.json(r);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'boot failed' });
    }
  });
}

module.exports = {
  getEmbeddedQemuStatus,
  ensureEmbeddedQemuDownload,
  mountEmbeddedQemuRoutes,
  getEmbeddedQemuStatusForVmLab: getEmbeddedQemuStatus
};
