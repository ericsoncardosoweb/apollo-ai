/**
 * useAutomations Hook - CRM Automation Journey Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Types
export interface ConditionRule {
    field: string
    operator: string
    value: string | number | null
}

export interface ActionConfig {
    type: string
    payload: Record<string, unknown>
}

export interface AutomationJourney {
    id: string
    name: string
    description: string | null
    trigger_type: 'manual' | 'pipeline_entry' | 'pipeline_exit' | 'schedule' | 'condition'
    trigger_config: Record<string, unknown>
    conditions: ConditionRule[]
    actions: ActionConfig[]
    delay_config: Record<string, unknown>
    is_active: boolean
    execution_count: number
    last_executed_at: string | null
    created_at: string
    updated_at: string
    recent_executions?: AutomationExecution[]
}

export interface AutomationExecution {
    id: string
    journey_id: string
    deal_id: string | null
    contact_id: string | null
    scheduled_at: string
    executed_at: string | null
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    result: Record<string, unknown>
    error_message: string | null
    created_at: string
}

interface AutomationFilters {
    trigger_type?: string
    is_active?: boolean
}

interface CreateAutomationData {
    name: string
    description?: string
    trigger_type: string
    trigger_config?: Record<string, unknown>
    conditions?: ConditionRule[]
    actions: ActionConfig[]
    delay_config?: Record<string, unknown>
    is_active?: boolean
}

interface UpdateAutomationData {
    name?: string
    description?: string
    trigger_config?: Record<string, unknown>
    conditions?: ConditionRule[]
    actions?: ActionConfig[]
    delay_config?: Record<string, unknown>
    is_active?: boolean
}

// =============================================================================
// FETCH AUTOMATIONS
// =============================================================================

export function useAutomations(filters?: AutomationFilters) {
    return useQuery({
        queryKey: ['automations', filters],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.trigger_type) params.append('trigger_type', filters.trigger_type)
            if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString())

            const response = await api.get<{ items: AutomationJourney[] }>(`/automations?${params.toString()}`)
            return response.data.items
        },
        staleTime: 30000,
    })
}

// =============================================================================
// FETCH SINGLE AUTOMATION
// =============================================================================

export function useAutomation(automationId: string | null) {
    return useQuery({
        queryKey: ['automation', automationId],
        queryFn: async () => {
            if (!automationId) return null
            const response = await api.get<AutomationJourney>(`/automations/${automationId}`)
            return response.data
        },
        enabled: !!automationId,
    })
}

// =============================================================================
// FETCH AUTOMATION EXECUTIONS
// =============================================================================

export function useAutomationExecutions(automationId: string | null, status?: string) {
    return useQuery({
        queryKey: ['automationExecutions', automationId, status],
        queryFn: async () => {
            if (!automationId) return []
            const params = new URLSearchParams()
            if (status) params.append('status', status)

            const response = await api.get<{ items: AutomationExecution[] }>(
                `/automations/${automationId}/executions?${params.toString()}`
            )
            return response.data.items
        },
        enabled: !!automationId,
    })
}

// =============================================================================
// CREATE AUTOMATION
// =============================================================================

export function useCreateAutomation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: CreateAutomationData) => {
            const response = await api.post<AutomationJourney>('/automations', data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automations'] })
        },
    })
}

// =============================================================================
// UPDATE AUTOMATION
// =============================================================================

export function useUpdateAutomation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ automationId, data }: { automationId: string, data: UpdateAutomationData }) => {
            const response = await api.patch<AutomationJourney>(`/automations/${automationId}`, data)
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations'] })
            queryClient.invalidateQueries({ queryKey: ['automation', variables.automationId] })
        },
    })
}

// =============================================================================
// TRIGGER AUTOMATION (Manual)
// =============================================================================

export function useTriggerAutomation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ automationId, dealId, contactId }: {
            automationId: string
            dealId?: string
            contactId?: string
        }) => {
            const response = await api.post<{ success: boolean, execution: AutomationExecution }>(
                `/automations/${automationId}/execute`,
                { deal_id: dealId, contact_id: contactId }
            )
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automation', variables.automationId] })
            queryClient.invalidateQueries({ queryKey: ['automationExecutions', variables.automationId] })
        },
    })
}

// =============================================================================
// DELETE AUTOMATION
// =============================================================================

export function useDeleteAutomation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (automationId: string) => {
            await api.delete(`/automations/${automationId}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automations'] })
        },
    })
}
