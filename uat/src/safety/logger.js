/**
 * Append-only audit log (JSON Lines).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export function getUatHome() {
  const base = process.env.UAT_HOME || path.join(os.homedir(), '.uat');
  return base;
}

export function ensureLogDir() {
  const dir = path.join(getUatHome(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * @param {Record<string, unknown>} record
 */
export function logExecution(record) {
  try {
    const dir = ensureLogDir();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...record
    });
    fs.appendFileSync(path.join(dir, 'commands.jsonl'), line + '\n', 'utf8');
  } catch {
    /* never throw from logger */
  }
}
