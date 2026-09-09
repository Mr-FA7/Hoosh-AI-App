# Phase 5 — AgentRun persistence — completion report

> **Date:** 2026-09-09  
> **Status:** COMPLETE  
> **Next:** Phase 6

## 1. What was built
kernel setCoreStore + runAgentTask persist; GET agent-runs

## 2. Architecture changes
Evolved existing Runtime/Control Plane seams; no greenfield rewrite. Free/local-first preserved.

## 3. Files changed / added
- `kernel.js`
- `lib/hooshCoreStore.js`
- `companion.js`

## 4. Database changes
SQLite tasks/rooms/artifacts/agent_runs used

## 5. APIs
GET /api/v3/agent-runs

## 6. Tests
Covered by `npm run test:security` and/or `npm run test:smoke-phase16` where Runtime is up. `tsc --noEmit` for UI.

## 7. Security implications
Frontend remains non-boundary. Pairing/presets/sandbox gates apply where relevant.

## 8. Known limitations
MVP depth — full n8n debugger, multi-LAN rooms orchestration, Win/Linux computer-use, and cloud sync remain future work.

## 9. Next phase
Phase 6
