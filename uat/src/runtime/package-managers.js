/**
 * Project fingerprinting → suggested dependency install commands.
 */

import fs from 'fs';
import path from 'path';

/**
 * @param {string} projectRoot
 * @returns {{ type: string, installCommands: string[] }[]}
 */
export function detectProjects(projectRoot) {
  const out = [];
  const pkg = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkg)) {
    out.push({ type: 'node', installCommands: ['npm install', 'npm ci'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    out.push({ type: 'node-pnpm', installCommands: ['pnpm install'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
    out.push({ type: 'node-yarn', installCommands: ['yarn install'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'requirements.txt'))) {
    out.push({ type: 'python', installCommands: ['pip install -r requirements.txt'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
    out.push({ type: 'python-pep621', installCommands: ['pip install -e .'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
    out.push({ type: 'rust', installCommands: ['cargo build'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
    out.push({ type: 'go', installCommands: ['go mod download'] });
  }
  if (fs.existsSync(path.join(projectRoot, 'Gemfile'))) {
    out.push({ type: 'ruby', installCommands: ['bundle install'] });
  }
  return out;
}
