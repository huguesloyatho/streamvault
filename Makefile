# ===========================================
# StreamVault - Makefile
# ===========================================

.PHONY: help dev build start stop restart logs status backup update clean init

# Default target
help:
	@echo ""
	@echo "StreamVault - Available Commands"
	@echo "================================="
	@echo ""
	@echo "Development:"
	@echo "  make dev          Start development environment (hot reload)"
	@echo ""
	@echo "Production:"
	@echo "  make build        Build production images"
	@echo "  make start        Start services"
	@echo "  make stop         Stop services"
	@echo "  make restart      Restart services"
	@echo "  make update       Pull latest and rebuild"
	@echo ""
	@echo "Monitoring:"
	@echo "  make logs         Show all logs"
	@echo "  make logs-backend Show backend logs"
	@echo "  make logs-frontend Show frontend logs"
	@echo "  make status       Show container status"
	@echo ""
	@echo "Data:"
	@echo "  make backup       Backup data volumes"
	@echo "  make clean        Remove containers and volumes"
	@echo ""
	@echo "Setup:"
	@echo "  make init         Initialize .env from template"
	@echo ""

# Development
dev:
	@./scripts/dev.sh

# Build
build:
	@./scripts/deploy.sh build

# Start/Stop
start:
	@./scripts/deploy.sh start

stop:
	@./scripts/deploy.sh stop

restart:
	@./scripts/deploy.sh restart

update:
	@./scripts/deploy.sh update

# Logs
logs:
	@docker compose logs -f

logs-backend:
	@docker compose logs -f pocketbase

logs-frontend:
	@docker compose logs -f frontend

# Status
status:
	@./scripts/deploy.sh status

# Backup
backup:
	@./scripts/deploy.sh backup

# Clean everything
clean:
	@echo "Stopping containers..."
	@docker compose down -v --remove-orphans
	@echo "Removing images..."
	@docker rmi streamvault/pocketbase:latest streamvault/frontend:latest 2>/dev/null || true
	@echo "Cleanup complete"

# Initialize
init:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		KEY=$$(openssl rand -hex 16); \
		sed -i.bak "s/your-32-character-encryption-key/$$KEY/" .env; \
		rm -f .env.bak; \
		echo "Created .env with generated encryption key"; \
		echo "Edit .env to configure FQDN and other settings"; \
	else \
		echo ".env already exists"; \
	fi
