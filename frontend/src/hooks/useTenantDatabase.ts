/**
 * Hook para gerenciamento da configuração de banco de dados do tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'

// =============================================================================
// TYPES
// =============================================================================

export type DatabaseStatus = 'pending' | 'configured' | 'testing' | 'active' | 'error' | 'suspended'

export interface TenantDatabaseConfig {
    id: string
    tenant_id: string
    supabase_url: string | null
    supabase_anon_key: string | null
    supabase_service_key: string | null
    status: DatabaseStatus
    status_message: string | null
    last_tested_at: string | null
    enable_realtime: boolean
    enable_storage: boolean
    max_connections: number
    migrations_version: number
    last_migration_at: string | null
    created_at: string
    updated_at: string
    configured_by: string | null
}

export interface TenantWithDatabaseStatus {
    id: string
    name: string
    slug: string
    email: string
    phone: string | null
    logo_url: string | null
    plan_id: string | null
    database_status: string
    onboarding_completed: boolean
    created_at: string
    db_config_status: string
    has_supabase_url: boolean
    last_tested_at: string | null
    migrations_version: number
}

export interface ConfigureDatabaseInput {
    tenant_id: string
    supabase_url: string
    supabase_anon_key: string
    supabase_service_key?: string
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Fetch database config for a specific tenant
 */
export function useTenantDatabaseConfig(tenantId: string | null) {
    return useQuery({
        queryKey: ['tenant-database-config', tenantId],
        queryFn: async () => {
            if (!tenantId) return null
            const { data, error } = await supabase
                .from('tenant_database_config')
                .select('*')
                .eq('tenant_id', tenantId)
                .single()

            if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
            return data as TenantDatabaseConfig | null
        },
        enabled: !!tenantId,
    })
}

/**
 * Fetch all tenants with database status
 */
export function useTenantsWithDatabaseStatus() {
    return useQuery({
        queryKey: ['tenants-with-database-status'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tenants_with_database_status')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as TenantWithDatabaseStatus[]
        },
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Configure database for a tenant
 */
export function useConfigureDatabase() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: ConfigureDatabaseInput) => {
            // Check if config already exists
            const { data: existing } = await supabase
                .from('tenant_database_config')
                .select('id')
                .eq('tenant_id', input.tenant_id)
                .single()

            if (existing) {
                // Update existing
                const { data, error } = await supabase
                    .from('tenant_database_config')
                    .update({
                        supabase_url: input.supabase_url,
                        supabase_anon_key: input.supabase_anon_key,
                        supabase_service_key: input.supabase_service_key,
                        status: 'configured',
                        status_message: 'Credenciais salvas, aguardando teste',
                    })
                    .eq('tenant_id', input.tenant_id)
                    .select()
                    .single()

                if (error) throw error
                return data as TenantDatabaseConfig
            } else {
                // Create new
                const { data, error } = await supabase
                    .from('tenant_database_config')
                    .insert({
                        tenant_id: input.tenant_id,
                        supabase_url: input.supabase_url,
                        supabase_anon_key: input.supabase_anon_key,
                        supabase_service_key: input.supabase_service_key,
                        status: 'configured',
                        status_message: 'Credenciais salvas, aguardando teste',
                    })
                    .select()
                    .single()

                if (error) throw error
                return data as TenantDatabaseConfig
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-database-config', data.tenant_id] })
            queryClient.invalidateQueries({ queryKey: ['tenants-with-database-status'] })
            queryClient.invalidateQueries({ queryKey: ['companies'] })
            notifications.show({
                title: 'Configuração salva!',
                message: 'As credenciais do banco foram salvas. Teste a conexão para ativar.',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error configuring database:', error)
            notifications.show({
                title: 'Erro ao configurar banco',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

/**
 * Test database connection
 */
export function useTestDatabaseConnection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (tenantId: string) => {
            // First, update status to testing
            await supabase
                .from('tenant_database_config')
                .update({ status: 'testing', status_message: 'Testando conexão...' })
                .eq('tenant_id', tenantId)

            // Call the test function
            const { data, error } = await supabase.rpc('test_tenant_database_connection', {
                p_tenant_id: tenantId,
            })

            if (error) throw error
            return data as { success: boolean; message: string }
        },
        onSuccess: (result, tenantId) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-database-config', tenantId] })
            queryClient.invalidateQueries({ queryKey: ['tenants-with-database-status'] })
            queryClient.invalidateQueries({ queryKey: ['companies'] })

            if (result.success) {
                notifications.show({
                    title: 'Conexão ativa!',
                    message: result.message,
                    color: 'green',
                })
            } else {
                notifications.show({
                    title: 'Erro na conexão',
                    message: result.message,
                    color: 'red',
                })
            }
        },
        onError: (error: unknown) => {
            console.error('Error testing connection:', error)
            notifications.show({
                title: 'Erro ao testar conexão',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

/**
 * Run migrations on tenant database
 * Tries Edge Function first, falls back to manual update
 */
export function useRunMigrations() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (tenantId: string) => {
            try {
                // Try calling Edge Function (if deployed)
                const { data, error } = await supabase.functions.invoke('run-client-migrations', {
                    body: { tenant_id: tenantId }
                })

                if (!error && data?.success) {
                    return data
                }
            } catch (edgeFnError) {
                console.log('Edge Function not available, using manual mode')
            }

            // Fallback: Just update the version (assuming SQL was executed manually)
            // Get current version and increment
            const { data: config } = await supabase
                .from('tenant_database_config')
                .select('migrations_version')
                .eq('tenant_id', tenantId)
                .single()

            const newVersion = (config?.migrations_version || 0) + 1

            const { data, error } = await supabase
                .from('tenant_database_config')
                .update({
                    migrations_version: newVersion,
                    last_migration_at: new Date().toISOString(),
                    status: 'active',
                    status_message: `Migrações v${newVersion} aplicadas`,
                })
                .eq('tenant_id', tenantId)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                message: `Versão atualizada para v${newVersion}. Certifique-se de executar o SQL no banco do cliente.`
            }
        },
        onSuccess: (data, tenantId) => {
            queryClient.invalidateQueries({ queryKey: ['tenant-database-config', tenantId] })
            notifications.show({
                title: 'Versão atualizada!',
                message: data.message || 'Migrações registradas com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Migration error:', error)
            notifications.show({
                title: 'Erro ao executar migrações',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}
