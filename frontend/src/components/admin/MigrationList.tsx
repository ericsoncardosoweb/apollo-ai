/**
 * MigrationList - Lista de migrações pendentes
 * Permite executar cada migração individualmente
 */

import { useState } from 'react'
import {
    Stack,
    Paper,
    Text,
    Title,
    Badge,
    Button,
    Group,
    Alert,
    Progress,
    Accordion,
    Code,
    CopyButton,
    Tooltip,
    ActionIcon,
    ThemeIcon,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
    IconCheck,
    IconCopy,
    IconPlayerPlay,
    IconDatabase,
    IconAlertCircle,
    IconCircleDashed,
    IconCircleCheck,
} from '@tabler/icons-react'
import { useClientSupabase } from '@/hooks/useClientSupabase'

// Define each migration with name, description and SQL
export interface Migration {
    version: number
    name: string
    description: string
    sql: string
}

// All available migrations
export const MIGRATIONS: Migration[] = [
    {
        version: 1,
        name: 'Contacts & Conversations',
        description: 'Tabelas base para contatos e conversas',
        sql: `-- Contacts
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
DROP POLICY IF EXISTS contacts_all ON contacts;
CREATE POLICY contacts_all ON contacts FOR ALL USING (true);

-- Conversations
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
DROP POLICY IF EXISTS conversations_all ON conversations;
CREATE POLICY conversations_all ON conversations FOR ALL USING (true);`
    },
    {
        version: 2,
        name: 'Messages',
        description: 'Tabela de mensagens das conversas',
        sql: `-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    sender_type VARCHAR(20) DEFAULT 'contact',
    content TEXT,
    content_type VARCHAR(30) DEFAULT 'text',
    status VARCHAR(20) DEFAULT 'sent',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_all ON messages;
CREATE POLICY messages_all ON messages FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);`
    },
    {
        version: 3,
        name: 'CRM Pipelines & Deals',
        description: 'Pipeline de vendas e negócios',
        sql: `-- CRM Pipelines
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_pipelines_all ON crm_pipelines;
CREATE POLICY crm_pipelines_all ON crm_pipelines FOR ALL USING (true);

-- Default pipeline
INSERT INTO crm_pipelines (name, is_default, stages) 
SELECT 'Funil de Vendas', true, '[{"id":"lead","name":"Lead","color":"#868e96","position":0},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":2,"is_conversion_point":true}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE is_default = true);

-- CRM Deals
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id),
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID REFERENCES crm_pipelines(id),
    current_stage_id VARCHAR(100) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_deals_all ON crm_deals;
CREATE POLICY crm_deals_all ON crm_deals FOR ALL USING (true);

-- CRM Deal History
CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
    from_stage VARCHAR(100),
    to_stage VARCHAR(100),
    changed_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_deal_history_all ON crm_deal_history;
CREATE POLICY crm_deal_history_all ON crm_deal_history FOR ALL USING (true);`
    },
    {
        version: 4,
        name: 'Tools',
        description: 'Ferramentas e funções para agentes IA',
        sql: `-- Tools
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'function',
    parameters JSONB NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}',
    execution_type VARCHAR(50) DEFAULT 'internal',
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
DROP POLICY IF EXISTS tools_all ON tools;
CREATE POLICY tools_all ON tools FOR ALL USING (true);

-- System Tools
INSERT INTO tools (name, display_name, description, type, execution_type, is_system, parameters) VALUES 
('updateContactStatus', 'Atualizar Status do Contato', 'Atualiza o status de um contato', 'function', 'internal', true, '{"type":"object","properties":{"contact_id":{"type":"string"},"status":{"type":"string","enum":["active","inactive","blocked"]}},"required":["contact_id","status"]}'),
('transferToHuman', 'Transferir para Humano', 'Transfere para atendente', 'function', 'internal', true, '{"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"]}'),
('endConversation', 'Finalizar Conversa', 'Marca como resolvida', 'function', 'internal', true, '{"type":"object","properties":{"resolution":{"type":"string"}},"required":["resolution"]}')
ON CONFLICT (name) DO NOTHING;`
    },
    {
        version: 5,
        name: 'WhatsApp Connections',
        description: 'Conexões WhatsApp (UAZAPI, etc)',
        sql: `-- WhatsApp Connections
CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) DEFAULT 'uazapi',
    instance_id VARCHAR(255),
    api_url TEXT,
    api_key TEXT,
    status VARCHAR(30) DEFAULT 'disconnected',
    phone_number VARCHAR(50),
    qr_code TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_connections_all ON whatsapp_connections;
CREATE POLICY whatsapp_connections_all ON whatsapp_connections FOR ALL USING (true);`
    },
    {
        version: 6,
        name: 'Quick Replies',
        description: 'Respostas rápidas para atendimento',
        sql: `-- Quick Replies
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
DROP POLICY IF EXISTS quick_replies_all ON quick_replies;
CREATE POLICY quick_replies_all ON quick_replies FOR ALL USING (true);`
    },
    {
        version: 7,
        name: 'Tenant Settings',
        description: 'Configurações personalizadas do tenant',
        sql: `-- Tenant Settings
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_settings_all ON tenant_settings;
CREATE POLICY tenant_settings_all ON tenant_settings FOR ALL USING (true);

-- Default Settings
INSERT INTO tenant_settings (key, value, category) VALUES
('company_name', '"Minha Empresa"', 'general'),
('ai_enabled', 'true', 'ai'),
('ai_model', '"gpt-4"', 'ai')
ON CONFLICT (key) DO NOTHING;`
    },
    {
        version: 8,
        name: 'Campaigns',
        description: 'Campanhas e disparos em massa',
        sql: `-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'draft',
    type VARCHAR(50) DEFAULT 'broadcast',
    template JSONB NOT NULL DEFAULT '{"blocks":[]}',
    audience_type VARCHAR(50) DEFAULT 'all',
    audience_filter JSONB,
    audience_count INT DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_read INT DEFAULT 0,
    total_replied INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaigns_all ON campaigns;
CREATE POLICY campaigns_all ON campaigns FOR ALL USING (true);

-- Campaign Recipients
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),
    phone VARCHAR(50),
    status VARCHAR(30) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_recipients_all ON campaign_recipients;
CREATE POLICY campaign_recipients_all ON campaign_recipients FOR ALL USING (true);`
    },
    {
        version: 9,
        name: 'Integrations',
        description: 'Integrações externas (n8n, webhooks)',
        sql: `-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    is_connected BOOLEAN DEFAULT false,
    credentials JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    last_synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integrations_all ON integrations;
CREATE POLICY integrations_all ON integrations FOR ALL USING (true);`
    },
    {
        version: 10,
        name: 'Tool Executions & Triggers',
        description: 'Logs de execução e gatilhos automáticos',
        sql: `-- Tool Executions Log
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tools(id),
    conversation_id UUID,
    contact_id UUID,
    input_params JSONB,
    output_result JSONB,
    status VARCHAR(20) DEFAULT 'success',
    execution_time_ms INT,
    error_message TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tool_executions_all ON tool_executions;
CREATE POLICY tool_executions_all ON tool_executions FOR ALL USING (true);

-- Automation Triggers
CREATE TABLE IF NOT EXISTS automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_triggers_all ON automation_triggers;
CREATE POLICY automation_triggers_all ON automation_triggers FOR ALL USING (true);`
    }
]

