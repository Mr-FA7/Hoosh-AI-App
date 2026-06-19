/**
 * Dev Containers CLI bridge + hoosh.dev.yaml → devcontainer.json generator.
 */
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

function runCli(cmd, args, cwd, timeoutMs = 300000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, stdout, stderr: stderr + '\n(timeout)' });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: '', stderr: err.message });
    });
  });
}

async function findDevcontainerCli() {
  for (const bin of ['devcontainer', 'npx']) {
    const args = bin === 'npx' ? ['@devcontainers/cli', '--version'] : ['--version'];
    const r = await runCli(bin, args, process.cwd(), 15000);
    if (r.ok) return bin === 'npx' ? { bin: 'npx', prefix: ['@devcontainers/cli'] } : { bin, prefix: [] };
  }
  return null;
}

async function devcontainerUp(projectRoot, options = {}) {
  const cli = await findDevcontainerCli();
  if (!cli) return { ok: false, error: 'Install devcontainer CLI: npm i -g @devcontainers/cli' };
  const args = [...cli.prefix, 'up', '--workspace-folder', path.resolve(projectRoot)];
  if (options.build) args.push('--build-no-cache');
  return runCli(cli.bin, args, projectRoot, options.timeoutMs || 600000);
}

async function devcontainerDown(projectRoot) {
  const cli = await findDevcontainerCli();
  if (!cli) return { ok: false, error: 'devcontainer CLI not found' };
  const args = [...cli.prefix, 'down', '--workspace-folder', path.resolve(projectRoot)];
  return runCli(cli.bin, args, projectRoot);
}

async function devcontainerExec(projectRoot, command) {
  const cli = await findDevcontainerCli();
  if (!cli) return { ok: false, error: 'devcontainer CLI not found' };
  const args = [...cli.prefix, 'exec', '--workspace-folder', path.resolve(projectRoot), '/bin/sh', '-lc', String(command)];
  return runCli(cli.bin, args, projectRoot);
}

async function generateDevcontainerJson(projectRoot, profile = {}) {
  const root = path.resolve(projectRoot);
  const out = path.join(root, '.devcontainer', 'devcontainer.json');
  const spec = {
    name: profile.name || 'Hoosh Dev',
    dockerComposeFile: profile.compose ? `../${profile.compose}` : '../compose.yaml',
    service: (profile.services && profile.services[0]) || 'app',
    workspaceFolder: '/workspace',
    forwardPorts: profile.ports || (profile.preview?.port ? [profile.preview.port] : [3000]),
    postCreateCommand: profile.postCreate || 'npm install',
    customizations: {
      hoosh: { profile: 'hoosh.dev.yaml', generated: true }
    }
  };
  await fs.ensureDir(path.dirname(out));
  await fs.writeJson(out, spec, { spaces: 2 });
  return { ok: true, path: out, spec };
}

module.exports = {
  findDevcontainerCli,
  devcontainerUp,
  devcontainerDown,
  devcontainerExec,
  generateDevcontainerJson
};
