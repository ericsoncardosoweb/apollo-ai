/**
 * useTools - Hook for AI Tools and Integrations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export type ToolType = 'function' | 'webhook' | 'integration'
export type ExecutionType = 'internal' | 'webhook' | 'code'
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolParameter {
    type: string
    description: string
    enum?: string[]
    default?: unknown
}

export interface ToolParameters {
    type: 'object'
    properties: Record<string, ToolParameter>
    required: string[]
}

export interface Tool {
    id: string
    name: string
    display_name: string
    description: string
    type: ToolType
    parameters: ToolParameters
    execution_type: ExecutionType
    webhook_url: string | null
    webhook_method: 'GET' | 'POST'
    webhook_headers: Record<string, string>
    code: string | null
    requires_confirmation: boolean
    allowed_agents: string[]
    is_active: boolean
    is_system: boolean
    execution_count: number
    last_executed_at: string | null
    avg_execution_time_ms: number
    error_count: number
    created_at: string
    updated_at: string
}

export interface ToolExecution {
    id: string
    tool_id: string
    agent_id: string | null
    conversation_id: string | null
    input_params: Record<string, unknown>
    output_result: unknown
    status: ExecutionStatus
    error_message: string | null
    execution_time_ms: number
    executed_at: string
}

export interface Integration {
    id: string
    name: string
    provider: string
    access_token: string | null
    refresh_token: string | null
    token_expires_at: string | null
    api_key: string | null
    api_url: string | null
    is_connected: boolean
    last_sync_at: string | null
    error_message: string | null
    settings: Record<string, unknown>
    created_at: string
    updated_at: string
}

export interface CreateToolInput {
    name: string
    display_name: string
    description: string
    type?: ToolType
    parameters?: ToolParameters
    execution_type?: ExecutionType
    webhook_url?: string
    webhook_method?: 'GET' | 'POST'
    webhook_headers?: Record<string, string>
    code?: string
    requires_confirmation?: boolean
    allowed_agents?: string[]
}

// =============================================================================
// TOOLS QUERIES
// =============================================================================

export function useTools(filters?: { type?: ToolType; is_active?: boolean }) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['tools', tenantId, filters],
        queryFn: async () => {
            let query = supabase
                .from('tools')
                .select('*')
                .order('is_system', { ascending: false })
                .order('display_name', { ascending: true })

            if (filters?.type) {
                query = query.eq('type', filters.type)
            }
            if (filters?.is_active !== undefined) {
                query = query.eq('is_active', filters.is_active)
            }

            const { data, error } = await query
            if (error) throw error
            return data as Tool[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useTool(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['tools', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('tools')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Tool
        },
        enabled: !clientLoading && !!id,
    })
}

export function useToolExecutions(toolId: string, limit = 50) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['tool-executions', tenantId, toolId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tool_executions')
                .select('*')
                .eq('tool_id', toolId)
                .order('executed_at', { ascending: false })
                .limit(limit)

            if (error) throw error
            return data as ToolExecution[]
        },
        enabled: !clientLoading && !!tenantId && !!toolId,
    })
}

// =============================================================================
// TOOLS MUTATIONS
// =============================================================================

export function useCreateTool() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateToolInput) => {
            const { data, error } = await supabase
                .from('tools')
                .insert({
                    ...input,
                    parameters: input.parameters || {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                })
                .select()
                .single()

            if (error) throw error
            return data as Tool
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tools', tenantId] })
            notifications.show({
                title: 'Ferramenta criada!',
                message: 'A ferramenta foi adicionada com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao criar ferramenta',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateTool() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateToolInput>) => {
            const { data, error } = await supabase
                .from('tools')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Tool
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tools', tenantId] })
            queryClient.setQueryData(['tools', tenantId, data.id], data)
            notifications.show({
                title: 'Ferramenta atualizada!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
    })
}

export function useDeleteTool() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            // Check if it's a system tool
            const { data: tool } = await supabase
                .from('tools')
                .select('is_system')
                .eq('id', id)
                .single()

            if (tool?.is_system) {
                throw new Error('Ferramentas do sistema não podem ser excluídas')
            }

            const { error } = await supabase
                .from('tools')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tools', tenantId] })
            notifications.show({
                title: 'Ferramenta removida',
                message: 'A ferramenta foi excluída',
                color: 'yellow',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useToggleTool() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { data, error } = await supabase
                .from('tools')
                .update({ is_active, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Tool
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tools', tenantId] })
            notifications.show({
                title: data.is_active ? 'Ferramenta ativada' : 'Ferramenta desativada',
                message: '',
                color: data.is_active ? 'green' : 'orange',
            })
        },
    })
}

export function useExecuteTool() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({
            tool_id,
            params,
            test_mode = true
        }: {
            tool_id: string
            params: Record<string, unknown>
            test_mode?: boolean
        }) => {
            const startTime = Date.now()

            // Log execution
            const { data: execution, error: insertError } = await supabase
                .from('tool_executions')
                .insert({
                    tool_id,
                    input_params: params,
                    status: 'running',
                })
                .select()
                .single()

            if (insertError) throw insertError

            // Simulate execution (in production, this calls actual logic)
            await new Promise(resolve => setTimeout(resolve, 500))

            const executionTime = Date.now() - startTime
            const result = { success: true, test_mode, params }

            // Update execution log
            const { error: updateError } = await supabase
                .from('tool_executions')
                .update({
                    status: 'success',
                    output_result: result,
                    execution_time_ms: executionTime,
                })
                .eq('id', execution.id)

            if (updateError) throw updateError

            // Update tool stats
            await supabase
                .from('tools')
                .update({
                    execution_count: supabase.rpc('increment', { x: 1 }),
                    last_executed_at: new Date().toISOString(),
                })
                .eq('id', tool_id)

            return { execution_id: execution.id, result, execution_time_ms: executionTime }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tools', tenantId] })
            notifications.show({
                title: 'Execução concluída!',
                message: 'A ferramenta foi executada com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro na execução',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

// =============================================================================
// INTEGRATIONS QUERIES
// =============================================================================

export function useIntegrations() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['integrations', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('integrations')
                .select('*')
                .order('name', { ascending: true })

            if (error) throw error
            return data as Integration[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

// =============================================================================
// INTEGRATIONS MUTATIONS
// =============================================================================

export function useConnectIntegration() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({
            id,
            api_key,
            api_url
        }: {
            id: string
            api_key?: string
            api_url?: string
        }) => {
            const { data, error } = await supabase
                .from('integrations')
                .update({
                    api_key,
                    api_url,
                    is_connected: true,
                    last_sync_at: new Date().toISOString(),
                    error_message: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Integration
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['integrations', tenantId] })
            notifications.show({
                title: 'Integração conectada!',
                message: `${data.name} foi conectado com sucesso`,
                color: 'green',
            })
        },
    })
}

export function useDisconnectIntegration() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from('integrations')
                .update({
                    access_token: null,
                    refresh_token: null,
                    api_key: null,
                    is_connected: false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Integration
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['integrations', tenantId] })
            notifications.show({
                title: 'Integração desconectada',
                message: `${data.name} foi desconectado`,
                color: 'yellow',
            })
        },
    })
}

export function useSyncIntegration() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            // Simulate sync
            await new Promise(resolve => setTimeout(resolve, 1000))

            const { data, error } = await supabase
                .from('integrations')
                .update({
                    last_sync_at: new Date().toISOString(),
                    error_message: null,
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Integration
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['integrations', tenantId] })
            notifications.show({
                title: 'Sincronização concluída!',
                message: `${data.name} foi sincronizado`,
                color: 'green',
            })
        },
    })
}
