#!/usr/bin/env bash
# Restaurant Intelligence Agent — Initial Setup Script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

info "Restaurant Intelligence Agent Setup"
echo "========================================"

# Check Python
python3 --version &>/dev/null || error "Python 3 is required. Install: sudo apt install python3 python3-pip"
PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Python $PYTHON_VER detected"

# Create virtual environment
if [ ! -d "venv" ]; then
    info "Creating virtual environment..."
    python3 -m venv venv
fi

info "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
info "Installing Python dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
info "Dependencies installed"

# Create directories
mkdir -p data/logs config

# Setup environment file
if [ ! -f ".env" ]; then
    cp .env.example .env
    warn "Created .env from template. Please edit .env with your credentials!"
else
    info ".env already exists"
fi

# Install Ollama
if ! command -v ollama &>/dev/null; then
    info "Installing Ollama..."
    bash scripts/install_ollama.sh
else
    info "Ollama already installed: $(ollama --version)"
fi

# Pull default model
info "Checking Ollama model..."
if ollama list 2>/dev/null | grep -q "qwen3:8b"; then
    info "qwen3:8b model already available"
else
    warn "Pulling qwen3:8b model (this may take a few minutes)..."
    ollama pull qwen3:8b || warn "Failed to pull qwen3:8b — try: ollama pull llama3.2:3b as fallback"
fi

info "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Reddit API and Telegram credentials"
echo "  2. Run: source venv/bin/activate && python main.py"
echo "  3. Dashboard: source venv/bin/activate && streamlit run src/dashboard/app.py"
