#!/usr/bin/env bash
# Start with Docker Compose
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Detect GPU support
if command -v nvidia-smi &>/dev/null; then
    echo "GPU detected — using GPU-enabled Ollama"
    COMPOSE_FILE="docker/docker-compose.yml"
else
    echo "No GPU detected — using CPU mode"
    COMPOSE_FILE="docker/docker-compose.yml -f docker/docker-compose.cpu.yml"
fi

docker compose -f $COMPOSE_FILE up -d

echo ""
echo "Services started:"
echo "  Dashboard:  http://localhost:8501"
echo "  n8n:        http://localhost:5678 (admin/changeme)"
echo "  Ollama:     http://localhost:11434"
echo ""
echo "Import n8n workflows from: n8n/workflows/"
echo ""
echo "View logs: docker compose -f $COMPOSE_FILE logs -f agent"
