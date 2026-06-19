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
const { appendScrollback } = require('./lib/terminalContext');

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
/** @type {Map<string, { p: any, cwd: string, mode: string, purpose: string, clients: Set<any>, dataHandler?: (d: string) => void, scrollback?: string, clientBuffer?: string, clientSelection?: string, updatedAt?: number }>} */
const namedSessions = new Map();

/** @type {{ buffer: string, selection: string, purpose: string, updatedAt: number } | null} */
let ephemeralClientTerminal = null;

function recordScrollback(entry, chunk) {
  if (!entry || !chunk) return;
  entry.scrollback = appendScrollback(entry.scrollback || '', chunk);
  entry.updatedAt = Date.now();
}

function trackTerminalInput(entry, data) {
  if (!entry) return;
  if (!entry.inputLine) entry.inputLine = '';
  entry.inputLine += String(data || '');
  if (/[\r\n]/.test(data)) {
    const line = entry.inputLine.replace(/[\r\n]+/g, '').trim();
    if (line) {
      entry.lastCommand = line;
      entry.commandOutputStart = (entry.scrollback || '').length;
      entry.lastExitCode = null;
    }
    entry.inputLine = '';
  }
}

function commandOutputFromEntry(entry) {
  if (!entry) return '';
  const start = Number(entry.commandOutputStart || 0);
  return String(entry.scrollback || '').slice(start).trim();
}

function updateDefaultCwd(newPath) {
  if (fs.existsSync(newPath)) {
    currentDefaultCwd = newPath;
  }
}

function listNamedTerminals() {
  return Array.from(namedSessions.entries()).map(([name, s]) => ({
    name,
    cwd: s.cwd,
    mode: s.mode,
    purpose: s.purpose,
    clients: s.clients.size
  }));
}

function wireNamedSession(name, entry) {
  if (!entry.dataHandler) {
    entry.dataHandler = (data) => {
      recordScrollback(entry, data);
      for (const client of entry.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(Buffer.from(data, 'utf8'), { binary: true });
        }
      }
    };
    entry.p.onData(entry.dataHandler);
  }
  if (!entry.exitHooked) {
    entry.exitHooked = true;
    entry.p.onExit((code, signal) => {
      entry.lastExitCode = code;
      namedSessions.delete(name);
      for (const client of entry.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'exit', code, signal, sessionName: name }));
        }
      }
    });
  }
}

function createNamedTerminal(name, opts = {}) {
  const key = String(name || '').trim();
  if (!key) throw new Error('Terminal name required');
  if (namedSessions.has(key)) return { ok: true, reused: true, name: key };
  const spawned = spawnPtySession({
    cols: opts.cols || 80,
    rows: opts.rows || 24,
    cwd: opts.cwd || currentDefaultCwd,
    mode: opts.mode || 'system',
    purpose: opts.purpose || 'user'
  });
  const entry = {
    ...spawned,
    clients: new Set(),
    dataHandler: null,
    exitHooked: false,
    scrollback: '',
    clientBuffer: '',
    clientSelection: '',
    inputLine: '',
    lastCommand: '',
    lastExitCode: null,
    commandOutputStart: 0,
    updatedAt: Date.now()
  };
  namedSessions.set(key, entry);
  wireNamedSession(key, entry);
  return { ok: true, name: key, cwd: entry.cwd };
}

function attachClientToNamed(ws, name, sendJson) {
  const entry = namedSessions.get(name);
  if (!entry) return false;
  entry.clients.add(ws);
  wireNamedSession(name, entry);
  sendJson({ type: 'ready', sessionName: name, reused: true, cwd: entry.cwd, mode: entry.mode, purpose: entry.purpose });
  return true;
}

