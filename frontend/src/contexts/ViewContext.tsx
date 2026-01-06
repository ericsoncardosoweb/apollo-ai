/**
 * View Context - Manages platform/company view switching
 * Platform admins can switch between platform view and company (client) view
 * Company selection is persisted to localStorage for page reloads
 */

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Company, ViewContext, isPlatformAdmin } from '@/types'
import { useAuth } from './AuthContext'

// LocalStorage key for persistence
const STORAGE_KEY = 'apollo_selected_company'
const VIEW_CONTEXT_KEY = 'apollo_view_context'

// Load company from localStorage
const loadStoredCompany = (): Company | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : null
    } catch {
        return null
    }
}

// Load view context from localStorage
const loadStoredViewContext = (): ViewContext => {
    try {
        const stored = localStorage.getItem(VIEW_CONTEXT_KEY)
        return (stored === 'company' || stored === 'platform') ? stored : 'platform'
    } catch {
        return 'platform'
    }
}

interface ViewContextType {
    // Current view mode
    viewContext: ViewContext
    setViewContext: (context: ViewContext) => void

    // Selected company (when in company view)
    selectedCompany: Company | null
    setSelectedCompany: (company: Company | null) => void

    // Available companies for platform admins
    companies: Company[]
    loadingCompanies: boolean

    // Helper methods
    switchToCompanyView: (company: Company) => void
    switchToPlatformView: () => void
    isInCompanyView: boolean
    isInPlatformView: boolean

    // Refresh companies list
    refreshCompanies: () => Promise<void>
}

const ViewContextContext = createContext<ViewContextType | undefined>(undefined)

export function ViewContextProvider({ children }: { children: ReactNode }) {
    const { role, user } = useAuth()

    // Initialize from localStorage for persistence across page reloads
    const [viewContext, setViewContextState] = useState<ViewContext>(() => {
        if (typeof window !== 'undefined') {
            return loadStoredViewContext()
        }
        return 'platform'
    })

    const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(() => {
        if (typeof window !== 'undefined') {
            return loadStoredCompany()
        }
        return null
    })

    const [companies, setCompanies] = useState<Company[]>([])
    const [loadingCompanies, setLoadingCompanies] = useState(false)

    // Wrapped setters that persist to localStorage
    const setViewContext = useCallback((context: ViewContext) => {
        setViewContextState(context)
        try {
            localStorage.setItem(VIEW_CONTEXT_KEY, context)
        } catch (e) {
            console.warn('Failed to save view context to localStorage:', e)
        }
    }, [])

    const setSelectedCompany = useCallback((company: Company | null) => {
        setSelectedCompanyState(company)
        try {
            if (company) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(company))
            } else {
                localStorage.removeItem(STORAGE_KEY)
            }
        } catch (e) {
            console.warn('Failed to save company to localStorage:', e)
        }
    }, [])

    // Fetch all companies for platform admins - now using tenants table
    const fetchCompanies = useCallback(async () => {
        if (!user || !isPlatformAdmin(role)) {
            setCompanies([])
            return
        }

        console.log('📦 Fetching companies for platform admin...')
        setLoadingCompanies(true)

        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('status', 'active')
                .order('name')

            console.log('📦 Companies result:', { data, error })

            if (error) {
                console.warn('⚠️ Error fetching companies:', error.message)
                // Don't use mock data in production - show empty state
                setCompanies([])
            } else {
                // Map tenants to Company interface
                const mappedCompanies: Company[] = (data || []).map(tenant => ({
                    id: tenant.id,
                    name: tenant.name,
                    slug: tenant.slug,
                    plan: tenant.plan || 'starter',
                    whatsapp_number: tenant.whatsapp || null,
                    owner_id: null,
                    is_active: tenant.status === 'active',
                    created_at: tenant.created_at,
                }))
                setCompanies(mappedCompanies)
            }
        } catch (err) {
            console.error('❌ Error fetching companies:', err)
            setCompanies([])
        } finally {
            setLoadingCompanies(false)
        }
    }, [user, role])

    // Load companies when user/role changes
    useEffect(() => {
        if (isPlatformAdmin(role)) {
            fetchCompanies()
        } else {
            // Non-platform users go directly to company view
            setViewContext('company')
        }
    }, [role, fetchCompanies, setViewContext])

    // Switch to company view
    const switchToCompanyView = useCallback((company: Company) => {
        setSelectedCompany(company)
        setViewContext('company')
    }, [setSelectedCompany, setViewContext])

    // Switch back to platform view
    const switchToPlatformView = useCallback(() => {
        setSelectedCompany(null)
        setViewContext('platform')
    }, [setSelectedCompany, setViewContext])

    // Clear localStorage on logout
    useEffect(() => {
        if (!user) {
            try {
                localStorage.removeItem(STORAGE_KEY)
                localStorage.removeItem(VIEW_CONTEXT_KEY)
            } catch (e) {
                console.warn('Failed to clear localStorage on logout:', e)
            }
            setSelectedCompanyState(null)
            setViewContextState('platform')
        }
    }, [user])

    return (
        <ViewContextContext.Provider value={{
            viewContext,
            setViewContext,
            selectedCompany,
            setSelectedCompany,
            companies,
            loadingCompanies,
            switchToCompanyView,
            switchToPlatformView,
            isInCompanyView: viewContext === 'company',
            isInPlatformView: viewContext === 'platform',
            refreshCompanies: fetchCompanies,
        }}>
            {children}
        </ViewContextContext.Provider>
    )
}

export function useViewContext() {
    const context = useContext(ViewContextContext)
    if (context === undefined) {
        throw new Error('useViewContext must be used within a ViewContextProvider')
    }
    return context
}
