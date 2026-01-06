# Apollo A.I. Advanced - Regras de Negócio e Comportamento do Sistema

> Documentação viva das regras de negócio, comportamento da interface e formato de gestão

**Última atualização**: 2026-01-06

---

## Sumário

1. [Arquitetura Multi-Tenant](#arquitetura-multi-tenant)
2. [Módulos do Sistema](#módulos-do-sistema)
3. [Gestão de Usuários e Permissões](#gestão-de-usuários-e-permissões)
4. [Contatos](#contatos)
5. [Live Chat (Inbox)](#live-chat-inbox)
6. [CRM (Pipeline Kanban)](#crm-pipeline-kanban)
7. [Campanhas WhatsApp](#campanhas-whatsapp)
8. [Agentes de IA](#agentes-de-ia)
9. [Integrações WhatsApp](#integrações-whatsapp)

---

## Arquitetura Multi-Tenant

### Estrutura de Dados

O sistema opera em **dois níveis de banco de dados**:

1. **Banco Principal (Supabase Central)**
   - Tabela `tenants`: Cadastro de empresas/clientes
   - Tabela `user_profiles`: Usuários do sistema
   - Tabela `memberships`: Vínculo usuário ↔ tenant
   - Configurações globais de planos e billing

2. **Banco do Cliente (Supabase por Tenant)**
   - Cada tenant tem seu próprio projeto Supabase
   - Contatos, conversas, deals, campanhas isolados
   - Configurado via `tenant_database_config` no banco principal

### Regras de Isolamento

- Cada usuário vê apenas dados dos tenants aos quais está vinculado
- O `selectedCompany` no contexto determina qual tenant está ativo
- Hooks usam `useActiveSupabase()` para conectar ao banco correto
- RLS (Row Level Security) aplicado em todas as tabelas sensíveis

---

## Módulos do Sistema

### Visão Geral

| Módulo | Descrição | Status |
|--------|-----------|--------|
| Dashboard | Métricas e KPIs do tenant | ✅ Implementado |
| Contatos | Base de leads e clientes | ✅ Implementado |
| Live Chat (Inbox) | Atendimento em tempo real | ✅ Implementado |
| CRM | Pipeline Kanban de vendas | ✅ Implementado |
| Campanhas | Disparo em massa WhatsApp | ✅ Implementado |
| Agentes IA | Configuração de agentes | 🔄 Parcial |
| RAG (Knowledge Base) | Base de conhecimento para IA | 🔄 Parcial |
| Analytics | Relatórios e métricas | ⏳ Planejado |
| Settings | Configurações do tenant | 🔄 Parcial |

---

## Gestão de Usuários e Permissões

### Roles (Papéis)

| Role | Descrição | Acesso |
|------|-----------|--------|
| `master` | Administrador da plataforma | Todos os tenants, configurações globais |
| `owner` | Dono do tenant | Todas as funcionalidades do tenant |
| `admin` | Administrador do tenant | Todas exceto billing e exclusão |
| `agent` | Atendente | Chat, contatos (limitado), CRM (limitado) |
| `viewer` | Visualizador | Apenas leitura |

### Comportamento de Autenticação

1. **Login**: Via Supabase Auth (email/password ou OAuth)
2. **Carregamento de Perfil**: Busca `user_profiles` e `memberships`
3. **Seleção de Empresa**: Se múltiplos tenants, exibe seletor
4. **Redirecionamento**:
   - `master` → `/admin`
   - Outros → `/app`

---

## Contatos

### Tipos de Contato

| Tipo | Descrição |
|------|-----------|
| `lead` | Potencial cliente (padrão) |
| `customer` | Cliente ativo |
| `supplier` | Fornecedor |
| `partner` | Parceiro comercial |
| `other` | Outro |

### Status de Contato

| Status | Descrição |
|--------|-----------|
| `active` | Ativo, pode receber mensagens |
| `inactive` | Inativo, excluído do disparo |
| `blocked` | Bloqueado, optou por não receber |

### Regras de Validação

- **Nome**: Obrigatório
- **WhatsApp**: Normalizado para formato internacional (5511999999999)
- **Email**: Validação de formato, único no tenant
- **CPF**: Validação de dígitos verificadores
- **CNPJ**: Validação de dígitos verificadores

### Ações em Massa

- ✅ Adicionar etiquetas
- ✅ Remover etiquetas
- ✅ Alterar status
- ✅ Alterar tipo
- ✅ Excluir (soft delete)

### Importação

- Formatos: CSV (vírgula ou ponto-e-vírgula)
- Mapeamento de campos configurável
- Detecção de duplicados por WhatsApp/Email
- Validação prévia antes de importar

### Exportação

- Seleção de campos a exportar
- Escopo: todos ou selecionados
- Formato: CSV com opções de separador e encoding

---

## Live Chat (Inbox)

### Status da Conversa

| Status | Descrição | Cor |
|--------|-----------|-----|
| `waiting` | Aguardando atendimento | Amarelo |
| `ai` | Sendo atendida por IA | Roxo |
| `attending` | Atendimento humano em andamento | Azul |
| `resolved` | Finalizada | Verde |
| `archived` | Arquivada | Cinza |

### Modos de Atendimento

| Modo | Descrição |
|------|-----------|
| `ai` | IA responde automaticamente |
| `human` | Agente humano atendendo |
| `bot` | Bot com fluxo predefinido |
| `hybrid` | IA + humano (supervisão) |

### Fluxo de Atendimento

```
Nova Mensagem
    ↓
[waiting] → IA assume → [ai] → Humano assume → [attending]
                ↓                                    ↓
           Resolvido                            Resolvido
                ↓                                    ↓
           [resolved] ← ← ← ← ← ← ← ← ← ← ← [resolved]
                ↓
           [archived] (manual)
```

### Take Over (Assumir)

Quando um humano assume:
1. Status muda para `attending`
2. Mode muda para `human`
3. Mensagem de sistema: "Atendimento assumido por {nome}"
4. IA para de responder

### Resolução

Quando resolvida:
1. Status muda para `resolved`
2. Timestamp `resolved_at` é registrado
3. Conversa sai da fila ativa

### Reabertura

Se contato envia nova mensagem após `resolved`:
1. Status volta para `waiting`
2. Entra novamente na fila

---

## CRM (Pipeline Kanban)

### Estrutura

```
Pipeline (Funil)
├── Stage 1 (Coluna) - position: 0
│   ├── Deal (Card) A
│   └── Deal (Card) B
├── Stage 2 (Coluna) - position: 1
│   └── Deal (Card) C
└── Stage 3 (Coluna) - position: 2
    └── Deal (Card) D
```

### Pipeline Padrão

- Cada tenant tem **exatamente um** pipeline marcado como `is_default`
- Ao marcar outro como padrão, o anterior é desmarcado automaticamente
- O pipeline padrão não pode ser excluído se for o único

### Stages (Colunas)

- Ordenadas por `position` (0, 1, 2, ...)
- Podem ter `automation_rules` para executar ações ao receber deal
- Stages especiais: `is_won` e `is_lost` para marcar ganho/perda

### Automações de Stage

Quando um deal entra em um stage:

| Tipo | Ação |
|------|------|
| `add_tag` | Adiciona etiqueta ao contato vinculado |
| `remove_tag` | Remove etiqueta do contato |
| `send_message` | Envia mensagem template via WhatsApp |
| `notify` | Notifica usuário/equipe |
| `webhook` | Dispara webhook para integração externa |

### Deals (Cards)

- Vinculados a contato e/ou conversa
- Valor monetário (`value`)
- Probabilidade de fechamento (`probability`)
- Data prevista de fechamento (`expected_close_date`)
- Atividades (notas, ligações, reuniões, tarefas)

---

## Campanhas WhatsApp

### Estrutura

```
Campanha
├── Filtros de Contatos (quem recebe)
├── Templates de Mensagem (1-5, distribuição aleatória)
├── Configurações Anti-Ban
├── Agendamento
└── Automações (ao entregar/responder)
```

### Status da Campanha

| Status | Descrição |
|--------|-----------|
| `draft` | Rascunho, ainda não agendada |
| `scheduled` | Agendada para data futura |
| `running` | Em execução |
| `paused` | Pausada manualmente |
| `completed` | Finalizada (todos enviados) |
| `cancelled` | Cancelada |

### Filtros de Contatos

- Por status: `active`, `inactive`
- Por tipo: `lead`, `customer`, etc.
- Por etiquetas: incluir ou excluir
- Por serviços contratados
- Condições customizadas em campos

### Anti-Banimento

| Configuração | Padrão | Descrição |
|--------------|--------|-----------|
| Volume máximo diário | 200 | Mensagens por dia |
| Intervalo mínimo | 30s | Entre mensagens |
| Intervalo máximo | 120s | Entre mensagens |
| Intervalos aleatórios | Sim | Variar entre min e max |
| Tamanho do lote | 10 | Mensagens por ciclo |
| Pausa entre lotes | 15min | Descanso entre ciclos |

### Templates de Mensagem

Cada template é uma sequência de **blocos de conteúdo**:

| Tipo | Descrição |
|------|-----------|
| `text` | Texto com formatação e variáveis |
| `image` | Imagem (URL ou upload) |
| `video` | Vídeo (URL ou upload) |
| `audio` | Áudio, opção PTT (voz) |
| `document` | Arquivo/documento |
| `sticker` | Sticker do WhatsApp |
| `contact` | Cartão VCard |
| `interval` | Aguardar X segundos |

### Variáveis Disponíveis

| Variável | Descrição |
|----------|-----------|
| `{first_name}` | Primeiro nome do contato |
| `{full_name}` | Nome completo |
| `{phone_number}` | Telefone formatado |
| `{email}` | Email |
| `{company}` | Empresa |
| `{city}` | Cidade |
| `{custom_*}` | Campos customizados |

### Formatação de Texto

O frontend usa formatação WhatsApp nativa:
- `*texto*` → **Negrito**
- `_texto_` → _Itálico_
- `~texto~` → ~~Riscado~~
- ``` `texto` ``` → `Monospace`

### Automações

**Ao entregar mensagem:**
- Adicionar etiqueta
- Remover etiqueta
- Mover deal para estágio
- Atribuir a departamento

**Ao receber resposta:**
- Adicionar etiqueta
- Notificar agente
- Iniciar fluxo de automação
- Atribuir a agente IA

---

## Agentes de IA

### Estrutura

Cada agente tem:
- Nome e descrição
- Modelo de IA (gpt-4, claude, etc.)
- Prompt de sistema (personalidade, instruções)
- Knowledge bases vinculadas (RAG)
- Configurações de temperatura e tokens

### Comportamento

1. Quando conversa entra em modo `ai`:
   - Agente recebe contexto: histórico, contato, knowledge
   - Gera resposta baseada no prompt
   - Resposta é enviada via gateway

2. Fallback para humano:
   - Se IA não conseguir responder
   - Se contato solicitar humano
   - Se detectar assunto crítico

---

## Integrações WhatsApp

### Gateways Suportados

| Gateway | Status | Descrição |
|---------|--------|-----------|
| UAZAPI | ✅ Implementado | API não-oficial |
| Evolution API | ⏳ Planejado | API não-oficial (open source) |
| Meta Cloud API | ⏳ Planejado | API oficial do Meta |

### Fluxo de Mensagens

```
Entrada (Inbound)
    Gateway → Webhook → Processamento → Conversa → IA/Humano

Saída (Outbound)
    Resposta → API Gateway → WhatsApp → Destinatário
```

### Status de Mensagem

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando envio |
| `sent` | Enviada ao gateway |
| `delivered` | Entregue ao dispositivo |
| `read` | Lida pelo destinatário |
| `failed` | Falha no envio |

---

## Interface do Usuário

### Layout Principal

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Seletor de Empresa | Notificações | Perfil   │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │                 Área de Conteúdo                 │
│          │                                                  │
│ - Home   │  Stats Cards                                     │
│ - Chat   │  Tabelas / Kanban / Forms                        │
│ - CRM    │  Modais                                          │
│ - Cont.  │                                                  │
│ - Camp.  │                                                  │
│ - Agents │                                                  │
│ - RAG    │                                                  │
│ - Config │                                                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### Padrões de UI

- **Tabelas**: Seleção múltipla, ações em massa na barra fixa
- **Modais**: Formulários CRUD, wizards multi-step
- **Kanban**: Drag-and-drop de cards entre colunas
- **Filtros**: Barra persistente com busca + selects + tags
- **Toast/Notifications**: Feedback de ações (Mantine notifications)

### Cores e Tema

- Tema escuro como padrão
- Cores primárias: Blue (#3b82f6)
- Sucesso: Green, Erro: Red, Warning: Yellow, Info: Blue

---

## Changelog de Regras

| Data | Módulo | Alteração |
|------|--------|-----------|
| 2026-01-06 | Contatos | Adicionadas ações em massa (tags, status, tipo) |
| 2026-01-06 | Contatos | Implementado Import/Export Wizard |
| 2026-01-06 | Campanhas | Módulo completo implementado |
| 2026-01-06 | Chat | Integração com useChat hooks |
| 2026-01-06 | CRM | Pipeline padrão com regra de unicidade |
