#!/usr/bin/env bash
# 生意脑回路 — 成片合成 worker 部署(应用在 Vercel,只把合成放自己服务器)
#
# 在服务器上跑:先 export 下面几个变量,再 bash scripts/deploy-worker.sh
# 脚本会:拉代码 → 写 .env → 起容器 → 连通性自检 → 跑一轮真实合成验证
#
# 只需要 Docker,不需要 node、ffmpeg、数据库——都在镜像里。
set -euo pipefail

WORKER_DIR="${WORKER_DIR:-/opt/bizbrain/worker}"
BRANCH="${BRANCH:-claude/north-america-project-content-0jek2g}"
REPO_URL="${REPO_URL:-https://github.com/415geek/Reddit-Agent.git}"

# ── 必填 ──────────────────────────────────────────────────────────────────────
FACTORY_APP_URL="${FACTORY_APP_URL:?必填:应用地址,如 https://bizbrain-c8geek.vercel.app}"
N8N_WEBHOOK_SECRET="${N8N_WEBHOOK_SECRET:?必填:和应用同一个 webhook secret}"
# 应用用 Supabase Storage 时必填。两边必须是同一个桶,否则应用读不到 worker 产出的成片。
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-}"
SUPABASE_BUCKET="${SUPABASE_BUCKET:-assets}"

# ── 选填(调音量/画质/字幕)────────────────────────────────────────────────────
BGM_GAIN_DB="${BGM_GAIN_DB:--20}"
LOUDNESS_LUFS="${LOUDNESS_LUFS:--14}"
BURN_SUBTITLES="${BURN_SUBTITLES:-true}"
SUBTITLE_FONT="${SUBTITLE_FONT:-Noto Sans CJK SC}"
SUBTITLE_MAX_CHARS="${SUBTITLE_MAX_CHARS:-14}"
VIDEO_PRESET="${VIDEO_PRESET:-medium}"
VIDEO_CRF="${VIDEO_CRF:-20}"
POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-30000}"
WORKER_CPUS="${WORKER_CPUS:-2}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

FACTORY_APP_URL="${FACTORY_APP_URL%/}"
echo "=== 合成 worker 部署 → ${WORKER_DIR} ==="

command -v docker &>/dev/null || error "Docker 未安装"
docker compose version &>/dev/null || error "docker compose(v2)不可用"

# ── 先验票再干活:密钥不对的话,建完镜像才发现太浪费 ──────────────────────────
info "检查应用连通性与密钥..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${FACTORY_APP_URL}/api/health" || echo 000)
[ "$HEALTH" = "200" ] || error "应用健康检查返回 ${HEALTH},确认 FACTORY_APP_URL 是否正确、应用是否在跑"

QUEUE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-webhook-secret: ${N8N_WEBHOOK_SECRET}" \
  "${FACTORY_APP_URL}/api/pipeline/compose/next?worker=deploy-check" || echo 000)
[ "$QUEUE" = "200" ] || error "领任务接口返回 ${QUEUE}(401 就是 N8N_WEBHOOK_SECRET 和应用那边对不上)"
info "应用可达、密钥正确 ✓"

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  # 真写一个探针文件:光看 URL 通不通没意义,要的是这把 key 有没有写权限
  PROBE="_worker-probe/$(date +%s).txt"
  UP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${SUPABASE_URL%/}/storage/v1/object/${SUPABASE_BUCKET}/${PROBE}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" -H "apikey: ${SUPABASE_KEY}" \
    -H "Content-Type: text/plain" -H "x-upsert: true" --data-binary "ok" || echo 000)
  case "$UP" in
    200|201) info "Supabase 存储可写 ✓"
             curl -s -o /dev/null -X DELETE "${SUPABASE_URL%/}/storage/v1/object/${SUPABASE_BUCKET}/${PROBE}" \
               -H "Authorization: Bearer ${SUPABASE_KEY}" -H "apikey: ${SUPABASE_KEY}" || true ;;
    *) error "Supabase 上传探测返回 ${UP}:SUPABASE_KEY 没有写 ${SUPABASE_BUCKET} 桶的权限,成片会传不上去" ;;
  esac
else
  warn "没配 SUPABASE_URL/KEY —— 成片会写到容器本地卷。"
  warn "如果应用用的是 Supabase Storage,它将读不到成片。确认应用也是本地存储再继续。"
fi

