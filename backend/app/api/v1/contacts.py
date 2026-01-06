"""
Apollo A.I. Advanced - Contacts Endpoints
==========================================

Full CRUD for contacts with bulk operations.
Uses client database via tenant context.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
import structlog

from app.api.deps import CurrentUser, TenantContext, ClientSupabase

logger = structlog.get_logger()
router = APIRouter(prefix="/contacts", tags=["Contacts"])


# ===========================================
# Schemas
# ===========================================

class ContactBase(BaseModel):
    """Base contact schema."""
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    type: str = "lead"
    status: str = "active"
    tags: List[str] = []
    source: Optional[str] = "manual"
    avatar_url: Optional[str] = None
    notes: Optional[str] = None
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    address_neighborhood: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zipcode: Optional[str] = None
    company_name: Optional[str] = None
    company_role: Optional[str] = None
    metadata: dict = {}


class ContactCreate(ContactBase):
    """Contact creation schema."""
    pass


class ContactUpdate(BaseModel):
    """Contact update schema."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = None
    avatar_url: Optional[str] = None
    notes: Optional[str] = None
    address_street: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    address_neighborhood: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zipcode: Optional[str] = None
    company_name: Optional[str] = None
    company_role: Optional[str] = None
    metadata: Optional[dict] = None


class ContactResponse(ContactBase):
    """Contact response schema."""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    deleted_at: Optional[datetime] = None


class BulkTagRequest(BaseModel):
    """Bulk tag operation request."""
    contact_ids: List[UUID]
    tags: List[str]
    action: str  # 'add' or 'remove'


class BulkUpdateRequest(BaseModel):
    """Bulk update request."""
    contact_ids: List[UUID]
    updates: ContactUpdate


class ContactStats(BaseModel):
    """Contact statistics."""
    total: int
    by_type: dict
    by_status: dict
    by_source: dict
    new_this_month: int


class ContactTagCreate(BaseModel):
    """Contact tag creation."""
    name: str
    color: Optional[str] = "#6366f1"
    description: Optional[str] = None


class ContactTagResponse(BaseModel):
    """Contact tag response."""
    id: UUID
    name: str
    color: str
    description: Optional[str]
    created_at: datetime


# ===========================================
# Utility Functions
# ===========================================

def normalize_phone(phone: str) -> str:
    """Normalize phone number to E.164 format."""
    if not phone:
        return phone
    # Remove non-numeric characters
    digits = ''.join(filter(str.isdigit, phone))
    # Add Brazil country code if missing
    if len(digits) == 11 and digits.startswith('9'):
        digits = '55' + digits
    elif len(digits) == 10:
        digits = '55' + digits
    return digits


# ===========================================
# Endpoints
# ===========================================

@router.get("", response_model=List[ContactResponse])
async def list_contacts(
    current_user: CurrentUser,
    client_db: ClientSupabase,
    search: Optional[str] = None,
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = 0
):
    """
    List contacts with filters.
    
    Supports search across name, email, phone, and whatsapp.
    """
    query = client_db.table("contacts").select("*").is_("deleted_at", "null")
    
    if search:
        query = query.or_(
            f"name.ilike.%{search}%,email.ilike.%{search}%,"
            f"phone.ilike.%{search}%,whatsapp.ilike.%{search}%"
        )
    
    if type_filter:
        query = query.eq("type", type_filter)
    
    if status_filter:
        query = query.eq("status", status_filter)
    
    if source:
        query = query.eq("source", source)
    
    if tags:
        query = query.overlaps("tags", tags)
    
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data or []


