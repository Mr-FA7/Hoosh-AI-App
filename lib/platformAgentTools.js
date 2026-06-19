/**
 * Agent-facing Docker/Podman + Hoosh Workflows tools (original code, CLI bridge).
 * Used by kernel.executeTool and injected into system prompts.
 */

const PLATFORM_TOOLS_DOC = `
[DOCKER / PODMAN / HOOSH STACKS]
Use when the user wants containers, compose, dev stacks, or infrastructure. Requires Docker Desktop or Podman on the host.
- stackStatus — discover compose files + service ps + runtime
- stackUp { composeFile?, build?, services? } — start stack (waits for health)
- stackDown { composeFile?, volumes? } — stop stack
- stackLogs { composeFile?, service?, tail? }
- stackBuild | stackPull | stackRestart | stackExec { composeFile?, service, command }
- stackInitExample — scaffold compose.yaml + hoosh.dev.yaml in project root
- containerList | containerStart | containerStop | containerRestart | containerRemove { id }
- containerExec { id, command }
- containerInspect { id }
- imageList | imagePull { image }
- networkList | volumeList
- runtimeStatus — docker/podman availability
- kubePlay { file } — Podman only: apply Kubernetes YAML (podman kube play)
- kubeDown { file, volumes? } — Podman only: tear down kube resources

[HOOSH WORKFLOWS — n8n-style automations, original engine (NOT n8n software)]
Flows live in .fa7/workflows/*.flow.json. Node types: trigger.manual|webhook|schedule|poll, action.agent|http|tool|stackUp|stackDown|skill|mcp, logic.delay|if, human.approval
- flowList | flowGet { flowId }
- flowSave { flow } — create/update full flow JSON (nodes + connections)
- flowDelete { flowId }
- flowSetActive { flowId, active } — enable/disable scheduled/webhook flows
- flowRun { flowId, input? }
- flowInitExample — add sample flow
- automationList | automationCreate { type, prompt, intervalMs?, cron? } | automationUpdate { id, ... } | automationDelete { id }

When the user asks to "set up docker", "run compose", "workflow like n8n", or automate tasks — use these tools proactively. Always stackStatus/flowList first if unsure.
`.trim();

const PLATFORM_TOOL_NAMES = new Set([
  'stackup', 'stackdown', 'stackstatus', 'stacklogs', 'stackbuild', 'stackpull',
  'stackrestart', 'stackexec', 'stackinitexample',
  'containerlist', 'containerstart', 'containerstop', 'containerrestart', 'containerremove',
  'containerexec', 'containerinspect',
  'imagelist', 'imagepull', 'networklist', 'volumelist', 'runtimestatus', 'kubeplay',
  'kubedown',
  'flowlist', 'flowget', 'flowsave', 'flowdelete', 'flowsetactive', 'flowrun', 'flowinitexample',
  'automationlist', 'automationcreate', 'automationupdate', 'automationdelete'
]);

function isPlatformTool(name) {
  return PLATFORM_TOOL_NAMES.has(String(name || '').toLowerCase());
}

