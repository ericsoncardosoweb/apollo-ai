-- ===========================================
-- Apollo A.I. Advanced - Campaigns & Messaging Schema
-- ===========================================
-- Migration for WhatsApp Campaigns functionality
-- ===========================================

-- ===========================================
-- MESSAGE TEMPLATES
-- ===========================================

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general' CHECK (category IN (
        'general', 'onboarding', 'nurturing', 'promotional', 'transactional', 'reengagement'
    )),
    
    -- Stats
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);

-- ===========================================
-- TEMPLATE CONTENTS (Sequence of messages/media)
-- ===========================================

CREATE TABLE IF NOT EXISTS template_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
    
    -- Content Type
    content_type TEXT NOT NULL CHECK (content_type IN (
        'text', 'image', 'video', 'audio', 'document', 
        'sticker', 'contact', 'location', 'interval'
    )),
    
    -- Text Content (supports variables like {{nome}}, {{empresa}})
    content TEXT,
    
    -- Media Content
    media_url TEXT,
    media_filename TEXT,
    media_mimetype TEXT,
    media_caption TEXT,
    send_as_voice BOOLEAN DEFAULT false,  -- For audio as PTT
    
    -- Interval (delay between contents)
    interval_seconds INTEGER CHECK (interval_seconds <= 50),  -- Max 50s as per requirement
    
    -- Contact VCard
    contact_data JSONB,
    
    -- Location
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name TEXT,
    location_address TEXT,
    
    -- Ordering
    position INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_contents_template ON template_contents(template_id);

-- ===========================================
-- CAMPAIGNS
-- ===========================================

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'
    )),
    
    -- WhatsApp Connection (references tenant config)
    connection_id UUID,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    schedule_timezone TEXT DEFAULT 'America/Sao_Paulo',
    schedule_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],  -- 0=Sun, 1=Mon, etc.
    schedule_start_hour INTEGER DEFAULT 9 CHECK (schedule_start_hour >= 0 AND schedule_start_hour <= 23),
    schedule_end_hour INTEGER DEFAULT 21 CHECK (schedule_end_hour >= 0 AND schedule_end_hour <= 23),
    
    -- Anti-ban Settings
    max_daily_volume INTEGER DEFAULT 200,
    min_interval_seconds INTEGER DEFAULT 30 CHECK (min_interval_seconds >= 10),
    max_interval_seconds INTEGER DEFAULT 50 CHECK (max_interval_seconds <= 60),
    use_random_intervals BOOLEAN DEFAULT true,
    batch_size INTEGER DEFAULT 10 CHECK (batch_size >= 1 AND batch_size <= 50),
    batch_pause_minutes INTEGER DEFAULT 15 CHECK (batch_pause_minutes >= 5),
    
    -- Contact Selection
    contact_filters JSONB DEFAULT '{}',  -- {"tags": ["vip"], "type": "lead", "source": "website"}
    contact_list_ids UUID[] DEFAULT '{}',  -- Specific contact list IDs
    exclude_recent_days INTEGER DEFAULT 7,  -- Don't message contacts messaged in last N days
    
    -- Templates
    template_ids UUID[] DEFAULT '{}',
    template_distribution TEXT DEFAULT 'random' CHECK (template_distribution IN ('random', 'sequential', 'weighted')),
    template_weights JSONB DEFAULT '{}',  -- For weighted distribution
    
    -- AI Agent for responses
    assigned_agent_id UUID,
    auto_reply_enabled BOOLEAN DEFAULT true,
    
    -- Automations (actions triggered by events)
    on_sent_actions JSONB DEFAULT '[]',
    on_delivery_actions JSONB DEFAULT '[]',
    on_read_actions JSONB DEFAULT '[]',
    on_response_actions JSONB DEFAULT '[]',
    on_failure_actions JSONB DEFAULT '[]',
    
    -- Statistics (denormalized for performance)
    total_contacts INTEGER DEFAULT 0,
    queued_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    opt_out_count INTEGER DEFAULT 0,
    
    -- Progress
    current_batch INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    
    -- Audit
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';

