# Connections API - Backend Requirements

## Overview
API endpoints for managing WhatsApp connections, quick replies templates, and tenant settings.

## Base URL
`/api/v1/connections`

---

## WhatsApp Connections

### Data Model
```typescript
interface WhatsAppConnection {
  id: string
  name: string
  description: string | null
  provider: 'uazapi' | 'evolution' | 'meta_cloud' | 'baileys'
  instance_id: string | null
  api_url: string | null
  api_key: string | null  // Encrypted
  webhook_url: string | null
  status: 'connecting' | 'connected' | 'disconnected' | 'qr_pending' | 'error' | 'banned'
  qr_code: string | null
  qr_expires_at: string | null
  phone_number: string | null
  phone_name: string | null
  phone_platform: string | null
  is_default: boolean
  is_active: boolean
  auto_reconnect: boolean
  daily_message_limit: number
  messages_sent_today: number
  total_messages_sent: number
  total_messages_received: number
  connected_at: string | null
  disconnected_at: string | null
  created_at: string
  updated_at: string
}
```

### Endpoints

#### GET /connections
List all WhatsApp connections for the tenant.

**Response:**
```json
{
  "data": [WhatsAppConnection],
  "count": 3
}
```

#### POST /connections
Create a new connection.

**Request Body:**
```json
{
  "name": "WhatsApp Principal",
  "description": "Conexão principal da empresa",
  "provider": "uazapi",
  "instance_id": "inst_123",
  "api_url": "https://api.uazapi.com",
  "api_key": "token_xxx",
  "is_default": true,
  "daily_message_limit": 1000
}
```

**Business Rules:**
- Only one connection can be `is_default = true` at a time
- When setting new default, unset previous default
- Encrypt `api_key` before storing

#### PUT /connections/:id
Update connection configuration.

#### DELETE /connections/:id
Remove a connection.

**Business Rules:**
- Cannot delete connection with active campaigns
- Disconnect WhatsApp before deleting

#### POST /connections/:id/connect
Initiate connection to WhatsApp gateway.

**Response:**
```json
{
  "status": "qr_pending",
  "qr_code": "data:image/png;base64,...",
  "qr_expires_at": "2026-01-06T20:00:00Z"
}
```

**Flow:**
1. Call gateway API to generate QR code
2. Return QR code to frontend
3. Gateway sends webhook when connected
4. Update status to `connected`

#### POST /connections/:id/disconnect
Disconnect from WhatsApp.

**Business Rules:**
- Update status to `disconnected`
- Store `disconnected_at` timestamp

#### GET /connections/:id/status
Get real-time connection status from gateway.

**Response:**
```json
{
  "status": "connected",
  "phone_number": "+5511999999999",
  "phone_name": "WhatsApp Business",
  "battery_level": 85,
  "is_charging": true
}
```

---

## Quick Replies

### Data Model
```typescript
interface QuickReply {
  id: string
  title: string
  content: string
  shortcut: string | null  // e.g., "/oi"
  category: string | null  // e.g., "saudacao", "vendas"
  media_url: string | null
  media_type: string | null
  is_active: boolean
  usage_count: number
  last_used_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}
```

### Endpoints

#### GET /quick-replies
List quick replies.

**Query Parameters:**
- `category` - Filter by category
- `search` - Full-text search in title/content

#### POST /quick-replies
Create quick reply.

**Request Body:**
```json
{
  "title": "Saudação Inicial",
  "content": "Olá! Como posso ajudar você hoje?",
  "shortcut": "/oi",
  "category": "saudacao"
}
```

**Business Rules:**
- Shortcut must be unique if provided
- Shortcut must start with `/`

#### PUT /quick-replies/:id
Update quick reply.

#### DELETE /quick-replies/:id
Remove quick reply.

#### POST /quick-replies/:id/use
Increment usage counter (called when user uses the reply).

---

## Tenant Settings

### Data Model
```typescript
interface TenantSetting {
  id: string
  key: string  // unique
  value: any   // JSONB
  category: string
  description: string | null
  created_at: string
  updated_at: string
}
```

### Endpoints

#### GET /settings
Get all settings as key-value map.

**Query Parameters:**
- `category` - Filter by category

**Response:**
```json
{
  "company_name": "Minha Empresa",
  "timezone": "America/Sao_Paulo",
  "welcome_message": "Olá!",
  "ai_enabled": true,
  "ai_model": "gpt-4"
}
```

#### PUT /settings
Bulk update settings.

**Request Body:**
```json
{
  "settings": [
    { "key": "company_name", "value": "Nova Empresa", "category": "general" },
    { "key": "ai_enabled", "value": false, "category": "ai" }
  ]
}
```

#### GET /settings/:key
Get single setting value.

#### PUT /settings/:key
Update single setting.

---

## Webhooks from Gateway

The backend should expose webhook endpoints for WhatsApp gateways to send events:

### POST /webhooks/whatsapp/:provider
Receive events from gateway.

**Event Types:**
- `connection.update` - Status changed
- `qrcode.updated` - New QR code generated
- `message.received` - Incoming message
- `message.ack` - Delivery confirmation
- `message.failed` - Delivery failed

---

## Implementation Checklist

- [ ] Create `whatsapp_connections` table in tenant DB
- [ ] Create `quick_replies` table in tenant DB
- [ ] Create `tenant_settings` table with default values
- [ ] Implement CRUD endpoints for connections
- [ ] Implement gateway integration (UAZAPI, Evolution)
- [ ] Implement QR code generation flow
- [ ] Implement webhook handlers for gateway events
- [ ] Implement CRUD for quick replies
- [ ] Implement settings get/update
- [ ] Add encryption for API keys
- [ ] Add rate limiting for connection attempts
