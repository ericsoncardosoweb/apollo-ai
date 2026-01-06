# Edge Function Setup - Run Client Migrations

Esta Edge Function permite executar automaticamente as migrações SQL no banco de dados Supabase de cada cliente.

## Deploy da Edge Function

### 1. Instale o Supabase CLI (se ainda não tiver)
```bash
npm install -g supabase
```

### 2. Faça login no Supabase
```bash
supabase login
```

### 3. Link com seu projeto
```bash
cd c:\www\apollo-ia-advanced
supabase link --project-ref SEU_PROJECT_REF
```

### 4. Deploy da Edge Function
```bash
supabase functions deploy run-client-migrations --no-verify-jwt
```

> **Nota:** O `--no-verify-jwt` é necessário porque a função será chamada de forma autenticada via cliente Supabase.

## Configuração de Variáveis de Ambiente

A Edge Function precisa das seguintes variáveis (já configuradas automaticamente):

- `SUPABASE_URL` - URL do seu projeto Supabase (automático)
- `SUPABASE_SERVICE_ROLE_KEY` - Service Key do projeto (automático)

## Como Funciona

1. **Frontend** chama `supabase.functions.invoke('run-client-migrations', { body: { tenant_id } })`
2. **Edge Function** busca as credenciais do cliente na tabela `tenant_database_config`
3. **Edge Function** conecta ao Supabase do cliente via Postgres Pooler
4. **Edge Function** executa o SQL de migração que cria as tabelas do Apollo
5. **Edge Function** atualiza o status de migração no banco master

## Estrutura do SQL Migrado

A Edge Function cria as seguintes tabelas no banco do cliente:

| Tabela | Descrição |
|--------|-----------|
| `services_catalog` | Catálogo de serviços/produtos para IA |
| `leads` | Base de leads do CRM |
| `pipeline_stages` | Etapas do funil de vendas |
| `opportunities` | Oportunidades de negócio |
| `conversations` | Conversas do chat |
| `messages` | Mensagens de cada conversa |
| `knowledge_documents` | Documentos da base de conhecimento |

## Troubleshooting

### Erro: "Configuração do banco não encontrada"
- Verifique se a tabela `tenant_database_config` existe no banco master
- Execute a migration `026_tenant_database_config.sql`

### Erro: "Credenciais incompletas"
- Preencha URL e Service Role Key do cliente no formulário
- A Service Role Key é obrigatória para executar SQL

### Erro de conexão com Postgres
- Verifique se a região do pooler está correta (default: `aws-0-sa-east-1`)
- O project_ref deve estar correto
