/**
 * Routes user input: shell passthrough vs unified intent vs NL (delegated to AI layer).
 */

import { resolveIntent, listIntents } from './unified-commands.js';
import { executeCommand } from './shell-engine.js';

const INTENT_PREFIX = 'uat:';

/**
 * @param {string} input
 * @returns {'shell'|'unified'|'uat-meta'}
 */
export function classifyInput(input) {
  const t = input.trim();
  if (t.startsWith(INTENT_PREFIX)) return 'uat-meta';
  if (t.startsWith('!')) return 'unified';
  return 'shell';
}

/**
 * `!list.files` → run unified intent
 * @param {string} input
 */
export function parseUnifiedInvocation(input) {
  const t = input.trim();
  if (!t.startsWith('!')) return null;
  const intentId = t.slice(1).trim();
  return intentId || null;
}

/**
 * @param {string} input
 * @param {{ shellId?: string, cwd?: string }} execOpts
 */
export async function routeAndExecute(input, execOpts = {}) {
  const kind = classifyInput(input);

  if (kind === 'unified') {
    const intentId = parseUnifiedInvocation(input);
    if (!intentId) {
      return { kind: 'error', message: 'Empty intent after !' };
    }
    const cmd = resolveIntent(intentId, execOpts);
    if (!cmd) {
      return {
        kind: 'error',
        message: `Unknown intent "${intentId}". Known: ${listIntents().join(', ')}`
      };
    }
    const result = await executeCommand(cmd, execOpts);
    return { kind: 'unified', intentId, command: cmd, result };
  }

  const cmd = input.trim();
  const result = await executeCommand(cmd, execOpts);
  return { kind: 'shell', result };
}
