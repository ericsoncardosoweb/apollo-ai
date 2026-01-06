"""
Apollo A.I. Advanced - Tenants Endpoints
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import structlog

from app.api.deps import CurrentUser, require_super_admin
from app.db.supabase import get_supabase, fetch_one, fetch_many, insert_one, update_one

logger = structlog.get_logger()
router = APIRouter()


# ===========================================
# Schemas
# ===========================================

class TenantBase(BaseModel):
    """Base tenant schema."""
    name: str
    slug: str
    email: EmailStr
    phone: Optional[str] = None
    document: Optional[str] = None


class TenantCreate(TenantBase):
    """Tenant creation schema."""
    plan: str = "starter"


class TenantUpdate(BaseModel):
    """Tenant update schema."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    timezone: Optional[str] = None
    whatsapp_gateway: Optional[str] = None
    whatsapp_instance_id: Optional[str] = None
    whatsapp_api_key: Optional[str] = None


class TenantResponse(TenantBase):
    """Tenant response schema."""
    id: UUID
    plan: str
    status: str
    max_agents: int
    max_conversations_month: int
    max_messages_month: int
    logo_url: Optional[str] = None
    primary_color: str
    whatsapp_gateway: Optional[str] = None


# ===========================================
# Endpoints
# ===========================================

@router.get("", response_model=List[TenantResponse])
async def list_tenants(
    current_user: CurrentUser = Depends(require_super_admin()),
    skip: int = 0,
    limit: int = 100
):
    """
    List all tenants (super_admin only).
    """
    tenants = await fetch_many(
        "tenants",
        order_by="created_at",
        order_desc=True,
        limit=limit,
        offset=skip
    )
    return tenants


@router.get("/me")
async def get_current_tenant(current_user: CurrentUser):
    """Get the current user's tenant."""
    tenant_id = current_user.get("tenant_id")
    
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not associated with any tenant"
        )
    
    tenant = await fetch_one("tenants", {"id": tenant_id})
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    current_user: CurrentUser = Depends(require_super_admin())
):
    """Get a specific tenant by ID (super_admin only)."""
    tenant = await fetch_one("tenants", {"id": str(tenant_id)})
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    current_user: CurrentUser = Depends(require_super_admin())
):
    """Create a new tenant (super_admin only)."""
    # Check if slug is unique
    existing = await fetch_one("tenants", {"slug": tenant_data.slug})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant with this slug already exists"
        )
    
    # Create tenant
    tenant = await insert_one("tenants", tenant_data.model_dump())
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tenant"
        )
    
    # Create default pipeline stages
    client = get_supabase()
    client.rpc("seed_default_pipeline", {"p_tenant_id": tenant["id"]}).execute()
    
    logger.info("Tenant created", tenant_id=tenant["id"], slug=tenant_data.slug)
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdate,
    current_user: CurrentUser
):
    """
    Update a tenant.
    
    - Super admins can update any tenant.
    - Admins can only update their own tenant.
    """
    user_role = current_user.get("role")
    user_tenant_id = current_user.get("tenant_id")
    
    # Authorization check
    if user_role != "super_admin" and str(tenant_id) != user_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update other tenants"
        )
    
    # Perform update
    update_data = tenant_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data provided for update"
        )
    
    tenant = await update_one(
        "tenants",
        {"id": str(tenant_id)},
        update_data
    )
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    logger.info("Tenant updated", tenant_id=str(tenant_id))
    return tenant
