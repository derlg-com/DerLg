#!/usr/bin/env bash
# =============================================================================
# DerLg — run-all.sh
# Starts all three services on the dev ports with live log output.
#
#   Backend (NestJS)     → http://localhost:4007  (configured default: 3003)
#   Web (Next.js)        → http://localhost:4008  (configured default: 3002)
#   Vibe-booking (AI)    → http://localhost:4009  (configured default: 8001)
#   Admin panel (Next.js)→ http://localhost:4010  (configured default: 5000)
#
# The admin panel is frontend-only. Its API lives inside the backend at
# /v1/admin/*; the old standalone service on port 5001 no longer exists.
#
# Usage:
#   ./run-all.sh            # start all four, stream logs, Ctrl+C to stop
#   ./run-all.sh backend    # start only backend
#   ./run-all.sh web        # start only web
#   ./run-all.sh ai         # start only vibe-booking
#   ./run-all.sh admin      # start only the admin panel
#
# Logs: each service writes to logs/<service>.log AND streams to your terminal.
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

# --- port + env overrides ----------------------------------------------------
BACKEND_PORT=4007
WEB_PORT=4008
AI_PORT=4009
ADMIN_PORT=4010

PIDS=()

# Tear down services started by this script
cleanup() {
  echo ""
  echo "⏹  Stopping services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
    # Kill child processes (e.g. nest → node, npm exec → node)
    pkill -P "$pid" 2>/dev/null || true
  done
  sleep 1
  echo "All stopped."
}
trap cleanup EXIT INT TERM

start_backend() {
  echo "🚀 Starting backend  → http://localhost:${BACKEND_PORT}"
  cd "$ROOT_DIR/backend"
  PORT=$BACKEND_PORT npx nest start --watch >> "$LOG_DIR/backend.log" 2>&1 &
  PIDS+=($!)
}

start_web() {
  echo "🌐 Starting web      → http://localhost:${WEB_PORT}"
  cd "$ROOT_DIR/web"
  NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}" \
  NEXT_PUBLIC_AI_WS_URL="ws://localhost:${AI_PORT}" \
  NEXT_PUBLIC_APP_URL="http://localhost:${WEB_PORT}" \
  npx next dev -p $WEB_PORT >> "$LOG_DIR/web.log" 2>&1 &
  PIDS+=($!)
}

start_admin() {
  echo "🛠  Starting admin    → http://localhost:${ADMIN_PORT}"
  cd "$ROOT_DIR/derlg-system-admin/frontend_admin"
  # The admin panel has no backend of its own — its API was merged into
  # backend/ and is served at /v1/admin/*.
  NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}" \
  NEXT_PUBLIC_WS_URL="ws://localhost:${BACKEND_PORT}" \
  npx next dev -p $ADMIN_PORT >> "$LOG_DIR/admin.log" 2>&1 &
  PIDS+=($!)
}

start_ai() {
  echo "🤖 Starting AI agent → http://localhost:${AI_PORT}"
  cd "$ROOT_DIR/vibe-booking"
  # IMPORTANT: unset NVIDIA_API_KEY so pydantic-settings reads .env instead.
  # Run uvicorn WITHOUT --reload — the reloader hangs on slow LLM calls.
  env -u NVIDIA_API_KEY \
    BACKEND_URL="http://localhost:${BACKEND_PORT}" \
    "$ROOT_DIR/vibe-booking/.venv/bin/uvicorn" \
    main:app --host 0.0.0.0 --port $AI_PORT >> "$LOG_DIR/ai.log" 2>&1 &
  PIDS+=($!)
}

# --- argument routing --------------------------------------------------------
TARGET="${1:-all}"

case "$TARGET" in
  backend)  start_backend ;;
  web)      start_web ;;
  ai)       start_ai ;;
  admin)    start_admin ;;
  all)
    start_backend
    start_web
    start_ai
    start_admin
    ;;
  *)
    echo "Usage: $0 [all|backend|web|ai|admin]"
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Logs are streaming below AND saved to logs/*.log"
echo "  Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# --- tail all log files into one interleaved stream -----------------------
sleep 3   # give services a moment to create their log files
tail -f "$LOG_DIR"/*.log 2>/dev/null
