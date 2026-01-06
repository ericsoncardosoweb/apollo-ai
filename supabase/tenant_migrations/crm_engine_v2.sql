-- ============================================================================
-- CRM ENGINE V2 - Deals/Cycles Architecture
-- Client Supabase (Tenant) - Run on each CLIENT's database
-- ============================================================================

-- ============================================================================
-- 1. CRM PIPELINES - Funnel definitions with stages
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- stages: Array of {id, name, color, position, is_conversion_point, automations_config}
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default sales pipeline
INSERT INTO crm_pipelines (name, description, is_default, stages) VALUES (
    'Funil de Vendas',
    'Pipeline padrão para gestão de vendas',
    true,
    '[
        {"id": "lead", "name": "Lead", "color": "#868e96", "position": 0, "is_conversion_point": false},
        {"id": "qualificacao", "name": "Qualificação", "color": "#fab005", "position": 1, "is_conversion_point": false},
        {"id": "proposta", "name": "Proposta", "color": "#228be6", "position": 2, "is_conversion_point": false},
        {"id": "negociacao", "name": "Negociação", "color": "#7950f2", "position": 3, "is_conversion_point": false},
        {"id": "fechamento", "name": "Fechamento", "color": "#40c057", "position": 4, "is_conversion_point": true}
    ]'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. CRM DEALS - The Cycle (1 Contact → N Deals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contact reference
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255), -- Denormalized for performance
    contact_phone VARCHAR(50),
    
    -- Pipeline and stage
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
    current_stage_id VARCHAR(100) NOT NULL,
    
    -- Deal value for this cycle
    value DECIMAL(12,2) DEFAULT 0,
    
    -- Cycle tracking (1, 2, 3... for same contact)
    cycle_number INT DEFAULT 1,
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    
    -- Assignment
    assigned_user_id UUID,
    assigned_user_name VARCHAR(255),
    
    -- Tags and metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Services of interest
    interested_services TEXT[] DEFAULT '{}',
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    -- Conversation link (optional)
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_created ON crm_deals(created_at DESC);

-- ============================================================================
-- 3. CRM DEAL HISTORY - Immutable audit log
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    
    -- Stage movement
    from_stage VARCHAR(100),
    to_stage VARCHAR(100) NOT NULL,
    
    -- Time tracking
    duration_in_stage INT, -- seconds spent in previous stage
    
    -- Who triggered
    triggered_by VARCHAR(50) DEFAULT 'user', -- 'user', 'automation', 'ai', 'system'
    triggered_by_id UUID,
    triggered_by_name VARCHAR(255),
    
    -- Additional context
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_history_deal ON crm_deal_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_history_created ON crm_deal_history(created_at DESC);

-- ============================================================================
-- 4. AUTOMATION JOURNEYS - Scheduled actions definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('manual', 'pipeline_entry', 'pipeline_exit', 'schedule', 'condition', 'webhook')),
    trigger_config JSONB DEFAULT '{}',
    -- For pipeline_entry: {pipeline_id, stage_id, only_first_time: true}
    -- For schedule: {cron: "0 9 * * *"}
    -- For condition: {field, operator, value}
    
    -- Conditions to evaluate before execution
    conditions JSONB DEFAULT '[]',
    -- Array of: {field, operator, value}
    -- Operators: equals, not_equals, greater_than, less_than, contains, not_contains, is_empty, is_not_empty
    
    -- Actions to execute
    actions JSONB DEFAULT '[]',
    -- Array of: {type, payload, delay_config}
    -- Types: whatsapp_send, http_request, crm_move, tag_add, tag_remove, notification, update_field
    
    -- Delay between trigger and execution
    delay_config JSONB DEFAULT '{}',
    -- {value: 2, unit: "hours"} or {value: 1, unit: "days"}
    
    -- Control
    is_active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_journeys_trigger ON automation_journeys(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_journeys_active ON automation_journeys(is_active);

-- ============================================================================
-- 5. AUTOMATION EXECUTIONS - Job queue for pending/executed actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID REFERENCES automation_journeys(id) ON DELETE CASCADE,
    
    -- Target
    deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Current action being executed (for multi-step journeys)
    current_action_index INT DEFAULT 0,
    
    -- Result and error tracking
    result JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_scheduled ON automation_executions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_automation_executions_journey ON automation_executions(journey_id);

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (tenant isolation via separate project)
CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true);
CREATE POLICY "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true);
CREATE POLICY "automation_journeys_all" ON automation_journeys FOR ALL USING (true);
CREATE POLICY "automation_executions_all" ON automation_executions FOR ALL USING (true);

-- ============================================================================
-- 7. TRIGGERS - Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crm_pipelines_updated ON crm_pipelines;
CREATE TRIGGER trigger_crm_pipelines_updated
    BEFORE UPDATE ON crm_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_crm_deals_updated ON crm_deals;
CREATE TRIGGER trigger_crm_deals_updated
    BEFORE UPDATE ON crm_deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_automation_journeys_updated ON automation_journeys;
CREATE TRIGGER trigger_automation_journeys_updated
    BEFORE UPDATE ON automation_journeys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. REALTIME - Enable for live updates
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE crm_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_deal_history;

-- ============================================================================
-- DONE - Run this on each CLIENT's Supabase database
-- ============================================================================
