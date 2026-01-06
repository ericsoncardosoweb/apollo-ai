/**
 * useConnections - Hook for WhatsApp Connections, Quick Replies, and Settings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionProvider = 'uazapi' | 'evolution' | 'meta_cloud' | 'baileys'
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'qr_pending' | 'error' | 'banned'

export interface WhatsAppConnection {
    id: string
    name: string
    description: string | null
    provider: ConnectionProvider
    instance_id: string | null
    api_url: string | null
    api_key: string | null
    webhook_url: string | null
    status: ConnectionStatus
    qr_code: string | null
    qr_expires_at: string | null
    phone_number: string | null
    phone_name: string | null
    phone_platform: string | null
    is_default: boolean
    is_active: boolean
    auto_reconnect: boolean
    daily_message_limit: number
    messages_sent_today: number
    last_message_at: string | null
    total_messages_sent: number
    total_messages_received: number
    connected_at: string | null
    disconnected_at: string | null
    created_at: string
    updated_at: string
}

export interface QuickReply {
    id: string
    title: string
    content: string
    shortcut: string | null
    category: string | null
    media_url: string | null
    media_type: string | null
    is_active: boolean
    usage_count: number
    last_used_at: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface TenantSetting {
    id: string
    key: string
    value: unknown
    category: string
    description: string | null
    created_at: string
    updated_at: string
}

export interface CreateConnectionInput {
    name: string
    description?: string
    provider: ConnectionProvider
    instance_id?: string
    api_url?: string
    api_key?: string
    is_default?: boolean
}

export interface CreateQuickReplyInput {
    title: string
    content: string
    shortcut?: string
    category?: string
    media_url?: string
    media_type?: string
}

// =============================================================================
// CONNECTIONS QUERIES
// =============================================================================

export function useWhatsAppConnections() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['whatsapp-connections', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('whatsapp_connections')
                .select('*')
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as WhatsAppConnection[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useWhatsAppConnection(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['whatsapp-connections', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('whatsapp_connections')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as WhatsAppConnection
        },
        enabled: !clientLoading && !!id,
    })
}

export function useDefaultConnection() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['whatsapp-connections', tenantId, 'default'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('whatsapp_connections')
                .select('*')
                .eq('is_default', true)
                .eq('is_active', true)
                .single()

            if (error && error.code !== 'PGRST116') throw error
            return data as WhatsAppConnection | null
        },
        enabled: !clientLoading && !!tenantId,
    })
}

// =============================================================================
// CONNECTIONS MUTATIONS
// =============================================================================

export function useCreateConnection() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateConnectionInput) => {
            // If setting as default, unset other defaults first
            if (input.is_default) {
                await supabase
                    .from('whatsapp_connections')
                    .update({ is_default: false })
                    .eq('is_default', true)
            }

            const { data, error } = await supabase
                .from('whatsapp_connections')
                .insert({
                    ...input,
                    status: 'disconnected',
                })
                .select()
                .single()

            if (error) throw error
            return data as WhatsAppConnection
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', tenantId] })
            notifications.show({
                title: 'Conexão criada!',
                message: 'A conexão WhatsApp foi criada com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao criar conexão',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useUpdateConnection() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateConnectionInput>) => {
            // If setting as default, unset other defaults first
            if (input.is_default) {
                await supabase
                    .from('whatsapp_connections')
                    .update({ is_default: false })
                    .neq('id', id)
                    .eq('is_default', true)
            }

            const { data, error } = await supabase
                .from('whatsapp_connections')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as WhatsAppConnection
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', tenantId] })
            queryClient.setQueryData(['whatsapp-connections', tenantId, data.id], data)
            notifications.show({
                title: 'Conexão atualizada!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
    })
}

export function useDeleteConnection() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('whatsapp_connections')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', tenantId] })
            notifications.show({
                title: 'Conexão removida',
                message: 'A conexão foi excluída',
                color: 'yellow',
            })
        },
    })
}

export function useUpdateConnectionStatus() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, status, qr_code, phone_number, phone_name }: {
            id: string
            status: ConnectionStatus
            qr_code?: string
            phone_number?: string
            phone_name?: string
        }) => {
            const updates: Record<string, unknown> = {
                status,
                updated_at: new Date().toISOString()
            }

            if (status === 'connected') {
                updates.connected_at = new Date().toISOString()
                updates.qr_code = null
                updates.qr_expires_at = null
                if (phone_number) updates.phone_number = phone_number
                if (phone_name) updates.phone_name = phone_name
            } else if (status === 'disconnected') {
                updates.disconnected_at = new Date().toISOString()
            } else if (status === 'qr_pending' && qr_code) {
                updates.qr_code = qr_code
                updates.qr_expires_at = new Date(Date.now() + 60000).toISOString() // 60s expiry
            }

            const { data, error } = await supabase
                .from('whatsapp_connections')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as WhatsAppConnection
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', tenantId] })
            queryClient.setQueryData(['whatsapp-connections', tenantId, data.id], data)
        },
    })
}

// =============================================================================
// QUICK REPLIES QUERIES
// =============================================================================

export function useQuickReplies(category?: string) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['quick-replies', tenantId, category],
        queryFn: async () => {
            let query = supabase
                .from('quick_replies')
                .select('*')
                .eq('is_active', true)
                .order('usage_count', { ascending: false })

            if (category) {
                query = query.eq('category', category)
            }

            const { data, error } = await query
            if (error) throw error
            return data as QuickReply[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

// =============================================================================
// QUICK REPLIES MUTATIONS
// =============================================================================

export function useCreateQuickReply() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateQuickReplyInput) => {
            const { data, error } = await supabase
                .from('quick_replies')
                .insert(input)
                .select()
                .single()

            if (error) throw error
            return data as QuickReply
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] })
            notifications.show({
                title: 'Resposta rápida criada!',
                message: 'A resposta foi adicionada',
                color: 'green',
            })
        },
    })
}

export function useUpdateQuickReply() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateQuickReplyInput>) => {
            const { data, error } = await supabase
                .from('quick_replies')
                .update(input)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as QuickReply
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] })
        },
    })
}

export function useDeleteQuickReply() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('quick_replies')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] })
            notifications.show({
                title: 'Resposta removida',
                message: 'A resposta rápida foi excluída',
                color: 'yellow',
            })
        },
    })
}

export function useIncrementQuickReplyUsage() {
    const { supabase, tenantId } = useActiveSupabase()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.rpc('increment_quick_reply_usage', { reply_id: id })
            if (error) {
                // Fallback: manual increment
                const { data } = await supabase
                    .from('quick_replies')
                    .select('usage_count')
                    .eq('id', id)
                    .single()

                await supabase
                    .from('quick_replies')
                    .update({
                        usage_count: (data?.usage_count || 0) + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('id', id)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] })
        },
    })
}

// =============================================================================
// SETTINGS QUERIES
// =============================================================================

export function useTenantSettings(category?: string) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['tenant-settings', tenantId, category],
        queryFn: async () => {
            let query = supabase
                .from('tenant_settings')
                .select('*')
                .order('key', { ascending: true })

            if (category) {
                query = query.eq('category', category)
            }

            const { data, error } = await query
            if (error) throw error

            // Convert to key-value map
            const settings: Record<string, unknown> = {}
            data?.forEach(s => {
                settings[s.key] = s.value
            })
            return settings
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useTenantSetting(key: string) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['tenant-settings', tenantId, 'key', key],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tenant_settings')
                .select('value')
                .eq('key', key)
                .single()

            if (error && error.code !== 'PGRST116') throw error
            return data?.value
        },
        enabled: !clientLoading && !!tenantId && !!key,
    })
}

// =============================================================================
// SETTINGS MUTATIONS
// =============================================================================

export function useUpdateTenantSetting() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ key, value, category, description }: {
            key: string
            value: unknown
            category?: string
            description?: string
        }) => {
            const { data, error } = await supabase
                .from('tenant_settings')
                .upsert({
                    key,
                    value,
                    category: category || 'general',
                    description,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'key' })
                .select()
                .single()

            if (error) throw error
            return data as TenantSetting
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] })
            notifications.show({
                title: 'Configuração salva!',
                message: '',
                color: 'green',
            })
        },
    })
}

export function useBulkUpdateSettings() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (settings: Array<{ key: string; value: unknown; category?: string }>) => {
            const updates = settings.map(s => ({
                key: s.key,
                value: s.value,
                category: s.category || 'general',
                updated_at: new Date().toISOString(),
            }))

            const { error } = await supabase
                .from('tenant_settings')
                .upsert(updates, { onConflict: 'key' })

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] })
            notifications.show({
                title: 'Configurações salvas!',
                message: 'Todas as alterações foram aplicadas',
                color: 'green',
            })
        },
    })
}
