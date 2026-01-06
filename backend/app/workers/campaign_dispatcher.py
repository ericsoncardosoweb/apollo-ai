"""
Apollo A.I. Advanced - Campaign Dispatcher Worker
===================================================

Background worker that processes campaign deliveries:
1. Fetches pending deliveries
2. Applies intelligent delay between sends
3. Sends via WhatsApp gateway
4. Updates delivery status

Uses Redis for queue management and rate limiting.
"""

import asyncio
from typing import Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
import structlog
import redis.asyncio as redis

from app.core.config import settings
from app.services.intelligent_delay import get_delay_service, DelayStrategy
from app.services.whatsapp_sender import get_whatsapp_sender

logger = structlog.get_logger()


@dataclass
class DeliveryTask:
    """Delivery task from queue."""
    id: str
    campaign_id: str
    contact_id: str
    contact_phone: str
    contact_name: Optional[str]
    template_id: str
    batch_number: int


class CampaignDispatcher:
    """
    Campaign delivery dispatcher.
    
    Processes campaign deliveries with intelligent rate limiting
    and anti-ban protections.
    """
    
    REDIS_QUEUE_KEY = "campaign:delivery_queue"
    REDIS_PROCESSING_KEY = "campaign:processing"
    REDIS_RATE_LIMIT_KEY = "campaign:rate_limit:{campaign_id}"
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self._redis = redis_client
        self._delay_service = get_delay_service()
        self._sender = get_whatsapp_sender()
        self._running = False
        self._current_campaign: Optional[str] = None
    
    async def _get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
        return self._redis
    
    async def start(self):
        """Start the dispatcher worker."""
        logger.info("Campaign dispatcher starting")
        self._running = True
        
        while self._running:
            try:
                await self._process_next_batch()
            except Exception as e:
                logger.error("Dispatcher error", error=str(e))
                await asyncio.sleep(5)
    
    async def stop(self):
        """Stop the dispatcher worker."""
        logger.info("Campaign dispatcher stopping")
        self._running = False
    
    async def _process_next_batch(self):
        """Process the next batch of deliveries."""
        # Get running campaigns
        from app.db.supabase import get_supabase
        
        client = get_supabase()
        if not client:
            await asyncio.sleep(10)
            return
        
        # Find campaigns that need processing
        campaigns = client.table("campaigns").select(
            "id, batch_size, min_interval_seconds, max_interval_seconds, "
            "use_random_intervals, batch_pause_minutes, current_batch"
        ).eq("status", "running").execute()
        
        if not campaigns.data:
            await asyncio.sleep(5)
            return
        
        for campaign in campaigns.data:
            await self._process_campaign_batch(client, campaign)
    
    async def _process_campaign_batch(self, client, campaign: dict):
        """Process a single batch for a campaign."""
        campaign_id = campaign["id"]
        batch_size = campaign.get("batch_size", 10)
        current_batch = campaign.get("current_batch", 0)
        
        # Check daily limit
        redis_client = await self._get_redis()
        rate_key = self.REDIS_RATE_LIMIT_KEY.format(campaign_id=campaign_id)
        
        daily_sent = await redis_client.get(rate_key) or 0
        daily_limit = campaign.get("max_daily_volume", 200)
        
        if int(daily_sent) >= daily_limit:
            logger.info(
                "Campaign daily limit reached",
                campaign_id=campaign_id,
                sent=daily_sent,
                limit=daily_limit
            )
            return
        
        # Get pending deliveries for current batch
        deliveries = client.table("campaign_deliveries").select(
            "id, campaign_id, contact_id, contact_phone, contact_name, template_id"
        ).eq("campaign_id", campaign_id).eq(
            "batch_number", current_batch
        ).eq("status", "pending").limit(batch_size).execute()
        
        if not deliveries.data:
            # Move to next batch
            client.table("campaigns").update({
                "current_batch": current_batch + 1
            }).eq("id", campaign_id).execute()
            
            # Check if campaign is complete
            remaining = client.table("campaign_deliveries").select(
                "id", count="exact"
            ).eq("campaign_id", campaign_id).eq("status", "pending").execute()
            
            if remaining.count == 0:
                client.table("campaigns").update({
                    "status": "completed",
                    "completed_at": datetime.utcnow().isoformat()
                }).eq("id", campaign_id).execute()
                logger.info("Campaign completed", campaign_id=campaign_id)
            else:
                # Batch pause
                pause_minutes = campaign.get("batch_pause_minutes", 15)
                logger.info(
                    "Batch pause",
                    campaign_id=campaign_id,
                    pause_minutes=pause_minutes
                )
                await asyncio.sleep(pause_minutes * 60)
            
            return
        
        # Process deliveries with delay
        for delivery in deliveries.data:
            try:
                await self._send_delivery(client, campaign, delivery)
                
                # Increment rate limit counter
                await redis_client.incr(rate_key)
                await redis_client.expire(rate_key, 86400)  # 24h TTL
                
                # Apply intelligent delay
                await self._delay_service.delay(
                    min_seconds=campaign.get("min_interval_seconds", 30),
                    max_seconds=campaign.get("max_interval_seconds", 50),
                    strategy=DelayStrategy.RANDOM_RANGE if campaign.get("use_random_intervals", True) else DelayStrategy.FIXED,
                    delay_id=f"campaign_{campaign_id}"
                )
                
            except Exception as e:
                logger.error(
                    "Delivery failed",
                    campaign_id=campaign_id,
                    delivery_id=delivery["id"],
                    error=str(e)
                )
                # Mark as failed
                client.table("campaign_deliveries").update({
                    "status": "failed",
                    "error_message": str(e),
                    "retry_count": 1
                }).eq("id", delivery["id"]).execute()
    
    async def _send_delivery(self, client, campaign: dict, delivery: dict):
        """Send a single delivery."""
        delivery_id = delivery["id"]
        campaign_id = campaign["id"]
        template_id = delivery.get("template_id")
        contact_id = delivery.get("contact_id")
        contact_phone = delivery["contact_phone"]
        
        # Mark as sending
        client.table("campaign_deliveries").update({
            "status": "sending",
            "queued_at": datetime.utcnow().isoformat()
        }).eq("id", delivery_id).execute()
        
        # Get template contents
        contents = client.table("template_contents").select("*").eq(
            "template_id", template_id
        ).order("position").execute()
        
        if not contents.data:
            raise ValueError(f"Template {template_id} has no contents")
        
        # Get contact data for variable substitution
        contact = None
        if contact_id:
            contact_result = client.table("contacts").select("*").eq(
                "id", contact_id
            ).maybe_single().execute()
            contact = contact_result.data
        
        # Send each content item
        sent_message_ids = []
        resolved_contents = []
        
        for content in contents.data:
            content_type = content["content_type"]
            
            # Handle interval (delay between messages)
            if content_type == "interval":
                interval_seconds = content.get("interval_seconds", 30)
                await self._delay_service.delay(
                    min_seconds=interval_seconds,
                    max_seconds=interval_seconds,
                    strategy=DelayStrategy.FIXED,
                    delay_id=f"template_interval_{delivery_id}"
                )
                continue
            
            # Resolve variables
            resolved_content = await self._resolve_variables(content, contact)
            resolved_contents.append(resolved_content)
            
            # Send via WhatsApp
            message_id = await self._sender.send_message(
                phone=contact_phone,
                content_type=content_type,
                content=resolved_content.get("content"),
                media_url=resolved_content.get("media_url"),
                caption=resolved_content.get("media_caption"),
                send_as_voice=resolved_content.get("send_as_voice", False)
            )
            
            if message_id:
                sent_message_ids.append(message_id)
        
        # Update delivery as sent
        client.table("campaign_deliveries").update({
            "status": "sent",
            "sent_at": datetime.utcnow().isoformat(),
            "content_sent": resolved_contents,
            "whatsapp_message_ids": sent_message_ids
        }).eq("id", delivery_id).execute()
        
        # Update campaign stats
        client.table("campaigns").update({
            "sent_count": client.table("campaigns").select("sent_count").eq(
                "id", campaign_id
            ).single().execute().data["sent_count"] + 1,
            "last_sent_at": datetime.utcnow().isoformat()
        }).eq("id", campaign_id).execute()
        
        # Increment template usage
        client.table("message_templates").update({
            "usage_count": client.table("message_templates").select("usage_count").eq(
                "id", template_id
            ).single().execute().data["usage_count"] + 1,
            "last_used_at": datetime.utcnow().isoformat()
        }).eq("id", template_id).execute()
        
        logger.info(
            "Delivery sent",
            campaign_id=campaign_id,
            delivery_id=delivery_id,
            phone=contact_phone[:8] + "****"
        )
    
    async def _resolve_variables(self, content: dict, contact: Optional[dict]) -> dict:
        """Resolve template variables with contact data."""
        import re
        
        result = content.copy()
        variable_pattern = re.compile(r'\{\{(\w+)\}\}')
        
        # Build variable values
        values = {}
        if contact:
            values = {
                "nome": contact.get("name", ""),
                "primeiro_nome": contact.get("name", "").split()[0] if contact.get("name") else "",
                "telefone": contact.get("phone", ""),
                "email": contact.get("email", ""),
                "empresa": contact.get("company_name", ""),
                "cargo": contact.get("company_role", ""),
                "cidade": contact.get("address_city", ""),
                "estado": contact.get("address_state", ""),
            }
        
        # System variables
        now = datetime.now()
        values["data_hoje"] = now.strftime("%d/%m/%Y")
        values["hora_atual"] = now.strftime("%H:%M")
        
        # Replace in text content
        if result.get("content"):
            text = result["content"]
            for var in variable_pattern.findall(text):
                text = text.replace(f"{{{{{var}}}}}", str(values.get(var, "")))
            result["content"] = text
        
        # Replace in caption
        if result.get("media_caption"):
            caption = result["media_caption"]
            for var in variable_pattern.findall(caption):
                caption = caption.replace(f"{{{{{var}}}}}", str(values.get(var, "")))
            result["media_caption"] = caption
        
        return result


# Singleton instance
_dispatcher: Optional[CampaignDispatcher] = None


def get_campaign_dispatcher() -> CampaignDispatcher:
    """Get singleton CampaignDispatcher instance."""
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = CampaignDispatcher()
    return _dispatcher


# ===========================================
# CLI Entry Point
# ===========================================

async def run_dispatcher():
    """Run the campaign dispatcher as a standalone worker."""
    dispatcher = get_campaign_dispatcher()
    
    try:
        await dispatcher.start()
    except KeyboardInterrupt:
        await dispatcher.stop()


if __name__ == "__main__":
    asyncio.run(run_dispatcher())
