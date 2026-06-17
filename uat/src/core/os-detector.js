/**
 * OS Detection & environment profile for routing shells and package managers.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';

function readLinuxDistroId() {
  try {
    const release = fs.readFileSync('/etc/os-release', 'utf8');
    const m = release.match(/^ID=(.+)$/m);
    return m ? m[1].replace(/"/g, '').toLowerCase() : 'linux';
  } catch {
    return 'linux';
  }
}

function detectLinuxFamily() {
  const id = readLinuxDistroId();
  if (['ubuntu', 'debian', 'linuxmint', 'pop'].includes(id)) return { id, family: 'debian', pm: 'apt' };
  if (['fedora', 'rhel', 'centos', 'rocky'].includes(id)) return { id, family: 'rhel', pm: 'dnf' };
  if (id === 'arch' || id === 'manjaro') return { id, family: 'arch', pm: 'pacman' };
  return { id, family: 'generic', pm: 'apt' };
}

function windowsShells() {
  const out = [];
  const ps =
    process.env.SystemRoot &&
    path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (ps && fs.existsSync(ps)) out.push({ id: 'powershell', path: ps, args: ['-NoLogo', '-NoProfile'] });
  const cmd = process.env.ComSpec || 'cmd.exe';
  out.push({ id: 'cmd', path: cmd, args: ['/d', '/s', '/c'] });
  return out;
}

function unixShells() {
  const candidates = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    '/bin/sh'
  ].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of candidates) {
    if (seen.has(p)) continue;
    seen.add(p);
    try {
      if (fs.existsSync(p)) {
        const base = path.basename(p);
        out.push({
          id: base === 'zsh' ? 'zsh' : base === 'bash' ? 'bash' : 'sh',
          path: p,
          args: ['-c']
        });
      }
    } catch {
      /* ignore */
    }
  }
  if (out.length === 0) {
    out.push({ id: 'sh', path: '/bin/sh', args: ['-c'] });
  }
  return out;
}

/**
 * @returns {import('./types.js').OSProfile}
 */
export function getOSProfile() {
  const platform = process.platform;
  const arch = process.arch;
  const hostname = os.hostname();
  const release = os.release();

  if (platform === 'win32') {
    return {
      platform: 'win32',
      osName: 'Windows',
      arch,
      hostname,
      release,
      shells: windowsShells(),
      defaultShellId: 'powershell',
      packageManagers: [
        { id: 'winget', cli: 'winget' },
        { id: 'choco', cli: 'choco' },
        { id: 'scoop', cli: 'scoop' }
      ],
      preferredPackageManager: 'winget',
      paths: { home: os.homedir(), sep: path.sep }
    };
  }

  if (platform === 'darwin') {
    const shells = unixShells();
    const defaultShell =
      shells.find((s) => s.id === (process.env.SHELL || '').split('/').pop()) || shells[0];
    return {
      platform: 'darwin',
      osName: 'macOS',
      arch,
      hostname,
      release,
      shells,
      defaultShellId: defaultShell?.id || 'zsh',
      packageManagers: [{ id: 'brew', cli: 'brew' }],
      preferredPackageManager: 'brew',
      paths: { home: os.homedir(), sep: path.sep }
    };
  }

  const linux = detectLinuxFamily();
  const shells = unixShells();
  const defaultShell = shells[0];
  return {
    platform: 'linux',
    osName: 'Linux',
    distroId: linux.id,
    distroFamily: linux.family,
    arch,
    hostname,
    release,
    shells,
    defaultShellId: defaultShell?.id || 'bash',
    packageManagers: [
      { id: linux.pm, cli: linux.pm },
      { id: 'flatpak', cli: 'flatpak' }
    ],
    preferredPackageManager: linux.pm,
    paths: { home: os.homedir(), sep: path.sep }
  };
}

export function pickShell(profile, shellId) {
  const id = shellId || profile.defaultShellId;
  const found = profile.shells.find((s) => s.id === id);
  return found || profile.shells[0];
}
