# Backend API Requirements - Live Chat (Inbox)

> Documentação de requisitos para o backend implementar a API de Chat/Inbox

**Status**: 🔴 Não Iniciado | 🟡 Em Progresso | 🟢 Concluído

---

## Endpoints Necessários

### Conversas

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/conversations` | GET | Listar conversas com filtros |
| ⬜ | `/api/v1/conversations/{id}` | GET | Obter conversa por ID |
| ⬜ | `/api/v1/conversations/{id}` | PUT | Atualizar conversa |
| ⬜ | `/api/v1/conversations/{id}/take-over` | POST | Assumir atendimento |
| ⬜ | `/api/v1/conversations/{id}/resolve` | POST | Resolver conversa |
| ⬜ | `/api/v1/conversations/{id}/archive` | POST | Arquivar conversa |
| ⬜ | `/api/v1/conversations/{id}/assign` | POST | Atribuir a agente |
| ⬜ | `/api/v1/conversations/{id}/transfer` | POST | Transferir para departamento |
| ⬜ | `/api/v1/conversations/stats` | GET | Estatísticas do inbox |

### Mensagens

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/conversations/{id}/messages` | GET | Listar mensagens |
| ⬜ | `/api/v1/conversations/{id}/messages` | POST | Enviar mensagem |
| ⬜ | `/api/v1/conversations/{id}/messages/{msgId}/read` | POST | Marcar como lida |

### Quick Replies

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/quick-replies` | GET | Listar respostas rápidas |
| ⬜ | `/api/v1/quick-replies` | POST | Criar resposta rápida |
| ⬜ | `/api/v1/quick-replies/{id}` | PUT | Atualizar |
| ⬜ | `/api/v1/quick-replies/{id}` | DELETE | Excluir |

---

## Schemas

### Conversation

```typescript
interface Conversation {
    id: string
    contact_id: string | null
    contact_name: string | null
    contact_phone: string | null
    
    channel: 'whatsapp' | 'telegram' | 'instagram' | 'webchat' | 'email' | 'sms'
    external_id: string | null    // ID no gateway
    
    status: 'waiting' | 'ai' | 'attending' | 'resolved' | 'archived'
    mode: 'ai' | 'human' | 'bot' | 'hybrid'
    
    // Atendimento
    assigned_to: string | null
    assigned_name: string | null
    ai_agent_id: string | null
    ai_agent_name: string | null
    
    // Métricas
    unread_count: number
    message_count: number
    last_message_at: string
    last_message_preview: string | null
    last_message_direction: 'in' | 'out' | null
    
    // CRM
    pipeline_stage: string | null
    deal_id: string | null
    proposal_value: number | null
    
    // Organização
    tags: string[]
    metadata: Record<string, unknown>
    
    // Audit
    created_at: string
    updated_at: string
    resolved_at: string | null
    deleted_at: string | null
}
```

### ChatMessage

```typescript
interface ChatMessage {
    id: string
    conversation_id: string
    direction: 'in' | 'out'
    sender_type: 'contact' | 'ai' | 'human' | 'system' | 'bot'
    sender_id: string | null
    sender_name: string | null
    
    content_type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'location' | 'contacts' | 'sticker' | 'system'
    content: string | null
    media_url: string | null
    media_mime_type: string | null
    media_filename: string | null
    media_duration: number | null   // Para áudio/vídeo
    
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    error_message: string | null
    external_id: string | null      // ID no gateway
    
    ai_response_metadata: object | null
    metadata: Record<string, unknown>
    
    created_at: string
    updated_at: string
}
```

### QuickReply

```typescript
interface QuickReply {
    id: string
    title: string
    content: string
    shortcut: string | null   // Ex: "/ola" para auto-complete
    category: string | null
    is_active: boolean
    usage_count: number
    created_at: string
}
```

---

## Regras de Negócio

### ⬜ Status da Conversa

Transições permitidas:
- `waiting` → `ai` (IA assume) ou `attending` (humano assume)
- `ai` → `attending` (humano assume) ou `resolved`
- `attending` → `resolved` ou `ai` (devolver para IA)
- `resolved` → `waiting` (reaberta por nova mensagem)
- Qualquer → `archived` (arquivamento manual)

### ⬜ Take Over (Assumir)

Quando um humano assume:
1. Mudar `mode` para `human`
2. Mudar `status` para `attending`
3. Setar `assigned_to` e `assigned_name`
4. Inserir mensagem de sistema: "Atendimento assumido por {nome}"

### ⬜ Contagem de Não Lidas

- Incrementar `unread_count` quando mensagem `direction = 'in'`
- Zerar `unread_count` quando humano visualiza a conversa

### ⬜ Atualização de Última Mensagem

Ao inserir mensagem:
1. Atualizar `last_message_at`
2. Atualizar `last_message_preview` (primeiros 100 chars)
3. Atualizar `last_message_direction`

---

## Real-time (WebSocket)

### ⬜ Eventos a Emitir

```typescript
// Nova mensagem
{
    event: 'message:new',
    data: ChatMessage
}

// Conversa atualizada
{
    event: 'conversation:updated',
    data: Conversation
}

// Nova conversa
{
    event: 'conversation:new',
    data: Conversation
}
```

### ⬜ Subscrição

Cliente envia:
```json
{
    "subscribe": "conversation:{id}"
}
```

Para receber mensagens de uma conversa específica.

---

## Checklist de Implementação

### Banco de Dados
- [ ] Executar migration `conversations_v2.sql`
- [ ] Índices para ordenação por last_message_at
- [ ] Trigger para atualizar last_message_*

### API Endpoints
- [ ] CRUD Conversas
- [ ] Mensagens
- [ ] Take over / Resolve / Archive
- [ ] Quick Replies

### Real-time
- [ ] WebSocket server
- [ ] Eventos de mensagem
- [ ] Subscrição por conversa

### Integrações
- [ ] Webhook de entrada de mensagens
- [ ] Envio via gateway WhatsApp

---

**Última atualização**: 2026-01-06
