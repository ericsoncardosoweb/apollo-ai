/**
 * Admin Inbox - Chat ao Vivo (Real-time Conversations)
 */

import { useState } from 'react'
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
    SimpleGrid,
    Divider,
    ThemeIcon,
    Box,
} from '@mantine/core'
import {
    IconSearch,
    IconSend,
    IconPhone,
    IconUser,
    IconMessageCircle,
    IconDots,
    IconPaperclip,
    IconMoodSmile,
} from '@tabler/icons-react'

// Mock conversations
const MOCK_CONVERSATIONS = [
    {
        id: '1',
        contact: { name: 'João Silva', phone: '+55 11 99999-1234', avatar: null },
        lastMessage: 'Olá, gostaria de saber mais sobre...',
        unread: 3,
        time: '10:45',
        status: 'active',
        agent: 'Lia',
    },
    {
        id: '2',
        contact: { name: 'Maria Santos', phone: '+55 11 98888-5678', avatar: null },
        lastMessage: 'Qual o valor do plano Pro?',
        unread: 0,
        time: '10:32',
        status: 'waiting',
        agent: 'Carlos',
    },
    {
        id: '3',
        contact: { name: 'Carlos Lima', phone: '+55 21 97777-9012', avatar: null },
        lastMessage: 'Obrigado pelo atendimento!',
        unread: 0,
        time: '09:15',
        status: 'closed',
        agent: 'Ana',
    },
]

const MOCK_MESSAGES = [
    { id: '1', sender: 'contact', text: 'Olá, boa tarde!', time: '10:40' },
    { id: '2', sender: 'agent', text: 'Olá João! Sou a Lia, assistente virtual. Como posso ajudar?', time: '10:41' },
    { id: '3', sender: 'contact', text: 'Gostaria de saber mais sobre os planos disponíveis', time: '10:42' },
    { id: '4', sender: 'agent', text: 'Claro! Temos 3 planos: Basic (R$ 97/mês), Pro (R$ 197/mês) e Enterprise. Qual gostaria de conhecer?', time: '10:43' },
    { id: '5', sender: 'contact', text: 'O plano Pro tem todas as funcionalidades?', time: '10:45' },
]

export default function AdminInbox() {
    const [selectedConversation, setSelectedConversation] = useState(MOCK_CONVERSATIONS[0])
    const [message, setMessage] = useState('')
    const [search, setSearch] = useState('')

    const filteredConversations = MOCK_CONVERSATIONS.filter(c =>
        c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contact.phone.includes(search)
    )

    return (
        <Stack gap="md" h="calc(100vh - 140px)">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Chat ao Vivo</Title>
                    <Text c="dimmed" size="sm">Conversas em tempo real</Text>
                </div>
                <Group>
                    <Badge color="green" variant="dot" size="lg">3 ativas</Badge>
                    <Badge color="yellow" variant="dot" size="lg">1 aguardando</Badge>
                </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" style={{ flex: 1, minHeight: 0 }}>
                {/* Conversations List */}
                <Card withBorder padding={0} radius="md" style={{ display: 'flex', flexDirection: 'column' }}>
                    <Box p="sm" bg="dark.7">
                        <TextInput
                            placeholder="Buscar conversa..."
                            leftSection={<IconSearch size={16} />}
                            size="sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </Box>
                    <ScrollArea style={{ flex: 1 }}>
                        {filteredConversations.map((conv) => (
                            <Paper
                                key={conv.id}
                                p="sm"
                                bg={selectedConversation.id === conv.id ? 'dark.6' : 'transparent'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedConversation(conv)}
                            >
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap="sm" wrap="nowrap">
                                        <Avatar color="blue" radius="xl">
                                            {conv.contact.name.charAt(0)}
                                        </Avatar>
                                        <div style={{ minWidth: 0 }}>
                                            <Text size="sm" fw={500} truncate>{conv.contact.name}</Text>
                                            <Text size="xs" c="dimmed" truncate>{conv.lastMessage}</Text>
                                        </div>
                                    </Group>
                                    <Stack gap={2} align="flex-end">
                                        <Text size="xs" c="dimmed">{conv.time}</Text>
                                        {conv.unread > 0 && (
                                            <Badge size="xs" circle color="green">{conv.unread}</Badge>
                                        )}
                                    </Stack>
                                </Group>
                            </Paper>
                        ))}
                    </ScrollArea>
                </Card>

                {/* Chat Area */}
                <Card withBorder padding={0} radius="md" style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
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
                            <Badge size="sm" color={selectedConversation.status === 'active' ? 'green' : 'gray'}>
                                {selectedConversation.agent}
                            </Badge>
                            <ActionIcon variant="subtle"><IconPhone size={18} /></ActionIcon>
                            <ActionIcon variant="subtle"><IconUser size={18} /></ActionIcon>
                            <ActionIcon variant="subtle"><IconDots size={18} /></ActionIcon>
                        </Group>
                    </Group>

                    {/* Messages */}
                    <ScrollArea style={{ flex: 1 }} p="md">
                        <Stack gap="md">
                            {MOCK_MESSAGES.map((msg) => (
                                <Group
                                    key={msg.id}
                                    justify={msg.sender === 'agent' ? 'flex-end' : 'flex-start'}
                                >
                                    <Paper
                                        p="sm"
                                        radius="md"
                                        maw="70%"
                                        bg={msg.sender === 'agent' ? 'teal.9' : 'dark.5'}
                                    >
                                        <Text size="sm">{msg.text}</Text>
                                        <Text size="xs" c="dimmed" ta="right" mt={4}>{msg.time}</Text>
                                    </Paper>
                                </Group>
                            ))}
                        </Stack>
                    </ScrollArea>

                    {/* Input Area */}
                    <Divider />
                    <Group p="sm" gap="xs">
                        <ActionIcon variant="subtle"><IconPaperclip size={18} /></ActionIcon>
                        <ActionIcon variant="subtle"><IconMoodSmile size={18} /></ActionIcon>
                        <TextInput
                            placeholder="Digite sua mensagem..."
                            style={{ flex: 1 }}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                        <ActionIcon color="teal" size="lg" radius="xl">
                            <IconSend size={18} />
                        </ActionIcon>
                    </Group>
                </Card>
            </SimpleGrid>
        </Stack>
    )
}
