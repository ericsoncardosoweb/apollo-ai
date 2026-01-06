/**
 * Admin Tools - Ferramentas e Integrações Dinâmico
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
    Textarea,
    Select,
    JsonInput,
    Table,
    Skeleton,
    Alert,
    Progress,
    Avatar,
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
    IconTrash,
    IconEdit,
    IconPlayerPlay,
    IconCode,
    IconFunction,
    IconRobot,
    IconLock,
    IconSearch,
    IconBolt,
} from '@tabler/icons-react'
import {
    useTools,
    useCreateTool,
    useUpdateTool,
    useDeleteTool,
    useToggleTool,
    useExecuteTool,
    useIntegrations,
    useConnectIntegration,
    useDisconnectIntegration,
    useSyncIntegration,
    Tool,
    Integration,
    ToolType,
    ExecutionType,
} from '@/hooks/useTools'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'
import { ToolTemplateBuilder, ToolTemplate } from '@/components/campaigns/ToolTemplateBuilder'
import { MigrationAlert } from '@/components/admin/MigrationAlert'

const TOOL_TYPE_CONFIG: Record<ToolType, { label: string; color: string; icon: typeof IconFunction }> = {
    function: { label: 'Função', color: 'blue', icon: IconFunction },
    webhook: { label: 'Webhook', color: 'orange', icon: IconWebhook },
    integration: { label: 'Integração', color: 'green', icon: IconApi },
}

const INTEGRATION_ICONS: Record<string, typeof IconCalendar> = {
    google_calendar: IconCalendar,
    google_sheets: IconDatabase,
    rd_station: IconBrandGoogle,
    n8n: IconWebhook,
}

export default function AdminTools() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [testModalOpened, { open: openTestModal, close: closeTestModal }] = useDisclosure()
    const [search, setSearch] = useState('')

    // Form state
    const [editingTool, setEditingTool] = useState<Tool | null>(null)
    const [name, setName] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [description, setDescription] = useState('')
    const [type, setType] = useState<ToolType>('function')
    const [executionType, setExecutionType] = useState<ExecutionType>('internal')
    const [webhookUrl, setWebhookUrl] = useState('')
    const [parametersJson, setParametersJson] = useState('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}')
    const [requiresConfirmation, setRequiresConfirmation] = useState(false)

    // Test modal state
    const [testTool, setTestTool] = useState<Tool | null>(null)
    const [testParams, setTestParams] = useState('{}')

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Hooks
    const { data: tools, isLoading: loadingTools, refetch: refetchTools, error: toolsError } = useTools()
    const { data: integrations, isLoading: loadingIntegrations, refetch: refetchIntegrations } = useIntegrations()
    const createTool = useCreateTool()
    const updateTool = useUpdateTool()
    const deleteTool = useDeleteTool()
    const toggleTool = useToggleTool()
    const executeTool = useExecuteTool()
    const connectIntegration = useConnectIntegration()
    const disconnectIntegration = useDisconnectIntegration()
    const syncIntegration = useSyncIntegration()

    // Detect table not found
    const tableNotFound = toolsError && typeof toolsError === 'object' && 'message' in toolsError &&
        String((toolsError as { message: string }).message).includes('tools')

    const resetForm = () => {
        setName('')
        setDisplayName('')
        setDescription('')
        setType('function')
        setExecutionType('internal')
        setWebhookUrl('')
        setParametersJson('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}')
        setRequiresConfirmation(false)
        setEditingTool(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (tool: Tool) => {
        if (tool.is_system) return // Can't edit system tools
        setEditingTool(tool)
        setName(tool.name)
        setDisplayName(tool.display_name)
        setDescription(tool.description)
        setType(tool.type)
        setExecutionType(tool.execution_type)
        setWebhookUrl(tool.webhook_url || '')
        setParametersJson(JSON.stringify(tool.parameters, null, 2))
        setRequiresConfirmation(tool.requires_confirmation)
        openModal()
    }

    const handleSubmit = async () => {
        let params
        try {
            params = JSON.parse(parametersJson)
        } catch {
            return
        }

        const data = {
            name,
            display_name: displayName,
            description,
            type,
            execution_type: executionType,
            webhook_url: webhookUrl || undefined,
            parameters: params,
            requires_confirmation: requiresConfirmation,
        }

        if (editingTool) {
            await updateTool.mutateAsync({ id: editingTool.id, ...data })
        } else {
            await createTool.mutateAsync(data)
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (tool: Tool) => {
        if (tool.is_system) return
        if (confirm(`Remover a ferramenta "${tool.display_name}"?`)) {
            deleteTool.mutate(tool.id)
        }
    }

    const handleToggle = (tool: Tool) => {
        toggleTool.mutate({ id: tool.id, is_active: !tool.is_active })
    }

    const handleOpenTest = (tool: Tool) => {
        setTestTool(tool)
        setTestParams('{}')
        openTestModal()
    }

    const handleRunTest = async () => {
        if (!testTool) return
        let params
        try {
            params = JSON.parse(testParams)
        } catch {
            return
        }
        await executeTool.mutateAsync({ tool_id: testTool.id, params, test_mode: true })
        closeTestModal()
    }

    // Filter tools
    const filteredTools = tools?.filter(tool =>
        tool.display_name.toLowerCase().includes(search.toLowerCase()) ||
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase())
    ) || []

    const systemTools = filteredTools.filter(t => t.is_system)
    const customTools = filteredTools.filter(t => !t.is_system)

    if (tableNotFound) {
        return (
            <Stack gap="lg">
                <Title order={2}>Ferramentas</Title>
                <MigrationAlert
                    tableName="tools"
                    migrationFile="tools_v2.sql"
                    onSuccess={() => refetchTools()}
                />
            </Stack>
        )
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Ferramentas</Title>
                        <Text c="dimmed" size="sm">
                            Funções e integrações do agente IA
                        </Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate} disabled={!isConfigured}>
                        Nova Função
                    </Button>
                </Group>

                {!isConfigured && (
                    <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                        Configure o banco de dados do cliente para gerenciar ferramentas.
                    </Alert>
                )}

                <Tabs defaultValue="functions">
                    <Tabs.List>
                        <Tabs.Tab value="functions" leftSection={<IconSettings size={16} />}>
                            Funções ({tools?.length || 0})
                        </Tabs.Tab>
                        <Tabs.Tab value="triggers" leftSection={<IconBolt size={16} />}>
                            Gatilhos
                        </Tabs.Tab>
                        <Tabs.Tab value="integrations" leftSection={<IconWebhook size={16} />}>
                            Integrações ({integrations?.length || 0})
                        </Tabs.Tab>
                        <Tabs.Tab value="api" leftSection={<IconApi size={16} />}>
                            API
                        </Tabs.Tab>
                    </Tabs.List>

                    {/* Functions Panel */}
                    <Tabs.Panel value="functions" pt="md">
                        <TextInput
                            placeholder="Buscar ferramenta..."
                            leftSection={<IconSearch size={16} />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            mb="md"
                        />

                        {loadingTools ? (
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                                {[1, 2, 3, 4].map(i => <Skeleton key={i} height={100} />)}
                            </SimpleGrid>
                        ) : (
                            <Stack gap="md">
                                {/* System Tools */}
                                {systemTools.length > 0 && (
                                    <>
                                        <Text size="sm" fw={600} c="dimmed">
                                            Ferramentas do Sistema ({systemTools.length})
                                        </Text>
                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                                            {systemTools.map((tool) => (
                                                <ToolCard
                                                    key={tool.id}
                                                    tool={tool}
                                                    onToggle={handleToggle}
                                                    onTest={handleOpenTest}
                                                />
                                            ))}
                                        </SimpleGrid>
                                    </>
                                )}

                                {/* Custom Tools */}
                                {customTools.length > 0 && (
                                    <>
                                        <Text size="sm" fw={600} c="dimmed" mt="md">
                                            Ferramentas Customizadas ({customTools.length})
                                        </Text>
                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                                            {customTools.map((tool) => (
                                                <ToolCard
                                                    key={tool.id}
                                                    tool={tool}
                                                    onToggle={handleToggle}
                                                    onEdit={handleOpenEdit}
                                                    onDelete={handleDelete}
                                                    onTest={handleOpenTest}
                                                />
                                            ))}
                                        </SimpleGrid>
                                    </>
                                )}

                                {filteredTools.length === 0 && (
                                    <Paper p="xl" ta="center" bg="dark.6" radius="md">
                                        <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                            <IconFunction size={30} />
                                        </ThemeIcon>
                                        <Text c="dimmed">Nenhuma ferramenta encontrada</Text>
                                    </Paper>
                                )}
                            </Stack>
                        )}
                    </Tabs.Panel>

                    {/* Triggers Panel - Gatilhos de Remarketing */}
                    <Tabs.Panel value="triggers" pt="md">
                        <TriggersPanel />
                    </Tabs.Panel>

                    {/* Integrations Panel */}
                    <Tabs.Panel value="integrations" pt="md">
                        {loadingIntegrations ? (
                            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                                {[1, 2, 3].map(i => <Skeleton key={i} height={150} />)}
                            </SimpleGrid>
                        ) : (
                            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                                {integrations?.map((integration) => {
                                    const Icon = INTEGRATION_ICONS[integration.provider] || IconApi
                                    return (
                                        <Card key={integration.id} withBorder padding="md" radius="md">
                                            <Group justify="space-between" mb="md">
                                                <Group gap="sm">
                                                    <ThemeIcon variant="light" color={integration.is_connected ? 'green' : 'gray'}>
                                                        <Icon size={18} />
                                                    </ThemeIcon>
                                                    <Text fw={500}>{integration.name}</Text>
                                                </Group>
                                                <Badge color={integration.is_connected ? 'green' : 'gray'} variant="dot">
                                                    {integration.is_connected ? 'Conectado' : 'Desconectado'}
                                                </Badge>
                                            </Group>

                                            {integration.is_connected ? (
                                                <>
                                                    <Text size="xs" c="dimmed">
                                                        Última sincronia: {integration.last_sync_at
                                                            ? new Date(integration.last_sync_at).toLocaleString('pt-BR')
                                                            : 'Nunca'}
                                                    </Text>
                                                    <Group mt="md">
                                                        <Button
                                                            size="xs"
                                                            variant="light"
                                                            leftSection={<IconRefresh size={14} />}
                                                            loading={syncIntegration.isPending}
                                                            onClick={() => syncIntegration.mutate(integration.id)}
                                                        >
                                                            Sincronizar
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="subtle"
                                                            color="red"
                                                            onClick={() => disconnectIntegration.mutate(integration.id)}
                                                        >
                                                            Desconectar
                                                        </Button>
                                                    </Group>
                                                </>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="light"
                                                    fullWidth
                                                    mt="md"
                                                    leftSection={<IconExternalLink size={14} />}
                                                    onClick={() => connectIntegration.mutate({ id: integration.id })}
                                                >
                                                    Conectar
                                                </Button>
                                            )}
                                        </Card>
                                    )
                                })}
                            </SimpleGrid>
                        )}
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
                                    <Code>ak_live_{selectedCompany?.id?.substring(0, 20) || 'xxxxxxxxxxxxxxxxxxxx'}</Code>
                                    <CopyButton value={`ak_live_${selectedCompany?.id?.substring(0, 20) || 'xxxxxxxxxxxxxxxxxxxx'}`}>
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

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpened}
                onClose={() => { closeModal(); resetForm(); }}
                title={editingTool ? 'Editar Ferramenta' : 'Nova Ferramenta'}
                size="lg"
            >
                <Stack gap="md">
                    <SimpleGrid cols={2}>
                        <TextInput
                            label="Nome (identificador)"
                            placeholder="minhaFuncao"
                            description="Sem espaços, camelCase"
                            value={name}
                            onChange={(e) => setName(e.target.value.replace(/\s/g, ''))}
                            required
                        />
                        <TextInput
                            label="Nome de Exibição"
                            placeholder="Minha Função"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                        />
                    </SimpleGrid>

                    <Textarea
                        label="Descrição"
                        placeholder="O que esta função faz? (A IA usa isso para decidir quando chamar)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        required
                    />

                    <SimpleGrid cols={2}>
                        <Select
                            label="Tipo"
                            data={[
                                { value: 'function', label: 'Função Interna' },
                                { value: 'webhook', label: 'Webhook Externo' },
                            ]}
                            value={type}
                            onChange={(val) => setType(val as ToolType || 'function')}
                        />
                        <Select
                            label="Execução"
                            data={[
                                { value: 'internal', label: 'Lógica Interna' },
                                { value: 'webhook', label: 'Chamar Webhook' },
                                { value: 'code', label: 'Código JavaScript' },
                            ]}
                            value={executionType}
                            onChange={(val) => setExecutionType(val as ExecutionType || 'internal')}
                        />
                    </SimpleGrid>

                    {executionType === 'webhook' && (
                        <TextInput
                            label="URL do Webhook"
                            placeholder="https://n8n.exemplo.com/webhook/abc"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                    )}

                    <JsonInput
                        label="Parâmetros (JSON Schema)"
                        description="Define os parâmetros que a IA pode passar"
                        placeholder='{"type": "object", "properties": {...}}'
                        value={parametersJson}
                        onChange={setParametersJson}
                        formatOnBlur
                        autosize
                        minRows={4}
                        maxRows={10}
                    />

                    <Switch
                        label="Requer confirmação do usuário"
                        description="Pedir confirmação antes de executar ações destrutivas"
                        checked={requiresConfirmation}
                        onChange={(e) => setRequiresConfirmation(e.target.checked)}
                    />

                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createTool.isPending || updateTool.isPending}
                            disabled={!name || !displayName || !description}
                        >
                            {editingTool ? 'Salvar' : 'Criar Função'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Test Modal */}
            <Modal
                opened={testModalOpened}
                onClose={closeTestModal}
                title={`Testar: ${testTool?.display_name}`}
                size="md"
            >
                <Stack gap="md">
                    <Text size="sm" c="dimmed">{testTool?.description}</Text>

                    <JsonInput
                        label="Parâmetros de Teste"
                        description="JSON com os parâmetros para testar"
                        value={testParams}
                        onChange={setTestParams}
                        formatOnBlur
                        autosize
                        minRows={4}
                    />

                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeTestModal}>Cancelar</Button>
                        <Button
                            leftSection={<IconPlayerPlay size={16} />}
                            onClick={handleRunTest}
                            loading={executeTool.isPending}
                        >
                            Executar Teste
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}

