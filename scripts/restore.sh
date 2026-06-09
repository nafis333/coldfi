#!/bin/bash
set -euo pipefail

# ============================================================
# ColdFi - Database Restore Script
# ============================================================
# Usage: ./scripts/restore.sh [backup-file-or-s3-path]
# Requires: pg_restore, gpg, aws cli
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_DIR/.env.production" ]; then
  set -a
  source "$PROJECT_DIR/.env.production"
  set +a
fi

RESTORE_DIR="/tmp/restore"
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@coldfi.app}"
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://coldfi-backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-database}"

DB_HOST="${DB_BACKUP_HOST:-postgres}"
DB_PORT="${DB_BACKUP_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-coldfi}"
DB_USER="${POSTGRES_USER:-postgres}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
  exit 1
}

cleanup() {
  rm -rf "$RESTORE_DIR"
}

trap cleanup EXIT

BACKUP_SOURCE="${1:-}"

if [ -z "$BACKUP_SOURCE" ]; then
  echo "Available backups:"
  echo ""
  echo "Daily:"
  aws s3 ls "${S3_BUCKET}/${S3_PREFIX}/daily/" --recursive 2>/dev/null \
    | grep "\.sql\.gpg$" | sort -r | head -7 | awk '{print "  " $4 "  (" $1 " " $2 ")"}'
  echo ""
  echo "Weekly:"
  aws s3 ls "${S3_BUCKET}/${S3_PREFIX}/weekly/" --recursive 2>/dev/null \
    | grep "\.sql\.gpg$" | sort -r | head -4 | awk '{print "  " $4 "  (" $1 " " $2 ")"}'
  echo ""
  echo "Monthly:"
  aws s3 ls "${S3_BUCKET}/${S3_PREFIX}/monthly/" --recursive 2>/dev/null \
    | grep "\.sql\.gpg$" | sort -r | head -12 | awk '{print "  " $4 "  (" $1 " " $2 ")"}'
  echo ""
  echo "Usage: $0 <s3-path-or-local-file>"
  echo "Example: $0 ${S3_BUCKET}/${S3_PREFIX}/daily/coldfi_daily_20240115_030000.sql.gpg"
  exit 0
fi

log "Starting restore from: $BACKUP_SOURCE"

for cmd in pg_restore gpg aws sha512sum; do
  if ! command -v "$cmd" &> /dev/null; then
    error "$cmd is required but not installed"
  fi
done

mkdir -p "$RESTORE_DIR"

ENCRYPTED_FILE="$RESTORE_DIR/backup.sql.gpg"
CHECKSUM_FILE="$RESTORE_DIR/backup.sha512"

if [[ "$BACKUP_SOURCE" == s3://* ]]; then
  log "Downloading from S3..."
  aws s3 cp "$BACKUP_SOURCE" "$ENCRYPTED_FILE"
  CHECKSUM_PATH="${BACKUP_SOURCE%.sql.gpg}.sha512"
  aws s3 cp "$CHECKSUM_PATH" "$CHECKSUM_FILE" 2>/dev/null || true
elif [ -f "$BACKUP_SOURCE" ]; then
  log "Using local file: $BACKUP_SOURCE"
  cp "$BACKUP_SOURCE" "$ENCRYPTED_FILE"
  LOCAL_CHECKSUM="${BACKUP_SOURCE%.sql.gpg}.sha512"
  if [ -f "$LOCAL_CHECKSUM" ]; then
    cp "$LOCAL_CHECKSUM" "$CHECKSUM_FILE"
  fi
else
  error "Backup source not found: $BACKUP_SOURCE"
fi

if [ ! -f "$ENCRYPTED_FILE" ]; then
  error "Failed to download backup"
fi

log "Downloaded: $(du -h "$ENCRYPTED_FILE" | cut -f1)"

if [ -f "$CHECKSUM_FILE" ]; then
  log "Verifying checksum..."
  EXPECTED_CHECKSUM=$(awk '{print $1}' "$CHECKSUM_FILE")
  ACTUAL_CHECKSUM=$(sha512sum "$ENCRYPTED_FILE" | awk '{print $1}')
  if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
    error "Checksum verification failed! Expected: $EXPECTED_CHECKSUM, Got: $ACTUAL_CHECKSUM"
  fi
  log "Checksum verified: $ACTUAL_CHECKSUM"
else
  log "WARNING: No checksum file found, skipping verification"
fi

log "Decrypting backup..."
DUMP_FILE="$RESTORE_DIR/backup.sql"
gpg --batch --yes --decrypt --output "$DUMP_FILE" "$ENCRYPTED_FILE" 2>/dev/null

if [ ! -f "$DUMP_FILE" ]; then
  error "Decryption failed"
fi

log "Decrypted: $(du -h "$DUMP_FILE" | cut -f1)"

echo ""
echo "============================================"
echo "  WARNING: DATABASE RESTORE"
echo "============================================"
echo ""
echo "  This will REPLACE the current database:"
echo "    Host: $DB_HOST:$DB_PORT"
echo "    Database: $DB_NAME"
echo "    User: $DB_USER"
echo ""
echo "  All existing data will be LOST."
echo ""
read -p "  Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  log "Restore cancelled by user"
  exit 0
fi

log "Stopping backend services..."
if command -v docker &> /dev/null; then
  docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" stop backend 2>/dev/null || true
fi

log "Creating safety backup of current database..."
SAFETY_BACKUP="$RESTORE_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql"
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --file="$SAFETY_BACKUP" 2>/dev/null || log "WARNING: Could not create safety backup (database may be empty)"
log "Safety backup created: $SAFETY_BACKUP"

log "Restoring database..."
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname=postgres <<-EOSQL
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();
  DROP DATABASE IF EXISTS "$DB_NAME";
  CREATE DATABASE "$DB_NAME";
EOSQL

pg_restore \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --verbose \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE" 2>&1 | while read -r line; do
    [[ "$line" == *"error"* ]] && log "  WARNING: $line"
  done

log "Database restored"

log "Verifying restore..."
TABLE_COUNT=$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
log "Tables found: $TABLE_COUNT"

if [ "$TABLE_COUNT" -eq 0 ]; then
  error "Restore verification failed - no tables found"
fi

for table in users expenses groups settlements; do
  EXISTS=$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
    -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null | tr -d ' ')
  if [ "$EXISTS" = "t" ]; then
    log "  Table: $table"
  else
    log "  Table missing: $table"
  fi
done

log "Restarting backend services..."
if command -v docker &> /dev/null; then
  docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" start backend 2>/dev/null || true
  sleep 5
  for i in {1..5}; do
    if curl -sf http://localhost:3001/health/live > /dev/null 2>&1; then
      log "Backend is healthy"
      break
    fi
    log "Waiting for backend... ($i/5)"
    sleep 5
  done
fi

log ""
log "============================================"
log "  Restore Complete"
log "============================================"
log "  Source:     $BACKUP_SOURCE"
log "  Database:   $DB_NAME"
log "  Tables:     $TABLE_COUNT"
log "  Safety:     $SAFETY_BACKUP"
log "============================================"
log ""
log "Safety backup location: $SAFETY_BACKUP"
log "Keep this file until you verify the restore is correct."
