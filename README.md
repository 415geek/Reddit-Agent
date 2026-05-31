# Restaurant Competitive Intelligence Agent

A self-hosted AI agent system that monitors Reddit for restaurant technology discussions, POS system mentions, competitor activity, and sales opportunities — with human-approved Telegram workflows and a Streamlit dashboard.

## Features

- **Reddit Monitoring** — Scans 7 subreddits every 5 minutes for keyword matches
- **AI Opportunity Scoring** — Local LLM (Ollama/Qwen3) scores every post 0-10 across 5 categories
- **Lead Detection** — Identifies restaurant owners, POS shoppers, and new restaurant openings
- **AI Reply Generator** — 3 reply styles (Professional, Friendly, Educational) per opportunity
- **AI Post Generator** — Weekly content batch (industry insights, POS tips, delivery guides)
- **Telegram Approval** — All publishing requires human approval via Telegram bot
- **Streamlit Dashboard** — Web UI for all data, leads, replies, and analytics
- **n8n Workflows** — Optional workflow engine for scheduling and Telegram integration
- **Docker Ready** — Runs on Ubuntu, Jetson Orin 64GB, and Linux VPS

## Quick Start

### Option A: Native Python

```bash
# Clone and setup
git clone <repo-url>
cd Reddit-Agent
bash scripts/setup.sh

# Configure credentials
cp .env.example .env
nano .env   # Add Reddit API + Telegram credentials

# Start
source venv/bin/activate
python main.py

# Dashboard (separate terminal)
source venv/bin/activate
streamlit run src/dashboard/app.py
```

### Option B: Docker Compose

```bash
cp .env.example .env
nano .env   # Add credentials
bash scripts/start_docker.sh
```

### Option C: n8n Workflow Engine

```bash
bash scripts/start_docker.sh
# Open http://localhost:5678
# Import workflows from n8n/workflows/
```

## Configuration

### Reddit API Credentials

1. Go to https://www.reddit.com/prefs/apps
2. Create a new "script" app
3. Copy `client_id` and `client_secret` to `.env`

### Telegram Bot

1. Message @BotFather → `/newbot`
2. Copy the bot token to `.env`
3. Get your chat ID from @userinfobot → set `TELEGRAM_CHAT_ID`

### Ollama / Local LLM

```bash
# Install Ollama
bash scripts/install_ollama.sh

# Pull recommended model
ollama pull qwen3:8b

# Alternative lighter models
ollama pull llama3.2:3b
ollama pull deepseek-r1:7b
```

## Architecture

```
Reddit API
    │
    ▼
RedditMonitor (every 5 min)
    │  ← Collects posts + comments matching keywords
    ▼
AIScorer (Ollama/Qwen3)
    │  ← Scores 0-10, categorizes, detects competitors
    ▼
LeadDetector
    │  ← Identifies restaurant owners, POS shoppers
    ▼
ReplyGenerator (3 styles)
    │  ← Professional / Friendly / Educational drafts
    ▼
Telegram Bot
    │  ← Sends alerts with Approve/Edit/Skip buttons
    ▼
Human Approval
    │
    ▼
Streamlit Dashboard
    └── Overview / Opportunities / Competitors / Leads / Replies / Posts
```

## Monitored Subreddits

- r/restaurateur
- r/restaurantowners
- r/restaurant
- r/smallbusiness
- r/foodtrucks
- r/bubbletea
- r/entrepreneur

## Tracked Keywords

`menusifu`, `menu sifu`, `toast pos`, `square pos`, `clover pos`, `restaurant pos`, `delivery integration`, `doordash integration`, `ubereats integration`, `chinese restaurant pos`, `bubble tea pos`

## Competitors Tracked

**Primary:** MenuSifu, Toast, Square, Clover, Chowbus POS  
**Secondary:** SpotOn, Revel, Lightspeed, Owner.com, Popmenu

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/summary` | Daily summary |
| `/top` | Top 5 opportunities |
| `/leads` | Recent lead list |
| `/competitors` | Competitor mention report |
| `/stats` | System statistics |
| `/posts` | Generated content drafts |

## Dashboard Pages

- **Overview** — Metrics, recent opportunities, competitor chart
- **Opportunities** — Filterable opportunity list with scoring
- **Competitor Mentions** — Charts and trend analysis
- **Leads** — Lead list with type classification
- **Generated Replies** — Review replies by style and status
- **Generated Posts** — Weekly content drafts
- **Publishing History** — Approved/published content log

## Deployment

### Ubuntu VPS

```bash
# System dependencies
sudo apt update && sudo apt install -y python3 python3-pip python3-venv curl git
bash scripts/setup.sh
```

### Jetson Orin 64GB

```bash
# Jetson has ARM64 + CUDA — use native install
bash scripts/setup.sh
# Ollama supports ARM64 natively
```

### Systemd Service (Production)

```ini
# /etc/systemd/system/restaurant-agent.service
[Unit]
Description=Restaurant Intelligence Agent
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/reddit-agent
ExecStart=/opt/reddit-agent/venv/bin/python main.py
Restart=always
RestartSec=30
EnvironmentFile=/opt/reddit-agent/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable restaurant-agent
sudo systemctl start restaurant-agent
```

## Project Structure

```
Reddit-Agent/
├── main.py                     # Main orchestrator
├── config/config.yaml          # All settings
├── .env.example                # Credentials template
├── requirements.txt
├── src/
│   ├── agents/
│   │   ├── reddit_monitor.py   # Reddit collection
│   │   ├── ai_scorer.py        # Opportunity scoring
│   │   ├── lead_detector.py    # Lead detection
│   │   ├── reply_generator.py  # AI reply drafts
│   │   └── post_generator.py   # Weekly content
│   ├── database/
│   │   ├── models.py           # SQLite schema
│   │   └── db.py               # Session management
│   ├── telegram/
│   │   ├── bot.py              # Bot setup + alerts
│   │   ├── handlers.py         # Command handlers
│   │   └── keyboards.py        # Inline buttons
│   ├── dashboard/
│   │   └── app.py              # Streamlit dashboard
│   └── utils/
│       ├── ollama_client.py    # Ollama API client
│       └── logger.py           # Logging setup
├── n8n/workflows/              # n8n workflow exports
├── docker/                     # Docker Compose configs
└── scripts/                    # Setup + start scripts
```

## Roadmap

- [ ] Google Reviews monitoring
- [ ] Yelp monitoring
- [ ] Restaurant permit/registration data
- [ ] GEO-based monitoring
- [ ] AI visibility monitoring
- [ ] Multi-account Reddit support
- [ ] CRM integration
- [ ] Sales pipeline management
- [ ] PostgreSQL migration path
