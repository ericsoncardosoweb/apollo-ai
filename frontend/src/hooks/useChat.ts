/**
 * Hook para Chat/Inbox ao vivo
 * Integração com Supabase Realtime + React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'
import { useViewContext } from '@/contexts/ViewContext'

// =============================================================================
// TYPES
// =============================================================================

export interface Conversation {
    id: string
    tenant_id: string
    agent_id: string
    phone_number: string
    chat_id: string
    status: 'active' | 'waiting' | 'resolved' | 'archived'
    mode: 'ai' | 'human' | 'hybrid'
    ai_paused_until?: string
    unread_count: number
    last_message_at?: string
    last_message_preview?: string
    created_at: string
    updated_at: string

    // Joined data
    agent?: { id: string; name: string; color: string }
    lead?: { id: string; name: string; temperature: string }
}

export interface Message {
    id: string
    conversation_id: string
    sender_type: 'customer' | 'ai' | 'human' | 'system'
    sender_name?: string
    content: string
    content_type: 'text' | 'audio' | 'image' | 'video' | 'document'
    media_url?: string
    ai_model?: string
    ai_tokens_input?: number
    ai_tokens_output?: number
    ai_latency_ms?: number
    is_from_me: boolean
    status: 'sent' | 'delivered' | 'read' | 'failed'
    created_at: string
}

export interface SendMessageInput {
    conversationId: string
    content: string
    contentType?: 'text' | 'audio' | 'image' | 'video' | 'document'
    mediaUrl?: string
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Lista conversas do tenant
 */
export function useConversations(filters?: {
    status?: string
    agentId?: string
    search?: string
}) {
    const { selectedCompany } = useViewContext()
    const tenantId = selectedCompany?.id

    return useQuery({
        queryKey: ['conversations', tenantId, filters],
        queryFn: async () => {
            if (!tenantId) return []

            let query = supabase
                .from('conversations')
                .select(`
                    *,
                    agent:agents(id, name, color),
                    lead:crm_leads(id, name, temperature)
                `)
                .eq('tenant_id', tenantId)
                .order('last_message_at', { ascending: false, nullsFirst: false })

            if (filters?.status) {
                query = query.eq('status', filters.status)
            }
            if (filters?.agentId) {
                query = query.eq('agent_id', filters.agentId)
            }
            if (filters?.search) {
                query = query.ilike('phone_number', `%${filters.search}%`)
            }

            const { data, error } = await query

            if (error) throw error
            return data as Conversation[]
        },
        enabled: !!tenantId,
        refetchInterval: 30000, // Refetch every 30s
    })
}

/**
 * Busca uma conversa específica
 */
