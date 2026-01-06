/**
 * useClientSupabase - Hook para conexão dinâmica ao Supabase do cliente
 * 
 * Conecta ao banco de dados do cliente ativo baseado no selectedCompany do ViewContext.
 * Usado pelos hooks de dados (leads, conversas, serviços) para operações no banco do cliente.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useViewContext } from '@/contexts/ViewContext'
import { supabase } from '@/lib/supabase'

interface ClientSupabaseResult {
    clientSupabase: SupabaseClient | null
    isReady: boolean
    isLoading: boolean
    error: Error | null
    tenantId: string | null
}

interface TenantDatabaseConfig {
    supabase_url: string
    supabase_anon_key: string
    supabase_service_key: string | null
    status: string
    migrations_version: number
}

// Cache de clientes Supabase para evitar recriação
const clientCache = new Map<string, SupabaseClient>()

/**
 * Hook principal para obter cliente Supabase do tenant ativo
 */
export function useClientSupabase(): ClientSupabaseResult {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id || null

    // Buscar configuração do banco do cliente
    const { data: config, isLoading, error } = useQuery({
        queryKey: ['client-database-config', tenantId],
        queryFn: async () => {
            if (!tenantId) return null

            const { data, error } = await supabase
                .from('tenant_database_config')
                .select('supabase_url, supabase_anon_key, supabase_service_key, status, migrations_version')
                .eq('tenant_id', tenantId)
                .single()

            if (error) {
                // Se não encontrar config, ainda não foi configurado
                if (error.code === 'PGRST116') return null
                throw error
            }

            return data as TenantDatabaseConfig
        },
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos
    })

    // Criar/reutilizar cliente Supabase do cache
    const clientSupabase = useMemo(() => {
        if (!config?.supabase_url || !config?.supabase_anon_key) {
            return null
        }

        // Verificar cache
        const cacheKey = `${config.supabase_url}:${config.supabase_anon_key}`
        if (clientCache.has(cacheKey)) {
            return clientCache.get(cacheKey)!
        }

        // Criar novo cliente
        const client = createClient(config.supabase_url, config.supabase_anon_key)
        clientCache.set(cacheKey, client)

        return client
    }, [config?.supabase_url, config?.supabase_anon_key])

    const isReady = !!(clientSupabase && config?.status === 'active' && config?.migrations_version > 0)

    return {
        clientSupabase,
        isReady,
        isLoading,
        error: error as Error | null,
        tenantId,
    }
}

/**
 * Hook que retorna o cliente Supabase apropriado:
 * - Se há empresa selecionada com banco configurado: retorna cliente do cliente
 * - Se não: retorna cliente master (para admins gerenciarem dados de demonstração)
 */
export function useActiveSupabase() {
    const { clientSupabase, isReady, isLoading, tenantId } = useClientSupabase()

    // Se cliente está pronto, usa ele; senão usa master
    const activeClient = isReady && clientSupabase ? clientSupabase : supabase
    const isUsingClientDatabase = isReady && !!clientSupabase

    return {
        supabase: activeClient,
        isLoading,
        isUsingClientDatabase,
        tenantId,
    }
}

/**
 * Hook para verificar se o banco do cliente está configurado
 */
export function useClientDatabaseStatus() {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id || null

    const { data, isLoading } = useQuery({
        queryKey: ['client-database-status', tenantId],
        queryFn: async () => {
            if (!tenantId) return null

            const { data, error } = await supabase
                .from('tenant_database_config')
                .select('status, migrations_version, last_tested_at')
                .eq('tenant_id', tenantId)
                .single()

            if (error) return null
            return data
        },
        enabled: !!tenantId,
        staleTime: 60 * 1000, // 1 minuto
    })

    return {
        isConfigured: !!data?.migrations_version && data.migrations_version > 0,
        status: data?.status || 'not_configured',
        migrationsVersion: data?.migrations_version || 0,
        isLoading,
    }
}
