-- ===========================================
-- Apollo A.I. Advanced - Initial Database Schema
-- Supabase PostgreSQL Migration
-- ===========================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TENANTS
-- ===========================================

CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    document VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#6366f1',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    plan VARCHAR(50) DEFAULT 'starter',
    max_agents INTEGER DEFAULT 1,
    max_conversations_month INTEGER DEFAULT 1000,
    max_messages_month INTEGER DEFAULT 10000,
    whatsapp_gateway VARCHAR(50),
    whatsapp_instance_id VARCHAR(255),
    whatsapp_api_key TEXT,
    whatsapp_webhook_url TEXT,
    status VARCHAR(20) DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_status ON public.tenants(status);

CREATE TRIGGER trigger_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- PROFILES
-- ===========================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'agent',
    permissions JSONB DEFAULT '{}',
    is_available BOOLEAN DEFAULT true,
    max_concurrent_chats INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'active',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- CRM PIPELINE STAGES
-- ===========================================

CREATE TABLE public.crm_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50),
    position INTEGER NOT NULL DEFAULT 0,
    is_won_stage BOOLEAN DEFAULT false,
    is_lost_stage BOOLEAN DEFAULT false,
    auto_move_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_pipeline_tenant ON public.crm_pipeline_stages(tenant_id);

CREATE TRIGGER trigger_crm_pipeline_updated_at
    BEFORE UPDATE ON public.crm_pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- CRM LEADS
-- ===========================================

CREATE TABLE public.crm_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pipeline_stage_id UUID REFERENCES public.crm_pipeline_stages(id),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    document VARCHAR(20),
    company_name VARCHAR(255),
    company_role VARCHAR(100),
    source VARCHAR(100),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    score INTEGER DEFAULT 0,
    temperature VARCHAR(20) DEFAULT 'cold',
    assigned_to UUID REFERENCES public.profiles(id),
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    expected_value DECIMAL(12,2),
    status VARCHAR(50) DEFAULT 'new',
    lost_reason VARCHAR(255),
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    first_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_leads_tenant ON public.crm_leads(tenant_id);
CREATE INDEX idx_crm_leads_stage ON public.crm_leads(pipeline_stage_id);
CREATE INDEX idx_crm_leads_phone ON public.crm_leads(phone);

CREATE TRIGGER trigger_crm_leads_updated_at
    BEFORE UPDATE ON public.crm_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- AGENTS
-- ===========================================

CREATE TABLE public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    model_provider VARCHAR(50) DEFAULT 'openai',
    model_name VARCHAR(100) DEFAULT 'gpt-4o-mini',
    temperature DECIMAL(2,1) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    system_prompt TEXT NOT NULL,
    greeting_message TEXT,
    fallback_message TEXT,
    handoff_message TEXT,
    intent_router_enabled BOOLEAN DEFAULT true,
    rag_enabled BOOLEAN DEFAULT false,
    memory_enabled BOOLEAN DEFAULT true,
    memory_window INTEGER DEFAULT 10,
    reengagement_enabled BOOLEAN DEFAULT false,
    reengagement_delay_minutes INTEGER DEFAULT 30,
    reengagement_max_attempts INTEGER DEFAULT 3,
    reengagement_prompts JSONB DEFAULT '[]',
    business_hours JSONB DEFAULT '{"enabled": false}',
    status VARCHAR(20) DEFAULT 'active',
    is_default BOOLEAN DEFAULT false,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_tenant ON public.agents(tenant_id);
CREATE INDEX idx_agents_default ON public.agents(tenant_id, is_default);

CREATE TRIGGER trigger_agents_updated_at
    BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- CONVERSATIONS
-- ===========================================

CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    channel VARCHAR(50) DEFAULT 'whatsapp',
    phone_number VARCHAR(20),
    assigned_to UUID REFERENCES public.profiles(id),
    status VARCHAR(50) DEFAULT 'active',
    priority VARCHAR(20) DEFAULT 'normal',
    mode VARCHAR(20) DEFAULT 'ai',
    ai_confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
    handoff_reason TEXT,
    handoff_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    message_count INTEGER DEFAULT 0,
    ai_message_count INTEGER DEFAULT 0,
    human_message_count INTEGER DEFAULT 0,
    reengagement_attempts INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_phone ON public.conversations(phone_number);
CREATE INDEX idx_conversations_status ON public.conversations(status);

CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- MESSAGES
-- ===========================================

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL,
    sender_id UUID,
    sender_name VARCHAR(255),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text',
    media_url TEXT,
    media_mime_type VARCHAR(100),
    ai_model VARCHAR(100),
    ai_tokens_input INTEGER,
    ai_tokens_output INTEGER,
    ai_latency_ms INTEGER,
    ai_confidence DECIMAL(3,2),
    ai_intent VARCHAR(100),
    ai_entities JSONB,
    external_id VARCHAR(255),
    external_status VARCHAR(50),
    external_timestamp TIMESTAMPTZ,
    is_internal BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_tenant ON public.messages(tenant_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- ===========================================
-- TOOLS CONFIG
-- ===========================================

CREATE TABLE public.tools_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tool_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    trigger_conditions JSONB DEFAULT '{}',
    input_schema JSONB,
    output_mapping JSONB,
    auth_type VARCHAR(50),
    auth_config JSONB,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    last_called_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tools_tenant ON public.tools_config(tenant_id);

CREATE TRIGGER trigger_tools_updated_at
    BEFORE UPDATE ON public.tools_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- KNOWLEDGE BASE (RAG)
-- ===========================================

CREATE TABLE public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(50) NOT NULL,
    source_url TEXT,
    status VARCHAR(50) DEFAULT 'processing',
    error_message TEXT,
    file_size_bytes INTEGER,
    page_count INTEGER,
    chunk_count INTEGER,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_chunks_embedding ON public.knowledge_chunks 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===========================================
-- TOKEN USAGE
-- ===========================================

CREATE TABLE public.token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10,4) DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_token_usage_period UNIQUE (tenant_id, period_start)
);

-- ===========================================
-- SEED DEFAULT PIPELINE FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION seed_default_pipeline(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.crm_pipeline_stages (tenant_id, name, color, position, is_won_stage, is_lost_stage)
    VALUES 
        (p_tenant_id, 'Novo Lead', '#94a3b8', 0, false, false),
        (p_tenant_id, 'Primeiro Contato', '#3b82f6', 1, false, false),
        (p_tenant_id, 'Qualificação', '#f59e0b', 2, false, false),
        (p_tenant_id, 'Proposta Enviada', '#8b5cf6', 3, false, false),
        (p_tenant_id, 'Negociação', '#ec4899', 4, false, false),
        (p_tenant_id, 'Fechado Ganho', '#22c55e', 5, true, false),
        (p_tenant_id, 'Perdido', '#ef4444', 6, false, true);
END;
$$ LANGUAGE plpgsql;
