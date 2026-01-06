-- =============================================================================
-- APOLLO A.I. ADVANCED - TENANT FULL SCHEMA v10
-- Use for NEW COMPANIES only (fresh install)
-- Last updated: 2026-01-06
-- =============================================================================

-- This file contains the complete database schema for a new tenant.
-- Do NOT use this for existing companies - use incremental migrations instead.

-- =============================================================================
-- SECTION 1: CORE TABLES (Contacts, Conversations, Messages)
-- =============================================================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status VARCHAR(30) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ai', 'attending', 'resolved', 'archived')),
    priority VARCHAR(20) DEFAULT 'normal',
    assigned_to UUID,
    assigned_to_name VARCHAR(255),
    agent_id UUID,
    agent_name VARCHAR(255),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) CHECK (direction IN ('in', 'out')),
    sender_type VARCHAR(20) DEFAULT 'contact' CHECK (sender_type IN ('contact', 'agent', 'ai', 'system')),
    sender_id UUID,
    sender_name VARCHAR(255),
    content TEXT,
    content_type VARCHAR(30) DEFAULT 'text',
    media_url TEXT,
    media_mime_type VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- =============================================================================
-- SECTION 2: CRM TABLES (Pipelines, Deals)
-- =============================================================================

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

-- Default Pipeline
INSERT INTO crm_pipelines (name, description, is_default, stages) VALUES (
    'Funil de Vendas', 'Pipeline padrão para gestão de vendas', true,
    '[
        {"id":"lead","name":"Lead","color":"#868e96","position":0,"is_conversion_point":false},
        {"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1,"is_conversion_point":false},
        {"id":"proposta","name":"Proposta","color":"#228be6","position":2,"is_conversion_point":false},
        {"id":"negociacao","name":"Negociação","color":"#7950f2","position":3,"is_conversion_point":false},
        {"id":"fechamento","name":"Fechamento","color":"#40c057","position":4,"is_conversion_point":true}
    ]'::jsonb
);

CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
    current_stage_id VARCHAR(100) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    cycle_number INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    assigned_user_id UUID,
    assigned_user_name VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);

CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
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

-- =============================================================================
-- SECTION 3: AI TOOLS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'function' CHECK (type IN ('function', 'webhook', 'integration')),
    parameters JSONB NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}',
    execution_type VARCHAR(50) DEFAULT 'internal' CHECK (execution_type IN ('internal', 'webhook', 'code')),
    webhook_url TEXT,
    webhook_method VARCHAR(10) DEFAULT 'POST',
    webhook_headers JSONB DEFAULT '{}',
    code TEXT,
    requires_confirmation BOOLEAN DEFAULT false,
    allowed_agents TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    avg_execution_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(type);

-- System Tools (8 default tools)
INSERT INTO tools (name, display_name, description, type, execution_type, is_system, parameters) VALUES 
('updateContactStatus', 'Atualizar Status do Contato', 'Atualiza o status de um contato no sistema', 'function', 'internal', true, 
 '{"type":"object","properties":{"contact_id":{"type":"string","description":"ID do contato"},"status":{"type":"string","enum":["active","inactive","blocked"],"description":"Novo status"}},"required":["contact_id","status"]}'),
('updatePipelineStage', 'Mover no Pipeline', 'Move um negócio para outra etapa do pipeline CRM', 'function', 'internal', true,
 '{"type":"object","properties":{"deal_id":{"type":"string","description":"ID do deal"},"stage_id":{"type":"string","description":"ID da nova etapa"}},"required":["deal_id","stage_id"]}'),
('createTask', 'Criar Tarefa', 'Cria uma tarefa de follow-up para o atendente', 'function', 'internal', true,
 '{"type":"object","properties":{"title":{"type":"string","description":"Título da tarefa"},"due_date":{"type":"string","description":"Data de vencimento"},"priority":{"type":"string","enum":["low","normal","high"]}},"required":["title"]}'),
('scheduleMessage', 'Agendar Mensagem', 'Agenda uma mensagem WhatsApp para envio futuro', 'function', 'internal', true,
 '{"type":"object","properties":{"contact_id":{"type":"string"},"message":{"type":"string"},"send_at":{"type":"string","description":"Data/hora ISO 8601"}},"required":["contact_id","message","send_at"]}'),
('searchProducts', 'Buscar Produtos', 'Busca produtos ou serviços no catálogo', 'function', 'internal', true,
 '{"type":"object","properties":{"query":{"type":"string","description":"Termo de busca"},"category":{"type":"string"},"max_results":{"type":"integer"}},"required":["query"]}'),
('getContactHistory', 'Histórico do Contato', 'Busca o histórico de conversas anteriores do contato', 'function', 'internal', true,
 '{"type":"object","properties":{"contact_id":{"type":"string"},"limit":{"type":"integer","default":10}},"required":["contact_id"]}'),
('transferToHuman', 'Transferir para Humano', 'Transfere a conversa para um atendente humano', 'function', 'internal', true,
 '{"type":"object","properties":{"reason":{"type":"string","description":"Motivo da transferência"},"department":{"type":"string"}},"required":["reason"]}'),
