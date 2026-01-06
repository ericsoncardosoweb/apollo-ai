import { Title, Text, Card, Stack, Group, SimpleGrid, ThemeIcon, RingProgress, Paper, Badge } from '@mantine/core'
import { IconChartBar, IconTrendingUp, IconUsers, IconMessages, IconClock } from '@tabler/icons-react'

export default function AppAnalytics() {
    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Analytics</Title>
                <Text c="dimmed" size="sm">Métricas e relatórios do seu negócio</Text>
            </div>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                {[
                    { label: 'Conversas do Mês', value: '1,234', icon: IconMessages, color: 'teal', change: '+18%' },
                    { label: 'Taxa de Conversão', value: '23.4%', icon: IconTrendingUp, color: 'green', change: '+5.2%' },
                    { label: 'Tempo Médio Resposta', value: '2.8s', icon: IconClock, color: 'cyan', change: '-0.4s' },
                    { label: 'Leads Qualificados', value: '89', icon: IconUsers, color: 'indigo', change: '+12' },
                ].map((stat) => (
                    <Card key={stat.label} withBorder padding="lg" radius="md">
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{stat.label}</Text>
                                <Text size="xl" fw={700} mt={4}>{stat.value}</Text>
                                <Badge size="xs" color="green" variant="light" mt={4}>{stat.change}</Badge>
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
                    <Group justify="space-between" mb="md">
                        <Text fw={600}>Origem dos Leads</Text>
                        <ThemeIcon variant="light" color="teal">
                            <IconChartBar size={18} />
                        </ThemeIcon>
                    </Group>
                    <Group justify="center" py="xl">
                        <RingProgress
                            size={200}
                            thickness={20}
                            roundCaps
                            sections={[
                                { value: 40, color: 'teal', tooltip: 'WhatsApp - 40%' },
                                { value: 30, color: 'cyan', tooltip: 'Instagram - 30%' },
                                { value: 20, color: 'indigo', tooltip: 'Site - 20%' },
                                { value: 10, color: 'violet', tooltip: 'Outros - 10%' },
                            ]}
                        />
                    </Group>
                    <SimpleGrid cols={2} mt="md">
                        {[
                            { label: 'WhatsApp', value: '40%', color: 'teal' },
                            { label: 'Instagram', value: '30%', color: 'cyan' },
                            { label: 'Site', value: '20%', color: 'indigo' },
                            { label: 'Outros', value: '10%', color: 'violet' },
                        ].map((item) => (
                            <Group key={item.label} gap="xs">
                                <Badge size="xs" color={item.color} variant="filled" circle> </Badge>
                                <Text size="sm">{item.label}: {item.value}</Text>
                            </Group>
                        ))}
                    </SimpleGrid>
                </Card>

                <Card withBorder padding="lg" radius="md">
                    <Group justify="space-between" mb="md">
                        <Text fw={600}>Performance Semanal</Text>
                        <ThemeIcon variant="light" color="cyan">
                            <IconTrendingUp size={18} />
                        </ThemeIcon>
                    </Group>
                    <Paper bg="dark.6" p="xl" radius="md">
                        <Stack align="center" py="xl">
                            <Text c="dimmed" size="sm">Gráfico será implementado com Recharts</Text>
                            <Text size="lg" fw={500} c="teal">Em desenvolvimento...</Text>
                        </Stack>
                    </Paper>
                </Card>
            </SimpleGrid>
        </Stack>
    )
}
