#!/bin/bash
# ===========================================
# Script para configurar o repositório apollo-api
# Execute este script na pasta raiz do projeto
# ===========================================

echo "🚀 Configurando repositório apollo-api..."

# Clonar o repositório vazio
cd c:/www
git clone https://github.com/ericsoncardosoweb/apollo-api.git
cd apollo-api

# Copiar o backend do apollo-ia-advanced
echo "📁 Copiando código do backend..."
cp -r ../apollo-ia-advanced/backend/* .

# Criar Dockerfile na raiz
cat > Dockerfile << 'EOF'
# ===========================================
# Apollo A.I. - Backend API (Python FastAPI)
# ===========================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app/ ./app/

# Expose port 8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
EOF

# Criar .gitignore
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
.venv/
venv/
env/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# Logs
*.log

# OS
.DS_Store
Thumbs.db
EOF

# Commitar
echo "📦 Criando commit inicial..."
git add -A
git commit -m "feat: initial backend API setup for Easypanel deploy"

# Criar branch production
echo "🌿 Criando branch production..."
git checkout -b production
git push origin production

# Voltar para main e push
git checkout main
git push origin main

echo "✅ Repositório apollo-api configurado!"
echo ""
echo "Próximos passos no Easypanel:"
echo "1. Configure a branch 'production' no apollo-api"
echo "2. Configure as variáveis de ambiente no Ambiente"
echo "3. Clique em Implantar"
