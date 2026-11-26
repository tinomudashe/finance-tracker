"""Benchmark API latency & throughput BEFORE vs AFTER enabling the caching layer."""
import asyncio
import statistics
import tempfile
import time
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.cache import store
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Account, Category, Transaction
from scripts.seed import seed_demo_data


def _percentile(sorted_vals: list[float], pct: float) -> float:
    idx = min(len(sorted_vals) - 1, max(0, int(round((pct / 100.0) * (len(sorted_vals) - 1)))))
    return sorted_vals[idx]


async def run_benchmark(iterations: int = 80) -> dict[str, dict[str, float]]:
    with tempfile.TemporaryDirectory() as tmp:
        db_url = f"sqlite+aiosqlite:///{Path(tmp) / 'bench.db'}"
        eng = create_async_engine(db_url, future=True)
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        Session = async_sessionmaker(bind=eng, class_=AsyncSession, expire_on_commit=False)

        async with Session() as db:
            user = await seed_demo_data(db)
            acct = await db.scalar(
                Account.__table__.select().where(Account.user_id == user.id)
            )
            cat = await db.scalar(
                Category.__table__.select().where(
                    Category.user_id == user.id, Category.type == "expense"
                )
            )
            # Bulk-insert 2,000 synthetic transactions to simulate realistic load
            base_day = date(2025, 6, 1)
            bulk = [
                Transaction(
                    user_id=user.id,
                    account_id=acct,
                    category_id=cat,
                    amount=Decimal("24.50"),
                    transaction_date=base_day + timedelta(days=i % 360),
                    type="debit",
                    description=f"Synthetic merchant #{i}",
                    is_reconciled=True,
                )
                for i in range(2000)
            ]
            db.add_all(bulk)
            await db.commit()

        async def _override_db():
            async with Session() as s:
                yield s

        app.dependency_overrides[get_db] = _override_db
        results: dict[str, dict[str, float]] = {}

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://bench"
        ) as client:
            for mode_name, cache_flag in (("before_cache", False), ("after_cache", True)):
                settings.ENABLE_REDIS_CACHE = cache_flag
                store.reset_fallback()
                login = await client.post(
                    "/api/auth/login",
                    json={"email": "daniel.brooks@gmail.com", "password": "Password123!"},
                )
                headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
                # Warmup 1 call when cache enabled so we measure steady-state hit path
                if cache_flag:
                    await client.get("/api/dashboard/summary", headers=headers)
                    await client.get("/api/transactions?page=1&limit=50", headers=headers)

                latencies_ms: list[float] = []
                t_start = time.perf_counter()
                for _ in range(iterations):
                    t0 = time.perf_counter()
                    r1 = await client.get("/api/dashboard/summary", headers=headers)
                    r2 = await client.get("/api/transactions?page=1&limit=50", headers=headers)
                    assert r1.status_code == 200 and r2.status_code == 200
                    latencies_ms.append((time.perf_counter() - t0) * 1000.0)
                elapsed = time.perf_counter() - t_start
                latencies_ms.sort()
                results[mode_name] = {
                    "p50_ms": round(statistics.median(latencies_ms), 2),
                    "p95_ms": round(_percentile(latencies_ms, 95), 2),
                    "p99_ms": round(_percentile(latencies_ms, 99), 2),
                    "rps": round((iterations * 2) / elapsed, 1),
                }

        settings.ENABLE_REDIS_CACHE = True
        app.dependency_overrides.clear()
        await eng.dispose()
        return results


if __name__ == "__main__":
    stats = asyncio.run(run_benchmark())
    print("Benchmark results (2,052 transactions, Dashboard + Transactions read pair):")
    for k, v in stats.items():
        print(f"  {k}: {v}")
