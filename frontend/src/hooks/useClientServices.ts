/**
 * useClientServices - Hook para Catálogo de Serviços no banco do CLIENTE
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export interface ClientService {
    id: string
    name: string
    type: 'product' | 'service' | 'subscription' | 'bundle'
    price: number
    currency: string
    price_type: string
    description: string | null
    short_description: string | null
    ai_tags: string[]
    features: Record<string, unknown>
    category: string | null
    embedding_status: string
    is_active: boolean
    is_featured: boolean
    created_at: string
    updated_at: string
}

export interface CreateClientServiceInput {
    name: string
    type?: 'product' | 'service' | 'subscription' | 'bundle'
    price?: number
    description?: string
    short_description?: string
    category?: string
    ai_tags?: string[]
    is_active?: boolean
    is_featured?: boolean
}

// =============================================================================
// SERVICES QUERIES (Client DB)
// =============================================================================

export function useClientServices(filters?: { category?: string; isActive?: boolean }) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-services', tenantId, filters],
        queryFn: async () => {
            let query = supabase
                .from('services_catalog')
                .select('*')
                .order('name', { ascending: true })

            if (filters?.isActive !== undefined) {
                query = query.eq('is_active', filters.isActive)
            }

            if (filters?.category) {
                query = query.eq('category', filters.category)
            }

            const { data, error } = await query
            if (error) throw error
            return data as ClientService[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useClientService(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-services', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('services_catalog')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as ClientService
        },
        enabled: !clientLoading && !!id,
    })
}

// =============================================================================
// SERVICES MUTATIONS (Client DB)
// =============================================================================

export function useCreateClientService() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateClientServiceInput) => {
            const { data, error } = await supabase
                .from('services_catalog')
                .insert({
                    ...input,
                    type: input.type || 'service',
                    price: input.price || 0,
                    ai_tags: input.ai_tags || [],
                    is_active: input.is_active ?? true,
                })
                .select()
                .single()

            if (error) throw error
            return data as ClientService
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-services', tenantId] })
            notifications.show({
                title: 'Serviço criado!',
                message: 'O serviço foi adicionado ao catálogo',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao criar serviço',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateClientService() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateClientServiceInput>) => {
            const { data, error } = await supabase
                .from('services_catalog')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as ClientService
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['client-services', tenantId] })
            queryClient.setQueryData(['client-services', tenantId, data.id], data)
            notifications.show({
                title: 'Serviço atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao atualizar serviço',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useDeleteClientService() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('services_catalog')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-services', tenantId] })
            notifications.show({
                title: 'Serviço removido',
                message: 'O serviço foi removido do catálogo',
                color: 'yellow',
            })
        },
    })
}

// =============================================================================
// SERVICES STATS (Client DB)
// =============================================================================

export function useClientServicesStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-services-stats', tenantId],
        queryFn: async () => {
            const { data: services, error } = await supabase
                .from('services_catalog')
                .select('id, type, price, is_active, category')

            if (error) throw error

            const total = services?.length || 0
            const active = services?.filter(s => s.is_active).length || 0
            const featured = services?.filter(s => (s as unknown as { is_featured: boolean }).is_featured).length || 0

            const byType: Record<string, number> = {}
            services?.forEach(s => {
                byType[s.type] = (byType[s.type] || 0) + 1
            })

            const totalPrice = services?.reduce((acc, s) => acc + (s.price || 0), 0) || 0
            const averagePrice = active > 0 ? totalPrice / active : 0

            return {
                total,
                active,
                featured,
                byType,
                averagePrice,
            }
        },
        enabled: !clientLoading && !!tenantId,
    })
}
