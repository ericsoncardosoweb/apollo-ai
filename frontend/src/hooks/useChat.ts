/**
 * useChat - Hook for Conversations and Messages on client database
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export interface Conversation {
    id: string
    contact_id: string | null
    contact_name: string | null
    contact_phone: string | null
    channel: 'whatsapp' | 'telegram' | 'instagram' | 'webchat' | 'email' | 'sms'
    external_id: string | null
    status: 'waiting' | 'ai' | 'attending' | 'resolved' | 'archived'
    mode: 'ai' | 'human' | 'bot' | 'hybrid'
    assigned_to: string | null
    assigned_name: string | null
    ai_agent_id: string | null
    ai_agent_name: string | null
    unread_count: number
    message_count: number
    last_message_at: string
    last_message_preview: string | null
    last_message_direction: 'in' | 'out' | null
    pipeline_stage: string | null
    deal_id: string | null
    proposal_value: number | null
    tags: string[]
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
    resolved_at: string | null
    deleted_at: string | null
}

export interface ChatMessage {
    id: string
    conversation_id: string
    direction: 'in' | 'out'
    sender_type: 'contact' | 'ai' | 'human' | 'system' | 'bot'
    sender_id: string | null
    sender_name: string | null
    content_type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'location' | 'contacts' | 'sticker' | 'system'
    content: string | null
    media_url: string | null
    media_mime_type: string | null
    media_filename: string | null
    media_duration: number | null
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    error_message: string | null
    external_id: string | null
    ai_response_metadata: Record<string, unknown> | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
}

export interface QuickReply {
    id: string
    title: string
    content: string
    shortcut: string | null
    category: string | null
    is_active: boolean
    usage_count: number
    created_at: string
}

export interface ConversationFilters {
    status?: Conversation['status']
    channel?: Conversation['channel']
    assignedTo?: string
    search?: string
}

// =============================================================================
// CONVERSATIONS QUERIES
// =============================================================================

export function useChatConversations(filters?: ConversationFilters) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['chat-conversations', tenantId, filters],
        queryFn: async () => {
            let query = supabase
                .from('conversations')
                .select('*')
                .is('deleted_at', null)
                .order('last_message_at', { ascending: false })

            if (filters?.status) {
                query = query.eq('status', filters.status)
            }
            if (filters?.channel) {
                query = query.eq('channel', filters.channel)
            }
            if (filters?.assignedTo) {
                query = query.eq('assigned_to', filters.assignedTo)
            }
            if (filters?.search) {
                query = query.or(`contact_name.ilike.%${filters.search}%,contact_phone.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`)
            }

            const { data, error } = await query
            if (error) throw error
            return data as Conversation[]
        },
        enabled: !clientLoading && !!tenantId,
        refetchInterval: 10000, // Refetch every 10 seconds
    })
}

export function useChatConversation(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['chat-conversations', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Conversation
        },
        enabled: !clientLoading && !!id,
    })
}

// =============================================================================
// MESSAGES QUERIES
// =============================================================================

export function useChatMessages(conversationId: string | null, limit: number = 50) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['chat-messages', tenantId, conversationId, limit],
        queryFn: async () => {
            if (!conversationId) return []
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(limit)

            if (error) throw error
            return data as ChatMessage[]
        },
        enabled: !clientLoading && !!conversationId,
        refetchInterval: 5000, // Refetch every 5 seconds for real-time feel
    })
}

// =============================================================================
// REAL-TIME SUBSCRIPTION
// =============================================================================

export function useRealtimeChatMessages(conversationId: string | null) {
    const { supabase, tenantId } = useActiveSupabase()
    const queryClient = useQueryClient()
    const [isSubscribed, setIsSubscribed] = useState(false)

    useEffect(() => {
        if (!supabase || !conversationId) return

        const channel = supabase
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
                        ['chat-messages', tenantId, conversationId, 50],
                        (old: ChatMessage[] | undefined) => {
                            if (!old) return [payload.new as ChatMessage]
                            return [...old, payload.new as ChatMessage]
                        }
                    )
                }
            )
            .subscribe((status) => {
                setIsSubscribed(status === 'SUBSCRIBED')
            })

        return () => {
            channel.unsubscribe()
        }
    }, [supabase, conversationId, tenantId, queryClient])

    return { isSubscribed }
}

export function useRealtimeChatConversations() {
    const { supabase, tenantId } = useActiveSupabase()
    const queryClient = useQueryClient()
    const [isSubscribed, setIsSubscribed] = useState(false)

    useEffect(() => {
        if (!supabase) return

        const channel = supabase
            .channel('conversations:all')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations',
                },
                () => {
                    // Invalidate conversations query to refetch
                    queryClient.invalidateQueries({ queryKey: ['chat-conversations', tenantId] })
                }
            )
            .subscribe((status) => {
                setIsSubscribed(status === 'SUBSCRIBED')
            })

        return () => {
            channel.unsubscribe()
        }
    }, [supabase, tenantId, queryClient])

    return { isSubscribed }
}

// =============================================================================
// QUICK REPLIES
// =============================================================================

export function useChatQuickReplies() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['chat-quick-replies', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('quick_replies')
                .select('*')
                .eq('is_active', true)
                .order('usage_count', { ascending: false })

            if (error) throw error
            return data as QuickReply[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

export function useSendChatMessage() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({
            conversationId,
            content,
            contentType = 'text',
            senderType = 'human',
            senderName,
        }: {
            conversationId: string
            content: string
            contentType?: ChatMessage['content_type']
            senderType?: ChatMessage['sender_type']
            senderName?: string
        }) => {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    direction: 'out',
                    sender_type: senderType,
                    sender_name: senderName,
                    content_type: contentType,
                    content,
                    status: 'sent',
                })
                .select()
                .single()

            if (error) throw error
            return data as ChatMessage
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['chat-messages', tenantId, data.conversation_id] })
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', tenantId] })
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

export function useUpdateChatConversationStatus() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({
            id,
            status,
            mode,
            assignedTo,
            assignedName,
        }: {
            id: string
            status?: Conversation['status']
            mode?: Conversation['mode']
            assignedTo?: string
            assignedName?: string
        }) => {
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
            if (status) updates.status = status
            if (mode) updates.mode = mode
            if (assignedTo !== undefined) updates.assigned_to = assignedTo
            if (assignedName !== undefined) updates.assigned_name = assignedName
            if (status === 'resolved') updates.resolved_at = new Date().toISOString()

            const { data, error } = await supabase
                .from('conversations')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Conversation
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', tenantId] })
            queryClient.setQueryData(['chat-conversations', tenantId, data.id], data)
        },
    })
}

export function useMarkChatAsRead() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { error } = await supabase
                .from('conversations')
                .update({ unread_count: 0, updated_at: new Date().toISOString() })
                .eq('id', conversationId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', tenantId] })
        },
    })
}

export function useTakeChatOver() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({
            conversationId,
            userId,
            userName,
        }: {
            conversationId: string
            userId: string
            userName: string
        }) => {
            const { data, error } = await supabase
                .from('conversations')
                .update({
                    mode: 'human',
                    status: 'attending',
                    assigned_to: userId,
                    assigned_name: userName,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (error) throw error

            // Add system message
            await supabase.from('messages').insert({
                conversation_id: conversationId,
                direction: 'out',
                sender_type: 'system',
                content_type: 'system',
                content: `Atendimento assumido por ${userName}`,
                status: 'sent',
            })

            return data as Conversation
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', tenantId] })
            queryClient.invalidateQueries({ queryKey: ['chat-messages', tenantId, data.id] })
            notifications.show({
                title: 'Atendimento assumido',
                message: 'Você agora está atendendo esta conversa',
                color: 'green',
            })
        },
    })
}

export function useResolveChatConversation() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const { data, error } = await supabase
                .from('conversations')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (error) throw error
            return data as Conversation
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', tenantId] })
            notifications.show({
                title: 'Conversa resolvida',
                message: 'A conversa foi marcada como resolvida',
                color: 'green',
            })
        },
    })
}

// =============================================================================
// CONVERSATION STATS
// =============================================================================

export function useChatStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['chat-stats', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('conversations')
                .select('id, status, mode, channel, unread_count, created_at')
                .is('deleted_at', null)

            if (error) throw error

            const total = data?.length || 0
            const unread = data?.filter(c => c.unread_count > 0).length || 0
            const today = data?.filter(c => {
                const date = new Date(c.created_at)
                const now = new Date()
                return date.toDateString() === now.toDateString()
            }).length || 0

            const byStatus: Record<string, number> = {}
            const byChannel: Record<string, number> = {}

            data?.forEach(c => {
                byStatus[c.status] = (byStatus[c.status] || 0) + 1
                byChannel[c.channel] = (byChannel[c.channel] || 0) + 1
            })

            return {
                total,
                unread,
                newToday: today,
                byStatus,
                byChannel,
            }
        },
        enabled: !clientLoading && !!tenantId,
    })
}
