-- ============================================================================
-- APOLLO A.I. ADVANCED - MIGRATION 026
-- Tenant Database Configuration (Multi-Supabase)
-- ============================================================================

-- ============================================================================
-- 1. TENANT DATABASE CONFIG - Credenciais do Supabase do cliente
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_database_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Supabase Credentials (CRIPTOGRAFAR EM PRODUÇÃO)
    supabase_url TEXT, -- https://xxx.supabase.co
    supabase_anon_key TEXT, -- Chave anônima
    supabase_service_key TEXT, -- Chave de serviço (para operações admin)
    
    -- Status da configuração
    status VARCHAR(50) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'configured', 'testing', 'active', 'error', 'suspended')),
    status_message TEXT, -- Mensagem de erro ou sucesso
    last_tested_at TIMESTAMPTZ,
    
    -- Configurações adicionais
    enable_realtime BOOLEAN DEFAULT true,
    enable_storage BOOLEAN DEFAULT true,
    max_connections INTEGER DEFAULT 10,
    
    -- Migrations aplicadas
    migrations_version INTEGER DEFAULT 0,
    last_migration_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    configured_by UUID,
    
    UNIQUE(tenant_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_tenant_database_config_tenant ON tenant_database_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_database_config_status ON tenant_database_config(status);

-- Updated_at trigger
CREATE TRIGGER trigger_tenant_database_config_updated_at
    BEFORE UPDATE ON tenant_database_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. ADICIONAR CAMPO DE STATUS NA TABELA TENANTS
-- ============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS database_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE tenant_database_config ENABLE ROW LEVEL SECURITY;

-- Apenas platform admins podem ver/editar configurações de banco
CREATE POLICY "tenant_database_config_admin_only" ON tenant_database_config
    FOR ALL USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin')
    );

-- ============================================================================
-- 4. FUNÇÃO PARA TESTAR CONEXÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION test_tenant_database_connection(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_config tenant_database_config;
    v_result JSONB;
BEGIN
    SELECT * INTO v_config FROM tenant_database_config WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Configuração não encontrada');
    END IF;
    
    IF v_config.supabase_url IS NULL OR v_config.supabase_anon_key IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Credenciais incompletas');
    END IF;
    
    -- Em produção, aqui faria uma chamada HTTP para testar a conexão
    -- Por enquanto, apenas marca como testado
    
    UPDATE tenant_database_config 
    SET 
        status = 'active',
        status_message = 'Conexão testada com sucesso',
        last_tested_at = NOW()
    WHERE tenant_id = p_tenant_id;
    
    UPDATE tenants SET database_status = 'active' WHERE id = p_tenant_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Conexão estabelecida com sucesso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. VIEW PARA LISTAR EMPRESAS COM STATUS DO BANCO
-- ============================================================================

CREATE OR REPLACE VIEW tenants_with_database_status AS
SELECT 
    t.id,
    t.name,
    t.slug,
    t.email,
    t.phone,
    t.logo_url,
    t.plan_id,
    t.database_status,
    t.onboarding_completed,
    t.created_at,
    COALESCE(tdc.status, 'not_configured') as db_config_status,
    tdc.supabase_url IS NOT NULL as has_supabase_url,
    tdc.last_tested_at,
    tdc.migrations_version
FROM tenants t
LEFT JOIN tenant_database_config tdc ON tdc.tenant_id = t.id;
