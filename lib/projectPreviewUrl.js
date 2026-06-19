const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const FA7_UI_PORT = Number(process.env.FA7_UI_PORT || 5173);
const HOOSH_APP_ROOT = path.resolve(__dirname, '..');

const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):(\d+)(?:\/[^\s\)"']*)?/gi;
const LOCAL_RE = /Local:\s+(https?:\/\/[^\s\x1b]+)/gi;
const PORT_FLAG_RE = /(?:^|\s)(?:--port|-p|=)(\d{2,5})(?:\s|$)/i;
const ENV_PORT_RE = /(?:^|\s)PORT=(\d{2,5})(?:\s|$)/i;

function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

function normalizePreviewUrl(raw) {
  const cleaned = stripAnsi(String(raw || '').trim()).replace(/[)\],;'"]+$/, '');
  if (!cleaned) return null;
  try {
    const u = new URL(cleaned);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(u.hostname)) return null;
    u.hostname = '127.0.0.1';
    u.hash = '';
    return u.toString().replace(/\/$/, '') || u.origin;
  } catch {
    return null;
  }
}

function isHooshProjectRoot(projectRoot) {
  if (!projectRoot) return false;
  return path.resolve(projectRoot) === HOOSH_APP_ROOT;
}

function isHooshShellHtml(html) {
  const body = String(html || '');
  if (!body) return false;
  return (
    /<title>\s*Hoosh\s*<\/title>/i.test(body) &&
    /src="\/src\/main\.tsx"/i.test(body)
  );
}

async function probeUrl(url, { timeoutMs = 1200 } = {}) {
  const normalized = normalizePreviewUrl(url);
  if (!normalized) return { ok: false, url: null, isShell: false };
  try {
    const res = await axios.get(normalized, {
      timeout: timeoutMs,
      maxRedirects: 3,
      validateStatus: (s) => s >= 200 && s < 500,
      headers: { Accept: 'text/html,*/*' },
      responseType: 'text'
    });
    const html = typeof res.data === 'string' ? res.data : '';
    return { ok: true, url: normalized, isShell: isHooshShellHtml(html), status: res.status };
  } catch {
    return { ok: false, url: normalized, isShell: false };
  }
}

function readSavedPreviewUrl(projectRoot) {
  try {
    const p = path.join(projectRoot, '.fa7', 'preview.json');
    if (!fs.existsSync(p)) return null;
    const data = fs.readJsonSync(p);
    return normalizePreviewUrl(data?.url);
  } catch {
    return null;
  }
}

async function savePreviewUrl(projectRoot, url) {
  const normalized = normalizePreviewUrl(url);
  if (!projectRoot || !normalized) return null;
  const dir = path.join(projectRoot, '.fa7');
  await fs.ensureDir(dir);
  const file = path.join(dir, 'preview.json');
  await fs.writeJson(file, { url: normalized, updatedAt: new Date().toISOString() }, { spaces: 2 });
  return normalized;
}

