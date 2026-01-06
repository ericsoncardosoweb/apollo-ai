"""
Apollo A.I. Advanced - Conversations Endpoints
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
import structlog

from app.api.deps import CurrentUser, TenantContext
from app.db.supabase import fetch_one, fetch_many, insert_one, update_one, get_supabase

logger = structlog.get_logger()
router = APIRouter()


# ===========================================
# Schemas
# ===========================================

class ConversationResponse(BaseModel):
    """Conversation response schema."""
    id: UUID
    tenant_id: UUID
    agent_id: Optional[UUID]
    lead_id: Optional[UUID]
    external_id: Optional[str]
    channel: str
    phone_number: Optional[str]
    assigned_to: Optional[UUID]
    status: str
    priority: str
    mode: str
    tags: List[str]
    message_count: int
    last_message_at: datetime


class ConversationUpdate(BaseModel):
    """Conversation update schema."""
    status: Optional[str] = None
    priority: Optional[str] = None
    mode: Optional[str] = None
    assigned_to: Optional[UUID] = None
    tags: Optional[List[str]] = None


class HandoffRequest(BaseModel):
    """Request to transfer conversation to human."""
    reason: Optional[str] = None


# ===========================================
# Endpoints
# ===========================================

@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: CurrentUser,
    tenant: TenantContext,
    status_filter: Optional[str] = Query(None, alias="status"),
    mode_filter: Optional[str] = Query(None, alias="mode"),
    assigned_to: Optional[UUID] = None,
    limit: int = Query(50, le=100),
    offset: int = 0
):
    """
    List conversations for the current tenant.
    
    Supports filtering by status, mode, and assignee.
    """
    client = get_supabase()
    query = client.table("conversations").select("*").eq(
        "tenant_id", tenant["tenant_id"]
    )
    
    if status_filter:
        query = query.eq("status", status_filter)
    
    if mode_filter:
        query = query.eq("mode", mode_filter)
    
    if assigned_to:
        query = query.eq("assigned_to", str(assigned_to))
    
    query = query.order("last_message_at", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data or []


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Get a specific conversation by ID."""
    conversation = await fetch_one("conversations", {
        "id": str(conversation_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return conversation


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: UUID,
    conversation_data: ConversationUpdate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Update a conversation."""
    update_data = conversation_data.model_dump(exclude_unset=True)
    
    if "assigned_to" in update_data and update_data["assigned_to"]:
        update_data["assigned_to"] = str(update_data["assigned_to"])
    
    conversation = await update_one(
        "conversations",
        {"id": str(conversation_id), "tenant_id": tenant["tenant_id"]},
        update_data
    )
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    logger.info("Conversation updated", conversation_id=str(conversation_id))
    return conversation


@router.post("/{conversation_id}/handoff")
async def handoff_to_human(
    conversation_id: UUID,
    request: HandoffRequest,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Transfer conversation from AI to human agent.
    
    Assigns the conversation to the current user if no specific
    agent is assigned, and changes mode to 'human'.
    """
    update_data = {
        "mode": "human",
        "handoff_reason": request.reason,
        "handoff_at": datetime.utcnow().isoformat(),
    }
    
    # Assign to current user if not already assigned
    conversation = await fetch_one("conversations", {
        "id": str(conversation_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if not conversation.get("assigned_to"):
        update_data["assigned_to"] = current_user["id"]
    
    updated = await update_one(
        "conversations",
        {"id": str(conversation_id)},
        update_data
    )
    
    logger.info(
        "Conversation handed off to human",
        conversation_id=str(conversation_id),
        agent_id=current_user["id"],
        reason=request.reason
    )
    
    return {
        "message": "Conversation transferred to human agent",
        "conversation": updated
    }


@router.post("/{conversation_id}/return-to-ai")
async def return_to_ai(
    conversation_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Return conversation from human agent back to AI.
    """
    conversation = await fetch_one("conversations", {
        "id": str(conversation_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.get("mode") != "human":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation is not in human mode"
        )
    
    updated = await update_one(
        "conversations",
        {"id": str(conversation_id)},
        {"mode": "ai", "assigned_to": None}
    )
    
    logger.info(
        "Conversation returned to AI",
        conversation_id=str(conversation_id)
    )
    
    return {
        "message": "Conversation returned to AI",
        "conversation": updated
    }


@router.post("/{conversation_id}/resolve")
async def resolve_conversation(
    conversation_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Mark a conversation as resolved."""
    updated = await update_one(
        "conversations",
        {"id": str(conversation_id), "tenant_id": tenant["tenant_id"]},
        {
            "status": "resolved",
            "resolved_at": datetime.utcnow().isoformat()
        }
    )
    
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    logger.info("Conversation resolved", conversation_id=str(conversation_id))
    
    return {
        "message": "Conversation resolved",
        "conversation": updated
    }
