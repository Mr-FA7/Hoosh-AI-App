# Universal AI Terminal (UAT) — Architecture

## 1. Vision

UAT is a **local-first**, **cross-platform** terminal platform: a shell execution engine, a command-intelligence layer (optional LLM), safety policy, observability, extensibility (plugins), and operational tooling (runtime installation, self-update). The design targets **reliability, auditability, and safe extension**—not a single monolithic script.

## 2. Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Presentation Layer                             │
│  (CLI `uat` · Electron/Tauri UI · IDE extensions)                  │
└────────────────────────────┬──────────────────────────────────────┘
                             │ IPC / stdio / WebSocket (optional)
┌────────────────────────────▼──────────────────────────────────────┐
│                   Orchestration & Session API                      │
│  SessionManager · CommandPipeline · PluginHost                     │
└─────┬──────────────┬──────────────┬──────────────┬──────────────────┘
      │              │              │              │
┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
│ Command   │ │ Shell       │ │ AI        │ │ Safety &    │
│ Router &  │ │ Engine      │ │ Intel.    │ │ Audit       │
│ Unified   │ │ (PTY/spawn) │ │ Layer     │ │ (policy+log)│
│ Commands  │ │             │ │           │ │             │
└─────┬─────┘ └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
      │              │              │              │
┌─────▼──────────────▼──────────────▼──────────────▼──────────────┐
│ OS Detection · Path Normalization · Exit Code Mapping            │
└────────────────────────────┬────────────────────────────────────┘
┌────────────────────────────▼────────────────────────────────────┐
│ Connectivity Layer (HTTPS) · Self-Update · Package Managers    │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Core Components

| Module | Responsibility |
|--------|----------------|
| **OS Detector** | `platform`, `arch`, preferred shell, distro hints (Linux), package manager preference |
| **Shell Engine** | Execute in CMD / PowerShell / bash / zsh with unified result `{ stdout, stderr, exitCode, shell }` |
| **Unified Commands** | Intent → OS-specific command strings (e.g. list files → `dir` / `ls -la`) |
| **Command Router** | Classify input (natural language vs shell), apply unified map, delegate to AI if needed |
| **Command Intelligence** | NL → command via Ollama (local) or OpenAI (optional); system prompt includes OS context |
| **Safety Policy** | Regex/heuristic dangerous patterns; confirmation gates; sandbox flag (future: container/VM) |
| **Audit Logger** | Append-only JSONL under user config dir |
| **Runtime Manager** | Recipes for installing runtimes via brew/apt/choco/scoop (never silent `sudo` without policy) |
| **Package Manager Abstraction** | Detect project fingerprints (package.json, Cargo.toml, …) and suggest install commands |
| **Self-Update** | Fetch release metadata (e.g. GitHub), verify SHA-256; production adds signature verification |
| **Plugin Loader** | Load Node plugins from `plugins/` with manifest validation |

## 4. Data Flow (Execute Command)

1. User input → **Router** (raw shell vs NL vs `uat` subcommand).
2. If NL → **Intelligence** (optional) → proposed command string.
3. **Safety** → block / confirm / allow.
4. **Shell Engine** → spawn with correct shell and cwd/env.
5. **Logger** → record metadata + truncated output.
6. Unified response to UI.

## 5. Self-Update (Design)

- **Source of truth**: GitHub Releases API (or private mirror) with semver.
- **Integrity**: SHA-256 of artifact in release notes or `checksums.txt`; **signature** (Ed25519/Minisign) in production.
- **Rollback**: Keep previous binary in `~/.uat/versions/<version>/` and symlink `current`.
- **Command**: `uat update` / `uat upgrade self` → check → download → verify → atomic swap → restart.

## 6. Local-First & AI

- Core terminal and routing work **offline**.
- AI is **optional**: Ollama default host `OLLAMA_HOST`, OpenAI via `OPENAI_API_KEY` only if enabled.

## 7. Security Posture

- No arbitrary code execution from network without user confirmation.
- Dangerous patterns (e.g. `rm -rf /`, disk format, registry wipes) require explicit confirmation.
- Plugins run with same privileges as the host process—manifest allowlists recommended for production hardening.

## 8. Extension Points

- **Plugins**: export `{ name, version, register(api) }` where `api` exposes `registerCommand`, `onBeforeExecute`.
- **Future**: WASM sandbox for untrusted plugins.

## 9. Technology

- **Runtime**: Node.js ≥ 18 (fetch, streams).
- **IPC**: stdio for CLI; optional `ws` for remote UI (not required for core).

---

*This document is the canonical high-level design; implementation lives in `src/`.*
