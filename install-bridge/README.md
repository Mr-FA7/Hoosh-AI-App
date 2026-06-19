# Hoosh Local Bridge — one-click setup

Connect **https://aihoosh.com** to your computer (files, terminal, Ollama, LM Studio, Alma).

## Quick start

### Windows
Double-click **`Start-Hoosh-Bridge.bat`** (or run `Start-Hoosh-Bridge.ps1`).

### macOS
Double-click **`Start-Hoosh-Bridge.command`**.  
If blocked: Terminal → `chmod +x install-bridge/Start-Hoosh-Bridge.command`

## What the launcher does

1. Runs `npm install` on first use
2. Opens **aihoosh.com** and **chrome://extensions**
3. Shows the extension zip / folder
4. Starts **companion** on `http://127.0.0.1:3001` (keep the window open)

## Install the browser extension

1. Download **`hoosh-local-bridge.zip`** from [aihoosh.com/hoosh-local-bridge.zip](https://aihoosh.com/hoosh-local-bridge.zip) or unzip from `public/` after `npm run bridge:pack`
2. Unzip to a folder
3. Chrome → Extensions → Developer mode → **Load unpacked** → select that folder
4. Refresh aihoosh.com → **Connect to your computer** should show green

Nothing is uploaded to Firebase — traffic stays **browser → extension → your PC**.
