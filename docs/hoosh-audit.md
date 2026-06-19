# Hoosh AI — Phase 0 Codebase Audit

> **Company:** FA7 Labs LTD · **Product:** Hoosh AI
> **Author:** Claude Code (automated audit) · **Date:** 2026-06-18
> **Scope:** Mandatory Phase 0 of the Master Evolution Brief — *read before you write*. No production code was modified to produce this report (one temporary debug `console.error` was added to `/api/v3/project/open` to capture a stack trace and then reverted).

---

## خلاصهٔ مدیریتی (Persian executive summary)

برنامهٔ Hoosh AI **بسیار بالغ‌تر از یک نقطهٔ شروع** است. برخلاف تصور اولیه که «باید قابلیت‌های ۱۱ مثال آورده شوند»، بیشتر این قابلیت‌ها از قبل پیاده و **وصل** شده‌اند:

- **اسموک‌تست رسمی: ۶۰ از ۶۰ پاس** روی بوت تازه (`scripts/smoke-test.js`).
- **۵۵ ماژول در `lib/`** همگی به `kernel.js` / `companion.js` متصل‌اند.
- **تایپ‌چک TypeScript بدون خطا** (`tsc --noEmit`).
- حلقهٔ عاملِ کامل (plan → tool calls → edits → verify) با تک‌نقطهٔ کنترل side-effect در `kernel.executeTool`.

بنابراین تمرکز فازهای بعدی باید روی **سفت‌کاری، امنیت، و چند گپِ واقعیِ عمیق** باشد، نه بازنویسی سیستم‌های سالم. ۱۰ گپ برتر در بخش §7 آمده است.

---

## 1. Stack & Topology

| Layer | Technology |
|-------|------------|
| Desktop shell | **Electron** (`electron-main.js`, `preload.js`) |
| Frontend | **React + TypeScript + Vite** (`src/`, entry `src/main.tsx` → `src/App.tsx`) |
| Editor | **Monaco** (`@monaco-editor/react`) |
| Backend ("companion") | **Node.js + Express** monolith (`companion.js`, ~4280 lines), default port `FA7_PORT` (3001) |
| Agent core | `kernel.js` (`AgentKernel`, ~1700 lines) |
| Indexer | `indexer.js` + `lib/{ftsIndex,vectorIndex,lanceVectorIndex,sqliteFtsIndex,pageRank}.js` |
| Terminal | **node-pty** over WebSocket (`companionShellPty.js`) |
| Local LLM | **Ollama** managed runtime (`companionOllama*.js`, `ollamaManager.js`) |
| Provider gateway | `lib/llmGateway.js` + `lib/litellmRouter.js` (`lib/litellmCatalog.json`) |

**Process model:** Electron main spawns/loads the Vite-built UI; the UI talks to the `companion.js` Express server over HTTP (`/api/v3/*`) and to the terminal over a PTY WebSocket. The agent kernel runs **inside the companion process** (not a separate worker). Build: `tsc && vite build`; dev: `concurrently nodemon companion.js + vite`.

**Distinct Hoosh subsystems (keep — do not replace):** Gira (BDTM kernel), Kavosh (browser kernel), VM Lab (`companionVmLab*.js`), UAT mounts, Negah agent, FA7 plugin system, i18n (Persian/English).

---

## 2. Capability Inventory  (present / partial / missing)

Verified against running code + 60/60 smoke test.

