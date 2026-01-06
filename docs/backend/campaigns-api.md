# Backend API Requirements - WhatsApp Campaigns

> Documentação de requisitos para o backend implementar a API de Campanhas de WhatsApp

**Status**: 🔴 Não Iniciado | 🟡 Em Progresso | 🟢 Concluído

---

## Endpoints Necessários

### Campanhas

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/campaigns` | GET | Listar campanhas com filtros (status, pagination) |
| ⬜ | `/api/v1/campaigns` | POST | Criar nova campanha |
| ⬜ | `/api/v1/campaigns/{id}` | GET | Obter campanha por ID |
| ⬜ | `/api/v1/campaigns/{id}` | PUT | Atualizar campanha |
| ⬜ | `/api/v1/campaigns/{id}` | DELETE | Excluir campanha |
| ⬜ | `/api/v1/campaigns/{id}/start` | POST | Iniciar campanha |
| ⬜ | `/api/v1/campaigns/{id}/pause` | POST | Pausar campanha |
| ⬜ | `/api/v1/campaigns/{id}/stop` | POST | Cancelar campanha |
| ⬜ | `/api/v1/campaigns/{id}/stats` | GET | Estatísticas da campanha |
| ⬜ | `/api/v1/campaigns/{id}/deliveries` | GET | Histórico de entregas |
| ⬜ | `/api/v1/campaigns/{id}/preview` | POST | Preview de contatos que receberão |

### Templates de Mensagem

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/message-templates` | GET | Listar templates |
| ⬜ | `/api/v1/message-templates` | POST | Criar template |
| ⬜ | `/api/v1/message-templates/{id}` | GET | Obter template com conteúdos |
| ⬜ | `/api/v1/message-templates/{id}` | PUT | Atualizar template |
| ⬜ | `/api/v1/message-templates/{id}` | DELETE | Soft delete template |
| ⬜ | `/api/v1/message-templates/{id}/contents` | GET | Listar conteúdos do template |
| ⬜ | `/api/v1/message-templates/{id}/contents` | POST | Adicionar conteúdo |
| ⬜ | `/api/v1/message-templates/{id}/contents/{contentId}` | PUT | Atualizar conteúdo |
| ⬜ | `/api/v1/message-templates/{id}/contents/{contentId}` | DELETE | Remover conteúdo |
| ⬜ | `/api/v1/message-templates/{id}/reorder` | POST | Reordenar conteúdos |

---

## Schemas de Request/Response

### Campaign (Campanha)

```typescript
interface Campaign {
    id: string
    name: string
    description: string | null
    status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
    
    // Conexão WhatsApp
    connection_id: string | null
    connection_name: string | null
    
    // Agendamento
    scheduled_at: string | null  // ISO date
    schedule_days: number[]      // [1,2,3,4,5] = Seg-Sex
    schedule_start_hour: number  // 0-23
    schedule_end_hour: number    // 0-23
    timezone: string             // "America/Sao_Paulo"
    
    // Anti-ban settings
    max_daily_volume: number     // Ex: 200
    min_interval_seconds: number // Ex: 30
    max_interval_seconds: number // Ex: 120
    use_random_intervals: boolean
    batch_size: number           // Ex: 10
    batch_pause_minutes: number  // Ex: 15
    
    // Filtros de contatos
    contact_filters: {
        status?: string[]
        type?: string[]
        tags?: string[]
        exclude_tags?: string[]
        services?: string[]
        custom_conditions?: Array<{
            field: string
            operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'
            value: string
        }>
    }
    
    // Templates (até 5, distribuição aleatória)
    template_ids: string[]
    template_distribution: 'random' | 'sequential' | 'weighted'
    
    // Agente/IA para respostas
    assigned_agent_id: string | null
    ai_agent_id: string | null
    
    // Automações
    on_delivery_actions: CampaignAction[]
    on_response_actions: CampaignAction[]
    
    // Stats (readonly)
    total_contacts: number
    sent_count: number
    delivered_count: number
    read_count: number
    failed_count: number
    response_count: number
    
    // Audit
    created_at: string
    updated_at: string
    started_at: string | null
    completed_at: string | null
}

interface CampaignAction {
    type: 'add_tag' | 'remove_tag' | 'move_to_stage' | 'assign_department' | 'notify_agent' | 'start_flow'
    value?: string
    pipeline_id?: string
    stage_id?: string
    department?: string
    agent_id?: string
    flow_id?: string
}
```

### MessageTemplate (Template de Mensagem)

