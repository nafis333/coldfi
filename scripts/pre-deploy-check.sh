#!/bin/bash
# Pre-deployment checklist
# Usage: ./scripts/pre-deploy-check.sh

set -e

echo "=== Pre-Deployment Check ==="

echo ""
echo "[1/6] Checking environment variables..."
for var in DB_PASSWORD JWT_SECRET VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
    if [ -z "${!var}" ]; then
        echo "  FAIL: $var is not set"
        exit 1
    fi
    echo "  OK: $var is set"
done

echo ""
echo "[2/6] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "  FAIL: Docker is not running"
    exit 1
fi
echo "  OK: Docker is running"

echo ""
echo "[3/6] Checking Docker Compose..."
if ! docker compose version > /dev/null 2>&1; then
    echo "  FAIL: Docker Compose is not available"
    exit 1
fi
echo "  OK: Docker Compose is available"

echo ""
echo "[4/6] Checking ports..."
for port in 80 443; do
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo "  WARN: Port $port is already in use"
    else
        echo "  OK: Port $port is free"
    fi
done

echo ""
echo "[5/6] Checking SSL certificates..."
if [ -n "$API_DOMAIN" ]; then
    if [ -f "/etc/letsencrypt/live/$API_DOMAIN/fullchain.pem" ]; then
        echo "  OK: SSL certificate found for $API_DOMAIN"
    else
        echo "  WARN: No SSL certificate found for $API_DOMAIN"
    fi
else
    echo "  WARN: API_DOMAIN not set, skipping SSL check"
fi

echo ""
echo "[6/6] Checking disk space..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "  FAIL: Disk usage is at ${DISK_USAGE}% (threshold 80%)"
    exit 1
fi
echo "  OK: Disk usage is at ${DISK_USAGE}%"

echo ""
echo "=== All checks passed ==="
