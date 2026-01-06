/**
 * CRM Kanban - Versão Dinâmica com Drag and Drop
 * Integrado com Supabase via hooks React Query
 */

import { useState, useCallback } from 'react'
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
    Paper,
    ThemeIcon,
    Tooltip,
    Avatar,
    ScrollArea,
    Loader,
    Divider,
    SimpleGrid,
    Drawer,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconMessageCircle,
    IconSearch,
    IconUser,
    IconPhone,
    IconMail,
    IconFlame,
    IconTemperature,
    IconSnowflake,
    IconGripVertical,
    IconX,
    IconCheck,
} from '@tabler/icons-react'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from '@hello-pangea/dnd'
import {
    useKanbanLeads,
    useMoveLead,
    useUpdateLead,
    useCreateLead,
    useDeleteLead,
    useLead,
    useCRMFields,
    useLeadFieldValues,
    useLeadActivity,
    Lead,
    KanbanColumn,
} from '@/hooks/useCRM'
import { useNavigate } from 'react-router-dom'

// =============================================================================
// TEMPERATURE INDICATOR
// =============================================================================

function TemperatureIndicator({ temperature }: { temperature: string }) {
    const config = {
        hot: { icon: IconFlame, color: 'red', label: 'Quente' },
        warm: { icon: IconTemperature, color: 'orange', label: 'Morno' },
        cold: { icon: IconSnowflake, color: 'blue', label: 'Frio' },
    }[temperature] || { icon: IconSnowflake, color: 'gray', label: 'N/A' }

    const Icon = config.icon

    return (
        <Tooltip label={config.label}>
            <ThemeIcon size="xs" variant="light" color={config.color}>
                <Icon size={12} />
            </ThemeIcon>
        </Tooltip>
    )
}

// =============================================================================
// LEAD CARD COMPONENT
// =============================================================================

interface LeadCardProps {
    lead: Lead
    index: number
    onOpen: (lead: Lead) => void
    onDelete: (leadId: string) => void
}

function LeadCard({ lead, index, onOpen, onDelete }: LeadCardProps) {
    return (
        <Draggable draggableId={lead.id} index={index}>
            {(provided, snapshot) => (
                <Paper
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    p="sm"
                    mb="xs"
                    radius="md"
                    withBorder
                    style={{
                        ...provided.draggableProps.style,
                        backgroundColor: snapshot.isDragging ? 'var(--mantine-color-dark-5)' : undefined,
                        cursor: 'pointer',
                    }}
                    onClick={() => onOpen(lead)}
                >
                    <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                            <Box {...provided.dragHandleProps} style={{ cursor: 'grab' }}>
                                <IconGripVertical size={14} color="gray" />
                            </Box>

                            <Avatar size="sm" radius="xl" color="indigo">
                                {(lead.name || 'L').charAt(0).toUpperCase()}
                            </Avatar>

                            <Box style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" fw={500} truncate>
                                    {lead.name || 'Sem nome'}
                                </Text>
                                <Text size="xs" c="dimmed" truncate>
                                    {lead.phone}
                                </Text>
                            </Box>
                        </Group>

                        <Group gap={4}>
                            <TemperatureIndicator temperature={lead.temperature} />

                            <Menu position="bottom-end" withArrow withinPortal>
                                <Menu.Target>
                                    <ActionIcon
                                        variant="subtle"
                                        size="xs"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <IconDotsVertical size={14} />
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item
                                        leftSection={<IconMessageCircle size={14} />}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // Navigate to chat
                                        }}
                                    >
                                        Abrir Chat
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<IconEdit size={14} />}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onOpen(lead)
                                        }}
                                    >
                                        Editar
                                    </Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item
                                        leftSection={<IconTrash size={14} />}
                                        color="red"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDelete(lead.id)
                                        }}
                                    >
                                        Excluir
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        </Group>
                    </Group>

                    {/* Last message preview */}
                    {lead.last_contact_at && (
                        <Text size="xs" c="dimmed" mt="xs" lineClamp={1}>
                            {new Date(lead.last_contact_at).toLocaleDateString('pt-BR')}
                        </Text>
                    )}

                    {/* Tags */}
                    {lead.tags && lead.tags.length > 0 && (
                        <Group gap={4} mt="xs">
                            {lead.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} size="xs" variant="light">
                                    {tag}
                                </Badge>
                            ))}
                        </Group>
                    )}
                </Paper>
            )}
        </Draggable>
    )
}

// =============================================================================
// KANBAN COLUMN COMPONENT
// =============================================================================

interface KanbanColumnComponentProps {
    column: KanbanColumn
    onOpenLead: (lead: Lead) => void
    onDeleteLead: (leadId: string) => void
}

