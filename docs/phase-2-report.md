# Phase 2 — Runtime harden + secure pairing — completion report

> **Date:** 2026-09-09  
> **Status:** COMPLETE — STOP (Wave 1).  
> **Checks:** `npm run test:security` → **99/99**; `tsc --noEmit` clean; CLI `connect` smoke.  
> **Next:** Wave 2 (Phases 3–7) after authorization / continuous plan execution.

---

## 1. What was built

- **Pairing codes** — `POST /api/v3/runtime/pair/start|confirm`, `GET .../pair/status` (6-digit, ~10 min TTL)
- **Sessions** — short-lived session tokens in `~/.aivon-os/runtime-sessions.json`; accepted via `X-Hoosh-Device-Token` / Bearer
- **Revoke** — per-session + revoke-all with device token rotation
- **Capabilities** — `GET /api/v3/runtime/capabilities` (+ health embeds capabilities)
- **Origin allowlist** — default localhost Control Plane + extension schemes
- **Devices list** — SQLite `devices` + `runtime_sessions`; `GET /api/v3/runtime/devices`
- **Computers UI** — Add Computer / pair code / confirm / revoke all
- **CLI** — `connect` / `pair` / `disconnect`
- **Contracts** — `RUNTIME_API_SURFACE` expanded

---

## 2. Architecture changes

- Bootstrap (loopback) remains for same-machine Vite/Electron/bridge
- Pairing is the Web Control Plane path for durable sessions
- Frontend still not the security boundary

---

## 3. Files changed / added

| Path | Change |
|------|--------|
| `lib/deviceAuth.js` | pairing, sessions, revoke, origins |
| `lib/coreSchema.js` | schema v2 + `runtime_sessions` |
| `lib/hooshCoreStore.js` | upsertDevice / listDevices / upsertRuntimeSession |
| `companion.js` | pair/devices/sessions/revoke routes |
| `src/components/ComputersView.tsx` | pairing UX |
| `src/lib/runtimeBootstrap.ts` | storePairingSession / clearCachedDeviceToken |
| `src/i18n/messages.ts` | EN/FA computers.* |
| `scripts/hoosh-cli.js` | connect / disconnect |
| `scripts/test-security.js` | pair + origin tests |
| `src/hoosh/contracts/index.ts` | API surface |
| `docs/phase-2-report.md` | this file |

---

## 4. Database changes

- Schema version **2**: `devices.status`, table `runtime_sessions`
- File store: `runtime-sessions.json` (0600)

---

## 5. APIs added

- `POST /api/v3/runtime/pair/start|confirm`
- `GET /api/v3/runtime/pair/status|capabilities|sessions|devices`
- `POST /api/v3/runtime/sessions/revoke`
- `POST /api/v3/runtime/revoke`
- `PATCH /api/v3/runtime/device`

---

## 6. Tests

- Pairing start/confirm/revoke + origin allowlist in `test-security.js` (99 passed)

---

## 7. Security implications

- Pair start still **loopback-only** (attacker on LAN cannot mint codes without local access)
- Confirm accepts code from any client that can reach Runtime (intended for Web CP on same host via proxy/bridge)
- Loopback still bypasses token for DX; LAN requires token
- Revoke rotates long-lived device token

---

## 8. Known limitations

- No QR rendering (code text only)
- No multi-LAN relay / remote pairing over internet
- Origin checks soft on Referer; primary gate is Origin header when present
- Bridge still uses bootstrap token (sufficient for same-machine)

---

## 9. Next phase

Wave 2: Phase 3 (workspace polish) → Phase 4 (Model Hub) → Phase 5 (AgentRun) → Phase 6 (permission enforce) → Phase 7 (tools registry).
