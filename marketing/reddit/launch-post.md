# Launch post (general / r/SideProject style)

**Status:** PUBLISHED  
**Primary community:** r/SideProject  
**URL:** https://www.reddit.com/r/SideProject/comments/1wbdzzr/i_built_hoosh_ai_a_localfirst_desktop_agent/  
**Do not cross-post identical text elsewhere.**

---

## Title

I built Hoosh AI — a local-first desktop agent platform (bring your own models) and I’d love technical feedback

## Body

Hi — I’m the developer of **Hoosh AI** (FA7 Labs LTD).

### What it is

Hoosh is a **local-first agent platform that works with models you choose** (not a Hoosh-hosted model product): a Control Plane UI plus a Local Runtime on your machine. You bring the intelligence (Ollama, LM Studio, OpenAI-compatible APIs, etc.). The core idea is orchestration + tools + environment, not selling Hoosh-hosted inference.

### Why I built it

I wanted a desktop-oriented workflow where the UI and Runtime stay on localhost, models can be local, and the public website is mainly for download/discovery—not the place where the IDE has to live.

### What’s in v1.0.0 (verified)

- Local Runtime (`companion.js`) for project/tools workflows on `127.0.0.1`
- React Control Plane UI
- **Hoosh Desktop** shell (PyQt6 WebEngine) that loads the local UI and gates non-shell browsers when desktop mode is on
- Optional Electron packaging still exists, but the PyQt shell is the primary desktop path
- Source on GitHub; installers distributed via GitHub Releases
- **License:** source-available (Personal Use & Community Contribution) — **not** a conventional Open Source license

### How it works (short)

```text
AIHoosh.com (download)
   → Hoosh Desktop
   → localhost Runtime + UI
   → your models / tools
```

### Download / source

- Download: https://AIHoosh.com  
- Source: https://github.com/Mr-FA7/Hoosh-AI-App  
- Installers/releases: https://github.com/Mr-FA7/Hoosh-AI-Releases  

### Known limitations (honest)

- macOS builds are **not Apple-notarized**; Gatekeeper may show “Not Opened” — install via Terminal steps in the DMG (`START HERE.txt`)
- Large vendor trees and dependency audits are ongoing; see repo docs
- Screenshots aren’t in the initial public docs set yet — happy to answer questions in comments

### Feedback I’m looking for

1. Does the local-first + BYO-model positioning make sense?  
2. What’s confusing in first-run (especially Mac install)?  
3. What would you want next for agent/tooling workflows?

Thanks — I’ll hang out in the comments.
