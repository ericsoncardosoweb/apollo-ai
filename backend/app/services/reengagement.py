"""
Apollo A.I. Advanced - Re-engagement Watchdog (Arremate)
========================================================

Monitors conversations and triggers re-engagement when:
1. Last message was from the AI/Agent (not the customer)
2. Time since last interaction exceeds configured threshold
3. Conversation is still open/active

This recovers "cold" leads that stopped responding.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Callable, Awaitable
from enum import Enum
import structlog

from app.db.supabase import get_supabase
from app.db.redis import get_redis
from app.core.config import settings

logger = structlog.get_logger()


class ReengagementReason(str, Enum):
    """Reasons for triggering re-engagement"""
    SILENCE_TIMEOUT = "silence_timeout"
    SCHEDULED = "scheduled"
    MANUAL = "manual"


class ReengagementEvent:
    """Event emitted when a conversation needs re-engagement"""
    
    def __init__(
        self,
        conversation_id: str,
        tenant_id: str,
        agent_id: str,
        phone: str,
        reason: ReengagementReason,
        attempt_number: int,
        last_message_at: datetime,
        silence_duration_minutes: int,
    ):
        self.conversation_id = conversation_id
        self.tenant_id = tenant_id
        self.agent_id = agent_id
        self.phone = phone
        self.reason = reason
        self.attempt_number = attempt_number
        self.last_message_at = last_message_at
        self.silence_duration_minutes = silence_duration_minutes
        self.created_at = datetime.utcnow()


class ReengagementConfig:
    """Per-agent re-engagement configuration"""
    
    def __init__(
        self,
        enabled: bool = True,
        delay_minutes: int = 120,  # 2 hours default
        max_attempts: int = 3,
        prompts: Optional[List[str]] = None,
        active_hours: tuple = (9, 21),  # 9 AM to 9 PM
    ):
        self.enabled = enabled
        self.delay_minutes = delay_minutes
        self.max_attempts = max_attempts
        self.prompts = prompts or [
            "Olá! Notei que ficou um pouco quieto por aqui. Posso ajudar em algo mais?",
            "Ei! Ainda está por aí? Lembrei de você e queria saber se posso ajudar.",
            "Oi! Só passando para verificar se você ainda precisa de alguma informação.",
        ]
        self.active_hours = active_hours


class ReengagementWatchdog:
    """
    Background service that monitors conversations for re-engagement.
    
    Architecture:
    1. Periodically scans conversations in 'open' status
    2. Checks if last message was from agent and silence exceeds threshold
    3. Respects max attempts and business hours
    4. Emits events for AI to generate contextual follow-up
    """
    
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._handlers: List[Callable[[ReengagementEvent], Awaitable[None]]] = []
        self._check_interval = 60  # Check every minute
    
    def on_reengagement_needed(
        self, 
        handler: Callable[[ReengagementEvent], Awaitable[None]]
    ):
        """Register a handler for re-engagement events"""
        self._handlers.append(handler)
    
    async def start(self):
        """Start the watchdog"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._watch_loop())
        logger.info("Re-engagement watchdog started")
    
    async def stop(self):
        """Stop the watchdog"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Re-engagement watchdog stopped")
    
    async def _watch_loop(self):
        """Main monitoring loop"""
        while self._running:
            try:
                await self._check_conversations()
            except Exception as e:
                logger.error("Re-engagement check error", error=str(e))
            
            await asyncio.sleep(self._check_interval)
    
    async def _check_conversations(self):
        """Check all eligible conversations for re-engagement"""
        supabase = get_supabase()
        now = datetime.utcnow()
        current_hour = now.hour
        
        # Get agents with re-engagement enabled
        agents_result = supabase.table("agents").select(
            "id, tenant_id, reengagement_enabled, reengagement_delay_minutes, "
            "reengagement_max_attempts, reengagement_prompts, business_hours"
        ).eq("reengagement_enabled", True).eq("status", "active").execute()
        
        if not agents_result.data:
            return
        
        for agent in agents_result.data:
            agent_id = agent["id"]
            tenant_id = agent["tenant_id"]
            delay_minutes = agent.get("reengagement_delay_minutes", 120)
            max_attempts = agent.get("reengagement_max_attempts", 3)
            
            # Check business hours
            business_hours = agent.get("business_hours", {})
            if business_hours.get("enabled"):
                start_hour = business_hours.get("start", 9)
                end_hour = business_hours.get("end", 21)
                if current_hour < start_hour or current_hour >= end_hour:
                    continue  # Outside business hours
            
            # Calculate threshold time
            threshold = now - timedelta(minutes=delay_minutes)
            
            # Find conversations that need re-engagement
            conversations = supabase.table("conversations").select(
                "id, phone_number, last_message_at, reengagement_attempts"
            ).eq(
                "agent_id", agent_id
            ).eq(
                "status", "active"
            ).eq(
                "mode", "ai"  # Only AI-handled conversations
            ).lt(
                "last_message_at", threshold.isoformat()
            ).lt(
                "reengagement_attempts", max_attempts
            ).execute()
            
            if not conversations.data:
                continue
            
            for conv in conversations.data:
                # Check if last message was from agent (not customer)
                last_msg = supabase.table("messages").select(
                    "sender_type"
                ).eq(
                    "conversation_id", conv["id"]
                ).order(
                    "created_at", desc=True
                ).limit(1).execute()
                
                if not last_msg.data:
                    continue
                
                # Only re-engage if WE sent the last message
                if last_msg.data[0]["sender_type"] not in ["ai", "agent", "human_agent"]:
                    continue
                
                # Create re-engagement event
                last_message_at = datetime.fromisoformat(
                    conv["last_message_at"].replace("Z", "+00:00")
                )
                silence_minutes = int((now - last_message_at).total_seconds() / 60)
                
                event = ReengagementEvent(
                    conversation_id=conv["id"],
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    phone=conv["phone_number"],
                    reason=ReengagementReason.SILENCE_TIMEOUT,
                    attempt_number=conv.get("reengagement_attempts", 0) + 1,
                    last_message_at=last_message_at,
                    silence_duration_minutes=silence_minutes,
                )
                
                # Increment attempt counter
                supabase.table("conversations").update({
                    "reengagement_attempts": event.attempt_number
                }).eq("id", conv["id"]).execute()
                
                # Notify handlers
                await self._emit_event(event)
    
    async def _emit_event(self, event: ReengagementEvent):
        """Emit re-engagement event to all handlers"""
        logger.info(
            "Re-engagement triggered",
            conversation_id=event.conversation_id,
            attempt=event.attempt_number,
            silence_minutes=event.silence_duration_minutes
        )
        
        for handler in self._handlers:
            try:
                await handler(event)
            except Exception as e:
                logger.error(
                    "Re-engagement handler error",
                    error=str(e),
                    conversation_id=event.conversation_id
                )
    
    async def trigger_manual(
        self, 
        conversation_id: str, 
        tenant_id: str
    ) -> bool:
        """Manually trigger re-engagement for a conversation"""
        supabase = get_supabase()
        
        conv = supabase.table("conversations").select(
            "id, agent_id, phone_number, last_message_at, reengagement_attempts"
        ).eq("id", conversation_id).eq("tenant_id", tenant_id).single().execute()
        
        if not conv.data:
            return False
        
        event = ReengagementEvent(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            agent_id=conv.data.get("agent_id"),
            phone=conv.data["phone_number"],
            reason=ReengagementReason.MANUAL,
            attempt_number=conv.data.get("reengagement_attempts", 0) + 1,
            last_message_at=datetime.fromisoformat(
                conv.data["last_message_at"].replace("Z", "+00:00")
            ),
            silence_duration_minutes=0,
        )
        
        await self._emit_event(event)
        return True


# Singleton instance
_watchdog: Optional[ReengagementWatchdog] = None


def get_reengagement_watchdog() -> ReengagementWatchdog:
    """Get singleton ReengagementWatchdog instance"""
    global _watchdog
    if _watchdog is None:
        _watchdog = ReengagementWatchdog()
    return _watchdog
