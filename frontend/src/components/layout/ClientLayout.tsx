/**
 * Client Layout - Company Users (Operators & Managers)
 * Uses Mantine AppShell with role-based dynamic navigation
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
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { getNavItemsForRole, clientNavItems } from '@/config/navigation'

export default function ClientLayout() {
    const [opened, { toggle }] = useDisclosure()
    const { colorScheme, toggleColorScheme } = useMantineColorScheme()
    const { user, profile, role, signOut } = useAuth()
    const { tenant } = useTenant()
    const navigate = useNavigate()

    // Get navigation items based on user role
    const navItems = getNavItemsForRole(clientNavItems, role)

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
                collapsed: { mobile: !opened }
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                        <ThemeIcon
                            size="lg"
                            radius="md"
                            variant="gradient"
                            gradient={{ from: 'teal', to: 'cyan' }}
                        >
                            <IconRocket size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="sm" fw={700}>
                                {tenant?.name || 'Apollo A.I.'}
                            </Text>
                            <Text size="xs" c="dimmed">
                                {role === 'operator' ? 'Operador' : 'Gerente'}
                            </Text>
                        </div>
                    </Group>

                    <Group gap="xs">
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
                                            color="teal"
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
                                    Meu Perfil
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

            <AppShell.Navbar p="md">
                <AppShell.Section>
                    <Group mb="md" gap="xs">
                        <ThemeIcon size="sm" variant="light" color="teal">
                            <IconBuilding size={12} />
                        </ThemeIcon>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            {tenant?.name || 'Workspace'}
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
                                    <ThemeIcon variant="light" size="md" color="teal">
                                        <item.icon size={16} />
                                    </ThemeIcon>
                                }
                                rightSection={
                                    typeof item.badge === 'number' && item.badge > 0 ? (
                                        <Badge size="xs" color="red">{item.badge}</Badge>
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
                    <Box p="xs" bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                        <Group justify="space-between">
                            <div>
                                <Text size="xs" fw={500}>
                                    Plano {tenant?.plan || 'Pro'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    3 agentes ativos
                                </Text>
                            </div>
                            <Badge size="xs" variant="light" color="green">
                                Ativo
                            </Badge>
                        </Group>
                    </Box>
                </AppShell.Section>
            </AppShell.Navbar>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    )
}
