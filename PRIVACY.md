# Privacy

This document describes privacy-relevant behavior based on inspection of the Hoosh AI App repository. It is not a substitute for third-party provider policies.

## Summary

Hoosh AI is designed as a **local-first** Control Plane + Local Runtime. Much of your project work can stay on your machine. The project does **not** claim “zero data collection” in all configurations.

## What may stay local

Depending on features you use:

- Project files accessed via the Local Runtime
- Local model traffic to Ollama / LM Studio / similar endpoints you configure on your machine
- Local Runtime state under user directories such as application support / `.hoosh` style paths (when created by the Runtime)

## What may leave your machine

### Optional cloud model providers

If you configure OpenAI-compatible, Anthropic-compatible, or other remote APIs, prompts, code context, and related payloads you choose to send are transmitted to those providers under **their** terms and privacy policies. Hoosh does not control those services.

### Firebase Authentication (account features)

The web/desktop UI initializes Firebase Auth using a Firebase project configuration (see `.env.example` / `src/lib/firebase.ts`). When you sign up or sign in:

- Authentication data is processed by Google Firebase for that project
- Firebase Analytics measurement IDs may be present in client config; do not assume Analytics is disabled unless you verify runtime behavior in your build

### Marketing website

[aihoosh.com](https://aihoosh.com) is a hosted marketing/download surface. Standard web hosting logs and CDN behavior may apply as operated on Firebase App Hosting.

### Updates and downloads

Downloading installers from GitHub Releases involves GitHub’s infrastructure and policies.

## Secrets and credentials

- Do not put production secrets in the repository.
- User-supplied API keys should be treated as sensitive.
- Report accidental secret exposure via [SECURITY.md](SECURITY.md).

## Telemetry

No dedicated third-party product-analytics SDK (e.g. PostHog/Mixpanel) was identified as a core dependency in `package.json` during the public-release audit. UI copy may mention “telemetry” in product surfaces in a general sense. Firebase `measurementId` is present in client config.

## Your choices

- Prefer local models for sensitive work.
- Avoid pasting secrets into chat, Issues, or logs.
- Review provider dashboards and Firebase console settings for your deployment.

## Changes

Privacy-relevant behavior may change as the product evolves. Review this file and release notes when upgrading.
