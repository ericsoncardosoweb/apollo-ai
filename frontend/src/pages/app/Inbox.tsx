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
} from '@mantine/core'
import { IconSearch, IconSend, IconPaperclip, IconMoodSmile } from '@tabler/icons-react'

const conversations = [
    { id: '1', name: 'João Silva', lastMessage: 'Olá, gostaria de saber mais sobre...', time: '2 min', unread: 3, agent: 'Vendas' },
    { id: '2', name: 'Maria Santos', lastMessage: 'Perfeito, vou aguardar a proposta', time: '15 min', unread: 0, agent: 'Vendas' },
    { id: '3', name: 'Carlos Lima', lastMessage: 'Tive um problema com meu pedido', time: '1h', unread: 1, agent: 'Suporte' },
    { id: '4', name: 'Ana Pereira', lastMessage: 'Qual o prazo de entrega?', time: '2h', unread: 0, agent: 'Vendas' },
    { id: '5', name: 'Pedro Costa', lastMessage: 'Obrigado pelo atendimento!', time: '3h', unread: 0, agent: 'Suporte' },
]

const messages = [
    { id: '1', sender: 'contact', text: 'Olá! Vim pelo anúncio do Instagram.', time: '14:30' },
    { id: '2', sender: 'agent', text: 'Olá João! Bem-vindo! 😊 Como posso ajudá-lo hoje?', time: '14:30' },
    { id: '3', sender: 'contact', text: 'Gostaria de saber mais sobre o plano Enterprise', time: '14:31' },
    { id: '4', sender: 'agent', text: 'Perfeito! O plano Enterprise é ideal para empresas que precisam de recursos avançados. Ele inclui:\n\n• Agentes ilimitados\n• Integrações customizadas\n• Suporte prioritário 24/7\n• API dedicada', time: '14:31' },
    { id: '5', sender: 'contact', text: 'Qual o valor?', time: '14:32' },
]

export default function AppInbox() {
    return (
        <Stack gap="lg" h="calc(100vh - 120px)">
            <div>
                <Title order={2}>Inbox</Title>
                <Text c="dimmed" size="sm">Central de conversas com seus clientes</Text>
            </div>

            <Card withBorder padding={0} radius="md" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Conversations List */}
                <Box w={320} style={{ borderRight: '1px solid var(--mantine-color-dark-4)' }}>
                    <Box p="md">
                        <TextInput
                            placeholder="Buscar conversa..."
                            leftSection={<IconSearch size={16} />}
                        />
                    </Box>
                    <ScrollArea h="calc(100vh - 260px)">
                        {conversations.map((conv) => (
                            <Box
                                key={conv.id}
                                p="md"
                                style={{
                                    cursor: 'pointer',
                                    background: conv.id === '1' ? 'var(--mantine-color-dark-6)' : 'transparent',
                                    borderBottom: '1px solid var(--mantine-color-dark-5)',
                                }}
                            >
                                <Group justify="space-between" align="flex-start">
                                    <Group gap="sm">
                                        <Avatar radius="xl" color="teal">{conv.name.charAt(0)}</Avatar>
                                        <div>
                                            <Group gap="xs">
                                                <Text size="sm" fw={500}>{conv.name}</Text>
                                                {conv.unread > 0 && (
                                                    <Badge size="xs" circle color="teal">{conv.unread}</Badge>
                                                )}
                                            </Group>
                                            <Text size="xs" c="dimmed" lineClamp={1}>{conv.lastMessage}</Text>
                                        </div>
                                    </Group>
                                    <Stack gap={4} align="flex-end">
                                        <Text size="xs" c="dimmed">{conv.time}</Text>
                                        <Badge size="xs" variant="light" color="indigo">{conv.agent}</Badge>
                                    </Stack>
                                </Group>
                            </Box>
                        ))}
                    </ScrollArea>
                </Box>

                {/* Chat Area */}
                <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Chat Header */}
                    <Group p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
                        <Avatar radius="xl" color="teal">J</Avatar>
                        <div>
                            <Text fw={500}>João Silva</Text>
                            <Text size="xs" c="dimmed">+55 11 99999-9999 • Agente: Vendas</Text>
                        </div>
                    </Group>

                    {/* Messages */}
                    <ScrollArea style={{ flex: 1 }} p="md">
                        <Stack gap="md">
                            {messages.map((msg) => (
                                <Group
                                    key={msg.id}
                                    justify={msg.sender === 'contact' ? 'flex-start' : 'flex-end'}
                                >
                                    <Paper
                                        p="sm"
                                        radius="md"
                                        maw="70%"
                                        bg={msg.sender === 'contact' ? 'dark.6' : 'teal.9'}
                                    >
                                        <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{msg.text}</Text>
                                        <Text size="xs" c="dimmed" ta="right" mt={4}>{msg.time}</Text>
                                    </Paper>
                                </Group>
                            ))}
                        </Stack>
                    </ScrollArea>

                    {/* Input Area */}
                    <Group p="md" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
                        <ActionIcon variant="subtle" size="lg">
                            <IconPaperclip size={20} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" size="lg">
                            <IconMoodSmile size={20} />
                        </ActionIcon>
                        <TextInput
                            placeholder="Digite sua mensagem..."
                            style={{ flex: 1 }}
                            radius="xl"
                        />
                        <ActionIcon variant="filled" size="lg" color="teal" radius="xl">
                            <IconSend size={18} />
                        </ActionIcon>
                    </Group>
                </Box>
            </Card>
        </Stack>
    )
}
