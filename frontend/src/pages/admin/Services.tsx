/**
 * Admin Services - Catálogo de Serviços (conectado ao banco do CLIENTE)
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
    ActionIcon,
    Modal,
    ThemeIcon,
    Paper,
    SimpleGrid,
    Table,
    NumberInput,
    Textarea,
    Switch,
    Skeleton,
    Alert,
    Avatar,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconSearch,
    IconTrash,
    IconEdit,
    IconRefresh,
    IconPackage,
    IconCurrencyReal,
    IconCheck,
    IconDatabase,
} from '@tabler/icons-react'
import {
    useClientServices,
    useCreateClientService,
    useUpdateClientService,
    useDeleteClientService,
    useClientServicesStats,
    ClientService,
} from '@/hooks/useClientServices'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'

export default function AdminServices() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [search, setSearch] = useState('')

    // Form state
    const [editingService, setEditingService] = useState<ClientService | null>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [price, setPrice] = useState<number | ''>(0)
    const [isActive, setIsActive] = useState(true)

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Client Database Hooks
    const { data: services, isLoading, refetch } = useClientServices()
    const { data: stats } = useClientServicesStats()
    const createService = useCreateClientService()
    const updateService = useUpdateClientService()
    const deleteService = useDeleteClientService()

    const resetForm = () => {
        setName('')
        setDescription('')
        setPrice(0)
        setIsActive(true)
        setEditingService(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (service: ClientService) => {
        setEditingService(service)
        setName(service.name)
        setDescription(service.description || '')
        setPrice(service.price || 0)
        setIsActive(service.is_active)
        openModal()
    }

    const handleSubmit = async () => {
        if (editingService) {
            await updateService.mutateAsync({
                id: editingService.id,
                name,
                description,
                price: typeof price === 'number' ? price : 0,
                is_active: isActive,
            })
        } else {
            await createService.mutateAsync({
                name,
                description,
                price: typeof price === 'number' ? price : 0,
                is_active: isActive,
            })
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover este serviço?')) {
            deleteService.mutate(id)
        }
    }

    // Filter services by search
    const filteredServices = services?.filter(service =>
        service.name.toLowerCase().includes(search.toLowerCase()) ||
        (service.description?.toLowerCase().includes(search.toLowerCase()))
    ) || []

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Serviços</Title>
                        <Text c="dimmed" size="sm">
                            Catálogo de serviços de {selectedCompany?.name || 'empresa'}
                        </Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate} disabled={!isConfigured}>
                        Novo Serviço
                    </Button>
                </Group>

                {/* Alert se banco não configurado */}
                {!isConfigured && (
                    <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                        Configure o banco de dados do cliente para gerenciar serviços.
                        Acesse Empresas → Configurar Banco de Dados.
                    </Alert>
                )}

                {/* Stats */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="blue">
                                <IconPackage size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.total || 0}</Text>
                                <Text size="xs" c="dimmed">Total Serviços</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="green">
                                <IconCheck size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.active || 0}</Text>
                                <Text size="xs" c="dimmed">Ativos</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="orange">
                                <IconCurrencyReal size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>
                                    R$ {(stats?.averagePrice || 0).toLocaleString('pt-BR')}
                                </Text>
                                <Text size="xs" c="dimmed">Preço Médio</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="teal">
                                <IconCurrencyReal size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>
                                    R$ {((stats?.averagePrice || 0) * (stats?.active || 0)).toLocaleString('pt-BR')}
                                </Text>
                                <Text size="xs" c="dimmed">Valor Total</Text>
                            </div>
                        </Group>
                    </Paper>
                </SimpleGrid>

                {/* Services List */}
                <Card withBorder padding="md" radius="md">
                    <Group gap="md" mb="md">
                        <TextInput
                            placeholder="Buscar serviço..."
                            leftSection={<IconSearch size={16} />}
                            style={{ flex: 1 }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
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
                    ) : filteredServices.length > 0 ? (
                        <Table.ScrollContainer minWidth={500}>
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Serviço</Table.Th>
                                        <Table.Th>Preço</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Ações</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredServices.map((service) => (
                                        <Table.Tr key={service.id}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar color="blue" radius="xl">
                                                        <IconPackage size={18} />
                                                    </Avatar>
                                                    <div>
                                                        <Text size="sm" fw={500}>{service.name}</Text>
                                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                                            {service.description || '-'}
                                                        </Text>
                                                    </div>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" fw={500}>
                                                    R$ {(service.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge color={service.is_active ? 'green' : 'gray'} variant="light">
                                                    {service.is_active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <ActionIcon variant="light" onClick={() => handleOpenEdit(service)}>
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                    <ActionIcon variant="light" color="red" onClick={() => handleDelete(service.id)}>
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    ) : (
                        <Paper p="xl" ta="center" bg="dark.6" radius="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                <IconPackage size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">Nenhum serviço encontrado</Text>
                            <Button variant="light" mt="md" onClick={handleOpenCreate} disabled={!isConfigured}>
                                Adicionar primeiro serviço
                            </Button>
                        </Paper>
                    )}
                </Card>
            </Stack>

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpened}
                onClose={() => { closeModal(); resetForm(); }}
                title={editingService ? 'Editar Serviço' : 'Novo Serviço'}
                size="md"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome do Serviço"
                        placeholder="Ex: Consulta Básica"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Textarea
                        label="Descrição"
                        placeholder="Descrição do serviço..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                    />
                    <NumberInput
                        label="Preço"
                        placeholder="0,00"
                        prefix="R$ "
                        decimalScale={2}
                        decimalSeparator=","
                        thousandSeparator="."
                        value={price}
                        onChange={(val) => setPrice(typeof val === 'number' ? val : 0)}
                    />
                    <Switch
                        label="Serviço ativo"
                        description="Serviços inativos não aparecem para os clientes"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createService.isPending || updateService.isPending}
                            disabled={!name}
                        >
                            {editingService ? 'Salvar' : 'Criar Serviço'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
