# Hoosh Local Bridge — Windows installer

## For users

Download **`HooshBridgeSetup.exe`** from [aihoosh.com](https://aihoosh.com) (Connect to your computer panel) or from `public/HooshBridgeSetup.exe` in this repo.

Double-click the installer. It will:

1. Install to `%LOCALAPPDATA%\Programs\Hoosh Bridge`
2. Bundle Node.js and the Hoosh companion (no separate Node/git install)
3. Install the Chrome extension files and launch Chrome with the bridge
4. Create Start Menu + optional desktop shortcut
5. Optionally start companion when Windows starts

After install, use the **Hoosh Local Bridge** shortcut to open aihoosh.com with your PC connected.

## Build the installer (developers)

```bash
npm install
npm run bridge:installer:win
```

Output: `public/HooshBridgeSetup.exe`

Requires network on first build (downloads portable Node 20). Staging runs `npm ci --omit=dev` inside the installer bundle.

## Legacy zip launcher

`hoosh-bridge-setup-win.zip` still works but requires Node.js and git on first run.
