# Apollo A.I. Advanced - API Documentation

> **Versão:** 0.1.0  
> **Base URL:** `http://localhost:8000/api/v1` (dev) | `https://api.apollo-ai.com/api/v1` (prod)  
> **Autenticação:** JWT Bearer Token (Supabase Auth)

---

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Tenants (Empresas)](#tenants)
3. [Agentes](#agentes)
4. [Conversas](#conversas)
5. [Mensagens](#mensagens)
6. [CRM (Leads & Pipeline)](#crm)
7. [Base de Conhecimento (RAG)](#base-de-conhecimento)
8. [Webhooks](#webhooks)
9. [Analytics](#analytics)

---

## 🔐 Autenticação

Todas as requisições (exceto webhooks) precisam do header:

```
Authorization: Bearer <supabase_jwt_token>
```

O token é obtido via login no Supabase Auth.

### Headers Padrão

```typescript
const headers = {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId, // Opcional - inferido do JWT se não enviado
}
```

---

## 🏢 Tenants

### Listar Tenants (Admin)

```http
GET /tenants
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Empresa X",
      "slug": "empresa-x",
      "email": "contato@empresax.com",
      "plan": "professional",
      "status": "active",
      "max_agents": 5,
      "max_conversations_month": 10000,
      "whatsapp_gateway": "evolution",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### Obter Tenant Atual

```http
GET /tenants/me
```

### Atualizar Tenant

```http
PATCH /tenants/{tenant_id}
```

**Body:**
```json
{
  "name": "Novo Nome",
  "logo_url": "https://...",
  "primary_color": "#6366f1",
  "whatsapp_gateway": "evolution",
  "whatsapp_instance_id": "xxx",
  "whatsapp_api_key": "xxx"
}
```

---

## 🤖 Agentes

### Listar Agentes

```http
GET /agents
```

**Query Params:**
- `status`: `active` | `inactive` | `all`
- `page`: número da página
- `limit`: itens por página

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Assistente de Vendas",
      "description": "Atendimento comercial",
      "avatar_url": "https://...",
      "model_provider": "openai",
      "model_name": "gpt-4o-mini",
      "temperature": 0.7,
      "status": "active",
      "is_default": true,
      "total_conversations": 150,
      "total_messages": 3200,
      "rag_enabled": true,
      "reengagement_enabled": true
    }
  ],
  "total": 1
}
```

### Criar Agente

```http
POST /agents
```

**Body:**
```json
{
  "name": "Assistente de Vendas",
  "description": "Especialista em vendas",
  "system_prompt": "Você é um assistente de vendas...",
  "model_provider": "openai",
  "model_name": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 1000,
  "greeting_message": "Olá! Como posso ajudar?",
  "fallback_message": "Desculpe, não entendi.",
  "handoff_message": "Vou transferir para um atendente.",
  "rag_enabled": true,
  "memory_enabled": true,
  "memory_window": 10,
  "reengagement_enabled": true,
  "reengagement_delay_minutes": 120,
  "reengagement_max_attempts": 3,
  "reengagement_prompts": [
    "Ainda está por aí? Posso ajudar em algo?",
    "Oi! Vi que ficou quieto, posso esclarecer algo?",
    "Última tentativa 😊 Precisa de mais informações?"
  ],
  "is_default": false
}
```

### Atualizar Agente

```http
PATCH /agents/{agent_id}
```

### Deletar Agente

```http
DELETE /agents/{agent_id}
```

---

## 💬 Conversas

### Listar Conversas

```http
GET /conversations
```

**Query Params:**
- `status`: `active` | `resolved` | `pending` | `all`
- `mode`: `ai` | `human` | `all`
- `agent_id`: filtrar por agente
- `assigned_to`: filtrar por atendente
- `page`, `limit`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "phone_number": "5511999999999",
      "status": "active",
      "mode": "ai",
      "channel": "whatsapp",
      "agent": {
        "id": "uuid",
        "name": "Assistente"
      },
      "lead": {
        "id": "uuid",
        "name": "João Silva",
        "temperature": "warm"
      },
      "message_count": 15,
      "last_message_at": "2026-01-06T00:30:00Z",
      "started_at": "2026-01-05T10:00:00Z"
    }
  ],
  "total": 25
}
```

### Obter Conversa

```http
GET /conversations/{conversation_id}
```

### Transferir para Humano (Handoff)

```http
POST /conversations/{conversation_id}/handoff
```

**Body:**
```json
{
  "assigned_to": "user_uuid",  // Opcional
  "reason": "Cliente solicitou atendente humano"
}
```

### Devolver para IA

```http
POST /conversations/{conversation_id}/return-to-ai
```

### Resolver Conversa

```http
POST /conversations/{conversation_id}/resolve
```

---

## 📨 Mensagens

### Listar Mensagens da Conversa

```http
GET /conversations/{conversation_id}/messages
```

**Query Params:**
- `limit`: número de mensagens (default: 50)
- `before`: cursor para paginação

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "sender_type": "customer",
      "sender_name": "João",
      "content": "Olá, quero saber sobre os preços",
      "content_type": "text",
      "created_at": "2026-01-06T00:30:00Z"
    },
    {
      "id": "uuid",
      "sender_type": "ai",
      "content": "Olá João! Claro, temos...",
      "content_type": "text",
      "ai_model": "gpt-4o-mini",
      "ai_tokens_input": 150,
      "ai_tokens_output": 200,
      "ai_latency_ms": 1200,
      "created_at": "2026-01-06T00:30:02Z"
    }
  ],
  "has_more": true
}
```

### Enviar Mensagem Manual

```http
POST /conversations/{conversation_id}/messages
```

**Body:**
```json
{
  "content": "Mensagem do atendente humano",
  "is_internal": false  // true = nota interna, não enviada ao cliente
}
```

---

## 📊 CRM

### Pipeline Stages

#### Listar Estágios

```http
GET /crm/pipeline
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Novo Lead",
      "color": "#94a3b8",
      "position": 0,
      "is_won_stage": false,
      "is_lost_stage": false,
      "lead_count": 15
    }
  ]
}
```

#### Criar Estágio

```http
POST /crm/pipeline
```

#### Reordenar Estágios

```http
PUT /crm/pipeline/reorder
```

**Body:**
```json
{
  "stages": [
    {"id": "uuid1", "position": 0},
    {"id": "uuid2", "position": 1}
  ]
}
```

### Leads

#### Listar Leads

```http
GET /crm/leads
```

**Query Params:**
- `stage_id`: filtrar por estágio
- `temperature`: `cold` | `warm` | `hot`
- `assigned_to`: filtrar por responsável
- `search`: busca por nome/email/telefone
- `page`, `limit`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com",
      "phone": "5511999999999",
      "whatsapp": "5511999999999",
      "company_name": "Empresa X",
      "pipeline_stage": {
        "id": "uuid",
        "name": "Qualificação"
      },
      "temperature": "warm",
      "score": 75,
      "expected_value": 5000.00,
      "tags": ["urgente", "grande-porte"],
      "last_contact_at": "2026-01-06T00:00:00Z"
    }
  ],
  "total": 50
}
```

#### Criar Lead

```http
POST /crm/leads
```

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "5511999999999",
  "company_name": "Empresa X",
  "source": "whatsapp",
  "pipeline_stage_id": "uuid",
  "temperature": "warm",
  "expected_value": 5000.00,
  "tags": ["urgente"],
  "custom_fields": {
    "cargo": "Diretor"
  }
}
```

#### Mover Lead no Pipeline

```http
PATCH /crm/leads/{lead_id}/move
```

**Body:**
```json
{
  "pipeline_stage_id": "uuid"
}
```

#### Marcar como Ganho

```http
POST /crm/leads/{lead_id}/won
```

#### Marcar como Perdido

```http
POST /crm/leads/{lead_id}/lost
```

**Body:**
```json
{
  "reason": "Preço alto"
}
```

---

## 📚 Base de Conhecimento (RAG)

### Listar Documentos

```http
GET /knowledge
```

**Query Params:**
- `agent_id`: filtrar por agente (null = global)
- `category`: filtrar por categoria
- `status`: `pending` | `processing` | `completed` | `failed`
- `is_instruction`: `true` | `false`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Manual de Produtos",
      "description": "Catálogo completo",
      "source_type": "document",
      "category": "product",
      "is_instruction": false,
      "status": "completed",
      "chunk_count": 45,
      "agent": null,  // null = global
      "tags": ["produtos", "preços"],
      "created_at": "2026-01-05T00:00:00Z",
      "processed_at": "2026-01-05T00:01:00Z"
    }
  ],
  "stats": {
    "total_documents": 10,
    "total_chunks": 250,
    "completed": 8,
    "processing": 1,
    "failed": 1
  }
}
```

### Upload de Documento

```http
POST /knowledge/documents
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: arquivo (PDF, DOCX, TXT)
- `title`: nome do documento
- `category`: categoria (product, pricing, policy, faq, etc)
- `agent_id`: (opcional) vincular a agente específico
- `tags`: array de tags

