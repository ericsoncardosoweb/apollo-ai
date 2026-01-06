/**
 * Companies Management Page - Simplified
 * Just name field for now
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    Loader,
    Center,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconSearch,
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconEye,
    IconBuilding,
    IconRefresh,
    IconDatabase,
} from '@tabler/icons-react'
import { useViewContext } from '@/contexts/ViewContext'
import {
    useCompanies,
    useCreateCompany,
    useDeleteCompany,
    Company,
} from '@/hooks/useCompanies'
import DatabaseSetupForm from '@/components/company/DatabaseSetupForm'

export default function AdminCompanies() {
    const navigate = useNavigate()
    const { switchToCompanyView } = useViewContext()
    const [search, setSearch] = useState('')
    const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure()

    // Form state - just name for now
    const [newCompanyName, setNewCompanyName] = useState('')
    const [configCompany, setConfigCompany] = useState<Company | null>(null)
    const [configOpened, { open: openConfig, close: closeConfig }] = useDisclosure()

    // Queries and mutations
    const { data: companies, isLoading, refetch } = useCompanies()
    const createCompany = useCreateCompany()
    const deleteCompany = useDeleteCompany()

    // Filter companies by search
    const filteredCompanies = (companies || []).filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase())
    )

    const handleViewAsCompany = (company: Company) => {
        switchToCompanyView({
            id: company.id,
            name: company.name,
            slug: company.slug,
            plan: (company.plan || 'starter') as 'starter' | 'pro' | 'enterprise',
            whatsapp_number: null,
            owner_id: null,
            is_active: company.status === 'active',
            created_at: company.created_at,
        })
        navigate('/admin')
    }

    const handleDelete = (companyId: string) => {
        if (confirm('Tem certeza que deseja excluir esta empresa?')) {
            deleteCompany.mutate(companyId)
        }
    }

    const handleCreateCompany = () => {
        if (!newCompanyName.trim()) return

        createCompany.mutate({
            name: newCompanyName,
        }, {
            onSuccess: () => {
                setNewCompanyName('')
                closeCreate()
            }
        })
    }

    // Loading state
    if (isLoading) {
        return (
            <Center h={400}>
                <Stack align="center">
                    <Loader size="lg" />
                    <Text c="dimmed">Carregando empresas...</Text>
                </Stack>
            </Center>
        )
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Empresas Cadastradas</Title>
                        <Text c="dimmed" size="sm">Gerencie as empresas clientes da plataforma</Text>
                    </div>
                    <Group>
                        <Button
                            variant="subtle"
                            leftSection={<IconRefresh size={16} />}
                            onClick={() => refetch()}
                        >
                            Atualizar
                        </Button>
                        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                            Nova Empresa
                        </Button>
                    </Group>
                </Group>

                <Card withBorder padding="md" radius="md">
                    <TextInput
                        placeholder="Buscar empresa por nome ou slug..."
                        leftSection={<IconSearch size={16} />}
                        mb="md"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="sm" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Empresa</Table.Th>
                                    <Table.Th>Slug</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Ações</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {filteredCompanies.map((company) => (
                                    <Table.Tr
                                        key={company.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleViewAsCompany(company)}
                                    >
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Avatar radius="xl" color="indigo">{company.name.charAt(0)}</Avatar>
                                                <Text fw={500}>{company.name}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" c="dimmed">{company.slug}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color={company.status === 'active' ? 'green' : 'red'} variant="dot">
                                                {company.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td onClick={(e) => e.stopPropagation()}>
                                            <Menu shadow="md" width={180}>
                                                <Menu.Target>
                                                    <ActionIcon variant="subtle" color="gray">
                                                        <IconDotsVertical size={16} />
                                                    </ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    <Menu.Item
                                                        leftSection={<IconEye size={14} />}
                                                        onClick={() => handleViewAsCompany(company)}
                                                    >
                                                        Administrar
                                                    </Menu.Item>
                                                    <Menu.Item
                                                        leftSection={<IconDatabase size={14} />}
                                                        onClick={() => {
                                                            setConfigCompany(company)
                                                            openConfig()
                                                        }}
                                                    >
                                                        Configurar Banco
                                                    </Menu.Item>
                                                    <Menu.Divider />
                                                    <Menu.Item
                                                        color="red"
                                                        leftSection={<IconTrash size={14} />}
                                                        onClick={() => handleDelete(company.id)}
                                                    >
                                                        Remover
                                                    </Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {filteredCompanies.length === 0 && (
                        <Stack align="center" py="xl">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                                <IconBuilding size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">
                                {search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
                            </Text>
                            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openCreate}>
                                Cadastrar nova empresa
                            </Button>
                        </Stack>
                    )}
                </Card>
            </Stack>

            {/* Create Company Modal - SIMPLIFIED */}
            <Modal
                opened={createOpened}
                onClose={closeCreate}
                title={
                    <Group gap="xs">
                        <ThemeIcon color="indigo" variant="light">
                            <IconBuilding size={16} />
                        </ThemeIcon>
                        <Text fw={600}>Nova Empresa</Text>
                    </Group>
                }
                centered
                size="sm"
            >
                <Stack>
                    <TextInput
                        label="Nome da Empresa"
                        placeholder="Ex: Minha Empresa Ltda"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        required
                        autoFocus
                    />
                    <Group justify="flex-end" mt="md">
                        <Button variant="subtle" onClick={closeCreate}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateCompany}
                            leftSection={<IconPlus size={16} />}
                            loading={createCompany.isPending}
                            disabled={!newCompanyName.trim()}
                        >
                            Cadastrar
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Database Config Modal */}
            <Modal
                opened={configOpened}
                onClose={closeConfig}
                title={
                    <Group gap="xs">
                        <ThemeIcon color="blue" variant="light">
                            <IconDatabase size={16} />
                        </ThemeIcon>
                        <Text fw={600}>Configurar Banco de Dados</Text>
                    </Group>
                }
                centered
                size="lg"
            >
                {configCompany && (
                    <DatabaseSetupForm
                        tenantId={configCompany.id}
                        tenantName={configCompany.name}
                        onComplete={closeConfig}
                    />
                )}
            </Modal>
        </>
    )
}
