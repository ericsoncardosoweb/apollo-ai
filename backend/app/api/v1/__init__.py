"""
Apollo A.I. Advanced - API v1 Router
"""

from fastapi import APIRouter

from app.api.v1 import (
    auth, tenants, agents, conversations, messages, crm, tools, 
    webhooks, uploads, deals, pipelines, automations, contacts, knowledge,
    campaigns, templates, agent_builder
)

router = APIRouter()

# Include all sub-routers
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
router.include_router(agents.router, prefix="/agents", tags=["Agents"])
router.include_router(conversations.router, prefix="/conversations", tags=["Conversations"])
router.include_router(messages.router, prefix="/messages", tags=["Messages"])
router.include_router(crm.router, prefix="/crm", tags=["CRM"])
router.include_router(tools.router, prefix="/tools", tags=["Tools"])
router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
router.include_router(uploads.router)

# Client Database - Contacts & Knowledge (uses tenant's Supabase)
router.include_router(contacts.router)  # /contacts
router.include_router(knowledge.router)  # /knowledge

# Campaigns & Templates
router.include_router(campaigns.router)  # /campaigns
router.include_router(templates.router)  # /message-templates

# Agent Builder IDE
router.include_router(agent_builder.router)  # /agent-builder

# CRM Engine V2
router.include_router(deals.router)
router.include_router(pipelines.router)
router.include_router(automations.router)

