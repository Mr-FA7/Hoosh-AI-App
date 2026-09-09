# AI Hoosh — FINAL ARCHITECTURE v2

> **Status:** Architecture accepted · Phases 0–16 executed under Full Expansion plan (2026-09-09).  
> **Date:** 2026-09-09  
> **Supersedes:** `docs/phase-0-architecture.md` where they conflict. Phase 0 audit facts remain valid; product topology and phase plan are revised here.  
> **Inputs:** Master Expansion Directive (Free Local-First Agent Platform) · existing Hoosh codebase · Cursor Agents product patterns (ideas only) · DeepSeek Harness / Ruflo patterns (ideas only; no Cordis/brand rewrite)  
> **Rule:** Phase reports in `docs/phase-N-report.md`.

---

## 0. Product definition (locked)

AI Hoosh is **not** an inference seller, subscription chatbot, or model lab.

AI Hoosh **is**:

> **FREE, LOCAL-FIRST, MODEL-AGNOSTIC AI AGENT PLATFORM**  
> Environment + orchestration + tools + runtime + workflows + browser/computer automation + skills + marketplace + DX.  
> **The user brings the intelligence** (Ollama, LM Studio, llama.cpp, vLLM, OpenAI-compatible, Anthropic-compatible, cloud APIs, enterprise endpoints).

**Differentiator:** *Bring your own intelligence.*  
Hoosh competes at **orchestration + environment + agent + tool + automation**, not foundation models.

**Non-negotiable:**

- Core app remains free (no forced Hoosh tokens / card gate for core).
- Frontend is never the security boundary.
- One universal Agent Runtime contract for Web, CLI, Workflow, API, Rooms, Marketplace agents.
- Skills ≠ MCP ≠ Extensions ≠ Tools (four distinct concepts).
- Local-first: cloud is optional; offline core must work where technically possible.

---

## 1. First-principles re-evaluation

### What the Expansion Directive changes

Phase 0 assumed: **Electron shell + companion on the same machine** as the primary product.

Expansion requires: **Web Control Plane + Hoosh Local Runtime** with pairing, multi-computer, Model Hub, Agent Rooms, n8n-like workflows, Docker first-class, privacy modes, CLI/API surface — without rewriting the working agent core.

### What already exists (do not discard)

| Piece | Reality | Role in v2 |
|-------|---------|------------|
| `companion.js` + `kernel.js` | Local Express runtime + `AgentKernel` | **Becomes Hoosh Local Runtime** (harden + split; do not greenfield) |
| `lib/llmGateway.js` | Ollama / LM Studio / optional cloud | **Model Gateway** (productize as Model Hub UX) |
| Vite React SPA + Electron | UI + optional desktop shell | **Control Plane UI** (+ optional tray shell) |
| Local bridge extension | Hosted web → localhost companion | **Evolve into authenticated pairing** |
| `scripts/hoosh-cli.js` | Thin HTTP client | **Evolve into `hoosh` CLI** |
| Skills / MCP / flows / stacks / marketplace | Real, uneven polish | **Keep; productize under clear nav** |
| Firebase Auth | Account gate only | **Keep Auth-only**; never app DB |
| Permission / sandbox / audit | Partial hard boundary | **Widen to all side effects + presets** |

### What is missing (real gaps)

1. Device identity, pairing, revocation, capability negotiation  
2. Multi-runtime (multiple computers) assignment  
3. Companion bind/auth (today: powerful localhost API without pairing token)  
4. Model Hub product surface (gateway exists; hub UI does not)  
5. Agent Rooms + structured A2A messaging  
6. First-class graph workflow product (flows exist; not n8n-class editor)  
7. Unified Connections manager  
8. Offline / privacy mode chrome as first-class UX  
9. Versioned Runtime ↔ Web capability negotiation  

---

## 2. Target topology (v2)

