/**
 * Self-update: check GitHub Releases, download artifact, verify SHA-256.
 * Production: add signature verification + staged rollout.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fetchSecure } from '../connectivity/http-client.js';
import { getUatHome } from '../safety/logger.js';

const DEFAULT_REPO = process.env.UAT_UPDATE_REPO || 'your-org/universal-ai-terminal';

/**
 * @param {{ owner?: string, repo?: string, currentVersion: string }} opts
 */
export async function checkForUpdate(opts) {
  const [owner, repo] =
    opts.owner && opts.repo ? [opts.owner, opts.repo] : DEFAULT_REPO.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const res = await fetch(url, { headers: { 'User-Agent': 'UAT-SelfUpdate/0.1' } });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const rel = await res.json();
  const latest = rel.tag_name?.replace(/^v/, '') || '0.0.0';
  return {
    latestVersion: latest,
    publishedAt: rel.published_at,
    assets: (rel.assets || []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size
    })),
    needsUpdate: compareSemver(opts.currentVersion, latest) < 0
  };
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

/**
 * Download release asset and verify sha256 if checksum file provided alongside.
 * @param {string} assetUrl
 * @param {string} expectedSha256Hex optional
 */
export async function downloadAndVerify(assetUrl, expectedSha256Hex) {
  const { buffer } = await fetchSecure(assetUrl);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (expectedSha256Hex && hash !== expectedSha256Hex.toLowerCase()) {
    throw new Error(`SHA-256 mismatch: got ${hash}`);
  }
  const dir = path.join(getUatHome(), 'updates', 'staging');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `download-${hash.slice(0, 8)}.bin`);
  fs.writeFileSync(dest, buffer);
  return { path: dest, sha256: hash };
}

export { compareSemver };
