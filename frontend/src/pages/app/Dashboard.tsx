import {
    Title,
    Text,
    Card,
    SimpleGrid,
    Group,
    ThemeIcon,
    Stack,
    RingProgress,
    Badge,
    Progress,
} from '@mantine/core'
import {
    IconBriefcase,
    IconMessages,
    IconTrendingUp,
    IconUsers,
    IconRobot,
} from '@tabler/icons-react'

const stats = [
    { title: 'Oportunidades Ativas', value: '32', icon: IconBriefcase, color: 'teal', change: '+5 esta semana' },
    { title: 'Conversas Hoje', value: '87', icon: IconMessages, color: 'cyan', change: '+12% vs ontem' },
    { title: 'Contatos', value: '1,456', icon: IconUsers, color: 'indigo', change: '23 novos hoje' },
    { title: 'Agentes Ativos', value: '3', icon: IconRobot, color: 'violet', change: 'Todos operacionais' },
]

const pipeline = [
    { stage: 'Novo Lead', count: 12, color: 'gray' },
    { stage: 'Qualificado', count: 8, color: 'blue' },
    { stage: 'Proposta', count: 5, color: 'indigo' },
    { stage: 'Negociação', count: 4, color: 'violet' },
    { stage: 'Fechado', count: 3, color: 'green' },
]

export default function AppDashboard() {
    const totalPipeline = pipeline.reduce((acc, p) => acc + p.count, 0)

    return (
        <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between" align="flex-start">
                <div>
                    <Title order={2}>Dashboard</Title>
                    <Text c="dimmed" size="sm">
                        Acompanhe o desempenho do seu negócio
                    </Text>
                </div>
                <Badge size="lg" variant="light" color="teal">
                    3 agentes online
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

            {/* Pipeline & Performance */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between" mb="md">
                        <Text fw={600}>Pipeline de Vendas</Text>
                        <Badge variant="light" color="teal">{totalPipeline} oportunidades</Badge>
                    </Group>
                    <Stack gap="sm">
                        {pipeline.map((stage) => (
                            <div key={stage.stage}>
                                <Group justify="space-between" mb={4}>
                                    <Text size="sm">{stage.stage}</Text>
                                    <Text size="sm" fw={500}>{stage.count}</Text>
                                </Group>
                                <Progress
                                    value={(stage.count / totalPipeline) * 100}
                                    color={stage.color}
                                    radius="xl"
                                    size="md"
                                />
                            </div>
                        ))}
                    </Stack>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between" mb="md">
                        <Text fw={600}>Performance dos Agentes</Text>
                        <ThemeIcon variant="light" color="violet">
                            <IconTrendingUp size={18} />
                        </ThemeIcon>
                    </Group>
                    <Group justify="center" py="xl">
                        <RingProgress
                            size={180}
                            thickness={16}
                            roundCaps
                            sections={[
                                { value: 45, color: 'teal', tooltip: 'Vendas - 45%' },
                                { value: 30, color: 'cyan', tooltip: 'Suporte - 30%' },
                                { value: 25, color: 'indigo', tooltip: 'Qualificação - 25%' },
                            ]}
                            label={
                                <Stack align="center" gap={0}>
                                    <Text size="xl" fw={700}>92%</Text>
                                    <Text size="xs" c="dimmed">Satisfação</Text>
                                </Stack>
                            }
                        />
                    </Group>
                </Card>
            </SimpleGrid>
        </Stack>
    )
}
