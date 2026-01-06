/**
 * Navigation Configuration
 * Defines all navigation items with role-based visibility
 * Supports 3 environments: /master (global), /admin (company-specific), /app (client view)
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
    IconLayoutKanban,
    IconCrown,
    IconPackage,
    IconAdjustments,
    IconTestPipe,
    IconLock,
    IconBrandWhatsapp,
    IconMessage,
    IconSend,
} from '@tabler/icons-react'
import { NavItem, UserRole } from '@/types'

// Alias for IconAdjustments as IconCogs
const IconCogs = IconAdjustments

// Master/Global Platform navigation items (/master/*)
export const masterNavItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/master',
        icon: IconDashboard,
        description: 'Visão geral da plataforma',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Empresas',
        href: '/master/companies',
        icon: IconBuilding,
        description: 'Gerenciar empresas clientes',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Pipeline',
        href: '/master/kanban',
        icon: IconLayoutKanban,
        description: 'Kanban de onboarding',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Planos',
        href: '/master/plans',
        icon: IconCrown,
        description: 'Gerenciar planos de assinatura',
        roles: ['master', 'admin'],
    },
    {
        label: 'Usuários',
        href: '/master/users',
        icon: IconUsers,
        description: 'Gerenciar usuários do sistema',
        roles: ['master', 'admin'],
    },
    {
        label: 'Analytics',
        href: '/master/analytics',
        icon: IconChartBar,
        description: 'Métricas globais',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Configurações',
        href: '/master/settings',
        icon: IconSettings,
        description: 'Configurações da plataforma',
        roles: ['master', 'admin'],
    },
]

// Company Admin navigation items (/admin/*) - requires selectedCompany
export const adminNavItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/admin',
        icon: IconDashboard,
        description: 'Visão geral da empresa',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Chat ao Vivo',
        href: '/admin/inbox',
        icon: IconInbox,
        description: 'Conversas em tempo real',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'CRM',
        href: '/admin/crm',
        icon: IconBriefcase,
        description: 'Pipeline de vendas',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Contatos',
        href: '/admin/contacts',
        icon: IconUsers,
        description: 'Base de contatos',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Campanhas',
        href: '/admin/campaigns',
        icon: IconSend,
        description: 'Disparos em massa WhatsApp',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Serviços',
        href: '/admin/services',
        icon: IconPackage,
        description: 'Catálogo de serviços',
        roles: ['master', 'admin', 'operator'],
    },
    {
        label: 'Analytics',
        href: '/admin/analytics',
        icon: IconChartBar,
        description: 'Relatórios e métricas',
        roles: ['master', 'admin', 'operator'],
    },
    // Grupo Estrutura com subitems
    {
        label: 'Estrutura',
        href: '#estrutura',
        icon: IconCogs,
        description: 'Configuração da estrutura do sistema',
        roles: ['master', 'admin', 'operator'],
        isGroup: true,
        children: [
            {
                label: 'Agentes IA',
                href: '/admin/agents',
                icon: IconRobot,
                description: 'Editor de prompts',
                roles: ['master', 'admin', 'operator'],
            },
            {
                label: 'Testes Inteligentes',
                href: '/admin/tests',
                icon: IconTestPipe,
                description: 'Testes de agentes',
                roles: ['master', 'admin', 'operator'],
            },
            {
                label: 'Ferramentas',
                href: '/admin/tools',
                icon: IconSettings,
                description: 'Funções e integrações',
                roles: ['master', 'admin', 'operator'],
            },
            {
                label: 'Base de Conhecimento',
                href: '/admin/knowledge',
                icon: IconAddressBook,
                description: 'RAG e documentos',
                roles: ['master', 'admin', 'operator'],
            },
            {
                label: 'Controle de Acessos',
                href: '/admin/access',
                icon: IconLock,
                description: 'Permissões e acessos',
                roles: ['master', 'admin'],
            },
            {
                label: 'Usuários',
                href: '/admin/users',
                icon: IconUsers,
                description: 'Usuários da empresa',
                roles: ['master', 'admin'],
            },
            {
                label: 'Configurações',
                href: '/admin/settings',
                icon: IconSettings,
                description: 'Configurações da empresa',
                roles: ['master', 'admin'],
            },
            {
                label: 'Conexões WhatsApp',
                href: '/admin/connections',
                icon: IconBrandWhatsapp,
                description: 'Gerenciar instâncias',
                roles: ['master', 'admin'],
            },
            {
                label: 'Respostas Rápidas',
                href: '/admin/quick-replies',
                icon: IconMessage,
                description: 'Templates de mensagem',
                roles: ['master', 'admin', 'operator'],
            },
        ],
    },
]

// Client/Company navigation items (/app/*)
// Client has subset: Chat, CRM, Contatos, Analytics, Configurações, Serviços, Base de Conhecimento
export const clientNavItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/app',
        icon: IconDashboard,
        description: 'Visão geral do negócio',
        roles: ['master', 'admin', 'operator', 'client', 'attendant'],
    },
    {
        label: 'Chat ao Vivo',
        href: '/app/inbox',
        icon: IconInbox,
        description: 'Conversas em tempo real',
        roles: ['master', 'admin', 'operator', 'client', 'attendant'],
        badge: 0,
    },
    {
        label: 'CRM',
        href: '/app/crm',
        icon: IconBriefcase,
        description: 'Pipeline de vendas',
        roles: ['master', 'admin', 'operator', 'client'],
    },
    {
        label: 'Contatos',
        href: '/app/contacts',
        icon: IconAddressBook,
        description: 'Base de contatos',
        roles: ['master', 'admin', 'operator', 'client', 'attendant'],
    },
    {
        label: 'Base de Conhecimento',
        href: '/app/knowledge',
        icon: IconAddressBook,
        description: 'RAG e documentos',
        roles: ['master', 'admin', 'operator', 'client'],
    },
    {
        label: 'Analytics',
        href: '/app/analytics',
        icon: IconChartBar,
        description: 'Relatórios e métricas',
        roles: ['master', 'admin', 'operator', 'client'],
    },
    {
        label: 'Configurações',
        href: '/app/settings',
        icon: IconSettings,
        description: 'Configurações da empresa',
        roles: ['master', 'admin', 'operator', 'client'],
    },
]

// Filter navigation items by user role
export function getNavItemsForRole(items: NavItem[], userRole: UserRole): NavItem[] {
    return items.filter(item => item.roles.includes(userRole))
}

// Get appropriate navigation based on role
export function getNavigationForRole(role: UserRole): NavItem[] {
    // Platform admins get master nav
    if (['master', 'admin', 'operator'].includes(role)) {
        return masterNavItems
    }
    // Others get client nav filtered by role
    return getNavItemsForRole(clientNavItems, role)
}

// Get home route based on role
export function getHomeRouteForRole(role: UserRole): string {
    if (['master', 'admin', 'operator'].includes(role)) {
        return '/master'
    }
    return '/app'
}
