#!/bin/bash
set -e

# ===========================================
# StreamVault - Development Script
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

cd "$PROJECT_DIR"

# Create .env if not exists
if [ ! -f ".env" ]; then
    log_info "Creating .env from .env.example..."
    cp .env.example .env
    # Generate a dev encryption key
    DEV_KEY=$(openssl rand -hex 16 2>/dev/null || echo "dev-key-32-characters-here!!")
    sed -i.bak "s/your-32-character-encryption-key/$DEV_KEY/" .env
    rm -f .env.bak
    log_success ".env created with dev encryption key"
fi

log_info "Starting development environment..."

# Use override file for development
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build

log_success "Development environment stopped"
