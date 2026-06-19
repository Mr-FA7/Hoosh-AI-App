#!/usr/bin/env bash
# Restart Hoosh companion on port 3001 (default)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${FA7_PORT:-3001}"

echo "Stopping companion on :${PORT}..."
lsof -ti ":${PORT}" | xargs kill -9 2>/dev/null || true
sleep 1

if lsof -ti ":${PORT}" >/dev/null 2>&1; then
  echo "Could not free port ${PORT}. Try: kill -9 \$(lsof -ti :${PORT})"
  exit 1
fi

echo "Starting companion on :${PORT}..."
cd "$ROOT"
exec node companion.js
