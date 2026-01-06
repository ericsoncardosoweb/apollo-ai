import { Title, Text, Card, Stack, Group, Button, TextInput, Badge, Avatar, Table, ActionIcon, Menu } from '@mantine/core'
import { IconSearch, IconPlus, IconDotsVertical, IconBrandWhatsapp, IconMail, IconPhone, IconTag } from '@tabler/icons-react'

const contacts = [
    { id: '1', name: 'João Silva', phone: '+55 11 99999-1234', email: 'joao@email.com', tags: ['Lead', 'Hot'], lastContact: 'Hoje' },
    { id: '2', name: 'Maria Santos', phone: '+55 21 98888-5678', email: 'maria@empresa.com', tags: ['Cliente'], lastContact: 'Ontem' },
    { id: '3', name: 'Carlos Lima', phone: '+55 31 97777-9012', email: 'carlos@tech.io', tags: ['Lead'], lastContact: '3 dias' },
    { id: '4', name: 'Ana Pereira', phone: '+55 41 96666-3456', email: 'ana@startup.com', tags: ['Cliente', 'VIP'], lastContact: '1 semana' },
]

export default function AppContacts() {
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Contatos</Title>
                    <Text c="dimmed" size="sm">Base de contatos e leads</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />} color="teal">
                    Novo Contato
                </Button>
            </Group>

            <Card withBorder padding="md" radius="md">
                <TextInput
                    placeholder="Buscar contato..."
                    leftSection={<IconSearch size={16} />}
                    mb="md"
                />

                <Table.ScrollContainer minWidth={800}>
                    <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Contato</Table.Th>
                                <Table.Th>Telefone</Table.Th>
                                <Table.Th>Tags</Table.Th>
                                <Table.Th>Último Contato</Table.Th>
                                <Table.Th>Ações</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {contacts.map((contact) => (
                                <Table.Tr key={contact.id}>
                                    <Table.Td>
                                        <Group gap="sm">
                                            <Avatar radius="xl" color="teal">{contact.name.charAt(0)}</Avatar>
                                            <div>
                                                <Text fw={500}>{contact.name}</Text>
                                                <Text size="xs" c="dimmed">{contact.email}</Text>
                                            </div>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{contact.phone}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={4}>
                                            {contact.tags.map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    size="xs"
                                                    variant="light"
                                                    color={tag === 'VIP' ? 'yellow' : tag === 'Hot' ? 'red' : tag === 'Cliente' ? 'green' : 'gray'}
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">{contact.lastContact}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <ActionIcon variant="subtle" color="green">
                                                <IconBrandWhatsapp size={16} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" color="blue">
                                                <IconPhone size={16} />
                                            </ActionIcon>
                                            <Menu shadow="md" width={150}>
                                                <Menu.Target>
                                                    <ActionIcon variant="subtle" color="gray">
                                                        <IconDotsVertical size={16} />
                                                    </ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    <Menu.Item leftSection={<IconMail size={14} />}>Enviar email</Menu.Item>
                                                    <Menu.Item leftSection={<IconTag size={14} />}>Adicionar tag</Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </Group>
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
