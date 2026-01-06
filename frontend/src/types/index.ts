/**
 * Apollo A.I. Advanced - Type Definitions
 * Comprehensive role-based multi-tenant system
 */

// Platform-level roles (for platform staff)
export type PlatformRole = 'master' | 'admin' | 'operator'

// Company-level roles (for company members)
export type CompanyRole = 'owner' | 'manager' | 'attendant'

// Combined user role
export type UserRole = PlatformRole | 'client' | 'attendant'

// User profile from database
export interface UserProfile {
    id: string
    email: string
    name: string | null
    role: UserRole
    tenant_id: string | null
    avatar_url: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

// Company/Tenant information
export interface Company {
    id: string
    name: string
    slug: string
    plan: 'starter' | 'pro' | 'enterprise'
    whatsapp_number: string | null
    owner_id: string | null
    is_active: boolean
    created_at: string
}

// Company membership
export interface CompanyMember {
    id: string
    user_id: string
    company_id: string
    role: CompanyRole
    is_active: boolean
    created_at: string
}

// View context - determines which interface to show
export type ViewContext = 'platform' | 'company'

// Navigation item for dynamic sidebar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface NavItem {
    label: string
    href: string
    icon: React.ComponentType<any>
    description?: string
    roles: UserRole[]
    badge?: string | number
}

// Conversation in Inbox
export interface Conversation {
    id: string
    contact_name: string
    contact_phone: string
    contact_avatar?: string
    last_message: string
    last_message_at: string
    unread_count: number
    agent_name: string
    status: 'active' | 'waiting' | 'closed'
    is_typing: boolean
    is_spy_mode: boolean
}

// Chat message
export interface ChatMessage {
    id: string
    conversation_id: string
    sender: 'contact' | 'agent' | 'operator'
    content: string
    content_type: 'text' | 'image' | 'audio' | 'document'
    sent_at: string
    is_read: boolean
}

// Helper functions
export function isPlatformAdmin(role: UserRole): boolean {
    return ['master', 'admin', 'operator'].includes(role)
}

export function canManageCompanies(role: UserRole): boolean {
    return ['master', 'admin', 'operator'].includes(role)
}

export function canManageUsers(role: UserRole): boolean {
    return ['master', 'admin'].includes(role)
}

export function canAccessPlatformSettings(role: UserRole): boolean {
    return ['master', 'admin'].includes(role)
}
