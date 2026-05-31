#!/usr/bin/env bash
# Start all services
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

source venv/bin/activate

# Ensure Ollama is running
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "Starting Ollama..."
    ollama serve &>/dev/null &
    sleep 3
fi

# Start dashboard in background
echo "Starting dashboard on http://localhost:8501 ..."
streamlit run src/dashboard/app.py \
    --server.port=8501 \
    --server.address=0.0.0.0 \
    --server.headless=true \
    &>/tmp/dashboard.log &
DASHBOARD_PID=$!
echo "Dashboard PID: $DASHBOARD_PID"

# Start main agent
echo "Starting main agent..."
python main.py
