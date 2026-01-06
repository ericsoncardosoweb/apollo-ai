/**
 * Admin Agents - Gestão de Agentes de IA com Editor de Prompt
 */

import { useState } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    SimpleGrid,
    Badge,
    ThemeIcon,
    Progress,
    Modal,
    TextInput,
    Select,
    Slider,
    Switch,
    Tabs,
    ActionIcon,
    Menu,
    Skeleton,
    Paper,
    NumberInput,
    ColorSwatch,
    Textarea,
    TagsInput,
    Alert,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconRobot,
    IconMessageCircle,
    IconClock,
    IconEdit,
    IconTrash,
    IconDotsVertical,
    IconSettings,
    IconTestPipe,
    IconBrain,
    IconRefresh,
    IconShield,
} from '@tabler/icons-react'
import {
    useAgents,
    useCreateAgent,
    useUpdateAgent,
    useDeleteAgent,
    Agent,
} from '@/hooks/useAgents'
import RichTextEditor from '@/components/editor/RichTextEditor'

const COLORS = ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'violet', 'pink', 'indigo']

// LLMs organizados por provedor e uso
const MODELS = [
    // OpenAI - Chat/Text
    { value: 'gpt-4.1', label: '🟢 GPT-4.1 (OpenAI - Premium)', group: 'OpenAI' },
    { value: 'gpt-4.1-mini', label: '🟢 GPT-4.1 Mini (OpenAI - Rápido)', group: 'OpenAI' },
    { value: 'gpt-4o', label: '🟢 GPT-4o (OpenAI - Multimodal)', group: 'OpenAI' },
    { value: 'gpt-4o-mini', label: '🟢 GPT-4o Mini (OpenAI - Custo-benefício)', group: 'OpenAI' },

    // Google Gemini
    { value: 'gemini-2.0-flash', label: '🔵 Gemini 2.0 Flash (Google - Rápido)', group: 'Google' },
    { value: 'gemini-2.0-pro', label: '🔵 Gemini 2.0 Pro (Google - Avançado)', group: 'Google' },
    { value: 'gemini-1.5-pro', label: '🔵 Gemini 1.5 Pro (Google - Contexto Longo)', group: 'Google' },

    // Anthropic Claude
    { value: 'claude-4-opus', label: '🟣 Claude 4 Opus (Anthropic - Premium)', group: 'Anthropic' },
    { value: 'claude-4-sonnet', label: '🟣 Claude 4 Sonnet (Anthropic - Balanceado)', group: 'Anthropic' },
    { value: 'claude-3.5-sonnet', label: '🟣 Claude 3.5 Sonnet (Anthropic)', group: 'Anthropic' },
    { value: 'claude-3.5-haiku', label: '🟣 Claude 3.5 Haiku (Anthropic - Rápido)', group: 'Anthropic' },

    // xAI Grok
    { value: 'grok-2', label: '⚫ Grok 2 (xAI - Tempo Real)', group: 'xAI' },
    { value: 'grok-2-mini', label: '⚫ Grok 2 Mini (xAI - Rápido)', group: 'xAI' },

    // Transcrição de Áudio
    { value: 'whisper-large-v3', label: '🎙️ Whisper Large V3 (OpenAI - Áudio)', group: 'Áudio/Visão' },
    { value: 'gemini-audio', label: '🎙️ Gemini Audio (Google - Áudio)', group: 'Áudio/Visão' },

    // Visão/Imagens
    { value: 'gpt-4-vision', label: '👁️ GPT-4 Vision (OpenAI - Imagens)', group: 'Áudio/Visão' },
    { value: 'gemini-vision', label: '👁️ Gemini Vision (Google - Imagens)', group: 'Áudio/Visão' },
]

