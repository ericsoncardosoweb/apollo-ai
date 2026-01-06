// Supabase Edge Function: run-client-migrations
// Executa migrações SQL no banco de dados do cliente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SQL das migrações do cliente
const CLIENT_MIGRATIONS_V1 = `
-- APOLLO CLIENT DATABASE - MIGRATION V1

CREATE TABLE IF NOT EXISTS services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'service',
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BRL',
    price_type VARCHAR(50) DEFAULT 'fixed',
    description TEXT,
    short_description VARCHAR(500),
    ai_tags TEXT[] DEFAULT '{}',
    features JSONB DEFAULT '{}',
    category VARCHAR(100),
    embedding_status VARCHAR(50) DEFAULT 'pending',
    embedding_string TEXT,
    last_indexed_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    score INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    position INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    stage_id UUID REFERENCES pipeline_stages(id),
    title VARCHAR(255),
    value DECIMAL(12,2) DEFAULT 0,
    probability INTEGER DEFAULT 50,
    expected_close_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status VARCHAR(50) DEFAULT 'active',
    agent_id UUID,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    sender_type VARCHAR(20),
    content TEXT,
    content_type VARCHAR(50) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    file_url TEXT,
    file_type VARCHAR(50),
    file_size INTEGER,
    chunk_count INTEGER DEFAULT 0,
    embedding_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_lead ON opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services_catalog(is_active);

-- Pipeline stages iniciais
INSERT INTO pipeline_stages (name, color, position) VALUES 
    ('Novo Lead', '#3498db', 0),
    ('Qualificação', '#f39c12', 1),
    ('Proposta', '#9b59b6', 2),
    ('Negociação', '#e74c3c', 3),
    ('Fechado/Ganho', '#27ae60', 4),
    ('Perdido', '#7f8c8d', 5)
ON CONFLICT DO NOTHING;
`;

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { tenant_id } = await req.json()

        if (!tenant_id) {
            throw new Error('tenant_id é obrigatório')
        }

        // 1. Conectar ao Supabase Master para buscar credenciais do cliente
        const masterSupabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Buscar credenciais do tenant
        const { data: config, error: configError } = await masterSupabase
            .from('tenant_database_config')
            .select('supabase_url, supabase_service_key')
            .eq('tenant_id', tenant_id)
            .single()

        if (configError || !config) {
            throw new Error('Configuração do banco não encontrada para este tenant')
        }

        if (!config.supabase_url || !config.supabase_service_key) {
            throw new Error('Credenciais do Supabase do cliente incompletas')
        }

        // 3. Conectar ao banco do cliente usando a API de Management
        // Nota: Para executar SQL arbitrário, usamos a REST API com postgres
        const restUrl = config.supabase_url.replace('.supabase.co', '.supabase.co/rest/v1/rpc/exec_sql')

        // Alternativa: Usar a conexão direta via pg
        // Para isso, precisamos extrair o connection string do projeto

        // Por enquanto, vamos tentar via REST API criando uma função no cliente
        // Primeiro, verificamos se as tabelas existem
        const clientSupabase = createClient(
            config.supabase_url,
            config.supabase_service_key
        )

        // Tentar executar cada statement separadamente
        const statements = CLIENT_MIGRATIONS_V1
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 10 && !s.startsWith('--'))

        // Executar via Supabase Management API (requer access token do projeto)
        // Por enquanto, vamos usar uma abordagem diferente:
        // Chamar a API de SQL execution do Supabase

        const projectRef = config.supabase_url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

        if (!projectRef) {
            throw new Error('Não foi possível extrair o project ref do Supabase URL')
        }

        // Usar a Supabase Management API para executar SQL
        // Isso requer um Personal Access Token ou Service Role Key com permissões elevadas

        // SOLUÇÃO: Usar a conexão postgres direta via pooler
        const poolerUrl = `postgresql://postgres.${projectRef}:${config.supabase_service_key}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`

        // Importar driver postgres para Deno
        const { Pool } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts')

        const pool = new Pool(poolerUrl, 3)
        const connection = await pool.connect()

        try {
            // Executar a migration completa
            await connection.queryObject(CLIENT_MIGRATIONS_V1)

            // Atualizar status no master
            await masterSupabase
                .from('tenant_database_config')
                .update({
                    status: 'active',
                    migrations_version: 1,
                    last_migration_at: new Date().toISOString(),
                    status_message: 'Migrações executadas com sucesso',
                })
                .eq('tenant_id', tenant_id)

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Migrações executadas com sucesso!',
                    tables_created: [
                        'services_catalog',
                        'leads',
                        'pipeline_stages',
                        'opportunities',
                        'conversations',
                        'messages',
                        'knowledge_documents'
                    ]
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } finally {
            connection.release()
            await pool.end()
        }

    } catch (error) {
        console.error('Migration error:', error)

        return new Response(
            JSON.stringify({
                success: false,
                message: error.message || 'Erro ao executar migrações'
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
