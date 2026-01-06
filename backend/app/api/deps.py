"""
Apollo A.I. Advanced - API Dependencies

Common dependencies for authentication, tenant context, and authorization.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from supabase import Client
import structlog

from app.core.config import settings
from app.core.security import decode_access_token
from app.core.exceptions import AuthenticationError, AuthorizationError, TenantError
from app.db.supabase import get_supabase, fetch_one

logger = structlog.get_logger()


# ===========================================
# Authentication
# ===========================================

async def get_current_user(
    authorization: Annotated[str | None, Header()] = None
) -> dict:
    """
    Extract and validate the current user from the Authorization header.
    
    Uses Supabase JWT for authentication.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = parts[1]
    
    # Validate with Supabase
    try:
        client = get_supabase()
        
        if client is None:
            raise AuthenticationError("Supabase not configured. Please check environment variables.")
        
        user_response = client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise AuthenticationError("Invalid or expired token")
        
        user = user_response.user
        
        # Get profile with tenant info
        profile = await fetch_one("profiles", {"id": str(user.id)})
        
        if not profile:
            raise AuthenticationError("User profile not found")
        
        return {
            "id": str(user.id),
            "email": user.email,
            "tenant_id": profile.get("tenant_id"),
            "role": profile.get("role", "agent"),
            "full_name": profile.get("full_name"),
            "permissions": profile.get("permissions", {}),
        }
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error("Authentication failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Type alias for dependency injection
CurrentUser = Annotated[dict, Depends(get_current_user)]


# ===========================================
# Tenant Context
# ===========================================

async def get_tenant_context(current_user: CurrentUser) -> dict:
    """
    Get the current tenant context from the authenticated user.
    
    Validates that the tenant is active and not suspended.
    """
    tenant_id = current_user.get("tenant_id")
    
    if not tenant_id:
        raise TenantError("User not associated with any tenant")
    
    tenant = await fetch_one("tenants", {"id": tenant_id})
    
    if not tenant:
        raise TenantError("Tenant not found")
    
    if tenant.get("status") != "active":
        raise TenantError(
            f"Tenant is {tenant.get('status')}. Please contact support.",
            details={"tenant_status": tenant.get("status")}
        )
    
    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.get("name"),
        "tenant_slug": tenant.get("slug"),
        "plan": tenant.get("plan"),
        "whatsapp_gateway": tenant.get("whatsapp_gateway"),
    }


TenantContext = Annotated[dict, Depends(get_tenant_context)]


# ===========================================
# Role-Based Authorization
# ===========================================

def require_role(*allowed_roles: str):
    """
    Dependency factory to require specific roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: CurrentUser = Depends(require_role("admin", "super_admin"))):
            ...
    """
    async def check_role(current_user: CurrentUser) -> dict:
        user_role = current_user.get("role", "agent")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' is not allowed. Required: {', '.join(allowed_roles)}",
            )
        
        return current_user
    
    return check_role


def require_super_admin():
    """Require super_admin role."""
    return require_role("super_admin")


def require_admin():
    """Require admin or super_admin role."""
    return require_role("admin", "super_admin")


def require_manager():
    """Require manager, admin, or super_admin role."""
    return require_role("manager", "admin", "super_admin")


# ===========================================
# Permission-Based Authorization
# ===========================================

def require_permission(permission: str):
    """
    Dependency factory to require specific permission.
    
    Usage:
        @router.post("/agents")
        async def create_agent(user: CurrentUser = Depends(require_permission("agents:create"))):
            ...
    """
    async def check_permission(current_user: CurrentUser) -> dict:
        permissions = current_user.get("permissions", {})
        user_role = current_user.get("role", "agent")
        
        # Super admin has all permissions
        if user_role == "super_admin":
            return current_user
        
        # Check specific permission
        if not permissions.get(permission, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        
        return current_user
    
    return check_permission
