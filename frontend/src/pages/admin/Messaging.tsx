/**
 * Admin Messaging - Campanhas e Broadcasts
 */

import { useState } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    TextInput,
    Badge,
    Table,
    ActionIcon,
    Menu,
    Modal,
    Tabs,
    ThemeIcon,
    Paper,
    SimpleGrid,
    Progress,
    Select,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconPlayerPlay,
    IconPlayerPause,
    IconBrandWhatsapp,
    IconMail,
    IconSend,
    IconUsers,
    IconChartBar,
} from '@tabler/icons-react'
import RichTextEditor from '@/components/editor/RichTextEditor'

// Mock campaigns
const MOCK_CAMPAIGNS = [
    { id: '1', name: 'Black Friday 2026', type: 'whatsapp', status: 'active', sent: 1250, delivered: 1180, opened: 890, clicks: 234, createdAt: '01/01/2026' },
    { id: '2', name: 'Boas Vindas', type: 'whatsapp', status: 'active', sent: 500, delivered: 495, opened: 412, clicks: 156, createdAt: '15/12/2025' },
    { id: '3', name: 'Reengajamento', type: 'email', status: 'paused', sent: 2000, delivered: 1850, opened: 650, clicks: 89, createdAt: '01/12/2025' },
]

export default function AdminMessaging() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [messageContent, setMessageContent] = useState('')

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Mensageria</Title>
                        <Text c="dimmed" size="sm">Campanhas e broadcasts</Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
                        Nova Campanha
                    </Button>
                </Group>

                {/* Stats */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="blue">
                                <IconSend size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>3.750</Text>
                                <Text size="xs" c="dimmed">Mensagens Enviadas</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="green">
                                <IconChartBar size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>94%</Text>
                                <Text size="xs" c="dimmed">Taxa de Entrega</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="orange">
                                <IconMail size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>52%</Text>
                                <Text size="xs" c="dimmed">Taxa de Abertura</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="teal">
                                <IconUsers size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>479</Text>
                                <Text size="xs" c="dimmed">Cliques</Text>
                            </div>
                        </Group>
                    </Paper>
                </SimpleGrid>

                {/* Campaigns Table */}
                <Card withBorder padding="md" radius="md">
                    <Tabs defaultValue="all">
                        <Tabs.List mb="md">
                            <Tabs.Tab value="all">Todas</Tabs.Tab>
                            <Tabs.Tab value="active">Ativas</Tabs.Tab>
                            <Tabs.Tab value="paused">Pausadas</Tabs.Tab>
                            <Tabs.Tab value="scheduled">Agendadas</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="all">
                            <Table.ScrollContainer minWidth={800}>
                                <Table verticalSpacing="sm" highlightOnHover>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Campanha</Table.Th>
                                            <Table.Th>Tipo</Table.Th>
                                            <Table.Th>Status</Table.Th>
                                            <Table.Th>Enviadas</Table.Th>
                                            <Table.Th>Entregues</Table.Th>
                                            <Table.Th>Abertas</Table.Th>
                                            <Table.Th>Cliques</Table.Th>
                                            <Table.Th>Ações</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {MOCK_CAMPAIGNS.map((campaign) => (
                                            <Table.Tr key={campaign.id}>
                                                <Table.Td>
                                                    <Text size="sm" fw={500}>{campaign.name}</Text>
                                                    <Text size="xs" c="dimmed">{campaign.createdAt}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge
                                                        leftSection={campaign.type === 'whatsapp' ? <IconBrandWhatsapp size={12} /> : <IconMail size={12} />}
                                                        color={campaign.type === 'whatsapp' ? 'green' : 'blue'}
                                                        variant="light"
                                                    >
                                                        {campaign.type}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge
                                                        color={campaign.status === 'active' ? 'green' : 'yellow'}
                                                        variant="dot"
                                                    >
                                                        {campaign.status === 'active' ? 'Ativa' : 'Pausada'}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>{campaign.sent.toLocaleString()}</Table.Td>
                                                <Table.Td>
                                                    <Group gap={4}>
                                                        <Text size="sm">{campaign.delivered.toLocaleString()}</Text>
                                                        <Text size="xs" c="dimmed">
                                                            ({Math.round((campaign.delivered / campaign.sent) * 100)}%)
                                                        </Text>
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Group gap={4}>
                                                        <Text size="sm">{campaign.opened.toLocaleString()}</Text>
                                                        <Text size="xs" c="dimmed">
                                                            ({Math.round((campaign.opened / campaign.delivered) * 100)}%)
                                                        </Text>
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>{campaign.clicks}</Table.Td>
                                                <Table.Td>
                                                    <Menu shadow="md" width={150}>
                                                        <Menu.Target>
                                                            <ActionIcon variant="subtle">
                                                                <IconDotsVertical size={16} />
                                                            </ActionIcon>
                                                        </Menu.Target>
                                                        <Menu.Dropdown>
                                                            <Menu.Item leftSection={campaign.status === 'active' ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}>
                                                                {campaign.status === 'active' ? 'Pausar' : 'Ativar'}
                                                            </Menu.Item>
                                                            <Menu.Item leftSection={<IconEdit size={14} />}>Editar</Menu.Item>
                                                            <Menu.Divider />
                                                            <Menu.Item color="red" leftSection={<IconTrash size={14} />}>Excluir</Menu.Item>
                                                        </Menu.Dropdown>
                                                    </Menu>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                        </Tabs.Panel>
                    </Tabs>
                </Card>
            </Stack>

            {/* New Campaign Modal */}
            <Modal opened={modalOpened} onClose={closeModal} title="Nova Campanha" size="lg">
                <Stack gap="md">
                    <TextInput label="Nome da Campanha" placeholder="Ex: Black Friday 2026" required />
                    <Select
                        label="Canal"
                        data={[
                            { value: 'whatsapp', label: '💬 WhatsApp' },
                            { value: 'email', label: '📧 Email' },
                        ]}
                        defaultValue="whatsapp"
                    />
                    <Select
                        label="Segmento"
                        data={[
                            { value: 'all', label: 'Todos os contatos' },
                            { value: 'leads', label: 'Apenas Leads' },
                            { value: 'clients', label: 'Apenas Clientes' },
                        ]}
                        defaultValue="all"
                    />
                    <div>
                        <Text size="sm" fw={500} mb={4}>Mensagem</Text>
                        <RichTextEditor
                            content={messageContent}
                            onChange={setMessageContent}
                            placeholder="Digite sua mensagem..."
                            minHeight={150}
                            maxHeight={300}
                        />
                    </div>
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button leftSection={<IconSend size={16} />}>Enviar Agora</Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
