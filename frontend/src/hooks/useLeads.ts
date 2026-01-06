/**
 * Hook para gerenciamento de Leads/Contatos do CRM
 * Integração com Supabase + React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'
import { useViewContext } from '@/contexts/ViewContext'

// =============================================================================
// TYPES
// =============================================================================

export interface Lead {
    id: string
    tenant_id: string
    pipeline_stage_id: string | null
    name: string | null
    email: string | null
    phone: string | null
    company: string | null
    position: string | null
    description: string | null
    source: string | null
    tags: string[]
    value: number | null
    expected_close_date: string | null
    assigned_to: string | null
    last_ai_update: string | null
    ai_notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    // Joined data
    pipeline_stage?: PipelineStage
}

export interface PipelineStage {
    id: string
    tenant_id: string
    name: string
    color: string
    position: number
    is_won_stage: boolean
    is_lost_stage: boolean
}

export interface CreateLeadInput {
    name: string
    email?: string
    phone?: string
    company?: string
    source?: string
    tags?: string[]
    pipeline_stage_id?: string
}

export interface UpdateLeadInput {
    id: string
    name?: string
    email?: string
    phone?: string
    company?: string
    position?: string
    description?: string
    source?: string
    tags?: string[]
    value?: number
    pipeline_stage_id?: string
    assigned_to?: string
}

// =============================================================================
// PIPELINE STAGES
// =============================================================================

export function usePipelineStages() {
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['pipeline-stages', selectedCompany?.id],
        queryFn: async () => {
            let query = supabase
                .from('crm_pipeline_stages')
                .select('*')
                .order('position', { ascending: true })

            if (selectedCompany?.id) {
                query = query.eq('tenant_id', selectedCompany.id)
            }

            const { data, error } = await query
            if (error) throw error
            return data as PipelineStage[]
        },
    })
}

// =============================================================================
// LEADS QUERIES
// =============================================================================

export function useLeads(stageId?: string) {
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['leads', selectedCompany?.id, stageId],
        queryFn: async () => {
            let query = supabase
                .from('crm_leads')
                .select(`
                    *,
                    pipeline_stage:crm_pipeline_stages(*)
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (selectedCompany?.id) {
                query = query.eq('tenant_id', selectedCompany.id)
            }

            if (stageId) {
                query = query.eq('pipeline_stage_id', stageId)
            }

            const { data, error } = await query
            if (error) throw error
            return data as Lead[]
        },
    })
}

export function useLead(id: string | null) {
    return useQuery({
        queryKey: ['leads', id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('crm_leads')
                .select(`
                    *,
                    pipeline_stage:crm_pipeline_stages(*)
                `)
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Lead
        },
        enabled: !!id,
    })
}

// =============================================================================
// LEADS MUTATIONS
// =============================================================================

export function useCreateLead() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async (input: CreateLeadInput) => {
            const { data, error } = await supabase
                .from('crm_leads')
                .insert({
                    ...input,
                    tenant_id: selectedCompany?.id,
                    tags: input.tags || [],
                })
                .select()
                .single()

            if (error) throw error
            return data as Lead
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] })
            notifications.show({
                title: 'Lead criado!',
                message: 'O lead foi adicionado ao CRM',
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

export function useUpdateLead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateLeadInput) => {
            const { data, error } = await supabase
                .from('crm_leads')
                .update(input)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Lead
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] })
            queryClient.setQueryData(['leads', data.id], data)
            notifications.show({
                title: 'Lead atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error updating lead:', error)
            notifications.show({
                title: 'Erro ao atualizar lead',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useMoveLead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
            const { data, error } = await supabase
                .from('crm_leads')
                .update({ pipeline_stage_id: stageId })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Lead
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] })
        },
    })
}

export function useDeleteLead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('crm_leads')
                .update({ is_active: false })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] })
            notifications.show({
                title: 'Lead removido',
                message: 'O lead foi removido do CRM',
                color: 'yellow',
            })
        },
    })
}

// =============================================================================
// CRM STATS
// =============================================================================

export function useCRMStats() {
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['crm-stats', selectedCompany?.id],
        queryFn: async () => {
            if (!selectedCompany?.id) return null

            // Get leads count by stage
            const { data: leads, error } = await supabase
                .from('crm_leads')
                .select('id, pipeline_stage_id, value, created_at')
                .eq('tenant_id', selectedCompany.id)
                .eq('is_active', true)

            if (error) throw error

            const total = leads?.length || 0
            const totalValue = leads?.reduce((acc, l) => acc + (l.value || 0), 0) || 0
            const thisMonth = leads?.filter(l => {
                const date = new Date(l.created_at)
                const now = new Date()
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
            }).length || 0

            return {
                total,
                totalValue,
                newThisMonth: thisMonth,
            }
        },
        enabled: !!selectedCompany?.id,
    })
}