```
                         ┌──────────────────────────────┐
                         │  ACCOUNT (optional for pure  │
                         │  local desktop; required for │
                         │  multi-device / hosted web)   │
                         └──────────────┬───────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────────────┐
│  HOOSH CONTROL PLANE (Web SPA — Vite/React; also served from Electron shell)  │
│  UI · projects · threads · agents · rooms · workflows · marketplace · models  │
│  connections · computers · settings · monitoring                              │
│  NEVER executes OS side effects directly                                      │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                    Secure channel (pairing + auth + scopes)
                    localhost HTTPS/WSS preferred · optional relay later
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ Hoosh Runtime A  │        │ Hoosh Runtime B  │        │ Hoosh Runtime C  │
│ (this Mac)       │        │ (Windows PC)     │        │ (Linux server)   │
│ companion/kernel │        │ same contracts   │        │ headless daemon  │
└────────┬─────────┘        └────────┬─────────┘        └────────┬─────────┘
         │                           │                           │
         ▼                           ▼                           ▼
   FS · Terminal · Git · Docker · Browser · MCP · Skills · Local LLMs · …
```

**Invariant (unchanged from Phase 0, now spans devices):**

```
TRIGGER → AGENT / WORKFLOW → TASK → TOOL REGISTRY
        → PERMISSION ENGINE → SANDBOX → EXECUTOR → DEVICE OS
FRONTEND / CONTROL PLANE observes and directs.
FRONTEND is never the security boundary.
```

---

## 3. Answers to the twenty required questions

### 1. Is Tauri still necessary if the main product is web-based?

**No — not for v2.**  
Control Plane is a **Vite/React SPA**. Desktop packaging is optional:

- **Electron** remains the shipping desktop shell (already works with companion in-process / local).
- **Tauri** is a *future alternate shell* only after Application/Runtime APIs are stable. Migrating now is a forbidden rewrite.
- Headless servers run **Runtime only** (no Tauri/Electron).

### 2. What exactly should Hoosh Local Runtime be?

**The evolved, authenticated form of today’s companion + kernel**, not a new product.

Name: **Hoosh Runtime** (`hoosh-runtime` process / service).

Responsibilities:

- Agent Runtime (`AgentKernel` contracts)
- Model Gateway client to local/cloud providers user configured
- Tool Registry + Permission + Sandbox + Executors
- Device capability advertisement
- Pairing / session credentials
- CLI target (`hoosh …`)
- Optional tray GUI (status, permissions, doctor)

Install shapes: user daemon, CLI, tray, Windows service / launchd / systemd later.

### 3. How should the browser securely communicate with it?

**Evolve the existing local bridge; do not leave open localhost.**

Minimum secure path:

1. Runtime binds **`127.0.0.1` only** by default (not `0.0.0.0`).
2. **Pairing**: one-time code / QR → Control Plane issues device record → Runtime stores **device secret**.
3. Every request: **short-lived token** (device session) + **origin allowlist** + **capability scopes**.
4. Transport: HTTPS localhost or secure WebSocket to Runtime; bridge extension becomes a **credentialed proxy**, not an open pipe.
5. Revocation: Control Plane / Runtime can invalidate device sessions.
6. Future multi-LAN/remote: optional authenticated relay; never “unrestricted local HTTP”.

Native messaging / WebTransport are evaluation options; **v2 default is authenticated localhost + paired bridge**.

### 4. What language should the runtime use?

**TypeScript / Node.js** — keep and modularize the existing runtime.  
This preserves node-pty, Playwright/Kavosh, MCP stdio, Electron packaging, and current skill/MCP ecosystems.

### 5. Which components belong in Rust?

**Optional later, not v2 core:**

- Hardened OS sandbox helpers (Seatbelt/Landlock wrappers) if/when invested
- Small native keychain / tray helpers if Node bindings are insufficient

Do **not** rewrite Runtime, Agent loop, or Model Gateway in Rust for v2.

### 6. Which components belong in TypeScript?

