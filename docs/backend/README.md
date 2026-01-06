# Backend API Requirements - Índice

> Documentação centralizada de todos os requisitos de API para o backend

---

## Documentos Disponíveis

| Documento | Descrição | Status Geral |
|-----------|-----------|--------------| 
| [campaigns-api.md](./campaigns-api.md) | API de Campanhas WhatsApp | 🔴 Não Iniciado |
| [crm-api.md](./crm-api.md) | API do CRM (Pipelines, Deals) | 🔴 Não Iniciado |
| [contacts-api.md](./contacts-api.md) | API de Contatos | 🔴 Não Iniciado |
| [chat-api.md](./chat-api.md) | API de Live Chat (Inbox) | 🔴 Não Iniciado |
| [connections-api.md](./connections-api.md) | Conexões WhatsApp, Quick Replies, Settings | 🔴 Não Iniciado |
| [tools-api.md](./tools-api.md) | Ferramentas IA e Integrações | 🔴 Não Iniciado |

---

## Como Usar

1. Cada arquivo contém uma tabela de endpoints com checkbox
2. Marque os itens conforme for implementando
3. Atualize o status geral neste índice

## Legenda de Status

- ⬜ Não iniciado
- 🔄 Em progresso
- ✅ Concluído
- ❌ Bloqueado/Problema

---

## Prioridade de Implementação

### Alta Prioridade
1. **Contacts API** - Base para todos os outros módulos
2. **Chat API** - Core do produto (atendimento)
3. **Connections API** - Essencial para WhatsApp funcionar

### Média Prioridade
4. **CRM API** - Pipeline de vendas
5. **Campaigns API** - Disparo em massa
6. **Tools API** - Funcionalidades de IA

### Baixa Prioridade
- Analytics API (futuro)
- Billing API (futuro)

---

## Migrations de Banco de Dados

Os seguintes arquivos SQL devem ser executados no banco do cliente:

| Arquivo | Descrição | Executado? |
|---------|-----------|------------|
| `contacts_v2.sql` | Tabelas de contatos e tags | ⬜ |
| `conversations_v2.sql` | Tabelas de chat e mensagens | ⬜ |
| `crm_engine_v2.sql` | Tabelas de CRM | ⬜ |
| `campaigns_v2.sql` | Tabelas de campanhas | ⬜ |
| `connections_v2.sql` | Conexões WhatsApp, Quick Replies, Settings | ⬜ |
| `tools_v2.sql` | Ferramentas e Integrações | ⬜ |

Localização: `supabase/tenant_migrations/`

---

## Contato para Dúvidas

Se tiver dúvidas sobre a documentação ou requisitos, consulte:
- Documento de regras: `docs/BUSINESS_RULES.md`
- API existente (OpenAPI): https://apps-apollo-api.orzdma.easypanel.host/docs

---

**Última atualização**: 2026-01-06
