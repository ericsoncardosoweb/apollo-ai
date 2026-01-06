/**
 * Advanced Prompt Editor - IDE profissional estilo MAIA
 * 
 * Features:
 * - Syntax highlighting com @IF/@THEN/@END, @updateCRM()
 * - Numeração de linhas
 * - AI Prompt Assistant
 * - CRM Updates detection
 * - Error detection
 * - Test panel com score de similaridade
 */

import { useState, useMemo } from 'react'
import {
    Box,
    Group,
    Stack,
    Text,
    Paper,
    Badge,
    ActionIcon,
    Button,
    ThemeIcon,
    ScrollArea,
    Code,
    Loader,
    Card,
    Tabs,
    TextInput,
    Textarea,
    RingProgress,
    Menu,
    Modal,
    Select,
    Collapse,
    UnstyledButton,
} from '@mantine/core'
import { useDisclosure, useHotkeys } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    IconBrain,
    IconVariable,
    IconTestPipe,
    IconCoin,
    IconPlayerPlay,
    IconWand,
    IconDeviceFloppy,
    IconHistory,
    IconCode,
    IconEye,
    IconSettings,
    IconRobot,
    IconCheck,
    IconX,
    IconChevronRight,
    IconChevronDown,
    IconSparkles,
    IconAlertCircle,
    IconRefresh,
    IconCopy,
    IconPlus,
    IconTrash,
    IconEdit,
} from '@tabler/icons-react'

// =============================================================================
// TYPES
// =============================================================================

interface CRMUpdate {
    kanban: string
    field: string
    description?: string
}

interface TestMessage {
    id: string
    userScript: string
    expectedResponse: string
    actualResponse?: string
    score?: number
    passed?: boolean
    executionSteps?: ExecutionStep[]
}

interface ExecutionStep {
    name: string
    success: boolean
    testMode: boolean
    duration: string
    details?: Record<string, unknown>
}

interface TestRun {
    id: string
    timestamp: string
    status: 'passed' | 'failed' | 'running'
    overallScore: number
    duration: string
    messagesExecuted: number
    failedMessages: number
    messages: TestMessage[]
}

interface AdvancedPromptEditorProps {
    agentId?: string
    agentName?: string
    initialPrompt?: string
    onSave?: (prompt: string) => Promise<void>
}

// =============================================================================
// SYNTAX HIGHLIGHTING PATTERNS
// =============================================================================

const SYNTAX_PATTERNS = {
    // Control flow
    ifStatement: /(@IF\s+[^\n]+)/g,
    thenStatement: /(@THEN\s+)/g,
    endStatement: /(@END)/g,

    // CRM Functions
    updateCRM: /(@updateCRM\s*\([^)]+\))/g,

    // Variables
    variables: /(\{\{[^}]+\}\})/g,

    // Comments
    comments: /(\/\/[^\n]*)/g,

    // Strings in functions
    strings: /("[^"]*")/g,

    // Rules markers
    ruleMarkers: /(\*\*[^*]+\*\*)/g,

    // Section headers
    headers: /(##[^\n]+)/g,

    // Warning/Error markers
    warnings: /(⚠️|❌|✅|🚫)/g,
}

// =============================================================================
// LINE NUMBER COMPONENT
// =============================================================================

function LineNumbers({ count, errorLines = [] }: { count: number; errorLines?: number[] }) {
    return (
        <Box
            style={{
                width: 50,
                textAlign: 'right',
                paddingRight: 12,
                borderRight: '1px solid var(--mantine-color-dark-5)',
                userSelect: 'none',
            }}
        >
            {Array.from({ length: count }, (_, i) => (
                <Text
                    key={i}
                    size="xs"
                    c={errorLines.includes(i + 1) ? 'red' : 'dimmed'}
                    style={{
                        height: 24,
                        lineHeight: '24px',
                        fontFamily: 'monospace',
                    }}
                >
                    {i + 1}
                </Text>
            ))}
        </Box>
    )
}