-- ===========================================
-- CAMPAIGN DELIVERIES (Queue + History)
-- ===========================================

CREATE TABLE IF NOT EXISTS campaign_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    
    -- Contact Info (denormalized for history)
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    
    -- Delivery Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped', 'opted_out'
    )),
    
    -- Scheduling
    batch_number INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    
    -- Content sent (with variables substituted)
    content_sent JSONB,  -- Array of content items with resolved variables
    
    -- Error handling
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    
    -- WhatsApp tracking
    whatsapp_message_ids TEXT[],  -- Array because template can have multiple messages
    
    -- Response tracking
    has_response BOOLEAN DEFAULT false,
    response_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign ON campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_status ON campaign_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_scheduled ON campaign_deliveries(scheduled_at) WHERE status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_contact ON campaign_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_phone ON campaign_deliveries(contact_phone);

-- ===========================================
-- CONTACT LISTS (for campaign targeting)
-- ===========================================

CREATE TABLE IF NOT EXISTS contact_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Type
    type TEXT DEFAULT 'static' CHECK (type IN ('static', 'dynamic')),
    
    -- For dynamic lists: filter criteria
    filter_criteria JSONB DEFAULT '{}',
    
    -- Stats
    contact_count INTEGER DEFAULT 0,
    last_synced_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CONTACT LIST MEMBERS (for static lists)
-- ===========================================

CREATE TABLE IF NOT EXISTS contact_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES contact_lists(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(list_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_list_members_list ON contact_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_contact_list_members_contact ON contact_list_members(contact_id);

-- ===========================================
-- SCHEDULED MESSAGES (One-off scheduled sends)
-- ===========================================

CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- Content
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    content TEXT,  -- Direct content if no template
    content_type TEXT DEFAULT 'text',
    media_url TEXT,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'sending', 'sent', 'failed', 'cancelled'
    )),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Metadata
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'automation', 'reengagement', 'api')),
    created_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status, scheduled_at) WHERE status = 'pending';

-- ===========================================
-- OPT-OUT LIST (contacts who opted out)
-- ===========================================

CREATE TABLE IF NOT EXISTS campaign_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    
    -- Opt-out reason
    reason TEXT,
    source TEXT DEFAULT 'user_request',  -- 'user_request', 'keyword', 'complaint'
    
    -- Which campaign triggered opt-out
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_campaign_opt_outs_phone ON campaign_opt_outs(contact_phone);

-- ===========================================
-- VARIABLES CATALOG (for template substitution)
-- ===========================================

CREATE TABLE IF NOT EXISTS template_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL UNIQUE,  -- e.g., 'nome', 'empresa', 'valor'
    display_name TEXT NOT NULL,  -- e.g., 'Nome do Contato'
    description TEXT,
    
    -- Variable source
    source TEXT DEFAULT 'contact' CHECK (source IN ('contact', 'custom', 'system')),
    source_field TEXT,  -- Field path in source, e.g., 'name', 'metadata.empresa'
    
    -- Default value if field is empty
    default_value TEXT,
    
    -- Formatting
    format_type TEXT DEFAULT 'text' CHECK (format_type IN ('text', 'currency', 'date', 'phone')),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default variables
INSERT INTO template_variables (name, display_name, description, source, source_field) VALUES
    ('nome', 'Nome do Contato', 'Nome completo do contato', 'contact', 'name'),
    ('primeiro_nome', 'Primeiro Nome', 'Primeiro nome do contato', 'contact', 'name'),
    ('telefone', 'Telefone', 'Número de telefone', 'contact', 'phone'),
    ('email', 'Email', 'Endereço de email', 'contact', 'email'),
    ('empresa', 'Empresa', 'Nome da empresa do contato', 'contact', 'company_name'),
    ('cargo', 'Cargo', 'Cargo do contato', 'contact', 'company_role'),
    ('cidade', 'Cidade', 'Cidade do contato', 'contact', 'address_city'),
    ('estado', 'Estado', 'Estado do contato', 'contact', 'address_state'),
    ('data_hoje', 'Data de Hoje', 'Data atual formatada', 'system', 'current_date'),
    ('hora_atual', 'Hora Atual', 'Hora atual', 'system', 'current_time')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Update updated_at triggers
