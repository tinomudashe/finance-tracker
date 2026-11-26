# Performance Benchmark Report (Before vs. After Caching Layer)

## Methodology
- **Dataset:** Seeded Daniel Brooks workspace + 2,000 synthetic historical ledger rows (**2,052 total transactions** across 5 accounts and 13 categories).
- **Workload:** Paired read requests to `/api/dashboard/summary` and `/api/transactions?page=1&limit=50` over 80 iterations (`160` HTTP requests per run) via `backend/scripts/benchmark_cache.py`.
- **Locust Load Suite:** Available at `load-tests/locustfile.py` (`locust -f load-tests/locustfile.py --host http://localhost`).

## Measured Results

| Configuration | p50 Latency | p95 Latency | p99 Latency | Throughput (RPS) |
| --- | --- | --- | --- | --- |
| **Before Cache** (`ENABLE_REDIS_CACHE=false`) | 133.31 ms | 198.06 ms | 203.72 ms | 12.8 req/s |
| **After Cache** (`ENABLE_REDIS_CACHE=true`, 60s TTL) | **5.51 ms** | **6.00 ms** | **6.24 ms** | **360.1 req/s** |
| **Improvement** | **24.2x faster** | **33.0x faster** | **32.6x faster** | **28.1x higher** |

## Cache Invalidation & Resilience Guarantees
- Every write operation (`POST`, `PUT`, `DELETE` across accounts, categories, transactions, budgets, and CSV imports) immediately invalidates `cache:tx:{user_id}:*` and `cache:dash:{user_id}:*`.
- If Redis is unreachable, `CacheAndSessionStore` (`backend/app/core/cache.py`) degrades gracefully without failing API requests.
