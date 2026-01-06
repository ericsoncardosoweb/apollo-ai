import { Title, Text, Card, Stack, Group, Button, TextInput, Badge, Avatar, Table, ActionIcon, Menu } from '@mantine/core'
import { IconSearch, IconPlus, IconDotsVertical, IconEdit, IconTrash, IconMail } from '@tabler/icons-react'

const users = [
    { id: '1', name: 'João Silva', email: 'joao@techcorp.com', role: 'admin', company: 'TechCorp', lastActive: 'Agora' },
    { id: '2', name: 'Maria Santos', email: 'maria@vendas.com', role: 'operator', company: 'Vendas Express', lastActive: '5 min' },
    { id: '3', name: 'Carlos Lima', email: 'carlos@abc.com', role: 'viewer', company: 'Consultoria ABC', lastActive: '1h' },
]

export default function AdminUsers() {
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Usuários</Title>
                    <Text c="dimmed" size="sm">Gerencie os usuários do sistema</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />}>
                    Novo Usuário
                </Button>
            </Group>

            <Card withBorder padding="md" radius="md">
                <TextInput
                    placeholder="Buscar usuário..."
                    leftSection={<IconSearch size={16} />}
                    mb="md"
                />

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
                            {users.map((user) => (
                                <Table.Tr key={user.id}>
                                    <Table.Td>
                                        <Group gap="sm">
                                            <Avatar radius="xl" color="indigo">{user.name.charAt(0)}</Avatar>
                                            <div>
                                                <Text fw={500}>{user.name}</Text>
                                                <Text size="xs" c="dimmed">{user.email}</Text>
                                            </div>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={user.role === 'admin' ? 'red' : user.role === 'operator' ? 'blue' : 'gray'}
                                            variant="light"
                                        >
                                            {user.role}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>{user.company}</Table.Td>
                                    <Table.Td>
                                        <Badge color="green" variant="dot" size="sm">{user.lastActive}</Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Menu shadow="md" width={150}>
                                            <Menu.Target>
                                                <ActionIcon variant="subtle" color="gray">
                                                    <IconDotsVertical size={16} />
                                                </ActionIcon>
                                            </Menu.Target>
                                            <Menu.Dropdown>
                                                <Menu.Item leftSection={<IconEdit size={14} />}>Editar</Menu.Item>
                                                <Menu.Item leftSection={<IconMail size={14} />}>Enviar email</Menu.Item>
                                                <Menu.Divider />
                                                <Menu.Item color="red" leftSection={<IconTrash size={14} />}>Remover</Menu.Item>
                                            </Menu.Dropdown>
                                        </Menu>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            </Card>
        </Stack>
    )
}
