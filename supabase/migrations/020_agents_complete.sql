-- ============================================================================
-- APOLLO A.I. ADVANCED - MIGRATION 020
-- Agents Schema Completo
-- ============================================================================

-- Drop existing if needed for clean slate
DROP TABLE IF EXISTS agent_test_messages CASCADE;
DROP TABLE IF EXISTS agent_test_runs CASCADE;
DROP TABLE IF EXISTS prompt_templates CASCADE;

-- ============================================================================
-- 1. Agents - Configuração completa de agentes de IA
-- ============================================================================

-- Ensure agents table has all needed columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT 'blue';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model_name VARCHAR(50) DEFAULT 'gpt-4o-mini';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature DECIMAL(2,1) DEFAULT 0.7;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 500;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS memory_window INTEGER DEFAULT 10;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS intent_router_enabled BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_enabled BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_delay_minutes INTEGER DEFAULT 120;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_max_attempts INTEGER DEFAULT 3;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reengagement_prompts JSONB DEFAULT '[]';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS fallback_message TEXT DEFAULT 'Desculpe, estou com dificuldades técnicas. Tente novamente em alguns instantes.';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"enabled": false, "start": 9, "end": 21}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) DEFAULT 'standalone';
-- agent_type: 'standalone', 'orchestrator', 'sub_agent'

ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_conversations INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avg_response_time_ms INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Prompt Templates - Banco de modelos reutilizáveis (Admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'vendas', 'suporte', 'agendamento', 'atendimento'
    system_prompt TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- Lista de variáveis usadas
    is_global BOOLEAN DEFAULT false, -- Template global (somente admin master)
    tenant_id UUID REFERENCES tenants(id),
    created_by UUID,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_prompt_templates_tenant ON prompt_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_global ON prompt_templates(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);

-- ============================================================================
-- 3. Agent Test Runs - Histórico de testes de agentes
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'passed', 'failed'
    overall_score DECIMAL(5,2),
    duration_seconds DECIMAL(10,2),
    messages_executed INTEGER DEFAULT 0,
    messages_passed INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    model_used VARCHAR(50),
    prompt_chars INTEGER,
    total_tokens_used INTEGER,
    estimated_cost_usd DECIMAL(10,6),
    run_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_test_runs_agent ON agent_test_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_tenant ON agent_test_runs(tenant_id);

-- ============================================================================
-- 4. Agent Test Messages - Mensagens individuais de cada teste
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_test_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL REFERENCES agent_test_runs(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    user_script TEXT NOT NULL, -- Mensagem simulada do usuário
    expected_response TEXT, -- Resposta esperada (baseline)
    actual_response TEXT, -- Resposta real da IA
    similarity_score DECIMAL(5,2), -- Score de similaridade semântica (0-100)
    passed BOOLEAN,
    execution_steps JSONB DEFAULT '[]', -- Tools executadas
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_test_messages_run ON agent_test_messages(test_run_id);

-- ============================================================================
-- 5. Conversation Memory - Long-term memory por conversa
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    summary TEXT, -- Resumo da conversa até agora
    key_facts JSONB DEFAULT '[]', -- Fatos importantes extraídos
    customer_profile JSONB DEFAULT '{}', -- Perfil do cliente inferido
    sentiment_history JSONB DEFAULT '[]', -- Histórico de sentimento
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_memory_conv ON conversation_memory(conversation_id);

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

-- Prompt Templates: tenant isolation + global read
CREATE POLICY "prompt_templates_tenant_isolation" ON prompt_templates
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR is_global = true
    );

CREATE POLICY "prompt_templates_global_write_master" ON prompt_templates
    FOR INSERT WITH CHECK (
        is_global = false 
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin')
    );

-- Agent Test Runs: tenant isolation
CREATE POLICY "agent_test_runs_tenant_isolation" ON agent_test_runs
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );

-- Agent Test Messages: via test_run
CREATE POLICY "agent_test_messages_access" ON agent_test_messages
    FOR ALL USING (
        test_run_id IN (
            SELECT id FROM agent_test_runs 
            WHERE tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
            OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
        )
    );

-- Conversation Memory: tenant isolation
CREATE POLICY "conversation_memory_tenant" ON conversation_memory
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );
