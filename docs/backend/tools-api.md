# Tools API - Backend Requirements

## Overview
API endpoints for managing AI agent tools/functions and external integrations. Tools are functions that AI agents can call during conversations to perform actions like updating CRM, scheduling appointments, or fetching data.

## Base URL
`/api/v1/tools`

---

## Tools (AI Functions)

### Data Model
```typescript
interface Tool {
  id: string
  name: string           // Function name (camelCase)
  display_name: string   // Human-readable name
  description: string    // Description for AI to understand when to use
  type: 'function' | 'webhook' | 'integration'
  
  // Function definition (OpenAI function calling format)
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
  
  // Execution config
  execution_type: 'internal' | 'webhook' | 'code'
  webhook_url: string | null       // For webhook type
  webhook_method: 'GET' | 'POST'   // Default: POST
  webhook_headers: Record<string, string>
  code: string | null              // JavaScript code for code type
  
  // Permissions
  requires_confirmation: boolean   // Ask user before executing
  allowed_agents: string[]         // Which agents can use this tool
  
  // Status
  is_active: boolean
  is_system: boolean              // Built-in tools
  
  // Stats
  execution_count: number
  last_executed_at: string | null
  avg_execution_time_ms: number
  error_count: number
  
  created_at: string
  updated_at: string
}

interface ToolExecution {
  id: string
  tool_id: string
  agent_id: string
  conversation_id: string
  
  // Request/Response
  input_params: Record<string, any>
  output_result: any
  
  // Status
  status: 'pending' | 'running' | 'success' | 'error'
  error_message: string | null
  execution_time_ms: number
  
  executed_at: string
}
```

### Endpoints

#### GET /tools
List all tools for the tenant.

**Query Parameters:**
- `type` - Filter by type
- `is_active` - Filter by status
- `agent_id` - Filter by allowed agent

**Response:**
```json
{
  "data": [
    {
      "id": "tool_123",
      "name": "updateCRM",
      "display_name": "Atualizar CRM",
      "description": "Atualiza o status de um lead no pipeline do CRM",
      "type": "function",
      "parameters": {
        "type": "object",
        "properties": {
          "contact_id": {
            "type": "string",
            "description": "ID do contato"
          },
          "stage": {
            "type": "string",
            "description": "Nova etapa do pipeline",
            "enum": ["lead", "qualificado", "proposta", "fechamento"]
          }
        },
        "required": ["contact_id", "stage"]
      },
      "is_active": true,
      "execution_count": 234
    }
  ]
}
```

#### POST /tools
Create a new tool.

**Request Body:**
```json
{
  "name": "scheduleAppointment",
  "display_name": "Agendar Reunião",
  "description": "Agenda uma reunião no Google Calendar",
  "type": "function",
  "parameters": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "description": "Data (YYYY-MM-DD)" },
      "time": { "type": "string", "description": "Horário (HH:MM)" },
      "title": { "type": "string", "description": "Título da reunião" }
    },
    "required": ["date", "time", "title"]
  },
  "execution_type": "webhook",
  "webhook_url": "https://n8n.example.com/webhook/calendar",
  "webhook_method": "POST",
  "requires_confirmation": true
}
```

**Validation Rules:**
- `name` must be unique, alphanumeric + underscore
- `name` cannot be a reserved word
- `parameters` must be valid JSON Schema
- `webhook_url` must be valid HTTPS URL

#### PUT /tools/:id
Update tool configuration.

**Business Rules:**
- Cannot modify `is_system` tools' core fields
- Changing parameters may break existing agent prompts

#### DELETE /tools/:id
Remove a tool.

**Business Rules:**
- Cannot delete system tools
- Warn if tool is used by agents

#### PATCH /tools/:id/toggle
Enable/disable a tool.

```json
{
  "is_active": false
}
```

---

## Tool Execution

#### POST /tools/:id/execute
Manually execute a tool (for testing).

**Request Body:**
```json
{
  "params": {
    "contact_id": "contact_123",
    "stage": "proposta"
  },
  "test_mode": true
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "updated": true,
    "previous_stage": "qualificado",
    "new_stage": "proposta"
  },
  "execution_time_ms": 245
}
```

#### POST /tools/execute-for-agent
Called by AI agent during conversation.

**Request Body:**
```json
{
  "tool_name": "updateCRM",
  "agent_id": "agent_vendas",
  "conversation_id": "conv_123",
  "params": {
    "contact_id": "contact_123",
    "stage": "proposta"
  }
}
```

**Business Rules:**
- Verify agent has permission to use tool
- Log execution for audit
- If `requires_confirmation`, return pending status

#### GET /tools/:id/executions
Get execution history for a tool.

**Query Parameters:**
- `status` - Filter by status
- `from` / `to` - Date range
- `limit` / `offset` - Pagination

---

## Integrations

### Data Model
```typescript
interface Integration {
  id: string
  name: string
  provider: 'google_calendar' | 'google_sheets' | 'rd_station' | 'hubspot' | 'custom'
  
  // OAuth
  access_token: string | null      // Encrypted
  refresh_token: string | null     // Encrypted
  token_expires_at: string | null
  
  // API config
  api_key: string | null           // Encrypted
  api_url: string | null
  
  // Status
  is_connected: boolean
  last_sync_at: string | null
  error_message: string | null
  
  // Settings
  settings: Record<string, any>    // Provider-specific config
  
  created_at: string
  updated_at: string
}
```

### Endpoints

#### GET /integrations
List available integrations.

#### POST /integrations/:provider/connect
Initiate OAuth flow.

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/oauth/authorize?..."
}
```

#### POST /integrations/:provider/callback
OAuth callback handler.

#### POST /integrations/:id/disconnect
Disconnect integration.

#### POST /integrations/:id/sync
Trigger manual sync.

---

## System Tools (Built-in)

These tools are pre-installed for every tenant:

| Name | Description |
|------|-------------|
| `updateContactStatus` | Update contact status in database |
| `updatePipelineStage` | Move deal to different CRM stage |
| `createTask` | Create a follow-up task |
| `sendEmail` | Send email via connected integration |
| `scheduleMessage` | Schedule a WhatsApp message |
| `searchProducts` | Search product catalog |
| `getContactHistory` | Fetch conversation history |
| `transferToHuman` | Transfer conversation to human agent |
| `endConversation` | Mark conversation as resolved |

---

## AI Agent Tool Configuration

When configuring an agent, specify which tools it can use:

```json
{
  "agent_id": "agent_vendas",
  "allowed_tools": ["updateCRM", "searchProducts", "scheduleMessage"],
  "tool_confirmation_mode": "always" | "dangerous" | "never"
}
```

---

## Implementation Checklist

- [ ] Create `tools` table in tenant DB
- [ ] Create `tool_executions` table for audit log
- [ ] Create `integrations` table
- [ ] Implement CRUD endpoints for tools
- [ ] Implement tool execution engine
- [ ] Add webhook caller for webhook-type tools
- [ ] Add JavaScript sandbox for code-type tools
- [ ] Implement OAuth flow for integrations
- [ ] Add system tools with internal logic
- [ ] Add execution logging and analytics
- [ ] Add rate limiting per tool
- [ ] Add permission checks for agents

---

## Security Considerations

1. **Sandbox Execution**: Code-type tools run in isolated environment
2. **Secret Management**: API keys/tokens encrypted at rest
3. **Webhook Validation**: Sign webhook requests with HMAC
4. **Rate Limiting**: Prevent abuse of external APIs
5. **Audit Trail**: Log all tool executions
6. **Permission Model**: Tools scoped to specific agents
