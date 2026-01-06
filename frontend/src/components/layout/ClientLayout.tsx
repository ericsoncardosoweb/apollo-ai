import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
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
    IconInbox,
    IconUsers,
    IconRobot,
    IconChartBar,
    IconSettings,
    IconLogout,
    IconSun,
    IconMoon,
    IconChevronRight,
    IconBriefcase,
} from '@tabler/icons-react'

const clientNavigation = [
    {
        label: 'Dashboard',
        href: '/app',
        icon: IconDashboard,
        description: 'Visão geral do seu negócio'
    },
    {
        label: 'Inbox',
        href: '/app/inbox',
        icon: IconInbox,
        description: 'Conversas e mensagens'
    },
    {
        label: 'CRM',
        href: '/app/crm',
        icon: IconBriefcase,
        description: 'Gerenciar oportunidades'
    },
    {
        label: 'Contatos',
        href: '/app/contacts',
        icon: IconUsers,
        description: 'Base de contatos'
    },
    {
        label: 'Agentes IA',
        href: '/app/agents',
        icon: IconRobot,
        description: 'Performance dos agentes'
    },
    {
        label: 'Analytics',
        href: '/app/analytics',
        icon: IconChartBar,
        description: 'Métricas e relatórios'
    },
    {
        label: 'Configurações',
        href: '/app/settings',
        icon: IconSettings,
        description: 'Configurações da empresa'
    },
]

export default function ClientLayout() {
    const [opened, { toggle }] = useDisclosure()
    const { signOut, user } = useAuth()
    const { tenant } = useTenant()
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
                            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
                                <Text fw={700} size="sm">
                                    {tenant?.name?.charAt(0).toUpperCase() || 'A'}
                                </Text>
                            </ThemeIcon>
                            <Box>
                                <Text fw={600} size="sm">{tenant?.name || 'Apollo A.I.'}</Text>
                                <Text size="xs" c="dimmed">Portal do Cliente</Text>
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
                                    <Avatar size="sm" radius="xl" color="teal">
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
                                    onClick={() => navigate('/app/settings')}
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
                        {clientNavigation.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                end={item.href === '/app'}
                            >
                                {({ isActive }) => (
                                    <MantineNavLink
                                        active={isActive}
                                        label={item.label}
                                        description={item.description}
                                        leftSection={<item.icon size={20} stroke={1.5} />}
                                        rightSection={<IconChevronRight size={14} stroke={1.5} />}
                                        variant="filled"
                                        color="teal"
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
                        <Badge
                            size="sm"
                            variant="light"
                            color={tenant?.plan === 'enterprise' ? 'violet' : tenant?.plan === 'pro' ? 'teal' : 'gray'}
                            fullWidth
                        >
                            Plano {tenant?.plan?.charAt(0).toUpperCase()}{tenant?.plan?.slice(1) || 'Free'}
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
