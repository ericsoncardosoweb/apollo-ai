/**
 * Hook para gerenciamento de Usuários (user_profiles)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'

// =============================================================================
// TYPES
// =============================================================================

export interface UserProfile {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    role: 'master' | 'admin' | 'operator' | 'viewer' | 'client'
    tenant_id: string | null
    tenant_name?: string | null
    is_active: boolean
    last_sign_in_at: string | null
    created_at: string
    updated_at: string
}

export interface CreateUserInput {
    email: string
    name: string
    role: string
    tenant_id?: string
}

export interface UpdateUserInput {
    id: string
    name?: string
    role?: string
    is_active?: boolean
    tenant_id?: string
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Fetch all users (platform users from user_profiles)
 */
export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('user_profiles')
                .select(`
                    *,
                    tenants:tenant_id (name)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Map tenant name
            return (data || []).map((user: any) => ({
                ...user,
                tenant_name: user.tenants?.name || null,
            })) as UserProfile[]
        },
    })
}

/**
 * Fetch platform admins only (master, admin, operator)
 */
export function usePlatformUsers() {
    return useQuery({
        queryKey: ['platform-users'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .in('role', ['master', 'admin', 'operator'])
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as UserProfile[]
        },
    })
}

/**
 * Fetch a single user by ID
 */
export function useUser(id: string | null) {
    return useQuery({
        queryKey: ['users', id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as UserProfile
        },
        enabled: !!id,
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Update a user profile
 */
export function useUpdateUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateUserInput) => {
            const { data, error } = await supabase
                .from('user_profiles')
                .update(input)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as UserProfile
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            queryClient.invalidateQueries({ queryKey: ['platform-users'] })
            notifications.show({
                title: 'Usuário atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error updating user:', error)
            const message = error instanceof Error ? error.message : 'Erro desconhecido'
            notifications.show({
                title: 'Erro ao atualizar usuário',
                message,
                color: 'red',
            })
        },
    })
}

/**
 * Deactivate a user (soft delete)
 */
export function useDeactivateUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('user_profiles')
                .update({ is_active: false })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            notifications.show({
                title: 'Usuário desativado',
                message: 'O usuário foi desativado',
                color: 'yellow',
            })
        },
        onError: (error: unknown) => {
            console.error('Error deactivating user:', error)
            notifications.show({
                title: 'Erro ao desativar usuário',
                message: 'Não foi possível desativar o usuário',
                color: 'red',
            })
        },
    })
}