async function executePlatformTool(name, args, ctx) {
  const tool = String(name || '').toLowerCase();
  const safeArgs = args || {};
  const root = ctx.projectRoot;
  if (!root && !['containerlist', 'imagelist', 'networklist', 'volumelist', 'runtimestatus', 'imagepull'].includes(tool)) {
    return JSON.stringify({ ok: false, error: 'No project open' });
  }

  const { StackRunner } = require('./stackRunner');
  const cm = require('./containerManager');
  const { saveFlow, deleteFlow, getFlow, listFlows, initExampleFlow } = require('./flowStore');
  const { initStackExample } = require('./hooshDevProfile');
  const { kubePlay, kubeDown } = require('./kubePlay');

  if (tool === 'stackstatus') {
    const runner = new StackRunner(root);
    const [runtime, files, psResult] = await Promise.all([
      runner.status(),
      runner.discover(),
      runner.ps(safeArgs.composeFile)
    ]);
    return JSON.stringify({ runtime, files, ps: psResult });
  }
  if (tool === 'stackup') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.up({
      composeFile: safeArgs.composeFile,
      build: safeArgs.build !== false,
      services: safeArgs.services,
      waitHealthy: safeArgs.waitHealthy !== false
    }));
  }
  if (tool === 'stackdown') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.down({
      composeFile: safeArgs.composeFile,
      volumes: !!safeArgs.volumes
    }));
  }
  if (tool === 'stacklogs') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.logs({
      composeFile: safeArgs.composeFile,
      service: safeArgs.service,
      tail: safeArgs.tail
    }));
  }
  if (tool === 'stackbuild') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.build({
      composeFile: safeArgs.composeFile,
      services: safeArgs.services,
      noCache: !!safeArgs.noCache
    }));
  }
  if (tool === 'stackpull') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.pull({ composeFile: safeArgs.composeFile, services: safeArgs.services }));
  }
  if (tool === 'stackrestart') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.restart({ composeFile: safeArgs.composeFile, services: safeArgs.services }));
  }
  if (tool === 'stackexec') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.exec({
      composeFile: safeArgs.composeFile,
      service: safeArgs.service,
      command: safeArgs.command
    }));
  }
  if (tool === 'stackinitexample') {
    return JSON.stringify(await initStackExample(root, { force: !!safeArgs.force }));
  }

  if (tool === 'containerlist') return JSON.stringify(await cm.listContainers(true));
  if (tool === 'containerstart') return JSON.stringify(await cm.containerAction('start', safeArgs.id || safeArgs.name));
  if (tool === 'containerstop') return JSON.stringify(await cm.containerAction('stop', safeArgs.id || safeArgs.name));
  if (tool === 'containerrestart') return JSON.stringify(await cm.containerAction('restart', safeArgs.id || safeArgs.name));
  if (tool === 'containerremove') return JSON.stringify(await cm.containerAction('remove', safeArgs.id || safeArgs.name));
  if (tool === 'containerexec') {
    return JSON.stringify(await cm.execInContainer(safeArgs.id || safeArgs.name, safeArgs.command, safeArgs));
  }
  if (tool === 'containerinspect') {
    return JSON.stringify(await cm.inspectContainer(safeArgs.id || safeArgs.name));
  }
  if (tool === 'imagelist') return JSON.stringify(await cm.listImages());
  if (tool === 'imagepull') return JSON.stringify(await cm.pullImage(safeArgs.image));
  if (tool === 'networklist') return JSON.stringify(await cm.listNetworks());
  if (tool === 'volumelist') return JSON.stringify(await cm.listVolumes());
  if (tool === 'runtimestatus') {
    const { runtimeStatus } = require('./stackRunner');
    return JSON.stringify(await runtimeStatus());
  }
  if (tool === 'kubeplay') {
    return JSON.stringify(await kubePlay(root, safeArgs.file || safeArgs.yaml));
  }
  if (tool === 'kubedown') {
    return JSON.stringify(await kubeDown(root, safeArgs.file || safeArgs.yaml, { volumes: !!safeArgs.volumes }));
  }

  if (tool === 'flowlist') {
    return JSON.stringify({ ok: true, flows: await listFlows(root) });
  }
  if (tool === 'flowget') {
    const flow = await getFlow(root, safeArgs.flowId || safeArgs.id);
    return JSON.stringify({ ok: !!flow, flow });
  }
  if (tool === 'flowsave') {
    const flow = safeArgs.flow || safeArgs;
    const saved = await saveFlow(root, flow);
    if (ctx.flowEngine) {
      const flows = await listFlows(root);
      ctx.flowEngine.refreshSchedules(flows);
    }
    return JSON.stringify({ ok: true, flow: saved });
  }
  if (tool === 'flowdelete') {
    await deleteFlow(root, safeArgs.flowId || safeArgs.id);
    if (ctx.flowEngine) {
      const flows = await listFlows(root);
      ctx.flowEngine.refreshSchedules(flows);
    }
    return JSON.stringify({ ok: true });
  }
  if (tool === 'flowsetactive') {
    const flow = await getFlow(root, safeArgs.flowId || safeArgs.id);
    if (!flow) return JSON.stringify({ ok: false, error: 'Flow not found' });
    flow.active = safeArgs.active !== false;
    const saved = await saveFlow(root, flow);
    if (ctx.flowEngine) {
      const flows = await listFlows(root);
      ctx.flowEngine.refreshSchedules(flows);
    }
    return JSON.stringify({ ok: true, flow: saved });
  }
  if (tool === 'flowrun') {
    if (!ctx.flowEngine) return JSON.stringify({ ok: false, error: 'Flow engine unavailable' });
    const run = await ctx.flowEngine.run(safeArgs.flowId || safeArgs.id, {
      trigger: safeArgs.trigger || 'agent',
      input: safeArgs.input || {}
    });
    return JSON.stringify(run);
  }
  if (tool === 'flowinitexample') {
    return JSON.stringify(await initExampleFlow(root));
  }

  if (tool === 'automationlist') {
    return JSON.stringify({ jobs: ctx.agentAutomation?.list() || [] });
  }
  if (tool === 'automationcreate') {
    const job = ctx.agentAutomation?.add(safeArgs);
    return JSON.stringify({ ok: !!job, job });
  }
  if (tool === 'automationupdate') {
    const job = ctx.agentAutomation?.update(safeArgs.id, safeArgs);
    return JSON.stringify({ ok: !!job, job });
  }
  if (tool === 'automationdelete') {
    ctx.agentAutomation?.remove(safeArgs.id);
    return JSON.stringify({ ok: true });
  }

  return JSON.stringify({ ok: false, error: `Unknown platform tool: ${name}` });
}

