/**
 * Client Layout - End User View
 * Theme: VIOLET/PURPLE - Client view
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
    IconShield,
    IconSearch,
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useViewContext } from '@/contexts/ViewContext'
import { getNavItemsForRole, clientNavItems } from '@/config/navigation'
import { isPlatformAdmin } from '@/types'
import CompanySpotlight from '@/components/company/CompanySpotlight'
import logoImage from '@/assets/logo/logo.png'

// Theme color for Client environment
const THEME_COLOR = 'violet'

export default function ClientLayout() {
    const [opened, { toggle }] = useDisclosure()
    const [spotlightOpened, { open: openSpotlight, close: closeSpotlight }] = useDisclosure()

    const { colorScheme, toggleColorScheme } = useMantineColorScheme()
    const { user, profile, role, signOut } = useAuth()
    const {
        selectedCompany,
        companies,
        switchToCompanyView,
        switchToPlatformView,
        loadingCompanies,
    } = useViewContext()
    const navigate = useNavigate()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    // Get nav items for user role
    const navItems = getNavItemsForRole(clientNavItems, role || 'client')

    // Check if user is platform admin (can switch between views)
    const canSwitchViews = isPlatformAdmin(role)

    const handleCompanySelect = (company: typeof companies[0]) => {
        switchToCompanyView(company)
        closeSpotlight()
    }

    const handleGoToAdmin = () => {
        navigate('/admin')
    }

    const handleGoToMaster = () => {
        switchToPlatformView()
        navigate('/master')
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
                            <Badge size="sm" color={THEME_COLOR} variant="filled">CLIENTE</Badge>
                        </Group>

                        <Group gap="md">
                            {/* Company Selector - Only for platform admins */}
                            {canSwitchViews && selectedCompany && (
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
                                                {profile?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                                            </Avatar>
                                            <div style={{ lineHeight: 1 }}>
                                                <Text size="sm" fw={500}>
                                                    {profile?.name || 'Usuário'}
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
                                <IconRocket size={12} />
                            </ThemeIcon>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                {selectedCompany?.name || 'Área do Cliente'}
                            </Text>
                        </Group>
                    </AppShell.Section>

                    <AppShell.Section grow component={ScrollArea}>
                        <Stack gap={4}>
                            {navItems.map((item) => (
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

                    {canSwitchViews && (
                        <AppShell.Section>
                            <Divider my="sm" />

                            {/* Go to Admin Panel */}
                            <Button
                                fullWidth
                                variant="light"
                                color="blue"
                                leftSection={<IconBuilding size={16} />}
                                onClick={handleGoToAdmin}
                                mb="xs"
                            >
                                Painel Gestão
                            </Button>

                            {/* Go to Master Panel */}
                            <Button
                                fullWidth
                                variant="subtle"
                                color="teal"
                                leftSection={<IconShield size={16} />}
                                onClick={handleGoToMaster}
                                mb="sm"
                            >
                                Painel Master
                            </Button>
                        </AppShell.Section>
                    )}

                    <AppShell.Section>
                        <Box p="xs" bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                            <Group gap="xs">
                                <ThemeIcon size="sm" variant="light" color={THEME_COLOR}>
                                    <IconRocket size={12} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" fw={500}>Apollo v1.0.0</Text>
                                    <Text size="xs" c="dimmed">Área do Cliente</Text>
                                </div>
                            </Group>
                        </Box>
                    </AppShell.Section>
                </AppShell.Navbar>

                <AppShell.Main>
                    <Outlet />
                </AppShell.Main>
            </AppShell>

            {/* Company Spotlight Modal - For platform admins */}
            {canSwitchViews && (
                <CompanySpotlight
                    opened={spotlightOpened}
                    onClose={closeSpotlight}
                    companies={companies}
                    loading={loadingCompanies}
                    onSelectCompany={handleCompanySelect}
                    onCreateCompany={() => navigate('/master/companies')}
                />
            )}
        </>
    )
}
