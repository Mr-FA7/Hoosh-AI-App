# Phase 1 — Control Plane shell — completion report

> **Date:** 2026-09-09  
> **Status:** COMPLETE — STOP.  
> **Checks:** `tsc --noEmit` clean; CLI `help` / `status` / `doctor` smoke.  
> **Next authorized phase:** Phase 2 (multi-device pairing / revoke) or Phase 3+ only after you say go. Do **not** start Agent Rooms / n8n graph / Tauri.

---

## 1. What was built

### Control Plane surfaces
- **Models** — existing Engine view stays as `engine`, labeled **Models** on the primary rail (`sidebar.models`)
- **Computers** — new `ComputersView`: this-machine runtime health + doctor checks
- **Connections** — new `ConnectionsView`: aggregates Runtime / model catalog / MCP / Docker (`/v3/stacks/runtime`)

### Free-first Home
- Home shows free/local-first line + live Local Runtime pill (`/v3/runtime/health`)
- Model chip unchanged (Local / LM Studio / Your API)

### CLI
- `scripts/hoosh-cli.js`: `doctor`, `status`/`health`, `login` (+ device token header from `~/.aivon-os/runtime-auth.json` or `HOOSH_DEVICE_TOKEN`)

### i18n
- EN + FA keys for sidebar Models/Computers/Connections, computers.*, connections.*, home.freeFirst / runtime*

---

## 2. Architecture alignment (v2)

| Surface | Maps to |
|---------|---------|
| Models | BYOI providers (Control Plane) |
| Computers | Device / Runtime presence (pairing stub) |
| Connections | Universal connection registry (read-only status) |
| CLI doctor/status | Operator path to Local Runtime |

Invariant unchanged: frontend is not the security boundary; Runtime remains companion.

---

## 3. Files changed / added

| Path | Change |
|------|--------|
| `src/shell/viewCatalog.ts` | Models primary; computers + connections entries |
| `src/components/ComputersView.tsx` | **added** |
| `src/components/ConnectionsView.tsx` | **added** |
| `src/components/HomeView.tsx` | free-first + runtime pill |
| `src/App.tsx` | wire computers / connections |
| `src/index.css` | `.home-free-line`, `.home-runtime-pill` |
| `src/i18n/messages.ts` | EN/FA strings |
| `scripts/hoosh-cli.js` | doctor / status / login + auth header |
| `docs/phase-1-report.md` | **added** (this file) |

---

## 4. Explicitly **not** in this phase

- Multi-device pairing / QR / revoke tokens
- Agent Rooms
- Workflow graph rewrite
- Tauri desktop rewrite
- Cordis / DeepSeek Harness code copy
- Selling tokens / Upgrade UI

---

## 5. How to verify

1. Open app → Home: free line + runtime pill (green if companion up)
2. Rail → **Models**, **Computers**, More → **Connections**
3. `node scripts/hoosh-cli.js status` and `doctor` with companion running on `:3001`

---

## 6. STOP

Phase 1 is done. Await explicit go for the next phase.