```typescript
interface MessageTemplate {
    id: string
    name: string
    description: string | null
    category: string  // 'general', 'onboarding', 'nurturing', 'promotional', 'transactional'
    is_active: boolean
    usage_count: number
    last_used_at: string | null
    created_at: string
    updated_at: string
    
    // Conteúdos (quando include=contents)
    contents?: TemplateContent[]
}

interface TemplateContent {
    id: string
    template_id: string
    content_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location' | 'interval'
    content: string | null          // Para texto: mensagem com variáveis
    media_url: string | null        // Para mídia
    media_filename: string | null
    media_mimetype: string | null
    send_as_voice: boolean          // Para áudio: enviar como PTT
    interval_seconds: number | null // Para interval: tempo de espera
    contact_data: object | null     // Para contact: dados do VCard
    latitude: number | null         // Para location
    longitude: number | null
    location_name: string | null
    location_address: string | null
    position: number                // Ordem de exibição
}
```

---

## Lógica de Negócio no Backend

### ⬜ Engine de Disparo

O backend precisa implementar um worker/scheduler que:

1. **Busca campanhas ativas** (`status = 'running'`)
2. **Verifica horário permitido** (schedule_start_hour - schedule_end_hour)
3. **Verifica dia da semana** (schedule_days)
4. **Respeita limites**:
   - max_daily_volume por dia
   - Intervalo entre mensagens (random se use_random_intervals)
   - Pausa entre lotes (batch_pause_minutes)

### ⬜ Substituição de Variáveis

Variáveis suportadas no conteúdo de texto:
- `{first_name}` → Primeiro nome do contato
- `{full_name}` → Nome completo
- `{phone_number}` → Telefone formatado
- `{email}` → Email do contato
- `{company}` → Empresa do contato
- `{city}` → Cidade do contato
- `{custom_*}` → Campos customizados do metadata

### ⬜ Conversão de Formatação

O texto vem do frontend com formatação HTML/WhatsApp:
- `*texto*` → Negrito
- `_texto_` → Itálico
- `~texto~` → Riscado
- ``` `texto` ``` → Monospace

O backend deve preservar essa formatação ao enviar via gateway WhatsApp.

### ⬜ Seleção de Template

Quando a campanha tem múltiplos templates:
- **random**: Escolher aleatoriamente
- **sequential**: Rotacionar em ordem
- **weighted**: Usar peso configurado

### ⬜ Execução de Ações

Ao entregar/receber resposta, executar as ações configuradas:
- `add_tag` → Adicionar etiqueta ao contato
- `remove_tag` → Remover etiqueta
- `move_to_stage` → Mover deal do CRM para estágio
- `assign_department` → Atribuir conversa a departamento
- `notify_agent` → Notificar agente (push/email)
- `start_flow` → Iniciar fluxo de automação

---

## Serviços Necessários

### ⬜ Redis/Queue

Para gerenciamento da fila de entregas:
- Publicar mensagens na fila
- Worker consumindo com rate limiting
- Retry com exponential backoff

### ⬜ Webhook de Status

Receber callbacks do gateway WhatsApp:
- `sent` → Mensagem saiu do servidor
- `delivered` → Entregue ao dispositivo
- `read` → Lida pelo destinatário
- `failed` → Falha com código de erro

### ⬜ Integração com Gateway

Suporte a gateways:
- UAZAPI (já implementado)
- Evolution API (futuro)
- Meta Cloud API (futuro)

---

## Configurações de Ambiente

```env
# Campaign Engine
CAMPAIGN_ENGINE_ENABLED=true
CAMPAIGN_WORKER_INTERVAL_MS=5000
CAMPAIGN_DEFAULT_MAX_DAILY=200
CAMPAIGN_DEFAULT_MIN_INTERVAL=30
CAMPAIGN_DEFAULT_MAX_INTERVAL=120

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
```

---

## Checklist de Implementação

### Banco de Dados
- [ ] Executar migration `campaigns_v2.sql` no banco do cliente
- [ ] Criar índices de performance
- [ ] Configurar RLS policies

### API Endpoints
- [ ] CRUD Campanhas
- [ ] CRUD Templates
- [ ] Start/Pause/Stop Campaign
- [ ] Preview de contatos

### Workers
- [ ] Campaign Scheduler
- [ ] Message Delivery Worker
- [ ] Status Webhook Handler

### Integrações
- [ ] UAZAPI adapter para campanhas
- [ ] Redis queue setup
- [ ] Retry logic

---

**Última atualização**: 2026-01-06
