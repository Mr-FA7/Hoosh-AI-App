#!/usr/bin/env node
/**
 * Universal AI Terminal — CLI entry
 */

import { parseArgs } from 'node:util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { getOSProfile, pickShell } from '../src/core/os-detector.js';
import { executeCommand } from '../src/core/shell-engine.js';
import { routeAndExecute } from '../src/core/command-router.js';
import { resolveIntent, listIntents } from '../src/core/unified-commands.js';
import { evaluateCommand } from '../src/safety/policy.js';
import { logExecution } from '../src/safety/logger.js';
import { naturalLanguageToCommand } from '../src/ai/command-intelligence.js';
import { getInstallRecipe, listSupportedRuntimes } from '../src/runtime/runtime-manager.js';
import { detectProjects } from '../src/runtime/package-managers.js';
import { checkForUpdate, downloadAndVerify } from '../src/update/self-update.js';
import { loadPlugins } from '../src/plugins/loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

function printHelp() {
  console.log(`
Universal AI Terminal (UAT) v${PKG.version}

Usage:
  uat doctor                    Show OS, shells, and paths
  uat exec "<command>"          Run through shell engine (with safety check)
  uat run "<command>"           Alias for exec
  uat unified "<intent>"        Run mapped intent (e.g. list.files)
  uat ask "<natural language>"  Translate via Ollama/OpenAI → propose command (dry-run add --exec)
  uat runtime list              List supported runtime recipes
  uat runtime install <name>    Print install recipe for this OS
  uat project [dir]             Detect stack and suggest install commands
  uat update check              Compare current version to GitHub latest (set UAT_UPDATE_REPO)
  uat plugins                   Load plugins from ~/.uat/plugins and ./plugins
  uat intents                   List unified command intents

Environment:
  OLLAMA_HOST, UAT_MODEL, OPENAI_API_KEY, UAT_HOME, UAT_UPDATE_REPO, UAT_SANDBOX
`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      exec: { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      shell: { type: 'string' }
    }
  });

  const cmd = positionals[0];
  const rest = positionals.slice(1);

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp();
    process.exit(0);
  }

  if (cmd === 'doctor') {
    const p = getOSProfile();
    console.log(JSON.stringify(p, null, 2));
    return;
  }

  if (cmd === 'intents') {
    console.log(listIntents().join('\n'));
    return;
  }

  if (cmd === 'unified') {
    const intent = rest.join(' ').trim();
    if (!intent) {
      console.error('usage: uat unified <intentId>');
      process.exit(1);
    }
    const line = `!${intent}`;
    const out = await routeAndExecute(line, { shellId: values.shell });
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === 'exec' || cmd === 'run') {
    const command = rest.join(' ').trim();
    if (!command) {
      console.error('usage: uat exec "<command>"');
      process.exit(1);
    }
    const policy = evaluateCommand(command);
    if (policy.action === 'block') {
      console.error('BLOCKED:', policy.rules.join(', '));
      process.exit(2);
    }
    if (policy.action === 'confirm' && !values.yes) {
      console.error('CONFIRMATION REQUIRED:', policy.rules.join(', '));
      console.error('Re-run with --yes to acknowledge risk.');
      process.exit(3);
    }
    const result = await executeCommand(command, { shellId: values.shell });
    logExecution({ command, policy, exitCode: result.exitCode });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.exitCode ?? 1);
  }

  if (cmd === 'ask') {
    const text = rest.join(' ').trim();
    if (!text) {
      console.error('usage: uat ask "<natural language>" [--exec]');
      process.exit(1);
    }
    const { command } = await naturalLanguageToCommand(text);
    console.log('Proposed command:', command);
    const policy = evaluateCommand(command);
    console.log('Safety:', policy);
    if (values.exec) {
      if (policy.action === 'block') {
        console.error('BLOCKED');
        process.exit(2);
      }
      if (policy.action === 'confirm' && !values.yes) {
        console.error('CONFIRMATION REQUIRED — use --yes');
        process.exit(3);
      }
      const result = await executeCommand(command, { shellId: values.shell });
      logExecution({ nl: text, command, policy, exitCode: result.exitCode });
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exit(result.exitCode ?? 1);
    }
    return;
  }

  if (cmd === 'runtime') {
    const sub = rest[0];
    if (sub === 'list') {
      console.log(listSupportedRuntimes().join('\n'));
      return;
    }
    if (sub === 'install') {
      const name = rest[1];
      if (!name) {
        console.error('usage: uat runtime install <name>');
        process.exit(1);
      }
      const recipe = getInstallRecipe(name);
      if (!recipe) {
        console.error('No recipe for', name);
        process.exit(1);
      }
      console.log(recipe);
      console.log('\nReview and run manually in an elevated shell if required.');
      return;
    }
  }

  if (cmd === 'project') {
    const dir = path.resolve(rest[0] || '.');
    const hits = detectProjects(dir);
    console.log(JSON.stringify(hits, null, 2));
    return;
  }

  if (cmd === 'update') {
    const sub = rest[0];
    if (sub === 'check') {
      const repo = process.env.UAT_UPDATE_REPO;
      if (!repo || repo.includes('your-org')) {
        console.error('Set UAT_UPDATE_REPO=owner/repo for your fork.');
        process.exit(1);
      }
      const [owner, rname] = repo.split('/');
      const info = await checkForUpdate({ owner, repo: rname, currentVersion: PKG.version });
      console.log(JSON.stringify(info, null, 2));
      return;
    }
    if (sub === 'download' && rest[1]) {
      const { path: p, sha256 } = await downloadAndVerify(rest[1]);
      console.log('Saved', p, 'sha256', sha256);
      return;
    }
    console.error('usage: uat update check | uat update download <url>');
    process.exit(1);
  }

  if (cmd === 'plugins') {
    const root = path.join(__dirname, '../plugins');
    const plugs = await loadPlugins(root);
    console.log(JSON.stringify(plugs.map((p) => ({ name: p.name, version: p.version })), null, 2));
    return;
  }

  printHelp();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
