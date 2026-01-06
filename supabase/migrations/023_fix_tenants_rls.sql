-- =====================================================
-- Apollo A.I. Advanced - Fix Tenants RLS Policies
-- Adds INSERT/UPDATE permissions for platform admins
-- Execute in Supabase SQL Editor
-- =====================================================

-- Drop ALL existing policies on tenants first
DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "platform_admins_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "platform_admins_insert_tenants" ON public.tenants;
DROP POLICY IF EXISTS "platform_admins_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "platform_admins_delete_tenants" ON public.tenants;

-- Helper function to check if user is platform admin (uses user_profiles table)
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('master', 'admin', 'operator')
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- TENANTS POLICIES - Allow platform admins full access
-- =====================================================

-- Platform admins can read all tenants
CREATE POLICY "platform_admins_read_tenants" ON public.tenants
    FOR SELECT USING (is_platform_admin() OR is_super_admin());

-- Platform admins can create tenants
CREATE POLICY "platform_admins_insert_tenants" ON public.tenants
    FOR INSERT WITH CHECK (is_platform_admin() OR is_super_admin());

-- Platform admins can update tenants
CREATE POLICY "platform_admins_update_tenants" ON public.tenants
    FOR UPDATE USING (is_platform_admin() OR is_super_admin());

-- Platform admins can delete tenants
CREATE POLICY "platform_admins_delete_tenants" ON public.tenants
    FOR DELETE USING (is_platform_admin() OR is_super_admin());

-- Users can read their own tenant
CREATE POLICY "users_read_own_tenant" ON public.tenants
    FOR SELECT USING (id = get_user_tenant_id());
