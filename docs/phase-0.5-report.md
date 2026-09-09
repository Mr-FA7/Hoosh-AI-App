# Phase 0.5 + Runtime harden — completion report

> **Date:** 2026-09-09  
> **Status:** COMPLETE — STOP. Phase 1 not started.  
> **Tests:** `npm run test:security` → **90/90**; `tsc --noEmit` clean.  
> **Next authorized phase:** Phase 1 Control Plane shell (only after you say go), or continue Phase 2 pairing UX.

---

## 1. What was built

### Phase 0.5 — Core Contracts
- TypeScript contracts: `src/hoosh/contracts/index.ts` (Agent, AgentRun, Task, Tool, Permission, Device, Room, Workflow, Connection, RuntimeBootstrap, API surface map)
- SQLite schema: `lib/coreSchema.js` + `lib/hooshCoreStore.js` (`~/.aivon-os/hoosh-core.sqlite`)

### Runtime harden (early Phase 2)
- Default bind **`127.0.0.1`** (`FA7_BIND` override) — no more `0.0.0.0` by default
- Device auth module: `lib/deviceAuth.js` (`runtime-auth.json`, bootstrap, middleware)
- Routes: `/api/v3/runtime/health|bootstrap|doctor`
- Permission presets: `lib/permissionPresets.js` + `/api/v3/permission/preset`
- Settings UI: Safe / Full presets + Runtime doctor
- Control Plane bootstrap: `src/lib/runtimeBootstrap.ts` + `main.tsx`
- Bridge extension attaches device token after bootstrap

---

## 2. Architecture changes

- Companion is explicitly **Hoosh Local Runtime** entry (still `companion.js`)
- Security default: localhost bind + device token for non-loopback
- Permission UX: Safe vs Full presets over existing `ToolApprovalManager`

---

## 3. Files changed / added

| Path | Change |
|------|--------|
| `src/hoosh/contracts/index.ts` | **added** |
| `lib/coreSchema.js` | **added** |
| `lib/hooshCoreStore.js` | **added** |
| `lib/deviceAuth.js` | **added** |
| `lib/permissionPresets.js` | **added** |
| `src/lib/runtimeBootstrap.ts` | **added** |
| `docs/phase-0.5-report.md` | **added** (this file) |
| `companion.js` | bind, middleware, runtime + preset routes |
| `src/main.tsx` | bootstrap auth |
| `src/components/SettingsView.tsx` | presets + doctor |
| `src/i18n/messages.ts` | EN/FA strings |
| `extensions/hoosh-local-bridge/background.js` | token bootstrap |
| `scripts/test-security.js` | preset + auth + store tests |

---

## 4. Database changes

- New optional SQLite DB: `~/.aivon-os/hoosh-core.sqlite` (schema v1)
- New auth file: `~/.aivon-os/runtime-auth.json` (0600)

---

## 5. APIs added

- `GET /api/v3/runtime/health`
- `GET /api/v3/runtime/bootstrap` (loopback when auth on)
- `GET /api/v3/runtime/doctor`
- `GET|POST /api/v3/permission/preset`

---

## 6. Tests

- `npm run test:security` — includes preset, device-auth, core-store cases

---

## 7. Security implications

- **Improved:** default LAN exposure removed (`0.0.0.0` → `127.0.0.1`)
- **Partial:** loopback still trusted without token (needed for Vite/Electron/bridge rollout); LAN requires token
- **Next:** full pairing UX, revoke, origin allowlist, require token even on loopback after Control Plane always bootstraps

---

## 8. Known limitations

- Agent Rooms / Model Hub / Workflow graph / multi-computer pairing UI **not** built (later phases)
- Bootstrap is loopback credential issue, not QR pairing yet
- Core SQLite not yet wiring AgentRun into kernel hot path
- Bridge zip in `public/` may need `npm run bridge:pack` to refresh packaged extension

---

## 9. Next phase

**STOP here per phase rule.**

Recommended next when authorized:

1. Phase 1 — Control Plane shell / nav for Models, Computers, Connections  
2. or Phase 2 continue — pairing code + require token on loopback + CLI `hoosh doctor/login`

---

**End of Phase 0.5 report.**
