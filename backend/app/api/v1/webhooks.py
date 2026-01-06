"""
Apollo A.I. Advanced - Webhooks Endpoints (WhatsApp Message Receiver)
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
import structlog
import json

from app.db.supabase import fetch_one, insert_one, update_one, get_supabase

logger = structlog.get_logger()
router = APIRouter()


class WhatsAppMessage(BaseModel):
    """Incoming WhatsApp message schema."""
    phone: str
    message: str
    message_id: Optional[str] = None
    timestamp: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None


@router.post("/whatsapp/{tenant_slug}")
async def receive_whatsapp_message(
    tenant_slug: str,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """
    Receive incoming WhatsApp messages.
    
    This is the webhook endpoint that WhatsApp gateways (Evolution, Z-API, etc.)
    will call when a new message arrives.
    """
    # Get tenant by slug
    tenant = await fetch_one("tenants", {"slug": tenant_slug})
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if tenant.get("status") != "active":
        raise HTTPException(status_code=403, detail="Tenant is not active")
    
    # Parse request body
    body = await request.json()
    
    # Normalize message format (different gateways have different formats)
    message_data = normalize_gateway_payload(body, tenant.get("whatsapp_gateway"))
    
    if not message_data:
        logger.warning("Could not parse webhook payload", payload=body)
        return {"status": "ignored"}
    
    # Find or create conversation
    conversation = await get_or_create_conversation(
        tenant_id=tenant["id"],
        phone_number=message_data["phone"]
    )
    
    # Save message
    message = await insert_one("messages", {
        "conversation_id": conversation["id"],
        "tenant_id": tenant["id"],
        "sender_type": "user",
        "content": message_data["message"],
        "content_type": message_data.get("media_type", "text"),
        "media_url": message_data.get("media_url"),
        "external_id": message_data.get("message_id"),
    })
    
    # Update conversation
    await update_one("conversations", {"id": conversation["id"]}, {
        "last_message_at": message["created_at"],
        "message_count": conversation.get("message_count", 0) + 1
    })
    
    # Queue for AI processing if in AI mode
    if conversation.get("mode") == "ai":
        # TODO: Send to Celery queue for AI processing
        pass
    
    logger.info(
        "WhatsApp message received",
        tenant_id=tenant["id"],
        conversation_id=conversation["id"],
        phone=message_data["phone"]
    )
    
    return {"status": "received", "message_id": message["id"]}


def normalize_gateway_payload(payload: dict, gateway: Optional[str]) -> Optional[dict]:
    """Normalize different gateway payloads to a common format."""
    
    if gateway == "evolution":
        # Evolution API format
        if "data" in payload:
            data = payload["data"]
            return {
                "phone": data.get("key", {}).get("remoteJid", "").split("@")[0],
                "message": data.get("message", {}).get("conversation", ""),
                "message_id": data.get("key", {}).get("id"),
            }
    
    elif gateway == "zapi":
        # Z-API format
        return {
            "phone": payload.get("phone"),
            "message": payload.get("text", {}).get("message", payload.get("text", "")),
            "message_id": payload.get("messageId"),
        }
    
    elif gateway == "meta":
        # Meta Cloud API format
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [{}])
        if messages:
            msg = messages[0]
            return {
                "phone": msg.get("from"),
                "message": msg.get("text", {}).get("body", ""),
                "message_id": msg.get("id"),
            }
    
    # Fallback: try common field names
    return {
        "phone": payload.get("phone") or payload.get("from") or payload.get("sender"),
        "message": payload.get("message") or payload.get("text") or payload.get("body"),
        "message_id": payload.get("message_id") or payload.get("id"),
    }


async def get_or_create_conversation(tenant_id: str, phone_number: str) -> dict:
    """Get existing active conversation or create a new one."""
    
    # Look for active conversation with this phone
    client = get_supabase()
    result = client.table("conversations").select("*").eq(
        "tenant_id", tenant_id
    ).eq(
        "phone_number", phone_number
    ).in_(
        "status", ["active", "waiting"]
    ).order(
        "last_message_at", desc=True
    ).limit(1).execute()
    
    if result.data:
        return result.data[0]
    
    # Create new conversation
    # Get default agent for tenant
    agent = await fetch_one("agents", {"tenant_id": tenant_id, "is_default": True})
    
    conversation = await insert_one("conversations", {
        "tenant_id": tenant_id,
        "agent_id": agent["id"] if agent else None,
        "phone_number": phone_number,
        "channel": "whatsapp",
        "status": "active",
        "mode": "ai",
    })
    
    # Auto-create lead
    await insert_one("crm_leads", {
        "tenant_id": tenant_id,
        "whatsapp": phone_number,
        "phone": phone_number,
        "source": "whatsapp",
    })
    
    return conversation


@router.get("/whatsapp/{tenant_slug}/verify")
async def verify_webhook(tenant_slug: str, hub_mode: str = None, hub_challenge: str = None):
    """Webhook verification for Meta Cloud API."""
    if hub_mode == "subscribe" and hub_challenge:
        return int(hub_challenge)
    return {"status": "ok"}
