#!/bin/bash
# Daily backup script — run via cron at 3 AM
# Usage: ./backup.sh

set -e

BACKUP_DIR="/backups/coldfi"
DB_NAME="coldfi"
DB_USER="coldfi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="coldfi_${TIMESTAMP}.sql.gpg"

mkdir -p "$BACKUP_DIR"

pg_dump -U "$DB_USER" "$DB_NAME" | gpg --encrypt --recipient "admin@coldfi.app" > "$BACKUP_DIR/$FILENAME"

b2 upload-file coldfi-backups "$BACKUP_DIR/$FILENAME" "$FILENAME"

find "$BACKUP_DIR" -name "*.sql.gpg" -mtime +7 -delete

curl -X POST https://api.uptimerobot.com/ -d "api_key=$UPTIMEROBOT_API_KEY&format=json&type=1&monitorID=$MONITOR_ID"
echo "Backup complete: $FILENAME"
