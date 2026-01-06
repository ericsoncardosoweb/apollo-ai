# 🚀 Apollo A.I. Advanced

> Plataforma SaaS Multi-Tenant para Agentes de I.A. Conversacionais focados em Vendas e Suporte via WhatsApp.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      Apollo A.I. Advanced                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + Vite + TypeScript + TailwindCSS + ShadcnUI)  │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Python FastAPI + LangGraph + Pydantic)                │
├─────────────────────────────────────────────────────────────────┤
│  Database (Supabase: PostgreSQL + Auth + Realtime + PgVector)   │
├─────────────────────────────────────────────────────────────────┤
│  Queue (Redis + Celery)  │  WhatsApp (Evolution/Z-API/Meta)     │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Estrutura do Projeto

```
apollo-ia-advanced/
├── backend/          # Python FastAPI + LangGraph + AI Core
├── frontend/         # React + Vite + TypeScript
├── docker/           # Dockerfiles e configurações
├── supabase/         # Migrations e Edge Functions
└── docs/             # Documentação técnica
```

## 🚀 Quick Start

### Pré-requisitos

- Docker e Docker Compose
- Node.js 20+
- Python 3.11+
- Conta no Supabase

### Desenvolvimento Local

1. **Clone e configure:**
```bash
git clone https://github.com/seu-user/apollo-ia-advanced.git
cd apollo-ia-advanced
cp .env.example .env
# Edite .env com suas credenciais
```

2. **Inicie os serviços:**
```bash
docker-compose up -d
```

3. **Acesse:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Sem Docker (Desenvolvimento)

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Comandos Úteis

```bash
# Iniciar todos os serviços
make up

# Parar serviços
make down

# Logs do backend
make logs-backend

# Executar migrations
make migrate

# Rodar testes
make test
```

## 📚 Documentação

- [Arquitetura](docs/architecture.md)
- [API Reference](docs/api.md)
- [Deployment](docs/deployment.md)
- [Agent Design](docs/agent-design.md)

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React, Vite, TypeScript, TailwindCSS, ShadcnUI |
| Backend | Python, FastAPI, LangGraph, Pydantic |
| AI | OpenAI GPT-4, LangChain, PgVector (RAG) |
| Database | Supabase (PostgreSQL), Redis |
| Messaging | Evolution API, Z-API, UAZAPI, Meta Cloud API |
| Deploy | Docker, Coolify, VPS Hostinger |

## 📄 Licença

Proprietary - All rights reserved.
