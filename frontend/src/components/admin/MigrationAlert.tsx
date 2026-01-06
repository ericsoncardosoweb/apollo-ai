/**
 * MigrationAlert - Componente reutilizável para alertas de migração
 * Permite executar migrações diretamente do painel admin
 */

import { useState } from 'react'
import { Alert, Button, Group, Text, Code, Stack, Progress, Modal, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDatabase, IconPlayerPlay, IconCheck, IconAlertCircle, IconCopy } from '@tabler/icons-react'
import { useClientSupabase } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'
import { supabase } from '@/lib/supabase'
import { CURRENT_MIGRATION_VERSION } from '@/hooks/useMigrationStatus'

interface Props {
    tableName: string  // Ex: 'tools', 'campaigns', etc
    migrationFile?: string  // Ex: 'tools_v2.sql'
    onSuccess?: () => void
}

// SQL for each missing table - this is the quick fix SQL for specific tables
const TABLE_MIGRATIONS: Record<string, string> = {
    tools: `
-- Tools Table
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'function' CHECK (type IN ('function', 'webhook', 'integration')),
    parameters JSONB NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}',
    execution_type VARCHAR(50) DEFAULT 'internal' CHECK (execution_type IN ('internal', 'webhook', 'code')),
    webhook_url TEXT,
    webhook_method VARCHAR(10) DEFAULT 'POST',
    webhook_headers JSONB DEFAULT '{}',
    code TEXT,
    requires_confirmation BOOLEAN DEFAULT false,
    allowed_agents TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    avg_execution_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tools_all" ON tools FOR ALL USING (true);

-- System Tools
INSERT INTO tools (name, display_name, description, type, execution_type, is_system, parameters) VALUES 
('updateContactStatus', 'Atualizar Status do Contato', 'Atualiza o status de um contato', 'function', 'internal', true, '{"type":"object","properties":{"contact_id":{"type":"string"},"status":{"type":"string","enum":["active","inactive","blocked"]}},"required":["contact_id","status"]}'),
('updatePipelineStage', 'Mover no Pipeline', 'Move um negócio para outra etapa', 'function', 'internal', true, '{"type":"object","properties":{"deal_id":{"type":"string"},"stage_id":{"type":"string"}},"required":["deal_id","stage_id"]}'),
('createTask', 'Criar Tarefa', 'Cria uma tarefa de follow-up', 'function', 'internal', true, '{"type":"object","properties":{"title":{"type":"string"},"due_date":{"type":"string"}},"required":["title"]}'),
('transferToHuman', 'Transferir para Humano', 'Transfere para atendente', 'function', 'internal', true, '{"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"]}'),
('endConversation', 'Finalizar Conversa', 'Marca como resolvida', 'function', 'internal', true, '{"type":"object","properties":{"resolution":{"type":"string"}},"required":["resolution"]}')
ON CONFLICT (name) DO NOTHING;
`,
    contacts: `
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(30) DEFAULT 'active',
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "contacts_all" ON contacts FOR ALL USING (true);
`,
    conversations: `
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status VARCHAR(30) DEFAULT 'waiting',
    assigned_to UUID,
    agent_id UUID,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "conversations_all" ON conversations FOR ALL USING (true);
`,
    messages: `
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10),
    sender_type VARCHAR(20) DEFAULT 'contact',
    content TEXT,
    content_type VARCHAR(30) DEFAULT 'text',
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "messages_all" ON messages FOR ALL USING (true);
`,
    campaigns: `
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'draft',
    type VARCHAR(50) DEFAULT 'broadcast',
    template JSONB NOT NULL DEFAULT '{"blocks":[]}',
    audience_type VARCHAR(50) DEFAULT 'all',
    audience_count INT DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "campaigns_all" ON campaigns FOR ALL USING (true);
`,
    whatsapp_connections: `
CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) DEFAULT 'uazapi',
    instance_id VARCHAR(255),
    api_url TEXT,
    api_key TEXT,
    status VARCHAR(30) DEFAULT 'disconnected',
    phone_number VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "whatsapp_connections_all" ON whatsapp_connections FOR ALL USING (true);
`,
    quick_replies: `
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "quick_replies_all" ON quick_replies FOR ALL USING (true);
`,
    tenant_settings: `
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tenant_settings_all" ON tenant_settings FOR ALL USING (true);
INSERT INTO tenant_settings (key, value, category) VALUES
('company_name', '"Minha Empresa"', 'general'),
('ai_enabled', 'true', 'ai')
ON CONFLICT (key) DO NOTHING;
`,
    integrations: `
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    is_connected BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "integrations_all" ON integrations FOR ALL USING (true);
`,
    crm_pipelines: `
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO crm_pipelines (name, is_default, stages) VALUES (
    'Funil de Vendas', true,
    '[{"id":"lead","name":"Lead","color":"#868e96","position":0},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":2,"is_conversion_point":true}]'::jsonb
) ON CONFLICT DO NOTHING;
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true);
`,
    crm_deals: `
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID,
    current_stage_id VARCHAR(100) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "crm_deals_all" ON crm_deals FOR ALL USING (true);
`
}

