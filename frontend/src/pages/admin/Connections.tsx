/**
 * Admin Connections - Gerenciamento de Conexões WhatsApp
 */

import { useState } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    Badge,
    ActionIcon,
    Modal,
    ThemeIcon,
    Paper,
    SimpleGrid,
    Table,
    TextInput,
    Textarea,
    Select,
    Switch,
    Skeleton,
    Alert,
    Avatar,
    Progress,
    Tooltip,
    Box,
    Image,
    NumberInput,
    CopyButton,
    Code,
    Divider,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconSearch,
    IconTrash,
    IconEdit,
    IconRefresh,
    IconBrandWhatsapp,
    IconCheck,
    IconX,
    IconQrcode,
    IconPhone,
    IconPlugConnected,
    IconPlugConnectedX,
    IconAlertCircle,
    IconCopy,
    IconSettings,
    IconChartBar,
    IconDatabase,
    IconStar,
    IconStarFilled,
} from '@tabler/icons-react'
import {
    useWhatsAppConnections,
    useCreateConnection,
    useUpdateConnection,
    useDeleteConnection,
    useUpdateConnectionStatus,
    WhatsAppConnection,
    ConnectionProvider,
    ConnectionStatus,
} from '@/hooks/useConnections'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'

const PROVIDER_LABELS: Record<ConnectionProvider, { label: string; color: string }> = {
    uazapi: { label: 'UAZAPI', color: 'blue' },
    evolution: { label: 'Evolution API', color: 'green' },
    meta_cloud: { label: 'Meta Cloud API', color: 'indigo' },
    baileys: { label: 'Baileys', color: 'orange' },
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: typeof IconCheck }> = {
    connected: { label: 'Conectado', color: 'green', icon: IconCheck },
    connecting: { label: 'Conectando...', color: 'yellow', icon: IconRefresh },
    disconnected: { label: 'Desconectado', color: 'gray', icon: IconPlugConnectedX },
    qr_pending: { label: 'Aguardando QR', color: 'blue', icon: IconQrcode },
    error: { label: 'Erro', color: 'red', icon: IconAlertCircle },
    banned: { label: 'Banido', color: 'red', icon: IconX },
}

