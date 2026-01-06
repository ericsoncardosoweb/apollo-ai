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
    current_user: dict = Depends(require_super_admin()),
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
    current_user: dict = Depends(require_super_admin())
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
    current_user: dict = Depends(require_super_admin())
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


# ===========================================
# Migration Endpoint
# ===========================================

class RunMigrationRequest(BaseModel):
    """Request to run migration on tenant database."""
    target_version: int


class RunMigrationResponse(BaseModel):
    """Response from migration execution."""
    success: bool
    new_version: int
    message: str


# Current migration version
CURRENT_MIGRATION_VERSION = 2

# Migration SQL definitions (cumulative)
MIGRATION_SQL = {
    # Version 0 -> 1: CRM Tables
    0: """
-- CRM Pipelines
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default pipeline
INSERT INTO crm_pipelines (name, description, is_default, stages) 
SELECT 'Funil de Vendas', 'Pipeline padrão', true,
    '[{"id":"lead","name":"Lead","color":"#868e96","position":0,"is_conversion_point":false},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1,"is_conversion_point":false},{"id":"proposta","name":"Proposta","color":"#228be6","position":2,"is_conversion_point":false},{"id":"negociacao","name":"Negociação","color":"#7950f2","position":3,"is_conversion_point":false},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":4,"is_conversion_point":true}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE is_default = true);

-- CRM Deals (no FK dependencies)
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID,
    current_stage_id VARCHAR(100) NOT NULL DEFAULT 'lead',
    value DECIMAL(12,2) DEFAULT 0,
    cycle_number INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    assigned_user_id UUID,
    assigned_user_name VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    interested_services TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    conversation_id UUID
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);

-- Deal History
CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL,
    from_stage VARCHAR(100),
    to_stage VARCHAR(100) NOT NULL,
    duration_in_stage INT,
    triggered_by VARCHAR(50) DEFAULT 'user',
    triggered_by_id UUID,
    triggered_by_name VARCHAR(255),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_pipelines_all" ON crm_pipelines;
DROP POLICY IF EXISTS "crm_deals_all" ON crm_deals;
DROP POLICY IF EXISTS "crm_deal_history_all" ON crm_deal_history;

CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true) WITH CHECK (true);
""",
    # Version 1 -> 2: Automation tables
    1: """
CREATE TABLE IF NOT EXISTS automation_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('manual', 'pipeline_entry', 'pipeline_exit', 'schedule', 'condition', 'webhook')),
    trigger_config JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '[]',
    actions JSONB DEFAULT '[]',
    delay_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID,
    deal_id UUID,
    contact_id UUID,
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    current_action_index INT DEFAULT 0,
    result JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automation_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_journeys_all" ON automation_journeys;
DROP POLICY IF EXISTS "automation_executions_all" ON automation_executions;

CREATE POLICY "automation_journeys_all" ON automation_journeys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "automation_executions_all" ON automation_executions FOR ALL USING (true) WITH CHECK (true);
"""
}


@router.post("/{tenant_id}/run-migration", response_model=RunMigrationResponse)
async def run_tenant_migration(
    tenant_id: UUID,
    request: RunMigrationRequest,
    current_user: dict = Depends(require_super_admin())
):
    """
    Run database migration on tenant's Supabase.
    
    - Requires super_admin role
    - Uses exec_sql RPC function (must be bootstrapped first)
    - Updates migrations_version in master DB
    """
    from app.services.tenant_migration import get_migration_service
    
    service = get_migration_service()
    result = await service.run_migration(str(tenant_id), request.target_version)
    
    if not result.success:
        # If exec_sql not found, provide bootstrap instructions
        if "bootstrap" in (result.error or "").lower() or "exec_sql" in (result.error or "").lower():
            raise HTTPException(
                status_code=status.HTTP_424_FAILED_DEPENDENCY,
                detail={
                    "message": "Tenant database needs bootstrap. Run 000_bootstrap.sql first.",
                    "error": result.error,
                    "action_required": "bootstrap"
                }
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error or result.message
        )
    
    return RunMigrationResponse(
        success=result.success,
        new_version=result.new_version,
        message=result.message
    )


@router.post("/{tenant_id}/bootstrap")
async def bootstrap_tenant_database(
    tenant_id: UUID,
    current_user: dict = Depends(require_super_admin())
):
    """
    Bootstrap a tenant's database with exec_sql function.
    
    This must be run ONCE per tenant before migrations can work.
    Note: Bootstrap SQL must be executed manually via Supabase SQL Editor
    since exec_sql doesn't exist yet.
    """
    bootstrap_sql = '''
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    EXECUTE sql_query;
    RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
'''
    
    # Get tenant config to provide the Supabase URL
    client = get_supabase()
    result = client.table("tenant_database_config").select("supabase_url").eq("tenant_id", str(tenant_id)).single().execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant database config not found"
        )
    
    supabase_url = result.data["supabase_url"]
    # Extract project ID for SQL Editor URL
    import re
    match = re.match(r'https://([^.]+)\.supabase\.co', supabase_url)
    sql_editor_url = f"https://supabase.com/dashboard/project/{match.group(1)}/sql/new" if match else supabase_url
    
    return {
        "message": "Run this SQL in the tenant's Supabase SQL Editor",
        "sql": bootstrap_sql,
        "sql_editor_url": sql_editor_url,
        "instructions": [
            "1. Click the URL below to open the SQL Editor",
            "2. Paste the SQL and click RUN",
            "3. After success, migrations will work automatically"
        ]
    }


