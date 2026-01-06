-- ============================================================================
-- TENANT_CONVERSATIONS_MESSAGES.sql
-- Client Supabase (Tenant) - Conversations and Messages for Chat ao Vivo
-- Run this on EACH CLIENT's Supabase database
-- ============================================================================

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contact info
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    contact_avatar_url TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ai', 'attending', 'resolved')),
    
    -- Agent handling
    agent_type VARCHAR(20) DEFAULT 'ai' CHECK (agent_type IN ('ai', 'human')),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    agent_name VARCHAR(255),
    assigned_user_id UUID,
    
    -- CRM integration
    pipeline_stage VARCHAR(50),
    proposal_value DECIMAL(12, 2),
    interested_services TEXT[], -- Array of service names/IDs
    
    -- Metrics
    unread_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    
    -- WhatsApp specific
    whatsapp_conversation_id VARCHAR(255),
    channel VARCHAR(50) DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'webchat', 'telegram', 'instagram')),
    
    -- Timestamps
    last_message_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_phone ON conversations(contact_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id, agent_type);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Sender info
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('contact', 'ai', 'human', 'system')),
    sender_id UUID, -- User ID if human, Agent ID if AI
    sender_name VARCHAR(255),
    
    -- Message content
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image', 'video', 'file', 'location', 'sticker', 'system')),
    content TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    
    -- WhatsApp specific
    whatsapp_message_id VARCHAR(255),
    whatsapp_status VARCHAR(20), -- sent, delivered, read, failed
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type);

-- ============================================================================
-- CONVERSATION EVENTS TABLE (for system labels/events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- 'stage_changed', 'agent_assigned', 'transferred', etc.
    event_data JSONB DEFAULT '{}',
    description TEXT,
    
    -- Who triggered
    triggered_by_type VARCHAR(20), -- 'user', 'ai', 'system'
    triggered_by_id UUID,
    triggered_by_name VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation ON conversation_events(conversation_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (tenant isolation handled by separate Supabase project)
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (true);
CREATE POLICY "messages_all" ON messages FOR ALL USING (true);
CREATE POLICY "conversation_events_all" ON conversation_events FOR ALL USING (true);

-- ============================================================================
-- TRIGGER: Update conversation on new message
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        last_message_at = NEW.created_at,
        message_count = message_count + 1,
        unread_count = CASE 
            WHEN NEW.sender_type = 'contact' THEN unread_count + 1 
            ELSE unread_count 
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- REALTIME: Enable for real-time chat
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_events;

-- ============================================================================
-- DONE - Run this on each CLIENT's Supabase database
-- ============================================================================
