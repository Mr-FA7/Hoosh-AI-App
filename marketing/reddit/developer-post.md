# Developer / engineering post

**Targets:** r/SideProject (alt angle), later r/LocalLLaMA (after participation), **not** r/programming unless rewritten as a pure technical article with almost no product CTA.

**Status:** READY (adapt title/depth per community).

---

## Title

Building Hoosh’s local Runtime + desktop shell: why the website stopped being the IDE

---

## Body

I’m the creator of **Hoosh AI**. This is a short engineering note on a product decision, not a “download now” ad.

### Problem

A hosted web IDE + “install a local bridge” path is fragile: browsers, Private Network Access prompts, Gatekeeper, and users who just want something that works offline for core tasks.

### Approach we shipped

1. **Marketing site only** at https://AIHoosh.com (download / pitch).  
2. **Desktop shell** (PyQt6 WebEngine) loads the Control Plane from `127.0.0.1`.  
3. **Local Runtime** stays Node (`companion.js`) — we did **not** rewrite the Runtime in Python.  
4. A **desktop UA/token gate** so Chrome/Safari can’t usefully drive the local Control Plane when the shell mode is on.  
5. Source published as **source-available** (personal use + contribution; commercial redistribution restricted) — https://github.com/Mr-FA7/Hoosh-AI-App  

### Trade-offs

- Unsigned Mac apps still hit Gatekeeper; we document Terminal install instead of pretending notarization exists.  
- Shipping Qt WebEngine increases installer size.  
- Vendored/third-party trees in the repo need careful licensing attribution.

### What I’d love feedback on

- Is gating localhost UI to the desktop shell the right UX trade-off?  
- Prefer Electron vs PyQt for a project like this, and why?  
- What would you want in a “doctor / first-run” flow for local agent runtimes?

Links if useful: https://AIHoosh.com · https://github.com/Mr-FA7/Hoosh-AI-App