// Tool Card Component
function ToolCard({
    tool,
    onToggle,
    onEdit,
    onDelete,
    onTest
}: {
    tool: Tool
    onToggle: (tool: Tool) => void
    onEdit?: (tool: Tool) => void
    onDelete?: (tool: Tool) => void
    onTest: (tool: Tool) => void
}) {
    const config = TOOL_TYPE_CONFIG[tool.type]

    return (
        <Card withBorder padding="md" radius="md">
            <Group justify="space-between">
                <Group gap="sm">
                    <ThemeIcon variant="light" color={tool.is_active ? config.color : 'gray'}>
                        {tool.is_system ? <IconLock size={18} /> : <config.icon size={18} />}
                    </ThemeIcon>
                    <div>
                        <Group gap="xs">
                            <Code>{tool.name}()</Code>
                            <Badge size="xs" variant="light" color={config.color}>{config.label}</Badge>
                            {tool.is_system && <Badge size="xs" variant="outline" color="gray">Sistema</Badge>}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={1}>{tool.description}</Text>
                    </div>
                </Group>
                <Switch checked={tool.is_active} onChange={() => onToggle(tool)} color="teal" />
            </Group>

            <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">
                    {tool.execution_count} execuções
                </Text>
                <Group gap="xs">
                    <Tooltip label="Testar">
                        <ActionIcon variant="subtle" size="sm" onClick={() => onTest(tool)}>
                            <IconPlayerPlay size={14} />
                        </ActionIcon>
                    </Tooltip>
                    {!tool.is_system && onEdit && (
                        <Tooltip label="Editar">
                            <ActionIcon variant="subtle" size="sm" onClick={() => onEdit(tool)}>
                                <IconEdit size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                    {!tool.is_system && onDelete && (
                        <Tooltip label="Excluir">
                            <ActionIcon variant="subtle" size="sm" color="red" onClick={() => onDelete(tool)}>
                                <IconTrash size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>
            </Group>
        </Card>
    )
}

// Triggers Panel for Remarketing
function TriggersPanel() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [triggerName, setTriggerName] = useState('')
    const [triggerEvent, setTriggerEvent] = useState('deal_stage_changed')
    const [triggerDelay, setTriggerDelay] = useState<number | ''>(0)
    const [template, setTemplate] = useState<ToolTemplate>({ blocks: [], variables: [] })

    const TRIGGER_EVENTS = [
        { value: 'deal_stage_changed', label: 'Negócio mudou de etapa' },
        { value: 'deal_won', label: 'Negócio ganho' },
        { value: 'deal_lost', label: 'Negócio perdido' },
        { value: 'contact_created', label: 'Novo contato criado' },
        { value: 'contact_inactive_7d', label: 'Contato inativo 7 dias' },
        { value: 'contact_inactive_30d', label: 'Contato inativo 30 dias' },
        { value: 'payment_due', label: 'Pagamento vencendo' },
        { value: 'payment_overdue', label: 'Pagamento em atraso' },
        { value: 'birthday', label: 'Aniversário do contato' },
        { value: 'cart_abandoned', label: 'Carrinho abandonado' },
        { value: 'message_no_reply_24h', label: 'Sem resposta em 24h' },
    ]

    // Mock triggers for demo
    const [triggers] = useState([
        { id: '1', name: 'Follow-up 7 dias', event: 'contact_inactive_7d', is_active: true, executions: 234 },
        { id: '2', name: 'Lembrete Pagamento', event: 'payment_due', is_active: true, executions: 89 },
        { id: '3', name: 'Boas-vindas', event: 'contact_created', is_active: false, executions: 567 },
    ])

    const handleCreate = () => {
        setTriggerName('')
        setTriggerEvent('deal_stage_changed')
        setTriggerDelay(0)
        setTemplate({ blocks: [], variables: [] })
        openModal()
    }

    return (
        <>
            <Stack gap="md">
                <Group justify="space-between">
                    <div>
                        <Text fw={600}>Gatilhos de Remarketing</Text>
                        <Text size="xs" c="dimmed">
                            Automações que disparam mensagens baseadas em eventos
                        </Text>
                    </div>
                    <Button size="sm" leftSection={<IconPlus size={14} />} onClick={handleCreate}>
                        Novo Gatilho
                    </Button>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {triggers.map((trigger) => (
                        <Card key={trigger.id} withBorder padding="md" radius="md">
                            <Group justify="space-between" mb="sm">
                                <Group gap="sm">
                                    <ThemeIcon variant="light" color={trigger.is_active ? 'yellow' : 'gray'}>
                                        <IconBolt size={18} />
                                    </ThemeIcon>
                                    <div>
                                        <Text fw={500}>{trigger.name}</Text>
                                        <Text size="xs" c="dimmed">
                                            {TRIGGER_EVENTS.find(e => e.value === trigger.event)?.label}
                                        </Text>
                                    </div>
                                </Group>
                                <Switch checked={trigger.is_active} color="teal" />
                            </Group>
                            <Group justify="space-between">
                                <Text size="xs" c="dimmed">{trigger.executions} execuções</Text>
                                <Group gap="xs">
                                    <ActionIcon variant="subtle" size="sm">
                                        <IconEdit size={14} />
                                    </ActionIcon>
                                    <ActionIcon variant="subtle" size="sm" color="red">
                                        <IconTrash size={14} />
                                    </ActionIcon>
                                </Group>
                            </Group>
                        </Card>
                    ))}
                </SimpleGrid>

                <Alert color="blue" variant="light" title="💡 Como funcionam os gatilhos">
                    <Text size="sm">
                        Gatilhos são automações que enviam mensagens automaticamente quando eventos específicos acontecem.
                        Configure o evento, delay e template da mensagem para criar remarketing inteligente.
                    </Text>
                </Alert>
            </Stack>

            {/* Create/Edit Trigger Modal */}
            <Modal
                opened={modalOpened}
                onClose={closeModal}
                title="Novo Gatilho de Remarketing"
                size="xl"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome do Gatilho"
                        placeholder="Ex: Follow-up após 7 dias"
                        value={triggerName}
                        onChange={(e) => setTriggerName(e.target.value)}
                        required
                    />

                    <SimpleGrid cols={2}>
                        <Select
                            label="Evento Gatilho"
                            description="Quando o gatilho deve disparar"
                            data={TRIGGER_EVENTS}
                            value={triggerEvent}
                            onChange={(val) => setTriggerEvent(val || 'deal_stage_changed')}
                        />
                        <TextInput
                            label="Delay (minutos)"
                            description="Tempo de espera após o evento"
                            type="number"
                            value={triggerDelay}
                            onChange={(e) => setTriggerDelay(Number(e.target.value))}
                        />
                    </SimpleGrid>

                    <Text fw={500} size="sm" mt="md">Template da Mensagem</Text>
                    <ToolTemplateBuilder
                        value={template}
                        onChange={setTemplate}
                    />

                    <Group justify="flex-end" mt="md">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button disabled={!triggerName || template.blocks.length === 0}>
                            Criar Gatilho
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}

