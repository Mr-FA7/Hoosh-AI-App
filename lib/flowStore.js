/**
 * Hoosh Flow store — *.flow.json in project .fa7/workflows/
 */
const fs = require('fs-extra');
const path = require('path');
const { randomUUID } = require('crypto');

function workflowsDir(projectRoot) {
  return path.join(path.resolve(projectRoot), '.fa7', 'workflows');
}

function flowPath(projectRoot, id) {
  return path.join(workflowsDir(projectRoot), `${id}.flow.json`);
}

function normalizeFlow(raw, idHint) {
  const id = raw.id || idHint || randomUUID();
  return {
    id,
    name: String(raw.name || 'Workflow').trim(),
    version: Number(raw.version || 1),
    active: raw.active !== false,
    nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
    connections: raw.connections && typeof raw.connections === 'object' ? raw.connections : {},
    settings: raw.settings || {},
    updatedAt: new Date().toISOString()
  };
}

async function listFlows(projectRoot) {
  const dir = workflowsDir(projectRoot);
  if (!(await fs.pathExists(dir))) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.flow.json'));
  const flows = [];
  for (const file of files) {
    try {
      const data = await fs.readJson(path.join(dir, file));
      flows.push(normalizeFlow(data, file.replace('.flow.json', '')));
    } catch { /* skip bad file */ }
  }
  return flows.sort((a, b) => a.name.localeCompare(b.name));
}

async function getFlow(projectRoot, id) {
  const abs = flowPath(projectRoot, id);
  if (!(await fs.pathExists(abs))) return null;
  const data = await fs.readJson(abs);
  return normalizeFlow(data, id);
}

async function saveFlow(projectRoot, flow) {
  const normalized = normalizeFlow(flow, flow.id);
  await fs.ensureDir(workflowsDir(projectRoot));
  await fs.writeJson(flowPath(projectRoot, normalized.id), normalized, { spaces: 2 });
  return normalized;
}

async function deleteFlow(projectRoot, id) {
  const abs = flowPath(projectRoot, id);
  if (await fs.pathExists(abs)) await fs.remove(abs);
  return { ok: true };
}

const EXAMPLE_FLOW = {
  name: 'Agent + Stack',
  version: 1,
  active: true,
  nodes: [
    { id: 'trigger', type: 'trigger.manual', position: { x: 80, y: 120 }, parameters: {} },
    { id: 'agent', type: 'action.agent', position: { x: 320, y: 120 }, parameters: { prompt: 'Summarize project status' } },
    { id: 'stack', type: 'action.stackUp', position: { x: 560, y: 120 }, parameters: { build: true } }
  ],
  connections: {
    trigger: { main: [[{ node: 'agent', input: 0 }]] },
    agent: { main: [[{ node: 'stack', input: 0 }]] }
  }
};

async function initExampleFlow(projectRoot) {
  const flows = await listFlows(projectRoot);
  if (flows.length) return { ok: true, created: [], skipped: ['example exists'] };
  const flow = await saveFlow(projectRoot, { ...EXAMPLE_FLOW, id: randomUUID() });
  return { ok: true, created: [flow.id], flow };
}

module.exports = {
  workflowsDir,
  listFlows,
  getFlow,
  saveFlow,
  deleteFlow,
  initExampleFlow,
  EXAMPLE_FLOW
};
