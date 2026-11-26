from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    accounts,
    auth,
    budgets,
    categories,
    csv_import,
    dashboard,
    reports,
    transactions,
    users,
)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Self-hosted Personal Finance System REST API (FastAPI + PostgreSQL 16 + Redis 7 + Celery 5)."
    ),
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "financetrace-api", "version": "1.0.0"}


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(csv_import.router, prefix="/api")
