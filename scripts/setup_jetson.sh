#!/usr/bin/env bash
# Restaurant Intelligence Agent — Jetson Orin Setup Script
# Tested on: JetPack 5.x (Ubuntu 20.04) and JetPack 6.x (Ubuntu 22.04)
# Architecture: ARM64 (aarch64), 64GB unified memory
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "\n${BLUE}==>${NC} $*"; }

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   Restaurant Intelligence Agent                  ║"
echo "║   Jetson Orin Setup                              ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Verify Jetson environment ─────────────────────────────────────────────
step "Verifying Jetson environment"

ARCH=$(uname -m)
[ "$ARCH" = "aarch64" ] || error "This script is for ARM64 (Jetson). Detected: $ARCH"
info "Architecture: aarch64 ✓"

if [ -f /etc/nv_tegra_release ]; then
    TEGRA_INFO=$(cat /etc/nv_tegra_release)
    info "Tegra release: $TEGRA_INFO"
elif [ -f /etc/os-release ]; then
    . /etc/os-release
    info "OS: $PRETTY_NAME"
fi

# Check JetPack version
if command -v dpkg &>/dev/null; then
    JETPACK_VER=$(dpkg -l | grep "nvidia-jetpack" | awk '{print $3}' 2>/dev/null || echo "unknown")
    info "JetPack: $JETPACK_VER"
fi

# Check CUDA
if command -v nvcc &>/dev/null; then
    CUDA_VER=$(nvcc --version | grep "release" | awk '{print $6}' | tr -d ',')
    info "CUDA: $CUDA_VER ✓"
else
    warn "nvcc not found — CUDA may not be in PATH. Adding /usr/local/cuda/bin..."
    export PATH=/usr/local/cuda/bin:$PATH
    echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
fi

# ── 2. System dependencies ───────────────────────────────────────────────────
step "Installing system dependencies"

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \
    git curl wget build-essential \
    libssl-dev libffi-dev \
    libopenblas-dev \
    2>/dev/null
info "System packages installed"

# ── 3. Python virtual environment ────────────────────────────────────────────
step "Setting up Python environment"

PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Python $PYTHON_VER"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    info "Virtual environment created"
fi
source venv/bin/activate

pip install --upgrade pip wheel setuptools --quiet

# Install with ARM64-compatible options
info "Installing Python packages (ARM64)..."
pip install --quiet \
    praw==7.7.1 \
    "python-telegram-bot==21.6" \
    "sqlalchemy==2.0.36" \
    httpx==0.27.2 \
    aiohttp==3.10.10 \
    apscheduler==3.10.4 \
    streamlit==1.40.2 \
    plotly==5.24.1 \
    "pandas==2.2.3" \
    python-dotenv==1.0.1 \
    pyyaml==6.0.2 \
    loguru==0.7.2 \
    tenacity==9.0.0 \
    rich==13.9.4 \
    python-dateutil==2.9.0.post0

info "Python packages installed"

# ── 4. Directories and environment file ──────────────────────────────────────
step "Setting up project directories"
mkdir -p data/logs
info "Directories created"

if [ ! -f ".env" ]; then
    cp .env.example .env
    # Set Jetson-optimized defaults
    sed -i 's|OLLAMA_MODEL=qwen3:8b|OLLAMA_MODEL=qwen3:8b|' .env
    sed -i 's|OLLAMA_HOST=http://localhost:11434|OLLAMA_HOST=http://localhost:11434|' .env
    warn ".env created — please edit it with your credentials!"
else
    info ".env already exists"
fi

# ── 5. Ollama for ARM64 / Jetson ─────────────────────────────────────────────
step "Installing Ollama (ARM64)"

if command -v ollama &>/dev/null; then
    info "Ollama already installed: $(ollama --version 2>/dev/null || echo 'version unknown')"
else
    info "Downloading Ollama for ARM64..."
    curl -fsSL https://ollama.ai/install.sh | sh
    info "Ollama installed"
fi

