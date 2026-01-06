"""
Apollo A.I. Advanced - Message Templates Endpoints
===================================================

API for managing reusable message templates with:
- Multi-content support (text, image, video, audio)
- Variable substitution
- Template preview
- Usage statistics
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field
import structlog

from app.api.deps import CurrentUser, TenantContext, ClientSupabase

logger = structlog.get_logger()
router = APIRouter(prefix="/message-templates", tags=["Message Templates"])


# ===========================================
# Schemas
# ===========================================

class TemplateContentBase(BaseModel):
    """Template content item."""
    content_type: str = Field(..., description="Type: text, image, video, audio, document, interval")
    content: Optional[str] = None  # For text
    media_url: Optional[str] = None  # For media
    media_filename: Optional[str] = None
    media_mimetype: Optional[str] = None
    media_caption: Optional[str] = None
    send_as_voice: bool = False  # For audio as PTT
    interval_seconds: Optional[int] = Field(None, le=50)  # For interval
    position: int = 0


class TemplateCreate(BaseModel):
    """Template creation schema."""
    name: str
    description: Optional[str] = None
    category: str = "general"
    contents: List[TemplateContentBase]


class TemplateUpdate(BaseModel):
    """Template update schema."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    contents: Optional[List[TemplateContentBase]] = None
    is_active: Optional[bool] = None


class TemplateContentResponse(BaseModel):
    """Template content response."""
    id: UUID
    template_id: UUID
    content_type: str
    content: Optional[str]
    media_url: Optional[str]
    media_filename: Optional[str]
    media_mimetype: Optional[str]
    media_caption: Optional[str]
    send_as_voice: bool
    interval_seconds: Optional[int]
    position: int
    created_at: datetime


class TemplateResponse(BaseModel):
    """Template response schema."""
    id: UUID
    name: str
    description: Optional[str]
    category: str
    is_active: bool
    usage_count: int
    last_used_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    contents: List[TemplateContentResponse] = []


class TemplatePreviewRequest(BaseModel):
    """Template preview request."""
    contact_id: Optional[UUID] = None
    sample_data: Optional[dict] = None  # Custom variable values


class TemplatePreviewResponse(BaseModel):
    """Template preview with resolved variables."""
    contents: List[dict]
    variables_used: List[str]
    missing_variables: List[str]


class TemplateVariable(BaseModel):
    """Available template variable."""
    name: str
    display_name: str
    description: Optional[str]
    source: str
    format_type: str


# ===========================================
# Templates CRUD
# ===========================================

