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
  name=$1
  pid_file="$PID_DIR/$name.pid"

  if [ ! -f "$pid_file" ]; then
    echo "$name is not running: no pid file"
    return 0
  fi

  pid=$(cat "$pid_file")
  if [ ! "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "$name is not running: stale pid file"
    rm -f "$pid_file"
    return 0
  fi

  echo "Stopping $name: pid $pid"
  kill_tree "$pid" TERM

  if ! wait_for_exit "$pid"; then
    echo "$name did not stop after TERM, sending KILL"
    kill_tree "$pid" KILL
  fi

  rm -f "$pid_file"
  echo "$name stopped"
}

if [ ! -d "$PID_DIR" ]; then
  echo "No runtime pid directory: $PID_DIR"
  exit 0
fi

stop_service local-ai-generation
stop_service local-ai-embedding
stop_service local-ai-ocr
stop_service frontend
stop_service backend

echo
echo "All services stopped."
