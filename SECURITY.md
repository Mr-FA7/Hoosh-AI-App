# Security Policy

## Supported versions

Security fixes are prioritized for the latest released version on the `main` branch and the latest GitHub Release tag.

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes |
| older   | Best effort |

## Reporting a vulnerability

**Do not** file a public GitHub Issue for security vulnerabilities that could enable unauthorized access, remote code execution, or data exposure.

**Do not** publish secrets, credentials, private keys, session tokens, or private personal data in Issues, PRs, or Discussions.

### Preferred channel

Use **GitHub Private Vulnerability Reporting** for this repository (Security → Advisories / “Report a vulnerability”), when enabled on the repository.

If private reporting is not yet available in the UI, open a **minimal** GitHub Issue titled `Security contact request` **without** vulnerability details, and wait for a maintainer to establish a private channel.

### What to include (in the private report)

- Affected component (UI, companion Runtime, desktop shell, packaging, etc.)
- Description of the issue and potential impact
- Reproduction steps (proof-of-concept without weaponizing)
- Affected version / commit if known
- Any mitigations you already identified

### What we will try to do

- Acknowledge the report
- Assess severity and scope
- Coordinate a fix and disclosure timing when appropriate

## Safe Harbor

We welcome good-faith research. Avoid privacy violations, destruction of data, and disruption of production services you do not own.

## Application security notes

- The web UI is not the security boundary for local Runtime capabilities.
- Prefer binding the Runtime to `127.0.0.1` unless you knowingly expose it.
- Treat user-configured cloud API keys as sensitive; store them only in local secure storage mechanisms provided by the app/OS.
