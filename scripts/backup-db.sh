#!/usr/bin/env bash
# MarketVoice — Database backup
set -euo pipefail
DEPLOY_DIR="/opt/marketvoice"
BACKUP_DIR="$DEPLOY_DIR/backups/db"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/marketvoice-$TIMESTAMP.sql.gz"

docker exec marketvoice-postgres pg_dump -U marketvoice_user marketvoice | gzip > "$BACKUP_FILE"
echo "Backup saved: $BACKUP_FILE"

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
echo "Old backups cleaned. Current backups:"
ls -lh "$BACKUP_DIR"
