# Hoosh AI

**Version:** 1.0.0  
**Website:** [https://aihoosh.com](https://aihoosh.com)  
**Installers:** [Hoosh-AI-Releases](https://github.com/Mr-FA7/Hoosh-AI-Releases/releases)

> **Hoosh AI is source-available software.** The source code is publicly available for transparency, personal/local use, updates, inspection, and community contribution. It is **not** released under a conventional permissive Open Source license. Commercial redistribution, resale, commercial repackaging, and unauthorized commercial derivative products are restricted by the project [LICENSE](LICENSE).

---

## Overview

Hoosh AI is a **free, local-first, model-agnostic AI agent platform**. It provides orchestration, tools, workflows, and a local Runtime so you can bring your own models (Ollama, LM Studio, OpenAI-compatible APIs, and similar) instead of buying Hoosh-hosted inference.

Typical topology:

- **Control Plane UI** — React app (runs inside Hoosh Desktop, or locally in development)
- **Hoosh Local Runtime** — Node.js companion (`companion.js`) on `127.0.0.1`
- **Marketing site** — [aihoosh.com](https://aihoosh.com) for pitch + downloads only

## Features

Verified capabilities present in this repository include:

- Local project workspace, editor, terminal, Git, and agent tooling
- Local Runtime companion with device auth / pairing surfaces
- Model Hub style local/cloud provider configuration (user-supplied keys and endpoints)
- Desktop shell (`desktop/`) using PyQt6 WebEngine with Runtime gate
- Optional Electron packaging (legacy/optional)
- Browser extension bridge packaging scripts (legacy advanced path)
- CLI helpers (`npm run hoosh-cli`) and smoke/security test scripts

## Screenshots

Screenshots are not bundled in this repository at initial public release. See the live marketing site or project Discussions for visuals when published.

## Architecture

High-level:

```text
aihoosh.com (marketing)
        │ download
        ▼
Hoosh Desktop (PyQt6 WebEngine)
        │ UA + token → localhost
        ▼
companion.js (Local Runtime) → FS / Terminal / Git / Docker / LLMs
```

Deeper design notes: [`docs/architecture-v2.md`](docs/architecture-v2.md), [`docs/desktop-offline.md`](docs/desktop-offline.md).

## Requirements

- **Node.js** 20+ recommended (22 used in development)
- **npm** (lockfile present)
- **Python 3** + PyQt6 / PyQt6-WebEngine for the desktop shell
- Optional: Ollama / LM Studio / Docker depending on features you use
- macOS / Windows / Linux as targeted by packaging scripts (native modules such as `node-pty` are platform-specific)

## Installation

### End users (desktop)

1. Download installers from [Hoosh-AI-Releases](https://github.com/Mr-FA7/Hoosh-AI-Releases/releases).
2. **macOS:** open the DMG, then install via Terminal (Gatekeeper blocks unsigned `.app` double-clicks). See `START HERE.txt` inside the DMG or [docs/desktop-offline.md](docs/desktop-offline.md).
3. **Windows:** extract the zip and follow `README.txt` / `Start Hoosh.bat`.

### Developers (from source)

```bash
git clone https://github.com/Mr-FA7/Hoosh-AI-App.git
cd Hoosh-AI-App
npm install
cp .env.example .env.local   # optional overrides
npm run build
npm run companion            # Local Runtime
# in another terminal, for UI during development:
npm run dev
```

Desktop shell:

```bash
pip install -r desktop/requirements.txt
npm run build
npm run desktop
```

## Configuration

- Runtime bind/port: `FA7_BIND`, `FA7_PORT` (default local bind expected for Architecture v2)
- Desktop gate: `FA7_DESKTOP_SHELL`, `FA7_DESKTOP_TOKEN` (set by the desktop shell)
- Browser escape hatch for local debugging: `FA7_ALLOW_BROWSER=1`
- Firebase Auth (hosted account features): `VITE_FIREBASE_*` — see `.env.example`

## Environment Variables

See [`.env.example`](.env.example). Do not commit `.env` files or secrets.

## Running Locally

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite UI + nodemon companion |
| `npm run companion` | Runtime only |
| `npm start` | Serve production `dist/` via `server.js` |
| `npm run desktop` | PyQt desktop shell |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm test                 # security + model-tier scripts
npm run build            # typecheck + Vite production build
```

## Building

```bash
npm run build
# Electron (optional legacy):
npm run electron:build:mac   # or :win / :linux
# PyQt desktop packaging:
npm run desktop:package:mac
npm run desktop:package:win
```

## Updating

- **From source:** `git pull` then `npm install` and rebuild.
- **Desktop installers:** download the latest release from Hoosh-AI-Releases and re-run the install script.

## Troubleshooting

- **macOS “Not Opened”:** unsigned builds are blocked by Gatekeeper. Use the Terminal one-liner in the DMG’s `START HERE.txt` — do not double-click `Hoosh.app`.
- **Companion not reachable:** ensure Node is installed; check `~/.hoosh/desktop-companion.log` when using the desktop shell.
- **Chrome cannot open localhost Control Plane:** expected when desktop gate is on; use Hoosh Desktop or `FA7_ALLOW_BROWSER=1` for debugging only.

## Project Structure

```text
src/           React Control Plane UI
companion.js   Local Runtime entry
lib/           Runtime libraries
desktop/       PyQt6 Hoosh Desktop shell
docs/          Architecture and phase reports
scripts/       Packaging, CLI, tests
extensions/    Browser bridge extensions
public/        Static assets served with the web build
```

## Security

- Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).
- Never open Issues containing API keys, tokens, or passwords.
- Frontend is not the security boundary; Runtime auth and OS permissions matter.

## Privacy

See [PRIVACY.md](PRIVACY.md). Core design is local-first; optional cloud model providers receive whatever you send them when configured.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Distributed under the **Hoosh AI App Personal Use & Community Contribution License** — see [LICENSE](LICENSE).

| Question | Answer (per LICENSE) |
|----------|----------------------|
| Inspect / run locally? | Yes |
| Personal modification? | Yes |
| Contribute via PR? | Yes |
| Conventional Open Source? | **No** |
| Sell / commercially redistribute? | **No** (without written permission) |

## Copyright

Copyright © 2026 Fardin Ahrari / Mr-FA7 / FA7 Labs LTD.  
Trademarks: [TRADEMARKS.md](TRADEMARKS.md).

## Third-Party Software

Dependency licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Disclaimer

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND. See LICENSE for warranty disclaimer and liability limits. Use local and cloud AI tools responsibly and in accordance with third-party provider terms.
