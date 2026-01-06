-- ============================================================================
-- APOLLO A.I. ADVANCED - MIGRATION 025
-- Services Catalog para RAG + AI Metadata
-- ============================================================================

-- ============================================================================
-- 1. TABELA SERVICES_CATALOG - Catálogo estruturado para IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Informações básicas
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'service' 
        CHECK (type IN ('product', 'service', 'subscription', 'bundle')),
    
    -- Precificação (crucial para IA não alucinar valores)
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BRL',
    price_type VARCHAR(50) DEFAULT 'fixed' 
        CHECK (price_type IN ('fixed', 'hourly', 'monthly', 'yearly', 'custom')),
    
    -- Conteúdo
    description TEXT,
    short_description VARCHAR(500), -- Para preview
    
    -- AI Tags (palavras-chave semânticas)
    ai_tags TEXT[] DEFAULT '{}', -- ['High Ticket', 'Entrada', 'Recorrente']
    
    -- Propriedades extras (Key-Value dinâmico)
    features JSONB DEFAULT '{}',
    -- Ex: {"duração": "2 horas", "formato": "online", "garantia": "7 dias"}
    
    -- Categorização
    category VARCHAR(100),
    
    -- Embedding/RAG
    embedding_status VARCHAR(50) DEFAULT 'pending' 
        CHECK (embedding_status IN ('pending', 'processing', 'indexed', 'failed')),
    embedding_string TEXT, -- String rica gerada para vetorização
    last_indexed_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false, -- Destacado
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_catalog_tenant ON services_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_catalog_type ON services_catalog(type);
CREATE INDEX IF NOT EXISTS idx_services_catalog_active ON services_catalog(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_catalog_price ON services_catalog(price);

-- Updated_at trigger
CREATE TRIGGER trigger_services_catalog_updated_at
    BEFORE UPDATE ON services_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. FUNÇÃO PARA GERAR EMBEDDING STRING
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_service_embedding_string(
    p_service_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_service services_catalog;
    v_tags TEXT;
    v_features TEXT;
    v_result TEXT;
BEGIN
    SELECT * INTO v_service FROM services_catalog WHERE id = p_service_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Converter tags array para string
    v_tags := array_to_string(v_service.ai_tags, ', ');
    
    -- Converter features JSONB para string legível
    SELECT string_agg(key || ': ' || value::text, ' | ')
    INTO v_features
    FROM jsonb_each_text(v_service.features);
    
    -- Montar string rica para embedding
    v_result := format(
        'Tipo: %s | Nome: %s | Valor: %s %s | Categoria: %s | Tags: %s | Descrição: %s | Detalhes: %s',
        v_service.type,
        v_service.name,
        v_service.currency,
        v_service.price::TEXT,
        COALESCE(v_service.category, 'Geral'),
        COALESCE(v_tags, 'Nenhuma'),
        COALESCE(v_service.description, ''),
        COALESCE(v_features, '')
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TRIGGER PARA ATUALIZAR EMBEDDING STRING
-- ============================================================================

CREATE OR REPLACE FUNCTION update_service_embedding_string()
RETURNS TRIGGER AS $$
BEGIN
    -- Gerar a string rica automaticamente
    NEW.embedding_string := generate_service_embedding_string(NEW.id);
    NEW.embedding_status := 'pending'; -- Marcar para reindexação
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_service_embedding_string
    BEFORE INSERT OR UPDATE ON services_catalog
    FOR EACH ROW
    WHEN (NEW.embedding_string IS NULL OR 
          OLD.name IS DISTINCT FROM NEW.name OR
          OLD.price IS DISTINCT FROM NEW.price OR
          OLD.description IS DISTINCT FROM NEW.description OR
          OLD.ai_tags IS DISTINCT FROM NEW.ai_tags OR
          OLD.features IS DISTINCT FROM NEW.features)
    EXECUTE FUNCTION update_service_embedding_string();

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE services_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_catalog_tenant_isolation" ON services_catalog
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('master', 'admin', 'operator')
    );

-- ============================================================================
-- 5. DADOS DE EXEMPLO (SEED)
-- ============================================================================

-- Função para criar catálogo de exemplo para um tenant
CREATE OR REPLACE FUNCTION seed_example_catalog(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO services_catalog (tenant_id, name, type, price, description, ai_tags, features, category)
    VALUES 
        (p_tenant_id, 'Consultoria Individual', 'service', 500.00, 
         'Sessão de consultoria individual de 1 hora focada em estratégias de crescimento.',
         ARRAY['Premium', 'Individual', 'Estratégia'],
         '{"duração": "1 hora", "formato": "online", "inclui_gravação": "sim"}',
         'Consultoria'),
         
        (p_tenant_id, 'Mentoria Mensal', 'subscription', 1500.00,
         'Acompanhamento mensal com 4 encontros semanais e suporte via WhatsApp.',
         ARRAY['Recorrente', 'High Ticket', 'VIP'],
         '{"encontros_por_mês": "4", "suporte_whatsapp": "ilimitado", "duração_contrato": "3 meses"}',
         'Mentoria'),
         
        (p_tenant_id, 'Curso Online', 'product', 297.00,
         'Curso completo em vídeo com mais de 20 horas de conteúdo prático.',
         ARRAY['Entrada', 'Escalável', 'Evergreen'],
         '{"horas_de_conteúdo": "20+", "acesso": "vitalício", "certificado": "sim"}',
         'Cursos')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
