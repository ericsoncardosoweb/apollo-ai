-- ===========================================
-- Apollo A.I. Advanced - Enhanced RAG Vector Search
-- SUBSTITUIR a versão anterior (003_rag_search_function.sql)
-- ===========================================

-- Drop old function if exists
DROP FUNCTION IF EXISTS match_knowledge_chunks;

-- ===========================================
-- ENHANCED SEARCH FUNCTION
-- Com ranking, categorias e source attribution
-- ===========================================

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(1536),
    match_tenant_id UUID,
    match_agent_id UUID DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.65,
    match_count INT DEFAULT 10,
    match_categories TEXT[] DEFAULT NULL  -- Filtro por categorias
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    chunk_index INT,
    similarity FLOAT,
    knowledge_base_id UUID,
    source_title TEXT,
    source_type TEXT,
    category TEXT,
    metadata JSONB,
    is_instruction BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Importante para RLS
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kc.id,
        kc.content,
        kc.chunk_index,
        -- Score baseado em similaridade coseno (0-1)
        1 - (kc.embedding <=> query_embedding) AS similarity,
        kc.knowledge_base_id,
        kb.title AS source_title,
        kb.source_type,
        kb.category,
        kc.metadata,
        kb.is_instruction
    FROM public.knowledge_chunks kc
    INNER JOIN public.knowledge_base kb ON kb.id = kc.knowledge_base_id
    WHERE 
        -- ISOLAMENTO OBRIGATÓRIO POR TENANT
        kc.tenant_id = match_tenant_id
        
        -- Status do documento deve ser 'completed'
        AND kb.status = 'completed'
        
        -- Filtro por agente: chunks do agente específico OU chunks globais (agent_id IS NULL)
        AND (match_agent_id IS NULL OR kb.agent_id = match_agent_id OR kb.agent_id IS NULL)
        
        -- Filtro de categorias (se especificado)
        AND (match_categories IS NULL OR kb.category = ANY(match_categories))
        
        -- Threshold de similaridade mínima
        AND 1 - (kc.embedding <=> query_embedding) > match_threshold
        
    ORDER BY 
        -- Prioriza instruções sobre documentos
        kb.is_instruction DESC,
        -- Depois ordena por similaridade
        kc.embedding <=> query_embedding
        
    LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_knowledge_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_chunks TO service_role;


-- ===========================================
-- HYBRID SEARCH (Keyword + Semantic)
-- Combina busca por texto com busca vetorial
-- ===========================================

CREATE OR REPLACE FUNCTION hybrid_knowledge_search(
    query_text TEXT,
    query_embedding vector(1536),
    match_tenant_id UUID,
    match_agent_id UUID DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.6,
    match_count INT DEFAULT 10,
    keyword_weight FLOAT DEFAULT 0.3,  -- Peso da busca por keyword
    semantic_weight FLOAT DEFAULT 0.7   -- Peso da busca semântica
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    chunk_index INT,
    final_score FLOAT,
    semantic_score FLOAT,
    keyword_score FLOAT,
    knowledge_base_id UUID,
    source_title TEXT,
    source_type TEXT,
    is_instruction BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_results AS (
        SELECT 
            kc.id,
            kc.content,
            kc.chunk_index,
            1 - (kc.embedding <=> query_embedding) AS sem_score,
            kc.knowledge_base_id,
            kb.title,
            kb.source_type,
            kb.is_instruction
        FROM public.knowledge_chunks kc
        INNER JOIN public.knowledge_base kb ON kb.id = kc.knowledge_base_id
        WHERE kc.tenant_id = match_tenant_id
            AND kb.status = 'completed'
            AND (match_agent_id IS NULL OR kb.agent_id = match_agent_id OR kb.agent_id IS NULL)
            AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ),
    keyword_results AS (
        SELECT 
            kc.id,
            -- Score baseado em similaridade de trigrama (pg_trgm)
            similarity(kc.content, query_text) AS kw_score
        FROM public.knowledge_chunks kc
        INNER JOIN public.knowledge_base kb ON kb.id = kc.knowledge_base_id
        WHERE kc.tenant_id = match_tenant_id
            AND kb.status = 'completed'
            AND (match_agent_id IS NULL OR kb.agent_id = match_agent_id OR kb.agent_id IS NULL)
            AND kc.content ILIKE '%' || query_text || '%'  -- Busca básica primeiro
    )
    SELECT 
        sr.id,
        sr.content,
        sr.chunk_index,
        -- Score final combinado
        (sr.sem_score * semantic_weight) + (COALESCE(kr.kw_score, 0) * keyword_weight) AS final_score,
        sr.sem_score AS semantic_score,
        COALESCE(kr.kw_score, 0) AS keyword_score,
        sr.knowledge_base_id,
        sr.title AS source_title,
        sr.source_type,
        sr.is_instruction
    FROM semantic_results sr
    LEFT JOIN keyword_results kr ON sr.id = kr.id
    ORDER BY 
        sr.is_instruction DESC,
        (sr.sem_score * semantic_weight) + (COALESCE(kr.kw_score, 0) * keyword_weight) DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION hybrid_knowledge_search TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_knowledge_search TO service_role;


-- ===========================================
-- ADD COLUMNS TO KNOWLEDGE_BASE IF MISSING
-- ===========================================

DO $$ 
BEGIN
    -- Add category column for filtering
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_base' AND column_name = 'category'
    ) THEN
        ALTER TABLE public.knowledge_base ADD COLUMN category VARCHAR(100);
    END IF;
    
    -- Add is_instruction flag (instructions have priority over documents)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_base' AND column_name = 'is_instruction'
    ) THEN
        ALTER TABLE public.knowledge_base ADD COLUMN is_instruction BOOLEAN DEFAULT false;
    END IF;
    
    -- Add priority for manual ordering
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_base' AND column_name = 'priority'
    ) THEN
        ALTER TABLE public.knowledge_base ADD COLUMN priority INTEGER DEFAULT 0;
    END IF;
    
    -- Add tags array for flexible filtering
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_base' AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.knowledge_base ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category 
    ON public.knowledge_base(tenant_id, category);

-- Create index for instruction priority
CREATE INDEX IF NOT EXISTS idx_knowledge_base_instruction 
    ON public.knowledge_base(tenant_id, is_instruction DESC, priority DESC);


-- ===========================================
-- VIEW PARA DEBUG / ADMIN
-- Mostra estatísticas da base de conhecimento por tenant
-- ===========================================

CREATE OR REPLACE VIEW knowledge_stats AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    COUNT(DISTINCT kb.id) AS total_documents,
    COUNT(DISTINCT CASE WHEN kb.is_instruction THEN kb.id END) AS total_instructions,
    COUNT(kc.id) AS total_chunks,
    SUM(CASE WHEN kb.status = 'completed' THEN 1 ELSE 0 END) AS completed_docs,
    SUM(CASE WHEN kb.status = 'failed' THEN 1 ELSE 0 END) AS failed_docs,
    MAX(kb.updated_at) AS last_update
FROM public.tenants t
LEFT JOIN public.knowledge_base kb ON kb.tenant_id = t.id
LEFT JOIN public.knowledge_chunks kc ON kc.knowledge_base_id = kb.id
GROUP BY t.id, t.name;
