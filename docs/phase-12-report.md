# Phase 12 — Computer Use — completion report

> **Date:** 2026-09-09  
> **Status:** COMPLETE  
> **Next:** Phase 13

## 1. What was built
ComputerUseView + negah/status; darwin computerUse capability

## 2. Architecture changes
Evolved existing Runtime/Control Plane seams; no greenfield rewrite. Free/local-first preserved.

## 3. Files changed / added
- `src/components/ComputerUseView.tsx`
- `lib/deviceAuth.js`
- `companion.js`

## 4. Database changes
None / prior schema

## 5. APIs
GET /api/v3/negah/status

## 6. Tests
Covered by `npm run test:security` and/or `npm run test:smoke-phase16` where Runtime is up. `tsc --noEmit` for UI.

## 7. Security implications
Frontend remains non-boundary. Pairing/presets/sandbox gates apply where relevant.

## 8. Known limitations
MVP depth — full n8n debugger, multi-LAN rooms orchestration, Win/Linux computer-use, and cloud sync remain future work.

## 9. Next phase
Phase 13
