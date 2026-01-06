"""
Automations API - Journey/Automation Management Endpoints
==========================================================
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_tenant_id, get_tenant_supabase_client

router = APIRouter(prefix="/automations", tags=["CRM Automations"])


# =============================================================================
# SCHEMAS
# =============================================================================

class ConditionRule(BaseModel):
    field: str
    operator: str
    value: Optional[str] = None


class ActionConfig(BaseModel):
    type: str  # whatsapp_send, http_request, crm_move, tag_add, notification
    payload: dict


class AutomationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str  # manual, pipeline_entry, pipeline_exit, schedule, condition
    trigger_config: Optional[dict] = None
    conditions: Optional[List[ConditionRule]] = None
    actions: List[ActionConfig]
    delay_config: Optional[dict] = None
    is_active: bool = True


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_config: Optional[dict] = None
    conditions: Optional[List[ConditionRule]] = None
    actions: Optional[List[ActionConfig]] = None
    delay_config: Optional[dict] = None
    is_active: Optional[bool] = None


class ManualTriggerRequest(BaseModel):
    deal_id: Optional[str] = None
    contact_id: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
async def list_automations(
    trigger_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """List all automations"""
    query = supabase.table("automation_journeys").select("*")
    
    if trigger_type:
        query = query.eq("trigger_type", trigger_type)
    if is_active is not None:
        query = query.eq("is_active", is_active)
    
    result = query.order("created_at", desc=True).execute()
    
    return {"items": result.data or []}


@router.get("/{automation_id}")
async def get_automation(
    automation_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Get a single automation"""
    result = supabase.table("automation_journeys").select("*").eq("id", automation_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    # Get recent executions
    exec_result = supabase.table("automation_executions").select("*").eq("journey_id", automation_id).order("created_at", desc=True).limit(10).execute()
    
    automation = result.data
    automation["recent_executions"] = exec_result.data or []
    
    return automation


@router.post("")
async def create_automation(
    data: AutomationCreate,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Create a new automation"""
    automation_data = {
        "name": data.name,
        "description": data.description,
        "trigger_type": data.trigger_type,
        "trigger_config": data.trigger_config or {},
        "conditions": [c.model_dump() for c in data.conditions] if data.conditions else [],
        "actions": [a.model_dump() for a in data.actions],
        "delay_config": data.delay_config or {},
        "is_active": data.is_active
    }
    
    result = supabase.table("automation_journeys").insert(automation_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create automation")
    
    return result.data[0]


@router.patch("/{automation_id}")
async def update_automation(
    automation_id: str,
    data: AutomationUpdate,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Update an automation"""
    update_data = {}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.trigger_config is not None:
        update_data["trigger_config"] = data.trigger_config
    if data.conditions is not None:
        update_data["conditions"] = [c.model_dump() for c in data.conditions]
    if data.actions is not None:
        update_data["actions"] = [a.model_dump() for a in data.actions]
    if data.delay_config is not None:
        update_data["delay_config"] = data.delay_config
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = supabase.table("automation_journeys").update(update_data).eq("id", automation_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    return result.data[0]


@router.post("/{automation_id}/execute")
async def trigger_automation(
    automation_id: str,
    data: ManualTriggerRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Manually trigger an automation"""
    from datetime import datetime, timezone
    
    # Verify automation exists and is active
    auto_result = supabase.table("automation_journeys").select("*").eq("id", automation_id).single().execute()
    
    if not auto_result.data:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    automation = auto_result.data
    
    if not automation.get("is_active"):
        raise HTTPException(status_code=400, detail="Automation is not active")
    
    if automation.get("trigger_type") != "manual":
        raise HTTPException(status_code=400, detail="Automation is not a manual trigger type")
    
    if not data.deal_id and not data.contact_id:
        raise HTTPException(status_code=400, detail="Must provide deal_id or contact_id")
    
    # Schedule immediate execution
    execution_data = {
        "journey_id": automation_id,
        "deal_id": data.deal_id,
        "contact_id": data.contact_id,
        "scheduled_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    result = supabase.table("automation_executions").insert(execution_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to schedule execution")
    
    return {
        "success": True,
        "message": "Automation scheduled for immediate execution",
        "execution": result.data[0]
    }


@router.delete("/{automation_id}")
async def delete_automation(
    automation_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Delete an automation"""
    # Cancel pending executions first
    supabase.table("automation_executions").update({"status": "cancelled"}).eq("journey_id", automation_id).eq("status", "pending").execute()
    
    # Delete automation
    supabase.table("automation_journeys").delete().eq("id", automation_id).execute()
    
    return {"success": True, "message": "Automation deleted"}


@router.get("/{automation_id}/executions")
async def get_automation_executions(
    automation_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Get execution history for an automation"""
    query = supabase.table("automation_executions").select("*").eq("journey_id", automation_id)
    
    if status:
        query = query.eq("status", status)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    
    return {"items": result.data or []}