**Almost everything in v2:** Control Plane UI, Runtime, CLI, Model Gateway adapters, Workflow engine, Rooms orchestrator, MCP/skills, Docker/stacks tooling, permission engine.

### 7. Is Python actually necessary?

**No for core.** Optional later for niche scientific skills or user-installed Python MCP servers. Do not make Python a hard dependency of Runtime.

### 8. How should Ollama and LM Studio integrate?

**First-class Model Gateway adapters** (already largely true):

- Dynamic discovery (no hardcoded model name lists in UI)
- Health, stream, tool-calling where available, pull/remove for Ollama
- LM Studio OpenAI-compat endpoint detection
- Clear Local vs Cloud badges
- User-initiated installs only (size/network disclosure)

### 9. How should local and cloud models coexist?

Via **Model Gateway + Privacy Mode**:

| Mode | Behavior |
|------|----------|
| Local Only | Cloud adapters disabled |
| Hybrid | Explicit user-enabled cloud + local |
| Cloud | Cloud allowed |
| Strict Private | Local models + network policy deny (except allowlisted) |

**Silent cloud failover is forbidden.** Fallback chains are user-authored and privacy-checked.

### 10. How should Agent Rooms work?

Layer on the **same Agent Runtime**:

- Room = shared objective + roster of specialized Agents + mode (sequential / parallel / debate / review / supervisor / swarm)
- Orchestrator assigns Tasks; Agents talk via **structured A2A messages** (Task Request/Result, Status, Artifact, Question, Approval, Failure) — not raw thought dumps
- Each Agent may use a different ModelProvider
- Visualization: roster status panel (working / waiting / done)
- Templates for teams; governance (tools, budget, permissions) owned by Room owner

Inspiration: Cursor multitask/subagents · DeepSeek agent-team concepts — **implement with Hoosh contracts**, not Cordis.

### 11. How should the n8n-like workflow engine work?

```
Workflow Definition → Workflow Runtime → Node Executor
  → Permission Engine → Tool / Agent Runtime → Artifacts / Events
```

- Evolve existing `flowEngine` toward a visual graph product; keep optional Docker n8n as an *integration*, not a second core.
- Nodes: Trigger / AI / Computer / Browser / Developer / Data / Logic / Output
- Debugger: step, inspect I/O, retry, rerun-from-here
- Same Permission Engine as Agents

### 12. How should Docker integrate?

First-class **Connections + Docker page + Docker Agent tools**, built on existing stacks/container runtime:

- Inspect/build/run/logs/compose with permission gates
- Docker Sandbox for generated code
- One-click env setup as a later phase on top of stacks detection

### 13. How should remote computers work?

Each machine runs a **paired Hoosh Runtime**. Control Plane lists **My Computers** (online/offline). Agents/workflows declare **target device**. Orchestrator routes tool calls to that Runtime’s session. Server mode = headless Runtime + pairing.

### 14. How should permissions work across all of this?

Nested scopes (fail-closed):

`Account → Device → Workspace → Project → Agent → Tool → Session`

Plus DeepSeek-inspired **presets** (UX only):

- Safe = workspace-write + ask  
- Full = danger-full-access + never ask (explicit)  
- Custom when knobs diverge  

Outcomes: `allowed-once | rejected | cancelled | unavailable` (deny if no answerer).  
Approval UI attaches to live tool card (`callId`), audit log-only.

### 15. How should the unified event model work?

Everything is representable as:

```
Trigger → Agent/Workflow → Task → Tool → Permission → Execution → Observation → Result → Artifact
```

Durable facts: ToolExecution, PermissionRequest, PlanMode, DevicePolicy, Room events.  
Chat messages are **projections**, not a parallel source of truth (migrate threads to SQLite; keep incremental).

### 16. How should the database evolve?

