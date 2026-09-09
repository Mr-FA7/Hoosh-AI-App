# Changelog

All notable changes to Hoosh AI App are documented in this file.

Format inspired by Keep a Changelog. Versioning follows the `version` field in `package.json`.

## [1.0.0] — 2026-09-09

### Added

- Initial public source-available release preparation (documentation, LICENSE, community files, CI workflows).
- Local-first Control Plane UI (`src/`) with Firebase Auth integration for account surfaces.
- Hoosh Local Runtime (`companion.js` and `lib/`) for filesystem, terminal, tooling, and model provider integration.
- Hoosh Desktop PyQt6 WebEngine shell (`desktop/`) with Runtime desktop gate.
- Marketing landing for hosted `aihoosh.com` download flow.
- Packaging scripts for macOS/Windows desktop artifacts and legacy bridge installers.
- Security and model-tier test scripts (`npm test`).

### Changed

- Hosted website path oriented to marketing + download rather than full IDE-in-browser as the primary product.

### Security

- Desktop Runtime gate rejects non-shell browsers when `FA7_DESKTOP_SHELL` is enabled.
- Firebase client config can be overridden via `VITE_FIREBASE_*` environment variables.

### Known limitations

- macOS builds are not Apple notarized; Gatekeeper “Not Opened” requires Terminal-based install (see docs).
- Electron packaging remains available but PyQt desktop shell is the primary local UI path.
- Large `external/` and `vendor/` trees are retained from prior development; see THIRD_PARTY_NOTICES.md.

[1.0.0]: https://github.com/Mr-FA7/Hoosh-AI-App/releases/tag/v1.0.0