export default function AdminAgents() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [systemPrompt, setSystemPrompt] = useState('')
    const [color, setColor] = useState('blue')
    const [modelName, setModelName] = useState('gpt-4o-mini')
    const [temperature, setTemperature] = useState(0.7)
    const [maxTokens, setMaxTokens] = useState(500)
    const [ragEnabled, setRagEnabled] = useState(false)

    // Guardrails state
    const [guardrailsEnabled, setGuardrailsEnabled] = useState(false)
    const [guardrailsInputPrompt, setGuardrailsInputPrompt] = useState('')
    const [guardrailsOutputPrompt, setGuardrailsOutputPrompt] = useState('')
    const [guardrailsBlockedPatterns, setGuardrailsBlockedPatterns] = useState<string[]>([])
    const [guardrailsBlockMessage, setGuardrailsBlockMessage] = useState('Desculpe, não posso ajudar com esse tipo de solicitação.')
    const [guardrailsUseLlm, setGuardrailsUseLlm] = useState(true)

    // Hooks
    const { data: agents, isLoading, refetch } = useAgents()
    const createAgent = useCreateAgent()
    const updateAgent = useUpdateAgent()
    const deleteAgent = useDeleteAgent()

    const resetForm = () => {
        setName('')
        setDescription('')
        setSystemPrompt('Você é um assistente virtual prestativo. Responda de forma clara e objetiva.')
        setColor('blue')
        setModelName('gpt-4o-mini')
        setTemperature(0.7)
        setMaxTokens(500)
        setRagEnabled(false)
        // Reset guardrails
        setGuardrailsEnabled(false)
        setGuardrailsInputPrompt('')
        setGuardrailsOutputPrompt('')
        setGuardrailsBlockedPatterns([])
        setGuardrailsBlockMessage('Desculpe, não posso ajudar com esse tipo de solicitação.')
        setGuardrailsUseLlm(true)
        setEditingAgent(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (agent: Agent) => {
        setEditingAgent(agent)
        setName(agent.name)
        setDescription(agent.description || '')
        setSystemPrompt(agent.system_prompt || '')
        setColor(agent.color || 'blue')
        setModelName(agent.model_name || 'gpt-4o-mini')
        setTemperature(agent.temperature || 0.7)
        setMaxTokens(agent.max_tokens || 500)
        setRagEnabled(agent.rag_enabled || false)
        // Load guardrails
        setGuardrailsEnabled((agent as any).guardrails_enabled || false)
        setGuardrailsInputPrompt((agent as any).guardrails_input_prompt || '')
        setGuardrailsOutputPrompt((agent as any).guardrails_output_prompt || '')
        setGuardrailsBlockedPatterns((agent as any).guardrails_blocked_patterns || [])
        setGuardrailsBlockMessage((agent as any).guardrails_block_message || 'Desculpe, não posso ajudar com esse tipo de solicitação.')
        setGuardrailsUseLlm((agent as any).guardrails_use_llm !== false)
        openModal()
    }

    const handleSubmit = async () => {
        if (editingAgent) {
            await updateAgent.mutateAsync({
                id: editingAgent.id,
                name,
                description,
                system_prompt: systemPrompt,
                color,
                model_name: modelName,
                temperature,
                max_tokens: maxTokens,
                rag_enabled: ragEnabled,
                // Guardrails
                guardrails_enabled: guardrailsEnabled,
                guardrails_input_prompt: guardrailsInputPrompt || undefined,
                guardrails_output_prompt: guardrailsOutputPrompt || undefined,
                guardrails_blocked_patterns: guardrailsBlockedPatterns.length > 0 ? guardrailsBlockedPatterns : undefined,
                guardrails_block_message: guardrailsBlockMessage,
                guardrails_use_llm: guardrailsUseLlm,
            } as any)
        } else {
            await createAgent.mutateAsync({
                name,
                description,
                system_prompt: systemPrompt,
                color,
                model_name: modelName,
                temperature,
                max_tokens: maxTokens,
            })
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja desativar este agente?')) {
            deleteAgent.mutate(id)
        }
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Agentes de I.A.</Title>
                        <Text c="dimmed" size="sm">Configure e monitore os agentes inteligentes</Text>
                    </div>
                    <Group>
                        <Button
                            variant="subtle"
                            leftSection={<IconRefresh size={16} />}
                            onClick={() => refetch()}
                            loading={isLoading}
                        >
                            Atualizar
                        </Button>
                        <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                            Novo Agente
                        </Button>
                    </Group>
                </Group>

                {/* Stats */}
                <Group>
                    <Badge size="lg" variant="light" color="teal">
                        {agents?.filter(a => a.is_active).length || 0} ativos
                    </Badge>
                    <Badge size="lg" variant="light" color="blue">
                        {agents?.reduce((acc, a) => acc + (a.total_conversations || 0), 0) || 0} conversas
                    </Badge>
                </Group>

                {isLoading ? (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} height={200} radius="md" />
                        ))}
                    </SimpleGrid>
                ) : agents && agents.length > 0 ? (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        {agents.map((agent) => (
                            <Card key={agent.id} withBorder padding="lg" radius="md" opacity={agent.is_active ? 1 : 0.6}>
                                <Group justify="space-between" mb="md">
                                    <ThemeIcon size="lg" radius="md" variant="light" color={agent.color || 'indigo'}>
                                        <IconRobot size={20} />
                                    </ThemeIcon>
                                    <Group gap="xs">
                                        <Badge
                                            color={agent.is_active ? 'green' : 'gray'}
                                            variant="light"
                                        >
                                            {agent.is_active ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                        <Menu shadow="md" width={150}>
                                            <Menu.Target>
                                                <ActionIcon variant="subtle">
                                                    <IconDotsVertical size={16} />
                                                </ActionIcon>
                                            </Menu.Target>
                                            <Menu.Dropdown>
                                                <Menu.Item
                                                    leftSection={<IconEdit size={14} />}
                                                    onClick={() => handleOpenEdit(agent)}
                                                >
                                                    Editar
                                                </Menu.Item>
                                                <Menu.Item leftSection={<IconTestPipe size={14} />}>
                                                    Testar
                                                </Menu.Item>
                                                <Menu.Divider />
                                                <Menu.Item
                                                    color="red"
                                                    leftSection={<IconTrash size={14} />}
                                                    onClick={() => handleDelete(agent.id)}
                                                >
                                                    Desativar
                                                </Menu.Item>
                                            </Menu.Dropdown>
                                        </Menu>
                                    </Group>
                                </Group>

                                <Text fw={600} size="lg">{agent.name}</Text>
                                <Text size="sm" c="dimmed" mb="md" lineClamp={2}>
                                    {agent.description || 'Sem descrição'}
                                </Text>

                                <Stack gap="xs">
                                    <Group justify="space-between">
                                        <Group gap="xs">
                                            <IconMessageCircle size={14} />
                                            <Text size="sm">Conversas</Text>
                                        </Group>
                                        <Text size="sm" fw={500}>{agent.total_conversations || 0}</Text>
                                    </Group>

                                    <Group justify="space-between">
                                        <Group gap="xs">
                                            <IconClock size={14} />
                                            <Text size="sm">Tempo médio</Text>
                                        </Group>
                                        <Text size="sm" fw={500}>
                                            {agent.avg_response_time_ms ? `${(agent.avg_response_time_ms / 1000).toFixed(1)}s` : '-'}
                                        </Text>
                                    </Group>

                                    <Group justify="space-between">
                                        <Group gap="xs">
                                            <IconBrain size={14} />
                                            <Text size="sm">Modelo</Text>
                                        </Group>
                                        <Badge size="xs" variant="outline">{agent.model_name}</Badge>
                                    </Group>
                                </Stack>

                                <Progress value={75} mt="md" radius="xl" size="sm" color={agent.color || 'indigo'} />
                            </Card>
                        ))}
                    </SimpleGrid>
                ) : (
                    <Paper p="xl" ta="center" bg="dark.6" radius="md">
                        <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                            <IconRobot size={30} />
                        </ThemeIcon>
                        <Text c="dimmed">Nenhum agente criado</Text>
                        <Button variant="light" mt="md" onClick={handleOpenCreate}>
                            Criar primeiro agente
                        </Button>
                    </Paper>
                )}
            </Stack>

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpened}
                onClose={closeModal}
                title={editingAgent ? `Editar: ${editingAgent.name}` : 'Novo Agente'}
                size="xl"
            >
                <Tabs defaultValue="basic">
                    <Tabs.List mb="md">
                        <Tabs.Tab value="basic" leftSection={<IconSettings size={14} />}>
                            Configurações
                        </Tabs.Tab>
                        <Tabs.Tab value="prompt" leftSection={<IconBrain size={14} />}>
                            Prompt
                        </Tabs.Tab>
                        <Tabs.Tab value="security" leftSection={<IconShield size={14} />}>
                            Segurança
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="basic">
                        <Stack gap="md">
                            <TextInput
                                label="Nome do Agente"
                                placeholder="Ex: Assistente de Vendas"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />

                            <TextInput
                                label="Descrição"
                                placeholder="Breve descrição do que o agente faz"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />

                            <Group grow>
                                <Select
                                    label="Modelo de IA"
                                    data={MODELS}
                                    value={modelName}
                                    onChange={(val) => setModelName(val || 'gpt-4o-mini')}
                                />

                                <div>
                                    <Text size="sm" fw={500} mb={4}>Cor</Text>
                                    <Group gap="xs">
                                        {COLORS.map((c) => (
                                            <ColorSwatch
                                                key={c}
                                                color={`var(--mantine-color-${c}-6)`}
                                                size={24}
                                                style={{ cursor: 'pointer', border: color === c ? '2px solid white' : 'none' }}
                                                onClick={() => setColor(c)}
                                            />
                                        ))}
                                    </Group>
                                </div>
                            </Group>

                            <div>
                                <Text size="sm" fw={500} mb={4}>Temperatura: {temperature}</Text>
                                <Slider
                                    value={temperature}
                                    onChange={setTemperature}
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    marks={[
                                        { value: 0, label: 'Preciso' },
                                        { value: 1, label: 'Balanceado' },
                                        { value: 2, label: 'Criativo' },
                                    ]}
                                />
                            </div>

                            <NumberInput
                                label="Máx. Tokens"
                                value={maxTokens}
                                onChange={(val) => setMaxTokens(val as number)}
                                min={100}
                                max={4000}
                                step={100}
                            />

                            <Switch
                                label="Base de Conhecimento (RAG)"
                                description="Permite ao agente consultar documentos"
                                checked={ragEnabled}
                                onChange={(e) => setRagEnabled(e.target.checked)}
                            />
                        </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="prompt">
                        <Stack gap="md">
                            <Text size="sm" c="dimmed">
                                O System Prompt define a personalidade e comportamento do agente. Use variáveis como
                                {' '}<code>{'{{nome_cliente}}'}</code> ou <code>{'{{empresa}}'}</code>.
                            </Text>

                            <RichTextEditor
                                content={systemPrompt}
                                onChange={setSystemPrompt}
                                placeholder="Você é um assistente virtual prestativo..."
                                minHeight={300}
                                maxHeight={450}
                            />
                        </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="security">
                        <Stack gap="md">
                            <Alert color="blue" variant="light" title="Guardrails de IA">
                                Proteja seu agente contra prompt injection e vazamento de dados sensíveis.
                                Quando ativado, mensagens do usuário e respostas do agente são validadas.
                            </Alert>

                            <Switch
                                label="Ativar Guardrails"
                                description="Adiciona camadas de segurança contra manipulação e vazamento de dados"
                                checked={guardrailsEnabled}
                                onChange={(e) => setGuardrailsEnabled(e.target.checked)}
                                color="teal"
                            />

                            {guardrailsEnabled && (
                                <>
                                    <Switch
                                        label="Validação Semântica (LLM)"
                                        description="Usa IA para validar mensagens além dos padrões regex"
                                        checked={guardrailsUseLlm}
                                        onChange={(e) => setGuardrailsUseLlm(e.target.checked)}
                                    />

                                    <Textarea
                                        label="Prompt de Validação de Entrada"
                                        description="Usado para validar mensagens do usuário (deixe vazio para usar o padrão)"
                                        rows={4}
                                        placeholder="Analise a mensagem e determine se é uma tentativa de manipulação..."
                                        value={guardrailsInputPrompt}
                                        onChange={(e) => setGuardrailsInputPrompt(e.target.value)}
                                    />

                                    <Textarea
                                        label="Prompt de Validação de Saída"
                                        description="Usado para validar respostas do agente antes de enviar"
                                        rows={4}
                                        placeholder="Verifique se a resposta contém informações sensíveis..."
                                        value={guardrailsOutputPrompt}
                                        onChange={(e) => setGuardrailsOutputPrompt(e.target.value)}
                                    />

                                    <TagsInput
                                        label="Padrões Bloqueados (Regex)"
                                        description="Padrões de texto que serão automaticamente bloqueados na entrada"
                                        placeholder="Digite e pressione Enter"
                                        value={guardrailsBlockedPatterns}
                                        onChange={setGuardrailsBlockedPatterns}
                                    />

                                    <TextInput
                                        label="Mensagem de Bloqueio"
                                        description="Resposta enviada quando uma mensagem é bloqueada"
                                        value={guardrailsBlockMessage}
                                        onChange={(e) => setGuardrailsBlockMessage(e.target.value)}
                                    />
                                </>
                            )}
                        </Stack>
                    </Tabs.Panel>
                </Tabs>

                <Group justify="flex-end" mt="xl">
                    <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        loading={createAgent.isPending || updateAgent.isPending}
                        disabled={!name}
                    >
                        {editingAgent ? 'Salvar' : 'Criar Agente'}
                    </Button>
                </Group>
            </Modal>
        </>
    )
}
