# Desktop community post (r/macapps App Pile format)

**Target:** r/macapps **App Pile megathread** (default for non–App Store / non-tier apps).  
**Status:** READY for megathread comment — **not** main-feed promo unless Tier 2 transparency is met.  
**Frequency:** at most once per developer / 30 days (per common MacApps rule summaries).

Use Problem / Comparison / Pricing structure expected by the community.

---

## Megathread comment draft

**Problem:** I wanted a Mac desktop agent app that runs locally (BYO Ollama/LM Studio/APIs) without making the website the IDE, and without pretending unsigned builds are notarized.

**App:** Hoosh AI — local-first agent Control Plane + Local Runtime, with a PyQt desktop shell.

**Comparison:** Closer to “local agent/IDE environment” than a single-chat Mac App Store wrapper. Unlike browser-only AI sites, core use is meant to run on-device with your models. Unlike many “open source” tools, Hoosh is explicitly **source-available** (personal use + contribution; commercial redistribution restricted) — I’m stating that up front.

**Pricing:** Free for core local use. No Hoosh token sales for core. Download: https://AIHoosh.com · Source: https://github.com/Mr-FA7/Hoosh-AI-App · Installers: https://github.com/Mr-FA7/Hoosh-AI-Releases  

**Platforms:** macOS (+ Windows packaging). Node.js required for Runtime. Mac Gatekeeper: use Terminal install steps in the DMG (`START HERE.txt`) — builds are not Apple-notarized.

**Disclosure:** I’m the developer.

**Feedback wanted:** first-run friction on Mac, and whether the desktop-shell-only localhost gate feels right.
