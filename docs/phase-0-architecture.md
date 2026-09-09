# AI Hoosh — Phase 0 Architecture Correction

> **Status:** WAITING FOR REVIEW — **Phase 1 is not authorized.**
> **Date:** 2026-09-09
> **Rule:** Inspect existing codebase. Reuse what works. Do not rebuild. Do not start Phase 1 until this document is accepted.

This document is the corrected Phase 0 deliverable (A–O). It supersedes any proposal that assumed a greenfield Next.js/Tauri rewrite or merged Skills / MCP / Tools / Extensions into one concept.

---

## خلاصهٔ مدیریتی

Hoosh امروز یک IDE/agent واقعی است، نه یک mockup:

- Electron + React/Vite + companion Express + `AgentKernel`
- مدل‌ها همین حالا از **Ollama** و **LM Studio** می‌آیند (`lib/llmGateway.js`؛ پیش‌فرض `ollama`، LM Studio روی `127.0.0.1:1234`)
- ابزارها در `kernel.executeTool` اجرا می‌شوند؛ UI شِل/فایل را مستقیم اجرا نمی‌کند
- Skills، MCP، Extensions، و Native Tools از قبل جدا هستند — ولی قرارداد واحد Tool Registry ندارند
- Permission در kernel وجود دارد؛ ولی خیلی از routeهای companion بدون آن بازند
- Firebase فقط Auth UI است، دیتابیس برنامه نیست

**تصمیم اصلی:** هسته را سفت کن، بازنویسی نکن.

**مرز طلایی که تا آخر پروژه باید بماند:**

```
AGENT → MODEL GATEWAY → TOOL REGISTRY → PERMISSION ENGINE → SANDBOX → EXECUTOR → OS / BROWSER / NETWORK
FRONTEND observes and controls the runtime. Frontend is never the security boundary.
```

مدل‌های agent از **Ollama** و **LM Studio** تأمین می‌شوند. ابر (OpenAI / Anthropic / OpenRouter) آداپتور اختیاری است، نه مسیر پیش‌فرض.

---

## 0. Architecture audit of what already exists

### Current topology

```
Electron (optional)          Vite UI :5173 / dist
        │                              │
        │  in-process require          │  HTTP /api  +  PTY WS
        └──────────► companion.js :3001  (Express, AgentKernel inside)
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
         llmGateway     executeTool     node-pty
         Ollama         toolApproval    Kavosh / Playwright
         LM Studio      MCP / skills    VM Lab / stacks
```

Hosted web (`server.js`) is a static SPA. Local power requires companion + optional Chrome/Firefox bridge.

### Existing technologies (keep)

| Layer | Today | Decision |
|-------|--------|----------|
| Desktop | Electron 41 | **Keep.** Tauri is a later optional shell, not a rewrite. |
| Web UI | React 19 + TS + Vite 8 | **Keep.** No Next.js. |
| Backend | Node + Express `companion.js` | **Keep and modularize.** This is the trusted runtime. |
| Agent | `kernel.js` `AgentKernel` | **Keep.** This is the runtime. |
| Models | `lib/llmGateway.js` | **Keep.** Default Ollama + LM Studio. |
| Editor | Monaco | **Keep.** |
| Terminal | xterm + node-pty | **Keep.** |
| Auth UI | Firebase email/password | **Keep as account gate only.** |
| i18n | EN + FA / RTL | **Keep and enforce.** |

### Reuse / extend / refactor / missing

| Area | Verdict | Anchor |
|------|---------|--------|
| Agent loop + `executeTool` | Reuse | `kernel.js` |
| LLM gateway (Ollama, LM Studio, optional cloud) | Reuse / extend | `lib/llmGateway.js` |
| MCP client | Reuse / extend | `lib/mcpManager.js` |
| Tool approval + modal | Extend into a hard boundary for **all** side effects | `lib/toolApproval.js` |
| Skills S1 + prompt skills | Extend; keep distinct from MCP | `lib/skillManager.js`, `skills/` |
| VS Code-style extensions | Extend inside sandbox | `lib/extensionSandbox.js` |
| FA7 unsandboxed plugins | Refactor or freeze | `fa7-plugins/` |
| Dual tool schemas | Refactor into one registry | `agentToolSchemas.js` vs `lmToolProtocol.js` |
| `AIPanel.tsx` / `App.tsx` god-files | Refactor (extract shell) | `src/` |
| Typed event bus + AgentRun | **Add** on top of sessions | `agentSessions.js`, `agentActionHub.js` |
| Companion authz + bind localhost | **Add** | `companion.js` |
| Native emergency stop | **Add** | — |
| OS computer-use | Interface only until a later phase | browser agent already exists |
| Firebase as app DB | **Reject** | Auth only |

