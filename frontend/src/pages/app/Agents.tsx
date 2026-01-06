import { Title, Text, Card, Stack, Group, SimpleGrid, Badge, ThemeIcon, Progress, Paper } from '@mantine/core'
import { IconRobot, IconMessageCircle, IconClock, IconThumbUp } from '@tabler/icons-react'

const agents = [
    {
        id: '1',
        name: 'Assistente de Vendas',
        status: 'active',
        conversations: 156,
        avgResponse: '2.3s',
        satisfaction: 94,
        todayConversations: 23
    },
    {
        id: '2',
        name: 'Suporte Técnico',
        status: 'active',
        conversations: 89,
        avgResponse: '3.1s',
        satisfaction: 91,
        todayConversations: 15
    },
    {
        id: '3',
        name: 'Qualificação de Leads',
        status: 'active',
        conversations: 67,
        avgResponse: '2.8s',
        satisfaction: 88,
        todayConversations: 12
    },
]

export default function AppAgents() {
    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Agentes de I.A.</Title>
                <Text c="dimmed" size="sm">Performance dos seus agentes inteligentes</Text>
            </div>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {agents.map((agent) => (
                    <Card key={agent.id} withBorder padding="lg" radius="md">
                        <Group justify="space-between" mb="md">
                            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
                                <IconRobot size={20} />
                            </ThemeIcon>
                            <Badge color="green" variant="dot">
                                Online
                            </Badge>
                        </Group>

                        <Text fw={600} size="lg">{agent.name}</Text>
                        <Text size="sm" c="dimmed" mb="lg">{agent.todayConversations} conversas hoje</Text>

                        <Stack gap="md">
                            <Paper p="sm" radius="md" bg="dark.6">
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <IconMessageCircle size={16} color="var(--mantine-color-teal-5)" />
                                        <Text size="sm">Total de Conversas</Text>
                                    </Group>
                                    <Text size="sm" fw={600}>{agent.conversations}</Text>
                                </Group>
                            </Paper>

                            <Paper p="sm" radius="md" bg="dark.6">
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <IconClock size={16} color="var(--mantine-color-cyan-5)" />
                                        <Text size="sm">Tempo Médio</Text>
                                    </Group>
                                    <Text size="sm" fw={600}>{agent.avgResponse}</Text>
                                </Group>
                            </Paper>

                            <div>
                                <Group justify="space-between" mb={4}>
                                    <Group gap="xs">
                                        <IconThumbUp size={16} color="var(--mantine-color-green-5)" />
                                        <Text size="sm">Satisfação</Text>
                                    </Group>
                                    <Text size="sm" fw={600}>{agent.satisfaction}%</Text>
                                </Group>
                                <Progress
                                    value={agent.satisfaction}
                                    color={agent.satisfaction >= 90 ? 'green' : agent.satisfaction >= 80 ? 'yellow' : 'red'}
                                    radius="xl"
                                    size="md"
                                />
                            </div>
                        </Stack>
                    </Card>
                ))}
            </SimpleGrid>
        </Stack>
    )
}
