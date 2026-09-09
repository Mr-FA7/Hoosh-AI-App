# Third-Party Notices

Hoosh AI includes or depends on third-party software. Those components remain under their own licenses. This file summarizes major categories discovered during the public-release audit. It is not a complete SPDX bill of materials.

## npm production dependency license summary

Generated via `license-checker --production --summary` (approximate counts of transitive packages):

| License | Approx. package count |
|---------|------------------------|
| MIT | 284 |
| Apache-2.0 | 58 |
| ISC | 28 |
| BSD-3-Clause | 14 |
| MPL-2.0 | 2 |
| CC-BY-4.0 | 1 |
| BSD-2-Clause | 1 |
| 0BSD | 1 |

Direct runtime/dev libraries declared in `package.json` include (non-exhaustive): React, Vite, TypeScript, Express, Firebase, Monaco Editor, xterm.js, Electron, Playwright, Ollama JS client, Framer Motion, Zustand, Tailwind CSS, Lucide icons, and others listed in `package.json`.

For exact license text, inspect each package under `node_modules/<name>/LICENSE*` after `npm install`, or regenerate with:

```bash
npx license-checker --production --relativeLicensePath
```

## Python desktop shell

Declared in `desktop/requirements.txt`:

- PyQt6 / PyQt6-WebEngine (Riverbank / Qt licensing applies to those components)

## Bundled vendor trees

The repository currently tracks large trees under:

- `external/`
- `vendor/`

These include third-party project materials (notably Ollama-related trees). Their upstream licenses continue to apply. Do not assume they are covered by the Hoosh LICENSE.

## Fonts / icons / assets

- Lucide React icons (ISC) via npm
- Google Fonts may be loaded by marketing UI from Google’s CDN when that page is viewed
- Project images under `public/` / `assets/` — treat as project branding unless otherwise marked (see TRADEMARKS.md)

## Models and datasets

Large local model weights under `models/` are gitignored and are **not** redistributed by this repository’s default publication. Any models you download yourself are subject to their own licenses.

## Attribution requirement

When redistributing Hoosh **as permitted by the Hoosh LICENSE**, preserve third-party notices and do not remove upstream license files required by those components.
