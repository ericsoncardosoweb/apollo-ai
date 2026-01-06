import { Title, Text, Card, Stack, Group, Button, TextInput, Badge, Avatar, Table, ActionIcon, Menu } from '@mantine/core'
import { IconSearch, IconPlus, IconDotsVertical, IconEdit, IconTrash, IconEye } from '@tabler/icons-react'

const companies = [
    { id: '1', name: 'TechCorp Ltda', plan: 'enterprise', agents: 5, conversations: 2340, status: 'active' },
    { id: '2', name: 'Vendas Express', plan: 'pro', agents: 3, conversations: 1250, status: 'active' },
    { id: '3', name: 'Consultoria ABC', plan: 'starter', agents: 1, conversations: 450, status: 'active' },
    { id: '4', name: 'Loja Virtual XYZ', plan: 'pro', agents: 2, conversations: 890, status: 'inactive' },
]

export default function AdminCompanies() {
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Empresas Cadastradas</Title>
                    <Text c="dimmed" size="sm">Gerencie as empresas clientes da plataforma</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />}>
                    Nova Empresa
                </Button>
            </Group>

            <Card withBorder padding="md" radius="md">
                <TextInput
                    placeholder="Buscar empresa..."
                    leftSection={<IconSearch size={16} />}
                    mb="md"
                />

                <Table.ScrollContainer minWidth={800}>
                    <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Empresa</Table.Th>
                                <Table.Th>Plano</Table.Th>
                                <Table.Th>Agentes</Table.Th>
                                <Table.Th>Conversas</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Ações</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {companies.map((company) => (
                                <Table.Tr key={company.id}>
                                    <Table.Td>
                                        <Group gap="sm">
                                            <Avatar radius="xl" color="indigo">{company.name.charAt(0)}</Avatar>
                                            <Text fw={500}>{company.name}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={company.plan === 'enterprise' ? 'violet' : company.plan === 'pro' ? 'indigo' : 'gray'}
                                            variant="light"
                                        >
                                            {company.plan}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>{company.agents}</Table.Td>
                                    <Table.Td>{company.conversations.toLocaleString()}</Table.Td>
                                    <Table.Td>
                                        <Badge color={company.status === 'active' ? 'green' : 'red'} variant="dot">
                                            {company.status === 'active' ? 'Ativo' : 'Inativo'}
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
                                                <Menu.Item leftSection={<IconEye size={14} />}>Ver detalhes</Menu.Item>
                                                <Menu.Item leftSection={<IconEdit size={14} />}>Editar</Menu.Item>
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
