"""
Apollo A.I. Advanced - Campaigns Endpoints
===========================================

Full API for WhatsApp campaign management with:
- Campaign CRUD with scheduling
- Anti-ban settings
- Template selection
- Delivery tracking
- Statistics
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel, Field
import structlog

from app.api.deps import CurrentUser, TenantContext, ClientSupabase

logger = structlog.get_logger()
router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


# ===========================================
# Schemas
# ===========================================

class AntiBanSettings(BaseModel):
    """Anti-ban configuration for campaign."""
    max_daily_volume: int = Field(default=200, ge=10, le=1000)
    min_interval_seconds: int = Field(default=30, ge=10, le=60)
    max_interval_seconds: int = Field(default=50, ge=20, le=60)
    use_random_intervals: bool = True
    batch_size: int = Field(default=10, ge=1, le=50)
    batch_pause_minutes: int = Field(default=15, ge=5, le=60)


class ScheduleSettings(BaseModel):
    """Schedule configuration for campaign."""
    scheduled_at: Optional[datetime] = None
    timezone: str = "America/Sao_Paulo"
    days: List[int] = Field(default=[1, 2, 3, 4, 5])  # Mon-Fri
    start_hour: int = Field(default=9, ge=0, le=23)
    end_hour: int = Field(default=21, ge=0, le=23)


class ContactFilter(BaseModel):
    """Contact filter for campaign targeting."""
    tags: Optional[List[str]] = None
    type: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = "active"
    exclude_recent_days: int = Field(default=7, ge=0)


class CampaignCreate(BaseModel):
    """Campaign creation schema."""
    name: str
    description: Optional[str] = None
    template_ids: List[UUID]
    template_distribution: str = "random"
    
    # Targeting
    contact_filters: Optional[ContactFilter] = None
    contact_list_ids: Optional[List[UUID]] = None
    
    # Scheduling
    schedule: Optional[ScheduleSettings] = None
    
    # Anti-ban
    anti_ban: Optional[AntiBanSettings] = None
    
    # AI Agent
    assigned_agent_id: Optional[UUID] = None
    auto_reply_enabled: bool = True


class CampaignUpdate(BaseModel):
    """Campaign update schema."""
    name: Optional[str] = None
    description: Optional[str] = None
    template_ids: Optional[List[UUID]] = None
    template_distribution: Optional[str] = None
    contact_filters: Optional[dict] = None
    schedule: Optional[ScheduleSettings] = None
    anti_ban: Optional[AntiBanSettings] = None
    assigned_agent_id: Optional[UUID] = None
    auto_reply_enabled: Optional[bool] = None


class CampaignResponse(BaseModel):
    """Campaign response schema."""
    id: UUID
    name: str
    description: Optional[str]
    status: str
    template_ids: List[UUID]
    template_distribution: str
    
    # Schedule
    scheduled_at: Optional[datetime]
    schedule_timezone: str
    schedule_days: List[int]
    schedule_start_hour: int
    schedule_end_hour: int
    
    # Anti-ban
    max_daily_volume: int
    min_interval_seconds: int
    max_interval_seconds: int
    use_random_intervals: bool
    batch_size: int
    batch_pause_minutes: int
    
    # Stats
    total_contacts: int
    sent_count: int
    delivered_count: int
    read_count: int
    failed_count: int
    response_count: int
    
    # Progress
    current_batch: int
    last_sent_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    created_at: datetime
    updated_at: datetime


class CampaignStats(BaseModel):
    """Campaign statistics."""
    total_contacts: int
    queued: int
    sent: int
    delivered: int
    read: int
    failed: int
    responses: int
    opt_outs: int
    delivery_rate: float
    read_rate: float
    response_rate: float


class DeliveryResponse(BaseModel):
    """Campaign delivery response."""
    id: UUID
    campaign_id: UUID
    contact_id: Optional[UUID]
    contact_phone: str
    contact_name: Optional[str]
    status: str
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    error_message: Optional[str]
    has_response: bool
    created_at: datetime


# ===========================================
# Campaign CRUD Endpoints
# ===========================================

@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(
    current_user: CurrentUser,
    client_db: ClientSupabase,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=100),
    offset: int = 0
):
    """List campaigns with filters."""
    query = client_db.table("campaigns").select("*")
    
    if status_filter:
        query = query.eq("status", status_filter)
    
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data or []


@router.get("/stats/overview")
async def get_campaigns_overview(
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get overview stats for all campaigns."""
    result = client_db.table("campaigns").select(
        "id, status, total_contacts, sent_count, delivered_count, read_count, failed_count, response_count"
    ).execute()
    
    campaigns = result.data or []
    
    total = len(campaigns)
    active = sum(1 for c in campaigns if c["status"] in ("running", "scheduled"))
    completed = sum(1 for c in campaigns if c["status"] == "completed")
    
    total_sent = sum(c.get("sent_count", 0) for c in campaigns)
    total_delivered = sum(c.get("delivered_count", 0) for c in campaigns)
    total_read = sum(c.get("read_count", 0) for c in campaigns)
    total_responses = sum(c.get("response_count", 0) for c in campaigns)
    
    return {
        "total_campaigns": total,
        "active_campaigns": active,
        "completed_campaigns": completed,
        "total_messages_sent": total_sent,
        "total_delivered": total_delivered,
        "total_read": total_read,
        "total_responses": total_responses,
        "avg_delivery_rate": (total_delivered / total_sent * 100) if total_sent > 0 else 0,
        "avg_read_rate": (total_read / total_delivered * 100) if total_delivered > 0 else 0,
    }


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get a specific campaign by ID."""
    result = client_db.table("campaigns").select("*").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    
    return result.data


@router.get("/{campaign_id}/stats", response_model=CampaignStats)
async def get_campaign_stats(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Get detailed statistics for a campaign."""
    # Get campaign
    campaign_result = client_db.table("campaigns").select(
        "total_contacts, sent_count, delivered_count, read_count, failed_count, response_count, opt_out_count"
    ).eq("id", str(campaign_id)).maybe_single().execute()
    
    if not campaign_result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    c = campaign_result.data
    
    # Get queued count
    queued_result = client_db.table("campaign_deliveries").select(
        "id", count="exact"
    ).eq("campaign_id", str(campaign_id)).in_(
        "status", ["pending", "queued"]
    ).execute()
    
    queued = queued_result.count or 0
    sent = c.get("sent_count", 0)
    delivered = c.get("delivered_count", 0)
    read = c.get("read_count", 0)
    
    return CampaignStats(
        total_contacts=c.get("total_contacts", 0),
        queued=queued,
        sent=sent,
        delivered=delivered,
        read=read,
        failed=c.get("failed_count", 0),
        responses=c.get("response_count", 0),
        opt_outs=c.get("opt_out_count", 0),
        delivery_rate=(delivered / sent * 100) if sent > 0 else 0,
        read_rate=(read / delivered * 100) if delivered > 0 else 0,
        response_rate=(c.get("response_count", 0) / sent * 100) if sent > 0 else 0
    )


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Create a new campaign."""
    # Validate templates exist
    for template_id in campaign_data.template_ids:
        template_result = client_db.table("message_templates").select("id").eq(
            "id", str(template_id)
        ).maybe_single().execute()
        
        if not template_result.data:
            raise HTTPException(
                status_code=400,
                detail=f"Template {template_id} not found"
            )
    
    # Build campaign data
    data = {
        "name": campaign_data.name,
        "description": campaign_data.description,
        "template_ids": [str(t) for t in campaign_data.template_ids],
        "template_distribution": campaign_data.template_distribution,
        "status": "draft",
        "created_by": current_user.get("id"),
    }
    
    # Add contact filters
    if campaign_data.contact_filters:
        data["contact_filters"] = campaign_data.contact_filters.model_dump()
        data["exclude_recent_days"] = campaign_data.contact_filters.exclude_recent_days
    
    if campaign_data.contact_list_ids:
        data["contact_list_ids"] = [str(l) for l in campaign_data.contact_list_ids]
    
    # Add schedule
    if campaign_data.schedule:
        data["scheduled_at"] = campaign_data.schedule.scheduled_at.isoformat() if campaign_data.schedule.scheduled_at else None
        data["schedule_timezone"] = campaign_data.schedule.timezone
        data["schedule_days"] = campaign_data.schedule.days
        data["schedule_start_hour"] = campaign_data.schedule.start_hour
        data["schedule_end_hour"] = campaign_data.schedule.end_hour
    
    # Add anti-ban settings
    if campaign_data.anti_ban:
        data["max_daily_volume"] = campaign_data.anti_ban.max_daily_volume
        data["min_interval_seconds"] = campaign_data.anti_ban.min_interval_seconds
        data["max_interval_seconds"] = campaign_data.anti_ban.max_interval_seconds
        data["use_random_intervals"] = campaign_data.anti_ban.use_random_intervals
        data["batch_size"] = campaign_data.anti_ban.batch_size
        data["batch_pause_minutes"] = campaign_data.anti_ban.batch_pause_minutes
    
    # Add agent
    if campaign_data.assigned_agent_id:
        data["assigned_agent_id"] = str(campaign_data.assigned_agent_id)
    data["auto_reply_enabled"] = campaign_data.auto_reply_enabled
    
    # Create campaign
    result = client_db.table("campaigns").insert(data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create campaign")
    
    logger.info("Campaign created", campaign_id=result.data[0]["id"])
    return result.data[0]


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    campaign_data: CampaignUpdate,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Update a campaign (only if draft or paused)."""
    # Get current campaign
    current = client_db.table("campaigns").select("status").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not current.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if current.data["status"] not in ("draft", "paused"):
        raise HTTPException(
            status_code=400,
            detail="Can only update draft or paused campaigns"
        )
    
    # Build update data
    update_data = campaign_data.model_dump(exclude_unset=True)
    
    if campaign_data.schedule:
        schedule = campaign_data.schedule
        update_data["scheduled_at"] = schedule.scheduled_at.isoformat() if schedule.scheduled_at else None
        update_data["schedule_timezone"] = schedule.timezone
        update_data["schedule_days"] = schedule.days
        update_data["schedule_start_hour"] = schedule.start_hour
        update_data["schedule_end_hour"] = schedule.end_hour
        del update_data["schedule"]
    
    if campaign_data.anti_ban:
        ab = campaign_data.anti_ban
        update_data["max_daily_volume"] = ab.max_daily_volume
        update_data["min_interval_seconds"] = ab.min_interval_seconds
        update_data["max_interval_seconds"] = ab.max_interval_seconds
        update_data["use_random_intervals"] = ab.use_random_intervals
        update_data["batch_size"] = ab.batch_size
        update_data["batch_pause_minutes"] = ab.batch_pause_minutes
        del update_data["anti_ban"]
    
    if "template_ids" in update_data:
        update_data["template_ids"] = [str(t) for t in update_data["template_ids"]]
    
    if "assigned_agent_id" in update_data and update_data["assigned_agent_id"]:
        update_data["assigned_agent_id"] = str(update_data["assigned_agent_id"])
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = client_db.table("campaigns").update(update_data).eq(
        "id", str(campaign_id)
    ).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update campaign")
    
    return result.data[0]


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Delete a campaign (only if draft)."""
    current = client_db.table("campaigns").select("status").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not current.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if current.data["status"] != "draft":
        raise HTTPException(
            status_code=400,
            detail="Can only delete draft campaigns. Cancel running campaigns first."
        )
    
    client_db.table("campaigns").delete().eq("id", str(campaign_id)).execute()
    logger.info("Campaign deleted", campaign_id=str(campaign_id))


# ===========================================
# Campaign Actions
# ===========================================

@router.post("/{campaign_id}/schedule", response_model=CampaignResponse)
async def schedule_campaign(
    campaign_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    client_db: ClientSupabase,
    scheduled_at: Optional[datetime] = None
):
    """
    Schedule a campaign for sending.
    
    If scheduled_at is provided, campaign will start at that time.
    If not provided, campaign will be queued to start immediately.
    """
    # Get campaign
    result = client_db.table("campaigns").select("*").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign = result.data
    
    if campaign["status"] not in ("draft", "paused"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot schedule campaign with status '{campaign['status']}'"
        )
    
    # Validate templates
    if not campaign.get("template_ids"):
        raise HTTPException(status_code=400, detail="Campaign has no templates assigned")
    
    # Queue contacts for delivery
    total_contacts = await queue_campaign_contacts(client_db, campaign)
    
    if total_contacts == 0:
        raise HTTPException(
            status_code=400,
            detail="No contacts match the campaign filters"
        )
    
    # Update campaign status
    update_data = {
        "status": "scheduled" if scheduled_at else "running",
        "total_contacts": total_contacts,
        "queued_count": total_contacts,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if scheduled_at:
        update_data["scheduled_at"] = scheduled_at.isoformat()
    else:
        update_data["started_at"] = datetime.utcnow().isoformat()
    
    updated = client_db.table("campaigns").update(update_data).eq(
        "id", str(campaign_id)
    ).execute()
    
    logger.info(
        "Campaign scheduled",
        campaign_id=str(campaign_id),
        total_contacts=total_contacts,
        scheduled_at=scheduled_at
    )
    
    return updated.data[0]


async def queue_campaign_contacts(client_db, campaign: dict) -> int:
    """Queue contacts for campaign delivery based on filters."""
    campaign_id = campaign["id"]
    filters = campaign.get("contact_filters", {})
    
    # Build query for eligible contacts
    query = client_db.table("contacts").select("id, phone, whatsapp, name").is_(
        "deleted_at", "null"
    ).eq("status", "active")
    
    # Apply filters
    if filters.get("tags"):
        query = query.overlaps("tags", filters["tags"])
    if filters.get("type"):
        query = query.eq("type", filters["type"])
    if filters.get("source"):
        query = query.eq("source", filters["source"])
    
    result = query.execute()
    contacts = result.data or []
    
    # Exclude opted-out contacts
    opt_out_result = client_db.table("campaign_opt_outs").select("contact_phone").execute()
    opted_out_phones = {r["contact_phone"] for r in (opt_out_result.data or [])}
    
    # Exclude recently messaged
    exclude_days = campaign.get("exclude_recent_days", 7)
    if exclude_days > 0:
        cutoff = datetime.utcnow() - timedelta(days=exclude_days)
        recent_result = client_db.table("campaign_deliveries").select(
            "contact_phone"
        ).gt("sent_at", cutoff.isoformat()).execute()
        recently_messaged = {r["contact_phone"] for r in (recent_result.data or [])}
    else:
        recently_messaged = set()
    
    # Filter contacts
    eligible_contacts = []
    for contact in contacts:
        phone = contact.get("whatsapp") or contact.get("phone")
        if not phone:
            continue
        if phone in opted_out_phones:
            continue
        if phone in recently_messaged:
            continue
        eligible_contacts.append({
            "contact_id": contact["id"],
            "contact_phone": phone,
            "contact_name": contact.get("name")
        })
    
    if not eligible_contacts:
        return 0
    
    # Create delivery records
    deliveries = []
    for i, contact in enumerate(eligible_contacts):
        deliveries.append({
            "campaign_id": campaign_id,
            "contact_id": contact["contact_id"],
            "contact_phone": contact["contact_phone"],
            "contact_name": contact["contact_name"],
            "status": "pending",
            "batch_number": i // campaign.get("batch_size", 10),
        })
    
    # Insert in batches
    batch_size = 100
    for i in range(0, len(deliveries), batch_size):
        batch = deliveries[i:i + batch_size]
        client_db.table("campaign_deliveries").insert(batch).execute()
    
    return len(eligible_contacts)


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
async def pause_campaign(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Pause a running campaign."""
    result = client_db.table("campaigns").select("status").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if result.data["status"] not in ("running", "scheduled"):
        raise HTTPException(status_code=400, detail="Campaign is not running")
    
    updated = client_db.table("campaigns").update({
        "status": "paused",
        "paused_at": datetime.utcnow().isoformat()
    }).eq("id", str(campaign_id)).execute()
    
    logger.info("Campaign paused", campaign_id=str(campaign_id))
    return updated.data[0]