| Store | Role |
|-------|------|
| **SQLite + files on each Runtime / control-plane cache** | Source of truth for projects, runs, threads, permissions, workflows |
| **Firebase Auth** | Identity only |
| **Optional cloud sync** | Encrypted replicas / marketplace listings / multi-device metadata — never required for core execution |
| Reject | Firestore as primary workspace DB |

### 17. What should remain local?

Projects, Runtime config, permissions, tools state, local agents/workflows/artifacts, Ollama/LM Studio models, audit logs, secrets (OS keychain / `secretStore`).

### 18. What should be cloud-hosted?

Account, optional sync, marketplace catalog distribution, org/enterprise later, optional relay for remote pairing. **Not** required for single-machine local+Ollama use.

### 19. What can work completely offline?

Control Plane UI (desktop or cached), Runtime, local models, terminal/fs/git/docker (local), skills on disk, local workflows, permissions. Marketplace install and cloud models require network.

### 20. Minimum architecture that supports the entire vision without a future rewrite?

Five stable contracts + two deployables:

1. **Control Plane** (SPA)  
2. **Hoosh Runtime** (device daemon = evolved companion/kernel)  
3. **Model Gateway** (provider-agnostic)  
4. **Tool Registry → Permission → Sandbox → Executor**  
5. **Universal Agent / Task / Event / Artifact** records  

Everything else (Rooms, Workflows, Docker Agent, Computer Use, Marketplace, Orgs) is a **plugin/layer on these contracts**. If we keep these seams, we never need a greenfield rewrite.

---

## 4. Core contracts (Phase 0.5 deliverable set)

These are types + persistence seams — implement after Architecture v2 acceptance, before shell rebuild.

| Contract | Meaning |
|----------|---------|
| `ModelProvider` / `ModelAdapter` | Discover, health, chat/stream, embed, capabilities |
| `ModelGateway` | Route + privacy policy + usage report (user-owned keys) |
| `Device` / `RuntimeSession` | Paired computer, capabilities, revocation |
| `Agent` | Reusable definition (instructions, tools, skills, model prefs, permissions) |
| `AgentRun` | One execution instance |
| `Task` | Unit of work (Room or solo) |
| `Tool` / `ToolExecution` | Registry entry + audited call |
| `PermissionPolicy` / `PermissionRequest` | Nested scopes + tickets |
| `Event` | Typed durable/live bus |
| `Artifact` | Versioned outputs |
| `Room` / `RoomMessage` | Collaboration surface + A2A |
| `Workflow` / `WorkflowRun` / `NodeExecution` | Graph automation |
| `Connection` | Models, devices, MCP, Docker, Git hosts, … |

---

## 5. Responsibility split (Control Plane vs Runtime)

| Belongs in Control Plane | Belongs in Hoosh Runtime |
|--------------------------|---------------------------|
| Account UI, navigation, editors chrome | Agent loop, tools, PTY, fs |
| Thread/Room/Workflow **authoring** UI | Workflow **execution** |
| Model Hub / Connections UI | Provider HTTP to Ollama/LM Studio/APIs |
| Pairing UX, computer list | Device secret, capability report |
| Marketplace browse/install UX | Skill/extension load + sandbox |
| Observability dashboards | Metrics export (opt-in) |
| Cloud sync clients (later) | Local SQLite / files SoT |

Electron = Control Plane window **or** tray + embedded UI; privileged work still Runtime.

---

## 6. Model Hub & Connections

**Model Hub** is the product face of Model Gateway:

- Categories: Local / Cloud / Custom  
- Wizard: Add Provider → detect models → capabilities matrix  
- Cost transparency when cloud keys used (provider-owned billing; no silent Hoosh markup)  
- Keys in OS keychain / encrypted secret store; sync never ships raw keys by default  

**Connections** is the universal registry: AI, Computers, Browsers, MCP, Docker, Git hosts, DBs, APIs — each with status, scopes, revoke.

---

## 7. Privacy, network, offline

