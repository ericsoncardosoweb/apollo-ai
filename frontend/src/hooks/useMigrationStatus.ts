/**
 * useMigrationStatus - Hook to check tenant database migration status
 * Used by admin/master users to see which clients need database updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { notifications } from '@mantine/notifications'

// Current expected migration version - increment when adding new migrations
export const CURRENT_MIGRATION_VERSION = 4 // Campaigns + Connections + Contacts

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
        // Version 0 -> 1: Initial CRM tables
        0: `
-- CRM Engine V2 Migration
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
    'Funil de Vendas',
    'Pipeline padrão para gestão de vendas',
    true,
    '[
        {"id": "lead", "name": "Lead", "color": "#868e96", "position": 0, "is_conversion_point": false},
        {"id": "qualificacao", "name": "Qualificação", "color": "#fab005", "position": 1, "is_conversion_point": false},
        {"id": "proposta", "name": "Proposta", "color": "#228be6", "position": 2, "is_conversion_point": false},
        {"id": "negociacao", "name": "Negociação", "color": "#7950f2", "position": 3, "is_conversion_point": false},
        {"id": "fechamento", "name": "Fechamento", "color": "#40c057", "position": 4, "is_conversion_point": true}
    ]'::jsonb
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
    assigned_user_id UUID,
    assigned_user_name VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    interested_services TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline ON crm_deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);

CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    from_stage VARCHAR(100),
    to_stage VARCHAR(100) NOT NULL,
    duration_in_stage INT,
    triggered_by VARCHAR(50) DEFAULT 'user',
    triggered_by_id UUID,
    triggered_by_name VARCHAR(255),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "crm_deals_all" ON crm_deals FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true);
`,
        // Version 1 -> 2: Add automation tables
        1: `
CREATE TABLE IF NOT EXISTS automation_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('manual', 'pipeline_entry', 'pipeline_exit', 'schedule', 'condition', 'webhook')),
    trigger_config JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '[]',
    actions JSONB DEFAULT '[]',
    delay_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID REFERENCES automation_journeys(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    current_action_index INT DEFAULT 0,
    result JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automation_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "automation_journeys_all" ON automation_journeys FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "automation_executions_all" ON automation_executions FOR ALL USING (true);
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
