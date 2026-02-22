#!/bin/bash
# Stop the Plan Assistant dev server
# Usage: ./stop.sh

PID_FILE="$HOME/.plan-assistant/.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Plan Assistant is not running"
    exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Plan Assistant stopped (PID $PID)"
else
    echo "Plan Assistant was not running (stale PID)"
fi

rm -f "$PID_FILE"
