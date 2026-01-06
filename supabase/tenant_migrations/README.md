# Apollo A.I. Advanced - Sistema de Migrações de Tenant

## Visão Geral

Este diretório contém os scripts SQL para configurar e atualizar bancos de dados de tenants (clientes).

## Arquivos

### Para NOVAS Empresas
- **`000_full_schema_v10.sql`** - Schema completo para instalação limpa

### Para Empresas EXISTENTES (Migrações Incrementais)
O sistema de migrações é controlado pelo hook `useMigrationStatus.ts` no frontend.
As migrações são executadas automaticamente baseadas na versão atual do banco.

## Versões de Migração

| Versão | Tabelas Criadas |
|--------|-----------------|
| 0 → 1  | `contacts`, `conversations`, `messages` |
| 1 → 2  | `crm_pipelines`, `crm_deals` |
| 2 → 3  | `tools` (+ 8 ferramentas do sistema) |
| 3 → 4  | `whatsapp_connections` |
| 4 → 5  | `quick_replies` |
| 5 → 6  | `tenant_settings` (+ configurações padrão) |
| 6 → 7  | `campaigns` |
| 7 → 8  | `integrations` |
| 8 → 9  | `tool_executions` |
| 9 → 10 | `automation_triggers` |

## Como Funciona

### Nova Empresa
1. Crie o projeto Supabase do cliente
2. Execute `000_full_schema_v10.sql` no SQL Editor
3. Configure as credenciais no painel master
4. Defina `migrations_version = 10` na tabela `tenant_database_config`

### Empresa Existente
1. O sistema detecta a versão atual na coluna `migrations_version`
2. Ao clicar em "Atualizar", executa apenas as migrações pendentes
3. A ordem é respeitada automaticamente (ex: versão 4 → executa 4→5, 5→6, ..., 9→10)

## Regras de Segurança

1. **NUNCA** execute o schema completo em um banco já existente
2. **SEMPRE** faça backup antes de executar migrações
3. As migrações usam `CREATE TABLE IF NOT EXISTS` para evitar erros
4. Os inserts usam `ON CONFLICT DO NOTHING` para não duplicar dados

## Estrutura das Tabelas

```
contacts            → Contatos/leads
conversations       → Conversas de chat
messages            → Mensagens individuais
crm_pipelines       → Funis de vendas
crm_deals           → Negócios no CRM
crm_deal_history    → Histórico de movimentação
tools               → Ferramentas de IA
tool_executions     → Log de execuções
whatsapp_connections → Instâncias WhatsApp
quick_replies       → Respostas rápidas
tenant_settings     → Configurações
campaigns           → Campanhas de disparo
campaign_recipients → Destinatários de campanha
integrations        → Integrações externas
automation_triggers → Gatilhos automáticos
```

## Ferramentas do Sistema (v3)

| Nome | Descrição |
|------|-----------|
| `updateContactStatus` | Atualizar status do contato |
| `updatePipelineStage` | Mover deal no pipeline |
| `createTask` | Criar tarefa de follow-up |
| `scheduleMessage` | Agendar mensagem |
| `searchProducts` | Buscar no catálogo |
| `getContactHistory` | Histórico de conversas |
| `transferToHuman` | Transferir para humano |
| `endConversation` | Finalizar conversa |
