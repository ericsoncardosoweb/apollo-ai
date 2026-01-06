/**
 * Admin Inbox - Chat ao Vivo (Real-time Conversations)
 * Complete redesign with tabs, colored bubbles, audio, attachments, CRM actions
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Paper,
    Avatar,
    Badge,
    TextInput,
    ActionIcon,
    ScrollArea,
    Divider,
    ThemeIcon,
    Box,
    Tabs,
    Button,
    Tooltip,
    Select,
    NumberInput,
    MultiSelect,
    TagsInput,
    Indicator,
    Skeleton,
    Alert,
    Menu,
    Progress,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconSearch,
    IconSend,
    IconPhone,
    IconUser,
    IconMessageCircle,
    IconDots,
    IconPaperclip,
    IconMoodSmile,
    IconMicrophone,
    IconPlayerStop,
    IconRobot,
    IconUserCheck,
    IconCircleCheck,
    IconClock,
    IconWifi,
    IconWifiOff,
    IconHandStop,
    IconArrowRight,
    IconTag,
    IconCurrencyReal,
    IconPackage,
    IconSettings,
    IconInfoCircle,
    IconDatabase,
    IconCopy,
    IconCheck,
} from '@tabler/icons-react'
import { useViewContext } from '@/contexts/ViewContext'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import {
    useChatConversations,
    useChatMessages,
    useSendChatMessage,
    useTakeChatOver,
    useMarkChatAsRead,
    useResolveChatConversation,
    useRealtimeChatConversations,
    useRealtimeChatMessages,
    useChatStats,
    Conversation as ApiConversation,
    ChatMessage as ApiMessage,
} from '@/hooks/useChat'
import { useAuth } from '@/contexts/AuthContext'

// Types
interface Contact {
    id: string
    name: string
    phone: string
    avatar?: string
    tags?: string[]
}

interface Conversation {
    id: string
    contact: Contact
    lastMessage: string
    lastMessageAt: string
    unreadCount: number
    status: 'waiting' | 'ai' | 'attending' | 'resolved' | 'archived'
    agentName: string
    agentType: 'ai' | 'human'
    pipelineStage?: string
    proposalValue?: number
    interestedServices?: string[]
}

interface Message {
    id: string
    sender: 'contact' | 'ai' | 'human'
    type: 'text' | 'audio' | 'image' | 'file' | 'system'
    content: string
    timestamp: string
    senderName?: string
}

// Status configs
const STATUS_CONFIG = {
    waiting: { label: 'Aguardando', color: 'yellow', icon: IconClock },
    ai: { label: 'I.A', color: 'violet', icon: IconRobot },
    attending: { label: 'Atendendo', color: 'blue', icon: IconUserCheck },
    resolved: { label: 'Resolvidos', color: 'green', icon: IconCircleCheck },
}

// Mock data for demonstration
const MOCK_CONVERSATIONS: Conversation[] = [
    {
        id: '1',
        contact: { id: 'c1', name: 'João Silva', phone: '+55 11 99999-1234', tags: ['lead', 'interessado'] },
        lastMessage: 'Olá, gostaria de saber mais sobre...',
        lastMessageAt: '10:45',
        unreadCount: 3,
        status: 'ai',
        agentName: 'Lia IA',
        agentType: 'ai',
        pipelineStage: 'qualificacao',
        proposalValue: 1500,
        interestedServices: ['Consultoria', 'Suporte'],
    },
    {
        id: '2',
        contact: { id: 'c2', name: 'Maria Santos', phone: '+55 11 98888-5678', tags: ['cliente'] },
        lastMessage: 'Qual o valor do plano Pro?',
        lastMessageAt: '10:32',
        unreadCount: 0,
        status: 'waiting',
        agentName: '-',
        agentType: 'ai',
        pipelineStage: 'proposta',
    },
    {
        id: '3',
        contact: { id: 'c3', name: 'Carlos Lima', phone: '+55 21 97777-9012', tags: [] },
        lastMessage: 'Obrigado pelo atendimento!',
        lastMessageAt: '09:15',
        unreadCount: 0,
        status: 'resolved',
        agentName: 'Ana',
        agentType: 'human',
        pipelineStage: 'ganho',
    },
    {
        id: '4',
        contact: { id: 'c4', name: 'Pedro Costa', phone: '+55 11 96666-3456' },
        lastMessage: 'Preciso de ajuda urgente',
        lastMessageAt: '11:20',
        unreadCount: 5,
        status: 'attending',
        agentName: 'Carlos',
        agentType: 'human',
    },
]

const MOCK_MESSAGES: Message[] = [
    { id: '1', sender: 'contact', type: 'text', content: 'Olá, boa tarde!', timestamp: '10:40' },
    { id: '2', sender: 'ai', type: 'text', content: 'Olá João! Sou a Lia, sua assistente virtual. Como posso ajudar hoje?', timestamp: '10:41', senderName: 'Lia IA' },
    { id: '3', sender: 'contact', type: 'text', content: 'Gostaria de saber mais sobre os planos disponíveis', timestamp: '10:42' },
    { id: 's1', sender: 'ai', type: 'system', content: 'Etapa alterada: Lead → Qualificação', timestamp: '10:43' },
    { id: '4', sender: 'ai', type: 'text', content: 'Claro! Temos 3 planos:\n\n• **Basic** - R$ 97/mês\n• **Pro** - R$ 197/mês\n• **Enterprise** - Sob consulta\n\nQual gostaria de conhecer melhor?', timestamp: '10:43', senderName: 'Lia IA' },
    { id: '5', sender: 'contact', type: 'text', content: 'O plano Pro tem todas as funcionalidades?', timestamp: '10:45' },
    { id: 's2', sender: 'human', type: 'system', content: 'Carlos assumiu o atendimento', timestamp: '10:46' },
    { id: '6', sender: 'human', type: 'text', content: 'Olá João! Sou o Carlos, vou continuar seu atendimento. O Pro tem:\n\n✓ Agentes ilimitados\n✓ RAG completo\n✓ Integrações\n\nPosso enviar uma proposta?', timestamp: '10:47', senderName: 'Carlos' },
]

// Pipeline stages
const PIPELINE_STAGES = [
    { value: 'lead', label: 'Lead' },
    { value: 'qualificacao', label: 'Qualificação' },
    { value: 'proposta', label: 'Proposta' },
    { value: 'negociacao', label: 'Negociação' },
    { value: 'ganho', label: 'Ganho' },
    { value: 'perdido', label: 'Perdido' },
]

// Available services (mock)
const AVAILABLE_SERVICES = ['Consultoria', 'Suporte', 'Implantação', 'Treinamento', 'Customização']

export default function AdminInbox() {
    const navigate = useNavigate()
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()
    const { user } = useAuth()

    // State declarations first
    const [activeTab, setActiveTab] = useState<string | null>('all')
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
    const [message, setMessage] = useState('')
    const [search, setSearch] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [isConnected, setIsConnected] = useState(true) // WhatsApp connection status
    const [needsSetup, setNeedsSetup] = useState(false)

    // Hooks for real data (now activeTab and selectedConversationId are defined)
    const statusFilter = activeTab === 'all' ? undefined : activeTab as ApiConversation['status']
    const { data: apiConversations, isLoading, error, refetch } = useChatConversations({ status: statusFilter })
    const sendMessage = useSendChatMessage()
    const takeOver = useTakeChatOver()
    const markAsRead = useMarkChatAsRead()
    const resolveConversation = useResolveChatConversation()
    const { data: stats } = useChatStats()

    // Real-time subscriptions
    useRealtimeChatConversations()
    useRealtimeChatMessages(selectedConversationId)

    // Check for table not found
    useEffect(() => {
        if (error && (error as any)?.code === 'PGRST205') {
            setNeedsSetup(true)
        }
    }, [error])

    // Transform API conversations to local format or use mock when no real data
    const conversations: Conversation[] = (apiConversations || []).map(c => ({
        id: c.id,
        contact: {
            id: c.contact_id || c.id,
            name: c.contact_name || 'Desconhecido',
            phone: c.contact_phone || '',
            tags: c.tags || [],
        },
        lastMessage: c.last_message_preview || '',
        lastMessageAt: c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
        unreadCount: c.unread_count || 0,
        status: c.status,
        agentName: c.assigned_name || c.ai_agent_name || 'IA',
        agentType: c.mode === 'human' ? 'human' : 'ai' as const,
        pipelineStage: c.pipeline_stage || undefined,
        proposalValue: c.proposal_value || undefined,
    }))

    // Messages for selected conversation
    const { data: apiMessages } = useChatMessages(selectedConversationId)

    // Transform messages
    const messages: Message[] = (apiMessages || []).map((m: ApiMessage) => ({
        id: m.id,
        sender: m.sender_type === 'contact' ? 'contact' : m.sender_type as 'ai' | 'human',
        type: m.content_type === 'system' ? 'system' : m.content_type as Message['type'],
        content: m.content || '',
        timestamp: new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        senderName: m.sender_name || undefined,
    }))

    // Get selected conversation object
    const selectedConversation = conversations.find(c => c.id === selectedConversationId) || conversations[0] || null

    // CRM panel state (editable)
    const [pipelineStage, setPipelineStage] = useState(selectedConversation?.pipelineStage || '')
    const [proposalValue, setProposalValue] = useState<number | ''>(selectedConversation?.proposalValue || '')
    const [interestedServices, setInterestedServices] = useState<string[]>(selectedConversation?.interestedServices || [])
    const [contactTags, setContactTags] = useState<string[]>(selectedConversation?.contact.tags || [])

    // Update CRM state when conversation changes
    useEffect(() => {
        if (selectedConversation) {
            setPipelineStage(selectedConversation.pipelineStage || '')
            setProposalValue(selectedConversation.proposalValue || '')
            setInterestedServices(selectedConversation.interestedServices || [])
            setContactTags(selectedConversation.contact.tags || [])
        }
    }, [selectedConversation])

    // Filter conversations by search
    const filteredConversations = conversations.filter(c => {
        const matchesSearch = !search || c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
            c.contact.phone.includes(search)
        return matchesSearch
    })

    // Count per status from stats
    const counts = {
        waiting: stats?.byStatus?.waiting || 0,
        ai: stats?.byStatus?.ai || 0,
        attending: stats?.byStatus?.attending || 0,
        resolved: stats?.byStatus?.resolved || 0,
    }

    const handleSendMessage = () => {
        if (!message.trim()) return
        // TODO: Send message via API
        console.log('Sending:', message)
        setMessage('')
    }

    const handleTakeOver = () => {
        // TODO: API call to take over conversation
        console.log('Taking over conversation:', selectedConversation?.id)
    }

    const handleStartRecording = () => {
        setIsRecording(true)
        // TODO: Start audio recording
    }

    const handleStopRecording = () => {
        setIsRecording(false)
        // TODO: Stop and send audio
    }

    const getBubbleColor = (sender: string) => {
        switch (sender) {
            case 'ai': return 'linear-gradient(135deg, rgba(34, 139, 34, 0.9), rgba(46, 125, 50, 0.85))'
            case 'human': return 'linear-gradient(135deg, rgba(25, 118, 210, 0.9), rgba(21, 101, 192, 0.85))'
            case 'contact': return 'rgba(55, 55, 55, 0.9)'
            default: return 'dark.5'
        }
    }

    const getSenderLabel = (msg: Message) => {
        if (msg.sender === 'contact') return `📱 ${selectedConversation?.contact.name || 'Contato'}`
        if (msg.sender === 'ai') return '🤖 IA'
        if (msg.sender === 'human') return `👤 ${msg.senderName || 'Atendente'}`
        return null
    }

    return (
        <Stack gap="md" style={{ height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
            {/* Header */}
            <Group justify="space-between">
                <div>
                    <Title order={2}>Chat ao Vivo</Title>
                    <Text c="dimmed" size="sm">Conversas em tempo real</Text>
                </div>
                <Group gap="md">
                    {/* WhatsApp Connection Status */}
                    <Tooltip label={isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado - Clique para configurar'}>
                        <ActionIcon
                            size="lg"
                            variant="light"
                            color={isConnected ? 'green' : 'red'}
                            onClick={() => !isConnected && navigate('/admin/settings?tab=whatsapp')}
                        >
                            {isConnected ? <IconWifi size={20} /> : <IconWifiOff size={20} />}
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>

            {/* Main Layout: 3 columns - FIXED HEIGHT */}
            <Group gap="md" align="stretch" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* LEFT: Conversation List */}
                <Card withBorder padding={0} radius="md" style={{ width: 320, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {/* Tabs */}
                    <Tabs value={activeTab} onChange={setActiveTab} variant="default">
                        <Tabs.List grow>
                            <Tabs.Tab value="waiting" leftSection={<IconClock size={14} />}>
                                <Group gap={4}>
                                    <Text size="xs">Aguardando</Text>
                                    {counts.waiting > 0 && <Badge size="xs" circle color="yellow">{counts.waiting}</Badge>}
                                </Group>
                            </Tabs.Tab>
                            <Tabs.Tab value="ai" leftSection={<IconRobot size={14} />}>
                                <Group gap={4}>
                                    <Text size="xs">I.A</Text>
                                    {counts.ai > 0 && <Badge size="xs" circle color="violet">{counts.ai}</Badge>}
                                </Group>
                            </Tabs.Tab>
                            <Tabs.Tab value="attending" leftSection={<IconUserCheck size={14} />}>
                                <Group gap={4}>
                                    <Text size="xs">Atendendo</Text>
                                    {counts.attending > 0 && <Badge size="xs" circle color="blue">{counts.attending}</Badge>}
                                </Group>
                            </Tabs.Tab>
                            <Tabs.Tab value="resolved" leftSection={<IconCircleCheck size={14} />}>
                                <Group gap={4}>
                                    <Text size="xs">Resolvidos</Text>
                                    {counts.resolved > 0 && <Badge size="xs" circle color="green">{counts.resolved}</Badge>}
                                </Group>
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs>

                    {/* Search */}
                    <Box p="xs" bg="dark.7">
                        <TextInput
                            placeholder="Buscar conversa..."
                            leftSection={<IconSearch size={16} />}
                            size="xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </Box>

                    {/* Conversation List */}
                    <ScrollArea style={{ flex: 1 }}>
                        {filteredConversations.length === 0 ? (
                            <Box p="md" ta="center">
                                <Text c="dimmed" size="sm">Nenhuma conversa</Text>
                            </Box>
                        ) : (
                            filteredConversations.map((conv) => (
                                <Paper
                                    key={conv.id}
                                    p="sm"
                                    bg={selectedConversation?.id === conv.id ? 'dark.6' : 'transparent'}
                                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-dark-5)' }}
                                    onClick={() => setSelectedConversationId(conv.id)}
                                >
                                    <Group justify="space-between" wrap="nowrap">
                                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                            <Indicator
                                                color={conv.agentType === 'ai' ? 'violet' : 'blue'}
                                                position="bottom-end"
                                                size={10}
                                                withBorder
                                            >
                                                <Avatar color="blue" radius="xl" size="md">
                                                    {conv.contact.name.charAt(0)}
                                                </Avatar>
                                            </Indicator>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <Group gap={4} wrap="nowrap">
                                                    <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                                                        {conv.contact.name}
                                                    </Text>
                                                    {conv.agentType === 'ai' && (
                                                        <ThemeIcon size="xs" variant="light" color="violet" radius="xl">
                                                            <IconRobot size={10} />
                                                        </ThemeIcon>
                                                    )}
                                                </Group>
                                                <Text size="xs" c="gray.4" truncate>{conv.lastMessage}</Text>
                                            </div>
                                        </Group>
                                        <Stack gap={2} align="flex-end">
                                            <Text size="xs" c="gray.5">{conv.lastMessageAt}</Text>
                                            {conv.unreadCount > 0 && (
                                                <Badge size="xs" circle color="green">{conv.unreadCount}</Badge>
                                            )}
                                        </Stack>
                                    </Group>
                                </Paper>
                            ))
                        )}
                    </ScrollArea>
                </Card>

                {/* CENTER: Chat Window - Fixed layout */}
                <Card withBorder padding={0} radius="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <Group p="sm" bg="dark.7" justify="space-between">
                                <Group gap="sm">
                                    <Avatar color="blue" radius="xl">
                                        {selectedConversation.contact.name.charAt(0)}
                                    </Avatar>
                                    <div>
                                        <Text size="sm" fw={500}>{selectedConversation.contact.name}</Text>
                                        <Text size="xs" c="dimmed">{selectedConversation.contact.phone}</Text>
                                    </div>
                                </Group>
                                <Group gap="xs">
                                    <Badge
                                        size="sm"
                                        color={selectedConversation.agentType === 'ai' ? 'violet' : 'blue'}
                                        leftSection={selectedConversation.agentType === 'ai' ? <IconRobot size={12} /> : <IconUser size={12} />}
                                    >
                                        {selectedConversation.agentName}
                                    </Badge>
                                    {selectedConversation.status === 'ai' && (
                                        <Button
                                            size="xs"
                                            variant="light"
                                            color="orange"
                                            leftSection={<IconHandStop size={14} />}
                                            onClick={handleTakeOver}
                                        >
                                            Assumir
                                        </Button>
                                    )}
                                </Group>
                            </Group>

                            {/* Messages - Flex fill */}
                            <ScrollArea style={{ flex: 1, minHeight: 0 }} p="md">
                                <Stack gap="sm">
                                    {MOCK_MESSAGES.map((msg) => (
                                        msg.type === 'system' ? (
                                            // System message (labels)
                                            <Group key={msg.id} justify="center">
                                                <Badge
                                                    variant="light"
                                                    color="gray"
                                                    size="sm"
                                                    leftSection={<IconInfoCircle size={12} />}
                                                >
                                                    {msg.content}
                                                </Badge>
                                            </Group>
                                        ) : (
                                            // Regular message
                                            <Group
                                                key={msg.id}
                                                justify={msg.sender === 'contact' ? 'flex-start' : 'flex-end'}
                                            >
                                                <Paper
                                                    p="sm"
                                                    radius="lg"
                                                    maw="70%"
                                                    style={{
                                                        background: getBubbleColor(msg.sender),
                                                        borderBottomLeftRadius: msg.sender === 'contact' ? 4 : undefined,
                                                        borderBottomRightRadius: msg.sender !== 'contact' ? 4 : undefined,
                                                    }}
                                                >
                                                    {getSenderLabel(msg) && (
                                                        <Text size="xs" fw={600} mb={4} c="gray.3">
                                                            {getSenderLabel(msg)}
                                                        </Text>
                                                    )}
                                                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                                        {msg.content}
                                                    </Text>
                                                    <Text size="xs" c="gray.5" ta="right" mt={4}>{msg.timestamp}</Text>
                                                </Paper>
                                            </Group>
                                        )
                                    ))}
                                </Stack>
                            </ScrollArea>

                            {/* Input Area - Fixed at bottom */}
                            <Group
                                p="sm"
                                gap="xs"
                                bg="dark.7"
                                style={{
                                    borderTop: '1px solid var(--mantine-color-dark-4)',
                                    flexShrink: 0,
                                    flexWrap: 'nowrap',
                                }}
                            >
                                {/* Attachment */}
                                <Tooltip label="Anexar arquivo">
                                    <ActionIcon variant="subtle" size="lg">
                                        <IconPaperclip size={18} />
                                    </ActionIcon>
                                </Tooltip>

                                {/* Emoji */}
                                <Tooltip label="Emojis">
                                    <ActionIcon variant="subtle" size="lg">
                                        <IconMoodSmile size={18} />
                                    </ActionIcon>
                                </Tooltip>

                                {/* Text Input */}
                                <TextInput
                                    placeholder="Digite sua mensagem..."
                                    style={{ flex: 1 }}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />

                                {/* Audio */}
                                <Tooltip label={isRecording ? 'Parar gravação' : 'Gravar áudio'}>
                                    <ActionIcon
                                        variant={isRecording ? 'filled' : 'subtle'}
                                        color={isRecording ? 'red' : 'gray'}
                                        size="lg"
                                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                                    >
                                        {isRecording ? <IconPlayerStop size={18} /> : <IconMicrophone size={18} />}
                                    </ActionIcon>
                                </Tooltip>

                                {/* Send */}
                                <ActionIcon
                                    color="teal"
                                    size="lg"
                                    radius="xl"
                                    variant="filled"
                                    onClick={handleSendMessage}
                                    disabled={!message.trim()}
                                >
                                    <IconSend size={18} />
                                </ActionIcon>
                            </Group>
                        </>
                    ) : (
                        <Box p="xl" ta="center" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Stack align="center">
                                <ThemeIcon size={60} variant="light" color="gray" radius="xl">
                                    <IconMessageCircle size={30} />
                                </ThemeIcon>
                                <Text c="dimmed">Selecione uma conversa</Text>
                            </Stack>
                        </Box>
                    )}
                </Card>

                {/* RIGHT: CRM Actions Panel */}
                {selectedConversation && (
                    <Card withBorder padding="md" radius="md" style={{ width: 280 }}>
                        <Stack gap="md">
                            <Text size="sm" fw={600} c="dimmed">
                                <Group gap="xs">
                                    <IconSettings size={16} />
                                    Ações CRM
                                </Group>
                            </Text>

                            {/* Pipeline Stage */}
                            <Select
                                label="Etapa do Pipeline"
                                placeholder="Selecione a etapa"
                                data={PIPELINE_STAGES}
                                value={pipelineStage}
                                onChange={(val) => setPipelineStage(val || '')}
                                leftSection={<IconArrowRight size={16} />}
                                size="xs"
                            />

                            {/* Proposal Value */}
                            <NumberInput
                                label="Valor da Proposta"
                                placeholder="0,00"
                                prefix="R$ "
                                decimalScale={2}
                                decimalSeparator=","
                                thousandSeparator="."
                                value={proposalValue}
                                onChange={(val) => setProposalValue(typeof val === 'number' ? val : '')}
                                leftSection={<IconCurrencyReal size={16} />}
                                size="xs"
                            />

                            {/* Interested Services */}
                            <MultiSelect
                                label="Serviços de Interesse"
                                placeholder="Selecione os serviços"
                                data={AVAILABLE_SERVICES}
                                value={interestedServices}
                                onChange={setInterestedServices}
                                leftSection={<IconPackage size={16} />}
                                size="xs"
                                searchable
                            />

                            {/* Tags */}
                            <TagsInput
                                label="Tags do Contato"
                                placeholder="Adicionar tag"
                                value={contactTags}
                                onChange={setContactTags}
                                leftSection={<IconTag size={16} />}
                                size="xs"
                            />

                            <Divider />

                            {/* Quick Actions */}
                            <Button
                                variant="light"
                                color="green"
                                leftSection={<IconCircleCheck size={16} />}
                                size="xs"
                                fullWidth
                            >
                                Marcar como Resolvido
                            </Button>

                            <Button
                                variant="light"
                                color="blue"
                                leftSection={<IconUser size={16} />}
                                size="xs"
                                fullWidth
                                onClick={() => navigate(`/admin/contacts?id=${selectedConversation.contact.id}`)}
                            >
                                Ver Perfil Completo
                            </Button>
                        </Stack>
                    </Card>
                )}
            </Group>
        </Stack>
    )
}