const PLATFORM_KERNEL_TOOLS = [
  { name: 'stackStatus', description: 'Compose discovery, runtime, and service ps', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' } } } },
  { name: 'stackUp', description: 'Start compose stack with optional health wait', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, build: { type: 'boolean' }, services: { type: 'array', items: { type: 'string' } }, waitHealthy: { type: 'boolean' } } } },
  { name: 'stackDown', description: 'Stop compose stack', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, volumes: { type: 'boolean' } } } },
  { name: 'stackLogs', description: 'Tail compose logs', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, service: { type: 'string' }, tail: { type: 'number' } } } },
  { name: 'stackBuild', description: 'docker/podman compose build', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, services: { type: 'array', items: { type: 'string' } }, noCache: { type: 'boolean' } } } },
  { name: 'stackPull', description: 'compose pull images', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, services: { type: 'array', items: { type: 'string' } } } } },
  { name: 'stackRestart', description: 'compose restart services', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, services: { type: 'array', items: { type: 'string' } } } } },
  { name: 'stackExec', description: 'Run command in compose service', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' }, service: { type: 'string' }, command: { type: 'string' } }, required: ['service', 'command'] } },
  { name: 'stackInitExample', description: 'Create example compose.yaml and hoosh.dev.yaml', inputSchema: { type: 'object', properties: { force: { type: 'boolean' } } } },
  { name: 'containerList', description: 'List all containers', inputSchema: { type: 'object', properties: {} } },
  { name: 'containerStart', description: 'Start container by id/name', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'containerStop', description: 'Stop container', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'containerRestart', description: 'Restart container', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'containerRemove', description: 'Remove container', inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'containerExec', description: 'Exec shell command in container', inputSchema: { type: 'object', properties: { id: { type: 'string' }, command: { type: 'string' } }, required: ['id', 'command'] } },
  { name: 'containerInspect', description: 'Inspect container JSON', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'imageList', description: 'List local images', inputSchema: { type: 'object', properties: {} } },
  { name: 'imagePull', description: 'Pull image', inputSchema: { type: 'object', properties: { image: { type: 'string' } }, required: ['image'] } },
  { name: 'networkList', description: 'List docker/podman networks', inputSchema: { type: 'object', properties: {} } },
  { name: 'volumeList', description: 'List volumes', inputSchema: { type: 'object', properties: {} } },
  { name: 'runtimeStatus', description: 'Detect docker/podman runtime', inputSchema: { type: 'object', properties: {} } },
  { name: 'kubePlay', description: 'Podman kube play YAML file in project', inputSchema: { type: 'object', properties: { file: { type: 'string' } } } },
  { name: 'kubeDown', description: 'Podman kube down', inputSchema: { type: 'object', properties: { file: { type: 'string' }, volumes: { type: 'boolean' } } } },
  { name: 'flowList', description: 'List .fa7/workflows flows', inputSchema: { type: 'object', properties: {} } },
  { name: 'flowGet', description: 'Get flow by id', inputSchema: { type: 'object', properties: { flowId: { type: 'string' } }, required: ['flowId'] } },
  { name: 'flowSave', description: 'Create or update flow JSON', inputSchema: { type: 'object', properties: { flow: { type: 'object' } } } },
  { name: 'flowDelete', description: 'Delete flow', inputSchema: { type: 'object', properties: { flowId: { type: 'string' } }, required: ['flowId'] } },
  { name: 'flowSetActive', description: 'Enable/disable flow schedules and webhooks', inputSchema: { type: 'object', properties: { flowId: { type: 'string' }, active: { type: 'boolean' } }, required: ['flowId'] } },
  { name: 'flowRun', description: 'Execute a flow', inputSchema: { type: 'object', properties: { flowId: { type: 'string' }, input: { type: 'object' } }, required: ['flowId'] } },
  { name: 'flowInitExample', description: 'Add sample workflow', inputSchema: { type: 'object', properties: {} } },
  { name: 'automationList', description: 'List agent cron/webhook jobs', inputSchema: { type: 'object', properties: {} } },
  { name: 'automationCreate', description: 'Create automation job', inputSchema: { type: 'object', properties: { type: { type: 'string' }, prompt: { type: 'string' }, intervalMs: { type: 'number' }, cron: { type: 'string' } } } },
  { name: 'automationUpdate', description: 'Update automation job', inputSchema: { type: 'object', properties: { id: { type: 'string' }, enabled: { type: 'boolean' }, prompt: { type: 'string' }, cron: { type: 'string' } }, required: ['id'] } },
  { name: 'automationDelete', description: 'Delete automation job', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } }
];

module.exports = {
  PLATFORM_TOOLS_DOC,
  PLATFORM_TOOL_NAMES,
  PLATFORM_KERNEL_TOOLS,
  isPlatformTool,
  executePlatformTool
};
