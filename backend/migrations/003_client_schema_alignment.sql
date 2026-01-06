-- ===========================================
-- Apollo A.I. Advanced - Client Schema Alignment v3
-- ===========================================
-- This migration aligns the client database schema with
-- the frontend hooks expectations (useChat, useContacts, etc.)
-- ===========================================

-- ===========================================
-- CONTACTS TABLE (Previously leads)
-- ===========================================
-- Frontend uses `contacts` table, not `leads`
-- We'll create contacts as a new table and migrate data

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    cpf TEXT,
    cnpj TEXT,
    
    -- Classification
    type TEXT DEFAULT 'lead' CHECK (type IN ('lead', 'customer', 'supplier', 'partner', 'other')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    
    -- Segmentation
    tags TEXT[] DEFAULT '{}',
    source TEXT DEFAULT 'manual',
    
    -- Profile
    avatar_url TEXT,
    notes TEXT,
    
    -- Address
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zipcode TEXT,
    
    -- Company
    company_name TEXT,
    company_role TEXT,
    
    -- Custom fields
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for contacts
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_whatsapp ON contacts(whatsapp) WHERE whatsapp IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at) WHERE deleted_at IS NULL;

-- ===========================================
-- CONTACT TAGS (for tag management)
-- ===========================================

CREATE TABLE IF NOT EXISTS contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CONVERSATIONS TABLE - Add missing columns
-- ===========================================

