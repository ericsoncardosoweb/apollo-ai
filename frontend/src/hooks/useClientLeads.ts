/**
 * useClientLeads - Hook para Leads no banco do CLIENTE
 * 
 * Conecta ao Supabase do cliente ativo e gerencia leads.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export interface ClientLead {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    source: string | null
    status: string
    score: number
    tags: string[]
    custom_fields: Record<string, unknown>
    created_at: string
    updated_at: string
}

export interface ClientPipelineStage {
    id: string
    name: string
    color: string | null
    position: number
    is_won: boolean
    is_lost: boolean
    created_at: string
}

export interface CreateClientLeadInput {
    name: string
    phone?: string
    email?: string
    source?: string
    status?: string
    tags?: string[]
}

// =============================================================================
// PIPELINE STAGES (Client DB)
// =============================================================================

export function useClientPipelineStages() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-pipeline-stages', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pipeline_stages')
                .select('*')
                .order('position', { ascending: true })

            if (error) throw error
            return data as ClientPipelineStage[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

// =============================================================================
// LEADS QUERIES (Client DB)
// =============================================================================

export function useClientLeads(status?: string) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-leads', tenantId, status],
        queryFn: async () => {
            let query = supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })

            if (status) {
                query = query.eq('status', status)
            }

            const { data, error } = await query
            if (error) throw error
            return data as ClientLead[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useClientLead(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-leads', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as ClientLead
        },
        enabled: !clientLoading && !!id,
    })
}

// =============================================================================
// LEADS MUTATIONS (Client DB)
// =============================================================================

export function useCreateClientLead() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateClientLeadInput) => {
            const { data, error } = await supabase
                .from('leads')
                .insert({
                    ...input,
                    tags: input.tags || [],
                    status: input.status || 'new',
                })
                .select()
                .single()

            if (error) throw error
            return data as ClientLead
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-leads', tenantId] })
            notifications.show({
                title: 'Lead criado!',
                message: 'O lead foi adicionado no banco do cliente',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error creating lead:', error)
            notifications.show({
                title: 'Erro ao criar lead',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateClientLead() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateClientLeadInput>) => {
            const { data, error } = await supabase
                .from('leads')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as ClientLead
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['client-leads', tenantId] })
            queryClient.setQueryData(['client-leads', tenantId, data.id], data)
            notifications.show({
                title: 'Lead atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao atualizar lead',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useDeleteClientLead() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('leads')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-leads', tenantId] })
            notifications.show({
                title: 'Lead removido',
                message: 'O lead foi removido',
                color: 'yellow',
            })
        },
    })
}

// =============================================================================
// LEADS STATS (Client DB)
// =============================================================================

export function useClientLeadsStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-leads-stats', tenantId],
        queryFn: async () => {
            const { data: leads, error } = await supabase
                .from('leads')
                .select('id, status, score, created_at')

            if (error) throw error

            const total = leads?.length || 0
            const thisMonth = leads?.filter(l => {
                const date = new Date(l.created_at)
                const now = new Date()
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
            }).length || 0

            const byStatus: Record<string, number> = {}
            leads?.forEach(l => {
                byStatus[l.status] = (byStatus[l.status] || 0) + 1
            })

            return {
                total,
                newThisMonth: thisMonth,
                byStatus,
            }
        },
        enabled: !clientLoading && !!tenantId,
    })
}
