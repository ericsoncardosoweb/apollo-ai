/**
 * Inbox Page - Advanced Chat Interface
 * Features: Buffer Ativo (typing), Modo Espião, Botão de Pânico
 */

import { useState } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    TextInput,
    Avatar,
    Badge,
    ScrollArea,
    Paper,
    ActionIcon,
    Box,
    Skeleton,
    ThemeIcon,
    Button,
    Tooltip,
    Kbd,
    Indicator,
    Transition,
    Overlay,
} from '@mantine/core'
import {
    IconSearch,
    IconSend,
    IconPaperclip,
    IconMoodSmile,
    IconEye,
    IconEyeOff,
    IconAlertTriangle,
    IconRobot,
    IconPhone,
    IconDotsVertical,
    IconPlayerPause,
    IconInbox,
} from '@tabler/icons-react'
import { Conversation, ChatMessage } from '@/types'

// Mock data for conversations
const mockConversations: Conversation[] = [
    {
        id: '1',
        contact_name: 'João Silva',
        contact_phone: '+55 11 99999-1234',
        last_message: 'Olá, gostaria de saber mais sobre os planos...',
        last_message_at: new Date().toISOString(),
        unread_count: 3,
        agent_name: 'Assistente de Vendas',
        status: 'active',
        is_typing: true, // Buffer Ativo
        is_spy_mode: false,
    },
    {
        id: '2',
        contact_name: 'Maria Santos',
        contact_phone: '+55 21 98888-5678',
        last_message: 'Perfeito, vou aguardar a proposta',
        last_message_at: new Date(Date.now() - 900000).toISOString(),
        unread_count: 0,
        agent_name: 'Assistente de Vendas',
        status: 'active',
        is_typing: false,
        is_spy_mode: false,
    },
    {
        id: '3',
        contact_name: 'Carlos Lima',
        contact_phone: '+55 31 97777-9012',
        last_message: 'Tive um problema com meu pedido #4521',
        last_message_at: new Date(Date.now() - 3600000).toISOString(),
        unread_count: 1,
        agent_name: 'Suporte Técnico',
        status: 'waiting',
        is_typing: false,
        is_spy_mode: false,
    },
    {
        id: '4',
        contact_name: 'Ana Pereira',
        contact_phone: '+55 41 96666-3456',
        last_message: 'Qual o prazo de entrega para São Paulo?',
        last_message_at: new Date(Date.now() - 7200000).toISOString(),
        unread_count: 0,
        agent_name: 'Assistente de Vendas',
        status: 'active',
        is_typing: false,
        is_spy_mode: false,
    },
]

const mockMessages: ChatMessage[] = [
    { id: '1', conversation_id: '1', sender: 'contact', content: 'Olá! Vim pelo anúncio do Instagram.', content_type: 'text', sent_at: '14:30', is_read: true },
    { id: '2', conversation_id: '1', sender: 'agent', content: 'Olá João! Bem-vindo! 😊 Como posso ajudá-lo hoje?', content_type: 'text', sent_at: '14:30', is_read: true },
    { id: '3', conversation_id: '1', sender: 'contact', content: 'Gostaria de saber mais sobre os planos disponíveis', content_type: 'text', sent_at: '14:31', is_read: true },
    { id: '4', conversation_id: '1', sender: 'agent', content: 'Perfeito! Temos 3 planos disponíveis:\n\n• **Starter** - R$97/mês - 1 agente\n• **Pro** - R$297/mês - 5 agentes\n• **Enterprise** - Sob consulta - Ilimitado\n\nQual deles te interessa mais?', content_type: 'text', sent_at: '14:31', is_read: true },
    { id: '5', conversation_id: '1', sender: 'contact', content: 'O Pro parece interessante, mas preciso de mais detalhes sobre integrações', content_type: 'text', sent_at: '14:32', is_read: true },
]

// Typing Indicator Component (Buffer Ativo)
function TypingIndicator() {
    return (
        <Group gap={4} p="sm">
            <Box
                w={8}
                h={8}
                bg="teal.5"
                style={{ borderRadius: '50%', animation: 'pulse 1s infinite' }}
            />
            <Box
                w={8}
                h={8}
                bg="teal.5"
                style={{ borderRadius: '50%', animation: 'pulse 1s infinite 0.2s' }}
            />
            <Box
                w={8}
                h={8}
                bg="teal.5"
                style={{ borderRadius: '50%', animation: 'pulse 1s infinite 0.4s' }}
            />
            <Text size="xs" c="dimmed" ml={4}>Digitando...</Text>
        </Group>
    )
}

