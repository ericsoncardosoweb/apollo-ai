/**
 * Navigation Configuration
 * Defines all navigation items with role-based visibility
 */

import {
    IconDashboard,
    IconBuilding,
    IconRobot,
    IconUsers,
    IconWebhook,
    IconChartBar,
    IconSettings,
    IconInbox,
    IconBriefcase,
    IconAddressBook,
} from '@tabler/icons-react'
import { NavItem, UserRole } from '@/types'

// Admin navigation items (Platform administrators)
export const adminNavItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/admin',
        icon: IconDashboard,
        description: 'Visão geral da plataforma',
        roles: ['admin'],
    },
    {
        label: 'Empresas',
        href: '/admin/companies',
        icon: IconBuilding,
        description: 'Gerenciar empresas clientes',
        roles: ['admin'],
    },
    {
        label: 'Agentes IA',
        href: '/admin/agents',
        icon: IconRobot,
        description: 'Configurar agentes de IA',
        roles: ['admin'],
    },
    {
        label: 'Usuários',
        href: '/admin/users',
        icon: IconUsers,
        description: 'Gerenciar usuários do sistema',
        roles: ['admin'],
    },
    {
        label: 'Webhooks',
        href: '/admin/webhooks',
        icon: IconWebhook,
        description: 'Integrações externas',
        roles: ['admin'],
    },
    {
        label: 'Analytics',
        href: '/admin/analytics',
        icon: IconChartBar,
        description: 'Métricas globais',
        roles: ['admin'],
    },
    {
        label: 'Configurações',
        href: '/admin/settings',
        icon: IconSettings,
        description: 'Configurações da plataforma',
        roles: ['admin'],
    },
]

// Client navigation items (Company users - operators and managers)
export const clientNavItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/app',
        icon: IconDashboard,
        description: 'Visão geral do negócio',
        roles: ['client', 'operator'],
    },
    {
        label: 'Inbox',
        href: '/app/inbox',
        icon: IconInbox,
        description: 'Central de conversas',
        roles: ['client', 'operator'],
        badge: 0, // Will be dynamic
    },
    {
        label: 'CRM',
        href: '/app/crm',
        icon: IconBriefcase,
        description: 'Pipeline de vendas',
        roles: ['client'], // Operators may not see full CRM
    },
    {
        label: 'Contatos',
        href: '/app/contacts',
        icon: IconAddressBook,
        description: 'Base de contatos',
        roles: ['client', 'operator'],
    },
    {
        label: 'Agentes',
        href: '/app/agents',
        icon: IconRobot,
        description: 'Performance dos agentes',
        roles: ['client'],
    },
    {
        label: 'Analytics',
        href: '/app/analytics',
        icon: IconChartBar,
        description: 'Relatórios e métricas',
        roles: ['client'],
    },
    {
        label: 'Configurações',
        href: '/app/settings',
        icon: IconSettings,
        description: 'Configurações da empresa',
        roles: ['client'],
    },
]

// Filter navigation items by user role
export function getNavItemsForRole(items: NavItem[], userRole: UserRole): NavItem[] {
    return items.filter(item => item.roles.includes(userRole))
}

// Get appropriate navigation based on role
export function getNavigationForRole(role: UserRole): NavItem[] {
    if (role === 'admin') {
        return adminNavItems
    }
    return getNavItemsForRole(clientNavItems, role)
}

// Get home route based on role
export function getHomeRouteForRole(role: UserRole): string {
    if (role === 'admin') {
        return '/admin'
    }
    return '/app'
}