function KanbanColumnComponent({ column, onOpenLead, onDeleteLead }: KanbanColumnComponentProps) {
    return (
        <Box
            style={{
                width: 300,
                minWidth: 300,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 200px)',
            }}
        >
            {/* Column Header */}
            <Paper p="sm" mb="sm" radius="md" withBorder>
                <Group justify="space-between">
                    <Group gap="xs">
                        <Box
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: `var(--mantine-color-${column.color}-6)`,
                            }}
                        />
                        <Text fw={600} size="sm">{column.name}</Text>
                    </Group>
                    <Badge size="sm" variant="light" color="gray">
                        {column.count}
                    </Badge>
                </Group>
            </Paper>

            {/* Droppable Area */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <ScrollArea
                        style={{ flex: 1 }}
                        scrollbarSize={6}
                    >
                        <Box
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            p="xs"
                            style={{
                                minHeight: 200,
                                backgroundColor: snapshot.isDraggingOver
                                    ? 'var(--mantine-color-dark-6)'
                                    : 'transparent',
                                borderRadius: 8,
                                transition: 'background-color 0.2s',
                            }}
                        >
                            {column.leads.map((lead, index) => (
                                <LeadCard
                                    key={lead.id}
                                    lead={lead}
                                    index={index}
                                    onOpen={onOpenLead}
                                    onDelete={onDeleteLead}
                                />
                            ))}
                            {provided.placeholder}

                            {column.leads.length === 0 && !snapshot.isDraggingOver && (
                                <Text size="xs" c="dimmed" ta="center" py="xl">
                                    Arraste leads para cá
                                </Text>
                            )}
                        </Box>
                    </ScrollArea>
                )}
            </Droppable>
        </Box>
    )
}

// =============================================================================
// LEAD DETAIL DRAWER
// =============================================================================

interface LeadDetailDrawerProps {
    leadId: string | null
    opened: boolean
    onClose: () => void
}

function LeadDetailDrawer({ leadId, opened, onClose }: LeadDetailDrawerProps) {
    const { data: lead, isLoading } = useLead(leadId || undefined)
    const { data: customFields } = useCRMFields()
    const { data: fieldValues } = useLeadFieldValues(leadId || undefined)
    const { data: activity } = useLeadActivity(leadId || undefined)
    const updateLead = useUpdateLead()
    const navigate = useNavigate()

    const [description, setDescription] = useState('')

    if (isLoading) {
        return (
            <Drawer opened={opened} onClose={onClose} position="right" size="md">
                <Box ta="center" py="xl">
                    <Loader />
                </Box>
            </Drawer>
        )
    }

    if (!lead) return null

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            position="right"
            size="md"
            title={
                <Group>
                    <Avatar color="indigo" radius="xl">
                        {lead.name?.charAt(0) || 'L'}
                    </Avatar>
                    <div>
                        <Text fw={600}>{lead.name || 'Sem nome'}</Text>
                        <Badge size="xs" color={lead.pipeline_stage?.color}>
                            {lead.pipeline_stage?.name}
                        </Badge>
                    </div>
                </Group>
            }
        >
            <Stack gap="md">
                {/* Contact Info */}
                <Paper withBorder p="sm">
                    <Stack gap="xs">
                        <Group gap="xs">
                            <IconPhone size={14} />
                            <Text size="sm">{lead.phone}</Text>
                        </Group>
                        {lead.email && (
                            <Group gap="xs">
                                <IconMail size={14} />
                                <Text size="sm">{lead.email}</Text>
                            </Group>
                        )}
                    </Stack>
                </Paper>

                {/* Description */}
                <Box>
                    <Text size="sm" fw={500} mb="xs">Descrição</Text>
                    <Textarea
                        placeholder="Adicione uma descrição do lead..."
                        value={description || lead.description || ''}
                        onChange={(e) => setDescription(e.target.value)}
                        minRows={3}
                        onBlur={() => {
                            if (description !== lead.description) {
                                updateLead.mutate({ leadId: lead.id, updates: { description } })
                            }
                        }}
                    />
                </Box>

                {/* Custom Fields */}
                {customFields && customFields.length > 0 && (
                    <Box>
                        <Text size="sm" fw={500} mb="xs">Campos Customizados</Text>
                        <Stack gap="xs">
                            {customFields.map((field) => (
                                <TextInput
                                    key={field.id}
                                    label={field.field_label}
                                    placeholder={field.placeholder}
                                    defaultValue={fieldValues?.[field.field_name] as string}
                                    size="xs"
                                />
                            ))}
                        </Stack>
                    </Box>
                )}

                {/* Activity Log */}
                <Box>
                    <Text size="sm" fw={500} mb="xs">Histórico</Text>
                    <Stack gap="xs">
                        {activity?.slice(0, 5).map((item) => (
                            <Paper key={item.id} p="xs" bg="dark.6" radius="sm">
                                <Group justify="space-between">
                                    <Text size="xs">{item.description || item.activity_type}</Text>
                                    <Text size="xs" c="dimmed">
                                        {new Date(item.created_at).toLocaleString('pt-BR')}
                                    </Text>
                                </Group>
                                <Badge size="xs" variant="light" color={item.performed_by === 'ai' ? 'blue' : 'gray'}>
                                    {item.performed_by}
                                </Badge>
                            </Paper>
                        ))}
                    </Stack>
                </Box>

                <Divider />

                {/* Actions */}
                <Button
                    fullWidth
                    leftSection={<IconMessageCircle size={16} />}
                    onClick={() => {
                        if (lead.conversation_id) {
                            navigate(`/app/inbox?conversation=${lead.conversation_id}`)
                        }
                    }}
                >
                    Abrir Chat
                </Button>

                <Button
                    fullWidth
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                >
                    Excluir Lead
                </Button>
            </Stack>
        </Drawer>
    )
}

