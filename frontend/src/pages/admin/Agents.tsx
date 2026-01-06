import { Title, Text, Card, Stack, Group, Button, SimpleGrid, Badge, ThemeIcon, Progress } from '@mantine/core'
import { IconPlus, IconRobot, IconMessageCircle, IconClock } from '@tabler/icons-react'

const agents = [
    { id: '1', name: 'Assistente de Vendas', company: 'TechCorp', status: 'active', conversations: 456, avgResponse: '2.3s' },
    { id: '2', name: 'Suporte Técnico', company: 'TechCorp', status: 'active', conversations: 234, avgResponse: '3.1s' },
    { id: '3', name: 'Atendimento Geral', company: 'Vendas Express', status: 'training', conversations: 89, avgResponse: '4.2s' },
    { id: '4', name: 'Qualificação de Leads', company: 'Consultoria ABC', status: 'active', conversations: 178, avgResponse: '2.8s' },
]

export default function AdminAgents() {
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Agentes de I.A.</Title>
                    <Text c="dimmed" size="sm">Configure e monitore os agentes inteligentes</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />}>
                    Novo Agente
                </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {agents.map((agent) => (
                    <Card key={agent.id} withBorder padding="lg" radius="md">
                        <Group justify="space-between" mb="md">
                            <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                                <IconRobot size={20} />
                            </ThemeIcon>
                            <Badge
                                color={agent.status === 'active' ? 'green' : 'yellow'}
                                variant="light"
                            >
                                {agent.status === 'active' ? 'Ativo' : 'Treinando'}
                            </Badge>
                        </Group>

                        <Text fw={600} size="lg">{agent.name}</Text>
                        <Text size="sm" c="dimmed" mb="md">{agent.company}</Text>

                        <Stack gap="xs">
                            <Group justify="space-between">
                                <Group gap="xs">
                                    <IconMessageCircle size={14} />
                                    <Text size="sm">Conversas</Text>
                                </Group>
                                <Text size="sm" fw={500}>{agent.conversations}</Text>
                            </Group>

                            <Group justify="space-between">
                                <Group gap="xs">
                                    <IconClock size={14} />
                                    <Text size="sm">Tempo médio</Text>
                                </Group>
                                <Text size="sm" fw={500}>{agent.avgResponse}</Text>
                            </Group>
                        </Stack>

                        <Progress value={75} mt="md" radius="xl" size="sm" color="indigo" />
                    </Card>
                ))}
            </SimpleGrid>
        </Stack>
    )
}
