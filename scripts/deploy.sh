#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  AI Workflow Platform - Deploy"
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
DEPLOY_ENV="${1:-production}"
COMPOSE_FILE="docker-compose.prod.yml"

# Pre-deployment checks
echo ""
echo "Running pre-deployment checks..."

# Check for uncommitted changes
if command -v git >/dev/null 2>&1; then
    if ! git diff --quiet HEAD 2>/dev/null; then
        warn "You have uncommitted changes"
    fi
fi

# Verify secrets exist
if [ ! -d secrets ]; then
    mkdir -p secrets
    warn "Created secrets/ directory - populate with production values"
fi

required_secrets=("database_url.txt" "redis_url.txt" "nextauth_secret.txt" "db_password.txt")
for secret in "${required_secrets[@]}"; do
    if [ ! -f "secrets/$secret" ]; then
        err "Missing secret: secrets/$secret"
    fi
done
log "All secrets present"

# Build
echo ""
echo "Building Docker images..."
docker compose -f "$COMPOSE_FILE" build --no-cache
log "Build complete"

# Database migrations
echo ""
echo "Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm app npx prisma migrate deploy
log "Migrations applied"

# Deploy
echo ""
echo "Deploying to $DEPLOY_ENV..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
log "Containers started"

# Health check
echo ""
echo "Running health check..."
sleep 10

HEALTH_RETRIES=30
HEALTH_COUNT=0
while [ $HEALTH_COUNT -lt $HEALTH_RETRIES ]; do
    if docker compose -f "$COMPOSE_FILE" exec -T app curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        log "Health check passed"
        break
    fi
    HEALTH_COUNT=$((HEALTH_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $HEALTH_COUNT -eq $HEALTH_RETRIES ]; then
    err "Health check failed after $HEALTH_RETRIES attempts"
fi

# Cleanup
echo ""
echo "Cleaning up old images..."
docker image prune -f
log "Cleanup complete"

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "Environment: $DEPLOY_ENV"
echo "Containers:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