// =============================================================================
// MAIN CRM PAGE
// =============================================================================

export default function CRMPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
    const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)
    const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false)

    // Queries
    const { data: columns, isLoading, error } = useKanbanLeads()

    // Mutations
    const moveLead = useMoveLead()
    const createLead = useCreateLead()
    const deleteLead = useDeleteLead()

    // Form state for new lead
    const [newLeadName, setNewLeadName] = useState('')
    const [newLeadPhone, setNewLeadPhone] = useState('')

    // Handle drag end
    const handleDragEnd = useCallback((result: DropResult) => {
        const { draggableId, source, destination } = result

        // Dropped outside
        if (!destination) return

        // Same position
        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return
        }

        // Move lead
        moveLead.mutate({
            leadId: draggableId,
            toStageId: destination.droppableId,
            position: destination.index,
        })
    }, [moveLead])

    // Open lead detail
    const handleOpenLead = (lead: Lead) => {
        setSelectedLeadId(lead.id)
        openDrawer()
    }

    // Delete lead
    const handleDeleteLead = (leadId: string) => {
        if (confirm('Tem certeza que deseja excluir este lead?')) {
            deleteLead.mutate(leadId)
        }
    }

    // Create lead
    const handleCreateLead = async () => {
        await createLead.mutateAsync({
            name: newLeadName,
            phone: newLeadPhone,
        })
        setNewLeadName('')
        setNewLeadPhone('')
        closeCreateModal()
    }

    // Loading
    if (isLoading) {
        return (
            <Box p="xl" ta="center">
                <Loader size="lg" />
                <Text mt="md" c="dimmed">Carregando CRM...</Text>
            </Box>
        )
    }

    // Error
    if (error) {
        return (
            <Box p="xl" ta="center">
                <Text c="red">Erro ao carregar CRM: {String(error)}</Text>
            </Box>
        )
    }

    return (
        <>
            <Stack gap="lg">
                {/* Header */}
                <Group justify="space-between">
                    <div>
                        <Title order={2}>CRM</Title>
                        <Text c="dimmed" size="sm">
                            Gerencie seus leads e oportunidades
                        </Text>
                    </div>
                    <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                        Novo Lead
                    </Button>
                </Group>

                {/* Search */}
                <TextInput
                    placeholder="Buscar leads..."
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: 300 }}
                />

                {/* Kanban Board */}
                <Box style={{ overflowX: 'auto' }}>
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Group align="flex-start" gap="md" wrap="nowrap">
                            {(columns || []).map((column) => (
                                <KanbanColumnComponent
                                    key={column.id}
                                    column={column}
                                    onOpenLead={handleOpenLead}
                                    onDeleteLead={handleDeleteLead}
                                />
                            ))}
                        </Group>
                    </DragDropContext>
                </Box>
            </Stack>

            {/* Lead Detail Drawer */}
            <LeadDetailDrawer
                leadId={selectedLeadId}
                opened={drawerOpened}
                onClose={closeDrawer}
            />

            {/* Create Lead Modal */}
            <Modal
                opened={createModalOpened}
                onClose={closeCreateModal}
                title="Novo Lead"
                centered
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome"
                        placeholder="Nome do lead"
                        value={newLeadName}
                        onChange={(e) => setNewLeadName(e.target.value)}
                        required
                    />
                    <TextInput
                        label="WhatsApp"
                        placeholder="+55 11 99999-9999"
                        value={newLeadPhone}
                        onChange={(e) => setNewLeadPhone(e.target.value)}
                        required
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeCreateModal}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateLead}
                            loading={createLead.isPending}
                            disabled={!newLeadName.trim() || !newLeadPhone.trim()}
                        >
                            Criar Lead
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
