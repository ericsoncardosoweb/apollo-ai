/**
 * useMigrationStatus - Hook to check tenant database migration status
 * Used by admin/master users to see which clients need database updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { notifications } from '@mantine/notifications'

// Current expected migration version - increment when adding new migrations
export const CURRENT_MIGRATION_VERSION = 10

interface TenantWithMigration {
    tenant_id: string
    tenant_name: string
    supabase_url: string
    supabase_anon_key: string
    supabase_service_key: string | null
    status: string
    migrations_version: number
    last_tested_at: string | null
    needs_update: boolean
}

interface MigrationResult {
    success: boolean
    new_version: number
    error?: string
}

/**
 * Hook to get all tenants with their migration status
 * Only for master/admin users
 */
export function useTenantMigrationStatus() {
    const { user } = useAuth()
    const isMasterOrAdmin = user?.role === 'master' || user?.role === 'admin'

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['tenant-migration-status'],
        queryFn: async () => {
            // Get all tenants with their database config
            const { data: configs, error } = await supabase
                .from('tenant_database_config')
                .select(`
                    tenant_id,
                    supabase_url,
                    supabase_anon_key,
                    supabase_service_key,
                    status,
                    migrations_version,
                    last_tested_at
                `)
                .eq('status', 'active')

            if (error) throw error

            // Get tenant names
            const tenantIds = configs.map(c => c.tenant_id)
            const { data: tenants } = await supabase
                .from('tenants')
                .select('id, name')
                .in('id', tenantIds)

            const tenantMap = new Map(tenants?.map(t => [t.id, t.name]) || [])

            // Map with update status
            const tenantsWithStatus: TenantWithMigration[] = configs.map(config => ({
                tenant_id: config.tenant_id,
                tenant_name: tenantMap.get(config.tenant_id) || 'Sem nome',
                supabase_url: config.supabase_url,
                supabase_anon_key: config.supabase_anon_key,
                supabase_service_key: config.supabase_service_key,
                status: config.status,
                migrations_version: config.migrations_version || 0,
                last_tested_at: config.last_tested_at,
                needs_update: (config.migrations_version || 0) < CURRENT_MIGRATION_VERSION
            }))

            return tenantsWithStatus
        },
        enabled: isMasterOrAdmin,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    const tenantsNeedingUpdate = data?.filter(t => t.needs_update) || []
    const allUpToDate = tenantsNeedingUpdate.length === 0

    return {
        tenants: data || [],
        tenantsNeedingUpdate,
        allUpToDate,
        isLoading,
        error,
        refetch,
        isMasterOrAdmin,
        currentVersion: CURRENT_MIGRATION_VERSION
    }
}

/**
 * Hook to run migrations on a tenant's database
 */
export function useRunTenantMigration() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (tenant: TenantWithMigration): Promise<MigrationResult> => {
            // Get migration SQL based on current version
            const migrationSQL = getMigrationSQL(tenant.migrations_version)

            if (!migrationSQL) {
                return { success: true, new_version: CURRENT_MIGRATION_VERSION }
            }

            // Execute via Edge Function (which has service role access)
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/tenants/${tenant.tenant_id}/run-migration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    target_version: CURRENT_MIGRATION_VERSION,
                    sql: migrationSQL
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Failed to run migration')
            }

            const result = await response.json()

            // Update version in master DB
            await supabase
                .from('tenant_database_config')
                .update({ migrations_version: CURRENT_MIGRATION_VERSION })
                .eq('tenant_id', tenant.tenant_id)

            return { success: true, new_version: CURRENT_MIGRATION_VERSION }
        },
        onSuccess: (result, tenant) => {
            notifications.show({
                title: 'Migração concluída',
                message: `${tenant.tenant_name} atualizado para v${result.new_version}`,
                color: 'green'
            })
            queryClient.invalidateQueries({ queryKey: ['tenant-migration-status'] })
        },
        onError: (error: Error, tenant) => {
            notifications.show({
                title: 'Erro na migração',
                message: `${tenant.tenant_name}: ${error.message}`,
                color: 'red'
            })
        }
    })
}

