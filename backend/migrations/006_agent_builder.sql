-- ===========================================
-- Migration 006: AI Agent Builder IDE
-- ===========================================
-- Complete schema for Agent Builder with:
-- - Prompt versioning (Git-like history)
-- - Test suites and cases
-- - Test execution and results
-- - CRM field registry for autocomplete

-- ===========================================
-- 1. AGENT TYPE EXTENSIONS
-- ===========================================

-- Support Router/Specialist architecture
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'specialist' 
    CHECK (agent_type IN ('router', 'specialist', 'hybrid'));

-- Intents this agent handles (for routing)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS intents TEXT[] DEFAULT '{}';

-- Tools this agent can use
ALTER TABLE agents ADD COLUMN IF NOT EXISTS allowed_tools TEXT[] DEFAULT '{}';

-- ===========================================
-- 2. PROMPT VERSIONS (Git-like history)
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    change_description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT false,
    performance_score DECIMAL(5,2),
    tokens_count INTEGER,
    UNIQUE(agent_id, version)
);

-- Auto-increment version number
CREATE OR REPLACE FUNCTION auto_increment_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version := COALESCE(
        (SELECT MAX(version) + 1 FROM agent_prompt_versions WHERE agent_id = NEW.agent_id),
        1
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_version ON agent_prompt_versions;
CREATE TRIGGER tr_auto_version
    BEFORE INSERT ON agent_prompt_versions
    FOR EACH ROW EXECUTE FUNCTION auto_increment_prompt_version();

-- ===========================================
-- 3. CRM FIELD REGISTRY (for autocomplete)
-- ===========================================

CREATE TABLE IF NOT EXISTS crm_field_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    field_path TEXT NOT NULL,          -- e.g., "lead.name", "deal.stage"
    field_type TEXT NOT NULL DEFAULT 'string',  -- string, number, date, boolean
    source_table TEXT NOT NULL,        -- leads, deals, contacts
    description TEXT,
    example_value TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default CRM fields
INSERT INTO crm_field_registry (field_path, field_type, source_table, description, example_value) VALUES
    ('lead.name', 'string', 'leads', 'Nome do lead', 'João Silva'),
    ('lead.phone', 'string', 'leads', 'Telefone do lead', '11999998888'),
    ('lead.email', 'string', 'leads', 'Email do lead', 'joao@email.com'),
    ('lead.source', 'string', 'leads', 'Origem do lead', 'WhatsApp'),
    ('lead.status', 'string', 'leads', 'Status atual', 'active'),
    ('lead.temperature', 'string', 'leads', 'Temperatura do lead', 'hot'),
    ('deal.stage', 'string', 'deals', 'Etapa do funil', 'Qualificação'),
    ('deal.value', 'number', 'deals', 'Valor do negócio', 'R$ 5.000'),
    ('deal.probability', 'number', 'deals', 'Probabilidade de fechamento', '75%'),
    ('contact.name', 'string', 'contacts', 'Nome do contato', 'Maria Santos'),
    ('contact.company', 'string', 'contacts', 'Empresa do contato', 'Empresa XYZ'),
    ('channel.name', 'string', 'channels', 'Nome do canal', 'WhatsApp Business'),
    ('channel.type', 'string', 'channels', 'Tipo do canal', 'whatsapp'),
    ('agent.name', 'string', 'agents', 'Nome do agente', 'Sofia'),
    ('conversation.started_at', 'date', 'conversations', 'Início da conversa', '2025-01-06'),
    ('conversation.message_count', 'number', 'conversations', 'Total de mensagens', '15')
ON CONFLICT DO NOTHING;

-- ===========================================
-- 4. TEST SUITES
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'functional' CHECK (category IN ('functional', 'regression', 'edge_case', 'performance')),
    context JSONB DEFAULT '{}',         -- Default context for all tests
    is_active BOOLEAN DEFAULT true,
    pass_rate DECIMAL(5,2) DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 5. TEST CASES
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id UUID NOT NULL REFERENCES agent_test_suites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    messages JSONB NOT NULL DEFAULT '[]',  -- [{role, content, expected_response?, expected_tools?}]
    expected_tools TEXT[],                  -- Tools expected to be called
    expected_tone TEXT,                     -- "empathetic", "professional", etc
    context JSONB DEFAULT '{}',             -- CRM context to inject
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    last_score DECIMAL(5,2),
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 6. TEST RUNS (execution history)
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    suite_id UUID REFERENCES agent_test_suites(id) ON DELETE SET NULL,
    prompt_version_id UUID REFERENCES agent_prompt_versions(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error', 'cancelled')),
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0,
    duration_ms INTEGER,
    triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'auto', 'ci', 'schedule')),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 7. TEST RESULTS (per-case results)
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES agent_test_runs(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES agent_test_cases(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error')),
    score DECIMAL(5,2),
    user_input TEXT,
    expected_response TEXT,
    actual_response TEXT,
    tools_called JSONB DEFAULT '[]',
    execution_steps JSONB DEFAULT '[]',   -- Chain of thought / execution trace
    guardrail_checks JSONB DEFAULT '[]',
    duration_ms INTEGER,
    tokens_used INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 8. INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent ON agent_prompt_versions(agent_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_active ON agent_prompt_versions(agent_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_test_suites_agent ON agent_test_suites(agent_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON agent_test_cases(suite_id, order_index);
CREATE INDEX IF NOT EXISTS idx_test_runs_agent ON agent_test_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON agent_test_runs(status) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_test_results_run ON agent_test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_crm_fields_path ON crm_field_registry(field_path);

-- ===========================================
-- 9. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE agent_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_field_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_versions_all" ON agent_prompt_versions;
DROP POLICY IF EXISTS "crm_fields_all" ON crm_field_registry;
DROP POLICY IF EXISTS "test_suites_all" ON agent_test_suites;
DROP POLICY IF EXISTS "test_cases_all" ON agent_test_cases;
DROP POLICY IF EXISTS "test_runs_all" ON agent_test_runs;
DROP POLICY IF EXISTS "test_results_all" ON agent_test_results;

CREATE POLICY "prompt_versions_all" ON agent_prompt_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_fields_all" ON crm_field_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "test_suites_all" ON agent_test_suites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "test_cases_all" ON agent_test_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "test_runs_all" ON agent_test_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "test_results_all" ON agent_test_results FOR ALL USING (true) WITH CHECK (true);

-- Log
DO $$ BEGIN RAISE NOTICE 'Migration 006: AI Agent Builder tables created'; END $$;
