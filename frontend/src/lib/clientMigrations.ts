/**
 * Migrations SQL para o banco de dados do cliente
 * Este SQL será executado no Supabase de cada cliente
 */

export const CLIENT_MIGRATIONS_V1 = `
-- ============================================================================
-- APOLLO CLIENT DATABASE - MIGRATION V1
-- Tabelas do cliente para funcionamento do sistema
-- ============================================================================

-- ============================================================================
-- 1. CATÁLOGO DE SERVIÇOS (services_catalog)
-- ============================================================================

CREATE TABLE IF NOT EXISTS services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Informações básicas
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'service' 
        CHECK (type IN ('product', 'service', 'subscription', 'bundle')),
    
    -- Precificação
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BRL',
    price_type VARCHAR(50) DEFAULT 'fixed',
    
    -- Conteúdo
    description TEXT,
    short_description VARCHAR(500),
    
    -- AI Tags
    ai_tags TEXT[] DEFAULT '{}',
    features JSONB DEFAULT '{}',
    category VARCHAR(100),
    
    -- Embedding/RAG
    embedding_status VARCHAR(50) DEFAULT 'pending',
    embedding_string TEXT,
    last_indexed_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. LEADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    score INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. PIPELINE / OPORTUNIDADES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    position INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    stage_id UUID REFERENCES pipeline_stages(id),
    title VARCHAR(255),
    value DECIMAL(12,2) DEFAULT 0,
    probability INTEGER DEFAULT 50,
    expected_close_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. CONVERSAS E MENSAGENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status VARCHAR(50) DEFAULT 'active',
    agent_id UUID,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    sender_type VARCHAR(20), -- 'user', 'agent', 'ai'
    content TEXT,
    content_type VARCHAR(50) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. BASE DE CONHECIMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    file_url TEXT,
    file_type VARCHAR(50),
    file_size INTEGER,
    chunk_count INTEGER DEFAULT 0,
    embedding_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_lead ON opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services_catalog(is_active);

-- ============================================================================
-- 7. DADOS INICIAIS DO PIPELINE
-- ============================================================================

INSERT INTO pipeline_stages (name, color, position) VALUES 
    ('Novo Lead', '#3498db', 0),
    ('Qualificação', '#f39c12', 1),
    ('Proposta', '#9b59b6', 2),
    ('Negociação', '#e74c3c', 3),
    ('Fechado/Ganho', '#27ae60', 4),
    ('Perdido', '#7f8c8d', 5)
ON CONFLICT DO NOTHING;

-- Migration completed successfully!
SELECT 'Apollo Client Database v1 - Migration completed!' as status;
`;
