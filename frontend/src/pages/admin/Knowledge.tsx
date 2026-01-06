/**
 * Admin Knowledge Base - RAG e Documentos (conectado ao banco do CLIENTE)
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
    Progress,
    FileButton,
    List,
    Divider,
    Skeleton,
    Alert,
    Textarea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconUpload,
    IconFile,
    IconFileText,
    IconFileTypePdf,
    IconLink,
    IconTrash,
    IconSearch,
    IconBrain,
    IconRefresh,
    IconCheck,
    IconClock,
    IconDatabase,
} from '@tabler/icons-react'
import {
    useClientDocuments,
    useCreateClientDocument,
    useDeleteClientDocument,
    useClientKnowledgeStats,
} from '@/hooks/useClientKnowledge'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'

export default function AdminKnowledge() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [urlInput, setUrlInput] = useState('')
    const [titleInput, setTitleInput] = useState('')
    const [contentInput, setContentInput] = useState('')

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Client Database Hooks
    const { data: documents, isLoading, refetch } = useClientDocuments()
    const { data: stats } = useClientKnowledgeStats()
    const createDocument = useCreateClientDocument()
    const deleteDocument = useDeleteClientDocument()

    const getFileIcon = (type: string | null) => {
        switch (type) {
            case 'pdf': return <IconFileTypePdf size={20} />
            case 'doc':
            case 'docx': return <IconFileText size={20} />
            case 'url': return <IconLink size={20} />
            default: return <IconFile size={20} />
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
            case 'indexed':
                return <Badge color="green" variant="dot" leftSection={<IconCheck size={10} />}>Indexado</Badge>
            case 'processing':
                return <Badge color="yellow" variant="dot" leftSection={<IconClock size={10} />}>Processando</Badge>
            default:
                return <Badge color="gray" variant="dot">Pendente</Badge>
        }
    }

    const handleCreateDocument = async () => {
        if (!titleInput) return
        await createDocument.mutateAsync({
            title: titleInput,
            content: contentInput || undefined,
            file_url: urlInput || undefined,
            file_type: urlInput ? 'url' : 'text',
        })
        setTitleInput('')
        setContentInput('')
        setUrlInput('')
        closeModal()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover este documento?')) {
            deleteDocument.mutate(id)
        }
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Base de Conhecimento</Title>
                        <Text c="dimmed" size="sm">
                            RAG - Documentos de {selectedCompany?.name || 'empresa'}
                        </Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={openModal} disabled={!isConfigured}>
                        Adicionar Fonte
                    </Button>
                </Group>

                {/* Alert se banco não configurado */}
                {!isConfigured && (
                    <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                        Configure o banco de dados do cliente para gerenciar documentos.
                        Acesse Empresas → Configurar Banco de Dados.
                    </Alert>
                )}

                {/* Stats */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="blue">
                                <IconFile size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.total || 0}</Text>
                                <Text size="xs" c="dimmed">Documentos</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="teal">
                                <IconBrain size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.totalChunks || 0}</Text>
                                <Text size="xs" c="dimmed">Chunks Indexados</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="green">
                                <IconCheck size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.indexed || 0}</Text>
                                <Text size="xs" c="dimmed">Indexados</Text>
                            </div>
                        </Group>
                    </Paper>
                    <Paper p="md" withBorder radius="md">
                        <Group gap="xs">
                            <ThemeIcon size="lg" variant="light" color="yellow">
                                <IconClock size={20} />
                            </ThemeIcon>
                            <div>
                                <Text size="xl" fw={700}>{stats?.pending || 0}</Text>
                                <Text size="xs" c="dimmed">Pendentes</Text>
                            </div>
                        </Group>
                    </Paper>
                </SimpleGrid>

                {/* Documents List */}
                <Card withBorder padding="md" radius="md">
                    <Group gap="md" mb="md">
                        <TextInput
                            placeholder="Buscar documento..."
                            leftSection={<IconSearch size={16} />}
                            style={{ flex: 1 }}
                        />
                        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
                            Atualizar
                        </Button>
                    </Group>

                    {isLoading ? (
                        <Stack gap="sm">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} height={60} radius="sm" />
                            ))}
                        </Stack>
                    ) : documents && documents.length > 0 ? (
                        <Stack gap="sm">
                            {documents.map((doc) => (
                                <Paper key={doc.id} p="sm" bg="dark.6" radius="sm">
                                    <Group justify="space-between">
                                        <Group gap="sm">
                                            <ThemeIcon variant="light" color={doc.file_type === 'pdf' ? 'red' : doc.file_type === 'url' ? 'blue' : 'gray'}>
                                                {getFileIcon(doc.file_type)}
                                            </ThemeIcon>
                                            <div>
                                                <Text size="sm" fw={500}>{doc.title}</Text>
                                                <Group gap="xs">
                                                    <Text size="xs" c="dimmed">{doc.chunk_count || 0} chunks</Text>
                                                    <Text size="xs" c="dimmed">•</Text>
                                                    <Text size="xs" c="dimmed">
                                                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                                    </Text>
                                                </Group>
                                            </div>
                                        </Group>
                                        <Group gap="xs">
                                            {getStatusBadge(doc.embedding_status)}
                                            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(doc.id)}>
                                                <IconTrash size={16} />
                                            </ActionIcon>
                                        </Group>
                                    </Group>
                                    {doc.embedding_status === 'processing' && (
                                        <Progress value={65} size="xs" mt="sm" animated />
                                    )}
                                </Paper>
                            ))}
                        </Stack>
                    ) : (
                        <Paper p="xl" ta="center" bg="dark.6" radius="md">
                            <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                <IconFile size={30} />
                            </ThemeIcon>
                            <Text c="dimmed">Nenhum documento encontrado</Text>
                            <Button variant="light" mt="md" onClick={openModal} disabled={!isConfigured}>
                                Adicionar primeiro documento
                            </Button>
                        </Paper>
                    )}
                </Card>

                {/* Tips */}
                <Card withBorder padding="md" radius="md" bg="dark.7">
                    <Group gap="xs" mb="sm">
                        <IconBrain size={18} />
                        <Text fw={600}>Dicas para melhor performance</Text>
                    </Group>
                    <List size="sm" c="dimmed">
                        <List.Item>Documentos menores (até 10MB) são processados mais rápido</List.Item>
                        <List.Item>PDFs com texto selecionável têm melhor indexação</List.Item>
                        <List.Item>URLs de páginas estáticas funcionam melhor que SPAs</List.Item>
                        <List.Item>Atualize documentos frequentemente para manter informações recentes</List.Item>
                    </List>
                </Card>
            </Stack>

            {/* Add Source Modal */}
            <Modal opened={modalOpened} onClose={closeModal} title="Adicionar Fonte" size="md">
                <Stack gap="md">
                    <Text size="sm" c="dimmed">Escolha como adicionar conhecimento à base:</Text>

                    <Card withBorder padding="md" radius="md">
                        <Group gap="sm" mb="sm">
                            <IconUpload size={18} />
                            <Text fw={500}>Upload de Arquivo</Text>
                        </Group>
                        <Text size="xs" c="dimmed" mb="md">PDF, DOCX, TXT (máx 10MB)</Text>
                        <FileButton onChange={() => { }} accept=".pdf,.docx,.txt">
                            {(props) => (
                                <Button {...props} variant="light" fullWidth>
                                    Selecionar Arquivo
                                </Button>
                            )}
                        </FileButton>
                    </Card>

                    <Divider label="ou" labelPosition="center" />

                    <Card withBorder padding="md" radius="md">
                        <Group gap="sm" mb="sm">
                            <IconLink size={18} />
                            <Text fw={500}>URL da Web</Text>
                        </Group>
                        <TextInput
                            placeholder="https://site.com/pagina"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                        />
                        <Button variant="light" fullWidth mt="md" disabled={!urlInput}>
                            Indexar URL
                        </Button>
                    </Card>
                </Stack>
            </Modal>
        </>
    )
}
