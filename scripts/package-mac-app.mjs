#!/usr/bin/env node
/**
 * Build macOS one-click installer: public/HooshCompanionSetup.dmg
 *
 * Gatekeeper blocks unsigned .app double-clicks ("Not Opened").
 * Primary entry is therefore a .command that runs in Terminal and
 * executes the companion binary directly (bypasses the .app GUI block).
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

// Ad-hoc sign (helps a little; still not notarized without Apple Developer ID)
try {
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '-s', '-', srcApp], { stdio: 'inherit' });
} catch {
  console.warn('codesign ad-hoc skipped');
}

rmSync(workRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const payloadApp = path.join(stage, 'HooshCompanion.app');
execFileSync('/usr/bin/ditto', [srcApp, payloadApp], { stdio: 'inherit' });
chmodSync(path.join(payloadApp, 'Contents', 'MacOS', 'HooshCompanion'), 0o755);
try {
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '-s', '-', payloadApp], { stdio: 'inherit' });
} catch { /* ignore */ }

// Primary: Terminal-based installer (works without Apple notarization)
const installCommand = `#!/bin/bash
# Hoosh Companion — one-click install (run from Terminal; bypasses “Not Opened” .app block)
set +e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
cd "$(dirname "$0")" || exit 1

SRC="$(pwd)/HooshCompanion.app"
DEST_DIR="$HOME/Applications"
DEST="$DEST_DIR/HooshCompanion.app"
BIN="$DEST/Contents/MacOS/HooshCompanion"

clear 2>/dev/null
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     Hoosh Companion — Installer      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Clear download quarantine on everything in this volume / folder
xattr -cr "$(pwd)" >/dev/null 2>&1
xattr -dr com.apple.quarantine "$(pwd)" >/dev/null 2>&1

if [ ! -d "$SRC" ]; then
  echo "ERROR: HooshCompanion.app not found next to this installer."
  echo "Re-download HooshCompanionSetup.dmg from https://aihoosh.com"
  echo ""
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

# Re-sign ad-hoc after copy (quarantine strip can confuse Gatekeeper)
codesign --force --deep -s - "$DEST" >/dev/null 2>&1 || true

echo "→ Starting companion (via Terminal — avoids macOS “Not Opened” block)…"
echo ""

# CRITICAL: run the executable directly instead of \`open Foo.app\`
# \`open\` triggers Gatekeeper UI for unsigned apps; direct exec does not.
"$BIN"
STATUS=$?

echo ""
if [ $STATUS -eq 0 ]; then
  echo "✓ Done. Keep this window until companion finishes first-time setup,"
  echo "  then you can close it. Companion keeps running in the background."
else
  echo "Companion exited with code $STATUS."
  echo "If macOS still blocked something:"
  echo "  System Settings → Privacy & Security → Open Anyway"
  open "x-apple.systempreferences:com.apple.preference.security" 2>/dev/null \\
    || open "x-apple.systempreferences:com.apple.Settings.PrivacySecurity.extension" 2>/dev/null \\
    || true
fi
echo ""
read -r -p "Press Enter to close…"
exit $STATUS
`;

writeFileSync(path.join(stage, 'Install Hoosh Companion.command'), installCommand, { mode: 0o755 });
chmodSync(path.join(stage, 'Install Hoosh Companion.command'), 0o755);

// Optional GUI helper that only opens the .command (still may be blocked once)
const helperApp = path.join(stage, 'If Needed — Open Installer.app');
const helperMacOS = path.join(helperApp, 'Contents', 'MacOS');
mkdirSync(helperMacOS, { recursive: true });
writeFileSync(
  path.join(helperApp, 'Contents', 'Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Open Installer</string>
  <key>CFBundleIdentifier</key><string>com.fa7.hoosh.companion.openinstall</string>
  <key>CFBundleVersion</key><string>0.2.1</string>
  <key>CFBundleShortVersionString</key><string>0.2.1</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>OpenInstaller</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
</dict></plist>`
);
writeFileSync(
  path.join(helperMacOS, 'OpenInstaller'),
  `#!/bin/bash
DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
CMD="$DIR/Install Hoosh Companion.command"
/usr/bin/osascript <<EOF
display dialog "macOS blocks unsigned apps with “Not Opened”.

Use this instead:
1. Close this dialog
2. Right-click “Install Hoosh Companion.command”
3. Choose Open → Open
4. Allow Terminal if asked

That path installs and starts Hoosh without the malware warning." buttons {"Open Privacy Settings", "OK"} default button "OK" with title "Hoosh Companion" with icon caution
EOF
BTN=$?
open "x-apple.systempreferences:com.apple.preference.security" 2>/dev/null || true
open -R "$CMD" 2>/dev/null || true
`,
  { mode: 0o755 }
);
chmodSync(path.join(helperMacOS, 'OpenInstaller'), 0o755);
try {
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '-s', '-', helperApp], { stdio: 'pipe' });
} catch { /* ignore */ }

const readmeText = `Hoosh Companion — macOS install
================================

IMPORTANT (macOS security)
  Apple shows “Not Opened” for apps that are not notarized.
  Do NOT double-click HooshCompanion.app first.

INSTALL (works around Gatekeeper)
  1. Open this disk image
  2. Right-click  “Install Hoosh Companion.command”
  3. Choose Open → Open
  4. Allow Terminal if macOS asks
  5. Wait for install + companion start
  6. In Chrome, Allow “access other apps” for aihoosh.com

If you already saw “Not Opened”
  System Settings → Privacy & Security → scroll down → Open Anyway
  Then run “Install Hoosh Companion.command” as above.

After install, Hoosh Companion lives in ~/Applications.
Re-run the same .command anytime to start/stop it.

https://aihoosh.com
`;
writeFileSync(path.join(stage, 'README.txt'), readmeText);
writeFileSync(readmeSrc, readmeText);

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
// Zip includes .command + .app for users who prefer zip
const zipStage = path.join(workRoot, 'zip-stage');
mkdirSync(zipStage, { recursive: true });
execFileSync('/usr/bin/ditto', [payloadApp, path.join(zipStage, 'HooshCompanion.app')]);
copyFileSync(path.join(stage, 'Install Hoosh Companion.command'), path.join(zipStage, 'Install Hoosh Companion.command'));
chmodSync(path.join(zipStage, 'Install Hoosh Companion.command'), 0o755);
writeFileSync(path.join(zipStage, 'README.txt'), readmeText);
execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', zipStage, zipOut], { stdio: 'inherit' });

rmSync(workRoot, { recursive: true, force: true });

const dmgKb = Math.round(statSync(dmgOut).size / 1024);
console.log(`Packaged → public/HooshCompanionSetup.dmg (${dmgKb} KB)`);
console.log('Primary entry: Install Hoosh Companion.command (Terminal — bypasses Not Opened)');
