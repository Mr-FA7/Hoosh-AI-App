#!/usr/bin/env node
/**
 * Package Hoosh Desktop for Windows → public/HooshSetup.exe (zipped portable renamed)
 * or a simple self-extracting-style folder zip as HooshSetup.zip + stub.
 *
 * On non-Windows CI we still produce public/HooshSetup.exe as a zip payload
 * with a launch script when a real NSIS build isn't available.
 */
import { execSync } from 'node:child_process';
import {
  existsSync, rmSync, mkdirSync, writeFileSync, cpSync, statSync, copyFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const outExe = path.join(publicDir, 'HooshSetup.exe');
const outZip = path.join(publicDir, 'HooshSetup-win.zip');
const work = path.join(os.tmpdir(), `hoosh-desktop-win-${process.pid}`);
const stage = path.join(work, 'Hoosh');

rmSync(work, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(publicDir, { recursive: true });

const pyDist = path.join(root, 'dist_desktop', 'Hoosh');
// Prefer slim portable: desktop sources + runtime (PyInstaller onedir is ~400MB+)
cpSync(path.join(root, 'desktop'), path.join(stage, 'desktop'), { recursive: true });
for (const f of ['companion.js', 'package.json', 'package-lock.json', 'kernel.js']) {
  const src = path.join(root, f);
  if (existsSync(src)) cpSync(src, path.join(stage, f));
}
for (const dir of ['lib', 'dist']) {
  const src = path.join(root, dir);
  if (existsSync(src)) cpSync(src, path.join(stage, dir), { recursive: true });
}
if (existsSync(path.join(pyDist, 'Hoosh.exe'))) {
  mkdirSync(path.join(stage, 'app'), { recursive: true });
  cpSync(path.join(pyDist, 'Hoosh.exe'), path.join(stage, 'app', 'Hoosh.exe'));
}

writeFileSync(path.join(stage, 'Start Hoosh.bat'), `@echo off
set HOOSH_ROOT=%~dp0
set PATH=%PATH%;C:\\Program Files\\nodejs
if exist "%~dp0app\\Hoosh.exe" (
  start "" "%~dp0app\\Hoosh.exe"
) else (
  python "%~dp0desktop\\main.py"
)
`);

writeFileSync(path.join(stage, 'README.txt'), `Hoosh Desktop (Windows)
Requires Node.js. Run "Start Hoosh.bat".
Download: https://aihoosh.com
`);

try {
  execSync(`cd "${work}" && zip -r "${outZip}" Hoosh`, { stdio: 'inherit', shell: true });
} catch {
  execSync(`cd "${work}" && tar -a -cf "${outZip}" Hoosh`, { stdio: 'inherit', shell: true });
}

// Prefer real exe from PyInstaller onedir if present
const builtExe = path.join(root, 'dist_desktop', 'Hoosh', 'Hoosh.exe');
if (existsSync(builtExe)) {
  copyFileSync(builtExe, outExe);
  console.log(`✓ ${outExe} (PyInstaller)`);
} else {
  console.log(`✓ ${outZip} — use this for Windows until native Hoosh.exe is built`);
}

rmSync(work, { recursive: true, force: true });
if (existsSync(outZip)) {
  console.log(`✓ ${outZip} (${(statSync(outZip).size / 1024 / 1024).toFixed(1)} MB)`);
}
