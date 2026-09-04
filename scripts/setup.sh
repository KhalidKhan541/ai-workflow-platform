#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  AI Workflow Platform - Project Setup"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check prerequisites
command -v node >/dev/null 2>&1 || err "Node.js is not installed"
command -v npm >/dev/null 2>&1 || err "npm is not installed"
command -v docker >/dev/null 2>&1 || warn "Docker not found - will skip container setup"

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    err "Node.js 18+ is required (found v$(node -v))"
fi
log "Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
log "Dependencies installed"

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate
log "Prisma client generated"

# Check if Docker is available for database
if command -v docker >/dev/null 2>&1; then
    echo ""
    echo "Starting PostgreSQL and Redis with Docker..."
    docker compose up -d postgres redis
    sleep 5

    # Wait for PostgreSQL
    echo "Waiting for PostgreSQL..."
    until docker compose exec postgres pg_isready -U aiworkflow > /dev/null 2>&1; do
        sleep 1
    done
    log "PostgreSQL is ready"

    # Wait for Redis
    echo "Waiting for Redis..."
    until docker compose exec redis redis-cli ping > /dev/null 2>&1; do
        sleep 1
    done
    log "Redis is ready"
else
    warn "Docker not available - ensure PostgreSQL and Redis are running"
fi

# Setup .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo ""
    echo "Creating .env.local from .env.example..."
    cp .env.example .env.local
    log ".env.local created - please update with your values"
else
    warn ".env.local already exists - skipping"
fi

# Run database migrations
echo ""
echo "Running database migrations..."
npx prisma db push --skip-generate
log "Database schema updated"

# Seed database
echo ""
echo "Seeding database..."
npx prisma db seed
log "Database seeded"

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Update .env.local with your API keys"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