### What the previous prompt got wrong

1. Treating Hoosh as greenfield. It is not.
2. Assuming Next.js must power desktop. SSR adds nothing to a local agent OS.
3. Merging Skill / MCP / Tool / Extension. The code already distinguishes them; the architecture must keep them distinct.
4. Putting security in React. Approvals are UI; enforcement must stay in companion/kernel and cover HTTP routes that currently bypass the kernel.
5. Defaulting to Firebase for data. Firebase is an account lock, not a product database.
6. Ignoring that **Ollama and LM Studio are the actual model sources**.

---

## A. Final architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  DESKTOP SHELL (Electron)     WEB SHELL (Vite SPA)              │
│  window chrome, emergency-stop accelerator, keychain            │
└───────────────────────────────┬─────────────────────────────────┘
                                │  Application API (typed IPC/HTTP)
                                │  Frontend never executes OS effects
┌───────────────────────────────▼─────────────────────────────────┐
│  APPLICATION API  (companion routes, to be domain-split)        │
│  observes: UI commands, approvals, layout, settings             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌───────────────┐     ┌─────────────────┐      ┌─────────────────┐
│ Model Gateway │     │ Agent Runtime   │      │ Event Bus       │
│ Ollama        │◄───►│ Agent / Run /   │─────►│ typed events    │
│ LM Studio     │     │ Thread / Task   │      │ correlation IDs │
│ optional cloud│     └────────┬────────┘      └─────────────────┘
└───────────────┘              │
                               ▼
                      ┌─────────────────┐
                      │ Tool Registry   │  native | mcp | skill-script | extension
                      └────────┬────────┘
                               ▼
                      ┌─────────────────┐
                      │ Permission      │  HARD BOUNDARY
                      │ Engine          │  LLM cannot skip
                      └────────┬────────┘     UI is not final authority
                               ▼
                      ┌─────────────────┐
                      │ Sandbox Engine  │  where it may run
                      └────────┬────────┘
                               ▼
                      ┌─────────────────┐
                      │ Executors       │  fs / terminal / browser / computer / mcp
                      └─────────────────┘
