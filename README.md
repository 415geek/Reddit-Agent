# MarketVoice

Reddit + AI powered **Restaurant POS Market Intelligence Dashboard**.

Monitors Reddit RSS feeds across national restaurant communities and major U.S. city subreddits, detects discussions related to POS systems, payment processing, online ordering, and competitor complaints, then uses AI to score leads and display them in a dashboard.

**Live dashboard:** `https://voice.restaurantiq.ai`

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/415geek/Reddit-Agent.git /opt/marketvoice/app
cd /opt/marketvoice/app
cp .env.example .env
nano .env   # Fill in credentials (see Configuration below)
```

### 2. Start services

```bash
docker compose up -d
```

### 3. Run migrations and seed sources

```bash
docker compose exec marketvoice-app npx prisma migrate deploy
docker compose exec marketvoice-app npx prisma db seed
```

### 4. Access dashboard

```
http://<your-server-ip>:3031
```

---

## How to Start / Stop / Restart

```bash
# Start all
docker compose up -d

# Stop all (does NOT delete data)
docker compose down

# Restart app only
docker compose restart marketvoice-app

# View logs
docker compose logs -f marketvoice-app

# View all logs
docker compose logs -f
```

---

## Configuration

Edit `/opt/marketvoice/app/.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Database password (must match DATABASE_URL) |
| `MARKETVOICE_ADMIN_USER` | Dashboard login username |
| `MARKETVOICE_ADMIN_PASSWORD` | Dashboard login password |
| `JWT_SECRET` | Secret for session tokens (min 32 chars) |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis |
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative to OpenAI) |
| `AI_PROVIDER` | `openai` or `anthropic` |
| `N8N_WEBHOOK_SECRET` | Secret for n8n → app webhook |
| `N8N_INGEST_URL` | URL for n8n to POST analyzed posts |
| `TELEGRAM_BOT_TOKEN` | Telegram bot (optional) |
| `TELEGRAM_CHAT_ID` | Telegram chat ID (optional) |

Generate strong secrets:
```bash
openssl rand -base64 32
```

---

## AI API Key Setup

### OpenAI
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Anthropic
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Telegram Notifications (Optional)

1. Create bot via @BotFather → get token
2. Get your chat ID via @userinfobot
3. Set in `.env`:
```env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```
4. Restart: `docker compose restart marketvoice-app`

---

## Database Migrations

```bash
# Run pending migrations
docker compose exec marketvoice-app npx prisma migrate deploy

# Reset database (DESTRUCTIVE — deletes all data)
docker compose exec marketvoice-app npx prisma migrate reset

# Open Prisma Studio (GUI)
docker compose exec marketvoice-app npx prisma studio
```

---

## Seed Reddit Sources

The seed file adds all 28 default subreddits (5 national + 23 cities).

```bash
docker compose exec marketvoice-app npx prisma db seed
```

---

## Add New Subreddit

Insert directly into the database:

```sql
INSERT INTO marketvoice_sources 
  (id, "sourceName", subreddit, "rssUrl", city, state, region, "sourceType", priority, active, "createdAt", "updatedAt")
VALUES 
  ('portland-food', 'Portland Food', 'portlandfood', 'https://www.reddit.com/r/portlandfood/new/.rss', 
   'Portland', 'OR', 'West', 'city', 6, true, NOW(), NOW());
```

Or via Prisma Studio:
```bash
docker compose exec marketvoice-app npx prisma studio
```

---

## Modify Keyword List

Edit the n8n workflow node "Keyword Pre-Filter" directly in the n8n UI at `http://<server>:5678`.

Or modify the keyword array in the n8n workflow JSON at `n8n/marketvoice-workflow.json` and re-import.

---

## n8n Workflow Setup

1. Open n8n: `http://<server>:5678`
2. Import workflow: `n8n/marketvoice-workflow.json`
3. Configure credentials:
   - PostgreSQL: host=`marketvoice-postgres`, db=`marketvoice`, user=`marketvoice_user`
   - OpenAI API key
4. Set environment variables in n8n:
   - `N8N_INGEST_URL` = `https://voice.restaurantiq.ai/api/ingest`
   - `N8N_WEBHOOK_SECRET` = (same as in `.env`)
