-- =====================================================
-- Apollo A.I. Advanced - Plans & Billing Schema
-- Execute in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PLANS TABLE (SaaS Subscription Plans)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    billing_period VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    features JSONB DEFAULT '[]',
    max_agents INTEGER DEFAULT 1,
    max_conversations_month INTEGER DEFAULT 1000,
    max_messages_month INTEGER DEFAULT 10000,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER trigger_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone can read active plans
CREATE POLICY "Anyone can read active plans" ON public.plans
    FOR SELECT USING (is_active = true);

-- RLS: Platform admins can manage plans
CREATE POLICY "Platform admins can manage plans" ON public.plans
    FOR ALL USING (is_platform_admin());

-- =====================================================
-- SEED DEFAULT PLANS
-- =====================================================

INSERT INTO public.plans (name, slug, description, price, features, max_agents, max_conversations_month, max_messages_month, sort_order)
VALUES 
    ('Basic', 'basic', 'Plano inicial para pequenas empresas', 97.00, 
     '["1 Agente IA", "500 conversas/mês", "5.000 mensagens/mês", "Suporte por email"]'::jsonb,
     1, 500, 5000, 1),
    ('Pro', 'pro', 'Plano profissional para empresas em crescimento', 297.00,
     '["3 Agentes IA", "2.000 conversas/mês", "20.000 mensagens/mês", "RAG/Knowledge Base", "Suporte prioritário"]'::jsonb,
     3, 2000, 20000, 2),
    ('Enterprise', 'enterprise', 'Plano corporativo com recursos ilimitados', 997.00,
     '["Agentes ilimitados", "Conversas ilimitadas", "Mensagens ilimitadas", "RAG avançado", "API completa", "Suporte 24/7", "Onboarding dedicado"]'::jsonb,
     999, 999999, 999999, 3)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- UPDATE TENANTS TABLE
-- =====================================================

-- Add plan_id FK
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);

-- Add custom_price (overrides plan price when set)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS custom_price DECIMAL(10,2) DEFAULT NULL;

-- Add stage for onboarding pipeline
DO $$ BEGIN
    CREATE TYPE tenant_stage AS ENUM ('onboarding', 'implementation', 'published', 'cancelled', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS stage tenant_stage DEFAULT 'onboarding';

-- Add internal_notes for rich text notes
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT NULL;

-- Add responsible_user_id (primary contact)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES auth.users(id);

-- Set default plan for existing tenants
UPDATE public.tenants 
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'basic' LIMIT 1)
WHERE plan_id IS NULL;

-- =====================================================
-- MRR CALCULATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_mrr()
RETURNS DECIMAL AS $$
DECLARE
    total_mrr DECIMAL;
BEGIN
    SELECT COALESCE(SUM(
        COALESCE(t.custom_price, p.price)
    ), 0)
    INTO total_mrr
    FROM public.tenants t
    LEFT JOIN public.plans p ON t.plan_id = p.id
    WHERE t.status = 'active';
    
    RETURN total_mrr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- GET TENANTS BY STAGE (for Kanban)
-- =====================================================

CREATE OR REPLACE FUNCTION get_tenants_by_stage()
RETURNS TABLE (
    stage tenant_stage,
    tenants JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.stage,
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'name', t.name,
                'slug', t.slug,
                'status', t.status,
                'plan_name', p.name,
                'price', COALESCE(t.custom_price, p.price),
                'created_at', t.created_at
            ) ORDER BY t.created_at DESC
        ) as tenants
    FROM public.tenants t
    LEFT JOIN public.plans p ON t.plan_id = p.id
    GROUP BY t.stage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- MASTER DASHBOARD STATS
-- =====================================================

CREATE OR REPLACE FUNCTION get_master_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    active_count INTEGER;
    operator_count INTEGER;
    best_seller_plan VARCHAR;
    mrr_value DECIMAL;
BEGIN
    -- Active companies
    SELECT COUNT(*) INTO active_count
    FROM public.tenants WHERE status = 'active';
    
    -- Operators count
    SELECT COUNT(*) INTO operator_count
    FROM public.user_profiles WHERE role IN ('admin', 'operator');
    
    -- Best seller plan
    SELECT p.name INTO best_seller_plan
    FROM public.tenants t
    JOIN public.plans p ON t.plan_id = p.id
    WHERE t.status = 'active'
    GROUP BY p.id, p.name
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    -- MRR
    mrr_value := calculate_mrr();
    
    result := jsonb_build_object(
        'active_companies', active_count,
        'operators_count', operator_count,
        'best_seller_plan', COALESCE(best_seller_plan, 'N/A'),
        'mrr', mrr_value
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
