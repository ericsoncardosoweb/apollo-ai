"""
Deals API - CRM Deal (Cycle) Management Endpoints
==================================================
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime

from app.api.deps import get_current_tenant_id, get_tenant_supabase_client
from app.services.deal_manager import DealManager

router = APIRouter(prefix="/deals", tags=["CRM Deals"])


# =============================================================================
# SCHEMAS
# =============================================================================

class DealCreate(BaseModel):
    contact_id: str
    pipeline_id: str
    initial_stage_id: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    value: float = 0
    tags: Optional[List[str]] = None
    interested_services: Optional[List[str]] = None
    notes: Optional[str] = None


class DealUpdate(BaseModel):
    value: Optional[float] = None
    tags: Optional[List[str]] = None
    interested_services: Optional[List[str]] = None
    notes: Optional[str] = None


class DealMove(BaseModel):
    target_stage_id: str
    notes: Optional[str] = None


class DealClose(BaseModel):
    status: str  # "won" or "lost"
    notes: Optional[str] = None


class DealResponse(BaseModel):
    id: str
    contact_id: Optional[str]
    contact_name: Optional[str]
    contact_phone: Optional[str]
    pipeline_id: Optional[str]
    current_stage_id: str
    value: float
    cycle_number: int
    status: str
    tags: Optional[List[str]]
    interested_services: Optional[List[str]]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]

    class Config:
        from_attributes = True


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
async def list_deals(
    pipeline_id: Optional[str] = Query(None),
    stage_id: Optional[str] = Query(None),
    status: Optional[str] = Query("open"),
    contact_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """List deals with optional filters"""
    query = supabase.table("crm_deals").select("*")
    
    if pipeline_id:
        query = query.eq("pipeline_id", pipeline_id)
    if stage_id:
        query = query.eq("current_stage_id", stage_id)
    if status:
        query = query.eq("status", status)
    if contact_id:
        query = query.eq("contact_id", contact_id)
    
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    
    return {
        "items": result.data or [],
        "total": len(result.data or []),
        "limit": limit,
        "offset": offset
    }


@router.get("/{deal_id}")
async def get_deal(
    deal_id: str,
    include_history: bool = Query(True),
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Get a single deal with optional history"""
    result = supabase.table("crm_deals").select("*").eq("id", deal_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    deal = result.data
    
    if include_history:
        history_result = supabase.table("crm_deal_history").select("*").eq("deal_id", deal_id).order("created_at", desc=True).execute()
        deal["history"] = history_result.data or []
    
    return deal


@router.post("")
async def create_deal(
    data: DealCreate,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Create a new deal"""
    deal_manager = DealManager(
        tenant_id=tenant_id,
        supabase_url=supabase._supabase_url,
        supabase_key=supabase._supabase_key
    )
    
    deal = await deal_manager.create_deal(
        contact_id=data.contact_id,
        pipeline_id=data.pipeline_id,
        initial_stage_id=data.initial_stage_id,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone,
        value=data.value,
        metadata={"tags": data.tags, "services": data.interested_services}
    )
    
    if not deal:
        raise HTTPException(status_code=500, detail="Failed to create deal")
    
    # Update tags and services if provided
    if data.tags or data.interested_services or data.notes:
        await deal_manager.update_deal(
            deal_id=deal["id"],
            tags=data.tags,
            interested_services=data.interested_services,
            notes=data.notes
        )
    
    return deal


@router.patch("/{deal_id}")
async def update_deal(
    deal_id: str,
    data: DealUpdate,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Update deal fields"""
    deal_manager = DealManager(
        tenant_id=tenant_id,
        supabase_url=supabase._supabase_url,
        supabase_key=supabase._supabase_key
    )
    
    deal = await deal_manager.update_deal(
        deal_id=deal_id,
        value=data.value,
        tags=data.tags,
        interested_services=data.interested_services,
        notes=data.notes
    )
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return deal


@router.patch("/{deal_id}/move")
async def move_deal(
    deal_id: str,
    data: DealMove,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Move deal to a new stage"""
    deal_manager = DealManager(
        tenant_id=tenant_id,
        supabase_url=supabase._supabase_url,
        supabase_key=supabase._supabase_key
    )
    
    deal = await deal_manager.move_deal(
        deal_id=deal_id,
        target_stage_id=data.target_stage_id,
        triggered_by="user",
        notes=data.notes
    )
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return deal


@router.patch("/{deal_id}/close")
async def close_deal(
    deal_id: str,
    data: DealClose,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Close a deal as won or lost"""
    if data.status not in ("won", "lost"):
        raise HTTPException(status_code=400, detail="Status must be 'won' or 'lost'")
    
    deal_manager = DealManager(
        tenant_id=tenant_id,
        supabase_url=supabase._supabase_url,
        supabase_key=supabase._supabase_key
    )
    
    deal = await deal_manager.close_deal(
        deal_id=deal_id,
        status=data.status,
        notes=data.notes
    )
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return deal


@router.delete("/{deal_id}")
async def delete_deal(
    deal_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Delete a deal"""
    deal_manager = DealManager(
        tenant_id=tenant_id,
        supabase_url=supabase._supabase_url,
        supabase_key=supabase._supabase_key
    )
    
    success = await deal_manager.delete_deal(deal_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete deal")
    
    return {"success": True, "message": "Deal deleted"}


@router.get("/{deal_id}/history")
async def get_deal_history(
    deal_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Get deal movement history"""
    result = supabase.table("crm_deal_history").select("*").eq("deal_id", deal_id).order("created_at", desc=True).execute()
    
    return {"items": result.data or []}
