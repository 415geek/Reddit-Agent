#!/usr/bin/env bash
# BizBrain — 数据库备份
set -euo pipefail
DEPLOY_DIR="/opt/bizbrain"
BACKUP_DIR="$DEPLOY_DIR/backups/db"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/bizbrain-$TIMESTAMP.sql.gz"

docker exec bizbrain-postgres pg_dump -U bizbrain_user bizbrain | gzip > "$BACKUP_FILE"
echo "Backup saved: $BACKUP_FILE"

# 只保留最近7份
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
echo "Old backups cleaned. Current backups:"
ls -lh "$BACKUP_DIR"
