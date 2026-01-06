-- ===========================================
-- Apollo A.I. Advanced - Master Database Schema
-- ===========================================
-- This runs on YOUR Supabase (master) not the client's
-- ===========================================

-- ===========================================
-- TENANTS TABLE (Core)
-- ===========================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'trial')),
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    
    -- WhatsApp Configuration
    whatsapp_gateway TEXT CHECK (whatsapp_gateway IN ('evolution', 'zapi', 'meta', 'uazapi')),
    whatsapp_instance_id TEXT,
    whatsapp_api_key TEXT,
    whatsapp_phone TEXT,
    
    -- Limits
    max_agents INTEGER DEFAULT 1,
    max_conversations_month INTEGER DEFAULT 500,
    max_tokens_month INTEGER DEFAULT 100000,
    
    -- Metadata
    owner_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for slug lookup (webhook routing)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);


-- ===========================================
-- TENANT DATABASE CONFIG (Multi-tenant BYODB)
-- ===========================================
-- Stores credentials for each tenant's own Supabase
-- Credentials are encrypted with Fernet

CREATE TABLE IF NOT EXISTS tenant_database_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Supabase Credentials (encrypted)
    supabase_url TEXT NOT NULL,
    supabase_anon_key TEXT,  -- Can be encrypted
    supabase_service_key TEXT,  -- Should be encrypted
    
    -- Connection Status
    connection_status TEXT DEFAULT 'pending' CHECK (connection_status IN ('pending', 'connected', 'error', 'migrating')),
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Schema Versioning
    migrations_version INTEGER DEFAULT 0,
    last_migration_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_db_config_tenant ON tenant_database_config(tenant_id);


-- ===========================================
-- USER PROFILES (Master Auth)
-- ===========================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,  -- Supabase auth.users.id
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    
    email TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'agent' CHECK (role IN ('super_admin', 'admin', 'manager', 'agent')),
    
    -- Permissions (JSON object)
    permissions JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);


-- ===========================================
-- UPLOADS (Temporary File Storage)
-- ===========================================

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content_type TEXT,
    file_size INTEGER,
    
    -- Retention
    expires_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_tenant ON uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uploads_expires ON uploads(expires_at) WHERE is_deleted = false;


-- ===========================================
-- PLANS & BILLING (Future)
-- ===========================================

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    
    -- Limits
    max_agents INTEGER DEFAULT 1,
    max_conversations_month INTEGER DEFAULT 500,
    max_tokens_month INTEGER DEFAULT 100000,
    max_knowledge_docs INTEGER DEFAULT 10,
    
    -- Pricing
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, slug, max_agents, max_conversations_month, max_tokens_month, price_monthly)
VALUES 
    ('Free', 'free', 1, 500, 100000, 0),
    ('Starter', 'starter', 3, 2000, 500000, 97),
    ('Pro', 'pro', 10, 10000, 2000000, 297),
    ('Enterprise', 'enterprise', -1, -1, -1, 997)
ON CONFLICT (slug) DO NOTHING;


-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_database_config_updated_at ON tenant_database_config;
CREATE TRIGGER update_tenant_database_config_updated_at
    BEFORE UPDATE ON tenant_database_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
