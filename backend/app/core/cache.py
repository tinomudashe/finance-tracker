import json
import time
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings


class CacheAndSessionStore:
    """Async Redis store for JWT session revocation and query caching with graceful fallback."""

    def __init__(self) -> None:
        self._redis: Redis | None = None
        self._fallback_kv: dict[str, tuple[str, float]] = {}

    def _get_redis(self) -> Redis:
        if self._redis is None:
            self._redis = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
            )
        return self._redis

    def _fallback_get(self, key: str) -> str | None:
        item = self._fallback_kv.get(key)
        if not item:
            return None
        val, expires_at = item
        if expires_at < time.time():
            self._fallback_kv.pop(key, None)
            return None
        return val

    def _fallback_set(self, key: str, val: str, ttl: int) -> None:
        self._fallback_kv[key] = (val, time.time() + ttl)

    async def store_session(self, user_id: str, session_id: str, ttl: int | None = None) -> None:
        ttl_sec = ttl or settings.SESSION_TTL_SECONDS
        key = f"session:{user_id}:{session_id}"
        payload = json.dumps({"user_id": user_id, "created_at": int(time.time())})
        self._fallback_set(key, payload, ttl_sec)
        try:
            await self._get_redis().setex(key, ttl_sec, payload)
        except (RedisError, OSError):
            pass

    async def is_session_active(self, user_id: str, session_id: str) -> bool:
        key = f"session:{user_id}:{session_id}"
        try:
            val = await self._get_redis().get(key)
            if val is not None:
                return True
        except (RedisError, OSError):
            pass
        return self._fallback_get(key) is not None

    async def revoke_session(self, user_id: str, session_id: str) -> None:
        key = f"session:{user_id}:{session_id}"
        self._fallback_kv.pop(key, None)
        try:
            await self._get_redis().delete(key)
        except (RedisError, OSError):
            pass

    async def cache_get(self, key: str) -> Any | None:
        if not settings.ENABLE_REDIS_CACHE:
            return None
        raw: str | None = None
        try:
            raw = await self._get_redis().get(key)
        except (RedisError, OSError):
            raw = self._fallback_get(key)
        if raw is None:
            raw = self._fallback_get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    async def cache_set(self, key: str, value: Any, ttl: int | None = None) -> None:
        if not settings.ENABLE_REDIS_CACHE:
            return
        ttl_sec = ttl or settings.CACHE_TTL_SECONDS
        serialized = json.dumps(value, default=str)
        self._fallback_set(key, serialized, ttl_sec)
        try:
            await self._get_redis().setex(key, ttl_sec, serialized)
        except (RedisError, OSError):
            pass

    async def invalidate_user_cache(self, user_id: str) -> None:
        prefixes = (f"cache:tx:{user_id}:", f"cache:dash:{user_id}:")
        for k in list(self._fallback_kv.keys()):
            if k.startswith(prefixes):
                self._fallback_kv.pop(k, None)
        try:
            client = self._get_redis()
            for prefix in prefixes:
                keys = [k async for k in client.scan_iter(match=f"{prefix}*")]
                if keys:
                    await client.delete(*keys)
        except (RedisError, OSError):
            pass

    def reset_fallback(self) -> None:
        self._fallback_kv.clear()


store = CacheAndSessionStore()
