/**
 * useClientKnowledge - Hook para Base de Conhecimento no banco do CLIENTE
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export interface ClientDocument {
    id: string
    title: string
    content: string | null
    file_url: string | null
    file_type: string | null
    file_size: number | null
    chunk_count: number
    embedding_status: string
    created_at: string
    updated_at: string
}

export interface CreateClientDocumentInput {
    title: string
    content?: string
    file_url?: string
    file_type?: string
    file_size?: number
}

// =============================================================================
// DOCUMENTS QUERIES (Client DB)
// =============================================================================

export function useClientDocuments() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-documents', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('knowledge_documents')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as ClientDocument[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useClientDocument(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-documents', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('knowledge_documents')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as ClientDocument
        },
        enabled: !clientLoading && !!id,
    })
}

// =============================================================================
// DOCUMENTS MUTATIONS (Client DB)
// =============================================================================

export function useCreateClientDocument() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateClientDocumentInput) => {
            const { data, error } = await supabase
                .from('knowledge_documents')
                .insert({
                    ...input,
                    embedding_status: 'pending',
                })
                .select()
                .single()

            if (error) throw error
            return data as ClientDocument
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-documents', tenantId] })
            notifications.show({
                title: 'Documento criado!',
                message: 'O documento foi adicionado à base de conhecimento',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao criar documento',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateClientDocument() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateClientDocumentInput>) => {
            const { data, error } = await supabase
                .from('knowledge_documents')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as ClientDocument
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['client-documents', tenantId] })
            queryClient.setQueryData(['client-documents', tenantId, data.id], data)
            notifications.show({
                title: 'Documento atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao atualizar documento',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useDeleteClientDocument() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('knowledge_documents')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-documents', tenantId] })
            notifications.show({
                title: 'Documento removido',
                message: 'O documento foi removido da base de conhecimento',
                color: 'yellow',
            })
        },
    })
}

// =============================================================================
// KNOWLEDGE STATS (Client DB)
// =============================================================================

export function useClientKnowledgeStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-knowledge-stats', tenantId],
        queryFn: async () => {
            const { data: docs, error } = await supabase
                .from('knowledge_documents')
                .select('id, embedding_status, chunk_count')

            if (error) throw error

            const total = docs?.length || 0
            const indexed = docs?.filter(d => d.embedding_status === 'completed').length || 0
            const pending = docs?.filter(d => d.embedding_status === 'pending').length || 0
            const totalChunks = docs?.reduce((acc, d) => acc + (d.chunk_count || 0), 0) || 0

            return {
                total,
                indexed,
                pending,
                totalChunks,
            }
        },
        enabled: !clientLoading && !!tenantId,
    })
}
