import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Development fallback credentials
// In production, these should come from environment variables
const DEV_SUPABASE_URL = 'https://qdugrmcdbbqabokmmftl.supabase.co'
const DEV_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdWdybWNkYmJxYWJva21tZnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjUxODksImV4cCI6MjA4MzI0MTE4OX0.FInbgp79XIWeWjBSESvRYj_FLYnvoIUat_3zVzYZ4HI'

// Lazy initialization pattern
let supabaseInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
    if (supabaseInstance) {
        return supabaseInstance
    }

    // Try environment variables first, fall back to dev credentials
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEV_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEV_SUPABASE_ANON_KEY

    console.log('🔗 Supabase connecting to:', supabaseUrl)

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
