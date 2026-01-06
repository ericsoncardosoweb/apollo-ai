/**
 * Master Dashboard - KPIs with Supabase data
 * Shows calculated metrics: MRR, Active Companies, Operators, Best-Seller Plan
 */

import { useNavigate } from 'react-router-dom'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    SimpleGrid,
    Button,
    Badge,
    Table,
    ThemeIcon,
    Paper,
    Skeleton,
    ActionIcon,
    Avatar,
    RingProgress,
    Tooltip,
} from '@mantine/core'
import {
    IconBuilding,
    IconUsers,
    IconCrown,
    IconCurrencyDollar,
    IconArrowUpRight,
    IconArrowRight,
    IconRobot,
    IconMessage,
    IconEye,
    IconRefresh,
} from '@tabler/icons-react'
import { useCompanies } from '@/hooks/useCompanies'
import { useMasterStats } from '@/hooks/usePlans'
import { useAppStore, useIsAdminView } from '@/stores/useAppStore'
import { useViewContext } from '@/contexts/ViewContext'

// Format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

export default function AdminDashboard() {
    const navigate = useNavigate()
    const { viewMode, selectedCompany } = useAppStore()
    const isAdminView = useIsAdminView()
    const { switchToCompanyView } = useViewContext()

    // Queries
    const { data: companies, isLoading: companiesLoading, refetch: refetchCompanies } = useCompanies()
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useMasterStats()

    // Calculate derived stats
    const activeCompanies = companies?.filter(c => c.status === 'active').length || 0
    const recentCompanies = companies?.slice(0, 5) || []

    const handleViewCompany = (company: any) => {
        switchToCompanyView({
            id: company.id,
            name: company.name,
            slug: company.slug,
            plan: company.plan || 'starter',
            whatsapp_number: null,
            owner_id: null,
            is_active: company.status === 'active',
            created_at: company.created_at,
        })
        navigate('/admin')
    }

    const handleRefresh = () => {
        refetchCompanies()
        refetchStats()
    }

    // KPI Cards data
    const kpiCards = [
        {
            title: 'Empresas Ativas',
            value: stats?.active_companies ?? activeCompanies,
            subtitle: 'Plataforma Apollo',
            icon: IconBuilding,
            color: 'teal',
            trend: '+2 este mês',
        },
        {
            title: 'Operadores',
            value: stats?.operators_count ?? 0,
            subtitle: 'Equipe ativa',
            icon: IconUsers,
            color: 'blue',
            trend: null,
        },
        {
            title: 'Plano Best-Seller',
            value: stats?.best_seller_plan ?? 'Pro',
            subtitle: 'Mais vendido',
            icon: IconCrown,
            color: 'yellow',
            trend: null,
            isText: true,
        },
        {
            title: 'MRR',
            value: formatCurrency(stats?.mrr ?? 0),
            subtitle: 'Receita Recorrente Mensal',
            icon: IconCurrencyDollar,
            color: 'green',
            trend: '+12.5% vs mês anterior',
            isText: true,
        },
    ]

    // If in Management mode and company selected, show company-specific dashboard
    if (viewMode === 'MANAGEMENT' && selectedCompany) {
        return (
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Dashboard - {selectedCompany.name}</Title>
                        <Text c="dimmed" size="sm">Visão geral da empresa selecionada</Text>
                    </div>
                    <Badge color="blue" size="lg" variant="light">MODO GESTÃO</Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                    <Card withBorder padding="lg" radius="md">
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Agentes</Text>
                                <Text size="xl" fw={700}>0</Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="violet">
                                <IconRobot size={24} />
                            </ThemeIcon>
                        </Group>
                    </Card>
                    <Card withBorder padding="lg" radius="md">
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Conversas</Text>
                                <Text size="xl" fw={700}>0</Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="blue">
                                <IconMessage size={24} />
                            </ThemeIcon>
                        </Group>
                    </Card>
                    <Card withBorder padding="lg" radius="md">
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Leads</Text>
                                <Text size="xl" fw={700}>0</Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="green">
                                <IconUsers size={24} />
                            </ThemeIcon>
                        </Group>
                    </Card>
                    <Card withBorder padding="lg" radius="md">
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Plano</Text>
                                <Text size="xl" fw={700}>{selectedCompany.plan || 'Basic'}</Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="yellow">
                                <IconCrown size={24} />
                            </ThemeIcon>
                        </Group>
                    </Card>
                </SimpleGrid>

                <Button variant="light" onClick={() => navigate('/admin')}>
                    Acessar Painel de Gestão Completo
                </Button>
            </Stack>
        )
    }

    // Admin Global View
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Dashboard Master</Title>
                    <Text c="dimmed" size="sm">Visão geral da plataforma Apollo A.I.</Text>
                </div>
                <Group>
                    <Button
                        variant="subtle"
                        leftSection={<IconRefresh size={16} />}
                        onClick={handleRefresh}
                        loading={companiesLoading || statsLoading}
                    >
                        Atualizar
                    </Button>
                    <Badge color="teal" size="lg" variant="filled">ADMIN GLOBAL</Badge>
                </Group>
            </Group>

            {/* KPI Cards */}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                {kpiCards.map((kpi, index) => (
                    <Card key={index} withBorder padding="lg" radius="md">
                        {statsLoading ? (
                            <Skeleton height={80} />
                        ) : (
                            <>
                                <Group justify="space-between" mb="xs">
                                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                        {kpi.title}
                                    </Text>
                                    <ThemeIcon size={40} radius="md" variant="light" color={kpi.color}>
                                        <kpi.icon size={20} />
                                    </ThemeIcon>
                                </Group>
                                <Text size="xl" fw={700}>
                                    {kpi.value}
                                </Text>
                                <Text size="xs" c="dimmed">{kpi.subtitle}</Text>
                                {kpi.trend && (
                                    <Group gap={4} mt="xs">
                                        <IconArrowUpRight size={14} color="var(--mantine-color-green-6)" />
                                        <Text size="xs" c="green">{kpi.trend}</Text>
                                    </Group>
                                )}
                            </>
                        )}
                    </Card>
                ))}
            </SimpleGrid>

            {/* Performance and MRR Growth - Compact */}
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
                <Card withBorder padding="md" radius="md">
                    <Group gap="xs" mb="xs">
                        <RingProgress
                            size={50}
                            thickness={5}
                            roundCaps
                            sections={[{ value: 85, color: 'teal' }]}
                        />
                        <div>
                            <Text size="lg" fw={700}>85%</Text>
                            <Text size="xs" c="dimmed">Uptime</Text>
                        </div>
                    </Group>
                </Card>

                <Card withBorder padding="md" radius="md">
                    <Text size="xs" c="dimmed">MRR Atual</Text>
                    <Text size="lg" fw={700} c="green">
                        {formatCurrency(stats?.mrr ?? 0)}
                    </Text>
                    <Badge size="xs" color="green" variant="light">+12.5%</Badge>
                </Card>

                <Card withBorder padding="md" radius="md">
                    <Text size="xs" c="dimmed">Conversas/Mês</Text>
                    <Text size="lg" fw={700}>0</Text>
                    <Text size="xs" c="dimmed">Todas empresas</Text>
                </Card>

                <Card withBorder padding="md" radius="md">
                    <Text size="xs" c="dimmed">Mensagens/Mês</Text>
                    <Text size="lg" fw={700}>0</Text>
                    <Text size="xs" c="dimmed">Todas empresas</Text>
                </Card>
            </SimpleGrid>

            {/* Recent Clients Table */}
            <Card withBorder padding="lg" radius="md">
                <Group justify="space-between" mb="md">
                    <Text fw={600}>Empresas Recentes</Text>
                    <Button
                        variant="subtle"
                        rightSection={<IconArrowRight size={14} />}
                        onClick={() => navigate('/master/companies')}
                        size="xs"
                    >
                        Ver todas
                    </Button>
                </Group>

                {companiesLoading ? (
                    <Stack>
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} height={50} />
                        ))}
                    </Stack>
                ) : (
                    <Table.ScrollContainer minWidth={500}>
                        <Table verticalSpacing="sm" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Empresa</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Plano</Table.Th>
                                    <Table.Th>Ações</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {recentCompanies.map((company) => (
                                    <Table.Tr key={company.id}>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Avatar radius="xl" size="sm" color="teal">
                                                    {company.name.charAt(0)}
                                                </Avatar>
                                                <div>
                                                    <Text size="sm" fw={500}>{company.name}</Text>
                                                    <Text size="xs" c="dimmed">{company.slug}</Text>
                                                </div>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                color={company.status === 'active' ? 'green' : 'red'}
                                                variant="dot"
                                                size="sm"
                                            >
                                                {company.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge variant="light" color="blue" size="sm">
                                                {company.plan || 'Basic'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Tooltip label="Acessar empresa">
                                                <ActionIcon
                                                    variant="subtle"
                                                    color="teal"
                                                    onClick={() => handleViewCompany(company)}
                                                >
                                                    <IconEye size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                )}

                {!companiesLoading && recentCompanies.length === 0 && (
                    <Paper p="xl" ta="center" bg="dark.6" radius="md">
                        <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                            <IconBuilding size={30} />
                        </ThemeIcon>
                        <Text c="dimmed">Nenhuma empresa cadastrada</Text>
                        <Button
                            variant="light"
                            mt="md"
                            onClick={() => navigate('/master/companies')}
                        >
                            Cadastrar primeira empresa
                        </Button>
                    </Paper>
                )}
            </Card>
        </Stack>
    )
}
