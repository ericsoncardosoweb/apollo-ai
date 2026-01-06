"""
Apollo A.I. Advanced - Database Helpers

Provides Supabase client utilities for tenant-specific connections.
"""

from supabase import create_client, Client
import structlog

logger = structlog.get_logger()


def get_tenant_supabase(supabase_url: str, supabase_key: str) -> Client:
    """
    Create a Supabase client for a specific tenant.
    
    Args:
        supabase_url: The tenant's Supabase URL
        supabase_key: The tenant's Supabase service key
    
    Returns:
        Supabase client instance
    """
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and key are required")
    
    client = create_client(supabase_url, supabase_key)
    
    # Store credentials for later access if needed  
    client._supabase_url = supabase_url
    client._supabase_key = supabase_key
    
    return client