```

Invariant: every side-effecting capability — including companion HTTP that today skips the kernel — must enter through Tool Registry → Permission Engine → Sandbox → Executor.

---

## B. Responsibility matrix

For each subsystem: owns / does not own / APIs / callers / never-callers.

| Subsystem | Owns | Does not own | Exposes | May call | Must never call it directly |
|-----------|------|--------------|---------|----------|-----------------------------|
| **Desktop Shell** | Window, OS accelerators, emergency-stop hotkey, keychain bridge | Agent logic, tools, models | `shell.quit`, `shell.emergencyStop`, `shell.secureStorage` | Application API | Frontend React (except via API) |
| **Web Application** | Hosted SPA, account gate, bridge discovery | Local fs/shell/browser automation | Static app + auth | Companion via bridge | Executors |
| **Frontend** | Layout, i18n, editor chrome, conversation rendering, approval UX | Security decisions, tool execution, model HTTP | Commands / subscriptions | Application API, Event Bus (observe) | Permission Engine internals, Executors, Model SDKs |
| **Agent Runtime** | Agent definition, AgentRun loop, planning/acting | Model HTTP, permission verdicts, OS I/O | `agent.start/pause/cancel`, run inspect | Model Gateway, Tool Registry, Event Bus | Executors, raw provider SDKs |
| **Agent Orchestrator** | Multi-run, subagents, merge | Single-run internals | `orchestrator.spawn` | Agent Runtime | Executors |
| **Model Gateway** | Provider adapters, stream, cancel, retry, usage | Tool execution, routing policy storage UI | `gateway.chat`, `gateway.embed`, `gateway.abort` | Ollama, LM Studio, optional cloud | Filesystem, shell |
| **Tool Registry** | Unified ToolDefinition catalog and resolution | Permission, sandbox | `registry.resolve`, `registry.list` | Native/MCP/Skill/Extension catalogs | OS |
| **Permission Engine** | Policy eval, approval tickets, deny-by-default | How a tool runs | `permission.evaluate`, `permission.respond` | Persistence, Event Bus | Model Gateway (models must not decide) |
| **Sandbox Engine** | Isolation placement (workspace, docker, vm, none) | Policy, tool semantics | `sandbox.place(execution)` | Host APIs | Frontend |
| **Filesystem Service** | Read/write/patch inside allowed roots | Policy | Executor API | OS fs | Frontend, LLM |
| **Terminal Service** | PTY + exec | Policy | Executor API | node-pty / shell | Frontend |
| **Browser Service** | Tabs, navigate, observe, act | Policy | Observation + Action APIs | Playwright / Kavosh / extension | Frontend DOM of user machine |
| **Computer Use Service** | Observe/propose/execute OS GUI actions | Policy | Observation + Action APIs | OS automation (future) | Agent (must go through permission) |
| **MCP Client** | Server identity, transport, tool/resource lists | Hoosh permission | `mcp.call` via registry | MCP servers | Executors that skip registry |
| **Skills Runtime** | Load SKILL.md/manifest, inject instructions, run declared scripts | Being a tool provider of record | `skills.activate`, `skills.match` | Tool Registry (to *use* tools) | OS |
| **Extension Runtime** | UI contributions, commands, extra tools/skills/MCP | Unrestricted Node | sandboxed `vscode`-like API | Registry, Frontend contributions | Kernel internals |
| **Workflow Engine** | Graph of steps, pause/resume | Agent loop | `workflow.start/pause` | Agent Runtime, Event Bus | Executors |
| **Memory Service** | Inspectable memory stores by scope | Secrets | `memory.get/put/delete` | Persistence | Model (write without policy) |
| **Artifact Service** | Versioned artifacts | Editor buffers | `artifact.create/list` | Persistence | — |
| **Task Service** | Task graph, status | Tool I/O | `task.create/update` | Event Bus | — |
| **Event Bus** | Typed events, correlation | Business logic | `bus.publish/subscribe` | Everyone (publish allowed types) | — |
| **Persistence Layer** | SQLite + files | Cloud identity | repositories | Local disk | Firebase (as source of truth) |
| **Cloud Sync** | Optional encrypted replica | Local authority | `sync.push/pull` | Persistence | Runtime executors |
| **Authentication** | Identity session | Authorization of tools | `auth.user` | Firebase / later providers | Companion power APIs (until companion has its own token) |
| **Billing** | Entitlements, usage rollups | Execution | `billing.report` | Usage events | Runtime hot path |
| **Marketplace** | Listings, install UX, signatures | Granting permissions | `market.install` | Skill/Extension runtimes | Permission Engine (install ≠ grant) |

---

## C. Data model

Do not implement the full catalog blindly.

### v1 (local SQLite + existing JSON, first persistence cut)

| Entity | v1 | Store | Notes |
|--------|----|-------|-------|
| User (account) | yes | Firebase Auth | Identity only |
| Workspace / Project | yes | companion project root + metadata table | Already exists as path |
| ProjectInstruction | yes | files in repo (`.fa7/rules`, instructions) | Version-controlled |
| Agent | yes | SQLite | Reusable definition |
| AgentVersion | later | — | Pin later |
| AgentRun | **yes** | SQLite | First-class execution |
| Thread | yes | SQLite (replace chat localStorage) | Conversation |
| Message | yes | SQLite | No private CoT |
| Task | yes | SQLite | Unit of work |
| Tool (catalog) | yes | code + SQLite cache | Registry snapshot |
| ToolExecution | **yes** | SQLite | Replay |
| PermissionPolicy | yes | SQLite + migrate `tool-approval.json` | |
| PermissionRequest | yes | SQLite | Tickets |
| Skill / SkillVersion | yes | manifests on disk + install table | Already `skill-installs.json` |
| Extension | partial | existing marketplace install dir | |
| MCPServer / MCPTool | yes | `mcp.json` + registry cache | |
| Artifact / ArtifactVersion | later (interface now) | files | |
| Memory | yes | `.fa7/memory.json` then SQLite | Inspectable |
| Provider / Model | yes | `providers.json` via gateway | Ollama + LM Studio first |
| UsageEvent | yes | SQLite | Attach run/model/tool |
| AuditEvent | yes | `.fa7/audit.log` → SQLite | Already JSONL |
| Notification | later | — | |
| Workflow / WorkflowRun | later | existing flows stay as-is | |
| Organization, BillingAccount, Subscription, MarketplaceListing/Review, Automation, SecretReference | **future** | — | Interfaces only |

### Explicitly not v1

Organization, billing, marketplace reviews, automations scheduler productization, cloud collaboration, SecretReference as a cloud vault.

Secrets stay in OS keychain / `secretStore.js`. Never in SQLite plaintext. Never in prompts unless authorized.

---

## D. Event model

Every event:

`id, timestamp, workspace, project, actor, agentRunId, type, payload, correlationId`

### v1 event types

```
agent.run.started | paused | completed | failed | cancelled
task.created | started | completed
tool.requested | started | completed | failed
permission.requested | approved | denied
diff.created | accepted | rejected
artifact.created
browser.action
computer.action          # interface; no OS executor in Phase 1
workflow.started | completed
```

Rules:

- Frontend subscribes. Runtime publishes.
- Do not put chain-of-thought in events.
- Redact secrets in payloads.
- Existing `agentActionHub.js` SSE becomes a **transport** for this bus, not a second event language.

---

## E. Tool model

Four **concepts** stay distinct. One **contract** unifies execution.

### Four concepts

| Concept | What it is | What it is not | Example |
|---------|------------|----------------|---------|
| **Native Tool** | Built into Hoosh | A skill, an MCP server | `filesystem.read`, `terminal.execute`, `browser.open` |
| **MCP Tool** | Provided by an MCP server | A skill | `github.create_issue` |
| **Skill** | Instructional/capability package: prompts, scripts, resources, declared tools | An MCP server, an extension | `fa7.python-expert` |
| **Extension** | Package that extends Hoosh itself (UI, commands, tools, skills, MCP, workflows) | A skill | theme, panel, extra command |

A Skill **may use** Native Tools, MCP Tools, scripts, resources, prompts. A Skill is not itself a tool provider of record; its scripts run as tool executions under the Skill’s granted permissions.

### Unified contract (all executable capabilities)

```
ToolDefinition
  id, name, description
  provider: native | mcp | skill-script | extension
  inputSchema, outputSchema
  riskLevel: low | medium | high | critical
  requiredPermissions[]
  executionEnvironment: workspace | sandbox | browser | os | mcp
  timeout
  supportsStreaming, supportsCancellation

