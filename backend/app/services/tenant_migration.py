"""
Tenant Migration Service - Automatic database migrations for tenant Supabase
"""

import httpx
import structlog
from typing import Optional
from dataclasses import dataclass

from app.db.supabase import get_supabase

logger = structlog.get_logger()

# Current migration version
CURRENT_MIGRATION_VERSION = 2

# Migration SQL (version -> SQL)
MIGRATIONS = {
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

INSERT INTO crm_pipelines (name, description, is_default, stages) 
SELECT 'Funil de Vendas', 'Pipeline padrão', true,
    '[{"id":"lead","name":"Lead","color":"#868e96","position":0,"is_conversion_point":false},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1,"is_conversion_point":false},{"id":"proposta","name":"Proposta","color":"#228be6","position":2,"is_conversion_point":false},{"id":"negociacao","name":"Negociação","color":"#7950f2","position":3,"is_conversion_point":false},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":4,"is_conversion_point":true}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE is_default = true);

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


@dataclass
class MigrationResult:
    success: bool
    new_version: int
    message: str
    error: Optional[str] = None


class TenantMigrationService:
    """Service to run database migrations on tenant Supabase instances."""
    
    def __init__(self):
        self.master_client = get_supabase()
    
    async def get_tenant_config(self, tenant_id: str) -> Optional[dict]:
        """Get tenant database configuration from master DB."""
        result = self.master_client.table("tenant_database_config").select("*").eq("tenant_id", tenant_id).single().execute()
        return result.data if result.data else None
    
    async def run_migration(self, tenant_id: str, target_version: int = CURRENT_MIGRATION_VERSION) -> MigrationResult:
        """Run migrations on a tenant's database up to target_version."""
        
        # Get tenant config
        config = await self.get_tenant_config(tenant_id)
        if not config:
            return MigrationResult(
                success=False,
                new_version=0,
                message="Tenant config not found",
                error="No database configuration found for this tenant"
            )
        
        current_version = config.get("migrations_version", 0)
        
        if current_version >= target_version:
            return MigrationResult(
                success=True,
                new_version=current_version,
                message="Database already up to date"
            )
        
        # Build SQL from current to target version
        sql_parts = []
        for v in range(current_version, target_version):
            if v in MIGRATIONS:
                sql_parts.append(MIGRATIONS[v])
        
        if not sql_parts:
            return MigrationResult(
                success=True,
                new_version=current_version,
                message="No migrations to run"
            )
        
        full_sql = "\n\n".join(sql_parts)
        
        # Execute SQL on tenant database
        result = await self._execute_sql_on_tenant(config, full_sql)
        
        if result.success:
            # Update version in master DB
            self.master_client.table("tenant_database_config").update({
                "migrations_version": target_version
            }).eq("tenant_id", tenant_id).execute()
            
            logger.info("Migration completed", tenant_id=tenant_id, from_version=current_version, to_version=target_version)
            return MigrationResult(
                success=True,
                new_version=target_version,
                message=f"Migrated from v{current_version} to v{target_version}"
            )
        
        return result
    
    async def _execute_sql_on_tenant(self, config: dict, sql: str) -> MigrationResult:
        """Execute SQL on tenant's Supabase using service role key."""
        
        supabase_url = config["supabase_url"]
        # Prefer service key for DDL operations
        api_key = config.get("supabase_service_key") or config.get("supabase_anon_key")
        
        if not api_key:
            return MigrationResult(
                success=False,
                new_version=0,
                message="No API key available",
                error="Tenant has no service_key or anon_key configured"
            )
        
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        # Try exec_sql RPC first (if bootstrap was run)
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                rpc_url = f"{supabase_url}/rest/v1/rpc/exec_sql"
                response = await client.post(
                    rpc_url,
                    headers=headers,
                    json={"sql_query": sql}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if isinstance(result, dict) and result.get("success"):
                        return MigrationResult(
                            success=True,
                            new_version=CURRENT_MIGRATION_VERSION,
                            message="Migration executed via exec_sql RPC"
                        )
                    elif isinstance(result, dict) and result.get("error"):
                        return MigrationResult(
                            success=False,
                            new_version=0,
                            message="SQL execution failed",
                            error=result.get("error")
                        )
                    else:
                        # RPC returned but no clear success/error - assume success
                        return MigrationResult(
                            success=True,
                            new_version=CURRENT_MIGRATION_VERSION,
                            message="Migration executed"
                        )
                
                elif response.status_code == 404:
                    # exec_sql doesn't exist - need to bootstrap first
                    logger.warning("exec_sql RPC not found, tenant needs bootstrap", url=supabase_url)
                    return MigrationResult(
                        success=False,
                        new_version=0,
                        message="Tenant not bootstrapped",
                        error="exec_sql function not found. Run 000_bootstrap.sql first."
                    )
                
                else:
                    error_text = response.text
                    logger.error("Migration failed", status=response.status_code, error=error_text)
                    return MigrationResult(
                        success=False,
                        new_version=0,
                        message=f"HTTP {response.status_code}",
                        error=error_text
                    )
                    
            except Exception as e:
                logger.error("Migration exception", error=str(e))
                return MigrationResult(
                    success=False,
                    new_version=0,
                    message="Connection error",
                    error=str(e)
                )
    
    async def bootstrap_tenant(self, tenant_id: str) -> MigrationResult:
        """Create the exec_sql function on a tenant database.
        
        Note: This requires running SQL directly, which needs the Supabase
        dashboard or a direct PostgreSQL connection. We provide the SQL
        for manual execution if RPC isn't available yet.
        """
        bootstrap_sql = """
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
"""
        
        config = await self.get_tenant_config(tenant_id)
        if not config:
            return MigrationResult(
                success=False,
                new_version=0,
                message="Tenant config not found"
            )
        
        # Try to execute bootstrap SQL
        return await self._execute_sql_on_tenant(config, bootstrap_sql)


# Singleton instance
_migration_service: Optional[TenantMigrationService] = None

def get_migration_service() -> TenantMigrationService:
    global _migration_service
    if _migration_service is None:
        _migration_service = TenantMigrationService()
    return _migration_service
