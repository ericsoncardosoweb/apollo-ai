"""
Apollo A.I. Advanced - Tenant Connection Pool

Manages Supabase connections per tenant with:
- LRU cache for connection reuse
- TTL for connection refresh
- Thread-safe async operations
- Automatic cleanup of expired connections
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from dataclasses import dataclass
from collections import OrderedDict
import structlog

from supabase import create_client, Client

logger = structlog.get_logger()


@dataclass
class TenantConnection:
    """Holds a tenant's Supabase connection with metadata."""
    client: Client
    tenant_id: str
    supabase_url: str
    created_at: datetime
    last_used: datetime
    
    def is_expired(self, ttl_seconds: int) -> bool:
        """Check if connection has exceeded TTL."""
        age = (datetime.now(timezone.utc) - self.last_used).total_seconds()
        return age > ttl_seconds
    
    def touch(self):
        """Update last used timestamp."""
        self.last_used = datetime.now(timezone.utc)


class TenantConnectionPool:
    """
    Singleton connection pool for tenant Supabase clients.
    
    Features:
    - LRU cache: least recently used connections are evicted first
    - TTL: connections expire after inactivity
    - Max size: limits memory usage
    - Thread-safe: uses asyncio locks
    """
    
    _instance: Optional["TenantConnectionPool"] = None
    _lock: asyncio.Lock = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(
        self,
        max_connections: int = 100,
        ttl_seconds: int = 300,  # 5 minutes
        cleanup_interval: int = 60  # 1 minute
    ):
        if self._initialized:
            return
            
        self._connections: OrderedDict[str, TenantConnection] = OrderedDict()
        self._max_connections = max_connections
        self._ttl_seconds = ttl_seconds
        self._cleanup_interval = cleanup_interval
        self._cleanup_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self._initialized = True
        
        logger.info(
            "Tenant connection pool initialized",
            max_connections=max_connections,
            ttl_seconds=ttl_seconds
        )
    
    async def get_client(
        self,
        tenant_id: str,
        supabase_url: str,
        supabase_key: str
    ) -> Client:
        """
        Get or create a Supabase client for a tenant.
        
        Args:
            tenant_id: Unique tenant identifier
            supabase_url: Tenant's Supabase URL
            supabase_key: Tenant's Supabase service key
            
        Returns:
            Supabase client instance
        """
        async with self._lock:
            # Check if connection exists and is valid
            if tenant_id in self._connections:
                conn = self._connections[tenant_id]
                
                # Check if still pointing to same URL (config might have changed)
                if conn.supabase_url == supabase_url and not conn.is_expired(self._ttl_seconds):
                    conn.touch()
                    # Move to end (most recently used)
                    self._connections.move_to_end(tenant_id)
                    logger.debug("Connection cache hit", tenant_id=tenant_id)
                    return conn.client
                else:
                    # Connection expired or config changed, remove it
                    del self._connections[tenant_id]
                    logger.debug("Connection expired/changed", tenant_id=tenant_id)
            
            # Evict oldest if at capacity
            if len(self._connections) >= self._max_connections:
                oldest_id = next(iter(self._connections))
                del self._connections[oldest_id]
                logger.info("Evicted oldest connection", evicted_tenant=oldest_id)
            
            # Create new connection
            try:
                client = create_client(supabase_url, supabase_key)
                
                # Store URL and key on client for later access
                client._supabase_url = supabase_url
                client._supabase_key = supabase_key
                
                now = datetime.now(timezone.utc)
                conn = TenantConnection(
                    client=client,
                    tenant_id=tenant_id,
                    supabase_url=supabase_url,
                    created_at=now,
                    last_used=now
                )
                
                self._connections[tenant_id] = conn
                
                logger.info(
                    "New tenant connection created",
                    tenant_id=tenant_id,
                    pool_size=len(self._connections)
                )
                
                return client
                
            except Exception as e:
                logger.error("Failed to create tenant connection", tenant_id=tenant_id, error=str(e))
                raise
    
    async def invalidate(self, tenant_id: str):
        """Remove a specific tenant's connection from the pool."""
        async with self._lock:
            if tenant_id in self._connections:
                del self._connections[tenant_id]
                logger.info("Connection invalidated", tenant_id=tenant_id)
    
    async def invalidate_all(self):
        """Clear all connections from the pool."""
        async with self._lock:
            count = len(self._connections)
            self._connections.clear()
            logger.info("All connections invalidated", count=count)
    
    async def cleanup_expired(self):
        """Remove all expired connections."""
        async with self._lock:
            expired = [
                tid for tid, conn in self._connections.items()
                if conn.is_expired(self._ttl_seconds)
            ]
            
            for tid in expired:
                del self._connections[tid]
            
            if expired:
                logger.info("Expired connections cleaned up", count=len(expired))
    
    async def start_cleanup_task(self):
        """Start background task for periodic cleanup."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("Cleanup task started")
    
    async def stop_cleanup_task(self):
        """Stop the background cleanup task."""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            logger.info("Cleanup task stopped")
    
    async def _cleanup_loop(self):
        """Background loop for periodic cleanup."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self.cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Cleanup loop error", error=str(e))
    
    @property
    def size(self) -> int:
        """Current number of connections in pool."""
        return len(self._connections)
    
    @property
    def stats(self) -> dict:
        """Get pool statistics."""
        return {
            "size": len(self._connections),
            "max_size": self._max_connections,
            "ttl_seconds": self._ttl_seconds,
            "tenants": list(self._connections.keys())
        }


# Global pool instance
_pool: Optional[TenantConnectionPool] = None


def get_connection_pool() -> TenantConnectionPool:
    """Get the global connection pool instance."""
    global _pool
    if _pool is None:
        _pool = TenantConnectionPool()
    return _pool


async def get_tenant_client(
    tenant_id: str,
    supabase_url: str,
    supabase_key: str
) -> Client:
    """
    Convenience function to get a tenant's Supabase client.
    
    Uses the global connection pool for caching.
    """
    pool = get_connection_pool()
    return await pool.get_client(tenant_id, supabase_url, supabase_key)
