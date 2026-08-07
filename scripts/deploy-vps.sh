#!/usr/bin/env bash
# 生意脑回路(BizBrain)— VPS 部署脚本
# 在 VPS 上以 root 运行: bash deploy-vps.sh
# 运行前先 export 下方必填环境变量。
set -euo pipefail

APP_DIR="/opt/bizbrain/app"
BACKUP_DIR="/opt/bizbrain/backups"
BRANCH="claude/north-america-project-content-0jek2g"
REPO_URL="https://github.com/415geek/Reddit-Agent.git"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ── 必填凭据 ──────────────────────────────────────────────────────────────────
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:?Set WEBHOOK_SECRET}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY}"
# ── 选填 ──────────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
FACTORY_DOMAIN="${FACTORY_DOMAIN:-factory.example.com}"
APP_URL="${APP_URL:-https://${FACTORY_DOMAIN}}"
ADMIN_USER="${ADMIN_USER:-admin}"
MEDIA_PROVIDER="${MEDIA_PROVIDER:-mock}"
ARK_API_KEY="${ARK_API_KEY:-}"
DOUBAO_TTS_APPID="${DOUBAO_TTS_APPID:-}"
DOUBAO_TTS_TOKEN="${DOUBAO_TTS_TOKEN:-}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo "=== BizBrain VPS 部署 — ${TIMESTAMP} ==="

# ── 安全检查 ──────────────────────────────────────────────────────────────────
command -v docker &>/dev/null || error "Docker 未安装"
info "Docker 可用 ✓"

if ss -tulpn 2>/dev/null | grep -q ":3031 "; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "bizbrain-app|marketvoice-app"; then
    error "端口 3031 被其他进程占用。"
  fi
  warn "端口 3031 已被本项目旧容器占用 — 将替换。"
fi
info "端口检查通过 ✓"

mkdir -p "${APP_DIR}" "${BACKUP_DIR}/db"

# ── 拉代码 ────────────────────────────────────────────────────────────────────
info "拉取最新代码..."
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi
info "代码就绪 ✓"

# ── 写 .env ───────────────────────────────────────────────────────────────────
info "写入生产 .env ..."
cat > "${APP_DIR}/.env" <<EOF
NODE_ENV=production

FACTORY_APP_PORT=3031
FACTORY_APP_URL=${APP_URL}
FACTORY_DOMAIN=${FACTORY_DOMAIN}

DATABASE_URL=postgresql://bizbrain_user:${DB_PASSWORD}@bizbrain-postgres:5432/bizbrain
POSTGRES_PASSWORD=${DB_PASSWORD}

FACTORY_ADMIN_USER=${ADMIN_USER}
FACTORY_ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}

N8N_WEBHOOK_SECRET=${WEBHOOK_SECRET}

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ANTHROPIC_MODEL=claude-sonnet-5
AI_MOCK=

MEDIA_PROVIDER=${MEDIA_PROVIDER}
ARK_API_KEY=${ARK_API_KEY}
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_MODEL=doubao-seedream-4-0-250828
SEEDANCE_MODEL=doubao-seedance-1-0-pro-250528
DOUBAO_TTS_APPID=${DOUBAO_TTS_APPID}
DOUBAO_TTS_TOKEN=${DOUBAO_TTS_TOKEN}
DOUBAO_TTS_CLUSTER=volcano_tts
DOUBAO_TTS_VOICE=zh_male_yuanboxiaoshu_moon_bigtts

DOUYIN_CLIENT_KEY=
DOUYIN_CLIENT_SECRET=

TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}

DATA_DIR=/app/data
EOF
chmod 600 "${APP_DIR}/.env"
info ".env 完成 ✓"

# ── 构建与启动 ────────────────────────────────────────────────────────────────
info "构建 Docker 镜像(需要几分钟)..."
cd "${APP_DIR}"
docker compose build --no-cache
docker compose up -d

info "等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
  if docker compose exec -T bizbrain-postgres pg_isready -U bizbrain_user -d bizbrain &>/dev/null 2>&1; then
    info "PostgreSQL 就绪 ✓"
    break
  fi
  [ "$i" -eq 30 ] && error "PostgreSQL 60秒内未就绪。"
  sleep 2
done

# ── 迁移与种子 ────────────────────────────────────────────────────────────────
info "执行数据库迁移..."
docker compose exec -T bizbrain-app node ./node_modules/prisma/build/index.js migrate deploy
info "写入选题库种子(约127条,北美案例加重)..."
docker compose exec -T bizbrain-app ./node_modules/.bin/tsx prisma/seed.ts
info "种子完成 ✓"

# ── 验证(Traefik 负责 HTTPS,不再配置 nginx) ────────────────────────────────
sleep 6
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3031/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  info "健康检查 HTTP 200 ✓"
else
  warn "健康检查返回 HTTP ${HTTP_CODE},最近日志:"
  docker compose logs --tail=40 bizbrain-app
fi

echo ""
echo "============================================================"
echo "  生意脑回路(BizBrain)部署完成!"
echo "============================================================"
echo ""
echo "后台(直连): http://$(hostname -I | awk '{print $1}'):3031/login"
echo "后台(域名): ${APP_URL}/login  (DNS 指向本机后由 Traefik 自动签发证书)"
echo "登录: ${ADMIN_USER} / <你设置的密码>"
echo ""
echo "──────────────────────────────────────────────────────────"
echo "  后续步骤"
echo "──────────────────────────────────────────────────────────"
echo "1. DNS:${FACTORY_DOMAIN} → 本机IP(Traefik 自动 HTTPS,无需 nginx/certbot)"
echo "2. n8n:导入 ${APP_DIR}/n8n/ 下的 5 个工作流,"
echo "   在 n8n 环境变量里配置 FACTORY_APP_URL、N8N_WEBHOOK_SECRET、TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID"
echo "   03 工作流需要创建 Telegram 凭据并替换占位 credential id"
echo "3. 备份 cron:"
echo "   echo '0 2 * * * bash ${APP_DIR}/scripts/backup-db.sh >> ${BACKUP_DIR}/backup.log 2>&1' | crontab -"
echo ""
