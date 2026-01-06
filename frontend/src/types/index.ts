/**
 * Apollo A.I. Advanced - Type Definitions
 */

// User roles in the system
export type UserRole = 'admin' | 'client' | 'operator'

// User profile from database
export interface UserProfile {
    id: string
    email: string
    name: string | null
    role: UserRole
    tenant_id: string | null
    avatar_url: string | null
    created_at: string
    updated_at: string
}

// Tenant/Company information
export interface Tenant {
    id: string
    name: string
    slug: string
    plan: 'starter' | 'pro' | 'enterprise'
    whatsapp_number: string | null
    is_active: boolean
    created_at: string
}

// Navigation item for dynamic sidebar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface NavItem {
    label: string
    href: string
    icon: React.ComponentType<any> // Allow any icon component
    description?: string
    roles: UserRole[] // Which roles can see this item
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
    is_typing: boolean // Buffer Ativo
    is_spy_mode: boolean // Modo Espião ativo
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

// Inbox state
export interface InboxState {
    conversations: Conversation[]
    selectedConversation: Conversation | null
    messages: ChatMessage[]
    isSpyMode: boolean
    isPanicMode: boolean
}