CREATE TRIGGER tr_message_templates_updated 
    BEFORE UPDATE ON message_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_campaigns_updated 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_contact_lists_updated 
    BEFORE UPDATE ON contact_lists 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- HELPER FUNCTION: Get next scheduled delivery time
-- ===========================================

CREATE OR REPLACE FUNCTION get_next_delivery_slot(
    p_campaign_id UUID,
    p_base_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
    v_campaign RECORD;
    v_last_sent TIMESTAMPTZ;
    v_next_slot TIMESTAMPTZ;
    v_interval INTEGER;
BEGIN
    -- Get campaign settings
    SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Get last sent time
    SELECT COALESCE(MAX(sent_at), p_base_time) INTO v_last_sent
    FROM campaign_deliveries
    WHERE campaign_id = p_campaign_id AND status = 'sent';
    
    -- Calculate random interval
    IF v_campaign.use_random_intervals THEN
        v_interval := v_campaign.min_interval_seconds + 
                      floor(random() * (v_campaign.max_interval_seconds - v_campaign.min_interval_seconds))::INTEGER;
    ELSE
        v_interval := v_campaign.min_interval_seconds;
    END IF;
    
    -- Calculate next slot
    v_next_slot := v_last_sent + (v_interval || ' seconds')::INTERVAL;
    
    -- Ensure within business hours
    IF EXTRACT(HOUR FROM v_next_slot AT TIME ZONE v_campaign.schedule_timezone) < v_campaign.schedule_start_hour THEN
        v_next_slot := DATE_TRUNC('day', v_next_slot AT TIME ZONE v_campaign.schedule_timezone) + 
                       (v_campaign.schedule_start_hour || ' hours')::INTERVAL;
    ELSIF EXTRACT(HOUR FROM v_next_slot AT TIME ZONE v_campaign.schedule_timezone) >= v_campaign.schedule_end_hour THEN
        -- Move to next day
        v_next_slot := DATE_TRUNC('day', v_next_slot AT TIME ZONE v_campaign.schedule_timezone) + 
                       INTERVAL '1 day' + (v_campaign.schedule_start_hour || ' hours')::INTERVAL;
    END IF;
    
    RETURN v_next_slot;
END;
$$;

-- ===========================================
-- HELPER FUNCTION: Substitute template variables
-- ===========================================

CREATE OR REPLACE FUNCTION substitute_template_variables(
    p_content TEXT,
    p_contact_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_contact RECORD;
    v_result TEXT;
    v_variable RECORD;
BEGIN
    v_result := p_content;
    
    -- Get contact data
    SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
    
    IF NOT FOUND THEN
        RETURN v_result;
    END IF;
    
    -- Replace known variables
    v_result := REPLACE(v_result, '{{nome}}', COALESCE(v_contact.name, ''));
    v_result := REPLACE(v_result, '{{primeiro_nome}}', COALESCE(SPLIT_PART(v_contact.name, ' ', 1), ''));
    v_result := REPLACE(v_result, '{{telefone}}', COALESCE(v_contact.phone, ''));
    v_result := REPLACE(v_result, '{{email}}', COALESCE(v_contact.email, ''));
    v_result := REPLACE(v_result, '{{empresa}}', COALESCE(v_contact.company_name, ''));
    v_result := REPLACE(v_result, '{{cargo}}', COALESCE(v_contact.company_role, ''));
    v_result := REPLACE(v_result, '{{cidade}}', COALESCE(v_contact.address_city, ''));
    v_result := REPLACE(v_result, '{{estado}}', COALESCE(v_contact.address_state, ''));
    v_result := REPLACE(v_result, '{{data_hoje}}', TO_CHAR(NOW(), 'DD/MM/YYYY'));
    v_result := REPLACE(v_result, '{{hora_atual}}', TO_CHAR(NOW(), 'HH24:MI'));
    
    RETURN v_result;
END;
$$;
