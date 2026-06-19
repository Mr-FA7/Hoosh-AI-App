#!/usr/bin/env node
/**
 * FA7 Media Studio — one-shot bootstrap CLI
 * Usage: node scripts/media-setup.js [--stacks] [--pip-only] [--force-recreate] [--project PATH]
 */
const path = require('path');
const { bootstrapMediaStudio, getBootstrapStatus } = require('../lib/mediaBootstrap');

const args = process.argv.slice(2);
const startStacks = args.includes('--stacks');
const pipOnly = args.includes('--pip-only');
const statusOnly = args.includes('--status');
const forceRecreate = args.includes('--force-recreate');
const projectIdx = args.indexOf('--project');
const projectRoot = projectIdx >= 0 ? path.resolve(args[projectIdx + 1]) : process.cwd();

async function main() {
  if (statusOnly) {
    const s = await getBootstrapStatus();
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  console.log('FA7 Media Studio Bootstrap');
  console.log('  project:', projectRoot);
  console.log('  example:', process.env.FA7_EXAMPLE_ROOT || '(default Desktop/example)');
  console.log('  stacks:', startStacks ? 'yes' : 'no');
  console.log('');

  const report = await bootstrapMediaStudio(projectRoot, {
    pip: true,
    exampleReqs: !pipOnly,
    initStacks: true,
    startStacks,
    installSystem: !pipOnly,
    stackMode: 'bundle',
    pipOnly,
    forceRecreate: forceRecreate || !pipOnly
  }, (ev) => {
    const line = ev.sub
      ? `  [${ev.phase}] ${ev.sub.capability || ev.sub.phase || ''}`
      : `  [${ev.phase}] ${ev.status || '...'}`;
    console.log(line);
  });

  console.log('\n=== RESULT ===');
  console.log('OK:', report.ok);
  console.log('Python:', report.python);
  if (report.phases.verify?.summary) {
    const s = report.phases.verify.summary;
    console.log(`Capabilities ready: ${s.available}/${s.total}`);
  }
  console.log('\nFull report:', JSON.stringify(report.phases, null, 2).slice(0, 4000));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
