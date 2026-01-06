/**
 * useDashboardStats - Hook para estatísticas do Dashboard
 * Carrega dados dinâmicos para o dashboard do cliente selecionado
 */

import { useQuery } from '@tanstack/react-query'
import { useActiveSupabase } from './useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'

export interface DashboardStats {
    conversations: number
    conversationsChange: number
    opportunities: number
    opportunitiesChange: number
    contacts: number
    contactsChange: number
    newLeads: number
    newLeadsChange: number
    activeAgents: number
    services: number
}

export interface PipelineData {
    name: string
    count: number
    color: string
}

export interface FunnelData {
    name: string
    value: number
    color: string
}

export interface AgentData {
    name: string
    conversations: number
    score: number
}

/**
 * Hook principal para estatísticas do dashboard
 */
export function useDashboardStats() {
    const { supabase, isLoading: clientLoading, tenantId, isUsingClientDatabase } = useActiveSupabase()
    const { selectedCompany } = useViewContext()

    return useQuery({
        queryKey: ['dashboard-stats', tenantId],
        queryFn: async (): Promise<DashboardStats> => {
            // Buscar leads
            const { data: leads, error: leadsError } = await supabase
                .from('leads')
                .select('id, status, created_at')

            // Buscar conversas
            const { data: conversations, error: convsError } = await supabase
                .from('conversations')
                .select('id, status, created_at')

            // Buscar serviços
            const { data: services, error: servicesError } = await supabase
                .from('services_catalog')
                .select('id, is_active')

            // Calcular stats
            const now = new Date()
            const thisMonth = now.getMonth()
            const thisYear = now.getFullYear()
            const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
            const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

            const isThisMonth = (date: string) => {
                const d = new Date(date)
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear
            }

            const isLastMonth = (date: string) => {
                const d = new Date(date)
                return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
            }

            const calcChange = (current: number, previous: number) => {
                if (previous === 0) return current > 0 ? 100 : 0
                return ((current - previous) / previous) * 100
            }

            // Leads
            const totalLeads = leads?.length || 0
            const leadsThisMonth = leads?.filter(l => isThisMonth(l.created_at)).length || 0
            const leadsLastMonth = leads?.filter(l => isLastMonth(l.created_at)).length || 0
            const qualifiedLeads = leads?.filter(l => l.status === 'qualified').length || 0

            // Conversas
            const totalConvs = conversations?.length || 0
            const convsThisMonth = conversations?.filter(c => isThisMonth(c.created_at)).length || 0
            const convsLastMonth = conversations?.filter(c => isLastMonth(c.created_at)).length || 0

            // Serviços ativos
            const activeServices = services?.filter(s => s.is_active).length || 0

            return {
                conversations: totalConvs,
                conversationsChange: calcChange(convsThisMonth, convsLastMonth),
                opportunities: qualifiedLeads,
                opportunitiesChange: calcChange(leadsThisMonth, leadsLastMonth),
                contacts: totalLeads,
                contactsChange: calcChange(leadsThisMonth, leadsLastMonth),
                newLeads: leadsThisMonth,
                newLeadsChange: calcChange(leadsThisMonth, leadsLastMonth),
                activeAgents: 3, // TODO: buscar agentes ativos do sistema
                services: activeServices,
            }
        },
        enabled: !clientLoading && !!tenantId,
        staleTime: 60 * 1000, // 1 minuto
    })
}

/**
 * Hook para dados do pipeline de vendas
 */
export function usePipelineData() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['pipeline-data', tenantId],
        queryFn: async (): Promise<PipelineData[]> => {
            // Buscar leads agrupados por status
            const { data: leads, error } = await supabase
                .from('leads')
                .select('status')

            if (error) throw error

            const statusCounts: Record<string, number> = {}
            leads?.forEach(l => {
                statusCounts[l.status] = (statusCounts[l.status] || 0) + 1
            })

            const colorMap: Record<string, string> = {
                new: 'blue',
                contacted: 'cyan',
                qualified: 'teal',
                proposal: 'yellow',
                negotiation: 'orange',
                won: 'green',
                lost: 'red',
            }

            const nameMap: Record<string, string> = {
                new: 'Novo Lead',
                contacted: 'Contactado',
                qualified: 'Qualificado',
                proposal: 'Proposta',
                negotiation: 'Negociação',
                won: 'Fechado',
                lost: 'Perdido',
            }

            return Object.entries(statusCounts).map(([status, count]) => ({
                name: nameMap[status] || status,
                count,
                color: colorMap[status] || 'gray',
            }))
        },
        enabled: !clientLoading && !!tenantId,
        staleTime: 60 * 1000,
    })
}

/**
 * Hook para dados do funil de conversão
 */
export function useFunnelData() {
    const { supabase, isLoading: clientLoading, tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['funnel-data', tenantId],
        queryFn: async (): Promise<FunnelData[]> => {
            // Buscar leads por status para montar funil
            const { data: leads, error } = await supabase
                .from('leads')
                .select('status')

            if (error) throw error

            const statusCounts: Record<string, number> = {}
            leads?.forEach(l => {
                statusCounts[l.status] = (statusCounts[l.status] || 0) + 1
            })

            // Calcular funil progressivo
            const totalLeads = leads?.length || 0
            const qualified = statusCounts['qualified'] || 0
            const proposal = statusCounts['proposal'] || 0
            const won = statusCounts['won'] || 0

            return [
                { name: 'Visitantes', value: totalLeads * 3, color: 'gray' }, // Estimado
                { name: 'Leads', value: totalLeads, color: 'blue' },
                { name: 'Oportunidades', value: qualified + proposal + won, color: 'teal' },
                { name: 'Vendas', value: won, color: 'green' },
            ]
        },
        enabled: !clientLoading && !!tenantId,
        staleTime: 60 * 1000,
    })
}

/**
 * Hook para dados de performance de agentes (mock por enquanto)
 */
export function useAgentPerformance() {
    const { tenantId } = useActiveSupabase()

    return useQuery({
        queryKey: ['agent-performance', tenantId],
        queryFn: async (): Promise<AgentData[]> => {
            // TODO: Integrar com tabela de agentes quando existir
            return [
                { name: 'Lia - Atendimento', conversations: 156, score: 92 },
                { name: 'Carlos - Vendas', conversations: 78, score: 87 },
                { name: 'Ana - Suporte', conversations: 45, score: 95 },
            ]
        },
        enabled: !!tenantId,
        staleTime: 5 * 60 * 1000, // 5 minutos
    })
}
