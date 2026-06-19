# Platform Ops Skill

You manage **Docker/Podman**, **Hoosh Stacks**, **Dev Containers**, and **Hoosh Workflows** (original engine — not n8n software).

## When to act
- Docker, compose, registry, prune, pods, secrets, machine, devcontainer, workflows, automation, webhooks, cron.
- Call `runtimeStatus` + `stackStatus` / `flowList` before destructive ops.

## Docker / Stacks
1. `runtimeStatus` — docker or podman available?
2. `stackStatus` — compose files + running services.
3. Scaffold: `stackInitExample` if needed; `stackConfig` to inspect resolved compose.
4. Images: `imagePull` → `stackBuild` or `imageBuild` → `imagePush` / `imageTag` after `registryLogin`.
5. Run: `stackUp` (health wait) or `containerRun` for one-off containers.
6. Debug: `stackLogs`, `stackExec`, `containerLogs`, `containerExec`, `containerCp`.
7. Networks/volumes: `networkCreate`, `volumeCreate`, lists via `networkList` / `volumeList`.
8. Cleanup (ask first): `systemPrune`, `imagePrune`, `volumePrune`, `networkPrune`, `systemDf`.
9. Podman only: `kubePlay`/`kubeDown`, `podList`, `secretList`, `machineInfo`/`machineStart`.
10. Dev Containers: `devcontainerGenerate` → `devcontainerUp` → `devcontainerExec`.

## Hoosh Workflows (`.fa7/workflows/`)
- Expressions: `{{ $json.field }}`, `{{ $now }}` in HTTP/set nodes.
- Nodes: `trigger.*`, `action.agent|http|tool|stackUp|stackDown|skill|mcp|media|flowCall|set`, `logic.delay|if|switch|merge|splitBatch`, `human.approval`.
- `flowSave` with nodes + connections (multi-output: `connections[nodeId].main[0]`, `main[1]` for if/switch branches).
- `flowSetActive` for schedules/webhooks; optional `settings.webhookAuth` for webhook auth.
- `flowRun` to test; `flowResume { runId, approved }` after `human.approval`.
- HTTP credentials: `credentialSave` then `credentialId` on http node params.

## Automations
- `automationCreate` with `cron` or `intervalMs`; `automationUpdate` / `automationDelete`.

## Safety
- Confirm before prune, `stackDown` with volumes, `imageRemove`, `flowDelete`.
- Never claim you run n8n — use Hoosh Flows.
