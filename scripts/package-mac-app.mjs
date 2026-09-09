#!/usr/bin/env node
/**
 * Build macOS one-click installer: public/HooshCompanionSetup.dmg
 *
 * User flow: download DMG → open → double-click "Install Hoosh Companion"
 * → app copied to ~/Applications → companion starts.
 *
 * Staging uses os.tmpdir() because hdiutil fails on paths with spaces
 * (this repo lives under "Hoosh AI").
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync, rmSync, chmodSync, mkdirSync, writeFileSync, readFileSync, statSync, copyFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcApp = path.join(root, 'install-bridge', 'mac', 'HooshCompanion.app');
const srcExe = path.join(srcApp, 'Contents', 'MacOS', 'HooshCompanion');
const readmeSrc = path.join(root, 'install-bridge', 'mac', 'README-mac.txt');
const publicDir = path.join(root, 'public');
const dmgOut = path.join(publicDir, 'HooshCompanionSetup.dmg');
const zipOut = path.join(publicDir, 'hoosh-bridge-setup-mac.zip');
const workRoot = path.join(os.tmpdir(), `hoosh-companion-dmg-${process.pid}`);
const stage = path.join(workRoot, 'stage');
const tmpDmg = path.join(workRoot, 'HooshCompanionSetup.dmg');
const volName = 'Hoosh Companion';

if (process.platform !== 'darwin') {
  console.error('bridge:installer:mac — must run on macOS (needs hdiutil). Skipping.');
  process.exit(0);
}
if (!existsSync(srcApp) || !existsSync(srcExe)) {
  console.error('HooshCompanion.app missing at', srcApp);
  process.exit(1);
}

chmodSync(srcExe, 0o755);
rmSync(workRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const payloadApp = path.join(stage, 'HooshCompanion.app');
execFileSync('/usr/bin/ditto', [srcApp, payloadApp], { stdio: 'inherit' });
chmodSync(path.join(payloadApp, 'Contents', 'MacOS', 'HooshCompanion'), 0o755);

const installerApp = path.join(stage, 'Install Hoosh Companion.app');
const installerMacOS = path.join(installerApp, 'Contents', 'MacOS');
mkdirSync(installerMacOS, { recursive: true });
mkdirSync(path.join(installerApp, 'Contents', 'Resources'), { recursive: true });

writeFileSync(
  path.join(installerApp, 'Contents', 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Install Hoosh Companion</string>
  <key>CFBundleDisplayName</key><string>Install Hoosh Companion</string>
  <key>CFBundleIdentifier</key><string>com.fa7.hoosh.companion.installer</string>
  <key>CFBundleVersion</key><string>0.2.0</string>
  <key>CFBundleShortVersionString</key><string>0.2.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>InstallHooshCompanion</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`
);

const installerScript = `#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
SELF_APP="$(cd "$(dirname "$0")/../.." && pwd)"
DMG_ROOT="$(cd "$SELF_APP/.." && pwd)"
SRC="$DMG_ROOT/HooshCompanion.app"
DEST_DIR="$HOME/Applications"
DEST="$DEST_DIR/HooshCompanion.app"
alert()  { /usr/bin/osascript -e "display dialog \\"$1\\" with title \\"Hoosh Companion\\" buttons {\\"OK\\"} default button 1 with icon caution" >/dev/null 2>&1; }
notify() { /usr/bin/osascript -e "display notification \\"$1\\" with title \\"Hoosh Companion\\"" >/dev/null 2>&1; }
ask()    { /usr/bin/osascript -e "button returned of (display dialog \\"$1\\" with title \\"Hoosh Companion\\" buttons {\\"Cancel\\",\\"Install\\"} default button \\"Install\\" with icon note)" 2>/dev/null; }
xattr -dr com.apple.quarantine "$SELF_APP" >/dev/null 2>&1 || true
xattr -dr com.apple.quarantine "$SRC" >/dev/null 2>&1 || true
if [ ! -d "$SRC" ]; then
  alert "HooshCompanion.app not found next to the installer. Re-download HooshCompanionSetup.dmg from aihoosh.com."
  exit 1
fi
CHOICE="$(ask "Install Hoosh Companion to Applications and start it?\\\\n\\\\n(First launch may ask you to allow the app in System Settings → Privacy & Security.)")"
[ "$CHOICE" = "Install" ] || exit 0
mkdir -p "$DEST_DIR"
rm -rf "$DEST"
/usr/bin/ditto "$SRC" "$DEST" || { alert "Could not copy the app to $DEST_DIR"; exit 1; }
chmod +x "$DEST/Contents/MacOS/HooshCompanion"
xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1 || true
notify "Installed. Starting companion…"
open "$DEST"
exit 0
`;

const installerBin = path.join(installerMacOS, 'InstallHooshCompanion');
writeFileSync(installerBin, installerScript, { mode: 0o755 });
chmodSync(installerBin, 0o755);

const readmeText = existsSync(readmeSrc)
  ? readFileSync(readmeSrc, 'utf8')
  : 'Double-click “Install Hoosh Companion”.\n';
writeFileSync(path.join(stage, 'README.txt'), readmeText);

mkdirSync(publicDir, { recursive: true });
rmSync(tmpDmg, { force: true });
rmSync(dmgOut, { force: true });

execFileSync(
  '/usr/bin/hdiutil',
  [
    'create',
    '-volname', volName,
    '-srcfolder', stage,
    '-ov',
    '-format', 'UDZO',
    '-imagekey', 'zlib-level=9',
    tmpDmg
  ],
  { stdio: 'inherit' }
);

copyFileSync(tmpDmg, dmgOut);

rmSync(zipOut, { force: true });
execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', payloadApp, zipOut], {
  stdio: 'inherit'
});
if (existsSync(readmeSrc)) {
  execFileSync('/usr/bin/zip', ['-j', zipOut, readmeSrc], { stdio: 'inherit' });
}

rmSync(workRoot, { recursive: true, force: true });

const dmgKb = Math.round(statSync(dmgOut).size / 1024);
console.log(`Packaged → public/HooshCompanionSetup.dmg (${dmgKb} KB)`);
console.log('Also refreshed → public/hoosh-bridge-setup-mac.zip (contains .app)');
console.log('Serve at: /HooshCompanionSetup.dmg');
