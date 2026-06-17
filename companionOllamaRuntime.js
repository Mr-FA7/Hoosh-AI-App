/**
 * منطق هم‌راستا با Fard Terminal: آدرس پایدار Ollama، کش مدل در دادهٔ همراه،
 * و در صورت نبود سرویس روی پورت پیش‌فرض، اجرای manageشدهٔ ollama serve.
 * بدون Electron — مسیر داده: ~/.nava-ai
 */

const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

function companionDataRoot() {
  return path.join(os.homedir(), '.nava-ai');
}

function embeddedOllamaBinPath() {
  const name = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  return path.join(companionDataRoot(), 'ollama-runtime', name);
}

function getManagedModelsDir() {
  return path.join(companionDataRoot(), 'ollama-models');
}

function normalizeOllamaHttpBase(raw) {
  const s = String(raw || '').trim() || 'http://127.0.0.1:11434';
  const withProto = s.startsWith('http://') || s.startsWith('https://') ? s : `http://${s}`;
  // internal base must NOT include /api suffix; call sites append /api/<route>
  return withProto.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function configPath() {
  return path.join(companionDataRoot(), 'config.json');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch (_) {
    return {};
  }
}

function writeConfig(cfg) {
  ensureDir(companionDataRoot());
  fs.writeFileSync(configPath(), JSON.stringify(cfg || {}, null, 2), 'utf8');
}

function getOllamaConfig() {
  const cfg = readConfig();
  return {
    ollamaBase: cfg.ollamaBase ? normalizeOllamaHttpBase(cfg.ollamaBase) : '',
    ollamaApiKey: typeof cfg.ollamaApiKey === 'string' ? cfg.ollamaApiKey : ''
  };
}

function setOllamaConfig(next) {
  const cfg = readConfig();
  const merged = { ...cfg };
  if (next && typeof next === 'object') {
    if ('ollamaBase' in next) {
      const b = String(next.ollamaBase || '').trim();
      merged.ollamaBase = b ? normalizeOllamaHttpBase(b) : '';
    }
    if ('ollamaApiKey' in next) {
      merged.ollamaApiKey = String(next.ollamaApiKey || '');
    }
  }
  writeConfig(merged);
  return getOllamaConfig();
}

function getOllamaAuthHeaders() {
  const { ollamaApiKey } = getOllamaConfig();
  return ollamaApiKey ? { Authorization: `Bearer ${ollamaApiKey}` } : {};
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
}

function tryOllamaFile(p) {
  try {
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  } catch (_) {}
  return null;
}

function portableOllamaBinCandidates() {
  const inResources =
    process.platform === 'win32' ? path.join('ollama', 'ollama.exe') : path.join('ollama', 'ollama');
  const base = path.join(__dirname, 'resources');
  return [path.join(base, inResources), path.join(base, process.platform === 'win32' ? 'ollama.exe' : 'ollama')];
}

function bundledMacOllamaAppCandidates() {
  if (process.platform !== 'darwin') return [];
  const appPath = path.join(__dirname, 'resources', 'Ollama.app');
  return [
    path.join(appPath, 'Contents/Resources/ollama'),
    path.join(appPath, 'Contents/MacOS/ollama')
  ];
}

function macStandardOllamaBinCandidates() {
  if (process.platform !== 'darwin') return [];
  const root = '/Applications/Ollama.app';
  return [path.join(root, 'Contents/Resources/ollama'), path.join(root, 'Contents/MacOS/ollama')];
}

/** ترتیب: کش همراه → resources → Ollama.app باندل → نصب استاندارد مک → PATH */
function findOllamaExecutable() {
  const embedded = tryOllamaFile(embeddedOllamaBinPath());
  if (embedded) return embedded;
  for (const p of portableOllamaBinCandidates()) {
    const hit = tryOllamaFile(p);
    if (hit) return hit;
  }
  for (const p of bundledMacOllamaAppCandidates()) {
    const hit = tryOllamaFile(p);
    if (hit) return hit;
  }
  for (const p of macStandardOllamaBinCandidates()) {
    const hit = tryOllamaFile(p);
    if (hit) return hit;
  }
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(cmd, ['ollama'], { encoding: 'utf8', shell: process.platform === 'win32' });
    const line = (r.stdout || '').trim().split(/\r?\n/)[0];
    if (line && fs.existsSync(line)) return line;
  } catch (_) {}
  return null;
}

function findFreePort(preferred = 17434) {
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const s = net.createServer();
      s.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && port === preferred) {
          const s2 = net.createServer();
          s2.listen(0, '127.0.0.1', () => {
            const p = s2.address().port;
            s2.close(() => resolve(p));
          });
          s2.once('error', reject);
        } else reject(err);
      });
      s.listen(port, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    };
    tryListen(preferred);
  });
}