// Conversation List Item
function ConversationItem({
    conversation,
    isSelected,
    onClick
}: {
    conversation: Conversation
    isSelected: boolean
    onClick: () => void
}) {
    return (
        <Box
            p="md"
            onClick={onClick}
            style={{
                cursor: 'pointer',
                background: isSelected ? 'var(--mantine-color-dark-6)' : 'transparent',
                borderBottom: '1px solid var(--mantine-color-dark-5)',
                transition: 'background 0.1s ease',
            }}
        >
            <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                    <Indicator
                        color={conversation.status === 'active' ? 'green' : 'yellow'}
                        position="bottom-end"
                        size={10}
                        offset={4}
                    >
                        <Avatar radius="xl" color="teal">
                            {conversation.contact_name.charAt(0)}
                        </Avatar>
                    </Indicator>
                    <div>
                        <Group gap="xs">
                            <Text size="sm" fw={500}>{conversation.contact_name}</Text>
                            {conversation.unread_count > 0 && (
                                <Badge size="xs" circle color="teal">{conversation.unread_count}</Badge>
                            )}
                        </Group>
                        <Group gap={4}>
                            {conversation.is_typing ? (
                                <Text size="xs" c="teal" fw={500}>Digitando...</Text>
                            ) : (
                                <Text size="xs" c="dimmed" lineClamp={1}>{conversation.last_message}</Text>
                            )}
                        </Group>
                    </div>
                </Group>
                <Stack gap={4} align="flex-end">
                    <Text size="xs" c="dimmed">
                        {new Date(conversation.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Badge size="xs" variant="light" color="indigo">
                        <Group gap={4}>
                            <IconRobot size={10} />
                            {conversation.agent_name.split(' ')[0]}
                        </Group>
                    </Badge>
                </Stack>
            </Group>
        </Box>
    )
}

// Conversation Skeleton Loading
function ConversationSkeleton() {
    return (
        <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
            <Group>
                <Skeleton height={40} circle />
                <div style={{ flex: 1 }}>
                    <Skeleton height={12} width="60%" mb={8} />
                    <Skeleton height={10} width="80%" />
                </div>
            </Group>
        </Box>
    )
}

// Message Bubble
function MessageBubble({ message, isSpyMode }: { message: ChatMessage; isSpyMode: boolean }) {
    const isContact = message.sender === 'contact'
    const isAgent = message.sender === 'agent'

    return (
        <Group justify={isContact ? 'flex-start' : 'flex-end'}>
            <Paper
                p="sm"
                radius="md"
                maw="70%"
                bg={isContact ? 'dark.6' : isAgent ? 'teal.9' : 'indigo.9'}
                style={{
                    opacity: isSpyMode && isAgent ? 0.7 : 1,
                    position: 'relative',
                }}
            >
                {isAgent && isSpyMode && (
                    <Badge
                        size="xs"
                        color="yellow"
                        variant="filled"
                        style={{ position: 'absolute', top: -8, right: -8 }}
                    >
                        <IconRobot size={10} />
                    </Badge>
                )}
                <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{message.content}</Text>
                <Text size="xs" c="dimmed" ta="right" mt={4}>{message.sent_at}</Text>
            </Paper>
        </Group>
    )
}

export default function AppInbox() {
    const [search, setSearch] = useState('')
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(mockConversations[0])
    const [isSpyMode, setIsSpyMode] = useState(false)
    const [isPanicMode, setIsPanicMode] = useState(false)
    const [isLoading] = useState(false)
    const [messageInput, setMessageInput] = useState('')

    // Filter conversations by search
    const filteredConversations = mockConversations.filter(conv =>
        conv.contact_name.toLowerCase().includes(search.toLowerCase()) ||
        conv.contact_phone.includes(search)
    )

    // Handle Panic Button - Take over conversation from AI
    const handlePanicMode = () => {
        setIsPanicMode(!isPanicMode)
        // In real implementation: Notify backend to pause AI agent
    }

    return (
        <Stack gap="lg" h="calc(100vh - 120px)">
            {/* Header with controls */}
            <Group justify="space-between">
                <div>
                    <Title order={2}>Inbox</Title>
                    <Text c="dimmed" size="sm">Central de conversas com seus clientes</Text>
                </div>
                <Group gap="xs">
                    {/* Spy Mode Toggle */}
                    <Tooltip label={isSpyMode ? 'Desativar Modo Espião' : 'Ativar Modo Espião (ver ações do agente)'}>
                        <ActionIcon
                            variant={isSpyMode ? 'filled' : 'light'}
                            color={isSpyMode ? 'yellow' : 'gray'}
                            size="lg"
                            onClick={() => setIsSpyMode(!isSpyMode)}
                        >
                            {isSpyMode ? <IconEye size={20} /> : <IconEyeOff size={20} />}
                        </ActionIcon>
                    </Tooltip>

                    {/* Panic Button */}
                    <Tooltip label={isPanicMode ? 'Devolver ao Agente IA' : 'Assumir Conversa (Botão de Pânico)'}>
                        <Button
                            variant={isPanicMode ? 'filled' : 'light'}
                            color={isPanicMode ? 'red' : 'gray'}
                            leftSection={isPanicMode ? <IconPlayerPause size={16} /> : <IconAlertTriangle size={16} />}
                            onClick={handlePanicMode}
                        >
                            {isPanicMode ? 'IA Pausada' : 'Assumir'}
                        </Button>
                    </Tooltip>
                </Group>
            </Group>

            {/* Spy Mode Indicator */}
            <Transition mounted={isSpyMode} transition="slide-down" duration={200}>
                {(styles) => (
                    <Paper style={styles} p="xs" bg="yellow.9" radius="md">
                        <Group justify="center" gap="xs">
                            <IconEye size={16} />
                            <Text size="sm" fw={500}>
                                Modo Espião Ativo - Você está observando as respostas do agente IA
                            </Text>
                            <Kbd size="xs">ESC para sair</Kbd>
                        </Group>
                    </Paper>
                )}
            </Transition>

            {/* Main Chat Interface */}
            <Card withBorder padding={0} radius="md" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Conversations List */}
                <Box w={340} style={{ borderRight: '1px solid var(--mantine-color-dark-4)' }}>
                    <Box p="md">
                        <TextInput
                            placeholder="Buscar conversa..."
                            leftSection={<IconSearch size={16} />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </Box>
                    <ScrollArea h="calc(100vh - 300px)">
                        {isLoading ? (
                            <>
                                <ConversationSkeleton />
                                <ConversationSkeleton />
                                <ConversationSkeleton />
                            </>
                        ) : (
                            filteredConversations.map((conv) => (
                                <ConversationItem
                                    key={conv.id}
                                    conversation={conv}
                                    isSelected={selectedConversation?.id === conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                />
                            ))
                        )}
                    </ScrollArea>
                </Box>

                {/* Chat Area */}
                <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {/* Panic Mode Overlay */}
                    {isPanicMode && (
                        <Overlay color="red" opacity={0.05} zIndex={1} />
                    )}

                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <Group p="md" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
                                <Group>
                                    <Avatar radius="xl" color="teal">{selectedConversation.contact_name.charAt(0)}</Avatar>
                                    <div>
                                        <Group gap="xs">
                                            <Text fw={500}>{selectedConversation.contact_name}</Text>
                                            {isPanicMode && (
                                                <Badge color="red" size="xs" variant="filled">
                                                    MODO MANUAL
                                                </Badge>
                                            )}
                                        </Group>
                                        <Text size="xs" c="dimmed">{selectedConversation.contact_phone}</Text>
                                    </div>
                                </Group>
                                <Group gap="xs">
                                    <Tooltip label="Ligar">
                                        <ActionIcon variant="light" size="lg">
                                            <IconPhone size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <ActionIcon variant="subtle" size="lg">
                                        <IconDotsVertical size={18} />
                                    </ActionIcon>
                                </Group>
                            </Group>

                            {/* Messages */}
                            <ScrollArea style={{ flex: 1 }} p="md">
                                <Stack gap="md">
                                    {mockMessages.map((msg) => (
                                        <MessageBubble key={msg.id} message={msg} isSpyMode={isSpyMode} />
                                    ))}

                                    {/* Typing Indicator (Buffer Ativo) */}
                                    {selectedConversation.is_typing && (
                                        <Group justify="flex-start">
                                            <Paper p="xs" radius="md" bg="dark.6">
                                                <TypingIndicator />
                                            </Paper>
                                        </Group>
                                    )}
                                </Stack>
                            </ScrollArea>

                            {/* Input Area */}
                            <Group p="md" style={{ borderTop: '1px solid var(--mantine-color-dark-4)', position: 'relative', zIndex: 2 }}>
                                <ActionIcon variant="subtle" size="lg">
                                    <IconPaperclip size={20} />
                                </ActionIcon>
                                <ActionIcon variant="subtle" size="lg">
                                    <IconMoodSmile size={20} />
                                </ActionIcon>
                                <TextInput
                                    placeholder={isPanicMode ? "Digite sua mensagem (modo manual)..." : "Mensagem (IA responde automaticamente)..."}
                                    style={{ flex: 1 }}
                                    radius="xl"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    styles={isPanicMode ? { input: { borderColor: 'var(--mantine-color-red-6)' } } : undefined}
                                />
                                <ActionIcon
                                    variant="filled"
                                    size="lg"
                                    color={isPanicMode ? 'red' : 'teal'}
                                    radius="xl"
                                >
                                    <IconSend size={18} />
                                </ActionIcon>
                            </Group>
                        </>
                    ) : (
                        <Stack align="center" justify="center" style={{ flex: 1 }}>
                            <ThemeIcon size={80} radius="xl" variant="light" color="gray">
                                <IconInbox size={40} />
                            </ThemeIcon>
                            <Text c="dimmed">Selecione uma conversa</Text>
                        </Stack>
                    )}
                </Box>
            </Card>

            {/* CSS for typing animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </Stack>
    )
}
