# Launch post — general (r/SideProject style)

**Target:** communities that allow project showcases (esp. r/SideProject).  
**Status:** READY for manual publication after live rule check.  
**Do not** paste this unchanged into LocalLLaMA / programming / opensource.

---

## Title options (pick one)

1. I built Hoosh AI — a local-first desktop agent platform (bring your own models). Looking for feedback  
2. Show: Hoosh AI — Control Plane + local Runtime for agent workflows on your machine  

---

## Body

Hey — I’m the developer of **Hoosh AI**.

I built a **local-first, model-agnostic agent platform**: a Control Plane UI plus a Local Runtime that runs on your machine. You bring the intelligence (Ollama, LM Studio, OpenAI-compatible APIs, etc.). Hoosh is about orchestration, tools, and environment — not selling you a proprietary model.

### Why I built it

I wanted a desktop-oriented agent environment that stays useful offline for core work, without forcing the website to be the IDE. The public site is for discovery/download; the real product runs locally.

### What it does (verified)

- Local Control Plane UI (projects, agent tooling, terminal/Git-oriented workflows)
- Local Runtime (`companion`) for machine capabilities
- Desktop shell (PyQt WebEngine) so the UI can run in a dedicated local window
- Bring-your-own models / endpoints
- Source available on GitHub for inspection and contribution under a **source-available** license (not a conventional Open Source license)

### How it works (short)

Marketing site → download desktop installer → app starts Local Runtime on localhost → UI loads inside the desktop shell.

### Download / source

- Product / download: https://AIHoosh.com  
- Source: https://github.com/Mr-FA7/Hoosh-AI-App  
- Installers / releases: https://github.com/Mr-FA7/Hoosh-AI-Releases  

### Known limitations (honest)

- macOS builds are **not Apple-notarized**, so Gatekeeper may show “Not Opened” — install via Terminal steps in the DMG (`START HERE.txt`)
- Electron packaging exists but the primary local UI path is the PyQt desktop shell
- Cloud providers only see what you choose to send when you configure them

### Feedback I’m looking for

1. What’s confusing in first-run install?  
2. What agent/runtime capability would you need next?  
3. For local-model users: does the “bring your own model” story make sense?

Happy to answer technical questions in the comments. Thanks for reading — and please be kind but blunt.