@router.post("/{campaign_id}/resume", response_model=CampaignResponse)
async def resume_campaign(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Resume a paused campaign."""
    result = client_db.table("campaigns").select("status").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if result.data["status"] != "paused":
        raise HTTPException(status_code=400, detail="Campaign is not paused")
    
    updated = client_db.table("campaigns").update({
        "status": "running",
        "paused_at": None
    }).eq("id", str(campaign_id)).execute()
    
    logger.info("Campaign resumed", campaign_id=str(campaign_id))
    return updated.data[0]


@router.post("/{campaign_id}/cancel", response_model=CampaignResponse)
async def cancel_campaign(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Cancel a campaign and remove pending deliveries."""
    result = client_db.table("campaigns").select("status").eq(
        "id", str(campaign_id)
    ).maybe_single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if result.data["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Campaign already finished")
    
    # Cancel pending deliveries
    client_db.table("campaign_deliveries").update({
        "status": "skipped"
    }).eq("campaign_id", str(campaign_id)).in_(
        "status", ["pending", "queued"]
    ).execute()
    
    updated = client_db.table("campaigns").update({
        "status": "cancelled",
        "completed_at": datetime.utcnow().isoformat()
    }).eq("id", str(campaign_id)).execute()
    
    logger.info("Campaign cancelled", campaign_id=str(campaign_id))
    return updated.data[0]


# ===========================================
# Deliveries Endpoints
# ===========================================

@router.get("/{campaign_id}/deliveries", response_model=List[DeliveryResponse])
async def list_campaign_deliveries(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, le=500),
    offset: int = 0
):
    """List deliveries for a campaign."""
    query = client_db.table("campaign_deliveries").select("*").eq(
        "campaign_id", str(campaign_id)
    )
    
    if status_filter:
        query = query.eq("status", status_filter)
    
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data or []


@router.get("/{campaign_id}/deliveries/failed", response_model=List[DeliveryResponse])
async def list_failed_deliveries(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase,
    limit: int = Query(100, le=500)
):
    """List failed deliveries for retry analysis."""
    result = client_db.table("campaign_deliveries").select("*").eq(
        "campaign_id", str(campaign_id)
    ).eq("status", "failed").order("created_at", desc=True).limit(limit).execute()
    
    return result.data or []


@router.post("/{campaign_id}/deliveries/retry-failed")
async def retry_failed_deliveries(
    campaign_id: UUID,
    current_user: CurrentUser,
    client_db: ClientSupabase
):
    """Reset failed deliveries to pending for retry."""
    result = client_db.table("campaign_deliveries").update({
        "status": "pending",
        "error_code": None,
        "error_message": None,
        "retry_count": 0
    }).eq("campaign_id", str(campaign_id)).eq("status", "failed").execute()
    
    count = len(result.data) if result.data else 0
    logger.info("Failed deliveries reset", campaign_id=str(campaign_id), count=count)
    
    return {"message": f"Reset {count} failed deliveries for retry"}
