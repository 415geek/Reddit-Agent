#!/usr/bin/env bash
# MarketVoice — VPS Deployment Script
# Run on VPS as root: bash deploy-vps.sh
# Before running, set the environment variables below or export them in your shell.
set -euo pipefail

APP_DIR="/opt/marketvoice/app"
BACKUP_DIR="/opt/marketvoice/backups"
BRANCH="claude/restaurant-intelligence-agent-HQMW9"
REPO_URL="https://github.com/415geek/Reddit-Agent.git"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ── Required credentials (set these before running) ───────────────────────────
# Export these variables in your shell, or edit this file directly:
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:?Set WEBHOOK_SECRET}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
APP_URL="${APP_URL:-https://voice.restaurantiq.ai}"
ADMIN_USER="${ADMIN_USER:-admin}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo "=== MarketVoice VPS Deployment — ${TIMESTAMP} ==="

# ── Safety checks ─────────────────────────────────────────────────────────────
info "Running pre-deployment safety checks..."

command -v docker &>/dev/null || error "Docker is not installed"
info "Docker available ✓"

if ss -tulpn 2>/dev/null | grep -q ":3031 "; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "marketvoice-app"; then
    error "Port 3031 is occupied by a non-MarketVoice process."
  fi
  warn "Port 3031 already used by MarketVoice container — will be replaced."
fi
info "Port safety check passed ✓"

# ── Create directories ────────────────────────────────────────────────────────
info "Preparing directories..."
mkdir -p "${APP_DIR}" "${BACKUP_DIR}/db"

# ── Clone or update repo ──────────────────────────────────────────────────────
info "Fetching latest code from GitHub..."
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
  info "Repository updated ✓"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
  info "Repository cloned ✓"
fi

# ── Write .env ────────────────────────────────────────────────────────────────
info "Writing .env with production credentials..."

cat > "${APP_DIR}/.env" <<EOF
NODE_ENV=production

MARKETVOICE_APP_PORT=3031
MARKETVOICE_APP_URL=${APP_URL}

DATABASE_URL=postgresql://marketvoice_user:${DB_PASSWORD}@marketvoice-postgres:5432/marketvoice
POSTGRES_PASSWORD=${DB_PASSWORD}

AI_PROVIDER=anthropic
OPENAI_API_KEY=
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

MARKETVOICE_ADMIN_USER=${ADMIN_USER}
MARKETVOICE_ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}

N8N_WEBHOOK_SECRET=${WEBHOOK_SECRET}
N8N_INGEST_URL=${APP_URL}/api/ingest

TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
EOF

chmod 600 "${APP_DIR}/.env"
info ".env created ✓"

# ── Docker: build and start ───────────────────────────────────────────────────
info "Building Docker image (this may take a few minutes)..."
cd "${APP_DIR}"
docker compose build --no-cache
info "Build complete ✓"

info "Starting containers..."
docker compose up -d

info "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker compose exec -T marketvoice-postgres pg_isready -U marketvoice_user -d marketvoice &>/dev/null 2>&1; then
    info "PostgreSQL ready ✓"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "PostgreSQL did not become ready in 60 seconds."
  fi
  sleep 2
done

# ── Migrations and seed ───────────────────────────────────────────────────────
info "Running database migrations..."
docker compose exec -T marketvoice-app ./node_modules/.bin/prisma migrate deploy
info "Migrations applied ✓"

info "Seeding Reddit sources (28 subreddits)..."
docker compose exec -T marketvoice-app ./node_modules/.bin/tsx prisma/seed.ts
info "Seed complete ✓"

# ── Nginx ─────────────────────────────────────────────────────────────────────
info "Configuring Nginx..."

if [ -d /etc/nginx/sites-available ]; then
  cp -a /etc/nginx/sites-available/ "${BACKUP_DIR}/nginx-sites-available-${TIMESTAMP}/"
  info "Nginx configs backed up ✓"
fi

cp "${APP_DIR}/nginx/marketvoice.conf" /etc/nginx/sites-available/marketvoice.conf

if [ ! -L /etc/nginx/sites-enabled/marketvoice.conf ]; then
  ln -s /etc/nginx/sites-available/marketvoice.conf /etc/nginx/sites-enabled/marketvoice.conf
fi

if nginx -t; then
  systemctl reload nginx
  info "Nginx reloaded ✓"
else
  warn "Nginx config test failed — restoring backup"
  cp -a "${BACKUP_DIR}/nginx-sites-available-${TIMESTAMP}/." /etc/nginx/sites-available/
  rm -f /etc/nginx/sites-enabled/marketvoice.conf
  nginx -t && systemctl reload nginx || true
  error "Nginx setup failed. Application is running on port 3031 but not proxied."
fi

# ── Verify ────────────────────────────────────────────────────────────────────
info "Verifying deployment..."
sleep 6

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3031/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  info "Health check: HTTP 200 OK ✓"
else
  warn "Health check returned HTTP ${HTTP_CODE}"
  warn "Showing last 40 lines of app logs:"
  docker compose logs --tail=40 marketvoice-app
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  MarketVoice Deployment Complete!"
echo "============================================================"
echo ""
echo "Dashboard (direct):  http://$(hostname -I | awk '{print $1}'):3031/login"
echo "Dashboard (domain):  ${APP_URL}/login  (after DNS + SSL)"
echo ""
echo "Login: ${ADMIN_USER} / ${ADMIN_PASSWORD}"
echo ""
echo "──────────────────────────────────────────────────────────"
echo "  NEXT STEPS"
echo "──────────────────────────────────────────────────────────"
echo ""
echo "1. DNS — Add A record: voice.restaurantiq.ai → $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo "   Verify: dig +short voice.restaurantiq.ai"
echo ""
echo "2. SSL (after DNS propagates):"
echo "   sudo certbot --nginx -d voice.restaurantiq.ai"
echo ""
echo "3. n8n Workflow:"
echo "   a. Open n8n at http://YOUR_SERVER_IP:5678"
echo "   b. Import: ${APP_DIR}/n8n/marketvoice-workflow.json"
echo "   c. Add PostgreSQL credential (host: marketvoice-postgres, db: marketvoice, user: marketvoice_user)"
echo "   d. Settings > Variables > add ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,"
echo "      N8N_INGEST_URL, N8N_WEBHOOK_SECRET"
echo "   e. Set PostgreSQL credential on both DB query nodes and activate"
echo ""
echo "4. Optional — backup cron:"
echo "   echo '0 2 * * * bash ${APP_DIR}/scripts/backup-db.sh >> ${BACKUP_DIR}/backup.log 2>&1' | crontab -"
echo ""
