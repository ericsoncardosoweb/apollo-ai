-- ============================================================================
-- CRM ENGINE V2 - SIMPLIFIED (No FK dependencies)
-- Run this directly in your CLIENT's Supabase SQL Editor
-- ============================================================================

-- 1. CRM PIPELINES
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
SELECT 'Funil de Vendas', 'Pipeline padrão para gestão de vendas', true,
    '[
        {"id": "lead", "name": "Lead", "color": "#868e96", "position": 0, "is_conversion_point": false},
        {"id": "qualificacao", "name": "Qualificação", "color": "#fab005", "position": 1, "is_conversion_point": false},
        {"id": "proposta", "name": "Proposta", "color": "#228be6", "position": 2, "is_conversion_point": false},
        {"id": "negociacao", "name": "Negociação", "color": "#7950f2", "position": 3, "is_conversion_point": false},
        {"id": "fechamento", "name": "Fechamento", "color": "#40c057", "position": 4, "is_conversion_point": true}
    ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE name = 'Funil de Vendas');

-- 2. CRM DEALS (WITHOUT FK to contacts - standalone)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_created ON crm_deals(created_at DESC);

-- 3. CRM DEAL HISTORY
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

CREATE INDEX IF NOT EXISTS idx_deal_history_deal ON crm_deal_history(deal_id);

-- 4. Enable RLS but allow all
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_pipelines_all" ON crm_pipelines;
DROP POLICY IF EXISTS "crm_deals_all" ON crm_deals;
DROP POLICY IF EXISTS "crm_deal_history_all" ON crm_deal_history;

CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true) WITH CHECK (true);

-- 5. Realtime (optional, may fail if not enabled)
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_pipelines;
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_deals;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Realtime not enabled, skipping';
END $$;

-- DONE! Refresh the CRM page after running this.
