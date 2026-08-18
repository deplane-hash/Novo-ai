#!/usr/bin/env bash
# Nova launcher — one command to run the app.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local-node/bin:$PATH"
NOVA_PORT="${NOVA_PORT:-8787}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first run)…"
  npm install
fi

if [ ! -d "dist" ] || [ ! -d "dist-server" ]; then
  echo "Building…"
  npm run build
fi

pkill -x node 2>/dev/null || true
sleep 0.5

NODE_ENV=production PORT="$NOVA_PORT" node dist-server/index.js &
SERVER_PID=$!

# auto-open the browser (best effort)
sleep 1.2
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$NOVA_PORT" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:$NOVA_PORT" >/dev/null 2>&1 || true
fi

echo "Nova is running at http://localhost:$NOVA_PORT  (Ctrl+C to stop)"
wait "$SERVER_PID"
