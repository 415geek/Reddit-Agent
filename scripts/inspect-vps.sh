#!/usr/bin/env bash
# BizBrain — VPS Pre-Deployment Inspection
# Run this FIRST on the VPS before deploying anything
set -euo pipefail

echo "=== BizBrain VPS Inspection ==="
echo "Date: $(date)"
echo ""

echo "--- System ---"
whoami && hostname && uname -m

echo ""
echo "--- Disk ---"
df -h

echo ""
echo "--- Memory ---"
free -m

echo ""
echo "--- Running Docker containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not running"

echo ""
echo "--- Docker Compose projects ---"
docker compose ls 2>/dev/null || true

echo ""
echo "--- Listening ports ---"
ss -tulpn | grep LISTEN

echo ""
echo "--- Port 3031 check ---"
if ss -tulpn | grep -q ":3031"; then
    echo "WARNING: Port 3031 is OCCUPIED — choose a different port"
    ss -tulpn | grep ":3031"
else
    echo "Port 3031 is FREE ✓"
fi

echo ""
echo "--- /opt directory ---"
ls -la /opt/

echo ""
echo "--- Nginx sites ---"
ls -la /etc/nginx/sites-available/ 2>/dev/null || echo "No sites-available dir"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "No sites-enabled dir"

echo ""
echo "--- Nginx config test ---"
nginx -t 2>&1 || true

echo ""
echo "--- Existing projects check ---"
echo "n8n:" && docker ps --format "{{.Names}}" | grep -i n8n || echo "  not found"
echo "n8n:" && docker ps --format "{{.Names}}" | grep -i leads || echo "  not found"

echo ""
echo "--- Inspection complete ---"
echo "Review output above before deploying BizBrain"
