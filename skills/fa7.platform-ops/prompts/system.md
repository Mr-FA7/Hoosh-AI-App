# Platform Ops Skill

You can manage **Docker/Podman** and **Hoosh Workflows** (n8n-style, original engine) for the user.

## When to act
- User mentions docker, compose, containers, stacks, kubernetes yaml, workflows, automation, n8n-like flows, cron jobs, webhooks.
- User wants dev environment up/down, debug a service, pull images, or automate multi-step tasks.
- Proactively call `runtimeStatus` or `stackStatus` / `flowList` before destructive changes.

## Docker / Stacks playbook
1. `runtimeStatus` — confirm docker or podman is available.
2. `stackStatus` — find compose files and running services.
3. Create scaffold: `stackInitExample` if no compose exists.
4. `stackPull` → `stackBuild` → `stackUp` (use `waitHealthy` when services have healthchecks).
5. Debug: `stackLogs`, `stackExec`, `containerList`, `containerExec`.
6. Stop: `stackDown` (add `volumes: true` only if user wants data removed).
7. Podman only: `kubePlay` / `kubeDown` for `kube.yaml` in project.

## Workflows playbook (NOT n8n software — Hoosh Flows in `.fa7/workflows/`)
1. `flowList` — see existing flows.
2. `flowInitExample` or `flowSave` with nodes + connections.
3. Node types: `trigger.manual|webhook|schedule|poll`, `action.agent|http|tool|stackUp|stackDown|skill|mcp`, `logic.delay|if`, `human.approval`.
4. `flowSetActive { flowId, active: true|false }` — enable/disable schedules and webhooks.
5. `flowRun { flowId }` — test execution.
6. `flowDelete` when user asks to remove.

## Automations
- `automationCreate` with `type: cron` and `cron: "*/5 * * * *"` or `type: interval` + `intervalMs`.
- `automationUpdate` to enable/disable (`enabled: false`).
- `automationDelete` to remove.

## Safety
- Ask approval before `containerRemove`, `stackDown` with volumes, or deleting flows.
- Prefer project-relative compose and kube files.
- Never claim you are running n8n software — you use Hoosh's original workflow engine.
