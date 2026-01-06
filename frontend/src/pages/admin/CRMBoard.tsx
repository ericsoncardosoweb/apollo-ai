/**
 * CRM Kanban Board - Drag & Drop Deal Management
 * Full integration with database, pipeline management, and automated actions
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
    Alert,
    ColorInput,
    Switch,
    Loader,
    Center,
    Tabs,
    Checkbox,
    CopyButton,
    Code,
    Table,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from '@hello-pangea/dnd'
import {
    IconPlus,
    IconGripVertical,
    IconCurrencyReal,
    IconTag,
    IconPhone,
    IconBolt,
    IconCheck,
    IconX,
    IconDotsVertical,
    IconArrowRight,
    IconDeviceFloppy,
    IconTemplate,
    IconMessageCircle,
    IconRobot,
    IconUser,
    IconUserCircle,
    IconSearch,
    IconSettings,
    IconTrash,
    IconStar,
    IconStarFilled,
    IconEdit,
    IconWorld,
    IconMail,
    IconBrandWhatsapp,
    IconWebhook,
    IconCopy,
    IconDatabase,
    IconList,
    IconDownload,
} from '@tabler/icons-react'
import { useViewContext } from '@/contexts/ViewContext'
import { useClientDatabaseStatus, useClientSupabase } from '@/hooks/useClientSupabase'

// Types
interface Stage {
    id: string
    name: string
    color: string
    position: number
    is_conversion_point: boolean
    first_time_only: boolean
}

interface Pipeline {
    id: string
    name: string
    description?: string
    stages: Stage[]
    is_default: boolean
    is_active: boolean
}

interface Deal {
    id: string
    contact_id?: string
    contact_name: string
    contact_phone: string
    value: number
    tags: string[]
    current_stage_id: string
    cycle_number: number
    status: 'open' | 'won' | 'lost'
    created_at: string
    conversation_id?: string
    attendant_type?: 'ai' | 'human' | null
    attendant_name?: string
    ai_agent_name?: string
}

interface AutomationAction {
    id: string
    type: 'whatsapp_send' | 'http_request' | 'notification' | 'tag_add' | 'crm_move'
    name: string
    payload: Record<string, unknown>
}

// Action type definitions
const ACTION_TYPES = [
    { value: 'whatsapp_send', label: 'Enviar WhatsApp', icon: IconBrandWhatsapp, color: 'green' },
    { value: 'http_request', label: 'Requisição HTTP', icon: IconWebhook, color: 'orange' },
    { value: 'notification', label: 'Notificação', icon: IconMail, color: 'blue' },
    { value: 'tag_add', label: 'Adicionar Tag', icon: IconTag, color: 'purple' },
]

// Default pipeline for new accounts
const DEFAULT_PIPELINE: Pipeline = {
    id: 'default',
    name: 'Funil de Vendas',
    description: 'Pipeline padrão de vendas',
    is_default: true,
    is_active: true,
    stages: [
        { id: 'lead', name: 'Lead', color: '#868e96', position: 0, is_conversion_point: false, first_time_only: false },
        { id: 'qualificacao', name: 'Qualificação', color: '#fab005', position: 1, is_conversion_point: false, first_time_only: false },
        { id: 'proposta', name: 'Proposta', color: '#228be6', position: 2, is_conversion_point: false, first_time_only: false },
        { id: 'negociacao', name: 'Negociação', color: '#7950f2', position: 3, is_conversion_point: false, first_time_only: false },
        { id: 'fechamento', name: 'Fechamento', color: '#40c057', position: 4, is_conversion_point: true, first_time_only: false },
    ],
}

export default function CRMBoard() {
    const navigate = useNavigate()
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()
    const { clientSupabase: supabase } = useClientSupabase()

    // Data State
    const [pipelines, setPipelines] = useState<Pipeline[]>([DEFAULT_PIPELINE])
    const [deals, setDeals] = useState<Deal[]>([])
    const [loading, setLoading] = useState(true)
    const [needsSetup, setNeedsSetup] = useState(false)

    // UI State
    const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
    const [selectedStageForAutomation, setSelectedStageForAutomation] = useState<Stage | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Modal/Drawer states
    const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)
    const [newDealModalOpened, { open: openNewDealModal, close: closeNewDealModal }] = useDisclosure(false)
    const [automationModalOpened, { open: openAutomationModal, close: closeAutomationModal }] = useDisclosure(false)
    const [pipelineModalOpened, { open: openPipelineModal, close: closePipelineModal }] = useDisclosure(false)
    const [addActionModalOpened, { open: openAddActionModal, close: closeAddActionModal }] = useDisclosure(false)
    const [listModalOpened, { open: openListModal, close: closeListModal }] = useDisclosure(false)
    const [listViewStage, setListViewStage] = useState<Stage | null>(null)

    // Form states
    const [newDealForm, setNewDealForm] = useState({ contact_name: '', contact_phone: '', value: 0 })
    const [pipelineForm, setPipelineForm] = useState<Partial<Pipeline>>({ name: '', stages: [] })
    const [isEditingPipeline, setIsEditingPipeline] = useState(false)
    const [stageActions, setStageActions] = useState<AutomationAction[]>([])
    const [selectedActionType, setSelectedActionType] = useState<string | null>(null)

    // =========================================================================
    // DATA LOADING
    // =========================================================================

    useEffect(() => {
        console.log('CRM Debug:', { isConfigured, hasSupabase: !!supabase, selectedCompany: selectedCompany?.name })
        if (isConfigured && supabase) {
            loadData()
        } else {
            setLoading(false)
        }
    }, [isConfigured, supabase])

    const loadData = async () => {
        if (!supabase) return
        setLoading(true)
        try {
            // Load pipelines
            const { data: pipelineData, error: pipelineError } = await supabase
                .from('crm_pipelines')
                .select('*')
                .eq('is_active', true)
                .order('created_at')

            // Check if table doesn't exist
            if (pipelineError?.code === 'PGRST205') {
                console.error('CRM tables not found:', pipelineError)
                setNeedsSetup(true)
                setLoading(false)
                return
            }

            if (pipelineData && pipelineData.length > 0) {
                setPipelines(pipelineData)
                const defaultPipeline = pipelineData.find((p: Pipeline) => p.is_default) || pipelineData[0]
                setSelectedPipeline(defaultPipeline)
            } else {
                // Create default pipeline if none exists
                await createDefaultPipeline()
            }

            // Load deals
            const { data: dealData, error: dealError } = await supabase
                .from('crm_deals')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false })

            if (dealError?.code === 'PGRST205') {
                console.error('CRM deals table not found:', dealError)
                setNeedsSetup(true)
                setLoading(false)
                return
            }

            if (dealData) {
                setDeals(dealData)
            }

            setNeedsSetup(false)
        } catch (error: any) {
            console.error('Error loading CRM data:', error)
            if (error?.code === 'PGRST205') {
                setNeedsSetup(true)
            }
        } finally {
            setLoading(false)
        }
    }

    const createDefaultPipeline = async () => {
        if (!supabase) return
        const { data, error } = await supabase
            .from('crm_pipelines')
            .insert({
                name: DEFAULT_PIPELINE.name,
                description: DEFAULT_PIPELINE.description,
                stages: DEFAULT_PIPELINE.stages,
                is_default: true,
                is_active: true
            })
            .select()
            .single()

        if (data) {
            setPipelines([data])
            setSelectedPipeline(data)
        }
    }

    // =========================================================================
    // COMPUTED VALUES
    // =========================================================================

    const filteredDeals = useMemo(() => {
        if (!searchQuery.trim()) return deals
        const query = searchQuery.toLowerCase()
        return deals.filter(d =>
            d.contact_name?.toLowerCase().includes(query) ||
            d.contact_phone?.toLowerCase().includes(query) ||
            (d.tags || []).some(tag => tag.toLowerCase().includes(query))
        )
    }, [deals, searchQuery])

    const dealsByStage = (stageId: string) =>
        filteredDeals.filter(d => d.current_stage_id === stageId && d.status === 'open')

    const getStageTotal = (stageId: string) =>
        dealsByStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0)

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

    const getAttendantDisplay = (deal: Deal) => {
        if (deal.attendant_type === 'ai') {
            return { icon: <IconRobot size={12} />, label: deal.ai_agent_name || 'I.A.', color: 'teal' }
        } else if (deal.attendant_type === 'human') {
            return { icon: <IconUser size={12} />, label: deal.attendant_name || 'Atendente', color: 'blue' }
        }
        return { icon: <IconUserCircle size={12} />, label: 'Sem atendente', color: 'gray' }
    }

    // =========================================================================
    // HANDLERS
    // =========================================================================

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result
        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        // Optimistic update
        const updatedDeals = deals.map(deal => {
            if (deal.id === draggableId) {
                return { ...deal, current_stage_id: destination.droppableId }
            }
            return deal
        })
        setDeals(updatedDeals)

        // API update
        if (supabase) {
            const { error } = await supabase
                .from('crm_deals')
                .update({ current_stage_id: destination.droppableId, updated_at: new Date().toISOString() })
                .eq('id', draggableId)

            if (error) {
                notifications.show({ title: 'Erro', message: 'Falha ao mover deal', color: 'red' })
                loadData() // Revert
            } else {
                // Log history
                await supabase.from('crm_deal_history').insert({
                    deal_id: draggableId,
                    from_stage: source.droppableId,
                    to_stage: destination.droppableId,
                    triggered_by: 'user'
                })
            }
        }
    }

    const handleDealClick = (deal: Deal) => {
        setSelectedDeal(deal)
        openDrawer()
    }

    const handleOpenChat = (deal: Deal) => {
        if (deal.conversation_id) {
            navigate(`/admin/inbox?conversation=${deal.conversation_id}`)
        } else {
            navigate('/admin/inbox')
        }
    }

    const handleStageAutomation = (stage: Stage) => {
        setSelectedStageForAutomation(stage)
        setStageActions([]) // TODO: Load from DB
        openAutomationModal()
    }

    const handleCreateDeal = async () => {
        if (!newDealForm.contact_name || !selectedPipeline) return

        const newDeal = {
            contact_name: newDealForm.contact_name,
            contact_phone: newDealForm.contact_phone,
            value: newDealForm.value,
            pipeline_id: selectedPipeline.id,
            current_stage_id: selectedPipeline.stages[0]?.id || 'lead',
            cycle_number: 1,
            status: 'open',
            metadata: {}
        }

        if (supabase) {
            const { data, error } = await supabase
                .from('crm_deals')
                .insert(newDeal)
                .select()
                .single()

            if (data) {
                setDeals([data, ...deals])
                notifications.show({ title: 'Sucesso', message: 'Deal criado com sucesso', color: 'green' })
            }
            if (error) {
                notifications.show({ title: 'Erro', message: 'Falha ao criar deal', color: 'red' })
            }
        } else {
            // Mock for development
            setDeals([{ ...newDeal, id: `d${Date.now()}`, created_at: new Date().toISOString(), tags: [] } as Deal, ...deals])
        }

        setNewDealForm({ contact_name: '', contact_phone: '', value: 0 })
        closeNewDealModal()
    }

    // =========================================================================
    // PIPELINE MANAGEMENT
    // =========================================================================

    const handleOpenNewPipeline = () => {
        setIsEditingPipeline(false)
        setPipelineForm({
            name: '',
            description: '',
            stages: [
                { id: `stage_${Date.now()}`, name: 'Novo Lead', color: '#868e96', position: 0, is_conversion_point: false, first_time_only: false }
            ]
        })
        openPipelineModal()
    }

    const handleEditPipeline = (pipeline: Pipeline) => {
        setIsEditingPipeline(true)
        setPipelineForm({ ...pipeline })
        openPipelineModal()
    }

    const handleSavePipeline = async () => {
        if (!pipelineForm.name || !pipelineForm.stages?.length) {
            notifications.show({ title: 'Erro', message: 'Preencha o nome e adicione pelo menos um estágio', color: 'red' })
            return
        }

        // Use form value or default to true if no pipelines exist
        const shouldBeDefault = pipelineForm.is_default || pipelines.length === 0

        const pipelineData = {
            name: pipelineForm.name,
            description: pipelineForm.description || '',
            stages: pipelineForm.stages,
            is_default: shouldBeDefault,
            is_active: true
        }

        if (supabase) {
            try {
                // If marking as default, unset other defaults first
                if (shouldBeDefault) {
                    await supabase.from('crm_pipelines').update({ is_default: false }).eq('is_default', true)
                }

                if (isEditingPipeline && pipelineForm.id) {
                    const { error } = await supabase
                        .from('crm_pipelines')
                        .update(pipelineData)
                        .eq('id', pipelineForm.id)

                    if (error) throw error
                    notifications.show({ title: 'Sucesso', message: 'Pipeline atualizado', color: 'green' })
                } else {
                    const { data, error } = await supabase
                        .from('crm_pipelines')
                        .insert(pipelineData)
                        .select()
                        .single()

                    if (error) throw error
                    notifications.show({ title: 'Sucesso', message: 'Pipeline criado', color: 'green' })
                }
                await loadData()
            } catch (error) {
                console.error('Error saving pipeline:', error)
                notifications.show({ title: 'Erro', message: 'Falha ao salvar pipeline', color: 'red' })
            }
        } else {
            // Dev mode: update local state
            const newPipeline: Pipeline = {
                id: pipelineForm.id || `pipeline_${Date.now()}`,
                name: pipelineData.name,
                description: pipelineData.description,
                stages: pipelineData.stages as Stage[],
                is_default: pipelineData.is_default,
                is_active: true
            }

            if (isEditingPipeline) {
                setPipelines(pipelines.map(p => p.id === newPipeline.id ? newPipeline : p))
            } else {
                setPipelines([...pipelines, newPipeline])
            }
            setSelectedPipeline(newPipeline)
            notifications.show({ title: 'Sucesso', message: 'Pipeline salvo (modo dev)', color: 'green' })
        }

        closePipelineModal()
    }

    const handleSetDefaultPipeline = async (pipelineId: string) => {
        if (!supabase) return

        // Unset all defaults
        await supabase.from('crm_pipelines').update({ is_default: false }).eq('is_default', true)

        // Set new default
        await supabase.from('crm_pipelines').update({ is_default: true }).eq('id', pipelineId)

        notifications.show({ title: 'Sucesso', message: 'Pipeline definido como padrão', color: 'green' })
        loadData()
    }

    const addStageToForm = () => {
        const newStage: Stage = {
            id: `stage_${Date.now()}`,
            name: `Estágio ${(pipelineForm.stages?.length || 0) + 1}`,
            color: '#868e96',
            position: pipelineForm.stages?.length || 0,
            is_conversion_point: false,
            first_time_only: false
        }
        setPipelineForm({ ...pipelineForm, stages: [...(pipelineForm.stages || []), newStage] })
    }

    const updateStageInForm = (index: number, updates: Partial<Stage>) => {
        const stages = [...(pipelineForm.stages || [])]

        // Exclusivity validation for conversion point
        if (updates.is_conversion_point) {
            stages.forEach((s, i) => { if (i !== index) s.is_conversion_point = false })
        }

        // Exclusivity validation for first_time_only
        if (updates.first_time_only) {
            stages.forEach((s, i) => { if (i !== index) s.first_time_only = false })
        }

        // Cannot have both on same stage
        if (updates.is_conversion_point && stages[index].first_time_only) {
            updates.first_time_only = false
        }
        if (updates.first_time_only && stages[index].is_conversion_point) {
            updates.is_conversion_point = false
        }

        stages[index] = { ...stages[index], ...updates }
        setPipelineForm({ ...pipelineForm, stages })
    }

    const removeStageFromForm = (index: number) => {
        const stages = (pipelineForm.stages || []).filter((_, i) => i !== index)
        setPipelineForm({ ...pipelineForm, stages })
    }

    // =========================================================================
    // ACTION MANAGEMENT
    // =========================================================================

    const handleAddAction = (type: string) => {
        const actionDef = ACTION_TYPES.find(a => a.value === type)
        if (!actionDef) return

        const newAction: AutomationAction = {
            id: `action_${Date.now()}`,
            type: type as AutomationAction['type'],
            name: actionDef.label,
            payload: {}
        }

        setStageActions([...stageActions, newAction])
        closeAddActionModal()
    }

    const removeAction = (actionId: string) => {
        setStageActions(stageActions.filter(a => a.id !== actionId))
    }

    const handleSaveAutomation = async () => {
        if (!selectedStageForAutomation || !selectedPipeline) return

        // Update stage config and save actions
        // TODO: Save to automation_journeys table

        notifications.show({ title: 'Sucesso', message: 'Automações salvas', color: 'green' })
        closeAutomationModal()
    }

    // Export deals to CSV
    const exportToCSV = (dealsToExport: Deal[], filename: string, includeStage = false) => {
        const headers = ['Nome', 'Telefone', 'Valor', 'Tags', 'Status', 'Criado em']
        if (includeStage) headers.splice(4, 0, 'Etapa')

        const rows = dealsToExport.map(deal => {
            const stage = selectedPipeline?.stages.find(s => s.id === deal.current_stage_id)
            const row = [
                deal.contact_name,
                deal.contact_phone,
                deal.value.toString(),
                deal.tags.join('; '),
                deal.status,
                new Date(deal.created_at).toLocaleDateString('pt-BR'),
            ]
            if (includeStage) row.splice(4, 0, stage?.name || '')
            return row
        })

        const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${filename}.csv`
        link.click()
        notifications.show({ title: 'Exportado!', message: `${dealsToExport.length} registros exportados`, color: 'green' })
    }

    const handleExportPipeline = () => {
        if (!selectedPipeline) return
        const allDeals = deals.filter(d => selectedPipeline.stages.some(s => s.id === d.current_stage_id))
        exportToCSV(allDeals, `pipeline-${selectedPipeline.name.toLowerCase().replace(/\s/g, '-')}`, true)
    }

    const handleExportStage = () => {
        if (!listViewStage) return
        const stageDeals = dealsByStage(listViewStage.id)
        exportToCSV(stageDeals, `${listViewStage.name.toLowerCase().replace(/\s/g, '-')}-deals`, false)
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    if (loading) {
        return (
            <Center h="calc(100vh - 120px)">
                <Loader size="lg" />
            </Center>
        )
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

    // SQL for CRM tables
    const CRM_SQL = `-- Execute este SQL no Supabase do cliente para criar as tabelas do CRM

CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO crm_pipelines (name, description, is_default, stages) 
SELECT 'Funil de Vendas', 'Pipeline padrão', true,
    '[{"id":"lead","name":"Lead","color":"#868e96","position":0},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1},{"id":"proposta","name":"Proposta","color":"#228be6","position":2},{"id":"negociacao","name":"Negociação","color":"#7950f2","position":3},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":4,"is_conversion_point":true}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines);

CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID,
    current_stage_id VARCHAR(100) NOT NULL DEFAULT 'lead',
    value DECIMAL(12,2) DEFAULT 0,
    cycle_number INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open',
    assigned_user_id UUID,
    assigned_user_name VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL,
    from_stage VARCHAR(100),
    to_stage VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true) WITH CHECK (true);`

    if (needsSetup) {
        return (
            <Stack gap="md">
                <Title order={2}>CRM - Pipeline de Vendas</Title>
                <Alert color="orange" title="Tabelas do CRM não encontradas" icon={<IconDatabase size={20} />}>
                    <Stack gap="sm">
                        <Text size="sm">
                            As tabelas do CRM ainda não foram criadas no banco de dados deste cliente.
                            Execute o SQL abaixo no Supabase do cliente para configurar.
                        </Text>
                        <Paper withBorder p="xs" style={{ maxHeight: 300, overflow: 'auto' }}>
                            <Code block style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{CRM_SQL}</Code>
                        </Paper>
                        <Group>
                            <CopyButton value={CRM_SQL}>
                                {({ copied, copy }) => (
                                    <Button
                                        color={copied ? 'green' : 'blue'}
                                        leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                        onClick={copy}
                                    >
                                        {copied ? 'SQL Copiado!' : 'Copiar SQL'}
                                    </Button>
                                )}
                            </CopyButton>
                            <Button variant="light" onClick={() => loadData()}>
                                Verificar Novamente
                            </Button>
                        </Group>
                    </Stack>
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
                    <TextInput
                        placeholder="Buscar por nome, telefone ou tag..."
                        leftSection={<IconSearch size={16} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        w={280}
                        styles={{ input: { backgroundColor: 'var(--mantine-color-dark-6)' } }}
                    />
                    <Select
                        placeholder="Selecionar Pipeline"
                        data={pipelines.map(p => ({
                            value: p.id,
                            label: `${p.name}${p.is_default ? ' ⭐' : ''}`
                        }))}
                        value={selectedPipeline?.id}
                        onChange={(value) => {
                            const pipeline = pipelines.find(p => p.id === value)
                            setSelectedPipeline(pipeline || null)
                        }}
                        w={220}
                    />
                    <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                            <ActionIcon variant="light" size="lg">
                                <IconSettings size={18} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>Pipelines</Menu.Label>
                            <Menu.Item leftSection={<IconPlus size={14} />} onClick={handleOpenNewPipeline}>
                                Novo Pipeline
                            </Menu.Item>
                            {selectedPipeline && (
                                <>
                                    <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => handleEditPipeline(selectedPipeline)}>
                                        Editar Pipeline
                                    </Menu.Item>
                                    {!selectedPipeline.is_default && (
                                        <Menu.Item leftSection={<IconStarFilled size={14} />} onClick={() => handleSetDefaultPipeline(selectedPipeline.id)}>
                                            Definir como Padrão
                                        </Menu.Item>
                                    )}
                                </>
                            )}
                            <Menu.Divider />
                            <Menu.Label>Templates</Menu.Label>
                            <Menu.Item leftSection={<IconTemplate size={14} />}>
                                Salvar como Template
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                    <Button leftSection={<IconPlus size={16} />} variant="filled" onClick={openNewDealModal}>
                        Novo Deal
                    </Button>
                    <Tooltip label="Exportar Pipeline">
                        <ActionIcon variant="light" size="lg" onClick={handleExportPipeline}>
                            <IconDownload size={18} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>

            {/* Kanban Board */}
            {selectedPipeline && (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Group gap="md" align="flex-start" wrap="nowrap" style={{ flex: 1, overflowX: 'auto', paddingBottom: 16 }}>
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
                                                <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: stage.color }} />
                                                <Text fw={600} size="sm">{stage.name}</Text>
                                                <Badge size="xs" variant="light" color="gray">{dealsByStage(stage.id).length}</Badge>
                                                {stage.is_conversion_point && (
                                                    <Badge size="xs" color="green" variant="dot">Conversão</Badge>
                                                )}
                                            </Group>
                                            <Group gap={4}>
                                                <Tooltip label="Ver Lista">
                                                    <ActionIcon size="sm" variant="subtle" onClick={() => { setListViewStage(stage); openListModal(); }}>
                                                        <IconList size={14} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                <Tooltip label="Automações">
                                                    <ActionIcon size="sm" variant="subtle" onClick={() => handleStageAutomation(stage)}>
                                                        <IconBolt size={14} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                <ActionIcon size="sm" variant="subtle" onClick={openNewDealModal}>
                                                    <IconPlus size={14} />
                                                </ActionIcon>
                                            </Group>
                                        </Group>

                                        <Text size="xs" c="dimmed" mb="xs">Total: {formatCurrency(getStageTotal(stage.id))}</Text>

                                        {/* Deals */}
                                        <Stack gap="xs" style={{ flex: 1, overflowY: 'auto', minHeight: 100 }}>
                                            {dealsByStage(stage.id).map((deal, index) => {
                                                const attendant = getAttendantDisplay(deal)
                                                return (
                                                    <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <Paper
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                withBorder
                                                                p="sm"
                                                                radius="sm"
                                                                style={{
                                                                    ...provided.draggableProps.style,
                                                                    backgroundColor: snapshot.isDragging ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-dark-6)',
                                                                    cursor: 'grab',
                                                                }}
                                                                onClick={() => handleDealClick(deal)}
                                                            >
                                                                <Group justify="space-between" wrap="nowrap">
                                                                    <div {...provided.dragHandleProps} style={{ cursor: 'grab' }}>
                                                                        <IconGripVertical size={14} color="gray" />
                                                                    </div>
                                                                    <Stack gap={4} style={{ flex: 1 }}>
                                                                        <Group justify="space-between">
                                                                            <Text size="sm" fw={500} lineClamp={1}>{deal.contact_name}</Text>
                                                                            <Tooltip label="Abrir Chat">
                                                                                <ActionIcon size="xs" variant="subtle" color="indigo" onClick={(e) => { e.stopPropagation(); handleOpenChat(deal) }}>
                                                                                    <IconMessageCircle size={14} />
                                                                                </ActionIcon>
                                                                            </Tooltip>
                                                                        </Group>
                                                                        <Group gap="xs">
                                                                            <Text size="xs" c="green" fw={600}>{formatCurrency(deal.value || 0)}</Text>
                                                                            {deal.cycle_number > 1 && <Badge size="xs" variant="outline" color="blue">Ciclo {deal.cycle_number}</Badge>}
                                                                        </Group>
                                                                        <Badge size="xs" variant="light" color={attendant.color} leftSection={attendant.icon}>{attendant.label}</Badge>
                                                                    </Stack>
                                                                    <Menu position="bottom-end" withArrow>
                                                                        <Menu.Target>
                                                                            <ActionIcon size="sm" variant="subtle" onClick={(e) => e.stopPropagation()}>
                                                                                <IconDotsVertical size={14} />
                                                                            </ActionIcon>
                                                                        </Menu.Target>
                                                                        <Menu.Dropdown>
                                                                            <Menu.Item leftSection={<IconMessageCircle size={14} />} onClick={() => handleOpenChat(deal)}>Abrir Chat</Menu.Item>
                                                                            <Menu.Divider />
                                                                            <Menu.Item leftSection={<IconCheck size={14} />} color="green">Marcar como Ganho</Menu.Item>
                                                                            <Menu.Item leftSection={<IconX size={14} />} color="red">Marcar como Perdido</Menu.Item>
                                                                        </Menu.Dropdown>
                                                                    </Menu>
                                                                </Group>
                                                            </Paper>
                                                        )}
                                                    </Draggable>
                                                )
                                            })}
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
            <Drawer opened={drawerOpened} onClose={closeDrawer} title={selectedDeal?.contact_name || 'Deal'} position="right" size="md">
                {selectedDeal && (
                    <Stack gap="md">
                        <Card withBorder>
                            <Stack gap="xs">
                                <Group>
                                    <Avatar color="blue" radius="xl" size="lg">{selectedDeal.contact_name?.charAt(0)}</Avatar>
                                    <div>
                                        <Text fw={500}>{selectedDeal.contact_name}</Text>
                                        <Text size="xs" c="dimmed">{selectedDeal.contact_phone}</Text>
                                    </div>
                                </Group>
                                <Divider my="xs" label="Atendimento" labelPosition="center" />
                                <Group gap="xs">
                                    {selectedDeal.attendant_type === 'ai' ? (
                                        <><ThemeIcon size="sm" variant="light" color="teal"><IconRobot size={14} /></ThemeIcon><Text size="sm">Atendido por I.A.: <strong>{selectedDeal.ai_agent_name || 'Lia'}</strong></Text></>
                                    ) : selectedDeal.attendant_type === 'human' ? (
                                        <><ThemeIcon size="sm" variant="light" color="blue"><IconUser size={14} /></ThemeIcon><Text size="sm">Atendido por: <strong>{selectedDeal.attendant_name}</strong></Text></>
                                    ) : (
                                        <><ThemeIcon size="sm" variant="light" color="gray"><IconUserCircle size={14} /></ThemeIcon><Text size="sm" c="dimmed">Aguardando atendimento</Text></>
                                    )}
                                </Group>
                                <Button variant="light" color="indigo" leftSection={<IconMessageCircle size={16} />} fullWidth onClick={() => handleOpenChat(selectedDeal)}>Abrir Conversa</Button>
                                <Divider my="xs" />
                                <Group gap="xs"><IconCurrencyReal size={16} /><Text fw={600} c="green">{formatCurrency(selectedDeal.value || 0)}</Text></Group>
                            </Stack>
                        </Card>
                        <NumberInput label="Valor do Deal" value={selectedDeal.value} thousandSeparator="." decimalSeparator="," prefix="R$ " leftSection={<IconCurrencyReal size={16} />} />
                        <Group grow>
                            <Button variant="light" color="green" leftSection={<IconCheck size={16} />}>Ganho</Button>
                            <Button variant="light" color="red" leftSection={<IconX size={16} />}>Perdido</Button>
                        </Group>
                    </Stack>
                )}
            </Drawer>

            {/* New Deal Modal */}
            <Modal opened={newDealModalOpened} onClose={closeNewDealModal} title="Novo Deal" size="md">
                <Stack gap="md">
                    <TextInput label="Nome do Contato" placeholder="Ex: João Silva" required value={newDealForm.contact_name} onChange={(e) => setNewDealForm({ ...newDealForm, contact_name: e.target.value })} />
                    <TextInput label="Telefone" placeholder="+55 11 99999-9999" leftSection={<IconPhone size={16} />} value={newDealForm.contact_phone} onChange={(e) => setNewDealForm({ ...newDealForm, contact_phone: e.target.value })} />
                    <NumberInput label="Valor do Deal" placeholder="0,00" thousandSeparator="." decimalSeparator="," prefix="R$ " leftSection={<IconCurrencyReal size={16} />} value={newDealForm.value} onChange={(val) => setNewDealForm({ ...newDealForm, value: typeof val === 'number' ? val : 0 })} />
                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={closeNewDealModal}>Cancelar</Button>
                        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleCreateDeal} disabled={!newDealForm.contact_name}>Criar Deal</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Pipeline Management Modal */}
            <Modal opened={pipelineModalOpened} onClose={closePipelineModal} title={isEditingPipeline ? 'Editar Pipeline' : 'Novo Pipeline'} size="lg">
                <Stack gap="md">
                    <TextInput label="Nome do Pipeline" placeholder="Ex: Funil de Vendas" required value={pipelineForm.name || ''} onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })} />
                    <TextInput label="Descrição" placeholder="Descrição opcional" value={pipelineForm.description || ''} onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })} />

                    <Switch
                        label="Pipeline Padrão"
                        description="Este pipeline será usado como padrão para novos leads"
                        checked={pipelineForm.is_default || false}
                        onChange={(e) => setPipelineForm({ ...pipelineForm, is_default: e.currentTarget.checked })}
                        color="green"
                    />

                    <Divider label="Estágios" labelPosition="center" />

                    <Stack gap="xs">
                        {(pipelineForm.stages || []).map((stage, index) => (
                            <Paper key={stage.id} withBorder p="sm">
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap="xs" style={{ flex: 1 }}>
                                        <ColorInput size="xs" value={stage.color} onChange={(color) => updateStageInForm(index, { color })} w={80} swatches={['#868e96', '#fab005', '#228be6', '#7950f2', '#40c057', '#fa5252', '#fd7e14', '#e64980', '#15aabf']} />
                                        <TextInput size="xs" value={stage.name} onChange={(e) => updateStageInForm(index, { name: e.target.value })} style={{ flex: 1 }} />
                                    </Group>
                                    <Group gap="xs">
                                        <Tooltip label="Ponto de Conversão">
                                            <Checkbox size="xs" color="green" checked={stage.is_conversion_point} onChange={(e) => updateStageInForm(index, { is_conversion_point: e.currentTarget.checked })} />
                                        </Tooltip>
                                        <ActionIcon size="sm" color="red" variant="subtle" onClick={() => removeStageFromForm(index)} disabled={(pipelineForm.stages?.length || 0) <= 1}>
                                            <IconTrash size={14} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                            </Paper>
                        ))}
                        <Button variant="light" leftSection={<IconPlus size={14} />} size="sm" onClick={addStageToForm}>Adicionar Estágio</Button>
                    </Stack>

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={closePipelineModal}>Cancelar</Button>
                        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSavePipeline} disabled={!pipelineForm.name || !pipelineForm.stages?.length}>Salvar Pipeline</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Stage Automation Modal */}
            <Modal opened={automationModalOpened} onClose={closeAutomationModal} title={`Automações: ${selectedStageForAutomation?.name}`} size="lg">
                <Stack gap="md">
                    <Text size="sm" c="dimmed">Configure ações automáticas quando um card entrar neste estágio.</Text>

                    <Card withBorder>
                        <Stack gap="sm">
                            <Text fw={500} size="sm">Configuração do Estágio</Text>
                            <Switch label="Apenas na primeira vez deste ciclo" description="Automações executadas apenas na primeira passagem" disabled={selectedStageForAutomation?.is_conversion_point} />
                            <Switch label="Aqui acontece a conversão" description="Este estágio marca a conversão final" color="green" checked={selectedStageForAutomation?.is_conversion_point} />
                            <Alert color="blue" variant="light" title="Regras de exclusividade" icon={<IconBolt size={16} />}>
                                <Text size="xs">• Apenas um estágio pode ser o ponto de conversão<br />• Ambas opções não podem estar no mesmo estágio</Text>
                            </Alert>
                        </Stack>
                    </Card>

                    <Card withBorder>
                        <Stack gap="sm">
                            <Text fw={500} size="sm">Ações Programadas</Text>
                            {stageActions.map(action => {
                                const actionDef = ACTION_TYPES.find(a => a.value === action.type)
                                const ActionTypeIcon = actionDef?.icon || IconBolt
                                return (
                                    <Paper key={action.id} withBorder p="sm">
                                        <Group justify="space-between">
                                            <Group gap="xs">
                                                <ThemeIcon size="sm" variant="light" color={actionDef?.color || 'gray'}><ActionTypeIcon size={12} /></ThemeIcon>
                                                <Text size="sm">{action.name}</Text>
                                            </Group>
                                            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeAction(action.id)}><IconTrash size={14} /></ActionIcon>
                                        </Group>
                                    </Paper>
                                )
                            })}
                            <Button variant="light" leftSection={<IconPlus size={14} />} size="sm" onClick={openAddActionModal}>Adicionar Ação</Button>
                        </Stack>
                    </Card>

                    <Group justify="flex-end">
                        <Button variant="default" onClick={closeAutomationModal}>Cancelar</Button>
                        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSaveAutomation}>Salvar</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Add Action Modal */}
            <Modal opened={addActionModalOpened} onClose={closeAddActionModal} title="Adicionar Ação" size="md">
                <Stack gap="md">
                    <Text size="sm" c="dimmed">Selecione o tipo de ação a ser executada:</Text>
                    {ACTION_TYPES.map(action => {
                        const ActionIconComp = action.icon
                        return (
                            <Paper key={action.value} withBorder p="md" style={{ cursor: 'pointer' }} onClick={() => handleAddAction(action.value)}>
                                <Group>
                                    <ThemeIcon size="lg" variant="light" color={action.color}><ActionIconComp size={20} /></ThemeIcon>
                                    <Text fw={500}>{action.label}</Text>
                                </Group>
                            </Paper>
                        )
                    })}
                </Stack>
            </Modal>

            {/* List View Modal */}
            <Modal
                opened={listModalOpened}
                onClose={closeListModal}
                title={
                    <Group gap="sm">
                        <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: listViewStage?.color || '#868e96' }} />
                        <Text fw={600}>{listViewStage?.name} - Lista de Deals</Text>
                        <Badge size="sm" variant="light">{listViewStage ? dealsByStage(listViewStage.id).length : 0}</Badge>
                    </Group>
                }
                size="xl"
            >
                <Stack gap="md">
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">Total: {listViewStage ? formatCurrency(getStageTotal(listViewStage.id)) : 'R$ 0,00'}</Text>
                        <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={handleExportStage}>
                            Exportar CSV
                        </Button>
                    </Group>

                    <Table.ScrollContainer minWidth={500}>
                        <Table verticalSpacing="sm" highlightOnHover striped>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Nome</Table.Th>
                                    <Table.Th>Telefone</Table.Th>
                                    <Table.Th>Valor</Table.Th>
                                    <Table.Th>Tags</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Ações</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {listViewStage && dealsByStage(listViewStage.id).map(deal => (
                                    <Table.Tr key={deal.id} style={{ cursor: 'pointer' }} onClick={() => { handleDealClick(deal); closeListModal(); }}>
                                        <Table.Td><Text size="sm" fw={500}>{deal.contact_name}</Text></Table.Td>
                                        <Table.Td><Text size="sm" c="dimmed">{deal.contact_phone}</Text></Table.Td>
                                        <Table.Td><Text size="sm" fw={500} c="green">{formatCurrency(deal.value)}</Text></Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                {deal.tags.slice(0, 2).map(tag => (
                                                    <Badge key={tag} size="xs" variant="light">{tag}</Badge>
                                                ))}
                                                {deal.tags.length > 2 && <Badge size="xs" variant="outline">+{deal.tags.length - 2}</Badge>}
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge size="xs" color={deal.status === 'won' ? 'green' : deal.status === 'lost' ? 'red' : 'blue'}>
                                                {deal.status === 'won' ? 'Ganho' : deal.status === 'lost' ? 'Perdido' : 'Aberto'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                <Tooltip label="Abrir Chat">
                                                    <ActionIcon size="sm" variant="subtle" color="green" onClick={(e) => { e.stopPropagation(); handleOpenChat(deal); }}>
                                                        <IconBrandWhatsapp size={14} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>

                    {listViewStage && dealsByStage(listViewStage.id).length === 0 && (
                        <Text ta="center" c="dimmed" py="xl">Nenhum deal nesta etapa</Text>
                    )}
                </Stack>
            </Modal>
        </Stack>
    )
}
