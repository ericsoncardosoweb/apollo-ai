.PHONY: up down build logs logs-backend logs-frontend logs-redis shell-backend shell-frontend test migrate clean

# ===========================================
# Development Commands
# ===========================================

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build --no-cache

restart:
	docker-compose down && docker-compose up -d

# ===========================================
# Logs
# ===========================================

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-celery:
	docker-compose logs -f celery-worker celery-beat

logs-redis:
	docker-compose logs -f redis

# ===========================================
# Shell Access
# ===========================================

shell-backend:
	docker-compose exec backend bash

shell-frontend:
	docker-compose exec frontend sh

shell-redis:
	docker-compose exec redis redis-cli

# ===========================================
# Testing
# ===========================================

test:
	docker-compose exec backend pytest tests/ -v

test-cov:
	docker-compose exec backend pytest tests/ --cov=app --cov-report=html

lint:
	docker-compose exec backend ruff check app/
	docker-compose exec backend mypy app/

format:
	docker-compose exec backend ruff format app/

# ===========================================
# Database
# ===========================================

migrate:
	@echo "Run migrations in Supabase Dashboard or via CLI"

# ===========================================
# Production
# ===========================================

prod-up:
	docker-compose -f docker-compose.yml -f docker/docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.yml -f docker/docker-compose.prod.yml down

prod-build:
	docker-compose -f docker-compose.yml -f docker/docker-compose.prod.yml build --no-cache

# ===========================================
# Cleanup
# ===========================================

clean:
	docker-compose down -v --remove-orphans
	docker system prune -f

clean-all:
	docker-compose down -v --remove-orphans
	docker system prune -af
	docker volume prune -f
