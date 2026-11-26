# Changelog

## [1.0.0] - 2026-11-25
### Added
- BCNF PostgreSQL 16 schema (`sql/schema.sql`), SQLAlchemy 2.0 async models, Alembic migrations (`0001_initial_schema`, `0002_budget_utilization_view`), and realistic 6-month demo seed dataset.
- FastAPI REST API with `bcrypt` + `httpOnly` JWT authentication, Redis session revocation, and 60s query caching.
- Full CRUD for Accounts, hierarchical Categories, Transactions, Budgets, Dashboard analytics, Notifications, Excel (`.xlsx`) & PDF reports, CSV bank statement import, and TF-IDF auto-categorization.
- React 18 + TypeScript `FinanceTrace` frontend with Salesforce Lightning design tokens, Dark/Light mode, `EN`/`PL`/`FR` localization, and `USD`/`EUR`/`GBP` currency support.
- Production & development Docker Compose setups with isolated `frontend-net` and `backend-net` bridge networks, Nginx rate limiting, Celery worker + Beat, GitHub Actions CI/CD, and automated test suites.