ToolExecution
  executionId, toolId, agentRunId
  input, output, status
  startedAt, completedAt, error
  permissionDecisionId
```

The Agent Runtime asks the Tool Registry. It does not know or care which provider class produced the tool. MCP tools still pass through the same Permission Engine. Never bypass.

Today: two schema lists (`agentToolSchemas.js`, `lmToolProtocol.js`) + MCP ids `server:tool`. Phase after shell: one registry wrapping these sources. Do not rewrite working `executeTool` in Phase 1.

---

## F. Permission model

Mandatory pipeline:

```
Agent → Tool Request → Permission Engine → Policy Evaluation
      → Approval if required → Sandbox / Execution Layer → OS / Network / Browser
```

Hard rules:

1. The LLM cannot bypass Permission Engine.
2. The frontend is never the final authority.
3. YOLO / auto-approve is a **policy**, still evaluated in the engine, still audited.
4. Companion HTTP side effects (`/api/v3/terminal/exec`, file write, stacks, vault) must go through the same engine or an equivalent trusted gate. Today many routes skip `executeTool`. That is the highest-priority security debt.
5. Install ≠ Grant ≠ Activate (already true for Skills; keep it).
6. Untrusted projects get reduced permissions.
7. Deny by default for write, terminal, MCP, computer-use, secrets, network-outside-policy.

Computer-use and browser actions carry: action id, agent run id, risk, permission decision, result, timestamp.

---

## G. Agent runtime model

Distinct entities:

```
Agent              reusable definition ("Senior React Developer")
  └─ AgentRun      one execution (#123)
       └─ Thread   conversational context (#456)
            └─ Task     unit of work (#789)
                 └─ ToolCall  one execution (#001)
```

Loop (already approximately in `kernel.executeAutonomousLoop`):

Understand → Plan → Task graph → Tool execution → Observe → Verify → Fix → Artifact → Final response

Run history / replay (safe):

- prompts (redacted), context inventory, plan, tasks, tool calls, approvals, results, artifacts, errors, outcome
- **Never** private chain-of-thought
- UI reconstructs from AgentRun + ToolExecution + events

Emergency stop (must not depend on React):

- Desktop accelerator + companion local endpoint + in-process abort registry
- Cancels: model streams, tool executions, child processes, PTY, browser automation, computer-use, queued actions, pauses workflows
- Must work if the UI is frozen
- Today: `streamRegistry` + `/api/ai/chat/abort` + UI Stop. Insufficient as an OS-level stop. Add native/runtime stop **after** shell, as a runtime interface in Phase 1 (wired to existing abort; full process kill in a later phase).

Parallel agents and subagents: architecture-ready via Orchestrator; product UI later. Do not fake an agent grid in Phase 1.

---

## H. Browser architecture

```
Browser Agent → Browser Service → Browser Policy → Browser Runtime
                                         (Playwright / Kavosh / extension)
```

Separate:

- **Observation** (DOM summary, screenshot, URL, console) — untrusted content
- **Action proposal** (click, type, navigate)
- **Policy** (domain allow/deny, JS, download/upload, secrets)
- **Execution**

Chrome extension is **not** the security boundary:

```
Chrome / Firefox extension  ↔️  Secure Local Bridge  ↔️  Hoosh Runtime
```

Extension must: show connection state, require permission, allow disconnect, limit domains, never expose secrets, never accept unrestricted remote commands.

Existing: `kavoshBrowserKernel.js`, `browserAgentLoop.js`, `extensions/hoosh-local-bridge*`. Keep. Do not implement new browser automation in Phase 1.

---

## I. Computer-use architecture

Not `AI → mouse.click()`.

```
Observation → Action Proposal → Policy Check → Risk Classification
          → Approval if required → Execution → Observation
```

`ComputerObservation`: screenshot, activeWindow, application, cursorPosition, timestamp  
`ComputerAction`: move, click, doubleClick, rightClick, type, keyPress, scroll, drag, hotkey  
Every action: id, agentRunId, risk, permission decision, result, timestamp

Phase 1: **interface only**. No OS mouse control. Browser Playwright loop is the existing related capability and stays behind Browser Policy, not this OS layer.

---

## J. Security model

### Trust levels for context (prompt injection defense)

`SYSTEM > TRUSTED > USER > PROJECT > TOOL > EXTERNAL > UNTRUSTED`

External = websites, repos, documents, emails, browser pages, tool outputs.

`ContextItem { source, trustLevel, content, timestamp }`

Never merge untrusted text into system instructions.

### Skill security

Each skill declares: permissions, required tools, network, filesystem, scripts, dependencies. Install shows this **before** grant/activate. Already started in S1/S3. Keep.

### MCP security

Identity, connection, auth, tool/resource lists, permissions, trust status. Tools still go through Registry + Permission Engine.

### Companion threat model (current hole)

Companion listens on `0.0.0.0` without auth. Firebase AuthGate is UI-only. LAN or a compromised page talking to the bridge can hit shell/fs.

Correction (not Phase 1 feature work, but a required interface):

- Bind default `127.0.0.1`
- Companion token / pairing for bridge
- All mutating routes through permission gate

### Secrets

OS keychain / `secretStore`. Never log. Never send to the model unless explicitly required and authorized.

---

## K. Local / cloud data boundary

Hoosh must work when cloud is unavailable.

| Local (source of truth) | Cloud (optional) |
|-------------------------|------------------|
| Projects, files, settings | Account identity |
| Agent runs, threads, tasks | Billing (future) |
| Terminal sessions | Marketplace listings (future) |
| Local artifacts | Org / collaboration (future) |
| Local memory | Optional encrypted sync |
| Ollama / LM Studio models | Optional cloud model adapters |
| Permissions, audit log | — |

Modes: Local Only (default) · Cloud Sync (later) · Encrypted Sync (later)

Firebase stays **account**, not workspace DB.

---

## L. Technology decision matrix

### L1. Desktop: Electron vs Tauri vs Next.js

| Criterion | Electron + React + Vite (current) | Tauri v2 + React + Vite | Tauri v2 + Next.js |
|-----------|-----------------------------------|-------------------------|---------------------|
| Startup / bundle | Heavier | Better | Worse (SSR runtime unused) |
| Filesystem / PTY / Node | Native today (`node-pty`, companion in-process) | Needs Rust sidecar rewrite | Same plus SSR noise |
| IPC | HTTP + WS already | Would redo | Would redo |
| SSR | Not needed | Not needed | **No value** for local agent OS |
| Browser automation | Playwright in Node — works | Extra glue | Extra glue |
| Maintainability | Team already ships this | High migration cost | Highest cost, least fit |

**Decision:** Keep **Electron + React + TypeScript + Vite + Node companion**.  
**Reject Next.js** for desktop and for the local runtime. Use a server framework later only if a real cloud control-plane needs SSR/SEO — not the workspace.  
**Tauri:** allowed as a *future second shell* once Application API is stable. Not Phase 1–6. Migrating now would be a rewrite (forbidden).

### L2. Models

| Provider | Role |
|----------|------|
| **Ollama** | Primary local. Default. Managed runtime already exists. |
| **LM Studio** | Primary local OpenAI-compat (`127.0.0.1:1234`). Keep first-class. |
| llama.cpp server | Optional local compat |
| OpenAI / Anthropic / OpenRouter / catalog | Optional adapters, user-enabled, never silent fallback that changes privacy |

Agent Runtime talks only to **Model Gateway**. Routing modes: Manual · Automatic (local-first) · Policy (later org).

Factors: capability, cost, speed, context, **privacy**, availability. Silent cloud failover is forbidden unless the user configured it.

### L3. Database

| Option | Offline | Relational | Auth | Self-host | Fit |
|--------|---------|------------|------|-----------|-----|
| Firebase as app DB | Weak | Weak | Strong | No | **Reject** for product data |
| Supabase/Postgres | Needs net | Strong | Strong | Possible | Future cloud control-plane |
| Custom Postgres | Needs net | Strong | DIY | Yes | Future multi-user server |
| **SQLite + files + optional sync** | **Best** | Enough | Pair with existing auth | Yes | **v1** |

**Decision:** SQLite (extend existing `node:sqlite` FTS) + JSON/files during migration + Firebase Auth only. Not Firebase Firestore. Not a mandatory Postgres.

### L4. State

| Kind | Lives in | Examples |
|------|----------|----------|
| **UI state** | React / small Zustand | sidebar, theme, panels, editor tabs |
| **Application state** | Persistence + thin client cache | projects, threads, agents, tasks |
| **Runtime state** | companion / kernel | AgentRun, tool calls, permissions, browser, PTY, computer-use |

React **observes** runtime events. Do not put the agent loop in Zustand.

---

## M. Final folder structure

Do not create a parallel app. Extract toward this layout **incrementally**. Existing files stay until moved with tests.

```
src/
  auth/                 # keep
  i18n/                 # keep
  components/           # existing views (migrate gradually)
  ui/                   # Phase 1: design-system primitives (extract, don’t duplicate)
  shell/                # Phase 1: AppShell, TopBar, rail, workspace, agent pane, bottom, overlays
  state/
    uiStore.ts          # layout only
    appStore.ts         # projects/threads (client cache)
    runtimeSubscriptions.ts  # observe events; no execution
  hoosh/                # keep agentService until runtime client is extracted

companion.js            # keep entry; continue splitting companion*.js
kernel.js               # keep AgentKernel
lib/
  llmGateway.js         # Model Gateway (keep)
  toolApproval.js       # Permission Engine core (keep, widen)
  skillManager.js       # Skills Runtime (keep)
  mcpManager.js         # MCP Client (keep)
  sandboxRunner.js      # Sandbox Engine (keep)
  # add, do not replace:
  toolRegistry.js       # unified catalog wrapping existing schemas
  eventBus.js           # typed bus; agentActionHub as transport
  agentRunStore.js      # AgentRun records
  emergencyStop.js      # runtime-level cancel

skills/                 # first-party skills (keep)
extensions/             # local bridge (keep)
fa7-plugins/            # freeze unsandboxed API
docs/                   # this file + hoosh-audit.md
```

No `apps/web` Next.js tree. No `src-tauri` until a future shell decision.

---

## N. Phase 1 implementation plan (small, real, no fake agents)

Phase 1 is **not** a new product. It is extracting a strong shell on the existing app.

### In scope

1. **Design system extraction** from `src/index.css` + repeated inline styles  
   Tokens: color, type, space, radius, motion.  
   Real primitives: Button, Input, Menu, Dialog, Tooltip, Tabs, Panel, Notice.  
   Command Palette: Cmd/Ctrl+K, fuzzy jump to **existing** views/commands (Home, Editor, Terminal, Git, Settings, …).  
   i18n: no new hardcoded English.

2. **Application shell** with real behavior  
   Top bar, left rail, center workspace, right agent panel, bottom panel, overlays.  
   Collapse / expand / resize / maximize / restore. Remember layout.  
   Keep existing views mounted behind the shell (do not delete Marketplace, VM Lab, etc.).

3. **Core navigation** to existing surfaces  
   Workspace/project, agents (existing sessions), tasks (existing if any), artifacts (interface), skills, MCP, extensions, settings.  
   Empty states that are real (not “coming soon” fake data).

4. **State architecture**  
   Split UI vs app vs runtime-observation.  
   Wire Agent panel to **real** message state (existing chat).  
   Tabs already exist — make shell tabs consistent.

5. **Architectural interfaces (stubs that are real types, not fake UIs)**  
   `ToolRegistry.list()` wrapping current tools.  
   `PermissionEngine.evaluate()` wrapping `toolApproval`.  
   `EmergencyStop.request()` wrapping current abort + documenting process-kill gap.  
   `ComputerUse` types only.  
   Model Gateway already exists — expose routing modes in settings if cheap; do not rebuild providers.

### Out of scope for Phase 1

- Real OS computer control
- New browser automation
- Marketplace rebuild
- Billing
- Complex new agent loop
- Next.js / Tauri
- Firebase Firestore
- Fake terminals, fake tool cards, fake approvals

### Definition of done

- Existing app still boots; smoke tests still pass
- Shell panels actually open/close/resize
- Command palette actually navigates
- Agent panel still streams real models from **Ollama / LM Studio**
- No screenshot-only screens
- Document files changed, tests, remaining, risks
- **Then STOP**

---

## O. Risks and trade-offs

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| Companion unauthenticated on `0.0.0.0` | Local RCE-class | Bind localhost; pair bridge; gate mutating routes |
| Routes bypass `executeTool` | Permission is not actually a hard boundary | Widen engine to HTTP side effects |
| Dual tool schema lists | Drift, missing MCP in one path | Registry wrapper |
| Unsandboxed `fa7-plugins` | Full Node | Freeze API; prefer extension sandbox |
| Electron weight vs Tauri | Perf/security narrative | Accept for now; stable API enables a later shell |
| Firebase Auth vs local-first | Hosted web needs account; desktop should work offline | Keep gate for hosted; companion must not depend on Firebase |
| YOLO mode | Looks like bypass | Still engine-evaluated + audited |
| Putting runtime in React during shell extract | Repeats the original sin | Observe events only |
| Prompt wants hundreds of features | Rewrite pressure | Phase 1 is shell only |
| Cloud model adapters | Privacy surprise | Local default; no silent cloud failover |
| Audit doc stale (plaintext keys) | Wrong mental model | `secretStore.js` encrypts; this doc is current |

### Trade-off accepted

We keep Electron + companion monolith-with-mounts instead of a fashionable rewrite. Correctness and security boundaries beat framework novelty. The product already has an agent, tools, MCP, skills, terminal, browser, and local models. The failure mode is **unbounded surface area**, not missing screens.

---

## Final principle (locked)

```
AGENT → MODEL GATEWAY (Ollama, LM Studio, optional cloud)
      → TOOL REGISTRY
      → PERMISSION ENGINE
      → SANDBOX
      → EXECUTOR
      → OS / BROWSER / NETWORK

FRONTEND observes and controls the runtime.
FRONTEND is never the security boundary.
```

**STOP.** Phase 1 starts only after this correction is reviewed and authorized.
