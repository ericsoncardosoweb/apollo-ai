/**
 * Admin Layout - Company-Specific Administration
 * Theme: BLUE - Company admin view
 * Requires: selectedCompany to be set
 */

import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
    AppShell,
    Burger,
    Group,
    NavLink as MantineNavLink,
    Text,
    Avatar,
    Menu,
    ActionIcon,
    Box,
    Divider,
    ThemeIcon,
    useMantineColorScheme,
    Stack,
    Badge,
    UnstyledButton,
    ScrollArea,
    Button,
    Tooltip,
    Alert,
    Image,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconSun,
    IconMoon,
    IconLogout,
    IconSettings,
    IconChevronRight,
    IconRocket,
    IconBuilding,
    IconSearch,
    IconEye,
    IconArrowLeft,
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useViewContext } from '@/contexts/ViewContext'
import { adminNavItems } from '@/config/navigation'
import CompanySpotlight from '@/components/company/CompanySpotlight'
import AdminFAB from '@/components/admin/AdminFAB'
import { MigrationAlert } from '@/components/shared/MigrationAlert'
import logoImage from '@/assets/logo/logo.png'

// Theme color for Admin/Gestão environment
const THEME_COLOR = 'blue'

export default function AdminLayout() {
    const [opened, { toggle }] = useDisclosure()
    const [spotlightOpened, { open: openSpotlight, close: closeSpotlight }] = useDisclosure()

    const { colorScheme, toggleColorScheme } = useMantineColorScheme()
    const { user, profile, role, signOut } = useAuth()
    const {
        companies,
        selectedCompany,
        switchToCompanyView,
        switchToPlatformView,
        loadingCompanies,
    } = useViewContext()
    const navigate = useNavigate()
    const location = useLocation()

    // Save current panel to localStorage for persistence
    useEffect(() => {
        localStorage.setItem('apollo_last_panel', location.pathname)
    }, [location.pathname])

    // Redirect to master if no company selected
    useEffect(() => {
        if (!selectedCompany) {
            navigate('/master')
        }
    }, [selectedCompany, navigate])

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const handleCompanySelect = (company: typeof companies[0]) => {
        switchToCompanyView(company)
        closeSpotlight()
    }

    const handleGoToMaster = () => {
        switchToPlatformView()
        navigate('/master')
    }

    const handleViewAsClient = () => {
        navigate('/app')
    }


    // If no company selected, show alert
    if (!selectedCompany) {
        return (
            <Box p="xl">
                <Alert color="orange" title="Nenhuma empresa selecionada">
                    Você precisa selecionar uma empresa para acessar o painel de gestão.
                    <Button mt="md" onClick={handleGoToMaster}>
                        Ir para Painel Master
                    </Button>
                </Alert>
            </Box>
        )
    }

    return (
        <>
            <AppShell
                header={{ height: 60 }}
                navbar={{
                    width: 280,
                    breakpoint: 'sm',
                    collapsed: { mobile: !opened }
                }}
                padding="md"
            >
                <AppShell.Header style={{ backgroundColor: '#000' }}>
                    <Group h="100%" px="md" justify="space-between">
                        <Group>
                            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                            <Image src={logoImage} alt="Apollo A.I." h={44} w="auto" />
                            <Badge size="sm" color={THEME_COLOR} variant="filled">GESTÃO</Badge>
                        </Group>

                        <Group gap="md">
                            {/* Company Selector - Opens Spotlight */}
                            <Tooltip label="Trocar empresa">
                                <Button
                                    variant="light"
                                    color={THEME_COLOR}
                                    leftSection={<IconBuilding size={16} />}
                                    rightSection={<IconSearch size={14} />}
                                    onClick={openSpotlight}
                                    size="xs"
                                >
                                    {selectedCompany.name}
                                </Button>
                            </Tooltip>

                            {/* Stage Badge */}
                            {selectedCompany.pipeline_stage && (
                                <Badge
                                    size="sm"
                                    color={
                                        selectedCompany.pipeline_stage === 'ativo' ? 'green' :
                                            selectedCompany.pipeline_stage === 'implantacao' ? 'blue' :
                                                selectedCompany.pipeline_stage === 'onboard' ? 'yellow' :
                                                    selectedCompany.pipeline_stage === 'lead' ? 'gray' :
                                                        'red'
                                    }
                                    variant="light"
                                >
                                    {selectedCompany.pipeline_stage === 'ativo' ? 'Ativo' :
                                        selectedCompany.pipeline_stage === 'implantacao' ? 'Implantação' :
                                            selectedCompany.pipeline_stage === 'onboard' ? 'Onboard' :
                                                selectedCompany.pipeline_stage === 'lead' ? 'Lead' :
                                                    selectedCompany.pipeline_stage === 'churn' ? 'Churn' :
                                                        selectedCompany.pipeline_stage}
                                </Badge>
                            )}

                            {/* Ver como Cliente */}
                            <Tooltip label="Ver como cliente">
                                <ActionIcon
                                    variant="light"
                                    color="violet"
                                    size="lg"
                                    onClick={handleViewAsClient}
                                >
                                    <IconEye size={18} />
                                </ActionIcon>
                            </Tooltip>

                            {/* Voltar para Master */}
                            <Tooltip label="Painel Master">
                                <ActionIcon
                                    variant="light"
                                    color="teal"
                                    size="lg"
                                    onClick={handleGoToMaster}
                                >
                                    <IconArrowLeft size={18} />
                                </ActionIcon>
                            </Tooltip>

                            <ActionIcon
                                variant="subtle"
                                onClick={toggleColorScheme}
                                size="lg"
                            >
                                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                            </ActionIcon>

                            <Menu shadow="md" width={220} position="bottom-end">
                                <Menu.Target>
                                    <UnstyledButton>
                                        <Group gap="xs">
                                            <Avatar
                                                radius="xl"
                                                size="sm"
                                                color={THEME_COLOR}
                                                src={profile?.avatar_url}
                                            >
                                                {profile?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
                                            </Avatar>
                                            <div style={{ lineHeight: 1 }}>
                                                <Text size="sm" fw={500}>
                                                    {profile?.name || 'Admin'}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    {user?.email}
                                                </Text>
                                            </div>
                                        </Group>
                                    </UnstyledButton>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>Conta</Menu.Label>
                                    <Menu.Item leftSection={<IconSettings size={14} />}>
                                        Configurações
                                    </Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item
                                        color="red"
                                        leftSection={<IconLogout size={14} />}
                                        onClick={handleSignOut}
                                    >
                                        Sair
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        </Group>
                    </Group>
                </AppShell.Header>

                <AppShell.Navbar p="md" style={{ backgroundColor: '#000' }}>
                    <AppShell.Section>
                        <Group mb="md" gap="xs">
                            <ThemeIcon size="sm" variant="light" color={THEME_COLOR}>
                                <IconBuilding size={12} />
                            </ThemeIcon>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                Gestão - {selectedCompany.name}
                            </Text>
                        </Group>
                    </AppShell.Section>

                    <AppShell.Section grow component={ScrollArea}>
                        <Stack gap={4}>
                            {adminNavItems.map((item) =>
                                item.children ? (
                                    // Expandable group with children
                                    <MantineNavLink
                                        key={item.href}
                                        label={item.label}
                                        description={item.description}
                                        leftSection={
                                            <ThemeIcon variant="light" size="md" color={THEME_COLOR}>
                                                <item.icon size={16} />
                                            </ThemeIcon>
                                        }
                                        childrenOffset={28}
                                        defaultOpened={false}
                                        style={{ borderRadius: 'var(--mantine-radius-md)' }}
                                    >
                                        {item.children.map((child) => (
                                            <MantineNavLink
                                                key={child.href}
                                                component={NavLink}
                                                to={child.href}
                                                label={child.label}
                                                leftSection={
                                                    <ThemeIcon variant="subtle" size="sm" color={THEME_COLOR}>
                                                        <child.icon size={14} />
                                                    </ThemeIcon>
                                                }
                                                style={{ borderRadius: 'var(--mantine-radius-md)' }}
                                            />
                                        ))}
                                    </MantineNavLink>
                                ) : (
                                    // Regular nav item
                                    <MantineNavLink
                                        key={item.href}
                                        component={NavLink}
                                        to={item.href}
                                        label={item.label}
                                        description={item.description}
                                        leftSection={
                                            <ThemeIcon variant="light" size="md" color={THEME_COLOR}>
                                                <item.icon size={16} />
                                            </ThemeIcon>
                                        }
                                        rightSection={
                                            typeof item.badge === 'number' && item.badge > 0 ? (
                                                <Badge size="xs" color={THEME_COLOR}>{item.badge}</Badge>
                                            ) : (
                                                <IconChevronRight size={14} />
                                            )
                                        }
                                        style={{ borderRadius: 'var(--mantine-radius-md)' }}
                                    />
                                )
                            )}
                        </Stack>
                    </AppShell.Section>

                    <AppShell.Section>
                        <Divider my="sm" />


                        <Box p="xs" bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                            <Group gap="xs">
                                <ThemeIcon size="sm" variant="light" color={THEME_COLOR}>
                                    <IconRocket size={12} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" fw={500}>Apollo v1.0.0</Text>
                                    <Text size="xs" c="dimmed">{selectedCompany.name}</Text>
                                </div>
                            </Group>
                        </Box>
                    </AppShell.Section>
                </AppShell.Navbar>

                <AppShell.Main>
                    <MigrationAlert />
                    <Outlet />
                    <AdminFAB />
                </AppShell.Main>
            </AppShell>

            {/* Company Spotlight Modal */}
            <CompanySpotlight
                opened={spotlightOpened}
                onClose={closeSpotlight}
                companies={companies}
                loading={loadingCompanies}
                onSelectCompany={handleCompanySelect}
                onCreateCompany={() => navigate('/master/companies')}
            />
        </>
    )
}
