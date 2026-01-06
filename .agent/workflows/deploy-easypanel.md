---
description: How to deploy Apollo A.I. to Easypanel production
---

# Deploy to Easypanel Production

## Prerequisites
- Easypanel instance configured
- GitHub repository connected to Easypanel
- Supabase project with migrations executed

## Steps

1. **Ensure all changes are committed to main**
```bash
git add -A
git commit -m "feat: description of changes"
git push origin main
```

2. **Merge main into production branch**
```bash
git checkout production
git merge main
git push origin production
```
// turbo

3. **Easypanel will auto-deploy from production branch**
The Dockerfile in root builds both backend and frontend in a single container.

## Easypanel Configuration

**Service Settings:**
- **Branch:** `production`
- **Dockerfile:** `Dockerfile` (root)
- **Port:** `80`

**Environment Variables (set in Easypanel):**
```
SUPABASE_URL=https://qdugrmcdbbqabokmmftl.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
OPENAI_API_KEY=<your-openai-key>
ENVIRONMENT=production
DEBUG=false
```

## Rollback
```bash
git checkout production
git reset --hard <previous-commit-hash>
git push origin production --force
```
