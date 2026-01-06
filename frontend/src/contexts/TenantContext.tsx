import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Company } from '@/types'

interface TenantContextType {
    tenant: Company | null
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

// Mock tenant for development when API is not available
const mockTenant: Company = {
    id: 'mock-tenant-id',
    name: 'Empresa Demo',
    slug: 'empresa-demo',
    plan: 'pro',
    whatsapp_number: '+55 11 99999-9999',
    owner_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
}

export function TenantProvider({ children }: { children: ReactNode }) {
    const [tenant, setTenant] = useState<Company | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTenant = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const { data } = await api.get('/tenants/me')
            setTenant(data)
        } catch (err) {
            console.warn('Tenant API not available, using mock data')
            // Use mock tenant for development
            setTenant(mockTenant)
            setError(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTenant()
    }, [fetchTenant])

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
