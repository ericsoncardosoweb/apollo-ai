/**
 * Admin Contacts - Base de Contatos (conectado ao banco do CLIENTE)
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
    Avatar,
    Table,
    ActionIcon,
    Menu,
    Modal,
    ThemeIcon,
    Paper,
    SimpleGrid,
    Skeleton,
    TagsInput,
    Alert,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconSearch,
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconMessageCircle,
    IconDownload,
    IconUpload,
    IconUsers,
    IconFilter,
    IconRefresh,
    IconDatabase,
} from '@tabler/icons-react'
import { PhoneInput, EmailInput } from '@/components/form'
import {
    useClientLeads,
    useCreateClientLead,
    useUpdateClientLead,
    useDeleteClientLead,
    useClientLeadsStats,
    ClientLead,
} from '@/hooks/useClientLeads'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'

export default function AdminContacts() {
    const [search, setSearch] = useState('')
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [editingLead, setEditingLead] = useState<ClientLead | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [tags, setTags] = useState<string[]>([])

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured, status } = useClientDatabaseStatus()

    // Client Database Hooks
    const { data: leads, isLoading, refetch } = useClientLeads()
    const { data: stats } = useClientLeadsStats()
    const createLead = useCreateClientLead()
    const updateLead = useUpdateClientLead()
    const deleteLead = useDeleteClientLead()

    const resetForm = () => {
        setName('')
        setEmail('')
        setPhone('')
        setTags([])
        setEditingLead(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (lead: ClientLead) => {
        setEditingLead(lead)
        setName(lead.name || '')
        setEmail(lead.email || '')
        setPhone(lead.phone || '')
        setTags(lead.tags || [])
        openModal()
    }

    const handleSubmit = async () => {
        if (editingLead) {
            await updateLead.mutateAsync({
                id: editingLead.id,
                name,
                email,
                phone,
                tags,
            })
        } else {
            await createLead.mutateAsync({
                name,
                email,
                phone,
                tags,
                source: 'manual',
            })
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover este contato?')) {
            deleteLead.mutate(id)
        }
    }

    const filteredLeads = leads?.filter(lead =>
        (lead.name?.toLowerCase().includes(search.toLowerCase())) ||
        (lead.phone?.includes(search)) ||
        (lead.email?.toLowerCase().includes(search.toLowerCase()))
    ) || []

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Contatos</Title>
                        <Text c="dimmed" size="sm">
                            Base de contatos de {selectedCompany?.name || 'empresa'}
                        </Text>
                    </div>
                    <Group>
                        <Button variant="light" leftSection={<IconUpload size={16} />} disabled={!isConfigured}>
                            Importar
                        </Button>
                        <Button variant="light" leftSection={<IconDownload size={16} />} disabled={!isConfigured}>
                            Exportar
                        </Button>
                        <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate} disabled={!isConfigured}>
                            Novo Contato
                        </Button>
                    </Group>
                </Group>

                {/* Alert se banco não configurado */}
                {!isConfigured && (
                    <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                        Configure o banco de dados do cliente para gerenciar contatos.
                        Acesse Empresas → Configurar Banco de Dados.
                    </Alert>
                )}

                {/* Stats */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="blue">
                                <IconUsers size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.total || 0}</Text>
                                <Text size="xs" c="dimmed">Total de Contatos</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="green">
                                <IconMessageCircle size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>
                                    {Object.keys(stats?.byStatus || {}).length}
                                </Text>
                                <Text size="xs" c="dimmed">Status Diferentes</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="orange">
                                <IconPlus size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.newThisMonth || 0}</Text>
                                <Text size="xs" c="dimmed">Novos (mês)</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="teal">
                                <Badge size="xs">Lead</Badge>
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{leads?.length || 0}</Text>
                                <Text size="xs" c="dimmed">Leads Ativos</Text>
                            </div>
                        </Group>
                    </Paper>
                </SimpleGrid>

                <Card withBorder padding="md" radius="md">
                    <Group gap="md" mb="md">
                        <TextInput
                            placeholder="Buscar contato..."
                            leftSection={<IconSearch size={16} />}
                            style={{ flex: 1 }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Button variant="light" leftSection={<IconFilter size={16} />}>
                            Filtros
                        </Button>
                        <ActionIcon variant="light" onClick={() => refetch()}>
                            <IconRefresh size={16} />
                        </ActionIcon>
                    </Group>

                    {isLoading ? (
                        <Stack gap="sm">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} height={60} radius="sm" />
                            ))}
                        </Stack>
                    ) : filteredLeads.length > 0 ? (
                        <Table.ScrollContainer minWidth={700}>
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Contato</Table.Th>
                                        <Table.Th>Telefone</Table.Th>
                                        <Table.Th>Tags</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Score</Table.Th>
                                        <Table.Th>Ações</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredLeads.map((contact) => (
                                        <Table.Tr key={contact.id}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar color="blue" radius="xl">
                                                        {contact.name?.charAt(0) || '?'}
                                                    </Avatar>
                                                    <div>
                                                        <Text size="sm" fw={500}>{contact.name || 'Sem nome'}</Text>
                                                        <Text size="xs" c="dimmed">{contact.email || '-'}</Text>
                                                    </div>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{contact.phone || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    {contact.tags?.slice(0, 2).map((tag) => (
                                                        <Badge key={tag} size="xs" variant="light">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                    {contact.tags && contact.tags.length > 2 && (
                                                        <Badge size="xs" variant="outline">+{contact.tags.length - 2}</Badge>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    size="sm"
                                                    color={contact.status === 'new' ? 'blue' : contact.status === 'qualified' ? 'green' : 'gray'}
                                                    variant="light"
                                                >
                                                    {contact.status || 'Novo'}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" fw={500}>
                                                    {contact.score || 0}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Menu shadow="md" width={150}>
                                                    <Menu.Target>
                                                        <ActionIcon variant="subtle">
                                                            <IconDotsVertical size={16} />
                                                        </ActionIcon>
                                                    </Menu.Target>
                                                    <Menu.Dropdown>
                                                        <Menu.Item leftSection={<IconMessageCircle size={14} />}>
                                                            Iniciar Chat
                                                        </Menu.Item>
                                                        <Menu.Item
                                                            leftSection={<IconEdit size={14} />}
                                                            onClick={() => handleOpenEdit(contact)}
                                                        >
                                                            Editar
                                                        </Menu.Item>
                                                        <Menu.Divider />
                                                        <Menu.Item
                                                            color="red"
                                                            leftSection={<IconTrash size={14} />}
                                                            onClick={() => handleDelete(contact.id)}
                                                        >
                                                            Excluir
                                                        </Menu.Item>
                                                    </Menu.Dropdown>
                                                </Menu>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    ) : (
                        <Paper p="xl" ta="center" bg="dark.6" radius="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                <IconUsers size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">Nenhum contato encontrado</Text>
                            <Button variant="light" mt="md" onClick={handleOpenCreate}>
                                Adicionar primeiro contato
                            </Button>
                        </Paper>
                    )}
                </Card>
            </Stack>

            {/* New/Edit Contact Modal */}
            <Modal
                opened={modalOpened}
                onClose={closeModal}
                title={editingLead ? 'Editar Contato' : 'Novo Contato'}
                size="md"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome"
                        placeholder="Nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <PhoneInput
                        label="Telefone"
                        value={phone}
                        onChange={setPhone}
                    />
                    <EmailInput
                        label="Email"
                        placeholder="email@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TagsInput
                        label="Tags"
                        placeholder="Pressione Enter para adicionar"
                        value={tags}
                        onChange={setTags}
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createLead.isPending || updateLead.isPending}
                            disabled={!name}
                        >
                            {editingLead ? 'Salvar' : 'Criar Contato'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
