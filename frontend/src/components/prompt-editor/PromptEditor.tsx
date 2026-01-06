/**
 * Prompt Editor - IDE profissional para prompts de IA
 * 
 * Inspirado no MAIA:
 * - Autocomplete de variáveis {{lead.nome}} conectado ao CRM
 * - Syntax highlighting para variáveis e condicionais
 * - Contador de tokens em tempo real
 * - Teste de prompt com score de similaridade
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
    Box,
    Group,
    Stack,
    Text,
    Textarea,
    Paper,
    Badge,
    ActionIcon,
    Tooltip,
    Button,
    Menu,
    Divider,
    ThemeIcon,
    Progress,
    Popover,
    ScrollArea,
    Code,
    Loader,
    Card,
    SimpleGrid,
    RingProgress,
    Tabs,
    Switch,
    TextInput,
    Select,
} from '@mantine/core'
import { useDisclosure, useHotkeys, useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    IconBrain,
    IconVariable,
    IconTestPipe,
    IconCoin,
    IconCopy,
    IconPlayerPlay,
    IconWand,
    IconRefresh,
    IconChartBar,
    IconUser,
    IconBuildingStore,
    IconCalendar,
    IconDeviceFloppy,
    IconHistory,
    IconCode,
    IconEye,
    IconSettings,
    IconMessageCircle,
    IconRobot,
    IconCheck,
    IconX,
    IconChevronRight,
    IconBolt,
} from '@tabler/icons-react'

// =============================================================================
// TYPES
// =============================================================================

interface PromptVariable {
    name: string
    label: string
    category: 'lead' | 'empresa' | 'sistema' | 'custom'
    description: string
    example: string
    source: string // tabela/campo no Supabase
}

interface TestResult {
    success: boolean
    response: string
    tokensUsed: { input: number; output: number }
    latencyMs: number
    similarityScore?: number
    toolsCalled?: Array<{ name: string; params: Record<string, unknown>; success: boolean }>
}

interface PromptEditorProps {
    value: string
    onChange: (value: string) => void
    agentId?: string
    tenantId?: string
    onTest?: (prompt: string, testMessage: string) => Promise<TestResult>
    onSave?: (prompt: string) => Promise<void>
    readOnly?: boolean
    showTester?: boolean
}

// =============================================================================
// AVAILABLE VARIABLES (Would come from CRM schema in production)
// =============================================================================

const AVAILABLE_VARIABLES: PromptVariable[] = [
    // Lead variables
    { name: 'lead.nome', label: 'Nome do Lead', category: 'lead', description: 'Nome completo do cliente', example: 'João Silva', source: 'crm_leads.name' },
    { name: 'lead.telefone', label: 'Telefone', category: 'lead', description: 'Número de WhatsApp', example: '+5511999999999', source: 'crm_leads.phone' },
    { name: 'lead.email', label: 'E-mail', category: 'lead', description: 'E-mail do cliente', example: 'joao@email.com', source: 'crm_leads.email' },
    { name: 'lead.status', label: 'Status', category: 'lead', description: 'Estágio no funil', example: 'Qualificação', source: 'crm_pipeline_stages.name' },
    { name: 'lead.temperatura', label: 'Temperatura', category: 'lead', description: 'Nível de interesse', example: 'hot', source: 'crm_leads.temperature' },
    { name: 'lead.score', label: 'Score', category: 'lead', description: 'Pontuação do lead', example: '85', source: 'crm_leads.score' },
    { name: 'lead.ultima_mensagem', label: 'Última Mensagem', category: 'lead', description: 'Última msg do cliente', example: 'Olá, preciso de ajuda', source: 'messages.content' },
    { name: 'lead.tags', label: 'Tags', category: 'lead', description: 'Etiquetas do lead', example: 'VIP, Empresa', source: 'crm_leads.tags' },

    // Company variables
    { name: 'empresa.nome', label: 'Nome da Empresa', category: 'empresa', description: 'Nome do negócio', example: 'TechCorp Ltda', source: 'tenants.name' },
    { name: 'empresa.segmento', label: 'Segmento', category: 'empresa', description: 'Área de atuação', example: 'Tecnologia', source: 'tenants.segment' },
    { name: 'empresa.horario', label: 'Horário de Funcionamento', category: 'empresa', description: 'Expediente', example: '9h às 18h', source: 'tenants.business_hours' },

    // System variables
    { name: 'sistema.data_atual', label: 'Data Atual', category: 'sistema', description: 'Data de hoje formatada', example: '06/01/2026', source: 'NOW()' },
    { name: 'sistema.hora_atual', label: 'Hora Atual', category: 'sistema', description: 'Hora atual', example: '14:30', source: 'NOW()' },
    { name: 'sistema.dia_semana', label: 'Dia da Semana', category: 'sistema', description: 'Dia atual', example: 'Segunda-feira', source: 'NOW()' },
    { name: 'sistema.agente_nome', label: 'Nome do Agente', category: 'sistema', description: 'Nome deste bot', example: 'Lia', source: 'agents.name' },
]

// =============================================================================
// TOKEN ESTIMATOR (Approximation: ~4 chars per token for Portuguese)
// =============================================================================

function estimateTokens(text: string): number {
    if (!text) return 0
    // Rough estimation based on OpenAI's tokenizer behavior
    // Portuguese tends to have ~4-5 chars per token
    return Math.ceil(text.length / 4)
}

function getTokenColor(tokens: number): string {
    if (tokens < 1000) return 'green'
    if (tokens < 3000) return 'yellow'
    if (tokens < 6000) return 'orange'
    return 'red'
}

// =============================================================================
// VARIABLE HIGHLIGHTER
// =============================================================================

function highlightVariables(text: string): React.ReactNode {
    if (!text) return null

    const parts = text.split(/(\{\{[^}]+\}\})/g)

    return parts.map((part, index) => {
        if (part.match(/^\{\{[^}]+\}\}$/)) {
            const varName = part.slice(2, -2)
            const variable = AVAILABLE_VARIABLES.find(v => v.name === varName)
            const isValid = !!variable

            return (
                <Tooltip
                    key={index}
                    label={isValid ? `${variable.label}: ${variable.example}` : 'Variável desconhecida'}
                    withArrow
                >
                    <Badge
                        component="span"
                        size="sm"
                        variant="light"
                        color={isValid ? 'indigo' : 'red'}
                        style={{ cursor: 'help' }}
                    >
                        {part}
                    </Badge>
                </Tooltip>
            )
        }
        return <span key={index}>{part}</span>
    })
}

// =============================================================================
// VARIABLE PICKER COMPONENT
// =============================================================================

interface VariablePickerProps {
    onSelect: (variable: PromptVariable) => void
    opened: boolean
    onClose: () => void
    position: { x: number; y: number }
    searchQuery: string
}

function VariablePicker({ onSelect, opened, onClose, searchQuery }: VariablePickerProps) {
    const [search, setSearch] = useState(searchQuery)

    useEffect(() => {
        setSearch(searchQuery)
    }, [searchQuery])

    const filteredVariables = useMemo(() => {
        if (!search) return AVAILABLE_VARIABLES
        const query = search.toLowerCase()
        return AVAILABLE_VARIABLES.filter(v =>
            v.name.toLowerCase().includes(query) ||
            v.label.toLowerCase().includes(query)
        )
    }, [search])

    const groupedVariables = useMemo(() => {
        const groups: Record<string, PromptVariable[]> = {
            lead: [],
            empresa: [],
            sistema: [],
            custom: [],
        }
        filteredVariables.forEach(v => {
            groups[v.category].push(v)
        })
        return groups
    }, [filteredVariables])

    const categoryIcons = {
        lead: <IconUser size={14} />,
        empresa: <IconBuildingStore size={14} />,
        sistema: <IconCalendar size={14} />,
        custom: <IconSettings size={14} />,
    }

    const categoryLabels = {
        lead: 'Lead / Cliente',
        empresa: 'Empresa',
        sistema: 'Sistema',
        custom: 'Customizado',
    }

    if (!opened) return null

    return (
        <Paper shadow="lg" p="xs" withBorder style={{ position: 'absolute', zIndex: 1000, width: 320 }}>
            <TextInput
                placeholder="Buscar variável..."
                size="xs"
                mb="xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
            />
            <ScrollArea.Autosize mah={250}>
                <Stack gap={4}>
                    {Object.entries(groupedVariables).map(([category, vars]) => {
                        if (vars.length === 0) return null
                        return (
                            <Box key={category}>
                                <Group gap={4} mb={4}>
                                    {categoryIcons[category as keyof typeof categoryIcons]}
                                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                                        {categoryLabels[category as keyof typeof categoryLabels]}
                                    </Text>
                                </Group>
                                {vars.map(v => (
                                    <Paper
                                        key={v.name}
                                        p={6}
                                        radius="sm"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            onSelect(v)
                                            onClose()
                                        }}
                                        className="variable-item"
                                    >
                                        <style>{`
                                            .variable-item:hover { background: var(--mantine-color-dark-5); }
                                        `}</style>
                                        <Group justify="space-between">
                                            <div>
                                                <Code>{`{{${v.name}}}`}</Code>
                                                <Text size="xs" c="dimmed">{v.description}</Text>
                                            </div>
                                            <Text size="xs" c="dimmed">{v.example}</Text>
                                        </Group>
                                    </Paper>
                                ))}
                            </Box>
                        )
                    })}
                </Stack>
            </ScrollArea.Autosize>
        </Paper>
    )
}

// =============================================================================
// PROMPT TESTER COMPONENT
// =============================================================================

interface PromptTesterProps {
    prompt: string
    onTest: (testMessage: string) => Promise<TestResult>
}

function PromptTester({ prompt, onTest }: PromptTesterProps) {
    const [testMessage, setTestMessage] = useState('')
    const [testing, setTesting] = useState(false)
    const [result, setResult] = useState<TestResult | null>(null)
    const [expectedResponse, setExpectedResponse] = useState('')

    const handleTest = async () => {
        if (!testMessage.trim()) {
            notifications.show({
                title: 'Erro',
                message: 'Digite uma mensagem de teste',
                color: 'red',
            })
            return
        }

        setTesting(true)
        try {
            const testResult = await onTest(testMessage)
            setResult(testResult)
        } catch (error) {
            notifications.show({
                title: 'Erro no teste',
                message: String(error),
                color: 'red',
            })
        } finally {
            setTesting(false)
        }
    }

    return (
        <Stack gap="md">
            <Text size="sm" fw={600}>🧪 Testar Prompt</Text>

            <Textarea
                label="Mensagem de Teste (simular cliente)"
                placeholder="Olá, quero saber o preço..."
                minRows={2}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
            />

            <Textarea
                label="Resposta Esperada (para score de similaridade)"
                placeholder="Opcional: escreva a resposta ideal para comparação..."
                minRows={2}
                value={expectedResponse}
                onChange={(e) => setExpectedResponse(e.target.value)}
            />

            <Button
                leftSection={testing ? <Loader size={14} /> : <IconPlayerPlay size={16} />}
                onClick={handleTest}
                disabled={testing || !prompt}
                fullWidth
            >
                {testing ? 'Testando...' : 'Executar Teste'}
            </Button>

            {result && (
                <Card withBorder>
                    <Stack gap="sm">
                        {/* Status */}
                        <Group justify="space-between">
                            <Badge color={result.success ? 'green' : 'red'} variant="light" size="lg">
                                {result.success ? '✅ PASSED' : '❌ FAILED'}
                            </Badge>
                            <Text size="xs" c="dimmed">{result.latencyMs}ms</Text>
                        </Group>

                        {/* Score */}
                        {result.similarityScore && (
                            <Group>
                                <RingProgress
                                    size={60}
                                    thickness={6}
                                    roundCaps
                                    sections={[{ value: result.similarityScore, color: result.similarityScore > 80 ? 'green' : 'orange' }]}
                                    label={
                                        <Text size="xs" ta="center" fw={700}>
                                            {result.similarityScore}%
                                        </Text>
                                    }
                                />
                                <div>
                                    <Text size="sm" fw={500}>Score de Similaridade</Text>
                                    <Text size="xs" c="dimmed">Comparação semântica com resposta esperada</Text>
                                </div>
                            </Group>
                        )}

                        {/* Response */}
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Resposta da IA:</Text>
                            <Paper p="sm" bg="dark.6" radius="sm">
                                <Text size="sm">{result.response}</Text>
                            </Paper>
                        </Box>

                        {/* Tokens */}
                        <Group gap="xl">
                            <div>
                                <Text size="xs" c="dimmed">Tokens Input</Text>
                                <Text size="sm" fw={500}>{result.tokensUsed.input}</Text>
                            </div>
                            <div>
                                <Text size="xs" c="dimmed">Tokens Output</Text>
                                <Text size="sm" fw={500}>{result.tokensUsed.output}</Text>
                            </div>
                            <div>
                                <Text size="xs" c="dimmed">Custo Estimado</Text>
                                <Text size="sm" fw={500}>
                                    ${((result.tokensUsed.input * 0.15 + result.tokensUsed.output * 0.60) / 1_000_000).toFixed(6)}
                                </Text>
                            </div>
                        </Group>

                        {/* Tools Called */}
                        {result.toolsCalled && result.toolsCalled.length > 0 && (
                            <Box>
                                <Text size="xs" c="dimmed" mb={4}>Tools Executadas:</Text>
                                <Stack gap={4}>
                                    {result.toolsCalled.map((tool, i) => (
                                        <Paper key={i} p="xs" bg={tool.success ? 'teal.9' : 'red.9'} radius="sm">
                                            <Group gap="xs">
                                                {tool.success ? <IconCheck size={14} /> : <IconX size={14} />}
                                                <Code>{tool.name}</Code>
                                                <Text size="xs" c="dimmed">{JSON.stringify(tool.params)}</Text>
                                            </Group>
                                        </Paper>
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Card>
            )}
        </Stack>
    )
}

// =============================================================================
// MAIN PROMPT EDITOR COMPONENT
// =============================================================================

export default function PromptEditor({
    value,
    onChange,
    agentId,
    tenantId,
    onTest,
    onSave,
    readOnly = false,
    showTester = true,
}: PromptEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showVariablePicker, setShowVariablePicker] = useState(false)
    const [variableSearchQuery, setVariableSearchQuery] = useState('')
    const [cursorPosition, setCursorPosition] = useState(0)
    const [showPreview, setShowPreview] = useState(false)
    const [saving, setSaving] = useState(false)

    const tokens = useMemo(() => estimateTokens(value), [value])
    const [debouncedValue] = useDebouncedValue(value, 300)

    // Detect {{ typing to show variable picker
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget
        const pos = textarea.selectionStart
        const textBefore = value.slice(0, pos)

        // If user just typed second {
        if (e.key === '{' && textBefore.endsWith('{')) {
            setShowVariablePicker(true)
            setCursorPosition(pos)
            setVariableSearchQuery('')
        }

        // Close picker on Escape
        if (e.key === 'Escape' && showVariablePicker) {
            setShowVariablePicker(false)
        }
    }

    // Insert selected variable
    const handleVariableSelect = (variable: PromptVariable) => {
        const beforeCursor = value.slice(0, cursorPosition - 1) // Remove the first {
        const afterCursor = value.slice(cursorPosition)
        const newValue = `${beforeCursor}{{${variable.name}}}${afterCursor}`
        onChange(newValue)
        setShowVariablePicker(false)

        // Focus back to textarea
        setTimeout(() => {
            textareaRef.current?.focus()
        }, 0)
    }

    // Save prompt
    const handleSave = async () => {
        if (!onSave) return
        setSaving(true)
        try {
            await onSave(value)
            notifications.show({
                title: 'Salvo!',
                message: 'Prompt salvo com sucesso',
                color: 'green',
            })
        } catch (error) {
            notifications.show({
                title: 'Erro ao salvar',
                message: String(error),
                color: 'red',
            })
        } finally {
            setSaving(false)
        }
    }

    // Mock test function (would call backend in production)
    const handleTest = async (testMessage: string): Promise<TestResult> => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))

        return {
            success: true,
            response: 'Olá! Sou a assistente virtual. Vi que você perguntou sobre o preço. Nosso plano básico custa R$ 97/mês. Posso te explicar os benefícios?',
            tokensUsed: { input: tokens + 50, output: 45 },
            latencyMs: 1234,
            similarityScore: 87,
            toolsCalled: [
                { name: 'updatecrm_status', params: { status: 'Qualificação' }, success: true },
            ],
        }
    }

    // Hotkeys
    useHotkeys([
        ['mod+s', () => handleSave()],
        ['mod+enter', () => document.querySelector<HTMLButtonElement>('[data-test-button]')?.click()],
    ])

    return (
        <Box>
            {/* Header */}
            <Group justify="space-between" mb="md">
                <Group gap="xs">
                    <ThemeIcon variant="light" color="indigo">
                        <IconBrain size={18} />
                    </ThemeIcon>
                    <Text fw={600}>Editor de Prompt</Text>
                    <Tooltip label="Variáveis disponíveis">
                        <Badge variant="light" color="indigo" leftSection={<IconVariable size={12} />}>
                            {AVAILABLE_VARIABLES.length} variáveis
                        </Badge>
                    </Tooltip>
                </Group>

                <Group gap="xs">
                    {/* Token counter */}
                    <Tooltip label="Tokens estimados no prompt">
                        <Badge
                            variant="light"
                            color={getTokenColor(tokens)}
                            leftSection={<IconCoin size={12} />}
                        >
                            ~{tokens.toLocaleString()} tokens
                        </Badge>
                    </Tooltip>

                    {/* Preview toggle */}
                    <Tooltip label={showPreview ? 'Ocultar preview' : 'Ver preview'}>
                        <ActionIcon
                            variant={showPreview ? 'filled' : 'light'}
                            color="indigo"
                            onClick={() => setShowPreview(!showPreview)}
                        >
                            <IconEye size={16} />
                        </ActionIcon>
                    </Tooltip>

                    {/* Save button */}
                    {onSave && (
                        <Button
                            size="xs"
                            variant="light"
                            leftSection={saving ? <Loader size={12} /> : <IconDeviceFloppy size={14} />}
                            onClick={handleSave}
                            disabled={saving || readOnly}
                        >
                            Salvar
                        </Button>
                    )}
                </Group>
            </Group>

            {/* Main Content */}
            <SimpleGrid cols={showTester ? 2 : 1} spacing="md">
                {/* Editor Column */}
                <Stack gap="sm">
                    <Box pos="relative">
                        <Textarea
                            ref={textareaRef}
                            placeholder={`Você é {{sistema.agente_nome}}, assistente virtual de {{empresa.nome}}...

Use variáveis com {{ para personalizar:
- {{lead.nome}} - Nome do cliente
- {{empresa.segmento}} - Segmento da empresa

Dica: Digite {{ para ver todas as variáveis disponíveis.`}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            minRows={15}
                            autosize
                            disabled={readOnly}
                            styles={{
                                input: {
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                },
                            }}
                        />

                        {/* Variable Picker */}
                        <VariablePicker
                            opened={showVariablePicker}
                            onClose={() => setShowVariablePicker(false)}
                            onSelect={handleVariableSelect}
                            position={{ x: 0, y: 0 }}
                            searchQuery={variableSearchQuery}
                        />
                    </Box>

                    {/* Preview */}
                    {showPreview && (
                        <Card withBorder>
                            <Text size="xs" c="dimmed" mb="xs">Preview (variáveis destacadas):</Text>
                            <Box style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px' }}>
                                {highlightVariables(value)}
                            </Box>
                        </Card>
                    )}

                    {/* Quick Variables */}
                    <Box>
                        <Text size="xs" c="dimmed" mb="xs">Variáveis mais usadas:</Text>
                        <Group gap={4}>
                            {AVAILABLE_VARIABLES.slice(0, 6).map(v => (
                                <Tooltip key={v.name} label={v.description}>
                                    <Badge
                                        variant="outline"
                                        size="sm"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            const textarea = textareaRef.current
                                            if (!textarea) return
                                            const pos = textarea.selectionStart
                                            const newValue = value.slice(0, pos) + `{{${v.name}}}` + value.slice(pos)
                                            onChange(newValue)
                                            textarea.focus()
                                        }}
                                    >
                                        {`{{${v.name}}}`}
                                    </Badge>
                                </Tooltip>
                            ))}
                        </Group>
                    </Box>
                </Stack>

                {/* Tester Column */}
                {showTester && onTest && (
                    <PromptTester prompt={value} onTest={handleTest} />
                )}
            </SimpleGrid>
        </Box>
    )
}
