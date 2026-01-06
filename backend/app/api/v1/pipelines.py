"""
Pipelines API - CRM Pipeline Management Endpoints
==================================================
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_tenant_id, get_tenant_supabase_client, get_master_supabase

router = APIRouter(prefix="/pipelines", tags=["CRM Pipelines"])


# =============================================================================
# SCHEMAS
# =============================================================================

class StageConfig(BaseModel):
    id: str
    name: str
    color: str
    position: int
    is_conversion_point: bool = False
    automations_config: Optional[dict] = None


class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    stages: List[StageConfig]
    is_default: bool = False


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    stages: Optional[List[StageConfig]] = None
    is_active: Optional[bool] = None


class SaveAsTemplateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "vendas"


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
async def list_pipelines(
    include_inactive: bool = Query(False),
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """List all pipelines"""
    query = supabase.table("crm_pipelines").select("*")
    
    if not include_inactive:
        query = query.eq("is_active", True)
    
    result = query.order("created_at").execute()
    
    return {"items": result.data or []}


@router.get("/templates")
async def list_pipeline_templates(
    category: Optional[str] = Query(None),
    featured_only: bool = Query(False),
):
    """List global pipeline templates from master DB"""
    supabase = get_master_supabase()
    
    query = supabase.table("global_pipeline_templates").select("*").eq("is_public", True)
    
    if category:
        query = query.eq("category", category)
    if featured_only:
        query = query.eq("is_featured", True)
    
    result = query.order("usage_count", desc=True).execute()
    
    return {"items": result.data or []}


@router.get("/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Get a single pipeline"""
    result = supabase.table("crm_pipelines").select("*").eq("id", pipeline_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return result.data


@router.post("")
async def create_pipeline(
    data: PipelineCreate,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Create a new pipeline"""
    # If setting as default, unset other defaults
    if data.is_default:
        supabase.table("crm_pipelines").update({"is_default": False}).eq("is_default", True).execute()
    
    pipeline_data = {
        "name": data.name,
        "description": data.description,
        "stages": [stage.model_dump() for stage in data.stages],
        "is_default": data.is_default,
        "is_active": True
    }
    
    result = supabase.table("crm_pipelines").insert(pipeline_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create pipeline")
    
    return result.data[0]


@router.post("/from-template/{template_id}")
async def create_from_template(
    template_id: str,
    name: Optional[str] = Query(None),
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Create a new pipeline from a global template"""
    master_supabase = get_master_supabase()
    
    # Get template
    template_result = master_supabase.table("global_pipeline_templates").select("*").eq("id", template_id).single().execute()
    
    if not template_result.data:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = template_result.data
    
    # Create pipeline
    pipeline_data = {
        "name": name or template["name"],
        "description": template.get("description"),
        "stages": template["stages"],
        "is_default": False,
        "is_active": True
    }
    
    result = supabase.table("crm_pipelines").insert(pipeline_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create pipeline")
    
    # Increment usage count on template
    master_supabase.table("global_pipeline_templates").update({
        "usage_count": template.get("usage_count", 0) + 1
    }).eq("id", template_id).execute()
    
    return result.data[0]


@router.patch("/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    data: PipelineUpdate,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Update a pipeline"""
    update_data = {}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.stages is not None:
        update_data["stages"] = [stage.model_dump() for stage in data.stages]
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = supabase.table("crm_pipelines").update(update_data).eq("id", pipeline_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return result.data[0]


@router.post("/{pipeline_id}/save-template")
async def save_as_template(
    pipeline_id: str,
    data: SaveAsTemplateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Save a pipeline as a global template (admin only)"""
    # Get pipeline
    pipeline_result = supabase.table("crm_pipelines").select("*").eq("id", pipeline_id).single().execute()
    
    if not pipeline_result.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    pipeline = pipeline_result.data
    
    # Save to master DB
    master_supabase = get_master_supabase()
    
    template_data = {
        "name": data.name,
        "description": data.description or pipeline.get("description"),
        "category": data.category,
        "stages": pipeline["stages"],
        "is_public": True,
        "is_featured": False,
        "usage_count": 0
    }
    
    result = master_supabase.table("global_pipeline_templates").insert(template_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save template")
    
    return {"success": True, "template": result.data[0]}


@router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    supabase = Depends(get_tenant_supabase_client),
):
    """Delete a pipeline (soft delete by setting inactive)"""
    # Check for existing deals
    deals_result = supabase.table("crm_deals").select("id").eq("pipeline_id", pipeline_id).eq("status", "open").limit(1).execute()
    
    if deals_result.data:
        raise HTTPException(status_code=400, detail="Cannot delete pipeline with open deals")
    
    result = supabase.table("crm_pipelines").update({"is_active": False}).eq("id", pipeline_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    return {"success": True, "message": "Pipeline deactivated"}
