/**
 * Multi-shell execution engine: spawn with correct shell on each OS.
 */

import { spawn } from 'child_process';
import { pickShell, getOSProfile } from './os-detector.js';

/**
 * @param {string} command Full command line to run inside the shell
 * @param {object} [options]
 * @param {string} [options.shellId] powershell | cmd | zsh | bash | sh
 * @param {string} [options.cwd]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {number} [options.timeoutMs] default 300000
 * @returns {Promise<import('./types.js').UnifiedExecResult>}
 */
export function executeCommand(command, options = {}) {
  const profile = getOSProfile();
  const shell = pickShell(profile, options.shellId);
  const cwd = options.cwd || process.cwd();
  const env = { ...process.env, ...options.env };
  const timeoutMs = options.timeoutMs ?? 300000;

  const start = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    let child;
    if (profile.platform === 'win32') {
      if (shell.id === 'powershell') {
        child = spawn(shell.path, [...shell.args, '-Command', command], {
          cwd,
          env,
          windowsHide: true
        });
      } else {
        child = spawn(shell.path, [...shell.args, command], {
          cwd,
          env,
          windowsHide: true
        });
      }
    } else {
      const args = [...shell.args, command];
      child = spawn(shell.path, args, { cwd, env, shell: false });
    }

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
            setTimeout(() => child.kill('SIGKILL'), 2000).unref?.();
          }, timeoutMs)
        : null;

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        shellId: shell.id,
        durationMs: Date.now() - start,
        error: err.message
      });
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        shellId: shell.id,
        durationMs: Date.now() - start,
        error: killed ? `killed: timeout ${timeoutMs}ms` : undefined
      });
    });
  });
}