@router.get("/stats", response_model=ContactStats)
async def get_contact_stats(
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get contact statistics."""
    result = client_db.table("contacts").select(
        "id, type, status, source, created_at"
    ).is_("deleted_at", "null").execute()
    
    contacts = result.data or []
    total = len(contacts)
    
    # Calculate stats
    by_type = {}
    by_status = {}
    by_source = {}
    new_this_month = 0
    
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    for contact in contacts:
        # By type
        t = contact.get("type", "lead")
        by_type[t] = by_type.get(t, 0) + 1
        
        # By status
        s = contact.get("status", "active")
        by_status[s] = by_status.get(s, 0) + 1
        
        # By source
        src = contact.get("source", "manual")
        if src:
            by_source[src] = by_source.get(src, 0) + 1
        
        # New this month
        created = contact.get("created_at")
        if created:
            created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if created_dt >= first_of_month:
                new_this_month += 1
    
    return ContactStats(
        total=total,
        by_type=by_type,
        by_status=by_status,
        by_source=by_source,
        new_this_month=new_this_month
    )


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get a specific contact by ID."""
    result = client_db.table("contacts").select("*").eq(
        "id", str(contact_id)
    ).is_("deleted_at", "null").maybe_single().execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    return result.data


@router.get("/by-whatsapp/{whatsapp}", response_model=Optional[ContactResponse])
async def get_contact_by_whatsapp(
    whatsapp: str,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Find contact by WhatsApp number."""
    normalized = normalize_phone(whatsapp)
    
    result = client_db.table("contacts").select("*").eq(
        "whatsapp", normalized
    ).is_("deleted_at", "null").maybe_single().execute()
    
    return result.data


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_data: ContactCreate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Create a new contact."""
    data = contact_data.model_dump()
    
    # Normalize phone numbers
    if data.get("phone"):
        data["phone"] = normalize_phone(data["phone"])
    if data.get("whatsapp"):
        data["whatsapp"] = normalize_phone(data["whatsapp"])
    
    # Add audit fields
    data["created_by"] = current_user.get("id")
    
    try:
        result = client_db.table("contacts").insert(data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create contact"
            )
        
        logger.info("Contact created", contact_id=result.data[0]["id"])
        return result.data[0]
    
    except Exception as e:
        error_msg = str(e)
        if "unique constraint" in error_msg.lower():
            if "email" in error_msg:
                raise HTTPException(status_code=400, detail="Email already exists")
            if "whatsapp" in error_msg:
                raise HTTPException(status_code=400, detail="WhatsApp already exists")
            raise HTTPException(status_code=400, detail="Contact already exists")
        raise


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    contact_data: ContactUpdate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Update a contact."""
    update_data = contact_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data provided for update"
        )
    
    # Normalize phone numbers
    if "phone" in update_data and update_data["phone"]:
        update_data["phone"] = normalize_phone(update_data["phone"])
    if "whatsapp" in update_data and update_data["whatsapp"]:
        update_data["whatsapp"] = normalize_phone(update_data["whatsapp"])
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = client_db.table("contacts").update(update_data).eq(
        "id", str(contact_id)
    ).is_("deleted_at", "null").execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    logger.info("Contact updated", contact_id=str(contact_id))
    return result.data[0]


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Soft delete a contact."""
    result = client_db.table("contacts").update({
        "deleted_at": datetime.utcnow().isoformat()
    }).eq("id", str(contact_id)).is_("deleted_at", "null").execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    logger.info("Contact deleted", contact_id=str(contact_id))


@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_contacts(
    contact_ids: List[UUID],
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Bulk soft delete contacts."""
    ids = [str(id) for id in contact_ids]
    
    client_db.table("contacts").update({
        "deleted_at": datetime.utcnow().isoformat()
    }).in_("id", ids).execute()
    
    logger.info("Contacts bulk deleted", count=len(ids))


@router.post("/bulk-tag")
async def bulk_tag_contacts(
    request: BulkTagRequest,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Add or remove tags from multiple contacts."""
    ids = [str(id) for id in request.contact_ids]
    
    # Get current contacts
    result = client_db.table("contacts").select("id, tags").in_("id", ids).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No contacts found"
        )
    
    # Update each contact's tags
    for contact in result.data:
        current_tags = contact.get("tags", []) or []
        
        if request.action == "add":
            new_tags = list(set(current_tags + request.tags))
        elif request.action == "remove":
            new_tags = [t for t in current_tags if t not in request.tags]
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        client_db.table("contacts").update({
            "tags": new_tags,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", contact["id"]).execute()
    
    logger.info(
        "Contacts bulk tagged",
        count=len(ids),
        action=request.action,
        tags=request.tags
    )
    
    return {"message": f"Updated {len(ids)} contacts"}


@router.post("/bulk-update")
async def bulk_update_contacts(
    request: BulkUpdateRequest,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Update multiple contacts at once."""
    ids = [str(id) for id in request.contact_ids]
    update_data = request.updates.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data provided for update"
        )
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    client_db.table("contacts").update(update_data).in_("id", ids).execute()
    
    logger.info("Contacts bulk updated", count=len(ids))
    return {"message": f"Updated {len(ids)} contacts"}


# ===========================================
# Contact Tags
# ===========================================

@router.get("/tags/all", response_model=List[ContactTagResponse])
async def list_contact_tags(
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """List all contact tags."""
    result = client_db.table("contact_tags").select("*").order("name").execute()
    return result.data or []


@router.post("/tags", response_model=ContactTagResponse, status_code=status.HTTP_201_CREATED)
async def create_contact_tag(
    tag_data: ContactTagCreate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Create a new contact tag."""
    result = client_db.table("contact_tags").insert(
        tag_data.model_dump()
    ).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tag"
        )
    
    return result.data[0]


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_tag(
    tag_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Delete a contact tag."""
    client_db.table("contact_tags").delete().eq("id", str(tag_id)).execute()
    logger.info("Contact tag deleted", tag_id=str(tag_id))
