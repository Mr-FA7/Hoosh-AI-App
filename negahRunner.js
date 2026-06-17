const { exec } = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

class NegahRunner {
  constructor(projectRoot) {
    this.projectRoot = projectRoot || process.cwd();
  }

  setProjectRoot(projectRoot) {
    if (projectRoot) this.projectRoot = projectRoot;
  }

  runShell(command, opts = {}) {
    const cwd = opts.cwd || this.projectRoot;
    const timeoutMs = Number(opts.timeoutMs || 20000);
    return new Promise((resolve) => {
      exec(command, { cwd, timeout: timeoutMs }, (error, stdout, stderr) => {
        resolve({
          ok: !error,
          exitCode: error ? (error.code || 1) : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: error ? String(error.message || error) : null
        });
      });
    });
  }

  async captureScreen() {
    if (process.platform !== 'darwin') {
      return { ok: false, error: 'capture_screen is currently supported on macOS only.' };
    }
    const fileName = `negah-capture-${Date.now()}.png`;
    const outputPath = path.join(os.tmpdir(), fileName);
    const shot = await this.runShell(`screencapture -x -t png "${outputPath}"`, { timeoutMs: 15000 });
    if (!shot.ok) {
      return { ok: false, error: shot.error || shot.stderr || 'screencapture failed.' };
    }
    const image = await fs.readFile(outputPath);
    const base64 = image.toString('base64');
    return {
      ok: true,
      outputPath,
      screen_base64: `data:image/png;base64,${base64}`
    };
  }

  async executeCommand(command = {}) {
    const action = String(command.action || '').trim();
    const params = command.params || {};

    if (!action) {
      return { ok: false, action, error: 'Missing action.' };
    }

    switch (action) {
      case 'launch_web': {
        const url = String(params.url || '');
        if (!/^https?:\/\//i.test(url)) {
          return { ok: false, action, error: 'Invalid URL for launch_web.' };
        }
        const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        const r = await this.runShell(`${opener} "${url}"`);
        return { ok: r.ok, action, url, stdout: r.stdout, stderr: r.stderr, error: r.error };
      }

      case 'launch_desktop': {
        if (params.app_path) {
          const appPath = String(params.app_path);
          const opener = process.platform === 'darwin' ? `open "${appPath}"` : `"${appPath}"`;
          const r = await this.runShell(opener, { timeoutMs: 30000 });
          return { ok: r.ok, action, app_path: appPath, stdout: r.stdout, stderr: r.stderr, error: r.error };
        }
        if (params.command) {
          const r = await this.runShell(String(params.command), { timeoutMs: 60000 });
          return { ok: r.ok, action, command: params.command, stdout: r.stdout, stderr: r.stderr, error: r.error };
        }
        return { ok: false, action, error: 'launch_desktop requires app_path or command.' };
      }

      case 'capture_screen':
        return this.captureScreen();

      case 'wait': {
        const ms = Math.max(0, Number(params.ms || params.timeout_ms || 1000));
        await new Promise((resolve) => setTimeout(resolve, ms));
        return { ok: true, action, waited_ms: ms };
      }

      case 'keyboard_type': {
        const text = String(params.text || '');
        if (process.platform !== 'darwin') {
          return { ok: false, action, error: 'keyboard_type is currently supported on macOS only.' };
        }
        const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const r = await this.runShell(`osascript -e 'tell application "System Events" to keystroke "${escaped}"'`);
        return { ok: r.ok, action, text, stdout: r.stdout, stderr: r.stderr, error: r.error };
      }

      case 'find_element':
      case 'mouse_click':
        return { ok: false, action, error: `${action} runner is not configured yet for this environment.` };

      case 'ask_human':
      case 'abort_task':
        return { ok: true, action, note: 'No-op runner action acknowledged.' };

      default:
        return { ok: false, action, error: `Unsupported action: ${action}` };
    }
  }

  async runCommands(commands = [], opts = {}) {
    const list = Array.isArray(commands) ? commands : [];
    const results = [];
    let screenBase64 = null;

    for (const c of list) {
      const r = await this.executeCommand(c);
      results.push(r);
      if (r.screen_base64) screenBase64 = r.screen_base64;
    }

    const failures = results.filter((r) => !r.ok);
    const status = failures.length === 0 ? 'success' : 'partial_failure';
    return {
      status,
      failures: failures.length,
      results,
      screen_base64: screenBase64,
      summary: failures.length === 0
        ? `Executed ${results.length} command(s) successfully.`
        : `${failures.length}/${results.length} command(s) failed.`
    };
  }
}

module.exports = NegahRunner;
