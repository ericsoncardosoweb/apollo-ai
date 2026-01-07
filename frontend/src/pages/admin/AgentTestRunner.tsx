/**
 * Agent Test Runner - QA Suite for AI Agents
 * 
 * Features:
 * - Test suite management
 * - Test case creation and editing
 * - Run tests with semantic scoring
 * - Execution trace (Chain of Thought)
 * - Regression detection
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Stack,
    Group,
    Title,
    Text,
    Badge,
    Button,
    Card,
    Paper,
    Table,
    Progress,
    ActionIcon,
    Modal,
    TextInput,
    Textarea,
    Select,
    SimpleGrid,
    Accordion,
    Code,
    Collapse,
    Tooltip,
    ThemeIcon,
    Loader,
    Alert,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    IconArrowLeft,
    IconPlayerPlay,
    IconPlus,
    IconEdit,
    IconTrash,
    IconCheck,
    IconX,
    IconTestPipe,
    IconRefresh,
    IconChevronDown,
    IconChevronUp,
    IconFunction,
    IconAlertTriangle,
    IconClock,
    IconMessage,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface TestSuite {
    id: string
    agent_id: string
    name: string
    description?: string
    category: string
    context: Record<string, any>
    is_active: boolean
    pass_rate: number
    last_run_at?: string
    test_cases_count: number
}

interface TestCase {
    id: string
    suite_id: string
    name: string
    description?: string
    messages: Array<{ role: string; content: string; expected_response?: string }>
    expected_tools?: string[]
    expected_tone?: string
    context: Record<string, any>
    is_active: boolean
    order_index: number
    last_score?: number
    last_run_at?: string
}

interface TestRun {
    id: string
    agent_id: string
    suite_id?: string
    status: string
    total_tests: number
    passed_tests: number
    failed_tests: number
    average_score: number
    duration_ms?: number
    triggered_by: string
    started_at?: string
    completed_at?: string
    results?: TestResult[]
}

interface TestResult {
    id: string
    case_id: string
    status: string
    score: number
    user_input: string
    expected_response?: string
    actual_response: string
    tools_called: any[]
    execution_steps: ExecutionStep[]
    duration_ms: number
    error_message?: string
}

interface ExecutionStep {
    step_type: string
    name: string
    success: boolean
    duration_ms: number
    details: Record<string, any>
    test_mode: boolean
}

export default function AgentTestRunnerPage() {
    const { agentId } = useParams<{ agentId: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // State
    const [expandedSuite, setExpandedSuite] = useState<string | null>(null)
    const [expandedResult, setExpandedResult] = useState<string | null>(null)
    const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure()
    const [newSuiteName, setNewSuiteName] = useState('')
    const [newSuiteCategory, setNewSuiteCategory] = useState('functional')

    // Queries
    const { data: testSuites, isLoading: loadingSuites } = useQuery<TestSuite[]>({
        queryKey: ['test-suites', agentId],
        queryFn: async () => {
            const response = await api.get(`/agent-builder/agents/${agentId}/test-suites`)
            return response.data
        }
    })

    const { data: testRuns } = useQuery<TestRun[]>({
        queryKey: ['test-runs', agentId],
        queryFn: async () => {
            const response = await api.get(`/agent-builder/agents/${agentId}/test-runs?limit=10`)
            return response.data
        }
    })

    // Stats
    const totalTests = testSuites?.reduce((a, s) => a + s.test_cases_count, 0) || 0
    const activeTests = testSuites?.filter(s => s.is_active).length || 0
    const avgPassRate = testRuns?.[0]?.average_score || 0

    // Mutations
    const runAllTests = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/agent-builder/agents/${agentId}/run-all-tests`)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-runs', agentId] })
            queryClient.invalidateQueries({ queryKey: ['test-suites', agentId] })
            notifications.show({
                title: 'Testes executados!',
                message: 'Todos os testes foram executados',
                color: 'green'
            })
        },
        onError: () => {
            notifications.show({
                title: 'Erro',
                message: 'Falha ao executar testes',
                color: 'red'
            })
        }
    })

    const createSuite = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/agent-builder/agents/${agentId}/test-suites`, {
                name: newSuiteName,
                category: newSuiteCategory
            })
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-suites', agentId] })
            closeCreateModal()
            setNewSuiteName('')
            notifications.show({
                title: 'Suite criada!',
                message: 'Nova suite de testes criada',
                color: 'green'
            })
        }
    })

    return (
        <Stack gap="lg" p="md">
            {/* Header */}
            <Group justify="space-between">
                <Group>
                    <ActionIcon variant="subtle" onClick={() => navigate(`/admin/agents/${agentId}/builder`)}>
                        <IconArrowLeft size={20} />
                    </ActionIcon>
                    <div>
                        <Title order={3}>Test Runner</Title>
                        <Text size="sm" c="dimmed">QA Suite for AI Agent</Text>
                    </div>
                </Group>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconEdit size={16} />}
                        onClick={() => navigate(`/admin/agents/${agentId}/builder`)}
                    >
                        Edit Agent
                    </Button>
                    <Button
                        color="blue"
                        variant="light"
                        leftSection={<IconTestPipe size={16} />}
                    >
                        Tests
                    </Button>
                    <Button
                        color="green"
                        leftSection={<IconPlayerPlay size={16} />}
                        onClick={() => runAllTests.mutate()}
                        loading={runAllTests.isPending}
                    >
                        Run All Tests
                    </Button>
                </Group>
            </Group>

            {/* Stats Cards */}
            <SimpleGrid cols={3}>
                <Card withBorder p="md" bg="dark.7">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Tests</Text>
                    <Group gap="xs" mt="xs">
                        <ThemeIcon color="gray" variant="light" size="lg">
                            <IconTestPipe size={18} />
                        </ThemeIcon>
                        <Text size="xl" fw={700}>{totalTests}</Text>
                    </Group>
                </Card>

                <Card withBorder p="md" bg="dark.7">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Active Tests</Text>
                    <Group gap="xs" mt="xs">
                        <ThemeIcon color="green" variant="light" size="lg">
                            <IconCheck size={18} />
                        </ThemeIcon>
                        <Text size="xl" fw={700} c="green">{activeTests}</Text>
                    </Group>
                </Card>

                <Card withBorder p="md" bg="dark.7">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Average Pass Rate</Text>
                    <Text size="xl" fw={700} c={avgPassRate >= 80 ? 'green' : avgPassRate >= 50 ? 'yellow' : 'red'}>
                        {avgPassRate.toFixed(1)}%
                    </Text>
                </Card>
            </SimpleGrid>

            {/* Test Suites Table */}
            <Card withBorder p={0} bg="dark.7">
                <Group p="md" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                    <Text fw={500}>Test Suites</Text>
                    <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreateModal}>
                        New Suite
                    </Button>
                </Group>

                {loadingSuites ? (
                    <Stack align="center" p="xl">
                        <Loader />
                    </Stack>
                ) : testSuites && testSuites.length > 0 ? (
                    <Table highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th></Table.Th>
                                <Table.Th>Test Name</Table.Th>
                                <Table.Th>Category</Table.Th>
                                <Table.Th>Messages</Table.Th>
                                <Table.Th>Pass Rate</Table.Th>
                                <Table.Th>Last Run</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {testSuites.map((suite) => (
                                <Table.Tr
                                    key={suite.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setExpandedSuite(expandedSuite === suite.id ? null : suite.id)}
                                >
                                    <Table.Td>
                                        <ActionIcon variant="subtle" size="sm">
                                            {expandedSuite === suite.id ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                        </ActionIcon>
                                    </Table.Td>
                                    <Table.Td>
                                        <div>
                                            <Text fw={500}>{suite.name}</Text>
                                            {suite.description && (
                                                <Text size="xs" c="dimmed">{suite.description}</Text>
                                            )}
                                        </div>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge color="violet" variant="light" tt="uppercase" size="sm">
                                            {suite.category}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <IconMessage size={14} />
                                            <Text size="sm">{suite.test_cases_count} messages</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Progress
                                                value={suite.pass_rate}
                                                w={80}
                                                color={suite.pass_rate >= 80 ? 'green' : suite.pass_rate >= 50 ? 'yellow' : 'red'}
                                            />
                                            <Text size="sm">{suite.pass_rate.toFixed(0)}%</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">
                                            {suite.last_run_at ? new Date(suite.last_run_at).toLocaleDateString() : '-'}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge color={suite.is_active ? 'green' : 'gray'} variant="light">
                                            {suite.is_active ? 'ACTIVE' : 'INACTIVE'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td onClick={(e) => e.stopPropagation()}>
                                        <Group gap="xs">
                                            <Tooltip label="Run Suite">
                                                <ActionIcon variant="light" color="green">
                                                    <IconPlayerPlay size={14} />
                                                </ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="Edit">
                                                <ActionIcon variant="light">
                                                    <IconEdit size={14} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                ) : (
                    <Stack align="center" p="xl">
                        <ThemeIcon size={60} variant="light" color="gray" radius="xl">
                            <IconTestPipe size={30} />
                        </ThemeIcon>
                        <Text c="dimmed">No test suites yet</Text>
                        <Button variant="light" onClick={openCreateModal}>
                            Create your first test suite
                        </Button>
                    </Stack>
                )}
            </Card>

            {/* Recent Test Runs */}
            {testRuns && testRuns.length > 0 && (
                <Card withBorder p="md" bg="dark.7">
                    <Text fw={500} mb="md">Recent Test Runs</Text>

                    <Stack gap="sm">
                        {testRuns.slice(0, 5).map((run) => (
                            <Paper key={run.id} p="sm" withBorder>
                                <Group justify="space-between">
                                    <Group gap="md">
                                        <Badge
                                            color={run.status === 'passed' ? 'green' : run.status === 'failed' ? 'red' : 'yellow'}
                                            variant="light"
                                        >
                                            {run.status.toUpperCase()}
                                        </Badge>
                                        <Text size="sm">
                                            {run.passed_tests}/{run.total_tests} passed
                                        </Text>
                                        <Text size="sm" c="teal">
                                            Score: {run.average_score.toFixed(1)}%
                                        </Text>
                                    </Group>
                                    <Group gap="md">
                                        <Group gap="xs">
                                            <IconClock size={14} />
                                            <Text size="xs" c="dimmed">
                                                {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                                            </Text>
                                        </Group>
                                        <Text size="xs" c="dimmed">
                                            {run.started_at ? new Date(run.started_at).toLocaleString() : '-'}
                                        </Text>
                                        <Badge size="xs" variant="outline">
                                            {run.triggered_by}
                                        </Badge>
                                    </Group>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </Card>
            )}

            {/* Create Suite Modal */}
            <Modal opened={createModalOpened} onClose={closeCreateModal} title="New Test Suite">
                <Stack gap="md">
                    <TextInput
                        label="Suite Name"
                        placeholder="e.g., Cliente trafego pago"
                        value={newSuiteName}
                        onChange={(e) => setNewSuiteName(e.target.value)}
                        required
                    />

                    <Select
                        label="Category"
                        data={[
                            { value: 'functional', label: 'Functional' },
                            { value: 'regression', label: 'Regression' },
                            { value: 'edge_case', label: 'Edge Case' },
                            { value: 'performance', label: 'Performance' },
                        ]}
                        value={newSuiteCategory}
                        onChange={(v) => setNewSuiteCategory(v || 'functional')}
                    />

                    <Group justify="flex-end" mt="md">
                        <Button variant="subtle" onClick={closeCreateModal}>Cancel</Button>
                        <Button
                            onClick={() => createSuite.mutate()}
                            loading={createSuite.isPending}
                            disabled={!newSuiteName.trim()}
                        >
                            Create Suite
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    )
}
