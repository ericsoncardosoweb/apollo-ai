import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { UserRole, UserProfile, isPlatformAdmin } from '@/types'

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: UserProfile | null
    role: UserRole
    loading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, name: string) => Promise<void>
    signOut: () => Promise<void>
    resetPassword: (email: string) => Promise<void>
    updatePassword: (newPassword: string) => Promise<void>
    refreshProfile: () => Promise<void>
    // Role helpers
    isMaster: boolean
    isAdmin: boolean
    isOperator: boolean
    isPlatformAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch user profile with role from database - with timeout to prevent infinite hang
    const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<void> => {
        console.log('🔍 Fetching profile for:', userId, userEmail)

        // Create a default profile fallback
        const defaultProfile: UserProfile = {
            id: userId,
            email: userEmail,
            name: null,
            role: 'client',
            tenant_id: null,
            avatar_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        try {
            // Race the query against a timeout to prevent infinite loading
            const timeoutPromise = new Promise<null>((_, reject) => {
                setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
            })

            const queryPromise = supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single()

            const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>

            console.log('📊 Profile query result:', { data, error })

            if (error) {
                console.warn('⚠️ Profile not found, using default:', error.message)
                setProfile(defaultProfile)
                return
            }

            console.log('✅ Profile loaded, role:', data.role)
            setProfile(data as UserProfile)
        } catch (err) {
            console.error('❌ Error fetching profile (using default):', err)
            // Set default profile on any error (including timeout)
            setProfile(defaultProfile)
        }
    }, [])

    useEffect(() => {
        // Get initial session
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                setSession(session)
                setUser(session?.user ?? null)

                if (session?.user) {
                    // IMPORTANT: Await the profile fetch to ensure role is loaded before routing
                    await fetchProfile(session.user.id, session.user.email || '')
                }
            } catch (err) {
                console.error('❌ Error getting session:', err)
            } finally {
                setLoading(false)
            }
        }

        initSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session)
                setUser(session?.user ?? null)

                if (session?.user) {
                    await fetchProfile(session.user.id, session.user.email || '')
                } else {
                    setProfile(null)
                }

                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [fetchProfile])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
    }

    const signUp = async (email: string, password: string, name: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name }
            }
        })
        if (error) throw error
        // Profile will be created by database trigger
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setProfile(null)
    }

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
    }

    const updatePassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error
    }

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id, user.email || '')
        }
    }

    // Computed role properties
    const role: UserRole = profile?.role || 'client'
    const isMaster = role === 'master'
    const isAdmin = role === 'admin'
    const isOperator = role === 'operator'
    const isPlatformAdminUser = isPlatformAdmin(role)

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            role,
            loading,
            signIn,
            signUp,
            signOut,
            resetPassword,
            updatePassword,
            refreshProfile,
            isMaster,
            isAdmin,
            isOperator,
            isPlatformAdmin: isPlatformAdminUser,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
