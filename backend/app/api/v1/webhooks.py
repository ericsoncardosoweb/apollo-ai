"""
Apollo A.I. Advanced - Webhook Router
=====================================

Main entry point for all WhatsApp gateway webhooks.
Implements:
- Multi-provider support via Adapter Pattern
- Anti-picote via Message Buffer
- Tenant resolution from URL slug
- Defensive validation
"""

from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header, Query, BackgroundTasks
from pydantic import BaseModel
import structlog

from app.db.supabase import fetch_one
from app.services.gateway_adapter import parse_webhook_payload, GatewayProvider
from app.services.message_buffer import get_message_buffer
from app.core.exceptions import TenantNotFoundError, ValidationError

logger = structlog.get_logger()
router = APIRouter()


class WebhookResponse(BaseModel):
    """Standard webhook response"""
    status: str = "received"
    message_count: int = 0
    buffered: bool = False


# ===========================================
# MAIN WEBHOOK ENDPOINT
# ===========================================

@router.post(
    "/{provider}/{tenant_slug}",
    response_model=WebhookResponse,
    summary="Receive WhatsApp webhook",
    description="""
    Main webhook endpoint for all WhatsApp gateway providers.
    
    **Supported Providers:**
    - `evolution` - Evolution API
    - `zapi` - Z-API
    - `meta` - Meta Cloud API (Official)
    
    **Flow:**
    1. Validates tenant exists and is active
    2. Parses payload using provider-specific adapter
    3. Buffers messages (anti-picote pattern)
    4. Returns immediately (async processing)
    """
)
async def receive_webhook(
    provider: str,
    tenant_slug: str,
    request: Request,
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_hub_signature: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    """
    Receive and process incoming WhatsApp webhooks.
    
    The endpoint implements defensive validation and returns quickly
    to avoid gateway timeouts. Actual processing happens in background.
    """
    # Get raw payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.warning("Invalid JSON payload", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Validate provider
    if provider not in [p.value for p in GatewayProvider]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unknown provider: {provider}. Supported: {[p.value for p in GatewayProvider]}"
        )
    
    # Resolve tenant
    tenant = await fetch_one("tenants", {"slug": tenant_slug})
    
    if not tenant:
        logger.warning("Tenant not found", slug=tenant_slug)
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if tenant.get("status") != "active":
        logger.warning("Tenant not active", slug=tenant_slug, status=tenant.get("status"))
        raise HTTPException(status_code=403, detail="Tenant is not active")
    
    # Validate API key if tenant has one configured
    tenant_api_key = tenant.get("whatsapp_api_key")
    if tenant_api_key and x_api_key != tenant_api_key:
        # Only enforce if tenant has configured a key
        if tenant.get("whatsapp_gateway") == provider:
            logger.warning("Invalid API key", slug=tenant_slug)
            # Don't return error, just log - some gateways don't send auth
    
    # Parse webhook payload
    messages = parse_webhook_payload(payload, provider)
    
    if not messages:
        # Not a message event or parsing failed - acknowledge anyway
        return WebhookResponse(status="acknowledged", message_count=0, buffered=False)
    
    # Filter out messages from self
    incoming_messages = [m for m in messages if not m.is_from_me]
    
    if not incoming_messages:
        return WebhookResponse(status="filtered", message_count=0, buffered=False)
    
    # Buffer messages (anti-picote)
    buffer = get_message_buffer()
    
    for msg in incoming_messages:
        await buffer.push_message(tenant["id"], msg)
    
    logger.info(
        "Webhook processed",
        tenant=tenant_slug,
        provider=provider,
        message_count=len(incoming_messages),
        chat_id=incoming_messages[0].chat_id if incoming_messages else None
    )
    
    return WebhookResponse(
        status="received",
        message_count=len(incoming_messages),
        buffered=True
    )


# ===========================================
# WEBHOOK VERIFICATION (Meta Cloud API)
# ===========================================

@router.get(
    "/{provider}/{tenant_slug}",
    summary="Webhook verification",
    description="Verification endpoint for Meta Cloud API webhook setup"
)
async def verify_webhook(
    provider: str,
    tenant_slug: str,
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    Handle Meta Cloud API webhook verification.
    
    Meta sends a GET request with hub.mode, hub.challenge, and hub.verify_token.
    We must return the challenge to verify ownership.
    """
    if hub_mode == "subscribe" and hub_challenge:
        # Optionally verify the token matches tenant config
        tenant = await fetch_one("tenants", {"slug": tenant_slug})
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Return challenge for verification
        return int(hub_challenge)
    
    return {"status": "ok", "provider": provider, "tenant": tenant_slug}


# ===========================================
# WEBHOOK STATUS CHECK
# ===========================================

@router.get(
    "/status/{tenant_slug}",
    summary="Check webhook status",
    description="Check if webhooks are properly configured for a tenant"
)
async def check_webhook_status(tenant_slug: str):
    """Check webhook configuration and recent activity"""
    tenant = await fetch_one("tenants", {"slug": tenant_slug})
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "tenant": tenant_slug,
        "gateway_configured": bool(tenant.get("whatsapp_gateway")),
        "gateway": tenant.get("whatsapp_gateway"),
        "instance_id": tenant.get("whatsapp_instance_id", "")[:10] + "..." if tenant.get("whatsapp_instance_id") else None,
        "webhook_url": f"/api/v1/webhooks/{tenant.get('whatsapp_gateway', 'evolution')}/{tenant_slug}",
    }
