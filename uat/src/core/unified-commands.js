/**
 * Intent → OS-specific command strings (Unified Command Layer).
 * Extend this registry for production breadth.
 */

import { getOSProfile } from './os-detector.js';

const REGISTRY = {
  'list.files': {
    win32: { cmd: 'dir', ps: 'Get-ChildItem -Force' },
    unix: 'ls -la'
  },
  'list.files.hidden': {
    win32: { cmd: 'dir /a', ps: 'Get-ChildItem -Force' },
    unix: 'ls -la'
  },
  'show.cwd': {
    win32: { cmd: 'cd', ps: 'Get-Location' },
    unix: 'pwd'
  },
  'network.ping': {
    win32: { cmd: 'ping -n 4 127.0.0.1', ps: 'Test-Connection -Count 4 127.0.0.1' },
    unix: 'ping -c 4 127.0.0.1'
  },
  'env.path': {
    win32: { cmd: 'echo %PATH%', ps: '$env:PATH' },
    unix: 'echo $PATH'
  },
  'process.list': {
    win32: { cmd: 'tasklist', ps: 'Get-Process' },
    unix: 'ps aux'
  }
};

/**
 * @param {string} intentId
 * @param {{ shellId?: string }} [opts]
 * @returns {string|null}
 */
export function resolveIntent(intentId, opts = {}) {
  const profile = getOSProfile();
  const entry = REGISTRY[intentId];
  if (!entry) return null;

  if (profile.platform === 'win32') {
    const shellId = opts.shellId || profile.defaultShellId;
    if (shellId === 'cmd' && entry.win32.cmd) return entry.win32.cmd;
    if (shellId === 'powershell' && entry.win32.ps) return entry.win32.ps;
    return entry.win32.ps || entry.win32.cmd || null;
  }

  return typeof entry.unix === 'string' ? entry.unix : null;
}

export function listIntents() {
  return Object.keys(REGISTRY);
}
