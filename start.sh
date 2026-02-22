#!/bin/bash
# Start the Plan Assistant dev server
# Usage: ./start.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$HOME/.plan-assistant/.pid"
PORT=5199
LOG_FILE="$HOME/.plan-assistant/server.log"

mkdir -p "$HOME/.plan-assistant"

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        if curl -s --max-time 2 "http://localhost:$PORT/" > /dev/null 2>&1; then
            echo "Plan Assistant already running (PID $PID) on http://localhost:$PORT"
            exit 0
        fi
    fi
    rm -f "$PID_FILE"
fi

# Check if something else is on our port
if lsof -i ":$PORT" -sTCP:LISTEN > /dev/null 2>&1; then
    echo "Error: Port $PORT is already in use by another process"
    exit 1
fi

# Install deps if needed
if [ ! -d "$DIR/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$DIR" && pnpm install --silent 2>&1
fi

# Start the dev server in background
cd "$DIR"
nohup npx vite dev --port "$PORT" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server to be ready
echo -n "Starting Plan Assistant"
for i in $(seq 1 20); do
    if curl -s --max-time 1 "http://localhost:$PORT/" > /dev/null 2>&1; then
        echo ""
        echo "Plan Assistant running on http://localhost:$PORT (PID $SERVER_PID)"
        exit 0
    fi
    echo -n "."
    sleep 0.5
done

echo ""
echo "Failed to start (check $LOG_FILE)"
kill "$SERVER_PID" 2>/dev/null
rm -f "$PID_FILE"
exit 1
