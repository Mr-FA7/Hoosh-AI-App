/**
 * ترمینال محلی (PTY) + باز کردن ترمینال دسکتاپ — هم‌الگو با Fard Terminal.
 * WebSocket فقط روی 127.0.0.1
 */

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const WebSocket = require('ws');

function defaultShell() {
  if (process.platform === 'win32') {
    return process.env.PSModulePath ? 'powershell.exe' : process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function defaultShellArgs() {
  if (process.platform === 'win32') {
    return process.env.PSModulePath ? ['-NoLogo'] : [];
  }
  return ['-l'];
}

function isolatedHomeRoot() {
  return path.join(os.homedir(), '.fa7-os', 'local-shell-home');
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
}

function defaultShellArgsForMode(shellPath, mode) {
  if (process.platform === 'win32') {
    return defaultShellArgs();
  }
  const m = String(mode || 'system');
  if (m !== 'isolated') return defaultShellArgs();
  const s = String(shellPath || '');
  if (s.endsWith('/zsh') || s.endsWith('zsh')) return ['-f'];
  if (s.endsWith('/bash') || s.endsWith('bash')) return ['--noprofile', '--norc'];
  if (s.endsWith('/fish') || s.endsWith('fish')) return ['--no-config'];
  return [];
}

function normalizePtyPurpose(raw) {
  const s = String(raw || 'ai').toLowerCase();
  return s === 'user' ? 'user' : 'ai';
}

function spawnPtySession({ cols, rows, cwd, mode, purpose }) {
  const modeStr = String(mode || 'system');
  const purposeNorm = normalizePtyPurpose(purpose);
  const realHome = os.homedir();
  const isoHome = isolatedHomeRoot();
  if (modeStr === 'isolated') ensureDir(isoHome);

  const startDir =
    cwd && typeof cwd === 'string' && fs.existsSync(cwd)
      ? cwd
      : modeStr === 'isolated'
        ? isoHome
        : realHome;

  const shellPath = defaultShell();
  const shellArgs = defaultShellArgsForMode(shellPath, modeStr);
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    FA7_PTY_PURPOSE: purposeNorm
  };
  if (modeStr === 'isolated') {
    env.HOME = isoHome;
    env.USERPROFILE = isoHome;
    env.ZDOTDIR = isoHome;
    env.HISTFILE = path.join(isoHome, '.history');
    env.PROMPT = 'fard % ';
    env.RPROMPT = '';
    env.PS1 = 'fard$ ';
  }

  const spawnOpts = {
    name: 'xterm-color',
    cols: Math.max(cols || 80, 20),
    rows: Math.max(rows || 24, 8),
    cwd: startDir,
    env,
    useConpty: process.platform === 'win32'
  };

  let p;
  try {
    p = pty.spawn(shellPath, shellArgs, spawnOpts);
  } catch (e) {
    const fallbacks =
      process.platform === 'win32'
        ? [process.env.COMSPEC || 'cmd.exe', 'powershell.exe']
        : ['zsh', '/bin/zsh', 'bash', '/bin/bash', 'sh', '/bin/sh'];
    let lastErr = e;
    for (const f of fallbacks) {
      try {
        p = pty.spawn(f, defaultShellArgsForMode(f, modeStr), spawnOpts);
        lastErr = null;
        break;
      } catch (e2) {
        lastErr = e2;
      }
    }
    if (!p) throw lastErr || e;
  }

  return { p, cwd: startDir, mode: modeStr, purpose: purposeNorm };
}

function openSystemTerminal(cwd) {
  const dir = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  const platform = process.platform;

  if (platform === 'darwin') {
    return new Promise((resolve) => {
      const escaped = dir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "cd \\"${escaped}\\" && clear"`;
      const child = spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
      child.unref();
      child.on('error', () => resolve({ ok: false, error: 'Terminal.app' }));
      child.on('close', (code) => resolve({ ok: code === 0 }));
    });
  }

  if (platform === 'win32') {
    return new Promise((resolve) => {
      const child = spawn('cmd.exe', ['/c', 'start', 'wt', '-d', dir], {
        detached: true,
        stdio: 'ignore',
        shell: false
      });
      child.unref();
      child.on('error', () => {
        const fallback = spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${dir}"`], {
          detached: true,
          stdio: 'ignore'
        });
        fallback.unref();
        fallback.on('error', () => resolve({ ok: false }));
        fallback.on('close', () => resolve({ ok: true }));
      });
      child.on('close', () => resolve({ ok: true }));
    });
  }

  const candidates = [
    ['gnome-terminal', ['--working-directory', dir]],
    ['konsole', ['--workdir', dir]],
    ['xfce4-terminal', ['--working-directory', dir]],
    ['kitty', ['--directory', dir]],
    ['alacritty', ['--working-directory', dir]]
  ];

  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= candidates.length) {
        resolve({ ok: false, error: 'No desktop terminal found' });
        return;
      }
      const [cmd, args] = candidates[i++];
      execFile(cmd, args, { windowsHide: true }, (err) => {
        if (err) next();
        else resolve({ ok: true, used: cmd });
      });
    };
    next();
  });
}

