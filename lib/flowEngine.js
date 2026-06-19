/**
 * Hoosh Flow engine — original workflow runner (n8n-inspired concepts, no n8n code).
 * Item contract: [{ json, binary? }]
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const { getFlow } = require('./flowStore');
const { scheduleCron } = require('./simpleCron');
const { evaluateObject, evaluateExpression, getByPath } = require('./flowExpressions');
const { getCredential, applyCredentialToHeaders } = require('./integrationCredentials');

const RUNS_PATH = path.join(os.homedir(), '.aivon-os', 'flow-runs.json');

class FlowEngine {
  constructor(options = {}) {
    this.getProjectRoot = options.getProjectRoot || (() => null);
    this.getKernel = options.getKernel || (() => null);
    this.getHitl = options.getHitl || (() => null);
    this.runs = [];
    this.cronTimers = new Map();
    this.webhookSecrets = new Map();
    this.loadRuns();
  }

  loadRuns() {
    try {
      if (fs.existsSync(RUNS_PATH)) {
        this.runs = fs.readJsonSync(RUNS_PATH).runs || [];
      }
    } catch {
      this.runs = [];
    }
    return this.runs;
  }

  saveRuns() {
    fs.ensureDirSync(path.dirname(RUNS_PATH));
    fs.writeJsonSync(RUNS_PATH, { runs: this.runs.slice(-200) }, { spaces: 2 });
  }

  listRuns(flowId) {
    const rows = [...this.runs].reverse();
    return flowId ? rows.filter((r) => r.flowId === flowId) : rows;
  }

  getRun(id) {
    return this.runs.find((r) => r.id === id) || null;
  }

  registerWebhook(flow) {
    const secret = flow.settings?.webhookSecret || flow.id;
    this.webhookSecrets.set(secret, flow.id);
    return secret;
  }

  scheduleFlow(flow) {
    const cron = flow.settings?.cron || flow.nodes?.find((n) => n.type === 'trigger.schedule')?.parameters?.cron;
    if (!cron) return;
    if (this.cronTimers.has(`cron:${flow.id}`)) {
      this.cronTimers.get(`cron:${flow.id}`)();
      this.cronTimers.delete(`cron:${flow.id}`);
    }
    const cancel = scheduleCron(cron, () => {
      if (flow.active) this.run(flow.id, { trigger: 'schedule' }).catch(() => {});
    });
    this.cronTimers.set(`cron:${flow.id}`, cancel);
  }

  schedulePoll(flow) {
    const pollNode = flow.nodes?.find((n) => n.type === 'trigger.poll');
    if (!pollNode) return;
    const url = String(pollNode.parameters?.url || '').trim();
    const intervalMs = Number(pollNode.parameters?.intervalMs || 60000);
    if (!url) return;
    const key = `poll:${flow.id}`;
    if (this.cronTimers.has(key)) {
      this.cronTimers.get(key)();
      this.cronTimers.delete(key);
    }
    let lastSig = '';
    const timer = setInterval(async () => {
      if (!flow.active) return;
      try {
        const res = await fetch(url);
        const text = await res.text();
        const sig = `${res.status}:${text.length}:${text.slice(0, 120)}`;
        if (sig !== lastSig) {
          lastSig = sig;
          await this.run(flow.id, {
            trigger: 'poll',
            items: [{ json: { url, status: res.status, changed: true, preview: text.slice(0, 500) } }]
          });
        }
      } catch { /* ignore poll errors */ }
    }, intervalMs);
    this.cronTimers.set(key, () => clearInterval(timer));
  }

  refreshSchedules(flows = []) {
    for (const c of this.cronTimers.values()) {
      if (typeof c === 'function') c();
      else clearInterval(c);
    }
    this.cronTimers.clear();
    this.webhookSecrets.clear();
    for (const flow of flows) {
      if (!flow.active) continue;
      if (flow.nodes?.some((n) => n.type === 'trigger.webhook')) this.registerWebhook(flow);
      if (flow.nodes?.some((n) => n.type === 'trigger.schedule') || flow.settings?.cron) {
        this.scheduleFlow(flow);
      }
      if (flow.nodes?.some((n) => n.type === 'trigger.poll')) {
        this.schedulePoll(flow);
      }
    }
  }

  getNextNodes(flow, nodeId, branchIndex = 0) {
    const batch = flow.connections?.[nodeId]?.main?.[branchIndex];
    const conns = batch || flow.connections?.[nodeId]?.main?.[0] || [];
    return conns.map((c) => c.node).filter(Boolean);
  }

  findStartNodes(flow) {
    const referenced = new Set();
    for (const src of Object.keys(flow.connections || {})) {
      for (const batch of flow.connections[src]?.main || []) {
        for (const c of batch || []) referenced.add(c.node);
      }
    }
    const triggers = flow.nodes.filter((n) => String(n.type || '').startsWith('trigger.'));
    if (triggers.length) return triggers.map((n) => n.id);
    return flow.nodes.filter((n) => !referenced.has(n.id)).map((n) => n.id);
  }

  async executeNode(node, items, ctx) {
    const type = node.type || 'action.noop';
    const p = node.parameters || {};
    const exprCtx = { item: items[0] || { json: {} }, input: ctx.input, json: items[0]?.json };

    if (type === 'trigger.manual' || type === 'trigger.webhook' || type === 'trigger.schedule' || type === 'trigger.poll') {
      return items.length ? items : [{ json: { trigger: type, at: new Date().toISOString() } }];
    }

    if (type === 'logic.delay') {
      const ms = Number(evaluateExpression(String(p.ms || 1000), exprCtx));
      await new Promise((r) => setTimeout(r, ms));
      return items;
    }

    if (type === 'logic.if') {
      const field = p.field || 'json.ok';
      const val = field.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), { json: items[0]?.json });
      const expected = p.equals !== undefined ? evaluateObject(p.equals, exprCtx) : undefined;
      const pass = expected !== undefined ? val === expected : !!val;
      ctx.branchIndex = pass ? 0 : 1;
      return pass ? items : [{ json: { skipped: true, reason: 'if false', branch: 1 } }];
    }

    if (type === 'logic.switch') {
      const field = p.field || 'json.status';
      const val = getByPath(items[0] || {}, field.startsWith('$') ? field : `$json.${field.replace(/^json\./, '')}`);
      const rules = Array.isArray(p.rules) ? p.rules : [];
      let branch = rules.length;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.equals !== undefined && val === rule.equals) { branch = i; break; }
        if (rule.contains && String(val || '').includes(String(rule.contains))) { branch = i; break; }
      }
      ctx.branchIndex = branch;
      return items;
    }

    if (type === 'logic.merge') {
      return items;
    }

    if (type === 'logic.splitBatch') {
      const size = Math.max(1, Number(p.batchSize || 10));
      const batches = [];
      for (let i = 0; i < items.length; i += size) {
        batches.push({ json: { batch: batches.length, items: items.slice(i, i + size).map((it) => it.json) } });
      }
      return batches.length ? batches : items;
    }

    if (type === 'action.set') {
      const data = evaluateObject(p.data || {}, exprCtx);
      return items.map((it) => ({ json: { ...it.json, ...data } }));
    }

    if (type === 'action.http') {
      const url = String(evaluateObject(p.url || '', exprCtx)).trim();
      if (!url) return [{ json: { ok: false, error: 'url required' } }];
      const method = (p.method || 'GET').toUpperCase();
      let headers = evaluateObject(p.headers || {}, exprCtx);
      if (p.credentialId) {
        const cred = await getCredential(p.credentialId);
        headers = applyCredentialToHeaders(cred, headers);
      }
      const bodyRaw = p.body !== undefined ? evaluateObject(p.body, exprCtx) : undefined;
      const body = bodyRaw !== undefined ? (typeof bodyRaw === 'string' ? bodyRaw : JSON.stringify(bodyRaw)) : undefined;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body });
      const text = await res.text();
      let json = { status: res.status, body: text };
      try { json.data = JSON.parse(text); } catch { /* plain text */ }
      return [{ json }];
    }

    if (type === 'action.flowCall') {
      const subId = String(p.flowId || p.flow || '').trim();
      if (!subId) return [{ json: { ok: false, error: 'flowId required' } }];
      const subRun = await this.run(subId, {
        trigger: 'subflow',
        input: items[0]?.json || {},
        items
      });
      if (subRun.status === 'waiting_hitl') {
        ctx.pendingHitl = subRun.hitlId;
        ctx.subflowRunId = subRun.id;
      }
      return subRun.output || [{ json: { ok: subRun.status === 'completed', subRunId: subRun.id, status: subRun.status } }];
    }

    if (type === 'action.agent') {
      const kernel = this.getKernel();
      if (!kernel) return [{ json: { ok: false, error: 'kernel unavailable' } }];
      const prompt = String(p.prompt || items[0]?.json?.prompt || 'Continue workflow').trim();
      const result = await kernel.executeAutonomousLoop(prompt);
      return [{ json: { ok: true, result: String(result || '').slice(0, 8000) } }];
    }

    if (type === 'action.tool') {
      const kernel = this.getKernel();
      if (!kernel?.executeTool) return [{ json: { ok: false, error: 'tools unavailable' } }];
      const tool = String(p.tool || '').trim();
      const args = p.args || items[0]?.json || {};
      const result = await kernel.executeTool(tool, args);
      return [{ json: { ok: true, tool, result } }];
    }

    if (type === 'action.stackUp') {
      const root = this.getProjectRoot();
      const { StackRunner } = require('./stackRunner');
      const runner = new StackRunner(root);
      const result = await runner.up({
        composeFile: p.composeFile,
        build: p.build !== false,
        services: p.services,
        waitHealthy: p.waitHealthy !== false
      });
      return [{ json: result }];
    }

    if (type === 'action.stackDown') {
      const root = this.getProjectRoot();
      const { StackRunner } = require('./stackRunner');
      const runner = new StackRunner(root);
      const result = await runner.down({ composeFile: p.composeFile, volumes: !!p.volumes });
      return [{ json: result }];
    }

    if (type === 'action.skill') {
      const kernel = this.getKernel();
      if (!kernel) return [{ json: { ok: false, error: 'kernel unavailable' } }];
      const skillId = String(p.skillId || p.skill || '').trim();
      const prompt = String(p.prompt || `Execute skill ${skillId} with input: ${JSON.stringify(items[0]?.json || {})}`);
      const result = await kernel.executeAutonomousLoop(prompt);
      return [{ json: { ok: true, skillId, result: String(result || '').slice(0, 8000) } }];
    }

    if (type === 'action.mcp') {
      const kernel = this.getKernel();
      if (!kernel?.executeTool) return [{ json: { ok: false, error: 'tools unavailable' } }];
      const toolId = String(p.toolId || p.tool || '').trim();
      const result = await kernel.executeTool('mcpTool', {
        toolId,
        arguments: p.arguments || p.args || items[0]?.json || {}
      });
      return [{ json: { ok: true, toolId, result } }];
    }

    if (type === 'action.media') {
      const { runMediaAction, runCapability } = require('./mediaBridge');
      const capId = String(p.capabilityId || p.capability || '').trim();
      const action = String(p.action || p.tool || '').trim();
      const params = { ...p, ...(items[0]?.json || {}) };
      delete params.capabilityId;
      delete params.action;
      delete params.tool;
      const result = capId && !action
        ? await runCapability(capId, params, { projectRoot: this.getProjectRoot() })
        : await runMediaAction(action || 'transcribe', params, { projectRoot: this.getProjectRoot() });
      return [{ json: result }];
    }

    if (type === 'human.approval') {
      const hitl = this.getHitl();
      if (!hitl) return [{ json: { ok: false, error: 'HITL unavailable' } }];
      const wf = hitl.create(`Flow:${ctx.runId}:${node.id}`, [{
        label: p.label || 'Approve',
        type: 'human',
        prompt: p.prompt || 'Approve workflow step',
        requiresApproval: true
      }]);
      ctx.pendingHitl = wf.id;
      return [{ json: { ok: true, waiting: true, hitlId: wf.id, message: p.prompt || 'Waiting for approval' } }];
    }

    return items;
  }

  async runFlowGraph(flow, ctx, startIds, initialItems, initialVisited = null) {
    const queue = [...startIds];
    let items = initialItems || [{ json: { input: ctx.input || {} } }];
    const visited = initialVisited ? new Set(initialVisited) : new Set();

    while (queue.length) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = flow.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      ctx.branchIndex = 0;
      ctx.steps.push({ nodeId, type: node.type, at: new Date().toISOString() });
      items = await this.executeNode(node, items, ctx);
      if (ctx.pendingHitl) {
        ctx.status = 'waiting_hitl';
        ctx.resumeState = { items, queue: [...queue], visited: [...visited], pausedAtNodeId: nodeId };
        break;
      }
      const branch = ctx.branchIndex || 0;
      const next = this.getNextNodes(flow, nodeId, branch);
      for (const n of next) queue.push(n);
    }
    return items;
  }

  async run(flowId, options = {}) {
    const root = this.getProjectRoot();
    if (!root) throw new Error('No project open');
    const flow = await getFlow(root, flowId);
    if (!flow) throw new Error('Flow not found');

    const run = {
      id: randomUUID(),
      flowId: flow.id,
      flowName: flow.name,
      status: 'running',
      trigger: options.trigger || 'manual',
      startedAt: new Date().toISOString(),
      steps: [],
      output: null,
      error: null
    };
    this.runs.push(run);
    this.saveRuns();

    const ctx = { runId: run.id, input: options.input || {}, steps: run.steps, pendingHitl: null, status: 'running' };
    try {
      const starts = options.startNode ? [options.startNode] : this.findStartNodes(flow);
      const items = await this.runFlowGraph(flow, ctx, starts, options.items);
      if (ctx.status === 'waiting_hitl') {
        run.status = 'waiting_hitl';
        run.hitlId = ctx.pendingHitl;
        run.resumeState = ctx.resumeState;
      } else {
        run.status = 'completed';
      }
      run.output = items;
      run.finishedAt = new Date().toISOString();
    } catch (e) {
      run.status = 'failed';
      run.error = e.message;
      run.finishedAt = new Date().toISOString();
    }
    this.saveRuns();
    return run;
  }

  async resume(runId, options = {}) {
    const run = this.getRun(runId);
    if (!run) throw new Error('Run not found');
    if (run.status !== 'waiting_hitl') throw new Error('Run is not waiting for approval');
    const root = this.getProjectRoot();
    if (!root) throw new Error('No project open');
    const flow = await getFlow(root, run.flowId);
    if (!flow) throw new Error('Flow not found');

    if (options.approved === false) {
      run.status = 'cancelled';
      run.finishedAt = new Date().toISOString();
      run.error = options.reason || 'Rejected';
      this.saveRuns();
      return run;
    }

    const state = run.resumeState || {};
    const ctx = {
      runId: run.id,
      input: options.input || {},
      steps: run.steps,
      pendingHitl: null,
      status: 'running'
    };
    const nextIds = this.getNextNodes(flow, state.pausedAtNodeId, 0);
    const queue = [...(state.queue || []), ...nextIds];
    try {
      const items = await this.runFlowGraph(flow, ctx, queue, state.items || [], state.visited || []);
      if (ctx.status === 'waiting_hitl') {
        run.status = 'waiting_hitl';
        run.hitlId = ctx.pendingHitl;
        run.resumeState = ctx.resumeState;
      } else {
        run.status = 'completed';
        run.output = items;
        run.finishedAt = new Date().toISOString();
      }
    } catch (e) {
      run.status = 'failed';
      run.error = e.message;
      run.finishedAt = new Date().toISOString();
    }
    this.saveRuns();
    return run;
  }

  async runWebhook(secret, body = {}, headers = {}) {
    const flowId = this.webhookSecrets.get(secret);
    if (!flowId) throw new Error('Unknown webhook');
    const root = this.getProjectRoot();
    const flow = root ? await getFlow(root, flowId) : null;
    const expected = flow?.settings?.webhookAuth;
    if (expected) {
      const auth = headers.authorization || headers.Authorization || '';
      if (auth !== expected && auth !== `Bearer ${expected}`) throw new Error('Webhook unauthorized');
    }
    return this.run(flowId, { trigger: 'webhook', input: body, items: [{ json: body }] });
  }
}

module.exports = { FlowEngine, RUNS_PATH };
