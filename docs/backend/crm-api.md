# Backend API Requirements - CRM Module

> Documentação de requisitos para o backend implementar a API do CRM

**Status**: 🔴 Não Iniciado | 🟡 Em Progresso | 🟢 Concluído

---

## Endpoints Necessários

### Pipelines

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/pipelines` | GET | Listar pipelines |
| ⬜ | `/api/v1/pipelines` | POST | Criar pipeline |
| ⬜ | `/api/v1/pipelines/{id}` | GET | Obter pipeline com stages |
| ⬜ | `/api/v1/pipelines/{id}` | PUT | Atualizar pipeline |
| ⬜ | `/api/v1/pipelines/{id}` | DELETE | Excluir pipeline |
| ⬜ | `/api/v1/pipelines/{id}/set-default` | POST | Definir como padrão |

### Pipeline Stages (Colunas)

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/pipelines/{id}/stages` | GET | Listar stages do pipeline |
| ⬜ | `/api/v1/pipelines/{id}/stages` | POST | Criar stage |
| ⬜ | `/api/v1/pipelines/{id}/stages/{stageId}` | PUT | Atualizar stage |
| ⬜ | `/api/v1/pipelines/{id}/stages/{stageId}` | DELETE | Excluir stage |
| ⬜ | `/api/v1/pipelines/{id}/stages/reorder` | POST | Reordenar stages |

### Deals (Cards no Kanban)

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/deals` | GET | Listar deals com filtros |
| ⬜ | `/api/v1/deals` | POST | Criar deal |
| ⬜ | `/api/v1/deals/{id}` | GET | Obter deal com atividades |
| ⬜ | `/api/v1/deals/{id}` | PUT | Atualizar deal |
| ⬜ | `/api/v1/deals/{id}` | DELETE | Excluir deal |
| ⬜ | `/api/v1/deals/{id}/move` | POST | Mover para outro stage |
| ⬜ | `/api/v1/deals/{id}/activities` | GET | Listar atividades |
| ⬜ | `/api/v1/deals/{id}/activities` | POST | Adicionar atividade |

---

## Schemas

### Pipeline

```typescript
interface Pipeline {
    id: string
    name: string
    description: string | null
    is_default: boolean
    is_active: boolean
    color: string | null
    settings: {
        probability_enabled?: boolean
        deadline_enabled?: boolean
        auto_archive_days?: number
    }
    created_at: string
    updated_at: string
    
    // Incluído quando solicitado
    stages?: PipelineStage[]
}
```

### PipelineStage

```typescript
interface PipelineStage {
    id: string
    pipeline_id: string
    name: string
    color: string
    position: number
    probability: number | null  // 0-100
    is_won: boolean            // Stage de ganho
    is_lost: boolean           // Stage de perda
    automation_rules: AutomationRule[]
    created_at: string
    
    // Stats (quando include=stats)
    deal_count?: number
    total_value?: number
}

interface AutomationRule {
    type: 'add_tag' | 'remove_tag' | 'send_message' | 'notify' | 'webhook'
    config: Record<string, unknown>
}
```

### Deal

```typescript
interface Deal {
    id: string
    pipeline_id: string
    stage_id: string
    contact_id: string | null
    conversation_id: string | null
    
    title: string
    value: number
    probability: number | null
    expected_close_date: string | null
    
    status: 'open' | 'won' | 'lost'
    lost_reason: string | null
    won_at: string | null
    lost_at: string | null
    
    assigned_to: string | null
    tags: string[]
    custom_fields: Record<string, unknown>
    
    created_at: string
    updated_at: string
    
    // Relacionamentos (quando include=*)
    contact?: Contact
    stage?: PipelineStage
    activities?: DealActivity[]
}

interface DealActivity {
    id: string
    deal_id: string
    type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'stage_change' | 'value_change'
    title: string
    description: string | null
    scheduled_at: string | null
    completed_at: string | null
    created_by: string | null
    created_at: string
}
```

---

## Regras de Negócio

### ⬜ Pipeline Padrão

- Cada tenant deve ter exatamente **um** pipeline marcado como `is_default = true`
- Ao marcar um pipeline como padrão, desmarcar o anterior
- Não permitir excluir o pipeline padrão se for o único

### ⬜ Ordenação de Stages

- Stages têm `position` começando em 0
- Ao criar novo stage, colocar no final
- Ao reordenar, atualizar todas as positions

### ⬜ Automações de Stage

Quando um deal entra em um stage, executar as `automation_rules`:
- `add_tag`: Adicionar etiqueta ao contato
- `remove_tag`: Remover etiqueta
- `send_message`: Enviar mensagem template
- `notify`: Notificar usuário/equipe
- `webhook`: Disparar webhook externo

### ⬜ Cálculo de Probabilidade

- Se `probability_enabled` no pipeline, calcular valor ponderado
- Fórmula: `weighted_value = value * (probability / 100)`

### ⬜ Auditoria de Mudanças

Registrar atividades automaticamente quando:
- Deal muda de stage
- Valor é alterado
- Status muda para won/lost

---

## Checklist de Implementação

### Banco de Dados
- [ ] Executar migration `crm_engine_v2.sql`
- [ ] Seed de pipeline padrão
- [ ] Índices de performance

### API Endpoints
- [ ] CRUD Pipelines
- [ ] CRUD Stages
- [ ] CRUD Deals
- [ ] Move Deal
- [ ] Activities

### Automações
- [ ] Trigger de stage change
- [ ] Execução de automation_rules

---

**Última atualização**: 2026-01-06
