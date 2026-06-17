/**
 * Download Ollama binary from GitHub Releases into ~/.fa7-os/ollama-runtime/
 * (Fard-style; no Electron)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { companionDataRoot } = require('./companionOllamaRuntime');

const OLLAMA_RELEASES_LATEST_API = 'https://api.github.com/repos/ollama/ollama/releases/latest';

let runtimeDownloadInProgress = false;

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
}

function tryOllamaFile(p) {
  try {
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  } catch (_) {}
  return null;
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

function pickOllamaReleaseAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const pl = process.platform;
  const arch = process.arch;
  if (pl === 'darwin') {
    return list.find((a) => a && a.name === 'ollama-darwin.tgz') || null;
  }
  if (pl === 'win32') {
    if (arch === 'arm64') return list.find((a) => a && a.name === 'ollama-windows-arm64.zip') || null;
    return list.find((a) => a && a.name === 'ollama-windows-amd64.zip') || null;
  }
  if (pl === 'linux') {
    if (arch === 'arm64') {
      return (
        list.find((a) => a && a.name === 'ollama-linux-arm64.tar.zst') ||
        list.find((a) => a && a.name && a.name.startsWith('ollama-linux-arm64') && a.name.endsWith('.tar.zst')) ||
        null
      );
    }
    return (
      list.find((a) => a && a.name === 'ollama-linux-amd64.tar.zst') ||
      list.find((a) => a && a.name && a.name.startsWith('ollama-linux-amd64') && a.name.endsWith('.tar.zst')) ||
      null
    );
  }
  return null;
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
      throw new Error('Downloaded file checksum does not match GitHub asset');
    }
  }
}

function extractOllamaArchive(archivePath, outDir) {
  ensureDir(outDir);
  const lower = archivePath.toLowerCase();
  if (lower.endsWith('.tgz') || lower.endsWith('.tar.gz')) {
    const r = spawnSync('tar', ['-xzf', archivePath, '-C', outDir], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'tar.gz extraction failed');
    return;
  }
  if (lower.endsWith('.zip')) {
    let r = spawnSync('tar', ['-xf', archivePath, '-C', outDir], { encoding: 'utf8' });
    if (r.status !== 0) {
      const psCmd =
        "Expand-Archive -LiteralPath '" +
        archivePath.replace(/'/g, "''") +
        "' -DestinationPath '" +
        outDir.replace(/'/g, "''") +
        "' -Force";
      r = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCmd], { encoding: 'utf8' });
    }
    if (r.status !== 0) throw new Error(r.stderr || 'zip extraction failed');
    return;
  }
  if (lower.endsWith('.tar.zst') || lower.endsWith('.tzst')) {
    let r = spawnSync('tar', ['--zstd', '-xf', archivePath, '-C', outDir], { encoding: 'utf8' });
    if (r.status !== 0) {
      r = spawnSync('bash', ['-lc', `zstd -dc "${archivePath.replace(/"/g, '\\"')}" | tar -xf - -C "${outDir.replace(/"/g, '\\"')}"`], {
        encoding: 'utf8'
      });
    }
    if (r.status !== 0) {
      throw new Error(
        '.tar.zst extraction failed. On Linux you usually need tar with zstd support or the zstd package.'
      );
    }
    return;
  }
  throw new Error('Unsupported archive format: ' + path.basename(archivePath));
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

function embeddedOllamaBinPath() {
  const name = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  return path.join(companionDataRoot(), 'ollama-runtime', name);
}

async function downloadOllamaRuntimeIntoUserData() {
  const outBin = embeddedOllamaBinPath();
  const hit = tryOllamaFile(outBin);
  if (hit) return { ok: true, path: outBin, cached: true, version: '' };

  if (runtimeDownloadInProgress) {
    throw new Error('Runtime download already in progress; wait a few seconds.');
  }
  runtimeDownloadInProgress = true;
  const runtimeRoot = path.join(companionDataRoot(), 'ollama-runtime');
  ensureDir(runtimeRoot);

  try {
    const release = await ghFetchJson(OLLAMA_RELEASES_LATEST_API);
    const asset = pickOllamaReleaseAsset(release.assets);
    if (!asset || !asset.browser_download_url) {
      throw new Error('No suitable asset for this OS in the latest release');
    }

    const archivePath = path.join(runtimeRoot, asset.name);
    await downloadUrlToFileWithSha256(asset.browser_download_url, archivePath, asset.digest || '');

    const staging = path.join(runtimeRoot, '.extract-' + Date.now());
    ensureDir(staging);
    extractOllamaArchive(archivePath, staging);

    const wantName = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
    const extracted = findFileNamedRecursive(staging, wantName);
    if (!extracted) {
      throw new Error('Binary ' + wantName + ' not found inside archive');
    }

    try {
      fs.unlinkSync(outBin);
    } catch (_) {}
    try {
      fs.renameSync(extracted, outBin);
    } catch (_) {
      fs.copyFileSync(extracted, outBin);
    }
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(outBin, 0o755);
      } catch (_) {}
    }

    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch (_) {}
    try {
      fs.unlinkSync(archivePath);
    } catch (_) {}

    return { ok: true, path: outBin, version: release.tag_name || '', cached: false };
  } finally {
    runtimeDownloadInProgress = false;
  }
}

module.exports = {
  downloadOllamaRuntimeIntoUserData,
  embeddedOllamaBinPath,
  runtimeDownloadInProgress: () => runtimeDownloadInProgress
};
