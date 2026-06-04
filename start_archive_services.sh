#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

start_service() {
  name=$1
  port=$2
  workdir=$3
  shift 3

  pid_file="$PID_DIR/$name.pid"
  log_file="$LOG_DIR/$name.log"

  if [ "$port" ] && lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "$name cannot start: port $port is already in use"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
    echo "Run ./stop_archive_services.sh, then retry."
    return 1
  fi

  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if [ "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$name is already running: pid $pid"
      return 0
    fi
    rm -f "$pid_file"
  fi

  echo "Starting $name..."
  (
    cd "$workdir"
    nohup "$@" > "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  sleep 1
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    echo "$name started: pid $pid, log $log_file"
    return 0
  fi

  echo "$name failed to start. Last log lines:"
  tail -40 "$log_file" 2>/dev/null || true
  rm -f "$pid_file"
  return 1
}

PYTHON_BIN=${PYTHON_BIN:-python3}
FRONTEND_HOST=${FRONTEND_HOST:-0.0.0.0}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_HOST=${BACKEND_HOST:-0.0.0.0}
BACKEND_PORT=${BACKEND_PORT:-8000}
BACKEND_UVICORN=${BACKEND_UVICORN:-"$ROOT_DIR/apps/backend/.venv/bin/uvicorn"}
LOCAL_AI_OCR_PORT=${LOCAL_AI_OCR_PORT:-8081}
LOCAL_AI_EMBEDDING_PORT=${LOCAL_AI_EMBEDDING_PORT:-8082}
LOCAL_AI_GENERATION_PORT=${LOCAL_AI_GENERATION_PORT:-8083}

if [ ! -x "$BACKEND_UVICORN" ]; then
  BACKEND_UVICORN=uvicorn
fi

start_service backend "$BACKEND_PORT" "$ROOT_DIR/apps/backend" "$BACKEND_UVICORN" app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
start_service frontend "$FRONTEND_PORT" "$ROOT_DIR/apps/frontend" npm run dev -- --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT"
start_service local-ai-ocr "$LOCAL_AI_OCR_PORT" "$ROOT_DIR" "$PYTHON_BIN" scripts/start_local_ai_provider.py ocr
start_service local-ai-embedding "$LOCAL_AI_EMBEDDING_PORT" "$ROOT_DIR" "$PYTHON_BIN" scripts/start_local_ai_provider.py embedding
start_service local-ai-generation "$LOCAL_AI_GENERATION_PORT" "$ROOT_DIR" "$PYTHON_BIN" scripts/start_local_ai_provider.py generation

echo
echo "All services requested."
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Logs:     $LOG_DIR"
echo "PIDs:     $PID_DIR"