function isAllowedHttpUrl(urlStr) {
  try {
    const u = new URL(String(urlStr).trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function openExternalUrl(urlStr) {
  if (!isAllowedHttpUrl(urlStr)) {
    return Promise.resolve({ ok: false, error: 'Only http/https URLs' });
  }
  const platform = process.platform;
  if (platform === 'darwin') {
    return new Promise((resolve) => {
      const child = spawn('open', [urlStr], { detached: true, stdio: 'ignore' });
      child.unref();
      child.on('error', () => resolve({ ok: false }));
      child.on('close', () => resolve({ ok: true }));
    });
  }
  if (platform === 'win32') {
    return new Promise((resolve) => {
      const child = spawn('cmd.exe', ['/c', 'start', '', urlStr], { detached: true, stdio: 'ignore' });
      child.unref();
      child.on('error', () => resolve({ ok: false }));
      child.on('close', () => resolve({ ok: true }));
    });
  }
  return new Promise((resolve) => {
    const child = spawn('xdg-open', [urlStr], { detached: true, stdio: 'ignore' });
    child.unref();
    child.on('error', () => resolve({ ok: false }));
    child.on('close', () => resolve({ ok: true }));
  });
}

let currentDefaultCwd = os.homedir();

function updateDefaultCwd(newPath) {
  if (fs.existsSync(newPath)) {
    currentDefaultCwd = newPath;
  }
}

function attachPtyConnectionHandler(wss) {
  wss.on('connection', (ws) => {
    let session = null;

    const sendJson = (obj) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    };

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'init') {
        if (session) {
          try {
            session.p.kill();
          } catch (_) {}
          session = null;
        }
        try {
          const cwd = msg.cwd && fs.existsSync(msg.cwd) ? msg.cwd : currentDefaultCwd;
          session = spawnPtySession({
            cols: msg.cols,
            rows: msg.rows,
            cwd,
            mode: msg.mode || 'system',
            purpose: msg.purpose
          });
          session.p.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(Buffer.from(data, 'utf8'), { binary: true });
            }
          });
          session.p.onExit((code, signal) => {
            sendJson({ type: 'exit', code, signal });
            session = null;
          });
          sendJson({
            type: 'ready',
            cwd: session.cwd,
            mode: session.mode,
            purpose: session.purpose
          });
        } catch (e) {
          sendJson({ type: 'error', error: e.message || String(e) });
        }
        return;
      }

      if (msg.type === 'resize' && session) {
        try {
          session.p.resize(Math.max(msg.cols || 80, 20), Math.max(msg.rows || 24, 8));
        } catch (_) {}
        return;
      }

      if (msg.type === 'input' && session && typeof msg.data === 'string') {
        try {
          session.p.write(msg.data);
        } catch (_) {}
      }
    });

    ws.on('close', () => {
      if (session) {
        try {
          session.p.kill();
        } catch (_) {}
        session = null;
      }
    });
  });
}

/**
 * @param {{ port?: number, defaultCwd?: string }} opts
 * @returns {Promise<{ wss: import('ws').Server, port: number }>}
 */
function startPtyWebSocketServer(opts = {}) {
  const preferred = Number(opts.port) || 3002;
  const defaultCwd = opts.defaultCwd || os.homedir();

  const tryListen = (port) =>
    new Promise((resolve, reject) => {
      const wss = new WebSocket.Server({ port, host: '127.0.0.1' });
      const onErr = (err) => {
        wss.removeListener('listening', onOk);
        try {
          wss.close();
        } catch (_) {}
        reject(err);
      };
      const onOk = () => {
        wss.removeListener('error', onErr);
        resolve(wss);
      };
      wss.once('error', onErr);
      wss.once('listening', onOk);
    });

  return (async () => {
    let wss;
    let port;
    try {
      wss = await tryListen(preferred);
      port = preferred;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') {
        throw e;
      }
      wss = await tryListen(0);
      port = wss.address().port;
    }
    attachPtyConnectionHandler(wss);
    return { wss, port };
  })();
}

module.exports = {
  startPtyWebSocketServer,
  openSystemTerminal,
  openExternalUrl,
  isAllowedHttpUrl,
  isolatedHomeRoot,
  defaultShell,
  updateDefaultCwd
};
