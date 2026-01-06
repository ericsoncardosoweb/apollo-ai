-- =============================================================================
-- TOOLS & INTEGRATIONS
-- Ferramentas de IA e Integrações Externas
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AI Tools/Functions
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Type
    type VARCHAR(50) DEFAULT 'function' CHECK (type IN ('function', 'webhook', 'integration')),
    
    -- Function parameters (OpenAI format)
    parameters JSONB NOT NULL DEFAULT '{
        "type": "object",
        "properties": {},
        "required": []
    }',
    
    -- Execution config
    execution_type VARCHAR(50) DEFAULT 'internal' CHECK (execution_type IN ('internal', 'webhook', 'code')),
    webhook_url TEXT,
    webhook_method VARCHAR(10) DEFAULT 'POST',
    webhook_headers JSONB DEFAULT '{}',
    code TEXT, -- JavaScript code for code type
    
    -- Permissions
    requires_confirmation BOOLEAN DEFAULT false,
    allowed_agents TEXT[] DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    -- Stats
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    avg_execution_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool execution log
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    agent_id UUID,
    conversation_id UUID,
    
    -- Request/Response
    input_params JSONB,
    output_result JSONB,
    
    -- Status
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
    error_message TEXT,
    execution_time_ms INTEGER,
    
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- External integrations (OAuth, API keys)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    
    -- OAuth tokens
    access_token TEXT, -- Encrypted
    refresh_token TEXT, -- Encrypted
    token_expires_at TIMESTAMPTZ,
    
    -- API config
    api_key TEXT, -- Encrypted
    api_url TEXT,
    
    -- Status
    is_connected BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Provider-specific settings
    settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(type);
CREATE INDEX IF NOT EXISTS idx_tools_active ON tools(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tools_system ON tools(is_system);

CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_conversation ON tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_date ON tool_executions(executed_at);

CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_connected ON integrations(is_connected);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tools_all" ON tools FOR ALL USING (true);
CREATE POLICY "tool_executions_all" ON tool_executions FOR ALL USING (true);
CREATE POLICY "integrations_all" ON integrations FOR ALL USING (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tools_updated_at') THEN
        CREATE TRIGGER tools_updated_at BEFORE UPDATE ON tools
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'integrations_updated_at') THEN
        CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON integrations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- =============================================================================
-- SYSTEM TOOLS (Default)
-- =============================================================================

INSERT INTO tools (name, display_name, description, type, execution_type, is_system, parameters)
VALUES 
    (
        'updateContactStatus',
        'Atualizar Status do Contato',
        'Atualiza o status de um contato (ativo, inativo, bloqueado)',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"contact_id": {"type": "string", "description": "ID do contato"}, "status": {"type": "string", "description": "Novo status", "enum": ["active", "inactive", "blocked"]}}, "required": ["contact_id", "status"]}'
    ),
    (
        'updatePipelineStage',
        'Mover no Pipeline',
        'Move um negócio para outra etapa do pipeline do CRM',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"deal_id": {"type": "string", "description": "ID do negócio"}, "stage_id": {"type": "string", "description": "ID da nova etapa"}}, "required": ["deal_id", "stage_id"]}'
    ),
    (
        'createTask',
        'Criar Tarefa',
        'Cria uma tarefa de follow-up para o atendente',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"title": {"type": "string", "description": "Título da tarefa"}, "description": {"type": "string", "description": "Descrição"}, "due_date": {"type": "string", "description": "Data limite (YYYY-MM-DD)"}}, "required": ["title"]}'
    ),
    (
        'scheduleMessage',
        'Agendar Mensagem',
        'Agenda uma mensagem WhatsApp para ser enviada depois',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"contact_id": {"type": "string", "description": "ID do contato"}, "message": {"type": "string", "description": "Conteúdo da mensagem"}, "send_at": {"type": "string", "description": "Data/hora de envio (ISO 8601)"}}, "required": ["contact_id", "message", "send_at"]}'
    ),
    (
        'searchProducts',
        'Buscar Produtos',
        'Busca produtos/serviços no catálogo',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"query": {"type": "string", "description": "Termo de busca"}, "category": {"type": "string", "description": "Categoria (opcional)"}}, "required": ["query"]}'
    ),
    (
        'getContactHistory',
        'Histórico do Contato',
        'Busca o histórico de conversas anteriores do contato',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"contact_id": {"type": "string", "description": "ID do contato"}, "limit": {"type": "integer", "description": "Quantidade de mensagens", "default": 20}}, "required": ["contact_id"]}'
    ),
    (
        'transferToHuman',
        'Transferir para Humano',
        'Transfere a conversa para um atendente humano',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"reason": {"type": "string", "description": "Motivo da transferência"}, "department": {"type": "string", "description": "Departamento (opcional)"}}, "required": ["reason"]}'
    ),
    (
        'endConversation',
        'Finalizar Conversa',
        'Marca a conversa como resolvida/finalizada',
        'function',
        'internal',
        true,
        '{"type": "object", "properties": {"resolution": {"type": "string", "description": "Descrição da resolução"}, "satisfaction": {"type": "integer", "description": "Nota de satisfação (1-5)"}}, "required": ["resolution"]}'
    )
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- DEFAULT INTEGRATIONS (Available but not connected)
-- =============================================================================

INSERT INTO integrations (name, provider, settings)
VALUES 
    ('Google Calendar', 'google_calendar', '{"scopes": ["calendar.events"]}'),
    ('Google Sheets', 'google_sheets', '{"scopes": ["spreadsheets"]}'),
    ('RD Station', 'rd_station', '{}'),
    ('n8n Webhook', 'n8n', '{}')
ON CONFLICT DO NOTHING;
