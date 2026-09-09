# Hoosh Desktop — offline install & protect

## What you get

- **Hoosh Desktop** (PyQt6 WebEngine) loads the Control Plane only inside its window.
- **Hoosh Runtime** (`companion.js`) binds `127.0.0.1` and requires a desktop UA/token when `FA7_DESKTOP_SHELL=1`.
- **aihoosh.com** is marketing + download only (CTAs → GitHub Releases).

## Dev (repo)

```bash
pip install -r desktop/requirements.txt
npm install
npm run build
python3 desktop/main.py
# or: npm run desktop
```

Escape hatch (allow Chrome against local Runtime): `FA7_ALLOW_BROWSER=1`.

## Protect (PyArmor + optional Cython)

Regfile (local only — **never commit**):

`~/Library/CloudStorage/OneDrive-Personal/pyarmor-regfile-11427.zip`

```bash
pip install pyarmor cython
npm run desktop:protect
# → build/desktop-protected/
```

## Package

```bash
npm run build
npm run desktop:protect          # PyArmor (optional plain: --plain-only)
python3 -m PyInstaller --noconfirm --distpath dist_desktop --workpath build/pyinstaller-desktop desktop/Hoosh.spec
npm run desktop:package:mac      # → public/HooshSetup.dmg
npm run desktop:package:win      # → public/HooshSetup-win.zip (+ exe stub)
```

Publish installers (not committed to git — too large). Repo is private, so use the **public** releases repo:

```bash
gh release create desktop-v1.0.0 public/HooshSetup.dmg public/HooshSetup-win.zip \
  --repo Mr-FA7/Hoosh-AI-Releases \
  --title "Hoosh Desktop 1.0.0" --notes "…"
```

Download URLs used by aihoosh.com:

- https://github.com/Mr-FA7/Hoosh-AI-Releases/releases/latest/download/HooshSetup.dmg
- https://github.com/Mr-FA7/Hoosh-AI-Releases/releases/latest/download/HooshSetup-win.zip

Mac install (Gatekeeper / “Not Opened”):

1. Open the DMG.
2. Open **Terminal** (do not double-click `Hoosh.app` or the `.command`).
3. Paste:

```bash
xattr -cr "/Volumes/Hoosh Desktop" 2>/dev/null; bash "/Volumes/Hoosh Desktop/install.sh"
```

4. Later: `bash "$HOME/Applications/Start Hoosh.command"`

First install runs `npm ci --omit=dev` for Runtime (one-time network). Requires **Node.js**.

## Offline after install

Core path works without the website: local UI + Runtime + Ollama/LM Studio. Internet only for optional cloud models / marketplace / updates / first-time npm deps.
