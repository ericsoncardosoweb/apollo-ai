-- ============================================================================
-- CONVERSATIONS V2 - Live Chat System
-- Run on tenant database
-- ============================================================================

-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contact reference
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255), -- Denormalized for faster queries
    contact_phone VARCHAR(50), -- WhatsApp number
    
    -- Channel info
    channel VARCHAR(50) DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'telegram', 'instagram', 'webchat', 'email', 'sms')),
    external_id VARCHAR(255), -- ID from external system (Evolution API, etc)
    
    -- Status
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ai', 'attending', 'resolved', 'archived')),
    mode VARCHAR(20) DEFAULT 'ai' CHECK (mode IN ('ai', 'human', 'bot', 'hybrid')),
    
    -- Assignment
    assigned_to UUID,
    assigned_name VARCHAR(255),
    ai_agent_id UUID,
    ai_agent_name VARCHAR(100),
    
    -- Metrics
    unread_count INT DEFAULT 0,
    message_count INT DEFAULT 0,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_preview TEXT,
    last_message_direction VARCHAR(10), -- in, out
    
    -- CRM Integration
    pipeline_stage VARCHAR(100),
    deal_id UUID,
    proposal_value DECIMAL(12,2),
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ
);

-- 2. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Conversation reference
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Direction and sender
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('in', 'out')), -- in = from contact, out = from us
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('contact', 'ai', 'human', 'system', 'bot')),
    sender_id UUID,
    sender_name VARCHAR(255),
    
    -- Content
    content_type VARCHAR(30) DEFAULT 'text' CHECK (content_type IN ('text', 'audio', 'image', 'video', 'document', 'location', 'contacts', 'sticker', 'system')),
    content TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    media_duration INT, -- For audio/video in seconds
    
    -- Status
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    
    -- External reference
    external_id VARCHAR(255),
    
    -- AI context
    ai_response_metadata JSONB, -- tokens used, confidence, etc
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(contact_phone) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(conversation_id, direction);

-- 4. RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_all" ON conversations;
DROP POLICY IF EXISTS "messages_all" ON messages;

CREATE POLICY "conversations_all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "messages_all" ON messages FOR ALL USING (true) WITH CHECK (true);

-- 5. FUNCTION TO UPDATE CONVERSATION ON NEW MESSAGE
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        last_message_direction = NEW.direction,
        message_count = message_count + 1,
        unread_count = CASE WHEN NEW.direction = 'in' THEN unread_count + 1 ELSE unread_count END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;
CREATE TRIGGER trg_update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- 6. QUICK REPLIES TABLE (pre-defined responses)
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quick_replies_all" ON quick_replies;
CREATE POLICY "quick_replies_all" ON quick_replies FOR ALL USING (true) WITH CHECK (true);

-- 7. DEFAULT QUICK REPLIES
INSERT INTO quick_replies (title, content, shortcut, category) VALUES
    ('Saudação', 'Olá! Como posso ajudar você hoje?', '/ola', 'saudacao'),
    ('Aguarde', 'Um momento, por favor. Já vou te atender!', '/aguarde', 'espera'),
    ('Obrigado', 'Obrigado pelo contato! Qualquer dúvida, estamos à disposição.', '/obg', 'encerramento'),
    ('Horário', 'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.', '/horario', 'info')
ON CONFLICT DO NOTHING;

-- DONE!
