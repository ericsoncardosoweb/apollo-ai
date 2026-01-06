/**
 * Página de Agentes de IA - Versão Dinâmica
 * Integrado com Supabase via hooks React Query
 */

import { useState } from 'react'
import {
    Box,
    Title,
    Text,
    Card,
    Group,
    Stack,
    Button,
    TextInput,
    Badge,
    ActionIcon,
    Menu,
    Modal,
    Textarea,
    Select,
    SimpleGrid,
    Loader,
    ThemeIcon,
    Tooltip,
    Avatar,
    Paper,
    Tabs,
    Switch,
    NumberInput,
    Divider,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconCopy,
    IconPlayerPause,
    IconPlayerPlay,
    IconRobot,
    IconSearch,
    IconBrain,
    IconSettings,
    IconTestPipe,
    IconChartBar,
    IconMessage,
    IconClock,
} from '@tabler/icons-react'
import {
    useAgents,
    useCreateAgent,
    useUpdateAgent,
    useDeleteAgent,
    useDuplicateAgent,
    Agent,
} from '@/hooks/useAgents'
import AdvancedPromptEditor from '@/components/prompt-editor/AdvancedPromptEditor'

// =============================================================================
// AGENT CARD COMPONENT
// =============================================================================

interface AgentCardProps {
    agent: Agent
    onEdit: (agent: Agent) => void
    onDuplicate: (agentId: string) => void
    onDelete: (agentId: string) => void
    onToggleActive: (agent: Agent) => void
}

