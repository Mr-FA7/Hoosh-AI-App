/**
 * auditLog — append-only audit trail for Skill/Workflow/agent capability use.
 * Project-scoped JSONL at <projectRoot>/.fa7/audit.log. Best-effort, never throws.
 * Satisfies the add-on brief's "every Skill action appears in the audit log,
 * attributed to the Skill".
 */
const fs = require('fs');
const path = require('path');

function auditPath(projectRoot) {
  return path.join(projectRoot, '.fa7', 'audit.log');
}

function record(projectRoot, entry) {
  if (!projectRoot) return;
  try {
    const dir = path.join(projectRoot, '.fa7');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + '\n';
    fs.appendFileSync(auditPath(projectRoot), line);
  } catch { /* audit is best-effort */ }
}

function read(projectRoot, limit = 200) {
  try {
    const raw = fs.readFileSync(auditPath(projectRoot), 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return { _raw: l }; } });
  } catch {
    return [];
  }
}

module.exports = { record, read, auditPath };
