/**
 * Hook para gerenciamento do Catálogo de Serviços
 * Integração com Supabase + RAG/Embeddings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'
import { useViewContext } from '@/contexts/ViewContext'

// =============================================================================
// TYPES
// =============================================================================

export type ServiceType = 'product' | 'service' | 'subscription' | 'bundle'
export type EmbeddingStatus = 'pending' | 'processing' | 'indexed' | 'failed'

export interface ServiceCatalogItem {
    id: string
    tenant_id: string
    name: string
    type: ServiceType
    price: number
    currency: string
    price_type: 'fixed' | 'hourly' | 'monthly' | 'yearly' | 'custom'
    description: string | null
    short_description: string | null
    ai_tags: string[]
    features: Record<string, string>
    category: string | null
    embedding_status: EmbeddingStatus
    embedding_string: string | null
    last_indexed_at: string | null
    is_active: boolean
    is_featured: boolean
    created_at: string
    updated_at: string
}

export interface CreateServiceInput {
    name: string
    type: ServiceType
    price: number
    currency?: string
    price_type?: string
    description?: string
    short_description?: string
    ai_tags?: string[]
    features?: Record<string, string>
    category?: string
    is_featured?: boolean
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
    id: string
    is_active?: boolean
}

// =============================================================================
// QUERIES
// =============================================================================

export function useServicesCatalog() {
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['services-catalog', selectedCompany?.id],
        queryFn: async () => {
            let query = supabase
                .from('services_catalog')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (selectedCompany?.id) {
                query = query.eq('tenant_id', selectedCompany.id)
            }

            const { data, error } = await query
            if (error) throw error
            return data as ServiceCatalogItem[]
        },
    })
}

export function useService(id: string | null) {
    return useQuery({
        queryKey: ['services-catalog', id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('services_catalog')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as ServiceCatalogItem
        },
        enabled: !!id,
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

export function useCreateService() {
    const queryClient = useQueryClient()
    const { selectedCompany } = useViewContext()

    return useMutation({
        mutationFn: async (input: CreateServiceInput) => {
            const { data, error } = await supabase
                .from('services_catalog')
                .insert({
                    ...input,
                    tenant_id: selectedCompany?.id,
                    ai_tags: input.ai_tags || [],
                    features: input.features || {},
                    embedding_status: 'pending',
                })
                .select()
                .single()

            if (error) throw error
            return data as ServiceCatalogItem
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services-catalog'] })
            notifications.show({
                title: 'Serviço criado!',
                message: 'O serviço foi adicionado ao catálogo e será indexado para IA',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error creating service:', error)
            notifications.show({
                title: 'Erro ao criar serviço',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateService() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateServiceInput) => {
            const { data, error } = await supabase
                .from('services_catalog')
                .update({
                    ...input,
                    embedding_status: 'pending', // Re-index on update
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as ServiceCatalogItem
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['services-catalog'] })
            queryClient.setQueryData(['services-catalog', data.id], data)
            notifications.show({
                title: 'Serviço atualizado!',
                message: 'O serviço será reindexado para IA',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error updating service:', error)
            notifications.show({
                title: 'Erro ao atualizar serviço',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useDeleteService() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('services_catalog')
                .update({ is_active: false })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services-catalog'] })
            notifications.show({
                title: 'Serviço removido',
                message: 'O serviço foi removido do catálogo',
                color: 'yellow',
            })
        },
    })
}

// =============================================================================
// INDEXING SIMULATION (em produção seria chamada de Edge Function)
// =============================================================================

export function useIndexService() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            // Simula o processo de indexação
            // Em produção, isso chamaria uma Edge Function que:
            // 1. Busca o embedding_string do serviço
            // 2. Chama OpenAI Embeddings API
            // 3. Salva o vetor na tabela de vetores

            await supabase
                .from('services_catalog')
                .update({ embedding_status: 'processing' })
                .eq('id', id)

            // Simular delay de processamento
            await new Promise(resolve => setTimeout(resolve, 1500))

            const { data, error } = await supabase
                .from('services_catalog')
                .update({
                    embedding_status: 'indexed',
                    last_indexed_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as ServiceCatalogItem
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services-catalog'] })
            notifications.show({
                title: 'Indexação concluída!',
                message: 'O serviço está pronto para uso pela IA',
                color: 'green',
            })
        },
    })
}

// =============================================================================
// CATALOG STATS
// =============================================================================

export function useCatalogStats() {
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['services-catalog-stats', selectedCompany?.id],
        queryFn: async () => {
            if (!selectedCompany?.id) return null

            const { data, error } = await supabase
                .from('services_catalog')
                .select('id, type, price, embedding_status, is_active')
                .eq('tenant_id', selectedCompany.id)
                .eq('is_active', true)

            if (error) throw error

            const items = data || []
            return {
                total: items.length,
                products: items.filter(i => i.type === 'product').length,
                services: items.filter(i => i.type === 'service').length,
                subscriptions: items.filter(i => i.type === 'subscription').length,
                indexed: items.filter(i => i.embedding_status === 'indexed').length,
                pending: items.filter(i => i.embedding_status === 'pending').length,
                totalValue: items.reduce((acc, i) => acc + (i.price || 0), 0),
            }
        },
        enabled: !!selectedCompany?.id,
    })
}
