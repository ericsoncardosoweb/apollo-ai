# Backend API Requirements - Contacts Module

> Documentação de requisitos para o backend implementar a API de Contatos

**Status**: 🔴 Não Iniciado | 🟡 Em Progresso | 🟢 Concluído

---

## Endpoints Necessários

### Contatos

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/contacts` | GET | Listar contatos com filtros e paginação |
| ⬜ | `/api/v1/contacts` | POST | Criar contato |
| ⬜ | `/api/v1/contacts/{id}` | GET | Obter contato por ID |
| ⬜ | `/api/v1/contacts/{id}` | PUT | Atualizar contato |
| ⬜ | `/api/v1/contacts/{id}` | DELETE | Soft delete contato |
| ⬜ | `/api/v1/contacts/by-phone/{phone}` | GET | Buscar por telefone |
| ⬜ | `/api/v1/contacts/by-whatsapp/{whatsapp}` | GET | Buscar por WhatsApp |
| ⬜ | `/api/v1/contacts/stats` | GET | Estatísticas de contatos |

### Ações em Massa

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/contacts/bulk/delete` | POST | Excluir múltiplos |
| ⬜ | `/api/v1/contacts/bulk/tags` | POST | Adicionar/remover tags |
| ⬜ | `/api/v1/contacts/bulk/update` | POST | Atualizar campos |

### Importação/Exportação

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/contacts/import` | POST | Importar CSV (multipart) |
| ⬜ | `/api/v1/contacts/import/preview` | POST | Preview da importação |
| ⬜ | `/api/v1/contacts/export` | POST | Exportar para CSV |

### Tags

| Status | Endpoint | Método | Descrição |
|--------|----------|--------|-----------|
| ⬜ | `/api/v1/contact-tags` | GET | Listar tags |
| ⬜ | `/api/v1/contact-tags` | POST | Criar tag |
| ⬜ | `/api/v1/contact-tags/{id}` | PUT | Atualizar tag |
| ⬜ | `/api/v1/contact-tags/{id}` | DELETE | Excluir tag |

---

## Schemas

### Contact

```typescript
interface Contact {
    id: string
    name: string
    email: string | null
    phone: string | null
    whatsapp: string | null    // Normalizado: apenas dígitos, com DDI
    cpf: string | null         // Formatado: 000.000.000-00
    cnpj: string | null        // Formatado: 00.000.000/0000-00
    type: 'lead' | 'customer' | 'supplier' | 'partner' | 'other'
    status: 'active' | 'inactive' | 'blocked'
    tags: string[]             // Array de nomes de tags
    source: string | null      // 'manual', 'import', 'whatsapp', 'landing_page', etc.
    avatar_url: string | null
    notes: string | null
    
    // Endereço
    address_street: string | null
    address_number: string | null
    address_complement: string | null
    address_neighborhood: string | null
    address_city: string | null
    address_state: string | null
    address_zipcode: string | null
    
    // Empresa
    company_name: string | null
    company_role: string | null
    
    // Flexível
    metadata: Record<string, unknown>
    
    // Audit
    created_by: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null  // Soft delete
}
```

### ContactTag

```typescript
interface ContactTag {
    id: string
    name: string
    color: string         // Hex: #3b82f6
    description: string | null
    created_at: string
}
```

---

## Regras de Negócio

### ⬜ Normalização de Dados

Ao criar/atualizar contato:
- **WhatsApp**: Remover espaços, parênteses, traços. Manter apenas dígitos. Adicionar DDI 55 se não tiver.
  - Entrada: `(11) 99999-9999` → Saída: `5511999999999`
- **Email**: Converter para minúsculas, trim
- **CPF**: Validar dígitos verificadores. Formatar: `000.000.000-00`
- **CNPJ**: Validar dígitos verificadores. Formatar: `00.000.000/0000-00`

### ⬜ Validação de Duplicados

- WhatsApp deve ser único (constraint no banco)
- Email deve ser único se informado
- Na importação, detectar duplicados e permitir:
  - Ignorar
  - Atualizar existente
  - Criar como novo

### ⬜ Soft Delete

- Contatos nunca são deletados fisicamente
- Usar `deleted_at` timestamp
- Contatos deletados não aparecem em listagens normais
- Manter histórico de conversas e atividades

### ⬜ Busca e Filtros

Suportar filtros simultâneos:
- `search`: Nome, email, telefone (ILIKE)
- `type`: Tipo do contato
- `status`: Status do contato
- `tags`: Array de tags (overlap)
- `source`: Origem
- `created_after`: Data de criação
- `created_before`: Data de criação

---

## Importação de Contatos

### Request

```typescript
POST /api/v1/contacts/import
Content-Type: multipart/form-data

{
    file: File,                    // CSV file
    field_mapping: {
        "0": "name",               // Coluna 0 → campo name
        "1": "email",
        "2": "whatsapp",
        // ...
    },
    has_header: true,              // Primeira linha é cabeçalho
    skip_duplicates: true,         // Ignorar duplicados
    default_type: "lead",          // Tipo padrão
    default_tags: ["importado"],   // Tags padrão
}
```

### Response

```typescript
{
    success: true,
    imported: 150,
    skipped: 10,
    failed: 5,
    errors: [
        { row: 23, message: "Email inválido" },
        { row: 45, message: "WhatsApp duplicado" },
    ]
}
```

---

## Checklist de Implementação

### Banco de Dados
- [ ] Executar migration `contacts_v2.sql`
- [ ] Índices para busca full-text
- [ ] Constraint de unicidade (whatsapp, email)

### API Endpoints
- [ ] CRUD Contatos
- [ ] Busca por telefone/whatsapp
- [ ] Bulk actions
- [ ] Import/Export

### Validações
- [ ] CPF/CNPJ validator
- [ ] Email validator
- [ ] Phone normalizer

---

**Última atualização**: 2026-01-06
