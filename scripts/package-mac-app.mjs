#!/usr/bin/env node
/**
 * Packages install-bridge/mac/HooshCompanion.app into public/hoosh-bridge-setup-mac.zip.
 * Uses `ditto` so the .app bundle (exec bits, structure) survives the round-trip.
 * macOS only.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'install-bridge', 'mac', 'HooshCompanion.app');
const exe = path.join(appDir, 'Contents', 'MacOS', 'HooshCompanion');
const readme = path.join(root, 'install-bridge', 'mac', 'README-mac.txt');
const out = path.join(root, 'public', 'hoosh-bridge-setup-mac.zip');

if (process.platform !== 'darwin') {
  console.error('package-mac-app: must run on macOS (needs ditto). Skipping.');
  process.exit(0);
}
if (!existsSync(appDir)) {
  console.error('package-mac-app: HooshCompanion.app not found at', appDir);
  process.exit(1);
}

chmodSync(exe, 0o755);
rmSync(out, { force: true });

// --keepParent keeps "HooshCompanion.app" as the top-level entry inside the zip.
const args = ['-c', '-k', '--sequesterRsrc', '--keepParent', appDir, out];
execFileSync('/usr/bin/ditto', args, { stdio: 'inherit' });

// Add the plain-text instructions alongside the app (zip append).
if (existsSync(readme)) {
  execFileSync('/usr/bin/ditto', ['-c', '-k', readme, path.join(root, 'public', '__mac_readme.zip')]);
  // ditto can't append; use zip to add the readme into the same archive.
  execFileSync('/usr/bin/zip', ['-j', out, readme], { stdio: 'inherit' });
  rmSync(path.join(root, 'public', '__mac_readme.zip'), { force: true });
}

console.log('Packaged →', path.relative(root, out));
