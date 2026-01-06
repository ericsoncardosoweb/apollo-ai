/**
 * Hook para gerenciamento de Agentes de IA
 * Integração completa com Supabase + React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'
import { useViewContext } from '@/contexts/ViewContext'

// =============================================================================
// TYPES
// =============================================================================

export interface Agent {
    id: string
    tenant_id: string
    name: string
    description?: string
    color: string
    system_prompt: string
    model_name: string
    temperature: number
    max_tokens: number
    memory_window: number
    memory_enabled: boolean
    rag_enabled: boolean
    intent_router_enabled: boolean
    reengagement_enabled: boolean
    reengagement_delay_minutes: number
    reengagement_max_attempts: number
    reengagement_prompts: string[]
    fallback_message: string
    business_hours: {
        enabled: boolean
        start: number
        end: number
    }
    parent_agent_id?: string
    agent_type: 'standalone' | 'orchestrator' | 'sub_agent'
    is_active: boolean
    total_conversations: number
    total_messages: number
    avg_response_time_ms: number
    last_active_at?: string
    created_at: string
    updated_at: string
}

export interface CreateAgentInput {
    name: string
    description?: string
    color?: string
    system_prompt: string
    model_name?: string
    temperature?: number
    max_tokens?: number
    rag_enabled?: boolean
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
    id: string
}

export interface TestPromptInput {
    agentId: string
    testMessage: string
    expectedResponse?: string
}

export interface TestPromptResult {
    success: boolean
    response: string
    tokensUsed: { input: number; output: number }
    latencyMs: number
    similarityScore?: number
    toolsCalled?: Array<{ name: string; params: Record<string, unknown>; success: boolean }>
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Lista todos os agentes do tenant selecionado
 */
export function useAgents() {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id

    return useQuery({
        queryKey: ['agents', tenantId],
        queryFn: async () => {
            if (!tenantId) return []

            const { data, error } = await supabase
                .from('agents')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching agents:', error)
                throw error
            }

            return data as Agent[]
        },
        enabled: !!tenantId,
    })
}

/**
 * Busca um agente específico por ID
 */
export function useAgent(agentId: string | undefined) {
    return useQuery({
        queryKey: ['agent', agentId],
        queryFn: async () => {
            if (!agentId) return null

            const { data, error } = await supabase
                .from('agents')
                .select('*')
                .eq('id', agentId)
                .single()

            if (error) {
                console.error('Error fetching agent:', error)
                throw error
            }

            return data as Agent
        },
        enabled: !!agentId,
    })
}

/**
 * Busca estatísticas do agente
 */
