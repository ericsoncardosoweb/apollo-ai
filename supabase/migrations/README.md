# Apollo A.I. Advanced - Migrations SQL

Execute estes scripts no Supabase SQL Editor **na ordem numérica**.

## ⚠️ Pré-requisitos

Antes de executar estas migrations, verifique se as tabelas base já existem:
- `tenants`
- `agents`
- `crm_leads`
- `crm_pipeline_stages`
- `conversations`
- `messages`
- `tools_config`
- `user_profiles`

## 📋 Ordem de Execução

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `020_agents_complete.sql` | Expande agents com sub-agents, templates, tests, memory |
| 2 | `021_crm_complete.sql` | Custom fields do CRM, activity log, pipeline stages |
| 3 | `022_tools_system.sql` | Sistema de Tools (7 built-in), execution log |

## 🚀 Como Executar

1. Acesse o **Supabase Dashboard** → SQL Editor
2. Cole o conteúdo de cada arquivo
3. Execute **um de cada vez** na ordem acima
4. Verifique se não houve erros antes de prosseguir

## ✅ Após a Execução

Inicialize os dados padrão para cada tenant existente:

```sql
-- Para cada tenant existente, criar stages e tools padrão
SELECT create_default_pipeline_stages(id) FROM tenants;
SELECT create_default_tools(id) FROM tenants;
```

## 📚 O que cada migration faz

### 020_agents_complete.sql
- Adiciona colunas: `description`, `color`, sub-agents (`parent_agent_id`, `agent_type`)
- Cria tabela `prompt_templates` para banco de modelos
- Cria tabelas `agent_test_runs` e `agent_test_messages` para AI Evals
- Cria tabela `conversation_memory` para long-term memory

### 021_crm_complete.sql
- Cria `crm_field_definitions` (campos customizáveis)
- Cria `crm_lead_field_values` (valores dos campos)
- Cria `crm_activity_log` (histórico de ações)
- Função `create_default_pipeline_stages()` para novas empresas

### 022_tools_system.sql
- Expande `tools_config` com categorias, retry, timeout
- Cria `tool_executions` (log de execuções)
- Função `create_default_tools()` com 7 tools built-in:
  - `updateCRM` - Atualiza campos do lead
  - `sendMessage` - Envia mídia adicional
  - `scheduleRemarketing` - Agenda follow-up
  - `transferToHuman` - Transfere para humano
  - `pauseAgent` - Pausa a IA
  - `switchAgent` - Transfere para sub-agente
  - `notifyWhatsApp` - Notifica outro número

## 🔒 RLS Policies

Todas as tabelas têm policies de isolamento por tenant:
- Usuários só veem dados do seu tenant
- Roles `master`, `admin`, `operator` têm acesso especial
- Templates globais (`is_global = true`) são visíveis para todos
