#!/bin/zsh
# FA7 OS — Localhost (Preview)
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "FA7 OS — Production Preview Launcher"
echo "Project: $ROOT_DIR"
echo

# 1. Cleanup
cleanup_ports() {
  local ports=(4173 3001)
  for port in $ports; do
    local pid=$(lsof -ti ":$port")
    if [ -n "$pid" ]; then
      echo "Cleaning up port $port (PID $pid)..."
      kill -9 $pid 2>/dev/null || true
    fi
  done
}

cleanup_ports

# 2. Dependencies
if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies..."
  npm install || { echo "npm install failed. Press enter."; read; exit 1; }
fi

# 3. Force config
mkdir -p ~/.aivon-os
echo "{\"projectRoot\": \"$ROOT_DIR\"}" > ~/.aivon-os/fa7_config.json

export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=2048"

# 4. Build
echo "Building production bundle..."
npm run build || { echo "Build failed. Press enter."; read; exit 1; }

# 5. Browser opener
(
  for i in {1..60}; do
    if curl -fsS "http://127.0.0.1:4173" >/dev/null 2>&1; then
      open "http://127.0.0.1:4173" || true
      exit 0
    fi
    sleep 1
  done
) &

# 6. Preview
echo "Starting preview server..."
npx vite preview --host 127.0.0.1 --port 4173 --strictPort || { echo "Preview failed. Press enter."; read; exit 1; }

