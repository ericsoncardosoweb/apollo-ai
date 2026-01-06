/**
 * Admin Tools - Ferramentas e Integrações
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
    Tabs,
    ThemeIcon,
    Paper,
    SimpleGrid,
    Switch,
    Code,
    CopyButton,
    Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconSettings,
    IconWebhook,
    IconApi,
    IconBrandGoogle,
    IconCalendar,
    IconDatabase,
    IconCopy,
    IconCheck,
    IconRefresh,
    IconExternalLink,
} from '@tabler/icons-react'

// Mock tools/integrations
const MOCK_TOOLS = [
    { id: '1', name: 'updateCRM', description: 'Atualiza status do lead no CRM', type: 'function', enabled: true },
    { id: '2', name: 'getProductInfo', description: 'Busca informações de produtos', type: 'function', enabled: true },
    { id: '3', name: 'scheduleAppointment', description: 'Agenda compromissos no calendário', type: 'function', enabled: false },
    { id: '4', name: 'sendEmail', description: 'Envia email para o cliente', type: 'function', enabled: true },
]

const MOCK_INTEGRATIONS = [
    { id: '1', name: 'Google Calendar', icon: IconCalendar, connected: true, lastSync: '06/01/2026 10:30' },
    { id: '2', name: 'Google Sheets', icon: IconDatabase, connected: true, lastSync: '06/01/2026 09:15' },
    { id: '3', name: 'RD Station', icon: IconBrandGoogle, connected: false, lastSync: null },
]

export default function AdminTools() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()

    const apiKey = 'ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Ferramentas</Title>
                        <Text c="dimmed" size="sm">Funções e integrações do agente</Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
                        Nova Função
                    </Button>
                </Group>

                <Tabs defaultValue="functions">
                    <Tabs.List>
                        <Tabs.Tab value="functions" leftSection={<IconSettings size={16} />}>
                            Funções
                        </Tabs.Tab>
                        <Tabs.Tab value="integrations" leftSection={<IconWebhook size={16} />}>
                            Integrações
                        </Tabs.Tab>
                        <Tabs.Tab value="api" leftSection={<IconApi size={16} />}>
                            API
                        </Tabs.Tab>
                    </Tabs.List>

                    {/* Functions Panel */}
                    <Tabs.Panel value="functions" pt="md">
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                            {MOCK_TOOLS.map((tool) => (
                                <Card key={tool.id} withBorder padding="md" radius="md">
                                    <Group justify="space-between">
                                        <Group gap="sm">
                                            <ThemeIcon variant="light" color={tool.enabled ? 'teal' : 'gray'}>
                                                <IconSettings size={18} />
                                            </ThemeIcon>
                                            <div>
                                                <Group gap="xs">
                                                    <Code>{tool.name}()</Code>
                                                    <Badge size="xs" variant="light">{tool.type}</Badge>
                                                </Group>
                                                <Text size="xs" c="dimmed">{tool.description}</Text>
                                            </div>
                                        </Group>
                                        <Switch defaultChecked={tool.enabled} color="teal" />
                                    </Group>
                                </Card>
                            ))}
                        </SimpleGrid>
                    </Tabs.Panel>

                    {/* Integrations Panel */}
                    <Tabs.Panel value="integrations" pt="md">
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                            {MOCK_INTEGRATIONS.map((integration) => (
                                <Card key={integration.id} withBorder padding="md" radius="md">
                                    <Group justify="space-between" mb="md">
                                        <Group gap="sm">
                                            <ThemeIcon variant="light" color={integration.connected ? 'green' : 'gray'}>
                                                <integration.icon size={18} />
                                            </ThemeIcon>
                                            <Text fw={500}>{integration.name}</Text>
                                        </Group>
                                        <Badge color={integration.connected ? 'green' : 'gray'} variant="dot">
                                            {integration.connected ? 'Conectado' : 'Desconectado'}
                                        </Badge>
                                    </Group>

                                    {integration.connected ? (
                                        <>
                                            <Text size="xs" c="dimmed">Última sincronia: {integration.lastSync}</Text>
                                            <Group mt="md">
                                                <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />}>
                                                    Sincronizar
                                                </Button>
                                                <Button size="xs" variant="subtle" color="red">
                                                    Desconectar
                                                </Button>
                                            </Group>
                                        </>
                                    ) : (
                                        <Button size="sm" variant="light" fullWidth mt="md" leftSection={<IconExternalLink size={14} />}>
                                            Conectar
                                        </Button>
                                    )}
                                </Card>
                            ))}
                        </SimpleGrid>
                    </Tabs.Panel>

                    {/* API Panel */}
                    <Tabs.Panel value="api" pt="md">
                        <Card withBorder padding="lg" radius="md">
                            <Text fw={600} mb="md">Chave de API</Text>
                            <Text size="sm" c="dimmed" mb="md">
                                Use esta chave para autenticar requisições à API do Apollo A.I.
                            </Text>

                            <Paper p="sm" bg="dark.7" radius="sm">
                                <Group justify="space-between">
                                    <Code>{apiKey}</Code>
                                    <CopyButton value={apiKey}>
                                        {({ copied, copy }) => (
                                            <Tooltip label={copied ? 'Copiado!' : 'Copiar'}>
                                                <ActionIcon color={copied ? 'green' : 'gray'} variant="subtle" onClick={copy}>
                                                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                    </CopyButton>
                                </Group>
                            </Paper>

                            <Group mt="md">
                                <Button variant="light" leftSection={<IconRefresh size={16} />}>
                                    Regenerar Chave
                                </Button>
                                <Button variant="subtle" leftSection={<IconExternalLink size={16} />}>
                                    Documentação
                                </Button>
                            </Group>
                        </Card>
                    </Tabs.Panel>
                </Tabs>
            </Stack>

            {/* New Function Modal */}
            <Modal opened={modalOpened} onClose={closeModal} title="Nova Função" size="md">
                <Stack gap="md">
                    <TextInput label="Nome da Função" placeholder="minhaFuncao" required />
                    <TextInput label="Descrição" placeholder="O que esta função faz?" />
                    <TextInput label="Endpoint (opcional)" placeholder="https://api.example.com/webhook" />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button>Criar Função</Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
