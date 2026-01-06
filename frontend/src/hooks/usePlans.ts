/**
 * Hook para gerenciamento de Plans (Planos de Assinatura)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'

// =============================================================================
// TYPES
// =============================================================================

export interface Plan {
    id: string
    name: string
    slug: string
    description: string | null
    price: number
    billing_period: 'monthly' | 'yearly'
    features: string[]
    max_agents: number
    max_conversations_month: number
    max_messages_month: number
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export interface CreatePlanInput {
    name: string
    slug: string
    description?: string
    price: number
    billing_period?: 'monthly' | 'yearly'
    features?: string[]
    max_agents?: number
    max_conversations_month?: number
    max_messages_month?: number
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {
    id: string
    is_active?: boolean
}

export interface MasterStats {
    active_companies: number
    operators_count: number
    best_seller_plan: string
    mrr: number
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Fetch all plans
 */
export function usePlans() {
    return useQuery({
        queryKey: ['plans'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })

            if (error) throw error
            return data as Plan[]
        },
    })
}

/**
 * Fetch a single plan by ID
 */
export function usePlan(id: string | null) {
    return useQuery({
        queryKey: ['plans', id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Plan
        },
        enabled: !!id,
    })
}

/**
 * Fetch master dashboard stats
 */
export function useMasterStats() {
    return useQuery({
        queryKey: ['master-stats'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_master_stats')

            if (error) {
                console.error('Error fetching master stats:', error)
                // Return default stats if function doesn't exist yet
                return {
                    active_companies: 0,
                    operators_count: 0,
                    best_seller_plan: 'N/A',
                    mrr: 0,
                } as MasterStats
            }
            return data as MasterStats
        },
        refetchInterval: 60000, // Refetch every minute
    })
}

/**
 * Fetch tenants grouped by stage (for Kanban)
 */
export function useTenantsByStage() {
    return useQuery({
        queryKey: ['tenants-by-stage'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_tenants_by_stage')

            if (error) {
                console.error('Error fetching tenants by stage:', error)
                return []
            }
            return data as { stage: string; tenants: any[] }[]
        },
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new plan
 */
export function useCreatePlan() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreatePlanInput) => {
            const { data, error } = await supabase
                .from('plans')
                .insert(input)
                .select()
                .single()

            if (error) throw error
            return data as Plan
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plans'] })
            notifications.show({
                title: 'Plano criado!',
                message: 'O plano foi cadastrado com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error creating plan:', error)
            const message = error instanceof Error ? error.message : 'Erro desconhecido'
            notifications.show({
                title: 'Erro ao criar plano',
                message,
                color: 'red',
            })
        },
    })
}

/**
 * Update a plan
 */
export function useUpdatePlan() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, ...input }: UpdatePlanInput) => {
            const { data, error } = await supabase
                .from('plans')
                .update(input)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Plan
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plans'] })
            notifications.show({
                title: 'Plano atualizado!',
                message: 'O plano foi atualizado com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error updating plan:', error)
            const message = error instanceof Error ? error.message : 'Erro desconhecido'
            notifications.show({
                title: 'Erro ao atualizar plano',
                message,
                color: 'red',
            })
        },
    })
}

/**
 * Delete a plan (soft delete - set is_active to false)
 */
export function useDeletePlan() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('plans')
                .update({ is_active: false })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plans'] })
            notifications.show({
                title: 'Plano removido',
                message: 'O plano foi desativado',
                color: 'yellow',
            })
        },
        onError: (error: unknown) => {
            console.error('Error deleting plan:', error)
            notifications.show({
                title: 'Erro ao remover plano',
                message: 'Não foi possível remover o plano',
                color: 'red',
            })
        },
    })
}