('endConversation', 'Finalizar Conversa', 'Marca a conversa como resolvida', 'function', 'internal', true,
 '{"type":"object","properties":{"resolution":{"type":"string","description":"Resumo da resolução"},"satisfaction":{"type":"string","enum":["positive","neutral","negative"]}},"required":["resolution"]}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    agent_id UUID,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    input_params JSONB,
    output_result JSONB,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
    error_message TEXT,
    execution_time_ms INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_conv ON tool_executions(conversation_id);

-- =============================================================================
-- SECTION 4: WHATSAPP CONNECTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    provider VARCHAR(50) DEFAULT 'uazapi' CHECK (provider IN ('uazapi', 'evolution', 'meta_cloud', 'baileys')),
    instance_id VARCHAR(255),
    api_url TEXT,
    api_key TEXT,
    webhook_url TEXT,
    status VARCHAR(30) DEFAULT 'disconnected' CHECK (status IN ('connecting', 'connected', 'disconnected', 'qr_pending', 'error', 'banned')),
    qr_code TEXT,
    qr_expires_at TIMESTAMPTZ,
    phone_number VARCHAR(50),
    phone_name VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    daily_message_limit INT DEFAULT 1000,
    messages_sent_today INT DEFAULT 0,
    total_messages_sent INT DEFAULT 0,
    total_messages_received INT DEFAULT 0,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_status ON whatsapp_connections(status);

-- =============================================================================
-- SECTION 5: QUICK REPLIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    category VARCHAR(100),
    media_url TEXT,
    media_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut);
CREATE INDEX IF NOT EXISTS idx_quick_replies_category ON quick_replies(category);

-- =============================================================================
-- SECTION 6: TENANT SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default Settings
INSERT INTO tenant_settings (key, value, category, description) VALUES
('company_name', '"Minha Empresa"', 'general', 'Nome da empresa'),
('timezone', '"America/Sao_Paulo"', 'general', 'Fuso horário'),
('theme', '"dark"', 'general', 'Tema da interface'),
('welcome_message', '"Olá! Como posso ajudar?"', 'chat', 'Mensagem de boas-vindas'),
('offline_message', '"Estamos offline no momento"', 'chat', 'Mensagem quando offline'),
('ai_enabled', 'true', 'ai', 'IA habilitada'),
('ai_model', '"gpt-4"', 'ai', 'Modelo de IA')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- SECTION 7: CAMPAIGNS
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed')),
    type VARCHAR(50) DEFAULT 'broadcast' CHECK (type IN ('broadcast', 'drip', 'triggered')),
    template JSONB NOT NULL DEFAULT '{"blocks":[]}',
    audience_type VARCHAR(50) DEFAULT 'all',
    audience_filters JSONB DEFAULT '{}',
    audience_count INT DEFAULT 0,
    schedule_type VARCHAR(30) DEFAULT 'immediate',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE SET NULL,
    messages_per_minute INT DEFAULT 30,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_read INT DEFAULT 0,
    total_replied INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at);

CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed', 'skipped')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_contact ON campaign_recipients(contact_id);

-- =============================================================================
-- SECTION 8: INTEGRATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    api_key TEXT,
    api_url TEXT,
    is_connected BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default Integrations
INSERT INTO integrations (name, provider, settings) VALUES
('Google Calendar', 'google_calendar', '{"scopes":["calendar.events"]}'),
('Google Sheets', 'google_sheets', '{"scopes":["spreadsheets"]}'),
('RD Station', 'rd_station', '{}'),
('n8n Webhook', 'n8n', '{}')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SECTION 9: AUTOMATION TRIGGERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event VARCHAR(100) NOT NULL,
    delay_minutes INT DEFAULT 0,
    template JSONB NOT NULL DEFAULT '{"blocks":[]}',
    conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_event ON automation_triggers(event);
CREATE INDEX IF NOT EXISTS idx_triggers_active ON automation_triggers(is_active);

-- =============================================================================
-- SECTION 10: ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (tenant isolation is handled by separate Supabase project)
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true);
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (true);
CREATE POLICY "messages_all" ON messages FOR ALL USING (true);
CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true);
CREATE POLICY "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true);
CREATE POLICY "tools_all" ON tools FOR ALL USING (true);
CREATE POLICY "tool_executions_all" ON tool_executions FOR ALL USING (true);
CREATE POLICY "whatsapp_connections_all" ON whatsapp_connections FOR ALL USING (true);
CREATE POLICY "quick_replies_all" ON quick_replies FOR ALL USING (true);
CREATE POLICY "tenant_settings_all" ON tenant_settings FOR ALL USING (true);
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true);
CREATE POLICY "campaign_recipients_all" ON campaign_recipients FOR ALL USING (true);
CREATE POLICY "integrations_all" ON integrations FOR ALL USING (true);
CREATE POLICY "automation_triggers_all" ON automation_triggers FOR ALL USING (true);

-- =============================================================================
-- SECTION 11: HELPER FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_pipelines_updated_at BEFORE UPDATE ON crm_pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_deals_updated_at BEFORE UPDATE ON crm_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON whatsapp_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quick_replies_updated_at BEFORE UPDATE ON quick_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_triggers_updated_at BEFORE UPDATE ON automation_triggers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- END OF SCHEMA - VERSION 10
-- =============================================================================
