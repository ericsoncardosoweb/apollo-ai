/**
 * Users Management Page - Dynamic with Supabase
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
    Select,
    Skeleton,
    Paper,
    ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconSearch,
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconMail,
    IconUsers,
    IconRefresh,
} from '@tabler/icons-react'
import { useUsers, useUpdateUser, useDeactivateUser, UserProfile } from '@/hooks/useUsers'

const ROLE_COLORS: Record<string, string> = {
    master: 'red',
    admin: 'orange',
    operator: 'blue',
    viewer: 'gray',
    client: 'green',
}

const ROLE_LABELS: Record<string, string> = {
    master: 'Master',
    admin: 'Admin',
    operator: 'Operador',
    viewer: 'Visualizador',
    client: 'Cliente',
}

export default function AdminUsers() {
    const [search, setSearch] = useState('')
    const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure()
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
    const [editRole, setEditRole] = useState<string | null>(null)

    // Queries
    const { data: users, isLoading, refetch } = useUsers()
    const updateUser = useUpdateUser()
    const deactivateUser = useDeactivateUser()

    // Filter users
    const filteredUsers = users?.filter(user => {
        if (!search) return true
        const query = search.toLowerCase()
        return (
            user.name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.role?.toLowerCase().includes(query)
        )
    }) || []

    const handleEdit = (user: UserProfile) => {
        setSelectedUser(user)
        setEditRole(user.role)
        openEditModal()
    }

    const handleSaveEdit = async () => {
        if (!selectedUser || !editRole) return
        await updateUser.mutateAsync({
            id: selectedUser.id,
            role: editRole,
        })
        closeEditModal()
        setSelectedUser(null)
    }

    const handleDeactivate = (id: string) => {
        if (confirm('Tem certeza que deseja desativar este usuário?')) {
            deactivateUser.mutate(id)
        }
    }

    const formatLastActive = (lastSignIn: string | null) => {
        if (!lastSignIn) return 'Nunca'
        const date = new Date(lastSignIn)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Agora'
        if (diffMins < 60) return `${diffMins} min`
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
        return date.toLocaleDateString('pt-BR')
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Usuários</Title>
                        <Text c="dimmed" size="sm">
                            Gerencie os usuários do sistema
                        </Text>
                    </div>
                    <Group>
                        <Button
                            variant="subtle"
                            leftSection={<IconRefresh size={16} />}
                            onClick={() => refetch()}
                            loading={isLoading}
                        >
                            Atualizar
                        </Button>
                        <Button leftSection={<IconPlus size={16} />}>
                            Novo Usuário
                        </Button>
                    </Group>
                </Group>

                {/* Stats */}
                <Group>
                    <Badge size="lg" variant="light" color="teal">
                        {users?.length || 0} usuários
                    </Badge>
                    <Badge size="lg" variant="light" color="blue">
                        {users?.filter(u => u.role === 'operator').length || 0} operadores
                    </Badge>
                    <Badge size="lg" variant="light" color="green">
                        {users?.filter(u => u.is_active).length || 0} ativos
                    </Badge>
                </Group>

                <Card withBorder padding="md" radius="md">
                    <TextInput
                        placeholder="Buscar usuário..."
                        leftSection={<IconSearch size={16} />}
                        mb="md"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    {isLoading ? (
                        <Stack>
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} height={50} />
                            ))}
                        </Stack>
                    ) : filteredUsers.length === 0 ? (
                        <Paper p="xl" ta="center" bg="dark.6" radius="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                <IconUsers size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">Nenhum usuário encontrado</Text>
                        </Paper>
                    ) : (
                        <Table.ScrollContainer minWidth={700}>
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Usuário</Table.Th>
                                        <Table.Th>Papel</Table.Th>
                                        <Table.Th>Empresa</Table.Th>
                                        <Table.Th>Último Acesso</Table.Th>
                                        <Table.Th>Ações</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredUsers.map((user) => (
                                        <Table.Tr key={user.id} opacity={user.is_active ? 1 : 0.5}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar
                                                        radius="xl"
                                                        color={ROLE_COLORS[user.role] || 'gray'}
                                                        src={user.avatar_url}
                                                    >
                                                        {user.name?.charAt(0) || 'U'}
                                                    </Avatar>
                                                    <div>
                                                        <Text fw={500}>{user.name || 'Sem nome'}</Text>
                                                        <Text size="xs" c="dimmed">{user.email}</Text>
                                                    </div>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    color={ROLE_COLORS[user.role] || 'gray'}
                                                    variant="light"
                                                >
                                                    {ROLE_LABELS[user.role] || user.role}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{user.tenant_name || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    color={user.last_sign_in_at ? 'green' : 'gray'}
                                                    variant="dot"
                                                    size="sm"
                                                >
                                                    {formatLastActive(user.last_sign_in_at)}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Menu shadow="md" width={150}>
                                                    <Menu.Target>
                                                        <ActionIcon variant="subtle" color="gray">
                                                            <IconDotsVertical size={16} />
                                                        </ActionIcon>
                                                    </Menu.Target>
                                                    <Menu.Dropdown>
                                                        <Menu.Item
                                                            leftSection={<IconEdit size={14} />}
                                                            onClick={() => handleEdit(user)}
                                                        >
                                                            Editar
                                                        </Menu.Item>
                                                        <Menu.Item leftSection={<IconMail size={14} />}>
                                                            Enviar email
                                                        </Menu.Item>
                                                        <Menu.Divider />
                                                        <Menu.Item
                                                            color="red"
                                                            leftSection={<IconTrash size={14} />}
                                                            onClick={() => handleDeactivate(user.id)}
                                                        >
                                                            Desativar
                                                        </Menu.Item>
                                                    </Menu.Dropdown>
                                                </Menu>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    )}
                </Card>
            </Stack>

            {/* Edit Modal */}
            <Modal
                opened={editModalOpened}
                onClose={closeEditModal}
                title="Editar Usuário"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome"
                        value={selectedUser?.name || ''}
                        disabled
                    />
                    <TextInput
                        label="Email"
                        value={selectedUser?.email || ''}
                        disabled
                    />
                    <Select
                        label="Papel"
                        data={[
                            { value: 'master', label: 'Master' },
                            { value: 'admin', label: 'Admin' },
                            { value: 'operator', label: 'Operador' },
                            { value: 'viewer', label: 'Visualizador' },
                            { value: 'client', label: 'Cliente' },
                        ]}
                        value={editRole}
                        onChange={setEditRole}
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeEditModal}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            loading={updateUser.isPending}
                        >
                            Salvar
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
