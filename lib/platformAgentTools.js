/**
 * Agent-facing Docker/Podman + Hoosh Workflows tools (original code, CLI bridge).
 * Used by kernel.executeTool and injected into system prompts.
 */

const PLATFORM_TOOLS_DOC = `
[DOCKER / PODMAN / HOOSH STACKS]
Use when the user wants containers, compose, dev stacks, registry, prune, or infrastructure. Requires Docker Desktop or Podman.
Stacks: stackStatus, stackUp, stackDown, stackLogs, stackBuild, stackPull, stackRestart, stackExec, stackConfig, stackInitExample
Containers: containerList, containerRun, containerStart|Stop|Restart|Remove, containerExec, containerInspect, containerLogs, containerCp
Images: imageList, imagePull, imageBuild, imagePush, imageTag, imageRemove
Registry: registryLogin { username, password, server? }, registryLogout { server? }
Networks/Volumes: networkList, networkCreate, networkRemove, volumeList, volumeCreate, volumeRemove
Cleanup: systemDf, systemPrune { volumes? }, imagePrune, volumePrune, networkPrune
Runtime: runtimeStatus, kubePlay, kubeDown (Podman)
Podman extras: podList, podStart|Stop|Remove, secretList, secretCreate, secretRemove, machineInfo, machineStart|Stop
Dev Containers: devcontainerGenerate, devcontainerUp, devcontainerDown, devcontainerExec

[HOOSH WORKFLOWS — original engine (NOT n8n)]
Flows in .fa7/workflows/*.flow.json. Expressions: {{ $json.field }}, {{ $now }}
Nodes: trigger.*, action.agent|http|tool|stackUp|stackDown|skill|mcp|media|flowCall|set, logic.delay|if|switch|merge|splitBatch, human.approval
flowList, flowGet, flowSave, flowDelete, flowSetActive, flowRun, flowResume { runId, approved? }, flowInitExample
Credentials (HTTP nodes): credentialList, credentialSave { name, type, data }, credentialDelete { id }
Automations: automationList|Create|Update|Delete

Use stackStatus/flowList first. Ask before prune/remove/down with volumes.
`.trim();

const GLOBAL_PLATFORM_TOOLS = new Set([
  'containerlist', 'imagelist', 'networklist', 'volumelist', 'runtimestatus',
  'imagepull', 'registrylogin', 'registrylogout', 'imagebuild', 'imagepush',
  'imagetag', 'imageremove', 'systemdf', 'systemprune', 'imageprune',
  'volumeprune', 'networkprune', 'podlist', 'secretlist', 'machineinfo',
  'machinestart', 'machinestop', 'credentiallist'
]);

const PLATFORM_TOOL_NAMES = new Set([
  ...GLOBAL_PLATFORM_TOOLS,
  'stackup', 'stackdown', 'stackstatus', 'stacklogs', 'stackbuild', 'stackpull',
  'stackrestart', 'stackexec', 'stackconfig', 'stackinitexample',
  'containerrun', 'containerstart', 'containerstop', 'containerrestart', 'containerremove',
  'containerexec', 'containerinspect', 'containerlogs', 'containercp',
  'networkcreate', 'networkremove', 'volumecreate', 'volumeremove',
  'kubeplay', 'kubedown',
  'podstart', 'podstop', 'podremove', 'secretcreate', 'secretremove',
  'devcontainerup', 'devcontainerdown', 'devcontainerexec', 'devcontainergenerate',
  'flowlist', 'flowget', 'flowsave', 'flowdelete', 'flowsetactive', 'flowrun',
  'flowresume', 'flowinitexample',
  'credentialsave', 'credentialdelete',
  'automationlist', 'automationcreate', 'automationupdate', 'automationdelete'
]);

function isPlatformTool(name) {
  return PLATFORM_TOOL_NAMES.has(String(name || '').toLowerCase());
}

