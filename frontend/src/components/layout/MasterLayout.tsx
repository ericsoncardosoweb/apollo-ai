/**
 * Master Layout - Global Platform Administration
 * Theme: GREEN - Global admin view
 * Features: SegmentedControl for view mode switching
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
    Image,
    SegmentedControl,
    Center,
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
    IconPlus,
    IconShield,
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useViewContext } from '@/contexts/ViewContext'
import { masterNavItems } from '@/config/navigation'
import { useAppStore } from '@/stores/useAppStore'
import CompanySpotlight from '@/components/company/CompanySpotlight'
import logoImage from '@/assets/logo/logo.png'

// Theme color for Master environment
const THEME_COLOR = 'teal'

export default function MasterLayout() {
    const [opened, { toggle }] = useDisclosure()
    const [spotlightOpened, { open: openSpotlight, close: closeSpotlight }] = useDisclosure()

    const { colorScheme, toggleColorScheme } = useMantineColorScheme()
    const { user, profile, role, signOut } = useAuth()
    const {
        companies,
        switchToCompanyView,
        loadingCompanies,
    } = useViewContext()
    const navigate = useNavigate()
    const location = useLocation()

    // Zustand store for view mode
    const { viewMode, setViewMode, selectedCompany, setSelectedCompany } = useAppStore()

    // Save current panel to localStorage for persistence
    useEffect(() => {
        localStorage.setItem('apollo_last_panel', location.pathname)
    }, [location.pathname])

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const handleCompanySelect = (company: typeof companies[0]) => {
        switchToCompanyView(company)
        setSelectedCompany({
            id: company.id,
            name: company.name,
            slug: company.slug,
        })
        navigate('/admin')
    }

    const handleCreateCompany = () => {
        navigate('/master/companies')
        closeSpotlight()
    }

    const handleViewModeChange = (value: string) => {
        setViewMode(value as 'ADMIN' | 'MANAGEMENT')
        if (value === 'MANAGEMENT' && !selectedCompany) {
            openSpotlight()
        }
    }

    // Role badge
    const roleLabel = role === 'master' ? 'MASTER' : role === 'admin' ? 'ADMIN' : 'OPERADOR'

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
                            <Badge size="sm" color={THEME_COLOR} variant="filled">{roleLabel}</Badge>
                        </Group>

                        <Group gap="md">
                            {/* View Mode Toggle */}
                            <SegmentedControl
                                value={viewMode}
                                onChange={handleViewModeChange}
                                size="xs"
                                data={[
                                    {
                                        value: 'ADMIN',
                                        label: (
                                            <Center style={{ gap: 6 }}>
                                                <IconShield size={14} />
                                                <span>Admin Global</span>
                                            </Center>
                                        ),
                                    },
                                    {
                                        value: 'MANAGEMENT',
                                        label: (
                                            <Center style={{ gap: 6 }}>
                                                <IconBuilding size={14} />
                                                <span>Gestão</span>
                                            </Center>
                                        ),
                                    },
                                ]}
                                styles={{
                                    root: { backgroundColor: 'rgba(255,255,255,0.1)' },
                                }}
                            />

                            {/* Company Selector */}
                            {viewMode === 'MANAGEMENT' ? (
                                <Button
                                    variant="light"
                                    color={THEME_COLOR}
                                    leftSection={<IconBuilding size={16} />}
                                    rightSection={<IconSearch size={14} />}
                                    onClick={openSpotlight}
                                    size="xs"
                                >
                                    {selectedCompany?.name || 'Selecionar empresa...'}
                                </Button>
                            ) : (
                                <Tooltip label="Selecionar empresa para administrar">
                                    <Button
                                        variant="subtle"
                                        color="gray"
                                        leftSection={<IconBuilding size={16} />}
                                        rightSection={<IconSearch size={14} />}
                                        onClick={openSpotlight}
                                        size="xs"
                                    >
                                        Selecionar empresa...
                                    </Button>
                                </Tooltip>
                            )}

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
                                {viewMode === 'ADMIN' ? 'Painel Master' : `Gestão: ${selectedCompany?.name || '...'}`}
                            </Text>
                        </Group>
                    </AppShell.Section>

                    <AppShell.Section grow component={ScrollArea}>
                        <Stack gap={4}>
                            {masterNavItems.map((item) => (
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
                            ))}
                        </Stack>
                    </AppShell.Section>

                    <AppShell.Section>
                        <Divider my="sm" />

                        {/* New Company Button */}
                        <Button
                            fullWidth
                            variant="light"
                            color={THEME_COLOR}
                            leftSection={<IconPlus size={16} />}
                            onClick={() => navigate('/master/companies')}
                            mb="sm"
                        >
                            Nova Empresa
                        </Button>

                        <Box p="xs" bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                            <Group gap="xs">
                                <ThemeIcon size="sm" variant="light" color={THEME_COLOR}>
                                    <IconRocket size={12} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" fw={500}>Apollo v1.0.0</Text>
                                    <Text size="xs" c="dimmed">{companies.length} empresas</Text>
                                </div>
                            </Group>
                        </Box>
                    </AppShell.Section>
                </AppShell.Navbar>

                <AppShell.Main>
                    <Outlet />
                </AppShell.Main>
            </AppShell>

            {/* Company Spotlight Modal */}
            <CompanySpotlight
                opened={spotlightOpened}
                onClose={closeSpotlight}
                companies={companies}
                loading={loadingCompanies}
                onSelectCompany={handleCompanySelect}
                onCreateCompany={handleCreateCompany}
            />
        </>
    )
}
