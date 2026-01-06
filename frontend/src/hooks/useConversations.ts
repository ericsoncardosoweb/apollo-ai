/**
 * Conversations Hook - Fetches real conversations from backend
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Conversation } from '@/types';

interface ConversationsFilters {
    agentId?: string;
    status?: 'active' | 'waiting' | 'closed';
    mode?: 'ai' | 'human' | 'hybrid';
    search?: string;
}

interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
}

// ===========================================
// FETCH CONVERSATIONS
// ===========================================

export function useConversations(filters?: ConversationsFilters) {
    return useQuery({
        queryKey: ['conversations', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.agentId) params.append('agent_id', filters.agentId);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.mode) params.append('mode', filters.mode);
            if (filters?.search) params.append('search', filters.search);

            const response = await api.get<PaginatedResponse<Conversation>>(
                `/conversations?${params.toString()}`
            );
            return response.data;
        },
        refetchInterval: 10000, // Refetch every 10 seconds
        staleTime: 5000,
    });
}

// ===========================================
// FETCH SINGLE CONVERSATION WITH MESSAGES
// ===========================================

export function useConversation(conversationId: string | null) {
    return useQuery({
        queryKey: ['conversation', conversationId],
        queryFn: async () => {
            if (!conversationId) return null;
            const response = await api.get<Conversation>(`/conversations/${conversationId}`);
            return response.data;
        },
        enabled: !!conversationId,
    });
}

// ===========================================
// FETCH MESSAGES FOR A CONVERSATION
// ===========================================

export interface Message {
    id: string;
    conversation_id: string;
    sender_type: 'client' | 'ai' | 'human';
    content: string;
    content_type: 'text' | 'audio' | 'image' | 'document';
    created_at: string;
    metadata?: Record<string, unknown>;
}

export function useMessages(conversationId: string | null) {
    return useQuery({
        queryKey: ['messages', conversationId],
        queryFn: async () => {
            if (!conversationId) return [];
            const response = await api.get<Message[]>(`/messages?conversation_id=${conversationId}`);
            return response.data;
        },
        enabled: !!conversationId,
        refetchInterval: 5000, // Refetch messages every 5 seconds
    });
}

// ===========================================
// UPDATE CONVERSATION MODE (Panic Button)
// ===========================================

interface UpdateModePayload {
    conversationId: string;
    mode: 'ai' | 'human' | 'hybrid';
}

export function useUpdateConversationMode() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, mode }: UpdateModePayload) => {
            const response = await api.patch(`/conversations/${conversationId}`, { mode });
            return response.data;
        },
        onSuccess: (_, variables) => {
            // Invalidate conversation queries to refresh
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
        },
    });
}

// ===========================================
// SEND MESSAGE (Manual Message)
// ===========================================

interface SendMessagePayload {
    conversationId: string;
    content: string;
    contentType?: 'text' | 'audio' | 'image';
}

export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, content, contentType = 'text' }: SendMessagePayload) => {
            const response = await api.post(`/messages`, {
                conversation_id: conversationId,
                content,
                content_type: contentType,
                sender_type: 'human', // Manual message
            });
            return response.data;
        },
        onSuccess: (_, variables) => {
            // Refetch messages for this conversation
            queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });
}
