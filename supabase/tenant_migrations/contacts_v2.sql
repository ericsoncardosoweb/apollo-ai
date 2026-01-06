-- ============================================================================
-- CONTACTS V2 - Rich Contact Management System
-- Run on tenant database
-- ============================================================================

-- 1. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50), -- Normalized: +5511999999999
    
    -- Brazilian Documents
    cpf VARCHAR(14),
    cnpj VARCHAR(18),
    
    -- Classification
    type VARCHAR(20) DEFAULT 'lead' CHECK (type IN ('lead', 'customer', 'supplier', 'partner', 'other')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    tags TEXT[] DEFAULT '{}',
    
    -- Enrichment
    source VARCHAR(100), -- website, whatsapp, import, manual, api
    avatar_url TEXT,
    notes TEXT,
    
    -- Address
    address_street VARCHAR(255),
    address_number VARCHAR(20),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zipcode VARCHAR(10),
    
    -- Company info (for B2B)
    company_name VARCHAR(255),
    company_role VARCHAR(100),
    
    -- Custom fields (flexible schema for import extras)
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp ON contacts(whatsapp) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_cpf ON contacts(cpf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_cnpj ON contacts(cnpj) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- 3. RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_all" ON contacts;
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true) WITH CHECK (true);

-- 4. CONTACT TAGS TABLE (for tag management)
CREATE TABLE IF NOT EXISTS contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#868e96',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_tags_all" ON contact_tags;
CREATE POLICY "contact_tags_all" ON contact_tags FOR ALL USING (true) WITH CHECK (true);

-- 5. DEFAULT TAGS
INSERT INTO contact_tags (name, color, description) VALUES
    ('lead', '#fab005', 'Potencial cliente'),
    ('cliente', '#40c057', 'Cliente ativo'),
    ('vip', '#7950f2', 'Cliente VIP'),
    ('inativo', '#868e96', 'Contato inativo'),
    ('interessado', '#228be6', 'Demonstrou interesse')
ON CONFLICT (name) DO NOTHING;

-- 6. IMPORT HISTORY TABLE (for tracking imports)
CREATE TABLE IF NOT EXISTS contact_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255),
    total_rows INT DEFAULT 0,
    imported_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    default_tag VARCHAR(100),
    field_mapping JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE contact_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_imports_all" ON contact_imports;
CREATE POLICY "contact_imports_all" ON contact_imports FOR ALL USING (true) WITH CHECK (true);

-- DONE!
