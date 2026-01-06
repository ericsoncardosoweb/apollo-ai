"""
Apollo A.I. Advanced - Message Buffer Service (Anti-Picote)
===========================================================

Solves the "message picotage" problem where users send multiple 
messages in quick succession (text, text, audio, text) and naive
bots respond to each one separately.

ARCHITECTURE:
1. Webhook receives message → pushes to Redis buffer
2. Each push resets TTL (e.g., 8 seconds)
3. When TTL expires (user stopped typing), Redis publishes event
4. Worker consumes the "packet" of accumulated messages
5. Entire packet is sent to AI as single context

This uses Redis EXPIRE + Pub/Sub for reliable event-driven processing.
"""

import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Callable, Awaitable
import structlog

from app.db.redis import get_redis, RedisClient
from app.schemas.whatsapp import StandardMessage, BufferedMessagePacket
from app.core.config import settings

logger = structlog.get_logger()

# Buffer configuration
BUFFER_TTL_SECONDS = 8  # Wait 8 seconds of silence before processing
BUFFER_KEY_PREFIX = "buffer:chat:"
BUFFER_CHANNEL = "buffer:expired"


class MessageBufferService:
    """
    Anti-Picote Message Buffer using Redis.
    
    Accumulates messages from a chat until silence is detected,
    then emits a complete packet for AI processing.
    """
    
    def __init__(self):
        self._redis_client = None
        self._handlers: List[Callable[[BufferedMessagePacket], Awaitable[None]]] = []
        self._available = True
    
    async def _get_redis_client(self):
        """Get Redis client (async). Returns None if not available."""
        if not self._available:
            return None
        if self._redis_client is None:
            client = await get_redis()
            if client is None:
                self._available = False
                return None
            self._redis_client = client
        return self._redis_client
    
    def _get_buffer_key(self, tenant_id: str, chat_id: str) -> str:
        """Generate Redis key for message buffer"""
        return f"{BUFFER_KEY_PREFIX}{tenant_id}:{chat_id}"
    
    def _get_lock_key(self, tenant_id: str, chat_id: str) -> str:
        """Generate Redis key for processing lock"""
        return f"lock:buffer:{tenant_id}:{chat_id}"
    
    async def push_message(
        self, 
        tenant_id: str, 
        message: StandardMessage
    ) -> int:
        """
        Push a message to the buffer and reset TTL.
        
        Returns the current message count in buffer. Returns 0 if Redis unavailable.
        """
        redis = await self._get_redis_client()
        if redis is None:
            logger.warning("Redis not available, message not buffered")
            return 0
        
        key = self._get_buffer_key(tenant_id, message.chat_id)
        
        # Message data to store
        message_data = {
            "message_id": message.message_id,
            "chat_id": message.chat_id,
            "phone": message.phone,
            "content": message.content,
            "content_type": message.content_type,
            "media_url": message.media_url,
            "media_mime_type": message.media_mime_type,
            "media_duration_seconds": message.media_duration_seconds,
            "is_from_me": message.is_from_me,
            "timestamp": message.timestamp.isoformat(),
            "tenant_id": tenant_id,
        }
        
        try:
            # Add message to list
            await redis.rpush(key, json.dumps(message_data))
            
            # Reset TTL - this is the core of anti-picote
            await redis.expire(key, BUFFER_TTL_SECONDS)
            
            # Get current count
            count = await redis.llen(key)
            
            logger.info(
                "Message buffered",
                tenant_id=tenant_id,
                chat_id=message.chat_id,
                buffer_count=count,
                ttl=BUFFER_TTL_SECONDS
            )
            
            return count
        except Exception as e:
            logger.error("Error buffering message", error=str(e))
            return 0
    
    async def get_buffer(self, tenant_id: str, chat_id: str) -> Optional[BufferedMessagePacket]:
        """
        Get all buffered messages for a chat and clear the buffer.
        Uses distributed lock to prevent double-processing.
        """
        redis = await self._get_redis_client()
        if redis is None:
            return None
        
        key = self._get_buffer_key(tenant_id, chat_id)
        lock_key = self._get_lock_key(tenant_id, chat_id)
        
        try:
            # Try to acquire lock (5 second TTL)
            lock_acquired = await redis.set(
                lock_key, "1", ex=5, nx=True
            )
            
            if not lock_acquired:
                logger.debug("Buffer already being processed", chat_id=chat_id)
                return None
            
            try:
                # Get all messages atomically
                messages_raw = await redis.lrange(key, 0, -1)
                
                if not messages_raw:
                    return None
                
                # Delete the buffer
                await redis.delete(key)
                
                # Parse messages
                messages = []
                phone = ""
                first_timestamp = None
                last_timestamp = None
                total_duration = 0
                
                for raw in messages_raw:
                    data = json.loads(raw)
                    msg = StandardMessage(
                        message_id=data["message_id"],
                        chat_id=data["chat_id"],
                        phone=data["phone"],
                        content=data.get("content", ""),
                        content_type=data.get("content_type", "text"),
                        media_url=data.get("media_url"),
                        media_mime_type=data.get("media_mime_type"),
                        media_duration_seconds=data.get("media_duration_seconds"),
                        is_from_me=data.get("is_from_me", False),
                        timestamp=datetime.fromisoformat(data["timestamp"]),
                    )
                    messages.append(msg)
                    
                    if not phone:
                        phone = msg.phone
                    
                    ts = msg.timestamp
                    if first_timestamp is None or ts < first_timestamp:
                        first_timestamp = ts
                    if last_timestamp is None or ts > last_timestamp:
                        last_timestamp = ts
                    
                    if msg.media_duration_seconds:
                        total_duration += msg.media_duration_seconds
                
                if not messages:
                    return None
                
                return BufferedMessagePacket(
                    chat_id=messages[0].chat_id,
                    tenant_id=tenant_id,
                    phone=phone,
                    messages=messages,
                    total_duration_seconds=total_duration,
                    first_message_at=first_timestamp or datetime.utcnow(),
                    last_message_at=last_timestamp or datetime.utcnow(),
                )
            
            finally:
                # Release lock
                await redis.delete(lock_key)
        except Exception as e:
            logger.error("Error getting buffer", error=str(e))
            return None
    
    async def peek_buffer(self, tenant_id: str, chat_id: str) -> int:
        """Get current message count in buffer without consuming"""
        redis = await self._get_redis_client()
        if redis is None:
            return 0
        try:
            key = self._get_buffer_key(tenant_id, chat_id)
            return await redis.llen(key)
        except Exception:
            return 0
    
    async def clear_buffer(self, tenant_id: str, chat_id: str) -> bool:
        """Force clear a buffer (e.g., when handoff occurs)"""
        redis = await self._get_redis_client()
        if redis is None:
            return False
        try:
            key = self._get_buffer_key(tenant_id, chat_id)
            deleted = await redis.delete(key)
            return deleted > 0
        except Exception:
            return False
    
    def on_buffer_ready(
        self, 
        handler: Callable[[BufferedMessagePacket], Awaitable[None]]
    ):
        """Register a handler for when a buffer is ready for processing"""
        self._handlers.append(handler)
    
    async def _notify_handlers(self, packet: BufferedMessagePacket):
        """Notify all registered handlers"""
        for handler in self._handlers:
            try:
                await handler(packet)
            except Exception as e:
                logger.error(
                    "Buffer handler error",
                    error=str(e),
                    chat_id=packet.chat_id
                )


class BufferWatchdog:
    """
    Background task that monitors for expired buffers.
    Uses Redis keyspace notifications for efficiency.
    
    Alternative: Use Celery beat to poll for expired keys.
    """
    
    def __init__(self, buffer_service: MessageBufferService):
        self.buffer_service = buffer_service
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start watching for expired buffers"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._watch_loop())
        logger.info("Buffer watchdog started")
    
    async def stop(self):
        """Stop the watchdog"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Buffer watchdog stopped")
    
    async def _watch_loop(self):
        """
        Main watch loop using Redis keyspace notifications.
        
        Requires Redis to be configured with:
        notify-keyspace-events Ex
        """
        # Get Redis client
        redis = await self.buffer_service._get_redis_client()
        
        if redis is None:
            logger.warning("Redis not available, buffer watchdog disabled")
            self._running = False
            return
        
        try:
            # Subscribe to expired key events
            # Note: This requires Redis keyspace notifications enabled
            pubsub = redis.pubsub()
        
            # Subscribe to expired events for our buffer keys
            await pubsub.psubscribe("__keyevent@0__:expired")
            
            async for message in pubsub.listen():
                if not self._running:
                    break
                
                if message["type"] != "pmessage":
                    continue
                
                key = message.get("data", b"").decode() if message.get("data") else ""
                
                # Check if it's a buffer key
                if not key.startswith(BUFFER_KEY_PREFIX):
                    continue
                
                # Extract tenant_id and chat_id from key
                # Format: buffer:chat:{tenant_id}:{chat_id}
                parts = key.replace(BUFFER_KEY_PREFIX, "").split(":", 1)
                if len(parts) != 2:
                    continue
                
                tenant_id, chat_id = parts
                
                logger.info(
                    "Buffer expired, processing",
                    tenant_id=tenant_id,
                    chat_id=chat_id
                )
                
                # Get and process the buffer
                packet = await self.buffer_service.get_buffer(tenant_id, chat_id)
                if packet:
                    await self.buffer_service._notify_handlers(packet)
        
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Buffer watchdog error", error=str(e))
        finally:
            try:
                await pubsub.punsubscribe()
            except Exception:
                pass


# Singleton instance
_buffer_service: Optional[MessageBufferService] = None


def get_message_buffer() -> MessageBufferService:
    """Get singleton MessageBufferService instance"""
    global _buffer_service
    if _buffer_service is None:
        _buffer_service = MessageBufferService()
    return _buffer_service