export const CURRENT_MIGRATION_VERSION = MIGRATIONS.length

interface Props {
    currentVersion: number
    onMigrationComplete?: (newVersion: number) => void
}

export function MigrationList({ currentVersion, onMigrationComplete }: Props) {
    const [runningVersion, setRunningVersion] = useState<number | null>(null)
    const { clientSupabase, isReady } = useClientSupabase()

    const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion)
    const completedMigrations = MIGRATIONS.filter(m => m.version <= currentVersion)

    const handleRunMigration = async (migration: Migration) => {
        if (!clientSupabase) {
            notifications.show({
                title: 'Erro',
                message: 'Banco de dados não configurado',
                color: 'red'
            })
            return
        }

        setRunningVersion(migration.version)

        try {
            // Try to execute SQL directly on client's Supabase
            // Note: This requires the exec_sql RPC or manual execution
            const { error } = await clientSupabase.rpc('exec_sql', { sql_query: migration.sql })

            if (error) {
                // If RPC doesn't exist, show copy instructions
                if (error.message.includes('function') || error.message.includes('does not exist')) {
                    // Copy SQL to clipboard
                    await navigator.clipboard.writeText(migration.sql)
                    notifications.show({
                        title: 'SQL Copiado!',
                        message: 'Cole no SQL Editor do Supabase e execute',
                        color: 'yellow'
                    })
                } else {
                    throw error
                }
            } else {
                notifications.show({
                    title: 'Migração Executada!',
                    message: `${migration.name} aplicada com sucesso`,
                    color: 'green'
                })
                onMigrationComplete?.(migration.version)
            }
        } catch (error) {
            console.error('Migration error:', error)
            notifications.show({
                title: 'Erro na Migração',
                message: 'Copie o SQL e execute manualmente no Supabase',
                color: 'red'
            })
        } finally {
            setRunningVersion(null)
        }
    }

    const copyAllPendingSql = () => {
        const allSql = pendingMigrations.map(m => `-- Migration v${m.version}: ${m.name}\n${m.sql}`).join('\n\n')
        navigator.clipboard.writeText(allSql)
        notifications.show({
            title: 'SQL Copiado!',
            message: `${pendingMigrations.length} migrações copiadas`,
            color: 'green'
        })
    }

    if (!isReady) {
        return (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                Configure as credenciais do banco de dados primeiro.
            </Alert>
        )
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <div>
                    <Title order={5}>Migrações do Banco de Dados</Title>
                    <Text size="sm" c="dimmed">
                        Versão atual: v{currentVersion} / v{CURRENT_MIGRATION_VERSION}
                    </Text>
                </div>
                <Badge
                    size="lg"
                    color={pendingMigrations.length > 0 ? 'yellow' : 'green'}
                >
                    {pendingMigrations.length > 0
                        ? `${pendingMigrations.length} pendente(s)`
                        : 'Atualizado'}
                </Badge>
            </Group>

            <Progress
                value={(currentVersion / CURRENT_MIGRATION_VERSION) * 100}
                color="green"
                size="sm"
            />

            {pendingMigrations.length > 0 && (
                <Alert color="yellow" icon={<IconDatabase size={16} />}>
                    <Group justify="space-between" align="center">
                        <Text size="sm">
                            Execute as migrações pendentes para habilitar todas as funcionalidades.
                        </Text>
                        <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconCopy size={14} />}
                            onClick={copyAllPendingSql}
                        >
                            Copiar Todas
                        </Button>
                    </Group>
                </Alert>
            )}

            <Accordion variant="separated">
                {/* Pending Migrations */}
                {pendingMigrations.map((migration) => (
                    <Accordion.Item key={migration.version} value={`v${migration.version}`}>
                        <Accordion.Control
                            icon={
                                <ThemeIcon size="sm" color="yellow" variant="light" radius="xl">
                                    <IconCircleDashed size={14} />
                                </ThemeIcon>
                            }
                        >
                            <Group gap="xs">
                                <Badge size="sm" color="yellow">v{migration.version}</Badge>
                                <Text size="sm" fw={500}>{migration.name}</Text>
                            </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                            <Stack gap="sm">
                                <Text size="sm" c="dimmed">{migration.description}</Text>
                                <Code block style={{ maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
                                    {migration.sql}
                                </Code>
                                <Group>
                                    <Button
                                        size="xs"
                                        leftSection={<IconPlayerPlay size={14} />}
                                        loading={runningVersion === migration.version}
                                        onClick={() => handleRunMigration(migration)}
                                        disabled={migration.version !== currentVersion + 1}
                                    >
                                        Executar
                                    </Button>
                                    <CopyButton value={migration.sql}>
                                        {({ copied, copy }) => (
                                            <Button
                                                size="xs"
                                                variant="light"
                                                color={copied ? 'green' : 'gray'}
                                                leftSection={<IconCopy size={14} />}
                                                onClick={copy}
                                            >
                                                {copied ? 'Copiado!' : 'Copiar SQL'}
                                            </Button>
                                        )}
                                    </CopyButton>
                                </Group>
                                {migration.version !== currentVersion + 1 && (
                                    <Text size="xs" c="dimmed">
                                        Execute a migração v{currentVersion + 1} primeiro.
                                    </Text>
                                )}
                            </Stack>
                        </Accordion.Panel>
                    </Accordion.Item>
                ))}

                {/* Completed Migrations */}
                {completedMigrations.map((migration) => (
                    <Accordion.Item key={migration.version} value={`v${migration.version}`}>
                        <Accordion.Control
                            icon={
                                <ThemeIcon size="sm" color="green" variant="light" radius="xl">
                                    <IconCircleCheck size={14} />
                                </ThemeIcon>
                            }
                        >
                            <Group gap="xs">
                                <Badge size="sm" color="green">v{migration.version}</Badge>
                                <Text size="sm" c="dimmed">{migration.name}</Text>
                                <Badge size="xs" color="green" variant="light">Concluída</Badge>
                            </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                            <Text size="sm" c="dimmed">{migration.description}</Text>
                        </Accordion.Panel>
                    </Accordion.Item>
                ))}
            </Accordion>
        </Stack>
    )
}

export default MigrationList
