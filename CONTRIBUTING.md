# Contributing to Hoosh AI

Thanks for your interest in improving Hoosh AI. This project is **source-available** under the [LICENSE](LICENSE). Contributions are welcome for bug fixes, documentation, tests, and features that fit the local-first product direction.

## Contribution flow

```text
Fork → Clone → Create branch → Make changes → Run tests → Run build → Commit → Push → Open Pull Request → Code Review → Merge
```

1. Fork the repository on GitHub.
2. Clone your fork and add the upstream remote if needed.
3. Create a topic branch from `main` (e.g. `fix/runtime-health` or `docs/readme-typo`).
4. Make focused changes — avoid unrelated refactors.
5. Run validation (below).
6. Commit with a clear message (what/why).
7. Push to your fork and open a Pull Request using the PR template.
8. Address review feedback.

## Development setup

```bash
git clone https://github.com/<your-user>/Hoosh-AI-App.git
cd Hoosh-AI-App
npm install
cp .env.example .env.local   # optional
npm run dev                  # UI + companion
```

Desktop shell (optional):

```bash
pip install -r desktop/requirements.txt
npm run build && npm run desktop
```

## Coding standards

- Match existing style in the files you edit (TypeScript/React, Node, Python).
- Prefer small, reviewable PRs.
- Do not rewrite architecture or rebrand without maintainer agreement.
- Do not introduce conventional “Open Source” license claims that contradict [LICENSE](LICENSE).

## Testing requirements

Before opening a PR, run what applies:

```bash
npm test          # security + model-tier checks
npm run build     # tsc + vite production build
```

Add or update tests when fixing bugs that can be covered by existing script patterns under `scripts/`.

There is no separate `npm run lint` script in this repository today; rely on TypeScript (`tsc` via `npm run build`) and project review.

## Commit guidance

- Use concise, imperative subjects (e.g. `fix: reject non-desktop UI without token`).
- Explain non-obvious motivation in the body when needed.
- Do not commit build artifacts, `node_modules`, `.env`, keys, or large binaries.

## Pull request requirements

- Fill out the PR template completely.
- Link related Issues.
- Document breaking changes.
- Include screenshots for UI changes when practical.
- Confirm no secrets are included.

## Documentation

Update README or `docs/` when behavior, commands, or configuration change.

## Security restrictions

- **Never** commit API keys, tokens, passwords, private keys, or `.env` files.
- **Never** paste secrets into Issues or PRs.
- Report vulnerabilities via [SECURITY.md](SECURITY.md), not public Issues.

## License of contributions

By submitting a Contribution, you agree to the Contribution terms in [LICENSE](LICENSE).

## Code of Conduct

Participants are expected to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