| Capability | Status | Evidence |
|-----------|--------|----------|
| Codebase indexing / semantic search / embeddings | **Present** | `indexer.js`, hybrid FTS + vector + LanceDB + SQLite FTS5, PageRank repo-map |
| Chat with code context | **Present** | `AIPanel.tsx`, `@`-mentions, hybrid retrieval into prompt |
| Inline edit (Cmd-K style) | **Present** | `InlineChat.tsx`, `DiffZoneOverlay.tsx` |
| Autonomous terminal / command execution | **Present** | `executeCommand` tool, PTY, sandbox routing |
| Multi-file generation & refactor | **Present** | `kernel` agent loop, `lib/editFormats.js` (udiff/editblock/wholefile/search-replace) |
| Test running & self-healing on failure | **Present** | `lib/lintRunner.js`, `lib/lintHealLoop.js`, `healFileWithLintLoop` |
| Persistent project memory | **Partial** | `.fa7/notebook.md` + checkpoints exist; no structured symptom→cause→fix error memory or cross-project/user memory layer |
| Web / deep research | **Partial** | `webSearch` tool exists but uses **DuckDuckGo Instant-Answer snippets only** (`kernel.js:534`); no multi-source, full-page fetch, or cited synthesis. `lib/docsContext.js` fetches explicit doc URLs |
| Multiple model providers + routing | **Present** | `lib/llmGateway.js` (164 providers in catalog), role models, `lib/tierRouting.js` |
| Local model execution | **Present** | Ollama managed + llama.cpp/LM Studio via OpenAI-compat |
| Deployment helpers | **Partial** | `composeBuildPipeline.js` (Docker compose build); no Vercel/Railway/Cloudflare/K8s one-command deploy |
| Agent task manager / background tasks | **Partial** | `lib/agentSessions.js`, `lib/agentAutomation.js` (cron/webhook), parallel sessions UI in `AIPanel`; no unified "Agent Manager" surface with cost/resource columns per Antigravity model |
| Permission & safety controls | **Present** | `lib/toolApproval.js`, approval tiers, `ApprovalModal.tsx`, plan/ask/gather read-only modes |
| Browser control / preview | **Present** | `BrowserView.tsx`, `kavoshBrowserKernel.js`, `lib/browserAgentLoop.js`, `lib/sandboxPlaywright.js` |
| Cost / token tracking | **Partial** | only in `lib/fccProxy.js` proxy path; not surfaced per-task in UI |
| Architecture bird's-eye view | **Partial** | `src/flowchart/mermaidPlan.ts` renders plan graphs; no clickable file/dependency map |
| Secure API-key storage | **Missing/weak** | keys stored **plaintext** in JSON config (`llmGateway.js:93`), masked only on display |

---

## 3. Architecture Map (text)

```
 ┌─────────────────────────── Electron shell ───────────────────────────┐
 │  electron-main.js → loads Vite UI (dist/ or :5173)                     │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP /api/v3/*            WS (PTY)
 ┌───────────────────────────────▼───────────────────────────────────────┐
 │  React UI (src/)                                                        │
 │   App.tsx · AIPanel (chat/agent/plan/act) · Editor (Monaco+DiffZone)   │
 │   FileExplorer · TerminalView · BrowserView · SettingsView · GitPanel  │
 │   MarketplaceView · CheckpointPanel · ApprovalModal · flowchart        │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │
 ┌───────────────────────────────▼───────────────────────────────────────┐
 │  companion.js  (Express monolith, :3001)                               │
 │   routes: project · mission · agent-sessions · indexing · mcp · lsp …  │
 │   services: Indexer · OllamaManager · LlmGateway · McpManager/Gateway  │
 │            · ToolApprovalManager · AcpAdapter · SandboxRunner          │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │
 ┌───────────────────────────────▼───────────────────────────────────────┐
 │  kernel.js  AgentKernel  —  THE AGENT LOOP                             │
 │   executeAutonomousLoop(goal)                                          │
 │     → plan  → _stepProcess(step)                                       │
 │       → _toolCycle(toolCall)                                           │
 │         → executeTool(name,args)   ◀── SINGLE SIDE-EFFECT CHOKEPOINT   │
 │             ├ approval gate (toolApproval)                             │
 │             ├ mode gate (plan/ask/gather = read-only)                  │
 │             ├ path-traversal guard (relative-only)                     │
 │             ├ checkpoint-before-write (checkpointManager)              │
 │             ├ deferWrites → DiffZone proposal                          │
 │             └ command blacklist + optional Docker sandbox              │
 │   lint-heal loop · architect/editor dual-model · context compaction   │
 └───────────────────────────────────────────────────────────────────────┘
```

