const { execSync, spawn } = require('child_process');
const path = require('path');

function runGit(args, cwd, maxBuffer = 800000) {
  try {
    const out = execSync(`git ${args}`, {
      cwd,
      encoding: 'utf8',
      maxBuffer,
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true, stdout: out.trim(), stderr: '' };
  } catch (e) {
    return {
      ok: false,
      stdout: (e.stdout || '').toString().trim(),
      stderr: (e.stderr || e.message || '').toString().trim(),
      code: e.status
    };
  }
}

function getStatus(projectRoot) {
  const cwd = projectRoot || process.cwd();
  if (!runGit('rev-parse --is-inside-work-tree', cwd).ok) {
    return { ok: false, isRepo: false, error: 'Not a git repository' };
  }
  const branch = runGit('branch --show-current', cwd).stdout || 'HEAD';
  const porcelain = runGit('status --porcelain', cwd).stdout;
  const lines = porcelain ? porcelain.split('\n').filter(Boolean) : [];
  const files = lines.map((line) => {
    const code = line.slice(0, 2);
    const file = line.slice(3);
    return { code, file, staged: code[0] !== ' ' && code[0] !== '?', modified: code[1] !== ' ' };
  });
  return {
    ok: true,
    isRepo: true,
    branch,
    clean: files.length === 0,
    files,
    ahead: runGit('rev-list --count @{u}..HEAD 2>/dev/null', cwd).stdout || '0',
    behind: runGit('rev-list --count HEAD..@{u} 2>/dev/null', cwd).stdout || '0'
  };
}

function getDiff(projectRoot, filePath) {
  const cwd = projectRoot || process.cwd();
  const args = filePath ? `diff -- "${filePath}"` : 'diff HEAD';
  const r = runGit(args, cwd, 1200000);
  return { ok: r.ok, diff: r.stdout || r.stderr };
}

function stageFiles(projectRoot, paths = []) {
  const cwd = projectRoot || process.cwd();
  if (!paths.length) return runGit('add -A', cwd);
  const quoted = paths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(' ');
  return runGit(`add ${quoted}`, cwd);
}

function commit(projectRoot, message) {
  const cwd = projectRoot || process.cwd();
  const msg = String(message || 'Update from Hoosh AI').replace(/"/g, '\\"');
  return runGit(`commit -m "${msg}"`, cwd);
}

function getLog(projectRoot, limit = 15) {
  const cwd = projectRoot || process.cwd();
  const r = runGit(`log -${limit} --pretty=format:%H|%h|%an|%ar|%s`, cwd);
  if (!r.ok) return [];
  return r.stdout.split('\n').filter(Boolean).map((line) => {
    const [hash, short, author, when, ...msg] = line.split('|');
    return { hash, short, author, when, message: msg.join('|') };
  });
}

module.exports = { getStatus, getDiff, stageFiles, commit, getLog, runGit };