# ── 拉代码 ────────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${WORKER_DIR}")"
if [ -d "${WORKER_DIR}/.git" ]; then
  info "更新代码..."
  git -C "${WORKER_DIR}" fetch origin "${BRANCH}"
  git -C "${WORKER_DIR}" checkout "${BRANCH}"
  git -C "${WORKER_DIR}" reset --hard "origin/${BRANCH}"
else
  info "克隆代码..."
  git clone --branch "${BRANCH}" --depth 1 "${REPO_URL}" "${WORKER_DIR}"
fi
info "代码就绪 ✓"

# ── 写 .env(只写 worker 用得上的,不放 Anthropic/fal 这些跟合成无关的密钥)──
info "写入 ${WORKER_DIR}/worker/.env ..."
cat > "${WORKER_DIR}/worker/.env" <<EOF
FACTORY_APP_URL=${FACTORY_APP_URL}
N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET}

SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
SUPABASE_BUCKET=${SUPABASE_BUCKET}

POLL_INTERVAL_MS=${POLL_INTERVAL_MS}
WORKER_CPUS=${WORKER_CPUS}

BGM_GAIN_DB=${BGM_GAIN_DB}
LOUDNESS_LUFS=${LOUDNESS_LUFS}
BURN_SUBTITLES=${BURN_SUBTITLES}
# 字体名带空格必须加引号:docker compose 会自己剥掉引号,
# 不加的话不走 Docker 直接 source .env 时 shell 会把它当命令执行
SUBTITLE_FONT="${SUBTITLE_FONT}"
SUBTITLE_MAX_CHARS=${SUBTITLE_MAX_CHARS}
VIDEO_PRESET=${VIDEO_PRESET}
VIDEO_CRF=${VIDEO_CRF}
EOF
chmod 600 "${WORKER_DIR}/worker/.env"
info ".env 完成 ✓"

# ── 构建与启动 ────────────────────────────────────────────────────────────────
# -f 必须显式指定:worker/docker-compose.yml 缺失时 docker compose 会往上一级找,
# 撞上根目录那份整套自托管编排,把应用和 Postgres 一起建起来——不是这里要的。
COMPOSE_FILE="${WORKER_DIR}/worker/docker-compose.yml"
[ -f "${COMPOSE_FILE}" ] || error "找不到 ${COMPOSE_FILE},代码版本太旧,确认分支 ${BRANCH} 是最新的"
DC=(docker compose -f "${COMPOSE_FILE}")

cd "${WORKER_DIR}/worker"
info "构建镜像(装 ffmpeg 和中文字体,首次要几分钟)..."
"${DC[@]}" build
info "启动 worker..."
"${DC[@]}" up -d

sleep 5
if ! docker ps --format '{{.Names}}' | grep -q '^bizbrain-compose-worker$'; then
  "${DC[@]}" logs --tail=50
  error "容器没起来,日志见上"
fi

# 字体装没装,决定字幕是中文还是一排方框——现在就查,别等第一条片子出来才发现
if ! "${DC[@]}" exec -T compose-worker fc-list :lang=zh 2>/dev/null | grep -q .; then
  warn "容器里没找到中文字体,字幕可能烧成方框。检查 worker/Dockerfile 的 fonts-noto-cjk"
else
  info "中文字体就位 ✓"
fi

echo ""
echo "============================================================"
echo "  合成 worker 已启动"
echo "============================================================"
echo "应用:      ${FACTORY_APP_URL}"
echo "存储:      $([ -n "$SUPABASE_URL" ] && echo "Supabase / ${SUPABASE_BUCKET} 桶" || echo "容器本地卷")"
echo "轮询间隔:  $((POLL_INTERVAL_MS / 1000)) 秒"
echo ""
echo "看日志:    docker compose -f ${WORKER_DIR}/worker/docker-compose.yml logs -f"
echo "重启:      docker compose -f ${WORKER_DIR}/worker/docker-compose.yml restart"
echo "停止:      docker compose -f ${WORKER_DIR}/worker/docker-compose.yml down"
echo "更新:      bash ${WORKER_DIR}/scripts/deploy-worker.sh   (同样的 export 再跑一遍)"
echo ""
echo "它每 $((POLL_INTERVAL_MS / 1000)) 秒去问一次有没有待合成的内容,有就做,做完自动进审批队列。"
echo "队列空的时候日志是安静的,这是正常的。"
echo ""
