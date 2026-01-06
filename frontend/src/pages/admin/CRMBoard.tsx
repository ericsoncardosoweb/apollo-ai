/**
 * CRM Kanban Board - Drag & Drop Deal Management
 * Uses @hello-pangea/dnd for smooth drag and drop
 */

import { useState, useEffect } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Paper,
    Avatar,
    Badge,
    Button,
    ActionIcon,
    Select,
    TextInput,
    NumberInput,
    Drawer,
    Modal,
    Tooltip,
    Menu,
    Box,
    Divider,
    Timeline,
    ThemeIcon,
    Skeleton,
    Alert,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from '@hello-pangea/dnd'
import {
    IconPlus,
    IconSettings,
    IconGripVertical,
    IconCurrencyReal,
    IconTag,
    IconPhone,
    IconMail,
    IconHistory,
    IconBolt,
    IconCheck,
    IconX,
    IconDotsVertical,
    IconArrowRight,
    IconDeviceFloppy,
    IconTemplate,
    IconRefresh,
} from '@tabler/icons-react'
import { useViewContext } from '@/contexts/ViewContext'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'

// Types
interface Stage {
    id: string
    name: string
    color: string
    position: number
    is_conversion_point: boolean
}

interface Deal {
    id: string
    contact_name: string
    contact_phone: string
    value: number
    tags: string[]
    current_stage_id: string
    cycle_number: number
    status: 'open' | 'won' | 'lost'
    created_at: string
}

interface Pipeline {
    id: string
    name: string
    stages: Stage[]
    is_default: boolean
}

interface DealHistoryItem {
    id: string
    from_stage: string | null
    to_stage: string
    duration_in_stage: number | null
    triggered_by: string
    created_at: string
}

// Mock data for development
const MOCK_PIPELINES: Pipeline[] = [
    {
        id: '1',
        name: 'Funil de Vendas',
        is_default: true,
        stages: [
            { id: 'lead', name: 'Lead', color: '#868e96', position: 0, is_conversion_point: false },
            { id: 'qualificacao', name: 'Qualificação', color: '#fab005', position: 1, is_conversion_point: false },
            { id: 'proposta', name: 'Proposta', color: '#228be6', position: 2, is_conversion_point: false },
            { id: 'negociacao', name: 'Negociação', color: '#7950f2', position: 3, is_conversion_point: false },
            { id: 'fechamento', name: 'Fechamento', color: '#40c057', position: 4, is_conversion_point: true },
        ],
    },
]

const MOCK_DEALS: Deal[] = [
    { id: 'd1', contact_name: 'João Silva', contact_phone: '+55 11 99999-1234', value: 2500, tags: ['premium'], current_stage_id: 'lead', cycle_number: 1, status: 'open', created_at: '2026-01-05' },
    { id: 'd2', contact_name: 'Maria Santos', contact_phone: '+55 11 98888-5678', value: 5000, tags: ['vip', 'priority'], current_stage_id: 'qualificacao', cycle_number: 1, status: 'open', created_at: '2026-01-04' },
    { id: 'd3', contact_name: 'Carlos Lima', contact_phone: '+55 21 97777-9012', value: 1500, tags: [], current_stage_id: 'proposta', cycle_number: 2, status: 'open', created_at: '2026-01-03' },
    { id: 'd4', contact_name: 'Ana Costa', contact_phone: '+55 11 96666-3456', value: 8000, tags: ['enterprise'], current_stage_id: 'negociacao', cycle_number: 1, status: 'open', created_at: '2026-01-02' },
]