async function executePlatformTool(name, args, ctx) {
  const tool = String(name || '').toLowerCase();
  const safeArgs = args || {};
  const root = ctx.projectRoot;
  if (!root && !GLOBAL_PLATFORM_TOOLS.has(tool)) {
    return JSON.stringify({ ok: false, error: 'No project open' });
  }

  const { StackRunner } = require('./stackRunner');
  const cm = require('./containerManager');
  const ext = require('./containerEngineExtended');
  const podman = require('./podmanExtras');
  const devc = require('./devcontainerBridge');
  const creds = require('./integrationCredentials');
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
  if (tool === 'stackconfig') {
    const runner = new StackRunner(root);
    return JSON.stringify(await runner.config({ composeFile: safeArgs.composeFile }));
  }

  if (tool === 'registrylogin') {
    return JSON.stringify(await ext.registryLogin(safeArgs));
  }
  if (tool === 'registrylogout') {
    return JSON.stringify(await ext.registryLogout(safeArgs.server));
  }
  if (tool === 'imagebuild') {
    return JSON.stringify(await ext.buildImage({ ...safeArgs, context: safeArgs.context || root || '.' }));
  }
  if (tool === 'imagepush') {
    return JSON.stringify(await ext.pushImage(safeArgs.image));
  }
  if (tool === 'imagetag') {
    return JSON.stringify(await ext.tagImage(safeArgs.source, safeArgs.target));
  }
  if (tool === 'imageremove') {
    return JSON.stringify(await ext.removeImage(safeArgs.image || safeArgs.id, !!safeArgs.force));
  }
  if (tool === 'containerrun') {
    return JSON.stringify(await ext.runContainer({ ...safeArgs, cwd: root }));
  }
  if (tool === 'containerlogs') {
    return JSON.stringify(await ext.containerLogs(safeArgs.id || safeArgs.name, safeArgs));
  }
  if (tool === 'containercp') {
    return JSON.stringify(await ext.containerCp(safeArgs.src, safeArgs.dest));
  }
  if (tool === 'systemdf') return JSON.stringify(await ext.systemDf());
  if (tool === 'systemprune') return JSON.stringify(await ext.systemPrune(safeArgs));
  if (tool === 'imageprune') return JSON.stringify(await ext.imagePrune());
  if (tool === 'volumeprune') return JSON.stringify(await ext.volumePrune());
  if (tool === 'networkprune') return JSON.stringify(await ext.networkPrune());
  if (tool === 'networkcreate') {
    return JSON.stringify(await ext.networkCreate(safeArgs.name, safeArgs.driver));
  }
  if (tool === 'networkremove') {
    return JSON.stringify(await ext.networkRemove(safeArgs.name));
  }
  if (tool === 'volumecreate') {
    return JSON.stringify(await ext.volumeCreate(safeArgs.name, safeArgs.driver));
  }
  if (tool === 'volumeremove') {
    return JSON.stringify(await ext.volumeRemove(safeArgs.name));
  }
  if (tool === 'podlist') return JSON.stringify(await podman.listPods());
  if (tool === 'podstart') return JSON.stringify(await podman.podStart(safeArgs.name || safeArgs.id));
  if (tool === 'podstop') return JSON.stringify(await podman.podStop(safeArgs.name || safeArgs.id));
  if (tool === 'podremove') return JSON.stringify(await podman.podRemove(safeArgs.name || safeArgs.id));
  if (tool === 'secretlist') return JSON.stringify(await podman.listSecrets());
  if (tool === 'secretcreate') {
    return JSON.stringify(await podman.createSecret(safeArgs.name, safeArgs.data));
  }
  if (tool === 'secretremove') {
    return JSON.stringify(await podman.removeSecret(safeArgs.name || safeArgs.id));
  }
  if (tool === 'machineinfo') return JSON.stringify(await podman.machineInfo());
  if (tool === 'machinestart') return JSON.stringify(await podman.machineStart(safeArgs.name));
  if (tool === 'machinestop') return JSON.stringify(await podman.machineStop(safeArgs.name));
  if (tool === 'devcontainerup') {
    return JSON.stringify(await devc.devcontainerUp(root, safeArgs));
  }
  if (tool === 'devcontainerdown') {
    return JSON.stringify(await devc.devcontainerDown(root));
  }
  if (tool === 'devcontainerexec') {
    return JSON.stringify(await devc.devcontainerExec(root, safeArgs.command));
  }
  if (tool === 'devcontainergenerate') {
    const { readDevProfile } = require('./hooshDevProfile');
    const profile = await readDevProfile(root);
    return JSON.stringify(await devc.generateDevcontainerJson(root, { ...profile, ...safeArgs }));
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
  if (tool === 'flowresume') {
    if (!ctx.flowEngine) return JSON.stringify({ ok: false, error: 'Flow engine unavailable' });
    const run = await ctx.flowEngine.resume(safeArgs.runId || safeArgs.id, {
      approved: safeArgs.approved !== false,
      reason: safeArgs.reason,
      input: safeArgs.input
    });
    return JSON.stringify(run);
  }
  if (tool === 'flowinitexample') {
    return JSON.stringify(await initExampleFlow(root));
  }
  if (tool === 'credentiallist') {
    return JSON.stringify({ ok: true, credentials: await creds.listCredentials() });
  }
  if (tool === 'credentialsave') {
    const saved = await creds.saveCredential(safeArgs);
    return JSON.stringify({ ok: true, credential: saved });
  }
  if (tool === 'credentialdelete') {
    await creds.deleteCredential(safeArgs.id || safeArgs.name);
    return JSON.stringify({ ok: true });
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
  { name: 'stackConfig', description: 'Render resolved compose config YAML', inputSchema: { type: 'object', properties: { composeFile: { type: 'string' } } } },
  { name: 'registryLogin', description: 'Docker/Podman registry login', inputSchema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' }, server: { type: 'string' } }, required: ['username', 'password'] } },
  { name: 'registryLogout', description: 'Registry logout', inputSchema: { type: 'object', properties: { server: { type: 'string' } } } },
  { name: 'imageBuild', description: 'Build image from Dockerfile', inputSchema: { type: 'object', properties: { tag: { type: 'string' }, dockerfile: { type: 'string' }, context: { type: 'string' }, noCache: { type: 'boolean' } }, required: ['tag'] } },
  { name: 'imagePush', description: 'Push image to registry', inputSchema: { type: 'object', properties: { image: { type: 'string' } }, required: ['image'] } },
  { name: 'imageTag', description: 'Tag image', inputSchema: { type: 'object', properties: { source: { type: 'string' }, target: { type: 'string' } }, required: ['source', 'target'] } },
  { name: 'imageRemove', description: 'Remove local image', inputSchema: { type: 'object', properties: { image: { type: 'string' }, force: { type: 'boolean' } }, required: ['image'] } },
  { name: 'containerRun', description: 'Run detached container', inputSchema: { type: 'object', properties: { image: { type: 'string' }, name: { type: 'string' }, ports: { type: 'string' }, command: { type: 'string' }, env: { type: 'object' } }, required: ['image'] } },
  { name: 'containerLogs', description: 'Tail container logs', inputSchema: { type: 'object', properties: { id: { type: 'string' }, tail: { type: 'number' } }, required: ['id'] } },
  { name: 'containerCp', description: 'Copy files to/from container', inputSchema: { type: 'object', properties: { src: { type: 'string' }, dest: { type: 'string' } }, required: ['src', 'dest'] } },
  { name: 'systemDf', description: 'Docker system disk usage', inputSchema: { type: 'object', properties: {} } },
  { name: 'systemPrune', description: 'Prune unused docker data', inputSchema: { type: 'object', properties: { volumes: { type: 'boolean' } } } },
  { name: 'imagePrune', description: 'Prune dangling images', inputSchema: { type: 'object', properties: {} } },
  { name: 'volumePrune', description: 'Prune unused volumes', inputSchema: { type: 'object', properties: {} } },
  { name: 'networkPrune', description: 'Prune unused networks', inputSchema: { type: 'object', properties: {} } },
  { name: 'networkCreate', description: 'Create network', inputSchema: { type: 'object', properties: { name: { type: 'string' }, driver: { type: 'string' } }, required: ['name'] } },
  { name: 'networkRemove', description: 'Remove network', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'volumeCreate', description: 'Create volume', inputSchema: { type: 'object', properties: { name: { type: 'string' }, driver: { type: 'string' } }, required: ['name'] } },
  { name: 'volumeRemove', description: 'Remove volume', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'podList', description: 'List Podman pods', inputSchema: { type: 'object', properties: {} } },
  { name: 'podStart', description: 'Start Podman pod', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'podStop', description: 'Stop Podman pod', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'podRemove', description: 'Remove Podman pod', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'secretList', description: 'List Podman secrets', inputSchema: { type: 'object', properties: {} } },
  { name: 'secretCreate', description: 'Create Podman secret', inputSchema: { type: 'object', properties: { name: { type: 'string' }, data: { type: 'string' } }, required: ['name', 'data'] } },
  { name: 'secretRemove', description: 'Remove Podman secret', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'machineInfo', description: 'Podman machine status', inputSchema: { type: 'object', properties: {} } },
  { name: 'machineStart', description: 'Start Podman machine', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
  { name: 'machineStop', description: 'Stop Podman machine', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
  { name: 'devcontainerGenerate', description: 'Generate .devcontainer/devcontainer.json from hoosh.dev.yaml', inputSchema: { type: 'object', properties: {} } },
  { name: 'devcontainerUp', description: 'devcontainer up in project', inputSchema: { type: 'object', properties: { build: { type: 'boolean' } } } },
  { name: 'devcontainerDown', description: 'devcontainer down', inputSchema: { type: 'object', properties: {} } },
  { name: 'devcontainerExec', description: 'Run command in dev container', inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
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
  { name: 'flowResume', description: 'Resume flow run after human.approval', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, approved: { type: 'boolean' }, reason: { type: 'string' } }, required: ['runId'] } },
  { name: 'flowInitExample', description: 'Add sample workflow', inputSchema: { type: 'object', properties: {} } },
  { name: 'credentialList', description: 'List HTTP integration credentials', inputSchema: { type: 'object', properties: {} } },
  { name: 'credentialSave', description: 'Save encrypted credential for HTTP nodes', inputSchema: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, data: { type: 'object' } } } },
  { name: 'credentialDelete', description: 'Delete credential', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
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