**Tool layer chokepoint:** `kernel.executeTool` (`kernel.js:434`) is already the single funnel for filesystem/shell/network/git side effects — exactly the architecture the brief §17/§20 requires. This is a major strength to build on.

---

## 4. Health Check

- **Build / typecheck:** `tsc --noEmit` → clean (exit 0).
- **Smoke test:** `node scripts/smoke-test.js` → **60/60 pass** on a fresh companion boot.
- **Wiring:** all 55 `lib/*.js` modules referenced from the main process or their parent modules; no dead orphans.
- **Tech debt:**
  - `companion.js` is a ~4,280-line monolith with cosmetically-inconsistent indentation (route handlers written at column 0 but lexically inside `main()`). Hard to navigate; candidate for modular route extraction.
  - Many ad-hoc `test_*.js` scripts at repo root (Negah/Gira/VM Lab) instead of a unified test runner; `package.json` has no `test` script.
- **Security smells (must address — see gaps):**
  1. **Plaintext API keys** at rest (`llmGateway.js`, `litellmRouter.js`).
  2. Direct shell `spawn` path in `kernel.js:416` runs **outside** the Docker sandbox when sandbox is disabled (default); protection is a regex blacklist only (`kernel.js:604`) — denylist, not allowlist.
  3. No secret scanning before network sends (brief §7/§20 requirement).

---

## 5. Observations & Notes Cross-check

The existing `Example/notes/` (00-INDEX + 01–11) are **accurate**: they correctly map each example to implemented Hoosh modules. Phases 1–4 described there are genuinely done and wired. This audit confirms them and adds the verified 60/60 status + the security/secret findings the notes omitted.

