#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  AI Workflow Platform - Database Backup"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/aiworkflow_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    err "Docker is required for backup"
fi

# Check if postgres container is running
if ! docker compose ps postgres --status running --format "{{.Status}}" | grep -q "Up"; then
    err "PostgreSQL container is not running"
fi

echo ""
echo "Creating backup..."

# Create backup
docker compose exec -T postgres pg_dump \
    -U aiworkflow \
    -d aiworkflow \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > "$BACKUP_FILE"

# Verify backup
if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    err "Backup file is empty or was not created"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Cleanup old backups
echo ""
echo "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "aiworkflow_*.sql.gz" -mtime +$BACKUP_RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
    log "Deleted $DELETED_COUNT old backup(s)"
else
    log "No old backups to delete"
fi

# List current backups
echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR"/aiworkflow_*.sql.gz 2>/dev/null || echo "  (none)"

echo ""
echo "============================================"
echo "  Backup complete!"
echo "============================================"