### Adicionar Instrução Manual

```http
POST /knowledge/instructions
```

**Body:**
```json
{
  "title": "Regra de Desconto",
  "instruction": "Nunca ofereça mais de 15% de desconto sem aprovação do gerente.",
  "category": "policy",
  "agent_id": null  // null = todos os agentes
}
```

### Adicionar FAQs

```http
POST /knowledge/faqs
```

**Body:**
```json
{
  "agent_id": null,
  "faqs": [
    {
      "question": "Qual o horário de funcionamento?",
      "answer": "De segunda a sexta, das 9h às 18h."
    },
    {
      "question": "Vocês entregam em todo Brasil?",
      "answer": "Sim, entregamos para todo o Brasil via Correios e transportadoras."
    }
  ]
}
```

### Deletar Documento

```http
DELETE /knowledge/{document_id}
```

### Testar Busca RAG

```http
POST /knowledge/search
```

**Body:**
```json
{
  "query": "Qual o preço do produto X?",
  "agent_id": null,
  "top_k": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "O produto X custa R$ 299,00...",
      "score": 0.89,
      "source_title": "Tabela de Preços",
      "source_type": "document",
      "is_instruction": false
    }
  ],
  "query_embedding_time_ms": 150,
  "search_time_ms": 45
}
```

---

