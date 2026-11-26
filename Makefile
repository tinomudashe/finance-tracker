.PHONY: dev up down migrate downgrade seed test test-backend test-frontend e2e lint clean

dev:
	docker compose -f docker-compose.dev.yml up --build

up:
	docker compose up -d --build

down:
	docker compose down
	docker compose -f docker-compose.dev.yml down

migrate:
	cd backend && ../.venv/bin/alembic upgrade head

downgrade:
	cd backend && ../.venv/bin/alembic downgrade base

seed:
	cd backend && PYTHONPATH=. ../.venv/bin/python scripts/seed.py

test-backend:
	cd backend && PYTHONPATH=. ../.venv/bin/pytest --cov=app --cov-report=term-missing --cov-fail-under=70

test-frontend:
	cd frontend && npm test -- --run

test: test-backend test-frontend

e2e:
	cd e2e && npx playwright test

lint:
	../.venv/bin/ruff check backend || .venv/bin/ruff check backend
	cd frontend && npm run lint

clean:
	rm -rf backend/.pytest_cache backend/htmlcov backend/.coverage frontend/dist
