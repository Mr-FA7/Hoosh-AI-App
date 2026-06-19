/**
 * skillEval — runs a Skill's eval/*.json structural checks (S1).
 *
 * S1 evals are structural/static (no LLM): they assert the manifest + system
 * prompt are well-formed and the declared capabilities match intent. This is
 * the "no evals → not verified" gate from the add-on brief. Richer behavioral
 * (LLM) evals come later.
 */
const fs = require('fs-extra');
const path = require('path');

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].map(String).sort();
  const sb = [...b].map(String).sort();
  return sa.every((v, i) => v === sb[i]);
}

async function loadSystemPrompt(skillDir, manifest) {
  if (!manifest.systemPrompt) return '';
  try { return await fs.readFile(path.join(skillDir, manifest.systemPrompt), 'utf8'); } catch { return ''; }
}

function runCase(c, { systemPrompt, manifest }) {
  switch (c.assert) {
    case 'systemPromptContains':
      return systemPrompt.includes(String(c.value));
    case 'shellAllowlistEquals':
      return arraysEqual(manifest.permissions?.shell?.allowlist, c.value);
    case 'filesystemScopeEquals':
      return manifest.permissions?.filesystem === c.value;
    case 'networkEquals':
      return arraysEqual(manifest.permissions?.network, c.value);
    default:
      return false;
  }
}

/** Run all eval files for a skill. Returns { passed, total, ratio, results }. */
async function evaluateSkill(skillDir, manifest) {
  const evalDir = path.join(skillDir, 'eval');
  let files = [];
  try {
    files = (await fs.readdir(evalDir)).filter((f) => f.endsWith('.json')).map((f) => path.join(evalDir, f));
  } catch { /* no eval dir */ }

  const systemPrompt = await loadSystemPrompt(skillDir, manifest);
  const results = [];
  let passed = 0, total = 0;
  for (const file of files) {
    let spec;
    try { spec = await fs.readJson(file); } catch { continue; }
    for (const c of spec.cases || []) {
      total++;
      const ok = runCase(c, { systemPrompt, manifest });
      if (ok) passed++;
      results.push({ suite: spec.name, name: c.name, ok });
    }
  }
  const ratio = total ? passed / total : 0;
  const threshold = manifest.eval?.passThreshold ?? 0.8;
  return { passed, total, ratio, threshold, verified: total > 0 && ratio >= threshold, results };
}

module.exports = { evaluateSkill, arraysEqual };