function parsePortsFromText(text) {
  const ports = new Set();
  const src = String(text || '');
  for (const re of [
    /server\s*:\s*\{[\s\S]*?\bport\s*:\s*(\d{2,5})/gi,
    /preview\s*:\s*\{[\s\S]*?\bport\s*:\s*(\d{2,5})/gi,
    /devServer\s*:\s*\{[\s\S]*?\bport\s*:\s*(\d{2,5})/gi
  ]) {
    let m;
    while ((m = re.exec(src))) ports.add(Number(m[1]));
  }
  return [...ports].filter((p) => p > 0 && p < 65536);
}

function parseProjectPortCandidates(projectRoot) {
  const ports = new Set();
  const urls = new Set();
  if (!projectRoot) return { ports: [], urls: [] };

  const saved = readSavedPreviewUrl(projectRoot);
  if (saved) urls.add(saved);

  const pkgPath = path.join(projectRoot, 'package.json');
  let pkg = null;
  try {
    pkg = fs.readJsonSync(pkgPath);
  } catch { /* ignore */ }

  const scripts = pkg?.scripts || {};
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  for (const scriptName of ['dev', 'start', 'serve', 'preview', 'web']) {
    const script = String(scripts[scriptName] || '');
    if (!script) continue;
    const envPort = script.match(ENV_PORT_RE);
    if (envPort) ports.add(Number(envPort[1]));
    const flagPort = script.match(PORT_FLAG_RE);
    if (flagPort) ports.add(Number(flagPort[1]));
    for (const m of script.matchAll(URL_RE)) {
      const u = normalizePreviewUrl(m[0]);
      if (u) urls.add(u);
    }
    if (/vite preview|preview --/i.test(script)) ports.add(4173);
  }

  for (const cfgName of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']) {
    const cfgPath = path.join(projectRoot, cfgName);
    if (!fs.existsSync(cfgPath)) continue;
    try {
      parsePortsFromText(fs.readFileSync(cfgPath, 'utf8')).forEach((p) => ports.add(p));
    } catch { /* ignore */ }
  }

  if (deps.next) ports.add(3000);
  if (deps.nuxt || deps['nuxt3']) ports.add(3000);
  if (deps['react-scripts']) ports.add(3000);
  if (deps['@angular/core']) ports.add(4200);
  if (deps.express && !deps.vite && !deps.next) ports.add(3000);
  if (deps.vite && ports.size === 0 && !urls.size) ports.add(5174);

  if (isHooshProjectRoot(projectRoot)) {
    ports.add(FA7_UI_PORT);
    urls.add(`http://127.0.0.1:${FA7_UI_PORT}`);
  }

  for (const p of ports) {
    if (p === FA7_UI_PORT && !isHooshProjectRoot(projectRoot)) continue;
    urls.add(`http://127.0.0.1:${p}`);
  }

  return {
    ports: [...ports],
    urls: [...urls]
  };
}

function scanTerminalDevUrls(projectRoot, scanFn) {
  if (typeof scanFn !== 'function') return [];
  const root = projectRoot ? path.resolve(projectRoot) : null;
  const found = new Set();
  for (const raw of scanFn({ projectRoot: root }) || []) {
    const u = normalizePreviewUrl(raw);
    if (u) found.add(u);
  }
  return [...found];
}

async function resolveProjectPreviewUrl(projectRoot, opts = {}) {
  const root = projectRoot ? path.resolve(projectRoot) : null;
  if (!root) {
    return {
      ok: false,
      url: null,
      reason: 'no_project',
      hooshAppRoot: HOOSH_APP_ROOT,
      fa7UiPort: FA7_UI_PORT
    };
  }

  const { ports, urls: configUrls } = parseProjectPortCandidates(root);
  const terminalUrls = scanTerminalDevUrls(root, opts.scanTerminalUrls);
  const candidates = [...new Set([...terminalUrls, ...configUrls])];

  const saved = readSavedPreviewUrl(root);
  if (saved) candidates.unshift(saved);

  const tried = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (
      !isHooshProjectRoot(root) &&
      candidate === `http://127.0.0.1:${FA7_UI_PORT}`
    ) {
      tried.push({ url: candidate, skipped: 'fa7_shell_port' });
      continue;
    }
    const probe = await probeUrl(candidate);
    tried.push({ url: candidate, ...probe });
    if (probe.ok && !probe.isShell) {
      return {
        ok: true,
        url: probe.url,
        source: saved === candidate ? 'saved' : terminalUrls.includes(candidate) ? 'terminal' : 'detected',
        projectRoot: root,
        projectName: path.basename(root),
        hooshAppRoot: HOOSH_APP_ROOT,
        fa7UiPort: FA7_UI_PORT,
        isHooshProject: isHooshProjectRoot(root),
        tried
      };
    }
    if (probe.ok && probe.isShell && isHooshProjectRoot(root)) {
      return {
        ok: true,
        url: probe.url,
        source: 'hoosh_self',
        projectRoot: root,
        projectName: path.basename(root),
        hooshAppRoot: HOOSH_APP_ROOT,
        fa7UiPort: FA7_UI_PORT,
        isHooshProject: true,
        tried
      };
    }
  }

  const devScript = (() => {
    try {
      const pkg = fs.readJsonSync(path.join(root, 'package.json'));
      return pkg?.scripts?.dev || pkg?.scripts?.start || 'npm run dev';
    } catch {
      return 'npm run dev';
    }
  })();

  return {
    ok: false,
    url: null,
    reason: 'no_dev_server',
    projectRoot: root,
    projectName: path.basename(root),
    hooshAppRoot: HOOSH_APP_ROOT,
    fa7UiPort: FA7_UI_PORT,
    isHooshProject: isHooshProjectRoot(root),
    suggestedPorts: ports.filter((p) => p !== FA7_UI_PORT || isHooshProjectRoot(root)),
    devCommand: devScript,
    blockedShellUrl: `http://127.0.0.1:${FA7_UI_PORT}`,
    tried
  };
}

module.exports = {
  FA7_UI_PORT,
  HOOSH_APP_ROOT,
  normalizePreviewUrl,
  isHooshProjectRoot,
  isHooshShellHtml,
  probeUrl,
  readSavedPreviewUrl,
  savePreviewUrl,
  parseProjectPortCandidates,
  resolveProjectPreviewUrl
};
