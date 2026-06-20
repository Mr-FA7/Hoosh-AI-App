#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extDir   = path.join(root, 'extensions', 'hoosh-local-bridge');
const extDirFF = path.join(root, 'extensions', 'hoosh-local-bridge-firefox');
const publicDir = path.join(root, 'public');
const installDir = path.join(root, 'install-bridge');

const EXT_FILES    = ['manifest.json', 'background.js', 'content.js', 'bridge-page.js', 'popup.html', 'popup.js', 'options.html', 'README.md', 'icon.svg'];
const EXT_FILES_FF = ['manifest.json', 'background.js', 'content.js', 'bridge-page.js', 'popup.html', 'popup.js', 'options.html'];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function zipDir(files, baseDir, outPath) {
  const zip = new AdmZip();
  for (const name of files) {
    const full = path.join(baseDir, name);
    if (fs.existsSync(full)) zip.addLocalFile(full);
  }
  ensureDir(path.dirname(outPath));
  zip.writeZip(outPath);
  console.log('Wrote', outPath);
}

function main() {
  ensureDir(publicDir);

  zipDir(EXT_FILES,    extDir,   path.join(publicDir, 'hoosh-local-bridge.zip'));
  zipDir(EXT_FILES_FF, extDirFF, path.join(publicDir, 'hoosh-local-bridge-firefox.zip'));

  zipDir(
    ['Start-Hoosh-Bridge.bat', 'Start-Hoosh-Bridge.ps1', 'Start-HooshBridge-Auto.bat', 'Start-HooshBridge-Auto.ps1', 'Register-HooshExtension.ps1', 'Create-HooshChromeShortcut.ps1', 'Install-Extension-InYourChrome.ps1', 'README.md'],
    installDir,
    path.join(publicDir, 'hoosh-bridge-setup-win.zip')
  );

  zipDir(
    ['Start-Hoosh-Bridge.command', 'README.md'],
    installDir,
    path.join(publicDir, 'hoosh-bridge-setup-mac.zip')
  );

  console.log('Downloads will be served at:');
  console.log('  /HooshBridgeSetup.exe              (Windows installer — recommended)');
  console.log('  /hoosh-local-bridge.zip            (Chrome extension)');
  console.log('  /hoosh-local-bridge-firefox.zip    (Firefox extension)');
  console.log('  /hoosh-bridge-setup-win.zip');
  console.log('  /hoosh-bridge-setup-mac.zip');
}

main();
