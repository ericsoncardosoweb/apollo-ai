"""
Apollo A.I. Advanced - Tools Configuration Endpoints
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import structlog

from app.api.deps import CurrentUser, TenantContext
from app.db.supabase import fetch_one, fetch_many, insert_one, update_one, delete_one

logger = structlog.get_logger()
router = APIRouter()


class ToolConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tool_type: str
    agent_id: Optional[UUID] = None
    config: dict = {}
    trigger_conditions: dict = {}
    is_active: bool = True
    priority: int = 0


class ToolConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict] = None
    trigger_conditions: Optional[dict] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


@router.get("")
async def list_tools(current_user: CurrentUser, tenant: TenantContext):
    return await fetch_many("tools_config", {"tenant_id": tenant["tenant_id"]})


@router.get("/{tool_id}")
async def get_tool(tool_id: UUID, current_user: CurrentUser, tenant: TenantContext):
    tool = await fetch_one("tools_config", {"id": str(tool_id), "tenant_id": tenant["tenant_id"]})
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.post("", status_code=201)
async def create_tool(data: ToolConfigCreate, current_user: CurrentUser, tenant: TenantContext):
    tool_data = data.model_dump()
    tool_data["tenant_id"] = tenant["tenant_id"]
    if tool_data.get("agent_id"):
        tool_data["agent_id"] = str(tool_data["agent_id"])
    return await insert_one("tools_config", tool_data)


@router.patch("/{tool_id}")
async def update_tool(tool_id: UUID, data: ToolConfigUpdate, current_user: CurrentUser, tenant: TenantContext):
    tool = await update_one("tools_config", {"id": str(tool_id), "tenant_id": tenant["tenant_id"]}, data.model_dump(exclude_unset=True))
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.delete("/{tool_id}", status_code=204)
async def delete_tool(tool_id: UUID, current_user: CurrentUser, tenant: TenantContext):
    await delete_one("tools_config", {"id": str(tool_id), "tenant_id": tenant["tenant_id"]})
