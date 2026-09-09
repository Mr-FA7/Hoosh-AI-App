# AI community post (LocalLLaMA / Ollama-adjacent)

**Targets:** r/LocalLLaMA (after 1/10 participation + disclosure), r/Ollama (only if rules/modmail OK).  
**Status:** READY later — **COMMUNITY PARTICIPATION FIRST**.  
Do **not** lead with marketing. Lead with local-model workflow.

---

## Title

I built a local-first agent Control Plane that expects you to bring Ollama / LM Studio / your own API — feedback welcome

---

## Body

Disclosure: I’m the developer of **Hoosh AI**.

### Pitch in one sentence

Hoosh is a **local-first agent environment** (UI + Local Runtime). It does **not** sell you a foundation model — you point it at Ollama, LM Studio, or other endpoints you already run.

### Why this might matter here

A lot of local-LLM discussion is about models and inference. Hoosh sits one layer up: projects, tools, terminal/Git-oriented agent workflows, and a desktop shell so the Control Plane isn’t “the website + a fragile bridge.”

### Technical notes

- Runtime binds locally by default (Architecture v2 style).  
- Desktop shell can require a Hoosh-Desktop UA/token so random browsers aren’t the Control Plane client.  
- Source is public and **source-available** (not OSI Open Source): https://github.com/Mr-FA7/Hoosh-AI-App  

### Download

https://AIHoosh.com  
Installers also on https://github.com/Mr-FA7/Hoosh-AI-Releases  

### Honest asks

- What breaks first when you try a new agent shell against Ollama?  
- Do you want stricter offline mode defaults, or easier cloud fallbacks?  
- Any deal-breakers in a source-available (not MIT/Apache) license for tools you’d actually run?

I’ll answer comments and take harsh technical criticism.
