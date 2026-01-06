import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
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
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconDashboard,
    IconBuilding,
    IconRobot,
    IconChartBar,
    IconSettings,
    IconLogout,
    IconSun,
    IconMoon,
    IconChevronRight,
    IconUsers,
    IconWebhook,
} from '@tabler/icons-react'

const adminNavigation = [
    {
        label: 'Dashboard',
        href: '/admin',
        icon: IconDashboard,
        description: 'Visão geral da plataforma'
    },
    {
        label: 'Empresas',
        href: '/admin/companies',
        icon: IconBuilding,
        description: 'Gerenciar empresas cadastradas'
    },
    {
        label: 'Agentes IA',
        href: '/admin/agents',
        icon: IconRobot,
        description: 'Configurar agentes de inteligência artificial'
    },
    {
        label: 'Usuários',
        href: '/admin/users',
        icon: IconUsers,
        description: 'Gerenciar usuários do sistema'
    },
    {
        label: 'Webhooks',
        href: '/admin/webhooks',
        icon: IconWebhook,
        description: 'Configurar integrações'
    },
    {
        label: 'Analytics',
        href: '/admin/analytics',
        icon: IconChartBar,
        description: 'Métricas e relatórios globais'
    },
    {
        label: 'Configurações',
        href: '/admin/settings',
        icon: IconSettings,
        description: 'Configurações da plataforma'
    },
]

export default function AdminLayout() {
    const [opened, { toggle }] = useDisclosure()
    const { signOut, user } = useAuth()
    const navigate = useNavigate()
    const { colorScheme, toggleColorScheme } = useMantineColorScheme()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 280,
                breakpoint: 'sm',
                collapsed: { mobile: !opened },
            }}
            padding="md"
        >
            {/* Header */}
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger
                            opened={opened}
                            onClick={toggle}
                            hiddenFrom="sm"
                            size="sm"
                        />
                        <Group gap="xs">
                            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'indigo', to: 'violet' }}>
                                <Text fw={700} size="sm">A</Text>
                            </ThemeIcon>
                            <Box>
                                <Text fw={600} size="sm">Apollo A.I.</Text>
                                <Text size="xs" c="dimmed">Painel Administrativo</Text>
                            </Box>
                        </Group>
                    </Group>

                    <Group gap="xs">
                        <ActionIcon
                            variant="subtle"
                            onClick={() => toggleColorScheme()}
                            size="lg"
                            radius="md"
                        >
                            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                        </ActionIcon>

                        <Menu shadow="md" width={200} position="bottom-end">
                            <Menu.Target>
                                <ActionIcon variant="subtle" size="lg" radius="xl">
                                    <Avatar size="sm" radius="xl" color="indigo">
                                        {user?.email?.charAt(0).toUpperCase()}
                                    </Avatar>
                                </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>
                                    <Text size="xs" c="dimmed">Conectado como</Text>
                                    <Text size="sm" fw={500} truncate>{user?.email}</Text>
                                </Menu.Label>
                                <Menu.Divider />
                                <Menu.Item
                                    leftSection={<IconSettings size={14} />}
                                    onClick={() => navigate('/admin/settings')}
                                >
                                    Configurações
                                </Menu.Item>
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

            {/* Sidebar */}
            <AppShell.Navbar p="md">
                <AppShell.Section grow>
                    <Stack gap={4}>
                        {adminNavigation.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                end={item.href === '/admin'}
                            >
                                {({ isActive }) => (
                                    <MantineNavLink
                                        active={isActive}
                                        label={item.label}
                                        description={item.description}
                                        leftSection={<item.icon size={20} stroke={1.5} />}
                                        rightSection={<IconChevronRight size={14} stroke={1.5} />}
                                        variant="filled"
                                        styles={{
                                            root: {
                                                borderRadius: 'var(--mantine-radius-md)',
                                            },
                                        }}
                                    />
                                )}
                            </NavLink>
                        ))}
                    </Stack>
                </AppShell.Section>

                <AppShell.Section>
                    <Divider my="sm" />
                    <Box p="xs">
                        <Badge size="sm" variant="light" color="indigo" fullWidth>
                            Plano Enterprise
                        </Badge>
                    </Box>
                </AppShell.Section>
            </AppShell.Navbar>

            {/* Main Content */}
            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    )
}
