/**
 * useContacts - Hook for Contacts CRUD on client database
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useActiveSupabase } from './useClientSupabase'
import { normalizePhone, normalizeEmail, formatCPF, formatCNPJ } from '@/utils/validation'

// =============================================================================
// TYPES
// =============================================================================

export interface Contact {
    id: string
    name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    cpf: string | null
    cnpj: string | null
    type: 'lead' | 'customer' | 'supplier' | 'partner' | 'other'
    status: 'active' | 'inactive' | 'blocked'
    tags: string[]
    source: string | null
    avatar_url: string | null
    notes: string | null
    address_street: string | null
    address_number: string | null
    address_complement: string | null
    address_neighborhood: string | null
    address_city: string | null
    address_state: string | null
    address_zipcode: string | null
    company_name: string | null
    company_role: string | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
    created_by: string | null
    deleted_at: string | null
}

export interface ContactTag {
    id: string
    name: string
    color: string
    description: string | null
    created_at: string
}

export interface CreateContactInput {
    name: string
    email?: string | null
    phone?: string | null
    whatsapp?: string | null
    cpf?: string | null
    cnpj?: string | null
    type?: Contact['type']
    status?: Contact['status']
    tags?: string[]
    source?: string
    notes?: string
    address_street?: string
    address_number?: string
    address_complement?: string
    address_neighborhood?: string
    address_city?: string
    address_state?: string
    address_zipcode?: string
    company_name?: string
    company_role?: string
    metadata?: Record<string, unknown>
}

export interface ContactFilters {
    search?: string
    type?: Contact['type']
    status?: Contact['status']
    tags?: string[]
    source?: string
}

// =============================================================================
// CONTACTS QUERIES
// =============================================================================

export function useContacts(filters?: ContactFilters) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['contacts', tenantId, filters],
        queryFn: async () => {
            let query = supabase
                .from('contacts')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (filters?.type) {
                query = query.eq('type', filters.type)
            }
            if (filters?.status) {
                query = query.eq('status', filters.status)
            }
            if (filters?.source) {
                query = query.eq('source', filters.source)
            }
            if (filters?.tags && filters.tags.length > 0) {
                query = query.overlaps('tags', filters.tags)
            }
            if (filters?.search) {
                query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,whatsapp.ilike.%${filters.search}%`)
            }

            const { data, error } = await query
            if (error) throw error
            return data as Contact[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useContact(id: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['contacts', tenantId, id],
        queryFn: async () => {
            if (!id) return null
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', id)
                .is('deleted_at', null)
                .single()

            if (error) throw error
            return data as Contact
        },
        enabled: !clientLoading && !!id,
    })
}

export function useContactByWhatsApp(whatsapp: string | null) {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['contacts', tenantId, 'whatsapp', whatsapp],
        queryFn: async () => {
            if (!whatsapp) return null
            const normalized = normalizePhone(whatsapp)
            if (!normalized) return null

            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('whatsapp', normalized)
                .is('deleted_at', null)
                .maybeSingle()

            if (error) throw error
            return data as Contact | null
        },
        enabled: !clientLoading && !!whatsapp,
    })
}

// =============================================================================
// CONTACT TAGS
// =============================================================================

export function useContactTags() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['contact-tags', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contact_tags')
                .select('*')
                .order('name')

            if (error) throw error
            return data as ContactTag[]
        },
        enabled: !clientLoading && !!tenantId,
    })
}

export function useCreateContactTag() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: { name: string; color?: string; description?: string }) => {
            const { data, error } = await supabase
                .from('contact_tags')
                .insert(input)
                .select()
                .single()

            if (error) throw error
            return data as ContactTag
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-tags', tenantId] })
        },
    })
}

// =============================================================================
// CONTACTS MUTATIONS
// =============================================================================

export function useCreateContact() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (input: CreateContactInput) => {
            // Normalize fields
            const normalizedData = {
                ...input,
                email: input.email ? normalizeEmail(input.email) : null,
                whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : null,
                cpf: input.cpf ? formatCPF(input.cpf) : null,
                cnpj: input.cnpj ? formatCNPJ(input.cnpj) : null,
                tags: input.tags || [],
                type: input.type || 'lead',
                status: input.status || 'active',
                source: input.source || 'manual',
            }

            const { data, error } = await supabase
                .from('contacts')
                .insert(normalizedData)
                .select()
                .single()

            if (error) throw error
            return data as Contact
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] })
            notifications.show({
                title: 'Contato criado!',
                message: 'O contato foi adicionado com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error creating contact:', error)
            const errMsg = error instanceof Error ? error.message : 'Erro desconhecido'

            // Check for duplicate key errors
            if (errMsg.includes('duplicate key') || errMsg.includes('unique constraint')) {
                if (errMsg.includes('email')) {
                    notifications.show({ title: 'Email duplicado', message: 'Já existe um contato com este email', color: 'red' })
                } else if (errMsg.includes('whatsapp')) {
                    notifications.show({ title: 'WhatsApp duplicado', message: 'Já existe um contato com este WhatsApp', color: 'red' })
                } else {
                    notifications.show({ title: 'Contato duplicado', message: 'Já existe um contato com estas informações', color: 'red' })
                }
            } else {
                notifications.show({ title: 'Erro ao criar contato', message: errMsg, color: 'red' })
            }
        },
    })
}

export function useUpdateContact() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateContactInput>) => {
            const normalizedData: Record<string, unknown> = {
                ...input,
                updated_at: new Date().toISOString(),
            }

            // Normalize specific fields if present
            if (input.email !== undefined) normalizedData.email = input.email ? normalizeEmail(input.email) : null
            if (input.whatsapp !== undefined) normalizedData.whatsapp = input.whatsapp ? normalizePhone(input.whatsapp) : null
            if (input.cpf !== undefined) normalizedData.cpf = input.cpf ? formatCPF(input.cpf) : null
            if (input.cnpj !== undefined) normalizedData.cnpj = input.cnpj ? formatCNPJ(input.cnpj) : null

            const { data, error } = await supabase
                .from('contacts')
                .update(normalizedData)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Contact
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] })
            queryClient.setQueryData(['contacts', tenantId, data.id], data)
            notifications.show({
                title: 'Contato atualizado!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao atualizar contato',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

export function useDeleteContact() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (id: string) => {
            // Soft delete
            const { error } = await supabase
                .from('contacts')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] })
            notifications.show({
                title: 'Contato removido',
                message: 'O contato foi arquivado',
                color: 'yellow',
            })
        },
    })
}

export function useBulkDeleteContacts() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase
                .from('contacts')
                .update({ deleted_at: new Date().toISOString() })
                .in('id', ids)

            if (error) throw error
        },
        onSuccess: (_, ids) => {
            queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] })
            notifications.show({
                title: 'Contatos removidos',
                message: `${ids.length} contato(s) arquivado(s)`,
                color: 'yellow',
            })
        },
    })
}

export function useBulkTagContacts() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ ids, tags, action }: { ids: string[]; tags: string[]; action: 'add' | 'remove' }) => {
            // Get current contacts
            const { data: contacts, error: fetchError } = await supabase
                .from('contacts')
                .select('id, tags')
                .in('id', ids)

            if (fetchError) throw fetchError

            // Update each contact's tags
            const updates = contacts.map(contact => {
                let newTags = [...(contact.tags || [])]
                tags.forEach(tag => {
                    if (action === 'add' && !newTags.includes(tag)) {
                        newTags.push(tag)
                    } else if (action === 'remove') {
                        newTags = newTags.filter(t => t !== tag)
                    }
                })
                return supabase.from('contacts').update({ tags: newTags, updated_at: new Date().toISOString() }).eq('id', contact.id)
            })

            await Promise.all(updates)
        },
        onSuccess: (_, { ids }) => {
            queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] })
            notifications.show({
                title: 'Etiquetas atualizadas',
                message: `${ids.length} contato(s) atualizado(s)`,
                color: 'green',
            })
        },
    })
}

export function useBulkUpdateContacts() {
    const queryClient = useQueryClient()
    const { supabase, tenantId } = useActiveSupabase()

    return useMutation({
        mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<Pick<Contact, 'type' | 'status' | 'source'>> }) => {
            const { error } = await supabase
                .from('contacts')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .in('id', ids)

            if (error) throw error
        },
        onSuccess: (_, { ids }) => {
            queryClient.invalidateQueries({ queryKey: ['contacts', tenantId] })
            notifications.show({
                title: 'Contatos atualizados',
                message: `${ids.length} contato(s) atualizado(s)`,
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            notifications.show({
                title: 'Erro ao atualizar',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red',
            })
        },
    })
}

// =============================================================================
// CONTACTS STATS
// =============================================================================

export function useContactsStats() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['contacts-stats', tenantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contacts')
                .select('id, type, status, source, tags, created_at')
                .is('deleted_at', null)

            if (error) throw error

            const total = data?.length || 0
            const thisMonth = data?.filter(c => {
                const date = new Date(c.created_at)
                const now = new Date()
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
            }).length || 0

            const byType: Record<string, number> = {}
            const byStatus: Record<string, number> = {}
            const bySource: Record<string, number> = {}
            const tagCounts: Record<string, number> = {}

            data?.forEach(c => {
                byType[c.type] = (byType[c.type] || 0) + 1
                byStatus[c.status] = (byStatus[c.status] || 0) + 1
                if (c.source) bySource[c.source] = (bySource[c.source] || 0) + 1
                c.tags?.forEach((tag: string) => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1
                })
            })

            return {
                total,
                newThisMonth: thisMonth,
                byType,
                byStatus,
                bySource,
                tagCounts,
            }
        },
        enabled: !clientLoading && !!tenantId,
    })
}
