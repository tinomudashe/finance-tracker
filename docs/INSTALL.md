# Self-Hosting Installation Guide

## Prerequisites
- Docker Engine 24+ and Docker Compose v2
- 1 GB+ RAM and 10 GB+ free disk space
- (Optional) Domain name pointed at your host for HTTPS / TLS termination

## Step-by-Step Deployment

1. **Clone the repository**
   ```bash
   git clone https://github.com/tinomudashe/finance-tracker.git
   cd finance-tracker
   ```

2. **Configure environment secrets**
   ```bash
   cp .env.example .env
   ```
   Generate strong secrets for `POSTGRES_PASSWORD` and `SECRET_KEY`:
   ```bash
   openssl rand -hex 32
   ```
   Set `COOKIE_SECURE=true` when serving behind HTTPS.

3. **Start the isolated 7-container stack**
   ```bash
   docker compose up -d --build
   ```
   Alembic migrations (`alembic upgrade head`) run automatically when the `fastapi` container starts.

4. **Seed optional demo data**
   ```bash
   docker compose exec fastapi python scripts/seed.py
   ```

5. **Verify health**
   ```bash
   curl http://localhost/api/health
   ```
