-- ===========================================
-- Apollo A.I. Advanced - RLS Policies
-- Row Level Security for Multi-Tenancy
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
BEGIN
    RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- TENANTS POLICIES
-- ===========================================

CREATE POLICY "super_admin_all_tenants" ON public.tenants
    FOR ALL USING (is_super_admin());

CREATE POLICY "users_read_own_tenant" ON public.tenants
    FOR SELECT USING (id = get_user_tenant_id());

-- ===========================================
-- PROFILES POLICIES
-- ===========================================

CREATE POLICY "super_admin_all_profiles" ON public.profiles
    FOR ALL USING (is_super_admin());

CREATE POLICY "users_read_tenant_profiles" ON public.profiles
    FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "users_update_own_profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- ===========================================
-- AGENTS POLICIES
-- ===========================================

CREATE POLICY "users_read_tenant_agents" ON public.agents
    FOR SELECT USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "admin_manage_agents" ON public.agents
    FOR ALL USING (tenant_id = get_user_tenant_id() AND get_user_role() IN ('admin', 'super_admin'));

-- ===========================================
-- CONVERSATIONS POLICIES
-- ===========================================

CREATE POLICY "users_read_tenant_conversations" ON public.conversations
    FOR SELECT USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "users_manage_tenant_conversations" ON public.conversations
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- ===========================================
-- MESSAGES POLICIES
-- ===========================================

CREATE POLICY "users_read_tenant_messages" ON public.messages
    FOR SELECT USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "users_insert_messages" ON public.messages
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

-- ===========================================
-- CRM POLICIES
-- ===========================================

CREATE POLICY "users_all_tenant_leads" ON public.crm_leads
    FOR ALL USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "users_all_tenant_stages" ON public.crm_pipeline_stages
    FOR ALL USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ===========================================
-- TOOLS POLICIES
-- ===========================================

CREATE POLICY "users_read_tenant_tools" ON public.tools_config
    FOR SELECT USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "admin_manage_tools" ON public.tools_config
    FOR ALL USING (tenant_id = get_user_tenant_id() AND get_user_role() IN ('admin', 'super_admin'));

-- ===========================================
-- KNOWLEDGE BASE POLICIES
-- ===========================================

CREATE POLICY "users_read_tenant_knowledge" ON public.knowledge_base
    FOR SELECT USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "admin_manage_knowledge" ON public.knowledge_base
    FOR ALL USING (tenant_id = get_user_tenant_id() AND get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "users_read_tenant_chunks" ON public.knowledge_chunks
    FOR SELECT USING (tenant_id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "system_manage_chunks" ON public.knowledge_chunks
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- ===========================================
-- TOKEN USAGE POLICIES
-- ===========================================

CREATE POLICY "admin_read_token_usage" ON public.token_usage
    FOR SELECT USING (
        (tenant_id = get_user_tenant_id() AND get_user_role() IN ('admin', 'manager'))
        OR is_super_admin()
    );