function attachPtyConnectionHandler(wss) {
  wss.on('connection', (ws) => {
    let session = null;
    let attachedName = null;

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
        if (session && !attachedName) {
          try {
            session.p.kill();
          } catch (_) {}
          session = null;
        }
        try {
          const sessionName = String(msg.sessionName || '').trim();
          if (sessionName && namedSessions.has(sessionName)) {
            attachedName = sessionName;
            attachClientToNamed(ws, sessionName, sendJson);
            return;
          }
          const cwd = msg.cwd && fs.existsSync(msg.cwd) ? msg.cwd : currentDefaultCwd;
          session = spawnPtySession({
            cols: msg.cols,
            rows: msg.rows,
            cwd,
            mode: msg.mode || 'system',
            purpose: msg.purpose
          });
          if (sessionName) {
            attachedName = sessionName;
            session.clients = new Set([ws]);
            namedSessions.set(sessionName, session);
            wireNamedSession(sessionName, session);
          } else {
            session.scrollback = session.scrollback || '';
            session.p.onData((data) => {
              recordScrollback(session, data);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(Buffer.from(data, 'utf8'), { binary: true });
              }
            });
            session.p.onExit((code, signal) => {
              sendJson({ type: 'exit', code, signal });
              session = null;
            });
          }
          sendJson({
            type: 'ready',
            cwd: session.cwd,
            mode: session.mode,
            purpose: session.purpose,
            sessionName: attachedName || undefined
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
          trackTerminalInput(session, msg.data);
          session.p.write(msg.data);
        } catch (_) {}
        return;
      }

      if (msg.type === 'input' && attachedName && namedSessions.has(attachedName) && typeof msg.data === 'string') {
        try {
          const ent = namedSessions.get(attachedName);
          trackTerminalInput(ent, msg.data);
          ent.p.write(msg.data);
        } catch (_) {}
      }
    });

    ws.on('close', () => {
      if (attachedName && namedSessions.has(attachedName)) {
        const entry = namedSessions.get(attachedName);
        entry.clients.delete(ws);
        session = entry;
        attachedName = null;
        return;
      }
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

function getOrCreateAgentTerminal(agentSessionId, opts = {}) {
  const key = `agent-${String(agentSessionId || '').trim()}`;
  if (!key || key === 'agent-') throw new Error('agentSessionId required');
  return createNamedTerminal(key, {
    cwd: opts.cwd || currentDefaultCwd,
    mode: opts.mode || 'system',
    purpose: 'ai',
    cols: opts.cols,
    rows: opts.rows
  });
}

function syncClientTerminalState(body = {}) {
  const purpose = String(body.purpose || 'ai');
  const payload = {
    buffer: String(body.buffer || '').slice(0, 100000),
    selection: String(body.selection || '').slice(0, 50000),
    purpose,
    updatedAt: Date.now()
  };
  ephemeralClientTerminal = payload;

  const sessionName = String(body.sessionName || '').trim();
  if (sessionName && namedSessions.has(sessionName)) {
    const entry = namedSessions.get(sessionName);
    entry.clientBuffer = payload.buffer;
    entry.clientSelection = payload.selection;
    entry.updatedAt = payload.updatedAt;
  }
  return { ok: true };
}

function enrichTerminalChunk(entry, base) {
  return {
    ...base,
    lastCommand: entry?.lastCommand || '',
    lastExitCode: entry?.lastExitCode ?? null,
    commandOutput: commandOutputFromEntry(entry)
  };
}

function getTerminalContext(opts = {}) {
  const sessionId = String(opts.sessionId || '').trim();
  const purposeFilter = String(opts.purpose || 'all').toLowerCase();
  const selection = String(opts.selection || '').slice(0, 50000);
  const clientBuffer = String(opts.clientBuffer || '').slice(0, 100000);

  const chunks = [];

  if (sessionId) {
    const name = sessionId.startsWith('agent-') ? sessionId : `agent-${sessionId}`;
    const entry = namedSessions.get(name);
    if (entry) {
      if (purposeFilter === 'all' || entry.purpose === purposeFilter) {
        chunks.push(enrichTerminalChunk(entry, {
          sessionName: name,
          purpose: entry.purpose,
          cwd: entry.cwd,
          buffer: entry.clientBuffer || entry.scrollback || '',
          selection: selection || entry.clientSelection || ''
        }));
      }
    }
  }

  for (const [name, entry] of namedSessions.entries()) {
    if (sessionId && (name === sessionId || name === `agent-${sessionId}`)) continue;
    if (purposeFilter !== 'all' && entry.purpose !== purposeFilter) continue;
    chunks.push(enrichTerminalChunk(entry, {
      sessionName: name,
      purpose: entry.purpose,
      cwd: entry.cwd,
      buffer: entry.clientBuffer || entry.scrollback || '',
      selection: entry.clientSelection || ''
    }));
  }

  if (ephemeralClientTerminal) {
    if (purposeFilter === 'all' || ephemeralClientTerminal.purpose === purposeFilter) {
      chunks.push({
        sessionName: 'active-pane',
        purpose: ephemeralClientTerminal.purpose,
        cwd: currentDefaultCwd,
        buffer: ephemeralClientTerminal.buffer,
        selection: ephemeralClientTerminal.selection
      });
    }
  }

  if (clientBuffer || selection) {
    chunks.push({
      sessionName: 'client',
      purpose: purposeFilter === 'all' ? 'ui' : purposeFilter,
      cwd: currentDefaultCwd,
      buffer: clientBuffer,
      selection
    });
  }

  const merged = chunks[0] || {
    sessionName: sessionId ? `agent-${sessionId}` : 'terminal',
    purpose: purposeFilter === 'all' ? 'ai' : purposeFilter,
    cwd: currentDefaultCwd,
    buffer: clientBuffer || ephemeralClientTerminal?.buffer || '',
    selection: selection || ephemeralClientTerminal?.selection || ''
  };

  return {
    sessions: chunks,
    primary: merged
  };
}

function scanTerminalDevUrls(opts = {}) {
  const projectRoot = opts.projectRoot ? path.resolve(String(opts.projectRoot)) : null;
  const localRe = /Local:\s+(https?:\/\/[^\s\x1b]+)/gi;
  const urlRe = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):\d+(?:\/[^\s\)"']*)?/gi;
  const found = new Set();

  const ingestText = (text, cwd) => {
    if (projectRoot && cwd) {
      const resolved = path.resolve(String(cwd));
      if (resolved !== projectRoot && !resolved.startsWith(projectRoot + path.sep)) return;
    }
    const clean = String(text || '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    for (const m of clean.matchAll(localRe)) found.add(String(m[1]).trim());
    for (const m of clean.matchAll(urlRe)) found.add(String(m[0]).trim());
  };

  for (const [, entry] of namedSessions.entries()) {
    ingestText(entry.clientBuffer || entry.scrollback || '', entry.cwd);
  }
  if (ephemeralClientTerminal) {
    ingestText(ephemeralClientTerminal.buffer, currentDefaultCwd);
  }
  return [...found];
}

module.exports = {
  startPtyWebSocketServer,
  openSystemTerminal,
  openExternalUrl,
  isAllowedHttpUrl,
  isolatedHomeRoot,
  defaultShell,
  updateDefaultCwd,
  listNamedTerminals,
  createNamedTerminal,
  getOrCreateAgentTerminal,
  syncClientTerminalState,
  getTerminalContext,
  scanTerminalDevUrls
};
