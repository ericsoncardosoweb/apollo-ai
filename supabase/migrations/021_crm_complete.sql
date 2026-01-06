-- ============================================================================
-- APOLLO A.I. ADVANCED - MIGRATION 021
-- CRM Schema Completo com Custom Fields
-- ============================================================================

-- ============================================================================
-- 1. CRM Custom Fields Definitions - Campos personalizáveis por tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL, -- Nome interno (snake_case)
    field_label VARCHAR(255) NOT NULL, -- Label de exibição
    field_type VARCHAR(50) DEFAULT 'text', -- 'text', 'number', 'date', 'select', 'multiselect', 'boolean'
    field_options JSONB, -- Opções para select/multiselect
    is_required BOOLEAN DEFAULT false,
    is_ai_writable BOOLEAN DEFAULT true, -- A IA pode preencher este campo?
    display_order INTEGER DEFAULT 0,
    placeholder TEXT,
    default_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_crm_field_defs_tenant ON crm_field_definitions(tenant_id);

-- ============================================================================
-- 2. CRM Lead Custom Values - Valores dos campos customizados por lead
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_lead_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES crm_field_definitions(id) ON DELETE CASCADE,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    UNIQUE(lead_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_values_lead ON crm_lead_field_values(lead_id);

-- ============================================================================
-- 3. Enhance crm_leads with more columns
-- ============================================================================

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS source VARCHAR(100); -- 'whatsapp', 'website', 'manual', 'import'
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS value DECIMAL(12,2); -- Valor potencial do deal
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS expected_close_date DATE;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_ai_update TIMESTAMPTZ;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS ai_notes TEXT; -- Notas geradas pela IA

-- ============================================================================
-- 4. CRM Pipeline Stages - Ensure complete
-- ============================================================================

ALTER TABLE crm_pipeline_stages ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT 'gray';
ALTER TABLE crm_pipeline_stages ADD COLUMN IF NOT EXISTS auto_move_rules JSONB DEFAULT '[]';
-- auto_move_rules: [{ "from_intent": "purchase_intent", "to_stage": "qualificacao" }]

-- ============================================================================
-- 5. CRM Activity Log - Histórico de ações
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    activity_type VARCHAR(50) NOT NULL, -- 'stage_change', 'field_update', 'note_added', 'ai_action', 'message_sent'
    description TEXT,
    old_value JSONB,
    new_value JSONB,
    performed_by VARCHAR(50), -- 'ai', 'user', 'system'
    user_id UUID,
    agent_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activity_lead ON crm_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_tenant ON crm_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_created ON crm_activity_log(created_at DESC);

-- ============================================================================
-- 6. Default Pipeline Stages (if not exists)
-- ============================================================================

-- Function to create default stages for new tenants
CREATE OR REPLACE FUNCTION create_default_pipeline_stages(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO crm_pipeline_stages (tenant_id, name, position, color, is_won_stage, is_lost_stage)
    VALUES 
        (p_tenant_id, 'Novo', 1, 'blue', false, false),
        (p_tenant_id, 'Qualificados', 2, 'indigo', false, false),
        (p_tenant_id, 'Interessados', 3, 'green', false, false),
        (p_tenant_id, 'Proposta Enviada', 4, 'yellow', false, false),
        (p_tenant_id, 'Negociação', 5, 'orange', false, false),
        (p_tenant_id, 'Fechado Ganho', 6, 'teal', true, false),
        (p_tenant_id, 'Perdido', 7, 'red', false, true)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================

ALTER TABLE crm_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_field_defs_tenant" ON crm_field_definitions
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );

CREATE POLICY "crm_lead_values_access" ON crm_lead_field_values
    FOR ALL USING (
        lead_id IN (
            SELECT id FROM crm_leads 
            WHERE tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        )
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );

CREATE POLICY "crm_activity_tenant" ON crm_activity_log
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );
