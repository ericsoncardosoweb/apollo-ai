import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'

interface Tenant {
    id: string
    name: string
    slug: string
    plan: string
    primaryColor: string
    logoUrl?: string
}

interface TenantContextType {
    tenant: Tenant | null
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTenant = async () => {
        try {
            setLoading(true)
            setError(null)
            const { data } = await api.get('/tenants/me')
            setTenant(data)
        } catch (err) {
            setError('Failed to load tenant information')
            console.error('Tenant fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTenant()
    }, [])

    return (
        <TenantContext.Provider value={{ tenant, loading, error, refetch: fetchTenant }}>
            {children}
        </TenantContext.Provider>
    )
}

export function useTenant() {
    const context = useContext(TenantContext)
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider')
    }
    return context
}
