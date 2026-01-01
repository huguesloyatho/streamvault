#!/bin/bash
set -e

# ===========================================
# StreamVault - Deployment Script
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_DIR"

# Check if .env exists
check_env() {
    if [ ! -f ".env" ]; then
        log_error ".env file not found!"
        log_info "Copy .env.example to .env and configure it:"
        echo "  cp .env.example .env"
        echo "  nano .env"
        exit 1
    fi
    
    source ".env"
    if [ "$PB_ENCRYPTION_KEY" == "your-32-character-encryption-key" ] || [ -z "$PB_ENCRYPTION_KEY" ]; then
        log_error "PB_ENCRYPTION_KEY must be set in .env"
        log_info "Generate one with: openssl rand -hex 16"
        exit 1
    fi
    
    log_success "Environment configuration validated"
}

# Build images
build() {
    log_info "Building Docker images..."
    docker compose build --no-cache
    log_success "Images built successfully"
}

# Start services
start() {
    log_info "Starting StreamVault..."
    docker compose up -d
    
    echo ""
    log_success "StreamVault is starting!"
    echo ""
    log_info "Services:"
    echo "  - Backend:  http://localhost:${PB_PORT:-8090}"
    echo "  - Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    echo ""
    log_info "Configure your reverse proxy to point to these ports"
    log_info "Use 'make logs' to view logs"
}

# Stop services
stop() {
    log_info "Stopping StreamVault..."
    docker compose down
    log_success "Services stopped"
}

# Show logs
logs() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        docker compose logs -f "$service"
    else
        docker compose logs -f
    fi
}

# Show status
status() {
    echo ""
    log_info "Container Status:"
    docker compose ps -a
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream $(docker compose ps -q 2>/dev/null) 2>/dev/null || true
}

# Backup data
backup() {
    local backup_dir="${1:-$PROJECT_DIR/backups}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p "$backup_dir"
    
    log_info "Creating backup..."
    
    # Get volume names
    local project_name=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]')
    
    docker compose stop pocketbase
    
    docker run --rm \
        -v ${project_name}_pb_data:/pb_data:ro \
        -v ${project_name}_recordings_data:/recordings:ro \
        -v "$backup_dir":/backup \
        alpine tar czf "/backup/streamvault_backup_$timestamp.tar.gz" /pb_data /recordings
    
    docker compose start pocketbase
    
    log_success "Backup created: $backup_dir/streamvault_backup_$timestamp.tar.gz"
}

# Restore data
restore() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will overwrite all existing data!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring from backup..."
    
    local project_name=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]')
    
    docker compose stop pocketbase
    
    docker run --rm \
        -v ${project_name}_pb_data:/pb_data \
        -v ${project_name}_recordings_data:/recordings \
        -v "$(cd "$(dirname "$backup_file")" && pwd)":/backup \
        alpine sh -c "cd / && tar xzf /backup/$(basename "$backup_file")"
    
    docker compose start pocketbase
    
    log_success "Restore completed"
}

# Update to latest
update() {
    log_info "Updating StreamVault..."
    
    # Pull latest code (if git repo)
    if [ -d ".git" ]; then
        git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
    fi
    
    # Rebuild and restart
    docker compose build
    docker compose up -d
    
    log_success "Update completed"
}

# Show help
show_help() {
    echo ""
    echo "StreamVault Deployment Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  build              Build Docker images"
    echo "  start              Start services"
    echo "  stop               Stop all services"
    echo "  restart            Restart services"
    echo "  update             Pull latest and rebuild"
    echo "  logs [service]     Show logs (pocketbase|frontend)"
    echo "  status             Show container status"
    echo "  backup [dir]       Backup data volumes"
    echo "  restore <file>     Restore from backup"
    echo "  help               Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 start"
    echo "  $0 logs pocketbase"
    echo "  $0 backup ./my-backups"
    echo ""
}

# Main
case "${1:-help}" in
    build)
        check_env
        build
        ;;
    start)
        check_env
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        start
        ;;
    update)
        check_env
        update
        ;;
    logs)
        logs "$2"
        ;;
    status)
        status
        ;;
    backup)
        backup "$2"
        ;;
    restore)
        restore "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
