#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PID_DIR="$ROOT_DIR/.runtime/pids"

kill_tree() {
  target_pid=$1
  signal=$2

  children=$(pgrep -P "$target_pid" 2>/dev/null || true)
  for child_pid in $children; do
    kill_tree "$child_pid" "$signal"
  done

  kill "-$signal" "$target_pid" 2>/dev/null || true
}

stop_pid() {
  stop_pid_name=$1
  stop_pid_target=$2

  if [ ! "$stop_pid_target" ] || ! kill -0 "$stop_pid_target" 2>/dev/null; then
    return 0
  fi

  echo "Stopping $stop_pid_name: pid $stop_pid_target"
  kill_tree "$stop_pid_target" TERM

  if ! wait_for_exit "$stop_pid_target"; then
    echo "$stop_pid_name did not stop after TERM, sending KILL"
    kill_tree "$stop_pid_target" KILL
    wait_for_exit "$stop_pid_target" || true
  fi
}

wait_for_exit() {
  target_pid=$1
  attempts=0

  while kill -0 "$target_pid" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 20 ]; then
      return 1
    fi
    sleep 0.25
  done

  return 0
}

stop_service() {
  service_name=$1
  service_port=$2
  pid_file="$PID_DIR/$service_name.pid"
  stopped_from_pid_file=0

  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if [ "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      stop_pid "$service_name" "$pid"
      stopped_from_pid_file=1
    else
      echo "$service_name is not running: stale pid file"
    fi
    rm -f "$pid_file"
  else
    echo "$service_name has no pid file"
  fi

  if [ "$service_port" ]; then
    port_pids=$(lsof -tiTCP:"$service_port" -sTCP:LISTEN 2>/dev/null || true)
    for port_pid in $port_pids; do
      stop_pid "$service_name on port $service_port" "$port_pid"
      stopped_from_pid_file=1
    done

    if lsof -tiTCP:"$service_port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$service_name still has listener(s) on port $service_port"
      lsof -nP -iTCP:"$service_port" -sTCP:LISTEN || true
      return 1
    fi
  fi

  if [ "$stopped_from_pid_file" -eq 0 ]; then
    echo "$service_name is not running"
  else
    echo "$service_name stopped"
  fi
}

mkdir -p "$PID_DIR"

stop_service local-ai-generation "${LOCAL_AI_GENERATION_PORT:-8083}"
stop_service local-ai-embedding "${LOCAL_AI_EMBEDDING_PORT:-8082}"
stop_service local-ai-ocr "${LOCAL_AI_OCR_PORT:-8081}"
stop_service frontend "${FRONTEND_PORT:-3000}"
stop_service backend "${BACKEND_PORT:-8000}"

echo
echo "All services stopped."
