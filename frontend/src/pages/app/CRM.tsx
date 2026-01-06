import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    Badge,
    SimpleGrid,
    Paper,
    Avatar,
    ActionIcon,
    Menu,
} from '@mantine/core'
import { IconPlus, IconDotsVertical, IconPhone, IconMail, IconBrandWhatsapp } from '@tabler/icons-react'

interface Deal {
    id: string
    name: string
    contact: string
    value: string
    stage: string
    daysInStage: number
}

const stages = [
    { id: 'new', name: 'Novo Lead', color: 'gray' },
    { id: 'qualified', name: 'Qualificado', color: 'blue' },
    { id: 'proposal', name: 'Proposta', color: 'indigo' },
    { id: 'negotiation', name: 'Negociação', color: 'violet' },
    { id: 'closed', name: 'Fechado', color: 'green' },
]

const deals: Deal[] = [
    { id: '1', name: 'Projeto ERP', contact: 'TechCorp', value: 'R$ 45.000', stage: 'new', daysInStage: 2 },
    { id: '2', name: 'Consultoria Digital', contact: 'Loja XYZ', value: 'R$ 12.000', stage: 'new', daysInStage: 1 },
    { id: '3', name: 'Plataforma E-commerce', contact: 'Moda Plus', value: 'R$ 28.000', stage: 'qualified', daysInStage: 5 },
    { id: '4', name: 'App Mobile', contact: 'Startup ABC', value: 'R$ 35.000', stage: 'qualified', daysInStage: 3 },
    { id: '5', name: 'Automação Marketing', contact: 'Vendas Pro', value: 'R$ 8.500', stage: 'proposal', daysInStage: 7 },
    { id: '6', name: 'CRM Customizado', contact: 'Imobiliária Sol', value: 'R$ 22.000', stage: 'negotiation', daysInStage: 4 },
    { id: '7', name: 'Chatbot WhatsApp', contact: 'Clínica Vida', value: 'R$ 15.000', stage: 'closed', daysInStage: 1 },
]

function DealCard({ deal }: { deal: Deal }) {
    return (
        <Paper p="sm" radius="md" withBorder mb="xs">
            <Group justify="space-between" align="flex-start" mb="xs">
                <Text size="sm" fw={500} lineClamp={1}>{deal.name}</Text>
                <Menu shadow="md" width={140} position="bottom-end">
                    <Menu.Target>
                        <ActionIcon variant="subtle" size="sm">
                            <IconDotsVertical size={14} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPhone size={14} />}>Ligar</Menu.Item>
                        <Menu.Item leftSection={<IconBrandWhatsapp size={14} />}>WhatsApp</Menu.Item>
                        <Menu.Item leftSection={<IconMail size={14} />}>E-mail</Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Group>
            <Group gap="xs" mb="xs">
                <Avatar size="xs" radius="xl" color="teal">{deal.contact.charAt(0)}</Avatar>
                <Text size="xs" c="dimmed">{deal.contact}</Text>
            </Group>
            <Group justify="space-between">
                <Text size="sm" fw={600} c="teal">{deal.value}</Text>
                <Badge size="xs" variant="light">{deal.daysInStage}d</Badge>
            </Group>
        </Paper>
    )
}

export default function AppCRM() {
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>CRM</Title>
                    <Text c="dimmed" size="sm">Gerencie suas oportunidades de negócio</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />} color="teal">
                    Nova Oportunidade
                </Button>
            </Group>

            {/* Kanban Board */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
                {stages.map((stage) => {
                    const stageDeals = deals.filter(d => d.stage === stage.id)
                    const totalValue = stageDeals.reduce((sum, d) => {
                        const value = parseFloat(d.value.replace(/[^0-9]/g, ''))
                        return sum + value
                    }, 0)

                    return (
                        <Card
                            key={stage.id}
                            withBorder
                            padding="sm"
                            radius="md"
                            bg="dark.7"
                        >
                            <Group justify="space-between" mb="md">
                                <Group gap="xs">
                                    <Badge color={stage.color} variant="filled" size="xs" circle>
                                        {stageDeals.length}
                                    </Badge>
                                    <Text size="sm" fw={600}>{stage.name}</Text>
                                </Group>
                            </Group>

                            <Text size="xs" c="dimmed" mb="md">
                                R$ {totalValue.toLocaleString('pt-BR')}
                            </Text>

                            <Stack gap={0}>
                                {stageDeals.map((deal) => (
                                    <DealCard key={deal.id} deal={deal} />
                                ))}
                            </Stack>
                        </Card>
                    )
                })}
            </SimpleGrid>
        </Stack>
    )
}
