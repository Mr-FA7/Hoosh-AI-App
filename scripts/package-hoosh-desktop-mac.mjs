#!/usr/bin/env node
/**
 * Package Hoosh Desktop for macOS → public/HooshSetup.dmg
 *
 * Stages PyInstaller Hoosh.app + Runtime (companion + dist + node deps),
 * Install.command (Terminal path for Gatekeeper), then hdiutil.
 */
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync, rmSync, chmodSync, mkdirSync, writeFileSync, cpSync, readdirSync, statSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const dmgOut = path.join(publicDir, 'HooshSetup.dmg');
const workRoot = path.join(os.tmpdir(), `hoosh-desktop-dmg-${process.pid}`);
const stage = path.join(workRoot, 'stage');
const tmpDmg = path.join(workRoot, 'HooshSetup.dmg');
const volName = 'Hoosh Desktop';

const pyDistApp = path.join(root, 'dist_desktop', 'Hoosh.app');
const pyDistDir = path.join(root, 'dist_desktop', 'Hoosh');

if (process.platform !== 'darwin') {
  console.error('desktop:package:mac — macOS only. Skipping.');
  process.exit(0);
}

function ensurePyInstallerBuild() {
  if (existsSync(pyDistApp)) return pyDistApp;
  if (existsSync(path.join(pyDistDir, 'Hoosh'))) {
    // Wrap onedir into .app manually later
    return null;
  }
  console.log('→ Running PyInstaller (desktop/Hoosh.spec)…');
  execSync(
    `cd "${root}" && python3 -m PyInstaller --noconfirm --distpath dist_desktop --workpath build/pyinstaller-desktop desktop/Hoosh.spec`,
    { stdio: 'inherit', shell: true }
  );
  if (existsSync(pyDistApp)) return pyDistApp;
  return null;
}

function copyRuntime(destRuntime) {
  mkdirSync(destRuntime, { recursive: true });
  const files = [
    'companion.js',
    'package.json',
    'package-lock.json',
    'kernel.js',
  ];
  for (const f of files) {
    const src = path.join(root, f);
    if (existsSync(src)) cpSync(src, path.join(destRuntime, f));
  }
  // Keep DMG lean: ship source + production lockfile; Install.command runs npm ci.
  // Do NOT bundle full node_modules (hundreds of MB) into the download.
  for (const dir of ['lib', 'dist']) {
    const src = path.join(root, dir);
    if (existsSync(src)) {
      console.log(`→ Copy ${dir}…`);
      cpSync(src, path.join(destRuntime, dir), { recursive: true });
    }
  }
}

function wrapOnedirAsApp(onedir, appPath) {
  const macOs = path.join(appPath, 'Contents', 'MacOS');
  const res = path.join(appPath, 'Contents', 'Resources');
  mkdirSync(macOs, { recursive: true });
  mkdirSync(res, { recursive: true });
  cpSync(onedir, path.join(res, 'Hoosh'), { recursive: true });
  const bin = path.join(macOs, 'Hoosh');
  writeFileSync(bin, `#!/bin/bash\nDIR="$(cd "$(dirname "$0")/../Resources/Hoosh" && pwd)"\nexport HOOSH_ROOT="$(cd "$(dirname "$0")/../Resources/runtime" && pwd)"\nexec "$DIR/Hoosh" "$@"\n`);
  chmodSync(bin, 0o755);
  writeFileSync(path.join(appPath, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Hoosh</string>
  <key>CFBundleIdentifier</key><string>com.hoosh.desktop</string>
  <key>CFBundleName</key><string>Hoosh</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
`);
}

rmSync(workRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(publicDir, { recursive: true });

let appSrc = ensurePyInstallerBuild();
const stagedApp = path.join(stage, 'Hoosh.app');

if (appSrc && existsSync(appSrc)) {
  execFileSync('/usr/bin/ditto', [appSrc, stagedApp], { stdio: 'inherit' });
} else if (existsSync(pyDistDir)) {
  wrapOnedirAsApp(pyDistDir, stagedApp);
} else {
  console.warn('PyInstaller output missing — staging Installer that launches python desktop/main.py from Resources source.');
  const macOs = path.join(stagedApp, 'Contents', 'MacOS');
  mkdirSync(macOs, { recursive: true });
  writeFileSync(path.join(macOs, 'Hoosh'), `#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/../Resources/runtime" && pwd)"
export HOOSH_ROOT="$ROOT"
DESKTOP="$(cd "$(dirname "$0")/../Resources/desktop" && pwd)"
cd "$ROOT" || exit 1
exec python3 "$DESKTOP/main.py"
`);
  chmodSync(path.join(macOs, 'Hoosh'), 0o755);
  writeFileSync(path.join(stagedApp, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Hoosh</string>
  <key>CFBundleIdentifier</key><string>com.hoosh.desktop</string>
  <key>CFBundleName</key><string>Hoosh</string>
</dict></plist>
`);
  cpSync(path.join(root, 'desktop'), path.join(stagedApp, 'Contents', 'Resources', 'desktop'), { recursive: true });
}

const runtimeDest = path.join(stagedApp, 'Contents', 'Resources', 'runtime');
copyRuntime(runtimeDest);

try {
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '-s', '-', stagedApp], { stdio: 'inherit' });
} catch {
  console.warn('codesign ad-hoc skipped');
}

