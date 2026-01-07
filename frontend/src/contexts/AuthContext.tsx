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
    const fetchProfile = useCallback(async (userId: string, userEmail: string, isRefresh = false): Promise<void> => {
        console.log('🔍 Fetching profile for:', userId, userEmail)

        // Store current profile to preserve on failure
        const currentProfile = profile

        // Create a default profile fallback (only used for brand new users)
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

        const fetchWithRetry = async (attempt = 1): Promise<UserProfile | null> => {
            try {
                // Race the query against a timeout - increased to 15s for slow connections
                const timeoutPromise = new Promise<null>((_, reject) => {
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
                })

                const queryPromise = supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', userId)
                    .single()

                const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>

                if (error) {
                    console.warn(`⚠️ Profile query error (attempt ${attempt}):`, error.message)
                    return null
                }

                return data as UserProfile
            } catch (err) {
                console.warn(`⚠️ Profile fetch failed (attempt ${attempt}):`, err)
                return null
            }
        }

        // Try up to 3 times with exponential backoff
        let fetchedProfile: UserProfile | null = null
        for (let attempt = 1; attempt <= 3; attempt++) {
            fetchedProfile = await fetchWithRetry(attempt)
            if (fetchedProfile) break
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, attempt * 1000))
            }
        }

        if (fetchedProfile) {
            console.log('✅ Profile loaded, role:', fetchedProfile.role)
            setProfile(fetchedProfile)
        } else if (currentProfile && isRefresh) {
            // On refresh failure, keep existing profile - DON'T lose master role!
            console.warn('⚠️ Profile refresh failed, keeping existing profile with role:', currentProfile.role)
            // Profile already set, no change needed
        } else if (currentProfile && currentProfile.id === userId) {
            // Already have profile for this user, keep it
            console.warn('⚠️ Profile fetch failed, keeping existing role:', currentProfile.role)
        } else {
            // First time user or no profile - use default (new users only)
            console.warn('⚠️ No profile found, using default for new user')
            setProfile(defaultProfile)
        }
    }, [profile])

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
            await fetchProfile(user.id, user.email || '', true) // isRefresh=true to preserve role on failure
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
