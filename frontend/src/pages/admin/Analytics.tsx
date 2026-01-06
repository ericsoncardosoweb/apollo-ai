/**
 * Admin Analytics - Dashboard de Métricas Dinâmico
 */

import { useState } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    SimpleGrid,
    ThemeIcon,
    RingProgress,
    Paper,
    Select,
    Tabs,
    Badge,
    Progress,
    Table,
    Avatar,
    Skeleton,
    Center,
} from '@mantine/core'
import {
    IconChartBar,
    IconTrendingUp,
    IconTrendingDown,
    IconUsers,
    IconMessages,
    IconBrandWhatsapp,
    IconRobot,
    IconClock,
    IconCheck,
    IconUserPlus,
    IconChartPie,
    IconCalendar,
} from '@tabler/icons-react'
import { useViewContext } from '@/contexts/ViewContext'
import { useContacts, useContactsStats } from '@/hooks/useContacts'
import { useChatConversations, Conversation } from '@/hooks/useChat'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'

// Mock data for charts (will be replaced with real data)
const CONVERSATIONS_BY_DAY = [
    { day: 'Seg', count: 45 },
    { day: 'Ter', count: 62 },
    { day: 'Qua', count: 58 },
    { day: 'Qui', count: 71 },
    { day: 'Sex', count: 83 },
    { day: 'Sáb', count: 32 },
    { day: 'Dom', count: 18 },
]

const TOP_AGENTS = [
    { name: 'Agente Vendas', conversations: 234, satisfaction: 4.8 },
    { name: 'Agente Suporte', conversations: 189, satisfaction: 4.5 },
    { name: 'Agente Financeiro', conversations: 145, satisfaction: 4.7 },
]

