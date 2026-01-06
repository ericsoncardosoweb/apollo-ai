/**
 * useCampaigns - Hook for WhatsApp Campaigns and Message Templates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export interface MessageTemplate {
    id: string
    name: string
    description: string | null
    category: string
    is_active: boolean
    is_deleted: boolean
    usage_count: number
    last_used_at: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location' | 'interval'

export interface TemplateContent {
    id: string
    template_id: string
    content_type: ContentType
    content: string | null
    media_url: string | null
    media_filename: string | null
    media_mimetype: string | null
    send_as_voice: boolean
    interval_seconds: number | null
    contact_data: Record<string, unknown> | null
    latitude: number | null
    longitude: number | null
    location_name: string | null
    location_address: string | null
    position: number
    created_at: string
    updated_at: string
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
export type TemplateDistribution = 'random' | 'sequential' | 'weighted'

export interface CampaignFilters {
    status?: string[]
    type?: string[]
    tags?: string[]
    exclude_tags?: string[]
    services?: string[]
    custom_conditions?: Array<{
        field: string
        operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'
        value: string
    }>
}

export interface CampaignAction {
    type: 'add_tag' | 'remove_tag' | 'move_to_stage' | 'assign_department' | 'notify_agent' | 'start_flow'
    value?: string
    pipeline_id?: string
    stage_id?: string
    department?: string
    agent_id?: string
    flow_id?: string
}

export interface Campaign {
    id: string
    name: string
    description: string | null
    status: CampaignStatus
    connection_id: string | null
    connection_name: string | null
    scheduled_at: string | null
    schedule_days: number[]
    schedule_start_hour: number
    schedule_end_hour: number
    timezone: string
    max_daily_volume: number
    min_interval_seconds: number
    max_interval_seconds: number
    use_random_intervals: boolean
    batch_size: number
    batch_pause_minutes: number
    contact_filters: CampaignFilters
    template_distribution: TemplateDistribution
    assigned_agent_id: string | null
    assigned_agent_name: string | null
    ai_agent_id: string | null
    ai_agent_name: string | null
    on_delivery_actions: CampaignAction[]
    on_response_actions: CampaignAction[]
    total_contacts: number
    sent_count: number
    delivered_count: number
    read_count: number
    failed_count: number
    response_count: number
    created_by: string | null
    started_at: string | null
    completed_at: string | null
    created_at: string
    updated_at: string
}

export interface CampaignDelivery {
    id: string
    campaign_id: string
    contact_id: string | null
    contact_name: string | null
    contact_phone: string
    template_id: string | null
    status: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
    scheduled_for: string | null
    processed_at: string | null
    external_message_id: string | null
    error_message: string | null
    error_code: string | null
    has_response: boolean
    response_at: string | null
    retry_count: number
    created_at: string
    updated_at: string
}

export interface CreateTemplateInput {
    name: string
    description?: string
    category?: string
}

export interface CreateContentInput {
    template_id: string
    content_type: ContentType
    content?: string
    media_url?: string
    media_filename?: string
    media_mimetype?: string
    send_as_voice?: boolean
    interval_seconds?: number
    contact_data?: Record<string, unknown>
    latitude?: number
    longitude?: number
    location_name?: string
    location_address?: string
    position: number
}

export interface CreateCampaignInput {
    name: string
    description?: string
    connection_id?: string
    connection_name?: string
    scheduled_at?: string
    schedule_days?: number[]
    schedule_start_hour?: number
    schedule_end_hour?: number
    max_daily_volume?: number
    min_interval_seconds?: number
    max_interval_seconds?: number
    use_random_intervals?: boolean
    batch_size?: number
    batch_pause_minutes?: number
    contact_filters?: CampaignFilters
    template_distribution?: TemplateDistribution
    assigned_agent_id?: string
    assigned_agent_name?: string
    ai_agent_id?: string
    ai_agent_name?: string
    on_delivery_actions?: CampaignAction[]
    on_response_actions?: CampaignAction[]
}

// =============================================================================
// MESSAGE TEMPLATES QUERIES
// =============================================================================

export function useMessageTemplates(category?: string) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['message-templates', tenantId, category],
        queryFn: async () => {
            let query = supabase
                .from('message_templates')
                .select('*')
                .eq('is_deleted', false)
                .order('updated_at', { ascending: false })

            if (category) {
                query = query.eq('category', category)
            }

            const { data, error } = await query
            if (error) throw error
            return data as MessageTemplate[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useMessageTemplate(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['message-templates', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('message_templates')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as MessageTemplate
        },
        enabled: !clientLoading && !!id,
    })
}

export function useTemplateContents(templateId: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['template-contents', tenantId, templateId],
        queryFn: async () => {
            if (!templateId) return []
            const { data, error } = await supabase
                .from('template_contents')
                .select('*')
                .eq('template_id', templateId)
                .order('position', { ascending: true })

            if (error) throw error
            return data as TemplateContent[]
        },
        enabled: !clientLoading && !!templateId,
    })
}

// =============================================================================
// MESSAGE TEMPLATES MUTATIONS
// =============================================================================

export function useCreateMessageTemplate() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateTemplateInput) => {
            const { data, error } = await supabase
                .from('message_templates')
                .insert(input)
                .select()
                .single()

            if (error) throw error
            return data as MessageTemplate
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['message-templates', tenantId] })
            notifications.show({
                title: 'Template criado!',
                message: 'O template de mensagem foi criado com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao criar template',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateMessageTemplate() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateTemplateInput>) => {
            const { data, error } = await supabase
                .from('message_templates')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as MessageTemplate
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['message-templates', tenantId] })
            queryClient.setQueryData(['message-templates', tenantId, data.id], data)
            notifications.show({
                title: 'Template atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
    })
}

export function useDeleteMessageTemplate() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            // Soft delete
            const { error } = await supabase
                .from('message_templates')
                .update({ is_deleted: true })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['message-templates', tenantId] })
            notifications.show({
                title: 'Template removido',
                message: 'O template foi arquivado',
                color: 'yellow',
            })
        },
    })
}

// =============================================================================
// TEMPLATE CONTENTS MUTATIONS
// =============================================================================

export function useCreateTemplateContent() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateContentInput) => {
            const { data, error } = await supabase
                .from('template_contents')
                .insert(input)
                .select()
                .single()

            if (error) throw error
            return data as TemplateContent
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['template-contents', tenantId, data.template_id] })
        },
    })
}

export function useUpdateTemplateContent() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateContentInput>) => {
            const { data, error } = await supabase
                .from('template_contents')
                .update(input)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as TemplateContent
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['template-contents', tenantId, data.template_id] })
        },
    })
}

export function useDeleteTemplateContent() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, templateId }: { id: string; templateId: string }) => {
            const { error } = await supabase
                .from('template_contents')
                .delete()
                .eq('id', id)

            if (error) throw error
            return templateId
        },
        onSuccess: (templateId) => {
            queryClient.invalidateQueries({ queryKey: ['template-contents', tenantId, templateId] })
        },
    })
}

export function useReorderTemplateContents() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ templateId, items }: { templateId: string; items: { id: string; position: number }[] }) => {
            // Update each item's position
            const updates = items.map(item =>
                supabase
                    .from('template_contents')
                    .update({ position: item.position })
                    .eq('id', item.id)
            )

            await Promise.all(updates)
            return templateId
        },
        onSuccess: (templateId) => {
            queryClient.invalidateQueries({ queryKey: ['template-contents', tenantId, templateId] })
        },
    })
}

// =============================================================================
// CAMPAIGNS QUERIES
// =============================================================================

export function useCampaigns(status?: CampaignStatus) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['campaigns', tenantId, status],
        queryFn: async () => {
            let query = supabase
                .from('campaigns')
                .select('*')
                .order('created_at', { ascending: false })

            if (status) {
                query = query.eq('status', status)
            }

            const { data, error } = await query
            if (error) throw error
            return data as Campaign[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useCampaign(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['campaigns', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Campaign
        },
        enabled: !clientLoading && !!id,
    })
}

export function useCampaignTemplates(campaignId: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['campaign-templates', tenantId, campaignId],
        queryFn: async () => {
            if (!campaignId) return []
            const { data, error } = await supabase
                .from('campaign_templates')
                .select(`
                    *,
                    template:message_templates(*)
                `)
                .eq('campaign_id', campaignId)
                .order('position', { ascending: true })

            if (error) throw error
            return data
        },
        enabled: !clientLoading && !!campaignId,
    })
}

export function useCampaignDeliveries(campaignId: string | null, status?: CampaignDelivery['status']) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['campaign-deliveries', tenantId, campaignId, status],
        queryFn: async () => {
            if (!campaignId) return []
            let query = supabase
                .from('campaign_deliveries')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false })
                .limit(500)

            if (status) {
                query = query.eq('status', status)
            }

            const { data, error } = await query
            if (error) throw error
            return data as CampaignDelivery[]
        },
        enabled: !clientLoading && !!campaignId,
    })
}

// =============================================================================
// CAMPAIGNS MUTATIONS
// =============================================================================

export function useCreateCampaign() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateCampaignInput) => {
            const { data, error } = await supabase
                .from('campaigns')
                .insert(input)
                .select()
                .single()

            if (error) throw error
            return data as Campaign
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] })
            notifications.show({
                title: 'Campanha criada!',
                message: 'A campanha foi criada como rascunho',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao criar campanha',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateCampaign() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateCampaignInput>) => {
            const { data, error } = await supabase
                .from('campaigns')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Campaign
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] })
            queryClient.setQueryData(['campaigns', tenantId, data.id], data)
            notifications.show({
                title: 'Campanha atualizada!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
    })
}

export function useDeleteCampaign() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] })
            notifications.show({
                title: 'Campanha removida',
                message: 'A campanha foi excluída',
                color: 'yellow',
            })
        },
    })
}

export function useUpdateCampaignStatus() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: CampaignStatus }) => {
            const updates: Record<string, unknown> = {
                status,
                updated_at: new Date().toISOString()
            }

            if (status === 'running') {
                updates.started_at = new Date().toISOString()
            } else if (status === 'completed' || status === 'cancelled') {
                updates.completed_at = new Date().toISOString()
            }

            const { data, error } = await supabase
                .from('campaigns')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Campaign
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] })
            queryClient.setQueryData(['campaigns', tenantId, data.id], data)

            const statusMessages: Record<CampaignStatus, string> = {
                draft: 'Campanha voltou para rascunho',
                scheduled: 'Campanha agendada',
                running: 'Campanha iniciada',
                paused: 'Campanha pausada',
                completed: 'Campanha concluída',
                cancelled: 'Campanha cancelada',
            }

            notifications.show({
                title: statusMessages[data.status],
                message: '',
                color: data.status === 'running' ? 'green' : data.status === 'cancelled' ? 'red' : 'blue',
            })
        },
    })
}

export function useAddCampaignTemplate() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ campaignId, templateId, weight = 1 }: { campaignId: string; templateId: string; weight?: number }) => {
            // Get current count for position
            const { data: existing } = await supabase
                .from('campaign_templates')
                .select('id')
                .eq('campaign_id', campaignId)

            const position = (existing?.length || 0)

            // Check limit (max 5 templates)
            if (position >= 5) {
                throw new Error('Máximo de 5 templates por campanha')
            }

            const { data, error } = await supabase
                .from('campaign_templates')
                .insert({ campaign_id: campaignId, template_id: templateId, weight, position })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, { campaignId }) => {
            queryClient.invalidateQueries({ queryKey: ['campaign-templates', tenantId, campaignId] })
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

export function useRemoveCampaignTemplate() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ campaignId, templateId }: { campaignId: string; templateId: string }) => {
            const { error } = await supabase
                .from('campaign_templates')
                .delete()
                .eq('campaign_id', campaignId)
                .eq('template_id', templateId)

            if (error) throw error
            return campaignId
        },
        onSuccess: (campaignId) => {
            queryClient.invalidateQueries({ queryKey: ['campaign-templates', tenantId, campaignId] })
        },
    })
}

// =============================================================================
// CAMPAIGN STATS
// =============================================================================

export function useCampaignStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['campaign-stats', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('campaigns')
                .select('id, status, total_contacts, sent_count, delivered_count, read_count, failed_count, response_count')

            if (error) throw error

            const stats = {
                totalCampaigns: data?.length || 0,
                byStatus: {} as Record<string, number>,
                totalSent: 0,
                totalDelivered: 0,
                totalRead: 0,
                totalFailed: 0,
                totalResponses: 0,
            }

            data?.forEach(c => {
                stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1
                stats.totalSent += c.sent_count || 0
                stats.totalDelivered += c.delivered_count || 0
                stats.totalRead += c.read_count || 0
                stats.totalFailed += c.failed_count || 0
                stats.totalResponses += c.response_count || 0
            })

            return stats
        },
        enabled: !clientLoading && !!tenantId,
    })
}
