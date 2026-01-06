"""
Apollo A.I. Advanced - Agents Endpoints
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import structlog

from app.api.deps import CurrentUser, TenantContext
from app.db.supabase import fetch_one, fetch_many, insert_one, update_one, delete_one

logger = structlog.get_logger()
router = APIRouter()


# ===========================================
# Schemas
# ===========================================

class AgentBase(BaseModel):
    """Base agent schema."""
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class AgentCreate(AgentBase):
    """Agent creation schema."""
    system_prompt: str
    greeting_message: Optional[str] = None
    fallback_message: Optional[str] = None
    handoff_message: Optional[str] = None
    model_provider: str = "openai"
    model_name: str = "gpt-4o-mini"
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1000, ge=100, le=4000)


class AgentUpdate(BaseModel):
    """Agent update schema."""
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    system_prompt: Optional[str] = None
    greeting_message: Optional[str] = None
    fallback_message: Optional[str] = None
    handoff_message: Optional[str] = None
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, ge=100, le=4000)
    intent_router_enabled: Optional[bool] = None
    rag_enabled: Optional[bool] = None
    memory_enabled: Optional[bool] = None
    memory_window: Optional[int] = None
    reengagement_enabled: Optional[bool] = None
    reengagement_delay_minutes: Optional[int] = None
    reengagement_max_attempts: Optional[int] = None
    reengagement_prompts: Optional[list] = None
    business_hours: Optional[dict] = None
    status: Optional[str] = None
    is_default: Optional[bool] = None


class AgentResponse(AgentBase):
    """Agent response schema."""
    id: UUID
    tenant_id: UUID
    system_prompt: str
    model_provider: str
    model_name: str
    temperature: float
    max_tokens: int
    intent_router_enabled: bool
    rag_enabled: bool
    memory_enabled: bool
    status: str
    is_default: bool
    total_conversations: int
    total_messages: int


# ===========================================
# Endpoints
# ===========================================

@router.get("", response_model=List[AgentResponse])
async def list_agents(
    current_user: CurrentUser,
    tenant: TenantContext,
    status_filter: Optional[str] = None
):
    """List all agents for the current tenant."""
    filters = {"tenant_id": tenant["tenant_id"]}
    
    if status_filter:
        filters["status"] = status_filter
    
    agents = await fetch_many(
        "agents",
        filters=filters,
        order_by="created_at",
        order_desc=True
    )
    
    return agents


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Get a specific agent by ID."""
    agent = await fetch_one("agents", {
        "id": str(agent_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    return agent


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Create a new agent."""
    # Check agent limit
    existing_agents = await fetch_many(
        "agents",
        filters={"tenant_id": tenant["tenant_id"]}
    )
    
    # Get tenant limits (simplified - in production, fetch from tenant record)
    max_agents = 5  # Default limit
    
    if len(existing_agents) >= max_agents:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Agent limit ({max_agents}) reached for your plan"
        )
    
    # Create agent
    data = agent_data.model_dump()
    data["tenant_id"] = tenant["tenant_id"]
    
    # If this is the first agent, make it default
    if len(existing_agents) == 0:
        data["is_default"] = True
    
    agent = await insert_one("agents", data)
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create agent"
        )
    
    logger.info(
        "Agent created",
        agent_id=agent["id"],
        tenant_id=tenant["tenant_id"]
    )
    
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Update an agent."""
    update_data = agent_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data provided for update"
        )
    
    agent = await update_one(
        "agents",
        {"id": str(agent_id), "tenant_id": tenant["tenant_id"]},
        update_data
    )
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    logger.info("Agent updated", agent_id=str(agent_id))
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Delete an agent."""
    # Check if agent exists and belongs to tenant
    agent = await fetch_one("agents", {
        "id": str(agent_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Prevent deleting the default agent if it's the only one
    if agent.get("is_default"):
        other_agents = await fetch_many(
            "agents",
            filters={"tenant_id": tenant["tenant_id"]}
        )
        if len(other_agents) == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only agent"
            )
    
    deleted = await delete_one("agents", {"id": str(agent_id)})
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete agent"
        )
    
    logger.info("Agent deleted", agent_id=str(agent_id))


@router.post("/{agent_id}/set-default", response_model=AgentResponse)
async def set_default_agent(
    agent_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Set an agent as the default for the tenant."""
    # First, unset all other defaults
    from app.db.supabase import get_supabase
    client = get_supabase()
    
    client.table("agents").update({"is_default": False}).eq(
        "tenant_id", tenant["tenant_id"]
    ).execute()
    
    # Set this agent as default
    agent = await update_one(
        "agents",
        {"id": str(agent_id), "tenant_id": tenant["tenant_id"]},
        {"is_default": True}
    )
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    logger.info("Default agent set", agent_id=str(agent_id))
    return agent
