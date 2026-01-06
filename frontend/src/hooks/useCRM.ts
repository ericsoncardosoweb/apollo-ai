/**
 * Hook para gerenciamento de CRM (Leads + Pipeline)
 * Integração completa com Supabase + React Query
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
    name: string
    phone: string
    email?: string
    description?: string
    source: string
    tags: string[]
    value?: number
    temperature: 'hot' | 'warm' | 'cold'
    score: number
    pipeline_stage_id: string
    assigned_to?: string
    conversation_id?: string
    last_contact_at?: string
    last_ai_update?: string
    ai_notes?: string
    custom_fields?: Record<string, unknown>
    created_at: string
    updated_at: string

    // Joined data
    pipeline_stage?: PipelineStage
}

export interface PipelineStage {
    id: string
    tenant_id: string
    name: string
    position: number
    color: string
    is_won_stage: boolean
    is_lost_stage: boolean
    auto_move_rules: Array<{ from_intent: string; to_stage: string }>
}

export interface KanbanColumn {
    id: string
    name: string
    color: string
    position: number
    leads: Lead[]
    count: number
}

export interface CRMFieldDefinition {
    id: string
    tenant_id: string
    field_name: string
    field_label: string
    field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean'
    field_options?: string[]
    is_required: boolean
    is_ai_writable: boolean
    display_order: number
    placeholder?: string
    default_value?: string
}

export interface ActivityLog {
    id: string
    lead_id: string
    activity_type: string
    description?: string
    old_value?: Record<string, unknown>
    new_value?: Record<string, unknown>
    performed_by: 'ai' | 'user' | 'system'
    user_id?: string
    agent_id?: string
    created_at: string
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Busca stages do pipeline
 */
export function usePipelineStages() {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id

    return useQuery({
        queryKey: ['pipeline-stages', tenantId],
        queryFn: async () => {
            if (!tenantId) return []

            const { data, error } = await supabase
                .from('crm_pipeline_stages')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('position', { ascending: true })

            if (error) throw error
            return data as PipelineStage[]
        },
        enabled: !!tenantId,
    })
}

/**
 * Busca leads organizados por stage (Kanban)
 */
export function useKanbanLeads() {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id

    return useQuery({
        queryKey: ['kanban-leads', tenantId],
        queryFn: async (): Promise<KanbanColumn[]> => {
            if (!tenantId) return []

            // Fetch stages
            const { data: stages, error: stagesError } = await supabase
                .from('crm_pipeline_stages')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('position', { ascending: true })

            if (stagesError) throw stagesError

            // Fetch leads with stage info
            const { data: leads, error: leadsError } = await supabase
                .from('crm_leads')
                .select('*, pipeline_stage:crm_pipeline_stages(*)')
                .eq('tenant_id', tenantId)
                .order('updated_at', { ascending: false })

            if (leadsError) throw leadsError

            // Organize by columns
            const columns: KanbanColumn[] = (stages || []).map((stage) => ({
                id: stage.id,
                name: stage.name,
                color: stage.color,
                position: stage.position,
                leads: (leads || []).filter((lead) => lead.pipeline_stage_id === stage.id),
                count: (leads || []).filter((lead) => lead.pipeline_stage_id === stage.id).length,
            }))

            return columns
        },
        enabled: !!tenantId,
    })
}

/**
 * Busca um lead específico
 */
export function useLead(leadId: string | undefined) {
    return useQuery({
        queryKey: ['lead', leadId],
        queryFn: async () => {
            if (!leadId) return null

            const { data, error } = await supabase
                .from('crm_leads')
                .select('*, pipeline_stage:crm_pipeline_stages(*)')
                .eq('id', leadId)
                .single()

            if (error) throw error
            return data as Lead
        },
        enabled: !!leadId,
    })
}

/**
 * Busca campos customizados do CRM
 */
export function useCRMFields() {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id

    return useQuery({
        queryKey: ['crm-fields', tenantId],
        queryFn: async () => {
            if (!tenantId) return []

            const { data, error } = await supabase
                .from('crm_field_definitions')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('display_order', { ascending: true })

            if (error) throw error
            return data as CRMFieldDefinition[]
        },
        enabled: !!tenantId,
    })
}

/**
 * Busca valores dos campos customizados de um lead
 */
export function useLeadFieldValues(leadId: string | undefined) {
    return useQuery({
        queryKey: ['lead-field-values', leadId],
        queryFn: async () => {
            if (!leadId) return {}

            const { data, error } = await supabase
                .from('crm_lead_field_values')
                .select('*, field:crm_field_definitions(*)')
                .eq('lead_id', leadId)

            if (error) throw error

            // Convert to object
            const values: Record<string, unknown> = {}
            data?.forEach((item) => {
                values[item.field.field_name] = item.value
            })

            return values
        },
        enabled: !!leadId,
    })
}

/**
 * Busca histórico de atividades do lead
 */