5. Activate the workflow

---

## Nginx Setup

### Install Nginx config

```bash
sudo cp nginx/marketvoice.conf /etc/nginx/sites-available/marketvoice.conf
sudo ln -s /etc/nginx/sites-available/marketvoice.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL with Certbot

```bash
# Verify DNS first
dig +short voice.restaurantiq.ai  # Should return 72.62.82.26

# Install SSL
sudo certbot --nginx -d voice.restaurantiq.ai
```

---

## Database Backup

```bash
# Manual backup
bash scripts/backup-db.sh

# Schedule daily backup (crontab)
0 2 * * * /opt/marketvoice/app/scripts/backup-db.sh >> /opt/marketvoice/backups/backup.log 2>&1
```

Backups are saved to `/opt/marketvoice/backups/db/` with 7-day retention.

## Database Restore

```bash
# Restore from backup
gunzip -c /opt/marketvoice/backups/db/marketvoice-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i marketvoice-postgres psql -U marketvoice_user marketvoice
```

---

## VPS Pre-Deployment Inspection

Run this FIRST before deploying to check existing services:

```bash
bash scripts/inspect-vps.sh
```

---

## Full VPS Deployment

```bash
bash scripts/deploy-vps.sh
```

---

## Verify Existing Projects Not Affected

After deployment, verify existing services still run:

```bash
# Check all containers
docker ps

# Check leads.maxwelllai.com
curl -I https://leads.maxwelllai.com

# Check n8n
curl -I http://localhost:5678

# Nginx test
sudo nginx -t

# MarketVoice app
curl -I http://127.0.0.1:3031
```

---

## Troubleshoot Nginx

```bash
# Test config
sudo nginx -t

# View error log
sudo tail -f /var/log/nginx/marketvoice.error.log

# View access log
sudo tail -f /var/log/nginx/marketvoice.access.log

# Reload nginx
sudo systemctl reload nginx

# Restore backup if needed
sudo cp -a /opt/marketvoice/backups/nginx-sites-available-<TIMESTAMP>/ /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Project Structure

```
/opt/marketvoice/app/
├── app/
│   ├── api/             # Next.js API routes
│   │   ├── auth/        # Login/logout
│   │   ├── overview/    # Stats endpoint
│   │   ├── leads/       # Leads with filtering
│   │   ├── cities/      # City ranking
│   │   ├── competitors/ # Competitor mentions
│   │   ├── pain-points/ # Pain point ranking
│   │   ├── posts/[id]/  # Lead detail
│   │   └── ingest/      # n8n → DB webhook
│   ├── dashboard/       # Dashboard pages
│   ├── login/           # Login page
│   └── globals.css
├── components/
│   ├── ui/              # Base UI components
│   ├── layout/          # Sidebar, header
│   └── dashboard/       # Stat cards, charts
├── lib/                 # Prisma, auth, utils
├── prisma/
│   ├── schema.prisma    # DB schema
│   └── seed.ts          # 28 Reddit sources
├── n8n/
│   └── marketvoice-workflow.json
├── nginx/
│   └── marketvoice.conf
├── scripts/
│   ├── inspect-vps.sh
│   ├── deploy-vps.sh
│   └── backup-db.sh
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Dashboard Pages

| Page | URL | Description |
|------|-----|-------------|
| Overview | `/dashboard` | Stats, trend chart, recent leads |
| Leads | `/dashboard/leads` | Filterable lead table |
| Cities | `/dashboard/cities` | Market ranking by city |
| Competitors | `/dashboard/competitors` | Competitor pain map |
| Pain Points | `/dashboard/pain-points` | Pain point frequency |
| Lead Detail | `/dashboard/posts/[id]` | Full AI analysis |

---

## API Endpoints

```
GET  /api/overview?range=24h|7d|30d|all
GET  /api/leads?range=7d&intent=high&city=...&minScore=7
GET  /api/cities?range=30d
GET  /api/competitors?range=30d
GET  /api/pain-points?range=30d
GET  /api/posts/:id
POST /api/ingest          (n8n webhook, requires X-Webhook-Secret header)
GET  /api/health          (health check)
```
