#!/usr/bin/env bash
# Install Ollama on Linux (Ubuntu / Jetson Orin / VPS)
set -euo pipefail

echo "Installing Ollama..."

# Download and install
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
if command -v systemctl &>/dev/null; then
    sudo systemctl enable ollama
    sudo systemctl start ollama
    echo "Ollama service started"
else
    ollama serve &
    sleep 3
    echo "Ollama started in background"
fi

echo "Ollama installed successfully"
echo "Available at: http://localhost:11434"