-- Add contact relationship (replacing lead_id concept)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add channel and external ID
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp' 
    CHECK (channel IN ('whatsapp', 'telegram', 'instagram', 'webchat', 'email', 'sms'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Rename chat_id to be clear
-- (Keep chat_id for backward compatibility, external_id is the new standard)

-- Update status values (we need to handle this carefully)
-- Old: active, waiting_human, closed, archived
-- New: waiting, ai, attending, resolved, archived
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check 
    CHECK (status IN ('waiting', 'ai', 'attending', 'resolved', 'archived', 'active', 'waiting_human', 'closed'));

-- Add mode column
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'ai' 
    CHECK (mode IN ('ai', 'human', 'bot', 'hybrid'));

-- Add assignment columns
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_name TEXT;

-- Add AI agent columns
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_agent_name TEXT;

-- Add counters
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Add last message preview
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_direction TEXT CHECK (last_message_direction IN ('in', 'out'));

-- Add CRM linking
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deal_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS proposal_value DECIMAL(12,2);

-- Add tags and metadata
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add timestamps
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add reengagement tracking
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS reengagement_attempts INTEGER DEFAULT 0;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations(mode);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_external ON conversations(external_id);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted ON conversations(deleted_at) WHERE deleted_at IS NULL;

-- ===========================================
-- MESSAGES TABLE - Restructure for frontend
-- ===========================================

-- Add direction column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'in' CHECK (direction IN ('in', 'out'));

-- Add new sender_type with correct values
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_type TEXT 
    CHECK (sender_type IN ('contact', 'ai', 'human', 'system', 'bot'));

-- Add sender details
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Migrate role to sender_type (will be done in migration script)
-- user -> contact, assistant -> ai, system -> system

-- Add content_type with expanded values
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_media_type_check;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text'
    CHECK (content_type IN ('text', 'audio', 'image', 'video', 'document', 'location', 'contacts', 'sticker', 'system'));

-- Add media details
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;  -- Duration in seconds for audio/video

-- Add AI metadata
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_response_metadata JSONB;

-- Add external tracking
ALTER TABLE messages ALTER COLUMN whatsapp_message_id TYPE TEXT;
ALTER TABLE messages RENAME COLUMN whatsapp_message_id TO external_id;

-- Add soft delete
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add internal message flag (for notes not sent to customer)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- Updated indexes
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(is_deleted) WHERE is_deleted = false;

-- ===========================================
-- QUICK REPLIES (for chat)
-- ===========================================

CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    shortcut TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_active ON quick_replies(is_active) WHERE is_active = true;

-- ===========================================
-- AGENTS TABLE - Add missing columns
-- ===========================================

-- Rename model to model_name for consistency
ALTER TABLE agents RENAME COLUMN model TO model_name;

-- Add tenant reference
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add visual customization
ALTER TABLE agents ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'blue';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add model provider
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model_provider TEXT DEFAULT 'openai';

-- Add memory settings
ALTER TABLE agents ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS memory_window INTEGER DEFAULT 10;

-- Add intent router
ALTER TABLE agents ADD COLUMN IF NOT EXISTS intent_router_enabled BOOLEAN DEFAULT false;

-- Add reengagement settings
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_enabled BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_delay_minutes INTEGER DEFAULT 120;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_max_attempts INTEGER DEFAULT 3;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_prompts TEXT[] DEFAULT ARRAY[
    'Olá! Notei que ficou um pouco quieto por aqui. Posso ajudar em algo mais?',
    'Ei! Ainda está por aí? Lembrei de você e queria saber se posso ajudar.',
    'Oi! Só passando para verificar se você ainda precisa de alguma informação.'
];

-- Add business hours
ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"enabled": false, "start": 9, "end": 21}';

-- Add handoff message
ALTER TABLE agents ADD COLUMN IF NOT EXISTS handoff_message TEXT DEFAULT 'Um momento, vou transferir você para um atendente.';

-- Add agent hierarchy
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'standalone' 
    CHECK (agent_type IN ('standalone', 'orchestrator', 'sub_agent'));

-- Add status (rename is_active)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft'));

-- Add default flag
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Add statistics
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_conversations INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avg_response_time_ms INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ===========================================
-- KNOWLEDGE_DOCUMENTS - Add missing columns
-- ===========================================

-- Add embedding status
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add file details
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_url_storage TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Rename file_type if exists, otherwise create with proper name
ALTER TABLE knowledge_documents RENAME COLUMN file_type TO file_type_old;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_type TEXT;

-- ===========================================
-- AGENT TEST RUNS (for prompt testing)
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    test_message TEXT NOT NULL,
    expected_response TEXT,
    actual_response TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,
    similarity_score DECIMAL(5,4),
    success BOOLEAN DEFAULT true,
    tools_called JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_test_runs_agent ON agent_test_runs(agent_id);

-- ===========================================
-- PROMPT TEMPLATES
-- ===========================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    system_prompt TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_global BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_tenant ON prompt_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_global ON prompt_templates(is_global) WHERE is_global = true;

-- ===========================================
-- KNOWLEDGE CHUNKS (Vector Embeddings)
-- ===========================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    
    -- Vector embedding (1536 dimensions for OpenAI ada-002)
    embedding vector(1536),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(knowledge_document_id);

-- Create vector similarity index (IVFFlat for faster search)
-- Note: This requires at least some data to be inserted first
-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===========================================
-- VECTOR SEARCH FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    p_agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    title text,
    file_type text,
    chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        1 - (kc.embedding <=> query_embedding) as similarity,
        kd.title,
        kd.file_type,
        kc.chunk_index
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.knowledge_document_id
    WHERE 
        kd.embedding_status = 'completed'
        AND (p_agent_id IS NULL OR kd.agent_id = p_agent_id)
        AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ===========================================
-- DATA MIGRATION: leads -> contacts
-- ===========================================

-- Migrate existing leads to contacts
INSERT INTO contacts (id, name, email, phone, whatsapp, tags, source, status, metadata, created_at, updated_at)
SELECT 
    id,
    COALESCE(name, phone),
    email,
    phone,
    phone as whatsapp,
    tags,
    COALESCE(source, 'legacy'),
    CASE WHEN status = 'blocked' THEN 'blocked' ELSE 'active' END,
    metadata,
    created_at,
    updated_at
FROM leads
ON CONFLICT (id) DO NOTHING;

-- Update conversations to link to contacts
UPDATE conversations c
SET contact_id = l.id,
    contact_name = l.name,
    contact_phone = l.phone
FROM leads l
WHERE c.lead_id = l.id
AND c.contact_id IS NULL;

-- ===========================================
-- DATA MIGRATION: messages role -> sender_type
-- ===========================================

UPDATE messages 
SET sender_type = CASE 
    WHEN role = 'user' THEN 'contact'
    WHEN role = 'assistant' THEN 'ai'
    WHEN role = 'system' THEN 'system'
    WHEN role = 'tool' THEN 'system'
    ELSE 'contact'
END,
direction = CASE
    WHEN role = 'user' THEN 'in'
    ELSE 'out'
END,
content_type = COALESCE(media_type, 'text')
WHERE sender_type IS NULL;

-- ===========================================
-- DATA MIGRATION: conversations status
-- ===========================================

UPDATE conversations
SET status = CASE
    WHEN status = 'active' THEN 'ai'
    WHEN status = 'waiting_human' THEN 'waiting'
    WHEN status = 'closed' THEN 'resolved'
    ELSE status
END
WHERE status IN ('active', 'waiting_human', 'closed');

-- ===========================================
-- TRIGGERS for updated_at
-- ===========================================

CREATE TRIGGER tr_contacts_updated 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_quick_replies_updated 
    BEFORE UPDATE ON quick_replies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
