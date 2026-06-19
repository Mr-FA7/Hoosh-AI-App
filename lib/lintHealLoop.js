const fs = require('fs-extra');
const path = require('path');
const { runPostEditChecks } = require('./lintRunner');
const { applyEdit } = require('./editFormats');

function extractCodeFence(text) {
  const m = String(text || '').match(/```[\w]*\n([\s\S]*?)```/);
  return m ? m[1].trim() : '';
}

/**
 * Aider-style lint loop: run lint/test, optionally heal file, retry.
 * @param {{ projectRoot: string, relPath: string, healFn?: Function, maxRetries?: number, emit?: Function }} opts
 */
async function runLintHealLoop(opts = {}) {
  const projectRoot = opts.projectRoot;
  const relPath = String(opts.relPath || '').replace(/^\.\//, '');
  const maxRetries = Math.max(0, Math.min(4, Number(opts.maxRetries ?? 2)));
  const emit = opts.emit;
  let attempt = 0;
  let lastLint = null;

  while (attempt <= maxRetries) {
    lastLint = await runPostEditChecks(projectRoot, [relPath]);
    if (!lastLint.failed) {
      return { ok: true, passed: true, attempts: attempt, lint: lastLint };
    }
    if (!opts.healFn || attempt >= maxRetries) {
      return { ok: false, passed: false, attempts: attempt, lint: lastLint, feedback: lastLint.feedback };
    }
    if (emit) {
      emit('status', { message: `Lint/test failed — self-heal attempt ${attempt + 1}/${maxRetries}...` });
    }
    const healed = await opts.healFn({ relPath, feedback: lastLint.feedback, attempt });
    if (!healed?.ok) {
      return { ok: false, passed: false, attempts: attempt, lint: lastLint, feedback: lastLint.feedback, healError: healed?.error };
    }
    attempt += 1;
  }
  return { ok: false, passed: false, attempts: attempt, lint: lastLint, feedback: lastLint?.feedback };
}

async function applyHealPatch(projectRoot, relPath, healText) {
  const full = path.join(projectRoot, relPath);
  const existing = await fs.readFile(full, 'utf8').catch(() => '');
  const tool = extractRobustTool(healText);
  if (tool?.name === 'writeFile' && tool.args?.content != null) {
    await fs.writeFile(full, String(tool.args.content), 'utf8');
    return { ok: true, method: 'writeFile' };
  }
  if (tool?.name === 'patchFile' && tool.args) {
    const result = applyEdit(tool.args, existing);
    if (!result.ok) return { ok: false, error: result.error };
    await fs.writeFile(full, result.content, 'utf8');
    return { ok: true, method: 'patchFile' };
  }
  const fenced = extractCodeFence(healText);
  if (fenced) {
    await fs.writeFile(full, fenced, 'utf8');
    return { ok: true, method: 'code_fence' };
  }
  return { ok: false, error: 'No applicable heal patch in agent response' };
}

function extractRobustTool(text) {
  const norm = String(text || '');
  const toolMatch = norm.match(/TOOL:\s*(\{[\s\S]*?\})\s*(?:\n|$)/i);
  if (toolMatch) {
    try { return JSON.parse(toolMatch[1]); } catch { /* fall through */ }
  }
  try {
    const j = JSON.parse(norm.trim());
    if (j?.name) return j;
  } catch { /* ignore */ }
  return null;
}

module.exports = {
  runLintHealLoop,
  applyHealPatch,
  extractCodeFence
};