export function useAgentStats(agentId: string | undefined) {
    return useQuery({
        queryKey: ['agent-stats', agentId],
        queryFn: async () => {
            if (!agentId) return null

            // Get conversation count
            const { count: conversationCount } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agentId)

            // Get message count
            const { count: messageCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', agentId) // Needs proper join

            // Get test runs
            const { data: testRuns } = await supabase
                .from('agent_test_runs')
                .select('*')
                .eq('agent_id', agentId)
                .order('created_at', { ascending: false })
                .limit(10)

            return {
                totalConversations: conversationCount || 0,
                totalMessages: messageCount || 0,
                recentTestRuns: testRuns || [],
            }
        },
        enabled: !!agentId,
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Cria um novo agente
 */
export function useCreateAgent() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async (input: CreateAgentInput) => {
            if (!selectedCompany?.id) {
                throw new Error('Nenhuma empresa selecionada')
            }

            const { data, error } = await supabase
                .from('agents')
                .insert({
                    tenant_id: selectedCompany.id,
                    name: input.name,
                    description: input.description,
                    color: input.color || 'blue',
                    system_prompt: input.system_prompt,
                    model_name: input.model_name || 'gpt-4o-mini',
                    temperature: input.temperature || 0.7,
                    max_tokens: input.max_tokens || 500,
                    is_active: true,
                })
                .select()
                .single()

            if (error) throw error
            return data as Agent
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] })
            notifications.show({
                title: 'Agente criado!',
                message: 'O agente foi criado com sucesso',
                color: 'green',
            })
        },
        onError: (error) => {
            console.error('Error creating agent:', error)
            notifications.show({
                title: 'Erro ao criar agente',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Atualiza um agente existente
 */
export function useUpdateAgent() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: UpdateAgentInput) => {
            const { id, ...updates } = input

            const { data, error } = await supabase
                .from('agents')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Agent
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['agents'] })
            queryClient.invalidateQueries({ queryKey: ['agent', data.id] })
            notifications.show({
                title: 'Agente atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error) => {
            console.error('Error updating agent:', error)
            notifications.show({
                title: 'Erro ao atualizar agente',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Deleta um agente (soft delete)
 */
export function useDeleteAgent() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (agentId: string) => {
            const { error } = await supabase
                .from('agents')
                .update({ is_active: false })
                .eq('id', agentId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] })
            notifications.show({
                title: 'Agente removido!',
                message: 'O agente foi desativado',
                color: 'orange',
            })
        },
        onError: (error) => {
            console.error('Error deleting agent:', error)
            notifications.show({
                title: 'Erro ao remover agente',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Duplica um agente
 */
export function useDuplicateAgent() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (agentId: string) => {
            // Fetch original agent
            const { data: original, error: fetchError } = await supabase
                .from('agents')
                .select('*')
                .eq('id', agentId)
                .single()

            if (fetchError) throw fetchError

            // Create copy
            const { id, created_at, updated_at, total_conversations, total_messages, ...copyData } = original

            const { data, error } = await supabase
                .from('agents')
                .insert({
                    ...copyData,
                    name: `${original.name} (Cópia)`,
                    total_conversations: 0,
                    total_messages: 0,
                })
                .select()
                .single()

            if (error) throw error
            return data as Agent
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] })
            notifications.show({
                title: 'Agente duplicado!',
                message: 'Uma cópia do agente foi criada',
                color: 'green',
            })
        },
        onError: (error) => {
            console.error('Error duplicating agent:', error)
            notifications.show({
                title: 'Erro ao duplicar agente',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Testa o prompt do agente
 */
export function useTestPrompt() {
    return useMutation({
        mutationFn: async (input: TestPromptInput): Promise<TestPromptResult> => {
            // Call backend API to test prompt
            const response = await fetch(`/api/v1/agents/${input.agentId}/test-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test_message: input.testMessage,
                    expected_response: input.expectedResponse,
                }),
            })

            if (!response.ok) {
                throw new Error('Erro ao testar prompt')
            }

            return response.json()
        },
        onError: (error) => {
            console.error('Error testing prompt:', error)
            notifications.show({
                title: 'Erro no teste',
                message: String(error),
                color: 'red',
            })
        },
    })
}

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

export interface PromptTemplate {
    id: string
    name: string
    description?: string
    category: string
    system_prompt: string
    variables: string[]
    is_global: boolean
    tenant_id?: string
    usage_count: number
    created_at: string
}

/**
 * Lista templates de prompt (globais + do tenant)
 */
export function usePromptTemplates() {
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['prompt-templates', selectedCompany?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('prompt_templates')
                .select('*')
                .or(`is_global.eq.true,tenant_id.eq.${selectedCompany?.id || ''}`)
                .order('usage_count', { ascending: false })

            if (error) throw error
            return data as PromptTemplate[]
        },
    })
}

/**
 * Cria um novo template de prompt
 */
export function useCreatePromptTemplate() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async (input: Partial<PromptTemplate>) => {
            const { data, error } = await supabase
                .from('prompt_templates')
                .insert({
                    ...input,
                    tenant_id: selectedCompany?.id,
                    is_global: false,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
            notifications.show({
                title: 'Template salvo!',
                message: 'O template foi salvo com sucesso',
                color: 'green',
            })
        },
    })
}