# Configure Ollama to use Jetson GPU (unified memory)
OLLAMA_ENV_FILE="/etc/systemd/system/ollama.service.d/jetson.conf"
if command -v systemctl &>/dev/null; then
    sudo mkdir -p /etc/systemd/system/ollama.service.d/
    sudo tee "$OLLAMA_ENV_FILE" > /dev/null <<'CONF'
[Service]
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_FLASH_ATTENTION=1"
CONF
    sudo systemctl daemon-reload
    sudo systemctl enable ollama
    sudo systemctl restart ollama
    sleep 3
    info "Ollama service configured and started with Jetson optimizations"
fi

# ── 6. Pull LLM model ────────────────────────────────────────────────────────
step "Pulling AI model"

# Wait for Ollama to be ready
for i in {1..10}; do
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        break
    fi
    sleep 2
done

echo ""
echo "Available models (64GB unified memory can run any of these):"
echo "  1. qwen3:8b   — Best quality, ~5GB VRAM   (recommended)"
echo "  2. qwen3:14b  — Higher quality, ~9GB VRAM"
echo "  3. qwen3:32b  — Best quality,  ~20GB VRAM (Jetson Orin 64GB ideal)"
echo "  4. llama3.2:3b — Fastest, ~2GB VRAM       (light option)"
echo ""
read -rp "Which model? [1-4, default=1]: " MODEL_CHOICE

case "${MODEL_CHOICE:-1}" in
    1) MODEL="qwen3:8b" ;;
    2) MODEL="qwen3:14b" ;;
    3) MODEL="qwen3:32b" ;;
    4) MODEL="llama3.2:3b" ;;
    *) MODEL="qwen3:8b" ;;
esac

info "Pulling $MODEL (this may take several minutes on first run)..."
ollama pull "$MODEL"

# Update .env with chosen model
sed -i "s|OLLAMA_MODEL=.*|OLLAMA_MODEL=$MODEL|" .env
info "Model $MODEL ready. Updated .env"

# ── 7. Streamlit config ───────────────────────────────────────────────────────
step "Configuring Streamlit"
mkdir -p ~/.streamlit
cat > ~/.streamlit/config.toml <<'TOML'
[server]
headless = true
port = 8501
address = "0.0.0.0"
enableCORS = false
enableXsrfProtection = false

[browser]
gatherUsageStats = false
TOML
info "Streamlit configured"

# ── 8. Systemd services ────────────────────────────────────────────────────────
step "Setting up systemd services"
INSTALL_DIR="$(pwd)"
VENV_PYTHON="$INSTALL_DIR/venv/bin/python"
VENV_STREAMLIT="$INSTALL_DIR/venv/bin/streamlit"
CURRENT_USER=$(whoami)

# Main agent service
sudo tee /etc/systemd/system/restaurant-agent.service > /dev/null <<SERVICE
[Unit]
Description=Restaurant Intelligence Agent
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$VENV_PYTHON main.py
Restart=always
RestartSec=30
EnvironmentFile=$INSTALL_DIR/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

# Dashboard service
sudo tee /etc/systemd/system/restaurant-dashboard.service > /dev/null <<SERVICE
[Unit]
Description=Restaurant Intelligence Dashboard
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$VENV_STREAMLIT run src/dashboard/app.py
Restart=always
RestartSec=10
EnvironmentFile=$INSTALL_DIR/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable restaurant-agent restaurant-dashboard
info "Systemd services created (not started yet — configure .env first)"

# ── 9. Get Jetson IP ───────────────────────────────────────────────────────────
JETSON_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Jetson Orin Setup Complete!                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit credentials:"
echo "     nano $INSTALL_DIR/.env"
echo ""
echo "  2. Start services:"
echo "     sudo systemctl start restaurant-agent"
echo "     sudo systemctl start restaurant-dashboard"
echo ""
echo "  3. Access dashboard:"
echo -e "     ${GREEN}http://$JETSON_IP:8501${NC}"
echo ""
echo "  4. Check logs:"
echo "     journalctl -u restaurant-agent -f"
echo "     journalctl -u restaurant-dashboard -f"
echo ""
echo "  Model in use: $MODEL"
echo "  Ollama API:   http://localhost:11434"
