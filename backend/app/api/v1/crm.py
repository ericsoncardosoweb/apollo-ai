"""
Apollo A.I. Advanced - CRM Endpoints
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
import structlog

from app.api.deps import CurrentUser, TenantContext
from app.db.supabase import fetch_one, fetch_many, insert_one, update_one, delete_one, get_supabase

logger = structlog.get_logger()
router = APIRouter()


# ===========================================
# Schemas - Leads
# ===========================================

class LeadBase(BaseModel):
    """Base lead schema."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    company_name: Optional[str] = None
    company_role: Optional[str] = None


class LeadCreate(LeadBase):
    """Lead creation schema."""
    source: str = "manual"
    pipeline_stage_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    tags: List[str] = []
    custom_fields: dict = {}


class LeadUpdate(LeadBase):
    """Lead update schema."""
    pipeline_stage_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    status: Optional[str] = None
    temperature: Optional[str] = None
    score: Optional[int] = None
    expected_value: Optional[float] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[dict] = None
    lost_reason: Optional[str] = None


class LeadResponse(LeadBase):
    """Lead response schema."""
    id: UUID
    tenant_id: UUID
    pipeline_stage_id: Optional[UUID]
    assigned_to: Optional[UUID]
    source: str
    status: str
    temperature: str
    score: int
    tags: List[str]
    created_at: datetime
    last_contact_at: datetime


# ===========================================
# Schemas - Pipeline
# ===========================================

class PipelineStageResponse(BaseModel):
    """Pipeline stage response schema."""
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    color: str
    position: int
    is_won_stage: bool
    is_lost_stage: bool
    is_active: bool


class PipelineStageCreate(BaseModel):
    """Pipeline stage creation schema."""
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"
    position: int


class PipelineStageUpdate(BaseModel):
    """Pipeline stage update schema."""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None
    is_active: Optional[bool] = None


# ===========================================
# Lead Endpoints
# ===========================================

