#!/bin/zsh
# FA7 OS — Localhost Launcher
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "FA7 OS — Localhost Launcher"
echo "Project: $ROOT_DIR"
echo

# 1. Cleaner cleanup
cleanup_ports() {
  local ports=(5173 3001 3002 3003 5174 4173)
  for port in $ports; do
    local pid=$(lsof -ti ":$port")
    if [ -n "$pid" ]; then
      echo "Cleaning up port $port (PID $pid)..."
      kill -9 $pid 2>/dev/null || true
    fi
  done
  # Kill any lingering node/vite or python bridge processes
  pkill -9 -f "nodemon companion.js" || true
  pkill -9 -f "vite" || true
  pkill -9 -f "Browser/main.py" || true
  pkill -9 -f "bridge_host.py" || true
}

cleanup_ports

# 2. Check for dependencies
if [[ ! -d "node_modules" ]]; then
  echo "Node modules missing. Installing (first run)..."
  npm install || { echo "npm install failed. Press enter to exit."; read; exit 1; }
fi

# 3. Force config root
mkdir -p ~/.aivon-os
echo "{\"projectRoot\": \"$ROOT_DIR\"}" > ~/.aivon-os/fa7_config.json

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=2048"

# 4. Browser shell with Bridge launcher in background
(
  echo "[Launcher] Waiting for server..."
  for i in {1..45}; do
    if curl -fsS "http://127.0.0.1:5173" >/dev/null 2>&1; then
      echo "\n[Launcher] System ready! Launching Desktop Shell..."
      # Use python3 to open the specialized browser
      python3 Browser/main.py > /tmp/browser.log 2>&1 &
      # Fallback to standard browser in background just in case or for easy access
      # open "http://127.0.0.1:5173" || true
      exit 0
    fi
    sleep 1
  done
  echo "\n[Launcher] Timeout waiting for http://127.0.0.1:5173."
) &

echo "Starting FA7 Core (Ports 3001, 3002, 3003, 5173)..."
echo

# 5. Start dev server - forcing strict port 5173
npx concurrently -n companion,vite -c blue,green "nodemon companion.js" "vite --port 5173 --strictPort" || { echo "\n[!] Startup failed. Press enter to exit."; read; exit 1; }