export default function AdminConnections() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [qrModalOpened, { open: openQrModal, close: closeQrModal }] = useDisclosure()
    const [search, setSearch] = useState('')
    const [selectedConnection, setSelectedConnection] = useState<WhatsAppConnection | null>(null)

    // Form state
    const [editingConnection, setEditingConnection] = useState<WhatsAppConnection | null>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [provider, setProvider] = useState<ConnectionProvider>('uazapi')
    const [instanceId, setInstanceId] = useState('')
    const [apiUrl, setApiUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [dailyLimit, setDailyLimit] = useState<number | ''>(1000)
    const [isDefault, setIsDefault] = useState(false)

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Hooks
    const { data: connections, isLoading, refetch, error } = useWhatsAppConnections()
    const createConnection = useCreateConnection()
    const updateConnection = useUpdateConnection()
    const deleteConnection = useDeleteConnection()
    const updateStatus = useUpdateConnectionStatus()

    // Detect table not found
    const tableNotFound = error && typeof error === 'object' && 'message' in error &&
        String((error as { message: string }).message).includes('whatsapp_connections')

    const resetForm = () => {
        setName('')
        setDescription('')
        setProvider('uazapi')
        setInstanceId('')
        setApiUrl('')
        setApiKey('')
        setDailyLimit(1000)
        setIsDefault(false)
        setEditingConnection(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (connection: WhatsAppConnection) => {
        setEditingConnection(connection)
        setName(connection.name)
        setDescription(connection.description || '')
        setProvider(connection.provider)
        setInstanceId(connection.instance_id || '')
        setApiUrl(connection.api_url || '')
        setApiKey(connection.api_key || '')
        setDailyLimit(connection.daily_message_limit)
        setIsDefault(connection.is_default)
        openModal()
    }

    const handleSubmit = async () => {
        const data = {
            name,
            description: description || undefined,
            provider,
            instance_id: instanceId || undefined,
            api_url: apiUrl || undefined,
            api_key: apiKey || undefined,
            daily_message_limit: typeof dailyLimit === 'number' ? dailyLimit : 1000,
            is_default: isDefault,
        }

        if (editingConnection) {
            await updateConnection.mutateAsync({ id: editingConnection.id, ...data })
        } else {
            await createConnection.mutateAsync(data)
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover esta conexão?')) {
            deleteConnection.mutate(id)
        }
    }

    const handleConnect = async (connection: WhatsAppConnection) => {
        // Simulate QR code generation (in real app, this calls the gateway API)
        setSelectedConnection(connection)
        await updateStatus.mutateAsync({
            id: connection.id,
            status: 'qr_pending',
            qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Placeholder
        })
        openQrModal()

        // Simulate connection success after 5s
        setTimeout(async () => {
            await updateStatus.mutateAsync({
                id: connection.id,
                status: 'connected',
                phone_number: '+55 11 99999-9999',
                phone_name: 'WhatsApp Business',
            })
            closeQrModal()
        }, 5000)
    }

    const handleDisconnect = async (connection: WhatsAppConnection) => {
        if (confirm('Desconectar este WhatsApp?')) {
            await updateStatus.mutateAsync({
                id: connection.id,
                status: 'disconnected',
            })
        }
    }

    // Filter connections
    const filteredConnections = connections?.filter(conn =>
        conn.name.toLowerCase().includes(search.toLowerCase()) ||
        conn.phone_number?.includes(search) ||
        conn.provider.includes(search.toLowerCase())
    ) || []

    // Stats
    const connectedCount = connections?.filter(c => c.status === 'connected').length || 0
    const totalMessages = connections?.reduce((sum, c) => sum + c.total_messages_sent, 0) || 0

    if (tableNotFound) {
        return (
            <Stack gap="lg">
                <Title order={2}>Conexões WhatsApp</Title>
                <Alert
                    icon={<IconDatabase size={16} />}
                    color="yellow"
                    title="Migração Necessária"
                >
                    <Text size="sm" mb="sm">
                        A tabela de conexões não foi encontrada. Execute a migração SQL para criar as tabelas necessárias.
                    </Text>
                    <Code block>
                        {`-- Execute no banco do tenant:
-- connections_v2.sql`}
                    </Code>
                </Alert>
            </Stack>
        )
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Conexões WhatsApp</Title>
                        <Text c="dimmed" size="sm">
                            Gerenciar instâncias WhatsApp de {selectedCompany?.name || 'empresa'}
                        </Text>
                    </div>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleOpenCreate}
                        disabled={!isConfigured}
                    >
                        Nova Conexão
                    </Button>
                </Group>

                {!isConfigured && (
                    <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                        Configure o banco de dados do cliente para gerenciar conexões.
                    </Alert>
                )}

                {/* Stats */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="green">
                                <IconBrandWhatsapp size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{connections?.length || 0}</Text>
                                <Text size="xs" c="dimmed">Conexões</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="teal">
                                <IconPlugConnected size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{connectedCount}</Text>
                                <Text size="xs" c="dimmed">Online</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="blue">
                                <IconChartBar size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{totalMessages.toLocaleString()}</Text>
                                <Text size="xs" c="dimmed">Msgs Enviadas</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="orange">
                                <IconPhone size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>
                                    {connections?.filter(c => c.phone_number).length || 0}
                                </Text>
                                <Text size="xs" c="dimmed">Com Número</Text>
                            </div>
                        </Group>
                    </Paper>
                </SimpleGrid>

                {/* Connections List */}
                <Card withBorder padding="md" radius="md">
                    <Group gap="md" mb="md">
                        <TextInput
                            placeholder="Buscar conexão..."
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
                                <Skeleton key={i} height={80} radius="sm" />
                            ))}
                        </Stack>
                    ) : filteredConnections.length > 0 ? (
                        <Stack gap="md">
                            {filteredConnections.map((connection) => {
                                const statusConfig = STATUS_CONFIG[connection.status]
                                const providerConfig = PROVIDER_LABELS[connection.provider]
                                const StatusIcon = statusConfig.icon
                                const usagePercent = (connection.messages_sent_today / connection.daily_message_limit) * 100

                                return (
                                    <Paper key={connection.id} p="md" withBorder radius="md">
                                        <Group justify="space-between" wrap="nowrap">
                                            <Group gap="md" wrap="nowrap">
                                                <Avatar size="lg" color="green" radius="xl">
                                                    <IconBrandWhatsapp size={24} />
                                                </Avatar>
                                                <div style={{ minWidth: 0 }}>
                                                    <Group gap="xs">
                                                        <Text fw={600} truncate>{connection.name}</Text>
                                                        {connection.is_default && (
                                                            <ThemeIcon size="xs" color="yellow" variant="filled">
                                                                <IconStarFilled size={10} />
                                                            </ThemeIcon>
                                                        )}
                                                    </Group>
                                                    <Group gap="xs" mt={4}>
                                                        <Badge size="xs" variant="light" color={providerConfig.color}>
                                                            {providerConfig.label}
                                                        </Badge>
                                                        <Badge
                                                            size="xs"
                                                            variant="dot"
                                                            color={statusConfig.color}
                                                            leftSection={<StatusIcon size={10} />}
                                                        >
                                                            {statusConfig.label}
                                                        </Badge>
                                                    </Group>
                                                    {connection.phone_number && (
                                                        <Text size="xs" c="dimmed" mt={4}>
                                                            {connection.phone_number} • {connection.phone_name}
                                                        </Text>
                                                    )}
                                                </div>
                                            </Group>

                                            <Group gap="xl" wrap="nowrap">
                                                {/* Daily usage */}
                                                <Box w={120} visibleFrom="sm">
                                                    <Text size="xs" c="dimmed" mb={4}>
                                                        {connection.messages_sent_today}/{connection.daily_message_limit}/dia
                                                    </Text>
                                                    <Progress
                                                        value={usagePercent}
                                                        size="xs"
                                                        color={usagePercent > 80 ? 'red' : usagePercent > 50 ? 'yellow' : 'green'}
                                                    />
                                                </Box>

                                                {/* Actions */}
                                                <Group gap="xs">
                                                    {connection.status === 'disconnected' && (
                                                        <Button
                                                            size="xs"
                                                            variant="light"
                                                            color="green"
                                                            leftSection={<IconQrcode size={14} />}
                                                            onClick={() => handleConnect(connection)}
                                                        >
                                                            Conectar
                                                        </Button>
                                                    )}
                                                    {connection.status === 'connected' && (
                                                        <Button
                                                            size="xs"
                                                            variant="subtle"
                                                            color="red"
                                                            onClick={() => handleDisconnect(connection)}
                                                        >
                                                            Desconectar
                                                        </Button>
                                                    )}
                                                    <ActionIcon variant="light" onClick={() => handleOpenEdit(connection)}>
                                                        <IconSettings size={16} />
                                                    </ActionIcon>
                                                    <ActionIcon variant="light" color="red" onClick={() => handleDelete(connection.id)}>
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Group>
                                            </Group>
                                        </Group>
                                    </Paper>
                                )
                            })}
                        </Stack>
                    ) : (
                        <Paper p="xl" ta="center" bg="dark.6" radius="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                <IconBrandWhatsapp size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">Nenhuma conexão encontrada</Text>
                            <Button variant="light" mt="md" onClick={handleOpenCreate} disabled={!isConfigured}>
                                Adicionar primeira conexão
                            </Button>
                        </Paper>
                    )}
                </Card>
            </Stack>

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpened}
                onClose={() => { closeModal(); resetForm(); }}
                title={editingConnection ? 'Editar Conexão' : 'Nova Conexão WhatsApp'}
                size="lg"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome da Conexão"
                        placeholder="Ex: WhatsApp Principal"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Textarea
                        label="Descrição"
                        placeholder="Descrição opcional..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                    />

                    <Divider label="Configuração do Gateway" labelPosition="left" />

                    <Select
                        label="Provedor"
                        data={[
                            { value: 'uazapi', label: 'UAZAPI' },
                            { value: 'evolution', label: 'Evolution API' },
                            { value: 'meta_cloud', label: 'Meta Cloud API (Oficial)' },
                            { value: 'baileys', label: 'Baileys (Open Source)' },
                        ]}
                        value={provider}
                        onChange={(val) => setProvider(val as ConnectionProvider || 'uazapi')}
                    />
                    <TextInput
                        label="ID da Instância"
                        placeholder="ID no gateway"
                        value={instanceId}
                        onChange={(e) => setInstanceId(e.target.value)}
                    />
                    <TextInput
                        label="URL da API"
                        placeholder="https://api.uazapi.com"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                    />
                    <TextInput
                        label="API Key / Token"
                        placeholder="Token de autenticação"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />

                    <Divider label="Limites" labelPosition="left" />

                    <NumberInput
                        label="Limite Diário de Mensagens"
                        description="Limite de segurança para evitar bloqueios"
                        value={dailyLimit}
                        onChange={(val) => setDailyLimit(typeof val === 'number' ? val : 1000)}
                        min={100}
                        max={10000}
                    />

                    <Switch
                        label="Conexão padrão"
                        description="Usar esta conexão para novos atendimentos"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                    />

                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createConnection.isPending || updateConnection.isPending}
                            disabled={!name}
                        >
                            {editingConnection ? 'Salvar' : 'Criar Conexão'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* QR Code Modal */}
            <Modal
                opened={qrModalOpened}
                onClose={closeQrModal}
                title="Escanear QR Code"
                centered
            >
                <Stack align="center" gap="md">
                    <Text c="dimmed" ta="center">
                        Abra o WhatsApp no seu celular e escaneie o QR Code abaixo
                    </Text>

                    {selectedConnection?.qr_code ? (
                        <Paper p="md" bg="white" radius="md">
                            <Image
                                src={selectedConnection.qr_code}
                                alt="QR Code"
                                w={250}
                                h={250}
                                fallbackSrc="https://via.placeholder.com/250?text=QR+Code"
                            />
                        </Paper>
                    ) : (
                        <Skeleton w={250} h={250} />
                    )}

                    <Text size="sm" c="dimmed">
                        Aguardando conexão...
                    </Text>

                    <Progress
                        value={100}
                        size="xs"
                        striped
                        animated
                        w="100%"
                        color="green"
                    />
                </Stack>
            </Modal>
        </>
    )
}
