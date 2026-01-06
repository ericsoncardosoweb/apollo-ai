import { Title, Text, Card, Stack, Group, Button, Badge, Code, Table, ActionIcon, Switch, CopyButton, Tooltip } from '@mantine/core'
import { IconPlus, IconCopy, IconCheck, IconTrash, IconRefresh } from '@tabler/icons-react'

const webhooks = [
    { id: '1', name: 'Evolution API', url: 'https://evo.api/webhook', events: ['message.received', 'message.sent'], active: true },
    { id: '2', name: 'CRM Sync', url: 'https://crm.example/hook', events: ['lead.created', 'deal.updated'], active: true },
    { id: '3', name: 'Analytics', url: 'https://analytics.io/ingest', events: ['conversation.ended'], active: false },
]

export default function AdminWebhooks() {
    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Webhooks</Title>
                    <Text c="dimmed" size="sm">Configure integrações e eventos externos</Text>
                </div>
                <Button leftSection={<IconPlus size={16} />}>
                    Novo Webhook
                </Button>
            </Group>

            <Card withBorder padding="md" radius="md">
                <Table.ScrollContainer minWidth={800}>
                    <Table verticalSpacing="md" highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Nome</Table.Th>
                                <Table.Th>URL</Table.Th>
                                <Table.Th>Eventos</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Ações</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {webhooks.map((webhook) => (
                                <Table.Tr key={webhook.id}>
                                    <Table.Td>
                                        <Text fw={500}>{webhook.name}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Code>{webhook.url.substring(0, 30)}...</Code>
                                            <CopyButton value={webhook.url}>
                                                {({ copied, copy }) => (
                                                    <Tooltip label={copied ? 'Copiado!' : 'Copiar URL'}>
                                                        <ActionIcon variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
                                                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                            </CopyButton>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={4}>
                                            {webhook.events.map((event) => (
                                                <Badge key={event} size="xs" variant="outline" color="indigo">
                                                    {event}
                                                </Badge>
                                            ))}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Switch
                                            checked={webhook.active}
                                            color="green"
                                            size="sm"
                                        />
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <ActionIcon variant="subtle" color="blue">
                                                <IconRefresh size={16} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" color="red">
                                                <IconTrash size={16} />
                                            </ActionIcon>
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