export function useLeadActivity(leadId: string | undefined) {
    return useQuery({
        queryKey: ['lead-activity', leadId],
        queryFn: async () => {
            if (!leadId) return []

            const { data, error } = await supabase
                .from('crm_activity_log')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            return data as ActivityLog[]
        },
        enabled: !!leadId,
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Move um lead para outra stage (drag and drop)
 */
export function useMoveLead() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async ({ leadId, toStageId, position }: { leadId: string; toStageId: string; position?: number }) => {
            const { data, error } = await supabase
                .from('crm_leads')
                .update({
                    pipeline_stage_id: toStageId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', leadId)
                .select()
                .single()

            if (error) throw error

            // Log activity
            await supabase.from('crm_activity_log').insert({
                lead_id: leadId,
                tenant_id: selectedCompany?.id,
                activity_type: 'stage_change',
                description: 'Lead movido para nova etapa',
                new_value: { stage_id: toStageId },
                performed_by: 'user',
            })

            return data
        },
        onMutate: async ({ leadId, toStageId }) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ['kanban-leads'] })

            const previousData = queryClient.getQueryData(['kanban-leads'])

            queryClient.setQueryData(['kanban-leads'], (old: KanbanColumn[] | undefined) => {
                if (!old) return old

                // Find and move the lead
                let movedLead: Lead | undefined
                const newColumns = old.map((column) => {
                    const leadIndex = column.leads.findIndex((l) => l.id === leadId)
                    if (leadIndex !== -1) {
                        movedLead = column.leads[leadIndex]
                        return {
                            ...column,
                            leads: column.leads.filter((l) => l.id !== leadId),
                            count: column.count - 1,
                        }
                    }
                    return column
                })

                if (movedLead) {
                    return newColumns.map((column) => {
                        if (column.id === toStageId) {
                            return {
                                ...column,
                                leads: [{ ...movedLead!, pipeline_stage_id: toStageId }, ...column.leads],
                                count: column.count + 1,
                            }
                        }
                        return column
                    })
                }

                return old
            })

            return { previousData }
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(['kanban-leads'], context.previousData)
            }
            notifications.show({
                title: 'Erro ao mover lead',
                message: String(err),
                color: 'red',
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
        },
    })
}

/**
 * Atualiza um lead
 */
export function useUpdateLead() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async ({ leadId, updates }: { leadId: string; updates: Partial<Lead> }) => {
            const { data, error } = await supabase
                .from('crm_leads')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', leadId)
                .select()
                .single()

            if (error) throw error

            // Log activity
            await supabase.from('crm_activity_log').insert({
                lead_id: leadId,
                tenant_id: selectedCompany?.id,
                activity_type: 'field_update',
                new_value: updates,
                performed_by: 'user',
            })

            return data
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
            queryClient.invalidateQueries({ queryKey: ['lead', data.id] })
            notifications.show({
                title: 'Lead atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
    })
}

/**
 * Atualiza campo customizado do lead
 */
export function useUpdateLeadField() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ leadId, fieldId, value }: { leadId: string; fieldId: string; value: string }) => {
            const { data, error } = await supabase
                .from('crm_lead_field_values')
                .upsert({
                    lead_id: leadId,
                    field_id: fieldId,
                    value,
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['lead-field-values', variables.leadId] })
        },
    })
}

/**
 * Cria um novo lead
 */
export function useCreateLead() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async (input: Partial<Lead>) => {
            if (!selectedCompany?.id) throw new Error('Nenhuma empresa selecionada')

            // Get first stage
            const { data: firstStage } = await supabase
                .from('crm_pipeline_stages')
                .select('id')
                .eq('tenant_id', selectedCompany.id)
                .order('position', { ascending: true })
                .limit(1)
                .single()

            const { data, error } = await supabase
                .from('crm_leads')
                .insert({
                    tenant_id: selectedCompany.id,
                    name: input.name || 'Novo Lead',
                    phone: input.phone || '',
                    email: input.email,
                    source: input.source || 'manual',
                    temperature: 'cold',
                    score: 0,
                    pipeline_stage_id: firstStage?.id,
                })
                .select()
                .single()

            if (error) throw error
            return data as Lead
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
            notifications.show({
                title: 'Lead criado!',
                message: 'O lead foi adicionado ao CRM',
                color: 'green',
            })
        },
    })
}

/**
 * Deleta um lead
 */
export function useDeleteLead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (leadId: string) => {
            const { error } = await supabase
                .from('crm_leads')
                .delete()
                .eq('id', leadId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
            notifications.show({
                title: 'Lead removido',
                message: 'O lead foi excluído do CRM',
                color: 'orange',
            })
        },
    })
}

// =============================================================================
// FIELD DEFINITIONS MUTATIONS
// =============================================================================

/**
 * Cria campo customizado
 */
export function useCreateCRMField() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async (input: Partial<CRMFieldDefinition>) => {
            if (!selectedCompany?.id) throw new Error('Nenhuma empresa selecionada')

            const { data, error } = await supabase
                .from('crm_field_definitions')
                .insert({
                    tenant_id: selectedCompany.id,
                    field_name: input.field_name,
                    field_label: input.field_label,
                    field_type: input.field_type || 'text',
                    is_ai_writable: input.is_ai_writable ?? true,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-fields'] })
            notifications.show({
                title: 'Campo criado!',
                message: 'O campo customizado foi adicionado',
                color: 'green',
            })
        },
    })
}
