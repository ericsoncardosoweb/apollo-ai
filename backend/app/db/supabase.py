"""
Apollo A.I. Advanced - Supabase Client

Provides authenticated and service-role Supabase clients.
"""

from functools import lru_cache
from typing import Any

from supabase import create_client, Client
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class SupabaseClient:
    """Supabase client wrapper with multiple authentication modes."""

    _anon_client: Client | None = None
    _service_client: Client | None = None

    @classmethod
    def get_anon_client(cls) -> Client:
        """Get Supabase client with anon key (for user-context operations)."""
        if cls._anon_client is None:
            cls._anon_client = create_client(
                settings.supabase_url,
                settings.supabase_anon_key
            )
            logger.info("Supabase anon client initialized")
        return cls._anon_client

    @classmethod
    def get_service_client(cls) -> Client:
        """Get Supabase client with service role key (bypasses RLS)."""
        if cls._service_client is None:
            cls._service_client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key
            )
            logger.info("Supabase service client initialized")
        return cls._service_client

    @classmethod
    def get_authenticated_client(cls, access_token: str) -> Client:
        """Get Supabase client authenticated with user's JWT."""
        client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        client.auth.set_session(access_token, "")
        return client


@lru_cache
def get_supabase() -> Client:
    """Get default Supabase client (service role for backend operations)."""
    return SupabaseClient.get_service_client()


# ===========================================
# Helper Functions
# ===========================================

async def fetch_one(
    table: str,
    filters: dict[str, Any],
    client: Client | None = None
) -> dict[str, Any] | None:
    """Fetch a single record from a table."""
    client = client or get_supabase()
    query = client.table(table).select("*")
    
    for key, value in filters.items():
        query = query.eq(key, value)
    
    result = query.limit(1).execute()
    
    if result.data:
        return result.data[0]
    return None


async def fetch_many(
    table: str,
    filters: dict[str, Any] | None = None,
    order_by: str | None = None,
    order_desc: bool = True,
    limit: int | None = None,
    offset: int | None = None,
    client: Client | None = None
) -> list[dict[str, Any]]:
    """Fetch multiple records from a table."""
    client = client or get_supabase()
    query = client.table(table).select("*")
    
    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)
    
    if order_by:
        query = query.order(order_by, desc=order_desc)
    
    if limit:
        query = query.limit(limit)
    
    if offset:
        query = query.range(offset, offset + (limit or 100) - 1)
    
    result = query.execute()
    return result.data or []


async def insert_one(
    table: str,
    data: dict[str, Any],
    client: Client | None = None
) -> dict[str, Any] | None:
    """Insert a single record into a table."""
    client = client or get_supabase()
    result = client.table(table).insert(data).execute()
    
    if result.data:
        return result.data[0]
    return None


async def update_one(
    table: str,
    filters: dict[str, Any],
    data: dict[str, Any],
    client: Client | None = None
) -> dict[str, Any] | None:
    """Update a single record in a table."""
    client = client or get_supabase()
    query = client.table(table).update(data)
    
    for key, value in filters.items():
        query = query.eq(key, value)
    
    result = query.execute()
    
    if result.data:
        return result.data[0]
    return None


async def delete_one(
    table: str,
    filters: dict[str, Any],
    client: Client | None = None
) -> bool:
    """Delete a single record from a table."""
    client = client or get_supabase()
    query = client.table(table).delete()
    
    for key, value in filters.items():
        query = query.eq(key, value)
    
    result = query.execute()
    return len(result.data) > 0 if result.data else False
