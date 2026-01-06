# API Requirements - Client Dashboard

Este documento lista os endpoints e formatos JSON necessários para alimentar o Dashboard operacional de alta densidade.

---

## 1. Dashboard Stats (KPIs)

**Endpoint:** `GET /api/dashboard/stats`

**Query Params:**
- `tenant_id` (required)
- `period`: 'today' | 'yesterday' | '7days' | '30days'
- `start_date`: ISO date (se period = 'custom')
- `end_date`: ISO date (se period = 'custom')
- `product_id`: UUID (opcional)
- `agent_id`: UUID (opcional)

**Response:**
```json
{
  "total_conversas": { "value": 247, "trend": 12.5, "trend_up": true },
  "oportunidades_ativas": { "value": 34, "trend": 8.2, "trend_up": true },
  "total_contatos": { "value": 1892, "trend": 5.1, "trend_up": true },
  "novos_leads": { "value": 15, "trend": -3.2, "trend_up": false },
  "agentes_ativos": { "value": 3, "trend": 0, "trend_up": true },
  "servicos_cadastrados": { "value": 12, "trend": 2, "trend_up": true }
}
```

---

## 2. Funnel Data

**Endpoint:** `GET /api/dashboard/funnel`

**Query Params:**
- `tenant_id` (required)
- `period`
- `product_id` (opcional)

**Response:**
```json
{
  "stages": [
    { "name": "Visitantes", "value": 1500, "color": "gray" },
    { "name": "Leads", "value": 450, "color": "blue", "conversion_rate": 30 },
    { "name": "Oportunidades", "value": 120, "color": "orange", "conversion_rate": 26.7 },
    { "name": "Vendas", "value": 45, "color": "green", "conversion_rate": 37.5 }
  ],
  "total_conversion_rate": 3.0,
  "comparison_vs_previous": 15.2
}
```

---

## 3. Agent Performance

**Endpoint:** `GET /api/dashboard/agents-performance`

**Query Params:**
- `tenant_id` (required)
- `period`

**Response:**
```json
{
  "average_score": 91,
  "agents": [
    { "id": "uuid", "name": "Lia - Atendimento", "score": 92, "conversations": 156 },
    { "id": "uuid", "name": "Carlos - Vendas", "score": 87, "conversations": 78 },
    { "id": "uuid", "name": "Ana - Suporte", "score": 95, "conversations": 42 }
  ]
}
```

---

## 4. Filter Options

### 4.1 Products List
**Endpoint:** `GET /api/products`  
**Query Params:** `tenant_id`

```json
[
  { "id": "uuid", "name": "Curso de IA" },
  { "id": "uuid", "name": "Consultoria Premium" }
]
```

### 4.2 Agents List
**Endpoint:** `GET /api/agents`  
**Query Params:** `tenant_id`

```json
[
  { "id": "uuid", "name": "Lia - Atendimento" },
  { "id": "uuid", "name": "Carlos - Vendas" }
]
```

---

## 5. Drill-down Data

### 5.1 Leads List
**Endpoint:** `GET /api/leads`  
**Query Params:** `tenant_id`, `period`, `limit=50`

```json
[
  {
    "id": "uuid",
    "name": "João Silva",
    "phone": "+55 11 99999-1234",
    "email": "joao@email.com",
    "source": "WhatsApp",
    "created_at": "2026-01-06T10:30:00Z",
    "conversation_id": "uuid",
    "crm_lead_id": "uuid"
  }
]
```

### 5.2 Conversations List
**Endpoint:** `GET /api/conversations`  
**Query Params:** `tenant_id`, `period`, `agent_id`, `limit=50`

```json
[
  {
    "id": "uuid",
    "contact_name": "Maria Santos",
    "contact_phone": "+55 11 98888-5678",
    "agent_name": "Lia",
    "status": "active",
    "messages_count": 12,
    "started_at": "2026-01-06T09:15:00Z"
  }
]
```

### 5.3 Opportunities List
**Endpoint:** `GET /api/crm/opportunities`  
**Query Params:** `tenant_id`, `period`, `stage`

```json
[
  {
    "id": "uuid",
    "lead_name": "Carlos Lima",
    "phone": "+55 21 97777-9012",
    "stage": "Qualificação",
    "value": 5000.00,
    "probability": 60,
    "created_at": "2026-01-06T08:00:00Z"
  }
]
```

---

## Supabase RPC Functions

Para performance, considere criar as seguintes funções SQL:

```sql
-- get_dashboard_stats(tenant_id, period_start, period_end)
-- get_funnel_data(tenant_id, period_start, period_end, product_id)
-- get_agents_performance(tenant_id, period_start, period_end)
```
