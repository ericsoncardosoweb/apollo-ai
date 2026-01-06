/**
 * useClientConversations - Hook para Conversas e Mensagens no banco do CLIENTE
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export interface ClientConversation {
    id: string
    lead_id: string | null
    channel: string
    status: string
    agent_id: string | null
    last_message_at: string | null
    created_at: string
    // Joined
    lead?: {
        id: string
        name: string | null
        phone: string | null
    }
    messages_count?: number
}

export interface ClientMessage {
    id: string
    conversation_id: string
    sender_type: 'user' | 'agent' | 'ai'
    content: string | null
    content_type: string
    metadata: Record<string, unknown>
    created_at: string
}

// =============================================================================
// CONVERSATIONS QUERIES (Client DB)
// =============================================================================

export function useClientConversations(status?: string) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-conversations', tenantId, status],
        queryFn: async () => {
            let query = supabase
                .from('conversations')
                .select(`
                    *,
                    lead:leads(id, name, phone)
                `)
                .order('last_message_at', { ascending: false, nullsFirst: false })

            if (status) {
                query = query.eq('status', status)
            }

            const { data, error } = await query
            if (error) throw error
            return data as ClientConversation[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useClientConversation(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-conversations', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    lead:leads(id, name, phone, email)
                `)
                .eq('id', id)
                .single()

            if (error) throw error
            return data as ClientConversation
        },
        enabled: !clientLoading && !!id,
    })
}

// =============================================================================
// MESSAGES QUERIES (Client DB)
// =============================================================================

export function useClientMessages(conversationId: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-messages', tenantId, conversationId],
        queryFn: async () => {
            if (!conversationId) return []
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as ClientMessage[]
        },
        enabled: !clientLoading && !!conversationId,
    })
}

// =============================================================================
// MESSAGES MUTATIONS (Client DB)
// =============================================================================

export function useSendClientMessage() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({
            conversationId,
            content,
            senderType = 'agent',
        }: {
            conversationId: string
            content: string
            senderType?: 'user' | 'agent' | 'ai'
        }) => {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    content,
                    sender_type: senderType,
                    content_type: 'text',
                })
                .select()
                .single()

            if (error) throw error

            // Update conversation last_message_at
            await supabase
                .from('conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversationId)

            return data as ClientMessage
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['client-messages', tenantId, variables.conversationId] })
            queryClient.invalidateQueries({ queryKey: ['client-conversations', tenantId] })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao enviar mensagem',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

// =============================================================================
// CONVERSATIONS MUTATIONS (Client DB)
// =============================================================================

export function useCreateClientConversation() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ leadId, channel = 'whatsapp' }: { leadId?: string; channel?: string }) => {
            const { data, error } = await supabase
                .from('conversations')
                .insert({
                    lead_id: leadId,
                    channel,
                    status: 'active',
                })
                .select()
                .single()

            if (error) throw error
            return data as ClientConversation
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-conversations', tenantId] })
        },
    })
}

export function useCloseClientConversation() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { error } = await supabase
                .from('conversations')
                .update({ status: 'closed' })
                .eq('id', conversationId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-conversations', tenantId] })
            notifications.show({
                title: 'Conversa encerrada',
                message: 'A conversa foi encerrada',
                color: 'blue',
            })
        },
    })
}

// =============================================================================
// INBOX STATS (Client DB)
// =============================================================================

export function useClientInboxStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['client-inbox-stats', tenantId],
        queryFn: async () => {
            const { data: conversations, error } = await supabase
                .from('conversations')
                .select('id, status, channel')

            if (error) throw error

            const total = conversations?.length || 0
            const active = conversations?.filter(c => c.status === 'active').length || 0
            const pending = conversations?.filter(c => c.status === 'pending').length || 0

            return {
                total,
                active,
                pending,
                closed: total - active - pending,
            }
        },
        enabled: !clientLoading && !!tenantId,
    })
}