| Mode | Network | Cloud models | Telemetry |
|------|---------|--------------|-----------|
| Local Only | Policy default local | Off | Off |
| Hybrid | Per-agent/project policy | Opt-in | Opt-in |
| Cloud | Allowed | Allowed | Opt-in |
| Strict Private / Private Dev | Deny unless allowlist | Off | Off |

UI must show **Local vs Cloud** clearly whenever data may leave the machine.

---

## 8. Patterns borrowed (ideas only)

| Source | Borrow | Do not borrow |
|--------|--------|---------------|
| **Cursor Agents** | Composer-first home, model in composer, Files/Skills/MCP separation, account menu without paywall, wait-for-approval, workspace merge | Pro+/token UX, Origin/cloud as default, Upgrade CTAs |
| **DeepSeek Harness** | Fail-closed approval, permission presets, soft plan ≠ security, tool pipeline stages, skill discovery ranks, honest sandbox status | Cordis rewrite, DeepSeek branding, token-meter product core, E2B-default |

---

## 9. Revised phase plan

| Phase | Name | Outcome | Stop rule |
|-------|------|---------|-----------|
| **0** | Architecture audit | Done (Phase 0 + this v2) | — |
| **0.5** | Core Contracts | Types + SQLite sketches + Runtime API surface doc | STOP |
| **1** | Control Plane shell + design system | Real nav to existing surfaces; free-first onboarding copy | STOP |
| **2** | Hoosh Runtime harden + CLI + secure pairing | localhost bind, tokens, bridge pairing, `hoosh doctor/login/status` | STOP |
| **3** | Projects + Files + Terminal + Git | Polish existing | STOP |
| **4** | Model Hub + Gateway productization | Ollama/LM Studio/custom/cloud wizards | STOP |
| **5** | Agent Runtime + Threads + Context + Diff | AgentRun first-class | STOP |
| **6** | Permission Engine + Sandbox presets | Hard boundary everywhere | STOP |
| **7** | Skills + MCP + Tools + Extensions clarity | Four-way boundaries enforced | STOP |
| **8** | Tasks + Subagents + Parallel | — | STOP |
| **9** | Agent Rooms + Team Orchestration | — | STOP |
| **10** | Artifacts + Memory + Workflows (graph) | — | STOP |
| **11** | Browser Agent + Extension | — | STOP |
| **12** | Computer Use | — | STOP |
| **13** | Docker + Dev Environments | — | STOP |
| **14** | Marketplace expansion | Core stays free | STOP |
| **15** | Cloud Sync + Orgs + API | Optional | STOP |
| **16** | Security hardening + Performance + E2E | — | STOP |

**Execution rule:** At the end of every phase report what/why/files/APIs/tests/security/limits/next — then **STOP**. Never silently continue.

---

## 10. Immediate non-goals (until authorized)

- Phase 1 shell rebuild  
- Tauri / Next.js migration  
- Cordis / DeepSeek package import  
- Firebase Firestore product DB  
- Agent Rooms / Workflow editor implementation  
- Multi-device relay cloud  

---

## 11. Acceptance checklist for Architecture v2

Reviewers should confirm:

- [ ] Free / BYOI product definition accepted  
- [ ] Web Control Plane + Local Runtime topology accepted  
- [ ] companion/kernel = Runtime evolution (no greenfield) accepted  
- [ ] Tauri not required for v2 accepted  
- [ ] Pairing + fail-closed permission model accepted  
- [ ] Phase 0.5 → Phase 16 order accepted  
- [ ] Explicit authorization required before Phase 1  

---

## Final principle (locked)

```
USER BRINGS INTELLIGENCE.
HOOSH PROVIDES THE OPERATING ENVIRONMENT.

CONTROL PLANE directs.
HOOSH RUNTIME executes.
MODEL GATEWAY is provider-agnostic.
TOOL → PERMISSION → SANDBOX → EXECUTOR is the only path to the machine.
CORE STAYS FREE AND LOCAL-FIRST.
```

**End of Architecture v2 — STOP.**