export default function AdminAnalytics() {
    const [period, setPeriod] = useState<string>('7d')
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Real data hooks
    const { data: contacts, isLoading: loadingContacts } = useContacts()
    const { data: contactStats } = useContactsStats()
    const { data: conversations, isLoading: loadingConversations } = useChatConversations()

    // Calculate real metrics
    const totalContacts = contacts?.length || 0
    const totalConversations = conversations?.length || 0
    const activeConversations = conversations?.filter((c: Conversation) => c.status === 'waiting' || c.status === 'ai' || c.status === 'attending').length || 0
    const closedConversations = conversations?.filter((c: Conversation) => c.status === 'resolved' || c.status === 'archived').length || 0

    // Calculate conversion rate (contacts that have conversations)
    const contactsWithConversations = new Set(conversations?.map(c => c.contact_id) || []).size
    const conversionRate = totalContacts > 0 ? ((contactsWithConversations / totalContacts) * 100).toFixed(1) : '0'

    // Average response time (mock for now)
    const avgResponseTime = '2.5 min'

    // Status distribution for ring chart
    const statusDistribution = [
        { value: activeConversations, color: 'green', tooltip: `Ativas: ${activeConversations}` },
        { value: closedConversations, color: 'gray', tooltip: `Finalizadas: ${closedConversations}` },
    ]

    const maxCount = Math.max(...CONVERSATIONS_BY_DAY.map(d => d.count))

    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Analytics</Title>
                    <Text c="dimmed" size="sm">
                        Métricas e relatórios de {selectedCompany?.name || 'empresa'}
                    </Text>
                </div>
                <Select
                    value={period}
                    onChange={(val) => setPeriod(val || '7d')}
                    data={[
                        { value: '1d', label: 'Hoje' },
                        { value: '7d', label: 'Últimos 7 dias' },
                        { value: '30d', label: 'Últimos 30 dias' },
                        { value: '90d', label: 'Últimos 90 dias' },
                    ]}
                    size="sm"
                    w={160}
                />
            </Group>

            {/* Main Stats */}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between">
                        <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total de Conversas</Text>
                            {loadingConversations ? (
                                <Skeleton height={28} width={80} mt={4} />
                            ) : (
                                <Text size="xl" fw={700} mt={4}>{totalConversations.toLocaleString()}</Text>
                            )}
                            <Group gap={4} mt={4}>
                                <IconTrendingUp size={14} color="var(--mantine-color-teal-6)" />
                                <Text size="xs" c="teal">+12% vs período anterior</Text>
                            </Group>
                        </div>
                        <ThemeIcon size="xl" radius="md" variant="light" color="indigo">
                            <IconMessages size={24} stroke={1.5} />
                        </ThemeIcon>
                    </Group>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between">
                        <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Taxa de Conversão</Text>
                            <Text size="xl" fw={700} mt={4}>{conversionRate}%</Text>
                            <Group gap={4} mt={4}>
                                <IconTrendingUp size={14} color="var(--mantine-color-teal-6)" />
                                <Text size="xs" c="teal">+5.2% vs período anterior</Text>
                            </Group>
                        </div>
                        <ThemeIcon size="xl" radius="md" variant="light" color="teal">
                            <IconTrendingUp size={24} stroke={1.5} />
                        </ThemeIcon>
                    </Group>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between">
                        <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Contatos Ativos</Text>
                            {loadingContacts ? (
                                <Skeleton height={28} width={80} mt={4} />
                            ) : (
                                <Text size="xl" fw={700} mt={4}>{totalContacts.toLocaleString()}</Text>
                            )}
                            <Group gap={4} mt={4}>
                                <IconUserPlus size={14} color="var(--mantine-color-violet-6)" />
                                <Text size="xs" c="violet">+{contactStats?.newThisMonth || 0} este mês</Text>
                            </Group>
                        </div>
                        <ThemeIcon size="xl" radius="md" variant="light" color="violet">
                            <IconUsers size={24} stroke={1.5} />
                        </ThemeIcon>
                    </Group>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between">
                        <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Tempo Médio Resposta</Text>
                            <Text size="xl" fw={700} mt={4}>{avgResponseTime}</Text>
                            <Group gap={4} mt={4}>
                                <IconTrendingDown size={14} color="var(--mantine-color-teal-6)" />
                                <Text size="xs" c="teal">-30s vs período anterior</Text>
                            </Group>
                        </div>
                        <ThemeIcon size="xl" radius="md" variant="light" color="cyan">
                            <IconClock size={24} stroke={1.5} />
                        </ThemeIcon>
                    </Group>
                </Card>
            </SimpleGrid>

            <Tabs defaultValue="overview">
                <Tabs.List>
                    <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
                        Visão Geral
                    </Tabs.Tab>
                    <Tabs.Tab value="conversations" leftSection={<IconMessages size={16} />}>
                        Conversas
                    </Tabs.Tab>
                    <Tabs.Tab value="agents" leftSection={<IconRobot size={16} />}>
                        Agentes IA
                    </Tabs.Tab>
                </Tabs.List>

                {/* Overview Tab */}
                <Tabs.Panel value="overview" pt="md">
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        {/* Conversations by Day */}
                        <Card withBorder padding="lg" radius="md">
                            <Group justify="space-between" mb="md">
                                <Text fw={600}>Conversas por Dia</Text>
                                <Badge variant="light" leftSection={<IconCalendar size={12} />}>
                                    Últimos 7 dias
                                </Badge>
                            </Group>
                            <Stack gap="xs">
                                {CONVERSATIONS_BY_DAY.map((day) => (
                                    <Group key={day.day} gap="sm">
                                        <Text size="sm" w={40} c="dimmed">{day.day}</Text>
                                        <Progress
                                            value={(day.count / maxCount) * 100}
                                            size="lg"
                                            radius="xl"
                                            color="indigo"
                                            style={{ flex: 1 }}
                                        />
                                        <Text size="sm" w={40} ta="right">{day.count}</Text>
                                    </Group>
                                ))}
                            </Stack>
                        </Card>

                        {/* Status Distribution */}
                        <Card withBorder padding="lg" radius="md">
                            <Text fw={600} mb="md">Status das Conversas</Text>
                            <Center py="md">
                                {totalConversations > 0 ? (
                                    <RingProgress
                                        size={180}
                                        thickness={20}
                                        roundCaps
                                        label={
                                            <Text ta="center" size="lg" fw={700}>
                                                {totalConversations}
                                                <Text size="xs" c="dimmed">total</Text>
                                            </Text>
                                        }
                                        sections={statusDistribution.filter(s => s.value > 0)}
                                    />
                                ) : (
                                    <Text c="dimmed" size="sm">Sem conversas no período</Text>
                                )}
                            </Center>
                            <SimpleGrid cols={2} mt="md">
                                <Paper p="xs" radius="md" bg="dark.6">
                                    <Group gap="xs">
                                        <ThemeIcon size="sm" color="green" variant="light">
                                            <IconBrandWhatsapp size={12} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" c="dimmed">Ativas</Text>
                                            <Text size="sm" fw={600}>{activeConversations}</Text>
                                        </div>
                                    </Group>
                                </Paper>
                                <Paper p="xs" radius="md" bg="dark.6">
                                    <Group gap="xs">
                                        <ThemeIcon size="sm" color="gray" variant="light">
                                            <IconCheck size={12} />
                                        </ThemeIcon>
                                        <div>
                                            <Text size="xs" c="dimmed">Finalizadas</Text>
                                            <Text size="sm" fw={600}>{closedConversations}</Text>
                                        </div>
                                    </Group>
                                </Paper>
                            </SimpleGrid>
                        </Card>
                    </SimpleGrid>
                </Tabs.Panel>

                {/* Conversations Tab */}
                <Tabs.Panel value="conversations" pt="md">
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <Card withBorder padding="lg" radius="md">
                            <Text fw={600} mb="md">Canais de Atendimento</Text>
                            <Stack gap="md">
                                <Group justify="space-between">
                                    <Group gap="sm">
                                        <ThemeIcon color="green" variant="light">
                                            <IconBrandWhatsapp size={18} />
                                        </ThemeIcon>
                                        <Text size="sm">WhatsApp</Text>
                                    </Group>
                                    <Group gap="xs">
                                        <Text size="sm" fw={600}>{totalConversations}</Text>
                                        <Badge size="xs" color="green">100%</Badge>
                                    </Group>
                                </Group>
                            </Stack>
                        </Card>

                        <Card withBorder padding="lg" radius="md">
                            <Text fw={600} mb="md">Métricas de Qualidade</Text>
                            <Stack gap="md">
                                <div>
                                    <Group justify="space-between" mb={4}>
                                        <Text size="sm" c="dimmed">Taxa de Resolução</Text>
                                        <Text size="sm" fw={500}>
                                            {totalConversations > 0
                                                ? ((closedConversations / totalConversations) * 100).toFixed(0)
                                                : 0}%
                                        </Text>
                                    </Group>
                                    <Progress
                                        value={totalConversations > 0
                                            ? (closedConversations / totalConversations) * 100
                                            : 0}
                                        color="teal"
                                        size="sm"
                                    />
                                </div>
                                <div>
                                    <Group justify="space-between" mb={4}>
                                        <Text size="sm" c="dimmed">Satisfação do Cliente</Text>
                                        <Text size="sm" fw={500}>4.7/5.0</Text>
                                    </Group>
                                    <Progress value={94} color="yellow" size="sm" />
                                </div>
                                <div>
                                    <Group justify="space-between" mb={4}>
                                        <Text size="sm" c="dimmed">Transferência para Humano</Text>
                                        <Text size="sm" fw={500}>12%</Text>
                                    </Group>
                                    <Progress value={12} color="orange" size="sm" />
                                </div>
                            </Stack>
                        </Card>
                    </SimpleGrid>
                </Tabs.Panel>

                {/* Agents Tab */}
                <Tabs.Panel value="agents" pt="md">
                    <Card withBorder padding="lg" radius="md">
                        <Text fw={600} mb="md">Performance dos Agentes IA</Text>
                        <Table.ScrollContainer minWidth={500}>
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Agente</Table.Th>
                                        <Table.Th>Conversas</Table.Th>
                                        <Table.Th>Satisfação</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {TOP_AGENTS.map((agent, index) => (
                                        <Table.Tr key={agent.name}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar color="blue" radius="xl" size="sm">
                                                        <IconRobot size={14} />
                                                    </Avatar>
                                                    <Text size="sm" fw={500}>{agent.name}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{agent.conversations}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Text size="sm" fw={500}>{agent.satisfaction}</Text>
                                                    <Text size="xs" c="dimmed">/5.0</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge color="green" variant="light">Ativo</Badge>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    </Card>
                </Tabs.Panel>
            </Tabs>
        </Stack>
    )
}