## 🔔 Webhooks

### URL do Webhook para WhatsApp

```
POST /webhooks/{provider}/{tenant_slug}
```

- **provider**: `evolution` | `zapi` | `meta`
- **tenant_slug**: slug único da empresa

**Exemplo:**
```
https://api.apollo-ai.com/api/v1/webhooks/evolution/empresa-x
```

### Verificar Status do Webhook

```http
GET /webhooks/status/{tenant_slug}
```

**Response:**
```json
{
  "tenant": "empresa-x",
  "gateway_configured": true,
  "gateway": "evolution",
  "webhook_url": "/api/v1/webhooks/evolution/empresa-x",
  "last_webhook_at": "2026-01-06T00:30:00Z",
  "webhooks_last_24h": 150
}
```

---

## 📈 Analytics

### Dashboard Geral

```http
GET /analytics/dashboard
```

**Query Params:**
- `period`: `today` | `7d` | `30d` | `90d`
- `agent_id`: filtrar por agente

**Response:**
```json
{
  "conversations": {
    "total": 500,
    "active": 25,
    "resolved": 450,
    "avg_resolution_time_minutes": 15
  },
  "messages": {
    "total": 5000,
    "from_ai": 2500,
    "from_human": 500,
    "from_customer": 2000
  },
  "leads": {
    "total": 200,
    "new_this_period": 50,
    "won": 30,
    "lost": 10,
    "conversion_rate": 0.15
  },
  "tokens": {
    "input": 1500000,
    "output": 500000,
    "estimated_cost_usd": 5.50
  },
  "top_intents": [
    {"intent": "purchase_intent", "count": 150},
    {"intent": "question", "count": 120}
  ]
}
```

### Token Usage

```http
GET /analytics/tokens
```

**Query Params:**
- `period`: `7d` | `30d` | `90d`
- `agent_id`: filtrar por agente

---

## 🔧 Tipos TypeScript para Frontend

```typescript
// types/api.ts

export type UserRole = 'admin' | 'manager' | 'agent' | 'client'
export type ConversationStatus = 'active' | 'pending' | 'resolved'
export type ConversationMode = 'ai' | 'human' | 'hybrid'
export type MessageSenderType = 'customer' | 'ai' | 'agent' | 'human_agent' | 'system'
export type LeadTemperature = 'cold' | 'warm' | 'hot'
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type SourceType = 'document' | 'instruction' | 'website' | 'faq' | 'api_doc'
export type KnowledgeCategory = 'product' | 'pricing' | 'policy' | 'faq' | 'process' | 'technical' | 'general'

export interface Tenant {
  id: string
  name: string
  slug: string
  email: string
  plan: string
  status: string
  logo_url?: string
  primary_color: string
  whatsapp_gateway?: string
  max_agents: number
  max_conversations_month: number
}

export interface Agent {
  id: string
  name: string
  description?: string
  avatar_url?: string
  model_provider: string
  model_name: string
  temperature: number
  system_prompt: string
  status: string
  is_default: boolean
  rag_enabled: boolean
  reengagement_enabled: boolean
  total_conversations: number
  total_messages: number
}

export interface Conversation {
  id: string
  phone_number: string
  status: ConversationStatus
  mode: ConversationMode
  channel: string
  agent?: Agent
  lead?: Lead
  assigned_to?: string
  message_count: number
  last_message_at: string
  started_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: MessageSenderType
  sender_name?: string
  content: string
  content_type: string
  media_url?: string
  ai_model?: string
  ai_tokens_input?: number
  ai_tokens_output?: number
  is_internal: boolean
  created_at: string
}

export interface Lead {
  id: string
  name?: string
  email?: string
  phone?: string
  whatsapp?: string
  company_name?: string
  pipeline_stage?: PipelineStage
  temperature: LeadTemperature
  score: number
  expected_value?: number
  tags: string[]
  custom_fields: Record<string, any>
  last_contact_at: string
}

export interface PipelineStage {
  id: string
  name: string
  color: string
  position: number
  is_won_stage: boolean
  is_lost_stage: boolean
  lead_count?: number
}

export interface KnowledgeDocument {
  id: string
  title: string
  description?: string
  source_type: SourceType
  category?: KnowledgeCategory
  is_instruction: boolean
  status: DocumentStatus
  chunk_count?: number
  agent_id?: string
  tags: string[]
  error_message?: string
  created_at: string
  processed_at?: string
}
```

---

## 🚀 Exemplo de Integração React

```typescript
// hooks/useConversations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => api.get('/conversations', { params: filters }),
  })
}

export function useHandoff(conversationId: string) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: { assigned_to?: string; reason?: string }) =>
      api.post(`/conversations/${conversationId}/handoff`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
```

---

**Próximo passo sugerido:** Deploy do Backend ou continuar com o Frontend?