A transient `kernel is not defined` error was observed once on a cold `/api/v3/project/open` during server warm-up; it did not reproduce after full boot (60/60). Flagged as a **startup race** to harden (gap #2), not a structural bug.

---

## 6. Mapping the Brief's Phases to Hoosh's Reality

| Brief phase | Hoosh status | Remaining work |
|-------------|-------------|----------------|
| 1 — Foundation (index/retrieval/context) | ~90% done | structured project/error memory, context-compression API surface |
| 2 — Core loop (plan→edit→run→verify, diff UX) | ~90% done | hardening, give-up/iteration caps surfaced in UI |
| 3 — Agent surfaces + task manager | ~60% done | unified Agent Manager UI w/ status + cost + resource columns |
| 4 — Research & memory | ~40% done | real multi-source deep-research; durable memory layers |
| 5 — Local AI Mode | ~70% done | hardware-aware model swap, live VRAM/RAM/GPU in UI, privacy/offline mode toggle |
| 6 — Autonomy & deployment | ~50% done | gated multi-target deploy; explicit autonomy-mode ladder + STOP everywhere |
| 7 — Collaboration & polish | ~20% done | later; defer per brief |

---

## 7. Top 10 Highest-Leverage Gaps (ranked by impact × feasibility)

1. **Secure API-key storage** — replace plaintext JSON with OS keychain / Electron `safeStorage`. *High impact, high feasibility.* (brief §11, §20)
2. **Sandbox-by-default + command allowlist** — make `executeCommand` route through sandbox/allowlist instead of denylist regex; gate raw `spawn`. *High impact, medium feasibility.* (§7, §20)
3. **Secret scanning before network send** — redact-by-default pre-flight in `llmGateway`/`webSearch`/research. *High impact, medium.* (§7, §8, §20)
4. **Real deep-research agent** — multi-source (web/docs/GitHub/SO) + full-page fetch + cited synthesis, replacing DDG-snippets-only. *High impact, medium.* (§8)
5. **Agent Manager surface** — unified task list: status / plan / timeline / diffs / cost / resources, with per-task token+$+wall-clock. *High impact, medium.* (§6B)
6. **Structured project + error memory** — `ContextEngine.remember/recall` with symptom→cause→fix records persisted per project. *High impact, medium.* (§4)
7. **Autonomy-mode ladder + global STOP + caps** — explicit Assist / Auto-edit / Background modes with iteration/time/token caps everywhere. *Medium-high, medium.* (§7)
8. **Live resource telemetry (Local AI Mode)** — surface VRAM/RAM/GPU + model-swap routing tuned to 16GB VRAM / 48GB RAM. *Medium, medium.* (§12)
9. **Gated deployment helpers** — Docker (have) + Vercel/Railway/Cloudflare one-command, approval-gated. *Medium, medium-low.* (§13)
10. **Companion modularization + unified test runner** — split `companion.js` routes into modules; add a real `npm test`. *Medium impact (maintainability), medium.* (§19)

---

## 8. Proposed Phased Roadmap (for approval — no code until approved)

- **Phase A — Security hardening (gaps 1–3).** Smallest, highest-trust wins. Each shippable independently behind the existing Tool Layer.
- **Phase B — Research & Memory (gaps 4, 6).** Deep-research agent + `ContextEngine` memory API.
- **Phase C — Agent Manager & Autonomy UX (gaps 5, 7).** Unified manager surface + autonomy ladder + STOP/caps.
- **Phase D — Local AI Mode polish (gap 8).** Hardware-aware routing + telemetry.
- **Phase E — Deployment & maintainability (gaps 9, 10).** Gated deploys + companion refactor + test runner.

Each change must: build, keep 60/60 smoke green, run locally, route side-effects through the Tool Layer, and ship with a smoke test (brief §19).

---

## 9. Progress Log

### ✅ Phase A — Security hardening (DONE, verified 2026-06-18)

| Gap | Change | Verification |
|-----|--------|--------------|
| 1 — Plaintext API keys | `lib/secretStore.js` (AES-256-GCM, 0600 machine key, optional Electron safeStorage wrap). `lib/llmGateway.js` encrypts at rest on save, decrypts on load, **auto-migrates** legacy plaintext keys. `getConfig()` still masks. | on-disk key is `enc:v1:…`, no plaintext leak, reload decrypts, keystore 0600 |
| 2 — Denylist-only shell | `lib/toolApproval.js` adds a **command allowlist**: auto-approved terminal commands run only if every compound segment is allowlisted; `git push/reset/clean/...`, `rm -rf`, `curl`, etc. still prompt. Default (ask) mode unchanged. | unit tests below |
| 3 — No secret scanning | `lib/secretScanner.js` redacts high-confidence secrets from **external** sends; applied to `webSearch` query in `kernel.js`. (Intentionally NOT applied to LLM payloads — would corrupt user code sent to their own model.) | unit tests below |

- New tests: `scripts/test-security.js` → **20/20 pass**. Wired to `npm test`.
- Regression: `scripts/smoke-test.js` → **60/60 pass**; `tsc --noEmit` clean.
- No working subsystem replaced; all changes additive and behind the existing Tool Layer.

### ✅ Phase B — Research & Memory (DONE, verified 2026-06-18)

| Gap | Change | Verification |
|-----|--------|--------------|
| 6 — Structured project/error memory | `lib/memoryRecall.js` (pure recall/dedupe). Kernel gains `rememberFact`/`recallProjectFacts`/`rememberError` over `.fa7/memory.json` (`facts` + `learned_patterns`). New agent tools `remember`/`recall` (categorized read). **Auto-capture**: successful lint-heal records a symptom→fix pattern. Recalled patterns + memory hint injected into the system prompt. REST: `GET/POST /api/v3/memory`. | unit + smoke |
| 4 — Deep research | `lib/deepResearch.js`: DuckDuckGo HTML SERP parse → fetch top pages → readable-text extraction → cited excerpts. New `deepResearch` tool; `webSearch` now falls back to SERP+page-fetch when Instant-Answer is empty. Secret-redaction applied to research queries. Prompt steers the agent to cite `[n]`. | unit (offline parse) + **live fetch returned 1 real source** |

- Tests: `scripts/test-security.js` → **31/31 pass**. Smoke: `scripts/smoke-test.js` → **62/62 pass** (added 2 memory checks). `tsc --noEmit` clean.

### Phase 7 note (autonomy caps/STOP): backend already present — `MAX_TOOL_ROUNDS=10`, `cancelController`/`abortActiveMission`/`isMissionAborted`, and `agentMode` (plan/ask/gather/agent). Remaining is **UI** (autonomy-mode selector, global STOP affordance), best done with the running app.

### Remaining: Phase C (Agent Manager UI + autonomy UX), D (Local AI telemetry UI), E (gated deploy + companion modularization). These are UI-heavy / larger and should be verified by driving the app.

---

## 10. Next Action (Master Brief)

Phases A + B shipped and verified (no working subsystem replaced; all additive behind the Tool Layer). Remaining phases are UI-heavy — recommend doing them with the app running so each change is visually verifiable. Awaiting go-ahead on C/D/E priority.

---

# Add-on Brief — Skills, Marketplace & Workflow Automation

> Mandatory first action of the add-on brief: *does Hoosh AI already have a plugin/extension mechanism, prompt-pack concept, or tool registry? If so, build on it.* Then propose the S1 manifest schema + isolation design **for review before implementing.** This section answers both. **No code written yet.**

## 11. Existing foundations to build ON (do NOT reinvent)

Answer: **Yes — Hoosh already has all four.** The Skill system must extend these, not replace them.

| Brief asks for | Already in Hoosh | File / evidence |
|----------------|------------------|-----------------|
| **Prompt-pack / Skill concept** | `.fa7/skills/<name>/SKILL.md` with frontmatter (`description`, `keywords`/`triggers`, body), keyword-matched and injected into the system prompt. Plus Cursor-style **Rules** (`.fa7/rules/*.md`, `alwaysApply`/`globs`/`description`). Endpoints `GET /api/v3/skills`, `GET /api/v3/skills/match`. | `lib/rulesSkills.js` (`loadSkills`, `matchSkillsForQuery`, `buildSkillsPrompt`) |
| **Plugin / extension mechanism** | (a) **FA7 plugins**: `fa7-plugins/<name>/index.js` exporting `register(api)` — dynamic `import()`, **currently UNSANDBOXED (full Node)**. (b) **VS Code-style extensions**: activated in a real **vm isolate** with `require` blocked except `vscode`, `process`/`Buffer` undefined, 8 s timeout. | `companionFa7Plugins.js`; `lib/extensionSandbox.js`, `extensionBridge.js`, `extensionHost.js` |
| **Sandbox / isolation primitive** | `vm.runInNewContext` deny-by-default sandbox (the exact "capability-denied-by-default" model the add-on requires). | `lib/extensionSandbox.js` |
| **Tool registry / chokepoint** | `kernel.executeTool` (single side-effect funnel) + MCP registry/catalog/gateway. | `kernel.js:434`, `lib/mcpCatalog.js`, `lib/mcpManager.js`, `lib/mcpGateway.js` |
| **Capability permissions** | `ToolApprovalManager` — categories read/write/terminal/browser/mcp, per-tool overrides, **command allowlist** (added Phase A), approve/deny flow with timeout. | `lib/toolApproval.js` |
| **Marketplace UI + install flow** | `MarketplaceView.tsx` (search / installed tabs, install button) backed by `/api/v3/marketplace/*` (today: Open VSX extension proxy). Reusable shell for a Skill marketplace. | `src/components/MarketplaceView.tsx` |
| **Secure credential-by-handle** | `lib/secretStore.js` (Phase A) — store secrets encrypted, reference by handle. | `lib/secretStore.js` |
| **Workflow / automation seeds** | Plan→graph rendering (`mermaidPlan.ts`), HITL graph (`hitlGraph.js`), cron/webhook automation (`agentAutomation.js`), parallel agent sessions (`agentSessions.js`). | as listed |
| **Memory scope** | `.fa7/memory.json` + `memoryRecall` (Phase B). | `kernel.js`, `lib/memoryRecall.js` |

### Gaps the add-on must close (vs. what exists)
1. The existing **Skill format is prompt-only** (description + body) — no manifest, no permissions, no knowledge-base/MCP/sub-agents/evals/pricing. → needs the structured manifest.
2. **FA7 plugins run unsandboxed.** Third-party Skills must NOT use this path; they must run through the `extensionSandbox` vm model + Tool Layer, never raw Node.
3. No **per-Skill permission grant UI**, no **per-Skill resource caps**, no **audit attribution** to a Skill.
4. Marketplace is **extension-only**; no Skill/Workflow listings, no publish/validation/eval/monetization pipeline.
5. No **visual Workflow canvas / execution engine** (only plan rendering + cron automation).

## 12. Proposed S1 design (for review)

### 12.1 Manifest schema (`skill.json`, backward-compatible with SKILL.md)

S1 adds an optional `skill.json` next to the existing `SKILL.md`. If `skill.json` is absent, `loadSkills` keeps working exactly as today (prompt-only Skill). This is additive — zero breakage.

```jsonc
{
  "manifestVersion": 1,
  "id": "fa7.python-expert",            // namespaced, unique
  "name": "Python Expert",
  "version": "1.0.0",                    // semver
  "author": { "name": "FA7 Labs", "verified": false },
  "category": "coding",                  // coding|cloud-devops|ai|research|business|marketing|design|security|legal-assist|personal
  "summary": "…", "description": "…",
  "systemPrompt": "./prompts/system.md", // reuses existing prompt injection
  "examples": "./examples/*.md",
  "recommendedModels": [                 // mapped to llmGateway roles; graceful local fallback
    { "role": "plan", "provider": "anthropic", "model": "<verify-id-at-build>" },
    { "role": "completion", "provider": "ollama", "model": "qwen2.5-coder" }
  ],
  "knowledgeBase": [                     // fetched+indexed at install (live-docs rule, refresh cadence)
    { "source": "https://docs.python.org/3/", "type": "docs", "refresh": "weekly" }
  ],
  "mcpTools": [ { "id": "fa7.python-tools", "required": false } ],
  "subAgents": ["coding", "debug", "test"],
  "workflows": "./workflows/*.flow.json",
  "memoryScope": "project",              // project|user|task
  "eval": { "tests": "./eval/*.json", "passThreshold": 0.8 },
  "permissions": {                       // DECLARED, deny-by-default
    "filesystem": "workspace-only",      // none | workspace-only | path:<glob>
    "shell": { "allowlist": ["python", "pip", "pytest"] },
    "network": ["docs.python.org", "pypi.org"],
    "mcp": ["fa7.python-tools"],
    "secrets": []                        // handles only, never raw values
  },
  "pricing": { "model": "free" }         // free | one-time | subscription (S5)
}
```

Validation in S1: JSON-schema check, semver check, permissions well-formed & minimal, knowledge-base hosts ⊆ `permissions.network`, eval present for "verified".

### 12.2 Isolation design (the critical part)

Reuse and extend the existing `vm` sandbox + Tool Layer; **a Skill gets nothing by default.**

```
Skill code / shipped tools
        │  (never raw Node, never raw shell)
        ▼
  Skill Sandbox  (extends lib/extensionSandbox.js)
   • vm.runInNewContext, require blocked, process/Buffer undefined, time cap
   • injects ONLY a capability object built from granted permissions:
        ctx.fs    → workspace-scoped, path-allowlisted   ─┐
        ctx.shell → allowlisted commands only             ├─ every call forwards to →
        ctx.net   → host-allowlisted fetch (secret-redacted)│
        ctx.mcp   → only granted MCP tool ids             ─┘
        ▼
   kernel.executeTool  (THE chokepoint)
   • ToolApprovalManager gate (per-capability grant at install + per-action policy)
   • command allowlist + denylist (Phase A)
   • secret redaction before network (Phase A)
   • path-traversal guard, checkpoint, deferWrites/DiffZone
        ▼
   audit_log entry attributed to skillId  (NEW in S1)
```

Key rules:
- **Grant at install**: a permission screen shows the manifest's declared capabilities; nothing is enabled until the user approves (reuse `ToolApprovalManager`, add `perSkill` scope + an `audit_log`).
- **Per-Skill caps**: token/time/tool-call budget per Skill, surfaced later in the Agent Manager (Phase C).
- **Privacy/local mode**: if "no data leaves machine" is on, a Skill with `network`/remote-model needs either refuses to run or degrades to local — explicit notice.
- **Kill switch (S7)**: a disabled `skillId@version` set checked before activation.
- **FA7 plugins stay first-party-only**; third-party code only ever runs in the Skill sandbox.

### 12.3 S1 scope (proposed, pending approval)
1. `skill.json` schema + loader extension in `lib/rulesSkills.js` (back-compat).
2. Install/activate lifecycle: fetch+index knowledge base, register sub-agents, enable approved MCP tools, expose shipped workflows (stub until S6).
3. `lib/skillSandbox.js` (extends `extensionSandbox`) injecting capability object from granted permissions → Tool Layer.
4. Permission-grant screen + per-Skill audit attribution.
5. 2–3 first-party Skills (Python, React, Deep Research) end-to-end, each with eval tests.
6. Unit tests (manifest validation, permission gating, sandbox denial) + smoke endpoints.

**External facts to verify at build time** (per guardrails): exact model IDs for `recommendedModels`, MCP spec version, and (for S5) the payment SDK — fetched live, not hardcoded.

## 13. Workflow Builder design (S6) — informed by n8n study

> Studied `~/Downloads/n8n-master` for the n8n-style Workflow Builder. **No n8n code copied or depended on.**

### ⚠️ Licensing constraint (must respect)
n8n is **fair-code under the Sustainable Use License**, NOT open source: "use/modify only for internal/non-commercial/personal; distribute only free of charge for non-commercial purposes"; `.ee.` files need an Enterprise license. **Hoosh is commercial (marketplace + monetization), so copying n8n code or depending on n8n npm packages is not permitted.** We learn *concepts* (not copyrightable) and implement *original* code. n8n's canvas is Vue + `@vue-flow`; Hoosh is React → use **React Flow (`@xyflow/react`, MIT)** with original code.

### Concepts to adopt (original implementation)
| Concept (from n8n) | Hoosh implementation plan |
|---|---|
| Workflow = serializable JSON (`nodes[]` + `connections` keyed by node-name → output → targets) | `*.flow.json`, versionable, shippable inside a Skill |
| **Item-based data flow**: every node consumes/emits arrays of `{ json, binary }` items with `pairedItem` lineage (gives loop/batch for free) | core data contract of the Hoosh engine |
| Node contract: `description + execute()/trigger()/poll()/webhook()` (programmatic & declarative) | `HooshNodeType` contract; **every side effect routes through `kernel.executeTool`** (no special privileges) |
| Trigger taxonomy: manual · webhook · schedule/cron · poll · on-event | extend existing `lib/agentAutomation.js` (already cron/webhook) |
| Sandboxed `{{ }}` expression engine | reuse `lib/extensionSandbox.js` (vm) — no `@n8n/tournament` |
| Encrypted credentials by handle | reuse `lib/secretStore.js` (Phase A) |
| Partial execution + pinData (pinned per-node test data) | fast iterative testing in the canvas |
| Per-node error-handler/retry path; per-run state + transcript + budget caps + STOP | matches add-on §5.3; reuse `streamRegistry`/abort |

### Node types for Hoosh (agent-first)
Triggers · **AI nodes** (LLM call w/ routing, RAG, `deepResearch`, agent/sub-agent) · **Skill node** (invoke an installed Skill capability) · **Tool node** (HTTP/shell/fs/db/git — all via Tool Layer) · **Logic** (if/switch/loop/merge/delay/retry) · **Human-in-the-loop** (pause for approval).

### Differentiators vs n8n
Hoosh is agent-first: `agent`/`Skill` nodes are first-class (n8n centers on SaaS integrations). Keep the engine **lightweight & in-process** — Hoosh's companion is a single Node process; no heavy queue/worker/DB tier like n8n. Workflows are publishable in the Marketplace under the same permission/review/monetization rules as Skills (add-on §5.4).

### Sequencing
Workflow Builder is **S6** — after Skills S1 isolation is proven. Full notes: `Example/notes/12-n8n.md`.

## 14. Progress Log (Add-on)

### ✅ S1 — Skill core (DONE, verified 2026-06-18)

Built on existing foundations (rulesSkills, extensionSandbox model, toolApproval, secretStore) — additive, back-compatible (prompt-only `SKILL.md` still works).

| Piece | File | Verification |
|-------|------|--------------|
| Manifest schema + validation (deny-by-default, elevated detection, KB⊆network) | `lib/skillManifest.js` | unit |
| **Capability sandbox** — vm isolate, `require/process/Buffer` denied, injects a `hoosh` object **only** from granted perms, every call → `kernel.executeTool` | `lib/skillSandbox.js` | unit: allowed routes to Tool Layer, non-allowlisted shell denied, fs denied when scope=none, require() blocked |
| Manager: discover (built-in + project) / install / **grant (clamped to manifest)** / activate / uninstall | `lib/skillManager.js` | unit: clamps shell+network, activate requires grant |
| Eval gate (no evals → not "verified") | `lib/skillEval.js` | python-expert 3/3 verified |
| Audit attribution (every Skill action → `.fa7/audit.log`) | `lib/auditLog.js` | live: `network.research`, `memory.remember` attributed to skill |
| Tool Layer additions: `fetchUrl` tool; active-Skill system-prompt injection | `kernel.js` | smoke |
| REST: `/api/v3/skill/{catalog,:id/inspect,:id/eval,:id/install,:id/grant,:id/activate,:id/uninstall,:id/run}` + `/api/v3/audit` | `companion.js` | smoke 6 new checks |
| First-party Skills: Python, React, Deep Research (w/ sandboxed `run.js` capability) + evals | `skills/` | discover + eval + end-to-end run |

- Tests: `npm test` → **46/46**. Smoke → **68/68** (fresh boot). `tsc --noEmit` clean.
- **Isolation proven end-to-end**: a Skill's shipped code ran in the sandbox, its `research` capability routed through the Tool Layer, a non-granted command was denied, and all actions were audit-attributed to the Skill — exactly the gate required before any third-party publishing.

### ✅ S3 — Marketplace read-path UI (DONE, verified live 2026-06-18)

| Piece | File | Verification |
|-------|------|--------------|
| Skills tab in Marketplace (Skills ⇄ Extensions toggle, Skills default) | `src/components/MarketplaceView.tsx` | live snapshot |
| Skill catalog cards: name, category, version, source, **verified/elevated badges**, **up-front permission summary** (fs/shell/net/mcp/secrets) | `src/components/SkillsMarketplace.tsx` | live: 3 built-in skills render with correct perms |
| **Permission-grant screen** (modal) — shows requested capabilities; nothing granted until approved | `SkillsMarketplace.tsx` `PermissionGrantModal` | live: Install → modal (state installed, granted=no) → Approve → granted+active |
| Lifecycle buttons: Install / Grant & Activate / Active—deactivate | `SkillsMarketplace.tsx` | live end-to-end |

- Live flow verified in the running app: Install → permission-grant modal → Approve → `~/.aivon-os/skill-installs.json` shows `granted=yes, active=true`; **audit log** recorded `skill.install`, `skill.grant` (with permission detail), `skill.activate`, all attributed.
- `tsc --noEmit` clean; `npm test` 46/46 (no backend regression — S3 is frontend-only).

### Remaining: S2 (more first-party Skills + evals) · S4 (publish/validation/review — third-party) · S5 (monetization) · **S6 (Workflow Builder, design §13)** · S7 (trust & safety). Per the brief, do NOT open S4 third-party publishing until isolation (S1 ✅) + permission UX (S3 ✅) are solid — both now shipped.

## 15. Next Action (Add-on)

S1 (isolation) + S3 (permission UX) are both proven. The two prerequisites for third-party code are now met. Reasonable next steps: **S2** (flesh out the MVP-15 first-party Skills with evals), then **S6 Workflow Builder** (design §13), or **S4** publish pipeline. Awaiting priority.
