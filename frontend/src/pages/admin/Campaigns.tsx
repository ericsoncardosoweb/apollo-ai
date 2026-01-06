/**
 * Campaigns - WhatsApp Mass Messaging Module
 * Campanhas de disparo em massa com anti-banimento
 */

import { useState, useEffect, useMemo } from 'react'
import {
    Stack,
    Group,
    Title,
    Text,
    Button,
    Card,
    Paper,
    Tabs,
    Table,
    Badge,
    ActionIcon,
    Menu,
    TextInput,
    Select,
    SimpleGrid,
    ThemeIcon,
    Progress,
    Skeleton,
    Alert,
    Modal,
    NumberInput,
    MultiSelect,
    Checkbox,
    Divider,
    ScrollArea,
    Tooltip,
    Stepper,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { DateTimePicker } from '@mantine/dates'
import {
    IconSearch,
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconPlayerPlay,
    IconPlayerPause,
    IconPlayerStop,
    IconCopy,
    IconTemplate,
    IconSend,
    IconUsers,
    IconCheck,
    IconX,
    IconClock,
    IconCalendar,
    IconFilter,
    IconSettings,
    IconDatabase,
    IconRefresh,
    IconMessage,
    IconChartBar,
    IconBrandWhatsapp,
} from '@tabler/icons-react'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'
import {
    useCampaigns,
    useCampaignStats,
    useMessageTemplates,
    useCreateCampaign,
    useUpdateCampaign,
    useDeleteCampaign,
    useUpdateCampaignStatus,
    useDeleteMessageTemplate,
    MessageTemplate,
    Campaign,
    CampaignStatus,
} from '@/hooks/useCampaigns'
import { useContacts, useContactTags } from '@/hooks/useContacts'
import { TemplateBuilder } from '@/components/campaigns/TemplateBuilder'

// Status config
const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: 'gray' },
    scheduled: { label: 'Agendada', color: 'blue' },
    running: { label: 'Executando', color: 'green' },
    paused: { label: 'Pausada', color: 'yellow' },
    completed: { label: 'Concluída', color: 'teal' },
    cancelled: { label: 'Cancelada', color: 'red' },
}

const DAYS_OF_WEEK = [
    { value: '1', label: 'Segunda' },
    { value: '2', label: 'Terça' },
    { value: '3', label: 'Quarta' },
    { value: '4', label: 'Quinta' },
    { value: '5', label: 'Sexta' },
    { value: '6', label: 'Sábado' },
    { value: '7', label: 'Domingo' },
]

// SQL for creating tables
const CAMPAIGNS_SQL = `-- Execute campaigns_v2.sql tenant migration`

