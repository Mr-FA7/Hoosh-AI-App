const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

async function detectScripts(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return { lint: null, test: null };
  try {
    const pkg = await fs.readJson(pkgPath);
    const scripts = pkg.scripts || {};
    const lint = scripts.lint ? 'npm run lint' : (scripts.eslint ? 'npm run eslint' : null);
    const test = scripts.test && !/echo|no test/i.test(scripts.test) ? 'npm test -- --passWithNoTests' : null;
    return { lint, test };
  } catch {
    return { lint: null, test: null };
  }
}

function runCommand(command, cwd, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : '/bin/bash';
    const args = isWin ? ['/d', '/s', '/c', command] : ['-c', command];
    const child = spawn(shell, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, stdout, stderr: stderr + '\n(timeout)', code: -1 });
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: err.message, code: -1 });
    });
  });
}

async function runPostEditChecks(projectRoot, changedFiles = []) {
  const scripts = await detectScripts(projectRoot);
  const results = { lint: null, test: null, changedFiles };

  if (scripts.lint) {
    results.lint = await runCommand(scripts.lint, projectRoot, 120000);
  }
  if (scripts.test) {
    results.test = await runCommand(scripts.test, projectRoot, 180000);
  }

  const failed = (results.lint && !results.lint.ok) || (results.test && !results.test.ok);
  let feedback = '';
  if (results.lint && !results.lint.ok) {
    feedback += `LINT FAILED:\n${(results.lint.stderr || results.lint.stdout).slice(0, 4000)}\n`;
  }
  if (results.test && !results.test.ok) {
    feedback += `TEST FAILED:\n${(results.test.stderr || results.test.stdout).slice(0, 4000)}\n`;
  }

  return { ...results, failed, feedback };
}

module.exports = { detectScripts, runCommand, runPostEditChecks };