export function useConversation(conversationId: string | undefined) {
    return useQuery({
        queryKey: ['conversation', conversationId],
        queryFn: async () => {
            if (!conversationId) return null

            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    agent:agents(id, name, color, system_prompt),
                    lead:crm_leads(*)
                `)
                .eq('id', conversationId)
                .single()

            if (error) throw error
            return data as Conversation
        },
        enabled: !!conversationId,
    })
}

/**
 * Busca mensagens de uma conversa
 */
export function useMessages(conversationId: string | undefined) {
    return useQuery({
        queryKey: ['messages', conversationId],
        queryFn: async () => {
            if (!conversationId) return []

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as Message[]
        },
        enabled: !!conversationId,
    })
}

// =============================================================================
// REALTIME SUBSCRIPTION
// =============================================================================

/**
 * Hook para mensagens em tempo real
 */
export function useRealtimeMessages(conversationId: string | undefined) {
    const queryClient = useQueryClient()
    const [isTyping, setIsTyping] = useState(false)
    const [aiDraft, setAiDraft] = useState<string | null>(null)

    useEffect(() => {
        if (!conversationId) return

        // Subscribe to new messages
        const messagesChannel = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    // Add new message to cache
                    queryClient.setQueryData(
                        ['messages', conversationId],
                        (old: Message[] | undefined) => {
                            if (!old) return [payload.new as Message]
                            return [...old, payload.new as Message]
                        }
                    )
                }
            )
            .subscribe()

        // Subscribe to AI typing events (broadcast)
        const typingChannel = supabase
            .channel(`typing:${conversationId}`)
            .on('broadcast', { event: 'ai_typing' }, ({ payload }) => {
                setIsTyping(true)
                setAiDraft(payload.partial_response)
            })
            .on('broadcast', { event: 'ai_sent' }, () => {
                setIsTyping(false)
                setAiDraft(null)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(messagesChannel)
            supabase.removeChannel(typingChannel)
        }
    }, [conversationId, queryClient])

    return { isTyping, aiDraft }
}

/**
 * Hook para novas conversas em tempo real
 */
export function useRealtimeConversations() {
    const { selectedCompany } = useViewContext()
    const queryClient = useQueryClient()
    const tenantId = selectedCompany?.id

    useEffect(() => {
        if (!tenantId) return

        const channel = supabase
            .channel(`conversations:${tenantId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations',
                    filter: `tenant_id=eq.${tenantId}`,
                },
                () => {
                    // Invalidate and refetch
                    queryClient.invalidateQueries({ queryKey: ['conversations', tenantId] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [tenantId, queryClient])
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Envia uma mensagem (humano)
 */
export function useSendMessage() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: SendMessageInput) => {
            // 1. Save message to database
            const { data: message, error: msgError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: input.conversationId,
                    sender_type: 'human',
                    content: input.content,
                    content_type: input.contentType || 'text',
                    media_url: input.mediaUrl,
                    is_from_me: true,
                    status: 'sent',
                })
                .select()
                .single()

            if (msgError) throw msgError

            // 2. Get conversation to find phone and gateway
            const { data: conversation } = await supabase
                .from('conversations')
                .select('phone_number, tenant_id, tenants(whatsapp_gateway, whatsapp_instance_id)')
                .eq('id', input.conversationId)
                .single()

            if (conversation) {
                // 3. Send via WhatsApp API (would call backend)
                await fetch('/api/v1/messages/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: input.conversationId,
                        message_id: message.id,
                        phone: conversation.phone_number,
                        content: input.content,
                        content_type: input.contentType || 'text',
                    }),
                })
            }

            // 4. Update conversation
            await supabase
                .from('conversations')
                .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: input.content.substring(0, 100),
                })
                .eq('id', input.conversationId)

            return message as Message
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] })
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
        },
        onError: (error) => {
            console.error('Error sending message:', error)
            notifications.show({
                title: 'Erro ao enviar mensagem',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Assume o atendimento (muda de AI para humano)
 */
export function useTakeOverConversation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { data, error } = await supabase
                .from('conversations')
                .update({
                    mode: 'human',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, conversationId) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            notifications.show({
                title: 'Atendimento assumido',
                message: 'Você está agora em controle da conversa',
                color: 'green',
            })
        },
    })
}

/**
 * Devolve para a IA
 */
export function useReturnToAI() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { data, error } = await supabase
                .from('conversations')
                .update({
                    mode: 'ai',
                    ai_paused_until: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, conversationId) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            notifications.show({
                title: 'IA reativada',
                message: 'A IA voltou a responder automaticamente',
                color: 'blue',
            })
        },
    })
}

/**
 * Pausa a IA temporariamente
 */
export function usePauseAI() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ conversationId, minutes = 60 }: { conversationId: string; minutes?: number }) => {
            const pauseUntil = new Date(Date.now() + minutes * 60 * 1000)

            const { data, error } = await supabase
                .from('conversations')
                .update({
                    mode: 'human',
                    ai_paused_until: pauseUntil.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] })
            notifications.show({
                title: 'IA pausada',
                message: `A IA foi pausada por ${variables.minutes || 60} minutos`,
                color: 'yellow',
            })
        },
    })
}

/**
 * Resolve/arquiva a conversa
 */
export function useResolveConversation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { data, error } = await supabase
                .from('conversations')
                .update({
                    status: 'resolved',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, conversationId) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            notifications.show({
                title: 'Conversa resolvida',
                message: 'A conversa foi marcada como resolvida',
                color: 'green',
            })
        },
    })
}

/**
 * Marca todas as mensagens como lidas
 */
export function useMarkAsRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { error } = await supabase
                .from('conversations')
                .update({ unread_count: 0 })
                .eq('id', conversationId)

            if (error) throw error
        },
        onSuccess: (_, conversationId) => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
        },
    })
}
