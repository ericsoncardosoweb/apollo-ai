-- =============================================================================
-- WHATSAPP CAMPAIGNS & MASS MESSAGING
-- Sistema de disparo em massa com anti-banimento
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- MESSAGE TEMPLATES
-- Templates de mensagem com blocos de conteúdo
-- =============================================================================

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template content blocks (ordenáveis)
CREATE TABLE IF NOT EXISTS template_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    
    -- Content type
    content_type VARCHAR(30) NOT NULL CHECK (content_type IN (
        'text', 'image', 'video', 'audio', 'document', 
        'sticker', 'contact', 'location', 'interval'
    )),
    
    -- Content data
    content TEXT, -- For text: the message content with variables
    media_url TEXT, -- For media types
    media_filename VARCHAR(255),
    media_mimetype VARCHAR(100),
    
    -- Text formatting (stored as HTML, converted to WA format on send)
    -- Variables: {first_name}, {full_name}, {phone_number}, {email}, {custom_*}
    
    -- Audio specific
    send_as_voice BOOLEAN DEFAULT false, -- Send as PTT (voice message)
    
    -- Interval specific (wait time between blocks)
    interval_seconds INTEGER,
    
    -- Contact specific (VCard data)
    contact_data JSONB,
    
    -- Location specific
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name VARCHAR(255),
    location_address TEXT,
    
    -- Display order
    position INTEGER NOT NULL DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CAMPAIGNS
-- Configuração de campanhas de disparo
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'
    )),
    
    -- WhatsApp Connection
    connection_id UUID, -- Reference to WhatsApp instance
    connection_name VARCHAR(255),
    
    -- Schedule
    scheduled_at TIMESTAMPTZ, -- When to start
    schedule_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Days of week (1=Mon, 7=Sun)
    schedule_start_hour INTEGER DEFAULT 9, -- Start hour (0-23)
    schedule_end_hour INTEGER DEFAULT 18, -- End hour (0-23)
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    
    -- Anti-ban settings
    max_daily_volume INTEGER DEFAULT 200, -- Max messages per day
    min_interval_seconds INTEGER DEFAULT 30, -- Min seconds between messages
    max_interval_seconds INTEGER DEFAULT 120, -- Max seconds between messages
    use_random_intervals BOOLEAN DEFAULT true,
    batch_size INTEGER DEFAULT 10, -- Messages per batch
    batch_pause_minutes INTEGER DEFAULT 15, -- Pause between batches
    
    -- Contact filters (stored as JSONB for flexibility)
    contact_filters JSONB DEFAULT '{}',
    -- Example: {
    --   "status": ["active"],
    --   "type": ["lead", "customer"],
    --   "tags": ["interessado", "premium"],
    --   "services": ["consultoria"],
    --   "exclude_tags": ["opt-out", "reclamacao"],
    --   "custom_conditions": [
    --     {"field": "city", "operator": "eq", "value": "São Paulo"}
    --   ]
    -- }
    
    -- Template distribution (random among selected)
    template_distribution VARCHAR(20) DEFAULT 'random' CHECK (template_distribution IN (
        'random', 'sequential', 'weighted'
    )),
    
    -- Agent for responses
    assigned_agent_id UUID,
    assigned_agent_name VARCHAR(255),
    ai_agent_id UUID, -- If using AI agent for responses
    ai_agent_name VARCHAR(255),
    
    -- Actions on delivery
    on_delivery_actions JSONB DEFAULT '[]',
    -- Example: [
    --   {"type": "add_tag", "value": "campanha-xyz"},
    --   {"type": "remove_tag", "value": "nao-contatado"},
    --   {"type": "move_to_stage", "pipeline_id": "...", "stage_id": "..."},
    --   {"type": "assign_department", "department": "vendas"}
    -- ]
    
    -- Actions on response
    on_response_actions JSONB DEFAULT '[]',
    -- Example: [
    --   {"type": "add_tag", "value": "respondeu"},
    --   {"type": "notify_agent", "agent_id": "..."},
    --   {"type": "start_flow", "flow_id": "..."}
    -- ]
    
    -- Stats
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    
    -- Audit
    created_by UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign to Template relationship (M:N, up to 5 templates)
CREATE TABLE IF NOT EXISTS campaign_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    weight INTEGER DEFAULT 1, -- For weighted distribution
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(campaign_id, template_id)
);

-- =============================================================================
-- CAMPAIGN DELIVERIES
-- Fila de entregas e histórico
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Contact info
    contact_id UUID,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50) NOT NULL,
    
    -- Template used
    template_id UUID REFERENCES message_templates(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled'
    )),
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    
    -- Result
    external_message_id VARCHAR(255), -- ID from WhatsApp gateway
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Response tracking
    has_response BOOLEAN DEFAULT false,
    response_at TIMESTAMPTZ,
    
    -- Retry
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Actions executed
    actions_executed JSONB DEFAULT '[]',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_templates_active ON message_templates(is_active) WHERE is_active = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_templates_category ON message_templates(category);

CREATE INDEX IF NOT EXISTS idx_template_contents_template ON template_contents(template_id);
CREATE INDEX IF NOT EXISTS idx_template_contents_order ON template_contents(template_id, position);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_campaigns_connection ON campaigns(connection_id);

CREATE INDEX IF NOT EXISTS idx_campaign_templates_campaign ON campaign_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_template ON campaign_templates(template_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_campaign ON campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON campaign_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled ON campaign_deliveries(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deliveries_contact ON campaign_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON campaign_deliveries(contact_phone);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (tenant isolation handled by app layer)
CREATE POLICY "templates_all" ON message_templates FOR ALL USING (true);
CREATE POLICY "template_contents_all" ON template_contents FOR ALL USING (true);
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true);
CREATE POLICY "campaign_templates_all" ON campaign_templates FOR ALL USING (true);
CREATE POLICY "campaign_deliveries_all" ON campaign_deliveries FOR ALL USING (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'templates_updated_at') THEN
        CREATE TRIGGER templates_updated_at BEFORE UPDATE ON message_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'contents_updated_at') THEN
        CREATE TRIGGER contents_updated_at BEFORE UPDATE ON template_contents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'campaigns_updated_at') THEN
        CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'deliveries_updated_at') THEN
        CREATE TRIGGER deliveries_updated_at BEFORE UPDATE ON campaign_deliveries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- =============================================================================
-- SAMPLE DATA (optional)
-- =============================================================================

-- Insert sample category tags for templates
-- INSERT INTO message_templates (name, description, category, is_active)
-- VALUES 
--     ('Boas Vindas', 'Template padrão de boas vindas', 'onboarding', true),
--     ('Follow-up', 'Template de acompanhamento', 'nurturing', true),
--     ('Promoção', 'Template para ofertas especiais', 'promotional', true);