export function MigrationAlert({ tableName, migrationFile, onSuccess }: Props) {
    const [running, setRunning] = useState(false)
    const [showSql, setShowSql] = useState(false)
    const { clientSupabase } = useClientSupabase()
    const { selectedCompany } = useViewContext()

    const sql = TABLE_MIGRATIONS[tableName] || ''

    const handleRunMigration = async () => {
        if (!clientSupabase || !sql) {
            notifications.show({
                title: 'Erro',
                message: 'Supabase do cliente não configurado ou SQL não disponível',
                color: 'red'
            })
            return
        }

        setRunning(true)

        try {
            // Execute the SQL directly on the client's Supabase
            const { error } = await clientSupabase.rpc('exec_sql', { sql_query: sql })

            if (error) {
                // If RPC doesn't exist, show the SQL to copy
                if (error.message.includes('function') || error.message.includes('does not exist')) {
                    setShowSql(true)
                    notifications.show({
                        title: 'Execução Manual Necessária',
                        message: 'Copie o SQL e execute no Supabase do cliente',
                        color: 'yellow'
                    })
                } else {
                    throw error
                }
            } else {
                notifications.show({
                    title: 'Migração Executada!',
                    message: `Tabela ${tableName} criada com sucesso`,
                    color: 'green'
                })
                onSuccess?.()
            }
        } catch (error) {
            console.error('Migration error:', error)
            setShowSql(true)
            notifications.show({
                title: 'Erro na Migração',
                message: 'Execute o SQL manualmente no Supabase',
                color: 'red'
            })
        } finally {
            setRunning(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sql)
        notifications.show({
            title: 'SQL Copiado!',
            message: 'Cole no SQL Editor do Supabase',
            color: 'green'
        })
    }

    return (
        <>
            <Alert icon={<IconDatabase size={16} />} color="yellow" title="Migração Necessária">
                <Stack gap="sm">
                    <Text size="sm">
                        A tabela <Code>{tableName}</Code> não foi encontrada no banco de dados.
                    </Text>
                    <Group>
                        <Button
                            size="xs"
                            leftSection={<IconPlayerPlay size={14} />}
                            loading={running}
                            onClick={handleRunMigration}
                        >
                            Executar Migração
                        </Button>
                        <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconCopy size={14} />}
                            onClick={copyToClipboard}
                        >
                            Copiar SQL
                        </Button>
                    </Group>
                    {migrationFile && (
                        <Text size="xs" c="dimmed">
                            Arquivo: supabase/tenant_migrations/{migrationFile}
                        </Text>
                    )}
                </Stack>
            </Alert>

            {/* SQL Modal for manual execution */}
            <Modal
                opened={showSql}
                onClose={() => setShowSql(false)}
                title={`SQL para ${tableName}`}
                size="lg"
            >
                <Stack gap="md">
                    <Alert color="blue" variant="light">
                        <Text size="sm">
                            Execute este SQL no <strong>SQL Editor</strong> do Supabase do cliente.
                        </Text>
                    </Alert>
                    <Textarea
                        value={sql}
                        rows={15}
                        styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
                        readOnly
                    />
                    <Group justify="flex-end">
                        <Button
                            leftSection={<IconCopy size={14} />}
                            onClick={copyToClipboard}
                        >
                            Copiar SQL
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}

export default MigrationAlert
