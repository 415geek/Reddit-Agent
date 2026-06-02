#!/usr/bin/env bash
# MarketVoice — VPS Deployment Script
# Prerequisites: Docker, Docker Compose, Nginx installed on VPS
set -euo pipefail

DEPLOY_DIR="/opt/marketvoice"
APP_DIR="$DEPLOY_DIR/app"
BACKUP_DIR="$DEPLOY_DIR/backups"
NGINX_CONF="/etc/nginx/sites-available/marketvoice.conf"
NGINX_LINK="/etc/nginx/sites-enabled/marketvoice.conf"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo "=== MarketVoice VPS Deployment ==="

# ── Safety checks ─────────────────────────────────────────────────────────────
info "Running pre-deployment safety checks..."

# Verify this is NOT run as root without sudo
if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    error "This script requires sudo privileges"
fi

# Check port 3031 isn't occupied
if ss -tulpn 2>/dev/null | grep -q ":3031 "; then
    error "Port 3031 is already in use. Check with: ss -tulpn | grep 3031"
fi
info "Port 3031 is available ✓"

# Check Docker
command -v docker &>/dev/null || error "Docker is not installed"
info "Docker available ✓"

# ── Create project directory ───────────────────────────────────────────────────
info "Creating project directories..."
sudo mkdir -p "$DEPLOY_DIR" "$BACKUP_DIR"
sudo chown -R "$(whoami):$(whoami)" "$DEPLOY_DIR"
mkdir -p "$APP_DIR"

# ── Copy application files ─────────────────────────────────────────────────────
info "Copying application files to $APP_DIR..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
    "$SOURCE_DIR/" "$APP_DIR/"

# ── Setup environment file ─────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"

    # Generate secrets
    JWT_SECRET=$(openssl rand -base64 32)
    WEBHOOK_SECRET=$(openssl rand -base64 24)
    DB_PASSWORD=$(openssl rand -base64 20 | tr -d '=+/')

    sed -i "s|CHANGE_ME_PASSWORD|$DB_PASSWORD|g" "$APP_DIR/.env"
    sed -i "s|CHANGE_ME_JWT_SECRET_32_CHARS_MIN|$JWT_SECRET|g" "$APP_DIR/.env"
    sed -i "s|CHANGE_ME_SECRET|$WEBHOOK_SECRET|g" "$APP_DIR/.env"
    sed -i "s|POSTGRES_PASSWORD:-CHANGE_ME_PASSWORD|POSTGRES_PASSWORD:-$DB_PASSWORD|g" "$APP_DIR/docker-compose.yml" 2>/dev/null || true

    warn "Created .env with generated secrets."
    warn "REQUIRED: Edit $APP_DIR/.env and set:"
    warn "  - MARKETVOICE_ADMIN_PASSWORD"
    warn "  - OPENAI_API_KEY or ANTHROPIC_API_KEY"
    warn "  - DATABASE_URL (update password to match POSTGRES_PASSWORD)"
    echo ""
    read -rp "Press Enter after editing .env to continue..."
fi

# ── Backup Nginx configs ───────────────────────────────────────────────────────
info "Backing up Nginx configurations..."
TIMESTAMP=$(date +%F-%H%M%S)
if [ -d /etc/nginx/sites-available ]; then
    sudo cp -a /etc/nginx/sites-available "$BACKUP_DIR/nginx-sites-available-$TIMESTAMP"
fi
if [ -d /etc/nginx/sites-enabled ]; then
    sudo cp -a /etc/nginx/sites-enabled "$BACKUP_DIR/nginx-sites-enabled-$TIMESTAMP"
fi
info "Nginx configs backed up to $BACKUP_DIR"

# ── Deploy Docker Compose ──────────────────────────────────────────────────────
info "Starting MarketVoice containers..."
cd "$APP_DIR"
docker compose pull marketvoice-postgres marketvoice-redis 2>/dev/null || true
docker compose up -d marketvoice-postgres marketvoice-redis
info "Waiting for database to be ready..."
sleep 8

# Run migrations + seed
info "Running database migrations..."
docker compose run --rm marketvoice-app sh -c "npx prisma migrate deploy && npx prisma db seed" || \
    warn "Migration had issues — check manually: docker compose logs marketvoice-app"

# Start app
docker compose up -d marketvoice-app
info "App container started"

# ── Nginx configuration ────────────────────────────────────────────────────────
info "Configuring Nginx..."
sudo cp "$APP_DIR/nginx/marketvoice.conf" "$NGINX_CONF"

if [ ! -L "$NGINX_LINK" ]; then
    sudo ln -s "$NGINX_CONF" "$NGINX_LINK"
fi

if sudo nginx -t; then
    sudo systemctl reload nginx
    info "Nginx reloaded ✓"
else
    error "Nginx config test failed — NOT reloading nginx. Check config at $NGINX_CONF"
fi

# ── Verification ──────────────────────────────────────────────────────────────
echo ""
info "=== Deployment Verification ==="
docker compose ps
echo ""
ss -tulpn | grep 3031 || warn "Port 3031 not listening yet"
echo ""
sudo nginx -t && echo "Nginx: OK ✓"
echo ""

# Check app health
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3031/ 2>/dev/null || echo "000")
info "App HTTP response: $HTTP_CODE"

echo ""
info "=== Deployment Complete ==="
echo ""
echo "Dashboard: http://$(hostname -I | awk '{print $1}'):3031"
echo "Domain:    http://voice.restaurantiq.ai (after DNS propagation)"
echo ""
echo "Next steps:"
echo "  1. Configure DNS: A record voice.restaurantiq.ai → $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "  2. Verify DNS:    dig +short voice.restaurantiq.ai"
echo "  3. Enable SSL:    sudo certbot --nginx -d voice.restaurantiq.ai"
echo "  4. Import n8n workflow from: $APP_DIR/n8n/marketvoice-workflow.json"
echo ""
echo "Logs:"
echo "  docker compose -f $APP_DIR/docker-compose.yml logs -f marketvoice-app"
