-- =============================================================================
-- WHATSAPP CONNECTIONS
-- Gerenciamento de instâncias/conexões WhatsApp
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- WhatsApp connection instances
CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Provider info
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('uazapi', 'evolution', 'meta_cloud', 'baileys')),
    instance_id VARCHAR(255), -- ID no gateway
    
    -- Connection config
    api_url TEXT,
    api_key TEXT,
    webhook_url TEXT,
    
    -- Status
    status VARCHAR(30) DEFAULT 'disconnected' CHECK (status IN (
        'connecting', 'connected', 'disconnected', 'qr_pending', 'error', 'banned'
    )),
    qr_code TEXT, -- Base64 QR when pending
    qr_expires_at TIMESTAMPTZ,
    
    -- Phone info (when connected)
    phone_number VARCHAR(50),
    phone_name VARCHAR(255),
    phone_platform VARCHAR(50),
    
    -- Settings
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    auto_reconnect BOOLEAN DEFAULT true,
    
    -- Limits
    daily_message_limit INTEGER DEFAULT 1000,
    messages_sent_today INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    
    -- Stats
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    
    -- Audit
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick replies for chat
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50), -- e.g., "/oi" for auto-complete
    category VARCHAR(100),
    
    -- Media attachment (optional)
    media_url TEXT,
    media_type VARCHAR(50),
    
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant settings
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_connections_status ON whatsapp_connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_provider ON whatsapp_connections(provider);
CREATE INDEX IF NOT EXISTS idx_connections_default ON whatsapp_connections(is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut) WHERE shortcut IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quick_replies_category ON quick_replies(category);
CREATE INDEX IF NOT EXISTS idx_quick_replies_active ON quick_replies(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_settings_key ON tenant_settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON tenant_settings(category);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connections_all" ON whatsapp_connections FOR ALL USING (true);
CREATE POLICY "quick_replies_all" ON quick_replies FOR ALL USING (true);
CREATE POLICY "settings_all" ON tenant_settings FOR ALL USING (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'connections_updated_at') THEN
        CREATE TRIGGER connections_updated_at BEFORE UPDATE ON whatsapp_connections
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'quick_replies_updated_at') THEN
        CREATE TRIGGER quick_replies_updated_at BEFORE UPDATE ON quick_replies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'settings_updated_at') THEN
        CREATE TRIGGER settings_updated_at BEFORE UPDATE ON tenant_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- =============================================================================
-- DEFAULT SETTINGS
-- =============================================================================

INSERT INTO tenant_settings (key, value, category, description)
VALUES 
    ('company_name', '"Apollo A.I."', 'general', 'Nome da empresa'),
    ('timezone', '"America/Sao_Paulo"', 'general', 'Fuso horário padrão'),
    ('welcome_message', '"Olá! Como posso ajudar?"', 'chat', 'Mensagem de boas-vindas'),
    ('business_hours', '{"enabled": false, "start": "09:00", "end": "18:00", "days": [1,2,3,4,5]}', 'chat', 'Horário de atendimento'),
    ('auto_reply_outside_hours', '"Nosso atendimento funciona de segunda a sexta, das 9h às 18h."', 'chat', 'Resposta fora do horário'),
    ('ai_enabled', 'true', 'ai', 'IA habilitada para atendimento'),
    ('ai_model', '"gpt-4"', 'ai', 'Modelo de IA padrão'),
    ('notifications_email', 'true', 'notifications', 'Receber notificações por email'),
    ('notifications_push', 'true', 'notifications', 'Receber notificações push')
ON CONFLICT (key) DO NOTHING;
