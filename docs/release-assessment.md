# Phase 0–1 Release Assessment (internal)

Generated during public-release preparation. Based on repository inspection only.

## Application type

Local-first AI agent / IDE Control Plane with:
- Web UI (React + Vite + TypeScript)
- Local Runtime (`companion.js` / Node Express)
- Optional Electron packaging
- Primary desktop shell: PyQt6 WebEngine (`desktop/`)
- Hosted marketing site on Firebase App Hosting (`aihoosh.com`)

## Languages / frameworks

| Layer | Stack |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind, Monaco, Firebase Auth |
| Runtime | Node.js (Express), companion modules under `lib/` |
| Desktop shell | Python 3 + PyQt6 / PyQt6-WebEngine |
| Hosting | Firebase App Hosting (`server.js` + `apphosting.yaml`) |

## Package managers

- npm (`package.json` / `package-lock.json`)
- pip (`desktop/requirements.txt`)

## Build / test

| Command | Purpose |
|---------|---------|
| `npm run build` | `tsc && vite build` (+ prebuild bridge pack) |
| `npm test` | `test-security.js` + `test-model-tiers.js` |
| `npm run smoke` | smoke-test.js |
| `npm run desktop` | PyQt shell |
| `.github/workflows/release.yml` | Electron builder on tags `v*` |

## Platforms (verified in packaging scripts)

- macOS (DMG / companion / desktop shell)
- Windows (exe / zip packaging scripts)
- Linux (electron-builder targets in package.json)

## Version / branch / remote

- Version source: `package.json` → **1.0.0**
- Branch: `main`
- Remote: `https://github.com/Mr-FA7/Hoosh-AI-App.git`
- Visibility at audit: **PRIVATE**
- Related public installers repo: `Mr-FA7/Hoosh-AI-Releases`

## Release readiness (pre-work)

| Item | Status |
|------|--------|
| LICENSE | Missing |
| README | Missing |
| Community files | Missing |
| CI (lint/test/build) | Partial (`release.yml` only) |
| Secrets in tree | Firebase **client** web config present (documented public-by-design); no private keys / `.env` files found |
| Blocking secrets | None identified for STOP |

## Security audit notes (Phase 1)

- No `.env`, `.pem`, or private key files in working tree.
- Hardcoded Firebase web `apiKey` / project identifiers in `src/lib/firebase.ts` — Firebase client identifiers (not service-account secrets). History contains same values since auth commit.
- Test fixtures use obvious fake keys (`test_key_123`, scanner examples).
- Recommend: env-based Firebase config, Google Cloud API key HTTP-referrer restrictions, App Check.

## Non-goals of this release prep

- No application rewrite
- No architecture migration
- Vendor trees `external/` + `vendor/` retained; documented as third-party copies
