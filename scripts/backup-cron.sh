#!/bin/bash
# ============================================================
# Cron wrapper for backup.sh
# Add to crontab:
#   0 3 * * * /opt/coldfi/scripts/backup-cron.sh daily
#   0 3 * * 0 /opt/coldfi/scripts/backup-cron.sh weekly
#   0 3 1 * * /opt/coldfi/scripts/backup-cron.sh monthly
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/coldfi/backup.log"

mkdir -p "$(dirname "$LOG_FILE")"

{
  echo "=== Backup started at $(date) ==="
  "$SCRIPT_DIR/backup.sh" "$@"
  EXIT_CODE=$?
  echo "=== Backup finished at $(date) (exit: $EXIT_CODE) ==="
} >> "$LOG_FILE" 2>&1

exit $EXIT_CODE
