/**
 * Hook para gerenciamento de Companies/Tenants
 * Integração completa com Supabase + React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifications } from '@mantine/notifications'
import { useAuth } from '@/contexts/AuthContext'

// =============================================================================
// TYPES
// =============================================================================

export interface Company {
    id: string
    name: string
    slug: string
    plan: 'starter' | 'pro' | 'enterprise'
    status: 'active' | 'inactive' | 'suspended'
    whatsapp?: string
    whatsapp_gateway?: 'evolution' | 'zapi' | 'uazapi' | 'meta'
    whatsapp_instance_id?: string
    logo_url?: string
    primary_color?: string
    settings: Record<string, unknown>
    agents_count: number
    leads_count: number
    messages_count: number
    created_at: string
    updated_at: string
}

export interface CreateCompanyInput {
    name: string
    slug?: string
    plan?: 'starter' | 'pro' | 'enterprise'
    whatsapp?: string
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
    id: string
    status?: 'active' | 'inactive' | 'suspended'
}

export interface CompanyStats {
    totalAgents: number
    activeAgents: number
    totalLeads: number
    totalConversations: number
    totalMessages: number
    tokensUsedThisMonth: number
    estimatedCostUsd: number
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Lista todas as empresas (apenas para admin/master)
 */
export function useCompanies() {
    const { isPlatformAdmin } = useAuth()

    return useQuery({
        queryKey: ['companies'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching companies:', error)
                throw error
            }

            return data as Company[]
        },
        enabled: isPlatformAdmin,
    })
}

/**
 * Busca uma empresa específica
 */
export function useCompany(companyId: string | undefined) {
    return useQuery({
        queryKey: ['company', companyId],
        queryFn: async () => {
            if (!companyId) return null

            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', companyId)
                .single()

            if (error) {
                console.error('Error fetching company:', error)
                throw error
            }

            return data as Company
        },
        enabled: !!companyId,
    })
}

/**
 * Busca estatísticas da empresa
 */
export function useCompanyStats(companyId: string | undefined) {
    return useQuery({
        queryKey: ['company-stats', companyId],
        queryFn: async (): Promise<CompanyStats | null> => {
            if (!companyId) return null

            // Agents count
            const { count: totalAgents } = await supabase
                .from('agents')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', companyId)

            const { count: activeAgents } = await supabase
                .from('agents')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', companyId)
                .eq('is_active', true)

            // Leads count
            const { count: totalLeads } = await supabase
                .from('crm_leads')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', companyId)

            // Conversations count
            const { count: totalConversations } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', companyId)

            // Messages count (this month)
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            const { count: totalMessages } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', companyId)
                .gte('created_at', startOfMonth.toISOString())

            // Token usage this month
            const { data: tokenUsage } = await supabase
                .from('token_usage')
                .select('total_tokens, estimated_cost_usd')
                .eq('tenant_id', companyId)
                .gte('period_start', startOfMonth.toISOString())

            const tokensUsedThisMonth = tokenUsage?.reduce((acc, row) => acc + (row.total_tokens || 0), 0) || 0
            const estimatedCostUsd = tokenUsage?.reduce((acc, row) => acc + parseFloat(row.estimated_cost_usd || '0'), 0) || 0

            return {
                totalAgents: totalAgents || 0,
                activeAgents: activeAgents || 0,
                totalLeads: totalLeads || 0,
                totalConversations: totalConversations || 0,
                totalMessages: totalMessages || 0,
                tokensUsedThisMonth,
                estimatedCostUsd,
            }
        },
        enabled: !!companyId,
    })
}

/**
 * Busca empresas para o seletor (com busca)
 */
export function useCompanySearch(searchQuery: string) {
    const { isPlatformAdmin } = useAuth()

    return useQuery({
        queryKey: ['companies-search', searchQuery],
        queryFn: async () => {
            let query = supabase
                .from('tenants')
                .select('id, name, slug, plan, status, logo_url')
                .eq('status', 'active')
                .order('name', { ascending: true })
                .limit(20)

            if (searchQuery) {
                query = query.ilike('name', `%${searchQuery}%`)
            }

            const { data, error } = await query

            if (error) throw error
            return data as Pick<Company, 'id' | 'name' | 'slug' | 'plan' | 'status' | 'logo_url'>[]
        },
        enabled: isPlatformAdmin,
    })
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Cria uma nova empresa
 */
export function useCreateCompany() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreateCompanyInput) => {
            // Get current user email for the tenant
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) {
                throw new Error('Usuário não autenticado')
            }

            const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

            const { data, error } = await supabase
                .from('tenants')
                .insert({
                    name: input.name,
                    slug,
                    email: user.email,
                    status: 'active',
                })
                .select()
                .single()

            if (error) throw error

            return data as Company
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies'] })
            notifications.show({
                title: 'Empresa criada!',
                message: 'A empresa foi cadastrada com sucesso',
                color: 'green',
            })
        },
        onError: (error: unknown) => {
            console.error('Error creating company:', error)
            const message = error instanceof Error
                ? error.message
                : (error as { message?: string })?.message || 'Erro desconhecido'
            notifications.show({
                title: 'Erro ao criar empresa',
                message,
                color: 'red',
            })
        },
    })
}

/**
 * Atualiza uma empresa
 */
export function useUpdateCompany() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: UpdateCompanyInput) => {
            const { id, ...updates } = input

            const { data, error } = await supabase
                .from('tenants')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data as Company
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['companies'] })
            queryClient.invalidateQueries({ queryKey: ['company', data.id] })
            notifications.show({
                title: 'Empresa atualizada!',
                message: 'As alterações foram salvas',
                color: 'green',
            })
        },
        onError: (error) => {
            console.error('Error updating company:', error)
            notifications.show({
                title: 'Erro ao atualizar empresa',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Deleta uma empresa (soft delete - muda status)
 */
export function useDeleteCompany() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (companyId: string) => {
            const { error } = await supabase
                .from('tenants')
                .update({ status: 'inactive' })
                .eq('id', companyId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies'] })
            notifications.show({
                title: 'Empresa removida',
                message: 'A empresa foi desativada',
                color: 'orange',
            })
        },
        onError: (error) => {
            console.error('Error deleting company:', error)
            notifications.show({
                title: 'Erro ao remover empresa',
                message: String(error),
                color: 'red',
            })
        },
    })
}

/**
 * Configura WhatsApp da empresa
 */
export function useConfigureWhatsApp() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            companyId,
            gateway,
            instanceId,
            apiKey,
        }: {
            companyId: string
            gateway: 'evolution' | 'zapi' | 'uazapi' | 'meta'
            instanceId: string
            apiKey?: string
        }) => {
            const { data, error } = await supabase
                .from('tenants')
                .update({
                    whatsapp_gateway: gateway,
                    whatsapp_instance_id: instanceId,
                    // API Key would be stored securely, perhaps in a separate table or vault
                    updated_at: new Date().toISOString(),
                })
                .eq('id', companyId)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['company', variables.companyId] })
            notifications.show({
                title: 'WhatsApp configurado!',
                message: 'A integração foi salva',
                color: 'green',
            })
        },
    })
}
