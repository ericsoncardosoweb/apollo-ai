-- ============================================================================
-- 028_global_pipeline_templates.sql
-- Apollo Supabase (Master) - Pipeline templates for replication
-- ============================================================================

-- Global pipeline templates (Super Admin can save/share)
CREATE TABLE IF NOT EXISTS global_pipeline_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'vendas', 'pos-venda', 'suporte', 'onboarding'
    
    -- Pipeline configuration
    stages JSONB NOT NULL DEFAULT '[]',
    -- Same format as crm_pipelines.stages
    
    -- Preview/thumbnail
    preview_image_url TEXT,
    
    -- Usage stats
    usage_count INT DEFAULT 0,
    
    -- Creator (stored as text, no FK)
    created_by_id UUID,
    created_by_name VARCHAR(255),
    
    -- Control
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_category ON global_pipeline_templates(category);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_featured ON global_pipeline_templates(is_featured);

-- Insert default templates
INSERT INTO global_pipeline_templates (name, description, category, is_featured, stages) VALUES
(
    'Funil de Vendas Clássico',
    'Pipeline tradicional para vendas B2B e B2C',
    'vendas',
    true,
    '[
        {"id": "lead", "name": "Lead", "color": "#868e96", "position": 0, "is_conversion_point": false},
        {"id": "qualificacao", "name": "Qualificação", "color": "#fab005", "position": 1, "is_conversion_point": false},
        {"id": "proposta", "name": "Proposta", "color": "#228be6", "position": 2, "is_conversion_point": false},
        {"id": "negociacao", "name": "Negociação", "color": "#7950f2", "position": 3, "is_conversion_point": false},
        {"id": "fechamento", "name": "Fechamento", "color": "#40c057", "position": 4, "is_conversion_point": true}
    ]'::jsonb
),
(
    'Funil High Ticket',
    'Para vendas de alto valor com múltiplas etapas de qualificação',
    'vendas',
    true,
    '[
        {"id": "suspect", "name": "Suspect", "color": "#868e96", "position": 0, "is_conversion_point": false},
        {"id": "mql", "name": "MQL", "color": "#fab005", "position": 1, "is_conversion_point": false},
        {"id": "sql", "name": "SQL", "color": "#fd7e14", "position": 2, "is_conversion_point": false},
        {"id": "demo", "name": "Demonstração", "color": "#228be6", "position": 3, "is_conversion_point": false},
        {"id": "proposta", "name": "Proposta Enviada", "color": "#7950f2", "position": 4, "is_conversion_point": false},
        {"id": "negociacao", "name": "Em Negociação", "color": "#be4bdb", "position": 5, "is_conversion_point": false},
        {"id": "contrato", "name": "Contrato", "color": "#40c057", "position": 6, "is_conversion_point": true}
    ]'::jsonb
),
(
    'Pós-Venda & Retenção',
    'Acompanhamento após a venda para upsell e renovação',
    'pos-venda',
    true,
    '[
        {"id": "onboarding", "name": "Onboarding", "color": "#228be6", "position": 0, "is_conversion_point": false},
        {"id": "ativacao", "name": "Ativação", "color": "#fab005", "position": 1, "is_conversion_point": false},
        {"id": "engajado", "name": "Engajado", "color": "#40c057", "position": 2, "is_conversion_point": false},
        {"id": "risco", "name": "Em Risco", "color": "#fa5252", "position": 3, "is_conversion_point": false},
        {"id": "renovacao", "name": "Renovação", "color": "#7950f2", "position": 4, "is_conversion_point": true}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE - Run this on Apollo Supabase (Master)
-- ============================================================================
