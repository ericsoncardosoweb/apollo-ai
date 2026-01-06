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
CURRENT_MIGRATION_VERSION = 5

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
""",
    # Version 2 -> 3: Contacts, WhatsApp Connections, Quick Replies, Settings
    2: """
-- ===========================================
-- CONTACTS TABLE (replaces leads)
-- ===========================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    cpf TEXT,
    cnpj TEXT,
    type TEXT DEFAULT 'lead' CHECK (type IN ('lead', 'client', 'prospect', 'partner', 'other')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked', 'archived')),
    source TEXT,
    channel TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zipcode TEXT,
    company_name TEXT,
    company_role TEXT,
    avatar_url TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp ON contacts(whatsapp);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);

-- Contact Tags
CREATE TABLE IF NOT EXISTS contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#868e96',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- WHATSAPP CONNECTIONS
-- ===========================================
CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    provider TEXT NOT NULL CHECK (provider IN ('uazapi', 'evolution', 'meta_cloud', 'baileys')),
    instance_id TEXT,
    api_url TEXT,
    api_key TEXT,
    webhook_url TEXT,
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('connecting', 'connected', 'disconnected', 'qr_pending', 'error', 'banned')),
    qr_code TEXT,
    qr_expires_at TIMESTAMPTZ,
    phone_number TEXT,
    phone_name TEXT,
    phone_platform TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    auto_reconnect BOOLEAN DEFAULT true,
    daily_message_limit INTEGER DEFAULT 200,
    messages_sent_today INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- QUICK REPLIES
-- ===========================================
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    shortcut TEXT,
    category TEXT,
    media_url TEXT,
    media_type TEXT,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut) WHERE shortcut IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quick_replies_category ON quick_replies(category);

-- Increment usage function
CREATE OR REPLACE FUNCTION increment_quick_reply_usage(reply_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE quick_replies 
    SET usage_count = usage_count + 1, last_used_at = NOW()
    WHERE id = reply_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TENANT SETTINGS
-- ===========================================
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_all" ON contacts;
DROP POLICY IF EXISTS "contact_tags_all" ON contact_tags;
DROP POLICY IF EXISTS "whatsapp_connections_all" ON whatsapp_connections;
DROP POLICY IF EXISTS "quick_replies_all" ON quick_replies;
DROP POLICY IF EXISTS "tenant_settings_all" ON tenant_settings;

CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "contact_tags_all" ON contact_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "whatsapp_connections_all" ON whatsapp_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "quick_replies_all" ON quick_replies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_settings_all" ON tenant_settings FOR ALL USING (true) WITH CHECK (true);
""",
    # Version 3 -> 4: Campaigns Module
    3: """
-- ===========================================
-- MESSAGE TEMPLATES
-- ===========================================
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active) WHERE is_deleted = false;

-- ===========================================
-- TEMPLATE CONTENTS
-- ===========================================
CREATE TABLE IF NOT EXISTS template_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'contact', 'location', 'interval')),
    content TEXT,
    media_url TEXT,
    media_filename TEXT,
    media_mimetype TEXT,
    send_as_voice BOOLEAN DEFAULT false,
    interval_seconds INTEGER CHECK (interval_seconds <= 50),
    contact_data JSONB,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name TEXT,
    location_address TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_contents_template ON template_contents(template_id);

-- ===========================================
-- CAMPAIGNS
-- ===========================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
    connection_id UUID,
    connection_name TEXT,
    scheduled_at TIMESTAMPTZ,
    schedule_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
    schedule_start_hour INTEGER DEFAULT 9,
    schedule_end_hour INTEGER DEFAULT 21,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    max_daily_volume INTEGER DEFAULT 200,
    min_interval_seconds INTEGER DEFAULT 30,
    max_interval_seconds INTEGER DEFAULT 50,
    use_random_intervals BOOLEAN DEFAULT true,
    batch_size INTEGER DEFAULT 10,
    batch_pause_minutes INTEGER DEFAULT 15,
    contact_filters JSONB DEFAULT '{}',
    template_distribution TEXT DEFAULT 'random' CHECK (template_distribution IN ('random', 'sequential', 'weighted')),
    assigned_agent_id UUID,
    assigned_agent_name TEXT,
    ai_agent_id UUID,
    ai_agent_name TEXT,
    on_delivery_actions JSONB DEFAULT '[]',
    on_response_actions JSONB DEFAULT '[]',
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    created_by UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ===========================================
-- CAMPAIGN TEMPLATES (many-to-many)
-- ===========================================
CREATE TABLE IF NOT EXISTS campaign_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
    weight INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, template_id)
);

-- ===========================================
-- CAMPAIGN DELIVERIES
-- ===========================================
CREATE TABLE IF NOT EXISTS campaign_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID,
    contact_name TEXT,
    contact_phone TEXT NOT NULL,
    template_id UUID,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
    scheduled_for TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    external_message_id TEXT,
    error_message TEXT,
    error_code TEXT,
    has_response BOOLEAN DEFAULT false,
    response_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign ON campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_status ON campaign_deliveries(status);

-- RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_all" ON message_templates;
DROP POLICY IF EXISTS "template_contents_all" ON template_contents;
DROP POLICY IF EXISTS "campaigns_all" ON campaigns;
DROP POLICY IF EXISTS "campaign_templates_all" ON campaign_templates;
DROP POLICY IF EXISTS "campaign_deliveries_all" ON campaign_deliveries;

CREATE POLICY "message_templates_all" ON message_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "template_contents_all" ON template_contents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_templates_all" ON campaign_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "campaign_deliveries_all" ON campaign_deliveries FOR ALL USING (true) WITH CHECK (true);
""",
    # Version 4 -> 5: AI Guardrails Security Layer
    4: """
-- ===========================================
-- AI Guardrails Security Layer
-- ===========================================

-- Enable guardrails protection (checkbox in UI)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_enabled BOOLEAN DEFAULT false;

-- Custom prompts for validation
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_input_prompt TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_output_prompt TEXT;

-- Regex patterns to block (prompt injection)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_blocked_patterns TEXT[] DEFAULT ARRAY[
    'ignore.*previous.*instructions?',
    'forget.*everything',
    'you are now',
    'pretend to be',
    'jailbreak',
    'DAN mode',
    'reveal.*prompt',
    'show.*system.*prompt'
];

-- Regex patterns for sensitive data
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_sensitive_patterns TEXT[] DEFAULT ARRAY[
    'custo real',
    'margem de lucro',
    'markup',
    'senha',
    'api key',
    'credenciais'
];

-- Message shown when blocked
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_block_message TEXT DEFAULT 'Desculpe, não posso ajudar com esse tipo de solicitação.';

-- Use LLM for semantic validation
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails_use_llm BOOLEAN DEFAULT true;

-- Index
CREATE INDEX IF NOT EXISTS idx_agents_guardrails ON agents(guardrails_enabled) WHERE guardrails_enabled = true;
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
