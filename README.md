# FinanceTracker (`FinanceTrace — Personal Banking`)

A self-hosted, containerized personal finance system built with **React 18 + TypeScript**, **FastAPI (Python 3.12+)**, **PostgreSQL 16**, **Redis 7**, **Celery 5**, and **Nginx**.

- **GitHub Repository:** https://github.com/tinomudashe/finance-tracker
- **Trello Board:** https://trello.com/b/JYdaj90V/personal-finance-system
- **Architecture & Database Docs:** [docs/](docs/)

---

## Features

- **BCNF-Normalized PostgreSQL 16 Ledger:** 6 UUID-keyed tables (`users`, `accounts`, `categories`, `transactions`, `budgets`, `reports`) with `DECIMAL(15,2)` exact currency precision, `ON DELETE RESTRICT` immutable ledger guarantees, automatic `updated_at` triggers, and the real-time `budget_utilization` view.
- **Defense-in-Depth Authentication:** `bcrypt` (cost factor 12) password hashing, signed JWTs delivered via `httpOnly` cookies + `Bearer` header, Nginx `/api/auth/*` rate limiting, and instant server-side session revocation in Redis (`session:{user_id}:{sid}`).
- **Salesforce Lightning Banking UI (`FinanceTrace`):**
  - **Dashboard:** Interactive Net Worth, Monthly Income, Monthly Expenses, and Savings Rate KPI drill-down modals, 6-month `Income vs Expenses` SVG line chart, category `DonutChart`, budget progress bars, and recent activity.
  - **Transactions:** Search, multi-facet filtering, detail drawer, duplicate/edit/delete flows, **TF-IDF + Naive Bayes auto-categorization**, and **CSV bank statement import** with column auto-detection and SHA-256 duplicate prevention.
  - **Accounts:** Checking, Savings, Investment, Credit, and Cash Wallet tracking with live balances.
  - **Budgets:** Real-time threshold alerts (`>= 80%` nearing limit, `> 100%` over budget).
  - **Reports:** Multi-period analytics (`1m`, `3m`, `6m`, `1y` or custom range), **Excel (`.xlsx`)** export, and **PDF report generation** (via Celery / `fpdf2`).
  - **Settings:** User profile, hierarchical category management, Dark/Light/System appearance, multi-language (`EN` / `PL` / `FR`), and multi-currency (`USD` / `EUR` / `GBP`) preferences.

---

## Architecture Topology

- **`frontend-net` (bridge):** `nginx` ↔ `frontend` (`:3000`)
- **`backend-net` (internal bridge):** `nginx` ↔ `fastapi` (`:8000`) ↔ `postgres` (`:5432`), `redis` (`:6379`), `celery-worker`, `celery-beat`
- Only `nginx` binds host port `:80` in production; PostgreSQL and Redis have zero host port bindings.

---

## Quick Start

### 1. Local Development (Docker Compose with Hot Reload)
```bash
docker compose -f docker-compose.dev.yml up --build
```
- **Web UI:** http://localhost:3000 (click **Explore Demo Workspace (Daniel Brooks)** or sign in with `daniel.brooks@gmail.com` / `Password123!`)
- **Swagger / OpenAPI Docs:** http://localhost:8000/api/docs

### 2. Production Self-Hosting
```bash
cp .env.example .env
# Edit .env with strong POSTGRES_PASSWORD and SECRET_KEY
docker compose up -d --build
```
- **App Entrypoint (via Nginx):** http://localhost

### 3. Running Tests Locally
```bash
# Backend unit + integration + Alembic cycle tests (enforces >= 70% coverage)
make test-backend

# Frontend TypeScript + Vitest component suite
make test-frontend
```
