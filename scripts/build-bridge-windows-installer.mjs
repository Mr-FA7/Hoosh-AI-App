#!/usr/bin/env node
/**
 * Builds HooshBridgeSetup.exe for Windows (Inno Setup).
 * Stages portable Node 20, companion app + node_modules, Chrome extension.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import https from 'https';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const staging = path.join(root, 'build', 'win-bridge-staging');
const nodeVersion = 'v20.18.0';
const nodeZipName = `node-${nodeVersion}-win-x64.zip`;
const nodeCache = path.join(root, 'build', 'cache', nodeZipName);
const nodeUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeZipName}`;

const APP_GLOBS = [
  'companion.js',
  'kernel.js',
  'indexer.js',
  'ollamaManager.js',
  'systemHealth.js',
  'resourceManager.js',
  'negahAgent.js',
  'negahRunner.js',
  'composeBuildPipeline.js',
  'githubManager.js',
  'companionShellPty.js',
  'companionStudioDev.js',
  'companionOllamaPull.js',
  'companionOllamaApiProxy.js',
  'companionUatMount.js',
  'companionStacks.js',
  'companionFlows.js',
  'companionMedia.js',
  'companionVmLab.js',
  'companionVmLabEmbeddedQemu.js',
  'companionOllamaRuntime.js',
  'companionOllamaRuntimeDownload.js',
  'companionFa7Plugins.js',
  'kavoshBrowserKernel.js',
  'giraBdtmKernel.js',
  'package.json',
  'package-lock.json',
  '.npmrc',
];

const APP_DIRS = ['lib', 'fa7-plugins', 'templates', 'skills', 'tools', 'scripts'];

const EXT_FILES = ['manifest.json', 'background.js', 'content.js', 'README.md', 'icon.svg'];
const SKIP_ROOT_JS = new Set([
  'electron-main.js',
  'preload.js',
  'server.js',
  'vite.config.js',
]);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed ${res.statusCode}: ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function ensurePortableNode() {
  const nodeDest = path.join(staging, 'node');
  if (fs.existsSync(path.join(nodeDest, 'node.exe'))) return nodeDest;

  if (!fs.existsSync(nodeCache)) {
    console.log('Downloading', nodeUrl);
    await download(nodeUrl, nodeCache);
  }

  console.log('Extracting Node.js', nodeVersion);
  const zip = new AdmZip(nodeCache);
  const tmp = path.join(staging, '_node_extract');
  rimraf(tmp);
  zip.extractAllTo(tmp, true);
  const extracted = path.join(tmp, `node-${nodeVersion}-win-x64`);
  rimraf(nodeDest);
  copyDir(extracted, nodeDest);
  rimraf(tmp);
  return nodeDest;
}

function stageAppFiles() {
  const appDir = path.join(staging, 'app');
  rimraf(appDir);
  ensureDir(appDir);

  for (const name of APP_GLOBS) {
    const src = path.join(root, name);
    if (fs.existsSync(src)) copyFile(src, path.join(appDir, name));
  }

  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith('.js') || SKIP_ROOT_JS.has(name)) continue;
    if (name.startsWith('test') || name.startsWith('verify')) continue;
    const src = path.join(root, name);
    if (fs.statSync(src).isFile() && !fs.existsSync(path.join(appDir, name))) {
      copyFile(src, path.join(appDir, name));
    }
  }

  for (const dir of APP_DIRS) {
    copyDir(path.join(root, dir), path.join(appDir, dir));
  }
}

function installProductionDeps(nodeDir) {
  const appDir = path.join(staging, 'app');
  const npm = path.join(nodeDir, 'npm.cmd');
  const node = path.join(nodeDir, 'node.exe');

  console.log('Installing production dependencies (may take a few minutes)...');
  const env = { ...process.env, PATH: `${nodeDir};${process.env.PATH || ''}` };
  const r = spawnSync(npm, ['ci', '--omit=dev', '--legacy-peer-deps'], {
    cwd: appDir,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) {
    throw new Error('npm ci failed for bridge staging');
  }
  console.log('Dependencies installed.');
}

function stageExtension() {
  const extSrc = path.join(root, 'extensions', 'hoosh-local-bridge');
  const extDest = path.join(staging, 'extension');
  rimraf(extDest);
  ensureDir(extDest);
  for (const f of EXT_FILES) {
    const src = path.join(extSrc, f);
    if (fs.existsSync(src)) copyFile(src, path.join(extDest, f));
  }
}

function stageLaunchers() {
  const winDir = path.join(staging, 'win');
  copyDir(path.join(root, 'install-bridge', 'win'), winDir);
  for (const name of ['Start-HooshBridge-Auto.ps1', 'Start-HooshBridge-Auto.bat', 'Register-HooshExtension.ps1']) {
    const src = path.join(root, 'install-bridge', name);
    if (fs.existsSync(src)) copyFile(src, path.join(winDir, name));
  }
}

function findIscc() {
  const candidates = [
    path.join(root, 'node_modules', 'innosetup-compiler', 'bin', 'ISCC.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
    path.join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function compileInstaller() {
  const iscc = findIscc();
  if (!iscc) {
    console.warn('ISCC.exe not found. Install devDependency innosetup-compiler or Inno Setup 6.');
    console.warn('Staging folder is ready at:', staging);
    return false;
  }

  const iss = path.join(root, 'install-bridge', 'HooshBridgeSetup.iss');
  console.log('Compiling installer with', iscc);
  execSync(`"${iscc}" "${iss}"`, { stdio: 'inherit', cwd: root });
  const out = path.join(root, 'public', 'HooshBridgeSetup.exe');
  if (fs.existsSync(out)) {
    const mb = (fs.statSync(out).size / (1024 * 1024)).toFixed(1);
    console.log(`Wrote ${out} (${mb} MB)`);
  }
  return true;
}

async function main() {
  console.log('Building Hoosh Local Bridge Windows installer...');
  rimraf(staging);
  ensureDir(staging);

  const nodeDir = await ensurePortableNode();
  stageAppFiles();
  installProductionDeps(nodeDir);
  stageExtension();
  stageLaunchers();

  compileInstaller();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
