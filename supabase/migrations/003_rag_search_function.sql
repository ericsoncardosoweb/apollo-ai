-- ===========================================
-- Apollo A.I. Advanced - RAG Vector Search Function
-- Run this in Supabase SQL Editor
-- ===========================================

-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(1536),
    match_tenant_id UUID,
    match_agent_id UUID DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    chunk_index INT,
    similarity FLOAT,
    knowledge_base_id UUID,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kc.id,
        kc.content,
        kc.chunk_index,
        1 - (kc.embedding <=> query_embedding) AS similarity,
        kc.knowledge_base_id,
        kc.metadata
    FROM public.knowledge_chunks kc
    INNER JOIN public.knowledge_base kb ON kb.id = kc.knowledge_base_id
    WHERE kc.tenant_id = match_tenant_id
        AND kb.status = 'completed'
        AND (match_agent_id IS NULL OR kb.agent_id = match_agent_id OR kb.agent_id IS NULL)
        AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_knowledge_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_chunks TO service_role;
