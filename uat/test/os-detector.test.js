import test from 'node:test';
import assert from 'node:assert';
import { getOSProfile } from '../src/core/os-detector.js';
import { evaluateCommand } from '../src/safety/policy.js';
import { resolveIntent } from '../src/core/unified-commands.js';

test('OS profile has required fields', () => {
  const p = getOSProfile();
  assert.ok(['win32', 'darwin', 'linux'].includes(p.platform));
  assert.ok(p.shells.length >= 1);
  assert.ok(p.defaultShellId);
});

test('dangerous rm -rf / is blocked', () => {
  const r = evaluateCommand('rm -rf /');
  assert.equal(r.action, 'block');
});

test('unified list.files resolves per platform', () => {
  const c = resolveIntent('list.files');
  assert.ok(typeof c === 'string' && c.length > 0);
});