/**
 * Get SQL for migrating from one version to the target
 */
function getMigrationSQL(currentVersion: number): string | null {
    const migrations: Record<number, string> = {
        // Version 0 -> 1: Base tables (contacts, conversations)
        0: `
-- Base Tables
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status VARCHAR(30) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ai', 'attending', 'resolved', 'archived')),
    priority VARCHAR(20) DEFAULT 'normal',
    assigned_to UUID,
    assigned_to_name VARCHAR(255),
    agent_id UUID,
    agent_name VARCHAR(255),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) CHECK (direction IN ('in', 'out')),
    sender_type VARCHAR(20) DEFAULT 'contact' CHECK (sender_type IN ('contact', 'agent', 'ai', 'system')),
    sender_id UUID,
    sender_name VARCHAR(255),
    content TEXT,
    content_type VARCHAR(30) DEFAULT 'text',
    media_url TEXT,
    media_mime_type VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_all" ON messages FOR ALL USING (true);
`,
        // Version 1 -> 2: CRM Tables
        1: `
-- CRM Engine
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO crm_pipelines (name, description, is_default, stages) VALUES (
    'Funil de Vendas', 'Pipeline padrão', true,
    '[{"id":"lead","name":"Lead","color":"#868e96","position":0},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1},{"id":"proposta","name":"Proposta","color":"#228be6","position":2},{"id":"negociacao","name":"Negociação","color":"#7950f2","position":3},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":4,"is_conversion_point":true}]'::jsonb
) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE SET NULL,
    current_stage_id VARCHAR(100) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    cycle_number INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    tags TEXT[] DEFAULT '{}',
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true);
`,
        // Version 2 -> 3: Tools and Integrations
        2: `
-- Tools
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
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools_all" ON tools FOR ALL USING (true);

-- System Tools
INSERT INTO tools (name, display_name, description, type, execution_type, is_system, parameters) VALUES 
('updateContactStatus', 'Atualizar Status do Contato', 'Atualiza o status de um contato', 'function', 'internal', true, '{"type":"object","properties":{"contact_id":{"type":"string"},"status":{"type":"string","enum":["active","inactive","blocked"]}},"required":["contact_id","status"]}'),
('updatePipelineStage', 'Mover no Pipeline', 'Move um negócio para outra etapa', 'function', 'internal', true, '{"type":"object","properties":{"deal_id":{"type":"string"},"stage_id":{"type":"string"}},"required":["deal_id","stage_id"]}'),
('createTask', 'Criar Tarefa', 'Cria uma tarefa de follow-up', 'function', 'internal', true, '{"type":"object","properties":{"title":{"type":"string"},"due_date":{"type":"string"}},"required":["title"]}'),
('scheduleMessage', 'Agendar Mensagem', 'Agenda uma mensagem WhatsApp', 'function', 'internal', true, '{"type":"object","properties":{"contact_id":{"type":"string"},"message":{"type":"string"},"send_at":{"type":"string"}},"required":["contact_id","message","send_at"]}'),
('searchProducts', 'Buscar Produtos', 'Busca no catálogo', 'function', 'internal', true, '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'),
('getContactHistory', 'Histórico do Contato', 'Busca conversas anteriores', 'function', 'internal', true, '{"type":"object","properties":{"contact_id":{"type":"string"}},"required":["contact_id"]}'),
('transferToHuman', 'Transferir para Humano', 'Transfere para atendente', 'function', 'internal', true, '{"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"]}'),
('endConversation', 'Finalizar Conversa', 'Marca como resolvida', 'function', 'internal', true, '{"type":"object","properties":{"resolution":{"type":"string"}},"required":["resolution"]}')
ON CONFLICT (name) DO NOTHING;
`,
        // Version 3 -> 4: Connections
        3: `
-- WhatsApp Connections
CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    provider VARCHAR(50) DEFAULT 'uazapi' CHECK (provider IN ('uazapi', 'evolution', 'meta_cloud', 'baileys')),
    instance_id VARCHAR(255),
    api_url TEXT,
    api_key TEXT,
    webhook_url TEXT,
    status VARCHAR(30) DEFAULT 'disconnected' CHECK (status IN ('connecting', 'connected', 'disconnected', 'qr_pending', 'error', 'banned')),
    qr_code TEXT,
    qr_expires_at TIMESTAMPTZ,
    phone_number VARCHAR(50),
    phone_name VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    daily_message_limit INT DEFAULT 1000,
    messages_sent_today INT DEFAULT 0,
    total_messages_sent INT DEFAULT 0,
    total_messages_received INT DEFAULT 0,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whatsapp_connections_all" ON whatsapp_connections FOR ALL USING (true);
`,
        // Version 4 -> 5: Quick Replies
        4: `
-- Quick Replies
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    category VARCHAR(100),
    media_url TEXT,
    media_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut);
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_replies_all" ON quick_replies FOR ALL USING (true);
`,
        // Version 5 -> 6: Tenant Settings
        5: `
-- Tenant Settings
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_settings_all" ON tenant_settings FOR ALL USING (true);

-- Default settings
INSERT INTO tenant_settings (key, value, category) VALUES
('company_name', '"Minha Empresa"', 'general'),
('timezone', '"America/Sao_Paulo"', 'general'),
('welcome_message', '"Olá! Como posso ajudar?"', 'chat'),
('ai_enabled', 'true', 'ai'),
('ai_model', '"gpt-4"', 'ai')
ON CONFLICT (key) DO NOTHING;
`,
        // Version 6 -> 7: Campaigns
        6: `
-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed')),
    type VARCHAR(50) DEFAULT 'broadcast' CHECK (type IN ('broadcast', 'drip', 'triggered')),
    template JSONB NOT NULL DEFAULT '{"blocks":[]}',
    audience_type VARCHAR(50) DEFAULT 'all',
    audience_filters JSONB DEFAULT '{}',
    audience_count INT DEFAULT 0,
    schedule_type VARCHAR(30) DEFAULT 'immediate',
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    connection_id UUID REFERENCES whatsapp_connections(id),
    messages_per_minute INT DEFAULT 30,
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
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true);
`,
        // Version 7 -> 8: Integrations
        7: `
-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    api_key TEXT,
    api_url TEXT,
    is_connected BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_all" ON integrations FOR ALL USING (true);

INSERT INTO integrations (name, provider, settings) VALUES
('Google Calendar', 'google_calendar', '{"scopes":["calendar.events"]}'),
('Google Sheets', 'google_sheets', '{"scopes":["spreadsheets"]}'),
('n8n Webhook', 'n8n', '{}')
ON CONFLICT DO NOTHING;
`,
        // Version 8 -> 9: Tool Executions
        8: `
-- Tool Executions Log
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    agent_id UUID,
    conversation_id UUID,
    input_params JSONB,
    output_result JSONB,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
    error_message TEXT,
    execution_time_ms INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_id);
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool_executions_all" ON tool_executions FOR ALL USING (true);
`,
        // Version 9 -> 10: Triggers
        9: `
-- Automation Triggers
CREATE TABLE IF NOT EXISTS automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event VARCHAR(100) NOT NULL,
    delay_minutes INT DEFAULT 0,
    template JSONB NOT NULL DEFAULT '{"blocks":[]}',
    conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_triggers_all" ON automation_triggers FOR ALL USING (true);
`
    }

    // Build cumulative SQL from currentVersion to CURRENT_MIGRATION_VERSION
    const sqlParts: string[] = []
    for (let v = currentVersion; v < CURRENT_MIGRATION_VERSION; v++) {
        if (migrations[v]) {
            sqlParts.push(migrations[v])
        }
    }

    return sqlParts.length > 0 ? sqlParts.join('\n\n') : null
}

