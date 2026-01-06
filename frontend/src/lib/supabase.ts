import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization pattern for development
let supabaseInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
    if (supabaseInstance) {
        return supabaseInstance
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase environment variables not configured. Authentication will not work.')
        console.warn('Please create a .env file in the frontend directory with:')
        console.warn('  VITE_SUPABASE_URL=https://your-project.supabase.co')
        console.warn('  VITE_SUPABASE_ANON_KEY=your-anon-key')

        // Return a mock client for development
        supabaseInstance = createClient(
            'https://placeholder.supabase.co',
            'placeholder-key',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )
        return supabaseInstance
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    })

    return supabaseInstance
}

export const supabase = getSupabaseClient()