export default function CRMBoard() {
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // State
    const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(MOCK_PIPELINES[0])
    const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS)
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
    const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)
    const [automationModalOpened, { open: openAutomationModal, close: closeAutomationModal }] = useDisclosure(false)
    const [selectedStageForAutomation, setSelectedStageForAutomation] = useState<Stage | null>(null)

    // Group deals by stage
    const dealsByStage = (stageId: string) => deals.filter(d => d.current_stage_id === stageId && d.status === 'open')

    // Handle drag end
    const handleDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        // Update deal stage
        const updatedDeals = deals.map(deal => {
            if (deal.id === draggableId) {
                return { ...deal, current_stage_id: destination.droppableId }
            }
            return deal
        })

        setDeals(updatedDeals)

        // TODO: Call API to move deal
        console.log(`Moving deal ${draggableId} from ${source.droppableId} to ${destination.droppableId}`)
    }

    // Open deal drawer
    const handleDealClick = (deal: Deal) => {
        setSelectedDeal(deal)
        openDrawer()
    }

    // Open stage automation modal
    const handleStageAutomation = (stage: Stage) => {
        setSelectedStageForAutomation(stage)
        openAutomationModal()
    }

    // Calculate stage totals
    const getStageTotal = (stageId: string) => {
        return dealsByStage(stageId).reduce((sum, deal) => sum + deal.value, 0)
    }

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    if (!isConfigured) {
        return (
            <Stack gap="md">
                <Title order={2}>CRM - Pipeline de Vendas</Title>
                <Alert color="yellow" title="Banco de dados não configurado">
                    Configure o banco de dados do cliente para usar o CRM.
                </Alert>
            </Stack>
        )
    }

    return (
        <Stack gap="md" style={{ height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
            {/* Header */}
            <Group justify="space-between">
                <div>
                    <Title order={2}>CRM - Pipeline de Vendas</Title>
                    <Text c="dimmed" size="sm">Gerencie seus deals com drag and drop</Text>
                </div>
                <Group>
                    <Select
                        placeholder="Selecionar Pipeline"
                        data={MOCK_PIPELINES.map(p => ({ value: p.id, label: p.name }))}
                        value={selectedPipeline?.id}
                        onChange={(value) => {
                            const pipeline = MOCK_PIPELINES.find(p => p.id === value)
                            setSelectedPipeline(pipeline || null)
                        }}
                        w={200}
                    />
                    <Tooltip label="Salvar como Template">
                        <ActionIcon variant="light" size="lg">
                            <IconTemplate size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Button leftSection={<IconPlus size={16} />} variant="filled">
                        Novo Deal
                    </Button>
                </Group>
            </Group>

            {/* Kanban Board */}
            {selectedPipeline && (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Group
                        gap="md"
                        align="flex-start"
                        wrap="nowrap"
                        style={{ flex: 1, overflowX: 'auto', paddingBottom: 16 }}
                    >
                        {selectedPipeline.stages.map((stage) => (
                            <Droppable droppableId={stage.id} key={stage.id}>
                                {(provided, snapshot) => (
                                    <Paper
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        withBorder
                                        p="xs"
                                        radius="md"
                                        style={{
                                            minWidth: 280,
                                            maxWidth: 280,
                                            backgroundColor: snapshot.isDraggingOver ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-dark-7)',
                                            transition: 'background-color 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            maxHeight: '100%',
                                        }}
                                    >
                                        {/* Stage Header */}
                                        <Group justify="space-between" mb="xs">
                                            <Group gap="xs">
                                                <Box
                                                    style={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        backgroundColor: stage.color,
                                                    }}
                                                />
                                                <Text fw={600} size="sm">{stage.name}</Text>
                                                <Badge size="xs" variant="light" color="gray">
                                                    {dealsByStage(stage.id).length}
                                                </Badge>
                                            </Group>
                                            <Group gap={4}>
                                                <Tooltip label="Automações">
                                                    <ActionIcon
                                                        size="sm"
                                                        variant="subtle"
                                                        onClick={() => handleStageAutomation(stage)}
                                                    >
                                                        <IconBolt size={14} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                <ActionIcon size="sm" variant="subtle">
                                                    <IconPlus size={14} />
                                                </ActionIcon>
                                            </Group>
                                        </Group>

                                        {/* Stage Total */}
                                        <Text size="xs" c="dimmed" mb="xs">
                                            Total: {formatCurrency(getStageTotal(stage.id))}
                                        </Text>

                                        {/* Deals */}
                                        <Stack
                                            gap="xs"
                                            style={{
                                                flex: 1,
                                                overflowY: 'auto',
                                                minHeight: 100,
                                            }}
                                        >
                                            {dealsByStage(stage.id).map((deal, index) => (
                                                <Draggable
                                                    key={deal.id}
                                                    draggableId={deal.id}
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <Paper
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            withBorder
                                                            p="sm"
                                                            radius="sm"
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                backgroundColor: snapshot.isDragging
                                                                    ? 'var(--mantine-color-dark-5)'
                                                                    : 'var(--mantine-color-dark-6)',
                                                                cursor: 'grab',
                                                            }}
                                                            onClick={() => handleDealClick(deal)}
                                                        >
                                                            <Group justify="space-between" wrap="nowrap">
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    style={{ cursor: 'grab' }}
                                                                >
                                                                    <IconGripVertical size={14} color="gray" />
                                                                </div>
                                                                <Stack gap={4} style={{ flex: 1 }}>
                                                                    <Text size="sm" fw={500} lineClamp={1}>
                                                                        {deal.contact_name}
                                                                    </Text>
                                                                    <Group gap="xs">
                                                                        <Text size="xs" c="green" fw={600}>
                                                                            {formatCurrency(deal.value)}
                                                                        </Text>
                                                                        {deal.cycle_number > 1 && (
                                                                            <Badge size="xs" variant="outline" color="blue">
                                                                                Ciclo {deal.cycle_number}
                                                                            </Badge>
                                                                        )}
                                                                    </Group>
                                                                    {deal.tags.length > 0 && (
                                                                        <Group gap={4}>
                                                                            {deal.tags.slice(0, 2).map(tag => (
                                                                                <Badge key={tag} size="xs" variant="light">
                                                                                    {tag}
                                                                                </Badge>
                                                                            ))}
                                                                        </Group>
                                                                    )}
                                                                </Stack>
                                                                <Menu position="bottom-end" withArrow>
                                                                    <Menu.Target>
                                                                        <ActionIcon
                                                                            size="sm"
                                                                            variant="subtle"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <IconDotsVertical size={14} />
                                                                        </ActionIcon>
                                                                    </Menu.Target>
                                                                    <Menu.Dropdown>
                                                                        <Menu.Item leftSection={<IconCheck size={14} />} color="green">
                                                                            Marcar como Ganho
                                                                        </Menu.Item>
                                                                        <Menu.Item leftSection={<IconX size={14} />} color="red">
                                                                            Marcar como Perdido
                                                                        </Menu.Item>
                                                                    </Menu.Dropdown>
                                                                </Menu>
                                                            </Group>
                                                        </Paper>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </Stack>
                                    </Paper>
                                )}
                            </Droppable>
                        ))}
                    </Group>
                </DragDropContext>
            )}

            {/* Deal Detail Drawer */}
            <Drawer
                opened={drawerOpened}
                onClose={closeDrawer}
                title={selectedDeal?.contact_name || 'Deal'}
                position="right"
                size="md"
            >
                {selectedDeal && (
                    <Stack gap="md">
                        {/* Contact Info */}
                        <Card withBorder>
                            <Stack gap="xs">
                                <Group>
                                    <Avatar color="blue" radius="xl" size="lg">
                                        {selectedDeal.contact_name.charAt(0)}
                                    </Avatar>
                                    <div>
                                        <Text fw={500}>{selectedDeal.contact_name}</Text>
                                        <Text size="xs" c="dimmed">{selectedDeal.contact_phone}</Text>
                                    </div>
                                </Group>
                                <Divider my="xs" />
                                <Group gap="xs">
                                    <IconCurrencyReal size={16} />
                                    <Text fw={600} c="green">{formatCurrency(selectedDeal.value)}</Text>
                                </Group>
                                <Group gap="xs">
                                    <IconTag size={16} />
                                    {selectedDeal.tags.map(tag => (
                                        <Badge key={tag} size="sm">{tag}</Badge>
                                    ))}
                                    {selectedDeal.tags.length === 0 && (
                                        <Text size="sm" c="dimmed">Sem tags</Text>
                                    )}
                                </Group>
                            </Stack>
                        </Card>

                        {/* Value Editor */}
                        <NumberInput
                            label="Valor do Deal"
                            value={selectedDeal.value}
                            thousandSeparator="."
                            decimalSeparator=","
                            prefix="R$ "
                            leftSection={<IconCurrencyReal size={16} />}
                        />

                        {/* History Timeline */}
                        <Card withBorder>
                            <Text fw={500} mb="sm">Histórico de Movimentação</Text>
                            <Timeline active={0} bulletSize={24} lineWidth={2}>
                                <Timeline.Item
                                    bullet={<IconArrowRight size={12} />}
                                    title="Movido para Proposta"
                                >
                                    <Text c="dimmed" size="xs">Há 2 dias • Por Carlos</Text>
                                    <Text size="sm" c="dimmed">Tempo no estágio anterior: 3 dias</Text>
                                </Timeline.Item>
                                <Timeline.Item
                                    bullet={<IconArrowRight size={12} />}
                                    title="Movido para Qualificação"
                                >
                                    <Text c="dimmed" size="xs">Há 5 dias • Por Sistema</Text>
                                </Timeline.Item>
                                <Timeline.Item
                                    bullet={<IconPlus size={12} />}
                                    title="Deal Criado"
                                >
                                    <Text c="dimmed" size="xs">{selectedDeal.created_at}</Text>
                                </Timeline.Item>
                            </Timeline>
                        </Card>

                        {/* Actions */}
                        <Group grow>
                            <Button variant="light" color="green" leftSection={<IconCheck size={16} />}>
                                Ganho
                            </Button>
                            <Button variant="light" color="red" leftSection={<IconX size={16} />}>
                                Perdido
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Drawer>

            {/* Stage Automation Modal */}
            <Modal
                opened={automationModalOpened}
                onClose={closeAutomationModal}
                title={`Automações: ${selectedStageForAutomation?.name}`}
                size="lg"
            >
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        Configure ações automáticas quando um card entrar neste estágio.
                    </Text>

                    <Card withBorder>
                        <Stack gap="sm">
                            <Group>
                                <input type="checkbox" id="firstTime" />
                                <label htmlFor="firstTime">
                                    <Text size="sm">Apenas na primeira vez deste ciclo</Text>
                                </label>
                            </Group>

                            <Divider />

                            <Text fw={500} size="sm">Ações</Text>

                            <Paper withBorder p="sm">
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <ThemeIcon size="sm" variant="light" color="green">
                                            <IconPhone size={12} />
                                        </ThemeIcon>
                                        <Text size="sm">Enviar WhatsApp</Text>
                                    </Group>
                                    <ActionIcon size="sm" variant="subtle" color="red">
                                        <IconX size={14} />
                                    </ActionIcon>
                                </Group>
                            </Paper>

                            <Button variant="light" leftSection={<IconPlus size={14} />} size="sm">
                                Adicionar Ação
                            </Button>
                        </Stack>
                    </Card>

                    <Group justify="flex-end">
                        <Button variant="default" onClick={closeAutomationModal}>
                            Cancelar
                        </Button>
                        <Button leftSection={<IconDeviceFloppy size={16} />}>
                            Salvar
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    )
}
