import { Title, Text, Card, Stack, Group, SimpleGrid, ThemeIcon, RingProgress, Paper } from '@mantine/core'
import { IconChartBar, IconTrendingUp, IconUsers, IconMessages } from '@tabler/icons-react'

export default function AdminAnalytics() {
    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Analytics</Title>
                <Text c="dimmed" size="sm">Métricas e relatórios globais da plataforma</Text>
            </div>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                {[
                    { label: 'Total de Conversas', value: '45.2K', icon: IconMessages, color: 'indigo' },
                    { label: 'Taxa de Conversão', value: '23.4%', icon: IconTrendingUp, color: 'teal' },
                    { label: 'Usuários Ativos', value: '1,234', icon: IconUsers, color: 'violet' },
                    { label: 'Média de Satisfação', value: '4.8/5', icon: IconChartBar, color: 'cyan' },
                ].map((stat) => (
                    <Card key={stat.label} withBorder padding="lg" radius="md">
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{stat.label}</Text>
                                <Text size="xl" fw={700} mt={4}>{stat.value}</Text>
                            </div>
                            <ThemeIcon size="xl" radius="md" variant="light" color={stat.color}>
                                <stat.icon size={24} stroke={1.5} />
                            </ThemeIcon>
                        </Group>
                    </Card>
                ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Card withBorder padding="lg" radius="md">
                    <Text fw={600} mb="md">Distribuição por Plano</Text>
                    <Group justify="center" py="xl">
                        <RingProgress
                            size={200}
                            thickness={20}
                            roundCaps
                            sections={[
                                { value: 45, color: 'violet', tooltip: 'Enterprise - 45%' },
                                { value: 35, color: 'indigo', tooltip: 'Pro - 35%' },
                                { value: 20, color: 'gray', tooltip: 'Starter - 20%' },
                            ]}
                        />
                    </Group>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Text fw={600} mb="md">Conversas por Hora</Text>
                    <Paper bg="dark.6" p="xl" radius="md">
                        <Stack align="center" py="xl">
                            <Text c="dimmed" size="sm">Gráfico será implementado com Recharts</Text>
                            <Text size="lg" fw={500} c="indigo">Em desenvolvimento...</Text>
                        </Stack>
                    </Paper>
                </Card>
            </SimpleGrid>
        </Stack>
    )
}
