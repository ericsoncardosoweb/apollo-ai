-- =====================================================
-- Apollo A.I. Advanced - RLS Policies
-- Execute AFTER 010_user_profiles_and_roles.sql (Part 2)
-- =====================================================

-- =====================================================
-- RLS Policies for user_profiles
-- =====================================================

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Platform admins can read all profiles
DROP POLICY IF EXISTS "Platform admins can read all profiles" ON public.user_profiles;
CREATE POLICY "Platform admins can read all profiles" ON public.user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin', 'operator')
        )
    );

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow insert for new users (trigger creates profile)
DROP POLICY IF EXISTS "Allow profile creation" ON public.user_profiles;
CREATE POLICY "Allow profile creation" ON public.user_profiles
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- RLS Policies for companies
-- =====================================================

-- Platform admins can see all companies
DROP POLICY IF EXISTS "Platform admins can read all companies" ON public.companies;
CREATE POLICY "Platform admins can read all companies" ON public.companies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin', 'operator')
        )
    );

-- Company members can see their company
DROP POLICY IF EXISTS "Members can read their company" ON public.companies;
CREATE POLICY "Members can read their company" ON public.companies
    FOR SELECT USING (
        id IN (
            SELECT company_id FROM public.company_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Platform admins can create companies
DROP POLICY IF EXISTS "Admins can create companies" ON public.companies;
CREATE POLICY "Admins can create companies" ON public.companies
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin', 'operator')
        )
    );

-- Platform admins can update companies
DROP POLICY IF EXISTS "Admins can update companies" ON public.companies;
CREATE POLICY "Admins can update companies" ON public.companies
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin', 'operator')
        )
    );

-- =====================================================
-- RLS Policies for company_members
-- =====================================================

-- Platform admins can see all members
DROP POLICY IF EXISTS "Platform admins can read all members" ON public.company_members;
CREATE POLICY "Platform admins can read all members" ON public.company_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin', 'operator')
        )
    );

-- Users can see their own memberships
DROP POLICY IF EXISTS "Users can see own memberships" ON public.company_members;
CREATE POLICY "Users can see own memberships" ON public.company_members
    FOR SELECT USING (user_id = auth.uid());

-- Company owners can manage members
DROP POLICY IF EXISTS "Owners can manage members" ON public.company_members;
CREATE POLICY "Owners can manage members" ON public.company_members
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM public.company_members 
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Platform admins can manage all members
DROP POLICY IF EXISTS "Admins can manage all members" ON public.company_members;
CREATE POLICY "Admins can manage all members" ON public.company_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin', 'operator')
        )
    );
