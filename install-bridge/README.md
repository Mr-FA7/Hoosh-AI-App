# Hoosh Local Bridge installers

## Windows

Download **`HooshBridgeSetup.exe`** from [aihoosh.com](https://aihoosh.com).

```bash
npm run bridge:installer:win
```

Output: `public/HooshBridgeSetup.exe`

## macOS

Download **`HooshCompanionSetup.dmg`** from [aihoosh.com](https://aihoosh.com).

Double-click the DMG → **Install Hoosh Companion** → Install.

```bash
npm run bridge:installer:mac
# or (on macOS) as part of:
npm run bridge:pack
```

Output: `public/HooshCompanionSetup.dmg`

## Legacy zips

`hoosh-bridge-setup-mac.zip` / `hoosh-bridge-setup-win.zip` remain as fallbacks.
