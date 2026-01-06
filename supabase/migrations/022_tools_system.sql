-- ============================================================================
-- APOLLO A.I. ADVANCED - MIGRATION 022
-- Tools System - Ações configuráveis para agentes
-- ============================================================================

-- ============================================================================
-- 1. Tools Config - Configuração completa de tools
-- ============================================================================

-- Ensure all columns exist
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'integration';
-- categories: 'crm', 'messaging', 'integration', 'scheduling', 'internal'

ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT 'gray';
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 3;
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS retry_delay_ms INTEGER DEFAULT 1000;
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS timeout_ms INTEGER DEFAULT 5000;
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS test_mode_enabled BOOLEAN DEFAULT true;
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ;
ALTER TABLE tools_config ADD COLUMN IF NOT EXISTS last_test_success BOOLEAN;

-- ============================================================================
-- 2. Tool Execution Log - Registro de execuções
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES tools_config(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    agent_id UUID REFERENCES agents(id),
    conversation_id UUID REFERENCES conversations(id),
    message_id UUID,
    
    -- Execution details
    input_params JSONB,
    output_result JSONB,
    success BOOLEAN,
    error_message TEXT,
    latency_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    test_mode BOOLEAN DEFAULT false,
    
    -- Metadata
    triggered_by VARCHAR(50), -- 'ai', 'user', 'automation'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_exec_tool ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_exec_tenant ON tool_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tool_exec_conversation ON tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_exec_created ON tool_executions(created_at DESC);

-- ============================================================================
-- 3. Default Built-in Tools
-- ============================================================================

-- Function to create default tools for tenant
CREATE OR REPLACE FUNCTION create_default_tools(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- CRM Update Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'updateCRM',
        'Atualiza campos do lead no CRM (status, descrição, campos customizados)',
        'builtin',
        'crm',
        'database',
        'indigo',
        true,
        '{"action": "update_lead"}',
        '{
            "type": "object",
            "properties": {
                "kanban_name": {"type": "string", "description": "Nome do kanban/pipeline"},
                "field_name": {"type": "string", "description": "Nome do campo a atualizar"},
                "value": {"type": "string", "description": "Novo valor"},
                "description": {"type": "string", "description": "Descrição da atualização (para histórico)"}
            },
            "required": ["kanban_name", "field_name", "value"]
        }'
    ) ON CONFLICT DO NOTHING;
    
    -- Send Message Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'sendMessage',
        'Envia uma mensagem adicional (texto, imagem, vídeo, áudio, arquivo)',
        'builtin',
        'messaging',
        'message',
        'green',
        true,
        '{"action": "send_message"}',
        '{
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["text", "image", "video", "audio", "file"]},
                "content": {"type": "string", "description": "Texto ou URL do arquivo"},
                "delay_seconds": {"type": "integer", "description": "Delay antes de enviar"}
            },
            "required": ["type", "content"]
        }'
    ) ON CONFLICT DO NOTHING;
    
    -- Schedule Remarketing Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'scheduleRemarketing',
        'Agenda um re-engajamento futuro (dias, horas, minutos)',
        'builtin',
        'scheduling',
        'clock',
        'orange',
        true,
        '{"action": "schedule_remarketing"}',
        '{
            "type": "object",
            "properties": {
                "delay_type": {"type": "string", "enum": ["minutes", "hours", "days"]},
                "delay_value": {"type": "integer"},
                "message": {"type": "string"},
                "day_of_week": {"type": "string", "enum": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}
            },
            "required": ["delay_type", "delay_value"]
        }'
    ) ON CONFLICT DO NOTHING;
    
    -- Transfer to Human Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'transferToHuman',
        'Transfere a conversa para um atendente humano ou departamento',
        'builtin',
        'internal',
        'user',
        'red',
        true,
        '{"action": "transfer"}',
        '{
            "type": "object",
            "properties": {
                "department": {"type": "string", "description": "Departamento destino"},
                "agent_id": {"type": "string", "description": "ID do atendente específico"},
                "reason": {"type": "string", "description": "Motivo da transferência"}
            }
        }'
    ) ON CONFLICT DO NOTHING;
    
    -- Pause Agent Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'pauseAgent',
        'Pausa a IA nesta conversa por um período',
        'builtin',
        'internal',
        'pause',
        'yellow',
        true,
        '{"action": "pause_ai"}',
        '{
            "type": "object",
            "properties": {
                "duration_minutes": {"type": "integer", "description": "Duração em minutos (default: 60)"}
            }
        }'
    ) ON CONFLICT DO NOTHING;
    
    -- Switch Agent Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'switchAgent',
        'Transfere para outro agente de IA (sub-agente)',
        'builtin',
        'internal',
        'robot',
        'violet',
        true,
        '{"action": "switch_agent"}',
        '{
            "type": "object",
            "properties": {
                "target_agent_id": {"type": "string", "description": "ID do agente destino"},
                "context_message": {"type": "string", "description": "Mensagem de contexto para o novo agente"}
            },
            "required": ["target_agent_id"]
        }'
    ) ON CONFLICT DO NOTHING;
    
    -- Notify WhatsApp Tool
    INSERT INTO tools_config (tenant_id, name, description, tool_type, category, icon, color, is_active, config, input_schema)
    VALUES (
        p_tenant_id,
        'notifyWhatsApp',
        'Envia notificação para outro número de WhatsApp',
        'builtin',
        'messaging',
        'brand-whatsapp',
        'teal',
        true,
        '{"action": "notify"}',
        '{
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "Número do WhatsApp destino"},
                "message": {"type": "string", "description": "Mensagem a enviar"},
                "include_lead_info": {"type": "boolean", "description": "Incluir informações do lead"}
            },
            "required": ["phone", "message"]
        }'
    ) ON CONFLICT DO NOTHING;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tool_executions_tenant" ON tool_executions
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );
