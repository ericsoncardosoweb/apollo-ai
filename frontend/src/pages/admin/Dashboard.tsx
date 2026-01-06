import {
    Title,
    Text,
    Card,
    SimpleGrid,
    Group,
    ThemeIcon,
    Stack,
    RingProgress,
    Paper,
    Badge,
} from '@mantine/core'
import {
    IconBuilding,
    IconRobot,
    IconMessages,
    IconTrendingUp,
    IconUsers,
    IconActivity,
} from '@tabler/icons-react'

const stats = [
    { title: 'Empresas Ativas', value: '24', icon: IconBuilding, color: 'indigo', change: '+3 este mês' },
    { title: 'Agentes Configurados', value: '47', icon: IconRobot, color: 'violet', change: '12 ativos agora' },
    { title: 'Conversas Hoje', value: '1,248', icon: IconMessages, color: 'teal', change: '+18% vs ontem' },
    { title: 'Usuários Ativos', value: '156', icon: IconUsers, color: 'cyan', change: '89 online' },
]

export default function AdminDashboard() {
    return (
        <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between" align="flex-start">
                <div>
                    <Title order={2}>Painel Administrativo</Title>
                    <Text c="dimmed" size="sm">
                        Visão geral da plataforma Apollo A.I.
                    </Text>
                </div>
                <Badge size="lg" variant="dot" color="green">
                    Sistema Operacional
                </Badge>
            </Group>

            {/* Stats Grid */}
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
                {stats.map((stat) => (
                    <Card key={stat.title} withBorder padding="lg" radius="md">
                        <Group justify="space-between" align="flex-start">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    {stat.title}
                                </Text>
                                <Text size="xl" fw={700} mt={4}>
                                    {stat.value}
                                </Text>
                                <Text size="xs" c="dimmed" mt={4}>
                                    {stat.change}
                                </Text>
                            </div>
                            <ThemeIcon size="xl" radius="md" variant="light" color={stat.color}>
                                <stat.icon size={24} stroke={1.5} />
                            </ThemeIcon>
                        </Group>
                    </Card>
                ))}
            </SimpleGrid>

            {/* Quick Overview */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between" mb="md">
                        <Text fw={600}>Performance Geral</Text>
                        <ThemeIcon variant="light" color="indigo">
                            <IconActivity size={18} />
                        </ThemeIcon>
                    </Group>
                    <Group justify="center" py="xl">
                        <RingProgress
                            size={180}
                            thickness={16}
                            roundCaps
                            sections={[
                                { value: 40, color: 'indigo' },
                                { value: 25, color: 'violet' },
                                { value: 20, color: 'teal' },
                            ]}
                            label={
                                <Stack align="center" gap={0}>
                                    <Text size="xl" fw={700}>85%</Text>
                                    <Text size="xs" c="dimmed">Uptime</Text>
                                </Stack>
                            }
                        />
                    </Group>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between" mb="md">
                        <Text fw={600}>Crescimento Mensal</Text>
                        <ThemeIcon variant="light" color="teal">
                            <IconTrendingUp size={18} />
                        </ThemeIcon>
                    </Group>
                    <Paper bg="dark.6" p="xl" radius="md">
                        <Stack align="center" py="lg">
                            <Text size="xs" c="dimmed" tt="uppercase">MRR Atual</Text>
                            <Text size="2rem" fw={700} variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
                                R$ 24.850,00
                            </Text>
                            <Badge color="green" variant="light">+12.5% vs mês anterior</Badge>
                        </Stack>
                    </Paper>
                </Card>
            </SimpleGrid>
        </Stack>
    )
}