const installCommand = `#!/bin/bash
set +e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")" || exit 1
SRC="$(pwd)/Hoosh.app"
DEST_DIR="$HOME/Applications"
DEST="$DEST_DIR/Hoosh.app"
BIN="$DEST/Contents/MacOS/Hoosh"

clear 2>/dev/null
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        Hoosh Desktop — Installer     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

xattr -cr "$(pwd)" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$(pwd)" >/dev/null 2>&1

if [ ! -d "$SRC" ]; then
  echo "ERROR: Hoosh.app not found. Re-download HooshSetup.dmg from https://aihoosh.com"
  read -r -p "Press Enter to close…"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found. Install from https://nodejs.org then re-run this installer."
  read -r -p "Press Enter to close…"
  exit 1
fi

mkdir -p "$DEST_DIR"
rm -rf "$DEST"
echo "→ Installing to $DEST …"
/usr/bin/ditto "$SRC" "$DEST"
chmod +x "$BIN"
xattr -cr "$DEST" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1
codesign --force --deep -s - "$DEST" >/dev/null 2>&1 || true

RUNTIME="$DEST/Contents/Resources/runtime"
if [ -f "$RUNTIME/package.json" ] && [ ! -d "$RUNTIME/node_modules" ]; then
  echo "→ Installing Runtime dependencies (first run, needs network once)…"
  (cd "$RUNTIME" && npm ci --omit=dev) || (cd "$RUNTIME" && npm install --omit=dev) || {
    echo "WARNING: npm install failed — open Hoosh after fixing network/Node."
  }
fi

echo "→ Launching Hoosh Desktop via Terminal…"
echo ""
"$BIN"
echo ""
read -r -p "Press Enter to close…"
`;

writeFileSync(path.join(stage, 'Install Hoosh.command'), installCommand);
chmodSync(path.join(stage, 'Install Hoosh.command'), 0o755);

writeFileSync(path.join(stage, 'README.txt'), `Hoosh Desktop
==============

1. Right-click "Install Hoosh.command" → Open → Open
2. Or drag Hoosh.app to ~/Applications and run Install Hoosh.command

Requires Node.js for Local Runtime (https://nodejs.org).
Unsigned builds need Terminal / Open Anyway until Apple Developer ID notarization.

Offline: after install, core UI + Runtime + local models work without the website.
`);

rmSync(tmpDmg, { force: true });
execFileSync('hdiutil', [
  'create', '-volname', volName, '-srcfolder', stage,
  '-ov', '-format', 'UDZO', tmpDmg,
], { stdio: 'inherit' });

cpSync(tmpDmg, dmgOut);
rmSync(workRoot, { recursive: true, force: true });
const sz = statSync(dmgOut).size;
console.log(`✓ ${dmgOut} (${(sz / 1024 / 1024).toFixed(1)} MB)`);
