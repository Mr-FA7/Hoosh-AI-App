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

// Shared install body — used by .command AND plain install.sh
// Gatekeeper on Sequoia+ blocks unsigned .app AND .command double-clicks with “Not Opened”.
// Reliable path: open Terminal.app (trusted), paste one line from START HERE.txt.
const installBody = `set +e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Resolve DMG volume / folder that contains this script
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE" || exit 1

SRC="$HERE/Hoosh.app"
DEST_DIR="$HOME/Applications"
DEST="$DEST_DIR/Hoosh.app"
BIN="$DEST/Contents/MacOS/Hoosh"
LAUNCHER="$DEST_DIR/Start Hoosh.command"

clear 2>/dev/null
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        Hoosh Desktop — Installer     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Strip download quarantine (harmless if already clear)
xattr -cr "$HERE" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$HERE" >/dev/null 2>&1

if [ ! -d "$SRC" ]; then
  echo "ERROR: Hoosh.app not found next to this installer."
  echo "Open the HooshSetup.dmg disk image first, then re-run."
  echo ""
  read -r -p "Press Enter to close…"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required for Hoosh Runtime."
  echo "Install from https://nodejs.org then run this installer again."
  echo ""
  read -r -p "Press Enter to close…"
  exit 1
fi

mkdir -p "$DEST_DIR"
rm -rf "$DEST"
echo "→ Installing to $DEST …"
/usr/bin/ditto "$SRC" "$DEST"
chmod +x "$BIN" 2>/dev/null
# Never use \`open Hoosh.app\` — that triggers Gatekeeper. Run binary from Terminal.
xattr -cr "$DEST" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1
codesign --force --deep -s - "$DEST" >/dev/null 2>&1 || true

RUNTIME="$DEST/Contents/Resources/runtime"
if [ -f "$RUNTIME/package.json" ] && [ ! -d "$RUNTIME/node_modules" ]; then
  echo "→ Installing Runtime dependencies (first run, needs network once)…"
  (cd "$RUNTIME" && npm ci --omit=dev) || (cd "$RUNTIME" && npm install --omit=dev) || {
    echo "WARNING: npm install failed — fix network/Node, then re-run installer."
  }
fi

# Launcher that always starts via Terminal binary (avoids “Not Opened” on Hoosh.app)
cat > "$LAUNCHER" << 'LAUNCH'
#!/bin/bash
set +e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
APP="$HOME/Applications/Hoosh.app"
BIN="$APP/Contents/MacOS/Hoosh"
xattr -cr "$APP" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$APP" >/dev/null 2>&1
if [ ! -x "$BIN" ]; then
  echo "Hoosh not found at $APP — re-run the installer from the DMG."
  read -r -p "Press Enter…"
  exit 1
fi
echo "Starting Hoosh Desktop…"
exec "$BIN"
LAUNCH
chmod +x "$LAUNCHER"
xattr -cr "$LAUNCHER" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$LAUNCHER" >/dev/null 2>&1

echo ""
echo "✓ Installed."
echo "  Later: open Terminal and run:"
echo "    bash \\"$HOME/Applications/Start Hoosh.command\\""
echo "  (Do not double-click Hoosh.app — macOS blocks unsigned apps.)"
echo ""
echo "→ Launching Hoosh Desktop now…"
echo ""
"$BIN"
STATUS=$?
echo ""
if [ $STATUS -ne 0 ]; then
  echo "Exit code $STATUS."
  echo "If macOS still blocked something:"
  echo "  System Settings → Privacy & Security → Open Anyway"
  open "x-apple.systempreferences:com.apple.preference.security" 2>/dev/null \\
    || open "x-apple.systempreferences:com.apple.Settings.PrivacySecurity.extension" 2>/dev/null \\
    || true
fi
read -r -p "Press Enter to close…"
exit $STATUS
`;

const installSh = `#!/bin/bash
# Run from Terminal (recommended). Double-click may show “Not Opened”.
${installBody}`;

const installCommand = `#!/bin/bash
# Prefer: open Terminal → paste the line from “START HERE.txt”
${installBody}`;

writeFileSync(path.join(stage, 'install.sh'), installSh);
chmodSync(path.join(stage, 'install.sh'), 0o755);
writeFileSync(path.join(stage, 'Install Hoosh.command'), installCommand);
chmodSync(path.join(stage, 'Install Hoosh.command'), 0o755);

writeFileSync(path.join(stage, 'START HERE.txt'), `HOOSH DESKTOP — MAC INSTALL (read this)
=======================================

macOS shows “Not Opened” for unsigned apps. That is normal until we have
an Apple Developer ID. Do NOT double-click Hoosh.app.

HOW TO INSTALL (works every time)
---------------------------------
1. Open the HooshSetup.dmg (this window).
2. Open the Terminal app (Spotlight: Terminal).
3. Copy-paste ONE line, then press Return:

xattr -cr "/Volumes/Hoosh Desktop" 2>/dev/null; bash "/Volumes/Hoosh Desktop/install.sh"

4. Allow Terminal if macOS asks. Wait for install + first launch.

IF THE VOLUME NAME DIFFERS
--------------------------
After opening the DMG, run:

cd /Volumes && ls
# then:
xattr -cr "/Volumes/<the-folder-name>"
bash "/Volumes/<the-folder-name>/install.sh"

AFTER INSTALL
-------------
Start Hoosh from Terminal (not Finder double-click):

bash "$HOME/Applications/Start Hoosh.command"

Optional: System Settings → Privacy & Security → Open Anyway
(only if something was blocked once).

Needs Node.js: https://nodejs.org
`);

writeFileSync(path.join(stage, 'README.txt'), `Hoosh Desktop
==============

See START HERE.txt — paste the Terminal one-liner. Do not double-click Hoosh.app.

Requires Node.js (https://nodejs.org).
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
