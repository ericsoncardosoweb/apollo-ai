/**
 * Agent Builder IDE - Main Page
 * 
 * A VS Code-inspired editor for creating and testing AI agents.
 * Features:
 * - Monaco Editor with syntax highlighting
 * - Variable autocomplete ({{...}})
 * - AI Prompt Assistant
 * - Version history
 * - Test runner integration
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    AppShell,
    Group,
    Stack,
    Title,
    Text,
    Badge,
    Button,
    ActionIcon,
    Avatar,
    Card,
    Paper,
    Tabs,
    TextInput,
    Select,
    Slider,
    Switch,
    NumberInput,
    Tooltip,
    Loader,
    Alert,
    Divider,
    Box,
    ColorSwatch,
    SegmentedControl,
    Menu,
    Modal,
    Timeline,
    Code,
    ScrollArea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    IconArrowLeft,
    IconDeviceFloppy,
    IconEdit,
    IconTestPipe,
    IconHistory,
    IconRobot,
    IconSparkles,
    IconLoader2,
    IconCheck,
    IconX,
    IconAlertCircle,
    IconChevronDown,
    IconSettings,
    IconBrain,
    IconTarget,
    IconPlayerPlay,
    IconRefresh,
    IconCode,
    IconFileText,
} from '@tabler/icons-react'
import Editor, { Monaco } from '@monaco-editor/react'
import { useAgents, useUpdateAgent, Agent } from '@/hooks/useAgents'
import { api } from '@/lib/api'

// Monaco theme configuration
const APOLLO_DARK_THEME = {
    base: 'vs-dark' as const,
    inherit: true,
    rules: [
        { token: 'variable', foreground: '7dd3fc', fontStyle: 'bold' }, // Sky blue for {{variables}}
        { token: 'heading', foreground: 'fbbf24', fontStyle: 'bold' }, // Amber for ## headings
        { token: 'bold', foreground: 'a78bfa', fontStyle: 'bold' }, // Purple for **bold**
        { token: 'emoji', foreground: 'f87171' }, // Red for emojis
        { token: 'string', foreground: '4ade80' }, // Green for "strings"
        { token: 'bullet', foreground: '60a5fa' }, // Blue for bullets
    ],
    colors: {
        'editor.background': '#0f1419',
        'editor.lineHighlightBackground': '#1e293b',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#94a3b8',
    }
}

// CRM Fields for autocomplete
interface CRMField {
    id: string
    field_path: string
    field_type: string
    source_table: string
    description?: string
    example_value?: string
}

// Prompt version
interface PromptVersion {
    id: string
    version: number
    system_prompt: string
    change_description?: string
    created_at: string
    is_active: boolean
    performance_score?: number
}

const COLORS = ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'violet', 'pink', 'indigo']

const MODELS = [
    { value: 'gpt-4o', label: '🟢 GPT-4o (OpenAI)', group: 'OpenAI' },
    { value: 'gpt-4o-mini', label: '🟢 GPT-4o Mini (Fast)', group: 'OpenAI' },
    { value: 'gpt-4.1', label: '🟢 GPT-4.1 (Premium)', group: 'OpenAI' },
    { value: 'claude-4-sonnet', label: '🟣 Claude 4 Sonnet', group: 'Anthropic' },
    { value: 'gemini-2.0-flash', label: '🔵 Gemini 2.0 Flash', group: 'Google' },
]

export default function AgentBuilderPage() {
    const { agentId } = useParams<{ agentId: string }>()
    const navigate = useNavigate()

    // Agent state
    const { data: agents } = useAgents()
    const agent = agents?.find(a => a.id === agentId)
    const updateAgent = useUpdateAgent()

    // Editor state
    const [systemPrompt, setSystemPrompt] = useState('')
    const [isDirty, setIsDirty] = useState(false)
    const [activeTab, setActiveTab] = useState<string | null>('basic')
    const [rightPanel, setRightPanel] = useState<'assistant' | 'test'>('assistant')

    // Basic settings
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [color, setColor] = useState('blue')
    const [modelName, setModelName] = useState('gpt-4o-mini')
    const [temperature, setTemperature] = useState(0.7)
    const [maxTokens, setMaxTokens] = useState(500)

    // CRM fields for autocomplete
    const [crmFields, setCrmFields] = useState<CRMField[]>([])
    const [validationErrors, setValidationErrors] = useState<string[]>([])

    // AI Assistant
    const [assistantInput, setAssistantInput] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    // History
    const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure()
    const [versions, setVersions] = useState<PromptVersion[]>([])

    // Load agent data
    useEffect(() => {
        if (agent) {
            setName(agent.name)
            setDescription(agent.description || '')
            setSystemPrompt(agent.system_prompt || '')
            setColor(agent.color || 'blue')
            setModelName(agent.model_name || 'gpt-4o-mini')
            setTemperature(agent.temperature || 0.7)
            setMaxTokens(agent.max_tokens || 500)
        }
    }, [agent])

    // Load CRM fields
    useEffect(() => {
        const loadFields = async () => {
            try {
                const response = await api.get('/agent-builder/fields')
                setCrmFields(response.data)
            } catch (error) {
                console.error('Failed to load CRM fields', error)
            }
        }
        loadFields()
    }, [])

    // Configure Monaco editor (kept for future use when monaco-editor is installed)
    const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
        // Register custom theme
        monaco.editor.defineTheme('apollo-dark', APOLLO_DARK_THEME)
        monaco.editor.setTheme('apollo-dark')

        // Register custom language
        monaco.languages.register({ id: 'apollo-prompt' })

        // Syntax highlighting
        monaco.languages.setMonarchTokensProvider('apollo-prompt', {
            tokenizer: {
                root: [
                    [/\{\{[^}]+\}\}/, 'variable'],           // {{variable}}
                    [/^##.*$/, 'heading'],                   // ## Heading
                    [/\*\*[^*]+\*\*/, 'bold'],               // **bold**
                    [/❌|⚠️|✅|🔴|🟢|🟡/, 'emoji'],          // Emojis
                    [/"[^"]*"/, 'string'],                   // "quoted"
                    [/^[-•]\s/, 'bullet'],                   // - bullets
                ]
            }
        })

        // Autocomplete for {{variables}}
        monaco.languages.registerCompletionItemProvider('apollo-prompt', {
            triggerCharacters: ['{'],
            provideCompletionItems: (model: any, position: any) => {
                const textBefore = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: Math.max(1, position.column - 2),
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                })

                if (textBefore === '{{' || textBefore.endsWith('{{')) {
                    return {
                        suggestions: crmFields.map(field => ({
                            label: field.field_path,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: field.field_path + '}}',
                            detail: field.description || field.source_table,
                            documentation: `Type: ${field.field_type}\nExample: ${field.example_value || 'N/A'}`
                        }))
                    }
                }
                return { suggestions: [] }
            }
        })
    }, [crmFields])

    // Handle prompt change
    const handlePromptChange = (value: string | undefined) => {
        setSystemPrompt(value || '')
        setIsDirty(true)
    }

    // Save changes
    const handleSave = async () => {
        if (!agent) return

        try {
            await updateAgent.mutateAsync({
                id: agent.id,
                name,
                description,
                system_prompt: systemPrompt,
                color,
                model_name: modelName,
                temperature,
                max_tokens: maxTokens,
            })

            // Save version
            await api.post(`/agent-builder/agents/${agent.id}/versions`, {
                system_prompt: systemPrompt,
                change_description: 'Manual save'
            })

            setIsDirty(false)
            notifications.show({
                title: 'Salvo!',
                message: 'Agente atualizado com sucesso',
                color: 'green'
            })
        } catch (error) {
            notifications.show({
                title: 'Erro',
                message: 'Falha ao salvar agente',
                color: 'red'
            })
        }
    }

    // Generate prompt with AI
    const handleGenerate = async () => {
        if (!assistantInput.trim()) return

        setIsGenerating(true)
        try {
            const response = await api.post(`/agent-builder/agents/${agentId}/generate-prompt`, {
                instruction: assistantInput,
                current_prompt: systemPrompt
            })

            setSystemPrompt(response.data.suggestion)
            setIsDirty(true)
            setAssistantInput('')

            notifications.show({
                title: 'Prompt gerado!',
                message: 'Revise o prompt e salve se estiver satisfeito',
                color: 'green'
            })
        } catch (error) {
            notifications.show({
                title: 'Erro',
                message: 'Falha ao gerar prompt',
                color: 'red'
            })
        } finally {
            setIsGenerating(false)
        }
    }

    // Load version history
    const loadHistory = async () => {
        try {
            const response = await api.get(`/agent-builder/agents/${agentId}/versions`)
            setVersions(response.data)
            openHistory()
        } catch (error) {
            console.error('Failed to load history', error)
        }
    }

    // Rollback to version
    const handleRollback = async (versionId: string) => {
        try {
            await api.post(`/agent-builder/agents/${agentId}/versions/${versionId}/rollback`)

            // Reload agent
            window.location.reload()
        } catch (error) {
            notifications.show({
                title: 'Erro',
                message: 'Falha ao restaurar versão',
                color: 'red'
            })
        }
    }

    if (!agent) {
        return (
            <Stack align="center" justify="center" h="100vh">
                <Loader size="lg" />
                <Text>Carregando agente...</Text>
            </Stack>
        )
    }

    return (
        <>
            <AppShell
                header={{ height: 60 }}
                padding={0}
                styles={{
                    main: {
                        backgroundColor: 'var(--mantine-color-dark-9)',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                {/* Header */}
                <AppShell.Header bg="dark.8" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                    <Group h="100%" px="md" justify="space-between">
                        <Group>
                            <ActionIcon variant="subtle" onClick={() => navigate('/admin/agents')}>
                                <IconArrowLeft size={20} />
                            </ActionIcon>
                            <Avatar color={color} radius="md" size="sm">
                                {name[0]?.toUpperCase()}
                            </Avatar>
                            <Title order={4}>{name}</Title>
                            <Badge color={isDirty ? 'yellow' : 'green'} variant="light">
                                {isDirty ? 'Unsaved' : 'Saved'}
                            </Badge>
                        </Group>

                        <Group>
                            <Button
                                variant="light"
                                leftSection={<IconEdit size={16} />}
                                color="blue"
                            >
                                Edit Agent
                            </Button>
                            <Button
                                variant="light"
                                leftSection={<IconTestPipe size={16} />}
                                color="violet"
                                onClick={() => navigate(`/admin/agents/${agentId}/tests`)}
                            >
                                Tests
                            </Button>
                            <Button
                                color="green"
                                leftSection={<IconDeviceFloppy size={16} />}
                                onClick={handleSave}
                                loading={updateAgent.isPending}
                                disabled={!isDirty}
                            >
                                Save Changes
                            </Button>
                        </Group>
                    </Group>
                </AppShell.Header>

                <AppShell.Main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Tabs Bar */}
                    <Group p="sm" bg="dark.8" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                        <SegmentedControl
                            size="sm"
                            data={[
                                { value: 'basic', label: '⚙️ Basic' },
                                { value: 'model', label: '🧠 Model' },
                                { value: 'test', label: '🧪 Test' },
                            ]}
                            value={activeTab || 'basic'}
                            onChange={setActiveTab}
                        />

                        <Group gap="xs">
                            <Divider orientation="vertical" />
                            <Button
                                variant="subtle"
                                size="xs"
                                leftSection={<IconHistory size={14} />}
                                onClick={loadHistory}
                            >
                                History
                            </Button>
                            <Button
                                variant="subtle"
                                size="xs"
                                leftSection={<IconRobot size={14} />}
                                onClick={() => setRightPanel('assistant')}
                                color={rightPanel === 'assistant' ? 'blue' : 'gray'}
                            >
                                AI Assistant
                            </Button>
                        </Group>
                    </Group>

                    {/* Main Content */}
                    <Box style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left: Config Panel */}
                        <Box w={280} bg="dark.8" p="md" style={{ borderRight: '1px solid var(--mantine-color-dark-6)', overflowY: 'auto' }}>
                            <Tabs value={activeTab} onChange={setActiveTab}>
                                <Tabs.Panel value="basic">
                                    <Stack gap="md">
                                        <TextInput
                                            label="Agent Name"
                                            value={name}
                                            onChange={(e) => { setName(e.target.value); setIsDirty(true) }}
                                        />

                                        <TextInput
                                            label="Description"
                                            value={description}
                                            onChange={(e) => { setDescription(e.target.value); setIsDirty(true) }}
                                        />

                                        <div>
                                            <Text size="sm" fw={500} mb={4}>Color</Text>
                                            <Group gap="xs">
                                                {COLORS.map((c) => (
                                                    <ColorSwatch
                                                        key={c}
                                                        color={`var(--mantine-color-${c}-6)`}
                                                        size={24}
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: color === c ? '2px solid white' : 'none'
                                                        }}
                                                        onClick={() => { setColor(c); setIsDirty(true) }}
                                                    />
                                                ))}
                                            </Group>
                                        </div>
                                    </Stack>
                                </Tabs.Panel>

                                <Tabs.Panel value="model">
                                    <Stack gap="md">
                                        <Select
                                            label="Model"
                                            data={MODELS}
                                            value={modelName}
                                            onChange={(v) => { setModelName(v || 'gpt-4o-mini'); setIsDirty(true) }}
                                        />

                                        <div>
                                            <Text size="sm" fw={500} mb={4}>Temperature: {temperature}</Text>
                                            <Slider
                                                value={temperature}
                                                onChange={(v) => { setTemperature(v); setIsDirty(true) }}
                                                min={0}
                                                max={2}
                                                step={0.1}
                                                marks={[
                                                    { value: 0, label: 'Precise' },
                                                    { value: 1, label: 'Balanced' },
                                                    { value: 2, label: 'Creative' },
                                                ]}
                                            />
                                        </div>

                                        <NumberInput
                                            label="Max Tokens"
                                            value={maxTokens}
                                            onChange={(v) => { setMaxTokens(v as number); setIsDirty(true) }}
                                            min={100}
                                            max={4000}
                                            step={100}
                                        />
                                    </Stack>
                                </Tabs.Panel>

                                <Tabs.Panel value="test">
                                    <Stack gap="md">
                                        <Text size="sm" c="dimmed">
                                            Send a message to test your agent in real-time.
                                        </Text>

                                        <Button
                                            variant="light"
                                            fullWidth
                                            leftSection={<IconPlayerPlay size={16} />}
                                            onClick={() => navigate(`/admin/agents/${agentId}/tests`)}
                                        >
                                            Open Test Runner
                                        </Button>
                                    </Stack>
                                </Tabs.Panel>
                            </Tabs>
                        </Box>

                        {/* Center: Prompt Editor */}
                        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* System Prompt Header */}
                            <Group p="sm" bg="dark.7" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                                <Group gap="xs">
                                    <IconFileText size={16} />
                                    <Text size="sm" fw={500}>System Prompt</Text>
                                </Group>
                            </Group>

                            {/* AI Prompt Assistant */}
                            <Paper p="md" bg="dark.7" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                                <Group gap="xs" mb="sm">
                                    <Avatar size="sm" color="violet" radius="xl">
                                        <IconSparkles size={14} />
                                    </Avatar>
                                    <Text size="sm" fw={500}>AI Prompt Assistant</Text>
                                </Group>
                                <Group>
                                    <TextInput
                                        placeholder="deixe o tom mais humanizada e amigável..."
                                        style={{ flex: 1 }}
                                        value={assistantInput}
                                        onChange={(e) => setAssistantInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                        disabled={isGenerating}
                                    />
                                    <Button
                                        color="green"
                                        onClick={handleGenerate}
                                        loading={isGenerating}
                                        disabled={!assistantInput.trim()}
                                    >
                                        Generate
                                    </Button>
                                </Group>
                                {isGenerating && (
                                    <Group gap="xs" mt="xs">
                                        <IconLoader2 size={14} className="animate-spin" />
                                        <Text size="xs" c="dimmed">Generating prompt...</Text>
                                    </Group>
                                )}
                            </Paper>

                            {/* CRM Updates Bar */}
                            <Group p="xs" bg="dark.6" gap="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                                <Text size="xs" c="dimmed">CRM Updates:</Text>
                                {crmFields.slice(0, 3).map(field => (
                                    <Badge key={field.id} size="xs" variant="light" color="blue">
                                        {field.field_path}
                                    </Badge>
                                ))}
                                {crmFields.length > 3 && (
                                    <Badge size="xs" variant="outline" color="gray">
                                        +{crmFields.length - 3} more
                                    </Badge>
                                )}
                                <Text size="xs" c={validationErrors.length ? 'red' : 'teal'} ml="auto">
                                    {validationErrors.length ? `${validationErrors.length} issues` : 'No issues'}
                                </Text>
                            </Group>

                            {/* Prompt Editor Label */}
                            <Group p="xs" bg="dark.8" justify="space-between">
                                <Group gap="xs">
                                    <IconCode size={14} />
                                    <Text size="xs" fw={500}>Prompt Editor</Text>
                                </Group>
                            </Group>

                            {/* Monaco Editor */}
                            <Box style={{ flex: 1 }}>
                                <Editor
                                    height="100%"
                                    defaultLanguage="apollo-prompt"
                                    value={systemPrompt}
                                    onChange={handlePromptChange}
                                    onMount={handleEditorMount}
                                    options={{
                                        fontSize: 14,
                                        lineNumbers: 'on',
                                        minimap: { enabled: false },
                                        wordWrap: 'on',
                                        automaticLayout: true,
                                        padding: { top: 16 },
                                        scrollBeyondLastLine: false,
                                    }}
                                    theme="vs-dark"
                                />
                            </Box>
                        </Box>
                    </Box>
                </AppShell.Main>
            </AppShell>

            {/* History Modal */}
            <Modal
                opened={historyOpened}
                onClose={closeHistory}
                title="Version History"
                size="lg"
            >
                <ScrollArea h={400}>
                    <Timeline active={0} bulletSize={24} lineWidth={2}>
                        {versions.map((version, index) => (
                            <Timeline.Item
                                key={version.id}
                                bullet={version.is_active ? <IconCheck size={12} /> : undefined}
                                title={`Version ${version.version}`}
                                color={version.is_active ? 'green' : 'gray'}
                            >
                                <Text size="xs" c="dimmed">
                                    {new Date(version.created_at).toLocaleString()}
                                </Text>
                                {version.change_description && (
                                    <Text size="sm" mt={4}>{version.change_description}</Text>
                                )}
                                {version.performance_score && (
                                    <Badge size="xs" color="blue" mt={4}>
                                        Score: {version.performance_score}%
                                    </Badge>
                                )}
                                {!version.is_active && (
                                    <Button
                                        size="xs"
                                        variant="light"
                                        mt="xs"
                                        onClick={() => handleRollback(version.id)}
                                    >
                                        Rollback
                                    </Button>
                                )}
                            </Timeline.Item>
                        ))}
                    </Timeline>
                </ScrollArea>
            </Modal>
        </>
    )
}