function AgentCard({ agent, onEdit, onDuplicate, onDelete, onToggleActive }: AgentCardProps) {
    return (
        <Card withBorder padding="lg" radius="md" style={{ cursor: 'pointer' }}>
            <Group justify="space-between" mb="md">
                <Group>
                    <Avatar color={agent.color} radius="xl">
                        {agent.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                        <Text fw={600}>{agent.name}</Text>
                        <Text size="xs" c="dimmed">{agent.description || 'Sem descrição'}</Text>
                    </div>
                </Group>

                <Group gap={4}>
                    <Badge color={agent.is_active ? 'green' : 'gray'} variant="light">
                        {agent.is_active ? 'Ativo' : 'Pausado'}
                    </Badge>

                    <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                                <IconDotsVertical size={16} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={() => onEdit(agent)}
                            >
                                Editar
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconCopy size={14} />}
                                onClick={() => onDuplicate(agent.id)}
                            >
                                Duplicar
                            </Menu.Item>
                            <Menu.Item
                                leftSection={agent.is_active ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
                                onClick={() => onToggleActive(agent)}
                            >
                                {agent.is_active ? 'Pausar' : 'Ativar'}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                                leftSection={<IconTrash size={14} />}
                                color="red"
                                onClick={() => onDelete(agent.id)}
                            >
                                Remover
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>

            {/* Stats */}
            <SimpleGrid cols={3} spacing="xs" mb="md">
                <Paper p="xs" bg="dark.6" radius="sm" ta="center">
                    <Text size="lg" fw={700}>{agent.total_conversations}</Text>
                    <Text size="xs" c="dimmed">Conversas</Text>
                </Paper>
                <Paper p="xs" bg="dark.6" radius="sm" ta="center">
                    <Text size="lg" fw={700}>{agent.total_messages}</Text>
                    <Text size="xs" c="dimmed">Mensagens</Text>
                </Paper>
                <Paper p="xs" bg="dark.6" radius="sm" ta="center">
                    <Text size="lg" fw={700}>{agent.avg_response_time_ms ? `${(agent.avg_response_time_ms / 1000).toFixed(1)}s` : '-'}</Text>
                    <Text size="xs" c="dimmed">Tempo Resp.</Text>
                </Paper>
            </SimpleGrid>

            {/* Config badges */}
            <Group gap={4}>
                <Badge size="xs" variant="outline" color="blue">{agent.model_name}</Badge>
                {agent.rag_enabled && <Badge size="xs" variant="outline" color="green">RAG</Badge>}
                {agent.reengagement_enabled && <Badge size="xs" variant="outline" color="orange">Re-engaja</Badge>}
                {agent.agent_type === 'orchestrator' && <Badge size="xs" variant="outline" color="violet">Orquestrador</Badge>}
            </Group>

            {/* Click to edit */}
            <Button
                variant="light"
                fullWidth
                mt="md"
                leftSection={<IconEdit size={14} />}
                onClick={() => onEdit(agent)}
            >
                Editar Prompt
            </Button>
        </Card>
    )
}

// =============================================================================
// CREATE/EDIT AGENT MODAL
// =============================================================================

interface AgentModalProps {
    opened: boolean
    onClose: () => void
    agent?: Agent | null
    onSave: (data: Partial<Agent>) => void
    saving?: boolean
}

function AgentModal({ opened, onClose, agent, onSave, saving }: AgentModalProps) {
    const [name, setName] = useState(agent?.name || '')
    const [description, setDescription] = useState(agent?.description || '')
    const [color, setColor] = useState(agent?.color || 'blue')
    const [modelName, setModelName] = useState(agent?.model_name || 'gpt-4o-mini')
    const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '')
    const [temperature, setTemperature] = useState(agent?.temperature || 0.7)
    const [maxTokens, setMaxTokens] = useState(agent?.max_tokens || 500)
    const [memoryWindow, setMemoryWindow] = useState(agent?.memory_window || 10)
    const [ragEnabled, setRagEnabled] = useState(agent?.rag_enabled || false)
    const [reengagementEnabled, setReengagementEnabled] = useState(agent?.reengagement_enabled || false)

    const handleSave = () => {
        onSave({
            name,
            description,
            color,
            model_name: modelName,
            system_prompt: systemPrompt,
            temperature,
            max_tokens: maxTokens,
            memory_window: memoryWindow,
            rag_enabled: ragEnabled,
            reengagement_enabled: reengagementEnabled,
        })
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={agent ? 'Editar Agente' : 'Novo Agente'}
            size="xl"
            centered
        >
            <Tabs defaultValue="basic">
                <Tabs.List mb="md">
                    <Tabs.Tab value="basic" leftSection={<IconSettings size={14} />}>Básico</Tabs.Tab>
                    <Tabs.Tab value="prompt" leftSection={<IconBrain size={14} />}>Prompt</Tabs.Tab>
                    <Tabs.Tab value="behavior" leftSection={<IconRobot size={14} />}>Comportamento</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="basic">
                    <Stack gap="md">
                        <TextInput
                            label="Nome do Agente"
                            placeholder="Ex: Lia, Assistente de Vendas"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <Textarea
                            label="Descrição"
                            placeholder="Descreva o propósito deste agente..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            minRows={2}
                        />

                        <Group grow>
                            <Select
                                label="Modelo de IA"
                                data={[
                                    { value: 'gpt-4o', label: 'GPT-4o (mais inteligente)' },
                                    { value: 'gpt-4o-mini', label: 'GPT-4o-mini (mais rápido)' },
                                ]}
                                value={modelName}
                                onChange={(v) => setModelName(v || 'gpt-4o-mini')}
                            />

                            <Select
                                label="Cor"
                                data={[
                                    { value: 'blue', label: '🔵 Azul' },
                                    { value: 'green', label: '🟢 Verde' },
                                    { value: 'orange', label: '🟠 Laranja' },
                                    { value: 'red', label: '🔴 Vermelho' },
                                    { value: 'violet', label: '🟣 Violeta' },
                                    { value: 'pink', label: '🩷 Rosa' },
                                ]}
                                value={color}
                                onChange={(v) => setColor(v || 'blue')}
                            />
                        </Group>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="prompt">
                    <Textarea
                        label="System Prompt"
                        description="Instruções para o agente. Use {{variáveis}} para dados dinâmicos."
                        placeholder={`Você é {{sistema.agente_nome}}, uma assistente virtual de {{empresa.nome}}.

Seu objetivo é qualificar leads e agendar reuniões.

## Regras:
- Seja sempre cordial e profissional
- Nunca prometa o que não pode cumprir
- Se não souber, diga que vai verificar

## Variáveis disponíveis:
- {{lead.nome}} - Nome do cliente
- {{lead.email}} - Email do cliente`}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        minRows={15}
                        autosize
                        styles={{ input: { fontFamily: 'monospace' } }}
                    />
                </Tabs.Panel>

                <Tabs.Panel value="behavior">
                    <Stack gap="md">
                        <Group grow>
                            <NumberInput
                                label="Temperatura"
                                description="0 = preciso, 1 = criativo"
                                value={temperature}
                                onChange={(v) => setTemperature(Number(v) || 0.7)}
                                min={0}
                                max={1}
                                step={0.1}
                                decimalScale={1}
                            />

                            <NumberInput
                                label="Max Tokens"
                                description="Limite de tokens na resposta"
                                value={maxTokens}
                                onChange={(v) => setMaxTokens(Number(v) || 500)}
                                min={50}
                                max={4000}
                            />

                            <NumberInput
                                label="Janela de Memória"
                                description="Últimas N mensagens"
                                value={memoryWindow}
                                onChange={(v) => setMemoryWindow(Number(v) || 10)}
                                min={5}
                                max={50}
                            />
                        </Group>

                        <Divider label="Recursos" />

                        <Switch
                            label="RAG (Base de Conhecimento)"
                            description="Permite buscar informações em documentos"
                            checked={ragEnabled}
                            onChange={(e) => setRagEnabled(e.currentTarget.checked)}
                        />

                        <Switch
                            label="Re-engajamento Automático"
                            description="Envia mensagens de follow-up automaticamente"
                            checked={reengagementEnabled}
                            onChange={(e) => setReengagementEnabled(e.currentTarget.checked)}
                        />
                    </Stack>
                </Tabs.Panel>
            </Tabs>

            <Group justify="flex-end" mt="xl">
                <Button variant="subtle" onClick={onClose}>Cancelar</Button>
                <Button
                    onClick={handleSave}
                    loading={saving}
                    disabled={!name.trim()}
                >
                    {agent ? 'Salvar Alterações' : 'Criar Agente'}
                </Button>
            </Group>
        </Modal>
    )
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function AgentsPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
    const [editorOpened, { open: openEditor, close: closeEditor }] = useDisclosure(false)

    // Queries
    const { data: agents, isLoading, error } = useAgents()

    // Mutations
    const createAgent = useCreateAgent()
    const updateAgent = useUpdateAgent()
    const deleteAgent = useDeleteAgent()
    const duplicateAgent = useDuplicateAgent()

    // Filter agents by search
    const filteredAgents = (agents || []).filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Handlers
    const handleCreate = () => {
        setSelectedAgent(null)
        openModal()
    }

    const handleEdit = (agent: Agent) => {
        setSelectedAgent(agent)
        openEditor()
    }

    const handleSave = async (data: Partial<Agent>) => {
        if (selectedAgent) {
            await updateAgent.mutateAsync({ id: selectedAgent.id, ...data })
        } else {
            await createAgent.mutateAsync(data as any)
        }
        closeModal()
    }

    const handleSavePrompt = async (prompt: string) => {
        if (selectedAgent) {
            await updateAgent.mutateAsync({ id: selectedAgent.id, system_prompt: prompt })
        }
    }

    const handleToggleActive = async (agent: Agent) => {
        await updateAgent.mutateAsync({ id: agent.id, is_active: !agent.is_active } as any)
    }

    // Loading state
    if (isLoading) {
        return (
            <Box p="xl" ta="center">
                <Loader size="lg" />
                <Text mt="md" c="dimmed">Carregando agentes...</Text>
            </Box>
        )
    }

    // Error state
    if (error) {
        return (
            <Box p="xl" ta="center">
                <Text c="red">Erro ao carregar agentes: {String(error)}</Text>
            </Box>
        )
    }

    return (
        <>
            <Stack gap="lg">
                {/* Header */}
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Agentes de I.A.</Title>
                        <Text c="dimmed" size="sm">
                            Configure seus assistentes virtuais
                        </Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
                        Novo Agente
                    </Button>
                </Group>

                {/* Search */}
                <TextInput
                    placeholder="Buscar agentes..."
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Agents Grid */}
                {filteredAgents.length === 0 ? (
                    <Card withBorder p="xl" ta="center">
                        <ThemeIcon size={60} radius="xl" variant="light" color="gray" mx="auto" mb="md">
                            <IconRobot size={30} />
                        </ThemeIcon>
                        <Text fw={500} mb="xs">Nenhum agente encontrado</Text>
                        <Text size="sm" c="dimmed" mb="md">
                            Crie seu primeiro agente de IA para começar
                        </Text>
                        <Button variant="light" onClick={handleCreate}>
                            Criar Agente
                        </Button>
                    </Card>
                ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        {filteredAgents.map((agent) => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                onEdit={handleEdit}
                                onDuplicate={(id) => duplicateAgent.mutate(id)}
                                onDelete={(id) => deleteAgent.mutate(id)}
                                onToggleActive={handleToggleActive}
                            />
                        ))}
                    </SimpleGrid>
                )}
            </Stack>

            {/* Create/Edit Modal */}
            <AgentModal
                opened={modalOpened}
                onClose={closeModal}
                agent={selectedAgent}
                onSave={handleSave}
                saving={createAgent.isPending || updateAgent.isPending}
            />

            {/* Full Prompt Editor Modal */}
            <Modal
                opened={editorOpened}
                onClose={closeEditor}
                title={null}
                fullScreen
                transitionProps={{ transition: 'fade', duration: 200 }}
            >
                {selectedAgent && (
                    <AdvancedPromptEditor
                        agentId={selectedAgent.id}
                        agentName={selectedAgent.name}
                        initialPrompt={selectedAgent.system_prompt}
                        onSave={handleSavePrompt}
                    />
                )}
            </Modal>
        </>
    )
}
