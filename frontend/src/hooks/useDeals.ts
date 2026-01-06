/**
 * useDeals Hook - CRM Deal Management
 * Handles fetching, creating, moving, and closing deals
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Types
export interface Deal {
    id: string
    contact_id: string | null
    contact_name: string | null
    contact_phone: string | null
    pipeline_id: string | null
    current_stage_id: string
    value: number
    cycle_number: number
    status: 'open' | 'won' | 'lost'
    tags: string[]
    interested_services: string[]
    notes: string | null
    created_at: string
    updated_at: string
    closed_at: string | null
    history?: DealHistoryItem[]
}

export interface DealHistoryItem {
    id: string
    deal_id: string
    from_stage: string | null
    to_stage: string
    duration_in_stage: number | null
    triggered_by: string
    triggered_by_name: string | null
    notes: string | null
    created_at: string
}

interface DealFilters {
    pipeline_id?: string
    stage_id?: string
    status?: string
    contact_id?: string
    limit?: number
    offset?: number
}

interface CreateDealData {
    contact_id: string
    pipeline_id: string
    initial_stage_id: string
    contact_name?: string
    contact_phone?: string
    value?: number
    tags?: string[]
    interested_services?: string[]
    notes?: string
}

interface UpdateDealData {
    value?: number
    tags?: string[]
    interested_services?: string[]
    notes?: string
}

interface MoveDealData {
    target_stage_id: string
    notes?: string
}

interface CloseDealData {
    status: 'won' | 'lost'
    notes?: string
}

// =============================================================================
// FETCH DEALS
// =============================================================================

export function useDeals(filters?: DealFilters) {
    return useQuery({
        queryKey: ['deals', filters],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.pipeline_id) params.append('pipeline_id', filters.pipeline_id)
            if (filters?.stage_id) params.append('stage_id', filters.stage_id)
            if (filters?.status) params.append('status', filters.status)
            if (filters?.contact_id) params.append('contact_id', filters.contact_id)
            if (filters?.limit) params.append('limit', filters.limit.toString())
            if (filters?.offset) params.append('offset', filters.offset.toString())

            const response = await api.get<{ items: Deal[], total: number }>(`/deals?${params.toString()}`)
            return response.data
        },
        refetchInterval: 30000, // Refetch every 30 seconds
        staleTime: 10000,
    })
}

// =============================================================================
// FETCH SINGLE DEAL
// =============================================================================

export function useDeal(dealId: string | null) {
    return useQuery({
        queryKey: ['deal', dealId],
        queryFn: async () => {
            if (!dealId) return null
            const response = await api.get<Deal>(`/deals/${dealId}?include_history=true`)
            return response.data
        },
        enabled: !!dealId,
    })
}

// =============================================================================
// FETCH DEAL HISTORY
// =============================================================================

export function useDealHistory(dealId: string | null) {
    return useQuery({
        queryKey: ['dealHistory', dealId],
        queryFn: async () => {
            if (!dealId) return []
            const response = await api.get<{ items: DealHistoryItem[] }>(`/deals/${dealId}/history`)
            return response.data.items
        },
        enabled: !!dealId,
    })
}

// =============================================================================
// CREATE DEAL
// =============================================================================

export function useCreateDeal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: CreateDealData) => {
            const response = await api.post<Deal>('/deals', data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deals'] })
        },
    })
}

// =============================================================================
// UPDATE DEAL
// =============================================================================

export function useUpdateDeal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ dealId, data }: { dealId: string, data: UpdateDealData }) => {
            const response = await api.patch<Deal>(`/deals/${dealId}`, data)
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['deals'] })
            queryClient.invalidateQueries({ queryKey: ['deal', variables.dealId] })
        },
    })
}

// =============================================================================
// MOVE DEAL (Stage Change)
// =============================================================================

export function useMoveDeal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ dealId, data }: { dealId: string, data: MoveDealData }) => {
            const response = await api.patch<Deal>(`/deals/${dealId}/move`, data)
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['deals'] })
            queryClient.invalidateQueries({ queryKey: ['deal', variables.dealId] })
            queryClient.invalidateQueries({ queryKey: ['dealHistory', variables.dealId] })
        },
    })
}

// =============================================================================
// CLOSE DEAL (Won/Lost)
// =============================================================================

export function useCloseDeal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ dealId, data }: { dealId: string, data: CloseDealData }) => {
            const response = await api.patch<Deal>(`/deals/${dealId}/close`, data)
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['deals'] })
            queryClient.invalidateQueries({ queryKey: ['deal', variables.dealId] })
        },
    })
}

// =============================================================================
// DELETE DEAL
// =============================================================================

export function useDeleteDeal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (dealId: string) => {
            await api.delete(`/deals/${dealId}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deals'] })
        },
    })
}
