/**
 * Admin Dashboard - High Density Operational View
 * Refatorado para usar componentes reutilizáveis e dados dinâmicos
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Title,
    Text,
    Stack,
    Group,
    Paper,
    Button,
    Select,
    SimpleGrid,
    Alert,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
    IconMessageCircle,
    IconUsers,
    IconUserPlus,
    IconRobot,
    IconPackage,
    IconRefresh,
    IconFilter,
    IconDatabase,
    IconBriefcase,
} from '@tabler/icons-react'
import { useViewContext } from '@/contexts/ViewContext'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import {
    useDashboardStats,
    usePipelineData,
    useFunnelData,
    useAgentPerformance,
} from '@/hooks/useDashboardStats'
import {
    StatCard,
    PipelineCard,
    ConversionFunnel,
    PerformanceCard,
} from '@/components/dashboard'

// =============================================================================
// FILTER OPTIONS
// =============================================================================

const PERIOD_OPTIONS = [
    { value: 'today', label: 'Hoje' },
    { value: 'yesterday', label: 'Ontem' },
    { value: '7days', label: 'Últimos 7 dias' },
    { value: '30days', label: 'Este Mês' },
    { value: 'custom', label: 'Personalizado' },
]

const PRODUCT_OPTIONS = [
    { value: 'all', label: 'Todos os Produtos' },
]

const AGENT_OPTIONS = [
    { value: 'all', label: 'Todos os Agentes' },
]

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export default function AdminDashboard() {
    const { selectedCompany } = useViewContext()
    const navigate = useNavigate()
    const [period, setPeriod] = useState<string | null>('7days')
    const [product, setProduct] = useState<string | null>('all')
    const [agent, setAgent] = useState<string | null>('all')
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null])

    // Database status
    const { isConfigured } = useClientDatabaseStatus()

    // Dynamic data hooks
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats()
    const { data: pipelineData, isLoading: pipelineLoading } = usePipelineData()
    const { data: funnelData, isLoading: funnelLoading } = useFunnelData()
    const { data: agentsData, isLoading: agentsLoading } = useAgentPerformance()

    const handleRefresh = () => {
        refetchStats()
    }

    // Format trend for display
    const formatTrend = (value: number | undefined) => {
        if (value === undefined) return undefined
        const sign = value >= 0 ? '+' : ''
        return `${sign}${value.toFixed(1)}%`
    }

    const getTrendColor = (value: number | undefined): 'green' | 'red' | 'gray' => {
        if (value === undefined || value === 0) return 'gray'
        return value > 0 ? 'green' : 'red'
    }

    return (
        <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between">
                <div>
                    <Title order={2}>Dashboard - {selectedCompany?.name || 'Empresa'}</Title>
                    <Text c="dimmed" size="sm">Visão operacional em tempo real</Text>
                </div>
                <Button
                    variant="subtle"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleRefresh}
                    loading={statsLoading}
                >
                    Atualizar
                </Button>
            </Group>

            {/* Alert se banco não configurado */}
            {!isConfigured && (
                <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                    Configure o banco de dados do cliente para ver dados reais.
                    Acesse Empresas → Configurar Banco de Dados.
                </Alert>
            )}

            {/* Smart Filters */}
            <Paper p="md" radius="md" withBorder>
                <Group gap="md">
                    <IconFilter size={18} color="gray" />
                    <Select
                        placeholder="Período"
                        data={PERIOD_OPTIONS}
                        value={period}
                        onChange={setPeriod}
                        size="sm"
                        w={160}
                    />
                    {period === 'custom' && (
                        <DatePickerInput
                            type="range"
                            placeholder="Selecione o período"
                            value={dateRange}
                            onChange={setDateRange}
                            size="sm"
                            w={240}
                        />
                    )}
                    <Select
                        placeholder="Produto"
                        data={PRODUCT_OPTIONS}
                        value={product}
                        onChange={setProduct}
                        size="sm"
                        w={160}
                    />
                    <Select
                        placeholder="Agente"
                        data={AGENT_OPTIONS}
                        value={agent}
                        onChange={setAgent}
                        size="sm"
                        w={160}
                    />
                    <Button size="sm" variant="filled">Aplicar</Button>
                </Group>
            </Paper>

            {/* KPI Cards - Row 1 */}
            <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
                <StatCard
                    label="Conversas"
                    value={stats?.conversations || 0}
                    icon={<IconMessageCircle size={20} />}
                    color="blue"
                    trend={formatTrend(stats?.conversationsChange)}
                    trendColor={getTrendColor(stats?.conversationsChange)}
                    loading={statsLoading}
                />
                <StatCard
                    label="Oportunidades"
                    value={stats?.opportunities || 0}
                    icon={<IconBriefcase size={20} />}
                    color="orange"
                    trend={formatTrend(stats?.opportunitiesChange)}
                    trendColor={getTrendColor(stats?.opportunitiesChange)}
                    loading={statsLoading}
                />
                <StatCard
                    label="Contatos"
                    value={stats?.contacts || 0}
                    icon={<IconUsers size={20} />}
                    color="teal"
                    trend={formatTrend(stats?.contactsChange)}
                    trendColor={getTrendColor(stats?.contactsChange)}
                    loading={statsLoading}
                />
                <StatCard
                    label="Novos Leads"
                    value={stats?.newLeads || 0}
                    icon={<IconUserPlus size={20} />}
                    color="violet"
                    trend={formatTrend(stats?.newLeadsChange)}
                    trendColor={getTrendColor(stats?.newLeadsChange)}
                    loading={statsLoading}
                />
                <StatCard
                    label="Agentes Ativos"
                    value={stats?.activeAgents || 0}
                    icon={<IconRobot size={20} />}
                    color="cyan"
                    loading={statsLoading}
                />
                <StatCard
                    label="Serviços"
                    value={stats?.services || 0}
                    icon={<IconPackage size={20} />}
                    color="pink"
                    loading={statsLoading}
                />
            </SimpleGrid>

            {/* Charts Row */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {/* Funnel */}
                <ConversionFunnel
                    title="Funil de Conversão"
                    badgeText="+15% VS MÊS ANTERIOR"
                    stages={funnelData || []}
                    loading={funnelLoading}
                    showConversionRates={true}
                />

                {/* Agent Performance */}
                <PerformanceCard
                    title="Performance dos Agentes"
                    badgeText="30 DIAS"
                    agents={agentsData || []}
                    loading={agentsLoading}
                />
            </SimpleGrid>

            {/* Pipeline Row */}
            <PipelineCard
                title="Pipeline de Vendas"
                badgeText={`${pipelineData?.reduce((a, b) => a + b.count, 0) || 0} OPORTUNIDADES`}
                stages={pipelineData || []}
                loading={pipelineLoading}
            />
        </Stack>
    )
}