async function waitForOllamaReachable(baseUrl, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 2200);
      const res = await fetch(`${baseUrl}/api/tags`, { signal: ac.signal });
      clearTimeout(tid);
      if (res.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

let managedOllama = null;

function stopManagedOllama() {
  if (!managedOllama?.child) return;
  try {
    managedOllama.child.kill('SIGTERM');
  } catch (_) {}
  managedOllama = null;
}

function getActiveOllamaBase() {
  if (managedOllama) {
    return `http://127.0.0.1:${managedOllama.port}`;
  }
  const cfg = getOllamaConfig();
  if (cfg.ollamaBase) return cfg.ollamaBase;
  return normalizeOllamaHttpBase(
    process.env.FARD_OLLAMA_API_BASE || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  );
}

/**
 * اگر سرویس روی آدرس ترجیحی پاسخ دهد همان را برمی‌گرداند؛
 * وگرنه در صورت مجاز بودن، ollama serve داخلی با OLLAMA_MODELS جدا بالا می‌آید.
 */
async function ensureOllamaForCompanion() {
  const skipManaged = String(process.env.AIVON_SKIP_MANAGED_OLLAMA || '').trim() === '1';
  const cfg = getOllamaConfig();
  const preferred = cfg.ollamaBase
    ? cfg.ollamaBase
    : normalizeOllamaHttpBase(
        process.env.FARD_OLLAMA_API_BASE || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
      );

  if (await waitForOllamaReachable(preferred, 4000)) {
    process.env.FARD_OLLAMA_API_BASE = preferred;
    return {
      url: preferred,
      mode: 'system',
      modelsDir: getManagedModelsDir(),
      binary: findOllamaExecutable()
    };
  }

  if (skipManaged) {
    process.env.FARD_OLLAMA_API_BASE = preferred;
    return {
      url: preferred,
      mode: 'unreachable',
      modelsDir: getManagedModelsDir(),
      binary: findOllamaExecutable()
    };
  }

  const bin = findOllamaExecutable();
  if (!bin) {
    process.env.FARD_OLLAMA_API_BASE = preferred;
    return {
      url: preferred,
      mode: 'no_binary',
      modelsDir: getManagedModelsDir(),
      binary: null
    };
  }

  let port;
  try {
    port = await findFreePort(17434);
  } catch (e) {
    process.env.FARD_OLLAMA_API_BASE = preferred;
    return {
      url: preferred,
      mode: 'port_error',
      error: e.message,
      modelsDir: getManagedModelsDir(),
      binary: bin
    };
  }

  const modelsDir = getManagedModelsDir();
  ensureDir(modelsDir);
  const env = {
    ...process.env,
    OLLAMA_HOST: `127.0.0.1:${port}`,
    OLLAMA_MODELS: modelsDir
  };
  const child = spawn(bin, ['serve'], { env, windowsHide: true });
  const base = `http://127.0.0.1:${port}`;
  managedOllama = { child, port, modelsDir, binary: bin };

  const reachable = await waitForOllamaReachable(base, 25000);
  if (!reachable) {
    try {
      child.kill('SIGTERM');
    } catch (_) {}
    managedOllama = null;
    process.env.FARD_OLLAMA_API_BASE = preferred;
    return {
      url: preferred,
      mode: 'managed_failed',
      modelsDir,
      binary: bin
    };
  }

  process.env.FARD_OLLAMA_API_BASE = base;
  child.on('exit', () => {
    if (managedOllama?.child === child) {
      managedOllama = null;
    }
  });

  return {
    url: base,
    mode: 'managed',
    port,
    modelsDir,
    binary: bin
  };
}

/**
 * بعد از نصب/به‌روزرسانی باینری در ~/.nava-ai: managed قبلی را می‌بندد و دوباره ensure می‌کند.
 */
async function restartManagedOllamaService() {
  stopManagedOllama();
  await new Promise((r) => setTimeout(r, 350));
  return ensureOllamaForCompanion();
}

function getRuntimeStatus() {
  return {
    url: getActiveOllamaBase(),
    managed: !!managedOllama,
    port: managedOllama ? managedOllama.port : null,
    modelsDir: getManagedModelsDir(),
    binary: findOllamaExecutable()
  };
}

module.exports = {
  ensureOllamaForCompanion,
  restartManagedOllamaService,
  stopManagedOllama,
  getActiveOllamaBase,
  getRuntimeStatus,
  getManagedModelsDir,
  findOllamaExecutable,
  companionDataRoot,
  getOllamaConfig,
  setOllamaConfig,
  getOllamaAuthHeaders
};