@router.get("", response_model=List[TemplateResponse])
async def list_templates(
    current_user: CurrentUser,
    client_db: ClientSupabase,
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    limit: int = Query(50, le=100),
    offset: int = 0
):
    """List message templates with filters."""
    query = client_db.table("message_templates").select(
        "*, template_contents(*)"
    )
    
    if category:
        query = query.eq("category", category)
    
    if is_active is not None:
        query = query.eq("is_active", is_active)
    
    query = query.order("usage_count", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    templates = result.data or []
    
    # Format response with contents
    for template in templates:
        template["contents"] = sorted(
            template.get("template_contents", []),
            key=lambda x: x.get("position", 0)
        )
        del template["template_contents"]
    
    return templates


@router.get("/categories")
async def list_categories(
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get list of template categories with counts."""
    result = client_db.table("message_templates").select("category").execute()
    
    categories = {}
    for template in result.data or []:
        cat = template.get("category", "general")
        categories[cat] = categories.get(cat, 0) + 1
    
    return [
        {"name": cat, "count": count}
        for cat, count in sorted(categories.items())
    ]


@router.get("/variables", response_model=List[TemplateVariable])
async def list_variables(
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get list of available template variables."""
    result = client_db.table("template_variables").select("*").eq(
        "is_active", True
    ).order("name").execute()
    
    return result.data or []


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get a specific template with contents."""
    result = client_db.table("message_templates").select(
        "*, template_contents(*)"
    ).eq("id", str(template_id)).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = result.data
    template["contents"] = sorted(
        template.get("template_contents", []),
        key=lambda x: x.get("position", 0)
    )
    del template["template_contents"]
    
    return template


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: TemplateCreate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Create a new message template with contents."""
    # Validate contents
    if not template_data.contents:
        raise HTTPException(status_code=400, detail="Template must have at least one content item")
    
    for i, content in enumerate(template_data.contents):
        if content.content_type == "text" and not content.content:
            raise HTTPException(status_code=400, detail=f"Text content item {i+1} is empty")
        if content.content_type in ("image", "video", "audio", "document") and not content.media_url:
            raise HTTPException(status_code=400, detail=f"Media content item {i+1} has no URL")
        if content.content_type == "interval" and not content.interval_seconds:
            raise HTTPException(status_code=400, detail=f"Interval content item {i+1} has no duration")
    
    # Create template
    template_result = client_db.table("message_templates").insert({
        "name": template_data.name,
        "description": template_data.description,
        "category": template_data.category,
        "created_by": current_user.get("id"),
    }).execute()
    
    if not template_result.data:
        raise HTTPException(status_code=500, detail="Failed to create template")
    
    template_id = template_result.data[0]["id"]
    
    # Create contents
    contents_data = []
    for i, content in enumerate(template_data.contents):
        content_dict = content.model_dump()
        content_dict["template_id"] = template_id
        content_dict["position"] = i
        contents_data.append(content_dict)
    
    client_db.table("template_contents").insert(contents_data).execute()
    
    logger.info("Template created", template_id=template_id)
    
    # Fetch complete template
    return await get_template(UUID(template_id), current_user, client_db)


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    template_data: TemplateUpdate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Update a template and optionally its contents."""
    # Check exists
    existing = client_db.table("message_templates").select("id").eq(
        "id", str(template_id)
    ).maybe_single().execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Update template fields
    update_data = {}
    if template_data.name is not None:
        update_data["name"] = template_data.name
    if template_data.description is not None:
        update_data["description"] = template_data.description
    if template_data.category is not None:
        update_data["category"] = template_data.category
    if template_data.is_active is not None:
        update_data["is_active"] = template_data.is_active
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        client_db.table("message_templates").update(update_data).eq(
            "id", str(template_id)
        ).execute()
    
    # Update contents if provided
    if template_data.contents is not None:
        # Delete existing contents
        client_db.table("template_contents").delete().eq(
            "template_id", str(template_id)
        ).execute()
        
        # Insert new contents
        contents_data = []
        for i, content in enumerate(template_data.contents):
            content_dict = content.model_dump()
            content_dict["template_id"] = str(template_id)
            content_dict["position"] = i
            contents_data.append(content_dict)
        
        if contents_data:
            client_db.table("template_contents").insert(contents_data).execute()
    
    logger.info("Template updated", template_id=str(template_id))
    return await get_template(template_id, current_user, client_db)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Delete a template and its contents."""
    # Check if used in any active campaign
    campaigns = client_db.table("campaigns").select("id, name, status").contains(
        "template_ids", [str(template_id)]
    ).in_("status", ["running", "scheduled"]).execute()
    
    if campaigns.data:
        campaign_names = ", ".join([c["name"] for c in campaigns.data])
        raise HTTPException(
            status_code=400,
            detail=f"Template is used in active campaigns: {campaign_names}"
        )
    
    # Delete (contents will cascade)
    client_db.table("message_templates").delete().eq(
        "id", str(template_id)
    ).execute()
    
    logger.info("Template deleted", template_id=str(template_id))


@router.post("/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(
    template_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase,
    new_name: Optional[str] = None
):
    """Duplicate a template with all its contents."""
    # Get original
    original = await get_template(template_id, current_user, client_db)
    
    # Create copy
    copy_data = TemplateCreate(
        name=new_name or f"{original.name} (Cópia)",
        description=original.description,
        category=original.category,
        contents=[
            TemplateContentBase(
                content_type=c.content_type,
                content=c.content,
                media_url=c.media_url,
                media_filename=c.media_filename,
                media_mimetype=c.media_mimetype,
                media_caption=c.media_caption,
                send_as_voice=c.send_as_voice,
                interval_seconds=c.interval_seconds,
                position=c.position
            )
            for c in original.contents
        ]
    )
    
    return await create_template(copy_data, current_user, client_db)


# ===========================================
# Template Preview
# ===========================================

@router.post("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: UUID,
    preview_request: TemplatePreviewRequest,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """
    Preview a template with variable substitution.
    
    Either provide a contact_id to use real contact data,
    or sample_data with custom variable values.
    """
    import re
    
    # Get template
    template = await get_template(template_id, current_user, client_db)
    
    # Get variable values
    variable_values = {}
    
    if preview_request.contact_id:
        # Get contact data
        contact_result = client_db.table("contacts").select("*").eq(
            "id", str(preview_request.contact_id)
        ).maybe_single().execute()
        
        if contact_result.data:
            contact = contact_result.data
            variable_values = {
                "nome": contact.get("name", ""),
                "primeiro_nome": contact.get("name", "").split()[0] if contact.get("name") else "",
                "telefone": contact.get("phone", ""),
                "email": contact.get("email", ""),
                "empresa": contact.get("company_name", ""),
                "cargo": contact.get("company_role", ""),
                "cidade": contact.get("address_city", ""),
                "estado": contact.get("address_state", ""),
            }
    
    if preview_request.sample_data:
        variable_values.update(preview_request.sample_data)
    
    # Add system variables
    now = datetime.now()
    variable_values["data_hoje"] = now.strftime("%d/%m/%Y")
    variable_values["hora_atual"] = now.strftime("%H:%M")
    
    # Process contents
    preview_contents = []
    variables_used = set()
    missing_variables = set()
    
    variable_pattern = re.compile(r'\{\{(\w+)\}\}')
    
    for content in template.contents:
        preview_item = {
            "content_type": content.content_type,
            "position": content.position,
        }
        
        # Substitute variables in text content
        if content.content:
            text = content.content
            found_vars = variable_pattern.findall(text)
            
            for var in found_vars:
                variables_used.add(var)
                if var in variable_values:
                    text = text.replace(f"{{{{{var}}}}}", str(variable_values[var]))
                else:
                    missing_variables.add(var)
            
            preview_item["content"] = text
        
        # Substitute variables in caption
        if content.media_caption:
            caption = content.media_caption
            found_vars = variable_pattern.findall(caption)
            
            for var in found_vars:
                variables_used.add(var)
                if var in variable_values:
                    caption = caption.replace(f"{{{{{var}}}}}", str(variable_values[var]))
                else:
                    missing_variables.add(var)
            
            preview_item["media_caption"] = caption
        
        # Copy other fields
        if content.media_url:
            preview_item["media_url"] = content.media_url
        if content.interval_seconds:
            preview_item["interval_seconds"] = content.interval_seconds
        
        preview_contents.append(preview_item)
    
    return TemplatePreviewResponse(
        contents=preview_contents,
        variables_used=list(variables_used),
        missing_variables=list(missing_variables)
    )


# ===========================================
# Template Stats
# ===========================================

@router.post("/{template_id}/increment-usage")
async def increment_template_usage(
    template_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Increment usage count for a template (called when template is sent)."""
    result = client_db.table("message_templates").select("usage_count").eq(
        "id", str(template_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Template not found")
    
    client_db.table("message_templates").update({
        "usage_count": (result.data.get("usage_count", 0) or 0) + 1,
        "last_used_at": datetime.utcnow().isoformat()
    }).eq("id", str(template_id)).execute()
    
    return {"message": "Usage count updated"}
