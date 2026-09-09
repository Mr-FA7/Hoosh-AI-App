# Developer / engineering post

**Status:** READY  
**Audiences:** r/SideProject (tech-heavy), later r/LocalLLaMA after participation  
**Lead with GitHub** when the community is technical.

---

## Title

Building Hoosh AI: Web Control Plane + local Node Runtime + PyQt desktop shell (lessons so far)

## Body

I’m the creator of **Hoosh AI**. Sharing architecture decisions and asking for critique from builders.

### Problem

Many “AI IDE” flows push you through a hosted UI or assume cloud models. I wanted:

1. Runtime on the machine (`127.0.0.1`)
2. BYO models
3. A dedicated desktop shell so the Control Plane isn’t meant to run as a random browser tab against localhost

### Stack (actual)

- UI: React + TypeScript + Vite  
- Runtime: Node / Express (`companion.js` + `lib/`)  
- Desktop: PyQt6 WebEngine (`desktop/`) with UA/token gate  
- Hosting for marketing site: Firebase App Hosting (`AIHoosh.com`)  
- Electron remains optional/legacy packaging  

### Interesting engineering bits

- Desktop shell starts companion, waits for health, opens Qt WebEngine with a shared token  
- When `FA7_DESKTOP_SHELL=1`, non-shell browsers get a “use Hoosh Desktop” response instead of the full UI  
- Packaging: PyInstaller + DMG; Gatekeeper forces Terminal-based install until Developer ID notarization  

### Source / license

- https://github.com/Mr-FA7/Hoosh-AI-App  
- Source-available license (personal use + contribution; commercial redistribution restricted) — see LICENSE  

Download landing: https://AIHoosh.com  

### Questions for other engineers

- Prefer binding Runtime only on loopback forever, or optional authenticated LAN later?  
- Any pitfalls you’ve hit with PyQt WebEngine + local SPAs?  
- Better first-run UX for unsigned macOS apps short of notarization?

I’ll engage on comments. Not looking for “upvote please” — looking for sharp feedback.
