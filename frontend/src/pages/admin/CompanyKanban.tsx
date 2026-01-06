/**
 * Company Kanban - Onboarding Pipeline View
 * Groups companies by stage with filter for cancelled/archived
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    Badge,
    Avatar,
    Paper,
    ActionIcon,
    Menu,
    Tooltip,
    Skeleton,
    Switch,
    Box,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconRefresh,
    IconDotsVertical,
    IconEye,
    IconEdit,
    IconTrash,
    IconFilter,
    IconFilterOff,
} from '@tabler/icons-react'
import { useCompanies, Company, useUpdateCompany } from '@/hooks/useCompanies'
import { useViewContext } from '@/contexts/ViewContext'
import CompanyDrawer from '@/components/company/CompanyDrawer'

// Stage configuration
const STAGES = [
    { key: 'onboarding', label: 'Onboarding', color: 'blue', emoji: '🔄' },
    { key: 'implementation', label: 'Implantação', color: 'orange', emoji: '🛠️' },
    { key: 'published', label: 'Publicada', color: 'green', emoji: '✅' },
    { key: 'cancelled', label: 'Cancelada', color: 'red', emoji: '❌', hidden: true },
    { key: 'archived', label: 'Arquivada', color: 'gray', emoji: '📁', hidden: true },
]

export default function CompanyKanban() {
    const navigate = useNavigate()
    const { switchToCompanyView } = useViewContext()

    const [showHidden, setShowHidden] = useState(false)
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
    const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure()

    // Queries
    const { data: companies, isLoading, refetch } = useCompanies()
    const updateCompany = useUpdateCompany()

    // Filter visible stages
    const visibleStages = showHidden
        ? STAGES
        : STAGES.filter(s => !s.hidden)

    // Group companies by stage
    const getCompaniesByStage = (stageKey: string) => {
        return companies?.filter(c => {
            const companyStage = (c as any).stage || 'onboarding'
            return companyStage === stageKey
        }) || []
    }

    const handleViewCompany = (company: Company) => {
        switchToCompanyView({
            id: company.id,
            name: company.name,
            slug: company.slug,
            plan: company.plan || 'starter',
            whatsapp_number: null,
            owner_id: null,
            is_active: company.status === 'active',
            created_at: company.created_at,
        })
        navigate('/admin')
    }

    const handleEditCompany = (company: Company) => {
        setSelectedCompany(company)
        openDrawer()
    }

    const handleStageChange = (company: Company, newStage: string) => {
        // In a real implementation, this would update the stage field
        console.log('Change stage:', company.id, 'to', newStage)
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Pipeline de Onboarding</Title>
                        <Text c="dimmed" size="sm">
                            Arraste empresas entre estágios para atualizar o status
                        </Text>
                    </div>
                    <Group>
                        <Tooltip label={showHidden ? 'Ocultar cancelados' : 'Mostrar cancelados'}>
                            <ActionIcon
                                variant={showHidden ? 'filled' : 'subtle'}
                                color={showHidden ? 'red' : 'gray'}
                                onClick={() => setShowHidden(!showHidden)}
                                size="lg"
                            >
                                {showHidden ? <IconFilterOff size={18} /> : <IconFilter size={18} />}
                            </ActionIcon>
                        </Tooltip>
                        <Button
                            variant="subtle"
                            leftSection={<IconRefresh size={16} />}
                            onClick={() => refetch()}
                            loading={isLoading}
                        >
                            Atualizar
                        </Button>
                        <Button
                            leftSection={<IconPlus size={16} />}
                            onClick={() => navigate('/master/companies')}
                        >
                            Nova Empresa
                        </Button>
                    </Group>
                </Group>

                {/* Filter toggle */}
                <Group>
                    <Switch
                        label="Mostrar Canceladas e Arquivadas"
                        checked={showHidden}
                        onChange={(e) => setShowHidden(e.currentTarget.checked)}
                        color="red"
                    />
                </Group>

                {/* Kanban Board */}
                <Box
                    style={{
                        display: 'flex',
                        gap: 'var(--mantine-spacing-md)',
                        overflowX: 'auto',
                        paddingBottom: 'var(--mantine-spacing-md)',
                    }}
                >
                    {visibleStages.map((stage) => {
                        const stageCompanies = getCompaniesByStage(stage.key)

                        return (
                            <Paper
                                key={stage.key}
                                withBorder
                                p="md"
                                radius="md"
                                style={{
                                    minWidth: 280,
                                    maxWidth: 320,
                                    flex: '0 0 auto',
                                    backgroundColor: 'var(--mantine-color-dark-7)',
                                }}
                            >
                                {/* Column Header */}
                                <Group justify="space-between" mb="md">
                                    <Group gap="xs">
                                        <Text>{stage.emoji}</Text>
                                        <Text fw={600}>{stage.label}</Text>
                                    </Group>
                                    <Badge color={stage.color} variant="light" size="sm">
                                        {stageCompanies.length}
                                    </Badge>
                                </Group>

                                {/* Column Content */}
                                <Stack gap="sm">
                                    {isLoading ? (
                                        [...Array(2)].map((_, i) => (
                                            <Skeleton key={i} height={80} radius="md" />
                                        ))
                                    ) : stageCompanies.length === 0 ? (
                                        <Paper
                                            p="lg"
                                            radius="md"
                                            bg="dark.6"
                                            ta="center"
                                        >
                                            <Text size="sm" c="dimmed">
                                                Nenhuma empresa
                                            </Text>
                                        </Paper>
                                    ) : (
                                        stageCompanies.map((company) => (
                                            <Card
                                                key={company.id}
                                                withBorder
                                                padding="sm"
                                                radius="md"
                                                style={{ cursor: 'grab' }}
                                            >
                                                <Group justify="space-between" wrap="nowrap">
                                                    <Group gap="sm" wrap="nowrap">
                                                        <Avatar
                                                            color={stage.color}
                                                            radius="xl"
                                                            size="sm"
                                                        >
                                                            {company.name.charAt(0)}
                                                        </Avatar>
                                                        <div style={{ minWidth: 0 }}>
                                                            <Text size="sm" fw={500} truncate>
                                                                {company.name}
                                                            </Text>
                                                            <Text size="xs" c="dimmed" truncate>
                                                                {company.slug}
                                                            </Text>
                                                        </div>
                                                    </Group>

                                                    <Menu shadow="md" width={160}>
                                                        <Menu.Target>
                                                            <ActionIcon variant="subtle" color="gray" size="sm">
                                                                <IconDotsVertical size={14} />
                                                            </ActionIcon>
                                                        </Menu.Target>
                                                        <Menu.Dropdown>
                                                            <Menu.Item
                                                                leftSection={<IconEye size={14} />}
                                                                onClick={() => handleViewCompany(company)}
                                                            >
                                                                Acessar
                                                            </Menu.Item>
                                                            <Menu.Item
                                                                leftSection={<IconEdit size={14} />}
                                                                onClick={() => handleEditCompany(company)}
                                                            >
                                                                Editar
                                                            </Menu.Item>
                                                            <Menu.Divider />
                                                            <Menu.Label>Mover para</Menu.Label>
                                                            {STAGES.filter(s => s.key !== stage.key).map(s => (
                                                                <Menu.Item
                                                                    key={s.key}
                                                                    onClick={() => handleStageChange(company, s.key)}
                                                                >
                                                                    {s.emoji} {s.label}
                                                                </Menu.Item>
                                                            ))}
                                                        </Menu.Dropdown>
                                                    </Menu>
                                                </Group>

                                                {/* Company meta */}
                                                <Group gap="xs" mt="xs">
                                                    <Badge
                                                        size="xs"
                                                        variant="light"
                                                        color={company.status === 'active' ? 'green' : 'red'}
                                                    >
                                                        {company.status}
                                                    </Badge>
                                                    <Badge size="xs" variant="outline">
                                                        {company.plan || 'Basic'}
                                                    </Badge>
                                                </Group>
                                            </Card>
                                        ))
                                    )}
                                </Stack>
                            </Paper>
                        )
                    })}
                </Box>
            </Stack>

            {/* Company Drawer */}
            <CompanyDrawer
                company={selectedCompany}
                opened={drawerOpened}
                onClose={() => {
                    closeDrawer()
                    setSelectedCompany(null)
                }}
            />
        </>
    )
}
