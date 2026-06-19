/**
 * FA7 Media Studio Python venv — uses Python 3.12 when available (3.14 breaks many ML wheels).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { runCommand } = require('./containerRuntime');
const { getExampleRoot } = require('./mediaCatalog');
const { findBestPython } = require('./mediaSystemDeps');

const MEDIA_HOME = path.join(os.homedir(), '.aivon-os', 'media');
const VENV_DIR = path.join(MEDIA_HOME, 'venv');
const STATE_PATH = path.join(MEDIA_HOME, 'bootstrap-state.json');

function getMediaHome() {
  return MEDIA_HOME;
}

function getVenvDir() {
  return VENV_DIR;
}

function readVenvVersion() {
  try {
    const cfg = fs.readFileSync(path.join(VENV_DIR, 'pyvenv.cfg'), 'utf8');
    const m = cfg.match(/version\s*=\s*(\d+\.\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function getMediaPython() {
  if (process.env.FA7_MEDIA_PYTHON && fs.existsSync(process.env.FA7_MEDIA_PYTHON)) {
    return process.env.FA7_MEDIA_PYTHON;
  }
  const winPy = path.join(VENV_DIR, 'Scripts', 'python.exe');
  const unixPy = path.join(VENV_DIR, 'bin', 'python');
  if (fs.existsSync(winPy)) return winPy;
  if (fs.existsSync(unixPy)) return unixPy;
  return process.env.FA7_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

function getMediaEnv(extra = {}) {
  const exampleRoot = getExampleRoot();
  const pyPath = [];
  if (fs.existsSync(exampleRoot)) {
    pyPath.push(exampleRoot);
    try {
      for (const sub of fs.readdirSync(exampleRoot)) {
        if (sub.endsWith('-main') || sub.endsWith('-master') || sub.endsWith('-dev')) {
          pyPath.push(path.join(exampleRoot, sub));
        }
      }
    } catch { /* */ }
  }
  const sep = process.platform === 'win32' ? ';' : ':';
  const venvScripts = process.platform === 'win32'
    ? path.join(VENV_DIR, 'Scripts')
    : path.join(VENV_DIR, 'bin');
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  const existingPy = process.env.PYTHONPATH || '';
  const existingPath = process.env[pathKey] || '';
  return {
    ...process.env,
    ...extra,
    FA7_MEDIA_HOME: MEDIA_HOME,
    FA7_EXAMPLE_ROOT: exampleRoot,
    PYTHONPATH: [...pyPath, existingPy].filter(Boolean).join(sep),
    [pathKey]: [venvScripts, existingPath].filter(Boolean).join(sep),
    PYTHONUTF8: '1'
  };
}

async function ensureMediaVenv(options = {}) {
  await fs.ensureDir(MEDIA_HOME);
  const best = await findBestPython();
  if (!best) return { ok: false, error: 'No Python interpreter found' };

  const venvVer = readVenvVersion();
  const wantVer = best.version;
  const bad314 = venvVer && venvVer.startsWith('3.14') && !wantVer.startsWith('3.14');
  const versionMismatch = venvVer && wantVer && venvVer !== wantVer;
  const needsRecreate = options.forceRecreate || bad314 || versionMismatch;

  if (needsRecreate && fs.existsSync(VENV_DIR)) {
    await fs.remove(VENV_DIR);
  }

  if (!fs.existsSync(path.join(VENV_DIR, 'pyvenv.cfg'))) {
    const args = [...best.prefixArgs, '-m', 'venv', VENV_DIR];
    const r = await runCommand(best.bin, args, { timeoutMs: 120000 });
    if (!r.ok) return { ok: false, error: r.stderr || 'venv creation failed', python: best };
    const pipBoot = await runCommand(getMediaPython(), ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel', 'setuptools'], {
      timeoutMs: 300000,
      env: getMediaEnv()
    });
    return {
      ok: pipBoot.ok,
      python: getMediaPython(),
      created: true,
      basePython: best.version,
      stderr: pipBoot.stderr
    };
  }

  return { ok: true, python: getMediaPython(), created: false, basePython: readVenvVersion() || best.version };
}

async function loadBootstrapState() {
  try {
    if (await fs.pathExists(STATE_PATH)) return fs.readJsonSync(STATE_PATH);
  } catch { /* */ }
  return { completedAt: null, phases: {} };
}

async function saveBootstrapState(patch) {
  await fs.ensureDir(path.dirname(STATE_PATH));
  const cur = await loadBootstrapState();
  await fs.writeJsonSync(STATE_PATH, { ...cur, ...patch, updatedAt: new Date().toISOString() }, { spaces: 2 });
}

async function probeSystemTools() {
  const tools = ['ffmpeg', 'docker', 'podman', 'ollama'];
  const out = {};
  for (const t of tools) {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const r = await runCommand(cmd, [t], { timeoutMs: 5000 });
    out[t] = r.ok;
  }
  return out;
}

module.exports = {
  MEDIA_HOME,
  VENV_DIR,
  STATE_PATH,
  getMediaHome,
  getVenvDir,
  getMediaPython,
  getMediaEnv,
  ensureMediaVenv,
  loadBootstrapState,
  saveBootstrapState,
  probeSystemTools,
  readVenvVersion
};