export default function AdminCampaigns() {
    // State
    const [activeTab, setActiveTab] = useState<string | null>('campaigns')
    const [search, setSearch] = useState('')
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

    // Modals
    const [templateBuilderOpened, { open: openTemplateBuilder, close: closeTemplateBuilder }] = useDisclosure()
    const [campaignModalOpened, { open: openCampaignModal, close: closeCampaignModal }] = useDisclosure()
    const [setupModalOpened, { open: openSetupModal, close: closeSetupModal }] = useDisclosure()

    // Editing state
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
    const [campaignStep, setCampaignStep] = useState(0)
    const [needsSetup, setNeedsSetup] = useState(false)

    // Campaign form
    const [campaignForm, setCampaignForm] = useState({
        name: '',
        description: '',
        scheduled_at: null as Date | null,
        schedule_days: ['1', '2', '3', '4', '5'],
        schedule_start_hour: 9,
        schedule_end_hour: 18,
        max_daily_volume: 200,
        min_interval_seconds: 30,
        max_interval_seconds: 120,
        use_random_intervals: true,
        batch_size: 10,
        batch_pause_minutes: 15,
        status_filter: [] as string[],
        type_filter: [] as string[],
        tags_filter: [] as string[],
        exclude_tags: [] as string[],
        selected_templates: [] as string[],
        connection_id: '',
    })

    // Context
    const { selectedCompany } = useViewContext()

    // Queries
    const { error: campaignsError, isLoading: campaignsLoading, refetch: refetchCampaigns } = useCampaigns()
    const { data: campaigns } = useCampaigns(selectedStatus as CampaignStatus | undefined)
    const { data: templates, refetch: refetchTemplates } = useMessageTemplates()
    const { data: stats } = useCampaignStats()
    const { data: contacts } = useContacts()
    const { data: tags } = useContactTags()

    // Mutations
    const createCampaign = useCreateCampaign()
    const updateCampaign = useUpdateCampaign()
    const deleteCampaign = useDeleteCampaign()
    const updateCampaignStatus = useUpdateCampaignStatus()
    const deleteTemplate = useDeleteMessageTemplate()

    // Check for table not found error
    useMemo(() => {
        if (campaignsError && (campaignsError as any)?.code === 'PGRST205') {
            setNeedsSetup(true)
        }
    }, [campaignsError])

    // Filtered data
    const filteredCampaigns = campaigns?.filter(c => {
        const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
        return matchesSearch
    }) || []

    const filteredTemplates = templates?.filter(t => {
        const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
        return matchesSearch
    }) || []

    // Calculate matching contacts for filters
    const matchingContacts = useMemo(() => {
        if (!contacts) return 0
        return contacts.filter(c => {
            if (campaignForm.status_filter.length > 0 && !campaignForm.status_filter.includes(c.status)) return false
            if (campaignForm.type_filter.length > 0 && !campaignForm.type_filter.includes(c.type)) return false
            if (campaignForm.tags_filter.length > 0 && !campaignForm.tags_filter.some(t => c.tags?.includes(t))) return false
            if (campaignForm.exclude_tags.length > 0 && campaignForm.exclude_tags.some(t => c.tags?.includes(t))) return false
            return true
        }).length
    }, [contacts, campaignForm.status_filter, campaignForm.type_filter, campaignForm.tags_filter, campaignForm.exclude_tags])

    // Handlers
    const handleOpenCreateTemplate = () => {
        setEditingTemplate(null)
        openTemplateBuilder()
    }

    const handleEditTemplate = (template: MessageTemplate) => {
        setEditingTemplate(template)
        openTemplateBuilder()
    }

    const handleDeleteTemplate = async (id: string) => {
        if (window.confirm('Deseja realmente excluir este template?')) {
            await deleteTemplate.mutateAsync(id)
        }
    }

    const handleOpenCreateCampaign = () => {
        setEditingCampaign(null)
        setCampaignStep(0)
        setCampaignForm({
            name: '',
            description: '',
            scheduled_at: null,
            schedule_days: ['1', '2', '3', '4', '5'],
            schedule_start_hour: 9,
            schedule_end_hour: 18,
            max_daily_volume: 200,
            min_interval_seconds: 30,
            max_interval_seconds: 120,
            use_random_intervals: true,
            batch_size: 10,
            batch_pause_minutes: 15,
            status_filter: [],
            type_filter: [],
            tags_filter: [],
            exclude_tags: [],
            selected_templates: [],
            connection_id: '',
        })
        openCampaignModal()
    }

    const handleEditCampaign = (campaign: Campaign) => {
        setEditingCampaign(campaign)
        setCampaignStep(0)
        setCampaignForm({
            name: campaign.name,
            description: campaign.description || '',
            scheduled_at: campaign.scheduled_at ? new Date(campaign.scheduled_at) : null,
            schedule_days: campaign.schedule_days.map(String),
            schedule_start_hour: campaign.schedule_start_hour,
            schedule_end_hour: campaign.schedule_end_hour,
            max_daily_volume: campaign.max_daily_volume,
            min_interval_seconds: campaign.min_interval_seconds,
            max_interval_seconds: campaign.max_interval_seconds,
            use_random_intervals: campaign.use_random_intervals,
            batch_size: campaign.batch_size,
            batch_pause_minutes: campaign.batch_pause_minutes,
            status_filter: campaign.contact_filters.status || [],
            type_filter: campaign.contact_filters.type || [],
            tags_filter: campaign.contact_filters.tags || [],
            exclude_tags: campaign.contact_filters.exclude_tags || [],
            selected_templates: [],
            connection_id: campaign.connection_id || '',
        })
        openCampaignModal()
    }

    const handleDeleteCampaign = async (id: string) => {
        if (window.confirm('Deseja realmente excluir esta campanha?')) {
            await deleteCampaign.mutateAsync(id)
        }
    }

    const handleSaveCampaign = async () => {
        if (!campaignForm.name.trim()) {
            notifications.show({ title: 'Nome obrigatório', message: 'Digite um nome para a campanha', color: 'yellow' })
            return
        }

        if (campaignForm.selected_templates.length === 0) {
            notifications.show({ title: 'Templates obrigatórios', message: 'Selecione pelo menos um template', color: 'yellow' })
            return
        }

        try {
            const data = {
                name: campaignForm.name,
                description: campaignForm.description || undefined,
                scheduled_at: campaignForm.scheduled_at?.toISOString(),
                schedule_days: campaignForm.schedule_days.map(Number),
                schedule_start_hour: campaignForm.schedule_start_hour,
                schedule_end_hour: campaignForm.schedule_end_hour,
                max_daily_volume: campaignForm.max_daily_volume,
                min_interval_seconds: campaignForm.min_interval_seconds,
                max_interval_seconds: campaignForm.max_interval_seconds,
                use_random_intervals: campaignForm.use_random_intervals,
                batch_size: campaignForm.batch_size,
                batch_pause_minutes: campaignForm.batch_pause_minutes,
                contact_filters: {
                    status: campaignForm.status_filter.length > 0 ? campaignForm.status_filter : undefined,
                    type: campaignForm.type_filter.length > 0 ? campaignForm.type_filter : undefined,
                    tags: campaignForm.tags_filter.length > 0 ? campaignForm.tags_filter : undefined,
                    exclude_tags: campaignForm.exclude_tags.length > 0 ? campaignForm.exclude_tags : undefined,
                },
                connection_id: campaignForm.connection_id || undefined,
            }

            if (editingCampaign) {
                await updateCampaign.mutateAsync({ id: editingCampaign.id, ...data })
            } else {
                await createCampaign.mutateAsync(data)
            }

            closeCampaignModal()
        } catch (e) {
            // Error handled by hook
        }
    }

    const handleCampaignAction = async (campaign: Campaign, action: 'start' | 'pause' | 'stop') => {
        const statusMap = {
            start: 'running' as CampaignStatus,
            pause: 'paused' as CampaignStatus,
            stop: 'cancelled' as CampaignStatus,
        }
        await updateCampaignStatus.mutateAsync({ id: campaign.id, status: statusMap[action] })
    }

    // Render setup screen if tables don't exist
    if (needsSetup || (!campaignsLoading && campaignsError)) {
        return (
            <Stack gap="md">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Campanhas WhatsApp</Title>
                        <Text c="dimmed" size="sm">Sistema de disparo em massa</Text>
                    </div>
                </Group>

                <Alert color="yellow" title="Configuração Necessária">
                    <Text size="sm" mb="md">
                        As tabelas de campanhas ainda não foram criadas no banco de dados.
                        Execute a migration `campaigns_v2.sql` no banco do cliente.
                    </Text>
                    <Button onClick={openSetupModal}>Ver SQL</Button>
                </Alert>

                <Modal opened={setupModalOpened} onClose={closeSetupModal} title="SQL Migration" size="lg">
                    <Stack gap="md">
                        <Text size="sm" c="dimmed">
                            Execute o arquivo <code>supabase/tenant_migrations/campaigns_v2.sql</code> no banco do cliente.
                        </Text>
                        <Button onClick={() => { navigator.clipboard.writeText(CAMPAIGNS_SQL); notifications.show({ title: 'Copiado!', message: '', color: 'green' }) }}>
                            Copiar caminho do arquivo
                        </Button>
                    </Stack>
                </Modal>
            </Stack>
        )
    }

    return (
        <Stack gap="md">
            {/* Header */}
            <Group justify="space-between">
                <div>
                    <Title order={2}>Campanhas WhatsApp</Title>
                    <Text c="dimmed" size="sm">Sistema de disparo em massa para {selectedCompany?.name}</Text>
                </div>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconTemplate size={16} />}
                        onClick={handleOpenCreateTemplate}
                    >
                        Novo Template
                    </Button>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleOpenCreateCampaign}
                    >
                        Nova Campanha
                    </Button>
                </Group>
            </Group>

            {/* Stats */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="blue">
                            <IconSend size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Total Campanhas</Text>
                            <Text size="xl" fw={700}>{stats?.totalCampaigns || 0}</Text>
                        </div>
                    </Group>
                </Card>
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="green">
                            <IconCheck size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Mensagens Enviadas</Text>
                            <Text size="xl" fw={700}>{stats?.totalSent || 0}</Text>
                        </div>
                    </Group>
                </Card>
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="teal">
                            <IconMessage size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Respostas</Text>
                            <Text size="xl" fw={700}>{stats?.totalResponses || 0}</Text>
                        </div>
                    </Group>
                </Card>
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="red">
                            <IconX size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Falhas</Text>
                            <Text size="xl" fw={700}>{stats?.totalFailed || 0}</Text>
                        </div>
                    </Group>
                </Card>
            </SimpleGrid>

            {/* Tabs */}
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="campaigns" leftSection={<IconSend size={16} />}>
                        Campanhas
                    </Tabs.Tab>
                    <Tabs.Tab value="templates" leftSection={<IconTemplate size={16} />}>
                        Templates ({templates?.length || 0})
                    </Tabs.Tab>
                </Tabs.List>

                {/* Campaigns Tab */}
                <Tabs.Panel value="campaigns" pt="md">
                    <Stack gap="md">
                        {/* Filters */}
                        <Paper withBorder p="md">
                            <Group>
                                <TextInput
                                    placeholder="Buscar campanha..."
                                    leftSection={<IconSearch size={16} />}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ flex: 1, maxWidth: 300 }}
                                />
                                <Select
                                    placeholder="Status"
                                    data={Object.entries(CAMPAIGN_STATUS_CONFIG).map(([value, config]) => ({
                                        value,
                                        label: config.label,
                                    }))}
                                    value={selectedStatus}
                                    onChange={setSelectedStatus}
                                    clearable
                                    w={150}
                                />
                                <ActionIcon variant="light" onClick={() => refetchCampaigns()}>
                                    <IconRefresh size={16} />
                                </ActionIcon>
                            </Group>
                        </Paper>

                        {/* Campaigns List */}
                        <Card withBorder p={0}>
                            {campaignsLoading ? (
                                <Stack p="md">
                                    {[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}
                                </Stack>
                            ) : filteredCampaigns.length === 0 ? (
                                <Stack p="xl" align="center">
                                    <ThemeIcon size={60} variant="light" color="gray">
                                        <IconSend size={30} />
                                    </ThemeIcon>
                                    <Text c="dimmed">Nenhuma campanha encontrada</Text>
                                    <Button onClick={handleOpenCreateCampaign}>Criar primeira campanha</Button>
                                </Stack>
                            ) : (
                                <Table.ScrollContainer minWidth={800}>
                                    <Table verticalSpacing="sm" highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Nome</Table.Th>
                                                <Table.Th>Status</Table.Th>
                                                <Table.Th>Progresso</Table.Th>
                                                <Table.Th>Agendamento</Table.Th>
                                                <Table.Th>Respostas</Table.Th>
                                                <Table.Th w={100}></Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {filteredCampaigns.map(campaign => {
                                                const statusConfig = CAMPAIGN_STATUS_CONFIG[campaign.status]
                                                const progress = campaign.total_contacts > 0
                                                    ? Math.round((campaign.sent_count / campaign.total_contacts) * 100)
                                                    : 0

                                                return (
                                                    <Table.Tr key={campaign.id}>
                                                        <Table.Td>
                                                            <Text fw={500}>{campaign.name}</Text>
                                                            {campaign.description && (
                                                                <Text size="xs" c="dimmed" lineClamp={1}>{campaign.description}</Text>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge color={statusConfig.color}>{statusConfig.label}</Badge>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Group gap="xs">
                                                                <Progress value={progress} size="sm" style={{ flex: 1, minWidth: 80 }} />
                                                                <Text size="xs" c="dimmed">
                                                                    {campaign.sent_count}/{campaign.total_contacts}
                                                                </Text>
                                                            </Group>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            {campaign.scheduled_at ? (
                                                                <Text size="sm">
                                                                    {new Date(campaign.scheduled_at).toLocaleDateString('pt-BR')}
                                                                </Text>
                                                            ) : (
                                                                <Text size="sm" c="dimmed">Não agendada</Text>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge variant="light">{campaign.response_count}</Badge>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Group gap="xs" justify="flex-end">
                                                                {campaign.status === 'draft' && (
                                                                    <Tooltip label="Iniciar">
                                                                        <ActionIcon
                                                                            variant="light"
                                                                            color="green"
                                                                            onClick={() => handleCampaignAction(campaign, 'start')}
                                                                        >
                                                                            <IconPlayerPlay size={16} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                )}
                                                                {campaign.status === 'running' && (
                                                                    <Tooltip label="Pausar">
                                                                        <ActionIcon
                                                                            variant="light"
                                                                            color="yellow"
                                                                            onClick={() => handleCampaignAction(campaign, 'pause')}
                                                                        >
                                                                            <IconPlayerPause size={16} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                )}
                                                                {campaign.status === 'paused' && (
                                                                    <Tooltip label="Retomar">
                                                                        <ActionIcon
                                                                            variant="light"
                                                                            color="green"
                                                                            onClick={() => handleCampaignAction(campaign, 'start')}
                                                                        >
                                                                            <IconPlayerPlay size={16} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                )}
                                                                <Menu shadow="md" position="bottom-end">
                                                                    <Menu.Target>
                                                                        <ActionIcon variant="subtle">
                                                                            <IconDotsVertical size={16} />
                                                                        </ActionIcon>
                                                                    </Menu.Target>
                                                                    <Menu.Dropdown>
                                                                        <Menu.Item
                                                                            leftSection={<IconEdit size={14} />}
                                                                            onClick={() => handleEditCampaign(campaign)}
                                                                        >
                                                                            Editar
                                                                        </Menu.Item>
                                                                        <Menu.Item leftSection={<IconChartBar size={14} />}>
                                                                            Estatísticas
                                                                        </Menu.Item>
                                                                        <Menu.Item leftSection={<IconCopy size={14} />}>
                                                                            Duplicar
                                                                        </Menu.Item>
                                                                        <Menu.Divider />
                                                                        {['running', 'paused'].includes(campaign.status) && (
                                                                            <Menu.Item
                                                                                leftSection={<IconPlayerStop size={14} />}
                                                                                color="red"
                                                                                onClick={() => handleCampaignAction(campaign, 'stop')}
                                                                            >
                                                                                Cancelar
                                                                            </Menu.Item>
                                                                        )}
                                                                        <Menu.Item
                                                                            leftSection={<IconTrash size={14} />}
                                                                            color="red"
                                                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                                                        >
                                                                            Excluir
                                                                        </Menu.Item>
                                                                    </Menu.Dropdown>
                                                                </Menu>
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )
                                            })}
                                        </Table.Tbody>
                                    </Table>
                                </Table.ScrollContainer>
                            )}
                        </Card>
                    </Stack>
                </Tabs.Panel>

                {/* Templates Tab */}
                <Tabs.Panel value="templates" pt="md">
                    <Stack gap="md">
                        {/* Search */}
                        <Paper withBorder p="md">
                            <Group>
                                <TextInput
                                    placeholder="Buscar template..."
                                    leftSection={<IconSearch size={16} />}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ flex: 1, maxWidth: 300 }}
                                />
                                <ActionIcon variant="light" onClick={() => refetchTemplates()}>
                                    <IconRefresh size={16} />
                                </ActionIcon>
                            </Group>
                        </Paper>

                        {/* Templates Grid */}
                        {filteredTemplates.length === 0 ? (
                            <Card withBorder p="xl" ta="center">
                                <ThemeIcon size={60} variant="light" color="gray" mx="auto" mb="md">
                                    <IconTemplate size={30} />
                                </ThemeIcon>
                                <Text c="dimmed" mb="md">Nenhum template criado</Text>
                                <Button onClick={handleOpenCreateTemplate}>Criar primeiro template</Button>
                            </Card>
                        ) : (
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                                {filteredTemplates.map(template => (
                                    <Card key={template.id} withBorder padding="md">
                                        <Group justify="space-between" mb="xs">
                                            <Group gap="sm">
                                                <ThemeIcon variant="light" color="blue">
                                                    <IconMessage size={16} />
                                                </ThemeIcon>
                                                <Text fw={500}>{template.name}</Text>
                                            </Group>
                                            <Menu shadow="md" position="bottom-end">
                                                <Menu.Target>
                                                    <ActionIcon variant="subtle">
                                                        <IconDotsVertical size={16} />
                                                    </ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    <Menu.Item
                                                        leftSection={<IconEdit size={14} />}
                                                        onClick={() => handleEditTemplate(template)}
                                                    >
                                                        Editar
                                                    </Menu.Item>
                                                    <Menu.Item leftSection={<IconCopy size={14} />}>
                                                        Duplicar
                                                    </Menu.Item>
                                                    <Menu.Divider />
                                                    <Menu.Item
                                                        leftSection={<IconTrash size={14} />}
                                                        color="red"
                                                        onClick={() => handleDeleteTemplate(template.id)}
                                                    >
                                                        Excluir
                                                    </Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </Group>
                                        {template.description && (
                                            <Text size="sm" c="dimmed" lineClamp={2} mb="sm">
                                                {template.description}
                                            </Text>
                                        )}
                                        <Group gap="xs">
                                            <Badge size="sm" variant="light">{template.category}</Badge>
                                            {template.usage_count > 0 && (
                                                <Badge size="sm" variant="outline">
                                                    Usado {template.usage_count}x
                                                </Badge>
                                            )}
                                        </Group>
                                    </Card>
                                ))}
                            </SimpleGrid>
                        )}
                    </Stack>
                </Tabs.Panel>
            </Tabs>

            {/* Template Builder Modal */}
            <TemplateBuilder
                opened={templateBuilderOpened}
                onClose={closeTemplateBuilder}
                template={editingTemplate}
                onSaved={() => refetchTemplates()}
            />

            {/* Campaign Modal */}
            <Modal
                opened={campaignModalOpened}
                onClose={closeCampaignModal}
                title={editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
                size="xl"
            >
                <Stack gap="md">
                    <Stepper active={campaignStep} onStepClick={setCampaignStep} size="sm">
                        <Stepper.Step label="Básico" description="Nome e descrição" />
                        <Stepper.Step label="Filtros" description="Público-alvo" />
                        <Stepper.Step label="Anti-Ban" description="Proteção" />
                        <Stepper.Step label="Templates" description="Mensagens" />
                        <Stepper.Step label="Agendamento" description="Quando enviar" />
                    </Stepper>

                    {/* Step 0: Basic Info */}
                    {campaignStep === 0 && (
                        <Stack gap="md">
                            <TextInput
                                label="Nome da Campanha"
                                placeholder="Ex: Black Friday 2024"
                                value={campaignForm.name}
                                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                                required
                            />
                            <TextInput
                                label="Descrição (opcional)"
                                placeholder="Descreva o objetivo desta campanha"
                                value={campaignForm.description}
                                onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                            />
                        </Stack>
                    )}

                    {/* Step 1: Contact Filters */}
                    {campaignStep === 1 && (
                        <Stack gap="md">
                            <Alert color="blue" variant="light">
                                <Text size="sm">
                                    <strong>{matchingContacts}</strong> contato(s) correspondem aos filtros selecionados
                                </Text>
                            </Alert>

                            <MultiSelect
                                label="Status do Contato"
                                placeholder="Todos os status"
                                data={[
                                    { value: 'active', label: 'Ativo' },
                                    { value: 'inactive', label: 'Inativo' },
                                ]}
                                value={campaignForm.status_filter}
                                onChange={(v) => setCampaignForm({ ...campaignForm, status_filter: v })}
                            />

                            <MultiSelect
                                label="Tipo de Contato"
                                placeholder="Todos os tipos"
                                data={[
                                    { value: 'lead', label: 'Lead' },
                                    { value: 'customer', label: 'Cliente' },
                                    { value: 'supplier', label: 'Fornecedor' },
                                    { value: 'partner', label: 'Parceiro' },
                                ]}
                                value={campaignForm.type_filter}
                                onChange={(v) => setCampaignForm({ ...campaignForm, type_filter: v })}
                            />

                            <MultiSelect
                                label="Com Etiquetas"
                                placeholder="Qualquer etiqueta"
                                data={tags?.map(t => ({ value: t.name, label: t.name })) || []}
                                value={campaignForm.tags_filter}
                                onChange={(v) => setCampaignForm({ ...campaignForm, tags_filter: v })}
                            />

                            <MultiSelect
                                label="Excluir Etiquetas"
                                placeholder="Nenhuma exclusão"
                                data={tags?.map(t => ({ value: t.name, label: t.name })) || []}
                                value={campaignForm.exclude_tags}
                                onChange={(v) => setCampaignForm({ ...campaignForm, exclude_tags: v })}
                            />
                        </Stack>
                    )}

                    {/* Step 2: Anti-Ban Settings */}
                    {campaignStep === 2 && (
                        <Stack gap="md">
                            <Alert color="yellow" variant="light" title="Proteção Anti-Banimento">
                                <Text size="sm">
                                    Configure os parâmetros para evitar bloqueios do WhatsApp.
                                    Recomendamos valores conservadores para contas novas.
                                </Text>
                            </Alert>

                            <NumberInput
                                label="Volume Máximo Diário"
                                description="Número máximo de mensagens por dia"
                                value={campaignForm.max_daily_volume}
                                onChange={(v) => setCampaignForm({ ...campaignForm, max_daily_volume: typeof v === 'number' ? v : 200 })}
                                min={10}
                                max={1000}
                            />

                            <Group grow>
                                <NumberInput
                                    label="Intervalo Mínimo (seg)"
                                    value={campaignForm.min_interval_seconds}
                                    onChange={(v) => setCampaignForm({ ...campaignForm, min_interval_seconds: typeof v === 'number' ? v : 30 })}
                                    min={5}
                                    max={300}
                                />
                                <NumberInput
                                    label="Intervalo Máximo (seg)"
                                    value={campaignForm.max_interval_seconds}
                                    onChange={(v) => setCampaignForm({ ...campaignForm, max_interval_seconds: typeof v === 'number' ? v : 120 })}
                                    min={10}
                                    max={600}
                                />
                            </Group>

                            <Checkbox
                                label="Usar intervalos aleatórios entre mensagens"
                                checked={campaignForm.use_random_intervals}
                                onChange={(e) => setCampaignForm({ ...campaignForm, use_random_intervals: e.currentTarget.checked })}
                            />

                            <Group grow>
                                <NumberInput
                                    label="Tamanho do Lote"
                                    description="Mensagens por ciclo"
                                    value={campaignForm.batch_size}
                                    onChange={(v) => setCampaignForm({ ...campaignForm, batch_size: typeof v === 'number' ? v : 10 })}
                                    min={1}
                                    max={50}
                                />
                                <NumberInput
                                    label="Pausa entre Lotes (min)"
                                    description="Descanso entre ciclos"
                                    value={campaignForm.batch_pause_minutes}
                                    onChange={(v) => setCampaignForm({ ...campaignForm, batch_pause_minutes: typeof v === 'number' ? v : 15 })}
                                    min={1}
                                    max={120}
                                />
                            </Group>
                        </Stack>
                    )}

                    {/* Step 3: Template Selection */}
                    {campaignStep === 3 && (
                        <Stack gap="md">
                            <Text size="sm" c="dimmed">
                                Selecione até 5 templates para distribuição aleatória
                            </Text>

                            {templates?.length === 0 ? (
                                <Alert color="yellow">
                                    <Text size="sm">
                                        Nenhum template disponível. Crie um template primeiro.
                                    </Text>
                                    <Button
                                        size="sm"
                                        mt="sm"
                                        onClick={() => {
                                            closeCampaignModal()
                                            handleOpenCreateTemplate()
                                        }}
                                    >
                                        Criar Template
                                    </Button>
                                </Alert>
                            ) : (
                                <ScrollArea h={300}>
                                    <Stack gap="xs">
                                        {templates?.map(template => (
                                            <Paper
                                                key={template.id}
                                                withBorder
                                                p="sm"
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: campaignForm.selected_templates.includes(template.id)
                                                        ? 'var(--mantine-color-blue-6)'
                                                        : undefined,
                                                    backgroundColor: campaignForm.selected_templates.includes(template.id)
                                                        ? 'var(--mantine-color-blue-light)'
                                                        : undefined,
                                                }}
                                                onClick={() => {
                                                    const selected = [...campaignForm.selected_templates]
                                                    const idx = selected.indexOf(template.id)
                                                    if (idx >= 0) {
                                                        selected.splice(idx, 1)
                                                    } else if (selected.length < 5) {
                                                        selected.push(template.id)
                                                    } else {
                                                        notifications.show({ title: 'Limite atingido', message: 'Máximo de 5 templates', color: 'yellow' })
                                                        return
                                                    }
                                                    setCampaignForm({ ...campaignForm, selected_templates: selected })
                                                }}
                                            >
                                                <Group justify="space-between">
                                                    <div>
                                                        <Text fw={500}>{template.name}</Text>
                                                        {template.description && (
                                                            <Text size="xs" c="dimmed">{template.description}</Text>
                                                        )}
                                                    </div>
                                                    {campaignForm.selected_templates.includes(template.id) && (
                                                        <ThemeIcon color="blue" variant="filled" size="sm">
                                                            <IconCheck size={12} />
                                                        </ThemeIcon>
                                                    )}
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </ScrollArea>
                            )}

                            <Text size="sm" c="dimmed">
                                {campaignForm.selected_templates.length} de 5 templates selecionados
                            </Text>
                        </Stack>
                    )}

                    {/* Step 4: Scheduling */}
                    {campaignStep === 4 && (
                        <Stack gap="md">
                            <DateTimePicker
                                label="Data e Hora de Início"
                                placeholder="Selecione quando iniciar"
                                value={campaignForm.scheduled_at}
                                onChange={(v) => setCampaignForm({ ...campaignForm, scheduled_at: v })}
                                minDate={new Date()}
                            />

                            <MultiSelect
                                label="Dias da Semana"
                                description="Em quais dias a campanha pode enviar mensagens"
                                data={DAYS_OF_WEEK}
                                value={campaignForm.schedule_days}
                                onChange={(v) => setCampaignForm({ ...campaignForm, schedule_days: v })}
                            />

                            <Group grow>
                                <NumberInput
                                    label="Horário de Início"
                                    description="Hora do dia para começar"
                                    value={campaignForm.schedule_start_hour}
                                    onChange={(v) => setCampaignForm({ ...campaignForm, schedule_start_hour: typeof v === 'number' ? v : 9 })}
                                    min={0}
                                    max={23}
                                    suffix="h"
                                />
                                <NumberInput
                                    label="Horário de Término"
                                    description="Hora do dia para parar"
                                    value={campaignForm.schedule_end_hour}
                                    onChange={(v) => setCampaignForm({ ...campaignForm, schedule_end_hour: typeof v === 'number' ? v : 18 })}
                                    min={0}
                                    max={23}
                                    suffix="h"
                                />
                            </Group>

                            <Select
                                label="Conexão WhatsApp"
                                placeholder="Selecione a instância"
                                data={[
                                    { value: 'default', label: 'Instância Padrão' },
                                ]}
                                value={campaignForm.connection_id}
                                onChange={(v) => setCampaignForm({ ...campaignForm, connection_id: v || '' })}
                            />
                        </Stack>
                    )}

                    {/* Navigation */}
                    <Group justify="space-between" mt="md">
                        <Button
                            variant="default"
                            onClick={() => campaignStep > 0 ? setCampaignStep(campaignStep - 1) : closeCampaignModal()}
                        >
                            {campaignStep > 0 ? 'Voltar' : 'Cancelar'}
                        </Button>
                        {campaignStep < 4 ? (
                            <Button onClick={() => setCampaignStep(campaignStep + 1)}>
                                Próximo
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSaveCampaign}
                                loading={createCampaign.isPending || updateCampaign.isPending}
                            >
                                {editingCampaign ? 'Salvar' : 'Criar Campanha'}
                            </Button>
                        )}
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    )
}