@router.get("/leads", response_model=List[LeadResponse])
async def list_leads(
    current_user: CurrentUser,
    tenant: TenantContext,
    pipeline_stage_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    temperature: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = 0
):
    """
    List leads for the current tenant.
    
    Supports filtering by stage, status, temperature, assignee, and search.
    """
    client = get_supabase()
    query = client.table("crm_leads").select("*").eq(
        "tenant_id", tenant["tenant_id"]
    )
    
    if pipeline_stage_id:
        query = query.eq("pipeline_stage_id", str(pipeline_stage_id))
    
    if status_filter:
        query = query.eq("status", status_filter)
    
    if temperature:
        query = query.eq("temperature", temperature)
    
    if assigned_to:
        query = query.eq("assigned_to", str(assigned_to))
    
    if search:
        query = query.or_(
            f"name.ilike.%{search}%,email.ilike.%{search}%,phone.ilike.%{search}%"
        )
    
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data or []


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Get a specific lead by ID."""
    lead = await fetch_one("crm_leads", {
        "id": str(lead_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    return lead


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_data: LeadCreate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Create a new lead."""
    data = lead_data.model_dump()
    data["tenant_id"] = tenant["tenant_id"]
    
    # If no stage specified, use first stage
    if not data.get("pipeline_stage_id"):
        first_stage = await fetch_one("crm_pipeline_stages", {
            "tenant_id": tenant["tenant_id"],
            "position": 0
        })
        if first_stage:
            data["pipeline_stage_id"] = first_stage["id"]
    
    # Convert UUID to string
    if data.get("pipeline_stage_id"):
        data["pipeline_stage_id"] = str(data["pipeline_stage_id"])
    if data.get("assigned_to"):
        data["assigned_to"] = str(data["assigned_to"])
    
    lead = await insert_one("crm_leads", data)
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create lead"
        )
    
    logger.info("Lead created", lead_id=lead["id"], tenant_id=tenant["tenant_id"])
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    lead_data: LeadUpdate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Update a lead."""
    update_data = lead_data.model_dump(exclude_unset=True)
    
    # Handle status changes
    if update_data.get("status") == "won":
        update_data["won_at"] = datetime.utcnow().isoformat()
    elif update_data.get("status") == "lost":
        update_data["lost_at"] = datetime.utcnow().isoformat()
    
    # Convert UUIDs to strings
    if "pipeline_stage_id" in update_data and update_data["pipeline_stage_id"]:
        update_data["pipeline_stage_id"] = str(update_data["pipeline_stage_id"])
    if "assigned_to" in update_data and update_data["assigned_to"]:
        update_data["assigned_to"] = str(update_data["assigned_to"])
    
    lead = await update_one(
        "crm_leads",
        {"id": str(lead_id), "tenant_id": tenant["tenant_id"]},
        update_data
    )
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    logger.info("Lead updated", lead_id=str(lead_id))
    return lead


@router.post("/leads/{lead_id}/move-stage")
async def move_lead_stage(
    lead_id: UUID,
    stage_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Move a lead to a different pipeline stage."""
    # Verify stage belongs to tenant
    stage = await fetch_one("crm_pipeline_stages", {
        "id": str(stage_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline stage not found"
        )
    
    update_data = {"pipeline_stage_id": str(stage_id)}
    
    # Auto-update status based on stage
    if stage.get("is_won_stage"):
        update_data["status"] = "won"
        update_data["won_at"] = datetime.utcnow().isoformat()
    elif stage.get("is_lost_stage"):
        update_data["status"] = "lost"
        update_data["lost_at"] = datetime.utcnow().isoformat()
    
    lead = await update_one(
        "crm_leads",
        {"id": str(lead_id), "tenant_id": tenant["tenant_id"]},
        update_data
    )
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    logger.info(
        "Lead moved to stage",
        lead_id=str(lead_id),
        stage_id=str(stage_id),
        stage_name=stage["name"]
    )
    
    return {"message": "Lead moved successfully", "lead": lead}


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Delete a lead."""
    deleted = await delete_one("crm_leads", {
        "id": str(lead_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    logger.info("Lead deleted", lead_id=str(lead_id))


# ===========================================
# Pipeline Stage Endpoints
# ===========================================

@router.get("/pipeline/stages", response_model=List[PipelineStageResponse])
async def list_pipeline_stages(
    current_user: CurrentUser,
    tenant: TenantContext
):
    """List all pipeline stages for the tenant."""
    stages = await fetch_many(
        "crm_pipeline_stages",
        filters={"tenant_id": tenant["tenant_id"]},
        order_by="position",
        order_desc=False
    )
    return stages


@router.post("/pipeline/stages", response_model=PipelineStageResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline_stage(
    stage_data: PipelineStageCreate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Create a new pipeline stage."""
    data = stage_data.model_dump()
    data["tenant_id"] = tenant["tenant_id"]
    
    stage = await insert_one("crm_pipeline_stages", data)
    
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pipeline stage"
        )
    
    logger.info("Pipeline stage created", stage_id=stage["id"])
    return stage


@router.patch("/pipeline/stages/{stage_id}", response_model=PipelineStageResponse)
async def update_pipeline_stage(
    stage_id: UUID,
    stage_data: PipelineStageUpdate,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Update a pipeline stage."""
    update_data = stage_data.model_dump(exclude_unset=True)
    
    stage = await update_one(
        "crm_pipeline_stages",
        {"id": str(stage_id), "tenant_id": tenant["tenant_id"]},
        update_data
    )
    
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline stage not found"
        )
    
    logger.info("Pipeline stage updated", stage_id=str(stage_id))
    return stage


@router.delete("/pipeline/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline_stage(
    stage_id: UUID,
    current_user: CurrentUser,
    tenant: TenantContext
):
    """Delete a pipeline stage."""
    # Check if stage has leads
    leads_in_stage = await fetch_many(
        "crm_leads",
        filters={
            "tenant_id": tenant["tenant_id"],
            "pipeline_stage_id": str(stage_id)
        }
    )
    
    if leads_in_stage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete stage with {len(leads_in_stage)} leads. Move leads first."
        )
    
    deleted = await delete_one("crm_pipeline_stages", {
        "id": str(stage_id),
        "tenant_id": tenant["tenant_id"]
    })
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline stage not found"
        )
    
    logger.info("Pipeline stage deleted", stage_id=str(stage_id))


@router.get("/kanban")
async def get_kanban_view(
    current_user: CurrentUser,
    tenant: TenantContext
):
    """
    Get a complete Kanban view of the pipeline.
    
    Returns all stages with their leads for efficient rendering.
    """
    # Get all stages
    stages = await fetch_many(
        "crm_pipeline_stages",
        filters={"tenant_id": tenant["tenant_id"], "is_active": True},
        order_by="position",
        order_desc=False
    )
    
    # Get all leads
    leads = await fetch_many(
        "crm_leads",
        filters={"tenant_id": tenant["tenant_id"]},
        order_by="created_at",
        order_desc=True
    )
    
    # Group leads by stage
    leads_by_stage = {}
    for lead in leads:
        stage_id = lead.get("pipeline_stage_id")
        if stage_id not in leads_by_stage:
            leads_by_stage[stage_id] = []
        leads_by_stage[stage_id].append(lead)
    
    # Build response
    kanban = []
    for stage in stages:
        kanban.append({
            "stage": stage,
            "leads": leads_by_stage.get(stage["id"], []),
            "count": len(leads_by_stage.get(stage["id"], []))
        })
    
    return {
        "stages": kanban,
        "total_leads": len(leads)
    }
