/**
 * Admin Quick Replies - Respostas Rápidas para Chat
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
    ThemeIcon,
    Paper,
    SimpleGrid,
    Table,
    Textarea,
    Switch,
    Skeleton,
    Alert,
    Code,
    Tooltip,
    Select,
    CopyButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconSearch,
    IconTrash,
    IconEdit,
    IconRefresh,
    IconMessage,
    IconCopy,
    IconCheck,
    IconDatabase,
    IconCommand,
    IconTag,
} from '@tabler/icons-react'
import {
    useQuickReplies,
    useCreateQuickReply,
    useUpdateQuickReply,
    useDeleteQuickReply,
    QuickReply,
} from '@/hooks/useConnections'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'

const CATEGORY_OPTIONS = [
    { value: 'saudacao', label: '👋 Saudação' },
    { value: 'despedida', label: '👋 Despedida' },
    { value: 'informacao', label: 'ℹ️ Informação' },
    { value: 'vendas', label: '💰 Vendas' },
    { value: 'suporte', label: '🛠️ Suporte' },
    { value: 'agendamento', label: '📅 Agendamento' },
    { value: 'financeiro', label: '💳 Financeiro' },
    { value: 'outro', label: '📝 Outro' },
]

export default function AdminQuickReplies() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState<string | null>(null)

    // Form state
    const [editingReply, setEditingReply] = useState<QuickReply | null>(null)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [shortcut, setShortcut] = useState('')
    const [category, setCategory] = useState<string>('outro')

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Hooks
    const { data: replies, isLoading, refetch, error } = useQuickReplies(filterCategory || undefined)
    const createReply = useCreateQuickReply()
    const updateReply = useUpdateQuickReply()
    const deleteReply = useDeleteQuickReply()

    // Detect table not found
    const tableNotFound = error && typeof error === 'object' && 'message' in error &&
        String((error as { message: string }).message).includes('quick_replies')

    const resetForm = () => {
        setTitle('')
        setContent('')
        setShortcut('')
        setCategory('outro')
        setEditingReply(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (reply: QuickReply) => {
        setEditingReply(reply)
        setTitle(reply.title)
        setContent(reply.content)
        setShortcut(reply.shortcut || '')
        setCategory(reply.category || 'outro')
        openModal()
    }

    const handleSubmit = async () => {
        const data = {
            title,
            content,
            shortcut: shortcut || undefined,
            category,
        }

        if (editingReply) {
            await updateReply.mutateAsync({ id: editingReply.id, ...data })
        } else {
            await createReply.mutateAsync(data)
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover esta resposta rápida?')) {
            deleteReply.mutate(id)
        }
    }

    // Filter replies
    const filteredReplies = replies?.filter(reply =>
        reply.title.toLowerCase().includes(search.toLowerCase()) ||
        reply.content.toLowerCase().includes(search.toLowerCase()) ||
        reply.shortcut?.toLowerCase().includes(search.toLowerCase())
    ) || []

    // Group by category for stats
    const categoryStats = replies?.reduce((acc, r) => {
        const cat = r.category || 'outro'
        acc[cat] = (acc[cat] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    if (tableNotFound) {
        return (
            <Stack gap="lg">
                <Title order={2}>Respostas Rápidas</Title>
                <Alert
                    icon={<IconDatabase size={16} />}
                    color="yellow"
                    title="Migração Necessária"
                >
                    <Text size="sm" mb="sm">
                        A tabela de respostas rápidas não foi encontrada. Execute a migração SQL.
                    </Text>
                    <Code block>
                        {`-- Execute no banco do tenant: connections_v2.sql`}
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
                        <Title order={2}>Respostas Rápidas</Title>
                        <Text c="dimmed" size="sm">
                            Templates de mensagens para agilizar o atendimento
                        </Text>
                    </div>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleOpenCreate}
                        disabled={!isConfigured}
                    >
                        Nova Resposta
                    </Button>
                </Group>

                {!isConfigured && (
                    <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                        Configure o banco de dados do cliente para gerenciar respostas rápidas.
                    </Alert>
                )}

                {/* Stats by Category */}
                <SimpleGrid cols={{ base: 2, sm: 4, md: 8 }} spacing="xs">
                    {CATEGORY_OPTIONS.map((cat) => (
                        <Paper
                            key={cat.value}
                            p="xs"
                            withBorder
                            radius="md"
                            style={{
                                cursor: 'pointer',
                                borderColor: filterCategory === cat.value ? 'var(--mantine-color-blue-6)' : undefined,
                                backgroundColor: filterCategory === cat.value ? 'var(--mantine-color-blue-light)' : undefined,
                            }}
                            onClick={() => setFilterCategory(filterCategory === cat.value ? null : cat.value)}
                        >
                            <Text size="xs" ta="center">
                                {cat.label}
                            </Text>
                            <Text size="lg" fw={700} ta="center">
                                {categoryStats[cat.value] || 0}
                            </Text>
                        </Paper>
                    ))}
                </SimpleGrid>

                {/* Replies List */}
                <Card withBorder padding="md" radius="md">
                    <Group gap="md" mb="md">
                        <TextInput
                            placeholder="Buscar resposta..."
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
                    ) : filteredReplies.length > 0 ? (
                        <Table.ScrollContainer minWidth={500}>
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Título</Table.Th>
                                        <Table.Th>Atalho</Table.Th>
                                        <Table.Th>Categoria</Table.Th>
                                        <Table.Th>Uso</Table.Th>
                                        <Table.Th>Ações</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredReplies.map((reply) => (
                                        <Table.Tr key={reply.id}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <ThemeIcon variant="light" color="blue" size="sm">
                                                        <IconMessage size={14} />
                                                    </ThemeIcon>
                                                    <div>
                                                        <Text size="sm" fw={500}>{reply.title}</Text>
                                                        <Text size="xs" c="dimmed" lineClamp={1} maw={300}>
                                                            {reply.content}
                                                        </Text>
                                                    </div>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                {reply.shortcut ? (
                                                    <Code>{reply.shortcut}</Code>
                                                ) : (
                                                    <Text size="xs" c="dimmed">-</Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge variant="light" size="sm">
                                                    {CATEGORY_OPTIONS.find(c => c.value === reply.category)?.label || reply.category}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{reply.usage_count}x</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <CopyButton value={reply.content}>
                                                        {({ copied, copy }) => (
                                                            <Tooltip label={copied ? 'Copiado!' : 'Copiar conteúdo'}>
                                                                <ActionIcon
                                                                    variant="subtle"
                                                                    color={copied ? 'green' : 'gray'}
                                                                    onClick={copy}
                                                                >
                                                                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        )}
                                                    </CopyButton>
                                                    <ActionIcon variant="light" onClick={() => handleOpenEdit(reply)}>
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                    <ActionIcon variant="light" color="red" onClick={() => handleDelete(reply.id)}>
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    ) : (
                        <Paper p="xl" ta="center" bg="dark.6" radius="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                <IconMessage size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">Nenhuma resposta rápida encontrada</Text>
                            <Button variant="light" mt="md" onClick={handleOpenCreate} disabled={!isConfigured}>
                                Adicionar primeira resposta
                            </Button>
                        </Paper>
                    )}
                </Card>

                {/* Usage Tips */}
                <Alert color="blue" title="💡 Dica de Uso" variant="light">
                    <Text size="sm">
                        No chat, digite o atalho configurado (ex: <Code>/oi</Code>) para inserir a resposta rapidamente.
                        Você também pode acessar todas as respostas pelo ícone de mensagem rápida.
                    </Text>
                </Alert>
            </Stack>

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpened}
                onClose={() => { closeModal(); resetForm(); }}
                title={editingReply ? 'Editar Resposta' : 'Nova Resposta Rápida'}
                size="lg"
            >
                <Stack gap="md">
                    <TextInput
                        label="Título"
                        placeholder="Ex: Saudação Inicial"
                        description="Nome para identificar a resposta"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />

                    <Textarea
                        label="Conteúdo da Mensagem"
                        placeholder="Olá! Como posso ajudar você hoje?"
                        description="Suporta formatação WhatsApp: *negrito*, _itálico_, ~riscado~"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={5}
                        required
                    />

                    <SimpleGrid cols={2}>
                        <TextInput
                            label="Atalho"
                            placeholder="/oi"
                            description="Comando rápido (ex: /oi)"
                            leftSection={<IconCommand size={16} />}
                            value={shortcut}
                            onChange={(e) => setShortcut(e.target.value)}
                        />
                        <Select
                            label="Categoria"
                            data={CATEGORY_OPTIONS}
                            value={category}
                            onChange={(val) => setCategory(val || 'outro')}
                            leftSection={<IconTag size={16} />}
                        />
                    </SimpleGrid>

                    {/* Preview */}
                    <div>
                        <Text size="sm" fw={500} mb="xs">Pré-visualização:</Text>
                        <Paper p="md" bg="dark.7" radius="md">
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                {content || 'Digite o conteúdo acima para visualizar...'}
                            </Text>
                        </Paper>
                    </div>

                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createReply.isPending || updateReply.isPending}
                            disabled={!title || !content}
                        >
                            {editingReply ? 'Salvar' : 'Criar Resposta'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
