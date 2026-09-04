#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  AI Workflow Platform - Database Seed"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    # Try to source from .env.local
    if [ -f .env.local ]; then
        export $(grep -v '^#' .env.local | xargs)
    fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
    err "DATABASE_URL is not set"
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate
log "Prisma client generated"

# Push schema
echo "Pushing schema to database..."
npx prisma db push --skip-generate
log "Schema pushed"

# Seed
echo "Seeding database..."
npx prisma db seed
log "Database seeded successfully"

echo ""
echo "============================================"
echo "  Seed complete!"
echo "============================================"
