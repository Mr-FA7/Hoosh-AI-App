# Hoosh Public / Operator API (Phase 15 note)

> Cloud sync and Organizations are **deferred**. Core execution stays local.

## Runtime (localhost)

Base: `http://127.0.0.1:3001` (bind default). Auth: `X-Hoosh-Device-Token` or Bearer session token. Loopback clients may bootstrap without token.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v3/runtime/health` | Liveness |
| GET | `/api/v3/runtime/bootstrap` | Loopback device token |
| GET | `/api/v3/runtime/doctor` | Diagnostics |
| GET | `/api/v3/runtime/capabilities` | Capability negotiation |
| POST | `/api/v3/runtime/pair/start` | Pairing code (loopback) |
| POST | `/api/v3/runtime/pair/confirm` | Confirm pairing → session |
| POST | `/api/v3/runtime/revoke` | Revoke sessions / rotate |
| GET | `/api/v3/runtime/devices` | Device list |
| GET\|POST | `/api/v3/permission/preset` | Safe / Full presets |
| POST | `/api/ai/chat` | Universal agent chat |
| GET | `/api/v3/tools/registry` | Native / MCP / Skills / Extensions |
| GET\|POST | `/api/v3/tasks` | Tasks |
| GET\|POST | `/api/v3/rooms` | Agent Rooms MVP |
| GET | `/api/v3/artifacts` | Artifacts |
| GET | `/api/v3/agent-runs` | AgentRun list |

## CLI

```bash
node scripts/hoosh-cli.js doctor
node scripts/hoosh-cli.js status
node scripts/hoosh-cli.js connect
node scripts/hoosh-cli.js connect 123456
node scripts/hoosh-cli.js disconnect
node scripts/hoosh-cli.js mission "…"
```

Env: `HOOSH_API`, `HOOSH_DEVICE_TOKEN`.

## Agent server

See `lib/agentServer.js` (`/api/agent/v1/*`) — same permission boundary as UI/CLI; productize auth further in later hardening.
