"""
Apollo A.I. Advanced - Redis Client

Provides Redis client for caching and queue management.
"""

from functools import lru_cache
from typing import Any

import redis.asyncio as redis
from redis.asyncio import Redis
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class RedisClient:
    """Redis client wrapper for async operations."""

    _client: Redis | None = None
    _available: bool = True

    @classmethod
    def _is_configured(cls) -> bool:
        """Check if Redis URL is configured and valid."""
        url = settings.redis_url
        return bool(url and url != "redis://localhost:6379/0" and not url.startswith("redis://localhost"))

    @classmethod
    async def get_client(cls) -> Redis | None:
        """Get Redis client instance. Returns None if not available."""
        if not cls._available:
            return None
            
        if cls._client is None:
            try:
                cls._client = redis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                # Test connection
                await cls._client.ping()
                logger.info("Redis client initialized", url=settings.redis_url)
            except Exception as e:
                logger.warning(f"Redis not available: {e}. Running without cache.")
                cls._available = False
                cls._client = None
                return None
        return cls._client

    @classmethod
    async def close(cls) -> None:
        """Close Redis connection."""
        if cls._client:
            await cls._client.close()
            cls._client = None
            logger.info("Redis client closed")


async def get_redis() -> Redis | None:
    """Get Redis client instance. Returns None if not available."""
    return await RedisClient.get_client()


# ===========================================
# Cache Helper Functions
# ===========================================

async def cache_get(key: str) -> str | None:
    """Get value from cache."""
    client = await get_redis()
    if client is None:
        return None
    try:
        return await client.get(key)
    except Exception:
        return None


async def cache_set(
    key: str,
    value: str,
    expire_seconds: int | None = None
) -> bool:
    """Set value in cache with optional expiration."""
    client = await get_redis()
    if client is None:
        return False
    try:
        if expire_seconds:
            return await client.setex(key, expire_seconds, value)
        return await client.set(key, value)
    except Exception:
        return False


async def cache_delete(key: str) -> int:
    """Delete key from cache."""
    client = await get_redis()
    if client is None:
        return 0
    try:
        return await client.delete(key)
    except Exception:
        return 0


async def cache_exists(key: str) -> bool:
    """Check if key exists in cache."""
    client = await get_redis()
    if client is None:
        return False
    try:
        return await client.exists(key) > 0
    except Exception:
        return False


# ===========================================
# Rate Limiting
# ===========================================

async def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int
) -> tuple[bool, int]:
    """
    Check rate limit for a given key.
    
    Returns:
        (is_allowed, remaining_requests)
    """
    client = await get_redis()
    
    # If Redis not available, allow all requests
    if client is None:
        return True, max_requests
    
    try:
        current = await client.get(key)
        
        if current is None:
            await client.setex(key, window_seconds, 1)
            return True, max_requests - 1
        
        count = int(current)
        
        if count >= max_requests:
            return False, 0
        
        await client.incr(key)
        return True, max_requests - count - 1
    except Exception:
        return True, max_requests



# ===========================================
# Pub/Sub for Realtime
# ===========================================

async def publish_message(channel: str, message: str) -> int:
    """Publish message to a Redis channel."""
    client = await get_redis()
    return await client.publish(channel, message)


async def subscribe_channel(channel: str):
    """Subscribe to a Redis channel."""
    client = await get_redis()
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    return pubsub
