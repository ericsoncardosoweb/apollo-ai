-- ===========================================
-- Apollo A.I. Advanced - Client Database Schema
-- ===========================================
-- This runs on the CLIENT's Supabase
-- Execute via tenant_migration service
-- ===========================================

-- ===========================================
-- AGENTS (AI Configuration)
-- ===========================================

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- AI Configuration
    model TEXT DEFAULT 'gpt-4-turbo-preview',
    temperature DECIMAL(2,1) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    
    -- System Prompt
    system_prompt TEXT,
    
    -- Behavior
    greeting_message TEXT,
    fallback_message TEXT DEFAULT 'Desculpe, não entendi. Pode reformular?',
    
    -- Features
    enable_rag BOOLEAN DEFAULT false,
    enable_tools BOOLEAN DEFAULT true,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ===========================================
-- CONTACTS / LEADS
-- ===========================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    
    -- WhatsApp
    whatsapp_profile_name TEXT,
    whatsapp_profile_picture TEXT,
    
    -- Segmentation
    tags TEXT[] DEFAULT '{}',
    source TEXT,  -- 'whatsapp', 'website', 'manual', etc.
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'archived')),
    
    -- Engagement
    last_message_at TIMESTAMPTZ,
    total_messages INTEGER DEFAULT 0,
    
    -- Custom fields
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);


-- ===========================================
-- CONVERSATIONS
-- ===========================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    -- WhatsApp Context
    chat_id TEXT NOT NULL,  -- WhatsApp chat identifier
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'waiting_human', 'closed', 'archived')),
    
    -- AI Memory
    memory_summary TEXT,
    context_window JSONB DEFAULT '[]',
    
    -- Timestamps
    last_message_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);


-- ===========================================
-- MESSAGES
-- ===========================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    
    -- Media
    media_type TEXT,  -- 'image', 'audio', 'video', 'document'
    media_url TEXT,
    
    -- WhatsApp Metadata
    whatsapp_message_id TEXT,
    whatsapp_timestamp TIMESTAMPTZ,
    
    -- AI Metadata
    tokens_used INTEGER,
    model_used TEXT,
    tool_calls JSONB,
    
    -- Status
    status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);


-- ===========================================
-- CRM PIPELINES
-- ===========================================

CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ===========================================
-- PIPELINE STAGES
-- ===========================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    
    sort_order INTEGER DEFAULT 0,
    
    -- Stage Type
    stage_type TEXT DEFAULT 'active' CHECK (stage_type IN ('active', 'won', 'lost')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);


-- ===========================================
-- CRM DEALS (Opportunities/Cycles)
-- ===========================================

CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    contact_id UUID,  -- Optional, can be from leads or external
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
    current_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    
    -- Contact Info (denormalized for performance)
    contact_name TEXT,
    contact_phone TEXT,
    
    -- Deal Data
    value DECIMAL(12,2) DEFAULT 0,
    cycle_number INTEGER DEFAULT 1,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    
    -- Segmentation
    tags TEXT[] DEFAULT '{}',
    interested_services TEXT[] DEFAULT '{}',
    notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);


-- ===========================================
-- DEAL HISTORY (Movement Tracking)
-- ===========================================

CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
    
    from_stage UUID,
    to_stage UUID,
    
    -- Duration in previous stage (seconds)
    duration_in_stage INTEGER,
    
    -- Who triggered the move
    triggered_by TEXT,  -- 'user', 'automation', 'ai'
    triggered_by_id TEXT,
    triggered_by_name TEXT,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_deal_history_deal ON crm_deal_history(deal_id);


-- ===========================================
-- AUTOMATION JOURNEYS
-- ===========================================

CREATE TABLE IF NOT EXISTS automation_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Trigger
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('pipeline_entry', 'stage_change', 'time_based', 'tag_added', 'manual')),
    trigger_config JSONB DEFAULT '{}',
    
    -- Conditions (when to execute)
    conditions JSONB DEFAULT '[]',
    
    -- Actions (what to do)
    actions JSONB DEFAULT '[]',
    
    -- Delay before execution
    delay_config JSONB DEFAULT '{"value": 0, "unit": "seconds"}',
    
    -- Stats
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_trigger ON automation_journeys(trigger_type) WHERE is_active = true;


-- ===========================================
-- AUTOMATION EXECUTIONS
-- ===========================================

CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    journey_id UUID REFERENCES automation_journeys(id) ON DELETE CASCADE,
    deal_id UUID,
    contact_id UUID,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Results
    result JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_automation_executions_journey ON automation_executions(journey_id);


-- ===========================================
-- KNOWLEDGE DOCUMENTS (RAG)
-- ===========================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Document Info
    title TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,  -- 'pdf', 'txt', 'docx', 'url'
    file_url TEXT,
    
    -- Content
    content TEXT,
    
    -- Processing
    is_processed BOOLEAN DEFAULT false,
    chunk_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent ON knowledge_documents(agent_id);


-- ===========================================
-- SERVICES CATALOG
-- ===========================================

CREATE TABLE IF NOT EXISTS services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER tr_agents_updated BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_conversations_updated BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_crm_deals_updated BEFORE UPDATE ON crm_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_automation_journeys_updated BEFORE UPDATE ON automation_journeys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_knowledge_documents_updated BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_crm_pipelines_updated BEFORE UPDATE ON crm_pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