// =============================================================================
// SYNTAX HIGHLIGHTED CODE VIEW
// =============================================================================

function SyntaxHighlightedView({ code }: { code: string }) {
    const highlightLine = (line: string): React.ReactNode => {
        let result: React.ReactNode = line

        // Apply highlighting in order of priority
        const parts: React.ReactNode[] = []
        let remaining = line
        let key = 0

        // Split by patterns and apply colors
        const segments = remaining.split(/(@IF\s+[^\n]+|@THEN\s+|@END|@updateCRM\s*\([^)]+\)|\{\{[^}]+\}\}|\/\/[^\n]*|"[^"]*"|##[^\n]+|\*\*[^*]+\*\*)/g)

        segments.forEach((segment, index) => {
            if (!segment) return

            if (segment.match(/^@IF/)) {
                parts.push(<span key={key++} style={{ color: '#7dd3fc' }}>{segment}</span>)
            } else if (segment.match(/^@THEN/)) {
                parts.push(<span key={key++} style={{ color: '#4ade80' }}>{segment}</span>)
            } else if (segment.match(/^@END/)) {
                parts.push(<span key={key++} style={{ color: '#f87171' }}>{segment}</span>)
            } else if (segment.match(/^@updateCRM/)) {
                // Parse @updateCRM function
                const match = segment.match(/@updateCRM\s*\(([^)]+)\)/)
                if (match) {
                    parts.push(
                        <span key={key++}>
                            <span style={{ color: '#fbbf24' }}>@updateCRM</span>
                            <span style={{ color: '#a3a3a3' }}>(</span>
                            {match[1].split(',').map((arg, i) => (
                                <span key={i}>
                                    {i > 0 && <span style={{ color: '#a3a3a3' }}>, </span>}
                                    <span style={{ color: '#c084fc' }}>{arg.trim()}</span>
                                </span>
                            ))}
                            <span style={{ color: '#a3a3a3' }}>)</span>
                        </span>
                    )
                } else {
                    parts.push(<span key={key++} style={{ color: '#fbbf24' }}>{segment}</span>)
                }
            } else if (segment.match(/^\{\{/)) {
                parts.push(<span key={key++} style={{ color: '#60a5fa', fontWeight: 500 }}>{segment}</span>)
            } else if (segment.match(/^\/\//)) {
                parts.push(<span key={key++} style={{ color: '#6b7280', fontStyle: 'italic' }}>{segment}</span>)
            } else if (segment.match(/^"/)) {
                parts.push(<span key={key++} style={{ color: '#a78bfa' }}>{segment}</span>)
            } else if (segment.match(/^##/)) {
                parts.push(<span key={key++} style={{ color: '#34d399', fontWeight: 600 }}>{segment}</span>)
            } else if (segment.match(/^\*\*/)) {
                parts.push(<span key={key++} style={{ color: '#fbbf24', fontWeight: 600 }}>{segment}</span>)
            } else {
                parts.push(<span key={key++}>{segment}</span>)
            }
        })

        return parts
    }

    const lines = code.split('\n')

    return (
        <Box style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {lines.map((line, i) => (
                <Box key={i} style={{ height: 24, lineHeight: '24px', whiteSpace: 'pre' }}>
                    {highlightLine(line)}
                </Box>
            ))}
        </Box>
    )
}

// =============================================================================
// CRM UPDATES DETECTOR
// =============================================================================

function detectCRMUpdates(code: string): CRMUpdate[] {
    const updates: CRMUpdate[] = []
    const regex = /@updateCRM\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*\)/g
    let match

    while ((match = regex.exec(code)) !== null) {
        updates.push({
            kanban: match[1],
            field: match[2],
            description: match[3],
        })
    }

    // Remove duplicates
    return updates.filter((v, i, a) =>
        a.findIndex(t => t.kanban === v.kanban && t.field === v.field) === i
    )
}

// =============================================================================
// ERROR DETECTOR
// =============================================================================

function detectErrors(code: string): { line: number; message: string }[] {
    const errors: { line: number; message: string }[] = []
    const lines = code.split('\n')

    let ifCount = 0
    let endCount = 0

    lines.forEach((line, i) => {
        if (line.includes('@IF')) ifCount++
        if (line.includes('@END')) endCount++

        // Check for unclosed strings
        const quoteCount = (line.match(/"/g) || []).length
        if (quoteCount % 2 !== 0) {
            errors.push({ line: i + 1, message: 'String não fechada' })
        }

        // Check for invalid @updateCRM syntax
        if (line.includes('@updateCRM') && !line.match(/@updateCRM\s*\([^)]+\)/)) {
            errors.push({ line: i + 1, message: 'Sintaxe @updateCRM inválida' })
        }
    })

    // Check for unmatched @IF/@END
    if (ifCount !== endCount) {
        errors.push({ line: 0, message: `${ifCount} @IF mas ${endCount} @END` })
    }

    return errors
}

// =============================================================================
// AI PROMPT ASSISTANT
// =============================================================================

interface AIAssistantProps {
    onGenerate: (prompt: string) => void
    currentPrompt: string
}

function AIPromptAssistant({ onGenerate, currentPrompt }: AIAssistantProps) {
    const [instruction, setInstruction] = useState('')
    const [generating, setGenerating] = useState(false)

    const handleGenerate = async () => {
        if (!instruction.trim()) return

        setGenerating(true)
        // Simulate AI generation
        await new Promise(r => setTimeout(r, 2000))

        const generatedAddition = `
// ${instruction}
@IF o cliente mencionou ${instruction.toLowerCase()}
    @THEN @updateCRM("Kanban", "status", "", "qualificados")
    Responda de forma personalizada sobre ${instruction.toLowerCase()}
@END
`
        onGenerate(currentPrompt + '\n' + generatedAddition)
        setInstruction('')
        setGenerating(false)

        notifications.show({
            title: 'Prompt gerado!',
            message: 'O trecho foi adicionado ao seu prompt',
            color: 'green',
        })
    }

    return (
        <Card withBorder>
            <Group gap="xs" mb="sm">
                <ThemeIcon variant="light" color="violet">
                    <IconSparkles size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">AI Prompt Assistant</Text>
            </Group>

            <TextInput
                placeholder="deixe o tom mais humanizado e amigável."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                mb="sm"
            />

            <Button
                fullWidth
                variant="light"
                color="violet"
                leftSection={generating ? <Loader size={14} /> : <IconWand size={16} />}
                onClick={handleGenerate}
                disabled={generating || !instruction.trim()}
            >
                Generate
            </Button>
        </Card>
    )
}

// =============================================================================
// TEST PANEL COMPONENT
// =============================================================================

interface TestPanelProps {
    prompt: string
    agentId?: string
}

function TestPanel({ prompt, agentId }: TestPanelProps) {
    const [testMessages, setTestMessages] = useState<TestMessage[]>([
        { id: '1', userScript: 'Olá tudo bem?', expectedResponse: 'Oi! Tudo ótimo e você? 😊\n\nMe conta, você já trabalha com IA ou está começando a explorar agora?' },
        { id: '2', userScript: 'Ainda não', expectedResponse: 'Show, obrigado por compartilhar! Se você ainda não trabalha com IA, aqui é um ótimo lugar pra começar! 😊\n\nEm qual área você atua hoje?' },
        { id: '3', userScript: 'Com tráfego pago', expectedResponse: 'Legal! Tráfego pago + IA é uma combinação poderosa, viu? 🚀' },
    ])
    const [running, setRunning] = useState(false)
    const [lastRun, setLastRun] = useState<TestRun | null>(null)
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

    const toggleExpanded = (id: string) => {
        setExpandedMessages(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const runAllTests = async () => {
        setRunning(true)

        // Simulate test execution
        await new Promise(r => setTimeout(r, 3000))

        const results = testMessages.map((msg, i) => ({
            ...msg,
            actualResponse: msg.expectedResponse.replace('😊', '😄'), // Slight variation
            score: 96 + Math.random() * 4, // 96-100
            passed: true,
            executionSteps: [
                { name: 'updatecrm_dinastia_descri_o', success: true, testMode: true, duration: '1ms' },
                { name: 'updatecrm_dinastia_status', success: true, testMode: true, duration: '1ms' },
            ],
        }))

        setTestMessages(results)

        const overallScore = results.reduce((acc, m) => acc + (m.score || 0), 0) / results.length

        setLastRun({
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString('pt-BR'),
            status: 'passed',
            overallScore,
            duration: '28.9s',
            messagesExecuted: results.length,
            failedMessages: 0,
            messages: results,
        })

        setRunning(false)
    }

    return (
        <Stack gap="md">
            {/* Header */}
            <Group justify="space-between">
                <Group gap="xs">
                    {lastRun && (
                        <>
                            <Text size="sm" c="dimmed">{lastRun.timestamp}</Text>
                            <Badge color={lastRun.status === 'passed' ? 'green' : 'red'}>
                                {lastRun.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}
                            </Badge>
                            <Text size="sm" c="dimmed">{lastRun.overallScore.toFixed(1)}%</Text>
                            <Text size="sm" c="dimmed">{lastRun.duration}</Text>
                            <Text size="sm" c="dimmed">{lastRun.messagesExecuted}/{testMessages.length} passed</Text>
                        </>
                    )}
                </Group>

                <Button
                    leftSection={running ? <Loader size={14} /> : <IconPlayerPlay size={16} />}
                    onClick={runAllTests}
                    disabled={running}
                >
                    Run All Tests
                </Button>
            </Group>

            {/* Execution Context */}
            <Card withBorder p="xs">
                <Group gap="xs">
                    <Badge variant="light" color="indigo">opened</Badge>
                    <Badge variant="outline" color="gray">gpt-4.1</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                    ▸ Evaluated System Prompt ({prompt.length} chars)
                </Text>
            </Card>

            {/* Message Results */}
            <Text size="sm" c="yellow" fw={500}>📋 Message Results:</Text>

            <Stack gap="sm">
                {testMessages.map((msg, index) => (
                    <Card key={msg.id} withBorder p="sm">
                        {/* Message Header */}
                        <Group justify="space-between" mb="sm">
                            <Group gap="xs">
                                <Text fw={600} size="sm">Message {index + 1}</Text>
                                {msg.passed !== undefined && (
                                    <Badge color={msg.passed ? 'green' : 'red'} size="sm">
                                        {msg.passed ? 'PASSED' : 'FAILED'}
                                    </Badge>
                                )}
                                {msg.score && (
                                    <Text size="xs" c="dimmed">Score: {msg.score.toFixed(1)}%</Text>
                                )}
                            </Group>

                            <Group gap={4}>
                                <UnstyledButton onClick={() => toggleExpanded(`expected-${msg.id}`)}>
                                    <Text size="xs" c="dimmed">
                                        {expandedMessages.has(`expected-${msg.id}`) ? '∧ Hide Expected' : '∨ Show Expected'}
                                    </Text>
                                </UnstyledButton>
                                <UnstyledButton onClick={() => toggleExpanded(`exec-${msg.id}`)}>
                                    <Text size="xs" c="dimmed">
                                        {expandedMessages.has(`exec-${msg.id}`) ? '∧ Hide Execution' : `∨ Show Execution${msg.executionSteps ? ` (${msg.executionSteps.length})` : ''}`}
                                    </Text>
                                </UnstyledButton>
                            </Group>
                        </Group>

                        {/* Two columns: User Script | Agent Response */}
                        <Group grow align="flex-start">
                            <Box>
                                <Text size="xs" c="orange" mb={4}>User (Script):</Text>
                                <Paper p="xs" bg="dark.7" radius="sm">
                                    <Text size="sm">{msg.userScript}</Text>
                                </Paper>
                            </Box>

                            <Box>
                                <Text size="xs" c="green" mb={4}>Agent Response:</Text>
                                <Paper p="xs" bg="dark.6" radius="sm">
                                    <Text size="sm">{msg.actualResponse || msg.expectedResponse}</Text>
                                </Paper>
                            </Box>
                        </Group>

                        {/* Expected Response (Collapsible) */}
                        <Collapse in={expandedMessages.has(`expected-${msg.id}`)}>
                            <Box mt="sm">
                                <Text size="xs" c="yellow" mb={4}>Expected Response (Baseline):</Text>
                                <Paper p="xs" bg="yellow.9" radius="sm" style={{ opacity: 0.3 }}>
                                    <Text size="sm">{msg.expectedResponse}</Text>
                                </Paper>
                            </Box>
                        </Collapse>

                        {/* Execution Steps (Collapsible) */}
                        <Collapse in={expandedMessages.has(`exec-${msg.id}`)}>
                            {msg.executionSteps && msg.executionSteps.length > 0 && (
                                <Box mt="sm">
                                    <Text size="xs" c="dimmed" mb={4}>⚡ Execution Steps:</Text>
                                    <Stack gap={4}>
                                        {msg.executionSteps.map((step, i) => (
                                            <Paper key={i} p="xs" bg={step.success ? 'teal.9' : 'red.9'} radius="sm" style={{ opacity: 0.8 }}>
                                                <Group justify="space-between">
                                                    <Group gap="xs">
                                                        <Text size="xs" c="teal.3">⚡</Text>
                                                        <Code>{step.name}</Code>
                                                        <Badge size="xs" color="teal" variant="light">Success</Badge>
                                                        <Badge size="xs" color="gray" variant="outline">Test Mode</Badge>
                                                    </Group>
                                                    <Text size="xs" c="dimmed">⏱ {step.duration}</Text>
                                                </Group>
                                                <Text size="xs" c="dimmed" mt={4}>▸ View Details</Text>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </Collapse>
                    </Card>
                ))}
            </Stack>

            {/* Execution Details */}
            {lastRun && (
                <Card withBorder mt="md">
                    <Text size="sm" fw={500} mb="sm">⏱ Execution Details:</Text>
                    <Group grow>
                        <Box ta="center">
                            <Text size="xs" c="dimmed">Messages Executed</Text>
                            <Text size="xl" fw={700}>{lastRun.messagesExecuted}</Text>
                        </Box>
                        <Box ta="center">
                            <Text size="xs" c="dimmed">Failed Messages</Text>
                            <Text size="xl" fw={700}>{lastRun.failedMessages}</Text>
                        </Box>
                        <Box ta="center">
                            <Text size="xs" c="dimmed">Duration</Text>
                            <Text size="xl" fw={700}>{lastRun.duration}</Text>
                        </Box>
                        <Box ta="center">
                            <Text size="xs" c="dimmed">Overall Score</Text>
                            <Text size="xl" fw={700} c="green">{lastRun.overallScore.toFixed(1)}%</Text>
                        </Box>
                    </Group>
                </Card>
            )}
        </Stack>
    )
}

// =============================================================================
// MAIN ADVANCED PROMPT EDITOR COMPONENT
// =============================================================================

export default function AdvancedPromptEditor({
    agentId,
    agentName = 'DINASTIA',
    initialPrompt = '',
    onSave,
}: AdvancedPromptEditorProps) {
    const [activeTab, setActiveTab] = useState<string | null>('basic')
    const [prompt, setPrompt] = useState(initialPrompt)
    const [saving, setSaving] = useState(false)
    const [showAIAssistant, { toggle: toggleAIAssistant }] = useDisclosure(false)

    const crmUpdates = useMemo(() => detectCRMUpdates(prompt), [prompt])
    const errors = useMemo(() => detectErrors(prompt), [prompt])
    const lineCount = useMemo(() => prompt.split('\n').length, [prompt])
    const errorLines = useMemo(() => errors.map(e => e.line).filter(l => l > 0), [errors])

    // Handle save
    const handleSave = async () => {
        if (!onSave) return
        setSaving(true)
        try {
            await onSave(prompt)
            notifications.show({
                title: 'Salvo!',
                message: 'Alterações salvas com sucesso',
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

    // Hotkeys
    useHotkeys([
        ['mod+s', (e) => { e.preventDefault(); handleSave() }],
    ])

    return (
        <Box>
            {/* Top Header */}
            <Group justify="space-between" mb="md">
                <Group gap="sm">
                    <ActionIcon variant="subtle" size="lg">
                        <IconChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                    </ActionIcon>
                    <Badge size="lg" color="violet" variant="filled">{agentName.charAt(0)}</Badge>
                    <Text fw={600}>{agentName}</Text>
                    <Badge variant="light" color="gray">Unsaved</Badge>
                </Group>

                <Group gap="xs">
                    <Button variant="light" leftSection={<IconEdit size={16} />}>Edit Agent</Button>
                    <Button variant="light" leftSection={<IconTestPipe size={16} />}>Tests</Button>
                    <Button
                        leftSection={saving ? <Loader size={14} /> : <IconDeviceFloppy size={16} />}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        Save Changes
                    </Button>
                </Group>
            </Group>

            {/* Tabs */}
            <Tabs value={activeTab} onChange={setActiveTab} mb="md">
                <Tabs.List>
                    <Tabs.Tab value="basic" leftSection={<IconSettings size={14} />}>Basic</Tabs.Tab>
                    <Tabs.Tab value="model" leftSection={<IconBrain size={14} />}>Model</Tabs.Tab>
                    <Tabs.Tab value="test" leftSection={<IconTestPipe size={14} />}>Test</Tabs.Tab>
                </Tabs.List>
            </Tabs>

            {/* Main Content */}
            {activeTab === 'basic' && (
                <Group grow align="flex-start" gap="md">
                    {/* Left Sidebar */}
                    <Box style={{ flex: '0 0 250px' }}>
                        <Stack gap="md">
                            <Card withBorder>
                                <Text size="sm" fw={500} mb="xs">Agent Name</Text>
                                <TextInput value={agentName} readOnly />
                            </Card>

                            <Card withBorder>
                                <Text size="sm" fw={500} mb="xs">Description</Text>
                                <Textarea
                                    placeholder="Agente SDR da DinastIA"
                                    minRows={2}
                                />
                            </Card>

                            <Card withBorder>
                                <Text size="sm" fw={500} mb="xs">Color</Text>
                                <Group gap={4}>
                                    {['blue', 'green', 'yellow', 'orange', 'red', 'pink', 'violet', 'gray'].map(color => (
                                        <ActionIcon
                                            key={color}
                                            color={color}
                                            variant="filled"
                                            size="sm"
                                            radius="xl"
                                        />
                                    ))}
                                </Group>
                            </Card>
                        </Stack>
                    </Box>

                    {/* Center: Prompt Editor */}
                    <Box style={{ flex: 1 }}>
                        {/* System Prompt Header */}
                        <Group justify="space-between" mb="sm">
                            <Group gap="xs">
                                <Text fw={600}>🤖 System Prompt</Text>
                                {errors.length > 0 && (
                                    <Badge color="red" size="sm">{errors.length} error{errors.length > 1 ? 's' : ''}</Badge>
                                )}
                            </Group>

                            <Group gap="xs">
                                <ActionIcon variant="light" onClick={toggleAIAssistant}>
                                    <IconSparkles size={16} />
                                </ActionIcon>
                                <ActionIcon variant="light">
                                    <IconHistory size={16} />
                                </ActionIcon>
                            </Group>
                        </Group>

                        {/* CRM Updates Chips */}
                        {crmUpdates.length > 0 && (
                            <Group gap={4} mb="sm">
                                <Text size="xs" c="dimmed">🔗 CRM Updates:</Text>
                                {crmUpdates.map((update, i) => (
                                    <Badge key={i} variant="light" color="indigo" size="sm">
                                        {update.kanban}.{update.field}
                                    </Badge>
                                ))}
                                {errors.length > 0 && (
                                    <Badge color="red" size="sm" ml="auto">
                                        {errors.length} error{errors.length > 1 ? 's' : ''}
                                    </Badge>
                                )}
                            </Group>
                        )}

                        {/* AI Assistant Panel */}
                        <Collapse in={showAIAssistant}>
                            <Box mb="sm">
                                <AIPromptAssistant
                                    currentPrompt={prompt}
                                    onGenerate={setPrompt}
                                />
                            </Box>
                        </Collapse>

                        {/* Editor with Line Numbers */}
                        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                            <Group align="flex-start" gap={0}>
                                {/* Line Numbers */}
                                <Box
                                    p="sm"
                                    bg="dark.8"
                                    style={{ minHeight: 400 }}
                                >
                                    <LineNumbers count={lineCount} errorLines={errorLines} />
                                </Box>

                                {/* Code Area */}
                                <Box style={{ flex: 1, position: 'relative' }}>
                                    <ScrollArea h={400}>
                                        <Box p="sm">
                                            {/* Hidden textarea for editing */}
                                            <textarea
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    padding: 12,
                                                    background: 'transparent',
                                                    border: 'none',
                                                    outline: 'none',
                                                    resize: 'none',
                                                    fontFamily: 'monospace',
                                                    fontSize: 13,
                                                    lineHeight: '24px',
                                                    color: 'transparent',
                                                    caretColor: 'white',
                                                    zIndex: 1,
                                                }}
                                            />

                                            {/* Syntax highlighted view */}
                                            <Box style={{ pointerEvents: 'none' }}>
                                                <SyntaxHighlightedView code={prompt} />
                                            </Box>
                                        </Box>
                                    </ScrollArea>

                                    {/* Minimap (simplified) */}
                                    <Box
                                        style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: 0,
                                            width: 80,
                                            height: '100%',
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: 4,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <Text size="xs" style={{ transform: 'scale(0.3)', transformOrigin: 'top left', whiteSpace: 'pre', opacity: 0.5 }}>
                                            {prompt}
                                        </Text>
                                    </Box>
                                </Box>
                            </Group>
                        </Paper>

                        {/* Errors */}
                        {errors.length > 0 && (
                            <Stack gap={4} mt="sm">
                                {errors.map((error, i) => (
                                    <Paper key={i} p="xs" bg="red.9" radius="sm" style={{ opacity: 0.8 }}>
                                        <Group gap="xs">
                                            <IconAlertCircle size={14} />
                                            <Text size="xs">
                                                {error.line > 0 ? `Linha ${error.line}: ` : ''}{error.message}
                                            </Text>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Group>
            )}

            {activeTab === 'model' && (
                <Card withBorder>
                    <Stack gap="md">
                        <Select
                            label="Modelo de IA"
                            data={[
                                { value: 'gpt-4o', label: 'GPT-4o (mais inteligente)' },
                                { value: 'gpt-4o-mini', label: 'GPT-4o-mini (mais rápido)' },
                                { value: 'gpt-4.1', label: 'GPT-4.1 (beta)' },
                            ]}
                            defaultValue="gpt-4o-mini"
                        />

                        <TextInput
                            label="Temperatura"
                            description="0 = mais preciso, 1 = mais criativo"
                            defaultValue="0.7"
                            type="number"
                            step={0.1}
                            min={0}
                            max={1}
                        />

                        <TextInput
                            label="Max Tokens"
                            description="Limite de tokens na resposta"
                            defaultValue="500"
                            type="number"
                        />
                    </Stack>
                </Card>
            )}

            {activeTab === 'test' && (
                <TestPanel prompt={prompt} agentId={agentId} />
            )}
        </Box>
    )
}
