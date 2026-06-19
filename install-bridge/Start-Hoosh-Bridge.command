#!/bin/bash
# Hoosh Local Bridge — one-click launcher (macOS)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CANDIDATE="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$CANDIDATE/companion.js" ]; then
  ROOT="$CANDIDATE"
else
  ROOT="$HOME/Hoosh-AI-App"
fi

echo ""
echo "  Hoosh Local Bridge"
echo "  =================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install from https://nodejs.org"
  read -r -p "Press Enter to exit..."
  exit 1
fi

if [ ! -f "$ROOT/companion.js" ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "Hoosh-AI-App not found. Clone: git clone https://github.com/Mr-FA7/Hoosh-AI-App.git \"$ROOT\""
    read -r -p "Press Enter to exit..."
    exit 1
  fi
  echo "Cloning Hoosh-AI-App to $ROOT ..."
  git clone https://github.com/Mr-FA7/Hoosh-AI-App.git "$ROOT"
fi

cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..."
  npm install --legacy-peer-deps
fi

if [ ! -f public/hoosh-local-bridge.zip ]; then
  npm run bridge:pack 2>/dev/null || true
fi

ZIP="$ROOT/public/hoosh-local-bridge.zip"
EXT="$ROOT/extensions/hoosh-local-bridge"

open "https://aihoosh.com"
sleep 1
open -a "Google Chrome" "chrome://extensions/" 2>/dev/null || open "chrome://extensions/" 2>/dev/null || true
if [ -f "$ZIP" ]; then
  open -R "$ZIP"
elif [ -d "$EXT" ]; then
  open "$EXT"
fi

echo ""
echo "1) Unzip hoosh-local-bridge.zip"
echo "2) Chrome -> Extensions -> Load unpacked"
echo "3) Refresh aihoosh.com"
echo ""
echo "Keep this Terminal open. Companion: http://127.0.0.1:3001"
echo ""

npm run bridge
